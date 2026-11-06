# Tasks: Assistenten verwijderen uit de AI-assistentenlijst

**Input**: Design documents from `/specs/023-delete-assistants/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Inbegrepen — de projectspec vereist minimaal één Playwright-test per feature.
De UI-flows worden gemockt getest; de echte databank-, RLS- en autorisatiepaden
worden in Phase 8 volgens quickstart.md gecontroleerd.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel uitvoerbaar (ander bestand, geen afhankelijkheid)
- **[Story]**: user story uit spec.md
- Paden zijn relatief vanaf de repositoryroot.

---

## Phase 1: Setup

- [x] T001 Controleer de uitgangssituatie op branch `023-delete-assistants`:
  `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0` en `npm run build`
  (`package.json`). Noteer de resultaten; bij een bestaande fout eerst stoppen.
- [x] T002 [P] Leg de acceptatiegegevens vast uit `specs/023-delete-assistants/quickstart.md`
  §0: platformbeheerdersaccount, twee organisaties, een testassistent met een bestaand
  gesprek en een organisatie die tijdens het archief wordt aangemaakt.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Doel**: het archiefmodel, de beheerroute en de gedeelde frontend-bouwstenen staan
voordat de verhalen verder bouwen.

- [x] T003 Voeg in `supabase/migrations/025_assistant_archive.sql` de kolommen
  `archived_at timestamptz` toe aan `public.assistant_catalog` en
  `public.ai_assistants`, plus de index
  `ai_assistants_organization_archived_idx (organization_id, archived_at)`
  (data-model.md §1 en §7).
- [x] T004 Voeg in `supabase/migrations/025_assistant_archive.sql` de functie
  `public.platform_archive_catalog_assistant(p_id uuid)` toe: `SECURITY DEFINER`,
  `search_path = public`, geconditioneerde `UPDATE ... RETURNING` op de catalogus,
  spiegel het tijdstip naar alle `ai_assistants`-rijen, `already_archived`/`not_found`
  bij een botsing, `EXECUTE` alleen voor `service_role` (data-model.md §2).
- [x] T005 Voeg in `supabase/migrations/025_assistant_archive.sql` de functie
  `public.platform_restore_catalog_assistant(p_id uuid, p_actor uuid)` toe: wis beide
  `archived_at`-waarden, behoud `is_active`, voeg voor organisaties zonder rij een rij
  met `is_active = false` toe, `not_archived`/`not_found` bij een botsing, `EXECUTE`
  alleen voor `service_role` (data-model.md §2).
- [x] T006 Vervang in `supabase/migrations/025_assistant_archive.sql` de functie
  `public.platform_seed_org_assistants(p_org uuid, p_actor uuid)` door de versie met
  `WHERE c.archived_at IS NULL`, zodat `create-tenant` nooit een gearchiveerde
  assistent zaait (data-model.md §2).
- [x] T007 [P] Voeg `archived_at: string | null` toe aan de `Row`, `Insert` en `Update`
  van `ai_assistants` in `src/types/database.types.ts` (research.md #9).
- [x] T008 [P] Voeg in `src/lib/platform-admin-client.ts` de interface
  `ArchivedAssistant` en de functies `listArchivedAssistants()`,
  `archiveCatalogAssistant(catalogId)` en `restoreCatalogAssistant(catalogId)` toe,
  met de bestaande foutmapping (contracts/platform-admin-archive.md).
- [x] T009 Voeg in `supabase/functions/platform-admin/index.ts` de acties
  `list_archived_assistants`, `archive_catalog_assistant` en
  `restore_catalog_assistant` toe, inclusief UUID-validatie, `p_actor = user.id`,
  de Nederlandse foutmeldingen voor `not_found`/`already_archived`/`not_archived` en
  logging zonder namen of URL's (contracts/platform-admin-archive.md).
- [x] T010 [P] Breid in `src/components/ui/dialog.tsx` de bestaande focusafhandeling
  uit: onthoud de opener bij de open-transitie en zet de focus bij sluiten terug als
  het element nog in het document staat (research.md #7).
- [x] T011 [P] Voeg in `src/hooks/queries.ts` de query `useArchivedAssistants(enabled)`
  en de mutaties `useArchiveAssistant(orgId)` en `useRestoreAssistant(orgId)` toe;
  invalideer `['assistants']`, `['archived-assistants']` en
  `['dashboard-counts', orgId]` na succes (plan.md §Frontend).
- [x] T012 Voeg in `src/hooks/queries.ts` `.is('archived_at', null)` toe aan
  `useAssistants`, zodat een gearchiveerde assistent direct uit de lijst verdwijnt.
- [x] T013 **Checkpoint**: `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0` en
  `npm run build` zijn groen (`package.json`).

---

## Phase 3: User Story 1 — Een assistent verwijderen (P1) 🎯 MVP

**Goal**: de platformbeheerder verwijdert een assistent vanaf AI-assistenten met een
bevestiging en ziet hem direct uit de lijst verdwijnen.

**Independent Test**: mock `ai_assistants` en `platform-admin`, open AI-assistenten,
annuleer de verwijdering (kaart blijft), bevestig daarna (kaart weg, bevestiging
zichtbaar) en controleer de focus na sluiten.

- [x] T014 [US1] Maak `src/components/assistants/DeleteAssistantDialog.tsx`: titel
  "Assistent verwijderen", waarschuwing met naam, "voor alle organisaties",
  "gesprekken en analyses blijven leesbaar", "herstel via het archief",
  **Annuleren** eerst, **Verwijderen** destructief, wachtstand en uitgeschakelde knop
  tijdens opslaan, Nederlandse foutmelding bij mislukken (spec FR-001–FR-004,
  FR-011–FR-015).
- [x] T015 [US1] Werk `src/pages/AssistantsPage.tsx` bij: een prullenbak-knop per
  kaart alleen voor `isPlatformAdmin`, met `aria-label="<naam> verwijderen"`; koppel
  het venster aan T014; na succes de toast "Assistent verwijderd" en de focus naar de
  **Archief**-knop; na annuleren/sluiten de focus terug naar de opener.
- [x] T016 [US1] Voeg in `tests/e2e/assistant-archive.spec.ts` de verwijderflow toe
  met gemockte `**/rest/v1/ai_assistants*` en `**/functions/v1/platform-admin`:
  knop aanwezig, venster met naam en gevolgen, annuleren laat de kaart staan,
  bevestigen stuurt `archive_catalog_assistant`, verwijdert de kaart en toont de
  bevestiging; controleer de focus na sluiten.
- [x] T017 [US1] Voer `npx playwright test tests/e2e/assistant-archive.spec.ts` uit en
  daarna `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0` en `npm run build`
  (`package.json`); los alles op tot groen.

**Checkpoint**: de assistent verdwijnt uit de lijst en de bevestiging werkt; de rest
van de zichtbaarheid volgt in US2.

---

## Phase 4: User Story 2 — Voor gebruikers overal weg en onbruikbaar (P1)

**Goal**: een gearchiveerde assistent is niet meer zichtbaar op het startscherm, in de
geschiedenis, via een directe link, in Instellingen of in Koppelingen, en niet meer
bruikbaar voor chat of analyse.

**Independent Test**: mock een gearchiveerde rij en controleer dat lijst, opties,
detail, dashboardtelling, startscherm, geschiedenis en directe links hem niet
aanbieden; controleer daarnaast met een echte aanroep dat `rag-chat` en
`analysis-run-submit` weigeren (Phase 8).

- [x] T018 [P] [US2] Voeg in `src/hooks/queries.ts` `.is('archived_at', null)` toe aan
  `useAssistantOptions` en `useAssistant`, filter gearchiveerde rijen uit
  `useLinkedAssistants`, en sluit ze uit van de assistententelling in
  `useDashboardCounts`.
- [x] T019 [P] [US2] Scherp in `supabase/functions/platform-admin/index.ts` de bestaande
  acties aan: `list_org_assistants` en `get_connections` filteren
  `archived_at IS NULL`; `save_connections` weigert een gearchiveerde `catalog_id`;
  `set_assistant_active` raakt alleen niet-gearchiveerde rijen;
  `save_catalog_assistant` weigert een gearchiveerde id
  (contracts/platform-admin-archive.md).
- [x] T020 [P] [US2] Voeg in `supabase/functions/rag-chat/index.ts` `archived_at` toe
  aan de assistentselect en weiger een gezette waarde via de bestaande
  `FORBIDDEN`-route, vóór het opslaan van berichten of het aanroepen van n8n.
- [x] T021 [P] [US2] Voeg in `supabase/functions/analysis-run-submit/index.ts`
  `archived_at` toe aan de assistentselect en weiger een gezette waarde naast de
  bestaande `is_active`-, type- en organisatiecontrole.
- [x] T022 [US2] Voeg in `tests/e2e/assistant-archive.spec.ts` de zichtbaarheidstests
  toe: de lijst- en detailrequest bevatten `archived_at=is.null`, een gearchiveerde
  assistent verschijnt niet op AI-assistenten, en `/chat/new/<id>` en
  `/analyse/new/<id>` tonen "Assistent niet gevonden".
- [ ] T023 [US2] Voer de spec en de statische controles uit (`package.json`) en
  controleer handmatig met SQL dat gesprekken, berichten, analyses en
  kennisbronkoppelingen ongewijzigd zijn (quickstart.md §5.2). De SQL-controle wacht op T033.

**Checkpoint**: de assistent is voor gebruikers op alle aanbiedingen verdwenen en
server-side onbruikbaar.

---

## Phase 5: User Story 3 — Alleen de platformbeheerder (P1)

**Goal**: kantoorbeheerders en adviseurs zien geen verwijder- of herstelbesturing en
de server weigert hun directe aanroepen.

**Independent Test**: mock `is_platform_admin = false` en controleer dat noch de
prullenbak noch **Archief** bestaat; controleer in Phase 8 met echte JWT's dat de
beheerroute 403 en anoniem 401 geeft.

- [x] T024 [P] [US3] Voeg in `tests/e2e/assistant-archive.spec.ts` de kantoorbeheerder-
  test toe: mock `**/rest/v1/rpc/is_platform_admin` op `false` en
  `**/rest/v1/ai_assistants*`, open AI-assistenten en controleer dat er geen
  verwijderknop, geen **Archief**-knop en geen herstelknop bestaat.
- [x] T025 [US3] Controleer in `src/pages/AssistantsPage.tsx` dat beide besturingen
  uitsluitend op `isPlatformAdmin` staan en niet op `canManage`; leg dit vast in een
  korte comment boven de conditionele blokken.
- [x] T026 [US3] Voer `npx playwright test tests/e2e/assistant-archive.spec.ts` en de
  statische controles uit (`package.json`).

**Checkpoint**: de UI is rolgebaseerd afgeschermd; de serverafdwinging volgt in
Phase 8.

---

## Phase 6: User Story 4 — Mislukken en botsen laat niets half achter (P2)

**Goal**: een mislukte of dubbele verwijdering geeft een Nederlandse melding en laat
de assistent of volledig bestaan of volledig verwijderd zijn.

**Independent Test**: mock een 500-response en een tweede `already_archived`-response
en controleer dat de kaart blijft staan, de fout zichtbaar is en de knop niet
dubbel indient.

- [x] T027 [US4] Voeg in `tests/e2e/assistant-archive.spec.ts` de foutpaden toe: een
  mislukte `archive_catalog_assistant` toont een Nederlandse foutmelding en laat de
  kaart staan; een `already_archived`-respons toont "Deze assistent is al verwijderd."
  en werkt de lijst bij; controleer dat de knop tijdens opslaan is uitgeschakeld.
- [ ] T028 [US4] Voer de spec en de statische controles uit (`package.json`) en
  controleer dat een mislukte actie geen gedeeltelijke `archived_at`-waarde achterlaat
  (quickstart.md §7). De atomiciteitscontrole wacht op T033.

**Checkpoint**: de UI faalt zichtbaar en zonder halve toestand.

---

## Phase 7: User Story 5 — Herstellen vanuit het archief (P2)

**Goal**: de platformbeheerder ziet verwijderde assistenten in het archief en herstelt
ze met dezelfde aan/uit-standen als vóór het verwijderen.

**Independent Test**: mock een gearchiveerde assistent, open **Archief**, controleer
icoon/naam/type/datum, herstel en controleer dat de assistent weer in de lijst staat
en het archief leeg is.

- [x] T029 [US5] Maak `src/components/assistants/ArchiveDialog.tsx`: haal de lijst op
  bij openen, toon icoon, naam, typelabel en de verwijderdatum in Nederlands formaat,
  een **Herstellen**-knop per rij met `aria-label="<naam> herstellen"`, een laadstand,
  een Nederlandse foutmelding en de lege toestand "Geen verwijderde assistenten"
  (spec FR-019–FR-026).
- [x] T030 [US5] Werk `src/pages/AssistantsPage.tsx` bij: een **Archief**-knop in de
  kop alleen voor `isPlatformAdmin`, gekoppeld aan T029; na herstel de toast
  "Assistent hersteld" en een ververste assistentenlijst.
- [x] T031 [US5] Voeg in `tests/e2e/assistant-archive.spec.ts` de archief- en
  herstelstroom toe: `list_archived_assistants` toont de rij, **Herstellen** stuurt
  `restore_catalog_assistant`, de rij verdwijnt en de assistent staat weer in de
  lijst; test ook de lege toestand.
- [x] T032 [US5] Voer de spec en de statische controles uit (`package.json`).

**Checkpoint**: verwijderen is omkeerbaar en de oude schakelaarstanden blijven
behouden.

---

## Phase 8: Deployment & Verification

**Doel**: de migratie en functies toepassen in de juiste volgorde en de echte
databank-, RLS- en autorisatiepaden bewijzen. **Vraag voor elke deploy expliciete
bevestiging in de chat.**

- [ ] T033 Pas `supabase/migrations/025_assistant_archive.sql` toe via de Supabase MCP
  (`apply_migration`) en verifieer kolommen, index, functies en uitvoerrechten met de
  queries uit `specs/023-delete-assistants/quickstart.md` §1; draai de security- en
  performance-advisors.
- [ ] T034 Deploy `platform-admin` via de Supabase MCP (`deploy_edge_function`,
  JWT-verificatie aan) en rooktest `list_archived_assistants`
  (`specs/023-delete-assistants/quickstart.md` §2).
- [ ] T035 Deploy `rag-chat` en `analysis-run-submit` via de Supabase MCP en controleer
  dat de bestaande chat- en analyseflows ongewijzigd werken
  (`specs/023-delete-assistants/quickstart.md` §2).
- [ ] T036 Voer de handmatige acceptatie uit van `specs/023-delete-assistants/quickstart.md`
  §5.1–§5.4: archiveren, zichtbaarheid en bruikbaarheid, nieuwe organisatie tijdens
  het archief, en herstellen inclusief de oude schakelaarstanden.
- [ ] T037 Voer de negatieve beveiligingscontroles uit van
  `specs/023-delete-assistants/quickstart.md` §6: anoniem 401, kantoorbeheerder 403 op
  archiveren en herstellen, en geen wijziging na elke weigering.
- [ ] T038 Voer de idempotentie- en atomiciteitscontroles uit van
  `specs/023-delete-assistants/quickstart.md` §7: dubbel archiveren, dubbel herstellen,
  onbekend id en een gesimuleerde fout.
- [ ] T039 Voer de volledige Playwright-suite, `npx tsc --noEmit`,
  `npx eslint src/ --max-warnings 0` en `npm run build` uit (`package.json`); alles
  moet groen zijn.
- [ ] T040 Voer `bash scripts/fitness-check.sh` uit en daarna de Supabase MCP-controles
  voor RLS en buckets en de Snyk SAST/SCA-scans volgens `AGENTS.md`; werk
  `FITNESS.md` bij.
- [ ] T041 Werk `FEATURES.md` bij met de nieuwe mogelijkheid (verwijderen en herstellen
  van assistenten) volgens het bestaande feature-trackerformaat.
- [ ] T042 Werk het statusblok tussen `<!-- SPECKIT START -->` en
  `<!-- SPECKIT END -->` in `AGENTS.md` bij met de toegepaste migratie, gedeployde
  functies en verificatieresultaten.
- [ ] T043 Release via PR `develop` → `main` volgens `AGENTS.md` en controleer de
  Netlify-productiedeploy met dezelfde acceptatie als T036.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen dependencies; start direct.
- **Foundational (Phase 2)**: na Setup; blokkeert alle user stories.
- **US1 (Phase 3)**: na Foundational; geen dependency op andere stories. **MVP**.
- **US2 (Phase 4)**: na Foundational; raakt dezelfde bestanden als Foundational
  (`queries.ts`, `platform-admin`), dus in de praktijk na T011/T012/T009.
- **US3 (Phase 5)**: na US1 (T015) voor de UI-test; serverchecks in Phase 8.
- **US4 (Phase 6)**: na US1 (T014/T015).
- **US5 (Phase 7)**: na US1 (T015) en Foundational (T010/T011).
- **Deployment & Verification (Phase 8)**: na alle verhalen en na expliciete
  bevestiging voor T033–T035.

### Within Each Story

- Eerst de component/client/hook, dan de pagina-integratie, dan de test.
- Een story is pas klaar als de eigen Playwright-test en de statische controles groen
  zijn.
- De functionele serverchecks volgen in Phase 8; de UI-tests gebruiken mocks.

### Parallel Opportunities

- T007, T008 en T010 raken verschillende bestanden en kunnen parallel.
- T018, T019, T020 en T021 raken verschillende bestanden en kunnen na Foundational
  parallel (T019 deelt `platform-admin` met T009, dus niet gelijktijdig met T009).
- T024 kan parallel met T020/T021 zodra T015 klaar is.
- Binnen Phase 8 zijn T039 en T040 deels parallel, maar T040 pas na een groene T039.

---

## Parallel Example: Foundational

```text
T007  src/types/database.types.ts
T008  src/lib/platform-admin-client.ts
T010  src/components/ui/dialog.tsx
```

## Parallel Example: User Story 2

```text
T018  src/hooks/queries.ts
T019  supabase/functions/platform-admin/index.ts
T020  supabase/functions/rag-chat/index.ts
T021  supabase/functions/analysis-run-submit/index.ts
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup.
2. Phase 2: Foundational (verplicht).
3. Phase 3: US1 — verwijderen vanaf AI-assistenten.
4. **STOP en VALIDEER**: T017 groen; de kaart verdwijnt en de bevestiging werkt.
5. Daarna US2 om de assistent ook elders onzichtbaar en onbruikbaar te maken.

### Incremental Delivery

1. Fundering + US1 → de gevraagde verwijderknop werkt.
2. US2 → de assistent is overal weg en server-side onbruikbaar.
3. US3 → de rolafscherming is aantoonbaar.
4. US4 → fouten en botsingen laten niets half achter.
5. US5 → herstellen vanuit het archief.
6. Phase 8 → migratie, deploy en echte verificatie in de preview.

### Notes

- [P] = ander bestand, geen dependency op een nog openstaande taak.
- Elke story is afzonderlijk testbaar met mocks; de echte serverpaden horen bij
  Phase 8.
- Commit na elke logische groep met een conventionele message (`feat(assistants): …`,
  `test(assistants): …`, `chore(db): …`).
- Verplaats een taak terug naar `[ ]` als hij niet af is; pas nooit spec.md, plan.md
  of de constitutie aan om een reviewbevinding weg te werken.
