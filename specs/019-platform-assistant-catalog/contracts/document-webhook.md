# Contract delta: `document-webhook` (bestaande functie)

**Feature**: `019-platform-assistant-catalog` | **Basis**: `specs/009-secure-n8n-proxy/contracts/document-webhook.md`

Request (`document_id`, `action`), response (`{ ok: true }`), foutcodes en statussen blijven
ongewijzigd.

## Verwijderd

- De `flow_configs`-lookup voor `flow_type = 'document_processing'` van de organisatie.

## Nieuw

Met de **service role** leest de functie `platform_webhook_config` (rij `id = true`):

```text
webhookUrl   = platform_webhook_config.document_webhook_url
authHeader   = platform_webhook_config.auth_header of "X-Webhook-Token"
webhookToken = platform_webhook_config.token
```

- Ontbrekende/ongeldige `document_webhook_url` → `400 NOT_CONFIGURED` met de bestaande melding;
  bij `action = 'index'` wordt de documentstatus op `error` gezet, precies zoals nu.
- De SSRF-controle en de 10 s time-out blijven.
- De header wordt alleen meegestuurd als het token niet leeg is.

## Ongewijzigd

- Organisatie- en rolgrenzen (index alleen voor `role = 'admin'`).
- Documentcontrole via RLS, signed download-URL (900 s), payload, statusovergangen en alle
  foutmeldingen.
- Geen URL's, tokens of documentinhoud in logs.
