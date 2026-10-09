# Tasks: Risico-analyse assistent UI

**Input**: Design documents from `/specs/008-risico-analyse-ui/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Explicitly requested — Playwright coverage for form validation, status transitions, source panel resolution, error and retry (per plan + spec).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root (per plan.md)

---

## Phase 1: Setup

**Purpose**: Project initialization and basic structure

- [ ] T001 Add `marked` dependency to package.json (`npm install marked`) — sole new dependency per plan.md R4; run `npm audit` + confirm no other deps pulled in
- [ ] T002 [P] Extend assistant type union `'risico_analyse'` in `src/types/database.types.ts` (`ai_assistants.type`) and add `{ value: 'risico_analyse', label: '📋 Risico-analyse' }` to ASSISTANT_TYPES in `src/pages/AssistantsPage.tsx`
- [ ] T003 [P] Add `VITE_ANALYSIS_API_URL` to `.env.example` (documented, no real value) and `.env.local` (local mock URL, gitignored) per plan.md

**Checkpoint**: dependencies + types ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create zod schemas in `src/lib/analysis-schemas.ts` per `contracts/analysis-schema.md`: `BronRefIdSchema` (`^[KRA][0-9]+$`), `BronRefSchema`, `OptieSchema`, `AnalysisResultSchema`, `RunStatusSchema`, `RunErrorSchema`; export inferred TS types
- [ ] T005 [P] Create mock analysis server `scripts/mock-analysis-server.mjs` per `contracts/run-status.md`: endpoints `POST /analysis-runs` (202 + run_id), `GET /analysis-runs/:run_id`, `GET /analysis-runs`; scenario switch rich/thin/error/slow; deterministic timelines for tests; fixtures contain no real client data
- [ ] T006 [P] Extend DOMPurify sanitizer in `src/lib/sanitize.ts` with `sanitizeMarkdown()`: `marked.parse` → `DOMPurify.sanitize` (ALLOWED_TAGS incl. `h4`, table tags; raw HTML stripped); add unit-level test cases in the file header docblock only (no test framework addition)
- [ ] T007 Create typed client `src/lib/analysis-client.ts` per `contracts/n8n-submit.md` + `contracts/run-status.md`: `submitAnalysisRun()` (multipart, maps 400/401/413/422/5xx/timeout to typed errors), `fetchAnalysisRun()`, `fetchRecentRuns()`; zod-validate responses; NEVER log client content (codes only); no silent failures
- [ ] T008 Create polling hook `src/hooks/useAnalysisRun.ts` (TanStack Query): refetchInterval 3s while queued/running, exponential backoff 6→12→24→30s max on connection errors, stop on succeeded/failed, explicit connection-error state and unknown-status error state per spec US2/US4

**Checkpoint**: schemas, mock, sanitizer, client and polling hook ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Analyse starten via invoerformulier (Priority: P1) 🎯 MVP

**Goal**: Adviseur vult het formulier, valideert en start de run (submit < 1 minuut)

**Independent Test**: Minimaal invullen (verplichte velden + één bronveld) → versturen → run-kaart verschijnt; lege groepsvalidatie → inline Nederlandse melding

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T009 [P] [US1] Playwright: form group validation in `tests/e2e/analysis-ui.spec.ts` — submit with all group fields empty shows inline "Vul minimaal één van Klantsituatie, Bestanden of URL's"-melding; https-only URL rejection; invalid file type/size rejection (per spec US1 scenario's 2-4)
- [ ] T010 [P] [US1] Playwright: happy path submit in `tests/e2e/analysis-ui.spec.ts` — minimal valid input submits, run card appears with "in wachtrij" (spec US1 scenario 1)

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create `AnalysisForm.tsx` in `src/components/analysis/`: react-hook-form + zod resolver per `data-model.md` form table; fields Verzekeringsvraagstuk, Kennisbronnen (multi-select via existing `useAssistantKBLinks` from `src/hooks/queries.ts`), Klantsituatie, Bestanden (pdf/docx/txt, ≤10 MB/file, ≤25 MB total, limits visible), URL's (add/remove, https-only), Klantreferentie, Adviseur (prefilled readonly from `useAuth`); all labels/copy Dutch formal; WCAG 2.1 AA (labels, aria-describedby for inline errors, keyboard operability)
- [ ] T012 [P] [US1] Create `AnalysisFlow.tsx` in `src/components/analysis/`: screen state machine (form → run → result) wired to `useAnalysisRun`; chat-style desktop-first layout per plan (form panel left, run/result right); routes contain UUIDs only — never klantreferentie or content
- [ ] T013 [US1] Wire `AnalysisFlow` into `src/pages/AssistantsPage.tsx`: assistant card with type `risico_analyse` opens AnalysisFlow (i.p.v. ChatWindow); card button label "Risico-analyse starten"
- [ ] T014 [US1] Submit integration: `AnalysisForm` → `submitAnalysisRun()` from `src/lib/analysis-client.ts` with run UUID from `crypto.randomUUID()`; generate `run_id` client-side; store retry snapshot in memory (React state only — no localStorage, constitution III); show explicit Dutch error toast + form-level error state on failure (no silent failures)

**Checkpoint**: US1 fully functional and independently testable — advisor can submit a valid run in under one minute

---

## Phase 4: User Story 2 — Run-status volgen en terugkeren (Priority: P2)

**Goal**: Statuskaart met verstreken tijd; navigeren weg/terug; recente runs per adviseur

**Independent Test**: Run starten → wegnavigeren → terugkeren: run staat in lijst recente runs met actuele status + verstreken tijd

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T015 [P] [US2] Playwright: status transitions in `tests/e2e/analysis-ui.spec.ts` — mock slow fixture: card shows "in wachtrij" → "bezig" with elapsed time; leaving page and returning (recent runs list) shows run with current status; deterministic mock timelines

### Implementation for User Story 2

- [ ] T016 [P] [US2] Create `RunCard.tsx` in `src/components/analysis/`: status badge (in wachtrij/bezig/klaar/mislukt per `RunStatusSchema`), elapsed time since `started_at` (updates every second while visible), Dutch labels; unknown status → explicit "onbekende status" error (edge case)
- [ ] T017 [P] [US2] Create recent runs list in `AnalysisFlow.tsx` (or `RecentRuns.tsx` in `src/components/analysis/`): `fetchRecentRuns()` (limit 10) via `src/hooks/queries.ts` pattern; labels = klantreferentie + starttijdstip ONLY (FR-017); click opens run state/result
- [ ] T018 [US2] Navigation resilience: returning to `/assistants/:id/runs/:runId` (UUID-only params) restores run card from `fetchAnalysisRun()`; connection loss shows explicit error state with retry (spec US4-3, never a silently frozen card)

**Checkpoint**: US1 + US2 independently functional

---

## Phase 5: User Story 3 — Resultatenweergave met bronnen en download (Priority: P3)

**Goal**: Gaps-checklist, vijf analyse-secties als gesanitiseerde markdown, klikbare bronverwijzingen met zijpaneel, .docx-download (CONCEPT-label), kopieerknop

**Independent Test**: Rich fixture openen: alle secties zichtbaar; elke K/R/A-verwijzing opent zijpaneel met document/locatie/passage; download levert .docx; klembord bevat interne tekst

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T019 [P] [US3] Playwright: result view renders all sections from rich fixture (gaps-checklist top, five sections in order, "intern, speculatief" marking, CONCEPT label) in `tests/e2e/analysis-ui.spec.ts` (SC-002)
- [ ] T020 [P] [US3] Playwright: source panel resolution — every reference in sample resolves to document/locatie/passage; missing reference shows explicit "Bron niet beschikbaar" (SC-003, FR-012)

### Implementation for User Story 3

- [ ] T021 [P] [US3] Create `GapsPanel.tsx` in `src/components/analysis/`: "Ontbrekende informatie voor het gesprek" as checklist-style panel from `result.lacunes`; accessible checkboxes
- [ ] T022 [P] [US3] Create `AnalysisMarkdown.tsx` in `src/components/analysis/`: renders `intern_markdown` via `sanitizeMarkdown()` from `src/lib/sanitize.ts`; section order risico's → dekking en restgat → draagkracht → opties met voor en tegen → interne signalen; "interne signalen" visibly marked "intern, speculatief"; `[K1]`-style references rendered as clickable buttons
- [ ] T023 [P] [US3] Create `SourcePanel.tsx` in `src/components/analysis/`: side panel showing document, locatie, letterlijke passage from `result.bronnen` by reference id; explicit Dutch message when id absent (edge case); keyboard accessible, focus management
- [ ] T024 [P] [US3] Create `ResultView.tsx` in `src/components/analysis/`: composes GapsPanel + AnalysisMarkdown + SourcePanel + actions; download button uses `dossier_docx_url` with visible label "CONCEPT, door adviseur te accorderen"; copy-to-clipboard button copies full internal text with success feedback; result shows retention notice (FR-021); expired result (no result after 7 days) shows explicit deletion notice (edge case)
- [ ] T025 [US3] Invalid-result handling: zod parse failure of result → explicit error state with code `INVALID_RESULT_SCHEMA` (contracts/analysis-schema.md) — never a partially rendered result

**Checkpoint**: All user stories independently functional

---

## Phase 6: User Story 4 — Foutafhandeling en opnieuw proberen (Priority: P4)

**Goal**: Duidelijke Nederlandse foutmelding met foutcode; "Opnieuw" prefills formulier met eerdere invoer

**Independent Test**: Error-fixture run openen: foutcode + melding zichtbaar; "Opnieuw" → formulier met alle eerdere waarden

### Tests for User Story 4

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T026 [P] [US4] Playwright: error and retry in `tests/e2e/analysis-ui.spec.ts` — error fixture shows Dutch message with error code and "Opnieuw" button; clicking "Opnieuw" opens form with all previously entered values prefilled (spec US4 scenario's 1-2)

### Implementation for User Story 4

- [ ] T027 [P] [US4] Extend `RunCard.tsx` with failed state: Dutch error message + error code + "Opnieuw" button; wires retry snapshot from in-memory store to AnalysisFlow form state (US1 T014)
- [ ] T028 [US4] Retry flow: "Opnieuw" reopens AnalysisForm prefilled with retry snapshot (all fields incl. file selection placeholder — note files cannot be re-selected programmatically; show Dutch notice to re-attach files, everything else prefilled); resubmit creates a NEW run_id

**Checkpoint**: All user stories (US1-US4) independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T029 Accessibility audit pass: keyboard operability across AnalysisFlow (form → run → result → source panel), focus traps in SourcePanel, aria-live on status changes, contrast check on status badges — WCAG 2.1 AA (FR-019)
- [ ] T030 [P] Console/URL privacy audit: verify no client content in console logs, routes, or PostHog events across analysis components (SC-004, constitution III); grep for console.log in `src/components/analysis/` + `src/lib/analysis-client.ts`
- [ ] T031 [P] Run quickstart.md validation: `node scripts/mock-analysis-server.mjs` + manual happy path per `specs/008-risico-analyse-ui/quickstart.md`; verify all 4 scenarios (rich/thin/error/slow)
- [ ] T032 [P] Copy review: all UI strings Dutch formal-professional, no advisory language anywhere, all outputs labeled CONCEPT (constitution I + II, SC-006)
- [ ] T033 Run `npx tsc --noEmit`, `npm run build`, and `npx eslint src/ --max-warnings 0`; fix findings
- [ ] T034 Update FEATURES.md with the Risico-analyse feature entry (@feature-tracker scope)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001 (marked) for T006; T004 before T007 (schemas before client); T005 independent — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Phase 2 completion
  - US1 (Phase 3) is the MVP — no other story blocks it
  - US2 (Phase 4) depends on US1 (run card needs a submitted run)
  - US3 (Phase 5) depends on US2 (result view needs status polling)
  - US4 (Phase 6) depends on US1 (retry needs form + submit)
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no other story dependency
- **US2 (P2)**: After US1 (submits produce runs to track); recent-runs list technically depends only on client/hook (T007/T008)
- **US3 (P3)**: After US2 (needs succeeded runs); components (T021-T025) only depend on schemas/sanitizer
- **US4 (P4)**: After US1 (retry reopens the form); failed state component work is parallelizable with US2/US3

### Within Each User Story

- Playwright tests first (fail), then implementation, then integration
- Components before integration into AnalysisFlow
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 1: T002 ∥ T003 (after T001)
- Phase 2: T005 ∥ T006 (independent files); T004 before T007 sequentially
- Phase 3: T009 ∥ T010 (same file, different describe blocks — sequential writes recommended); T011 ∥ T012 ∥ T016-T017 prep
- Phase 5: T021 ∥ T022 ∥ T023 ∥ T024 (separate component files — compose after)
- Phase 6: T027 parallel with US3 components (RunCard extension is separate file)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — advisor submits a validated run
4. **STOP and VALIDATE**: Playwright form tests green; manual happy path via mock
5. Demo-ready: formulier → run-kaart "in wachtrij"

### Incremental Delivery

1. Setup + Foundational → schemas, mock, client, polling ready
2. Add US1 → submit flow (MVP!)
3. Add US2 → status tracking + recent runs
4. Add US3 → result view with sources + download + clipboard
5. Add US4 → error + retry prefill
6. Polish → accessibility, privacy audit, copy review, build checks

### Definition of Done (per AGENTS.md)

Each phase: `npx tsc --noEmit` clean, Playwright tests green for the story, fitness checks pass, conventional commit (`feat(analysis): …`).

---

## Notes

- Mock-first: all run behavior against `scripts/mock-analysis-server.mjs` via `VITE_ANALYSIS_API_URL`; real Supabase backend follows contracts/ in a separate backend feature
- No client content in URLs, console, logs, or browser storage — in-memory retry only
- All UI copy Dutch formal-professional; code, identifiers, commit messages English
- Never display recommendations; all outputs labeled CONCEPT; "interne signalen" marked "intern, speculatief"