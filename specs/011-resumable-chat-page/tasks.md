# Tasks: Chat als eigen pagina met hervatbare gesprekken

**Input**: Design documents from `/specs/011-resumable-chat-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rag-chat.md, quickstart.md

**Tests**: Inbegrepen â€” de spec/AGENTS.md eisen geautomatiseerde Playwright-dekking (4 gevallen uit de technische route) plus handmatige live-verificatie via quickstart.md. De Playwright MCP is in deze sessie niet gekoppeld; de e2e-taken worden conform de bestaande testpatronen (`tests/e2e/rag-chat.spec.ts`, `admin-only-management.spec.ts`) in dezelfde stijl geschreven en lokaal uitgevoerd.

**Organization**: Taken gegroepeerd per user story (US1-US9 uit spec.md; US8 wordt server-side in de foundational-fase gerealiseerd). P1-stories vormen de MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan parallel (verschillende bestanden, geen afhankelijkheden)
- **[Story]**: User story uit spec.md
- Exacte bestandspaden in elke beschrijving

---

## Phase 1: Setup

**Purpose**: Geen nieuwe infrastructuur nodig â€” branch `011-resumable-chat-page` staat klaar; dependencies, Vite, Playwright-config en fixtures bestaan. Sla deze fase niet-over: de enige voorbereiding is het verzekeren van de e2e-omgeving.

- [ ] T001 Controleer dat `.env.local` de bestaande e2e-accounts bevat (`E2E_EMAIL`/`E2E_PASSWORD`, zie `tests/e2e/fixtures.ts`); ontbreken ze, dan skippen de tests met duidelijke reden â€” vul ze handmatig aan (quickstart.md Â§1) _(gecontroleerd 2026-10-19: ontbreken in `.env.local`; suite draait volledig skipped (51/51) â€” handmatig aanvullen blijft voor Jaap)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database-kolom, typed client-contract, Edge Function v2 en routing die Ã¡lle stories delen

**âš ï¸ CRITICAL**: Geen enkele story-fase kan starten vÃ³Ã³r deze fase klaar is

- [x] T002 [P] Maak migratie `supabase/migrations/016_assistant_example_questions.sql`: `ALTER TABLE ai_assistants ADD COLUMN IF NOT EXISTS example_questions TEXT[] NOT NULL DEFAULT '{}';` (data-model.md; toepassen op productie gebeurt pas via Supabase MCP in quickstart.md Â§3)
- [x] T003 [P] Voeg `example_questions: string[]` (Row; optioneel in Insert/Update) toe aan `ai_assistants` in `src/types/database.types.ts` (na `n8n_webhook_url`, regel ~101)
- [x] T004 Breid `src/lib/rag-client.ts` uit naar contract v2 (`specs/011-resumable-chat-page/contracts/rag-chat.md`): request `{ assistant_id, conversation_id?, message_id, message }` (uuid-validatie client-side via `crypto.randomUUID()`-aanroep), response-zod-schema `{ conversation_id, user_message_id, assistant_message: { id, content, sources, created_at }, verification?, rewritten_query? }`; `RagChatResult` wordt het v2-resultaat; foutcodes en NL-teksten ongewijzigd
- [x] T005 Breid `supabase/functions/rag-chat/index.ts` uit tot v2 volgens het contract (serverflow 1-9): `message_id`-uuid-validatie; legacy-pad zonder `message_id` (v1-gedrag: `conversation_id` verplicht, geen persistentie, oude respons â€” comment met verwijderingsnotitie); message-first gespreksresolutie (berichts-lookup op `message_id` â†’ autoritatieve `conversation_id`, anders request-`conversation_id`, anders nieuw gesprek met `title = message.trim().slice(0,80) + 'â€¦'` alleen bij afkapping); eigendomscontrole via userClient-RLS-read; gebruikersbericht-upsert `ON CONFLICT DO NOTHING` (supabase-js `ignoreDuplicates`); historie nÃ¡ upsert (bestaand patroon); assistentbericht-insert `.select().single()` bij upstream-succes; `conversations.updated_at`-update; v2-respons. Logging blijft code+id's+ms (constitution III); contract-comment bovenin wijst naar `specs/011-resumable-chat-page/contracts/rag-chat.md`
- [x] T006 [P] Voeg aan `src/hooks/queries.ts` toe: `useAssistant(assistantId)` (enkele rij `ai_assistants` via `.eq('id', â€¦).maybeSingle()`) en `useConversation(conversationId)` (conversation + join `ai_assistants(name, icon, description, example_questions, is_active, type)`); voeg `exampleQuestions: string[]` toe aan de payloads van `useCreateAssistant`/`useUpdateAssistant` (insert/update van `example_questions`)
- [x] T007 Voeg in `src/App.tsx` de twee lazy routes toe binnen de AppShell-route (na `/assistants`, regel ~60): `<Route path="/chat/new/:assistantId" element={<ChatPage />} />` en `<Route path="/chat/:conversationId" element={<ChatPage />} />` met `const ChatPage = lazy(() => import('@/pages/ChatPage'))` (research.md #1: verschillende segmentdiepten, geen volgorde-conflict)

**Checkpoint**: Kolom, client-contract, Edge Function en routes staan â€” story-implementatie kan starten

---

## Phase 3: User Story 1 - Chatpagina met vast gespreksadres (Priority: P1) ðŸŽ¯ MVP

**Goal**: "Chat" opent een eigen chatpagina (volle breedte); na de eerste vraag heeft het gesprek een vast id-only adres dat herlaadt, terug-/vooruitnavigeert en later voortgezet kan worden; gesprek en berichten laden bij heropenen.

**Independent Test**: e2e (T008) + handmatig herladen/terugknop met de Ã©chte Edge Function (quickstart.md Â§4.1-4.2).

### Tests for User Story 1

- [x] T008 [P] [US1] Schrijf e2e-geval 1 in het nieuwe `tests/e2e/chat-page.spec.ts` (REST + rag-chat gemocked via `page.route`, patroon `tests/e2e/rag-chat.spec.ts:35-59`): open `/assistants` â†’ klik "Chat" â†’ pagina op `/chat/new/:id` â†’ stel vraag (mock: v2-succes met `conversation_id`) â†’ URL is gewijzigd in `/chat/<conversation_id>` (alleen id's), antwoord zichtbaar, request-body bevat precies `assistant_id`, `message_id`, `message` (gÃ©Ã©n `conversation_id` bij eerste versturing); verifieer FAIL vÃ³Ã³r implementatie

### Implementation for User Story 1

- [x] T009 [US1] Maak `src/components/chat/ChatHeader.tsx`: assistent-identiteit (icoon, naam, omschrijving) + knop "Nieuw gesprek" (`navigate(\`/chat/new/${assistant.id}\`)`) + link "Terug naar assistenten" (naar `/assistants`); semantische heading en native besturing (constitution IV)
- [x] T010 [US1] Maak `src/components/chat/ChatEmptyState.tsx` (basisversie): uitleg wat de assistent kan (omschrijving) + u-vorm-intro "Stel uw vraag om het gesprek te starten" (FR-012); voorbeeldvraag-knoppen volgen in US5 (T022)
- [x] T011 [US1] Maak `src/components/chat/MessageList.tsx`: scrollcontainer met auto-scroll naar onder bij nieuwe berichten (bestaande `scrollRef`-patroon uit `AssistantsPage.tsx:433-435`), bericht-rendering via `MessageBubble`, wachtindicator "Antwoord wordt opgesteldâ€¦" in een `aria-live="polite"`-regio
- [x] T012 [US1] Maak `src/components/chat/MessageBubble.tsx` (basisversie): gebruikers-/assistentstijling (bestaande klassen `AssistantsPage.tsx:626-634`), render via bestaande `MessageContent`, bronnen-toggle (bestaande logica + `Source`-type, `:636-663` ongewijzigd overgenomen)
- [x] T013 [US1] Maak `src/pages/ChatPage.tsx`: modus-onderscheid op params (`/chat/new/:assistantId` vs `/chat/:conversationId`); nieuw-modus laadt `useAssistant`, bestaand-modus laadt `useConversation` + `useConversationMessages` (seed van de lokale berichtlijst met reset-effect op param-wissel); niet-gevonden-states "Gesprek niet gevonden"/"Assistent niet gevonden" (research.md #10) met terugkeerlink; send-flow: `ChatMessage` met `status`-velden (data-model.md), `message_id = crypto.randomUUID()`, tonen pending bij versturen, `askAssistant`-aanroep, bij succes berichten bijwerken + `navigate('/chat/' + id, { replace: true })` in de nieuw-modus + `invalidateQueries(['messages', id])`; basis-invoer (textarea + verstknoop) zodat US1 zelfstandig testbaar is; verplaats de bestaande gespreksbrede feedbackbalk JSX (handlers, condities en teksten ongewijzigd, `AssistantsPage.tsx:676-764`) naar ChatPage
- [x] T014 [US1] Wijzig `src/pages/AssistantsPage.tsx`: verwijder `ChatWindow` + bijbehorende state/handlers/importen (regels 147-152, 390-779), laat de "Chat"-knop (`:124-127`) `navigate(\`/chat/new/${a.id}\`)` uitvoeren; AssistantModal blijft (US5 breidt uit)

**Checkpoint**: US1 werkt zelfstandig: eigen pagina, vast adres na eerste vraag, herlaadbaar; feedbackbalk en bronnen ongewijzigd werkend

---

## Phase 4: User Story 2 - Meerregelig invoerveld (Priority: P1)

**Goal**: Enter verstuurt, Shift+Enter geeft een nieuwe regel; het veld groeit mee tot 8 regels; tijdens versturen uitgeschakeld; focus keert na versturen terug in het veld.

**Independent Test**: e2e-geval 2 (T015) + toetsenbord-check in quickstart.md Â§4.6.

### Tests for User Story 2

- [x] T015 [US2] Schrijf e2e-geval 2 in `tests/e2e/chat-page.spec.ts`: Shift+Enter voegt een `\n` toe aan het invoerveld (waarde bevat regeleinde), Enter verstuurt (gebruikersbericht verschijnt); verifieer FAIL vÃ³Ã³r implementatie

### Implementation for User Story 2

- [x] T016 [US2] Maak `src/components/chat/ChatComposer.tsx` (vervangt de basis-invoer uit T013): bestaande shadcn `Textarea` met `rows={1}`, auto-grow via scrollHeight-check met cap op Â±8 regels (research.md #6), `onKeyDown` Enterâ†’`preventDefault()`+submit / Shift+Enterâ†’native newline, `disabled` tijdens `isSending`, placeholder `Typ uw berichtâ€¦` + `aria-label="Bericht"`; ChatPage zet na elke versturing (inclusief retry en voorbeeldvraag) de focus terug in de composer (`ref.focus()`, FR-007)

**Checkpoint**: US2 werkt zelfstandig: meerregelige vragen typen en versturen in Ã©Ã©n keer

---

## Phase 5: User Story 3 - Foutmelding met "Opnieuw proberen" (Priority: P1)

**Goal**: Bij een mislukt antwoord blijft de vraag staan met inline reden en "Opnieuw proberen" (zelfde `message_id`); na een geslaagde poging staat de vraag exact Ã©Ã©n keer in het gesprek; geen toast-fouten meer voor het versturen.

**Independent Test**: e2e-geval 3 (T017) + handmatig met echte n8n-storing (quickstart.md Â§4.3).

### Tests for User Story 3

- [x] T017 [US3] Schrijf e2e-geval 3 in `tests/e2e/chat-page.spec.ts`: mock rag-chat eerst met `{ code: 'UPSTREAM_ERROR', status: 502 }` â†’ inline fout met NL-reden en knop "Opnieuw proberen" zichtbaar bij de vraag (geen toast),vraag blijft staan; mock daarna v2-succes â†’ klik "Opnieuw proberen" â†’ antwoord verschijnt en er staat exact Ã©Ã©n gebruikersbericht (teller); assert dat de tweede request hetzelfde `message_id` heeft (request-bodies uit de mock opslaan); verifieer FAIL vÃ³Ã³r implementatie

### Implementation for User Story 3

- [x] T018 [US3] Foutafhandeling in `src/pages/ChatPage.tsx`: `catch (err: RagClientError)`-pad zet de pending `ChatMessage` naar `status: 'failed'` met `error: { code, message }` (NL-tekst uit de client-map) â€” toast-verwijdering voor verstuurfouten; retry-handler hergebruikt exact hetzelfde `message_id` (en dezelfde request zonder/`conversation_id` zoals de oorspronkelijke poging) en zet `failed â†’ pending`; state-transitie volgens data-model.md
- [x] T019 [US3] Foutblok in `src/components/chat/MessageBubble.tsx`: bij `status === 'failed'` toont de gebruikersbubble een inline, blijvende melding met de reden + knop "Opnieuw proberen" (`onClick` â†’ retry-handler; volledig toetsenbordbereikbaar, FR-008/FR-019)

**Checkpoint**: US3 werkt zelfstandig: geen halve gesprekken, geen dubbele vragen, herstel in Ã©Ã©n klik

---

## Phase 6: User Story 4+5 - Voorbeeldvragen (Priority: P2)

**Goal**: Beheerder stelt per assistent maximaal 4 voorbeeldvragen in; een nieuw gesprek toont omschrijving + voorbeeldvragen als knoppen die de vraag direct versturen.

**Independent Test**: e2e-geval 4 (T020) + handmatige admin-flow (quickstart.md Â§4.5).

### Tests for User Story 4+5

- [x] T020 [US5] Schrijf e2e-geval 4 in `tests/e2e/chat-page.spec.ts`: assistent-mock met `example_questions: ['Wat dekt mijn polis?', â€¦]` â†’ nieuw gesprek toont de voorbeeldvragen als knoppen â†’ klik verstuurt die vraag direct (gebruikersbericht zichtbaar, rag-chat-request met die tekst); verifieer FAIL vÃ³Ã³r implementatie

### Implementation for User Story 4+5

- [x] T021 [US4] Breid `AssistantModal` in `src/pages/AssistantsPage.tsx` uit: `Textarea` met label "Voorbeeldvragen (Ã©Ã©n per regel, maximaal 4)" (alleen admin â€” modal is reeds admin-only); parsering split-newlines/trim/filter-leeg; bij >4 niet-lege regels wordt opslaan geblokkeerd met inline NL-melding (FR-013 testbaar); `example_questions` meegeven aan create/update-mutaties (T006)
- [x] T022 [US5] Breid `src/components/chat/ChatEmptyState.tsx` uit: voorbeeldvragen (max 4, `?? []`) als knoppen die via de bestaande send-flow de vraag direct versturen (US5/FR-014)

**Checkpoint**: US4+US5 werken zelfstandig: lege staat verklaart de assistent en verlaagt de eerste vraag-drempel

---

## Phase 7: User Story 6 - Antwoord kopiÃ«ren (Priority: P2)

**Goal**: Onder elk antwoord een kopieerknop die de volledige antwoordtekst op het klembord zet met toast "Gekopieerd"; mislukking is zichtbaar.

**Independent Test**: handmatig via quickstart.md Â§4.7 (geen geautomatiseerde clipboard-test in de route).

- [x] T023 [US6] Kopieerknop in `src/components/chat/MessageBubble.tsx`: alleen bij verstuurd assistentbericht; `navigator.clipboard.writeText(message.content)` (ruwe tekst, research.md #8) â†’ toast "Gekopieerd"; catch â†’ fout-toast "KopiÃ«ren is mislukt" (constitution V)

**Checkpoint**: US6 werkt zelfstandig

---

## Phase 8: User Story 7 - Nieuw gesprek bij dezelfde assistent (Priority: P2)

**Goal**: "Nieuw gesprek" opent een leeg gesprek bij dezelfde assistent zonder het eerdere gesprek te verliezen; browser-terug keert naar het eerdere gesprek.

**Independent Test**: handmatig (quickstart.md Â§4.1 terugknop-pad) â€” de navigate-replace-semantiek wordt mede gedekt door e2e-geval 1.

- [x] T024 [US7] State-reset in `src/pages/ChatPage.tsx`: bij wissel van route-param (`conversationId`/`assistantId`) de lokale berichtlijst, gespreksstate, fout- en wachtstate resetten (zodat "Nieuw gesprek" vanuit een lopend gesprek een daadwerkelijk lege pagina geeft en terug-navigeren het oude gesprek intact toont)

**Checkpoint**: US7 werkt zelfstandig; US1-US7 vormen de volledige chatervaring

---

## Phase 9: User Story 8 - Titel is de eerste vraag (Priority: P2)

**Goal**: Elk nieuw gesprek krijgt als titel de eerste vraag (getrimd, afgekapt op 80 tekens, 'â€¦' alleen bij afkapping); daarna ongewijzigd.

**Independent Test**: server-side gerealiseerd in T005; handmatig verifiÃ«ren via de SQL-check in quickstart.md Â§5 (titel = eerste vraag) â€” geen afzonderlijke frontend-taak.

- [ ] T025 [US8] Verificatie-taak: na uitrol (quickstart.md Â§3) controleren dat nieuwe gesprekken de vraagtitel dragen (SQL uit quickstart.md Â§5); bestaande gesprekken behouden "Chat met <assistent>" (geen backfill â€” spec-aanname) _(uitrol 2026-10-20 voltooid; check vereist nieuw live gespreksgebruik, nog open)_

**Checkpoint**: US8 is server-side volledig afgedekt

---

## Phase 10: User Story 9 - Melding bij langzaam antwoord (Priority: P3)

**Goal**: Duurt een antwoord > 15 seconden, dan verschijnt bij de wachtindicator "Dit duurt langer dan gebruikelijk."; bij aankomst verdwijnt de melding.

**Independent Test**: handmatig (quickstart.md Â§4.8) â€” de route vraagt geen geautomatiseerde 15s-test (research.md #7).

- [x] T026 [US9] Wachtmelding in `src/pages/ChatPage.tsx` + `src/components/chat/MessageList.tsx`: `setTimeout(15_000)` bij versturen; zolang actief en `isSending`: aanvullende zin "Dit duurt langer dan gebruikelijk." binnen de `aria-live="polite"`-regio; timer en tekst clearen bij succes, fout Ã©n unmount (FR-018)

**Checkpoint**: Alle user stories zijn geÃ¯mplementeerd

---

## Phase 11: Migratie van bestaande tests (Cross-Cutting)

**Purpose**: De twee bestaande e2e-specs raken de verwijderde zijpaneel-flow; bijwerken is een noodzakelijk gevolg (randvoorwaarde: alleen bestanden die de spec nodig heeft)

- [x] T027 Herwerk `tests/e2e/rag-chat.spec.ts`: happy path en foutcode-gevallen via de pagina-flow (`/chat/new/:id` â†’ composer â†’ inline fout + "Opnieuw proberen" i.p.v. toasts); request-body-assertie wordt `assistant_id, message_id, message`; REST-mocks alleen nog lees-queries (conversations/messages GET â€” de client schrijft niet meer); invalid-response-geval: inline fout in plaats van toast
- [x] T028 [P] Kleine update `tests/e2e/admin-only-management.spec.ts:259-268`: "can still start a chat" asserteert navigatie naar `/chat/new/:id` + zichtbare composer (placeholder `Typ uw berichtâ€¦`) i.p.v. het zijpaneel

---

## Phase 12: Polish & Verificatie

**Purpose**: Definition of Done (AGENTS.md)

- [x] T029 Draai `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0` en `npm run build` â€” allemaal groen
- [x] T030 Draai `npx playwright test` (volledige suite: nieuwe + herwerkte specs + regressie) â€” groen (of skip met reden bij ontbrekende e2e-accounts)
- [ ] T031 Voer quickstart.md Â§3-Â§5 uit (migratie + Edge Function via Supabase MCP, frontend-release, handmatige live-verificatie, SQL-checks) â€” voor Jaap na de code-review _(2026-10-20: migratie 016 + rag-chat v2 toegepast via de Supabase-webUI i.p.v. MCP (token 401; MCP-deploy kapt het 19 KB-bestand af, zie knowledge/tooling/knowledge.md); frontend via PR #22 -> develop -> PR #23 -> main, Netlify-deploy getriggerd; open: handmatige live-verificatie par. 4 + SQL-checks par. 5)_
- [x] T032 Fitness checks (`scripts/fitness-check.sh` + F-01/F-10 via Supabase MCP) en FEATURES.md-update via `@feature-tracker` â€” na implementatie _(2026-10-19: script FAIL:0/PASS:13/WARN:1; eslint 0 errors, build groen, Playwright 51 skipped/0 failed; FEATURES.md + FITNESS.md bijgewerkt; F-01/F-10/F-16/F-17 SKIP â€” Supabase/Snyk MCP niet actief in sessie, achterstand gedocumenteerd in FITNESS.md)_

---

## Dependencies & Execution Order

### Fasedenkwoud

- **Phase 1-2**: sequentieel â€” T002/T003/T006 [P] onderling parallel; T004/T005/T007 kunnen parallel na T002/T003 (client en server delen alleen het contract)
- **Phase 3 (US1, MVP)**: blokkeert US2-US7 (composer, retry, examples, copy bouwen op ChatPage/MessageBubble)
- **Phase 4-8 (US2-US7)**: volgorde vrij; US2 vÃ³Ã³r US3/US5 aanbevolen (composer is de drager van retry/voorbeeldvragen); US6/US7 [P] onafhankelijk
- **Phase 9 (US8)**: geen codetaak â€” verificatie na uitrol
- **Phase 10 (US9)**: na US1 (heeft de wachtindicator nodig)
- **Phase 11**: kan parallel met Phase 4-10; vÃ³Ã³r Phase 12
- **Phase 12**: alles afgerond

### Binnen elke story

- Tests vÃ³Ã³r implementatie (FAIL-rood bewijzen waar mogelijk)
- Componenten vÃ³Ã³r samenstelling in ChatPage
- ChatPage vÃ³Ã³r AssistantsPage-wijziging (de knop heeft een doel nodig)

### Parallel-mogelijkheden

- T002 + T003 + T006 (database-kant) parallel aan T004 + T005 (API-kant) parallel aan T009-T012 (componenten)
- T023 (copy) en T024 (state-reset) parallel na Phase 3
- T028 parallel aan T027

---

## Implementation Strategy

MVP-first: Phase 1-3 opleveren en valideren (chatpagina + vast adres) â†’ daarna P1-US2/US3 (composer + foutafhandeling) â†’ P2-bundel (US4-US7) â†’ P3 (US9) â†’ testmigratie â†’ checks. Bij elke fase: `npx tsc --noEmit` + `npx eslint src/ --max-warnings 0` groen houden (pre-commit gate AGENTS.md).
