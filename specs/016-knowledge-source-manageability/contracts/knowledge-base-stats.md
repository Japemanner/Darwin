# Contract: knowledge_base_stats (PostgREST view)

**Feature**: 016-knowledge-source-manageability | **Date**: 2026-10-30

## Interface

| Field | Value |
|-------|-------|
| Relation | `public.knowledge_base_stats` (view) |
| Access | PostgREST, `authenticated` |
| Security | `security_invoker = true` (RLS van onderliggende tabellen) |
| Cardinality | Eén rij per kennisbron, ook zonder documenten |

## Shape

```json
[
  {
    "knowledge_base_id": "77777777-7777-4777-8777-777777777777",
    "organization_id": "33333333-3333-4333-8333-333333333333",
    "document_count": 3,
    "error_count": 1,
    "last_updated_at": "2026-10-30T09:12:00+00:00"
  }
]
```

| Column | Type | Nullable | Meaning |
|--------|------|----------|---------|
| `knowledge_base_id` | uuid | no | Kennisbron |
| `organization_id` | uuid | no | Organisatie (RLS-scope) |
| `document_count` | integer | no | Aantal documenten; 0 bij een lege bron |
| `error_count` | integer | no | Aantal documenten met `status = 'error'` |
| `last_updated_at` | timestamptz | no | Nieuwste van `knowledge_bases.updated_at` en `MAX(documents.updated_at)` |

## Client query

```ts
supabase
  .from('knowledge_base_stats')
  .select('*')
  .eq('organization_id', orgId)
```

Query key: `['kb-stats', orgId]`. Invalidatie na upload, verwijderen en retry.

## Guarantees

- Geen N+1: één HTTP-query levert alle statistieken van de organisatie.
- Een kennisbron zonder documenten verschijnt met `document_count = 0` en `error_count = 0`.
- Members zien dezelfde waarden als admins; de view is read-only en kent geen schrijfpad.
- Geen documentnaam, bestandspad of foutreden in de view; alleen aggregaten en tijdstippen.

## Migration

Zie `data-model.md` § KnowledgeBaseStats voor de SQL. Toepassen via Supabase MCP, gevolgd door `NOTIFY pgrst, 'reload schema';`.
