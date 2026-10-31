-- Knowledge source manageability
-- Migration 018 (feature 016-knowledge-source-manageability)
--
-- Adds an optional error reason written by the n8n ingest flow and a
-- per-knowledge-base aggregate view for the card statistics.
--
-- No existing column, row or policy is changed. The document UPDATE path
-- stays closed for clients (migration 015): status transitions are written
-- by the service role in the document-webhook edge function.

BEGIN;

-- Optional failure reason; empty means the UI shows a generic Dutch text.
ALTER TABLE public.knowledge_base_documents
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- One row per knowledge base, including sources without documents.
-- security_invoker keeps the RLS of knowledge_bases and
-- knowledge_base_documents in force for the caller.
CREATE OR REPLACE VIEW public.knowledge_base_stats
WITH (security_invoker = true) AS
SELECT
  kb.id AS knowledge_base_id,
  kb.organization_id,
  count(d.id)::int AS document_count,
  count(*) FILTER (WHERE d.status = 'error')::int AS error_count,
  GREATEST(kb.updated_at, COALESCE(MAX(d.updated_at), kb.updated_at)) AS last_updated_at
FROM public.knowledge_bases kb
LEFT JOIN public.knowledge_base_documents d
  ON d.knowledge_base_id = kb.id
GROUP BY kb.id;

REVOKE ALL ON public.knowledge_base_stats FROM anon;
REVOKE ALL ON public.knowledge_base_stats FROM authenticated;
GRANT SELECT ON public.knowledge_base_stats TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
