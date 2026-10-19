# Research: Chat als eigen pagina met hervatbare gesprekken

**Date**: 2026-10-16 | **Feature**: [spec.md](spec.md) | **Branch**: `011-resumable-chat-page`

Alle onbekenden zijn onderzocht in de codebase (`src/App.tsx`, `src/pages/AssistantsPage.tsx`,
`supabase/functions/rag-chat/index.ts`, `src/lib/rag-client.ts`, `src/hooks/queries.ts`,
migraties 001/002/004/007/013/015, `src/types/database.types.ts`, `tests/e2e/*`,
`playwright.config.ts`, `src/lib/sanitize.ts`, `src/components/layout/AppShell.tsx`).
Geen onopgeloste NEEDS CLARIFICATION. Bevindingen per beslissing.

## 1. Routes: twee dieptes, geen conflict

**Decision**: `/chat/new/:assistantId` (3 segmenten) en `/chat/:conversationId`
(2 segmenten) naast elkaar in `src/App.tsx` binnen `AppShell`, beide lazy naar de
nieuwe `src/pages/ChatPage.tsx`. ChatPage leest de params en onderscheidt de modus
op aanwezigheid van `assistantId` vs `conversationId`. De "Chat"-knop navigeert met
`navigate(\`/chat/new/${a.id}\`)`.

**Rationale**: react-router-dom v6 rangschikt routes op segmentdiepte en
statisch-boven-dynamisch; omdat de twee patronen een verschillend aantal segmenten
hebben kan `/chat/new/abc` alleen op de nieuwe-route matchen en `/chat/abc` alleen
op de gespreksroute — geen volgorde-probleem. De URL `/chat/new` (zonder id) valt op
`:conversationId` met de waarde "new" → gespreksquery leeg → "Gesprek niet gevonden"
(graceful, geen lege pagina). Navigatie binnen `AppShell` houdt auth-guarding en
layout intact; `pathname.startsWith` in `AppShell.tsx:69` matcht `/chat/*` op geen
nav-item, dus geen nav-wijziging nodig (constitution VI).

**Alternatives considered**:
- `/assistants/:id/chat`-variant — afgewezen: de route voert letterlijk `/chat/new/:id`
  en `/chat/:id` op; geen reden af te wijken.
- Query-params (`/chat?id=…`) — afgewezen: geen vaste adressen bij herladen-terugknop;
  path-params zijn de standaard voor hervatbare resources.

## 2. Retry-pad: message_id is de idempotie-sleutel vóór gespreksaanmaak

**Decision**: De Edge Function resolveert het gesprek in deze volgorde:
(a) zoek het bericht op `message_id` (service role, PK-lookup) — bestaat het, dan is
dit een retry en is `row.conversation_id` de autoritatieve gespreks-id (de
`conversation_id` uit de request wordt genegeerd);
(b) bestaat het bericht niet en bevat de request een `conversation_id`, dan die;
(c) anders: nieuw gesprek aanmaken (titel = eerste vraag, zie #12).
Daarna volgt altijd de eigendomscontrole op het gevonden gesprek (userClient-RLS-read:
bestaat, `user_id = auth user`, `assistant_id = assistantId`) → anders `FORBIDDEN`,
en de upsert van het gebruikersbericht (alleen als het bericht nog niet bestaat).

**Rationale**: Het retry-scenario uit user story 3 werkt letterlijk zonder dat de
client de gespreks-id kent: bij de eerste poging (nieuw gesprek) slaagt de server in
het aanmaken van het gesprek en opslaan van de vraag, maar faalt het antwoord → de
error-response bevat géén `conversation_id`, dus de pagina blijft op
`/chat/new/:assistantId`. "Opnieuw proberen" verstuurt exact dezelfde request (zelfde
`message_id`, wéér zonder `conversation_id`). Zonder deze lookup zou de server een
tweede gesprek aanmaken met dezelfde titel, de vraag-upsert DO NOTHING doen (id
bestaat al — maar in het oude gesprek), en het antwoord in het nieuwe gesprek
opslaan: vraag en antwoord in verschillende gesprekken en een zombiegesprek. Met de
lookup herstelt de retry in hetzelfde gesprek, bevat de n8n-history de vraag, en
wordt het paar vraag-antwoord compleet. De eigendomscontrole achteraf vangt af: een
retry met een `message_id` van een andere gebruiker wordt via de RLS-read geweigerd
(FORBIDDEN). Dit verfijnt de route-opdracht "Upsert … met id = message_id (ON CONFLICT
DO NOTHING)" zonder de semantiek te veranderen — de upsert blijft idempotent.

**Alternatives considered**:
- `conversation_id` meesturen in error-responses zodat de client die bij de retry
  gebruikt — afgewezen: vergroot het error-contract en de client-state; de
  server-side lookup lost het op zonder UI-wijziging en dekt bovendien het
  lost-response-scenario (server succesvol, client ziet error).
- Client maakt het gesprek vooraf aan (zoals nu in de browser) — afgewezen: de route
  verplaatst gespreksaanmaak expliciet naar de server (feature-doel: geen
  half-opgeslagen browserstates).

## 3. Vraag wordt vóór het antwoord opgehaald bewaard; spec bijgesteld

**Decision**: De server upsert het gebruikersbericht vóór de n8n-call (exact de
route-volgorde), leest daarna de historie (laatste 20, inclusief de huidige vraag —
zelfde deterministische patroon als vandaag, `AssistantsPage.tsx:483-485`:
"Persist the user message first so the server-side history read is deterministic"),
haalt het antwoord op en slaat het assistentbericht pas bij succes op. De spec is op
dit punt bijgesteld: FR-010, SC-002, twee edge cases en de betreffende aanname
zeggen nu: een antwoord ontstaat nooit zonder vraag; een vraag zonder antwoord is
tijdelijk en idempotent herstelbaar via "Opnieuw proberen".

**Rationale**: De oorspronkelijke acceptatiecriteria uit de feature-opdracht luiden:
"Gebruikers- en assistentberichten worden serverside opgeslagen in de dezelfde
aanroep die het antwoord ophaalt. Een herhaalde poging met hetzelfde bericht-id maakt
geen dubbel bericht." Dat is exact wat dit ontwerp doet. De strengere lezing in de
eerste spec-versie ("mislukt de aanroep, dan wordt geen van beide opgeslagen") was een
interpretatie bij het schrijven van de spec; de technische route (opdrachtgever,
na de spec geschreven) kiest expliciet de opslag-vóór-fetch-volgorde, consistent met
het bestaande deterministische-historie-patroon en met de retry-fix uit #2. Met
`message_id`-first-resolutie is de enige resterende inconsistente toestand "vraag
zonder antwoord" — tijdelijk, zelfherstellend via retry, en oneindig veel beter dan
de huidige browsermatige half-states (fire-and-forget assistentopslag). De
aanpassing is gedocumenteerd in de spec (zelfde patroon als 010-research #5, waar een
onjuiste spec-aanname bij het plannen werd gecorrigeerd) en in het
voltooiingsrapport gemarkeerd ter goedkeuring.

**Alternatives considered**:
- Beide berichten pas na succes opslaan (vraag in-memory aan de historie-payload
  toevoegen) — voldoet aan de oude FR-010-tekst maar wijkt af van de expliciete
  route-volgorde en van het bestaande historie-patroon; afgewezen.

## 4. Rollout zonder breuk: legacy-requestpath in de Edge Function

**Decision**: De Edge Function accepteert requests **zonder** `message_id` als
legacy-pad: dan is `conversation_id` verplicht (zoals nu), worden er géén berichten
opgeslagen, en krijgt de client de oude responsvorm
(`{ answer, sources, verification, rewritten_query }`). De oude productie-client
merkt daar niets van (verstuurt geen `message_id`, krijgt de oude vorm terug). Het
legacy-pad krijgt een comment met verwijderingsscenario (weghalen zodra een latere
feature rag-chat raakt). Releasevolgorde: migratie → Edge Function → frontend
(quickstart.md).

**Rationale**: Het v2-contract is in twee richtingen brekend: (a) `message_id`
verplicht zou elke huidige productieclient op VALIDATION laten stranden; (b) de
nieuwe responsvorm (antwoord genest onder `assistant_message`) faalt de zod-parse
van de oude client. Alleen met een request-side shunt én een responsvorm per pad
is de Edge Function tijdens de rollout achterwaarts compatibel. De shim is klein
(±10 regels branching) en tijdelijk gemarkeerd; zonder shim breekt óf de oude client
(edge eerst) óf alle nieuwe gesprekken (frontend eerst) gedurende het deploy-venster.
Dit is dezelfde afweging als 009 (legacy `knowledgeSourceName` bleef meegaan "totdat
n8n is overgeschakeld") — productie-continuïteit gaat vóór contractzuiverheid
tijdens de overgang, met expliciete verwijderingsnotitie.

**Alternatives considered**:
- Geen compatibiliteit, frontend eerst deployen (venster van gefaalde nieuwe
  gesprekken) — afgewezen: productie is live in gebruik door adviseurs; de shim
  maakt het venster nul.
- Dubbele responsvorm in één antwoord (oude + nieuwe velden) voor alle clients —
  afgewezen: oude clients sturen geen `message_id`, dus hebben ze sowieso het
  legacy-pad; mengvormen maken het contract onnodig dubbelzinnig.

## 5. ChatPage: lokale bericht-state, genesteld bij React Query, navigate-replace

**Decision**: ChatPage houdt een lokale berichtenlijst bij
(`ChatMessage`: bestaande `Message`-velden + `status: 'pending' | 'sent' | 'failed'`
+ optionele `error`). In de bestaand-modus seedt de lijst zich uit
`useConversationMessages` (reset-effect op `conversationId`-wissel); in de
nieuw-modus start de lijst leeg. Na een geslaagde versturing: berichten lokaal
bijgewerkt (pending → sent + assistentbericht toegevoegd), `invalidateQueries` op
`['messages', conversationId]` en `['conversations', …]`, en in de nieuw-modus
`navigate('/chat/' + conversationId, { replace: true })` — met `replace` zodat de
lege `/chat/new`-stap uit de browsergeschiedenis verdwijnt en "terug" naar het
assistentenoverzicht gaat (FR-004/US7).

**Rationale**: De route schrijft dit gedrag voor ("Na het eerste antwoord:
navigate('/chat/' + id, { replace: true })"). Lokale state voorkomt flicker tijdens
een lopend gesprek; de invalidatie zorgt dat bij later heropenen (React Query,
staleTime 60 s) de actuele serverstate wordt opgehaald. `replace: true` is essentieel
voor de terugknop-semantiek uit US1: `/assistants → /chat/new/x → /chat/<uuid>`
zonder replace zou "terug" op de lege nieuw-modus zetten; met replace slaat die
stap over.

**Alternatives considered**:
- Berichten uitsluitend uit React Query halen en optimistische mutatie-updates —
  afgewezen: meer machinery dan nodig voor één pagina; lokaal appenden met één
  invalidatie is het bestaande patroon ( huidige ChatWindow doet dit ook).

## 6. ChatComposer: auto-grow tot 8 regels, Enter/Shift+Enter, focusreturn

**Decision**: Bestaande shadcn `Textarea` met `rows={1}`, auto-grow via een
scrollHeight-check (cap op ±8 regels, daarna intern scrollen),
`onKeyDown`: Enter zonder Shift → `preventDefault()` + submit; Shift+Enter →
native newline. `disabled` tijdens `isSending` (route-voorschrift). Nieuwe
u-vorm-placeholder: `Typ uw bericht…` met `aria-label="Bericht"`. Na elke
versturing (inclusief retry en voorbeeldvraag) zet de pagina de focus terug in de
composer (`ref.focus()`, FR-007/FR-019).

**Rationale**: Native textarea + `onKeyDown` is de standaardoplossing zonder
dependencies (randvoorwaarde: geen nieuwe npm-packages). De 8-regels-cap komt uit
de route; auto-grow houdt korte vragen compact en lange vragen bewerkbaar (FR-006).
Disabled-tijdens-versturen voorkomt parallelle vragen in één gesprek (spec edge
case); de submit-handler checkt daarnaast `isSending` en lege/whitespace-input.

**Alternatives considered**:
- contenteditable-div met rich formatting — afgewezen: niet gevraagd, accessibility-
  risico's, dependencies deur uit.
- Enter altijd newline, aparte verstknoop — afgewezen: route schrijft Enter=versturen
  voor (US2).

## 7. Wachtmelding na 15 seconden

**Decision**: Bij het versturen een `setTimeout(15_000)` starten; zolang die loopt en
er nog geen antwoord is, toont de wachtindicator onderaan de lijst
"Antwoord wordt opgesteld…" en daarna de aanvullende zin "Dit duurt langer dan
gebruikelijk." Beide teksten exact uit de route. De indicator staat in een
`aria-live="polite"`-regio zodat screenreaders de statuswisseling aankondigen
(constitution IV). Timer + extra tekst worden gecleared bij succes, fout én unmount.

**Rationale**: 15 s is FR-018/US9 uit de spec en de route. `aria-live` is nodig
omdat de tekst verschijnt zonder focuswissel — anders merkt een screenreader de
statuswijziging niet op. Geen geautomatiseerde e2e-test (Playwright kan de
app-setTimeout niet betrouwbaar vervangen; 15 s wachten per run is te duur) — de
melding wordt handmatig geverifieerd via quickstart.md, net als de
persistentie-controle; de overige vier route-testgevallen zijn wél geautomatiseerd.

**Alternatives considered**:
- Testbare korte timer via configuratieknop (bijv. `SLOW_NOTICE_MS`-env) — afgewezen:
  ongevraagde configureerbaarheid (constitution VI); de melding is statisch
  gedefinieerd gedrag.

## 8. Kopieerknop kopieert de ruwe content; clipboard-fout is zichtbaar

**Decision**: Onder elk verstuurd assistentbericht een knop "Kopiëren" die
`navigator.clipboard.writeText(message.content)` uitvoert (de ruwe berichttekst, niet
de gerenderde innerHTML) en via de bestaande toast "Gekopieerd" bevestigt. Faalt de
clipboard-belofte (bijv. geen toestemming), dan een fout-toast
("Kopiëren is mislukt") — constitution V: geen stille fout.

**Rationale**: `message.content` is de volledige antwoordtekst zoals opgeslagen
(markdown/HTML-bron); MessageContent rendert die via `sanitizeHtml`
(`src/lib/sanitize.ts`). De ruwe tekst is verliesvrij en herbruikbaar in
documenten; innerText van de gerenderde DOM verliest structuur (lijsten, kopteksten).
De toast bestaat (`useToast`), zodat geen nieuwe UI ontstaat.

**Alternatives considered**:
- innerText kopiëren — afgewezen: verliest markdown-structuur; content is de
  bron van waarheid.
- Eigen "Gekopieerd"-label op de knop i.p.v. toast — afgewezen: route noemt
  expliciet "toast 'Gekopieerd'".

## 9. Voorbeeldvragen: text[]-kolom, één per regel, harde limiet 4

**Decision**: Migratie `016_assistant_example_questions.sql`:
`ALTER TABLE ai_assistants ADD COLUMN IF NOT EXISTS example_questions TEXT[] NOT NULL DEFAULT '{}';`.
`src/types/database.types.ts` krijgt `example_questions: string[]` (Row; optioneel in
Insert/Update). In de admin-`AssistantModal` een `Textarea` met label
"Voorbeeldvragen (één per regel, maximaal 4)": parsering splitst op newlines,
trimmed en filtert lege regels; bij méér dan 4 wordt opslagen geblokkeerd met een
inline melding (knop disabled + fouttekst, FR-013 testbaar). `useCreateAssistant` /
`useUpdateAssistant` krijgen het veld in hun payload. `ChatEmptyState` rendert de
vragen (max 4) als knoppen die de vraag direct versturen (US5/FR-014).

**Rationale**: `text[]` is het PostgreSQL-idiom voor een korte vaste-ordeslijst;
`NOT NULL DEFAULT '{}'` maakt de kolom veilig voor alle bestaande rijen zonder
backfill. `ADD COLUMN IF NOT EXISTS` is idempotent (patroon uit migratie 002:28).
De harde UI-limiet is testbaarder dan stilletjes trimsen naar 4. RLS: de kolom valt
onder de bestaande `ai_assistants`-policies (kolomvolgorde volgt de tabelpolicies —
migratie 015 laat schrijven alleen admins toe); geen policy-wijziging nodig.

**Alternatives considered**:
- Aparte tabel `assistant_example_questions` (id, assistant_id, text, position) —
  afgewezen: 1-op-4-lijst, geen eigen levenscyclus; text[] is kleiner en de route
  schrijft de kolom expliciet voor.
- JSONB — afgewezen: geen objectstructuur nodig; text[] is typischer en direct
  gesorteerd-stabiel per array-volgorde.

## 10. Niet-gevonden-states: twee semantische varianten

**Decision**: Twee toestanden, beide als semantische heading met een terugkeerlink
naar `/assistants` (FR-011):
- `Gesprek niet gevonden` — bestaand-modus: `useConversation(conversationId)` (nieuwe
  hook: conversation + join `ai_assistants(name, icon, description, example_questions,
  is_active, type)`) levert geen rij (RLS weigert andere eigenaar, of id bestaat
  niet/is geen uuid → query-error → zelfde state).
- `Assistent niet gevonden` — nieuw-modus: `useAssistant(assistantId)` levert geen
  rij, of de assistent is `type === 'risico_analyse'` of `is_active === false`
  (nieuwe gesprekken starten alleen bij actieve chat-assistenten, spec-aanname;
  de Edge Function weigert inactieve assistenten al — `index.ts:218` — dus de UI
  voorkomt slechts een doodlopende pagina).
Bestaande gesprekken van een gedeactiveerde assistent blijven toegankelijk (leesbaar;
versturen faalt zichtbaar met FORBIDDEN-inline-fout) conform de spec-aanname.

**Rationale**: FR-011 schrijft "Gesprek niet gevonden" expliciet voor; de
assistent-variant volgt hetzelfde patroon voor het spiegelende geval in de
nieuw-modus. Beide states zijn headings + link (WCAG: geen lege pagina, directe
terugkeer; constitution IV/V).

**Alternatives considered**:
- Eén generieke tekst voor beide — afgewezen: spec noemt de gespreks-tekst letterlijk;
  de assistent-variant verdient een eigen, correcte tekst.
- Redirect naar `/assistants` zonder melding — afgewezen: FR-011 eist een melding,
  geen stille redirect (constitution V).

## 11. Testaanpak: 4 nieuwe e2e-gevallen + 2 gemigreerde specs

**Decision**:
1. Nieuw `tests/e2e/chat-page.spec.ts` (route-item 5, allemaal met `page.route`-mocks,
   login via de bestaande `fixtures.ts`):
   a. nieuw gesprek krijgt de URL `/chat/<uuid>` (mock: rag-chat-succes met
      `conversation_id`; assert: URL verandert, antwoord zichtbaar, request-body =
      `assistant_id`, `message_id`, `message` — géén `conversation_id` bij eerste
      versturing);
   b. Shift+Enter maakt een nieuwe regel (textarea-value bevat `\n`), Enter verstuurt;
   c. fout → inline melding + "Opnieuw proberen" → mock slaagt → antwoord verschijnt
      en er staat exact één gebruikersbericht (tweede request hergebruikt
      `message_id` — via de mock-request-bodies geasserteerd);
   d. klik op een voorbeeldvraag verstuurt die vraag direct (assistant-mock met
      `example_questions`).
2. Herwerk `rag-chat.spec.ts`: de happy path en foutcodes draaien nu via de
   pagina-flow (`/chat/new/:id`) met inline fout + retry i.p.v. toasts; de
   request-body-assertie wordt `assistant_id, message_id, message`; REST-mocks
   verschuiven van client-inserts (conversations POST) naar server-side gedrag
   (alleen nog lees-queries: conversations/messages GET).
3. Kleine update `admin-only-management.spec.ts:259-268`: "can still start a chat"
   asserteert nu navigatie naar `/chat/new/:id` en de zichtbare composer
   (placeholder `Typ uw bericht…`) i.p.v. het verwijderde zijpaneel.
4. Persistentie na herladen handmatig tegen de echte Edge Function (quickstart.md);
   de wachtmelding (15 s) en kopieerknop eveneens handmatig (quickstart).

**Rationale**: De bestaande suite mockt alle Supabase-REST en functions via
`page.route` (`rag-chat.spec.ts:34-59`) — precies wat de route voorschrijft
("rag-chat gemockt met page.route"). De twee bestaande specs raken de oude
chat-flow en breken door de verwijdering van ChatWindow; bijwerken is geen refactor
ernaast maar een noodzakelijk gevolg (randvoorwaarde: alleen bestanden die de spec
nodig heeft — deze twee hebben de spec nodig om groen te blijven).

**Alternatives considered**:
- Oude rag-chat-spec laten vallen en alleen nieuwe schrijven — afgewezen: de
  foutcode-teksten (constitution V, NL-error-contract) blijven de moeite van
  regressiedekking waard; herwerken is een kleine stap boven verwijderen.
- Live Edge Function in e2e — afgewezen: suite draait volledig gemocked (patroon
  sinds 009); live-aanroepen horen in de handmatige quickstart-verificatie.

## 12. Titel: getrimd, 80 tekens, ellipsis alleen bij afkapping

**Decision**: Server bepaalt bij gespreksaanmaak:
`title = message.trim().slice(0, 80) + (message.trim().length > 80 ? '…' : '')`
(FR-017 + route "maximaal 80 tekens plus '…'"). Bestaande gesprekken behouden hun
titel; alleen gesprekken aangemaakt via het v2-pad krijgen de vraagtitel.

**Rationale**: Één plaats (server) garandeert dat alle nieuwe gesprekken dezelfde
titel hebben, ongeacht entry-point (chatpagina, toekomstige History-link). De
ellipsis alleen bij daadwerkelijke afkapping voorkomt titels van 81 tekens bij
korte vragen. Trimmen voorkomt leidende witruimte in de titel (spec edge case).

**Alternatives considered**:
- Titel client-side bepalen en in de request sturen — afgewezen: de server is het
  enige opslagpunt (feature-doel); bovendien zou de titel dan client-vertrouwen
  vergen dat de eigendomscontrole toch al overbrugt.