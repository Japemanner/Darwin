# Data Model: Risico-analyse als eigen pagina, met soepelere invoer

**Date**: 2026-10-30 | **Feature**: [spec.md](spec.md) | **Branch**: `014-risk-analysis-page`

**Geen database-migraties, geen Edge Function-wijzigingen, geen nieuwe dependencies.**
De enige contractwijziging is het optionele veld `expires_at` op lijstitems van
recente runs (frontend-schema + mock-server + notitie in het 008-contract; de echte
backend levert het veld binnen de bestaande endpointvorm).

## Entiteiten

### Route (nieuw)

| Route | Params | State (router-geheugen) | Inhoud |
|-------|--------|--------------------------|--------|
| `/analyse/new/:assistantId` | `assistantId: uuid` | optioneel `{ retryRunId: uuid }` | Formulier + recente analyses |
| `/analyse/:runId` | `runId: uuid` | — | RunCard + (bij geslaagd) ResultView |

Regels: adressen bevatten uitsluitend uuid's (constitution III, FR-002); de
retry-state staat in router-geheugen, niet in de URL; verversen van `/analyse/new`
verliest daardoor de prefill (bestaand gedrag "eerdere invoer niet meer beschikbaar").

### Analyse-run (bestaand `AnalysisRun`, ongewijzigd)

Id, assistent-id, adviseur-id, klantreferentie, status (`queued`/`running`/
`succeeded`/`failed`), starttijd, eindtijd, foutcode/-melding, `expires_at`
(bewaartermijn 7 dagen), resultaat, interne tekst, dossier-URL. De runpagina leest
deze via `useAnalysisRun` (poll 3 s met backoff; stopt bij succeeded/failed).

### Lijstitem recente run (`RecentRun`, +1 optioneel veld)

| Veld | Type | Regel |
|------|------|-------|
| `id`, `assistant_id`, `client_reference`, `status`, `started_at` | bestaand | ongewijzigd |
| `finished_at`, `error_code` | bestaand, nullable/optioneel | ongewijzigd |
| `expires_at` (nieuw) | `string (datetime) \| null \| undefined` | optioneel in het schema (rollout-veilig, research #7); getoond als "beschikbaar tot dd-mm-jjjj" uitsluitend bij `status === 'succeeded'` én aanwezig veld |

### Gezien-registratie (nieuw, `src/store/analysisSeenStore.ts`)

| Veld | Type | Regels |
|------|------|--------|
| `seenIds` | `string[]` (run-id's, max 50, laatste first) | gepersisteerd naar **sessionStorage** — uitsluitend uuid's, geen inhoud (constitution III; sessiegebonden) |
| `initialized` | `boolean` | `false` tot de eerste lijstlaad: dan worden alle huidige afgeronde runs gemarkeerd als gezien en de vlag gezet (spec edge case eerste gebruik) |
| `markSeen(ids)` | actie | voegt id's toe, kapt af op 50 |

### Meldingentelling (afgeleid, `src/hooks/useAnalysisNotifications.ts`)

```text
count = recente runs met status succeeded|failed waarvan id ∉ seenIds
```

- Zichtbaar in de zijbalk bij "Assistenten" (alleen `count > 0`) en als
  `document.title` = `(count) Darwin` (anders de basis-titel "Darwin - AI Platform").
- Reset: `AnalysisNewPage` markeert alle afgeronde lijstitems gezien bij (her)laden;
  `AnalysisRunPage` markeert de run zodra `succeeded`/`failed` (ook tijdens het
  kijken); elders in de app wordt niets gemarkeerd.
- Polling: gedeelde query met de lijst; interval 10 s zolang de lijst een `queued`/
  `running`-run bevat, anders geen interval (acceptatiecriterium FR-007).

### Retry-snapshot (nieuw modulebestand `src/lib/analysis-retry.ts`)

| Veld | Type | Regels |
|------|------|-------|
| sleutel | `runId: string` | Map, module-niveau, in-memory — geen browseropslag (constitution III) |
| `values` | `AnalysisFormValues` | ingevulde formulierwaarden mét `bestanden: []` (bestanden worden bewust niet bewaard) |
| `hadBestanden` (nieuw) | `boolean` | of de poging bijlagen had — stuurt de bijlagen-melding (US5); alleen dit feit, nooit bestandsinhoud |

Levensduur: tot tabblad-verversing (module-niveau). Bestaat de snapshot niet bij
"Opnieuw" → bestaande melding "eerdere invoer niet meer beschikbaar".

### Formulierinvoer (`AnalysisFormValues`, veldvolgorde nieuw)

Klantreferentie (verplicht, eerste veld) → Verzekeringsvraagstuk (verplicht,
voorbeeldtekst bij leeg) → Kennisbronnen (nieuwe run: alles standaard aangevinkt;
retry: eerdere selectie; minimaal één) → Klantsituatie → Bestanden (knop óf
slepen-en-neerzetten, identieke controles) → URL's (https-only). De adviseurnaam staat
als vaste tekst in de paginakop (uit het profiel) — geen invoerveld meer.

## Validatieregels

1. Alle bestaande regels blijven ongewijzigd: verplichte klantreferentie, verplicht
   verzekeringsvraagstuk, minimaal één kennisbron, groepsvalidatie
   (klantsituatie/bestanden/URL's), bestandstypen en -groottes, https-only URL's
   (`analysis-client.ts:52-85` en `AnalysisForm.tsx:121-150`).
2. Nieuwe run zonder `initial`: kennisbronnen standaard alles aangevinkt (effect bij
   aankomst van de bronnenlijst); met `initial` (retry): exact `initial.kennisbronnen`.
3. Route-uuid's: onbekende/genegeerde ids → nette niet-gevonden-melding zonder
   inhoud (FR-004); `useAnalysisRun` doet géén retry bij NOT_FOUND (bestaand).
4. Bijlagen-melding verschijnt uitsluitend bij retry waarvan
   `hadBestanden === true`; informatief, blokkeert niet.

## Statustransities

```text
Telling (per sessie/tabblad):
  eerste lijstlaad (initialized=false) → alle huidige afgeronde runs = gezien, count = 0
  run raakt klaar/mislukt buiten analysepagina's → count += 1 (badge + titel)
  AnalysisNewPage geopend → alle afgeronde lijstitems = gezien → count = 0
  AnalysisRunPage geopend en run afgerond → run = gezien → count daalt

Run-status op de runpagina (bestaand): queued → running → succeeded | failed
  poll 3 s (backoff 6-12-24-30 s bij fouten), stop bij succeeded/failed
```