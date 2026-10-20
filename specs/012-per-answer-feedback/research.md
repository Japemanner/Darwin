# Research: Feedback per antwoord, en vastleggen hoe een antwoord tot stand kwam

**Date**: 2026-10-19 | **Feature**: [spec.md](spec.md) | **Branch**: `012-per-answer-feedback`

Alle onbekenden zijn onderzocht in de codebase (`src/pages/ChatPage.tsx`,
`src/components/chat/MessageBubble.tsx`, `src/components/chat/MessageList.tsx`,
`src/hooks/queries.ts`, `src/hooks/useAuth.ts`, `src/types/database.types.ts`,
`supabase/functions/rag-chat/index.ts`, migraties 001/002/004/015/016,
`tests/e2e/fixtures.ts`, `tests/e2e/chat-page.spec.ts`, `playwright.config.ts`,
`package.json`) en tegen de Supabase/PostgREST/PostgreSQL-documentatie. Geen
onopgeloste NEEDS CLARIFICATION. Bevindingen per beslissing.

## 1. Unieke index volledig i.p.v. partieel — anders werkt de REST-upsert niet

**Decision**: unieke index over `(message_id, user_id)` **zonder** `WHERE message_id IS NOT NULL`:

```sql
CREATE UNIQUE INDEX feedback_interactions_message_id_user_id_key
  ON feedback_interactions (message_id, user_id);
```

**Rationale**: de route vraagt een upsert vanuit de UI én een partieel unieke index.
Die twee sluiten elkaar uit: supabase-js `.upsert(..., { onConflict: 'message_id,user_id' })`
stuurt PostgREST `?on_conflict=message_id,user_id`, en PostgREST kan in dat
conflict-target géén index-predicaat meegeven. PostgreSQL vereist dat predicaat juist
wél om een partieel unieke index te kunnen afleiden (index inference) — het gevolg zou
fout 42P10 ("no unique or exclusion constraint matching the ON CONFLICT specification")
zijn. Een **volledige** unieke index is gedragsequivalent: PostgreSQL behandelt NULL's
in een unieke index als verschillend (default `NULLS DISTINCT`, ook op PG15), dus de
oude gespreksbrede rijen (`message_id IS NULL`) conflicteren nooit — exact wat de
partiële voorwaarde beveiligde. Voor nieuwe rijen (altijd een `message_id`) dwingt de
index "één oordeel per gebruiker per antwoord" (FR-005) af. Dit is de enige afwijking
van de letterlijke route-tekst en wordt bij de afronding expliciet gemeld.

**Alternatives considered**:
- Partieel index + upsert via een extra RPC-functie (`INSERT … ON CONFLICT (…) WHERE …
  DO UPDATE`) — afgewezen: extra DB-functie voor iets dat de generieke REST-upsert
  kan, terwijl de volledige index hetzelfde gedrag geeft (constitution VI).
- Partieel index + select-then-insert/update in de client — afgewezen: twee
  round-trips en een race-window dat daarna alsnog door de unique-violation moet
  worden opgevangen.

## 2. De bestaande constraint één-per-gesprek moet vervallen

**Decision**: migratie 017 verwijdert
`ALTER TABLE feedback_interactions DROP CONSTRAINT IF EXISTS one_feedback_per_user_per_conversation;`
(004:20).

**Rationale**: die constraint dwingt `UNIQUE (conversation_id, user_id)` af. Zonder
verwijdering kan een gebruiker het tweede antwoord in hetzelfde gesprek niet meer
beoordelen — precies het probleem dat deze feature oplost ("na één duim kan niets meer
beoordeeld worden"). De oude data voldoet al aan de constraint (maximaal één rij per
combinatie), dus verwijderen verandert niets aan bestaande rijen; de nieuwe index uit
#1 neemt de rol van per-antwoord-uniekheid over.

## 3. RLS: INSERT-policy vervangen, UPDATE-policy toegevoegd (OR-semantiek)

**Decision**: de bestaande `"Users can insert own feedback"`-policy (004) wordt
**vervangen** door een policy die eist dat het bericht in een gesprek van `auth.uid()`
zit; daarnaast komt er een UPDATE-policy met dezelfde eis. Beide gebruiken
`auth.uid() = user_id AND EXISTS (SELECT 1 FROM messages JOIN conversations … WHERE
messages.id = feedback_interactions.message_id AND conversations.user_id = auth.uid())`.

**Rationale**: Postgres-policies zijn permissief-OR: een rij mag zodra **één**
INSERT-policy slaagt. De oude policy (`auth.uid() = user_id`) naast de nieuwe laten
bestaan zou gespreksbrede inserts (`message_id IS NULL`) blijven toestaan — inclusief
het oude gat dat de policy het gesprek zelf niet controleerde. Vervangen sluit beide
af. De EXISTS-subquery rijdt mee op de bestaande RLS van `messages` (001:323-331):
de subquery ziet alleen berichten uit eigen gesprekken, dus alleen die zijn
beoordeelbaar — de acceptatiecriteria FR-007/SC-006 worden op databaseniveau afgedwongen.
Een UPDATE-policy is nieuw nodig voor de upsert (`ON CONFLICT DO UPDATE`): PostgREST
handhaaft bij merge-duplicates zowel de INSERT- als de UPDATE-policy. SELECT-policies
blijven ongewijzigd (eigen feedback lezen voor de UI; beheerdersorg-lezen blijft staan
en is onschadelijk — het overzicht loopt via de functie uit #4). DELETE blijft
default-deny (niet gevraagd; wijzigen = overschrijven).

**Alternatives considered**:
- Oude INSERT-policy laten staan tijdens de overgang — afgewezen: permissive-OR maakt
  de nieuwe policy zinloos (zie rationale); het rollout-gat wordt opgevangen in #12.
- `message_id IS NOT NULL` als aparte CHECK in de policy — overbodig: de EXISTS-fail
  bij `message_id IS NULL` heeft hetzelfde effect (een NULL-berij verwijst naar niets).

## 4. get_feedback_review(): SECURITY DEFINER met vaste search_path, geen view

**Decision**:

```sql
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
AS $$ … $$;
```

De body joint `feedback_interactions` → `messages` (antwoord) → `conversations` →
`ai_assistants` en een `LEFT JOIN LATERAL` voor de vraag (zie #5), met
`WHERE f.message_id IS NOT NULL AND f.thumbs_up = false AND f.organization_id =
get_user_org_id() AND is_org_admin()`. Geen parameter: de organisatie komt uit
`get_user_org_id()` (001:171) en de rol uit `is_org_admin()` (015:31).

**Rationale**: de route-kanttekening klopt en is overgenomen: een view met
`security_invoker` blijft leeg voor beheerders, want de RLS op `messages` toont alleen
berichten uit eigen gesprekken. `SECURITY DEFINER` doorbreekt dat expliciet, maar
controleert daarna zelf: niet-beheerders krijgen **niets** (lege set, geen foutmelding
met details), en de org-scoping zit in de WHERE — een beheerder van organisatie A ziet
nooit feedback van B (FR-011, SC-005). De vaste `search_path = public` voorkomt
search_path-hijacking via aanroepende rollen (Supabase-richtlijn; `auth.uid()` binnen
de helperfuncties is schema-gekwalificeerd). Het resultaat bevat naast de route-lijst
(feedback, vraag, antwoord, verificatie, herschreven zoekvraag, assistent, datum)
**ook `latency_ms`**: FR-011 noemt de responstijd expliciet in het overzicht en de
responstijd staat al op dezelfde berichtsrij — één kolom extra maakt het overzicht
volledig analyseerbaar (de probleemstelling van de spec). `datum` = `created_at` +
`updated_at` van het oordeel (geven + laatste wijziging, conform de spec).

**Alternatives considered**:
- View + `security_invoker` met permissie-uitbreiding op `messages` — afgewezen:
  verbreedt leesrechten op alle berichten; de route verwerpt dit terecht.
- `SECURITY INVOKER`-functie — zelfde probleem als de view (RLS levert niets).
- Policy-variant: `messages`-RLS uitzetten voor beheerders — afgewezen: constitution
  III; organisatiebrede leesrechten op berichten is precies wat RLS moet voorkomen.

## 5. De vóórgaande vraag: laatste user-bericht vóór het antwoord

**Decision**: binnen de functie een `LEFT JOIN LATERAL`:

```sql
LEFT JOIN LATERAL (
  SELECT m0.content FROM messages m0
  WHERE m0.conversation_id = m.conversation_id
    AND m0.role = 'user'
    AND m0.created_at < m.created_at
  ORDER BY m0.created_at DESC
  LIMIT 1
) q ON true
```

**Rationale**: "de bijbehorende gebruikersvraag (het voorgaande user-bericht in
hetzelfde gesprek)" is per definitie het jongste gebruikersbericht vóór het antwoord.
`LEFT JOIN` (i.p.v. INNER) omdat historische antwoorden zonder bewaarde vraag
 theoretisch kunnen bestaan: het overzicht toont dan `question IS NULL` in plaats van
dat de hele rij verdwijnt — geen stille datadaling. Sinds 011 ontstaat een antwoord
nooit zonder direct voorafgaande vraag (plan 011 FR-010); antwoorden vóór 012 kunnen
de vraag wel degelijk missen.

**Alternatives considered**:
- Vraag koppelen via een expliciete `parent_message_id`-kolom — afgewezen: schemawijziging
  plus backfill die niets toevoegt; de tijdsordening is binnen één gesprek betrouwbaar
  (vraag en antwoord zijn aparte transacties met microseconden-`created_at`).

## 6. Antwoordgegevens vastleggen in rag-chat — meetpunt en JSONB-vorm

**Decision**: bij de bestaande v2-insert van het assistentbericht
(`rag-chat/index.ts:423-432`) komen drie velden bij:

```ts
rewritten_query: normalized.rewritten_query,   // string | null
verification: normalized.verification,          // { grounded, confidence, issues } | null (jsonb)
latency_ms: Date.now() - started,               // integer
```

`latency_ms` wordt direct vóór de insert berekend (`Date.now() - started`, `started`
staat al op regel 182): ontvangen vraag → voltooid antwoord, precies de
specificatiedefinitie. De verificatie wordt opgeslagen als het reeds genormaliseerde
object; ontbrekende velden (`null`) worden als `null` opgeslagen — FR-010's
"ontbrekend is geen fout". De n8n-koppeling verandert niet; het v2-responscontract
naar de client verandert niet (de client gebruikt de metadata niet); het legacy-v1-pad
raakt de kolommen niet. Logging blijft code + id's + duur (constitution III).

**Alternatives considered**:
- `latency_ms` alleen om de n8n-call meten — afgewezen: de spec definieert
  vraag-tot-antwoord; `started` meet dat exact en bestaat al.
- Aparte `answer_metadata`-tabel — afgewezen: 1-op-1 met het bericht, altijd samen
  gelezen; kolommen op `messages` zijn het eenvoudigste model (ook de route-keuze).

## 7. updated_at via het bestaande huis-triggerpatroon

**Decision**: `feedback_interactions.updated_at timestamptz NOT NULL DEFAULT now()`
(backfillt bestaande rijen bij de ALTER) plus de bestaande triggerfunctie
`update_updated_at()` (001:346-352):

```sql
DROP TRIGGER IF EXISTS set_updated_at ON feedback_interactions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON feedback_interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Rationale**: identiek aan het patroon op `conversations`/`ai_assistants` (001:355-374)
— de client hoeft `updated_at` niet mee te sturen in de upsert en kan het ook niet
vervalsen. `NOT NULL DEFAULT now()` is verplicht voor de backfill van bestaande rijen
en voor inserts (de upsert stuurt de kolom niet mee).

## 8. Frontend-datastromen: één query per gesprek, één upsert-mutatie

**Decision**:
- `useMessageFeedback(conversationId)` in `src/hooks/queries.ts`: `queryKey
  ['message-feedback', conversationId]`, selecteert `feedback_interactions` waar
  `conversation_id = X` **én** `user_id = profile.id` **én** `message_id` niet null —
  alle oordelen van het gesprek in één request. De userId komt intern uit `useAuth()`
  (zelfde patroon als `useFeedbackInteraction` vandaag). Elke `AnswerFeedback`-instantie
  roept dezelfde hook op met dezelfde key: TanStack Query dedupliceert naar één
  netwerkrequest voor het hele gesprek.
- Mutatie `useUpsertMessageFeedback`: `supabase.from('feedback_interactions')
  .upsert(payload, { onConflict: 'message_id,user_id' })` met een **volledige** payload
  (zie contract): bij duim omhoog expliciet `reason: null, feedback: null`, zodat een
  wijziging omlaag→omhoog de reden en toelichting wist (FR-005 "volledig overschrijven");
  `onSuccess` verversen van `['message-feedback', conversationId]`; fout → NL
  fout-toast, knoppen blijven bruikbaar (FR-008, constitution V).
- De `conversation_id` voor de upsert: ChatPage houdt naast `routeConversationId` de
  `conversation_id` uit het laatste antwoordresultaat bij (`result.conversationId`,
  gezet vóór de `navigate(replace)` naar `/chat/:id`). Daarmee is de id ook in de
  frames tussen eerste antwoord en routerparameter beschikbaar — geen upsert zonder
  gespreks-id.

**Rationale**: één query per gesprek (route-eis) plus react-query-deduplicatie houdt
het requestvolume gelijk aan één feedbackbalk-vroeger. De volledige payload is nodig
omdat PostgREST `ON CONFLICT DO UPDATE` alleen de meegestuurde kolommen zet — reden
en toelichting weglaten zou oude waarden laten staan bij een wijziging naar omhoog.

**Alternatives considered**:
- Per antwoord een eigen query — afgewezen: N requests per gesprek; de route vraagt
  expliciet één query.
- Optimistische updates — afgewezen: niet gevraagd; invalidate na succes is het
  bestaande patroon (`useVote` daargelaten, dat een eigen score-afleiding heeft).

## 9. AnswerFeedback-component: plaatsing en props

**Decision**: nieuw `src/components/chat/AnswerFeedback.tsx`, gemonteerd **in
`MessageBubble`** onder elk assistentbericht met `status === 'sent'` (naast de
bestaande kopieerknop in dezelfde kolom). Props: `{ conversationId, assistantId,
messageId }`; `user_id`/`organization_id` komen intern uit `useAuth()`.
`ChatPage` leidt het actieve gespreks-id (#8) en `viewAssistant.id` door via
`MessageList` → `MessageBubble`. Geen duimknoppen bij `pending`/`failed` (FR-001) —
`MessageBubble` mount `AnswerFeedback` alleen voor `role === 'assistant' && status
=== 'sent'`.

**Rationale**: MessageBubble is waar de per-bericht-context leeft (`message.id` = de
bericht-rij-id die ook als `message_id` geldt — zowel uit de v2-respons als na herladen
uit `useConversationMessages`); de visualisatie "onder elk antwoord" valt daarmee
binnen de berichtkolom. Twee extra props door MessageList is de kleinste ingreep
(constitution VI: geen refactor van MessageList/MessageBubble eromheen).

**Alternatives considered**:
- Mounten in `MessageList` buiten de bubbel — afgewezen: feedback hoort visueel bij
  het antwoord (in de 80%-kolom), niet als aparte rij tussen de berichten.
- Eigen Supabase-calls binnen de component zonder hook — afgewezen: cache-deling
  tussen alle antwoorden in het gesprek vereist de react-query-laag (#8).

## 10. Gespreksbrede balk en useFeedbackInteraction verwijderen

**Decision**: de hele feedbackbalk-blok uit `ChatPage` verdwijnt (state
`feedbackText`/`isFeedbackSubmitting`/`showFeedbackInput`/`thumbsUpSelected`/
`thumbsDownSelected`/`existingFeedback` + `useFeedbackInteraction`-aanroep + de drie
handlers + het UI-blok + `hasAssistantMessages`), inclusief de imports (`ThumbsUp`,
`ThumbsDown`, `X`, `Textarea`, `FeedbackInteraction`). De hook
`useFeedbackInteraction` (queries.ts:325-340) heeft geen andere consumenten (grep:
alleen ChatPage.tsx:88) en wordt verwijderd. `resetChatState` houdt de
feedback-resetregels niet langer nodig. De oude rijen blijven via de bestaande
SELECT-policy leesbaar voor de eigenaar; er is geen UI die ze nog toont (FR-009).

**Rationale**: route-opdracht + FR-009. De je-vorm-teksten in de oude balk
("Bedankt voor je feedback!") verdwijnen mee — de nieuwe component is volledig
u-vorm (constitution I), dus die uitzondering uit plan 011 vervalt.

## 11. Redenkeuze zonder nieuwe dependency: native radio-inputs

**Decision**: het duim-omlaag-formulier gebruikt native
`<input type="radio">`-elementen met `<Label>` (shadcn `label` bestaat al:
`@radix-ui/react-label`), plus de bestaande `Textarea` en `Button`. Vijf redenen met
NL-labels (u-vorm) en Engelse codes (constitution I):

| Code (DB) | Label (UI) |
|---|---|
| `incorrect` | Onjuist |
| `incomplete` | Onvolledig |
| `wrong_source` | Bron klopt niet |
| `misunderstood` | Vraag niet begrepen |
| `other` | Anders |

**Rationale**: `@radix-ui/react-radio-group` staat niet in `package.json` en de
randvoorwaard verbiedt nieuwe dependencies. Native radio's zijn volledig
toetsenbordbedienbaar en semantisch correct (fieldset/legend + radios = WCAG-basis).
De codes volgen exact de route-CHECK.

## 12. E2E: seeding via de echte Supabase-client van het testaccount

**Decision**: nieuw `tests/e2e/answer-feedback.spec.ts` — afwijking van het mock-
patroon in `chat-page.spec.ts`, als expliciete route-opdracht. De test:

1. laadt `.env.local` (Node 20: `process.loadEnvFile`, bewaakt met `existsSync`) voor
   `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`;
2. maakt een supabase-js-client (bestaande productie-dependency) en logt in met
   `signInWithPassword` met `E2E_EMAIL`/`E2E_PASSWORD` (hetzelfde account als de
   `page`-fixture inlogt in de browser);
3. seedt per test een gesprek + één vraag-antwoordpaar (twee antwoorden voor het
   scenario "per antwoord") via REST — voldoet automatisch aan de RLS (eigen
   gesprek); `rag-chat` is niet nodig;
4. opent `/chat/<conversation_id>` in de browser (dezelfde gebruiker via PKCE-login
   uit `fixtures.ts`) en doorloopt de UI tegen de echte database;
5. ruimt in een `afterEach`/`afterAll` op via één `DELETE conversations` — cascade
   (001:133, en de nieuwe `message_id`-FK) verwijdert berichten én feedback rijen.

Scenario's conform de route: (a) duim omhoog per antwoord — bij twee antwoorden
wordt er één beoordeeld, de andere blijft onaangeraakt; (b) duim omlaag met reden
zonder toelichting; (c) een oordeel wijzigen; (d) na herladen staat het oordeel er
nog. De mocked specs uit 011 (`chat-page.spec.ts` mockt `**/rest/v1/feedback_interactions**`
naar `null`) blijven ongewijzigd werken: de oude route-mock vangt `GET`s van de
verwijderde hook niet meer op (hook is weg), de nieuwe `useMessageFeedback`-GET wordt
door die mock beantwoord — `null`/leeg resultaat betekent "nog geen oordeel",
wat de geteste flows niet breekt. (ChatPage toont na de verwijdering van de balk geen
afhankelijkheid meer van die mock, en AnswerFeedback rendert per antwoord "onbeoordeeld".)

**Rationale**: per-antwoord feedback, upsert-conflicten en RLS zijn juist
database-interacties — mocken zou de kern van de feature onbewijsbaar maken. De
seeding schrijft testdata in het productieproject; dat is het expliciete route-keuze,
met cleanup via cascade en herkenbare titels (`E2E …`). `fullyParallel: false`
(playwright.config.ts:5) voorkomt parallelle self-interferentie.

**Alternatives considered**:
- Alles mocken zoals chat-page.spec — afgewezen: de route zegt letterlijk dat seeding
  via de Supabase-client van het testaccount moet; upsert/RLS-gedrag is het bewijsdoel.
- aparte Supabase-branch per testrun — buiten bereik; één productieproject is de
  gegeven randvoorwaarde (quickstart 011).

## 13. Rolloutvolgorde en het breekraam voor de oude productiebalk

**Decision**: volgorde = (1) migratie 017 via Supabase MCP, (2) rag-chat deploy via
MCP, (3) frontend naar develop → preview → main (Netlify). Tussen stap 1 en stap 3
kan de oude productiebalk een fout-toast geven bij duim geven: de oude INSERT-policy
is vervangen (#3), dus een gespreksbrede insert (`message_id IS NULL`) faalt met
42501. Dat raam is minuten tot uren, raakt een functie die deze feature juist
verwijdert, en corrumpeert niets (de oude balk toont al gegeven feedback wél — de
SELECT-policies blijven).

**Rationale**: het alternatief (oude INSERT-policy laten staan tot na de
frontend-deploy) maakt de nieuwe RLS-eis tot die tijd niet-afdwingbaar (permissive-OR,
#3) — de keuze valt binnen de 009-lijn van gedocumenteerde cutover-raampjes
(decisions/2026-10-14-secure-n8n-proxy.md). Migratie eerst is sowieso verplicht: de
nieuwe frontend (kolommen) en de Edge Function (nieuwe velden) breken zonder 017
met 42703-fouten.

**Alternatives considered**:
- Tweefasenmigratie (policies later strakker) — afgewezen: extra migratie + releasestaat
  voor een UI die dagen later verdwijnt; niet minimal scope.

## 14. Wat er niet verandert (grenscontrole)

- `rag-client.ts` en het v2-responscontract: ongewijzigd — de client gebruikt
  `verification`/`rewritten_query` uit de respons niet (geen UI-weergave, buiten scope).
- `MessageContent`, bronnenweergave, CONCEPT-label: ongewijzigd (constitution II).
- n8n: geen enkele wijziging (randvoorwaarde).
- `feedback_interactions`-SELECT-policies, Geschiedenis-pagina, roadmap/overige
  tabellen: ongewijzigd.
- Geen nieuwe npm-dependencies; alleen bestaande imports (supabase-js in tests is al
  een productie-dependency).