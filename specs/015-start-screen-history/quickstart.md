# Quickstart & Rollout: 015-start-screen-history

**Date**: 2026-10-30 | **Feature**: [spec.md](spec.md)

Deze feature is **volledig frontend**: geen migraties, geen Edge Function-deploy, geen
nieuwe dependencies en geen env-wijzigingen. Eén frontend-PR volstaat. De enige
serverafhankelijkheid is additief: de recente-runs-lijst moet `limit` tot 50 ondersteunen
(notitie in `specs/008-risico-analyse-ui/contracts/run-status.md`).

## 1. Voorbereiding

- Geen nieuwe secrets. E2E-accounts zoals bekend: `E2E_EMAIL`/`E2E_PASSWORD` en
  `E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD` in `.env.local`. Ontbreken ze, dan skippen de
  ingelogde Playwright-tests met een duidelijke reden (bestaand gedrag).
- De e2e draait tegen de mock-analysis-server
  (`node scripts/mock-analysis-server.mjs`, poort 4010, start automatisch via
  `playwright.config.ts`); scenario's via `MOCK_SCENARIO=rich|thin|error|slow`.
- `VITE_ANALYSIS_API_URL` moet lokaal naar de mock wijzen
  (`http://localhost:4010`), zoals in `.env.example`.

## 2. Lokale ontwikkeling en geautomatiseerde checks

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/start-page.spec.ts tests/e2e/history-page.spec.ts
npx playwright test            # volledige regressiesuite
```

Verwacht: `tsc`, eslint en build slagen. De twee nieuwe specs slagen (of skippen
gedocumenteerd zonder E2E-accounts). De bestaande suite blijft groen; vooral
`tests/e2e/fixtures.ts` is aangepast omdat de login nu op `/start` landt.

## 3. Handmatige verificatie met de mock-server (±15 min)

```bash
MOCK_SCENARIO=rich node scripts/mock-analysis-server.mjs   # aparte terminal
npm run dev
```

1. **Startscherm na inloggen**: log in → je landt op `/start` (niet op
   `/command-center`). Je ziet één vraagveld, een keuze uit actieve chat-assistenten, de
   vijf laatste gesprekken, de vijf laatste analyses en (bij een risico-assistent) de
   knop "Nieuwe risico-analyse".
2. **Vraag starten**: typ een vraag, kies een assistent, klik "Versturen" → het gesprek
   opent op `/chat/<uuid>` en de vraag staat als eerste bericht. Controleer in de
   adresbalk dat de vraag er niet in staat; controleer DevTools → Application →
   Local/Session Storage dat de vraag er niet in staat. Herladen van de chatpagina
   verstuurt de vraag niet opnieuw.
3. **Startscherm-overzicht**: klik een recent gesprek → je komt op het gesprek zelf en
   kunt verder chatten. Klik een recente analyse → je komt op de analysepagina met status.
4. **Risico-knop**: met één risico-assistent opent de knop direct
   `/analyse/new/<assistantId>`; met meerdere kom je op `/assistants` om te kiezen; zonder
   risico-assistent is de knop afwezig.
5. **Geschiedenis-tabs**: open `/history` → tab "Gesprekken" toont titel, assistent en
   datum laatst bijgewerkt; tab "Risico-analyses" toont klantreferentie, status, startdatum
   en bij een geslaagde analyse "beschikbaar tot <datum>". De badge Nieuw/Afgerond is weg;
   de bestaande assistent-filter staat op het tabblad Gesprekken.
6. **Openen en verdergaan**: open een gesprek → je komt op `/chat/<id>` en kunt een nieuw
   bericht sturen (geen alleen-lezen paneel meer). Open een analyse → `/analyse/<runId>`.
7. **Zoeken**: typ in Geschiedenis een deel van een gesprekstitel of klantreferentie → de
   lijst versmalt direct. Open DevTools → Network: geen enkel verzoek bevat de zoekterm;
   de adresbalk verandert niet. Een niet-matchende term toont "Geen resultaten" +
   "Zoekterm wissen".
8. **Toetsenbord**: Tab naar een rij, Enter opent die; Tab naar het vraagveld/de
   assistentkeuze/het zoekveld en bedien ze zonder muis. Focus is zichtbaar.
9. **Redirect**: open `/command-center` (en een willekeurig onbekend pad) → je landt op
   `/start`.

## 4. Release

| Stap | Actie | Waarom |
|------|-------|--------|
| 1 | PR naar `develop`, preview testen, daarna merge naar `main` | Frontend-only; geen volgorde-afhankelijkheden |
| 2 | Backend (Darwin API): bevestig dat `limit` tot 50 wordt gehonoreerd | Contractnotitie in `specs/008-risico-analyse-ui/contracts/run-status.md`; de frontend vraagt 50 en de mock ondersteunt het al |
| 3 | Handmatige live-verificatie + fitness-check + FEATURES.md via `@fitness-checker` / `@feature-tracker` | AGENTS.md "After Every Feature" |

## 5. Rollback

Frontend-only: revert van de merge-PR naar `main` zet het Command Center en de oude
Geschiedenis-pagina terug. Er is geen nieuwe opslag en er zijn geen data-effecten; de
startvraag en zoekterm zijn altijd tijdelijk. De 008-contractnotitie is documentatie en
mag blijven staan (additief).

## 6. Bekende beperkingen

- De Geschiedenis-lijsten werken met de bestaande limieten (200 gesprekken, 50 analyses);
  zoeken dekt uitsluitend de al geladen items. Oudere items buiten de limiet zijn niet via
  zoeken vindbaar.
- De zoekterm geldt per tabblad en vervalt bij het verlaten of herladen van de pagina.
- Bij meerdere risico-analyse-assistenten opent "Nieuwe risico-analyse" het
  assistentenoverzicht in plaats van direct een specifieke assistent.
- De vraag wordt direct bij het openen van de chat verzonden; er is geen tussenstap om
  haar op de chatpagina nog te wijzigen.
- De bestaande `Tabs`-implementatie ondersteunt Tab + Enter; pijltjestoetsnavigatie tussen
  tabs is bestaand gedrag en buiten scope.
