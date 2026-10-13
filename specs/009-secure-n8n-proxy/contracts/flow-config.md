# Contract: flow-config (Instellingen → Edge Function)

**Feature**: 009-secure-n8n-proxy | **Date**: 2026-10-13 | **Implementatie**: `supabase/functions/flow-config/index.ts`, client `src/lib/flow-config-client.ts`, UI `src/pages/SettingsPage.tsx` (`FlowConfigCard`)

## Endpoint

| Veld | Waarde |
|------|--------|
| Method | `POST` |
| URL | `{SUPABASE_URL}/functions/v1/flow-config` |
| Auth | Supabase-sessie-JWT (via `supabase.functions.invoke`) + server-side admincheck |
| Content-Type | `application/json` |

Alleen beheerders (`profiles.role = 'admin'`, eigen organisatie): anders
`403 FORBIDDEN`. De tokenwaarde wordt in geen enkele respons teruggegeven —
het veld is write-only (spec US3).

## Request

```json
{
  "action": "save",
  "flow_type": "rag_chat",
  "webhook_url": "https://n8n.example.com/webhook/rag-chat",
  "webhook_auth_header": "X-Webhook-Token",
  "webhook_token": "nieuwe-token-waarde"
}
```

| Veld | Type | Verplicht | Toelichting |
|------|------|-----------|------------|
| `action` | `"get"` \| `"save"` \| `"test"` | ja | |
| `flow_type` | `"rag_chat"` \| `"document_processing"` | ja | |
| `webhook_url` | string | bij `save`/`test` | https-URL |
| `webhook_auth_header` | string | bij `save`/`test` | standaard `X-Webhook-Token` |
| `webhook_token` | string | nee | Leeg/afwezig = bestaand token behouden of (bij `test`) het opgeslagen token gebruiken |

## Acties

### `get` → `200`

```json
{
  "flow_type": "rag_chat",
  "webhook_url": "https://n8n.example.com/webhook/rag-chat",
  "webhook_auth_header": "X-Webhook-Token",
  "has_token": true
}
```

De configuratie zonder token, plus `has_token`. De UI toont bij `has_token` de
placeholder "Token is ingesteld" in het wachtwoordveld; het veld blijft leeg
en alleen een nieuwe waarde overschrijft (write-only). Bestaat er nog geen
configuratie voor het flowtype, dan geeft `get` `200` met lege strings en
`has_token: false` (geen fout — de UI toont een leeg formulier).

### `save` → `200 { "ok": true, "has_token": true }`

Upsert op `(flow_type, organization_id)` met de service role:
- `webhook_url` en `webhook_auth_header` worden altijd geschreven.
- Een opgegeven (niet-lege) token wordt **als platte tekst** opgeslagen in
  `flow_configs.webhook_token` (technische route A2; leesbaarheid wordt
  geblokkeerd door de REVOKE/GRANT-migratie, zie data-model.md).
- Leeg/afwezig token laat het bestaande token ongemoeid.
- Server-side validatie: `webhook_url` moet `https://` zijn en geen letterlijk
  IP, `localhost` of link-local host bevatten; anders `400 VALIDATION` met de
  Nederlandse melding "Voer een geldige https-URL in."

### `test` → `200 { "ok": true|false, "status": number, "message": string }`

Poort van de huidige `testWebhook` (src/lib/webhook.ts:306-388), uitgevoerd
namens de beheerder:

- Gebruikt de meegegeven URL/headernaam en — indien opgegeven — het
  meegegeven token. Is het tokenveld leeg én is de meegegeven URL gelijk aan
  de opgeslagen URL, dan gebruikt de server het opgeslagen token
  (service-role lees). **Wijkt de meegegeven URL af van de opgeslagen URL en
  blijft het tokenveld leeg, dan weigert de test** met de Nederlandse melding
  "Voer het token in om een andere URL te testen." — het opgeslagen token mag
  nooit naar een andere host gestuurd worden.
- Weigert een `/webhook-test/`-URL met de bestaande Nederlandse uitleg dat een
  productie-URL vereist is.
- Verstuurt het bestaande testpayload (`test: true`, `tenantId: "test"`, …);
  10-seconden time-out; 500 met de bestaande nuance dat een IF-node in de
  workflow testberichten moet afhandelen ("Webhook bereikbaar! De workflow
  gaf een fout (500)…").
- `message` is de bestaande Nederlandse tekst per situatie (succes, time-out,
  onbereikbaar, 401/403/404/429/5xx).

## Fouten

JSON `{ "code", "message" }`:

| HTTP | Code | Situatie |
|------|------|----------|
| 401 | `UNAUTHORIZED` | Geen of ongeldig sessie-JWT |
| 403 | `FORBIDDEN` | Geen beheerder van de organisatie |
| 400 | `VALIDATION` | Ontbrekende of ongeldige velden (`flow_type`, `action`, niet-https/ongeldige `webhook_url`) — Nederlandse melding "Ongeldige invoer." resp. "Voer een geldige https-URL in." |

## CORS

`Access-Control-Allow-Origin` uit `ALLOWED_ORIGINS` (komma-gescheiden),
fail-closed: variabele niet gezet of `Origin` matcht niet → géén
`Access-Control-Allow-Origin`-header (browser blokkeert); nooit `*`. De
OPTIONS-preflight volgt dezelfde regel.

## Logging (constitution III)

Alleen actie, flow_type, organisatie-id, foutcode en duur. Nooit tokenwaarden,
en geen fetch-foutmeldingen die de webhook-URL bevatten — alleen de getypeerde
code.