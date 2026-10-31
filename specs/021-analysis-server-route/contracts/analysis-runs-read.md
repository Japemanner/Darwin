# Contract: status, recente lijst en dossierdownload (browser → Supabase)

**Feature**: 021-analysis-server-route | **Datum**: 2026-10-31
**Basis**: `specs/008-risico-analyse-ui/contracts/run-status.md` en
`specs/014-risk-analysis-page/contracts/analysis-routes.md`, gewijzigd van een eigen
REST-endpoint naar directe Supabase-leesacties met RLS.

## 1. Runstatus (polling)

`supabase.from('analysis_runs').select(<kolommen>).eq('id', runId).maybeSingle()`

- RLS: `advisor_id = auth.uid() AND organization_id = get_user_org_id()`.
- 0 rijen (onbekend, andermans, verlopen) → `AnalysisClientError('NOT_FOUND',
  'De uitvoering is niet gevonden.')`; de UI toont "Analyse niet gevonden".
- Overige fouten → `BACKEND_ERROR` met de bestaande Nederlandse melding.
- Polling blijft ongewijzigd: 3 s, stopt bij `succeeded`/`failed`, backoff
  6 → 12 → 24 → 30 s bij fouten (`useAnalysisRun`).

Geselecteerde kolommen:

```text
id, assistant_id, advisor_id, client_reference, status, started_at, finished_at,
error_code, error_message, result_json, intern_markdown, dossier_path, expires_at
```

Mapping naar `AnalysisRun`:

| DB | Client |
|---|---|
| `result_json` | `result` (nullable; zod-validatie bij weergave) |
| `dossier_path` | `dossier_path` (nieuw, nullable) |
| `dossier_docx_url` | niet gevuld; blijft optioneel in het schema |

## 2. Recente uitvoeringen

`supabase.from('analysis_runs').select(<metadata>).eq('advisor_id', advisorId)
.order('started_at', { ascending: false }).limit(limit)`

- `limit` standaard 10, tot en met 50 (bestaande afspraak uit 014).
- Kolommen: `id, assistant_id, client_reference, status, started_at, finished_at,
  error_code, expires_at` — géén `result_json`, `intern_markdown`, `dossier_path`,
  bestandsnamen of URL's.
- De `advisor_id`-filter is leesbaarheid; RLS is de beveiligingsgrens. Een afwijkende
  id levert een lege lijst op, geen fout en geen andermans rijen.
- Schema: bestaande `RecentRunSchema` (met optioneel `expires_at`).

## 3. Dossierdownload

Op het moment van de klik (geen URL in state, opslag of adresbalk):

```ts
const { data, error } = await supabase.storage
  .from('analysis-dossiers')
  .createSignedUrl(dossierPath, 60, { download: 'dossier.docx' })
```

- Alleen de eigenaar van de run heeft via de bucket-SELECT-policy toegang tot het pad.
- De signed URL is 60 seconden geldig; de UI opent hem via een tijdelijke
  `<a download>`-klik en verwijdert het element daarna.
- Fout (object weg, verlopen, geen toegang) → `AnalysisClientError('NOT_FOUND',
  'Het dossier is niet meer beschikbaar.')` met een Nederlandse toast.
- De downloadknop houdt het label "Dossier opslaan (.docx) — CONCEPT, door adviseur te
  accorderen"; alleen de mechaniek wijzigt (geen `<a href>` meer).

## 4. Verboden clientacties

| Actie | Resultaat |
|---|---|
| `insert`/`update`/`delete` op `analysis_runs` | geweigerd (geen policy; alleen service role) |
| upload/delete in `analysis-dossiers` | geweigerd (geen policy; alleen service role) |
| select van andermans run of dossier | 0 rijen / geen signed URL |

## 5. Foutcodes in de client

Bestaande `AnalysisErrorCode` blijft; toegevoegd: `NOT_CONFIGURED`.

| Situatie | Code | Melding |
|---|---|---|
| server antwoordt `NOT_CONFIGURED` | `NOT_CONFIGURED` | "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder." |
| 401 | `UNAUTHORIZED` | "Uw sessie is verlopen. Log opnieuw in." |
| 403 | `BACKEND_ERROR` | de Nederlandse servermelding |
| 413 | `FILE_TOO_LARGE` | "De bestanden overschrijden de toegestane grootte." |
| 422 | `GROUP_VALIDATION` | "De ingediende gegevens voldoen niet aan de validatie." |
| 5xx/overig | `BACKEND_ERROR` | "Er trad een fout op bij de risico-analyse-service." |
| geen sessie | `UNAUTHORIZED` | bestaande melding |
| geen rij | `NOT_FOUND` | "De uitvoering is niet gevonden." |
