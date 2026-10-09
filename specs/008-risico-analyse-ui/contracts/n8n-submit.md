# Contract: n8n submit (UI → Darwin backend → n8n workflow)

**Feature**: 008-risico-analyse-ui | **Datum**: 2026-10-09

## Endpoint (echt backend, latere backend-feature)

`POST {SUPABASE_FUNCTIONS_URL}/analysis-run-submit` — Supabase Edge
Function `analysis-run-submit` (service-role), aangeroepen door de UI met
het Supabase JWT van de ingelogde adviseur.

In v1 (deze feature) implementeert de mock server
(`scripts/mock-analysis-server.mjs`) dit endpoint onder
`VITE_ANALYSIS_API_URL`.

## Request

`Content-Type: multipart/form-data` (bestanden vereisen multipart):

| Onderdeel | Type | Verplicht | Beschrijving |
|-----------|------|-----------|---------------|
| run_id | string (UUID) | ja | door de UI gegenereerd |
| callback_url | string (https) | ja | Darwin callback-endpoint (run-callback-contract) |
| verzekeringsvraagstuk | text | ja | |
| kennisbronnen | JSON-array | ja | id's + namen van geselecteerde kennisbronnen |
| klantsituatie | text | nee | |
| bestanden | binary[] (files) | nee | pdf/docx/txt; ≤ 10 MB per bestand, ≤ 25 MB totaal |
| urls | JSON-array (https-strings) | nee | |
| klant_ref | text | ja | |
| adviseur | JSON | ja | `{id, full_name}` — ingelogde gebruiker |

De Edge Function valideert het JWT (auth.uid() = adviseur), maakt de
`analysis_runs`-rij (status `queued`), stuurt het multipart-payload door
naar de n8n-webhook (URL + token uit `flow_configs`, service-role
decryptie) en stuurt bestanden naar n8n. n8n ontvangt nooit het Supabase
JWT.

## Response

```json
HTTP 202 Accepted
{ "run_id": "uuid" }
```

## Fouten (expliciete foutstatussen — geen silent failures)

| Status | Betekenis | UI-gedrag |
|--------|-----------|-----------|
| 400 | Validatiefout (bijv. onbekend veld, bestandstype) | Nederlandse foutmelding bij het veld |
| 401 | Sessie verlopen | Doorsturen naar login; run blijft bestaan |
| 413 | Bestandsgrootte overschreden | Inline melding bij Bestanden |
| 422 | Groepsvalidatie (geen klantsituatie/bestanden/urls) | Inline melding |
| 5xx / netwerk | Webhook onbereikbaar | Expliciete foutstatus + "Opnieuw" |
| time-out | n8n reageert niet | Expliciete foutstatus + "Opnieuw" |

De client (`src/lib/analysis-client.ts`) mapt elk bovenstaand scenario
naar een getypeerd resultaat; hij logt nooit klantinhoud (alleen codes).