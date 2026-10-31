# Contract: database functions and policies (migration 022)

**Feature**: `020-team-management` | **Migration**: `supabase/migrations/022_team_management.sql`

This contract is the interface between the Edge Function/frontend and Postgres.
The full data model and policy matrix are in [../data-model.md](../data-model.md).

## 1. Schema additions

| Object | Definition |
|---|---|
| `profiles.email` | `text NOT NULL`, backfilled from `auth.users.email`, `UNIQUE (lower(email))` |
| `profiles.status` | `text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','blocked'))` |
| `profiles` insert trigger | `set_profile_email_before_insert`, fills `email` from `auth.users` when null |

No `UPDATE` grant on `email` or `status` for `authenticated`/`anon`. The existing
column grant remains `full_name, avatar_url`.

## 2. Helper functions

| Function | Returns | Blocked profile | Grants |
|---|---|---|---|
| `get_user_org_id()` | `uuid` or `NULL` | `NULL` | existing (authenticated execute) |
| `is_org_admin()` | `boolean` | `false` | existing |
| `is_platform_admin()` | `boolean` | `false` | existing (authenticated execute) |

All three keep `STABLE`, `SECURITY DEFINER`, `SET search_path = public`.

## 3. `activate_own_profile()`

```sql
activate_own_profile() RETURNS void
```

- Security definer, `SET search_path = public`.
- Updates only `id = auth.uid()` and only when `status = 'invited'`; sets
  `status = 'active'`.
- `REVOKE EXECUTE FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated`.
- Calling it as active/blocked is a no-op.
- The `updated_at` trigger handles the timestamp.

## 4. `team_update_member(...)`

```sql
team_update_member(
  p_actor uuid,
  p_org uuid,
  p_target uuid,
  p_role text,
  p_status text
) RETURNS profiles
```

- PL/pgSQL, security definer, `SET search_path = public`.
- `NULL` role/status leaves that field unchanged.
- Locks all admin rows of `p_org` with `FOR UPDATE` before the last-admin check.
- Authorizes the actor as platform administrator (not blocked) or as an active
  admin in `p_org`.
- Rejects a target outside `p_org` (`NOT_FOUND`), self-target (`SELF`), a
  non-platform actor targeting a platform administrator (`FORBIDDEN`), and a
  change that leaves no active admin (`LAST_ADMIN`).
- Raises `P0001` with message `FORBIDDEN`, `NOT_FOUND`, `SELF` or `LAST_ADMIN`.
- `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`; only `service_role` calls it.
- Returns the updated `profiles` row.

## 5. Policies

Migration 022 drop/recreates the 30 policies listed in
[../data-model.md §7](../data-model.md#7-rls-matrix-for-blocked-users) with
`AND get_user_org_id() IS NOT NULL` in the relevant `USING`/`WITH CHECK`
expressions. Policies that already use `get_user_org_id()` or `is_org_admin()`
need no edit: the helper change closes them for blocked profiles.

`DROP POLICY IF EXISTS` + `CREATE POLICY` under the same name is mandatory so an
old permissive OR-expression cannot survive.

## 6. Verification queries

```sql
-- columns, defaults, nullability
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('email', 'status');

-- no client update on email/status
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and privilege_type = 'UPDATE'
order by grantee, column_name;
-- authenticated => full_name, avatar_url only; anon => none

-- every modified policy contains the null check
select tablename, policyname, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
  and policyname in (
    'Users can create conversations',
    'Users can delete their own conversations',
    'Users can update own conversations',
    'Users can view own conversations',
    'Users can insert messages',
    'Users can view own messages',
    'Admins can read org feedback',
    'Users can insert feedback on own conversation messages',
    'Users can read own feedback',
    'Users can update own feedback',
    'Admins can update feature requests',
    'Admins can view all feature requests',
    'Authenticated users can submit feature requests',
    'Users can view own feature requests',
    'Users can create own push subscriptions',
    'Users can delete own push subscriptions',
    'Users can read own push subscriptions',
    'Admins can create roadmap features',
    'Admins can delete roadmap features',
    'Admins can update roadmap features',
    'Authenticated users can view roadmap features',
    'Users can delete own votes',
    'Users can insert own votes',
    'Users can update own votes',
    'Users can view own votes',
    'Users can update their own profile',
    'Users can delete org''s storage objects',
    'Users can insert org''s storage objects',
    'Users can select org''s storage objects',
    'Users can update org''s storage objects'
  )
order by schemaname, tablename, policyname;

-- function privileges
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('activate_own_profile', 'team_update_member')
order by routine_name, grantee;

-- existing users are active and have an e-mail
select status, count(*) from public.profiles group by status;
select count(*) from public.profiles where email is null;
```

## 7. Rollback

A new migration, not an edit of 022:

1. Restore the three helper functions without the blocked condition.
2. Restore the 30 original policy expressions from the inventory in
   `research.md` §2.
3. Drop `team_update_member`, `activate_own_profile`, the insert trigger and
   `set_profile_email`.
4. Keep or drop `email`/`status` after the frontend is reverted; `status`
   defaults to `active`, so the columns are harmless if kept.

## 8. Out of scope

- Deleting active/blocked accounts and their data.
- Multi-organization membership.
- Name/e-mail changes.
- Broadening the pre-existing storage policy scope.
- Dropping the `invitations` table.
