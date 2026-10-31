-- 021_platform_admin_catalog.sql
-- Feature 019-platform-assistant-catalog (specs/019-platform-assistant-catalog/).
--
-- Turns assistants into one platform-wide catalogue with a per-organization
-- switch, moves the n8n connection settings to a single write-only row, and
-- restricts all management to platform admins.
--
-- Rollout order (quickstart.md): apply this migration, deploy the Edge
-- Functions, release the frontend, then remove the deployed flow-config
-- function manually.
--
-- BEFORE APPLYING: the platform administrator address is filled in below
-- (jaap@jaaphoeve.com). The migration aborts when that account or its profiles
-- row does not exist.

BEGIN;

-- ============================================================
-- 1. Platform admins (table outside profiles on purpose)
-- ============================================================
-- profiles.role only allows admin|member and "Users can update their own
-- profile" would let a user self-escalate a role value. A separate table with
-- RLS enabled and no policies cannot be read or written by client roles.

CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ============================================================
-- 2. Assistant catalogue (source of truth for the definition)
-- ============================================================

CREATE TABLE public.assistant_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '🤖',
  type text NOT NULL CHECK (type IN ('chat', 'agent', 'voice', 'risico_analyse')),
  example_questions text[] NOT NULL DEFAULT '{}',
  test_webhook_url text,
  prod_webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_catalog FROM anon, authenticated;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.assistant_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. Central n8n connection (exactly one row, token write-only)
-- ============================================================

CREATE TABLE public.platform_webhook_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auth_header text NOT NULL DEFAULT 'X-Webhook-Token',
  token text NOT NULL DEFAULT '',
  document_webhook_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_webhook_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_webhook_config FROM anon, authenticated;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.platform_webhook_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 4. Link the existing per-organization rows to the catalogue
-- ============================================================

ALTER TABLE public.ai_assistants
  ADD COLUMN catalog_id uuid REFERENCES public.assistant_catalog(id);

ALTER TABLE public.ai_assistants
  ADD CONSTRAINT ai_assistants_organization_id_catalog_id_key
  UNIQUE (organization_id, catalog_id);

-- ============================================================
-- 5. No client role may write ai_assistants anymore
-- ============================================================
-- Three policies from 015_admin_only_writes.sql and three orphaned permissive
-- policies that only exist in the live database (they OR with the admin
-- policies, so without this drop every org member could still write).

DROP POLICY IF EXISTS "Admins can create assistants in their org" ON public.ai_assistants;
DROP POLICY IF EXISTS "Admins can update assistants in their org" ON public.ai_assistants;
DROP POLICY IF EXISTS "Admins can delete assistants in their org" ON public.ai_assistants;
DROP POLICY IF EXISTS "Users can create assistants" ON public.ai_assistants;
DROP POLICY IF EXISTS "Users can update assistants" ON public.ai_assistants;
DROP POLICY IF EXISTS "Users can delete assistants" ON public.ai_assistants;

-- "Users can view assistants" (SELECT, own organization) stays unchanged, as do
-- all policies on assistant_knowledge_bases (office admins keep linking KBs).

-- ============================================================
-- 6. Server-only functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.platform_save_catalog_assistant(
  p_id uuid,
  p_name text,
  p_description text,
  p_icon text,
  p_type text,
  p_example_questions text[],
  p_actor uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_icon text := coalesce(nullif(btrim(coalesce(p_icon, '')), ''), '🤖');
  v_questions text[] := coalesce(p_example_questions, '{}');
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'name_required';
  END IF;
  IF p_type NOT IN ('chat', 'agent', 'voice', 'risico_analyse') THEN
    RAISE EXCEPTION 'invalid_type';
  END IF;
  IF coalesce(array_length(v_questions, 1), 0) > 4 THEN
    RAISE EXCEPTION 'too_many_example_questions';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.assistant_catalog
      (name, description, icon, type, example_questions)
    VALUES
      (v_name, p_description, v_icon, p_type, v_questions)
    RETURNING id INTO v_id;

    -- A new catalogue assistant is ON for every existing organization.
    INSERT INTO public.ai_assistants
      (organization_id, catalog_id, name, description, icon, type,
       example_questions, system_prompt, is_active, created_by)
    SELECT o.id, v_id, v_name, p_description, v_icon, p_type,
           v_questions, '', true, p_actor
    FROM public.organizations o
    ON CONFLICT (organization_id, catalog_id) DO NOTHING;
  ELSE
    UPDATE public.assistant_catalog
       SET name = v_name,
           description = p_description,
           icon = v_icon,
           type = p_type,
           example_questions = v_questions
     WHERE id = p_id
     RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'not_found';
    END IF;

    -- Definition changes apply to every organization.
    UPDATE public.ai_assistants
       SET name = v_name,
           description = p_description,
           icon = v_icon,
           type = p_type,
           example_questions = v_questions
     WHERE catalog_id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.platform_save_catalog_assistant(uuid, text, text, text, text, text[], uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.platform_save_catalog_assistant(uuid, text, text, text, text, text[], uuid)
  TO service_role;

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
  ON CONFLICT (organization_id, catalog_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.platform_seed_org_assistants(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_seed_org_assistants(uuid, uuid) TO service_role;

-- ============================================================
-- 7. Data fill: the confirmed coupling table
-- ============================================================
-- Existing rows (name, type) -> catalogue item:
--   2b3ba047-b9a5-49e8-91ac-11234c99dd3b  Darwin               acceptatie
--   c26d93d8-f709-4b8c-8e0e-5e0b0341dfce  Darwin               Risico analyse
--   52c493c5-75de-4461-bce1-f92b14cc1d5f  Darwin               Schade
--   2854d916-42aa-44d0-9e88-7dd04544c218  Gerard_Tekelenburg   Acceptatiehandboek
--   f49f8190-94b3-4a9b-acf7-732e8c80467f  Gerard_Tekelenburg   Acceptatiehandboek P&Z
-- Production URL for type chat comes from the rag_chat flow config; the
-- risico_analyse assistant has no n8n URL (its flow lives outside n8n).

INSERT INTO public.assistant_catalog (name, type, prod_webhook_url)
SELECT v.name, v.type, v.prod_webhook_url
FROM (VALUES
  ('acceptatie', 'chat', 'https://process.jaaphoeve.com/webhook/e561c3e8-2c61-4272-8dde-50423c85e0b3'),
  ('Acceptatiehandboek', 'chat', 'https://process.jaaphoeve.com/webhook/e561c3e8-2c61-4272-8dde-50423c85e0b3'),
  ('Acceptatiehandboek Particulier en Zakelijk', 'chat', 'https://process.jaaphoeve.com/webhook/e561c3e8-2c61-4272-8dde-50423c85e0b3'),
  ('Risico analyse', 'risico_analyse', NULL),
  ('Schade', 'chat', 'https://process.jaaphoeve.com/webhook/e561c3e8-2c61-4272-8dde-50423c85e0b3')
) AS v(name, type, prod_webhook_url)
WHERE NOT EXISTS (
  SELECT 1 FROM public.assistant_catalog c
  WHERE c.name = v.name AND c.type = v.type
);

UPDATE public.ai_assistants SET catalog_id =
  (SELECT id FROM public.assistant_catalog WHERE name = 'acceptatie' AND type = 'chat')
WHERE id = '2b3ba047-b9a5-49e8-91ac-11234c99dd3b';

UPDATE public.ai_assistants SET catalog_id =
  (SELECT id FROM public.assistant_catalog WHERE name = 'Risico analyse' AND type = 'risico_analyse')
WHERE id = 'c26d93d8-f709-4b8c-8e0e-5e0b0341dfce';

UPDATE public.ai_assistants SET catalog_id =
  (SELECT id FROM public.assistant_catalog WHERE name = 'Schade' AND type = 'chat')
WHERE id = '52c493c5-75de-4461-bce1-f92b14cc1d5f';

UPDATE public.ai_assistants SET catalog_id =
  (SELECT id FROM public.assistant_catalog WHERE name = 'Acceptatiehandboek' AND type = 'chat')
WHERE id = '2854d916-42aa-44d0-9e88-7dd04544c218';

UPDATE public.ai_assistants SET catalog_id =
  (SELECT id FROM public.assistant_catalog
    WHERE name = 'Acceptatiehandboek Particulier en Zakelijk' AND type = 'chat')
WHERE id = 'f49f8190-94b3-4a9b-acf7-732e8c80467f';

-- Fill the missing organization x catalogue combinations as OFF, so every
-- organization keeps exactly the active assistants it had before.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.organization_id = o.id AND p.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'organization without an admin profile';
  END IF;
END;
$$;

INSERT INTO public.ai_assistants
  (organization_id, catalog_id, name, description, icon, type,
   example_questions, system_prompt, is_active, created_by)
SELECT o.id, c.id, c.name, c.description, c.icon, c.type,
       c.example_questions, '', false,
       (SELECT p.id FROM public.profiles p
         WHERE p.organization_id = o.id AND p.role = 'admin'
         ORDER BY p.created_at
         LIMIT 1)
FROM public.organizations o
CROSS JOIN public.assistant_catalog c
ON CONFLICT (organization_id, catalog_id) DO NOTHING;

ALTER TABLE public.ai_assistants ALTER COLUMN catalog_id SET NOT NULL;

-- ============================================================
-- 8. Central connection values (the token never enters this file)
-- ============================================================
-- Copy header and token from a rag_chat row with a non-empty token, and the
-- document URL from a document_processing row. Only SQL touches the token.

INSERT INTO public.platform_webhook_config (id, auth_header, token, document_webhook_url)
SELECT true,
       coalesce((
         SELECT webhook_auth_header FROM public.flow_configs
         WHERE flow_type = 'rag_chat' AND webhook_token <> ''
         ORDER BY updated_at DESC LIMIT 1
       ), 'X-Webhook-Token'),
       coalesce((
         SELECT webhook_token FROM public.flow_configs
         WHERE flow_type = 'rag_chat' AND webhook_token <> ''
         ORDER BY updated_at DESC LIMIT 1
       ), ''),
       (
         SELECT webhook_url FROM public.flow_configs
         WHERE flow_type = 'document_processing'
         ORDER BY updated_at DESC LIMIT 1
       )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 9. The platform administrator
-- ============================================================
-- Fails loudly when the address or its profiles row is missing, instead of
-- leaving the platform without an administrator.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jaap@jaaphoeve.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'platform admin <%> not found in auth.users', 'jaap@jaaphoeve.com';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'platform admin <%> has no profiles row', 'jaap@jaaphoeve.com';
  END IF;

  INSERT INTO public.platform_admins (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

COMMIT;
