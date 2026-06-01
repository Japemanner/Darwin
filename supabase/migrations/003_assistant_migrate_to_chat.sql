-- Darwin Assistant Modal Cleanup
-- Migration 003: Migrate existing agent/voice assistants to chat type
--
-- Changes:
-- 1. Update all non-chat assistants to type 'chat'
-- 2. Set n8n_webhook_url to null for migrated assistants (now handled globally via settings)

UPDATE ai_assistants
SET type = 'chat',
    n8n_webhook_url = NULL
WHERE type IN ('agent', 'voice');
