# Contract: run callback (n8n workflow → Darwin backend)

**Feature**: 008-risico-analyse-ui | **Datum**: 2026-10-09

## Endpoint

`POST {SUPABASE_FUNCTIONS_URL}/analysis-run-callback` — Supabase Edge
Function `analysis-run-callback` (service-role), aangeroepen door de n8n
workflow met een webhook-token (header `X-Webhook-Token`, configuratie via
`flow_configs`, nieuw `flow_type: 'risk_analysis'`).

## Success-payload

`Content-Type: application/json`, dossier-document als base64-binary:

```json
{
  "run_id": "uuid",
  "status": "ok",
  "analyse": {
    "risicos": ["..."],
    "dekking": "...",
    "restgat": "...",
    "draagkracht": "...",
    "opties": [{ "titel": "...", "voor": ["..."], "tegen": ["..."] }],
    "lacunes": ["..."],
    "intern_signalen": ["..."],
    "bronnen": [
      { "id": "K1", "document": "...", "locatie": "...", "passage": "..." }
    ]
  },
  "intern_markdown": "## Risico's\n...",
  "dossier_docx": "<base64>"
}
```

Semantiek: `status: "ok"` schrijft `analysis_runs` bij naar `succeeded`,
valideert `analyse` tegen het zod-schema (analysis-schema.md), slaat
`intern_markdown` op en uploadt `dossier_docx` naar Supabase Storage
(private bucket, signed URL 7 dagen). Geüploade invoerbestanden worden in
dezelfde stap verwijderd (constitution Principe III).

## Error-payload

```json
{
  "run_id": "uuid",
  "status": "error",
  "code": "N8N_WORKFLOW_ERROR",
  "message": "Nederlandse, adviseur-leesbare foutmelding"
}
```

Semantiek: `analysis_runs` bijwerken naar `failed` met `error_code` en
`error_message`; de UI toont foutcode + melding met retry.

## Afspraken

- De callback bevat nooit advies of aanbeveling; alle gegenereerde tekst
  draagt in de UI het label CONCEPT.
- `code` is een stabiele, machine-leesbare string (bijv.
  `TIMEOUT_EXTRACT`, `SOURCE_UNAVAILABLE`); de UI toont de code raw naast
  de Nederlandse melding.
- Foutieve payloads (ongeldig schema, onbekende run_id) → HTTP 4xx/5xx
  naar n8n; n8n laat de run uiteindelijk time-out → status `failed` met
  code `BACKEND_TIMEOUT` via cleanup-taak (expliciete foutstatus, geen
  stilzwijgende run).
- Idempotentie: herhaalde callbacks voor dezelfde run_id (zelfde status)
  zijn toegestaan; de tweede wint niet van een `succeeded`-status.