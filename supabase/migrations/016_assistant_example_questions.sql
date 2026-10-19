-- 016_assistant_example_questions.sql
-- Feature 011-resumable-chat-page: per-assistant example questions shown in the
-- empty state of a new conversation (max 4, entered by the admin one per line).
-- Additive column; existing rows default to an empty list. No RLS change needed:
-- column access follows the existing ai_assistants policies (SELECT org-wide,
-- writes admin-only since 015_admin_only_writes.sql).

ALTER TABLE ai_assistants
  ADD COLUMN IF NOT EXISTS example_questions TEXT[] NOT NULL DEFAULT '{}';