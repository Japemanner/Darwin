# Implementation Plan: Eenduidige Nederlandse UI-taal en navigatie

**Branch**: `017-dutch-ui-language` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-dutch-ui-language/spec.md`

## Summary

All user-facing copy in the app is brought in line with Constitution I: Dutch, formal
"u" form, no English words outside an agreed allowlist (Darwin, n8n, AI, webhook, URL,
token, CORS, header, PDF, DOCX, plus literal n8n interface labels). Role values
(`admin` / `member`) keep their stored values but are displayed as "Beheerder" /
"Adviseur" through one shared label map. The Roadmap entry leaves the main navigation
and moves into the sidebar's bottom user block as "Ideeën en wensen"; the `/roadmap`
route and page content stay where they are. The work is text-only plus one menu
position change: no behaviour, routes, permissions, data, or layout refactors.

The delivery order is fixed by the approved technical route: (1) produce a complete
old → new copy inventory in `specs/017-dutch-ui-language/copy-inventory.md` and stop
for Jaap's approval, (2) apply the approved rows file by file, (3) add the shared role
label map, (4) move the menu entry, (5) update/add the Playwright coverage.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict, `noUncheckedIndexedAccess`), React 18.3, Vite 6

**Primary Dependencies**: react-router-dom 6.28, zustand 5, @tanstack/react-query 5, @supabase/supabase-js 2.49, Tailwind CSS 3.4, lucide-react 0.468. **No new dependencies.**

**Storage**: N/A — copy lives in source; no database or storage change, no schema change, no RLS change

**Testing**: `tsc --noEmit`, ESLint 9 (`--max-warnings 0`), `npm run build`, Playwright 1.64 (`@playwright/test`) with `scripts/mock-analysis-server.mjs`; existing specs in `tests/e2e/`

**Target Platform**: Browser SPA (Chromium e2e), deployed on Netlify; desktop sidebar (≥1024px) and mobile drawer

**Project Type**: Single frontend web application (`src/` + `tests/e2e/`)

**Performance Goals**: N/A — no runtime behaviour, data or rendering change; one extra static link in the sidebar

**Constraints**:
- No new npm dependencies, no refactors in touched files beyond the required import/role wiring and the menu move
- UI copy Dutch in the "u" form; code, identifiers, comments and commit messages stay English
- No client content in URLs, console, logs, PostHog or browser storage — the new link is a static `/roadmap` route, no query/state added
- Done = `tsc`, ESLint (`--max-warnings 0`), `npm run build` and the feature's Playwright tests green
- Inventory must be approved by Jaap before any source file is edited

**Scale/Scope**: ~22 source files with user-facing copy, 13 existing e2e specs + 1 new spec, 1 new module (`src/lib/labels.ts`), 1 documentation artifact (`copy-inventory.md`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principle | Assessment |
|------|-----------|------------|
| 1. Dutch UI copy in all user stories | I. Dutch UI, English Code | **PASS** — the feature exists to enforce "u"-form Dutch; every acceptance scenario quotes Dutch copy. English remains in code, identifiers and commits. |
| 2. Outputs labeled CONCEPT, no advisory wording | II. Concept, Never Advice | **PASS** — the CONCEPT label (`CONCEPT, door adviseur te accorderen`) is preserved verbatim; no new advisory wording is introduced by any rename. |
| 3. Client content never persists beyond the session | III. Client Data Sensitivity | **PASS** — no data flows change. The new sidebar entry is a static link to `/roadmap`; no client content enters URLs, analytics, logs or storage. Error-copy changes must not interpolate client content. |
| 4. Accessibility criteria defined per story | IV. WCAG 2.1 AA | **PASS** — the moved entry stays a real link with visible Dutch text and an accessible name; icon-only controls keep their Dutch `aria-label`; no truncation of the longer label in the 256px sidebar; keyboard order stays nav → user block. |
| 5. External calls via typed clients with visible errors | V. Typed External Clients, No Silent Failures | **PASS** — no external call is added or removed. Where an English external error message was displayed verbatim, it is replaced by Dutch copy while the existing visible error state (`role="alert"`, destructive toast) is preserved. |
| 6. Scope traced to spec only | VI. Minimal Scope | **PASS** — the change set is text, one label module, one menu entry position, and test updates. No i18n framework, no copy abstraction, no route or permission change, no dependency. |

Workflow gates (constitution "Development Workflow & Compliance Gates"): pre-commit
`tsc`, fitness check, Gitleaks and ESLint stay green; after the feature, FEATURES.md is
updated and the regression suite runs. No violation requires the Complexity Tracking
table.

**Post-Phase 1 re-check**: unchanged — the design adds no dependency, no data flow, no
new surface beyond a static link and a pure label map. **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/017-dutch-ui-language/
├── spec.md                  # Feature specification
├── plan.md                  # This file
├── research.md              # Phase 0 decisions (naming, labels, menu, tests)
├── data-model.md            # Copy inventory entry, role label, navigation entry
├── quickstart.md            # Validation and delivery runbook
├── copy-inventory.md        # Step 1 deliverable — prepared (Concept, 93 rows); BLOCKS implementation until approved
├── contracts/
│   ├── ui-copy.md           # Copy rules, terminology table, allowlist, inventory schema
│   ├── role-labels.md       # src/lib/labels.ts contract and consumers
│   └── navigation.md        # Sidebar contract: main nav vs user block
├── checklists/
│   └── requirements.md      # Spec quality checklist
└── tasks.md                 # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── labels.ts                    # NEW — role label map (Beheerder/Adviseur)
│   ├── analysis-client.ts           # copy: run → uitvoering
│   ├── rag-client.ts                # copy: assistant → assistent
│   ├── flow-config-client.ts        # copy review (already Dutch)
│   └── storage.ts                   # copy review (already Dutch)
├── components/
│   ├── layout/AppShell.tsx          # nav label Overzicht, Roadmap out of nav, user block link + role label
│   ├── auth/LoginPage.tsx           # u-form + Dutch auth error copy
│   ├── auth/ProtectedRoute.tsx      # u-form
│   ├── chat/ChatComposer.tsx        # review (already u-form)
│   ├── chat/*                       # review: AnswerMeta, MessageBubble, MessageList, ChatEmptyState, ChatHeader, AnswerFeedback
│   ├── analysis/AnalysisForm.tsx    # review
│   ├── analysis/RecentRunsPanel.tsx # copy: runs → uitvoeringen
│   ├── analysis/ResultView.tsx      # copy: run → uitvoering, run-metadata
│   └── analysis/RunCard.tsx         # review
└── pages/
    ├── CommandCenterPage.tsx        # Command Center → Overzicht, u-form
    ├── AssistantsPage.tsx           # u-form, AI-assistenten, conversaties → gesprekken
    ├── KnowledgePage.tsx            # review English loanwords, "vector database"
    ├── HistoryPage.tsx              # runs → gesprekken, u-form
    ├── RoadmapPage.tsx              # Ideeën en wensen, features/request → ideeën/wensen/verzoek
    ├── TeamPage.tsx                 # role labels via labels.ts
    ├── SettingsPage.tsx             # role labels via labels.ts, u-form, tenant/admin/assistant copy
    ├── ForgotPasswordPage.tsx       # u-form
    └── ResetPasswordPage.tsx        # u-form, reset-link → herstelkoppeling

tests/e2e/
├── sidebar-navigation.spec.ts       # NEW — sidebar labels and menu position (1 test)
└── admin-only-management.spec.ts    # +1 assertion: adviseur sees "Adviseur" in the user block
```

**Structure Decision**: single Vite/React frontend; copy is edited in place, one new
pure module under `src/lib/`, one new spec under `tests/e2e/`. No directory or routing
restructuring.

## Delivery Sequence (technical route, with approval gate)

### Step 1 — Copy inventory (blocking gate)

**Status 2026-10-30**: inventory prepared as `copy-inventory.md` — 93 rows in 13 files,
status Concept. Awaiting Jaap's approval; no source file has been edited.

Produce `specs/017-dutch-ui-language/copy-inventory.md` as
`| # | bestand | scherm/onderdeel | oud | nieuw |` plus a list of reviewed files with
no change. Coverage method:

1. Enumerate every user-facing string in `src/` with these searches
   (run from the repo root; `-i` where useful):
   - JSX text nodes: `>[^<>{}]*[A-Za-z][^<>{}]*<` in `src/**/*.tsx`
   - attributes: `placeholder=`, `aria-label=`, `title=`, `alt=`
   - feedback copy: `toast({`, `EmptyState`, `DialogTitle`, `Label htmlFor`
   - error/status copy: `src/lib/*.ts` text constants and `new Error(`, `message:`
2. Check every match against the rules in `contracts/ui-copy.md` (u-form, no "je/jij/
   jouw/jullie", no English outside the allowlist, one term per concept).
3. Fill one row per changed string, grouped per file; keep unchanged strings in the
   reviewed list so coverage is auditable.
4. **STOP** and request Jaap's approval of the inventory. No file under `src/` or
   `tests/` is edited before that approval. Rework requested at this gate is applied
   to the inventory only.

### Step 2 — Apply approved copy, file by file

- Edit only the approved strings; the diff of each file contains nothing else.
- Where a file also needs the role map or the menu move (AppShell, TeamPage,
  SettingsPage), that is the only structural change allowed in it.
- Do not rename files, components, props, routes, ids or CSS classes.
- Keep `CONCEPT, door adviseur te accorderen` and all `aria-label`s that are already
  Dutch unchanged.

### Step 3 — Shared role label map

`src/lib/labels.ts` (contract: `contracts/role-labels.md`):

```ts
export const ROLE_LABELS: Record<'admin' | 'member', string> = {
  admin: 'Beheerder',
  member: 'Adviseur',
}
export function roleLabel(role: string | null | undefined): string // 'Beheerder' | 'Adviseur' | 'Geen rol'
```

Consumers (exhaustive): `AppShell` (desktop and mobile user block), `TeamPage` (member
badges, invitation badges, invite role options), `SettingsPage` (tenant role options,
success toast wording, description). The stored role values and `database.types.ts`
stay untouched.

### Step 4 — Sidebar: Roadmap leaves the nav

`AppShell.tsx` (contract: `contracts/navigation.md`):

- Remove the `{ href: '/roadmap', label: 'Roadmap', ... }` entry from `navItems`.
- Rename the first item label to `Overzicht` (href stays `/command-center`).
- In the bottom user block of **both** the mobile drawer and the desktop `aside`, add a
  link to `/roadmap` labelled `Ideeën en wensen`, with the existing `Map` icon
  (`aria-hidden`), above the avatar row, visually separated by the existing border.
- Keep visibility unchanged (all authenticated users), keep the route in `App.tsx`
  untouched, keep the main-nav active-state styling unchanged for the remaining items.
- No active state is added to the new link (that would be new behaviour).

### Step 5 — Tests

- New `tests/e2e/sidebar-navigation.spec.ts` — exactly one test, using the `memberPage`
  fixture (real login, skips with a reason when credentials are absent):
  - the user block shows `Adviseur` and not `member`;
  - the main nav has no `Roadmap` link and still exposes Assistenten, Kennisbronnen,
    Geschiedenis (and no Team/Settings for this role);
  - `Ideeën en wensen` is not inside `nav`, is visible inside the `aside`, and opens
    `/roadmap` with the heading `Ideeën en wensen`.
- `admin-only-management.spec.ts`: add one assertion that the admin user block shows
  `Beheerder` (covers the admin side of the label map).
- Update any existing selector that points at changed copy; the audit below shows the
  current specs are mostly insulated, but the implementation must run the suite and fix
  real failures rather than pre-emptively rewriting selectors.

**Selector audit (before implementation)**

| Spec | Selection | Impact |
|------|-----------|--------|
| `analysis-run.spec.ts` | `/in wachtrij|bezig/`, `/klaar/`, `/beschikbaar tot/` | none — RunCard/ResultView statuses keep their words |
| `chat-page.spec.ts`, `rag-chat.spec.ts` | `Typ uw bericht.`, `Versturen`, `Opnieuw proberen` | none — already u-form |
| `knowledge-source-manageability.spec.ts` | document statuses, `Nog geen documenten`, `1 fout` | none — those strings stay (`Nog geen documenten` still matches as a substring) |
| `document-webhook.spec.ts` | `Document geüpload`, `Upload mislukt` | **2 selectors update** → `Document toegevoegd`, `Toevoegen mislukt` (inventory rows 21–22) |
| `admin-only-management.spec.ts` | `Start een gesprek met een assistent`, type labels, `Inactief` | none — unchanged copy; +1 new assertion |
| `flow-config.spec.ts` | `Webhook URL`, `Verbinding testen`, `webhook token` labels | none — labels stay allowlisted/unchanged |
| `answer-feedback.spec.ts`, `answer-presentation.spec.ts` | feedback and CONCEPT copy | none — unchanged |
| `analysis-form.spec.ts` | `Adviseur` form field label | none — that label is the form field, not the role badge |

## Phase 0 — Research

See [research.md](./research.md). Decisions: role label module and its consumers;
per-context run terminology; "Overzicht" naming; menu placement and markup in both
sidebar variants; Dutch handling of external error messages; test fixture strategy for
role coverage; inventory completeness method. No `NEEDS CLARIFICATION` remains — the
three naming questions were answered before the spec was written.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — copy inventory row, role label, navigation entry,
  plus validation rules from the functional requirements.
- [contracts/ui-copy.md](./contracts/ui-copy.md) — copy rules, allowlist, terminology
  table, inventory schema and approval gate.
- [contracts/role-labels.md](./contracts/role-labels.md) — `src/lib/labels.ts` API and
  the exhaustive consumer list.
- [contracts/navigation.md](./contracts/navigation.md) — main nav vs user block, both
  viewports, unchanged route and visibility.
- [quickstart.md](./quickstart.md) — inventory review, verification commands, test
  invocation, manual walkthrough.
- Agent context: `AGENTS.md` SPECKIT block points at this plan.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Copy drift between the approved inventory and the code | Acceptance criterion "inventory covers 100%" fails | Tasks are generated per inventory row or per file group; a final re-grep compares the app to the inventory; steekproef in quickstart |
| English error text from Supabase Auth stays visible | SC-002 fails | Fixed Dutch copy on login/forgot/reset paths; technical detail only in the existing `console.error` calls |
| Mobile drawer and desktop sidebar diverge | SC-004 fails on one viewport | Contract requires both; the new test asserts the desktop `aside`; the drawer is checked in the manual walkthrough |
| Longer labels clip the 256px sidebar | Constitution IV | Label is short (`Ideeën en wensen`, 18 chars) and uses the existing `text-sm` row; manual check at 1024px and 360px |
| Test suite needs credentials, so the new spec skips locally | "Tests green" is weaker than intended | Test follows the existing repo pattern (real login + skip reason); run with `E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD` for a real pass; note in the completion report |
| SettingsPage/Tenant copy hides more English than the inventory caught | SC-002 fails | Settings is read line by line during inventory (largest English cluster: n8n guide, tenant card, `Admin`, `tenant`, `assistants`) |

## Complexity Tracking

No constitution violations. The only new module is a pure label map required by
FR-005; no abstraction, configuration or dependency is added.
