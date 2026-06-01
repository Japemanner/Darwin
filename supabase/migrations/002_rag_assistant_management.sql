-- Darwin RAG Assistant Management
-- Migration 002: Generic RAG architecture with shared webhook config
-- 
-- Changes:
-- 1. ai_assistants: extensible type field, n8n_webhook_url nullable
-- 2. knowledge_bases: vector_collection_id for vector DB reference
-- 3. messages: sources JSONB for RAG citations
-- 4. flow_configs: global webhook configuration per flow_type
-- 5. knowledge_items: text-based knowledge items (alongside file-based)
--

-- 1. ALTER EXISTING TABLES

-- ai_assistants: extensible type, n8n_webhook_url nullable
ALTER TABLE ai_assistants
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'chat'
    CHECK (type IN ('chat', 'agent', 'voice'));

ALTER TABLE ai_assistants
  ALTER COLUMN n8n_webhook_url DROP NOT NULL;

-- knowledge_bases: vector collection reference
ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS vector_collection_id TEXT;

-- messages: sources for RAG citations
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sources JSONB;

-- 2. NEW TABLE: flow_configs

CREATE TABLE IF NOT EXISTS flow_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_type TEXT NOT NULL UNIQUE
    CHECK (flow_type IN ('rag_chat')),
  webhook_url TEXT NOT NULL,
  webhook_token TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE flow_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone in org can view flow configs"
  ON flow_configs FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Admins can insert flow configs"
  ON flow_configs FOR INSERT
  WITH CHECK (
    organization_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update flow configs"
  ON flow_configs FOR UPDATE
  USING (
    organization_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete flow configs"
  ON flow_configs FOR DELETE
  USING (
    organization_id = get_user_org_id()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON flow_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. NEW TABLE: knowledge_items

CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  embedding_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'processing', 'done', 'failed')),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view knowledge items in their org"
  ON knowledge_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = knowledge_items.knowledge_base_id
      AND knowledge_bases.organization_id = get_user_org_id()
    )
  );

CREATE POLICY "Users can insert knowledge items in their org"
  ON knowledge_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = knowledge_items.knowledge_base_id
      AND knowledge_bases.organization_id = get_user_org_id()
    )
  );

CREATE POLICY "Users can delete knowledge items in their org"
  ON knowledge_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_bases
      WHERE knowledge_bases.id = knowledge_items.knowledge_base_id
      AND knowledge_bases.organization_id = get_user_org_id()
    )
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON knowledge_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
