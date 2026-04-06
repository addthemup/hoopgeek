-- User draft board rankings with change history + aggregate view.
-- This supports:
-- 1) per-user mock draft rankings over time
-- 2) community/user aggregate ranking by prospect

CREATE TABLE IF NOT EXISTS user_draft_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_prospect_id uuid NOT NULL REFERENCES draft_prospects(id) ON DELETE CASCADE,
  draft_year smallint NOT NULL,
  rank integer NOT NULL CHECK (rank > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_draft_rankings_user_year_prospect UNIQUE (user_id, draft_year, draft_prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_user_draft_rankings_user_year
  ON user_draft_rankings (user_id, draft_year, rank);

CREATE INDEX IF NOT EXISTS idx_user_draft_rankings_prospect_year
  ON user_draft_rankings (draft_prospect_id, draft_year);

COMMENT ON TABLE user_draft_rankings IS 'Current user mock draft rankings by prospect.';

CREATE TABLE IF NOT EXISTS user_draft_ranking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  draft_prospect_id uuid NOT NULL REFERENCES draft_prospects(id) ON DELETE CASCADE,
  draft_year smallint NOT NULL,
  rank integer NOT NULL CHECK (rank > 0),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_draft_ranking_history_user_prospect_changed
  ON user_draft_ranking_history (user_id, draft_prospect_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_draft_ranking_history_prospect_year
  ON user_draft_ranking_history (draft_prospect_id, draft_year, changed_at DESC);

COMMENT ON TABLE user_draft_ranking_history IS 'Append-only history of user mock draft ranking changes.';

CREATE OR REPLACE FUNCTION set_user_draft_rankings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_draft_rankings_updated_at ON user_draft_rankings;
CREATE TRIGGER trg_user_draft_rankings_updated_at
  BEFORE UPDATE ON user_draft_rankings
  FOR EACH ROW EXECUTE FUNCTION set_user_draft_rankings_updated_at();

CREATE OR REPLACE FUNCTION log_user_draft_ranking_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO user_draft_ranking_history (user_id, draft_prospect_id, draft_year, rank, changed_at)
    VALUES (NEW.user_id, NEW.draft_prospect_id, NEW.draft_year, NEW.rank, now());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND (OLD.rank IS DISTINCT FROM NEW.rank OR OLD.notes IS DISTINCT FROM NEW.notes) THEN
    INSERT INTO user_draft_ranking_history (user_id, draft_prospect_id, draft_year, rank, changed_at)
    VALUES (NEW.user_id, NEW.draft_prospect_id, NEW.draft_year, NEW.rank, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_draft_rankings_history ON user_draft_rankings;
CREATE TRIGGER trg_user_draft_rankings_history
  AFTER INSERT OR UPDATE ON user_draft_rankings
  FOR EACH ROW EXECUTE FUNCTION log_user_draft_ranking_history();

ALTER TABLE user_draft_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_draft_ranking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own draft rankings"
  ON user_draft_rankings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own draft rankings"
  ON user_draft_rankings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft rankings"
  ON user_draft_rankings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft rankings"
  ON user_draft_rankings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access user_draft_rankings"
  ON user_draft_rankings FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read own draft ranking history"
  ON user_draft_ranking_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access user_draft_ranking_history"
  ON user_draft_ranking_history FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE VIEW draft_user_rank_aggregates AS
SELECT
  draft_prospect_id,
  draft_year,
  ROUND(AVG(rank)::numeric, 2) AS user_rank_avg,
  COUNT(*)::integer AS user_rank_count
FROM user_draft_rankings
GROUP BY draft_prospect_id, draft_year;

GRANT SELECT ON draft_user_rank_aggregates TO anon, authenticated, service_role;

COMMENT ON VIEW draft_user_rank_aggregates IS 'Public aggregate of user mock draft rankings by prospect/year.';
