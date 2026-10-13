-- 014_flow_configs_token_lockdown.sql
-- Feature 009-secure-n8n-proxy: the webhook token becomes server-only.
-- Old tokens are considered leaked (the AES key shipped in the public bundle).
-- Apply order at rollout: deploy edge functions -> release frontend ->
-- apply this migration -> re-enter tokens per organization (see
-- specs/009-secure-n8n-proxy/quickstart.md).

-- 1. Wipe the leaked, client-encrypted tokens (they are undecryptable and
--    unrecoverable server-side; org admins re-enter a fresh token).
UPDATE public.flow_configs SET webhook_token = '';

-- 2. Table-level SELECT is revoked for client roles...
REVOKE SELECT ON public.flow_configs FROM anon, authenticated;

-- 3. ...and restored per column, without webhook_token (write-only for admins).
GRANT SELECT (id, flow_type, webhook_url, webhook_auth_header,
              organization_id, created_at, updated_at)
  ON public.flow_configs TO authenticated;

-- anon keeps no SELECT at all on this table.

-- 4. Close a pre-existing policy hole: the UPDATE policy had no WITH CHECK,
--    so an admin of org A could repoint a config row to org B (cross-tenant
--    webhook poisoning). Re-create the policy with WITH CHECK so both the
--    target row AND the new values must stay in the caller's own organization.
DROP POLICY IF EXISTS "Admins can update flow configs" ON public.flow_configs;
CREATE POLICY "Admins can update flow configs"
  ON public.flow_configs FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    organization_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );