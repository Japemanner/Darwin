# Data Model: Assistenten verwijderen uit de AI-assistentenlijst

**Feature**: `023-delete-assistants` | **Date**: 2026-11-06

## 1. Entities and changes

### `assistant_catalog` (existing, one column added)

Platform-wide assistant definition. Source of truth for the archive state.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `name`, `description`, `icon`, `type`, `example_questions` | existing | Definition copied to new organisation rows |
| `test_webhook_url`, `prod_webhook_url` | existing | Connections; hidden while archived |
| `created_at`, `updated_at` | existing | |
| **`archived_at`** | `timestamptz NULL` | **New.** `NULL` = in the catalogue; non-null = archived at that instant. Shown as the deletion date in the archive list. |

RLS stays enabled; client grants stay revoked. Only the `service_role` used by the
`platform-admin` Edge Function reads and writes this table.

### `ai_assistants` (existing, one column added)

Per-organisation row for a catalogue assistant. Conversations, messages, feedback
interactions, analysis runs and knowledge-source links hang off this row.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK; referenced by conversations and analysis runs |
| `organization_id` | `uuid` | FK to `organizations` |
| `catalog_id` | `uuid` | FK to `assistant_catalog`; unique per organisation |
| `name`, `description`, `icon`, `type`, `example_questions`, `system_prompt` | existing | Definition mirror |
| `is_active` | `boolean` | Per-organisation switch; **preserved** while archived |
| `created_by`, `created_at`, `updated_at` | existing | |
| **`archived_at`** | `timestamptz NULL` | **New.** Mirrors the catalogue timestamp for every row of that assistant. `NULL` = available; non-null = hidden from offers and unusable. |

RLS stays enabled with the existing organisation-wide SELECT policy. No policy
changes.

### Unchanged entities

| Entity | Relationship | Behaviour on archive |
|--------|--------------|----------------------|
| `conversations` | `assistant_id → ai_assistants.id` (no cascade) | Untouched; remains readable. |
| `messages` | `conversation_id → conversations.id` (cascade from conversation) | Untouched. |
| `analysis_runs` | `assistant_id → ai_assistants.id` (no delete action) | Untouched; result and dossier stay readable. |
| `feedback_interactions` | `assistant_id`, `conversation_id`, `message_id` | Untouched. |
| `assistant_knowledge_bases` | `assistant_id → ai_assistants.id` (cascade) | Untouched; links apply again after restore. |
| `knowledge_bases`, `knowledge_base_documents`, `knowledge_items` | Independent | Untouched. |
| `platform_webhook_config` | Single row | Untouched; connection URLs of an archived assistant stay stored. |
| `organizations` | Parent of `ai_assistants` | Untouched. |

## 2. Database functions (migration 024)

### `platform_archive_catalog_assistant(p_id uuid) → void`

```
UPDATE assistant_catalog
   SET archived_at = now()
 WHERE id = p_id AND archived_at IS NULL
RETURNING archived_at INTO v_archived;

IF v_archived IS NULL THEN
  IF EXISTS (SELECT 1 FROM assistant_catalog WHERE id = p_id) THEN
    RAISE EXCEPTION 'already_archived';
  END IF;
  RAISE EXCEPTION 'not_found';
END IF;

UPDATE ai_assistants
   SET archived_at = v_archived
 WHERE catalog_id = p_id AND archived_at IS NULL;
```

- `SECURITY DEFINER`, `SET search_path = public`.
- Execute revoked from `PUBLIC`, `anon`, `authenticated`; granted to `service_role`.
- One transaction: either the catalogue row and all organisation rows get the
  timestamp, or nothing changes.

### `platform_restore_catalog_assistant(p_id uuid, p_actor uuid) → void`

```
UPDATE assistant_catalog
   SET archived_at = NULL
 WHERE id = p_id AND archived_at IS NOT NULL
RETURNING id INTO v_id;

IF v_id IS NULL THEN
  IF EXISTS (SELECT 1 FROM assistant_catalog WHERE id = p_id) THEN
    RAISE EXCEPTION 'not_archived';
  END IF;
  RAISE EXCEPTION 'not_found';
END IF;

UPDATE ai_assistants SET archived_at = NULL WHERE catalog_id = v_id;

INSERT INTO ai_assistants (...)
SELECT o.id, c.id, c.name, c.description, c.icon, c.type,
       c.example_questions, '', false, p_actor
  FROM organizations o
  JOIN assistant_catalog c ON c.id = v_id
 WHERE NOT EXISTS (
   SELECT 1 FROM ai_assistants a
    WHERE a.organization_id = o.id AND a.catalog_id = v_id
 )
ON CONFLICT (organization_id, catalog_id) DO NOTHING;
```

- New organisations (created after the archive) get the restored assistant **off**.
- Existing organisations keep the `is_active` value they had before archiving.
- `p_actor` is the platform admin's profile id, used only for `created_by`.

### `platform_seed_org_assistants(p_org uuid, p_actor uuid) → void` (replaced)

Same as migration 021, with `WHERE c.archived_at IS NULL` in the `assistant_catalog`
select, so a new organisation never receives an archived assistant.

## 3. State transitions

| State | Trigger | Result | Visible in AI-assistenten | Usable in chat/analyse | History |
|-------|---------|--------|---------------------------|------------------------|---------|
| Available | archive RPC | Archived | No (only in "Archief") | No | Readable |
| Archived | restore RPC | Available | Yes | Per organisation switch | Readable; new messages allowed if switch is on |
| Available | Settings switch off | Available, `is_active = false` | Only to platform admin (badge "Inactief") | No | Readable |
| Archived | Settings switch attempted | Rejected | No | No | Readable |

The archive state and the per-organisation switch are independent: archiving does
not change `is_active`, and restoring does not turn anything on or off.

## 4. Validation rules

- `p_id` must be a UUID; the Edge Function validates this before the RPC.
- Archive requires a catalogue row with `archived_at IS NULL`; otherwise
  `already_archived` or `not_found`.
- Restore requires a catalogue row with `archived_at IS NOT NULL`; otherwise
  `not_archived` or `not_found`.
- Assistant name is not a key; all operations use ids.
- Archived assistants cannot be saved through `save_catalog_assistant`, toggled
  through `set_assistant_active`, or included in `save_connections`.

## 5. Invariants

1. `assistant_catalog.archived_at` is the source of truth. For a catalogue item,
   every `ai_assistants` row has `archived_at` equal to it (all null, or all the
   same non-null timestamp).
2. Archive and restore never change `ai_assistants.is_active`.
3. Archive and restore never delete or update `conversations`, `messages`,
   `analysis_runs`, `feedback_interactions` or `assistant_knowledge_bases`.
4. A new organisation never receives a catalogue item with a non-null
   `archived_at`; after a restore it receives the item with `is_active = false`.
5. No archived assistant is returned by the list, options, detail, dashboard-count,
   settings or connections queries.
6. `rag-chat` and `analysis-run-submit` reject an `ai_assistants` row whose
   `archived_at` is set.

## 6. Query filter matrix

| Query / handler | Change |
|-----------------|--------|
| `useAssistants` | `.is('archived_at', null)` |
| `useAssistantOptions` | `.is('archived_at', null)` |
| `useAssistant` (new chat / new analysis) | `.is('archived_at', null)` |
| `useLinkedAssistants` | drop rows whose `ai_assistants.archived_at` is set |
| `useDashboardCounts` (assistants) | `.is('archived_at', null)` |
| `useConversations`, `useConversation` | unchanged (history embeds keep working) |
| `platform-admin list_org_assistants` | `.is('archived_at', null)` |
| `platform-admin get_connections` / `save_connections` | catalogue `.is('archived_at', null)` |
| `platform-admin set_assistant_active` | update only rows with `archived_at IS NULL` |
| `platform-admin save_catalog_assistant` | reject an archived catalogue id |
| `rag-chat` | select `archived_at`; reject when set |
| `analysis-run-submit` | select `archived_at`; reject when set |

## 7. Migration and backfill

`024_assistant_archive.sql`:

1. `ALTER TABLE public.assistant_catalog ADD COLUMN archived_at timestamptz;`
2. `ALTER TABLE public.ai_assistants ADD COLUMN archived_at timestamptz;`
3. `CREATE INDEX ai_assistants_organization_archived_idx
   ON public.ai_assistants (organization_id, archived_at);`
4. Create the two RPCs and replace `platform_seed_org_assistants`.
5. Grant execute on the two new RPCs to `service_role` only.

No backfill: every existing row starts as available (`archived_at IS NULL`), which
matches the current behaviour. The migration is additive and can be rolled back by
dropping the columns and functions; no user data is removed.
