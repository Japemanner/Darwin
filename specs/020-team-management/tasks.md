---
description: "Task list for 020-team-management"
---

# Tasks: Teambeheer: uitnodigen, rol wijzigen en blokkeren

**Input**: Design documents from `specs/020-team-management/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/team-admin.md`, `contracts/team-db.md`, `contracts/auth-confirm.md`,
`quickstart.md`

**Tests**: Included because the spec's Definition of Done and the technical route
explicitly require Playwright tests and `scripts/rls-verify.mjs`.

**Organization**: Tasks are grouped by user story. Foundational work is shared;
each story has its own checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies).
- **[Story]**: US1–US9, matching `spec.md`.
- All paths are repository-relative.

## Path Conventions

Single Vite/React application with Supabase backend:

- `src/`, `supabase/functions/`, `supabase/migrations/`
- `tests/e2e/`, `scripts/`

---

## Phase 1: Setup

**Purpose**: Confirm the release preconditions and add the test configuration.

- [ ] T001 Confirm the 019 production deploy, Scaleway TEM SMTP, Site URL, invite template (`/auth/confirm`, `token_hash`, `type=invite`), 24-hour OTP expiry and the platform administrator. Stop and report if any is missing (`quickstart.md` §0).
- [ ] T002 [P] Add `E2E_BLOCK_TARGET_EMAIL`, `E2E_BLOCK_TARGET_PASSWORD` and `E2E_INVITE_EMAIL_BASE` with placeholder values and comments to `.env.example`; do not add real values.
- [ ] T003 [P] Confirm the branch is `020-team-management` and the working tree contains no unrelated edits before implementation starts.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The schema, helpers, typed client and shared UI/auth infrastructure that
every story depends on.

**⚠️ CRITICAL**: No user-story work can start until T004–T022 are complete.

### Database

- [ ] T004 Create `supabase/migrations/022_team_management.sql`: add `profiles.email` and `profiles.status`, backfill `email` from `auth.users`, set `email NOT NULL`, create the unique `lower(email)` index, and add the `set_profile_email` insert trigger.
- [ ] T005 In the same migration, replace `get_user_org_id()`, `is_org_admin()` and `is_platform_admin()` with the block-aware definitions and `SET search_path = public` (data-model §4).
- [ ] T006 In the same migration, drop and recreate the 30 policies from `research.md` §2 with `AND get_user_org_id() IS NOT NULL` in the relevant `USING`/`WITH CHECK` (data-model §7).
- [ ] T007 In the same migration, add `activate_own_profile()` with `REVOKE EXECUTE FROM PUBLIC, anon` and `GRANT EXECUTE TO authenticated` (data-model §5).
- [ ] T008 In the same migration, add `team_update_member(p_actor, p_org, p_target, p_role, p_status)` with the admin-row `FOR UPDATE` lock, actor/target/platform-admin/last-admin checks, `P0001` codes, and execute revoked from `PUBLIC, anon, authenticated` (data-model §6).
- [ ] T009 Run the preflight and migration verification in a transaction or Supabase branch: no profile without auth user, no auth user without profile, no organization without an admin, no duplicate `lower(email)`, all existing users `active`, no null email, the 30 policies contain the null check, and function privileges are correct (`quickstart.md` §1–§2). Do **not** apply to production yet.

### Shared frontend

- [ ] T010 [P] Add `email: string` and `status: 'invited' | 'active' | 'blocked'` to the `profiles` Row/Insert/Update types in `src/types/database.types.ts`.
- [ ] T011 [P] Add `STATUS_LABELS` and `statusLabel()` to `src/lib/labels.ts` (`Uitgenodigd`, `Actief`, `Geblokkeerd`).
- [ ] T012 [P] Create `src/lib/team-admin-client.ts`: typed `TeamMember`, the six action functions, `TeamAdminClientError` and the HTTP-body error mapping (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`) following `platform-admin-client.ts`.
- [ ] T013 Update `src/hooks/queries.ts`: replace `useTeamMembers` with a `list_members` call, remove `useInvitations` and `useRevokeInvitation`, remove the `Invitation` import, and make `useDashboardCounts` count only `status = 'active'` team members.
- [ ] T014 [P] Extend `src/components/ui/select.tsx` with `disabled`, `id` and `aria-label` support without changing existing call sites.
- [ ] T015 [P] Extend `src/components/ui/dialog.tsx` with `role="dialog"`, `aria-modal`, an accessible label, initial focus and a Tab focus trap; keep Escape closing.
- [ ] T016 Update `src/store/authStore.ts`: `fetchProfile` uses `maybeSingle()`; distinguish no row from a network/server error; no row → sign out and set the store message "Uw account is geblokkeerd of niet gekoppeld aan een organisatie. Neem contact op met uw beheerder."; network error → do not sign out; explicit sign-out clears the message. Apply this on sign-in, initialize and auth-state changes.
- [ ] T017 Update `src/components/auth/LoginPage.tsx` to display the store `authError`; keep the generic login error and do **not** add a `user_banned` branch (see plan "Spec deviation").
- [ ] T018 [P] Add the `before_send` URL redaction to `src/lib/posthog.tsx` for `$current_url`, `$referrer` and every `$initial_*` URL/referrer property, for all events.
- [ ] T019 Create `src/pages/AuthConfirmPage.tsx` and the `/auth/confirm` route outside `ProtectedRoute` in `src/App.tsx`: read `token_hash`/`type`, call `history.replaceState` before any auth call, accept only `type=invite`, and render the expired/used message with a link to `/login` for a missing/invalid token. The successful `verifyOtp`/activation flow is completed in T029. The token must never enter storage, logs or analytics.
- [ ] T020 Create `src/components/team/TeamManager.tsx` with the `organizationId` prop, the base table shell (Naam, E-mailadres, Rol, Status, Toegevoegd, acties), Skeleton loading, EmptyState and a query-error state. Actions and mutations are added per story.
- [ ] T021 Update `src/pages/TeamPage.tsx` to render the title and `<TeamManager organizationId={profile.organization_id} />`; show "Geen toegang" when the profile is not an admin; remove the old "Openstaande uitnodigingen" card and `InviteModal`.

### Shared server

- [ ] T022 Create `supabase/functions/team-admin/index.ts` with fail-closed CORS, JWT validation, caller profile read, blocked/missing-profile 403, per-organization authorization, the `{ code, message }` error shape, `logCode` without PII, and the action switch skeleton (contracts/team-admin §1–§3).
- [ ] T023 [P] Update `supabase/functions/send-feature-request/index.ts`: select `status` with the service role and return 403 "Uw account is geblokkeerd." for a blocked or missing profile.
- [ ] T024 [P] Update `supabase/functions/create-tenant/index.ts`: normalize `user_email` and insert `email` + `status: 'active'` in the profile.
- [ ] T025 [P] Delete `supabase/functions/invite-user/`; the README function table is updated in T063.

**Checkpoint**: Schema, helpers, typed client, auth-confirm, base Team UI and
`team-admin` skeleton are ready. Story work can now begin.

---

## Phase 3: User Story 1 — Collega uitnodigen en laten activeren (P1) 🎯 MVP

**Goal**: An office admin invites a colleague by name/e-mail/role; Darwin sends the
mail; the colleague activates through `/auth/confirm` and chooses a password.

**Independent Test**: Invite a new address, receive the mail, activate in another
browser, set a password, log in and see `Uitgenodigd` become `Actief`.

### Implementation

- [ ] T026 [US1] Implement the `invite` action in `supabase/functions/team-admin/index.ts`: normalize/validate email and name, role check, duplicate lookup by `lower(email)`, `inviteUserByEmail`, `email_exists`/`user_already_exists`/rate-limit mapping, profile insert with `status: 'invited'`, 23505 handling and account deletion on other errors (contracts/team-admin §4.2).
- [ ] T027 [US1] Add `useInviteMember` to `src/hooks/queries.ts`, invalidating `['team-members', orgId]` and `['dashboard-counts', orgId]`.
- [ ] T028 [US1] Add the "Nodig uit" button and dialog to `src/components/team/TeamManager.tsx` with Naam, E-mailadres, Rol, client validation, submit/disable state, success and Dutch error toast; close/reset on success.
- [ ] T029 [US1] Complete the valid `/auth/confirm` flow in `src/pages/AuthConfirmPage.tsx`: `verifyOtp({ type: 'invite' })`, `activate_own_profile`, navigate to `/reset-password`; show the exact expired/used message and a link to `/login` on failure.
- [ ] T030 [US1] Verify `src/pages/ResetPasswordPage.tsx` accepts the session created by `verifyOtp`; change it only if the manual check fails.
- [ ] T031 [US1] Manually smoke-test the real invitation e-mail: invite, receive, activate, choose a password, log in, and confirm the list status and date.

**Checkpoint**: US1 is functional; the row/status display is completed with the US2 list (T032–T034).

---

## Phase 4: User Story 2 — Teamoverzicht (P1)

**Goal**: The team list shows name, e-mail, role, status and date for every member,
including invited and blocked members.

**Independent Test**: A team with one active, one invited and one blocked member
shows all three correctly; an advisor cannot open Team.

### Implementation

- [ ] T032 [US2] Implement the `list_members` action in `supabase/functions/team-admin/index.ts`: service-role profile read, platform-admin IDs, `is_self`, `is_protected`, and the active → invited → blocked → name sort (contracts/team-admin §4.1).
- [ ] T033 [US2] Wire `useTeamMembers` in `src/hooks/queries.ts` to `listMembers(organizationId)` with the `['team-members', orgId]` key.
- [ ] T034 [US2] Complete the table in `src/components/team/TeamManager.tsx`: name/avatar, e-mail, role badge, status text/badge, `Toegevoegd` date in `nl-NL`, empty state with invite CTA, and loading/error states.
- [ ] T035 [US2] Confirm `src/pages/TeamPage.tsx` shows only the own organization and the "Geen toegang" card for an advisor; direct `/team` navigation is blocked by the role gate.
- [ ] T036 [US2] Add Playwright coverage in `tests/e2e/team-management.spec.ts` for the advisor (no Team link, `/team` shows "Geen toegang") and the list fields/status/date for an office admin.

**Checkpoint**: US1 and US2 work independently.

---

## Phase 5: User Story 3 — Opnieuw versturen en intrekken (P1)

**Goal**: Resend an open invitation (invalidating the old link) or revoke it and free
the e-mail address.

**Independent Test**: Resend makes the old link fail; revoke removes the row and the
same address can be invited again.

### Implementation

- [ ] T037 [US3] Implement `resend_invite` and `revoke_invite` in `supabase/functions/team-admin/index.ts`: status `invited`, `inviteUserByEmail` again, `getUserById` + empty `email_confirmed_at`, `deleteUser`, and the 409 messages (contracts/team-admin §4.3–§4.4).
- [ ] T038 [US3] Add `useResendInvite` and `useRevokeInvite` to `src/hooks/queries.ts` with the two invalidations.
- [ ] T039 [US3] Add the invited-row actions to `src/components/team/TeamManager.tsx`: "Uitnodiging opnieuw versturen" and "Uitnodiging intrekken" icon buttons with Dutch `aria-label`, and the confirmation "Uitnodiging voor <e-mailadres> intrekken? De link in de mail werkt daarna niet meer."
- [ ] T040 [US3] Add the Playwright flow in `tests/e2e/team-management.spec.ts`: invite → `Uitgenodigd` → resend → revoke; clean up the test invitation in `afterEach`.

**Checkpoint**: US3 works independently.

---

## Phase 6: User Story 4 — Rol wijzigen, blokkeren en deblokkeren (P1)

**Goal**: Change a role, block an active member (no login, no data, existing data
kept), and unblock with the existing password and data restored.

**Independent Test**: Change a role; block an open-session member and verify denial;
unblock and verify login and data return.

### Implementation

- [ ] T041 [US4] Implement `set_role`, `block` and `unblock` in `supabase/functions/team-admin/index.ts`, including the RPC calls, `ban_duration: '876000h'` / `'none'`, block-only-active, rollback on ban failure and re-ban on unblock-RPC failure (contracts/team-admin §4.5–§4.7).
- [ ] T042 [US4] Add `useSetMemberRole`, `useBlockMember` and `useUnblockMember` to `src/hooks/queries.ts` with the two invalidations.
- [ ] T043 [US4] Add the per-row role Select to `src/components/team/TeamManager.tsx` with optimistic change and revert + toast on error; add "Blokkeren"/"Deblokkeren" icon buttons with Dutch `aria-label`.
- [ ] T044 [US4] Add the block confirmation: "<naam> blokkeren? <naam> kan direct niet meer inloggen. Gesprekken en kennisbronnen blijven bewaard."
- [ ] T045 [US4] Add Playwright coverage for role change and for block/unblock with an open session: the target loses data, login fails, unblock restores login/data; always unblock in `afterAll`.
- [ ] T046 [US4] Confirm `profiles` role/status updates and the ban/unban work as one logical action; verify a ban failure rolls the status back.

**Checkpoint**: US4 works independently.

---

## Phase 7: User Story 5 — Platformbeheerder beheert elk team (P1)

**Goal**: Instellingen → Team lets the platform admin choose an organization and do
all US1–US4 actions there.

**Independent Test**: Choose organization A, invite/block there; choose B and verify
the list and actions belong to B.

### Implementation

- [ ] T047 [US5] Add the "Team" tab between "Assistenten" and "Nieuwe organisatie" in `src/pages/SettingsPage.tsx`, with an "Organisatie" Select fed by `listOrganizations`, the selected id in the `org` query parameter, active-tab initialization to `team` when `org` is present, and "Kies een organisatie." when empty.
- [ ] T048 [US5] Render `<TeamManager organizationId={selectedOrg} />` under the Team tab and keep the tab platform-admin-only; an office admin continues to see "Geen toegang".
- [ ] T049 [US5] Add Playwright coverage: the platform admin opens Instellingen → Team, selects `E2E_TEST_ORG_NAME`, and sees the same member list; the office admin does not see the Team tab.

**Checkpoint**: US5 works independently.

---

## Phase 8: User Story 6 — Waarborgen (P1)

**Goal**: No self-block/self-role-change, no last-active-admin removal, no office-admin
action on a platform admin; the server enforces all of it.

**Independent Test**: Attempt every forbidden action through the UI and through a
direct call; all are refused and nothing changes.

### Implementation

- [ ] T050 [US6] Enforce the self/last-admin/platform-admin rules in `team_update_member` (already part of T008) and map `SELF`, `LAST_ADMIN` and `FORBIDDEN` in `team-admin`; confirm `block`/`set_role` return 400/409/403 respectively.
- [ ] T051 [US6] In `src/components/team/TeamManager.tsx`, disable the role Select and hide actions for `is_self`, `is_protected`, and the last active admin (`role === 'admin' && status === 'active'` and exactly one such row).
- [ ] T052 [US6] Add Playwright coverage: the own row has no actions; the last active admin's Select is disabled; a direct `set_role`/`block` call returns 409 with the last-admin message.

**Checkpoint**: US6 works independently.

---

## Phase 9: User Story 7 — Geblokkeerde gebruiker (P1)

**Goal**: A blocked user loses data and sees a Dutch message; after unblock the
existing password and data work again.

**Independent Test**: Block an open-session target, verify no data and the message;
unblock, log in with the old password and see the data back.

### Implementation

- [ ] T053 [US7] Verify the blocked/missing-profile check in `team-admin` (T022) and the explicit blocked check in `send-feature-request` (T023); `rag-chat` and `document-webhook` rely on the user-context profile read and must return `FORBIDDEN` after T005/T006.
- [ ] T054 [US7] Verify the `authStore` no-row sign-out and store message (T016) and the `LoginPage` display (T017); the login page must not special-case `user_banned`.
- [ ] T055 [US7] Add Playwright coverage: the blocked target's open page loses data and is logged out with the Dutch message; login shows the generic message; unblock restores login and data.
- [ ] T056 [US7] Manually check the store message path after a page reload with a blocked session and after a normal sign-out (the normal sign-out must not show the blocked message).

**Checkpoint**: US7 works independently.

---

## Phase 10: User Story 8 — Server dwingt alles af (P1)

**Goal**: Advisors, other organizations and blocked users are refused outside the UI;
all safeguards hold on the server.

**Independent Test**: Direct calls as advisor, office admin (other org), platform
admin, blocked user and self/last-admin attempts; all match the matrix.

### Implementation

- [ ] T057 [US8] Extend `scripts/rls-verify.mjs`: member and office admin cannot update `profiles.email`, `profiles.status`, `profiles.role` or `profiles.organization_id`; block the `E2E_BLOCK_TARGET` through `team-admin` and verify it reads nothing from `profiles`, `conversations`, `messages`, `ai_assistants`, `knowledge_bases` and storage; unblock it in `finally`; `anon` cannot execute `activate_own_profile`/`team_update_member`; `authenticated` cannot execute `team_update_member`.
- [ ] T058 [US8] Add direct-call Playwright/API checks in `tests/e2e/team-management.spec.ts`: advisor 403, office admin other-org 403, blocked 403, self 400, last admin 409.
- [ ] T059 [US8] Run the policy verification SQL from `contracts/team-db.md` §6 and confirm 30 policies contain the null check, the helpers are block-aware, and the function grants are correct.

**Checkpoint**: US8 works independently.

---

## Phase 11: User Story 9 — Bestaande gebruikers merken niets (P1)

**Goal**: After migration 022 every existing user is active, has an e-mail, keeps the
same role/data and does not need to log in again.

**Independent Test**: Compare role/data/access before and after; every existing user
is `active`, no null e-mail, each organization has an active admin.

### Implementation

- [ ] T060 [US9] Run the preflight and post-migration counts in `quickstart.md` §1–§2: 0 profiles without auth, 0 auth users without profile, 0 organizations without an admin, 0 duplicate `lower(email)`, all existing profiles `active`, 0 null e-mail.
- [ ] T061 [US9] Smoke-test an existing user: login without a new invitation, same role and data, no visible change; verify a blocked user is the only one affected.
- [ ] T062 [US9] Record the rollback check from `quickstart.md` §7 in the release notes; do not run it unless a rollback is approved.

**Checkpoint**: US9 is verified.

---

## Phase 12: Polish, Release and Verification

**Purpose**: Documentation, quality gates and the gated release.

- [ ] T063 [P] Update `README.md` for the `team-admin` function and the removal of `invite-user`; confirm no other docs still describe the old flow.
- [ ] T064 [P] Update `FEATURES.md` via `@feature-tracker` with the new team-management feature and its files.
- [ ] T065 Run `npx tsc --noEmit`.
- [ ] T066 Run `npx eslint src/ --max-warnings 0`.
- [ ] T067 Run `npm run build`.
- [ ] T068 Run `npx playwright test tests/e2e/team-management.spec.ts`.
- [ ] T069 Run the full Playwright regression.
- [ ] T070 Run `node scripts/rls-verify.mjs`.
- [ ] T071 Apply migration 022 to production **only after explicit chat confirmation**; run the `quickstart.md` §2 verification immediately.
- [ ] T072 Deploy `team-admin`, `rag-chat`, `send-feature-request` and `create-tenant` **only after explicit confirmation**, in that order; run the §3 smoke tests.
- [ ] T073 Release the frontend, verify `/team`, `/settings` → Team and `/auth/confirm`; remove the deployed `invite-user` manually after the frontend is live.
- [ ] T074 Verify a PostHog event from `/auth/confirm?token_hash=...` contains no query/fragment and no token.
- [ ] T075 Run the final `quickstart.md` §8 Definition of Done and close the release.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No code dependencies; T001 is a hard release gate.
- **Foundational (Phase 2)**: Depends on Setup; blocks all stories.
- **US1 (Phase 3)**: Depends on Foundational; provides the invite/activation MVP. The full acceptance check uses the US2 list for the `Uitgenodigd` row.
- **US2 (Phase 4)**: Depends on Foundational; can run alongside US1 but the TeamManager file is shared, so coordinate edits.
- **US3 (Phase 5)**: Depends on US1/US2 (invited rows and the table).
- **US4 (Phase 6)**: Depends on US1/US2 (rows and table).
- **US5 (Phase 7)**: Depends on US2–US4 (the full TeamManager).
- **US6 (Phase 8)**: Depends on US4 (server rules and row actions).
- **US7 (Phase 9)**: Depends on US4/T016 (block and auth store).
- **US8 (Phase 10)**: Depends on all server actions.
- **US9 (Phase 11)**: Depends on the migration being applied.
- **Polish/Release (Phase 12)**: Depends on all stories and the quality gates.

### Shared-file constraints

- `supabase/migrations/022_team_management.sql`: T004–T008 are sequential; do not
  parallelize.
- `supabase/functions/team-admin/index.ts`: T022 and T026/T032/T037/T041 are
  sequential; the action switch is one file.
- `src/components/team/TeamManager.tsx`: T020, T028, T039, T043, T044 and T051 are
  sequential.
- `src/hooks/queries.ts`: T013, T027, T033, T038 and T042 are sequential.
- `tests/e2e/team-management.spec.ts`: T036, T040, T045, T049, T052, T055 and T058
  are sequential.

### Parallel Opportunities

- T002/T003 (setup docs/config) and T010/T011/T012/T014/T015/T018 (different
  files) can run in parallel once the migration design is fixed.
- T023/T024/T025 touch different functions/files and can run in parallel with
  T022, but the final deploy order remains `team-admin`, `rag-chat`,
  `send-feature-request`, `create-tenant`.
- The Playwright scenarios for different stories are drafted per story, but all
  edit the same `tests/e2e/team-management.spec.ts`; merge them sequentially.
- T063/T064 (README/FEATURES) can run in parallel with the final test runs.

### Within Each Story

- Server action → typed client → hook → UI → test (the order used above).
- Migration must be applied before the server actions can be smoke-tested on
  production; use a branch/transaction for the pre-release verification.
- Do not mark a story complete until its own test runs green (or skips with a
  documented missing E2E variable).

---

## Parallel Example: Foundational Frontend

```text
Task T010: profiles email/status types in src/types/database.types.ts
Task T011: STATUS_LABELS in src/lib/labels.ts
Task T012: team-admin-client.ts
Task T014: Select disabled/aria
Task T015: Dialog aria/focus
Task T018: PostHog before_send
```

All touch different files and can run concurrently.

---

## Implementation Strategy

### MVP First (US1 + the minimum list from US2)

1. Complete Phase 1 (T001 is a gate).
2. Complete Phase 2 (migration design, shared types/client/auth/UI shell).
3. Complete US1 (invite + activation) and the list part of US2.
4. **STOP and VALIDATE**: send a real invitation, activate, log in, see the row.
5. Only then add resend/revoke, role/block, Settings Team and the safeguards.

### Incremental Delivery

1. Foundational + US1 + US2 → invite and see the team.
2. US3 → resend/revoke.
3. US4 + US7 → role/block/unblock and blocked message.
4. US5 → platform-admin Team tab.
5. US6 + US8 → safeguards and direct-call verification.
6. US9 → migration/backfill verification.
7. Phase 12 → quality gates and gated release.

### Release Gates

- **No production migration** before T071 confirmation.
- **No Edge Function deploy** before T072 confirmation.
- **No `invite-user` removal** before the 020 frontend is live.
- **No `flow-config` removal** unless the 019 frontend is confirmed live
  (019 residual step).
- The mail settings from T001 are a hard prerequisite for a real invite test.

---

## Notes

- `[P]` means different files without dependencies; do not parallelize edits to the
  same file.
- Every user story has an independent test; the shared TeamManager file means the
  implementation order matters, but the behavior is independently verifiable.
- The login page intentionally does not surface `user_banned`; see plan "Spec
  deviation" and research §3d.
- The 30-policy list is the exact inventory from `research.md` §2; do not add
  policies outside it.
- The pre-existing bucket-only storage policy breadth is out of scope; 020 adds
  only the blocked-user null check.
- Release tasks T071–T073 are gated by explicit chat confirmation.
