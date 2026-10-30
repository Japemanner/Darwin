# Quickstart & Rollout: 014-risk-analysis-page

**Date**: 2026-10-30 | **Feature**: [spec.md](spec.md)

Handmatige stappen voor Jaap. Deze feature is **volledig frontend** — geen migraties,
geen Edge Function-deploy, geen nieuwe dependencies, geen env-wijzigingen. Eén
frontend-PR volstaat; er is geen breekraam. De enige serverafhankelijkheid is het
nieuwe optionele lijstveld `expires_at` (§4): de frontend werkt ook zónder.

## 1. Voorbereiding

- Geen nieuwe secrets; E2E-accounts zoals bekend: `E2E_EMAIL`/`E2E_PASSWORD` in
  `.env.local` (2026-10-29 nog afwezig — de suite skippt dan met reden, zelfde
  gedocumenteerde staat als 010-013).
- De e2e draait tegen de mock-server (`node scripts/mock-analysis-server.mjs`,
  poort 4010, start automatisch via `playwright.config.ts`); scenario's via
  `MOCK_SCENARIO=rich|thin|error|slow`.

## 2. Lokale ontwikkeling en geautomatiseerde checks

```bash
npx tsc --noEmit
npx eslint src/ --max-warnings 0
npm run build
npx playwright test tests/e2e/analysis-form.spec.ts tests/e2e/analysis-run.spec.ts tests/e2e/analysis-jwt.spec.ts tests/e2e/analysis-notifications.spec.ts
npx playwright test            # volledige regressiesuite
```

## 3. Handmatige verificatie met de mock-server (±15 min)

```bash
MOCK_SCENARIO=rich node scripts/mock-analysis-server.mjs   # aparte terminal
npm run dev
```

1. **Eigen pagina + vast adres**: start een risico-analyse via `/assistants` → de
   analysepagina opent; na submit staat het adres op `/analyse/<runId>`. Navigeer
   weg (Kennisbronnen), kopieer/plak het adres terug → status zichtbaar op hetzelfde
   adres; herladen werkt ook.
2. **Badge + tabbladtitel**: start een run, ga naar Kennisbronnen, wacht ±10 s →
   badge "1" bij Assistenten in de zijbalk én titel "(1) Darwin". Open de run (of
   de analysepagina met de lijst) → badge weg, titel terug naar de basis.
3. **Formulier**: Klantreferentie staat bovenaan; de adviseurnaam staat als vaste
   tekst in de kop; alle kennisbronnen aangevinkt (één uitzetten kan); hulptekst
   "Standaard zijn alle kennisbronnen van deze assistent geselecteerd."; het lege
   vraagstukveld toont de voorbeeldtekst.
4. **Slepen-en-neerzetten**: sleep een pdf op het uploadvak → bestand toegevoegd;
   sleep een .exe → zelfde foutmelding als via de knop; de knop "Bestanden kiezen"
   blijft werken (toetsenbord).
5. **Vervaldatum in de lijst**: na een geslaagde run toont de rij in "Recente runs"
   "beschikbaar tot <datum>"; mislukte/lopende rijen tonen die niet.
6. **Opnieuw mét bijlagen** (`MOCK_SCENARIO=error` server herstarten): start een run
   met een bestand → na de mislukking: "Opnieuw" → het formulier opent op
   `/analyse/new/:assistantId` mét prefill én de amber melding "Bijlagen zijn niet
   bewaard. Voeg de bestanden opnieuw toe."; zonder bestand in de eerdere poging
   verschijnt geen melding.
7. **Polling**: met de netwerktab open — na afronden van alle lopende runs stoppen
   de periodieke `GET /analysis-runs?...`-verzoeken (interval alleen bij
   queued/running).

## 4. Release en backend-afstemming

| Stap | Actie | Waarom |
|------|-------|--------|
| 1 | Frontend-PR naar `develop` → preview testen → merge naar `main` | Frontend-only; geen volgorde-afhankelijkheden |
| 2 | Backend (Darwin API): `expires_at` toevoegen aan de recente-lijst-items | Contractnotitie in `specs/008-risico-analyse-ui/contracts/run-status.md`; het frontend-schema is optioneel, dus de volgorde is vrij — zónder het veld toont de lijst alles behalve de vervaldatum |
| 3 | Handmatige live-verificatie §3-varianten tegen productie + fitness-check + FEATURES.md via `@fitness-checker` | AGENTS.md "After Every Feature" |

## 5. Rollback

Frontend-only: revert van de merge-PR naar `main` zet het zijpaneel terug. De
sessionStorage-gezien-set en de retry-snapshots zijn kortlevend (sessie/tabblad) en
hoeven niet opgeruimd. Geen data-effecten.

## 6. Bekende beperkingen

- De "gezien"-telling geldt per tabblad-sessie (sessionStorage, route-keuze); een
- nieuw tabblad initialiseert opnieuw en telt niet oude afrondingen.
- De telling kijkt naar de laatste 10 runs (bestaande lijstlimiet).
- Retry-prefill vervalt bij verversen van `/analyse/new` (router-state is
  memory-only; bestaand "eerdere invoer niet beschikbaar"-bericht).