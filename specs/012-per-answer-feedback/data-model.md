# Data Model: Feedback per antwoord, en vastleggen hoe een antwoord tot stand kwam

**Date**: 2026-10-19 | **Feature**: [spec.md](spec.md) | **Branch**: `012-per-answer-feedback`

## Overzicht

Migratie **017** breidt twee bestaande tabellen uit en voegt één functie toe. Geen nieuwe
tabellen. Alle kolommen zijn nullable (geen backfill nodig); `feedback_interactions.updated_at`
is de enige `NOT NULL DEFAULT`-kolom (backfillt bestaande rijen). De unieke constraint
één-per-gesprek vervalt; de uniekheid verhuist naar `(message_id, user_id)` (research #1, #2).
Toepassen via de **Supabase MCP** (AGENTS.md), vóór elke deploy (research #13).

## Migratie 017 — `supabase/migrations/017_per_answer_feedback.sql`

```sql
BEGIN;

-- messages: answer provenance (all nullable; absent for pre-012 answers)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS rewritten_query text,
  ADD COLUMN IF NOT EXISTS verification jsonb,
  ADD COLUMN IF NOT EXISTS latency_ms integer;

-- feedback_interactions: per-answer feedback
ALTER TABLE feedback_interactions
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- reason CHECK via benoemde constraint (idempotent: DO-block met pg_constraint-lookup)
-- CHECK passes when reason IS NULL (thumbs-up rows)
ALTER TABLE feedback_interactions
  ADD CONSTRAINT feedback_interactions_reason_check
  CHECK (reason IN ('incorrect','incomplete','wrong_source','misunderstood','other'));

-- one rating per user per ANSWER replaces one per conversation (research #2)
ALTER TABLE feedback_interactions
  DROP CONSTRAINT IF EXISTS one_feedback_per_user_per_conversation;

-- full unique index: NULLs are distinct → old conversation-wide rows never conflict;
-- PostgREST upsert can target it (research #1)
CREATE UNIQUE INDEX IF NOT EXISTS feedback_interactions_message_id_user_id_key
  ON feedback_interactions (message_id, user_id);

-- house pattern: updated_at maintained by trigger (001 update_updated_at, research #7)
DROP TRIGGER IF EXISTS set_updated_at ON feedback_interactions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON feedback_interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: replace insert policy, add update policy (research #3)
DROP POLICY IF EXISTS "Users can insert own feedback" ON feedback_interactions;

CREATE POLICY "Users can insert feedback on own conversation messages"
  ON feedback_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM messages
    JOIN conversations ON conversations.id = messages.conversation_id
    WHERE messages.id = feedback_interactions.message_id
      AND conversations.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own feedback"
  ON feedback_interactions FOR UPDATE
  USING (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM messages
    JOIN conversations ON conversations.id = messages.conversation_id
    WHERE messages.id = feedback_interactions.message_id
      AND conversations.user_id = auth.uid()
  ))
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM messages
    JOIN conversations ON conversations.id = messages.conversation_id
    WHERE messages.id = feedback_interactions.message_id
      AND conversations.user_id = auth.uid()
  ));

-- Admin overview (research #4, #5): SECURITY DEFINER, fixed search_path
CREATE OR REPLACE FUNCTION public.get_feedback_review()
RETURNS TABLE (
  feedback_id uuid, message_id uuid, conversation_id uuid,
  assistant_id uuid, assistant_name text,
  reason text, feedback text,
  question text, answer text,
  verification jsonb, rewritten_query text, latency_ms integer,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.message_id, f.conversation_id,
         c.assistant_id, a.name,
         f.reason, f.feedback,
         q.content, m.content,
         m.verification, m.rewritten_query, m.latency_ms,
         f.created_at, f.updated_at
  FROM feedback_interactions f
  JOIN messages m   ON m.id = f.message_id
  JOIN conversations c ON c.id = m.conversation_id
  JOIN ai_assistants a  ON a.id = c.assistant_id
  LEFT JOIN LATERAL (
    SELECT m0.content FROM messages m0
    WHERE m0.conversation_id = m.conversation_id
      AND m0.role = 'user'
      AND m0.created_at < m.created_at
    ORDER BY m0.created_at DESC
    LIMIT 1
  ) q ON true
  WHERE f.message_id IS NOT NULL
    AND f.thumbs_up = false
    AND f.organization_id = get_user_org_id()
    AND is_org_admin()
$$;

COMMIT;
```

RLS-positie: `feedback_interactions` blijft RLS-enabled; SELECT-policies ongewijzigd
(004); INSERT vervangen + UPDATE nieuw; DELETE blijft default-deny. De
policy-subquery's rijden mee op de bestaande `messages`/`conversations`-RLS — alleen
berichten uit eigen gesprekken zijn zichtbaar en dus beoordeelbaar (FR-007). De
service role (Edge Function) blijft boven RLS verheven en heeft geen feedback-acties.

## Entiteiten

| Entiteit | Tabel | Sleutelvelden | Relaties |
|---|---|---|---|
| Bericht | `messages` | id, conversation_id, role, content, sources, created_at, **+ rewritten_query text?, + verification jsonb?, + latency_ms int?** (017) | 1 gesprek → N berichten; verificatievorm: `{ grounded: boolean, confidence: number, issues: string[] }` of null |
| Antwoordoordeel | `feedback_interactions` | id, conversation_id, assistant_id, user_id, organization_id, thumbs_up, feedback?, created_at, **+ message_id uuid? (017, ON DELETE CASCADE), + reason text? (017, CHECK), + updated_at (017, trigger)** | 0..1 per gebruiker per **antwoord** (unieke index `(message_id, user_id)`); oude rijen: message_id NULL (gespreksbreed, bewaard) |
| Beheerdersoverzicht | `get_feedback_review()` | afgeleide functie — negatieve antwoordoordelen per organisatie met vraag/antwoord/verificatie/latency/assistent/datum | alleen beheerders (`is_org_admin()`, 015), alleen eigen organisatie (`get_user_org_id()`, 001) |

### Validatieregels (server-side afgedwongen)

| Regel | Handhaving |
|---|---|
| `reason ∈ {incorrect, incomplete, wrong_source, misunderstood, other}` of NULL | CHECK-constraint 017 (CHECK slaagt bij NULL → duim-omhoog-rijen zonder reden zijn valide) |
| maximaal één oordeel per gebruiker per antwoord | unieke index `(message_id, user_id)`; client-upsert overschrijft (FR-005) |
| inserts/updates alleen op berichten in eigen gesprekken | RLS INSERT/UPDATE-policy 017 (via bestaande messages/conversations-RLS) |
| duim-omhoog wist reden en toelichting | client stuurt `reason: null, feedback: null` in de upsert-payload (research #8) |
| reden verplicht bij duim omlaag (UI) | UI-blokkering; DB laat `reason` NULL toe bij `thumbs_up = false` (bewust: DB dwingt geen cross-veld af, UI is de autoriteit — research #3-minimaliteit) |
| `latency_ms` = ontvangen vraag → voltooid antwoord | Edge Function berekent `Date.now() - started` vóór de assistentbericht-insert (research #6) |
| `updated_at` | trigger `set_updated_at` bij elke UPDATE (001-patroon); niet door de client te beïnvloeden |

### Upsert-semantiek (PostgREST merge-duplicates)

| Aspect | Waarde |
|---|---|
| Conflict-target | `message_id, user_id` → `?on_conflict=message_id,user_id` |
| Arbiter | unieke index `feedback_interactions_message_id_user_id_key` (volledig, research #1) |
| Payload (altijd volledig) | `message_id, conversation_id, assistant_id, user_id, organization_id, thumbs_up, reason, feedback` — `created_at`/`updated_at` niet meesturen (defaults/trigger) |
| Wijzigen omlaag→omhoog | zelfde payload met `thumbs_up: true, reason: null, feedback: null` — oude reden/toelichting gewist |
| Rechten | INSERT-policy + UPDATE-policy gelden beide (research #3) |
| Race | gelijktijdige inserts op zelfde antwoord: één wint, ander valt terug op DO UPDATE — geen dubbele rijen mogelijk |

## UI-datamodel: AnswerFeedback (alleen React-state)

```text
per antwoord (role=assistant, status=sent):
  unrated  → klik omhoog  → upsert(thumbs_up=true)  → rated-up
  unrated  → klik omlaag  → form open (radio-reason verplicht + optionele toelichting)
  form     → Versturen    → upsert(thumbs_up=false, reason, feedback?) → rated-down
  form     → Annuleren    → unrated (niets opgeslagen; bestaand oordeel blijft)
  rated-up → klik omlaag  → form open (geen prefill, research-aanname) → Versturen → rated-down
  rated-down → klik omhoog → upsert(thumbs_up=true, reason:null, feedback:null) → rated-up
  rated-down → klik omlaag  → form open (geen prefill) → Versturen → overschrijft
```

- Duimknoppen: `aria-pressed` (actieve duim `true`), NL toegankelijk label
  ("Antwoord is nuttig"/"Antwoord is niet nuttig"), native `<button>`, zichtbare focus
  (constitution IV, FR-012).
- Redenkeuze: native radio's in een fieldset met legend "Wat ging er mis?" (u-vorm);
  knoppen "Versturen" (disabled zonder reden) en "Annuleren".
- Oordeel na herladen: `useMessageFeedback(conversationId)` levert de rij per
  `message_id`; de actieve duim zet `aria-pressed="true"` (FR-006).
- Opslagfout: NL toast, component blijft in de oude staat (FR-008).

## `src/types/database.types.ts` (handmatig bijgewerkt conform huisstijl)

| Tabel/sectie | Wijziging |
|---|---|
| `messages` Row/Insert/Update | `rewritten_query: string \| null`, `verification: Record<string, unknown> \| null`, `latency_ms: number \| null` |
| `feedback_interactions` Row/Insert/Update | `message_id: string \| null`, `reason: string \| null`, `updated_at: string`; Insert/Update-varianten met `?` |
| `feedback_interactions` Relationships | + `feedback_interactions_message_id_fkey` → `messages(id)` |
| `Functions` | + `get_feedback_review` (Args: geen; Returns: rijvorm boven) — vervangt `Record<string, never>` |

## Verificatie na migratie (SQL, via Supabase MCP / SQL-editor)

```sql
-- Kolommen bestaan (messages):
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'messages'
  AND column_name IN ('rewritten_query','verification','latency_ms');
-- Verwacht: 3 rijen

-- Constraint vervallen, index bestaat:
SELECT conname FROM pg_constraint WHERE conname = 'one_feedback_per_user_per_conversation';
SELECT indexname FROM pg_indexes WHERE tablename = 'feedback_interactions';
-- Verwacht: 0 rijen resp. … message_id_user_id_key aanwezig

-- RLS staat nog aan (F-01):
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('messages','feedback_interactions');
-- Verwacht: true × 2

-- Policies:
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'feedback_interactions' ORDER BY cmd;
-- Verwacht: 2× SELECT, 1× INSERT, 1× UPDATE (geen DELETE)
```