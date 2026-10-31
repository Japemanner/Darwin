-- 022_team_management.sql
-- Feature 020-team-management (specs/020-team-management/).
--
-- Adds profiles.email/status, makes the organization helpers block-aware,
-- hardens the policies that do not use those helpers, and adds the two
-- server-side functions for activation and team updates.
--
-- Apply only after explicit confirmation. The migration is additive except for
-- the helper replacements and the policy drop/recreates.

BEGIN;

-- ============================================================
-- 1. profiles: email and status
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN email text;
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('invited', 'active', 'blocked'));

UPDATE public.profiles p
SET email = lower(u.email)
FROM auth.users u
WHERE u.id = p.id AND p.email IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email IS NULL) THEN
    RAISE EXCEPTION 'profile without an auth.users e-mail';
  END IF;
END;
$$;

ALTER TABLE public.profiles ALTER COLUMN email SET NOT NULL;

CREATE UNIQUE INDEX profiles_email_lower_key
  ON public.profiles (lower(email));

-- The hotfix (020_profiles_update_columns.sql) already restricts self-update to
-- full_name/avatar_url. Re-assert it so the new columns never become writable.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

-- ============================================================
-- 2. Profile insert fallback
-- ============================================================
-- Older functions may still insert a profile without the new columns during the
-- release window. The trigger fills the e-mail from auth.users; the default
-- handles status.

CREATE OR REPLACE FUNCTION public.set_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    NEW.email := (SELECT u.email FROM auth.users u WHERE u.id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profile_email_before_insert ON public.profiles;
CREATE TRIGGER set_profile_email_before_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_email();

-- ============================================================
-- 3. Block-aware helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND status <> 'blocked'
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status <> 'blocked'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    JOIN public.profiles p ON p.id = pa.user_id
    WHERE pa.user_id = auth.uid()
      AND p.status <> 'blocked'
  )
$$;

-- ============================================================
-- 4. Policies that do not use the helpers
-- ============================================================
-- Each policy keeps its name. A drop/recreate is required: an ALTER would leave
-- the old permissive expression OR-ed with the new one.

-- conversations
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (user_id = auth.uid() AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
CREATE POLICY "Users can delete their own conversations"
  ON public.conversations FOR DELETE
  USING (user_id = auth.uid() AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (user_id = auth.uid() AND get_user_org_id() IS NOT NULL)
  WITH CHECK (user_id = auth.uid() AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (user_id = auth.uid() AND get_user_org_id() IS NOT NULL);

-- messages
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
        AND public.conversations.user_id = auth.uid()
    )
    AND get_user_org_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE public.conversations.id = public.messages.conversation_id
        AND public.conversations.user_id = auth.uid()
    )
    AND get_user_org_id() IS NOT NULL
  );

-- feedback_interactions
DROP POLICY IF EXISTS "Admins can read org feedback" ON public.feedback_interactions;
CREATE POLICY "Admins can read org feedback"
  ON public.feedback_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.organization_id = public.feedback_interactions.organization_id
        AND public.profiles.role = 'admin'
    )
    AND get_user_org_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can insert feedback on own conversation messages" ON public.feedback_interactions;
CREATE POLICY "Users can insert feedback on own conversation messages"
  ON public.feedback_interactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.messages
      JOIN public.conversations ON public.conversations.id = public.messages.conversation_id
      WHERE public.messages.id = public.feedback_interactions.message_id
        AND public.conversations.user_id = auth.uid()
    )
    AND get_user_org_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can read own feedback" ON public.feedback_interactions;
CREATE POLICY "Users can read own feedback"
  ON public.feedback_interactions FOR SELECT
  USING (auth.uid() = user_id AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own feedback" ON public.feedback_interactions;
CREATE POLICY "Users can update own feedback"
  ON public.feedback_interactions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.messages
      JOIN public.conversations ON public.conversations.id = public.messages.conversation_id
      WHERE public.messages.id = public.feedback_interactions.message_id
        AND public.conversations.user_id = auth.uid()
    )
    AND get_user_org_id() IS NOT NULL
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.messages
      JOIN public.conversations ON public.conversations.id = public.messages.conversation_id
      WHERE public.messages.id = public.feedback_interactions.message_id
        AND public.conversations.user_id = auth.uid()
    )
    AND get_user_org_id() IS NOT NULL
  );

-- feature_requests
DROP POLICY IF EXISTS "Admins can update feature requests" ON public.feature_requests;
CREATE POLICY "Admins can update feature requests"
  ON public.feature_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
    AND get_user_org_id() IS NOT NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
    AND get_user_org_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Admins can view all feature requests" ON public.feature_requests;
CREATE POLICY "Admins can view all feature requests"
  ON public.feature_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
    AND get_user_org_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Authenticated users can submit feature requests" ON public.feature_requests;
CREATE POLICY "Authenticated users can submit feature requests"
  ON public.feature_requests FOR INSERT
  WITH CHECK (auth.uid() = submitted_by AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own feature requests" ON public.feature_requests;
CREATE POLICY "Users can view own feature requests"
  ON public.feature_requests FOR SELECT
  USING (auth.uid() = submitted_by AND get_user_org_id() IS NOT NULL);

-- push_subscriptions
DROP POLICY IF EXISTS "Users can create own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can create own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id AND get_user_org_id() IS NOT NULL);

-- roadmap_features
DROP POLICY IF EXISTS "Admins can create roadmap features" ON public.roadmap_features;
CREATE POLICY "Admins can create roadmap features"
  ON public.roadmap_features FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
    AND get_user_org_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Admins can delete roadmap features" ON public.roadmap_features;
CREATE POLICY "Admins can delete roadmap features"
  ON public.roadmap_features FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
    AND get_user_org_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Admins can update roadmap features" ON public.roadmap_features;
CREATE POLICY "Admins can update roadmap features"
  ON public.roadmap_features FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
    AND get_user_org_id() IS NOT NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
    )
    AND get_user_org_id() IS NOT NULL
  );

DROP POLICY IF EXISTS "Authenticated users can view roadmap features" ON public.roadmap_features;
CREATE POLICY "Authenticated users can view roadmap features"
  ON public.roadmap_features FOR SELECT
  USING (auth.uid() IS NOT NULL AND get_user_org_id() IS NOT NULL);

-- roadmap_votes
DROP POLICY IF EXISTS "Users can delete own votes" ON public.roadmap_votes;
CREATE POLICY "Users can delete own votes"
  ON public.roadmap_votes FOR DELETE
  USING (auth.uid() = user_id AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert own votes" ON public.roadmap_votes;
CREATE POLICY "Users can insert own votes"
  ON public.roadmap_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own votes" ON public.roadmap_votes;
CREATE POLICY "Users can update own votes"
  ON public.roadmap_votes FOR UPDATE
  USING (auth.uid() = user_id AND get_user_org_id() IS NOT NULL)
  WITH CHECK (auth.uid() = user_id AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view own votes" ON public.roadmap_votes;
CREATE POLICY "Users can view own votes"
  ON public.roadmap_votes FOR SELECT
  USING (auth.uid() = user_id AND get_user_org_id() IS NOT NULL);

-- profiles: self-update (SELECT uses get_user_org_id and needs no edit)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() AND get_user_org_id() IS NOT NULL)
  WITH CHECK (id = auth.uid() AND get_user_org_id() IS NOT NULL);

-- storage.objects: the four orphaned bucket-only policies
DROP POLICY IF EXISTS "Users can delete org's storage objects" ON storage.objects;
CREATE POLICY "Users can delete org's storage objects"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert org's storage objects" ON storage.objects;
CREATE POLICY "Users can insert org's storage objects"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can select org's storage objects" ON storage.objects;
CREATE POLICY "Users can select org's storage objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update org's storage objects" ON storage.objects;
CREATE POLICY "Users can update org's storage objects"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL)
  WITH CHECK (bucket_id = 'knowledge-documents' AND get_user_org_id() IS NOT NULL);

-- ============================================================
-- 5. Activation
-- ============================================================

CREATE OR REPLACE FUNCTION public.activate_own_profile()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET status = 'active'
  WHERE id = auth.uid()
    AND status = 'invited'
$$;

REVOKE EXECUTE ON FUNCTION public.activate_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_own_profile() TO authenticated;

-- ============================================================
-- 6. Team updates
-- ============================================================

CREATE OR REPLACE FUNCTION public.team_update_member(
  p_actor uuid,
  p_org uuid,
  p_target uuid,
  p_role text,
  p_status text
) RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_actor_platform boolean;
  v_actor_admin boolean;
  v_other_active_admin boolean;
  v_new_role text;
  v_new_status text;
BEGIN
  -- Serialize two admins who try to block/demote each other. The second
  -- transaction waits and then sees the committed state.
  PERFORM 1
  FROM public.profiles
  WHERE organization_id = p_org
    AND role = 'admin'
  FOR UPDATE;

  -- Platform administrator (not blocked) or active admin in this organization.
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    JOIN public.profiles p ON p.id = pa.user_id
    WHERE pa.user_id = p_actor
      AND p.status <> 'blocked'
  ) INTO v_actor_platform;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_actor
      AND organization_id = p_org
      AND role = 'admin'
      AND status = 'active'
  ) INTO v_actor_admin;

  IF NOT (v_actor_platform OR v_actor_admin) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FORBIDDEN';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_target
    AND organization_id = p_org;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_FOUND';
  END IF;

  IF p_target = p_actor THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SELF';
  END IF;

  -- A non-platform actor may not touch a platform administrator.
  IF NOT v_actor_platform AND EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = p_target
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FORBIDDEN';
  END IF;

  v_new_role := COALESCE(p_role, v_target.role);
  v_new_status := COALESCE(p_status, v_target.status);

  -- A change that removes the last active admin is refused. The target must
  -- currently be an active admin and the proposed state must not be.
  IF v_target.role = 'admin' AND v_target.status = 'active'
     AND (v_new_role <> 'admin' OR v_new_status <> 'active') THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE organization_id = p_org
        AND role = 'admin'
        AND status = 'active'
        AND id <> p_target
    ) INTO v_other_active_admin;

    IF NOT v_other_active_admin THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LAST_ADMIN';
    END IF;
  END IF;

  UPDATE public.profiles
  SET role = v_new_role,
      status = v_new_status
  WHERE id = p_target
    AND organization_id = p_org
  RETURNING * INTO v_target;

  RETURN v_target;
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.team_update_member(uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.team_update_member(uuid, uuid, uuid, text, text)
  TO service_role;

-- ============================================================
-- 7. Existing organizations keep an active admin
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.organization_id = o.id
        AND p.role = 'admin'
        AND p.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'organization without an active admin';
  END IF;
END;
$$;

COMMIT;
