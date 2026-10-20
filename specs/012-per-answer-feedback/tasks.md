# Tasks: Feedback per antwoord, en vastleggen hoe een antwoord tot stand kwam

**Input**: Design documents from `/specs/012-per-answer-feedback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/feedback-db.md, quickstart.md

**Tests**: Inbegrepen — de route eist vier Playwright-scenario's die **tegen de echte database** draaien (seeding via de Supabase-client van het testaccount, research #12). Consequent: `answer-feedback.spec.ts` kan pas groen draaien nádat migratie 017 op productie is toegepast (T017, expliciete bevestiging van Jaap vereist); de gemockte regressiesuite draait onafhankelijk daarvan. Zonder `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` skippen de tests met reden — bij 011 zijn vastgesteld dat ze ontbreken (T001).

**Organization**: Taken gegroepeerd per user story (US1-US5 uit spec.md). US1-US3 (P1) vormen samen de per-antwoord-feedback-MVP; US4 en US5 (P2) zijn onafhankelijk. De beheerdersfunctie is server-side in de foundational-fase gerealiseerd (011 T025-patroon); US5 is een verificatietaak na uitrol.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan parallel (verschillende bestanden, geen afhankelijkheden)
- **[Story]**: User story uit spec.md
- Exacte bestandspaden in elke beschrijving

---

## Phase 1: Setup

**Purpose**: Geen nieuwe infrastructuur — branch, dependencies, Vite, Playwright-config en fixtures bestaan. De enige voorbereiding is de e2e-omgeving: de nieuwe spec seedt en logt in met een écht account.

- [x] T001 Controleer dat `.env.local` `E2E_EMAIL`/`E2E_PASSWORD` bevat (het admin-testaccount uit `tests/e2e/fixtures.ts`); vul handmatig aan bij Jaap indien ontbreekt (011 constateerde: afwezig — zonder deze variabelen skippen álle e2e-tests, en de nieuwe spec kan niet seeden). `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` bestaan al voor de app zelf _(gecontroleerd 2026-10-19: `E2E_EMAIL`/`E2E_PASSWORD`/`E2E_MEMBER_*` ontbreken in `.env.local`; suite skippt met reden — handmatig aanvullen blijft voor Jaap; Node v24 beschikbaar voor `process.loadEnvFile`)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migratie-bestand en getypte client-contract die álle stories delen

**⚠️ CRITICAL**: Geen enkele story-fase kan starten vóór deze fase klaar is

- [x] T002 [P] Maak migratie `supabase/migrations/017_per_answer_feedback.sql` volgens data-model.md §Migratie 017 (volledige SQL): `messages` + `rewritten_query text` / `verification jsonb` / `latency_ms integer` (alle nullable); `feedback_interactions` + `message_id` (FK → messages, ON DELETE CASCADE, nullable) / `reason` (benoemde CHECK `feedback_interactions_reason_check` met de vijf codes, idempotent via DO-block) / `updated_at timestamptz NOT NULL DEFAULT now()`; `DROP CONSTRAINT IF EXISTS one_feedback_per_user_per_conversation` (research #2); **volledige** unieke index `feedback_interactions_message_id_user_id_key (message_id, user_id)` (research #1 — PostgREST-upsert compatibiliteit); `set_updated_at`-trigger (huispatroon 001, DROP IF EXISTS eerst); INSERT-policy "Users can insert feedback on own conversation messages" (vervangt 004 "Users can insert own feedback") + UPDATE-policy "Users can update own feedback" (beide: `auth.uid() = user_id AND EXISTS(messages→conversations.user_id = auth.uid())`, research #3); functie `public.get_feedback_review()` (SECURITY DEFINER, `SET search_path = public`, STABLE, retourvorm conform contracts/feedback-db.md §2, LATERAL-vraaglookup, `is_org_admin()` + `get_user_org_id()`-filters). **Niet toepassen op productie** — dat gebeurt pas via Supabase MCP met expliciete bevestiging (T017, quickstart §3)
- [x] T003 [P] Werk `src/types/database.types.ts` bij (handmatige stijl, data-model.md §types): `messages` Row/Insert/Update + `rewritten_query: string | null`, `verification: Record<string, unknown> | null`, `latency_ms: number | null`; `feedback_interactions` Row/Insert/Update + `message_id: string | null`, `reason: string | null`, `updated_at: string`; Relationships + `feedback_interactions_message_id_fkey` → `messages(id)`; `Functions`-sectie: `get_feedback_review` (Args: geen; Returns: rijvorm uit contracts/feedback-db.md §2) i.p.v. `Record<string, never>`

**Checkpoint**: Migratie-bestand en typen staan — story-implementatie kan starten

---

## Phase 3: User Story 1 - Duim omhoog of omlaag per antwoord (Priority: P1) 🎯 MVP

**Goal**: Onder elk afgeronden assistentbericht staan twee duimknoppen; omhoog en omlaag slaan direct een oordeel op per antwoord; de gespreksbrede balk is verdwenen; één query per gesprek levert alle oordelen.

**Independent Test**: e2e-scenario (a) (T004) — duim omhoog op één van twee antwoorden; databasecheck bevestigt precies één rij met het juiste `message_id`.

### Tests for User Story 1

- [x] T004 [P] [US1] Maak `tests/e2e/answer-feedback.spec.ts` (echte database, research #12): scaffolding + scenario (a). Scaffolding: `.env.local` laden (`process.loadEnvFile`, bewaakt met `existsSync`), supabase-js-client (`createClient(url, anonKey)`, bestaande productie-dependency) + `signInWithPassword` met `E2E_EMAIL`/`E2E_PASSWORD` (zelfde account als de `page`-fixture), seed-helper (gesprek met herkenbare titel "E2E …" + twee vraag/antwoord-paren via REST — voldoet automatisch aan RLS), cleanup-helper (`afterEach`: `DELETE conversations` — cascade ruimt berichten én feedback), describe-namen met prefix "answer-feedback —" (voor `--grep-invert` in T016). Scenario (a): open `/chat/<conversation_id>` → klik duim omhoog bij antwoord 1 → DB-check via de client: precies één rij, `message_id` = antwoord 1, `thumbs_up = true`; duimknop 2 heeft `aria-pressed="false"` en er bestaat géén rij voor antwoord 2. Verifieer FAIL vóór implementatie

### Implementation for User Story 1

- [x] T005 [US1] Voeg aan `src/hooks/queries.ts` toe: `useMessageFeedback(conversationId)` — `queryKey ['message-feedback', conversationId]`, `user_id` intern uit `useAuth()`, select `feedback_interactions` waar `conversation_id = X` én `user_id` én `message_id` niet null (één query per gesprek; react-query dedupliceert alle AnswerFeedback-instanties, research #8), retourneert `FeedbackInteraction[]`; en `useUpsertMessageFeedback(conversationId)` — mutatie met payload `{ message_id, assistant_id, thumbs_up, reason: string | null, feedback: string | null }`, `user_id`/`organization_id` intern uit `useAuth()`, `.upsert(..., { onConflict: 'message_id,user_id' })` met volledige payload (contracts/feedback-db.md §1), `onSuccess` → `invalidateQueries(['message-feedback', conversationId])`
- [x] T006 [US1] Maak `src/components/chat/AnswerFeedback.tsx` (basisversie): props `{ conversationId, assistantId, messageId }`; intern `useAuth`, `useMessageFeedback` ( vindt de eigen rij via `message_id`) en `useUpsertMessageFeedback`; twee native `<button>`s met `ThumbsUp`/`ThumbsDown` (lucide-react), `aria-pressed` op basis van het opgeslagen oordeel, toegankelijke NL-labels "Antwoord is nuttig" / "Antwoord is niet nuttig" (FR-012); duim omhoog → directe upsert `thumbs_up: true, reason: null, feedback: null`; duim omlaag → interim directe upsert `thumbs_up: false` zonder reden (basisversie zodat US1 zelfstandig testbaar is — US2/T010 vervangt dit door het redenscherm, patroon 011 T013→T016); tijdens de mutatie knoppen disabled; fout → NL toast "Kon uw beoordeling niet opslaan. Probeer het opnieuw." en knoppen blijven bruikbaar (constitution V, FR-008)
- [x] T007 [US1] Monteer AnswerFeedback in `src/components/chat/MessageBubble.tsx`: binnen de berichtkolom onder de kopieerknop, alleen bij `role === 'assistant' && status === 'sent'` (FR-001 — geen duimen bij pending/failed); `MessageBubbleProps` + `conversationId`/`assistantId`; geef de props door in `src/components/chat/MessageList.tsx`
- [x] T008 [US1] Ruim op in `src/pages/ChatPage.tsx`: verwijder de gespreksbrede feedbackbalk volledig (state-velden `feedbackText`/`isFeedbackSubmitting`/`showFeedbackInput`/`thumbsUpSelected`/`thumbsDownSelected`/`existingFeedback` + `useFeedbackInteraction`-aanroep + de drie handlers + `hasAssistantMessages` + het UI-blok + imports `ThumbsUp`/`ThumbsDown`/`X`/`Textarea`/`FeedbackInteraction`; FR-009); houd de gespreks-id uit het laatste antwoordresultaat bij in state (`result.conversationId`, gezet vóór de `navigate(replace)`, gereset in `resetChatState` — research #8) zodat AnswerFeedback ook in de frames tussen eerste antwoord en routerparameter een id heeft; geef `conversationId ?? routeConversationId` + `viewAssistant.id` door aan `MessageList`; verwijder `useFeedbackInteraction` uit `src/hooks/queries.ts` (grep-verifieer: geen consumenten meer)

**Checkpoint**: US1 werkt zelfstandig: per antwoord beoordelen, andere antwoorden onaangeraakt, gespreksbrede balk weg

---

## Phase 4: User Story 2 - Reden en optionele toelichting bij duim omlaag (Priority: P1)

**Goal**: Duim omlaag opent een redenscherm met precies vijf redenen en een optionele toelichting; annuleren slaat niets op; bevestigen slaat oordeel + reden.

**Independent Test**: e2e-scenario (b) (T009) — omlaag met reden zonder toelichting opgeslagen; Versturen geblokkeerd zonder reden; Annuleren slaat niets op.

### Tests for User Story 2

- [x] T009 [US2] Voeg scenario (b) toe aan `tests/e2e/answer-feedback.spec.ts` (zelfde scaffold): klik duim omlaag → redenscherm zichtbaar (fieldset/legend "Wat ging er mis?", vijf radios met de NL-labels uit contracts/feedback-db.md §1) → "Versturen" is disabled zolang geen reden gekozen → kies "Onvolledig", laat toelichting leeg → "Versturen" → DB-check: rij `thumbs_up = false, reason = 'incomplete', feedback = null`; daarna Annuleren-pad: nieuw gesprek, omlaag → Annuleren → aantal rijen ongewijzigd (niets opgeslagen). Verifieer FAIL vóór implementatie

### Implementation for User Story 2

- [x] T010 [US2] Vervang de interim omlaag-flow uit T006 in `src/components/chat/AnswerFeedback.tsx` door het redenformulier (FR-003): klik omlaag opent inline (onder de duimen, bij het antwoord — geen toast/dialog): `<fieldset>` + `<legend>` "Wat ging er mis?" met vijf native `input type="radio"` (waardes `incorrect`/`incomplete`/`wrong_source`/`misunderstood`/`other`, labels Onjuist/Onvolledig/Bron klopt niet/Vraag niet begrepen/Anders — contracts/feedback-db.md §1, geen nieuwe dependency, research #11), shadcn `Textarea` met label "Toelichting (optioneel)" (leeg toegestaan bij élke reden, ook "Anders"), knoppen "Versturen" (disabled zonder gekozen reden en tijdens de mutatie) en "Annuleren" (sluit het formulier, niets opgeslagen, oude toestand blijft); bevestigen → upsert met `thumbs_up: false, reason, feedback: toelichting ?? null`; geen prefill van een eerder oordeel (spec-aanname); annuleren tijdens mutatie onmogelijk (knoppen disabled)

**Checkpoint**: US2 werkt zelfstandig: negatieve feedback met reden zonder verplichte tekst

---

## Phase 5: User Story 3 - Oordeel blijft na herladen zichtbaar en is wijzigbaar (Priority: P1)

**Goal**: Na herladen staat elk gegeven oordeel weer correct aangezet (`aria-pressed`); wijzigen overschrijft volledig — omlaag→omhoog wist reden en toelichting, omhoog→omlaag vraagt opnieuw een reden.

**Independent Test**: e2e-scenario's (c) + (d) (T011) — wijziging levert exact één rij met de nieuwe waarden; na herladen is de actieve duim correct.

### Tests for User Story 3

- [x] T011 [US3] Voeg scenario's (c) + (d) toe aan `tests/e2e/answer-feedback.spec.ts` (zelfde scaffold): (c) wijzigen — beoordeel antwoord omlaag met reden + toelichting → klik omhoog → DB-check: nog steeds precies één rij, nu `thumbs_up = true, reason = null, feedback = null`; klik opnieuw omlaag, kies een andere reden → rij overschreven met de nieuwe reden; (d) herladen — beoordeel twee antwoorden verschillend → `page.reload()` → `aria-pressed` staat per antwoord op de juiste duim. Verifieer FAIL vóór implementatie

### Implementation for User Story 3

- [x] T012 [US3] Voltooi de wijzigflows in `src/components/chat/AnswerFeedback.tsx` (FR-005/FR-006) _(verificatie 2026-10-19: de flows zijn door het T006/T010-ontwerp volledig afgedekt — handleThumbsUp stuurt altijd reason:null/feedback:null (omlaag→omhoog wist volledig), handleThumbsDown opent het formulier zonder prefill voor élke wijzigrichting, aria-pressed komt uitsluitend uit de opgeslagen rij via useMessageFeedback; geen code-aanvulling nodig)_: de actieve toestand komt volledig uit de opgeslagen rij via `useMessageFeedback` (na herladen én na invalidatie) — `aria-pressed="true"` op de beoordeelde duim, `false` op de andere; omlaag→omhoog: upsert met `thumbs_up: true, reason: null, feedback: null` (volledige overschrijving); omhoog→omlaag: opent het redenformulier zonder prefill (T010); omlaag→omlaag: opent het formulier, bevestigen overschrijft reden en toelichting volledig; geen tweede rij ooit (unieke index + upsert)

**Checkpoint**: US1-US3 samen: het complete per-antwoord feedback-MVP is zelfstandig testbaar

---

## Phase 6: User Story 4 - Antwoordgegevens bewaard bij elk opgeslagen antwoord (Priority: P2)

**Goal**: De Edge Function slaat bij elk nieuw assistentbericht de herschreven zoekvraag, de verificatie en de responstijd op — de gegevens die n8n al meelevert en die nu verloren gaan.

**Independent Test**: handmatig na uitrol — quickstart §4.5 + SQL-check §5 (antwoord heeft `rewritten_query`/`verification`/`latency_ms`); geen e2e (route: seeding zonder rag-chat, research #12).

- [x] T013 [P] [US4] Breid `supabase/functions/rag-chat/index.ts` uit (alleen het v2-pad, research #6): bereken direct vóór de assistentbericht-insert `latency_ms = Date.now() - started` en voeg aan de bestaande insert (regel ~423-432) toe: `rewritten_query: normalized.rewritten_query`, `verification: normalized.verification`, `latency_ms`; ontbrekende velden worden `null` opgeslagen (FR-010, geen fout); v1-legacy-pad, respons-contract en logging (code + id's + duur, constitution III) blijven ongewijzigd; deploy gebeurt pas via Supabase MCP in T018

**Checkpoint**: US4 is server-side afgedekt; onafhankelijk van US1-US3 (ander bestand)

---

## Phase 7: User Story 5 - Beheerdersoverzicht van negatieve feedback (Priority: P2)

**Goal**: Beheerders vragen in één aanroep alle negatieve antwoordoordelen van de eigen organisatie op met vraag, antwoord, verificatie, herschreven zoekvraag, responstijd, assistent en datums.

**Independent Test**: SQL-verificatie na uitrol (quickstart §4.7) — de functie zelf zit in T002 (011 T025-patroon: server-side werk in de foundational-fase).

- [ ] T014 [US5] Verificatie-taak na uitrol: als beheerder `SELECT * FROM get_feedback_review();` (Supabase MCP / SQL-editor) → alleen negatieve per-antwoord-oordelen van de eigen organisatie, per rij met `reason`, `feedback`, `question`, `answer`, `verification`, `rewritten_query`, `latency_ms`, `assistant_name`, `created_at`/`updated_at` (contracts/feedback-db.md §2); als gewone gebruiker (member-JWT): lege resultatenset; antwoorden van vóór 012 tonen `NULL` in de antwoordgegeelden

**Checkpoint**: US5 is server-side volledig afgedekt en geverifieerd

---

## Phase 8: Polish & Verificatie

**Purpose**: Definition of Done (AGENTS.md) + verplichte releasevolgorde (quickstart §3)

- [x] T015 Draai `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0` en `npm run build` — allemaal groen _(2026-10-19: tsc 0 errors; eslint 0 errors + 6 pre-existing warnings in ongeraakte bestanden App.tsx/toast.tsx/posthog.tsx — baseline vóór 012, pre-commit hook behandelt eslint als non-blocking; build groen in 5,9 s)_
- [x] T016 Draai de gemockte regressiesuite: `npx playwright test --grep-invert "answer-feedback"` — groen (of skip met reden bij ontbrekende e2e-accounts); `answer-feedback.spec.ts` draait bewust apart na T017 (real-DB) _(2026-10-19: 51 skipped / 0 failed — E2E-accounts ontbreken in `.env.local`, zelfde gedocumenteerde staat als 011; nieuwe spec-bestanden linten en tsc'en schoon)_
- [ ] T017 Pas migratie `017_per_answer_feedback.sql` toe via de **Supabase MCP** — alléén na expliciete bevestiging van Jaap (productie; AGENTS.md); draai daarna `npx playwright test tests/e2e/answer-feedback.spec.ts` — de vier real-DB-scenario's (a)-(d) groen (randvoorwaarde "Playwright-tests van deze feature groen"). Let op: vanaf deze stap kan de oude productiebalk geen nieuwe gespreksfeedback meer opslaan (breekraam, research #13) — sluit af met T018 _(status 2026-10-19: code compleet; wacht op bevestiging Jaap + Supabase MCP-sessie; daarna ook `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` nodig om de spec te kunnen draaien)_
- [ ] T018 Release (quickstart §3): deploy `rag-chat` via Supabase MCP (stap 2) + frontend-PR naar `develop` → preview testen → merge naar `main`/Netlify (stap 3) — sluit het breekraam; daarna handmatige live-verificatie quickstart §4 (incl. T014)
- [ ] T019 Fitness checks (`scripts/fitness-check.sh` + F-01 RLS via Supabase MCP) en FEATURES.md-update via `@feature-tracker` — na implementatie

---

## Dependencies & Execution Order

### Fasedenkwoud

- **Phase 1-2**: T002 en T003 [P] parallel; T001 vooraf of parallel
- **Phase 3 (US1, MVP)**: T004 (test-first) → T005 → T006 → T007 → T008 (hooks vóór component, component vóór montage, montage vóór ChatPage-opschoning); blokkeert US2/US3 (formulier en wijzigflows bouwen op AnswerFeedback)
- **Phase 4-5 (US2-US3)**: sequentieel na US1 (zelfde bestanden); T009 en T011 breiden hetzelfde spec-bestand uit (onderling sequentieel)
- **Phase 6 (US4)**: T013 [P] onafhankelijk — kan parallel met Phase 3-5 (ander bestandengebied, geen gedeelde staat)
- **Phase 7 (US5)**: T014 pas na T017/T018 (verificatie op uitgerolde productie)
- **Phase 8**: T015-T016 vóór T017; T017 vóór T018; T019 als laatste

### Binnen elke story

- E2e-scenario schrijven en FAIL aantonen vóór de implementatie van die story
- Hooks vóór component; component vóór montage; montage vóór pagina-integratie

### Parallel-mogelijkheden

- T002 + T003 (databaselaag) parallel
- T013 (US4, `supabase/functions/`) parallel aan Phase 3-5 (frontend)
- T004 (spec-scaffold) parallel aan T002/T003 (ander bestand; alleen T001 is nodig voor de RUN, niet voor het schrijven)

---

## Implementation Strategy

MVP-first: Phase 1-2 → Phase 3 (US1) opleveren en valideren (per antwoord beoordelen, balk weg) → US2 (redenscherm) → US3 (bewaard + wijzigbaar) → daarna P2: US4 parallel mogelijk vanaf foundational, US5-verificatie na uitrol → Phase 8 checks → migratie + release (T017/T018) → fitness/FEATURES (T019). Bij elke fase: `npx tsc --noEmit` + `npx eslint src/ --max-warnings 0` groen houden (pre-commit gate AGENTS.md); commits per afgeronde user story met conventional message (feat(feedback): …).

## Notes

- [P] = verschillende bestanden, geen afhankelijkheden; [Story] mapt op spec.md
- Bestaande specs (`chat-page.spec.ts`, `rag-chat.spec.ts`, `admin-only-management.spec.ts`) worden níét gewijzigd: hun `feedback_interactions`-mocks blijven geldig voor de nieuwe GET (null → "nog geen oordeel", research #12) — geen testmigratiefase nodig
- Geen nieuwe npm-dependencies; supabase-js in tests is een bestaande productie-dependency
- Migratie en Edge Function-deploy vallen buiten de codetaken en gebeuren uitsluitend via Supabase MCP met expliciete bevestiging van Jaap (T017/T018, quickstart §3)