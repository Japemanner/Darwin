# Contract delta: `rag-chat` (bestaande functie)

**Feature**: `019-platform-assistant-catalog` | **Basis**: `specs/011-resumable-chat-page/contracts/rag-chat.md`

Het request- en responsecontract verandert **niet**. Alleen de herkomst van webhook-URL,
headernaam en token verandert.

## Verwijderd

- De `flow_configs`-lookup voor `flow_type = 'rag_chat'` van de organisatie.
- De fallback naar `ai_assistants.n8n_webhook_url`.
- De vaste headernaam `X-Webhook-Token` bij die fallback.

## Nieuw

Na de bestaande autorisatie (JWT, profiel/organisatie, assistent binnen de eigen organisatie
én `is_active`) leest de functie met de **service role**:

1. `assistant_catalog.prod_webhook_url` via `ai_assistants.catalog_id`.
2. `platform_webhook_config.auth_header` en `platform_webhook_config.token` (rij `id = true`).

```text
webhookUrl   = catalog.prod_webhook_url
authHeader   = platform_webhook_config.auth_header of "X-Webhook-Token"
webhookToken = platform_webhook_config.token (leeg → geen headervaarde)
```

- Ontbrekende/ongeldige `prod_webhook_url` (of `catalog_id` null) →
  `400 NOT_CONFIGURED` met de bestaande melding
  "Er is geen koppeling geconfigureerd. Neem contact op met de beheerder."
- SSRF-controle `isAllowedWebhookUrl` blijft vóór de fetch.
- De header wordt alleen meegestuurd als het token niet leeg is (ongewijzigd gedrag).
- `is_active`- en organisatiecontrole blijven exact zoals ze zijn (FR-022: nieuw bericht in een
  gesprek met een uitgezette assistent → `403 FORBIDDEN` met de bestaande melding).

## Ongewijzigd

- Request: `assistant_id`, `conversation_id`, `message_id`, `message`.
- Alle foutcodes, statusmappen en Nederlandse meldingen.
- v2-persistentie, geschiedenis, knowledge bases, tenantId, normalisatie van het antwoord.
- Geen token, URL of berichtinhoud in logs.
