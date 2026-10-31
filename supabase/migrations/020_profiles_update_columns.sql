-- Restrict self-update on profiles to non-privileged, self-owned fields.
-- The RLS policy "Users can update their own profile" (001) only checks id = auth.uid(),
-- so without column grants any authenticated user could set role = 'admin' or move
-- themselves into another organization_id and read that tenant's data.

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;
