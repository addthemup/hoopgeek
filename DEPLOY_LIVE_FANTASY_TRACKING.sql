-- Live Fantasy Score Tracking Setup
-- Creates tables and functions for real-time fantasy score updates

-- ============================================================================
-- 1. Create live_player_stats table for real-time tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_player_stats (
    id BIGSERIAL PRIMARY KEY,
    game_id TEXT NOT NULL,
    nba_player_id BIGINT NOT NULL,
    player_name TEXT,
    fantasy_points DECIMAL(10, 2) DEFAULT 0,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite unique constraint
    UNIQUE(game_id, nba_player_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_player_stats_game_id ON live_player_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_live_player_stats_nba_player_id ON live_player_stats(nba_player_id);
CREATE INDEX IF NOT EXISTS idx_live_player_stats_updated_at ON live_player_stats(updated_at);

-- ============================================================================
-- 2. Add columns to dfs_entries for live scoring
-- ============================================================================

ALTER TABLE dfs_entries 
ADD COLUMN IF NOT EXISTS current_score DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS player_scores JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- 3. Add columns to fantasy_rosters for weekly tracking
-- ============================================================================

-- First check if table exists, create if not
CREATE TABLE IF NOT EXISTS fantasy_rosters (
    id BIGSERIAL PRIMARY KEY,
    league_id BIGINT REFERENCES leagues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    team_name TEXT,
    players JSONB DEFAULT '[]'::jsonb,
    weekly_score DECIMAL(10, 2) DEFAULT 0,
    weekly_average DECIMAL(10, 2) DEFAULT 0,
    player_weekly_scores JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(league_id, user_id)
);

-- Add columns if they don't exist
ALTER TABLE fantasy_rosters 
ADD COLUMN IF NOT EXISTS weekly_score DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_average DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS player_weekly_scores JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- 4. Function to calculate fantasy points from box score stats
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_fantasy_points(stats JSONB)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    points DECIMAL(10, 2) := 0;
    double_double_cats INTEGER := 0;
BEGIN
    -- Basic scoring (customize these multipliers based on your league)
    points := points + COALESCE((stats->>'points')::DECIMAL, 0) * 1;
    points := points + COALESCE((stats->>'reboundsTotal')::DECIMAL, 0) * 1.2;
    points := points + COALESCE((stats->>'assists')::DECIMAL, 0) * 1.5;
    points := points + COALESCE((stats->>'steals')::DECIMAL, 0) * 3;
    points := points + COALESCE((stats->>'blocks')::DECIMAL, 0) * 3;
    points := points + COALESCE((stats->>'turnovers')::DECIMAL, 0) * (-1);
    points := points + COALESCE((stats->>'threePointersMade')::DECIMAL, 0) * 0.5;
    
    -- Double-double bonus (10+ in 2 categories)
    IF COALESCE((stats->>'points')::DECIMAL, 0) >= 10 THEN
        double_double_cats := double_double_cats + 1;
    END IF;
    IF COALESCE((stats->>'reboundsTotal')::DECIMAL, 0) >= 10 THEN
        double_double_cats := double_double_cats + 1;
    END IF;
    IF COALESCE((stats->>'assists')::DECIMAL, 0) >= 10 THEN
        double_double_cats := double_double_cats + 1;
    END IF;
    IF COALESCE((stats->>'steals')::DECIMAL, 0) >= 10 THEN
        double_double_cats := double_double_cats + 1;
    END IF;
    IF COALESCE((stats->>'blocks')::DECIMAL, 0) >= 10 THEN
        double_double_cats := double_double_cats + 1;
    END IF;
    
    IF double_double_cats >= 2 THEN
        points := points + 1.5; -- Double-double bonus
    END IF;
    IF double_double_cats >= 3 THEN
        points := points + 3; -- Triple-double bonus
    END IF;
    
    RETURN ROUND(points, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Function to get live DFS leaderboard
-- ============================================================================

CREATE OR REPLACE FUNCTION get_live_dfs_leaderboard(p_pool_id BIGINT)
RETURNS TABLE (
    rank BIGINT,
    entry_id BIGINT,
    user_id UUID,
    username TEXT,
    current_score DECIMAL(10, 2),
    roster JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_entries AS (
        SELECT 
            e.id as entry_id,
            e.user_id,
            p.username,
            e.current_score,
            e.roster,
            ROW_NUMBER() OVER (ORDER BY e.current_score DESC, e.created_at ASC) as rank
        FROM dfs_entries e
        JOIN profiles p ON e.user_id = p.id
        WHERE e.pool_id = p_pool_id
    )
    SELECT * FROM ranked_entries
    ORDER BY rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Function to get fantasy league standings (weekly)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_fantasy_league_standings(p_league_id BIGINT)
RETURNS TABLE (
    rank BIGINT,
    roster_id BIGINT,
    user_id UUID,
    team_name TEXT,
    weekly_score DECIMAL(10, 2),
    weekly_average DECIMAL(10, 2),
    player_weekly_scores JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_rosters AS (
        SELECT 
            r.id as roster_id,
            r.user_id,
            r.team_name,
            r.weekly_score,
            r.weekly_average,
            r.player_weekly_scores,
            ROW_NUMBER() OVER (ORDER BY r.weekly_average DESC, r.weekly_score DESC) as rank
        FROM fantasy_rosters r
        WHERE r.league_id = p_league_id
    )
    SELECT * FROM ranked_rosters
    ORDER BY rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Enable RLS on new tables
-- ============================================================================

ALTER TABLE live_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_rosters ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read live stats (public data)
CREATE POLICY "Anyone can read live player stats"
ON live_player_stats FOR SELECT
USING (true);

-- Only service role can update live stats
CREATE POLICY "Service role can update live player stats"
ON live_player_stats FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Users can read their own fantasy rosters
CREATE POLICY "Users can read their fantasy rosters"
ON fantasy_rosters FOR SELECT
USING (auth.uid() = user_id);

-- Users can read rosters in their leagues
CREATE POLICY "Users can read rosters in their leagues"
ON fantasy_rosters FOR SELECT
USING (
    league_id IN (
        SELECT league_id 
        FROM league_members 
        WHERE user_id = auth.uid()
    )
);

-- Service role can update fantasy rosters
CREATE POLICY "Service role can update fantasy rosters"
ON fantasy_rosters FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 8. Create function to clean up old live stats (keep last 7 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_live_stats()
RETURNS void AS $$
BEGIN
    DELETE FROM live_player_stats
    WHERE updated_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON live_player_stats TO anon, authenticated;
GRANT ALL ON live_player_stats TO service_role;

GRANT SELECT ON fantasy_rosters TO anon, authenticated;
GRANT ALL ON fantasy_rosters TO service_role;

GRANT EXECUTE ON FUNCTION calculate_fantasy_points TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_live_dfs_leaderboard TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_fantasy_league_standings TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_live_stats TO service_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Live fantasy tracking setup completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Created:';
    RAISE NOTICE '   - live_player_stats table';
    RAISE NOTICE '   - fantasy_rosters table (if not exists)';
    RAISE NOTICE '   - calculate_fantasy_points function';
    RAISE NOTICE '   - get_live_dfs_leaderboard function';
    RAISE NOTICE '   - get_fantasy_league_standings function';
    RAISE NOTICE '   - cleanup_old_live_stats function';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Updated:';
    RAISE NOTICE '   - dfs_entries table (added current_score, player_scores)';
    RAISE NOTICE '   - fantasy_rosters table (added weekly_score, weekly_average)';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next steps:';
    RAISE NOTICE '   1. Set up cron job to run update_live_fantasy_scores.py';
    RAISE NOTICE '   2. Run during game times (every 60 seconds)';
    RAISE NOTICE '   3. Monitor logs for updates';
END $$;

