# Contract: `platform-admin` Edge Function (nieuw)

**Feature**: `019-platform-assistant-catalog` | **Versie**: 1 | **Datum**: 2026-10-31

## Transport

- `POST` op `/functions/v1/platform-admin`, JSON-body met `action`.
- `OPTIONS` → `200` met CORS-headers.
- Andere methoden → `405` met `VALIDATION`.
- CORS: fail-closed via `ALLOWED_ORIGINS` (komma-gescheiden, nooit `*`), exact patroon van
  `flow-config` (`Access-Control-Allow-Origin` alleen bij een toegestane origin + `Vary: Origin`).

## Authenticatie en autorisatie

1. `Authorization: Bearer <jwt>` verplicht; ontbreekt of ongeldig → `401 UNAUTHORIZED`.
2. De functie roept `rpc('is_platform_admin')` aan met een **user-context client** (anon key +
   de JWT van de aanroeper), zodat `auth.uid()` de aanroeper is.
3. Geen platformbeheerder → `403 FORBIDDEN` met
   "Alleen de platformbeheerder kan deze instelling wijzigen."
4. Alle databewerkingen daarna met de service-role client.

## Foutcodes

| Code | HTTP | Melding (Nederlands) |
|---|---|---|
| `VALIDATION` | 400 | situatieafhankelijk, zie hieronder |
| `UNAUTHORIZED` | 401 | "Uw sessie is verlopen. Log opnieuw in." |
| `FORBIDDEN` | 403 | "Alleen de platformbeheerder kan deze instelling wijzigen." |
| `INTERNAL_ERROR` | 500 | "Er ging iets mis. Probeer het opnieuw." |

Responsevorm: `{ "code": "<CODE>", "message": "<NL>" }`.

## Logging

`logCode(code, action, organizationId?, catalogId?, durationMs)` → één JSON-regel op stderr met
uitsluitend code, actie, id's en duur. **Nooit** URL's, tokens, namen of request-bodies.
Validatiefouten van SQL-functies worden naar `VALIDATION` vertaald.

## Acties

### `list_organizations`

Request: `{ "action": "list_organizations" }`

Response `200`:

```json
[{ "id": "uuid", "name": "Darwin" }]
```

Gesorteerd op `name` (oplopend). Lezen met de service role.

### `list_org_assistants`

Request: `{ "action": "list_org_assistants", "organization_id": "uuid" }`

Response `200`:

```json
[{
  "assistant_id": "uuid",
  "catalog_id": "uuid",
  "name": "Schade",
  "icon": "🤖",
  "type": "chat",
  "is_active": true
}]
```

- Join `ai_assistants` → `assistant_catalog` op `catalog_id`; `name`, `icon` en `type` komen uit
  de catalogus (bron van waarheid).
- Gesorteerd op `name`.
- Onbekende of ongeldige `organization_id` → `400 VALIDATION` ("Onbekende organisatie.").

### `set_assistant_active`

Request:

```json
{ "action": "set_assistant_active", "organization_id": "uuid", "catalog_id": "uuid", "is_active": false }
```

Response `200`: `{ "ok": true }`

- `is_active` moet een boolean zijn.
- Update `ai_assistants SET is_active` op `(organization_id, catalog_id)`.
- Geen rij geraakt → `400 VALIDATION` ("Deze assistent hoort niet bij deze organisatie.").

### `get_connections`

Request: `{ "action": "get_connections" }`

Response `200`:

```json
{
  "auth_header": "X-Webhook-Token",
  "has_token": true,
  "document_webhook_url": "https://…/webhook/…",
  "assistants": [
    { "catalog_id": "uuid", "name": "Schade", "type": "chat",
      "test_webhook_url": null, "prod_webhook_url": "https://…/webhook/…" }
  ]
}
```

- **Het token wordt nooit opgenomen.** Alleen `has_token` (`token <> ''`).
- `assistants` gesorteerd op `name`.

### `save_connections`

Request:

```json
{
  "action": "save_connections",
  "auth_header": "X-Webhook-Token",
  "token": "optioneel",
  "document_webhook_url": "https://…/webhook/…",
  "assistants": [
    { "catalog_id": "uuid", "test_webhook_url": null, "prod_webhook_url": "https://…/webhook/…" }
  ]
}
```

Response `200`: `{ "ok": true, "has_token": true }`

Regels:

- `auth_header` leeg/afwezig → `X-Webhook-Token`.
- `token` leeg of afwezig → bestaand token behouden; anders vervangen.
- Elke niet-lege URL wordt met `isAllowedWebhookUrl` gevalideerd:
  https verplicht; geen `localhost`, `.localhost`, `.local`, `.internal`, geen letterlijk
  IPv4/IPv6-adres. Fout → `400 VALIDATION` ("Voer een geldige https-URL in.").
- `document_webhook_url` en elke `prod_webhook_url` mogen geen `/webhook-test/` bevatten →
  `400 VALIDATION` ("Een productie-URL mag geen /webhook-test/ bevatten.").
- `test_webhook_url` volgt dezelfde regels, maar `/webhook-test/` is toegestaan.
- Lege URL → `NULL` in de database.
- Onbekende `catalog_id` → `400 VALIDATION`.
- Schrijft in één keer: `platform_webhook_config` (upsert `id = true`) en per assistent
  `assistant_catalog.test_webhook_url` / `prod_webhook_url`.

### `test_connection`

Request: `{ "action": "test_connection", "url": "https://…" }`

Response `200` (ook bij een mislukte verbinding — het is een testresultaat, geen fout):

```json
{ "ok": false, "status": 401, "message": "Authenticatiefout (401). Controleer of het token en de header naam overeenkomen met de n8n webhook instellingen." }
```

- Valideert `url` als productie-URL (inclusief geen `/webhook-test/`).
- Gebruikt de **opgeslagen** `auth_header` en het opgeslagen `token`; zonder opgeslagen token
  wordt geen headervaarde meegestuurd.
- Payload, 10 s time-out en statusmeldingen identiek aan `flow-config` actie `test`:
  `{ test: true, timestamp, assistant: { id: "test", name: "Connectivity Test",
  system_prompt: "test" }, knowledge_bases: [], knowledgeSourceName: "", tenantId: "test",
  conversation: { id: "test", history: [] }, message: "__test_connection__" }`.
- Wijzigt geen enkele opgeslagen instelling.

### `save_catalog_assistant`

Request:

```json
{
  "action": "save_catalog_assistant",
  "id": "uuid of null",
  "name": "Schade",
  "description": "… of null",
  "icon": "🤖",
  "type": "chat",
  "example_questions": ["…", "…"]
}
```

Response `200`: `{ "catalog_id": "uuid" }`

- Roept `rpc('platform_save_catalog_assistant')` aan met `p_actor = auth.uid()`.
- `name` leeg, ongeldig `type`, of meer dan 4 voorbeeldvragen → `400 VALIDATION`.
- `id` onbekend → `400 VALIDATION` ("Deze assistent bestaat niet meer.").
- Maakt bij een nieuwe assistent direct een aangezette rij voor elke organisatie.

## Invarianten

1. Geen enkel antwoord bevat ooit `platform_webhook_config.token`.
2. Elke actie behalve `test_connection` schrijft alleen na een geslaagde
   platformbeheerdercontrole.
3. De functie leest of logt geen cliëntinhoud.
4. `ALLOWED_ORIGINS` ongeldig/leeg → geen `Access-Control-Allow-Origin` (fail-closed).
