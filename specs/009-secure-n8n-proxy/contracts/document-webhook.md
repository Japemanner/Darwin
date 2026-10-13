# Contract: document-webhook (UI → Edge Function → n8n)

**Feature**: 009-secure-n8n-proxy | **Date**: 2026-10-13 | **Implementatie**: `supabase/functions/document-webhook/index.ts`, aanroep in `src/lib/storage.ts`

## Endpoint

| Veld | Waarde |
|------|--------|
| Method | `POST` |
| URL | `{SUPABASE_URL}/functions/v1/document-webhook` |
| Auth | Supabase-sessie-JWT (via `supabase.functions.invoke`) |
| Client-time-out | geen aparte client-abort — server-side n8n-fetch: 10 seconden |
| Content-Type | `application/json` |

## Request

```json
{
  "document_id": "880e8400-e29b-41d4-a716-446655440004",
  "action": "index"
}
```

| Veld | Type | Verplicht | Toelichting |
|------|------|-----------|-------------|
| `document_id` | UUID | ja | Bestaande rij in `knowledge_base_documents` |
| `action` | `"index"` \| `"modify"` \| `"delete"` | ja | Zelfde acties als de huidige `callDocumentWebhook` |

De client stuurt geen naam, type, bestandspad of downloadlink meer; de server
leest alles uit de database en genereert de signed URL zelf.

## Server-validatie

1. JWT valideren (patroon `invite-user`); ongeldig → `401 UNAUTHORIZED`.
2. Documentrij lezen via de user-context client (RLS dwingt
   `organization_id = get_user_org_id()` af); niet-vindbaar → `403 FORBIDDEN`.
   Vanuit de rij haalt de server: `document_name`, `document_type`,
   `file_path`, en via `knowledge_base_id` de kennisbronnaam. De organisatie
   komt uitsluitend uit het `profiles`-record van `auth.uid()` — nooit uit de
   request-body of user-metadata.
3. `flow_configs` (flow_type `document_processing`) met de service role;
   afwezig → `400 NOT_CONFIGURED` (de huidige stille no-op vervalt —
   constitution V: geen stille fouten). De geconfigureerde URL moet `https://`
   zijn en geen letterlijk IP, `localhost` of link-local host bevatten; anders
   `400 NOT_CONFIGURED`.
4. `tenantId` = organisatienaam (server-resolved).
5. Bij `index` en `modify`: signed URL (900 s) op de private bucket
   `knowledge-documents`, gemaakt met de service role. Bij `delete`: geen URL
   (`""`), gelijk aan het huidige gedrag.

## Payload naar n8n (ongewijzigd t.o.v. `callDocumentWebhook`)

```json
{
  "action": "index",
  "tenantId": "Organisatienaam",
  "knowledgeSourceName": "Schade",
  "document_id": "…",
  "document_name": "polisvoorwaarden.pdf",
  "document_type": "pdf",
  "file_path": "org-id/kb-id/uuid.pdf",
  "download_url": "https://…supabase.co/storage/v1/object/sign/…"
}
```

Per document hoort één kennisbron; `knowledgeSourceName` blijft hier een
string (de lijst-uitbreiding geldt alleen voor de chat, contract rag-chat.md).

## Response

Succes: `200 { "ok": true }`.
Fouten: JSON `{ "code", "message" }` met de codeverzameling uit
contracts/rag-chat.md (`UNAUTHORIZED` 401, `FORBIDDEN` 403,
`NOT_CONFIGURED` 400, `UPSTREAM_*` 502).

## Clientflow `src/lib/storage.ts` (gewijzigde volgorde)

Upload (`action: "index"` / `"modify"`):

1. Bestand uploaden naar storage en rij aanmaken met status `processing`
   (ongewijzigd).
2. `document-webhook` aanroepen. Bij mislukking: rij en bestand blijven
   staan, de UI toont de Nederlandse melding met foutcode (toast). De status
   blijft `processing`; het expliciete "Opnieuw verwerken" komt in feature I
   (verbeterplan), binnen deze feature is de melding de oplossing.

Verwijderen (`action: "delete"`) — volgorde wisselt ten opzichte van nu:

1. **Eerst** `document-webhook` aanroepen (de rij moet bestaan om te lezen).
2. Bij succes: bestand uit storage verwijderen en rij verwijderen
   (ongewijzigd vervolg).
3. Bij mislukking: document en rij blijven staan, de UI toont de Nederlandse
   melding met foutcode. (Spec US2 scenario 3: het document blijft opgeslagen.)

Randgeval n8n-succes + lokaal falen: meldt n8n de verwijdering wel, maar faalt
daarna de lokale verwijdering (storage of rij), dan blijft het document in de
lijst staan met een foutmelding. Herstel: de verwijdering opnieuw uitvoeren —
n8n ontvangt de delete-melding dan opnieuw (de verwijdering in de
vectorindex is idempotent).

## CORS

`Access-Control-Allow-Origin` uit `ALLOWED_ORIGINS` (komma-gescheiden),
fail-closed: variabele niet gezet of `Origin` matcht niet → géén
`Access-Control-Allow-Origin`-header (browser blokkeert); nooit `*`. De
OPTIONS-preflight volgt dezelfde regel.

## Logging (constitution III)

Alleen foutcode, document-id, actie en duur. Nooit documentnamen,
signed URL's of bestandsinhoud. Log ook geen fetch-foutmeldingen die de
webhook-URL bevatten — alleen de getypeerde code.