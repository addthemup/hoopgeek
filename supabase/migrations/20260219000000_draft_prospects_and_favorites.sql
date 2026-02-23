-- =====================================================
-- Draft prospects (canonical entity per person, matched across sources)
-- and user_favorite_prospects (favorite prospects in feed drawer).
-- Prospect = amalgamation of name matching from all four sites.
-- Create prospect on first scrape; track progress in draft_rankings.
-- =====================================================

-- 1. Canonical prospect table (one row per person per draft year, matched across sources)
CREATE TABLE IF NOT EXISTS draft_prospects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    draft_year SMALLINT NOT NULL,
    player_name_full TEXT NOT NULL,
    player_slug TEXT NOT NULL,
    school_team TEXT,
    position_primary TEXT,
    position_secondary TEXT,
    height_ft_in TEXT,
    height_inches SMALLINT,
    weight_lbs SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    nba_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    CONSTRAINT uq_draft_prospects_year_slug UNIQUE (draft_year, player_slug)
);

CREATE INDEX IF NOT EXISTS idx_draft_prospects_draft_year ON draft_prospects (draft_year);
CREATE INDEX IF NOT EXISTS idx_draft_prospects_slug ON draft_prospects (player_slug);
CREATE INDEX IF NOT EXISTS idx_draft_prospects_school ON draft_prospects (school_team);
CREATE INDEX IF NOT EXISTS idx_draft_prospects_nba_player_id
    ON draft_prospects (nba_player_id) WHERE nba_player_id IS NOT NULL;

COMMENT ON TABLE draft_prospects IS 'Canonical prospect per draft year; amalgamation of name matching from all ranking sources.';

CREATE OR REPLACE FUNCTION set_draft_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_draft_prospects_updated_at
    BEFORE UPDATE ON draft_prospects
    FOR EACH ROW EXECUTE FUNCTION set_draft_prospects_updated_at();

-- 2. Link draft_rankings to canonical prospect (nullable until scraper/match job sets it)
--    Requires draft_rankings to exist (migration 20260217000000_draft_rankings.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'draft_rankings') THEN
    ALTER TABLE draft_rankings
      ADD COLUMN IF NOT EXISTS draft_prospect_id UUID REFERENCES draft_prospects(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_draft_rankings_draft_prospect_id
      ON draft_rankings (draft_prospect_id) WHERE draft_prospect_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'draft_rankings not found: run migration 20260217000000_draft_rankings.sql first, then re-run this migration to add draft_prospect_id.';
  END IF;
END $$;

-- 3. User favorite prospects (feed drawer; auth required to favorite)
CREATE TABLE IF NOT EXISTS user_favorite_prospects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    draft_prospect_id UUID NOT NULL REFERENCES draft_prospects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_favorite_prospects_user_prospect UNIQUE (user_id, draft_prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorite_prospects_user
    ON user_favorite_prospects (user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_prospects_prospect
    ON user_favorite_prospects (draft_prospect_id);

COMMENT ON TABLE user_favorite_prospects IS 'User favorite draft prospects; used in feed drawer alongside favorite players.';

-- RLS: prospects viewable by anyone; favoriting requires auth, users see only their own
ALTER TABLE draft_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorite_prospects ENABLE ROW LEVEL SECURITY;

-- draft_prospects: anyone can read (for search, players page, public prospect pages)
CREATE POLICY "Anyone can read draft_prospects"
    ON draft_prospects FOR SELECT
    TO authenticated, anon
    USING (true);

-- Service role can do everything (scraper, backfill)
CREATE POLICY "Service role full access draft_prospects"
    ON draft_prospects FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- user_favorite_prospects: authenticated users see only their own; insert/delete own only
CREATE POLICY "Users can read own favorite prospects"
    ON user_favorite_prospects FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorite prospect"
    ON user_favorite_prospects FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own favorite prospect"
    ON user_favorite_prospects FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access user_favorite_prospects"
    ON user_favorite_prospects FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
