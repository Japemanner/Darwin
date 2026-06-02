-- Darwin Chat Feedback — Duimpjes
-- Migration 004: feedback_interactions table for per-conversation user ratings
--
-- Rules:
-- - One rating per user per conversation (UNIQUE constraint)
-- - thumbs_up = true → positive feedback, feedback text is NULL
-- - thumbs_up = false → negative feedback, feedback text is REQUIRED
-- - RLS: users can only insert/read their own feedback; admins can read all

CREATE TABLE IF NOT EXISTS feedback_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  assistant_id uuid NOT NULL REFERENCES ai_assistants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  thumbs_up boolean NOT NULL,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT one_feedback_per_user_per_conversation UNIQUE (conversation_id, user_id)
);

ALTER TABLE feedback_interactions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON feedback_interactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback
CREATE POLICY "Users can read own feedback"
  ON feedback_interactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all feedback in their organization
CREATE POLICY "Admins can read org feedback"
  ON feedback_interactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = feedback_interactions.organization_id
        AND profiles.role = 'admin'
    )
  );
