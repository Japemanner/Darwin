# Tasks: Beheerfuncties alleen voor beheerders

**Input**: Design documents from `/specs/010-admin-only-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/permissions-matrix.md, quickstart.md

**Tests**: Inbegrepen — de spec eist expliciet geautomatiseerde tests (SC-001 t/m SC-006) en AGENTS.md vereist Playwright-dekking + regressie per feature. E2e-taken worden uitgevoerd via de **Playwright MCP-agent** (`@playwright-tester`), nooit handmatig geschreven.

**Organization**: Taken gegroepeerd per user story (US1-US4 uit spec.md, alle P1). Elk besturingselement met file:line-verwijzing staat in `contracts/permissions-matrix.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan parallel (verschillende bestanden, geen afhankelijkheden)
- **[Story]**: User story uit spec.md
- Exacte bestandspaden in elke beschrijving

---

## Phase 1: Setup

**Purpose**: Testomgeving-voorbereiding die alle story-fasen nodig hebben

- [ ] T001 Documenteer de testaccount-omgevingsvariabelen `E2E_MEMBER_EMAIL` en `E2E_MEMBER_PASSWORD` in `.env.example` (comment: member-testaccount met `profiles.role = 'member'`, gebruikt door tests/e2e/fixtures.ts en scripts/rls-verify.mjs); zet de waarden zelf in de lokale `.env.local` (account aanmaken gebeurt handmatig, zie quickstart.md stap 1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Testinfrastructuur die alle US1/US2/US3-e2e-taken delen

**⚠️ CRITICAL**: e2e-taken van US1/US2/US3 kunnen pas starten na deze fase

- [ ] T002 Voeg een member-login-fixture toe aan `tests/e2e/fixtures.ts` naast de bestaande `page`-fixture (`:11-24`): nieuw fixture `memberPage` dat inlogt met `E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD`, met een duidelijke skip-melding (Nederlands) als de omgevingsvariabelen ontbreken — zelfde patroon als de bestaande fixture; hiermee wordt ook de bestaande `test.skip` in `tests/e2e/flow-config.spec.ts:141-146` implementeerbaar

**Checkpoint**: Fixture klaar — story-implementatie en e2e-taken kunnen starten

---

## Phase 3: User Story 1 - Adviseur gebruikt alleen actieve assistenten (Priority: P1) 🎯 MVP

**Goal**: Member ziet op het assistentoverzicht alleen actieve assistenten met leesbaar typelabel en omschrijving, zonder enige beheerbesturing; chat/analyse starten blijft werken.

**Independent Test**: e2e met `memberPage`-fixture (gemockte assistenten incl. één inactieve): alleen actieve kaarten zichtbaar met "Chat"/"Risico-analyse"-labels en omschrijving; geen bewerkknop of aanmaakknop in de DOM; toetsenbordnavigatie bereikt geen beheerbesturing; chat-knop start de chat-flow.

### Tests for User Story 1

- [ ] T003 [P] [US1] Schrijf via de Playwright MCP-agent e2e-tests in `tests/e2e/admin-only-management.spec.ts` (nieuw bestand, REST gemocked via `page.route` — patroon `tests/e2e/rag-chat.spec.ts:35-58`): member-zicht op het assistentoverzicht toont uitsluitend actieve assistenten, typelabels "Chat" en "Risico-analyse" (geen ruwe typecodes), de omschrijving zonder systeeminstructie-fallback, geen "Nieuwe assistent"-knop/bewerkknop in de DOM (`queryByRole`/`getByRole` leveren niets), géén bewerk-/aanmaakmodal in de DOM (role="dialog" levert niets — de enige triggers zijn de verdwenen knoppen, waarmee FR-005/webhook-URL expliciet is afgedekt), en geen enkele beheerbesturing in de tab-volgorde; verifieer dat de tests FAILen vóór implementatie

### Implementation for User Story 1

Alle taken in `src/pages/AssistantsPage.tsx` (sequentieel, zelfde bestand — geen [P]):

- [ ] T004 [US1] Rol-gating in `src/pages/AssistantsPage.tsx`: voeg `const isAdmin = profile?.role === 'admin'` toe (patroon `src/components/layout/AppShell.tsx:35`), render de knop "Nieuwe assistent" (`:70-72`) en de EmptyState-CTA (`:80`) alleen voor admins, geef members een lege-EmptyState zonder actie, en vervang de beheer-ondertitel "Beheer je AI assistenten en hun configuratie" (`:68`) door een zakelijke lees-variant voor members (constitution I)
- [ ] T005 [US1] Leesbare typelabels in `src/pages/AssistantsPage.tsx`: voeg labelmap `chat → "Chat"`, `risico_analyse → "Risico-analyse"` toe (FR-001) en gebruik die in de typebadge (`:94`) in plaats van `{a.type}`; de bestaande `ASSISTANT_TYPES`-map (`:32-35`) blijft ongemoeid voor het Select-veld in de admin-modal
- [ ] T006 [US1] Omschrijving en zichtbaarheid in `src/pages/AssistantsPage.tsx`: vervang de fallback `a.description || a.system_prompt` (`:100`) door `a.description ?? ''` (FR-003: systeeminstructie nooit tonen) en filter de kaartenlijst voor members op `is_active` (`isAdmin ? all : all.filter(a => a.is_active)` — FR-002; filter in de pagina, niet in `useAssistants`, zie research.md beslissing 4)
- [ ] T007 [US1] Bewerkknop-gating in `src/pages/AssistantsPage.tsx`: render de Pencil-bewerkknop (`:113-115`) alleen voor admins (conditioneel renderen, dus ook onbereikbaar via toetsenbord — FR-004); de startknoppen "Chat" (`:109-111`) en "Risico-analyse starten" (`:104-107`) blijven voor alle rollen

**Checkpoint**: US1 werkt zelfstandig: member-zicht is alleen-lezen, admin-zicht ongewijzigd

---

## Phase 4: User Story 2 - Adviseur ziet Kennisbronnen alleen-lezen (Priority: P1)

**Goal**: Member ziet kennisbronnen, documenten en statussen, zonder upload-, bewerk- of verwijderbesturing; de detailweergave blijft via kaartklik bereikbaar.

**Independent Test**: e2e met `memberPage`-fixture (gemockte kennisbronnen/documenten): kennisbronkaarten klikbaar naar de detailweergave met statusbadges; geen "Nieuwe kennisbron"-knop, bewerkknop, upload-zone, document-verwijderknop of kennisitem-formulier in de DOM.

### Tests for User Story 2

- [ ] T008 [US2] Schrijf via de Playwright MCP-agent e2e-tests in `tests/e2e/admin-only-management.spec.ts` (zelfde bestand als T003 — daarom na T003): member-zicht op Kennisbronnen toont bronnen en documenten met statusbadges, kaartklik opent de detailweergave, en er is géén upload-zone/bewerkknop/verwijderknop/kennisitem-formulier in de DOM of tab-volgorde; verifieer dat de tests FAILen vóór implementatie

### Implementation for User Story 2

- [ ] T009 [US2] Rol-gating in `src/pages/KnowledgePage.tsx`: voeg `const isAdmin = profile?.role === 'admin'` toe, render de knop "Nieuwe kennisbron" (`:58-60`) en de EmptyState-CTA (`:68`) alleen voor admins (members krijgen de lege-variant zonder actie), en vervang de beheer-ondertitel "Beheer documenten en koppel ze aan assistenten" (`:56`) door een zakelijke lees-variant voor members
- [ ] T010 [US2] KB-bewerkknop-gating in `src/pages/KnowledgePage.tsx`: render de "Bewerken"-knop per kennisbronkaart (`:86-88`) alleen voor admins; de kaartklik naar de KBSlideOver (`:73`) blijft voor alle rollen (FR-006-toegang)
- [ ] T011 [US2] KBSlideOver lees-weergave in `src/pages/KnowledgePage.tsx`: geef de KBSlideOver een `isAdmin`-prop en render daarmee de upload-zone (`:320-327`), document-verwijderknop (`:355-357`), kennisitem-formulier (`:367-401`) en kennisitem-verwijderknop (`:423-425`) alleen voor admins; de documentstatusbadges (`:346-354`), kennisitem-lijst met embeddingstatus (`:408-428`) en de tab "Gekoppeld" (`:433-451`) blijven voor alle rollen zichtbaar

**Checkpoint**: US2 werkt zelfstandig: kennisbronnen zijn voor members volledig alleen-lezen

---

## Phase 5: User Story 3 - Beheerder behoudt alle beheermogelijkheden (Priority: P1)

**Goal**: Waarborg dat de gating uit US1/US2 geen enkele admin-functionaliteit heeft gekost; inactieve assistenten dragen het label "Inactief".

**Independent Test**: e2e met de bestaande admin-fixture: bewerkknop, aanmaakknoppen, upload-zone en verwijderknoppen zijn aanwezig en functioneel; de "Inactief"-badge staat op de inactieve assistentkaart; de volledige bestaande regressiesuite blijft groen.

*Opmerking*: US3 heeft geen eigen implementatietaken — het bestaat uit verificatie van de gating uit US1/US2 (het "Inactief"-label bestaat al op `src/pages/AssistantsPage.tsx:93`).

### Tests for User Story 3

- [ ] T012 [US3] Schrijf via de Playwright MCP-agent e2e-tests in `tests/e2e/admin-only-management.spec.ts` (zelfde bestand — na T003/T008): admin-zicht toont de knop "Nieuwe assistent", de Pencil-bewerkknop, de "Inactief"-badge op een inactieve assistentkaart, de knop "Nieuwe kennisbron", de KB-bewerkknop en in de detailweergave de upload-zone en verwijderknoppen (admin-pariteit, FR-011, SC-005)
- [ ] T013 [US3] Draai via de Playwright MCP-agent de volledige bestaande regressiesuite (`tests/e2e/*.spec.ts`, incl. `rag-chat`, `document-webhook`, `flow-config`) — admin-flows en chat blijven ongewijzigd werken (FR-010, SC-004)

**Checkpoint**: Admin-pariteit en regressie bewezen

---

## Phase 6: User Story 4 - Het gegevensplatform dwingt de rechten af (Priority: P1)

**Goal**: Members krijgen RLS-weigeringen op alle 15 schrijfcombinaties (5 tabellen × insert/update/delete) en op storage-upload/-verwijdering; lezen binnen de eigen organisatie en eigen gesprekken/berichten/feedback blijven werken.

**Independent Test**: `node scripts/rls-verify.mjs` tegen de live database met het member-account: alle 15 schrijfchecks + storage-checks worden geweigerd (SC-001/SC-002), lees- en gesprekschecks slagen; SQL-controles uit quickstart.md §4 tonen de admin-only-policies.

### Tests for User Story 4

- [ ] T014 [P] [US4] Schrijf `scripts/rls-verify.mjs` (Node, `@supabase/supabase-js`): log in met `E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD` (URL/anon-key uit `.env.local`), test alle 15 combinaties (INSERT/UPDATE/DELETE op `ai_assistants`, `knowledge_bases`, `knowledge_base_documents`, `knowledge_items`, `assistant_knowledge_bases`) plus storage INSERT/DELETE in bucket `knowledge-documents` — verwacht per combinatie een weigering; daarnaast positieve checks: lezen binnen de eigen organisatie slaagt en eigen `conversations`/`messages`/`feedback_interactions` schrijven slaagt (de feedback-tabel uit `supabase/migrations/004_chat_feedback.sql` heet `feedback_interactions`); druk per combinatie PASS/FAIL af met niet-nul exit-code bij falen; draai het script vóór de migratie en verifieer dat de schrijfchecks FAILen (het script bewijzt dan dat het echt test — zie quickstart.md §2)

### Implementation for User Story 4

- [ ] T015 [US4] Schrijf `supabase/migrations/015_admin_only_writes.sql` exact volgens de matrix in `specs/010-admin-only-management/data-model.md`: helper `is_org_admin()` (STABLE SECURITY DEFINER, patroon `get_user_org_id()`), vervang de schrijf-policies op `ai_assistants` (INSERT/UPDATE/DELETE, uit `001:218-228`), `knowledge_bases` (INSERT/UPDATE/DELETE, uit `001:235-245`), `knowledge_base_documents` (INSERT/DELETE, uit `007:221-227`), `knowledge_items` (INSERT/DELETE, uit `002:101-116`) en `assistant_knowledge_bases` (INSERT/DELETE, uit `007:157-186`) door admin-only-versies (org-scope + `is_org_admin()`), en vervang de storage-policies INSERT/UPDATE/DELETE voor bucket `knowledge-documents` (uit `007:83-121`) door org-pad + admin; SELECT-policies blijven ongemoeid; transactioneel (BEGIN/COMMIT) met `DROP POLICY IF EXISTS`
- [ ] T016 **Release-stap** (uit te voeren volgens `specs/010-admin-only-management/quickstart.md` §3, ná de frontend-deploy naar `main`): pas migratie `015_admin_only_writes.sql` toe via de **Supabase MCP** (AGENTS.md: alle schema-wijzigingen via MCP) en verifieer: draai `node scripts/rls-verify.mjs` (nu volledig PASS — SC-001/SC-002) en de SQL-controles uit `specs/010-admin-only-management/quickstart.md` §4 (pg_policies tonen de "Admins can …"-varianten + `is_org_admin()` bestaat)

**Checkpoint**: Database-afdwinging bewezen, ook bij omzeiling van de UI

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Feature-completion volgens AGENTS.md (Definition of Done)

- [ ] T017 Draai de volledige pre-commit gates: `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0`, `npm run build` en `bash scripts/fitness-check.sh` — alles moet groen zijn
- [ ] T018 Draai via de Playwright MCP-agent de volledige regressiesuite inclusief `tests/e2e/admin-only-management.spec.ts` en verwerk eventuele bevindingen
- [ ] T019 Werk `FEATURES.md` bij via `@feature-tracker` met de nieuwe feature (assistenten- en kennisbronbeheer admin-only, leesbare typelabels, RLS-hardening 015)
- [ ] T020 Draai `@fitness-checker`: `scripts/fitness-check.sh`, daarna F-01 (RLS-enabled check) en F-10 (bucket-policies) via de Supabase MCP, en F-16/F-17 (Snyk SAST/SCA) via de Snyk MCP; schrijf `FITNESS.md`
- [ ] T021 Valideer de rolloutvolgorde uit `specs/010-admin-only-management/quickstart.md` (frontend deploy → migratie via MCP → rls-verify → MCP-verificaties F-01/F-10) en voer de handmatige eindcontrole uit (member: alleen actieve assistenten, geen beheer; admin: alles incl. "Inactief")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Direct startbaar
- **Foundational (Phase 2)**: Na Phase 1 — blokkeert de e2e-taken van US1/US2/US3
- **US1 (Phase 3)**: Na Phase 2 (T003) — implementatie T004-T007 kan direct na Phase 1 parallel
- **US2 (Phase 4)**: Na Phase 2 (T008) — implementatie T009-T011 is onafhankelijk van US1 (ander bestand)
- **US3 (Phase 5)**: Verificatie van US1+US2 — T012/T013 ná T004-T011
- **US4 (Phase 6)**: Volledig onafhankelijk van de UI-stories (database-laag) — kan parallel met Phase 3-5
- **Polish (Phase 7)**: Na alle stories

### User Story Dependencies

- **US1**: geen afhankelijkheden (implementatie: `src/pages/AssistantsPage.tsx`)
- **US2**: geen afhankelijkheden (implementatie: `src/pages/KnowledgePage.tsx`)
- **US3**: hangt af van US1 + US2-implementatie (verifieert de gating)
- **US4**: geen afhankelijkheden (migratie + script; raakt geen UI-bestanden)

### Parallel Opportunities

- T001 + T002 kunnen met T014 en T015 parallel (verschillende bestanden: fixtures/tests vs. scripts/migratie)
- US1-implementatie (T004-T007) kan parallel met US2-implementatie (T009-T011) en met heel US4 (T014-T016) — verschillende bestanden
- Binnen US4: T014 (scripts/rls-verify.mjs) parallel aan T015 (supabase/migrations/015_admin_only_writes.sql)

### Parallel Example: US1 + US2 + US4

```bash
# Twee "developers"/sessies parallel:
Dev A: T004 → T005 → T006 → T007 (AssistantsPage.tsx)
Dev B: T009 → T010 → T011 (KnowledgePage.tsx)
Dev C: T014 → T015 → T016 (scripts/rls-verify.mjs, migratie 015, Supabase MCP)

# Daarna samen: T003 + T008 + T012/T013 (testbestand delen — sequentieel)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1-2 (env-documentatie + member-fixture)
2. Complete US1 (T003-T007): adviseurs zien het assistentoverzicht alleen-lezen
3. **STOP and VALIDATE**: e2e US1 groen; handmatige check member + admin
4. Deploy-klaar — maar de volledige feature (inclusief US4-migratie) hoort in één release, zie quickstart.md §3

### Incremental Delivery

1. Phase 1-2 → fixture klaar
2. US1 → valideer → US2 → valideer (beide UI-laag, onafhankelijk testbaar)
3. US3 → admin-pariteit en regressie bewezen
4. US4 → RLS-hardening + rls-verify PASS
5. Polish → fitness, FEATURES.md, FITNESS.md, rollout

---

## Notes

- [P] = verschillende bestanden, geen afhankelijkheden; taken in hetzelfde bestand zijn sequentieel
- e2e-tests uitsluitend via de **Playwright MCP-agent** (`@playwright-tester`) schrijven en draaien (AGENTS.md); tests FAILen vóór de bijbehorende implementatie (TDD)
- Migratie uitsluitend via de **Supabase MCP** toepassen (AGENTS.md: geen raw SQL buiten MCP)
- `@feature-tracker` (FEATURES.md) en `@fitness-checker` (FITNESS.md) na de feature (AGENTS.md: After Every Feature)
- Commits: conventional commits (`feat(ui): …`, `feat(db): …`, `test(e2e): …`) per logische groep; feature-branch → PR naar `develop`, nooit direct naar `main`
- Rollout-volgorde (frontend eerst, daarna migratie) staat in quickstart.md §3 — het venster tussen beide is bewust kort
- Verborgen besturing = conditioneel gerenderd (geen CSS-hide): FR-004/SC-003 eisen DOM-afwezigheid en toetsenbord-onbereikbaarheid