# Tasks: Risico-analyse als eigen pagina, met soepelere invoer

**Input**: Design documents from `/specs/014-risk-analysis-page/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/analysis-routes.md, quickstart.md

**Tests**: Inbegrepen — route-item 6 eist expliciet nieuwe Playwright-gevallen en het acceptatiecriterium eist dat de bestaande `analysis-*.spec.ts` blijven slagen (aangepast aan de nieuwe routes). Alles draait tegen de mock-server (`scripts/mock-analysis-server.mjs`, poort 4010, `MOCK_SCENARIO=rich|error|...`); zonder `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local` skippen de tests met reden — zelfde gedocumenteerde staat als 010-013 (T001).

**Organization**: Taken gegroepeerd per user story (US1-US7 uit spec.md). US1-US3 zijn P1 (eigen pagina's, zijbalkindicator, formulierorde), US4-US6 zijn P2 (standaardselectie, bijlagen-melding, vervaldatum), US7 is P3 (slepen + placeholder). De gedeelde fundamenten (retry-module, expires_at-contract) staan in de foundational-fase; de "gezien"-store en indicatorhook horen bij US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kan parallel (verschillende bestanden, geen afhankelijkheden)
- **[Story]**: User story uit spec.md
- Exacte bestandspaden in elke beschrijving

---

## Phase 1: Setup

**Purpose**: Geen nieuwe infrastructuur — branch, dependencies, Vite, Playwright-config, mock-server en fixtures bestaan (geen nieuwe npm-dependencies).

- [x] T001 Controleer dat `.env.local` `E2E_EMAIL`/`E2E_PASSWORD` bevat (admin-testaccount uit `tests/e2e/fixtures.ts`); vul handmatig aan bij Jaap indien ontbreekt _(gecontroleerd 2026-10-29 bij feature 013: nog afwezig — suite skippt dan met reden; de analysis-specs draaien tegen de mock-server zodra het account bestaat)_. `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_ANALYSIS_API_URL` bestaan al _(2026-10-30: zelfde staat — 72 skipped / 0 failed)_.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Gedeelde datacontracten voor US1/US5 (retry-snapshot) en US6 (expires_at) — parallel uitvoerbaar; US1 heeft T002 nodig, US6 heeft T003 nodig.

- [x] T002 [P] Maak `src/lib/analysis-retry.ts` (research #2, data-model §Retry-snapshot): module-level in-memory `Map<string, AnalysisRetrySnapshot>` met `type AnalysisRetrySnapshot = { values: AnalysisFormValues; hadBestanden: boolean }` (import van `AnalysisFormValues` uit `@/components/analysis/AnalysisForm`), plus helper-functies `saveRetrySnapshot(runId, values, hadBestanden)`, `getRetrySnapshot(runId)` en `hasRetrySnapshot(runId)` — géén browseropslag (constitution III).
- [x] T003 [P] Voeg het optionele lijstveld `expires_at` toe (research #7; contracts/analysis-routes.md §2): (a) `RecentRunSchema` in `src/lib/analysis-schemas.ts` krijgt `expires_at: z.string().datetime().nullable().optional()` — optioneel zodat de lijst intact blijft zolang de echte backend het veld nog niet levert (`fetchRecentRuns` laat schema-onjuiste items stilletjes vallen, constitution V); (b) `publicRecent` in `scripts/mock-analysis-server.mjs` levert `expires_at: run.expires_at`; (c) notitie in `specs/008-risico-analyse-ui/contracts/run-status.md` §"Recente runs per adviseur": itemlijst + `expires_at`, gemerkt met datum + feature 014.

**Checkpoint**: Datacontracten staan — US1 en US6 kunnen bouwen

---

## Phase 3: User Story 1 - Eigen pagina met vast adres per analyse (Priority: P1) 🎯 MVP

**Goal**: Twee eigen pagina's (`/analyse/new/:assistantId` formulier + recente analyses, `/analyse/:runId` status + resultaat) binnen de AppShell-layout; het zijpaneel `AnalysisFlow` verdwijnt; de kaartknop navigeert; adressen bevatten uitsluitend uuid's.

**Independent Test**: e2e — start een analyse, navigeer weg, keer terug via het run-adres en via de lijst op de analysepagina: beide tonen de actuele status; de bestaande analysis-specs (aangepast aan de routes) slagen.

### Implementation for User Story 1

- [x] T004 [US1] Maak `src/pages/AnalysisNewPage.tsx` (research #1, contracts §1): route-param `assistantId` via `useAssistant`; kop met assistent-icoon/-naam, subtitel "Risico-analyse — CONCEPT, door adviseur te accorderen" (constitution II) én de adviseurnaam als vaste tekst uit `useAuth().profile`; niet-gevonden/inactief-assistent → nette NL-melding met teruglink (ChatPage-patroon `ChatPage.tsx:259-275`); `AnalysisForm` met `initial` uit de retry-snapshot wanneer `location.state.retryRunId` bestaat (`getRetrySnapshot`, T002); `RecentRunsPanel` (advisorId uit profiel, `onOpenRun` → `navigate('/analyse/<id>')`); submit-flow overgenomen van `AnalysisFlow.handleSubmit` (`AnalysisFlow.tsx:33-65`): `submitAnalysisRun` → `saveRetrySnapshot(newRunId, values, bestanden.length > 0)` → `navigate(\`/analyse/${runId}\`)`; NL foutafhandeling ongewijzigd (constitution V).
- [x] T005 [US1] Maak `src/pages/AnalysisRunPage.tsx` (research #1, #11): `useAnalysisRun(runId)` (bestaande poll 3 s + backoff, stopt bij succeeded/failed); `RunCard` + bij `succeeded` `ResultView` (beide hergebruikt, ongewijzigd); `NOT_FOUND` → nette "Analyse niet gevonden"-melding + teruglink; "Opnieuw" alleen bij `status === 'failed' && hasRetrySnapshot(runId)` → `navigate(\`/analyse/new/${run.assistant_id}\`, { state: { retryRunId: runId } })`; zonder snapshot de bestaande melding "De eerdere invoer is niet meer beschikbaar in deze sessie." (`AnalysisFlow.tsx:145-149`).
- [x] T006 [US1] Koppel de routes en verwijder het paneel: (a) `src/App.tsx` +2 lazy routes `/analyse/new/:assistantId` en `/analyse/:runId` binnen de AppShell-layout; (b) `src/pages/AssistantsPage.tsx` — kaartknop "Risico-analyse starten" → `navigate(\`/analyse/new/${a.id}\`)`, verwijder `analysisAssistant`-state, `AnalysisFlow`-import en de mount (regels 17, 62, 155-160); (c) verwijder `src/components/analysis/AnalysisFlow.tsx` (geen consumenten meer — grep-verifieer).
- [x] T007 [US1] Pas de bestaande specs aan de routes aan (research #12): `tests/e2e/analysis-form.spec.ts` — de knop navigeert nu naar `/analyse/new/:id`; groepsvalidatie-assertie `toHaveURL(/\/assistants/)` → `toHaveURL(/\/analyse\/new\//)`; `tests/e2e/analysis-run.spec.ts` — "survives navigation": na wegnavigeren terug naar het run-adres en naar de lijst op `/analyse/new/:assistantId` (KL-referentie + status zichtbaar in de rijen); retry-geval komt op `/analyse/new` terecht (inhoudsasserties ongewijzigd); `tests/e2e/analysis-jwt.spec.ts` — alleen comment-update (recent-call verhuist naar de pagina); verifieer dat de JWT- en URL-waakhonden blijven staan.

**Checkpoint**: US1 werkt zelfstandig — analyse overleeft navigatie via vaste id-only adressen; paneel weg; bestaande specs groen (gemockt)

---

## Phase 4: User Story 2 - Klaar-meldingen in de zijbalk en tabbladtitel (Priority: P1)

**Goal**: Badge bij zijbalkmenu-item "Assistenten" met het aantal afgeronde-ongeziene analyses, `(n) Darwin` in de tabbladtitel, telling reset bij bekijken, polling alléén bij lopende analyses.

**Independent Test**: e2e (T013) — badge toont 1 na een mock-afronding op een andere pagina en verdwijnt na het openen van de analyse; titel volgt mee.

### Implementation for User Story 2

- [x] T008 [US2] Maak `src/store/analysisSeenStore.ts` (research #4, data-model §Gezien-registratie): zustand-store (patroon `authStore.ts`) met persist naar **sessionStorage** (createJSONStorage) — `seenIds: string[]` (run-id's uitsluitend, geen inhoud, cap 50 bij markSeen), `initialized: boolean`, actie `markSeen(ids)`; herstelt uit sessionStorage bij store-aanmaak (constitution III: sessiegebonden).
- [x] T009 [US2] Wijzig `src/hooks/useRecentRuns.ts`: `refetchInterval` wordt een functie op de querydata — 10 s zolang de geladen lijst een run met status `queued`/`running` bevat, anders `false` (geen periodieke verzoeken zonder lopende analyses; research #3, FR-007). `staleTime` 5 s blijft.
- [x] T010 [US2] Maak `src/hooks/useAnalysisNotifications.ts` (research #3, #5; contracts §3): hergebruikt de query van `useRecentRuns` (zelfde `queryKey ['analysis-recent-runs', advisorId]`, één gedeelde request), berekent `count = runs.filter(succeeded|failed && !seenIds.has(id)).length`; eerste-initialisatie-effect: zodra de lijst voor het eerst geladen is en `initialized === false` → `markSeen(alle huidige afgeronde ids)` + vlag (spec edge case eerste gebruik — maakt de indicatortest deterministisch).
- [x] T011 [US2] Verwerk de badge en titel in `src/components/layout/AppShell.tsx` (research #6): `useAnalysisNotifications(profile?.id)`; pill-cijfertext bij het menu-item **Assistenten** in béíde nav-renders (gedeelde `navItems`, desktop regel 93+ en mobiel regel 46+), alleen bij n > 0, met toegankelijke naam "n analyses klaar of mislukt sinds uw laatste bezoek" (tekst, geen kleur-only signaal — WCAG); `document.title`-effect: basis-titel bij mount bewaard, n > 0 → `(n) Darwin`, anders terug naar de basis (research #6); nooit klantinhoud in de titel (constitution III).
- [x] T012 [US2] Bedraad het "bekijken reset": `src/pages/AnalysisNewPage.tsx` markeert bij (her)laden alle `succeeded`/`failed`-items uit de recente lijst als gezien (`markSeen`); `src/pages/AnalysisRunPage.tsx` markeert de run zodra die `succeeded`/`failed` is (ook als dat tijdens het kijken gebeurt).
- [x] T013 [US2] Maak `tests/e2e/analysis-notifications.spec.ts` (route-item 6; research #12): start een run via `/assistants` → onthoud het run-adres → navigeer naar `/knowledge` → wacht tot de badge "1" toont bij Assistenten en `document.title` is "(1) Darwin" (±15 s, mock rich) → open het run-adres → badge verdwenen en titel terug naar de basis; extra assertie: de badge bestaat niet vóór de afronding. Verifieer FAIL vóór implementatie.

**Checkpoint**: US2 werkt zelfstandig — badge + titel overal zichtbaar, reset bij bekijken, geen polling zonder lopende analyses

---

## Phase 5: User Story 3 - Formulier: Klantreferentie bovenaan, Adviseur in de kop (Priority: P1)

**Goal**: Klantreferentie is het eerste veld; de adviseurnaam staat als vaste tekst in de paginakop; het invoerveld Adviseur onderaan verdwijnt.

**Independent Test**: e2e (T015) — het eerste label in het formulier is Klantreferentie; het Adviseur-invoerveld bestaat niet; de kop toont de adviseurnaam.

### Implementation for User Story 3

- [x] T014 [US3] Herschik `src/components/analysis/AnalysisForm.tsx` (research #8; contracts §1): veldvolgorde Klantreferentie → Verzekeringsvraagstuk → Kennisbronnen → Klantsituatie → Bestanden → URL's; verwijder het Adviseur-invoerveld (regels 308-317 — de vaste tekst staat al in de paginakop sinds T004); alle bestaande validaties en ids ongewijzigd.
- [x] T015 [US3] Voeg toe aan `tests/e2e/analysis-form.spec.ts`: nieuw geval "Klantreferentie staat bovenaan" — het eerste label binnen het formulier heeft tekst "Klantreferentie" (`page.locator('form label').first()`), het Adviseur-invoerveld bestaat niet (`page.getByLabel(/adviseur/i)` count 0) en de paginakop bevat de adviseurnaam uit het profiel. Verifieer FAIL vóór implementatie.

**Checkpoint**: US3 werkt zelfstandig — het formulier begint bij de klant; adviseur staat vast in de kop

---

## Phase 6: User Story 4 - Kennisbronnen standaard aangevinkt (Priority: P2)

**Goal**: Bij een nieuwe analyse zijn alle kennisbronnen van de assistent aangevinkt (uitvinken kan); bij retry de eerdere keuze; de systeemlogica-tekst is vervangen.

**Independent Test**: e2e (T017) — bij openen staan alle checkboxen aan; één uitzetten blijft mogelijk; de hulptekst is de nieuwe tekst.

### Implementation for User Story 4

- [x] T016 [US4] Wijzig `src/components/analysis/AnalysisForm.tsx` (research #8): bij een néuw formulier (geen `initial`) worden na aankomst van `availableKBs` alle ids geselecteerd (effect: geen `initial` && lijst geladen → `setSelectedKBIds(new Set(alle ids))`); bij retry blijft `initial.kennisbronnen` ongewijzigd leidend; vervang de hulptekst "De selectie bepaalt het verzekerings­type." (regel 187) door de letterlijke route-tekst "Standaard zijn alle kennisbronnen van deze assistent geselecteerd."
- [x] T017 [US4] Voeg toe aan `tests/e2e/analysis-form.spec.ts`: nieuw geval "alle kennisbronnen standaard aangevinkt" — bij het openen van het formulier zijn alle kennisbroncheckboxen aangevinkt, de nieuwe hulptekst staat er en het uitzetten van één bron blijft mogelijk (`uncheck()`); de bestaande `.check()`-aanroepen in oudere gevallen blijven geldig (no-op op aangevinkt vak). Verifieer FAIL vóór implementatie.

**Checkpoint**: US4 werkt zelfstandig — nul handelingen voor de standaardselectie; retry herstelt de eerdere keuze

---

## Phase 7: User Story 5 - Melding bij "Opnieuw": bijlagen niet bewaard (Priority: P2)

**Goal**: Bij een retry waarvan de mislukte poging bijlagen had, toont de analysepagina een duidelijke melding dat bijlagen niet bewaard zijn; zonder eerdere bijlagen geen melding.

**Independent Test**: e2e (T019, error-scenario) — retry mét bestand toont de melding; zonder bestand niet.

### Implementation for User Story 5

- [x] T018 [US5] Toon de bijlagen-melding in `src/pages/AnalysisNewPage.tsx` (research #9; data-model §Retry-snapshot): wanneer een retry-prefill geladen wordt waarvan `snapshot.hadBestanden === true` (T002 vlag), een amber `role="note"`-blok boven het formulier: "Bijlagen zijn niet bewaard. Voeg de bestanden opnieuw toe." — informatief, blokkeert niet; geen melding wanneer `hadBestanden === false` of bij een nieuw formulier.
- [x] T019 [US5] Voeg toe aan `tests/e2e/analysis-run.spec.ts` (error-scenario, research #12): nieuw geval — start een run mét bestand (`setInputFiles` op `#bestanden`), wacht op "mislukt", klik "Opnieuw" → de amber bijlagen-melding is zichtbaar op `/analyse/new/:id` én de prefill (vraagstuk, klantreferentie) staat er; tweede run zónder bestand → na "Opnieuw" géén melding. Verifieer FAIL vóór implementatie.

**Checkpoint**: US5 werkt zelfstandig — geen stille bijlagendropping meer

---

## Phase 8: User Story 6 - Vervaldatum van het resultaat in de lijst (Priority: P2)

**Goal**: Elke geslaagde analyse in de recente-lijst toont tot wanneer het resultaat beschikbaar is; andere statussen niet.

**Independent Test**: e2e (T021) — na een geslaagde mock-run toont de rij "beschikbaar tot <dd-mm-jjjj>"; een lopende/mislukte rij toont dat niet.

### Implementation for User Story 6

- [x] T020 [US6] Toon de vervaldatum in `src/components/analysis/RecentRunsPanel.tsx` (research #7; contracts §2): bij `run.status === 'succeeded' && run.expires_at` een tekst "beschikbaar tot dd-mm-jjjj" in de rij (formatter met `toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })`); wachtrij/bezig/mislukt tonen géén vervaldatum; bestaande rij-informatie ongewijzigd.
- [x] T021 [US6] Voeg toe aan `tests/e2e/analysis-run.spec.ts` (rich scenario): nieuw geval — na "klaar" toont de rij in "Recente runs" op `/analyse/new/:id` de tekst "beschikbaar tot" met de datum van vandaag + 7 dagen; een rij die nog loopt toont die tekst niet. Verifieer FAIL vóór implementatie.

**Checkpoint**: US6 werkt zelfstandig — de bewaartermijn is zichtbaar vóór het openen

---

## Phase 9: User Story 7 - Bestanden slepen en voorbeeldtekst (Priority: P3)

**Goal**: Bestanden kunnen op het uploadvak gesleept worden met identieke controles; de knop blijft het toetsenbordalternatief; het lege vraagstukveld toont de voorbeeldtekst.

**Independent Test**: e2e (T023) — een gesleept bestand verschijnt in de bestandenlijst; een ongeldig bestand geeft de bestaande foutmelding; de knop blijft werken; de placeholder staat in het lege veld.

### Implementation for User Story 7

- [x] T022 [US7] Voeg slepen-en-neerzetten en de placeholder toe in `src/components/analysis/AnalysisForm.tsx` (research #10): het uploadvak (het label + omvattende zone) krijgt `onDragOver` (`e.preventDefault()` + `isDragging`-state voor visuele highlight) en `onDrop` (`e.preventDefault()` + bestaande `addFiles(e.dataTransfer.files)` — identieke controles en NL foutmeldingen); de bestaande knop "Bestanden kiezen" blijft volledig functioneren (toetsenbordalternatief, acceptatiecriterium); `placeholder` op het Verzekeringsvraagstuk-textarea: "Bijvoorbeeld: de klant twijfelt of een aansprakelijkheidsverzekering voor zijn eenmanszaak nodig is." (letterlijke route-tekst).
- [x] T023 [US7] Voeg toe aan `tests/e2e/analysis-form.spec.ts`: nieuw geval — simuleer een drop op het uploadvak via `page.dispatchEvent` met in-page geconstrueerde `DataTransfer` met een geldig bestand (Playwright-recept) → de bestandsnaam verschijnt in de bestandenlijst; daarna een drop met een ongeldig bestand (`.exe`) → de bestaande typemelding verschijnt; de placeholder-assertie op het lege vraagstukveld (`toHaveAttribute('placeholder', …)`) en een knop-controle (`setInputFiles`) blijven werken. Verifieer FAIL vóór implementatie.

**Checkpoint**: Alle zeven stories werken onafhankelijk; de volledige route is gedekt

---

## Phase 10: Polish & Verificatie

**Purpose**: Definition of Done (AGENTS.md "After Every Feature") + release (quickstart.md §4 — frontend-only, geen migratie of deploy-volgorde)

- [x] T024 Draai `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0` en `npm run build` — allemaal groen (randvoorwaarden uit de route) _(2026-10-30: tsc 0 fouten; eslint src/ 0 errors / 6 pre-existing baseline-warnings (geen enkele uit 014 — twee tijdens de bouw ontstane warnings zijn hersteld: AppShell-ref-cleanup, AnalysisForm-useMemo; tevens de pre-existing unused-import-error in analysis-form.spec.ts met de route-aanpassing opgelost); build groen in 7,0 s)_
- [x] T025 Draai de Playwright-suite: `npx playwright test tests/e2e/analysis-form.spec.ts tests/e2e/analysis-run.spec.ts tests/e2e/analysis-jwt.spec.ts tests/e2e/analysis-notifications.spec.ts` — groen of skip met reden (E2E-accounts uit T001); daarna `npx playwright test` als volledige regressie _(2026-10-30: volledige suite 72 skipped / 0 failed (64 bestaand + 8 nieuwe gevallen); 17 analysis-tests geregistreerd en parseerbaar — draaien vereist E2E-accounts)_
- [x] T026 [P] Update `FEATURES.md` (feature-tracker-stijl) met feature 014 (eigen pagina's, badge + titel, formulierorde, standaardselectie, bijlagen-melding, vervaldatum, DnD + placeholder) + supersede-notitie bij het 008-entry (paneel → pagina's) _(2026-10-30: uitgevoerd, total 22→23)_
- [x] T027 Fitness check: `scripts/fitness-check.sh` + F-01 (RLS) en F-10 (buckets) via Supabase MCP — géén DB-wijzigingen in deze feature, dus verificatie dat de bestaande staat ongewijzigd geldig is; schrijf `FITNESS.md` _(2026-10-30: script FAIL:0 / PASS:13 / WARN:1 / SKIP:4; Supabase/Snyk MCP niet actief in de sessie — gedocumenteerd als open achterstand; FITNESS.md-entry toegevoegd)_
- [x] T028 Release volgens quickstart.md §4: frontend-PR naar `develop` → preview testen → merge naar `main`; daarna handmatige live-verificatie quickstart.md §3 door Jaap; backend-afstemming `expires_at` op de recente-lijst (vrijblijvend — frontend werkt ook zonder) _(2026-10-30: feature-PR naar develop gesquasht en direct daarna de develop → main release-PR op eigenaarsinstructie ("merge naar main") — develop-preview overgeslagen (geen breekraam, frontend-only, alle lokale gates groen), zie `decisions/2026-10-30-014-directe-main-release.md`; handmatige live-verificatie §3 en backend-afstemming `expires_at` blijven open)_.

---

## Dependencies & Execution Order

### Fasedenkwoud

- **Phase 1-2**: T002 + T003 [P] parallel; T001 alleen nodig om te draaien
- **Phase 3 (US1, MVP)**: T004 (pagina, hangt af van T002) → T005 (run-pagina) → T006 (routes + paneel weg) → T007 (specs aanpassen — na T006, de oude flow bestaat niet meer)
- **Phase 4 (US2)**: T008 (store) → T010 (hook, hangt af van T008 + T009) ; T009 [P] parallel aan T008; T011 (badge + titel, hangt af van T010); T012 (markering, hangt af van T008 + de pagina's uit T004/T005); T013 (e2e, hangt af van T011 + T012)
- **Phase 5-6 (US3-US4)**: T014 → T016 (zelfde bestand `AnalysisForm.tsx`); T015 → T17 (zelfde spec-bestand, na de betreffende implementatie)
- **Phase 7 (US5)**: T018 (pagina, hangt af van T002 + T004) → T019 (e2e)
- **Phase 8 (US6)**: T020 (panel, hangt af van T003) → T021 (e2e)
- **Phase 9 (US7)**: T022 (zelfde bestand als T014/T016 — sequentieel daarop) → T023 (e2e)
- **Phase 10**: T024 → T025 → T028; T026/T027 [P] na afgeronde implementatie (parallel aan elkaar)

### Binnen elke story

- E2e-scenario schrijven en FAIL aantonen vóór de implementatie van die story (waar uitvoerbaar zonder E2E-accounts: registratie + lint)
- Data/hook-laag vóór component; component vóór montage; montage vóór pagina-integratie
- Per fase `npx tsc --noEmit` + `npx eslint src/ --max-warnings 0` groen houden (pre-commit gate AGENTS.md)

### Parallel-mogelijkheden

- T002 + T003 (foundational, verschillende bestanden)
- T008 + T009 (store en hook-interval, verschillende bestanden)
- T026 + T027 (FEATURES.md + fitness) parallel in Phase 10

---

## Implementation Strategy

**MVP-first**: Phase 1-2 → Phase 3 (US1: eigen pagina's met vaste adressen — het grootste pijnpunt) valideren → US2 (badge + titel) → US3 (formulierorde) → daarna P2: US4 → US5 → US6 → US7 → Phase 10. Het functionele increment is de volledige P1-block (US1-US3) in één PR, US4-US7 lopen in dezelfde PR mee (klein genoeg per story). Bij elke afgeronde story: `npx tsc --noEmit` + `npx eslint src/ --max-warnings 0` groen; commit per afgeronde user story met conventional message (`feat(analysis): …`, constitution I: commits Engels).

---

## Notes

- [P] = verschillende bestanden, geen afhankelijkheden; [Story] mapt op spec.md
- Bestaande specs worden bewust aangepast waar de UI die zij doorlopen verandert (navigatie-patroon, niet dekking): alleen de drie `analysis-*.spec.ts`; de overige specs raken niets van deze feature
- Geen nieuwe npm-dependencies: zustand (store), react-router-dom (routes/state), TanStack Query (interval), native drag events bestaan allemaal
- `AnalysisFlow.tsx` verdwijnt volledig — de hergebruikte componenten (`AnalysisForm`, `RunCard`, `ResultView`, `RecentRunsPanel`, `GapsPanel`) blijven bestaan; grep-verifieer geen resterende imports
- Geen database-, Edge Function- of n8n-wijzigingen; `expires_at` is een frontend-schema + mock-server-aanpassing met contractnotitie voor de echte backend (uitrolvolgorde vrij, research #7)
- De "gezien"-telling is sessie- en tabbladgebonden (sessionStorage, route-keuze); de eerste-initialisatieregel voorkomt historische natrellen (research #4, #5)