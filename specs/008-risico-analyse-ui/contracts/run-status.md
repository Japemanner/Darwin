# Contract: run status + recente runs (Darwin backend → UI)

**Feature**: 008-risico-analyse-ui | **Datum**: 2026-10-09

## Run-status (polling)

In het echte backend pollt de UI via `supabase-js` de tabel
`analysis_runs` (RLS: adviseur ziet uitsluitend eigen rijen) — geen los
REST-endpoint nodig. Voor de mock (v1) definieert dit contract de vorm
die de mock server aanbiedt onder `VITE_ANALYSIS_API_URL`.

`GET /analysis-runs/:run_id` (met Supabase JWT)

```json
{
  "id": "uuid",
  "assistant_id": "uuid",
  "advisor_id": "uuid",
  "client_reference": "ref",
  "status": "queued | running | succeeded | failed",
  "started_at": "2026-10-09T10:00:00Z",
  "finished_at": "2026-10-09T10:02:30Z | null",
  "error_code": "N8N_WORKFLOW_ERROR | null",
  "error_message": "… | null",
  "expires_at": "2026-10-16T10:02:30Z",
  "result": { "…": "AnalysisResult volgens analysis-schema.md, alleen bij succeeded" },
  "intern_markdown": "… | null",
  "dossier_docx_url": "https://signed-url | null"
}
```

Polling-gedrag (UI): interval 3 s; exponentiële backoff bij
verbindingsfouten (6 → 12 → 24 → 30 s max); stop bij `succeeded` of
`failed`; verbindingsfouten tonen een expliciete foutstatus (spec US4-3).
Onbekende statuswaarde → expliciete "onbekende status"-fout, nooit een
lege weergave.

## Recente runs per adviseur

`GET /analysis-runs?advisor_id=…&limit=10` (RLS dwingt advisor_id =
auth.uid() af) of via tabel-select `analysis_runs` waar
`advisor_id = auth.uid()`, geordend op `started_at desc`, limiet 10.

Elk item bevat uitsluitend metadata (id, client_reference, status,
started_at, finished_at, error_code) — geen analyse-inhoud, geen
bestandsnamen, geen urls. Labels in de lijst: klantreferentie +
starttijdstip (spec FR-017).

## Na de bewaartermijn (7 dagen)

Rijen blijven bestaan als metadata (status, klantreferentie, tijdstippen);
`result`, `intern_markdown`, `dossier_docx_url` zijn verwijderd (null).
De UI toont bij openen een expliciete Nederlandse melding dat het
resultaat automatisch verwijderd is (spec edge case).

## .docx-download

`dossier_docx_url` is een signed URL naar Supabase Storage (private
bucket), maximaal 7 dagen geldig. De UI downloadt zonder inhoud te
wijzigen; downloadknop draagt het label "CONCEPT, door adviseur te
accorderen" (FR-013).

## Kennisbronnen voor het formulier

Bestaande query's hergebruikt (geen nieuw contract):
`assistant_knowledge_bases` join `knowledge_bases` via `useAssistantKBLinks`
uit `@/hooks/queries` — uitsluitend kennisbronnen gekoppeld aan de
risico-analyse-assistent binnen de organisatie van de adviseur (FR-002).