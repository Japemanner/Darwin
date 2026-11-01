# Implementation Plan: Risico-analyse via de serverroute

**Branch**: `021-analysis-server-route` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/021-analysis-server-route/spec.md` + de
technische route uit de `/speckit.plan`-opdracht (migratie, twee Edge Functions,
frontend, opschonen, tests), met de afgestemde aanvulling van de cleanup-functie.

## Summary

De risico-analyse verlaat de browser: `analysis-run-submit` valideert sessie,
organisatie, assistent (actief, type `risico_analyse`), bestanden en kennisbronnen,
legt de run vast en stuurt hem met het centrale secret naar de productie-URL uit de
assistentcatalogus. n8n antwoordt 202; de run gaat naar `running`. Alleen
`analysis-run-callback` (HMAC over `run_id`, deploy met `--no-verify-jwt`) kan de run
afronden: een JSON-fout zet `failed`, een multipart-succes valideert `analyse`, uploadt
het dossier naar de privébucket `analysis-dossiers` en zet `succeeded`. De browser leest
status en recente runs via `analysis_runs` (RLS: eigen adviseur + eigen organisatie) en
maakt de dossierdownload pas bij de klik (60 s signed URL). Bestandsinhoud bestaat
alleen in het geheugen van de functie. `VITE_ANALYSIS_API_URL` verdwijnt; de
mock-server blijft als script staan maar wordt niet meer gebruikt. Een dagelijkse
pg_cron-job roept `analysis-run-cleanup` aan, dat via de Storage API de dossierobjecten
en daarna de rijen verwijdert.

Twee punten zijn vooraf afgestemd: de extra cleanup-functie (omdat SQL-delete van
`storage.objects` bestanden orphaned achterlaat) en de minimale download-plumbing in
`ResultView` (omdat de bestaande `<a href>` een URL in state zou vereisen). Beide staan
in [research.md](research.md) #10 en #13.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 / Vite 6 (frontend); Deno + TypeScript
(Supabase Edge Functions, `npm:zod` via Deno-import)

**Primary Dependencies**: bestaand — `@supabase/supabase-js` v2
(`functions.invoke` met FormData, PostgREST-reads, Storage `createSignedUrl`), zod
(frontend), TanStack Query, Playwright; Supabase `pg_cron` 1.6.4 en `pg_net` 0.20.4
(extensies aanwezig, nog niet geïnstalleerd). **Geen nieuwe npm-dependencies.**

**Storage**: Postgres `public.analysis_runs` (RLS, alleen SELECT-policy); privébucket
`analysis-dossiers` (pad `{org}/{advisor}/{run}.docx`, alleen SELECT-policy); ingevoerde
bestanden uitsluitend in het geheugen van `analysis-run-submit`; dossier tot
`expires_at`.

**Testing**: Playwright. Bestaande analyse-specs (`analysis-form`, `analysis-run`,
`analysis-jwt`, `analysis-notifications`) worden omgebouwd van de mock-server naar
`page.route`-interceptie van de nieuwe Supabase-aanroepen (rich/error/slow worden
fixtures in de spec). Nieuw `analysis-server-route.spec.ts` voor de drie gevraagde
gevallen (uitgezette assistent, ontbrekende productie-URL, andermans run). Specs
skippen met reden zonder `E2E_EMAIL`/`E2E_PASSWORD` (bestaand patroon). De echte
n8n-run, RLS en callback-afwijzingen verifieert de opdrachtgever handmatig volgens
quickstart.

**Target Platform**: Web (Netlify) + Supabase (Postgres, Storage, Edge Functions).

**Project Type**: web-app met server-side Supabase-componenten.

**Performance Goals**: upload ≤ 25 MB → ± 33 MB base64 naar n8n; Edge-runtime 256 MB
geheugen / 2 s CPU (gedocumenteerd, geen request-size-limiet); n8n
`N8N_PAYLOAD_SIZE_MAX` moet handmatig omhoog (default 16 MiB). Polling ongewijzigd:
run 3 s tot `succeeded`/`failed`; lijst 10 s alleen zolang er `queued`/`running` is.

**Constraints**: geen bestands- of klantinhoud in logs, URL's, PostHog of
browseropslag; geen bestands- of klantinhoud in Storage of de database; geen tokens of
handtekeningen in logs/browseropslag (de callback-signature staat alleen in de URL naar
n8n); centrale URL/secret alleen server-side; 60 s signed URL zonder state/adresbalk;
UI Nederlands (u-vorm), code en commits Engels; geen migratie toepassen of functie
deployen zonder bevestiging in de chat; releasevolgorde n8n → migratie →
functies/secrets/schedule → frontend; klaar = `tsc --noEmit`,
`eslint src/ --max-warnings 0`, `npm run build` en de Playwright-specs van deze feature
groen (of skip met reden zonder E2E-accounts).

**Scale/Scope**: 1 migratie (`023_analysis_server_route.sql`), 3 Edge Functions, 1
bucket, ± 8 frontend-bestanden, 5 testspecificaties. Geen nieuwe dependencies.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Gate | Status | Toelichting |
|---|------|--------|-------------|
| 1 | Dutch UI copy, u-vorm (Principle I) | PASS | Nieuwe UI-teksten: de vaste NOT_CONFIGURED-melding (bestaat al in `rag-chat`/`storage`), "Het dossier is niet meer beschikbaar." en de bestaande sessie-/validatiemeldingen. Geen nieuwe schermen; code, identifiers en commits Engels. |
| 2 | Concept, never advice (Principle II) | PASS | `ResultView`, het CONCEPT-label en de downloadtekst blijven inhoudelijk ongewijzigd; de callback slaat alleen op wat n8n levert en voegt geen advies toe. |
| 3 | Client data sensitivity (Principle III) | PASS | Bestanden alleen in het geheugen van de functie, nooit in Storage/DB/logs/URL's; dossier privé met org/adviseur-pad en 60 s signed URL; logs bevatten alleen code/run_id/duur; callback-URL bevat alleen `run_id` + HMAC (geen klantinhoud); geen klantinhoud in PostHog of browseropslag. |
| 4 | Accessibility WCAG 2.1 AA (Principle IV) | PASS | Geen nieuwe schermen; de download wordt een `<button>` met dezelfde tekst, focusstijl en contrast; de bestaande labels/foutmeldingen blijven. |
| 5 | Typed external clients, no silent failures (Principle V) | PASS | `analysis-client` blijft de enige client met getypeerde fouten en voegt `NOT_CONFIGURED` toe; elke serverfout mapt naar een Nederlandse melding; de callback zet expliciete `failed`-statussen; geen stille lege lijsten. |
| 6 | Minimal scope (Principle VI) | PASS | Alleen wat de spec/route nodig heeft. Drie afwijkingen zijn vastgelegd: twee vooraf afgestemd (cleanup-functie #10, `ResultView`-plumbing #13) en één volgt uit de technische route (`expires_at` vanaf het startmoment, #11). Geen nieuwe dependencies, geen extra schermen. |

**Re-check na Phase 1 (design): PASS** — het ontwerp voegt alleen toe wat nodig is om
de constitution te halen: (a) server-side resolutie van kennisbronnen voorkomt een
tenantbeslissing in de browser (#6); (b) de conditionele callback-update + HMAC
voorkomen een overschreven of vervalst resultaat (#7); (c) de cleanup via de Storage API
voorkomt orphaned dossierbestanden (#10); (d) de klik-download voorkomt een signed URL
in state (#13). Geen scope-uitbreiding buiten de afgestemde punten.

## Project Structure

### Documentation (this feature)

```text
specs/021-analysis-server-route/
├── plan.md                      # Dit bestand
├── research.md                  # Phase 0: 16 beslissingen (requestgrootte, route, payload,
│                                #   RLS, opslag, HMAC, cleanup, tests, foutcodes)
├── data-model.md                # Phase 1: tabel, RLS, bucket, mapping, opruiming
├── quickstart.md                # Phase 1: handmatige stappen, releasevolgorde, verificatie
├── contracts/
│   ├── analysis-run-submit.md   # Phase 1: browser → functie → n8n
│   ├── analysis-run-callback.md # Phase 1: n8n → functie (HMAC, 401/409)
│   ├── analysis-runs-read.md    # Phase 1: status/lijst/download via Supabase
│   └── analysis-run-cleanup.md  # Phase 1: pg_cron → cleanup-functie
├── checklists/
│   └── requirements.md          # Spec-quality-checklist (uit /speckit.specify)
└── tasks.md                     # /speckit.tasks (nog niet aangemaakt)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 023_analysis_server_route.sql   # NIEUW: analysis_runs + RLS + indexen +
│                                       #   bucket analysis-dossiers + storage-policy +
│                                       #   pg_cron/pg_net-extensies
└── functions/
    ├── analysis-run-submit/index.ts    # NIEUW: validatie, autorisatie, run aanmaken,
    │                                   #   JSON + base64 naar n8n, 202 → running
    ├── analysis-run-callback/index.ts  # NIEUW: HMAC, error-JSON, multipart-succes,
    │                                   #   zod-validatie, dossier uploaden, 401/409
    └── analysis-run-cleanup/index.ts   # NIEUW: verlopen rijen + objecten via Storage API

src/
├── lib/
│   ├── analysis-client.ts       # FormData + functions.invoke; PostgREST-reads;
│   │                            #   dossier_path; NOT_CONFIGURED; download-helper
│   └── analysis-schemas.ts      # AnalysisRunSchema + optioneel dossier_path
├── components/analysis/
│   └── ResultView.tsx           # dossierPath + klik-download (verder ongewijzigd)
├── pages/
│   ├── AnalysisNewPage.tsx      # submit zonder advisor-velden (server leidt ze af)
│   └── AnalysisRunPage.tsx      # geeft dossierPath door aan ResultView
└── types/
    └── database.types.ts        # analysis_runs (na migratie opnieuw genereren)

.env.example                     # VITE_ANALYSIS_API_URL verwijderen
src/vite-env.d.ts                # controleren; de variabele staat er nu niet in
playwright.config.ts             # mock-server-webServer verwijderen

tests/e2e/
├── analysis-form.spec.ts        # van mock naar route-interception
├── analysis-run.spec.ts         # rich/error/slow als fixtures + download
├── analysis-jwt.spec.ts         # JWT op functions.invoke + PostgREST
├── analysis-notifications.spec.ts # badge/titel met gemockte afronding
└── analysis-server-route.spec.ts # NIEUW: uitgezet / NOT_CONFIGURED / andermans run

scripts/mock-analysis-server.mjs # blijft staan, wordt niet meer gebruikt (quickstart)
```

**Structure Decision**: bestaande structuur blijft; de feature voegt één migratie,
drie functies en één bucket toe, wijzigt de bestaande analyseclient en twee
analysepagina's/één component, en vervangt de mock-afhankelijkheid in de tests.

## Ontwerp in het kort

### Migratie 023

- `public.analysis_runs` exact volgens [data-model.md](data-model.md) §2, RLS aan,
  alleen een SELECT-policy, expliciete `revoke`/`grant select`.
- Indexen op `(advisor_id, started_at desc)` en `(expires_at)`.
- `storage.buckets`-rij `analysis-dossiers` (privé) + één SELECT-policy op
  `storage.objects`; geen schrijf-policies.
- `create extension if not exists pg_cron; create extension if not exists pg_net;`.
- Geen cron-job in de migratie: de URL/het secret bestaan pas na de deploy (quickstart).

### `analysis-run-submit`

Volgt [contracts/analysis-run-submit.md](contracts/analysis-run-submit.md). Na de
bestaande rag-chat-autorisatie: assistent + catalogus-URL + centrale header/token,
server-side kennisbron-resolutie, bestandsvalidatie (413), run invoegen (`queued`,
`expires_at = now() + 7 days`), HMAC-callback-URL, JSON met base64 naar n8n (30 s),
202 → `running`, anders `failed` + foutcode.

### `analysis-run-callback`

Volgt [contracts/analysis-run-callback.md](contracts/analysis-run-callback.md).
`--no-verify-jwt`; HMAC over `run_id` (constant-time); 401/409/400; error-JSON →
`failed`; multipart `ok` → `analyse` parsen + zod, `INVALID_RESULT` bij ongeldig;
dossier uploaden naar `{org}/{advisor}/{run}.docx`, conditionele update, compensatie bij
een race.

### `analysis-run-cleanup`

Volgt [contracts/analysis-run-cleanup.md](contracts/analysis-run-cleanup.md).
`x-cleanup-secret` (constant-time); tot 1000 verlopen rijen per run; objecten via
`storage.remove` (batches van 100), daarna rijen; mislukte objecten blijven staan voor de
volgende dag.

### Frontend

- `analysis-client.ts`: `submitAnalysisRun` → FormData + `functions.invoke`;
  `fetchAnalysisRun`/`fetchRecentRuns` → PostgREST + mapping; `NOT_CONFIGURED`;
  `downloadAnalysisDossier(path)` met `createSignedUrl(..., 60)`.
- `analysis-schemas.ts`: `dossier_path` optioneel toevoegen.
- `ResultView.tsx`: `dossierPath` + `<button>` die de helper aanroept; label/opmaak
  ongewijzigd.
- `AnalysisNewPage.tsx`: advisor-velden niet meer meesturen.
- `AnalysisRunPage.tsx`: `dossierPath` doorgeven.
- `database.types.ts`: na de migratie opnieuw genereren.

### Tests

- `analysis-form.spec.ts`: formulier/validatie blijft; submit intercepteert
  `analysis-run-submit` (202) en `analysis_runs` (queued).
- `analysis-run.spec.ts`: rich/error/slow-fixtures via `page.route`; resultaat,
  bronpaneel, retry, vervaldatum en de klik-download (mock van
  `/storage/v1/object/sign/...`).
- `analysis-jwt.spec.ts`: assert Authorization op `functions.invoke` en PostgREST.
- `analysis-notifications.spec.ts`: de badge/titel-test gebruikt dezelfde gemockte
  afronding in plaats van de mock-server (timing blijft ±10 s).
- `analysis-server-route.spec.ts`: uitgezette assistent, NOT_CONFIGURED, andermans run
  (lege respons) met Nederlandse meldingen.

## Complexity Tracking

> Geen constitution-schendingen. De drie afgestemde afwijkingen zijn hieronder
> vastgelegd; ze zijn minimaal en noodzakelijk.

| Afwijking | Waarom nodig | Simpeler alternatief verworpen omdat |
|---|---|---|
| Extra `analysis-run-cleanup`-functie | SQL-delete van `storage.objects` laat de fysieke dossierbestanden staan; US6/FR-020 en constitution III eisen echte verwijdering | Alleen rijen verwijderen laat klantinhoud in de bucket achter |
| `ResultView`-plumbing (URL → `dossierPath` + klik) | De signed URL mag niet in state/URL staan (opdracht, constitution III) | URL bij render doorgeven zet de URL in React-state en de adresbalk |
| `expires_at` vanaf startmoment | De technische route schrijft `now() + 7 dagen` voor; voorkomt een run die nooit verloopt | `finished_at + 7 dagen` laat een nooit-afgeronde run oneindig staan |
