-- Darwin Knowledge Base Processing Mode
-- Migration 011: Add processing_mode column to knowledge_bases
--
-- Allows knowledge bases to be either 'vectorized' (RAG pipeline) or 'plain_text'
-- (no automatic vectorization, content available as plain text to assistants).
--

ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS processing_mode TEXT NOT NULL DEFAULT 'vectorized'
    CHECK (processing_mode IN ('vectorized', 'plain_text'));

-- No additional RLS policies needed: existing policies scope by organization_id
-- and this column inherits that scoping automatically.