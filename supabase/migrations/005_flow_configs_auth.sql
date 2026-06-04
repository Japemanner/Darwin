-- Darwin Flow Config Auth Improvements
-- Migration 005: Add webhook_auth_header, relax webhook_token constraint
--
-- Changes:
-- 1. webhook_token: allow empty string (for webhooks without auth)
-- 2. webhook_auth_header: custom header name for webhook authentication (default: X-Webhook-Token)

-- Allow empty webhook_token (webhooks without auth)
ALTER TABLE flow_configs ALTER COLUMN webhook_token SET DEFAULT '';

-- Add webhook_auth_header column for custom auth header name
ALTER TABLE flow_configs ADD COLUMN webhook_auth_header TEXT NOT NULL DEFAULT 'X-Webhook-Token';