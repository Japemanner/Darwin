# Contract: document-webhook — herverwerken (action `index`)

**Feature**: 016-knowledge-source-manageability | **Date**: 2026-10-30

**Supersedes**: `specs/009-secure-n8n-proxy/contracts/document-webhook.md`, alleen de regel dat de status bij een uploadfout op `processing` blijft en de aantekening dat "Opnieuw verwerken" toekomstig werk is.

## Endpoint

| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `{SUPABASE_URL}/functions/v1/document-webhook` |
| Auth | Supabase-sessie-JWT via `supabase.functions.invoke` |
| Content-Type | `application/json` |

## Request

```json
{
  "document_id": "880e8400-e29b-41d4-a716-446655440004",
  "action": "index"
}
```

De client stuurt geen status, foutreden, documentnaam of bestandspad. `retryDocument(documentId)` in `src/lib/storage.ts` is de enige nieuwe client-aanroep.

## Server behavior for `action: "index"`

1. Valideer JWT (bestaand) → anders `401 UNAUTHORIZED`.
2. Lees `profiles.organization_id, role` van `auth.uid()`.
   - Geen profiel → `403 FORBIDDEN`.
   - `role !== 'admin'` → `403 FORBIDDEN` (beheeractie, feature B).
3. Lees de documentrij via de user-context client (RLS org-scoped) → niet gevonden `403 FORBIDDEN`.
4. Zet met de **service role** vóór de n8n-call:
   - `status = 'processing'`
   - `error_message = null`
5. Lees `flow_configs` en maak de signed URL (bestaand, `index`/`modify`).
6. Roep n8n aan met de bestaande payload (ongewijzigd).
7. Bij upstream-succes: `200 { "ok": true }`; `error_message` blijft `null`. n8n vult later een eigen reden bij een asynchrone fout.
8. Bij upstream-fout (`UPSTREAM_AUTH`, `UPSTREAM_ERROR`, `UPSTREAM_TIMEOUT`, `UPSTREAM_UNREACHABLE`) of een interne fout vóór de call:
   - zet met de service role `status = 'error'` en `error_message` op de Nederlandse fouttekst uit `ERROR_MESSAGES`;
   - retourneer de bestaande foutcode/HTTP-status.

## Guarantees

- De browser schrijft nooit naar `knowledge_base_documents`; de default-deny UPDATE-situatie uit migratie 015 blijft intact.
- Een mislukte retry laat het document nooit eindeloos op `processing` staan.
- Een geslaagde retry laat de polling (5 s) starten en weer stoppen zodra n8n `ready` of `error` zet.
- De n8n-ingestflow en het payload-contract naar n8n veranderen niet.

## Errors

Zelfde codes en HTTP-statussen als feature 009: `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_CONFIGURED` 400, `UPSTREAM_AUTH|UPSTREAM_ERROR|UPSTREAM_TIMEOUT|UPSTREAM_UNREACHABLE` 502, `INTERNAL_ERROR` 500.

## Client contract (`src/lib/storage.ts`)

```ts
export const retryDocument = (documentId: string): Promise<void> =>
  notifyDocumentWebhook(documentId, 'index')
```

Fouten blijven `DocumentWebhookError` met een Nederlandse `message`. De UI toont die als toast en invalideert `['kb-documents', kbId]` en `['kb-stats', orgId]` alleen bij succes.

## Logging

Ongewijzigd: alleen `code`, `document_id`, `action`, `ms`. Nooit documentnaam, foutreden, signed URL of bestandsinhoud.
