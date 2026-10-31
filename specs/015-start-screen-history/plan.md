# Implementation Plan: Startscherm rond de vraag en één overzicht van eerder werk

**Branch**: `015-start-screen-history` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/015-start-screen-history/spec.md` + de technische route uit de `/speckit.plan`-opdracht (route `/start`, StartPage, ChatPage-handoff, StartPage-blokken, History-tabs/zoeken, tests, contractnotitie).

## Summary

Het Command Center verdwijnt als landingspagina. Na inloggen komt de adviseur op `/start`
(`src/pages/StartPage.tsx`): één vraagveld, een keuze uit de actieve chat-assistenten, de
vijf laatste gesprekken, de vijf laatste risico-analyses met status en — als er een
risico-analyse-assistent is — de knop "Nieuwe risico-analyse". Versturen navigeert naar
`/chat/new/:assistantId` met `{ initialQuestion }` in router-state; `ChatPage` neemt de
vraag eenmalig over, wist de router-state direct met `replace` en verstuurt de vraag via de
bestaande flow. De vraag komt nooit in het adres, in localStorage/sessionStorage, in logs
of in PostHog (autocapture en session replay staan al uit).

`HistoryPage` wordt herschreven rond twee tabs (Gesprekken, Risico-analyses). Gesprekken
worden links naar `/chat/:conversationId` (geen alleen-lezen drawer meer) en analyses links
naar `/analyse/:runId` met status en "beschikbaar tot". Beide tabbladen hebben een
zoekveld dat uitsluitend in de browser op de al geladen lijst filtert. De drawer en de
Nieuw/Afgerond-badge verdwijnen; de bestaande assistent-filter blijft ongewijzigd op het
tabblad Gesprekken staan (geen nieuwe filters). `/command-center` en `*` verwijzen door
naar `/start`; de login-fallback wordt `/start` en het zijbalkmenu krijgt "Start" bovenaan.
`CommandCenterPage` en `useDashboardCounts` worden verwijderd. De recente-runs-hook krijgt
een `limit`-parameter
(5 op Start, 50 in Geschiedenis); het 008-contract legt vast dat `limit` tot 50 moet kunnen
en de mock-server ondersteunt dat al. Geen nieuwe dependencies, geen backendwijzigingen.

## Technical Context

**Language/Version**: TypeScript 5.6 / React 18.3 / Vite 6 — frontend-only

**Primary Dependencies**: bestaand — react-router-dom v6 (routes, router-state),
TanStack Query v5 (bestaande queries), shadcn/ui-componenten (`Textarea`, `Select`, `Input`,
`Tabs`, `Badge`, `EmptyState`, `Skeleton`), lucide-react, Playwright. **Geen nieuwe
npm-dependencies.**

**Storage**: geen nieuwe opslag. Startvraag en zoekterm leven uitsluitend in React-state /
router-geheugen; de router-state wordt direct na overname door `ChatPage` gewist met
`navigate(..., { replace: true, state: null })`. Voor de vraag of zoekterm worden geen
localStorage/sessionStorage, cookies of URL-parameters gebruikt. Bestaande
Supabase-sessieopslag blijft ongemoeid.

**Testing**: Playwright (`tests/e2e/`) met de bestaande fixtures (echte Supabase-login;
zonder `E2E_EMAIL`/`E2E_PASSWORD` skippen de tests met reden) en de mock-analysis-server
(`playwright.config.ts`). Nieuwe specs voor startscherm en Geschiedenis; `fixtures.ts`
login-URL-assertie uitbreiden met `/start`.

**Target Platform**: Web (Netlify; SPA-redirect ongewijzigd).

**Project Type**: web-app (single frontend).

**Performance Goals**: Startscherm doet drie queries (assistenten, 5 gesprekken, 5 runs);
Geschiedenis twee queries (200 gesprekken, 50 runs). Zoeken filtert in-memory over die
lijsten (geen extra verzoeken). Geen pollingwijziging: `useRecentRuns` pollt alleen bij
queued/running.

**Constraints**: adressen bevatten uitsluitend id's; vraag en zoekterm nooit in URL of
browseropslag (constitution III); geen enkele wijziging aan chat- of analysegedrag buiten
het eenmalig overnemen van de startvraag; UI Nederlands in u-vorm, code/identifiers/commits
Engels (constitution I); CONCEPT-labels ongewijzigd (constitution II); WCAG 2.1 AA
(constitution IV); zichtbare fouten bij haperende queries (constitution V); minimale scope
(constitution VI). Klaar = `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0`,
`npm run build` en de Playwright-tests van deze feature groen.

**Scale/Scope**: nieuw `src/pages/StartPage.tsx`, `tests/e2e/start-page.spec.ts`,
`tests/e2e/history-page.spec.ts`; herschreven `HistoryPage.tsx`; klein gewijzigd `App.tsx`,
`LoginPage.tsx`, `AppShell.tsx`, `ChatPage.tsx`, `queries.ts`, `useRecentRuns.ts`,
`fixtures.ts`, 008-contract; verwijderd `CommandCenterPage.tsx` en `useDashboardCounts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Toelichting |
|---|------|--------|-------------|
| 1 | Dutch UI copy, u-vorm (Principle I) | PASS | Nieuwe koppen/labels/placeholders/lege toestanden in het Nederlands met "u": "Uw vraag", "Assistent", "Versturen", "Zoek op gesprekstitel", "Zoek op klantreferentie", "Nog geen gesprekken", "Zoekterm wissen". Code, identifiers en commits blijven Engels. |
| 2 | Concept, never advice (Principle II) | PASS | Er worden geen analyses of antwoorden inhoudelijk gewijzigd; bestaande CONCEPT-labels blijven staan. Het startscherm toont alleen vraag/keuze en eerder werk, geen advies of aanbeveling. |
| 3 | Client data sensitivity (Principle III) | PASS | Vraag en zoekterm staan nooit in het adres of in localStorage/sessionStorage/cookies. De vraag gaat via React Router-state (tab-gebonden geheugen) en wordt direct bij binnenkomst van `ChatPage` gewist met `replace`; er is een e2e-assertie op `history.state` en opslag. PostHog heeft `autocapture: false` en `disable_session_recording: true` (geverifieerd in `src/lib/posthog.tsx`), dus invoerwaarden worden niet verzonden. Lijsten tonen klantreferenties uitsluitend in de UI; analyse-URL's bevatten alleen run-id's. |
| 4 | Accessibility WCAG 2.1 AA (Principle IV) | PASS | Rijen/kaarten worden echte `<Link>`-elementen (Tab + Enter, zichtbare `focus-visible`-ring); formuliervelden krijgen echte labels; tabbladen gebruiken het bestaande `Tabs`-component met `role="tab"`/`aria-selected`; status is tekst in een badge (geen kleur-only signaal); lege toestanden hebben tekst en een knop/link. |
| 5 | Typed external clients, no silent failures (Principle V) | PASS | Bestaande getypeerde clients (`queries.ts` via Supabase, `fetchRecentRuns` met JWT) blijven de enige toegang. Nieuwe schermen tonen bij queryfouten een expliciete Nederlandse melding met "Opnieuw proberen" (`refetch`); geen stille lege lijsten. |
| 6 | Minimal scope (Principle VI) | PASS | Geen nieuwe dependencies, geen backend-/migratiewijzigingen, geen wijzigingen aan chat- of analysepagina's buiten de eenmalige vraag-overname. Verwijderen van `CommandCenterPage` en `useDashboardCounts` is dode-code-opruiming die direct volgt uit de nieuwe route. De bestaande assistent-filter blijft ongewijzigd; er komen geen filters naast het zoekveld bij. |

**Re-check na Phase 1 (design): PASS** — het ontwerp voegt geen scope toe. Drie
noodzakelijke, gedocumenteerde details: (a) `useRecentRuns` krijgt een `limit`-parameter
met de limiet in de queryKey, anders delen Start (5) en Geschiedenis (50) onbedoeld één
cache-entry; (b) `useConversations` ordent op `updated_at desc` zodat "recent" overeenkomt
met de getoonde datum "laatst bijgewerkt"; (c) de login-fixture moet `/start` accepteren,
anders falen alle bestaande ingelogde e2e-tests na de redirectwijziging. Alle drie zijn
correctheidsherstellingen binnen de route, geen uitbreiding.

## Project Structure

### Documentation (this feature)

```text
specs/015-start-screen-history/
├── plan.md              # Dit bestand
├── research.md          # Phase 0: beslissingen en alternatieven
├── data-model.md        # Phase 1: routes, UI-state, entiteiten, regels
├── quickstart.md        # Phase 1: lokale checks, handmatige verificatie, release
├── contracts/
│   └── ui-routes.md     # Phase 1: routes, router-state-handoff, zoekgedrag
├── checklists/
│   └── requirements.md  # Spec-quality-checklist (uit /speckit.specify)
└── tasks.md             # /speckit.tasks (nog niet aangemaakt)
```

### Source Code (repository root)

```text
src/
├── pages/
│   ├── StartPage.tsx              # NIEUW: vraag + assistentkeuze, 5 gesprekken,
│   │                              #   5 analyses, knop nieuwe risico-analyse
│   ├── HistoryPage.tsx            # HERSCHREVEN: tabs Gesprekken/Risico-analyses,
│   │                              #   zoeken in de browser, Links i.p.v. drawer
│   ├── ChatPage.tsx               # initialQuestion eenmalig overnemen + state wissen
│   └── CommandCenterPage.tsx      # VERWIJDERD (geen consument meer)
├── components/
│   ├── auth/LoginPage.tsx         # fallback redirect '/start'
│   └── layout/AppShell.tsx        # menu-item "Start" bovenaan (Home-icoon)
├── hooks/
│   ├── queries.ts                 # useDashboardCounts weg;
│   │                              # useConversations order updated_at desc
│   └── useRecentRuns.ts           # limit-parameter (default 10), limit in queryKey
└── App.tsx                        # /start-route; /command-center en * -> /start

tests/e2e/
├── fixtures.ts                    # login-URL-assertie accepteert /start
├── start-page.spec.ts             # NIEUW: vraag -> chat, URL/opslag zonder vraag,
│   │                              #   redirect /command-center
└── history-page.spec.ts           # NIEUW: tabs, zoeken, Enter op een rij,
│                                  #   analyses-status en beschikbaar-tot

specs/008-risico-analyse-ui/contracts/run-status.md  # notitie: limit tot 50
```

**Structure Decision**: bestaande single-frontend structuur (React + Vite) blijft
ongewijzigd. `StartPage` en de herschreven `HistoryPage` liggen binnen de bestaande
`AppShell`-layout, zodat de zijbalk en het meldingsgedrag behouden blijven.

## Complexity Tracking

> Geen constitution-violations; geen afwijkingen die justify nodig hebben.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Phase 0 & 1 Outputs

- [research.md](research.md) — alle technische beslissingen, inclusief de
  router-state/privacynuance, de `limit`-parameter, het behouden van de bestaande
  assistent-filter en de teststrategie.
- [data-model.md](data-model.md) — routes, UI-state en de entiteiten uit de spec.
- [contracts/ui-routes.md](contracts/ui-routes.md) — route- en handoffcontract.
- [quickstart.md](quickstart.md) — lokale checks, handmatige verificatie en release.
