# Research: Assistenten verwijderen uit de AI-assistentenlijst

**Feature**: `023-delete-assistants` | **Date**: 2026-11-06

This document records the technical decisions behind the plan. The specification
and the user's clarification (delete = archive, history stays readable) are the
source of truth for behaviour.

## 1. Delete versus archive

**Decision**: Deleting an assistant archives it. The platform admin sees the
action as "Verwijderen"; the assistant disappears from every user-facing offer
and can be restored from an archive list.

**Rationale**: `conversations.assistant_id` and `analysis_runs.assistant_id`
reference `ai_assistants` without `ON DELETE`; those rows also carry conversation
history, feedback and knowledge-source links. The user explicitly chose to keep
that history readable. A hard delete would either fail on the foreign key, require
destructive cascades, or leave orphan history. Archiving is additive, reversible
and keeps the existing foreign keys intact.

**Alternatives considered**:

- Hard delete with `ON DELETE CASCADE` on conversations/analysis runs: rejected
  because it destroys client history for every organisation and is irreversible.
- Hard delete while keeping detached history: rejected because it requires making
  `catalog_id` nullable and leaves invisible orphan rows with no restore path.
- Per-organisation delete: rejected because the page is the platform-wide
  catalogue; per-organisation hiding already exists as the Settings switch.

## 2. Where the archive state lives

**Decision**: Add `archived_at timestamptz` to both `assistant_catalog` (source of
truth, including the deletion date shown in the archive) and `ai_assistants`
(denormalised read flag for per-organisation queries). Both are written together
by one transaction-safe database function.

**Rationale**:

- Client list queries (`useAssistants`, `useAssistantOptions`, `useAssistant`,
  dashboard counts) can filter on a single column of the table they already read;
  no joins or PostgREST embedded filters are needed.
- Conversation and history queries keep embedding `ai_assistants(name, icon)`
  unchanged, so existing conversations stay readable with the correct name/icon.
- The archive list needs the catalogue definition and the deletion date; that lives
  in `assistant_catalog`.
- New organisations must not receive archived assistants. The existing
  `platform_seed_org_assistants` reads `assistant_catalog`, so it can filter on
  `archived_at IS NULL` directly.

**Alternatives considered**:

- Archive state only on `assistant_catalog`, filtering every client query through
  an embedded `assistant_catalog!inner(archived_at)` filter: rejected because it
  changes many query shapes, forces TypeScript changes, and risks breaking history
  embeds.
- Archive state only on `ai_assistants`, deriving the archive list by grouping
  rows: rejected because `create-tenant` seeding and the connection list read the
  catalogue, and grouping would need extra RPC logic.
- A separate `archived_assistants` table: rejected as more moving parts with no
  benefit over a nullable timestamp.

## 3. No RLS policy change

**Decision**: Keep the existing RLS policies. Archived rows remain selectable by
the organisation, exactly like switched-off assistants today; the UI queries and
the server enforce that archived assistants are not offered or usable.

**Rationale**: Hiding archived rows in RLS would also hide them from the embedded
`ai_assistants` select in conversation and history queries, turning the assistant
name/icon into `null` for old conversations. The project already relies on
query-level filtering for the existing `is_active` switch (non-admins receive
inactive rows and the page filters them). Server-side checks in `rag-chat` and
`analysis-run-submit` prevent actual use, so the security boundary does not depend
on the client filter.

**Alternatives considered**:

- RLS policy `archived_at IS NULL OR EXISTS (own conversation)`: rejected as
  complex, slow per row, and still not a real security boundary.
- Denormalising assistant name/icon into conversations so RLS can hide archived
  rows: rejected as a schema change with no user-visible benefit.

## 4. Atomic archive and restore

**Decision**: Two `SECURITY DEFINER` functions, executable only by
`service_role`:

- `platform_archive_catalog_assistant(p_id uuid)` sets
  `assistant_catalog.archived_at = now()` and the same timestamp on every
  `ai_assistants` row of that catalogue item. It does not touch conversations,
  messages, feedback, analysis runs or knowledge-source links.
- `platform_restore_catalog_assistant(p_id uuid, p_actor uuid)` clears both
  timestamps, preserves every per-organisation `is_active` value, and inserts a
  row with `is_active = false` for organisations created after the archive.

Both use a guarded `UPDATE ... RETURNING`, so two concurrent calls cannot both
succeed. Error codes are `not_found`, `already_archived` and `not_archived`.

**Rationale**: A single database transaction guarantees the "all-or-nothing"
requirement (FR-011, FR-023) and avoids a partially archived catalogue if the
Edge Function is interrupted. The service-role grant matches the existing
`platform_save_catalog_assistant` and `platform_seed_org_assistants` pattern.

**Alternatives considered**:

- Multiple PostgREST calls from the Edge Function: rejected because a failure
  halfway leaves the catalogue and the per-organisation rows out of sync.
- A trigger on `assistant_catalog` to mirror `archived_at`: rejected as implicit
  behaviour that is harder to reason about and test than an explicit function.

## 5. Archive list through the platform-admin Edge Function

**Decision**: Add `list_archived_assistants`, `archive_catalog_assistant` and
`restore_catalog_assistant` actions to the existing `platform-admin` function.
All three verify the caller's JWT and `is_platform_admin()` before doing anything.

**Rationale**: `assistant_catalog` has RLS enabled with all grants revoked from
`anon` and `authenticated`, so the browser cannot read it. Every other catalogue
operation already goes through this function. Reusing it keeps one contract, one
CORS policy, one error shape and one authorization check.

**Alternatives considered**:

- A new Edge Function: rejected as duplicate infrastructure.
- Granting the platform admin a SELECT policy on `assistant_catalog`: rejected
  because it would widen the table's exposure for every authenticated user and
  break the current "server-only catalogue" boundary.

## 6. Server-side usability checks

**Decision**: Extend the existing assistant lookups:

- `rag-chat`: select `archived_at` and reject when it is set (existing `FORBIDDEN`
  path).
- `analysis-run-submit`: same, in addition to the existing active/type/organisation
  checks.
- `platform-admin`: `list_org_assistants`, `get_connections`, `save_connections`
  and `set_assistant_active` exclude archived rows; `save_catalog_assistant`
  rejects an archived catalogue id.

**Rationale**: The archive must be usable-proof even when a user keeps an old chat
open or calls an Edge Function directly. This satisfies FR-006/FR-007 without
adding client-only checks.

## 7. UI structure and accessibility

**Decision**: Add a destructive icon button on every assistant card for the
platform admin, plus an "Archief" button in the page header. Two focused
components under `src/components/assistants/`:

- `DeleteAssistantDialog`: confirmation with a warning, "Annuleren" first (so it
  receives the initial focus), "Verwijderen" second, disabled while saving.
- `ArchiveDialog`: loading, error, empty and list states; one "Herstellen" button
  per row with an accessible name; the deletion date in Dutch format.

Extend the shared `Dialog` component to remember the element that opened it and
return focus to that element when it is still in the document (WCAG 2.1 AA,
FR-002/SC-005). Record the opener once per open transition, not on every render,
and give both new dialogs a stable `onOpenChange` (a state setter) so re-renders do
not move focus back to the first control. After a successful deletion the
triggering card no longer exists, so the page moves focus to the "Archief" button.

**Rationale**: The current `Dialog` focuses the first control but does not restore
focus on close, which would fail the new keyboard acceptance scenario. Fixing it
in the shared component benefits every dialog and avoids per-dialog duplicate
logic. The two components keep `AssistantsPage.tsx` readable; the repo already
groups feature components (`analysis/`, `settings/`, `team/`).

**Alternatives considered**:

- Inline dialogs in `AssistantsPage.tsx` (the existing `AssistantModal` style):
  rejected because the page would grow by roughly 150 lines and the delete flow
  needs its own state.
- A separate `/assistants/archive` route: rejected by the spec assumption that the
  archive is part of the AI-assistenten page.

## 8. Testing strategy

**Decision**:

- Playwright `tests/e2e/assistant-archive.spec.ts` mocks the platform-admin
  function and the `ai_assistants` REST response, so the UI flows (delete button,
  confirmation, cancel, archive list, restore, no controls for office admins) run
  without touching production data. This follows the precedent of
  `analysis-server-route.spec.ts`.
- Real database and authorization checks are manual quickstart steps with SQL
  counts and direct function calls (401/403), as with feature 021.
- `tsc --noEmit`, ESLint and the production build must pass.

**Rationale**: A real archive/restore test would temporarily hide a production
assistant from every organisation. Mocking keeps the regression suite
deterministic while the destructive path is verified deliberately in the
quickstart.

## 9. Migration and type strategy

**Decision**: One additive migration `supabase/migrations/025_assistant_archive.sql`
(columns, index, two RPCs, replaced seed function). Add `archived_at` to the
`ai_assistants` `Row`, `Insert` and `Update` types in
`src/types/database.types.ts` by hand, because that file predates migration 021 and
a full regeneration would introduce unrelated catalogue/platform tables in this
feature's diff. No `assistant_catalog` type is needed: the archive list is typed in
`platform-admin-client.ts`.

**Rationale**: The migration is backward compatible and needs no backfill (all
rows start with `archived_at = NULL`). The type change is the minimum needed for
the new column; a full regeneration is a separate cleanup task.

**Alternatives considered**:

- Full `supabase gen types` regeneration: rejected for this feature because it
  would produce a large unrelated diff and is better done as its own chore.
- No type change: rejected because `AIAssistant` would not expose `archived_at`,
  and filtering on it would require casts.
