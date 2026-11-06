-- 025_assistant_archive.sql
-- Feature 023-delete-assistants (specs/023-delete-assistants/).
--
-- Deleting an assistant archives it: the catalogue item and every
-- per-organisation row receive the same archived_at timestamp, while
-- conversations, messages, analysis runs, feedback and knowledge-source links
-- stay untouched. Restoring clears both timestamps and keeps every switch.
--
-- Only the service role (the platform-admin Edge Function) may archive or
-- restore. The archive list is read through that function as well, because
-- assistant_catalog has no client grants.

BEGIN;

-- ============================================================
-- 1. Archive state
-- ============================================================

ALTER TABLE public.assistant_catalog
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.ai_assistants
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS ai_assistants_organization_archived_idx
  ON public.ai_assistants (organization_id, archived_at);

-- ============================================================
-- 2. Archive one catalogue assistant for every organisation
-- ============================================================

CREATE OR REPLACE FUNCTION public.platform_archive_catalog_assistant(
  p_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived timestamptz;
BEGIN
  UPDATE public.assistant_catalog
     SET archived_at = now()
   WHERE id = p_id AND archived_at IS NULL
  RETURNING archived_at INTO v_archived;

  IF v_archived IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.assistant_catalog WHERE id = p_id) THEN
      RAISE EXCEPTION 'already_archived';
    END IF;
    RAISE EXCEPTION 'not_found';
  END IF;

  UPDATE public.ai_assistants
     SET archived_at = v_archived
   WHERE catalog_id = p_id AND archived_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.platform_archive_catalog_assistant(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_archive_catalog_assistant(uuid)
  TO service_role;

-- ============================================================
-- 3. Restore one catalogue assistant
-- ============================================================

CREATE OR REPLACE FUNCTION public.platform_restore_catalog_assistant(
  p_id uuid,
  p_actor uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.assistant_catalog
     SET archived_at = NULL
   WHERE id = p_id AND archived_at IS NOT NULL
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.assistant_catalog WHERE id = p_id) THEN
      RAISE EXCEPTION 'not_archived';
    END IF;
    RAISE EXCEPTION 'not_found';
  END IF;

  UPDATE public.ai_assistants
     SET archived_at = NULL
   WHERE catalog_id = v_id;

  -- Organisations created while the assistant was archived have no row yet.
  -- They get one that is OFF, so restoring never switches the assistant on
  -- for them unexpectedly. Existing organisations keep their switch.
  INSERT INTO public.ai_assistants
    (organization_id, catalog_id, name, description, icon, type,
     example_questions, system_prompt, is_active, created_by)
  SELECT o.id, c.id, c.name, c.description, c.icon, c.type,
         c.example_questions, '', false, p_actor
    FROM public.organizations o
    JOIN public.assistant_catalog c ON c.id = v_id
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.ai_assistants a
      WHERE a.organization_id = o.id AND a.catalog_id = v_id
   )
  ON CONFLICT (organization_id, catalog_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.platform_restore_catalog_assistant(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_restore_catalog_assistant(uuid, uuid)
  TO service_role;

-- ============================================================
-- 4. New organisations never receive an archived assistant
-- ============================================================

CREATE OR REPLACE FUNCTION public.platform_seed_org_assistants(
  p_org uuid,
  p_actor uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_assistants
    (organization_id, catalog_id, name, description, icon, type,
     example_questions, system_prompt, is_active, created_by)
  SELECT p_org, c.id, c.name, c.description, c.icon, c.type,
         c.example_questions, '', true, p_actor
    FROM public.assistant_catalog c
   WHERE c.archived_at IS NULL
  ON CONFLICT (organization_id, catalog_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.platform_seed_org_assistants(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_seed_org_assistants(uuid, uuid)
  TO service_role;

COMMIT;
