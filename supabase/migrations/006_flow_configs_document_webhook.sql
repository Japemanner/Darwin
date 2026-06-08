-- Darwin Document Processing Webhook
-- Migration 006: Extend flow_configs for document_processing flow type
--
-- Changes:
-- 1. flow_type CHECK: add 'document_processing'
-- 2. UNIQUE constraint: change from (flow_type) to (flow_type, organization_id)
--    so multiple organizations can each have their own rag_chat and document_processing config

BEGIN;

ALTER TABLE flow_configs DROP CONSTRAINT flow_configs_flow_type_check;
ALTER TABLE flow_configs ADD CONSTRAINT flow_configs_flow_type_check
  CHECK (flow_type IN ('rag_chat', 'document_processing'));

ALTER TABLE flow_configs DROP CONSTRAINT flow_configs_flow_type_key;
ALTER TABLE flow_configs ADD CONSTRAINT flow_configs_flow_type_org_unique
  UNIQUE (flow_type, organization_id);

COMMIT;