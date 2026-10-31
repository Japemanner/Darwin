# Data Model: Kennisbronnenbeheer dat laat zien of een bron bruikbaar is

**Feature**: 016-knowledge-source-manageability | **Date**: 2026-10-30

## Entities

### KnowledgeBase (`knowledge_bases`)

Bestaande tabel, ongewijzigd.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `organization_id` | uuid FK → organizations | RLS-scope |
| `name` | text | Vergrendeld in de UI zodra de bron documenten heeft |
| `description` | text NULL | |
| `vector_collection_id` | text NULL | Blijft in DB en payload; veld verdwijnt uit de UI |
| `processing_mode` | `vectorized` \| `plain_text` | |
| `created_by`, `created_at`, `updated_at` | | |

### KnowledgeBaseDocument (`knowledge_base_documents`)

Bestaande tabel + één nieuwe nullable kolom.

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid PK | |
| `knowledge_base_id` | uuid FK → knowledge_bases | |
| `organization_id` | uuid FK → organizations | |
| `name` | text | Getoond in de verwijderbevestiging |
| `file_path` | text NULL | |
| `file_type` | text | `pdf` \| `txt` \| `docx` (bestaande uploadvalidatie) |
| `file_size` | integer | |
| `status` | `processing` \| `ready` \| `error` | Ongewijzigd |
| **`error_message`** | **text NULL** | **Nieuw.** Door n8n gevuld; leeg = algemene Nederlandse fouttekst tonen |
| `created_by`, `created_at`, `updated_at` | | `updated_at` via bestaande trigger |

**State transitions** (alleen via de service role / n8n):

```text
upload            retry (server route)         n8n success
  │                     │                          │
  ▼                     ▼                          ▼
processing ──────────────────────────────────────► ready
     │                                              ▲
     │ n8n failure / proxy failure                  │
     ▼                                              │
   error ──────────── retry (server route) ─────────┘
```

- `processing → ready`: n8n meldt succes (bestaand gedrag).
- `processing → error`: n8n of de proxy meldt een fout; `error_message` optioneel gevuld.
- `error → processing`: "Opnieuw verwerken"; `error_message` wordt `null`.
- Geen enkele overgang wordt door de browser uitgevoerd.

### KnowledgeItem (`knowledge_items`)

Bestaande tabel, **ongewijzigd**. Niet meer gerenderd in de UI; data blijft bestaan. Verwerking blijft buiten scope.

### KnowledgeBaseStats (view, nieuw)

`public.knowledge_base_stats` — één rij per kennisbron, ook zonder documenten.

| Column | Type | Definition |
|--------|------|------------|
| `knowledge_base_id` | uuid | `kb.id` |
| `organization_id` | uuid | `kb.organization_id` |
| `document_count` | integer | `count(d.id)::int` |
| `error_count` | integer | `count(*) FILTER (WHERE d.status = 'error')::int` |
| `last_updated_at` | timestamptz | `GREATEST(kb.updated_at, COALESCE(MAX(d.updated_at), kb.updated_at))` |

```sql
CREATE OR REPLACE VIEW public.knowledge_base_stats
WITH (security_invoker = true) AS
SELECT
  kb.id            AS knowledge_base_id,
  kb.organization_id,
  count(d.id)::int AS document_count,
  count(*) FILTER (WHERE d.status = 'error')::int AS error_count,
  GREATEST(kb.updated_at, COALESCE(MAX(d.updated_at), kb.updated_at)) AS last_updated_at
FROM public.knowledge_bases kb
LEFT JOIN public.knowledge_base_documents d
  ON d.knowledge_base_id = kb.id
GROUP BY kb.id;

REVOKE ALL ON public.knowledge_base_stats FROM anon;
REVOKE ALL ON public.knowledge_base_stats FROM authenticated;
GRANT SELECT ON public.knowledge_base_stats TO authenticated;
```

`security_invoker = true` laat de RLS van `knowledge_bases` en `knowledge_base_documents` gelden voor de aanroeper. De client filtert aanvullend op `organization_id`.

## Validation Rules

| Rule | Source |
|------|--------|
| Naam kennisbron niet wijzigbaar bij `document_count > 0` | FR-014, FR-015 |
| Naam weer wijzigbaar bij `document_count = 0` | FR-016 |
| Alleen admins zien en kunnen beheeracties uitvoeren | FR-025, FR-026, FR-027 |
| Members zien statistieken en foutreden read-only | FR-026 |
| Verwijderen pas na bevestiging met naam | FR-011, FR-012, FR-013 |
| Retry alleen bij `status = 'error'` en alleen admin | FR-008, FR-009 |
| Upload accepteert alleen `pdf`, `txt`, `docx` | Bestaand gedrag |
| Geen nieuwe kolommen behalve `error_message`; data blijft behouden | FR-024 |

## RLS / Security

- `knowledge_base_documents`: SELECT blijft org-scoped; INSERT/DELETE admin-only (migratie 015). **Geen UPDATE-policy** — statusovergangen gebeuren in de edge function met de service role.
- `knowledge_base_stats`: `security_invoker` view; alleen `SELECT` voor `authenticated`.
- `knowledge_bases`: bestaande org-scoped SELECT en admin-only writes blijven ongewijzigd.
- De edge function leest `role` uit `profiles` en weigert `index` voor niet-admins (403), vóór enige statuswijziging of n8n-call.
- Edge-logging blijft beperkt tot `code`, `document_id`, `action`, `ms` (constitution III).

## Migration

`supabase/migrations/018_knowledge_source_manageability.sql`

1. `ALTER TABLE public.knowledge_base_documents ADD COLUMN IF NOT EXISTS error_message TEXT;`
2. `CREATE OR REPLACE VIEW public.knowledge_base_stats WITH (security_invoker = true) AS ...`
3. `GRANT SELECT ON public.knowledge_base_stats TO authenticated;`
4. Geen backfill, geen datawijziging, geen drop.

Toepassen via Supabase MCP; daarna `NOTIFY pgrst, 'reload schema';` zodat PostgREST de view en kolom direct kent.
