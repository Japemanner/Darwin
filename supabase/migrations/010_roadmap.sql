-- Darwin Roadmap & Feature Requests
-- Migration 010: roadmap_features, roadmap_votes, feature_requests
--
-- Scope: globaal (één gedeelde roadmap voor alle gebruikers van Darwin)
-- Workflow: admin curateert roadmap_features, gebruikers stemmen en dienen requests in
-- Statussen: in_overweging → gepland → in_ontwikkeling → verzonden
--

BEGIN;

-- ============================================================
-- ROADMAP FEATURES (globaal, admin beheert)
-- ============================================================
CREATE TABLE roadmap_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'in_overweging'
    CHECK (status IN ('in_overweging', 'gepland', 'in_ontwikkeling', 'verzonden')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE roadmap_features ENABLE ROW LEVEL SECURITY;

-- Alle ingelogde gebruikers kunnen roadmap-features zien
CREATE POLICY "Authenticated users can view roadmap features"
  ON roadmap_features
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Alleen admins kunnen features aanmaken/bewerken/verwijderen
CREATE POLICY "Admins can create roadmap features"
  ON roadmap_features
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update roadmap features"
  ON roadmap_features
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete roadmap features"
  ON roadmap_features
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- ROADMAP VOTES (globaal, gebruiker stemt +1 of -1)
-- ============================================================
CREATE TABLE roadmap_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES roadmap_features(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction smallint NOT NULL CHECK (direction IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_vote_per_user_per_feature UNIQUE (feature_id, user_id)
);

ALTER TABLE roadmap_votes ENABLE ROW LEVEL SECURITY;

-- Gebruikers kunnen hun eigen votes zien
CREATE POLICY "Users can view own votes"
  ON roadmap_votes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Gebruikers kunnen eigen votes aanmaken
CREATE POLICY "Users can insert own votes"
  ON roadmap_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Gebruikers kunnen eigen votes bewerken (wisselen van richting)
CREATE POLICY "Users can update own votes"
  ON roadmap_votes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Gebruikers kunnen eigen votes verwijderen (toggle uit)
CREATE POLICY "Users can delete own votes"
  ON roadmap_votes
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- FEATURE REQUESTS (gebruiker dient in, admin-only zichtbaar)
-- ============================================================
CREATE TABLE feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  motivation TEXT,
  submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'nieuw'
    CHECK (status IN ('nieuw', 'beoordeeld', 'gepromoot', 'afgewezen')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- Gebruikers kunnen hun eigen ingediende requests zien
CREATE POLICY "Users can view own feature requests"
  ON feature_requests
  FOR SELECT
  USING (auth.uid() = submitted_by);

-- Admins kunnen alle feature requests zien
CREATE POLICY "Admins can view all feature requests"
  ON feature_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Ingelogde gebruikers kunnen feature requests indienen
CREATE POLICY "Authenticated users can submit feature requests"
  ON feature_requests
  FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

-- Admins kunnen feature request status bijwerken
CREATE POLICY "Admins can update feature requests"
  ON feature_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

COMMIT;

-- ============================================================
-- VIEW: roadmap_features_with_score
-- Publieke view die features + totale score toont (bypasses vote RLS)
-- Nodig omdat RLS op roadmap_votes alleen eigen votes laat zien,
-- maar de score (som van alle votes) publiek zichtbaar moet zijn.
-- ============================================================
CREATE OR REPLACE VIEW roadmap_features_with_score AS
SELECT
  f.id,
  f.title,
  f.description,
  f.status,
  f.created_by,
  f.created_at,
  f.updated_at,
  COALESCE(SUM(v.direction), 0) AS score
FROM roadmap_features f
LEFT JOIN roadmap_votes v ON v.feature_id = f.id
GROUP BY f.id, f.title, f.description, f.status, f.created_by, f.created_at, f.updated_at;

-- View is publiek leesbaar voor ingelogde gebruikers
-- (views erven niet automatisch RLS, dus we zetten het expliciet aan)
ALTER VIEW roadmap_features_with_score OWNER TO postgres;
GRANT SELECT ON roadmap_features_with_score TO authenticated;