-- Darwin platform initial schema
-- Run this migration in the Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

------------------------------------------------------------
-- ORGANIZATIONS
------------------------------------------------------------
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- PROFILES (extends auth.users)
------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- INVITATIONS
------------------------------------------------------------
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- AI ASSISTANTS
------------------------------------------------------------
CREATE TABLE ai_assistants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🤖',
  n8n_webhook_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_assistants ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- KNOWLEDGE BASES
------------------------------------------------------------
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- KNOWLEDGE BASE DOCUMENTS
------------------------------------------------------------
CREATE TABLE knowledge_base_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- ASSISTANT <-> KNOWLEDGE BASE JUNCTION
------------------------------------------------------------
CREATE TABLE assistant_knowledge_bases (
  assistant_id UUID NOT NULL REFERENCES ai_assistants(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (assistant_id, knowledge_base_id)
);

ALTER TABLE assistant_knowledge_bases ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- CONVERSATIONS
------------------------------------------------------------
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  assistant_id UUID NOT NULL REFERENCES ai_assistants(id),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- MESSAGES
------------------------------------------------------------
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- NEW USER HANDLER: auto-create profile when user signs up
------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Attempt to find invitation to determine org
  -- For now, profile is created but organization must be manually set
  -- or the invite-user edge function links them
  INSERT INTO public.profiles (id, organization_id, full_name, role)
  VALUES (
    NEW.id,
    (SELECT id FROM organizations LIMIT 1), -- fallback to first org
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger that fires when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES
------------------------------------------------------------
-- Helper function: get user's organization_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- organizations
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (id = get_user_org_id());

-- profiles
CREATE POLICY "Users can view profiles in their org"
  ON profiles FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- invitations
CREATE POLICY "Admins can view invitations in their org"
  ON invitations FOR SELECT
  USING (
    organization_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert invitations in their org"
  ON invitations FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update invitations in their org"
  ON invitations FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ai_assistants
CREATE POLICY "Users can view assistants in their org"
  ON ai_assistants FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Users can create assistants in their org"
  ON ai_assistants FOR INSERT
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Users can update assistants in their org"
  ON ai_assistants FOR UPDATE
  USING (organization_id = get_user_org_id());

CREATE POLICY "Users can delete assistants in their org"
  ON ai_assistants FOR DELETE
  USING (organization_id = get_user_org_id());

-- knowledge_bases
CREATE POLICY "Users can view knowledge bases in their org"
  ON knowledge_bases FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Users can create knowledge bases in their org"
  ON knowledge_bases FOR INSERT
  WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Users can update knowledge bases in their org"
  ON knowledge_bases FOR UPDATE
  USING (organization_id = get_user_org_id());

CREATE POLICY "Users can delete knowledge bases in their org"
  ON knowledge_bases FOR DELETE
  USING (organization_id = get_user_org_id());

-- knowledge_base_documents
CREATE POLICY "Users can view documents in their org"
  ON knowledge_base_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id
      AND knowledge_bases.organization_id = get_user_org_id()
    )
  );

CREATE POLICY "Users can insert documents in their org"
  ON knowledge_base_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id
      AND knowledge_bases.organization_id = get_user_org_id()
    )
  );

CREATE POLICY "Users can delete documents in their org"
  ON knowledge_base_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id
      AND knowledge_bases.organization_id = get_user_org_id()
    )
  );

-- assistant_knowledge_bases
CREATE POLICY "Users can view links in their org"
  ON assistant_knowledge_bases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_assistants
      WHERE ai_assistants.id = assistant_knowledge_bases.assistant_id
      AND ai_assistants.organization_id = get_user_org_id()
    )
  );

CREATE POLICY "Users can create links in their org"
  ON assistant_knowledge_bases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_assistants
      WHERE ai_assistants.id = assistant_knowledge_bases.assistant_id
      AND ai_assistants.organization_id = get_user_org_id()
    )
  );

CREATE POLICY "Users can delete links in their org"
  ON assistant_knowledge_bases FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM ai_assistants
      WHERE ai_assistants.id = assistant_knowledge_bases.assistant_id
      AND ai_assistants.organization_id = get_user_org_id()
    )
  );

-- conversations
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (user_id = auth.uid());

-- messages
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

------------------------------------------------------------
-- Updated_at trigger function
------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_assistants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON knowledge_bases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON knowledge_base_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
