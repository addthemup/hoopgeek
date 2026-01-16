-- ============================================================================
-- NBA PLAYER GAME STATS MIGRATION
-- ============================================================================
-- This migration creates tables for storing aggregated player game statistics
-- from the scraping script. Optimized for lightweight storage and mobile queries.
-- 
-- NOTE: Traditional stats (points, rebounds, assists, etc.) are already stored
-- in nba_boxscores table. This table only stores advanced/derived stats that
-- aren't available in nba_boxscores.
-- ============================================================================

-- ============================================================================
-- 1. Create nba_player_game_stats table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nba_player_game_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    -- Links to nba_boxscores via player_id + game_id (no direct FK needed)
    player_id UUID NOT NULL REFERENCES public.nba_players(id) ON DELETE CASCADE,
    game_id VARCHAR(50) NOT NULL REFERENCES public.nba_games(game_id) ON DELETE CASCADE,
    season_year VARCHAR(10) NOT NULL,
    
    -- ============================================
    -- ADVANCED STATS (9 key metrics)
    -- ============================================
    advanced_playerEfficiencyRating DECIMAL(5,2), -- PER
    advanced_offensiveRating DECIMAL(5,2), -- ORtg
    advanced_defensiveRating DECIMAL(5,2), -- DRtg
    advanced_netRating DECIMAL(5,2), -- NetRtg
    advanced_trueShootingPercentage DECIMAL(5,3), -- TS%
    advanced_usagePercentage DECIMAL(5,3), -- USG%
    advanced_assistRatio DECIMAL(5,2),
    advanced_reboundPercentage DECIMAL(5,3),
    advanced_pace DECIMAL(5,2),
    
    -- ============================================
    -- FOUR FACTORS (4 metrics)
    -- ============================================
    fourFactors_effectiveFieldGoalPercentage DECIMAL(5,3), -- eFG%
    fourFactors_freeThrowAttemptRate DECIMAL(5,3), -- FTA Rate
    fourFactors_offensiveReboundPercentage DECIMAL(5,3), -- OREB%
    fourFactors_turnoverPercentage DECIMAL(5,3), -- TOV%
    
    -- ============================================
    -- HUSTLE STATS (6 metrics - Phase 2)
    -- ============================================
    hustle_contestedShots INTEGER,
    hustle_contestedShots3pt INTEGER,
    hustle_deflections INTEGER,
    hustle_looseBallsRecovered INTEGER,
    hustle_chargesDrawn INTEGER,
    hustle_screenAssists INTEGER,
    
    -- ============================================
    -- MISC IMPACT STATS (4 metrics - Phase 2)
    -- ============================================
    misc_pointsOffTurnovers INTEGER,
    misc_pointsSecondChance INTEGER,
    misc_pointsFastBreak INTEGER,
    misc_pointsPaint INTEGER,
    
    -- ============================================
    -- PLAYER TRACKING (6 metrics - Phase 2)
    -- ============================================
    playerTrack_touches INTEGER,
    playerTrack_passes INTEGER,
    playerTrack_timeOfPossession DECIMAL(5,2), -- seconds
    playerTrack_contestedFieldGoalPercentage DECIMAL(5,3),
    playerTrack_uncontestedFieldGoalsPercentage DECIMAL(5,3),
    playerTrack_defendedAtRimFieldGoalPercentage DECIMAL(5,3),
    
    -- ============================================
    -- SCORING BREAKDOWN (5 metrics - Phase 2)
    -- ============================================
    scoring_restrictedAreaFieldGoalsPercentage DECIMAL(5,3), -- 0-3ft
    scoring_paintFieldGoalsPercentage DECIMAL(5,3), -- 3-10ft
    scoring_midRangeFieldGoalsPercentage DECIMAL(5,3), -- 10-16ft
    scoring_aboveTheBreak3FieldGoalsPercentage DECIMAL(5,3), -- 3pt
    scoring_corner3FieldGoalsPercentage DECIMAL(5,3), -- Corner 3pt
    
    -- ============================================
    -- TIMESTAMPS
    -- ============================================
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- ============================================
    -- CONSTRAINTS
    -- ============================================
    CONSTRAINT unique_player_game UNIQUE(player_id, game_id)
);

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

-- Primary lookup: player + season
CREATE INDEX IF NOT EXISTS idx_player_game_stats_player_season 
    ON public.nba_player_game_stats(player_id, season_year);

-- Game lookup
CREATE INDEX IF NOT EXISTS idx_player_game_stats_game_id 
    ON public.nba_player_game_stats(game_id);

-- Season lookup
CREATE INDEX IF NOT EXISTS idx_player_game_stats_season 
    ON public.nba_player_game_stats(season_year);

-- Player lookup
CREATE INDEX IF NOT EXISTS idx_player_game_stats_player_id 
    ON public.nba_player_game_stats(player_id);

-- Composite index for common queries (player stats in date range)
CREATE INDEX IF NOT EXISTS idx_player_game_stats_player_game 
    ON public.nba_player_game_stats(player_id, game_id);

-- ============================================================================
-- 3. Create nba_league_averages table (for chart comparisons)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nba_league_averages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_year VARCHAR(10) NOT NULL,
    stat_type VARCHAR(50) NOT NULL, -- 'advanced', 'traditional', 'fourFactors', etc.
    stat_name VARCHAR(100) NOT NULL, -- e.g., 'offensiveRating', 'trueShootingPercentage'
    stat_value DECIMAL(10,3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_league_stat UNIQUE(season_year, stat_type, stat_name)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_league_averages_season_type 
    ON public.nba_league_averages(season_year, stat_type);

CREATE INDEX IF NOT EXISTS idx_league_averages_season 
    ON public.nba_league_averages(season_year);

-- ============================================================================
-- 4. Create updated_at trigger function (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to nba_player_game_stats
DROP TRIGGER IF EXISTS update_nba_player_game_stats_updated_at ON public.nba_player_game_stats;
CREATE TRIGGER update_nba_player_game_stats_updated_at
    BEFORE UPDATE ON public.nba_player_game_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to nba_league_averages
DROP TRIGGER IF EXISTS update_nba_league_averages_updated_at ON public.nba_league_averages;
CREATE TRIGGER update_nba_league_averages_updated_at
    BEFORE UPDATE ON public.nba_league_averages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.nba_player_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nba_league_averages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read player game stats (public data)
CREATE POLICY "Anyone can read player game stats"
    ON public.nba_player_game_stats
    FOR SELECT
    USING (true);

-- Policy: Anyone can read league averages (public data)
CREATE POLICY "Anyone can read league averages"
    ON public.nba_league_averages
    FOR SELECT
    USING (true);

-- Policy: Only service role can insert/update (via migrations/scripts)
-- Note: Adjust based on your auth setup
CREATE POLICY "Service role can modify player game stats"
    ON public.nba_player_game_stats
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can modify league averages"
    ON public.nba_league_averages
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.nba_player_game_stats IS 
    'Advanced and derived player statistics per game. Traditional stats (points, rebounds, assists, etc.) are stored in nba_boxscores. This table links via player_id + game_id.';

COMMENT ON TABLE public.nba_league_averages IS 
    'League-wide averages for each stat type and season. Used for player comparisons in charts.';

COMMENT ON COLUMN public.nba_player_game_stats.advanced_pace IS 
    'Possessions per 48 minutes. League average typically ~100.';

COMMENT ON COLUMN public.nba_player_game_stats.fourFactors_turnoverPercentage IS 
    'Turnover percentage (lower is better). Inverted in charts for consistency.';

COMMENT ON COLUMN public.nba_player_game_stats.player_id IS 
    'Links to nba_players.id. Use with game_id to join with nba_boxscores for traditional stats.';

COMMENT ON COLUMN public.nba_player_game_stats.game_id IS 
    'Links to nba_games.game_id. Use with player_id to join with nba_boxscores for traditional stats.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

