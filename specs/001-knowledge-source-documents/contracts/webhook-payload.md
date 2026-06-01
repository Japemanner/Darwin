# Contract: N8N Document Webhook Payload

**Feature**: `001-knowledge-source-documents`
**Version**: 1.0.0
**Direction**: Darwin → N8N

## Endpoint

```
POST {VITE_N8N_DOCUMENT_WEBHOOK}
Content-Type: application/json
```

## Request Body

```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "document_name": "handleiding.pdf",
  "document_type": "pdf",
  "download_url": "https://xxx.supabase.co/storage/v1/object/sign/knowledge-documents/orgId/kbId/uuid.pdf?token=eyJ..."
}
```

| Veld | Type | Verplicht | Omschrijving |
|------|------|-----------|-------------|
| `tenant_id` | string (UUID) | Ja | De organisatie-ID (organization_id) van de tenant die het document heeft geüpload |
| `document_name` | string | Ja | De originele bestandsnaam van het document |
| `document_type` | string | Ja | De bestandsextensie in lowercase (bijv. "pdf", "txt", "docx") |
| `download_url` | string (URL) | Ja | Een gesigneerde Supabase Storage URL, 15 minuten geldig vanaf aanmaak |

## Gedrag

- **Fire-and-forget**: Darwin wacht niet op een response van N8N. Een falende webhook call wordt gelogd naar de console maar niet aan de gebruiker getoond.
- **Idempotent**: Dezelfde payload kan meerdere keren worden verstuurd (bijv. bij retry). N8N moet hiermee om kunnen gaan.
- **Expiry**: De `download_url` is 15 minuten (900 seconden) geldig. N8N moet het document binnen deze tijd downloaden.

## Error Handling (Darwin-kant)

| Scenario | Darwin-gedrag |
|----------|-------------|
| N8N endpoint bereikbaar, HTTP 2xx | Webhook geslaagd — geen gebruikersmelding |
| N8N endpoint bereikbaar, HTTP 4xx/5xx | Fire-and-forget — error wordt gelogd naar console, gebruiker ziet niets |
| N8N endpoint onbereikbaar (netwerkfout) | Fire-and-forget — error wordt gelogd naar console, gebruiker ziet niets |
| `VITE_N8N_DOCUMENT_WEBHOOK` niet geconfigureerd | Webhook wordt overgeslagen — gebruiker ziet niets |

## Wijzigingen t.o.v. bestaande payload

| Veld | Oud (huidig) | Nieuw (target) |
|------|-------------|----------------|
| `organization_id` | ✅ Aanwezig | ❌ Vervallen (vervangen door `tenant_id`) |
| `tenant_id` | ❌ Niet aanwezig | ✅ Toegevoegd |
| `knowledge_base_id` | ✅ Aanwezig | ❌ Vervallen (N8N heeft dit niet nodig) |
| `document_name` | ✅ Aanwezig | ✅ Blijft |
| `document_type` | ❌ Niet aanwezig | ✅ Toegevoegd |
| `download_url` | ❌ Niet aanwezig | ✅ Toegevoegd (gesigneerd, 15 min) |
