# Data Model: Teambeheer: uitnodigen, rol wijzigen en blokkeren

**Feature**: `020-team-management` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

## 1. Overview

020 adds two columns to `public.profiles` (`email`, `status`), makes the existing
org helpers block-aware, hardens the policies that do not use those helpers, and
adds two server-side functions for activation and team updates. There is no new
table and no change to `invitations`, `conversations`, `ai_assistants`,
`knowledge_bases` or `knowledge_items` data.

The source of truth for a team member remains the pair `auth.users` + `profiles`:

- `auth.users` owns the credential, the ban and the confirmation timestamp.
- `profiles` owns the organization, name, e-mail, role and team status.
- A team action creates, updates or deletes both sides in one logical operation;
  a failure is rolled back.

## 2. `public.profiles` changes (migration 022)

```sql
ALTER TABLE public.profiles ADD COLUMN email text;
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('invited', 'active', 'blocked'));

UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;

ALTER TABLE public.profiles ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX profiles_email_lower_key
  ON public.profiles (lower(email));
```

### Backfill and existing users

- Every existing profile gets the e-mail from its `auth.users` row.
- Every existing profile gets `status = 'active'` from the column default.
- Existing users keep their role, organization, data and session; no re-login.
- The migration must stop if any existing profile has no `auth.users` e-mail
  (the live count is 0, but the migration should fail loudly rather than leaving
  a null e-mail).

### Grants

`authenticated` keeps only `UPDATE (full_name, avatar_url)`; `anon` has no UPDATE.
The new columns are not added to the column grant. `service_role` keeps full
access. No `GRANT UPDATE (email, status)` is added.

### Insert trigger

A `BEFORE INSERT` trigger fills `email` from `auth.users` when the inserting
function did not provide it:

```sql
CREATE OR REPLACE FUNCTION public.set_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    NEW.email := (SELECT u.email FROM auth.users u WHERE u.id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profile_email_before_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_profile_email();
```

This keeps `create-tenant` and any other service-role insert working during the
release window without granting clients an insert path. The unique index on
`lower(email)` catches a case-only duplicate.

### Why not a new table

`profiles` is already the identity row read by the RLS helpers and by the current
team page. A new `team_members` table would duplicate identity and require every
policy and join to change. The two columns are additive and keep the existing
one-row-per-user invariant.

## 3. Status state machine

```
                 invite
                   |
                   v
             +-----------+
             |  invited  |
             +-----------+
               |       |
     activate  |       |  revoke (delete account + profile)
               v       v
             +-----------+          block          +-----------+
             |  active   | ----------------------> |  blocked  |
             +-----------+                         +-----------+
                   ^                                   |
                   |            unblock                |
                   +-----------------------------------+
```

Rules:

| From | Action | To | Auth side effect |
|---|---|---|---|
| — | `invite` | `invited` | `auth.admin.inviteUserByEmail` creates/reuses an unconfirmed account |
| `invited` | invitee chooses password (`/auth/confirm` + `/reset-password`) | `active` | `activate_own_profile()`; the session already exists |
| `invited` | `resend_invite` | `invited` | new invite mail; old link invalid |
| `invited` | `revoke_invite` | — (row deleted) | `auth.admin.deleteUser`; profile cascades |
| `active` | `block` | `blocked` | `ban_duration: '876000h'` |
| `blocked` | `unblock` | `active` if `email_confirmed_at` is set, else `invited` | `ban_duration: 'none'` |
| `active`/`blocked` | `revoke_invite` | rejected | none |

`invited` means the account exists but the invitee has not chosen a password.
`revoke_invite` is only allowed while the auth user has an empty
`email_confirmed_at` and the profile status is `invited`. Blocking an `invited`
member is rejected; revoking is the correct action.

## 4. Helper functions

### `get_user_org_id()`

```sql
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND status <> 'blocked'
$$;
```

A blocked profile returns `NULL`. Every policy written as
`organization_id = get_user_org_id()` therefore denies. A blocked user also has no
organization context for `storage.foldername(name)[1] = get_user_org_id()::text`.

### `is_org_admin()`

```sql
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status <> 'blocked'
  )
$$;
```

A blocked admin is not an admin.

### `is_platform_admin()`

```sql
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    JOIN public.profiles p ON p.id = pa.user_id
    WHERE pa.user_id = auth.uid()
      AND p.status <> 'blocked'
  )
$$;
```

A blocked platform administrator is not a platform administrator. The function
keeps `SECURITY DEFINER`, `STABLE`, `SET search_path = public` and the existing
grants (`authenticated` execute; no client table access).

## 5. `activate_own_profile()`

```sql
CREATE OR REPLACE FUNCTION public.activate_own_profile()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET status = 'active'
  WHERE id = auth.uid()
    AND status = 'invited'
$$;

REVOKE EXECUTE ON FUNCTION public.activate_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_own_profile() TO authenticated;
```

- Only the caller's own row.
- Only from `invited`; calling it as `active` or `blocked` changes nothing.
- The existing `updated_at` trigger handles the timestamp.
- The function does not grant the client an UPDATE column; it is the only
  client-callable path that can change `status`.

## 6. `team_update_member(...)`

```sql
CREATE OR REPLACE FUNCTION public.team_update_member(
  p_actor uuid,
  p_org uuid,
  p_target uuid,
  p_role text,
  p_status text
) RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
...
$$;

REVOKE EXECUTE ON FUNCTION
  public.team_update_member(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
```

Only `service_role` may execute it. `p_role` and `p_status` are optional; `NULL`
leaves that field unchanged.

### Algorithm (in this order)

1. **Lock the admin rows of the target organization:**

   ```sql
   PERFORM 1
   FROM public.profiles
   WHERE organization_id = p_org AND role = 'admin'
   FOR UPDATE;
   ```

   This serializes two admins who try to block each other. The second transaction
   waits and then sees the committed state, so the last-admin check is correct.

2. **Authorize the actor:**
   - platform administrator: `EXISTS (platform_admins WHERE user_id = p_actor)`
     **and** the actor's profile is not blocked; or
   - `profiles.organization_id = p_org`, `role = 'admin'`, `status = 'active'`.
   - Otherwise raise `P0001` `FORBIDDEN`.

3. **Find the target:**
   - target profile not in `p_org` → `NOT_FOUND`;
   - `p_target = p_actor` → `SELF`.

4. **Protect a platform administrator from a non-platform actor:**
   - target has a `platform_admins` row and the actor is not a platform
     administrator → `FORBIDDEN`.

5. **Last active admin check:**
   - Compute the target's current `role`/`status` and the proposed
     `role`/`status`.
   - If the target is currently an active admin and the proposed state is not
     (`role <> 'admin'` or `status <> 'active'`), require at least one **other**
     profile in `p_org` with `role = 'admin'` and `status = 'active'`.
   - Otherwise raise `P0001` `LAST_ADMIN`.

6. **Update and return:**

   ```sql
   UPDATE public.profiles
   SET role = COALESCE(p_role, role),
       status = COALESCE(p_status, status)
   WHERE id = p_target AND organization_id = p_org
   RETURNING * INTO v_row;

   RETURN v_row;
   ```

### Error codes

| SQL message | Meaning | Edge Function mapping |
|---|---|---|
| `FORBIDDEN` | actor is not allowed, or target is a platform administrator and actor is not | 403 `FORBIDDEN` |
| `NOT_FOUND` | target is not in the organization | 404 `NOT_FOUND` |
| `SELF` | actor targets themselves | 400 `VALIDATION` |
| `LAST_ADMIN` | the change would remove the last active admin | 409 `CONFLICT` |

The function raises `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = '<code>'`.
The Edge Function maps only these known messages; anything else is
`INTERNAL_ERROR`.

### Invalid values

The Edge Function validates `role ∈ {admin, member}` and `status ∈ {invited,
active, blocked}` before calling the RPC. The table CHECK constraints are the
final guard. Direct RPC calls are impossible for client roles because execute is
revoked; `service_role` is trusted.

## 7. RLS matrix for blocked users

### Policies closed by the helper change

All policies that use `get_user_org_id()` or `is_org_admin()` are automatically
closed: the helper returns `NULL`/`false` for a blocked profile. This includes:

- `organizations`, `ai_assistants`, `assistant_knowledge_bases`
- `knowledge_bases`, `knowledge_base_documents`, `knowledge_items`
- `invitations`, `flow_configs`
- the `profiles` SELECT policy
- the admin/read storage policies that use the helpers

### Policies that need the explicit null check

The 30 policies from `research.md` §2 get `AND get_user_org_id() IS NOT NULL` in
their `USING` and/or `WITH CHECK` expression:

| Table | Policy | Command | Changed expression |
|---|---|---|---|
| `conversations` | `Users can create conversations` | INSERT | `user_id = auth.uid() AND get_user_org_id() IS NOT NULL` |
| `conversations` | `Users can delete their own conversations` | DELETE | `user_id = auth.uid() AND get_user_org_id() IS NOT NULL` |
| `conversations` | `Users can update own conversations` | UPDATE | `user_id = auth.uid() AND get_user_org_id() IS NOT NULL` |
| `conversations` | `Users can view own conversations` | SELECT | `user_id = auth.uid() AND get_user_org_id() IS NOT NULL` |
| `messages` | `Users can insert messages` | INSERT | `EXISTS (conversations … user_id = auth.uid()) AND get_user_org_id() IS NOT NULL` |
| `messages` | `Users can view own messages` | SELECT | `EXISTS (conversations … user_id = auth.uid()) AND get_user_org_id() IS NOT NULL` |
| `feedback_interactions` | `Admins can read org feedback` | SELECT | existing profile/org check `AND get_user_org_id() IS NOT NULL` |
| `feedback_interactions` | `Users can insert feedback on own conversation messages` | INSERT | existing own-conversation check `AND get_user_org_id() IS NOT NULL` |
| `feedback_interactions` | `Users can read own feedback` | SELECT | `auth.uid() = user_id AND get_user_org_id() IS NOT NULL` |
| `feedback_interactions` | `Users can update own feedback` | UPDATE | existing own-feedback check `AND get_user_org_id() IS NOT NULL` |
| `feature_requests` | `Admins can update feature requests` | UPDATE | existing admin check `AND get_user_org_id() IS NOT NULL` |
| `feature_requests` | `Admins can view all feature requests` | SELECT | existing admin check `AND get_user_org_id() IS NOT NULL` |
| `feature_requests` | `Authenticated users can submit feature requests` | INSERT | `auth.uid() = submitted_by AND get_user_org_id() IS NOT NULL` |
| `feature_requests` | `Users can view own feature requests` | SELECT | `auth.uid() = submitted_by AND get_user_org_id() IS NOT NULL` |
| `push_subscriptions` | `Users can create own push subscriptions` | INSERT | `auth.uid() = user_id AND get_user_org_id() IS NOT NULL` |
| `push_subscriptions` | `Users can delete own push subscriptions` | DELETE | `auth.uid() = user_id AND get_user_org_id() IS NOT NULL` |
| `push_subscriptions` | `Users can read own push subscriptions` | SELECT | `auth.uid() = user_id AND get_user_org_id() IS NOT NULL` |
| `roadmap_features` | `Admins can create roadmap features` | INSERT | existing admin check `AND get_user_org_id() IS NOT NULL` |
| `roadmap_features` | `Admins can delete roadmap features` | DELETE | existing admin check `AND get_user_org_id() IS NOT NULL` |
| `roadmap_features` | `Admins can update roadmap features` | UPDATE | existing admin check `AND get_user_org_id() IS NOT NULL` |
| `roadmap_features` | `Authenticated users can view roadmap features` | SELECT | `auth.uid() IS NOT NULL AND get_user_org_id() IS NOT NULL` |
| `roadmap_votes` | `Users can delete own votes` | DELETE | `auth.uid() = user_id AND get_user_org_id() IS NOT NULL` |
| `roadmap_votes` | `Users can insert own votes` | INSERT | `auth.uid() = user_id AND get_user_org_id() IS NOT NULL` |
| `roadmap_votes` | `Users can update own votes` | UPDATE | `auth.uid() = user_id AND get_user_org_id() IS NOT NULL` |
| `roadmap_votes` | `Users can view own votes` | SELECT | `auth.uid() = user_id AND get_user_org_id() IS NOT NULL` |
| `profiles` | `Users can update their own profile` | UPDATE | `id = auth.uid() AND get_user_org_id() IS NOT NULL` (USING and WITH CHECK) |
| `storage.objects` | `Users can delete org's storage objects` | DELETE | `bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL` |
| `storage.objects` | `Users can insert org's storage objects` | INSERT | `bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL` |
| `storage.objects` | `Users can select org's storage objects` | SELECT | `bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL` |
| `storage.objects` | `Users can update org's storage objects` | UPDATE | `bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL` |

`DROP POLICY IF EXISTS` followed by `CREATE POLICY` under the same name preserves
the policy identity and avoids OR-ing with an old permissive expression.

### What a blocked user can still see

Nothing through these policies. The auth session may still exist (a ban does not
revoke an access token), but:

- every org-scoped read returns no rows;
- every own-row read (conversations/messages/feedback/push/roadmap) returns no
  rows;
- `profiles` for the blocked user returns no row, so the client store cannot load
  a profile and signs out with the Dutch blocked/orphan message;
- every Edge Function that reads the profile through the user client gets no row
  and returns `FORBIDDEN`;
- `send-feature-request`, which reads with the service role, gets an explicit
  `status = 'blocked'` check and returns 403.

## 8. Team member DTO

`list_members` returns:

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

- `is_self = member.id === caller.id`.
- `is_protected = member has a platform_admins row && caller is not a platform
  administrator`.
- Sorting: status rank (`active` 0, `invited` 1, `blocked` 2), then
  `full_name.localeCompare(..., 'nl')`.

## 9. Validation rules

| Field | Rule |
|---|---|
| `organization_id` | UUID; caller must have access |
| `user_id` | UUID; target must belong to the organization |
| `email` | trim, lowercase, valid e-mail format; unique across all profiles |
| `full_name` | trim; 1–100 characters |
| `role` | `admin` or `member` |
| `status` | `invited`, `active` or `blocked` (server-side only) |
| `token_hash` | required on `/auth/confirm`, `type=invite` |

## 10. Migration order and rollback

1. Add `email` and `status`; backfill `email`; set `email NOT NULL`; create the
   unique index.
2. Create the insert trigger/function.
3. Replace `get_user_org_id()`, `is_org_admin()` and `is_platform_admin()`.
4. Drop/recreate the 30 policies.
5. Create `activate_own_profile()` and its grants.
6. Create `team_update_member()` and revoke execute from client roles.

Rollback is a new migration, not an edit of 022:

- restore the three helper functions without the blocked condition;
- restore the 30 original policy expressions (the list is in this document);
- drop `team_update_member`, `activate_own_profile`, the insert trigger and its
  function;
- the `email`/`status` columns may stay: `status` defaults to `active` and the
  columns are harmless without the helpers. A full rollback could drop the
  columns and index after the frontend is reverted.

The migration is applied only after explicit confirmation in the chat. It is
additive except for the helper replacements and policy drops.

## 11. Out of scope

- Permanently deleting an active/blocked account and its conversations,
  assistants or knowledge sources.
- One person in more than one organization.
- Changing a member's name or e-mail address.
- Users created outside the app.
- Dropping the `invitations` table.
- Converting `create-tenant` into an invitation.
- Broadening the pre-existing orphaned storage policies beyond the blocked-user
  null check.
