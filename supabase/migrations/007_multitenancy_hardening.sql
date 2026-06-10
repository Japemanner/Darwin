-- Darwin Multitenancy Hardening
-- Migration 007: Fix critical multitenancy issues
--
-- C1: handle_new_user() creates a personal org instead of assigning to first org
-- C2: Storage policies on knowledge-documents bucket
-- C3: DELETE RLS policy on conversations
-- C4: assistant_knowledge_bases INSERT/DELETE policies validate KB org too
-- M1: Add organization_id to knowledge_base_documents for direct scoping

BEGIN;

-- ============================================================
-- C1: Fix handle_new_user() — create personal org for each user
-- ============================================================
-- Old behavior: assigns user to (SELECT id FROM organizations LIMIT 1)
-- which puts every new user in the first org — a cross-tenant data leak.
-- New behavior: creates a personal org for each new user.
-- Users who are invited should be handled by the invite flow which
-- updates their profile.organization_id AFTER profile creation.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id UUID;
  invitation_org_id UUID;
  invitation_role TEXT;
BEGIN
  -- Check if there's a pending invitation for this email
  SELECT organization_id, role INTO invitation_org_id, invitation_role
  FROM invitations
  WHERE email = NEW.email
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF invitation_org_id IS NOT NULL THEN
    -- Use the invited org
    INSERT INTO public.profiles (id, organization_id, full_name, role)
    VALUES (
      NEW.id,
      invitation_org_id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
      invitation_role
    );

    -- Mark invitation as accepted
    UPDATE invitations
    SET status = 'accepted', updated_at = now()
    WHERE email = NEW.email
      AND organization_id = invitation_org_id
      AND status = 'pending';
  ELSE
    -- No invitation: create a personal org for the user
    INSERT INTO organizations (name)
    VALUES (COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email) || '''s Organization')
    RETURNING id INTO new_org_id;

    INSERT INTO public.profiles (id, organization_id, full_name, role)
    VALUES (
      NEW.id,
      new_org_id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
      'admin'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- C2: Storage policies for knowledge-documents bucket
-- ============================================================
-- The bucket should be PRIVATE (not public). Signed URLs are used for downloads.
-- Policies enforce that users can only upload/read files in their org's path.

-- Note: The bucket must be created as private in the Supabase Dashboard
-- or via: INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-documents', 'knowledge-documents', false);
-- If the bucket already exists, ensure it is set to private:
-- UPDATE storage.buckets SET public = false WHERE id = 'knowledge-documents';

-- Allow authenticated users to upload files to their org's path
CREATE POLICY "Users can upload documents to their org path"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
  );

-- Allow authenticated users to read files from their org's path
CREATE POLICY "Users can read documents from their org path"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
  );

-- Allow authenticated users to delete files from their org's path
CREATE POLICY "Users can delete documents from their org path"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
  );

-- Allow authenticated users to update files in their org's path
CREATE POLICY "Users can update documents in their org path"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
  )
  WITH CHECK (
    bucket_id = 'knowledge-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_user_org_id()::text
  );

-- ============================================================
-- C3: Add DELETE RLS policy on conversations
-- ============================================================
-- Users can delete their own conversations (needed when deleting an assistant)
CREATE POLICY "Users can delete their own conversations"
  ON conversations FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- C4: Fix assistant_knowledge_bases policies — validate BOTH assistant AND KB org
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can create links in their org" ON assistant_knowledge_bases;
DROP POLICY IF EXISTS "Users can view links in their org" ON assistant_knowledge_bases;
DROP POLICY IF EXISTS "Users can delete links in their org" ON assistant_knowledge_bases;

-- View: both assistant and KB must be in the user's org
CREATE POLICY "Users can view links in their org"
  ON assistant_knowledge_bases FOR SELECT
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
  );

-- Insert: BOTH assistant and KB must be in the user's org
CREATE POLICY "Users can create links in their org"
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
  );

-- Delete: both assistant and KB must be in the user's org
CREATE POLICY "Users can delete links in their org"
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
  );

-- ============================================================
-- M1: Add organization_id column to knowledge_base_documents
-- ============================================================
-- This enables direct scoping without joining through knowledge_bases.
-- Also adds defense-in-depth for RLS and client queries.

ALTER TABLE knowledge_base_documents
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Backfill existing rows
UPDATE knowledge_base_documents d
SET organization_id = kb.organization_id
FROM knowledge_bases kb
WHERE d.knowledge_base_id = kb.id
  AND d.organization_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE knowledge_base_documents
  ALTER COLUMN organization_id SET NOT NULL;

-- Add index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_documents_org
  ON knowledge_base_documents(organization_id);

-- Replace the existing RLS policies to use organization_id directly
DROP POLICY IF EXISTS "Users can view documents in their org" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Users can insert documents in their org" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Users can delete documents in their org" ON knowledge_base_documents;

CREATE POLICY "Users can view documents in their org"
  ON knowledge_base_documents FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Users can insert documents in their org"
  ON knowledge_base_documents FOR INSERT
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Users can delete documents in their org"
  ON knowledge_base_documents FOR DELETE
  USING (organization_id = get_user_org_id());

COMMIT;