# Contract: `team-admin` Edge Function

**Feature**: `020-team-management` | **Path**: `supabase/functions/team-admin/index.ts`

## 1. Transport

- `POST` only. `OPTIONS` returns 200 with CORS headers.
- `Content-Type: application/json`.
- Fail-closed CORS: only origins listed in `ALLOWED_ORIGINS` receive
  `Access-Control-Allow-Origin`; never `*`.
- `verify_jwt: true`; the function also validates the JWT with
  `serviceClient.auth.getUser(token)`.
- Secrets: `VITE_SUPABASE_URL`/`SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`/`SUPABASE_ANON_KEY`,
  `VITE_SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`,
  `ALLOWED_ORIGINS`.

## 2. Common request and response shape

Request:

```json
{ "action": "list_members", "organization_id": "uuid", "...": "action fields" }
```

Error response:

```json
{ "code": "FORBIDDEN", "message": "U heeft geen rechten voor deze actie." }
```

| Code | HTTP | Default Dutch message |
|---|---|---|
| `UNAUTHORIZED` | 401 | "Uw sessie is verlopen. Log opnieuw in." |
| `FORBIDDEN` | 403 | "U heeft geen rechten voor deze actie." |
| `VALIDATION` | 400 | "Ongeldige invoer." |
| `NOT_FOUND` | 404 | "Dit teamlid bestaat niet in deze organisatie." |
| `CONFLICT` | 409 | action-specific |
| `INTERNAL_ERROR` | 500 | "Er ging iets mis. Probeer het opnieuw." |

The blocked caller gets `403 FORBIDDEN` with
"Uw account is geblokkeerd." before any action is dispatched.

## 3. Authorization (every action)

1. Validate the JWT. Missing/invalid → `401 UNAUTHORIZED`.
2. Read the caller's profile with the service role:
   `id, organization_id, role, status`.
3. If `status = 'blocked'` → `403 "Uw account is geblokkeerd."`.
4. If the profile is missing → `403 "Uw account is geblokkeerd of niet gekoppeld
   aan een organisatie."`.
5. Load the requested organization:
   - platform administrator (`userClient.rpc('is_platform_admin') === true`), or
   - `profile.role = 'admin'`, `profile.status = 'active'`, and
     `profile.organization_id = organization_id`.
   - Otherwise → `403 "U heeft geen rechten voor deze actie."`.
6. `list_members` uses the same authorization; an office admin can only list their
   own organization, a platform administrator can list any organization.

`is_platform_admin()` itself returns false for a blocked profile after migration
022.

## 4. Actions

### 4.1 `list_members`

Request:

```json
{ "action": "list_members", "organization_id": "uuid" }
```

Response: `200` with an array of:

```ts
interface TeamMember {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'member'
  status: 'invited' | 'active' | 'blocked'
  created_at: string
  is_self: boolean
  is_protected: boolean
}
```

- `is_self`: `member.id === caller.id`.
- `is_protected`: the member has a `platform_admins` row and the caller is not a
  platform administrator.
- Sort: `active` first, then `invited`, then `blocked`; within a status by
  `full_name` with Dutch locale comparison.
- Read the profiles with the service role (the function has already authorized
  the organization) and the platform-admin IDs with the service role. Do not
  return password, ban or token data.

### 4.2 `invite`

Request:

```json
{
  "action": "invite",
  "organization_id": "uuid",
  "email": "collega@organisatie.nl",
  "full_name": "Collega Naam",
  "role": "admin"
}
```

Flow:

1. Normalize e-mail: `trim().toLowerCase()`. Validate the e-mail format.
   `full_name`: `trim()`, 1–100 characters. `role`: `admin` or `member`.
   `organization_id`: UUID. Invalid → `400 VALIDATION`.
2. Look up `profiles` by `lower(email)`:
   - same organization → `409 "Deze persoon staat al in het team."`
   - other organization → `409 "Dit e-mailadres hoort al bij een andere
     organisatie."`
   - no profile → continue.
   - If the profile exists but its auth user is missing, treat it as
     `INTERNAL_ERROR` after logging the code (never log the e-mail).
3. `serviceClient.auth.admin.inviteUserByEmail(email, { data: { full_name } })`.
   - `error.code === 'email_exists'` or `'user_already_exists'` (confirmed
     account) → `409 "Dit e-mailadres heeft al een account. Neem contact op met de
     platformbeheerder."`
   - `error.code === 'over_email_send_rate_limit'` → `409 "Er zijn te veel
     e-mails naar dit adres verstuurd. Probeer het later opnieuw."`
   - Any other error → log the code and return `INTERNAL_ERROR`.
4. Insert the profile with the service role:
   `{ id: user.id, organization_id, full_name, email, role, status: 'invited' }`.
   - `23505` unique violation → do **not** delete the account; return
     `409 "Deze persoon staat al in het team."` (the pre-check found a race).
   - Any other insert error → `auth.admin.deleteUser(user.id)`, then
     `INTERNAL_ERROR`.
5. Return `200 { member: TeamMember }` for the new row (same shape as
   `list_members`, `is_self: false`, `is_protected: false`).

The e-mail template and Site URL are configured in Supabase Auth, not in this
function. The function does not return the invite link, token or e-mail content.

### 4.3 `resend_invite`

Request:

```json
{ "action": "resend_invite", "organization_id": "uuid", "user_id": "uuid" }
```

Flow:

1. Load the target profile in the organization.
2. Require `status = 'invited'`; otherwise
   `409 "Deze uitnodiging is al geaccepteerd. Blokkeer het account in plaats daarvan."`
3. `inviteUserByEmail(profile.email, { data: { full_name: profile.full_name } })`.
4. Return `200 { ok: true }`.

The previous link is invalidated by the new invite. A confirmed account returns
`email_exists`; map it to the same 409. No profile row is created or changed.

### 4.4 `revoke_invite`

Request:

```json
{ "action": "revoke_invite", "organization_id": "uuid", "user_id": "uuid" }
```

Flow:

1. Load the target profile in the organization.
2. Require `status = 'invited'`.
3. `auth.admin.getUserById(user_id)`; require `email_confirmed_at` empty.
4. `auth.admin.deleteUser(user_id)`; the `profiles` row cascades.
5. Return `200 { ok: true }`.

If the status is not `invited`, the auth user is confirmed, or `deleteUser` fails
on a foreign key, return
`409 "Deze uitnodiging is al geaccepteerd. Blokkeer het account in plaats daarvan."`
No profile or auth user is deleted in that case.

### 4.5 `set_role`

Request:

```json
{ "action": "set_role", "organization_id": "uuid", "user_id": "uuid", "role": "member" }
```

Flow:

1. Validate `role`.
2. Call `serviceClient.rpc('team_update_member', { p_actor: caller.id,
   p_org: organization_id, p_target: user_id, p_role: role, p_status: null })`.
3. Map the RPC error (see §5).
4. Return `200 { member: TeamMember }` with the updated row.

The RPC locks the admin rows, enforces self/last-admin/platform-admin
protection, and returns the updated `profiles` row.

### 4.6 `block`

Request:

```json
{ "action": "block", "organization_id": "uuid", "user_id": "uuid" }
```

Flow:

1. Load the target profile in the organization. Require `status = 'active'`.
   - `invited` → `409 "Een uitgenodigd teamlid kan niet worden geblokkeerd. Trek
     de uitnodiging in."`
   - `blocked` → `409 "Dit teamlid is al geblokkeerd."`
2. Remember the current role/status for rollback.
3. Call `team_update_member` with `p_status: 'blocked'`, `p_role: null`.
4. `auth.admin.updateUserById(user_id, { ban_duration: '876000h' })`.
5. If the ban fails, restore the previous status with a second
   `team_update_member` call (`p_status: previousStatus`, `p_role: null`) and
   return `INTERNAL_ERROR`.
6. Return `200 { member: TeamMember }` with the blocked row.

RLS is closed as soon as step 3 commits. The ban blocks login and refresh. The
access token already in the browser remains valid until `exp`, but every request
is denied by RLS/Edge Functions.

### 4.7 `unblock`

Request:

```json
{ "action": "unblock", "organization_id": "uuid", "user_id": "uuid" }
```

Flow:

1. Load the target profile. Require `status = 'blocked'`; otherwise
   `409 "Dit teamlid is niet geblokkeerd."`
2. `auth.admin.getUserById(user_id)` to read `email_confirmed_at`.
3. `auth.admin.updateUserById(user_id, { ban_duration: 'none' })`.
4. Call `team_update_member` with
   `p_status: email_confirmed_at ? 'active' : 'invited'`, `p_role: null`.
5. If the RPC fails after the unban, re-ban with `ban_duration: '876000h'` and
   return `INTERNAL_ERROR`.
6. Return `200 { member: TeamMember }`.

An unblocked member with a confirmed e-mail logs in with the existing password.
An unconfirmed member returns to `invited` and needs a new invitation link.

## 5. RPC error mapping

| RPC message | HTTP | Code | Dutch message |
|---|---|---|---|
| `FORBIDDEN` | 403 | `FORBIDDEN` | "U heeft geen rechten voor deze actie." |
| `NOT_FOUND` | 404 | `NOT_FOUND` | "Dit teamlid bestaat niet in deze organisatie." |
| `SELF` | 400 | `VALIDATION` | "U kunt uw eigen account niet blokkeren of uw eigen rol wijzigen." |
| `LAST_ADMIN` | 409 | `CONFLICT` | "Een organisatie heeft minimaal één actieve beheerder nodig." |

Any other RPC error is `INTERNAL_ERROR`. Never return the raw SQL message.

## 6. Logging and privacy

`logCode` may log only:

- the error/action code;
- the organization UUID;
- the target user UUID;
- the duration in ms.

It must never log e-mail addresses, names, tokens, invite links, request bodies
or upstream error messages. This follows constitution III and the spec's
acceptance criterion that tokens do not appear in logs.

## 7. Concurrency

`team_update_member` locks the admin rows of the organization before the
last-admin check. Two simultaneous blocks/demotions serialize; the second sees
the committed state and returns `LAST_ADMIN` if it would leave the organization
without an active admin. The Edge Function does not add a second check.

## 8. Non-goals

- No account deletion of active/blocked members.
- No name or e-mail change.
- No multi-organization membership.
- No invite link or token in the response.
- No client-side role escalation.
