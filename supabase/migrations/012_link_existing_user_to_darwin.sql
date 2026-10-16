-- Darwin Link Existing User to Organization
-- Migration 012: Add linkert.ruan@gmail.com as admin to the "Darwin" organization
--
-- Background: the user already exists in auth.users (created outside an
-- invitation flow), but has no row in public.profiles. Without a profile row
-- the RLS helper get_user_org_id() returns NULL, so the user cannot see any
-- organization-scoped data.
--
-- This migration is idempotent: re-running it after the auth user exists is a
-- no-op. If the auth user does not exist yet, the profile insert is skipped
-- silently (the WHERE NOT EXISTS guard on auth.users prevents a FK violation).
--
-- Safety:
--   - Only inserts; never updates or deletes existing profiles.
--   - Resolves organization_id by name, not by hard-coded UUID, so it is
--     portable across environments (dev/staging/prod).
--   - RLS on profiles is respected because the migration runs as superuser
--     in the SQL Editor / migration runner.

WITH target_user AS (
  SELECT id
  FROM auth.users
  WHERE email = 'linkert.ruan@gmail.com'
  LIMIT 1
),
target_org AS (
  SELECT id
  FROM organizations
  WHERE name = 'Darwin'
  LIMIT 1
)
INSERT INTO public.profiles (id, organization_id, full_name, role)
SELECT
  tu.id,
  to_org.id,
  'linkert.ruan@gmail.com',
  'admin'
FROM target_user tu
CROSS JOIN target_org to_org
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.id = tu.id
);

-- Verification helper (safe to run manually after applying the migration):
--   SELECT p.id, p.full_name, p.role, o.name AS organization
--   FROM public.profiles p
--   JOIN organizations o ON o.id = p.organization_id
--   WHERE p.full_name = 'linkert.ruan@gmail.com';