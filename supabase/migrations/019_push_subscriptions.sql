-- Push subscriptions per user per device (feature 018-push-notifications)
-- Migration 019
--
-- One row per advisor per device/browser profile. The row holds only the
-- browser's push endpoint and its two public subscription keys — never a
-- client reference, client data or analysis content (constitution III).
--
-- RLS: a user reads, creates and deletes only own rows. There is deliberately
-- no UPDATE policy: subscribing is delete-then-insert (specs/018-.../research.md
-- R5), so an UPDATE policy would only widen the surface.
-- Sending happens server-side with the service role (push-send), which
-- bypasses RLS for reading subscriptions and removing expired ones.
--
-- Apply via Supabase MCP only — this project is production
-- (specs/018-push-notifications/quickstart.md §2).

BEGIN;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_user_endpoint_key UNIQUE (user_id, endpoint),
  CONSTRAINT push_subscriptions_endpoint_https CHECK (endpoint ~ '^https://'),
  CONSTRAINT push_subscriptions_endpoint_length CHECK (char_length(endpoint) <= 2048),
  CONSTRAINT push_subscriptions_p256dh_not_empty CHECK (p256dh <> ''),
  CONSTRAINT push_subscriptions_auth_not_empty CHECK (auth <> '')
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can read own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can create own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
