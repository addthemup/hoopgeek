-- =====================================================
-- NBA TEAM ROSTER TABLE - COPY THIS INTO SUPABASE SQL EDITOR
-- =====================================================
-- This creates the nba_team_roster table
-- =====================================================

CREATE TABLE IF NOT EXISTS nba_team_roster (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES nba_teams(team_id) ON DELETE CASCADE,
    season TEXT NOT NULL,
    player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    nba_player_id INTEGER, -- For matching when player_id is null
    player_name TEXT NOT NULL,
    player_slug TEXT,
    jersey_number TEXT,
    position TEXT,
    height TEXT,
    weight INTEGER,
    birth_date DATE,
    age INTEGER,
    experience_years INTEGER, -- EXP field from API
    school TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one roster entry per team/season/player combination
    UNIQUE(team_id, season, nba_player_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_nba_team_roster_team_id ON nba_team_roster(team_id);
CREATE INDEX IF NOT EXISTS idx_nba_team_roster_season ON nba_team_roster(season);
CREATE INDEX IF NOT EXISTS idx_nba_team_roster_player_id ON nba_team_roster(player_id);
CREATE INDEX IF NOT EXISTS idx_nba_team_roster_nba_player_id ON nba_team_roster(nba_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_team_roster_team_season ON nba_team_roster(team_id, season);

-- =====================================================
-- TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_nba_team_roster_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_nba_team_roster_updated_at
    BEFORE UPDATE ON nba_team_roster
    FOR EACH ROW
    EXECUTE FUNCTION update_nba_team_roster_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE nba_team_roster ENABLE ROW LEVEL SECURITY;

-- Allow public read access to rosters
CREATE POLICY "Public read access to nba_team_roster"
    ON nba_team_roster
    FOR SELECT
    USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access to nba_team_roster"
    ON nba_team_roster
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- HELPER FUNCTION: Get current season
-- =====================================================

CREATE OR REPLACE FUNCTION get_current_nba_season()
RETURNS TEXT AS $$
DECLARE
    current_date DATE := CURRENT_DATE;
    current_year INTEGER := EXTRACT(YEAR FROM current_date);
    current_month INTEGER := EXTRACT(MONTH FROM current_date);
    season_start_year INTEGER;
    season_end_year INTEGER;
BEGIN
    -- NBA season typically starts in October (month 10)
    -- If we're in October or later, season is current_year - (current_year + 1)
    -- If we're before October, season is (current_year - 1) - current_year
    IF current_month >= 10 THEN
        season_start_year := current_year;
        season_end_year := current_year + 1;
    ELSE
        season_start_year := current_year - 1;
        season_end_year := current_year;
    END IF;
    
    RETURN season_start_year || '-' || LPAD(season_end_year::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE nba_team_roster IS 'NBA team rosters scraped from NBA API, updated daily at 4 AM';
COMMENT ON COLUMN nba_team_roster.team_id IS 'Foreign key to nba_teams.team_id';
COMMENT ON COLUMN nba_team_roster.player_id IS 'Foreign key to nba_players.id (may be null if player not in our DB yet)';
COMMENT ON COLUMN nba_team_roster.nba_player_id IS 'NBA API player ID for matching';
COMMENT ON COLUMN nba_team_roster.experience_years IS 'Years of NBA experience (EXP field from API)';

