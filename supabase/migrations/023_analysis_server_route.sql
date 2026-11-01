-- 023_analysis_server_route.sql
-- Feature 021: server-side risk-analysis runs.
--
-- analysis_runs is written only by Edge Functions (service role); clients can
-- only read their own rows. Dossiers live in a private bucket under
-- {organization_id}/{advisor_id}/{run_id}.docx.
--
-- The daily cleanup schedule is NOT in this migration: the function URL and the
-- cleanup secret only exist after deploy and must never live in the repo.

-- ============================================================
-- 1. analysis_runs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analysis_runs (
  id uuid PRIMARY KEY,
  assistant_id uuid NOT NULL REFERENCES public.ai_assistants(id) ON DELETE CASCADE,
  advisor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_reference text NOT NULL CHECK (length(btrim(client_reference)) > 0),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error_code text,
  error_message text,
  result_json jsonb,
  intern_markdown text,
  dossier_path text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analysis_runs_advisor_started_idx
  ON public.analysis_runs (advisor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS analysis_runs_expires_idx
  ON public.analysis_runs (expires_at);

ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Advisors can view own analysis runs" ON public.analysis_runs;
CREATE POLICY "Advisors can view own analysis runs"
  ON public.analysis_runs FOR SELECT
  USING (advisor_id = auth.uid() AND organization_id = get_user_org_id());

-- No INSERT/UPDATE/DELETE policies: writes happen only with the service role.
REVOKE ALL ON public.analysis_runs FROM anon, authenticated;
GRANT SELECT ON public.analysis_runs TO authenticated;

-- ============================================================
-- 2. Private dossier bucket + owner-only read policy
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('analysis-dossiers', 'analysis-dossiers', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Advisors can read own analysis dossiers" ON storage.objects;
CREATE POLICY "Advisors can read own analysis dossiers"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'analysis-dossiers'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================================
-- 3. Scheduler extensions for the daily cleanup
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
