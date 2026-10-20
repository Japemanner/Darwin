-- Per-answer feedback and answer provenance
-- Migration 017 (feature 012-per-answer-feedback, specs/012-per-answer-feedback/)
--
-- Part 1 — messages: answer provenance columns (all nullable; NULL for
--   answers saved before this feature).
-- Part 2 — feedback_interactions: per-answer feedback. The conversation-wide
--   rating (004) becomes per-message:
--   - message_id references the rated answer (NULL = legacy conversation-wide
--     row, kept untouched);
--   - reason is a fixed code list (CHECK; CHECK passes when reason IS NULL,
--     so thumbs-up rows stay valid);
--   - updated_at is maintained by the existing house trigger (001).
--   The 004 constraint "one rating per user per conversation" MUST go —
--   it would block rating a second answer in the same conversation. The
--   unique index on (message_id, user_id) takes over: one rating per user
--   per ANSWER. The index is deliberately NOT partial: PostgREST's
--   on_conflict parameter cannot target partial unique indexes (no index
--   predicate support), so the supabase-js upsert would fail with 42P10.
--   NULLs are distinct in Postgres unique indexes, so legacy rows
--   (message_id IS NULL) never conflict — behavior identical to the
--   partial variant (specs/012-per-answer-feedback/research.md #1).
-- Part 3 — RLS: the 004 insert policy only checked user_id, allowing
--   feedback on someone else's conversation. Replaced by a policy that
--   requires the rated message to sit in a conversation owned by
--   auth.uid() (rides on the existing messages/conversations RLS), plus a
--   matching UPDATE policy for the upsert (ON CONFLICT DO UPDATE enforces
--   both INSERT and UPDATE policies). SELECT policies stay unchanged;
--   DELETE stays default-deny.
-- Part 4 — get_feedback_review(): admin overview of negative per-answer
--   feedback for the caller's own organization. SECURITY DEFINER with a
--   fixed search_path: the messages RLS shows an admin only their own
--   messages, so a security_invoker view would be empty; the function
--   checks is_org_admin() (015) and scopes by get_user_org_id() (001).
--
-- Apply via Supabase MCP only — this project is production
-- (quickstart.md §3, step 1).

BEGIN;

-- ============================================================
-- Part 1: messages — answer provenance
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS rewritten_query text,
  ADD COLUMN IF NOT EXISTS verification jsonb,
  ADD COLUMN IF NOT EXISTS latency_ms integer;

-- ============================================================
-- Part 2: feedback_interactions — per-answer feedback columns
-- ============================================================
ALTER TABLE feedback_interactions
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Reason codes (CHECK passes when reason IS NULL — thumbs-up rows).
-- Named constraint, idempotent via pg_constraint lookup.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'feedback_interactions'::regclass
      AND conname = 'feedback_interactions_reason_check'
  ) THEN
    ALTER TABLE feedback_interactions
      ADD CONSTRAINT feedback_interactions_reason_check
      CHECK (reason IN ('incorrect','incomplete','wrong_source','misunderstood','other'));
  END IF;
END $$;

-- One rating per user per ANSWER replaces one per conversation (research #2).
ALTER TABLE feedback_interactions
  DROP CONSTRAINT IF EXISTS one_feedback_per_user_per_conversation;

-- Full unique index (NOT partial — research #1): PostgREST upsert
-- compatibility; NULLs are distinct so legacy rows never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS feedback_interactions_message_id_user_id_key
  ON feedback_interactions (message_id, user_id);

-- House pattern (001): updated_at maintained by trigger, never by the client.
DROP TRIGGER IF EXISTS set_updated_at ON feedback_interactions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON feedback_interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Part 3: RLS — insert/update only on own-conversation messages
-- ============================================================
DROP POLICY IF EXISTS "Users can insert own feedback" ON feedback_interactions;

CREATE POLICY "Users can insert feedback on own conversation messages"
  ON feedback_interactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      WHERE messages.id = feedback_interactions.message_id
        AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own feedback"
  ON feedback_interactions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      WHERE messages.id = feedback_interactions.message_id
        AND conversations.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      WHERE messages.id = feedback_interactions.message_id
        AND conversations.user_id = auth.uid()
    )
  );

-- ============================================================
-- Part 4: get_feedback_review() — admin overview (no UI)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_feedback_review()
RETURNS TABLE (
  feedback_id uuid,
  message_id uuid,
  conversation_id uuid,
  assistant_id uuid,
  assistant_name text,
  reason text,
  feedback text,
  question text,
  answer text,
  verification jsonb,
  rewritten_query text,
  latency_ms integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id,
         f.message_id,
         f.conversation_id,
         c.assistant_id,
         a.name,
         f.reason,
         f.feedback,
         q.content,
         m.content,
         m.verification,
         m.rewritten_query,
         m.latency_ms,
         f.created_at,
         f.updated_at
  FROM feedback_interactions f
  JOIN messages m        ON m.id = f.message_id
  JOIN conversations c  ON c.id = m.conversation_id
  JOIN ai_assistants a   ON a.id = c.assistant_id
  LEFT JOIN LATERAL (
    SELECT m0.content
    FROM messages m0
    WHERE m0.conversation_id = m.conversation_id
      AND m0.role = 'user'
      AND m0.created_at < m.created_at
    ORDER BY m0.created_at DESC
    LIMIT 1
  ) q ON true
  WHERE f.message_id IS NOT NULL
    AND f.thumbs_up = false
    AND f.organization_id = get_user_org_id()
    AND is_org_admin()
$$;

COMMIT;