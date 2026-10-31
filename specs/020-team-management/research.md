# Research: Teambeheer: uitnodigen, rol wijzigen en blokkeren

**Feature**: `020-team-management` | **Date**: 2026-10-31 | **Plan**: [plan.md](./plan.md)

## 1. Live inventory (Supabase MCP)

Project: `https://ddfjigrjwlfpaljhhogv.supabase.co` — this is the project in the
project's `.env.local` (`VITE_SUPABASE_URL`), so the MCP points at Darwin.

| Check | Result |
|---|---|
| `authenticated` UPDATE on `public.profiles` | Only `full_name` and `avatar_url` — hotfix live |
| `public.is_platform_admin()` | Exists after migration 021 |
| `public.platform_admins` | Exists after migration 021 |
| Migration 021 | Applied as `20261031174605 platform_admin_catalog` |
| Migration 020 (`profiles_update_columns`) | Applied as `20261031162836`; the file is `020_profiles_update_columns.sql`, not `019` |
| `profiles` columns before 022 | No `email`, no `status` |
| Profiles without an `auth.users` row | 0 |
| `auth.users` without a profile | 0 |
| Organizations | 2; every organization has at least one admin profile |
| Assistants after 021 | 10 rows, 0 without `catalog_id`, 5 catalogue items, 0 duplicate org/catalogue combinations |
| Active assistants per organization | Darwin 3, Gerard_Tekelenburg 2 — unchanged |
| Assistant write policies after 021 | 0 |
| Central n8n row | Header/token/document URL present; token not inspected |
| Platform administrator | 1 row, the confirmed account (`jaap@jaaphoeve.com`) |

### Released Edge Functions (019)

The four 019 functions are deployed and active:

- `platform-admin` — new, version 1
- `rag-chat` — version 8
- `document-webhook` — version 8
- `create-tenant` — version 9

All four return `401` without an Authorization header. The 019 frontend was merged
to `main` through PR #35 -> #36. The Netlify production deploy could not be
verified with the CLI because it is not authenticated; this is a release check for
the operator, not a 020 implementation blocker.

### The `invite-user` function

Still deployed (version 5) and still present in the repository. It is the old
flow: it creates a user with a random password, calls `generateLink`, never writes
an invitation and never sends mail. It will be removed after the 020 frontend is
live (deployed function removal is manual).

## 2. Policy inventory

The full `pg_policies` inventory for `public` and `storage` was queried. The
following policies do **not** go through `get_user_org_id()` or `is_org_admin()`.
They all need `AND get_user_org_id() IS NOT NULL` in `USING` and/or `WITH CHECK`,
with a drop/create under the same policy name.

| Table | Policies |
|---|---|
| `public.conversations` | `Users can create conversations`, `Users can delete their own conversations`, `Users can update own conversations`, `Users can view own conversations` |
| `public.messages` | `Users can insert messages`, `Users can view own messages` |
| `public.feedback_interactions` | `Admins can read org feedback`, `Users can insert feedback on own conversation messages`, `Users can read own feedback`, `Users can update own feedback` |
| `public.feature_requests` | `Admins can update feature requests`, `Admins can view all feature requests`, `Authenticated users can submit feature requests`, `Users can view own feature requests` |
| `public.push_subscriptions` | `Users can create own push subscriptions`, `Users can delete own push subscriptions`, `Users can read own push subscriptions` |
| `public.roadmap_features` | `Admins can create roadmap features`, `Admins can delete roadmap features`, `Admins can update roadmap features`, `Authenticated users can view roadmap features` |
| `public.roadmap_votes` | `Users can delete own votes`, `Users can insert own votes`, `Users can update own votes`, `Users can view own votes` |
| `public.profiles` | `Users can update their own profile` |
| `storage.objects` | `Users can delete org's storage objects`, `Users can insert org's storage objects`, `Users can select org's storage objects`, `Users can update org's storage objects` |

That is 30 policies. All other policies already use `get_user_org_id()` or
`is_org_admin()` and are closed for blocked users once those helpers return
`NULL`/`false`.

### Pre-existing policy risks (out of scope for 020)

The inventory also shows orphaned permissive policies that only test
`bucket_id = 'knowledge-documents'` on `storage.objects` (the four `Users can …
org's storage objects` policies above). Adding the blocked-user null check does
not make those policies organization-scoped: an active user can still reach
objects outside their organization's path. This is a pre-existing cross-tenant
storage issue, not introduced by 020. The spec only requires blocked users to
lose access, so 020 adds the null check and leaves broader storage hardening for a
separate change. This is recorded here so it is not mistaken for a 020 regression.

Similarly, `knowledge_bases`, `knowledge_base_documents` and
`assistant_knowledge_bases` still have orphaned permissive `Users can …` policies
that OR with the admin policies. They use `get_user_org_id()` and are therefore
closed for blocked users, but their broader write permissions remain pre-existing
and out of scope.

## 3. Context7 verification

### a. `inviteUserByEmail` on an existing account

**Verified.** The GoTrue `Invite` handler (`internal/api/invite.go`) finds the user
by e-mail. If the user exists and is **confirmed**, it returns
`ErrorCodeEmailExists` (HTTP 422) with "A user with this email address has already
been registered". If the user exists and is **unconfirmed**, it does not create a
second user; it proceeds to send the invite again. The JS shared error registry
also contains `user_already_exists`; the admin invite endpoint uses
`email_exists`. The client must treat both codes as "already has an account".

**Decision**: map `email_exists` and `user_already_exists` to `CONFLICT`
"Dit e-mailadres heeft al een account. Neem contact op met de platformbeheerder."
The "already in team" and "other organization" checks happen before calling the
Auth admin API, so a confirmed account that belongs to the same or another
organization gets the more specific message.

**Alternative rejected**: calling `inviteUserByEmail` first and using its error
for the duplicate messages. That would send an e-mail before the organization
check and would leak less specific errors.

### b. Lifting a ban

**Verified.** `auth.admin.updateUserById(id, { ban_duration: 'none' })` lifts the
ban. The AdminUserAttributes documentation explicitly says: "Setting the ban
duration to 'none' lifts the ban on the user." A 100-year ban is
`'876000h'`.

**Decision**: block uses `ban_duration: '876000h'`; unblock uses
`ban_duration: 'none'`.

### c. Banned user, `verifyOtp` and token refresh

**Verified.** GoTrue checks `user.IsBanned()` in both the refresh-token grant and
the verify endpoint. A banned user gets `ErrorCodeUserBanned` (`user_banned`) and
cannot refresh or verify an OTP.

**Important**: a ban does **not** revoke existing sessions. Supabase's own docs
state that a temporary ban only blocks sign-in and does not revoke existing
sessions; access tokens already issued remain valid until `exp`. That is why 020
does not rely on the ban alone: `get_user_org_id()` and `is_org_admin()` return
`NULL`/`false` for a blocked profile, every policy using them denies the request,
the policies that do not use them get the explicit null check, and Edge Functions
check the profile status/`is_platform_admin()`.

**Decision**: block is status change + long ban + RLS. The first request after the
block is denied by RLS/Edge Functions; refresh/login is denied by GoTrue.

### d. Login error code and the password/ban order

**Verified, and it changes the UI decision.** In
`internal/api/token.go` (`ResourceOwnerPasswordGrant`), GoTrue calls
`user.IsBanned()` **before** `user.Authenticate(...)` (the password check). A
banned user therefore gets `user_banned` regardless of whether the entered
password is correct.

**Decision**: the login page must **not** special-case `user_banned`. Doing so
would let anyone test any password and learn that an account is banned
(account enumeration). The login page keeps the existing generic message
"Inloggen mislukt. Controleer uw e-mailadres en wachtwoord." The blocked message
is shown when an existing session loses its profile: the profile row is no longer
readable through RLS, `fetchProfile` returns no row, the store signs out and
passes "Uw account is geblokkeerd of niet gekoppeld aan een organisatie. Neem
contact op met uw beheerder." to `/login` through the store, not the URL.

This is a deliberate deviation from spec US7 acceptance 1 (the login attempt
itself). The route's fallback ("anders blijft de huidige algemene melding") is
followed. The blocked-user message is still visible after a reload/next request of
an open session and in every 403 from the management function.

### e. `before_send` in posthog-js

**Verified.** `posthog-js` `^1.393.0` supports `before_send`; it runs for every
event, receives the capture result, and may modify or drop it. The browser SDK
automatically adds `$current_url`, `$referrer`, `$initial_current_url`,
`$initial_referrer` and related properties.

**Decision**: add one `before_send` in `posthog.init` that removes the query
string and fragment from `$current_url`, `$referrer` and every `$initial_*`
URL/referrer property. This also closes the existing `?code=` leak on
`/reset-password`.

### f. Existing Edge Functions and blocked profiles

How each existing function reads the caller:

| Function | Profile read | After migration 022 |
|---|---|---|
| `rag-chat` | user client (`Authorization` JWT), `profiles.organization_id` | The `profiles` SELECT policy uses `get_user_org_id()`, which is `NULL` for a blocked profile → no row → `FORBIDDEN`. No code change. |
| `document-webhook` | user client, `profiles.organization_id, role` | Same: no row → `FORBIDDEN`. No code change. |
| `send-feature-request` | service role, `profiles.full_name` | The service role bypasses RLS; add `status` to the select and return `403 "Uw account is geblokkeerd."` (or 403 for a missing profile). |
| `create-tenant` | `is_platform_admin()` RPC with the caller JWT | Returns false for a blocked platform admin → `FORBIDDEN`. Also insert normalized `email` and `status: 'active'`. |
| `platform-admin` | `is_platform_admin()` RPC with the caller JWT | Returns false for a blocked platform admin → `FORBIDDEN`. No code change. |
| `team-admin` (new) | service role + `is_platform_admin()` RPC | Explicit blocked/missing-profile check before every action. |

This is the "via het JWT is het na de migratie al dicht" verification the route
asked for: the user-client functions need no code change, the service-role reader
needs the explicit check, and the platform-admin paths inherit the block-aware
`is_platform_admin()`.

## 4. Decisions

| Decision | Rationale | Alternatives considered |
|---|---|---|
| One `team-admin` Edge Function for all six actions | Required by the acceptance criteria; one authorization path; one place for Dutch errors | One function per action (rejected: six deployments and duplicated authorization) |
| Status and e-mail on `profiles` | The team list needs both; RLS helpers already read `profiles`; no new join table | Separate `team_members` table (rejected: extra joins and duplicate identity) |
| `get_user_org_id()` returns `NULL` for blocked profiles | Reuses every existing org-scoped policy; one change closes most tables | A separate `is_blocked()` in every policy (rejected: 60 policy edits) |
| Explicit null check on the 30 policies that do not use the helper | Blocked users have no org context; those policies filter on `user_id` only | Dropping those policies (rejected: breaks own-conversation flows) |
| `team_update_member` RPC with `FOR UPDATE` on admin rows | Serializes the last-admin check; two admins cannot block each other simultaneously | Check-then-update in the Edge Function (rejected: race) |
| Ban + status + RLS | A ban alone does not revoke existing sessions; RLS denies the next request | Delete user (rejected: loses conversations/assistants/knowledge and is out of scope) |
| Revoke deletes the unused auth account and profile | The invitee has created nothing; the e-mail address must become free again | Keep the placeholder account (rejected: e-mail stays occupied; current defect) |
| Resend calls `inviteUserByEmail` again | No dedicated resend for invites; a new invite invalidates the old e-mail link | `auth.resend` with type invite (rejected: unsupported) |
| `lower(email)` unique index, no extension | E-mail uniqueness across organizations without adding `citext` | `citext` extension (rejected: new extension, no benefit) |
| `activate_own_profile()` security-definer RPC | The authenticated role has no UPDATE on `status`; the RPC updates only the caller's invited row | Direct client update (rejected: column grant would reopen self-escalation) |
| `maybeSingle()` in `fetchProfile` | Distinguishes "no row" (blocked/orphan) from a network/server error | `.single()` (rejected: both look like an error) |
| No `user_banned` login branch | GoTrue checks the ban before the password; a specific message enables enumeration | Specific blocked message on login (rejected: account enumeration) |
| PostHog `before_send` URL redaction | Removes query/fragment for all events, including the existing `?code=` leak | Disable PostHog (rejected: product analytics is in scope) |
| Reuse the existing Dialog and Select | No new dependency; one accessibility fix for all modals | Add Radix Dialog/Select usage (rejected: new pattern, no new dependency needed) |

## 5. Open risks and release notes

1. **SMTP delivery**: invite mail depends on the configured SMTP (Scaleway TEM).
   The quickstart includes the SMTP, Site URL, invite template and 24-hour OTP
   expiry checks. `over_email_send_rate_limit` must be mapped to a Dutch error.
2. **Ban does not revoke existing JWTs**: the access token stays valid until
   `exp`, but RLS and Edge Functions deny every request. The UI shows the blocked
   message on the next profile read/refresh. This matches the spec's "vanaf het
   eerstvolgende verzoek".
3. **`inviteUserByEmail` 23505 race**: if the profile insert fails on a unique
   key, the route says not to delete the account. That can leave an orphan in a
   very narrow race. The pre-check makes this unlikely; the plan keeps the route's
   instruction to avoid deleting another user's account. This is recorded as a
   residual edge case.
4. **Platform admin address in migration 021**: the confirmed address is now in a
   public repository. This was explicitly confirmed by the operator; no
   additional PII is introduced by 020.
5. **Netlify deploy verification**: the 019 frontend is merged to `main`, but the
   CLI is not authenticated. The operator must confirm the production deploy
   before the 020 release. This is a release gate, not a code gate.
6. **Pre-existing storage policy breadth**: see §2. 020 adds only the blocked-user
   null check; broader storage hardening is a separate change.

## 6. Release status at plan time

- Migration 021: applied and verified.
- 019 Edge Functions: deployed.
- 019 frontend: merged to `main` (PR #35 -> #36); Netlify deploy to be verified.
- 020 migration 022: **not applied**.
- `team-admin`: **not deployed**.
- `invite-user`: still deployed and still in the repository; remove after the 020
  frontend release.
