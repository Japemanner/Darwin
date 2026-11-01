# Implementation Plan: Teambeheer: uitnodigen, rol wijzigen en blokkeren

**Branch**: `020-team-management` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/020-team-management/spec.md`

## Summary

Add a complete team-management flow for office admins and the platform
administrator: invite by name/e-mail/role with a real Darwin e-mail, a team list
with status and date, resend/revoke, role changes, block/unblock, and a Team tab
for the platform administrator. The server is the only authority: one
`team-admin` Edge Function, two security-definer SQL functions, block-aware RLS
helpers, and an explicit null check on the policies that do not use those
helpers. The invitee activates through a token-hash route, and PostHog strips URL
query strings and fragments from every event.

The live 019 backend is already applied and deployed. The 019 frontend is merged
to `main`; the Netlify production deploy still needs operator verification. The
020 migration and `team-admin` function are **not** applied or deployed yet.

## Technical Context

**Language/Version**: TypeScript ~5.6, React 18.3, Vite 6, Deno (Supabase Edge
Functions)

**Primary Dependencies**: React Router 6, TanStack Query 5, Zustand 5,
`@supabase/supabase-js` 2.49, Tailwind CSS 3, the local shadcn-style UI
components, `lucide-react`, `posthog-js` 1.393. **No new npm dependencies.**

**Storage**: Supabase PostgreSQL. `auth.users` + `public.profiles` remain the
identity pair; no new table. Existing conversations, assistants, knowledge bases
and knowledge items are unchanged.

**Testing**: Playwright 1.64 E2E, `scripts/rls-verify.mjs`, `tsc --noEmit`,
`eslint src/ --max-warnings 0`, `npm run build`.

**Target Platform**: React SPA on Netlify; Supabase Auth, Postgres and Edge
Functions (Deno).

**Project Type**: Web application (single Vite app + Supabase backend).

**Performance Goals**: A 100-member team list renders in under two seconds; a
team action completes in under two seconds excluding e-mail delivery; the Edge
Function responds within two seconds for a 100-member organization.

**Constraints**: Dutch UI in the u-form; English code/identifiers/commits; no
e-mail addresses, names, invitation tokens or token hashes in logs, analytics,
URLs or browser storage beyond the normal Supabase session (the profile e-mail is
stored in Postgres by design); WCAG 2.1 AA; one management Edge Function; no
migration or deployment without explicit chat confirmation; no new npm
dependencies.

**Scale/Scope**: Two organizations today, small teams; design for 100 members per
organization and six actions (invite, resend, revoke, set role, block, unblock).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Result |
|---|---|---|
| I. Dutch UI, English code | Team page, dialogs, errors and statuses are Dutch in the u-form; all code, identifiers and commits stay English | PASS |
| II. Concept, never advice | This feature only administers access; it produces no generated content and no recommendation | PASS (no change) |
| III. Client data sensitivity | `profiles.email` is stored in Postgres by design; no e-mail/name/invitation token in logs, analytics, URLs or browser storage beyond the normal Supabase session; `logCode` logs only codes/IDs/duration; `/auth/confirm` removes the token before `verifyOtp`; PostHog `before_send` strips URL query/fragment | PASS |
| IV. Accessibility WCAG 2.1 AA | Keyboard-operable table actions, Dutch `aria-label` on icon buttons, visible text statuses, focus-managed dialogs, labelled fields | PASS |
| V. Typed external clients, no silent failures | `team-admin-client.ts` is typed; every action has a Dutch visible error; no swallowed catches; the server maps RPC codes to explicit HTTP/Dutch errors | PASS |
| VI. Minimal scope | Only the files needed for the six actions, the two pages, the auth-confirm route, the PostHog redaction, the existing function updates and the tests. No account deletion, multi-org, name/e-mail change, `invitations` drop or `create-tenant` conversion | PASS |

**No violations.** No complexity exception is required.

Notes:

- The two-layer enforcement (RLS + Edge Function + RPC) is required by the spec's
  "server dwingt dit alles af" acceptance, not speculative complexity.
- The shared `Dialog` and `Select` components need small accessibility/disabled
  additions because the feature uses them; this is functional, not a refactor.
- The inventory found pre-existing orphaned storage policies that are broader
  than organization scope. 020 adds only the blocked-user null check; broader
  storage hardening is explicitly out of scope and recorded in
  [research.md](./research.md) §2.

## Project Structure

### Documentation (this feature)

```text
specs/020-team-management/
├── plan.md              # This file
├── research.md          # Phase 0: live inventory + Context7 decisions
├── data-model.md        # Phase 1: columns, state machine, RLS, functions
├── quickstart.md        # Phase 1: release order and verification
├── contracts/
│   ├── team-admin.md    # Edge Function contract
│   ├── team-db.md       # SQL functions/policies contract
│   └── auth-confirm.md  # /auth/confirm activation contract
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks, not created here
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── 022_team_management.sql          # NEW
└── functions/
    ├── team-admin/index.ts              # NEW
    ├── rag-chat/index.ts               # no code change; redeployed per quickstart
    ├── document-webhook/index.ts       # no code change; 019 live
    ├── send-feature-request/index.ts   # MODIFIED: explicit blocked 403
    ├── create-tenant/index.ts          # MODIFIED: email + status active
    └── invite-user/                    # DELETED (deployed function removed manually)

src/
├── App.tsx                             # MODIFIED: /auth/confirm route
├── types/database.types.ts             # MODIFIED: profiles.email/status
├── lib/
│   ├── labels.ts                       # MODIFIED: STATUS_LABELS/statusLabel
│   ├── team-admin-client.ts            # NEW
│   └── posthog.tsx                     # MODIFIED: before_send URL redaction
├── hooks/
│   └── queries.ts                      # MODIFIED: team query/mutations, active count
├── store/
│   └── authStore.ts                    # MODIFIED: maybeSingle + store error
├── components/
│   ├── team/TeamManager.tsx            # NEW
│   ├── auth/LoginPage.tsx              # MODIFIED: show store auth error
│   └── ui/
│       ├── select.tsx                  # MODIFIED: disabled/id/aria-label
│       └── dialog.tsx                  # MODIFIED: role/aria/focus trap
└── pages/
    ├── TeamPage.tsx                    # MODIFIED: role gate + TeamManager
    ├── SettingsPage.tsx                # MODIFIED: Team tab + org select
    ├── AuthConfirmPage.tsx             # NEW
    └── ResetPasswordPage.tsx           # unchanged, verify session flow

tests/
└── e2e/
    ├── fixtures.ts                     # MODIFIED: block target / invite base
    └── team-management.spec.ts         # NEW

scripts/
└── rls-verify.mjs                      # MODIFIED: status/email/blocked checks

.env.example                            # MODIFIED: new E2E variables
README.md                               # MODIFIED: function table (team-admin)
AGENTS.md                               # MODIFIED: SPECKIT plan reference/status
FEATURES.md                             # updated after implementation
```

**Structure Decision**: Single Vite/React app with Supabase migrations and Edge
Functions in the existing repository layout. The feature adds one migration, one
Edge Function, one typed client, one team component and one public auth route;
the rest are targeted edits to existing files.

## Implementation Phases

### Phase 1 — Database (migration 022)

1. Write `022_team_management.sql` per [data-model.md](./data-model.md) and
   [contracts/team-db.md](./contracts/team-db.md):
   - `profiles.email` + backfill + `NOT NULL` + unique lower(email);
   - `profiles.status` + default + check;
   - insert trigger `set_profile_email`;
   - block-aware `get_user_org_id()`, `is_org_admin()`, `is_platform_admin()`;
   - 30 policy drop/recreates with the null check;
   - `activate_own_profile()` + grants;
   - `team_update_member()` + service-role-only grant.
2. Preflight: counts of profiles without auth users, profiles without e-mail,
   organizations without an admin, duplicate lower(email), and the hardcoded
   existing users.
3. Apply only after explicit confirmation.
4. **Verify**: the checks in [quickstart.md](./quickstart.md) §2 — columns,
   grants, policy expressions, function privileges, all existing users `active`,
   no null e-mail, no duplicate e-mail.

### Phase 2 — Server (Edge Functions)

1. Create `team-admin` per [contracts/team-admin.md](./contracts/team-admin.md):
   fail-closed CORS, JWT validation, caller profile/status, per-org
   authorization, six actions, RPC error mapping, Dutch messages, no-PII logging.
2. Update `send-feature-request`: read `status` with the service role and return
   403 "Uw account is geblokkeerd." for a blocked caller; a missing profile also
   gets 403.
3. Update `create-tenant`: normalize the e-mail and insert `email` + `status:
   'active'` in the profile.
4. Delete `supabase/functions/invite-user/`; update `README.md`.
5. Redeploy `rag-chat` (code unchanged) and deploy the new `team-admin` plus the
   modified `send-feature-request` and `create-tenant`.
6. **Verify**: deploy to a branch or after confirmation; `401` without auth;
   advisor/other-org `403`; invite/resend/revoke/role/block/unblock smoke; no
   e-mail/name/token in function logs.

### Phase 3 — Frontend data and team UI

1. `database.types.ts`: `email` and `status` on profiles.
2. `labels.ts`: `STATUS_LABELS` and `statusLabel()`.
3. `team-admin-client.ts`: typed actions and error class.
4. `queries.ts`: `useTeamMembers` via `list_members`; one mutation per action;
   invalidate `['team-members', orgId]` and `['dashboard-counts', orgId]`;
   remove `useInvitations`/`useRevokeInvitation`; count only active members.
5. `Select`: add `disabled`, `id`, `aria-label`; `Dialog`: role/aria/focus trap.
6. `TeamManager.tsx`: invite dialog, table, per-row role select, action buttons,
   confirm dialogs, skeleton/empty/error states.
   - Block confirmation: "<naam> blokkeren? <naam> kan direct niet meer inloggen.
     Gesprekken en kennisbronnen blijven bewaard."
   - Revoke confirmation: "Uitnodiging voor <e-mailadres> intrekken? De link in de
     mail werkt daarna niet meer."
   - Status labels: Uitgenodigd, Actief, Geblokkeerd; role labels Adviseur,
     Beheerder.
7. `TeamPage.tsx`: role gate + TeamManager; remove the old invitation card/modal.
8. `SettingsPage.tsx`: Team tab between Assistenten and Nieuwe organisatie;
   organization Select from `listOrganizations`; `?org=` survives reload. When
   `org` is present on load, initialise the active tab to `team`; without a
   selection show "Kies een organisatie."
9. **Verify**: `tsc`, ESLint, build; keyboard tab order; own/protected/last-admin
   selects disabled; error toast + revert.

### Phase 4 — Activation, blocked session and analytics

1. `AuthConfirmPage.tsx` + `/auth/confirm` route outside `ProtectedRoute`.
2. `authStore.ts`: `maybeSingle`; no-row → sign out + store message; network
   error → stay signed in; explicit sign-out does not show the blocked message.
   The no-row message is: "Uw account is geblokkeerd of niet gekoppeld aan een
   organisatie. Neem contact op met uw beheerder."
3. `LoginPage.tsx`: show the store message; keep the generic login error and do
   **not** special-case `user_banned`.
4. `posthog.tsx`: `before_send` strips query/fragment from `$current_url`,
   `$referrer` and `$initial_*` URL properties for every event.
5. **Verify**: invalid/used link shows the exact message; valid flow reaches
   `/reset-password`; the address bar loses `token_hash` before `verifyOtp`;
   blocked open session shows the store message on reload/refresh; a PostHog
   event from `/auth/confirm?token_hash=...` contains no query.

### Phase 5 — Tests and verification

1. Fixtures and `.env.example`: `E2E_BLOCK_TARGET_EMAIL/PASSWORD`,
   `E2E_INVITE_EMAIL_BASE` (plus-addressed), with skips and clear reasons.
2. `team-management.spec.ts`: advisor access, invite/resend/revoke, duplicate,
   own row, last admin (UI + direct 409), block/unblock with open session,
   platform-admin Settings Team, invalid `/auth/confirm`.
3. `rls-verify.mjs`: profile email/status update denied; blocked user reads
   nothing; anon cannot execute either RPC; authenticated cannot execute
   `team_update_member`.
4. **Verify**: feature Playwright tests, `rls-verify.mjs`, `tsc`, ESLint, build.

### Phase 6 — Release

Follow [quickstart.md](./quickstart.md): mail settings, migration 022, Edge
Functions (`team-admin`, `rag-chat`, `send-feature-request`, `create-tenant`),
frontend, then the operator removes the deployed `invite-user` manually.

## Spec deviation (documented)

Spec US7 acceptance 1 says a blocked user sees the blocked message **when trying
to log in**. Context7 and the GoTrue source show that GoTrue checks
`IsBanned()` **before** verifying the password, so returning `user_banned` would
let anyone test any password and learn that an account is banned (account
enumeration). The route explicitly says to keep the generic login message in that
case. The plan follows that fallback: login keeps
"Inloggen mislukt. Controleer uw e-mailadres en wachtwoord."; the blocked message
is shown when an open session loses its profile and in every 403 from
`team-admin`. This is recorded in [research.md](./research.md) §3d.

## Post-Design Constitution Check

| Principle | Re-check after design | Result |
|---|---|---|
| I | All new UI copy is Dutch u-form; identifiers/code English | PASS |
| II | No generated/advisory output | PASS (no change) |
| III | Profile e-mail is stored in Postgres by design; no e-mail/name/invitation token in logs, analytics, URLs or browser storage beyond the Supabase session; URL redaction covers the existing `?code=` leak | PASS |
| IV | Keyboard, aria-labels, focus trap, text statuses, labelled fields | PASS |
| V | Typed client, explicit error mapping, no silent failures | PASS |
| VI | Scope traced to the spec and the route; no extra features | PASS |

## Complexity Tracking

No constitution violations. The design intentionally uses:

- a SQL RPC for the last-admin lock and atomic update (the Edge Function alone
  cannot serialize concurrent admins);
- a status check in both RLS and the Edge Function (defense in depth required by
  the "server dwingt dit af" acceptance);
- a profile insert trigger (keeps the release window safe when an older function
  inserts a profile without the new columns).

These are the minimum mechanisms for the required consistency and server
enforcement, not speculative abstractions.

## Release gate

Before applying migration 022:

- Confirm the 019 Netlify production deploy is live (the PR merge is done, but
  the CLI was not authenticated to verify it).
- Confirm the Scaleway TEM SMTP settings, Site URL, invite template to
  `/auth/confirm`, and 24-hour OTP expiry.
- Confirm the migration and each Edge Function deployment in the chat.
