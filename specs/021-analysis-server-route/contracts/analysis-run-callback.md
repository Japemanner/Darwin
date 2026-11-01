# Contract: `analysis-run-callback` (n8n → Darwin)

**Feature**: 021-analysis-server-route | **Datum**: 2026-10-31
**Basis**: `specs/008-risico-analyse-ui/contracts/run-callback.md`, met de aangescherpte
regels uit de technische route van 021 (HMAC in de URL, 409 voor afgeronde runs).

## Endpoint

`POST {SUPABASE_URL}/functions/v1/analysis-run-callback?run_id={uuid}&sig={hex}`

- **Deploy met `--no-verify-jwt`** (n8n heeft geen Supabase-JWT).
- Geen CORS nodig (server-to-server); `OPTIONS` mag 200 teruggeven.
- De URL wordt door `analysis-run-submit` aan n8n gegeven; n8n wijzigt hem niet.

## Authenticatie

```text
sig = hex(HMAC-SHA256(ANALYSIS_CALLBACK_SECRET, run_id))
```

- Herbereken met de `run_id` uit de query en vergelijk **constant-time**.
- Ongeldig of ontbrekend → **401**, niets schrijven, alleen `{ code, ms }` loggen.
- De query-`run_id` is gezaghebbend. Een afwijkende `run_id` in de body → 400.

## Volgorde van controles

1. `sig` valide → anders 401.
2. `run_id` bestaat en status is `queued` of `running` → anders **409**.
3. Content-Type:
   - `application/json` → error-payload.
   - `multipart/form-data` → success-payload.
   - anders → 400.
4. Payload valideren; bij een ongeldig succesresultaat wordt de run **failed**
   (geen 409) met `INVALID_RESULT`.

## Error-payload (JSON)

```json
{
  "run_id": "uuid",
  "status": "error",
  "code": "N8N_WORKFLOW_ERROR",
  "message": "Nederlandse, adviseur-leesbare foutmelding"
}
```

Semantiek: `status = 'failed'`, `error_code = code`, `error_message = message`,
`finished_at = now()`. Geen resultaat, geen dossier.

## Success-payload (multipart/form-data)

| Onderdeel | Type | Verplicht |
|---|---|---|
| `run_id` | text (UUID) | ja (moet gelijk zijn aan de query) |
| `status` | text | ja, literal `ok` |
| `analyse` | text (JSON-string) | ja |
| `intern_markdown` | text | ja, non-empty |
| `dossier_docx` | file | ja, non-empty `.docx` |

`analyse` wordt met `JSON.parse` gelezen en daarna met zod gevalideerd volgens
`specs/008-risico-analyse-ui/contracts/analysis-schema.md`:

```text
risicos: string[] (non-empty items)
dekking, restgat, draagkracht: string (non-empty)
opties: { titel: string; voor: string[]; tegen: string[] }[]
lacunes: string[]
intern_signalen: string[]
bronnen: { id: /^[KRA][0-9]+$/; document; locatie; passage }[]
```

## Serverstappen bij succes

1. Object uploaden met de service role naar
   `analysis-dossiers/{organization_id}/{advisor_id}/{run_id}.docx`
   (`contentType` = docx-MIME, `upsert: true` voor herstel na een eerdere mislukte
   rij-update).
2. Rij **conditioneel** bijwerken:
   `update … set status='succeeded', result_json=…, intern_markdown=…,
   dossier_path=…, finished_at=now() where id=… and status in ('queued','running')`.
3. Als de conditionele update 0 rijen raakt (race/afgerond): het zojuist geüploade
   object weer verwijderen via de Storage API en **409** teruggeven.
4. Antwoord 200 `{ run_id, status: 'ok' }`.

## Statuscodes

| Situatie | Status | Schrijfactie |
|---|---|---|
| Geldige error-payload | 200 | `failed` |
| Geldige success-payload | 200 | `succeeded` + object |
| Ongeldige/ontbrekende `sig` | 401 | geen |
| Onbekende run, of al `succeeded`/`failed` | 409 | geen |
| Body-`run_id` wijkt af, onbekende content-type, ontbrekende velden | 400 | geen |
| `analyse`/`intern_markdown`/`dossier_docx` ongeldig | 200 | `failed` + `INVALID_RESULT` |
| Storage- of databasefout | 500 | geen (of gecompenseerd) |

## Idempotentie en racisme

- Een tweede callback voor dezelfde run krijgt 409; de eerste afronding blijft staan.
- De conditionele update voorkomt dat een late callback een afgeronde run overschrijft.
- Een succes-callback met ongeldige analyse wordt `failed`; een latere geldige callback
  wordt dan geweigerd (409). Dit is bewust: de run is al afgerond.

## Logging

Alleen `{ run_id, code, ms }`. Nooit analyse-inhoud, markdown, dossierinhoud,
organisatie-/adviseur-id, foutmelding of de signature.
