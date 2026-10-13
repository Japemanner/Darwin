# Data Model: 009-secure-n8n-proxy

**Date**: 2026-10-13 | **Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Scope

No new tables, no new columns. The change is a privilege lockdown of
`flow_configs` plus a one-time wipe of the leaked webhook tokens, delivered in
one migration.

## Migration `supabase/migrations/014_flow_configs_token_lockdown.sql`

```sql
-- 014_flow_configs_token_lockdown.sql
-- Feature 009-secure-n8n-proxy: the webhook token becomes server-only.
-- Old tokens are considered leaked (the AES key shipped in the public bundle).

-- 1. Wipe the leaked, client-encrypted tokens (they are undecryptable and
--    unrecoverable server-side; org admins re-enter a fresh token).
UPDATE public.flow_configs SET webhook_token = '';

-- 2. Table-level SELECT is revoked for client roles…
REVOKE SELECT ON public.flow_configs FROM anon, authenticated;

-- 3. …and restored per column, without webhook_token:
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
```

## Effect per role

| Role | SELECT | INSERT / UPDATE / DELETE |
|------|--------|---------------------------|
| `anon` | none (RLS had none anyway) | none |
| `authenticated` | all columns **except `webhook_token`** (write-only: the column can still be written by admins, never read) | unchanged: RLS admin policies (`profiles.role = 'admin'` + org match, migrations 002:45-68) |
| service role (Edge Functions) | full access (bypasses grants and RLS) | full access |
| PostgREST | volgt de grants hierboven — `select=*` omvat `webhook_token` en wordt voor client-rollen geblokkeerd of laat de kolom stil weg (gedrag verschilt per PostgREST-versie; bij de rollout verifiëren — SC-004 geldt in beide gevallen) | — |

## RLS policies

Unchanged. The four existing policies (002:45-68) stay in place; column grants
are the finer lock on `webhook_token`. After this migration RLS is still
enabled on `flow_configs` (constitution/AGENTS.md rule 1 is unaffected).

## TypeScript types

`src/types/database.types.ts` keeps `flow_configs.webhook_token` in
Row/Insert/Update — the column still exists and is written via the
`flow-config` Edge Function. Na deze feature resteert er geen enkele
`flow_configs`-query in de frontend: de hooks `useFlowConfig` en
`useSaveFlowConfig` (`src/hooks/queries.ts`; enige consumer is
`SettingsPage.tsx`) worden verwijderd — alle lees-, schrijf- en
testverzoeken gaan via de `flow-config` Edge Function. Daarmee verdwijnt
ook het risico van een unqualified `.select()` die `webhook_token`
terug-leest.

## Storage

`knowledge-documents` bucket (private) unchanged. Signed URLs (900 s) for
document processing are now created server-side by the `document-webhook`
Edge Function instead of in the browser.

## Edge Function secrets (Supabase MCP / `supabase secrets set`)

| Secret | Used by | Notes |
|--------|---------|-------|
| `VITE_SUPABASE_URL` (fallback `SUPABASE_URL`) | all three new functions | platform-default bestaat al; de functies lezen de VITE_-variant het eerst |
| `VITE_SUPABASE_ANON_KEY` (fallback `SUPABASE_ANON_KEY`) | all three new functions | voor de user-context client die het Authorization-header van de gebruiker doorgeeft, zodat RLS geldt |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` (fallback `SUPABASE_SERVICE_ROLE_KEY`) | all three new functions | alleen voor `flow_configs`-lees/schrijf, adminchecks via profiles en signed URL's. **Nooit** een VITE_-variant hiervan in Netlify zetten — daar belandt die in de publieke bundel; in Supabase-secrets is de VITE_-naam onschadelijk |
| `ALLOWED_ORIGINS` | all three new functions | **nieuw** — komma-gescheiden origins voor CORS; `*` is verboden (technische route A2); fail-closed: niet gezet/geen match → geen ACAO-header |

`VITE_ENCRYPTION_KEY` leaves the frontend for good: removed from
`src/vite-env.d.ts` and `.env.example`; to be deleted from the Netlify
environment during rollout (see quickstart.md).

## Deployment constraint

This Supabase project is production. Release order (quickstart.md):
1. deploy Edge Functions, 2. release frontend to main, 3. apply this
migration, 4. re-enter tokens per organization. Applying the migration while
the old frontend (which selects `*`) is live breaks chat.