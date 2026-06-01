# Data Model: RAG Assistant Management

**Feature**: 002-rag-assistant-management | **Date**: 2026-05-30

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌──────────────────────────┐
│   ai_assistants      │       │  assistant_knowledge_bases │
│─────────────────────│       │──────────────────────────│
│ id (uuid) PK        │──1:N──│ assistant_id (uuid) FK    │
│ organization_id FK   │       │ knowledge_base_id (uuid) FK│
│ name (text)          │       │ created_at                 │
│ type (text)      ★NEW│       └──────────┬───────────────┘
│ system_prompt (text) │                  │
│ icon (text)          │       ┌──────────▼───────────────┐
│ n8n_webhook_url NULL★│       │    knowledge_bases        │
│ is_active (bool)     │       │──────────────────────────│
│ created_by FK        │       │ id (uuid) PK              │
│ created_at/updated_at│       │ organization_id FK         │
└──────────┬───────────┘       │ name (text)                │
           │                   │ description (text)         │
           │                   │ vector_collection_id  ★NEW │
           │                   │ created_by FK              │
           │                   │ created_at/updated_at       │
           │                   └──────┬──────────┬──────────┘
           │                          │          │
┌──────────▼───────────┐   ┌────────▼────┐ ┌───▼──────────────┐
│    conversations      │   │knowledge_items│ │knowledge_base_   │
│──────────────────────│   │     ★NEW      │ │   documents      │
│ id (uuid) PK         │   │─────────────│ │──────────────────│
│ user_id FK           │   │ id (uuid) PK │ │ id (uuid) PK     │
│ assistant_id FK      │   │ kb_id FK     │ │ kb_id FK         │
│ title (text)         │   │ title (text) │ │ name (text)      │
│ created_at/updated_at│   │ content (text)│ │ file_path (text) │
└──────────┬───────────┘   │ source_url?  │ │ file_type (text) │
           │               │ embed_status │ │ file_size (bigint)│
┌──────────▼───────────┐   │ created_at   │ │ status (text)    │
│      messages         │   └─────────────┘ │ created_by FK    │
│──────────────────────│                    │ created_at       │
│ id (uuid) PK         │                    └──────────────────┘
│ conversation_id FK   │
│ role (text)           │
│ content (text)        │
│ sources (jsonb)  ★NEW │
│ created_at            │
└───────────────────────┘

┌───────────────────────┐
│     flow_configs  ★NEW │
│───────────────────────│
│ id (uuid) PK           │
│ flow_type (text) UNIQUE│
│ webhook_url (text)     │
│ webhook_token (text)   │  ← AES-256-GCM encrypted
│ organization_id FK     │
│ created_at/updated_at  │
└───────────────────────┘
```

## Migration DDL (002_rag_assistant_management.sql)

### 1. Alter bestaande tables

```sql
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
```

### 2. Nieuwe table: flow_configs

```sql
CREATE TABLE flow_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
```

### 3. Nieuwe table: knowledge_items

```sql
CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
```

## TypeScript Type Updates

### `src/types/database.types.ts` — toevoegingen

```typescript
// In ai_assistants Row/Insert/Update: voeg toe
type: 'chat' | 'agent' | 'voice'

// In knowledge_bases Row/Insert/Update: voeg toe
vector_collection_id: string | null

// In messages Row/Insert/Update: voeg toe
sources: Record<string, unknown> | null

// Nieuwe table entries:
flow_configs: {
  Row: {
    id: string
    flow_type: 'rag_chat'
    webhook_url: string
    webhook_token: string
    organization_id: string
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    flow_type: 'rag_chat'
    webhook_url: string
    webhook_token: string
    organization_id: string
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    flow_type?: 'rag_chat'
    webhook_url?: string
    webhook_token?: string
    organization_id?: string
    created_at?: string
    updated_at?: string
  }
}
knowledge_items: {
  Row: {
    id: string
    knowledge_base_id: string
    title: string
    content: string
    source_url: string | null
    embedding_status: 'pending' | 'processing' | 'done' | 'failed'
    created_by: string
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    knowledge_base_id: string
    title: string
    content: string
    source_url?: string | null
    embedding_status?: 'pending' | 'processing' | 'done' | 'failed'
    created_by: string
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    knowledge_base_id?: string
    title?: string
    content?: string
    source_url?: string | null
    embedding_status?: 'pending' | 'processing' | 'done' | 'failed'
    created_by?: string
    created_at?: string
    updated_at?: string
  }
}
```
