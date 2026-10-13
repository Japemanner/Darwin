# Tasks: Beveiligde n8n-koppeling via de server

**Input**: Design documents from `/specs/009-secure-n8n-proxy/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Explicitly requested — Playwright coverage per user story (chat success + volledige foutcode-matrix, document-melding, settings write-only, JWT-header; per plan.md + spec SC-002/SC-003). Testbevindingen uit de analyse (specs/009-secure-n8n-proxy/analysis.md) zijn verwerkt.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `supabase/`, `tests/` at repository root (per plan.md)

---

## Phase 1: Setup

**Purpose**: Standalone deliverables without runtime effect until rollout

- [ ] T001 [P] [US3] Create migration file `supabase/migrations/014_flow_configs_token_lockdown.sql` per `data-model.md`: (a) token-wipe `UPDATE flow_configs SET webhook_token = ''`; (b) `REVOKE SELECT` van `anon, authenticated`; (c) kolom-level `GRANT SELECT` (7 kolommen, zonder `webhook_token`) aan `authenticated`; (d) **UPDATE-policy hercreëren mét `WITH CHECK`** (DROP + CREATE zoals in data-model.md — sluit cross-tenant herpositionering van config-rijen; review-finding HIGH). **Alleen het bestand** — niet toepassen op Supabase (rollout: quickstart.md; expliciete bevestiging vereist). NB: nummer 014 omdat 013 committed is en `012_link_existing_user_to_darwin.sql` lokaal nog untracked staat.

**Checkpoint**: migratiebestand klaar; geen enkele story heeft het nodig vóór de rollout (service role omzeilt grants)

---

## Phase 2: User Story 1 — Vraag stellen aan een chat-assistent (Priority: P1) 🎯 MVP

**Goal**: De server valideert de sessie, bepaalt organisatie/kennisbronnen en haalt het antwoord op bij n8n; de browser doet geen n8n-verkeer meer; kennisbronnamen gaan als lijst.

**Independent Test**: Chatvraag stellen met een via `page.route` gemockte edge function: antwoord + bronnen renderen; elke foutcode toont de Nederlandse melding; de request-body bevat alleen id's.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T002 [P] [US1] Playwright in `tests/e2e/rag-chat.spec.ts` — `page.route('**/functions/v1/rag-chat')` plus afvanging van de `conversations`/`messages`-REST-inserts (`**/rest/v1/conversations*`, `**/rest/v1/messages*`) zodat er **geen testdata in het productie-Supabase-project** wordt geschreven: (a) happy path: antwoord + bronnen (incl. %-badge) renderen zoals nu; (b) **alle zeven foutcodes** (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_CONFIGURED`, `UPSTREAM_AUTH`, `UPSTREAM_TIMEOUT`, `UPSTREAM_ERROR`, `UPSTREAM_UNREACHABLE`) toont de Nederlandse melding uit contracts/rag-chat.md als toast; (c) ongeldig antwoordformaat: 200 met leeg/vervormd body → getypeerde NL-melding, nooit een stil leeg antwoord (spec edge case); (d) de request-body naar de edge function bevat uitsluitend `assistant_id`, `conversation_id`, `message` — geen tenantId, kennisbronnen, token of system prompt; (e) tijdens de chatflow verlaat geen request de browser naar een n8n-/webhook-domein (SC-002: request-listener, afgezet tegen niet-Supabase-hosts zodat PostHog-verkeer geen vals alarm geeft)

### Implementation for User Story 1

- [ ] T003 [US1] Create `supabase/functions/rag-chat/index.ts` per `contracts/rag-chat.md`, in de huisstijl van `supabase/functions/invite-user/index.ts`: Bearer-JWT → `supabase.auth.getUser` (401 `UNAUTHORIZED`); user-context client (anon key + Authorization-header van de gebruiker doorgegeven, RLS geldt) voor profiel/organisatie (**uitsluitend uit het `profiles`-record van `auth.uid()`**), assistent (zelfde org, `is_active`), gesprek (eigenaar + assistent-match), kennisbronnen (join `assistant_knowledge_bases`), organisatienaam en laatste 20 berichten — lege/niet-vindbare reads → 403 `FORBIDDEN`; URL-keuze exact als `webhook.ts:218-238`: type `chat` → `flow_configs` via service role met fallback op `assistant.n8n_webhook_url`; overige types → alleen `assistant.n8n_webhook_url`; geen URL → 400 `NOT_CONFIGURED`; **server-side URL-guard** (https, geen letterlijk IP/localhost/link-local, ook voor de fallback-URL); `message` max. 10.000 tekens; n8n-payload met `knowledge_sources: string[]` (NIEUW) + legacy `knowledgeSourceName` + `tenantId`; n8n-fetch 60 s met geconfigureerde header; poort van `extractWebhookResponse` (arrays/objecten, legacy `response`-veld, fallback "Geen antwoord ontvangen"); `verification` en `rewritten_query` doorgeven; `sources` ongewijzigd doorsturen (incl. `knowledge_item_id`, `score`); fouten als JSON `{ code, message }`; **CORS fail-closed via `ALLOWED_ORIGINS`** (ongeconfigureerd/geen match → geen ACAO-header, nooit `*`); logging uitsluitend code/id's/duur — nooit ruwe payloads, antwoorden of fetch-fouten met URL's (constitution III)
- [ ] T004 [US1] Create `src/lib/rag-client.ts`: typed client rond `supabase.functions.invoke('rag-chat')`; mapt `FunctionsHttpError` (body `{ code, message }`), `FunctionsRelayError`/`FunctionsFetchError` (→ `UPSTREAM_UNREACHABLE`) naar `RagClientError` met de Nederlandse tekst per code uit contracts/rag-chat.md; zod-validatie van de succesresponse (`answer` verplicht; `sources`, `verification`, `rewritten_query` optioneel); exporteert types; logt nooit berichtinhoud
- [ ] T005 [US1] Rewire `ChatWindow.handleSend` in `src/pages/AssistantsPage.tsx`: vervang de `Promise.all` door **eerst** `await` het insert van het gebruikersbericht en **daarna** de `rag-client`-aanroep (deterministisch: de server-geladen historiek bevat het zojuist verstuurde bericht; bekend en ongevaarlijk neveneffect: n8n ziet de huidige vraag zowel in `history` als in `message`); optimistische UI ongewijzigd; toast-titel mapping op basis van `RagClientError.code` (niet op tekstheuristiek): `UNAUTHORIZED` → "Authenticatiefout", `FORBIDDEN` → "Geen toegang", `NOT_CONFIGURED` → "Configuratie ontbreekt", `UPSTREAM_*` → "Verbindingsfout", anders "Fout bij versturen"; verwijder de `callRagWebhook`-import; het fire-and-forget opslaan van het assistentbericht blijft zoals het is

**Checkpoint**: US1 zelfstandig testbaar — chat werkt volledig via de edge function; `callRagWebhook` wordt nergens meer aangeroepen

---

## Phase 3: User Story 2 — Document upload of verwijdering melden (Priority: P1)

**Goal**: De server meldt document-wijzigingen aan n8n met een zelfgemaakte downloadlink; bij mislukking blijft het document staan en ziet de beheerder een Nederlandse melding met foutcode.

**Independent Test**: Upload en verwijdering met gemockte edge function: upload → invoke `{ document_id, action: 'index' }`; mislukte delete → document staat nog in de lijst + Nederlandse toast mét melding en code.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [P] [US2] Playwright in `tests/e2e/document-webhook.spec.ts` — `page.route('**/functions/v1/document-webhook')` plus mocking van de storage-upload en de `knowledge_base_documents`-REST-calls (zodat er **geen echte data in het productie-Supabase-project** wordt geschreven): (a) upload triggert de invoke met `{ document_id, action: 'index' }` (geen naam/pad/download-URL in de body); (b) mislukte document-melding (502 `UPSTREAM_UNREACHABLE`) bij upload → Nederlandse toast met foutcode, document/rij blijft bestaan; (c) geslaagde delete → invoke met `{ document_id, action: 'delete' }`, document verdwijnt; (d) mislukte delete → Nederlandse toast **met de NL-melding en foutcode als beschrijving** en het document staat nog in de lijst (spec US2 scenario 3)

### Implementation for User Story 2

- [ ] T007 [US2] Create `supabase/functions/document-webhook/index.ts` per `contracts/document-webhook.md`: JWT-validatie (401); documentrij lezen via de user-context client (RLS dwingt organisatie af; **organisatie uitsluitend uit het `profiles`-record van `auth.uid()`**) → 403 indien niet-vindbaar; kennisbronnaam via `knowledge_base_id`, organisatienaam server-side; `flow_configs` (`document_processing`) via service role → 400 `NOT_CONFIGURED` (de huidige stille no-op vervalt); **server-side URL-guard** (https, geen letterlijk IP/localhost/link-local); bij `index`/`modify` signed URL (900 s, bucket `knowledge-documents`) via service role, bij `delete` `""`; n8n-payload exact als de huidige `callDocumentWebhook`; n8n-fetch 10 s; foutcodes + `{ code, message }`; CORS fail-closed via `ALLOWED_ORIGINS`; logging alleen actie/document-id/code/duur — geen documentnamen, signed URL's of fetch-fouten met URL's
- [ ] T008 [US2] Rewire `src/lib/storage.ts` **en `src/pages/KnowledgePage.tsx`**: typed invoke `document-webhook` met `{ document_id, action }` (zod-validatie; `DocumentWebhookError` met NL-tekst per code, zelfde mapping als rag-client); `uploadDocument`: na de rij-insert de invoke — bij mislukking rij+bestand laten staan en de typed error opgooien; `deleteDocument`: **eerst** de invoke (rij bestaat nog), pas bij succes bestand+rij verwijderen; bij mislukking opgooien; **in `KnowledgePage.tsx` `handleDeleteDoc` aanpassen naar `catch (err)` en `err.message` als toast-beschrijving meenemen** (de huidige lege `catch` toont alleen "Fout bij verwijderen" zonder reden — FR-009/constitution V)

**Checkpoint**: US1 + US2 zelfstandig functioneel; `callDocumentWebhook` wordt nergens meer aangeroepen

---

## Phase 4: User Story 3 — Webhook-configuratie in Instellingen (Priority: P1)

**Goal**: Beheerder stelt URL/headernaam/token in en test de verbinding; het token is daarna alleen te vervangen, nooit uit te lezen (client noch REST).

**Independent Test**: Instellingen met gemockte flow-config: `has_token: true` → placeholder "Token is ingesteld"; opslaan met leeg tokenveld stuurt geen token mee; testknop toont het Nederlandse resultaat.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [P] [US3] Playwright in `tests/e2e/flow-config.spec.ts` — `page.route('**/functions/v1/flow-config')`: (a) `get` met `has_token: true` → tokenveld toont placeholder "Token is ingesteld" en blijft leeg; (b) `get` zonder bestaande configuratie (lege strings, `has_token: false`) → leeg formulier; (c) opslaan met leeg tokenveld → request-body zonder `webhook_token`; (d) opslaan met nieuw token → token in de body (plaintext via HTTPS); (e) `test` → het Nederlandse resultaat (succes en mislukking met code) verschijnt in de resultbox; (f) een `/webhook-test/`-URL wordt geweigerd met de bestaande Nederlandse uitleg (spec US3 scenario 5); (g) `test` met een afwijkende URL en leeg tokenveld → weigering "Voer het token in om een andere URL te testen." (token-uitbuitingsrule); (h) niet-beheerder ziet de instelvelden niet (UI-gate op `profile.role === 'admin'`, zie T012)

### Implementation for User Story 3

- [ ] T010 [US3] Create `supabase/functions/flow-config/index.ts` per `contracts/flow-config.md`: JWT-validatie (401) + admincheck via `profiles.role = 'admin'` (403 `FORBIDDEN`; organisatie uitsluitend uit het `profiles`-record); `get` → `{ flow_type, webhook_url, webhook_auth_header, has_token }` (nooit de tokenwaarde, service-role lees; **niet-bestaande configuratie → lege strings + `has_token: false`**); `save` → upsert op `(flow_type, organization_id)`, token als platte tekst, leeg/afwezig token laat het bestaande staan, **server-side https-URL-guard** (geen letterlijk IP/localhost/link-local) → 400 `VALIDATION` met NL-melding; `test` → poort van `testWebhook` (`/webhook-test/`-weigering met de bestaande Nederlandse uitleg, testpayload, 10 s time-out, 500-met-IF-node-nuance) — token: meegegeven, of opgeslagen **alleen als de URL ongewijzigd is**; afwijkende URL + leeg token → weigering met NL-melding (token gaat nooit naar een andere host); CORS fail-closed via `ALLOWED_ORIGINS`; logging zonder tokenwaarden of fetch-fouten met URL's
- [ ] T011 [US3] Create `src/lib/flow-config-client.ts`: typed client rond `supabase.functions.invoke('flow-config')` voor `get`/`save`/`test`, zelfde foutmapping-patroon als `rag-client.ts` (`FlowConfigClientError` met NL-tekst per code, incl. `VALIDATION`); exporteert het `TestResult`-type dat de UI gebruikt
- [ ] T012 [US3] Rewire `FlowConfigCard` in `src/pages/SettingsPage.tsx`: hydratatie via `flow-config-client.get` (placeholder "Token is ingesteld" bij `has_token`; veld blijft leeg; lege configuratie → leeg formulier); `handleSave` via `save` (leeg veld = ongewijzigd — de server bewaart het bestaande token); `handleTest` via `test` (lege invoer + ongewijzigde URL + `has_token` → server gebruikt het opgeslagen token); **UI-gate: de FlowConfigCard alleen renderen voor `profile.role === 'admin'`**, niet-beheerders zien een korte Nederlandse "geen toegang"-melding; verwijder de imports van `encryptToken`, `decryptToken`, `testWebhook`, **het type `WebhookTestResult`** (vervangen door het client-type uit T011) en de `useFlowConfig`/`useSaveFlowConfig`-hooks
- [ ] T013 [US3] Remove `useFlowConfig` **en** `useSaveFlowConfig` uit `src/hooks/queries.ts` (beide orphaned door T012; enige consumer was `SettingsPage.tsx`) — daarmee resteert er geen enkele `flow_configs`-query in de frontend (ook het unqualified `.select()`-risico verdwijnt)

**Checkpoint**: US1–US3 zelfstandig functioneel; het token is nergens meer in de browser leesbaar of ontsleutelbaar

---

## Phase 5: User Story 4 — Risico-analyse verifieert de sessie (Priority: P2)

**Goal**: Alle drie de aanroepen van de risico-analyse-client sturen het sessie-JWT mee, conform de contracten van feature 008; de mock server negeert de header (backward-compatibel).

**Independent Test**: `page.route`-interceptie toont een niet-lege `Authorization`-header op submit, statuspoll en recente-runs; een gesimuleerde 401 toont de NL-melding.

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T014 [P] [US4] Playwright in `tests/e2e/analysis-jwt.spec.ts` — hergebruik de bestaande fixtures/mock (MOCK_SCENARIO rich): intercepteer `POST /analysis-runs`, `GET /analysis-runs/:id` en `GET /analysis-runs?…` via `page.route` en assert dat `request.headers()['authorization']` begint met "Bearer " en niet leeg is; **plus een gemockte 401-variant** (route vangt de call af en geeft 401 `{ "error": "invalid token" }`) → de UI toont "Uw sessie is verlopen. Log opnieuw in." (spec US4 scenario 2); de bestaande analysis-specs blijven groen (header is backward-compatibel met de mock)

### Implementation for User Story 4

- [ ] T015 [US4] Adjust `src/lib/analysis-client.ts`: haal voor elke call de sessie op via `supabase.auth.getSession()` en voeg `Authorization: Bearer ${session.access_token}` toe aan `submitAnalysisRun`, `fetchAnalysisRun` en `fetchRecentRuns`; AbortControllers/time-outs en foutmapping ongewijzigd; geen sessie → de bestaande 401-afhandeling ("Uw sessie is verlopen…")

**Checkpoint**: alle user stories zelfstandig functioneel

---

## Phase 6: Cleanup & Hardening (depends on US1 + US2 + US3)

**Purpose**: Verwijderen wat door de migratie wees is geworden en het blijvend afdwingen

- [ ] T016 Delete `src/lib/webhook.ts` volledig — verify met grep dat geen enkele import meer bestaat (`callRagWebhook`, `callDocumentWebhook`, `testWebhook`, `encryptToken`, `decryptToken`, `invalidateAssistantKBCache`, `WebhookTestResult`, `DocumentAction`); het dode `kbCache`-mechanisme verdwijnt mee
- [ ] T017 Remove `VITE_ENCRYPTION_KEY` from `src/vite-env.d.ts` en `.env.example` (pas ná T016 — anders faalt `tsc`); noteer in het eindoverzicht dat de waarde ook uit Netlify verwijderd moet worden (quickstart stap 6)
- [ ] T018 [P] Add fitness check **F-18** to `scripts/fitness-check.sh` (volgende vrije nummer na F-17): FAIL wanneer `VITE_ENCRYPTION_KEY` of **`crypto.subtle.`** (breder dan alleen `decrypt` — dekt ook `encrypt`/`importKey`) voorkomt in `src/` (poort van het patroon van F-02/F-09)
- [ ] T019 [P] Add `role="status"`/`aria-live` to `src/components/ui/toast.tsx` (assertive voor `variant: 'destructive'`) — de toast is na deze feature hét foutkanaal (FR-009, WCAG 2.1 AA, constitution IV); klein, chirurgisch: alleen rollen/live-regio toevoegen, geen herontwerp
- [ ] T020 Run de volledige poort: `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0`, `npm run build`, `npx playwright test` (volledige regressie incl. de nieuwe specs) en `bash scripts/fitness-check.sh`; los bevindingen op; bundelcontrole per quickstart stap 2 — grep op de **oude sleutelwaarde** (niet de naam) en op `crypto.subtle` in `dist/` (SC-001)
- [ ] T021 [P] Update `FEATURES.md` via het @feature-tracker-formaat met de feature-entry "Beveiligde n8n-koppeling via de server"
- [ ] T022 Zet de handmatige stappen uit `quickstart.md` (deploy via Supabase MCP, secrets `ALLOWED_ORIGINS`/`SUPABASE_ANON_KEY`, migratie 014 toepassen, token-invoer per organisatie ná de migratie, Netlify-env, payload-controle `knowledge_sources`) in het eindoverzicht — **niet zelf uitvoeren** (één productie-Supabase-project; expliciete bevestiging vereist)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen dependencies — T001 is een zelfstandig bestand
- **US1 (Phase 2)**, **US2 (Phase 3)**, **US3 (Phase 4)**, **US4 (Phase 5)**: onderling onafhankelijk — elke story bevat eigen edge function, client, UI en tests; parallel uitvoerbaar
- **Cleanup (Phase 6)**: vereist US1 + US2 + US3 voltooid (alle consumers van `webhook.ts` gemigreerd); T016 → T017 → T020 strikt sequentieel; T018 ∥ T019 (verschillende bestanden); T020 na T016–T019

### User Story Dependencies

- **US1 (P1)**: geen — MVP
- **US2 (P1)**: geen (alleen eigen bestanden; onafhankelijk van US1)
- **US3 (P1)**: geen (gebruikt geen onderdelen van US1/US2)
- **US4 (P2)**: geen — raakt alleen `analysis-client.ts` en nieuwe test

### Within Each User Story

- Playwright-tests eerst (fail), dan edge function, dan client, dan UI-integratie
- Edge function per story vóór de client die hem aanroept

### Parallel Opportunities

- T001 ∥ T002 ∥ T006 ∥ T009 ∥ T014 (verschillende bestanden)
- T003 ∥ T007 ∥ T010 ∥ T015 (verschillende edge functions/bestanden) na de bijbehorende tests
- T018 ∥ T019 in Phase 6 (na T016/T017)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: migratiebestand klaar
2. Phase 2: US1 — chat volledig via de server (MVP!)
3. **STOP and VALIDATE**: rag-chat-specs groen; handmatig: chat in de browser vertoont geen n8n-verkeer
4. Daarna US2, US3 (P1) en US4 (P2)
5. Phase 6 cleanup en hardening
6. Afronden per AGENTS.md (@feature-tracker, regressie, @fitness-checker, PR naar develop — niet zelf mergen)

### Definition of Done (per AGENTS.md + verbeterplan)

Elke fase: `npx tsc --noEmit` clean, `npx eslint src/ --max-warnings 0`, Playwright-tests van de story groen, fitness-checks groen, conventional commit per afgeronde user story (`feat(edge): …`, `feat(ui): …`, `chore(security): …`). Commit per user story, Engels commit-message (constitution I).

---

## Notes

- **Geen nieuwe npm-dependencies** (verbeterplan-randvoorwaarde)
- **Geen migraties toepassen op Supabase en geen Edge Function-deploys zonder expliciete bevestiging in de chat** — één productieproject (verbeterplan + AGENTS.md)
- UI-tekst Nederlands in u-vorm; code, identifiers en commits Engels
- Geen klantinhoud in URL's, console, logs of browseropslag (constitution III); edge functions loggen alleen code/id's/duur
- Alle e2e-tests draaien tegen `page.route`-mocks op de edge functions **en tegen gemockte storage/REST-calls** (geen echte data in het productieproject); de echte functies worden via de curl-scenario's en de payload-controle in quickstart.md geverifieerd
- Bekende kleine neveneffecten, bewust geaccepteerd in plan.md: huidige vraag staat zowel in `history` als in `message` richting n8n (T005); `sources` behoudt `score`/`knowledge_item_id` tot feature F; de token-loze per-assistent fallback-URL blijft rechtstreeks bij n8n aanroepbaar (rest-risico, spec-aanname)