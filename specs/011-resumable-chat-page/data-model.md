# Data Model: Chat als eigen pagina met hervatbare gesprekken

**Date**: 2026-10-16 | **Feature**: [spec.md](spec.md) | **Branch**: `011-resumable-chat-page`

## Overzicht

Deze feature voegt **één kolom** toe op een bestaande tabel en verplaatst
gespreks-/berichtopslag van de browser naar de Edge Function. Geen nieuwe tabellen,
geen nieuwe RLS-policies, geen policy-wijzigingen.

## Nieuw database-object

```sql
-- 016_assistant_example_questions.sql
ALTER TABLE ai_assistants
  ADD COLUMN IF NOT EXISTS example_questions TEXT[] NOT NULL DEFAULT '{}';
```

- `NOT NULL DEFAULT '{}'`: alle bestaande rijen zijn direct valide (lege lijst);
  geen backfill nodig.
- `ADD COLUMN IF NOT EXISTS` is idempotent (patroon `002_rag_assistant_management.sql:28`).
- Toepassen via de **Supabase MCP** (AGENTS.md: alle schema-wijzigingen via MCP).
- RLS: kolommen vallen onder de bestaande tabel-policies — SELECT org-breed,
  schrijven sinds migratie 015 admin-only. `example_questions` vraagt dus géén
  nieuwe policy.
- `src/types/database.types.ts`: `example_questions: string[]` in
  Row/Insert/Update van `ai_assistants` (handmatig bijgewerkt conform de bestaande
  stijl van het bestand).

## Entiteiten

| Entiteit | Tabel | Sleutelvelden | Relaties |
|---|---|---|---|
| Assistent | `ai_assistants` | id, organization_id, name, description?, system_prompt, icon, type (`chat`\|`agent`\|`voice`\|`risico_analyse`), n8n_webhook_url?, is_active, created_by, **+ example_questions text[]** (016) | 1 organisatie → N assistenten; N↔N kennisbronnen |
| Gesprek | `conversations` | id, user_id, assistant_id, **title**, created_at, updated_at (trigger `set_updated_at`, `001:373-374`) | eigendom: één gebruiker + één assistent; 1→N berichten |
| Bericht | `messages` | **id (client-gegenereerde uuid als idempotie-sleutel, v2)**, conversation_id, role (`user`\|`assistant`), content, sources (JSONB, `002:28`), created_at | hoort bij één gesprek |
| Feedback | `feedback_interactions` | ongewijzigd (004) | 0..1 per gebruiker per gesprek |

### Validatieregels (server-side afgedwongen, contract: [contracts/rag-chat.md](contracts/rag-chat.md))

| Regel | Handhaving |
|---|---|
| `message`: niet-leeg na trim, max 10.000 tekens | Edge Function VALIDATION (bestaand, `index.ts:183`) |
| `message_id`: uuid | Edge Function VALIDATION (nieuw) |
| `conversation_id` indien aanwezig: uuid + eigendom (`user_id = auth user`, `assistant_id`) | Edge Function FORBIDDEN via RLS-read (bestaand, `index.ts:223-230`) |
| `assistant_id`: bestaat, zelfde organisatie, `is_active` | Edge Function FORBIDDEN (bestaand, `index.ts:213-220`) |
| Titels: `trim().slice(0, 80)` + `'…'` alleen bij afkapping | Edge Function bij gespreksaanmaak (research #12) |
| `example_questions`: max 4, niet-leeg na trim | UI-admin-modal (blokkeert opslaan > 4); kolom zelf accepteert elke text[] |

### Nieuwe schrijfverantwoordelijkheid (Edge Function, service role ná eigendomscontrole)

| Actie | Voorheen (browser) | Voortaan (rag-chat v2) |
|---|---|---|
| Gesprek aanmaken | client-REST-insert, title "Chat met X" | server, alléén zonder bestaand `message_id`/`conversation_id`; titel = eerste vraag |
| Gebruikersbericht opslaan | client-REST-insert vóór de call | server-upsert met `id = message_id`, `ON CONFLICT DO NOTHING` — idempotent |
| Assistentbericht opslaan | client-REST-insert fire-and-forget ná de call | server-insert bij antwoordsucces (`.select().single()` → id + created_at in respons) |
| `conversations.updated_at` | n.v.t. | server-update per gespreksbeurt (trigger bevestigt) |

RLS-positie: de browser verliest géén rechten (policies blijven staan), maar de
nieuwe flow schrijft niet meer vanuit de browser; de Edge Function schrijft met de
service role nadat `authN` (JWT), profiel/organisatie, assistent (org, actief) en
gesprek (eigenaar + assistent) zijn gecontroleerd. Berichten-history leest
onveranderd via de userClient (RLS-scoped).

## UI-datamodel: ChatMessage (alleen in React-state, niet in de database)

```ts
interface ChatMessage {
  id: string            // = message_id (user) | server-id (assistant)
  role: 'user' | 'assistant'
  content: string
  sources: Record<string, unknown> | null
  created_at: string
  status: 'pending' | 'sent' | 'failed'
  error?: { code: string; message: string }  // alleen bij status === 'failed' (user)
}
```

### State transitions

```text
versturen (Enter / voorbeeldvraag / kopie-vrije flow):
  nieuw ChatMessage (status pending, id = crypto.randomUUID())  →  zichtbaar in de lijst
  askAssistant({ assistantId, conversationId?, messageId, message })
    succes:  pending → sent; + assistant-ChatMessage (status sent, uit
             assistant_message in de respons); nieuw-modus: navigate replace
             naar /chat/<conversation_id>
    fout:    pending → failed (error = RagClientError NL-tekst);
             bericht blijft staan met "Opnieuw proberen"
"Opnieuw proberen": failed → pending → (zelfde message_id, zelfde request) → sent | failed
herladen (bestaand-modus): lijst seedt volledig sent uit useConversationMessages
```

- `message_id` leeft uitsluitend in component-state (geen localStorage/sessionStorage —
  constitution III); bij unmount/terugkeer is alleen de serverstate waarheid.
- Gespreks-state in ChatPage: `null` (nieuw-modus) → `{ id, title, assistant }` na
  eerste geslaagde beurt; seed in bestaand-modus uit `useConversation`.

## Adresmodel (constitution III: id-only)

| Adres | Betekenis | Parameter |
|---|---|---|
| `/chat/new/:assistantId` | nieuw, leeg gesprek | assistent-uuid |
| `/chat/:conversationId` | bestaand gesprek (vast adres) | gesprek-uuid |

Geen vraag-, antwoord- of klanttekst komt ooit in een adres; `/chat/new` zonder id
resolves naar `:conversationId = "new"` → "Gesprek niet gevonden" (graceful).