# Tasks: Kennisbronnenbeheer dat laat zien of een bron bruikbaar is

**Input**: Design documents from `/specs/016-knowledge-source-manageability/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — the technical route explicitly requests Playwright tests for confirmation, rename-lock, multi-upload and polling-stop.

**Organization**: Tasks are grouped by user story. Most stories touch `src/pages/KnowledgePage.tsx`, so story phases are sequential by priority even where the underlying data work is independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6 from `spec.md`
- Exact file paths are included in every task

## Path Conventions

Single web app: `src/`, `supabase/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test scaffold and baseline confirmation

- [ ] T001 [P] Create the E2E scaffold with reusable REST/edge mocks (`mockKnowledgeBases`, `mockDocuments`, `mockStats`, `mockDocumentWebhook`) in `tests/e2e/knowledge-source-manageability.spec.ts`
- [ ] T002 Confirm the branch is `016-knowledge-source-manageability` and capture a clean baseline with `npx tsc --noEmit` (no file changes; see `package.json`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and types that every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create `supabase/migrations/018_knowledge_source_manageability.sql` with: `error_message TEXT` on `knowledge_base_documents`, the `security_invoker` view `knowledge_base_stats`, `REVOKE ALL ... FROM anon`, and `GRANT SELECT ... TO authenticated` (see `data-model.md`)
- [ ] T004 [P] Update `src/types/database.types.ts`: add `error_message` to `knowledge_base_documents` Row/Insert/Update, add `Views.knowledge_base_stats`, and export the `KnowledgeBaseStats` alias
- [ ] T005 Apply the migration via Supabase MCP and verify `information_schema.columns` plus a `select * from knowledge_base_stats limit 5`; run `NOTIFY pgrst, 'reload schema'` (source: `supabase/migrations/018_knowledge_source_manageability.sql`)

**Checkpoint**: Migration applied, types compile, view reachable.

---

## Phase 3: User Story 1 — Kennisbronkaarten tonen of een bron bruikbaar is (Priority: P1) 🎯 MVP

**Goal**: Elke kaart toont documentaantal, foutenaantal en laatste wijziging zonder de bron te openen.

**Independent Test**: Open `/knowledge` met een lege, een volledig verwerkte en een deels mislukte bron; elke kaart toont de juiste aantallen en datum.

### Tests for User Story 1

- [ ] T006 [US1] Add E2E cases for card statistics (empty, all-ready, one-error) in `tests/e2e/knowledge-source-manageability.spec.ts`

### Implementation for User Story 1

- [ ] T007 [P] [US1] Add `useKnowledgeBaseStats(orgId)` reading `knowledge_base_stats` filtered on `organization_id` with key `['kb-stats', orgId]` in `src/hooks/queries.ts`
- [ ] T008 [US1] Merge stats into the card grid in `src/pages/KnowledgePage.tsx`: document count, error count with destructive accent, `last_updated_at` formatted `nl-NL`, and "Nog geen documenten" for empty sources (depends on T007)
- [ ] T009 [US1] Invalidate `['kb-stats', orgId]` after upload/delete/retry so cards stay accurate in `src/pages/KnowledgePage.tsx`

**Checkpoint**: US1 works independently and is demoable as the MVP.

---

## Phase 4: User Story 2 — Documentstatussen verversen vanzelf en fouten zijn herstelbaar (Priority: P1)

**Goal**: 5-second polling while any document is `processing`, stop automatically, and offer a working "Opnieuw verwerken" with reason.

**Independent Test**: Bring a document into processing; the list refreshes without reload, stops when done, and an error document shows "Fout", a reason (or the generic text) and a retry button that calls `document-webhook` with `action: 'index'`.

### Tests for User Story 2

- [ ] T010 [US2] Add E2E case proving polling stops: `processing` responses first, then `ready`; assert the REST call count stabilises after the interval in `tests/e2e/knowledge-source-manageability.spec.ts`
- [ ] T011 [US2] Add E2E case for a failed document: "Fout", the `error_message` (or generic text), and the retry button posting `{ document_id, action: 'index' }` in `tests/e2e/knowledge-source-manageability.spec.ts`

### Implementation for User Story 2

- [ ] T012 [US2] Add `refetchInterval` to `useKnowledgeBaseDocuments` in `src/hooks/queries.ts`: `5000` while any document is `processing`, else `false`; set `refetchIntervalInBackground: false`
- [ ] T013 [P] [US2] Add `retryDocument(documentId)` to `src/lib/storage.ts` that only calls `notifyDocumentWebhook(documentId, 'index')` (contract: `contracts/document-retry.md`)
- [ ] T014 [US2] Update `supabase/functions/document-webhook/index.ts` for `action === 'index'`: read `profiles.organization_id, role`, return `403 FORBIDDEN` for non-admins, set `status='processing'`/`error_message=null` with the service role before the n8n call, and set `status='error'` plus the Dutch error text when a pre-call or upstream step fails
- [ ] T015 [US2] Deploy the updated `supabase/functions/document-webhook/index.ts` via Supabase MCP and verify an admin retry and a member retry (member must be refused)
- [ ] T016 [US2] Update the document row in `src/pages/KnowledgePage.tsx`: "Fout" label, `error_message` or the generic text "De verwerking is mislukt. Probeer het opnieuw of neem contact op met de beheerder.", and an admin-only "Opnieuw verwerken" button that calls `retryDocument`, shows a Dutch toast on failure, and invalidates docs + stats on success (depends on T012, T013, T015)

**Checkpoint**: US2 works independently; polling starts and stops, retry round-trips through the server route.

---

## Phase 5: User Story 3 — Verwijderen vraagt om bevestiging (Priority: P1)

**Goal**: Document and knowledge-item deletion always asks for confirmation with the item name.

**Independent Test**: Click delete on a document: a dialog shows its name; cancel keeps it, confirm deletes only that item. The same dialog protects knowledge-item deletion.

### Tests for User Story 3

- [ ] T017 [US3] Add E2E case: delete opens a confirmation containing the document name; cancel does not call DELETE; confirm calls DELETE in `tests/e2e/knowledge-source-manageability.spec.ts`

### Implementation for User Story 3

- [ ] T018 [US3] Add local `pendingDelete` state and a nested confirm `Dialog` (feature C pattern) in `src/pages/KnowledgePage.tsx`, wired to both document and knowledge-item deletion with "Annuleren" autofocus and Dutch u-vorm copy

**Checkpoint**: US3 works independently and is keyboard-operable.

---

## Phase 6: User Story 4 — Naam van een gebruikte kennisbron is vergrendeld (Priority: P1)

**Goal**: The name field is disabled with an explanation while the knowledge source contains documents; editable again at zero documents.

**Independent Test**: Edit a source with documents: name disabled and helper text shown. Edit an empty source: name editable and saves.

### Tests for User Story 4

- [ ] T019 [US4] Add E2E case: the name input is disabled and the helper text is visible when the mocked document list is non-empty in `tests/e2e/knowledge-source-manageability.spec.ts`

### Implementation for User Story 4

- [ ] T020 [US4] In `KBMappingModal` inside `src/pages/KnowledgePage.tsx`, read documents via `useKnowledgeBaseDocuments(kb?.id)` for edit mode, disable the name input when the list is loading or non-empty, and render the exact helper text from the plan; keep the field editable for zero documents and create mode

**Checkpoint**: US4 works independently.

---

## Phase 7: User Story 5 — Meerdere bestanden tegelijk uploaden (Priority: P2)

**Goal**: Multi-select and drag-and-drop uploads with per-file progress and result.

**Independent Test**: Select three files at once and drop two files: each shows its own "Wachten"/"Uploaden..."/"Klaar"/"Fout" status; one failure does not block the others.

### Tests for User Story 5

- [ ] T021 [US5] Add E2E case: `setInputFiles` with multiple files shows per-file statuses, one invalid file shows an error while valid files complete, and each success posts to `document-webhook` in `tests/e2e/knowledge-source-manageability.spec.ts`

### Implementation for User Story 5

- [ ] T022 [US5] Implement the upload queue in `src/pages/KnowledgePage.tsx`: `input multiple`, a focusable "Bestanden toevoegen" button that opens the picker, a drag-and-drop zone, per-file extension validation, sequential `uploadDocument` calls, and a status list with `aria-live="polite"` (depends on T009)

**Checkpoint**: US5 works independently and keeps the button as the keyboard alternative.

---

## Phase 8: User Story 6 — Overbodige velden en tabblad verdwijnen uit de UI (Priority: P2)

**Goal**: Vector Collection ID and Kennisitems disappear from the UI while data and payload remain.

**Independent Test**: Open create/edit and the detail panel: neither the Vector Collection ID field/help nor the Kennisitems tab is rendered; existing rows and payloads are unchanged.

### Tests for User Story 6

- [ ] T023 [US6] Add E2E assertions that the "Vector Collection ID" field, its Pinecone help text and the "Kennisitems" tab are absent in `tests/e2e/knowledge-source-manageability.spec.ts`

### Implementation for User Story 6

- [ ] T024 [US6] Remove the Vector Collection ID field and help text from `KBMappingModal` in `src/pages/KnowledgePage.tsx` while keeping `vectorCollectionId` state and the `vector_collection_id` payload
- [ ] T025 [US6] Stop rendering the Kennisitems tab button and panel in `src/pages/KnowledgePage.tsx`; keep the `useKnowledgeItems` hook, the add/delete handlers and the `'items'` state branch in the file
- [ ] T026 [P] [US6] Add a note to `FEATURES.md` that the Kennisitems tab is hidden since feature 016 and that its data and code remain

**Checkpoint**: US6 works independently; no data is removed.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, regression, documentation

- [ ] T027 [P] Run `npx tsc --noEmit` and fix any type errors from the new column/view in `src/types/database.types.ts`
- [ ] T028 [P] Run `npx eslint src/ --max-warnings 0` and fix any findings in `src/pages/KnowledgePage.tsx`, `src/hooks/queries.ts`, `src/lib/storage.ts`
- [ ] T029 Run `npm run build` (per `package.json`)
- [ ] T030 Run `npx playwright test tests/e2e/knowledge-source-manageability.spec.ts` and the existing regression suite (`npx playwright test`)
- [ ] T031 Review the diff for no new npm dependencies in `package.json`, no client content in URLs/logs/PostHog/storage, and admin-only actions; update the "Gap" line for document polling in `FEATURES.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — blocks all stories
- **User Stories (Phase 3–8)**: Depend on Foundational
  - Data work can be parallel, but UI work is sequential because it edits `src/pages/KnowledgePage.tsx`
  - Priority order: US1 → US2 → US3 → US4 → US5 → US6
- **Polish (Phase 9)**: Depends on all implemented stories

### User Story Dependencies

- **US1**: after Phase 2; no other story dependency
- **US2**: after Phase 2; depends on the migration for `error_message` and the deployed edge function
- **US3**: after Phase 2; independent of other stories (same page file)
- **US4**: after Phase 2; independent (same page file)
- **US5**: after Phase 2; reuses `uploadDocument`, independent of stats/retry
- **US6**: after Phase 2; independent (same page file)

### Within Each User Story

- Tests first, then implementation, per the requested Playwright coverage
- Hooks/contracts before UI wiring
- Server status transitions before the retry button
- Story validated before moving to the next priority

### Parallel Opportunities

- T001 and T002 (scaffold + baseline) can run together
- T003 (migration) and T004 (types) can run in parallel
- T007 (stats hook), T013 (retry client), T024 (vector field removal) and T026 (FEATURES note) are separate files and can run in parallel
- After foundational: US1 data hook, US2 server work and US5 upload logic could be developed in parallel by different people, but merging into `KnowledgePage.tsx` must be sequenced
- Polish gates T027/T028 can run in parallel

---

## Parallel Example: Foundational + US1/US2 data layer

```bash
# Different files, no dependency:
Task: "Create migration 018 in supabase/migrations/018_knowledge_source_manageability.sql"
Task: "Add error_message and knowledge_base_stats to src/types/database.types.ts"

# After migration/types:
Task: "Add useKnowledgeBaseStats in src/hooks/queries.ts"
Task: "Add retryDocument in src/lib/storage.ts"
Task: "Remove Vector Collection ID field in src/pages/KnowledgePage.tsx"
Task: "Note hidden Kennisitems tab in FEATURES.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (migration + types)
3. Complete Phase 3: US1 card statistics
4. **STOP and VALIDATE**: `/knowledge` shows usable-at-a-glance cards
5. Deploy/demo

### Incremental Delivery

1. Foundational → US1 (cards) → validate → deploy
2. US2 (polling + retry) → validate → deploy
3. US3 (confirmation) → validate
4. US4 (rename lock) → validate
5. US5 (multi-upload) → validate
6. US6 (UI cleanup) → validate
7. Polish gates → commit per conventional message

### Notes

- Every implementation task touches an existing file; no new components or dependencies
- `document-webhook` must be deployed before the retry button is exercised against the real backend
- Tests mock Supabase REST and the edge function; only login is real
- Commit after each story checkpoint with `feat(knowledge): ...` / `test(knowledge): ...`
