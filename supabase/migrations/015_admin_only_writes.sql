-- Admin-only management writes
-- Migration 015 (feature 010-admin-only-management, specs/010-admin-only-management/)
--
-- Restricts INSERT/UPDATE/DELETE on all management tables to org admins
-- (profiles.role = 'admin'). Members (advisors) keep read access within
-- their own organization and full access to their own conversations,
-- messages and feedback (unchanged policies).
--
-- Replaces the permissive org-based write policies from:
--   001_initial_schema.sql (ai_assistants, knowledge_bases)
--   002_rag_assistant_management.sql (knowledge_items)
--   007_multitenancy_hardening.sql (knowledge_base_documents,
--     assistant_knowledge_bases, storage.objects on bucket 'knowledge-documents')
--
-- The storage UPDATE hardening is deliberate: without it, a member could
-- overwrite an existing document via storage update and thereby bypass
-- the upload denial — the same hole through a different operation.
--
-- Full before/after matrix: specs/010-admin-only-management/data-model.md

BEGIN;

-- ============================================================
-- Helper: is the current user an admin?
-- ============================================================
-- Same pattern as get_user_org_id() (001): STABLE so the planner can cache
-- it within a statement, SECURITY DEFINER so calling policies have no RLS
-- dependency on profiles (no recursion risk — profiles policies do not
-- reference the management tables).

CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- ai_assistants: writes are admin-only
-- ============================================================
-- SELECT stays unchanged ("Users can view assistants in their org").

DROP POLICY IF EXISTS "Users can create assistants in their org" ON ai_assistants;
DROP POLICY IF EXISTS "Users can update assistants in their org" ON ai_assistants;
DROP POLICY IF EXISTS "Users can delete assistants in their org" ON ai_assistants;

CREATE POLICY "Admins can create assistants in their org"
  ON ai_assistants FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND is_org_admin());

CREATE POLICY "Admins can update assistants in their org"
  ON ai_assistants FOR UPDATE
  USING (organization_id = get_user_org_id() AND is_org_admin())
  WITH CHECK (organization_id = get_user_org_id() AND is_org_admin());

CREATE POLICY "Admins can delete assistants in their org"
  ON ai_assistants FOR DELETE
  USING (organization_id = get_user_org_id() AND is_org_admin());

-- ============================================================
-- knowledge_bases: writes are admin-only
-- ============================================================
-- SELECT stays unchanged ("Users can view knowledge bases in their org").

DROP POLICY IF EXISTS "Users can create knowledge bases in their org" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can update knowledge bases in their org" ON knowledge_bases;
DROP POLICY IF EXISTS "Users can delete knowledge bases in their org" ON knowledge_bases;

CREATE POLICY "Admins can create knowledge bases in their org"
  ON knowledge_bases FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND is_org_admin());

CREATE POLICY "Admins can update knowledge bases in their org"
  ON knowledge_bases FOR UPDATE
  USING (organization_id = get_user_org_id() AND is_org_admin())
  WITH CHECK (organization_id = get_user_org_id() AND is_org_admin());

CREATE POLICY "Admins can delete knowledge bases in their org"
  ON knowledge_bases FOR DELETE
  USING (organization_id = get_user_org_id() AND is_org_admin());

-- ============================================================
-- knowledge_base_documents: writes are admin-only
-- ============================================================
-- SELECT stays unchanged ("Users can view documents in their org").
-- UPDATE has no policy (default deny) — same as before this migration;
-- document status transitions are written by the service role (Darwin API).

DROP POLICY IF EXISTS "Users can insert documents in their org" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Users can delete documents in their org" ON knowledge_base_documents;

CREATE POLICY "Admins can insert documents in their org"
  ON knowledge_base_documents FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND is_org_admin());

CREATE POLICY "Admins can delete documents in their org"
  ON knowledge_base_documents FOR DELETE
  USING (organization_id = get_user_org_id() AND is_org_admin());

-- ============================================================
-- knowledge_items: writes are admin-only
-- ============================================================
-- SELECT stays unchanged ("Users can view knowledge items in their org").
-- UPDATE has no policy (default deny) — same as before this migration.

DROP POLICY IF EXISTS "Users can insert knowledge items in their org" ON knowledge_items;
DROP POLICY IF EXISTS "Users can delete knowledge items in their org" ON knowledge_items;

CREATE POLICY "Admins can insert knowledge items in their org"
  ON knowledge_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = knowledge_items.knowledge_base_id
        AND knowledge_bases.organization_id = get_user_org_id()
    )
    AND is_org_admin()
  );

CREATE POLICY "Admins can delete knowledge items in their org"
  ON knowledge_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = knowledge_items.knowledge_base_id
        AND knowledge_bases.organization_id = get_user_org_id()
    )
    AND is_org_admin()
  );

-- ============================================================
-- assistant_knowledge_bases: writes are admin-only
-- ============================================================
-- SELECT stays unchanged ("Users can view links in their org", 007 C4
-- validates BOTH the assistant and the KB org).

DROP POLICY IF EXISTS "Users can create links in their org" ON assistant_knowledge_bases;
DROP POLICY IF EXISTS "Users can delete links in their org" ON assistant_knowledge_bases;

CREATE POLICY "Admins can create links in their org"
  ON assistant_knowledge_bases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_assistants
      WHERE ai_assistants.id = assistant_knowledge_bases.assistant_id
        AND ai_assistants.organization_id = get_user_org_id()
    )
    AND EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = assistant_knowledge_bases.knowledge_base_id
        AND knowledge_bases.organization_id = get_user_org_id()
    )
    AND is_org_admin()
  );

CREATE POLICY "Admins can delete links in their org"
  ON assistant_knowledge_bases FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ai_assistants
      WHERE ai_assistants.id = assistant_knowledge_bases.assistant_id
        AND ai_assistants.organization_id = get_user_org_id()
    )
    AND EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = assistant_knowledge_bases.knowledge_base_id
        AND knowledge_bases.organization_id = get_user_org_id()
    )
    AND is_org_admin()
  );

-- ============================================================
-- Storage bucket 'knowledge-documents': uploads and deletes are admin-only
-- ============================================================
-- SELECT stays unchanged ("Users can read documents from their org path")
-- so members keep read access within their org path.

DROP POLICY IF EXISTS "Users can upload documents to their org path" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents from their org path" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents in their org path" ON storage.objects;

CREATE POLICY "Admins can upload documents to their org path"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
    AND is_org_admin()
  );

CREATE POLICY "Admins can delete documents from their org path"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
    AND is_org_admin()
  );

CREATE POLICY "Admins can update documents in their org path"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
    AND is_org_admin()
  )
  WITH CHECK (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
    AND is_org_admin()
  );

COMMIT;