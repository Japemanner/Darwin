# Implementation Plan: Risico-analyse als eigen pagina, met soepelere invoer

**Branch**: `014-risk-analysis-page` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-risk-analysis-page/spec.md` + de
technische route uit de `/speckit.plan`-opdracht (routes, retry-snapshot, zijbalkindicator,
formulieraanpassingen, expires_at in de lijst, tests)

## Summary

De risico-analyse verhuist uit het tijdelijke zijpaneel naar twee eigen pagina's binnen de
bestaande app-layout: `/analyse/new/:assistantId` (formulier + recente analyses) en
`/analyse/:runId` (status + resultaat) — adressen met uitsluitend uuid's (constitution
III). `AnalysisFlow` verdwijnt; de kaartknop op de assistentenpagina navigeert. De
componenten `AnalysisForm`, `RunCard`, `ResultView` en `RecentRunsPanel` worden hergebruikt;
het formulier herschikt (Klantreferentie bovenaan, Adviseur als vaste tekst in de kop),
krijgt alle kennisbronnen standaard aangevinkt (nieuwe run; retry herstelt de eerdere
keuze), de nieuwe hulptekst en voorbeeldtekst, en slepen-en-neerzetten naast de bestaande
knop. De retry-snapshot (in-memory, `src/lib/analysis-retry.ts`) krijgt een
`hadBestanden`-vlag zodat "Opnieuw" mét bijlagen een duidelijke melding toont; retry
navigeert met router-state `{ retryRunId }`. Nieuw `useAnalysisNotifications` (gedeelde
recente-runs-query, interval 10 s alléén zolang er queued/running-runs zijn) voedt een
badge bij het zijbalkmenu-item Assistenten en `document.title = "(n) Darwin"`; de
"gezien"-registratie is een sessionStorage-set met uitsluitend run-id's (zustand-store,
initialisatieregel: eerste laad markeert bestaande afrondingen als gezien; bekijken van
lijst/run reset de telling). `RecentRunSchema` krijgt het optionele veld `expires_at`
(rollout-veilig: de lijst blijft intact zolang de backend het veld nog niet levert), de
mock-server levert het, de contractnotitie komt in het 008-run-status-contract, en
`RecentRunsPanel` toont "beschikbaar tot dd-mm-jjjj" bij geslaagde runs. De bestaande
analysis-specs worden aan de nieuwe routes aangepast; nieuw: indicator-test (badge 1
na mock-afronding, weg na openen), Klantreferentie-bovenaan en bijlagen-melding bij
retry. Volledig frontend: geen migraties, edge functions of dependencies.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Vite 6 — frontend-only

**Primary Dependencies**: bestaand — react-router-dom v6 (routes, router-state),
TanStack Query v5 (gedeelde recente-runs-query met conditionele `refetchInterval`),
zustand v5 (gezien-store, `authStore.ts`-patroon + persist naar sessionStorage),
lucide-react, shadcn/ui (Badge), native drag events, Playwright — **geen nieuwe
npm-dependencies**

**Storage**: N/A — geen database- of Edge Function-wijzigingen. Frontend-state:
sessionStorage met uitsluitend run-id's (max 50, sessiegebonden — constitution III),
in-memory retry-snapshot Map, router-state (memory-only). Contract: +optioneel
`expires_at` op recente-lijst-items (notitie in `specs/008-risico-analyse-ui/contracts/run-status.md`)

**Testing**: Playwright (`tests/e2e/`) tegen de mock-server
(`scripts/mock-analysis-server.mjs`, `playwright.config.ts` webServer): bestaande
`analysis-form/run/jwt.spec.ts` aangepast aan de routes; nieuw
`analysis-notifications.spec.ts` (badge 1 → openen → weg; titel "(1) Darwin" →
basis-titel), form-volgorde/placeholder/standaardselectie in `analysis-form.spec.ts`,
bijlagen-melding in `analysis-run.spec.ts` (error-scenario, mét bestand)

**Target Platform**: Web (Netlify) — frontend-only release via develop → main

**Project Type**: web-app

**Performance Goals**: polling uitsluitend bij lopende analyses (10 s interval,
gedeeld door badge + lijst; run-pagina 3 s met bestaande backoff); één gedeelde
recente-runs-request; badge-afleiding is een memo over max 10 items

**Constraints**: adressen en tabbladtitel zonder klantinhoud; sessionStorage alleen
run-id's (constitution III); CONCEPT-labels ongewijzigd (constitution II); WCAG 2.1
AA — cijfertext geen kleur-only signaal, toetsenbordalternatief bij drag-and-drop
(constitution IV); UI Nederlands, code/identifiers/commits Engels (constitution I);
alleen route-genoemde bestanden; klaar = `tsc --noEmit`, `eslint --max-warnings 0`,
`npm run build` en de Playwright-tests van deze feature groen

**Scale/Scope**: 4 nieuwe bestanden (`AnalysisNewPage.tsx`, `AnalysisRunPage.tsx`,
`useAnalysisNotifications.ts`, `analysisSeenStore.ts`, `analysis-retry.ts`,
`analysis-notifications.spec.ts` — 6), 1 verwijderd (`AnalysisFlow.tsx`), ~10 licht
gewijzigd (`App.tsx`, `AssistantsPage.tsx`, `AppShell.tsx`, `AnalysisForm.tsx`,
`RecentRunsPanel.tsx`, `useRecentRuns.ts`, `analysis-schemas.ts`,
`mock-analysis-server.mjs`, 3 analysis-specs, 008-contractnotitie, `AGENTS.md`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Toelichting |
|---|------|--------|-------------|
| 1 | Dutch UI copy, u-vorm (Principle I) | PASS | Nieuwe teksten Nederlands en feitelijk: "Standaard zijn alle kennisbronnen van deze assistent geselecteerd." (route-tekst), placeholder "Bijvoorbeeld: de klant twijfelt of een aansprakelijkheidsverzekering voor zijn eenmanszaak nodig is." (route-tekst), "Bijlagen zijn niet bewaard. Voeg de bestanden opnieuw toe.", "beschikbaar tot <datum>", "Analyse niet gevonden", badge-label "n analyses klaar of mislukt sinds uw laatste bezoek". Code, identifiers en commits Engels. |
| 2 | Concept, never advice (Principle II) | PASS | De CONCEPT-regel ("Risico-analyse — CONCEPT, door adviseur te accorderen") verhuist mee naar de paginakop; `ResultView` en het download-label blijven ongewijzigd; geen nieuwe aanbevelende formuleringen. |
| 3 | Client data sensitivity (Principle III) | PASS | Adressen: uitsluitend uuid's; router-state is memory-only (nooit URL); sessionStorage bevat uitsluitend run-id's (sessiegebonden, expliciete route-instructie); retry-snapshot in-memory mét `hadBestanden` als boolean — bestandsinhoud noch formuliertekst in browseropslag; `document.title` bevat alleen een aantal. E2E gebruikt synthetische fixtures. Bestaande URL-waakhonden in de specs blijven geldig. |
| 4 | Accessibility WCAG 2.1 AA (Principle IV) | PASS | Badge: cijfertext met toegankelijke naam (geen kleur-only signaal), in beide nav-renders; drag-and-drop behoudt de bestaande knop als toetsenbordalternatief (acceptatiecriterium); formulierlabels/-fouten bestaan al aria-conform; nieuwe pagina's gebruiken de bestaande layout (focus, contrast, semantiek ongewijzigd). |
| 5 | Typed external clients, no silent failures (Principle V) | PASS | Hergebruik van de getypeerde `analysis-client` (JWT op elke call, NL foutcodes). `expires_at` is optioneel in `RecentRunSchema` juist óm een stille lege lijst te voorkomen zolang de backend het veld nog niet levert (research #7); runpagina toont expliciete foutstatussen (NOT_FOUND → nette melding; verbindingsfouten bestaand). |
| 6 | Minimal scope (Principle VI) | PASS | Geen nieuwe dependencies (zustand, router, TanStack Query, native DnD bestaan); geen nieuw zijbalk-item (badge bij Assistenten, route-keuze); `AnalysisFlow` verdwijnt omdat geen consument overblijft; alleen route-genoemde bestanden + de gevraagde 008-contractnotitie. |

**Re-check na Phase 1 (design): PASS** — het ontwerp voegt noodzakelijke verbredingen
aan de route toe, alle gedocumenteerd in [research.md](research.md): (a) de
retry-snapshot krijgt `hadBestanden` — zonder dat veld is de verplichte
bijlagen-melding (US5/FR-010) niet te tonen (#2); (b) `useRecentRuns` krijgt de
conditionele interval en deelt zijn queryKey met de indicatorhook — anders wordt de
polling-eis dubbel afgedwongen en verdubbelen de requests (#3); (c) `expires_at` is
optioneel i.p.v. verplicht — anders levert een backend-zonder-veld stilletjes een
lege lijst (#7); (d) de gezien-store krijgt een initialisatieregel — anders telt de
eerste login alle historische runs (#5). Vier correctheidsherstellingen binnen de
genoemde bestanden, geen scope-uitbreiding.

## Project Structure

### Documentation (this feature)

```text
specs/014-risk-analysis-page/
├── plan.md                      # Dit bestand
├── research.md                  # Phase 0: 12 onderzoeksbeslissingen (routes, retry, indicator,
│                                #   gezien-registratie, badge/titel, expires_at, formulier, DnD, tests)
├── data-model.md                # Phase 1: entiteiten, gezien-store, snapshot, transities
├── quickstart.md                # Phase 1: lokale checks, handmatige verificatie, release + backend-afstemming
├── contracts/
│   └── analysis-routes.md       # Phase 1: route-, lijst- en meldingencontract
├── checklists/
│   └── requirements.md          # Spec-quality-checklist (uit /speckit.specify)
└── tasks.md                     # /speckit.tasks (nog niet aangemaakt)
```

### Source Code (repository root)

```text
src/
├── pages/
│   ├── AnalysisNewPage.tsx           # NIEUW: kop (assistent + adviseur + CONCEPT-label),
│   │                                 #   AnalysisForm (+ bijlagen-melding bij retry), RecentRunsPanel,
│   │                                 #   submit → snapshot → navigate /analyse/:runId
│   ├── AnalysisRunPage.tsx           # NIEUW: RunCard + ResultView, Opnieuw → navigate met
│   │                                 #   { retryRunId }, NOT_FOUND-melding, run-gezien-markering
│   └── AssistantsPage.tsx            # kaartknop navigeert; AnalysisFlow-import/state/mount weg
├── components/
│   ├── analysis/
│   │   ├── AnalysisFlow.tsx          # VERWIJDERD (paneel; geen consumenten meer)
│   │   ├── AnalysisForm.tsx          # volgorde, standaardselectie, hulptekst, placeholder,
│   │   │                             #   drag-and-drop; Adviseur-veld weg
│   │   └── RecentRunsPanel.tsx       # + "beschikbaar tot dd-mm-jjjj" (succeeded + expires_at)
│   └── layout/
│       └── AppShell.tsx              # badge bij Assistenten (beide navs) + document.title-effect
├── hooks/
│   ├── useAnalysisNotifications.ts  # NIEUW: telling uit gedeelde query × gezien-store
│   └── useRecentRuns.ts              # conditionele refetchInterval (alleen queued/running)
├── store/
│   └── analysisSeenStore.ts          # NIEUW: zustand + sessionStorage (run-id's, initialized-vlag)
├── lib/
│   ├── analysis-retry.ts             # NIEUW: in-memory snapshot-Map + hadBestanden-vlag
│   └── analysis-schemas.ts           # RecentRunSchema + optioneel expires_at
└── App.tsx                           # +2 lazy routes (/analyse/new/:assistantId, /analyse/:runId)

scripts/mock-analysis-server.mjs       # publicRecent + expires_at
specs/008-risico-analyse-ui/contracts/run-status.md   # contractnotitie expires_at (feature 014)
tests/e2e/
├── analysis-notifications.spec.ts    # NIEUW: badge 1 na afronding, weg na openen, titel
├── analysis-form.spec.ts             # routes + volgorde/placeholder/standaardselectie
├── analysis-run.spec.ts             # routes + terugkeer via run-adres + bijlagen-melding
└── analysis-jwt.spec.ts             # route-comment (recent-call nu ook via AppShell-hook)
```

**Structure Decision**: bestaande structuur ongewijzigd — de feature voegt twee
pagina's, één hook, één store en één lib-module toe aan de bestaande
`src/`-indeling (pages/components/hooks/store/lib) en hergebruikt alle
analysecomponenten; geen nieuwe mappen of projecten.

## Complexity Tracking

> Geen constitution-schendingen om te rechtvaardigen — tabel blijft leeg. De vier
> route-verbredingen uit de re-check zijn correctheidsherstel binnen de genoemde
> bestanden (research #2, #3, #5, #7), geen complexiteit boven de constitution.