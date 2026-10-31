# Tasks: Risico-analyse via de serverroute

**Input**: Design documents from `/specs/021-analysis-server-route/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Inbegrepen — de route eist aangepaste analyse-specs en drie nieuwe
Playwright-scenario's. De echte n8n-run verifieert de opdrachtgever handmatig.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel uitvoerbaar (ander bestand, geen afhankelijkheid)
- **[Story]**: user story uit spec.md

---

## Phase 1: Setup

- [x] T001 Maak `supabase/migrations/023_analysis_server_route.sql`: `analysis_runs`,
  RLS + SELECT-policy, indexen, privébucket `analysis-dossiers`, storage-SELECT-policy,
  `pg_cron` + `pg_net` (plan §Migratie 023, data-model §2-3).
- [x] T002 Werk `src/types/database.types.ts` bij met `analysis_runs` (tot de migratie
  is toegepast; daarna opnieuw genereren via Supabase MCP).

---

## Phase 2: Foundational

**Doel**: de gedeelde contracten (tabel, bucket, clienttypes) staan voordat de
functies en UI verder bouwen.

- [x] T003 [P] Voeg `dossier_path` toe aan `AnalysisRunSchema` in
  `src/lib/analysis-schemas.ts` (optioneel, nullable).
- [x] T004 [P] Voeg `NOT_CONFIGURED` toe aan `AnalysisErrorCode` en de vaste
  Nederlandse melding in `src/lib/analysis-client.ts`.

**Checkpoint**: types en foutcodes staan.

---

## Phase 3: US1 — Analyse starten via de serverroute (P1) 🎯 MVP

- [x] T005 Maak `supabase/functions/analysis-run-submit/index.ts`: fail-closed CORS,
  JWT + profiel/org, assistentcheck, catalogus-URL + centrale header/token,
  servervalidatie (velden, groep, types, 10/25 MB), kennisbron-resolutie,
  run invoegen (`queued`, `expires_at = now() + 7 days`), HMAC-callback-URL,
  JSON + base64 naar n8n (30 s), 202 → `running`, anders `failed`.
  (contracts/analysis-run-submit.md)
- [x] T006 Herschrijf `submitAnalysisRun` in `src/lib/analysis-client.ts` naar
  `FormData` + `supabase.functions.invoke('analysis-run-submit')`; advisor-velden
  vervallen; foutmapping via `FunctionsHttpError`/`FunctionsRelayError`.
- [x] T007 Pas `src/pages/AnalysisNewPage.tsx` aan: alleen nog de invoer meegeven
  (geen `advisor_id`/`adviseur_naam`).

**Checkpoint**: een start gaat via de server; geen n8n-URL/secret in de browser.

---

## Phase 4: US2 — Status volgen en resultaat bekijken (P1)

- [x] T008 Herschrijf `fetchAnalysisRun` en `fetchRecentRuns` in
  `src/lib/analysis-client.ts` naar PostgREST-selects op `analysis_runs` met
  mapping (`result_json` → `result`, `dossier_path`), `NOT_FOUND` bij 0 rijen.
- [x] T009 Pas `src/pages/AnalysisRunPage.tsx` aan: `dossierPath` doorgeven.
- [x] T010 Verifieer dat `useAnalysisRun`, `useRecentRuns`, het startscherm, de
  geschiedenis en de meldingenteller ongewijzigd blijven werken (geen wijziging nodig
  buiten de client).

**Checkpoint**: status/lijst lezen via RLS; andermans run geeft NOT_FOUND.

---

## Phase 5: US3 — Bestanden zonder opslag (P1)

- [x] T011 Borg in `analysis-run-submit` dat bestanden alleen in het geheugen bestaan:
  per bestand `arrayBuffer()` → base64 → direct loslaten; geen opslag, geen log.
- [x] T012 Verifieer de limieten server-side (10 MB per bestand, 25 MB totaal, 413)
  en dat de client dezelfde limieten al afdwingt.

**Checkpoint**: inhoud gaat mee naar n8n en wordt nergens bewaard.

---

## Phase 6: US4 — Dossier downloaden (P1)

- [x] T013 Voeg `downloadAnalysisDossier(path)` toe aan
  `src/lib/analysis-client.ts`: `createSignedUrl(path, 60, { download })`,
  tijdelijke `<a download>`-klik, geen state/opslag/adresbalk.
- [x] T014 Wijzig `src/components/analysis/ResultView.tsx`: `dossierPath` + knop die
  de helper aanroept; label/opmaak ongewijzigd; Nederlandse fouttoast.

**Checkpoint**: download alleen voor de eigenaar, 60 s geldig.

---

## Phase 7: US5 — Alleen n8n rondt een run af (P1)

- [x] T015 Maak `supabase/functions/analysis-run-callback/index.ts`: HMAC over
  `run_id` (constant-time), 401/409, error-JSON → `failed`, multipart `ok` →
  `analyse` parsen + zod, `INVALID_RESULT`, dossier uploaden, conditionele update,
  compensatie bij race. (contracts/analysis-run-callback.md)

**Checkpoint**: callback zonder geldige sig of voor een afgeronde run wijzigt niets.

---

## Phase 8: US6 — Verlopen runs en dossiers verdwijnen (P2)

- [x] T016 Maak `supabase/functions/analysis-run-cleanup/index.ts`:
  `x-cleanup-secret` (constant-time), 1000 verlopen rijen, objecten via Storage API
  in batches van 100, daarna rijen; `{ deleted, failed }`.
- [x] T017 Leg de pg_cron/pg_net/Vault-stap vast in `quickstart.md` (staat er al;
  controleer de SQL en de volgorde).

**Checkpoint**: objecten en rijen verdwijnen echt; geen orphaned bestanden.

---

## Phase 9: Tests

- [x] T018 Bouw `tests/e2e/analysis-form.spec.ts` om naar route-interception
  (`analysis-run-submit` 202, `analysis_runs` queued) en verwijder de mock-afhankelijkheid.
- [x] T019 Bouw `tests/e2e/analysis-run.spec.ts` om: rich/error/slow-fixtures,
  resultaat, bronpaneel, retry, vervaldatum en de klik-download.
- [x] T020 Bouw `tests/e2e/analysis-jwt.spec.ts` om: Authorization op
  `functions.invoke` en PostgREST.
- [x] T021 Bouw `tests/e2e/analysis-notifications.spec.ts` om naar de gemockte
  afronding (badge/titel).
- [x] T022 Nieuw `tests/e2e/analysis-server-route.spec.ts`: uitgezette assistent,
  NOT_CONFIGURED, andermans run (lege respons) met Nederlandse meldingen.
- [x] T023 Verwijder de mock-server-`webServer` uit `playwright.config.ts`; laat
  `scripts/mock-analysis-server.mjs` staan.

**Checkpoint**: de analyse-specs draaien zonder mock-server en skippen met reden
zonder E2E-accounts.

---

## Phase 10: Polish & release

- [x] T024 Verwijder `VITE_ANALYSIS_API_URL` uit `src/`, `.env.example` en controleer
  `src/vite-env.d.ts`; grep op restanten.
- [x] T025 Draai `npx tsc --noEmit`, `npx eslint src/ --max-warnings 0`,
  `npm run build` en de vijf analyse-specs. _(2026-10-31: tsc/eslint/build groen;
  Playwright 23/23 passed met het E2E-lidaccount als `E2E_EMAIL`.)_
- [x] T026 Werk `FEATURES.md` bij en draai de fitness check (AGENTS.md).
  _(FEATURES.md bijgewerkt; `scripts/fitness-check.sh` FAIL:0 / WARN:2 / PASS:12 /
  SKIP:4. F-01/F-10 skippen tot de migratie is toegepast; de warnings zijn
  pre-existent.)_
- [ ] T027 Release volgens `quickstart.md`: n8n → migratie → functies/secrets/cron →
  frontend, **pas na bevestiging** voor migratie en deploy.
  _(Migratie 023 is op 2026-10-31 via de Supabase MCP toegepast en geverifieerd
  (remote versie `20261031192912`; F-01/F-10 groen). De drie functies zijn via de MCP
  gedeployed, de twee secrets zijn gezet, Vault + pg_cron-job
  `analysis-runs-cleanup` zijn ingericht en een handmatige pg_net-aanroep gaf 200
  `{deleted:0,failed:0}`. Nog open: handmatige n8n-aanpassingen, frontend-release en
  de live n8n-run/RLS-verificatie uit quickstart §5.)_

---

## Dependencies

- T001/T002 → T005-T017 (types en tabel nodig voor de client).
- T005 → T006/T007 (submit-contract).
- T008 → T009/T018-T022 (reads).
- T013 → T014 (download).
- T015 → T019 (callback/resultaatfixtures).
- T016 → T017 (cleanup + schedule).
- T018-T023 → T025 (checks).
