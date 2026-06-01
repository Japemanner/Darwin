# Tasks: RAG Assistant Management

**Input**: Design documents from `/specs/002-rag-assistant-management/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Geen test-tasks — tests niet expliciet aangevraagd in spec. Worden na implementatie via Playwright MCP toegevoegd per AGENTS.md workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database migration and type definitions — blocks ALL user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T001 Create migration file `supabase/migrations/002_rag_assistant_management.sql` with ALTER TABLE ai_assistants (add type, make n8n_webhook_url nullable), ALTER TABLE knowledge_bases (add vector_collection_id), ALTER TABLE messages (add sources JSONB), CREATE TABLE flow_configs with RLS policies and trigger, CREATE TABLE knowledge_items with RLS policies and trigger
- [ ] T002 [P] Update `src/types/database.types.ts`: add `type` to ai_assistants, `vector_collection_id` to knowledge_bases, `sources` to messages, new `flow_configs` table entry, new `knowledge_items` table entry, export new types `FlowConfig` and `KnowledgeItem`

**Checkpoint**: Database migration ready, TypeScript types aligned — user story implementation can now begin

---

## Phase 2: User Story 2 — Kennisbronnen en Kennisitems Beheren (Priority: P1) 🎯 MVP

**Goal**: Gebruikers kunnen text-based kennisitems toevoegen aan kennisbronnen, met title/content/source_url, embedding status tracking, en beheer via een nieuwe UI tab.

**Independent Test**: Maak een kennisitem aan, verifieer status "pending", bekijk de lijst, verwijder het item.

### Implementation for User Story 2

- [ ] T003 [P] [US2] Create `src/lib/webhook.ts`: implement `encryptToken()` and `decryptToken()` using Web Crypto API AES-256-GCM with `VITE_ENCRYPTION_KEY`
- [ ] T004 [US2] Add `vector_collection_id` field to `KBMappingModal` in `src/pages/KnowledgePage.tsx` — add form field for vector collection ID when creating/editing knowledge bases
- [ ] T005 [US2] Add "Kennisitems" tab to `KBSlideOver` in `src/pages/KnowledgePage.tsx` — third tab with form (title + content textarea + source_url) + list of existing items with embedding_status badge + delete button
- [ ] T006 [US2] Import necessary types and icons in `src/pages/KnowledgePage.tsx`: `FileText` for tab, `Link` icon for source_url, embedding status badge colors

**Checkpoint**: Kennisitems CRUD werkt — text-based items toegevoegd naast bestaande file-uploads

---

## Phase 3: User Story 1 — Chat Assistant Aanmaken en Gebruiken (Priority: P1) 🎯 MVP

**Goal**: Assistant modal met KB multi-select, ChatWindow gebruikt centrale webhook helper met gestandaardiseerde payload, sources worden getoond en opgeslagen.

**Independent Test**: Maak assistant met KB-koppeling aan, stuur chat bericht, ontvang antwoord met sources, zie bronverwijzingen onder antwoord.

### Implementation for User Story 1

- [ ] T007 [US1] Implement `callRagWebhook()` in `src/lib/webhook.ts`: load FlowConfig, resolve knowledge_bases via junction table, load conversation history (last 20), decrypt token, build payload, POST with Bearer auth, parse response (answer/sources), handle timeout (30s) and errors
- [ ] T008 [P] [US1] Add KB multi-select to `AssistantModal` in `src/pages/AssistantsPage.tsx`: fetch all knowledge_bases, render multi-select (checkboxes), on save write to `assistant_knowledge_bases` junction table
- [ ] T009 [P] [US1] Add `type` selector to `AssistantModal` in `src/pages/AssistantsPage.tsx`: replace/nest to webhook URL field with type dropdown ('chat'/'agent'/'voice'), keep n8n_webhook_url for legacy but make optional
- [ ] T010 [US1] Refactor `ChatWindow` `initChat()` in `src/pages/AssistantsPage.tsx`: on open, load linked KBs via `assistant_knowledge_bases` junction + `knowledge_bases` table, store for later use in webhook payload
- [ ] T011 [US1] Refactor `ChatWindow` `handleSend()` in `src/pages/AssistantsPage.tsx`: replace direct fetch with `callRagWebhook()`, handle response with `answer` + `sources`, save `sources` JSONB to messages table, implement 30s timeout error message, truncate history to last 20 messages
- [ ] T012 [US1] Add collapsible sources section to `ChatWindow` messages in `src/pages/AssistantsPage.tsx`: below assistant messages, show "Bronnen (N)" toggle button, expand to list title/excerpt/score, handle no-sources case (don't render section)

**Checkpoint**: Chat werkt via FlowConfig — webhook payload correct, sources zichtbaar, KB-koppeling functioneel

---

## Phase 4: User Story 3 — Gesprekshistorie Bekijken en Hergebruiken (Priority: P2)

**Goal**: Bestaande gesprekshistorie functionaliteit is al aanwezig — verificatie dat nieuwe sources veld correct wordt opgeslagen en getoond bij het heropenen van gesprekken.

**Independent Test**: Voer een gesprek, sluit chat, open opnieuw — alle berichten en sources intact.

### Implementation for User Story 3

- [ ] T013 [US3] Verify `ChatWindow` `initChat()` in `src/pages/AssistantsPage.tsx` correctly loads stored messages including `sources` field for assistant messages — existing code loads messages via `supabase.from('messages').select('*')` which now includes sources

**Checkpoint**: Historie met sources werkt — geen code-wijziging nodig, alleen verificatie

---

## Phase 5: User Story 4 — FlowConfig Instellen als Beheerder (Priority: P2)

**Goal**: Admin-only settings pagina voor het centraal beheren van de N8N webhook configuratie per flow_type. Token encrypted opgeslagen.

**Independent Test**: Als admin FlowConfig invullen en opslaan, GET toont gemaskeerd token, chat gebruikt de configuratie.

### Implementation for User Story 4

- [ ] T014 [US4] Create `src/pages/SettingsPage.tsx`: admin-only page with form showing current `flow_configs` for `rag_chat` — webhook_url visible, webhook_token masked (placeholder text), encrypt token before save via `encryptToken()`, use toast for success/error, handle empty state (no config yet)
- [ ] T015 [US4] Add `/settings` route in `src/App.tsx`: lazy import `SettingsPage`, add `<Route path="/settings" element={<SettingsPage />} />` inside ProtectedRoute > AppShell
- [ ] T016 [P] [US4] Add "Instellingen" nav item in `src/components/layout/AppShell.tsx`: import `Settings` from lucide-react, add `{ href: '/settings', label: 'Instellingen', icon: Settings }` to navItems, filter admin-only (same pattern as Team)

**Checkpoint**: FlowConfig centraal beheerbaar via settings pagina — admin kan URL + token configureren

---

## Phase 6: User Story 5 — Bronnen Weergeven bij Antwoord (Priority: P3)

**Goal**: Bronverwijzingen onder assistant antwoorden zijn uitklapbaar, met titel/excerpt/score. Al geïmplementeerd in T012 — alleen styling verificatie.

**Independent Test**: Chat bericht met sources, klik op "Bronnen (N)", zie uitgeklapte lijst.

### Implementation for User Story 5

- [ ] T017 [US5] Verify collapsible sources section from T012 in `src/pages/AssistantsPage.tsx` — ensure proper styling: expand/collapse animation, excerpt truncation, score display as percentage, no sources = no section rendered

**Checkpoint**: Bronverwijzingen UI afgerond — uitklapbaar, correct gestyled, conditioneel weergegeven

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Compilatie verificatie, edge cases, quickstart validatie

- [ ] T018 Run `tsc --noEmit` to verify TypeScript compilation across all modified files
- [ ] T019 Verify backward compatibility: legacy assistants with `n8n_webhook_url` still work as fallback when no FlowConfig exists
- [ ] T020 Validate against quickstart.md: create assistant with KB, add knowledge item, configure FlowConfig, send chat message, verify sources display

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 → T002 (sequential — types depend on migration)
- **User Story 2 (Phase 2)**: Depends on Phase 1. T003 (webhook.ts encryptie) can start in parallel with T004/T005 (KnowledgePage.tsx changes). T006 is a small final integration step on KnowledgePage.tsx.
- **User Story 1 (Phase 3)**: Depends on Phase 1 (types) + Phase 2 (webhook.ts encrypt functions). T008/T009 can run in parallel (different fields in same modal). T010-T012 are sequential within same ChatWindow function.
- **User Story 3 (Phase 4)**: Verification only — no code changes, can run any time after Phase 3.
- **User Story 4 (Phase 5)**: Depends on Phase 1 (types) + Phase 2 (encryptToken in webhook.ts). T015/T016 can run in parallel with T014.
- **User Story 5 (Phase 6)**: Verification of T012 — can run immediately after Phase 3.
- **Polish (Phase 7)**: After all user stories complete.

### User Story Dependencies

- **User Story 2 (P1)**: Can start after Phase 1 — no dependencies on US1
- **User Story 1 (P1)**: Depends on US2 for `webhook.ts` encrypt functions
- **User Story 3 (P2)**: Verification only — no code changes
- **User Story 4 (P2)**: Depends on US2 for `encryptToken` in `webhook.ts`
- **User Story 5 (P3)**: Verification of US1 output

### Within Each User Story

- Types/utilities before UI components
- Data access before presentation
- Core function before integration

### Parallel Opportunities

- T001 and T002: sequential (types depend on migration design)
- T003 (webhook.ts) can run parallel with T004+T005 (KnowledgePage.tsx) — different files
- T008 and T009: parallel — different fields in modal
- T014 (SettingsPage.tsx) can run parallel with T015+T016 (App.tsx + AppShell.tsx) — different files
- T017 and T013: verification only — can run in parallel after US1/US2

---

## Parallel Example: Phase 2 + Phase 3

```bash
# Phase 2 (US2) — parallel binnen eigen scope:
Task T003: "Create webhook.ts encrypt/decrypt" (parallel met T004/T005)
Task T004: "Add vector_collection_id to KBMappingModal" (parallel met T003)
Task T005: "Add Kennisitems tab to KBSlideOver" (na T004 — zelfde file)
Task T006: "Import types/icons in KnowledgePage.tsx" (na T005)

# Phase 3 (US1) — start parallel met Phase 2 finalisatie:
Task T008: "KB multi-select in AssistantModal" (parallel met T009)
Task T009: "Type selector in AssistantModal" (parallel met T008)
Task T007: "Implement callRagWebhook" (na T003 encryptie functies)
Task T010: "InitChat load KBs" (na T007)
Task T011: "HandleSend refactor" (na T007 + T010)
Task T012: "Sources collapsible section" (na T011)
```

---

## Implementation Strategy

### MVP First (User Stories 2 + 1)

1. Phase 1: T001 → T002 (database + types)
2. Phase 2: T003 → T004 → T005 → T006 (kennisitems UI)
3. Phase 3: T007 → T008 + T009 → T010 → T011 → T012 (chat refactor)
4. **STOP and VALIDATE**: Chat werkt via FlowConfig, sources zichtbaar, kennisitems werkend

### Incremental Delivery

1. Setup → database ready, types aligned
2. User Story 2 → text-based kennisitems werkend (MVP part 1)
3. User Story 1 → chat met RAG + sources (MVP part 2)
4. User Story 4 → admin settings pagina
5. User Story 3 + 5 → verification
6. Polish → compile check + quickstart

### Parallel Team Strategy

With multiple developers:
1. Team completes Phase 1 together
2. Developer A: Phase 2 (KnowledgePage.tsx + webhook.ts encrypt)
3. Developer B: Phase 3 (AssistantsPage.tsx) — starts after T003 encrypt done
4. Developer A: Phase 5 (SettingsPage.tsx + App.tsx + AppShell.tsx) after Phase 2
5. Verification phases (US3, US5) run after respective phases

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- US3 and US5 are verification-only — no new code written
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Never expose `webhook_token` in GET responses — always mask with placeholder
- Legacy backward compat: `n8n_webhook_url` remains nullable, fallback in webhook.ts when no FlowConfig
