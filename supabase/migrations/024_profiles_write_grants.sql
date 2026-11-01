-- 024_profiles_write_grants.sql
-- Hotfix: drop the unused table-level write grants on public.profiles.
--
-- Cause: 001_initial_schema.sql left the default Supabase table privileges in
-- place for anon and authenticated. 020_profiles_update_columns.sql narrowed
-- UPDATE to the full_name/avatar_url column grants, but INSERT, DELETE,
-- TRUNCATE, TRIGGER and REFERENCES were never revoked. None of them are needed:
--
--   * public.profiles has no INSERT and no DELETE policy, so RLS already denies
--     those rows for both roles — the grants only widen the surface and would
--     become exploitable the moment such a policy is added;
--   * TRUNCATE is not subject to RLS at all;
--   * REFERENCES and TRIGGER are only needed when creating constraints or
--     triggers, which happens from migrations, not from the API;
--   * profiles are created and rolled back server-side with the service role
--     (create-tenant, team-admin), which keeps its own grants untouched.
--
-- The RLS policies are deliberately left as they are: "Users can update their
-- own profile" still restricts a self-update to the own row, and the 020 column
-- grants still restrict it to full_name/avatar_url. SELECT stays granted; RLS on
-- the row level still limits it to the own organization.
--
-- Apply via Supabase MCP only — this project is production.

BEGIN;

REVOKE INSERT, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON public.profiles FROM anon, authenticated;

COMMIT;
