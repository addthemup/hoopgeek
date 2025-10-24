-- ============================================================================
-- LIVE PLAYER STATS TABLE - Linked to Your Existing NBA Tables
-- ============================================================================
-- This table stores real-time player statistics from live NBA games
-- Links to: nba_players, nba_teams, nba_games
-- ============================================================================

-- ============================================================================
-- 1. Create live_player_stats table with proper foreign keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_player_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys to existing tables
    game_id VARCHAR(50) NOT NULL REFERENCES public.nba_games(game_id) ON DELETE CASCADE,
    nba_player_id INTEGER NOT NULL,  -- Links to nba_players.nba_player_id
    player_id UUID,  -- Optional: Link to nba_players.id (UUID)
    
    -- Player Info (denormalized for quick access)
    player_name TEXT NOT NULL,
    team_tricode VARCHAR(10),  -- e.g., "LAL", "GSW"
    team_id INTEGER,  -- Links to nba_teams.team_id
    
    -- Raw Stats (matches your fantasyScoring.ts PlayerGameLog interface)
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    /*
    stats structure:
    {
      "pts": 24,
      "reb": 8,
      "ast": 5,
      "stl": 2,
      "blk": 1,
      "tov": 3,
      "fgm": 9,
      "fga": 18,
      "fg_pct": 0.50,
      "fg3m": 2,
      "fg3a": 6,
      "fg3_pct": 0.333,
      "ftm": 4,
      "fta": 5,
      "ft_pct": 0.80,
      "oreb": 2,
      "dreb": 6,
      "pf": 3,
      "min": 32,
      "plus_minus": 8
    }
    */
    
    -- Raw NBA API Response (for reference/debugging)
    raw_stats JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite unique constraint: one record per player per game
    UNIQUE(game_id, nba_player_id)
);

-- ============================================================================
-- 2. Add foreign key to nba_players (optional but recommended)
-- ============================================================================

-- Add foreign key constraint to nba_players
ALTER TABLE public.live_player_stats
ADD CONSTRAINT fk_live_stats_nba_player 
FOREIGN KEY (nba_player_id) 
REFERENCES public.nba_players(nba_player_id) 
ON DELETE CASCADE;

-- Note: We can't add FK to nba_teams.team_id directly because team_tricode is stored
-- But we'll add an index for fast joins

-- ============================================================================
-- 3. Create indexes for performance
-- ============================================================================

-- Index for querying by game
CREATE INDEX IF NOT EXISTS idx_live_player_stats_game_id 
ON public.live_player_stats(game_id);

-- Index for querying by player
CREATE INDEX IF NOT EXISTS idx_live_player_stats_nba_player_id 
ON public.live_player_stats(nba_player_id);

-- Index for recent updates (for "what's changed" queries)
CREATE INDEX IF NOT EXISTS idx_live_player_stats_updated_at 
ON public.live_player_stats(updated_at DESC);

-- Index for team queries
CREATE INDEX IF NOT EXISTS idx_live_player_stats_team_tricode 
ON public.live_player_stats(team_tricode);

-- Composite index for common query pattern (game + player)
CREATE INDEX IF NOT EXISTS idx_live_player_stats_game_player 
ON public.live_player_stats(game_id, nba_player_id);

-- GIN index on stats JSONB for fast JSON queries
CREATE INDEX IF NOT EXISTS idx_live_player_stats_stats_gin 
ON public.live_player_stats USING GIN (stats);

-- ============================================================================
-- 4. Create helper view for easy joins
-- ============================================================================

CREATE OR REPLACE VIEW live_player_stats_detailed AS
SELECT 
    lps.id,
    lps.game_id,
    lps.nba_player_id,
    lps.player_name,
    lps.team_tricode,
    lps.stats,
    lps.updated_at,
    
    -- Join player details
    p.position,
    p.jersey_number,
    p.height,
    p.weight,
    p.team_name as current_team_name,
    
    -- Join game details
    g.game_date,
    g.game_status,
    g.game_status_text,
    g.home_team_tricode,
    g.away_team_tricode,
    g.home_team_score,
    g.away_team_score,
    
    -- Join team details
    t.city as team_city,
    t.nickname as team_nickname
    
FROM live_player_stats lps
LEFT JOIN nba_players p ON lps.nba_player_id = p.nba_player_id
LEFT JOIN nba_games g ON lps.game_id = g.game_id
LEFT JOIN nba_teams t ON lps.team_id = t.team_id;

-- Grant access to the view
GRANT SELECT ON live_player_stats_detailed TO authenticated, anon;

-- ============================================================================
-- 5. Create live_stats_updates marker table (optional)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.live_stats_updates (
    date DATE PRIMARY KEY,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT DEFAULT 'active',
    games_processed INTEGER DEFAULT 0,
    players_updated INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_stats_updates_last_updated 
ON public.live_stats_updates(last_updated DESC);

-- ============================================================================
-- 6. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.live_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stats_updates ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read live stats (public data)
CREATE POLICY "Anyone can read live player stats"
ON public.live_player_stats FOR SELECT
USING (true);

-- Only service role can insert/update live stats
CREATE POLICY "Service role can manage live player stats"
ON public.live_player_stats FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Anyone can read update markers
CREATE POLICY "Anyone can read live stats updates"
ON public.live_stats_updates FOR SELECT
USING (true);

-- Only service role can manage update markers
CREATE POLICY "Service role can manage live stats updates"
ON public.live_stats_updates FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 7. Create helper functions
-- ============================================================================

-- Function to get live stats for a player in a specific game
CREATE OR REPLACE FUNCTION get_live_player_stats(
    p_game_id VARCHAR(50),
    p_nba_player_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'game_id', game_id,
        'player_name', player_name,
        'team_tricode', team_tricode,
        'stats', stats,
        'updated_at', updated_at
    ) INTO result
    FROM live_player_stats
    WHERE game_id = p_game_id 
    AND nba_player_id = p_nba_player_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all live stats for a game
CREATE OR REPLACE FUNCTION get_game_live_stats(
    p_game_id VARCHAR(50)
)
RETURNS TABLE (
    nba_player_id INTEGER,
    player_name TEXT,
    team_tricode VARCHAR(10),
    stats JSONB,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lps.nba_player_id,
        lps.player_name,
        lps.team_tricode,
        lps.stats,
        lps.updated_at
    FROM live_player_stats lps
    WHERE lps.game_id = p_game_id
    ORDER BY lps.team_tricode, lps.player_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get live stats for multiple players (for DFS lineup)
CREATE OR REPLACE FUNCTION get_lineup_live_stats(
    p_player_games JSONB  -- Array of {nba_player_id, game_id} objects
)
RETURNS TABLE (
    nba_player_id INTEGER,
    game_id VARCHAR(50),
    player_name TEXT,
    team_tricode VARCHAR(10),
    stats JSONB,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lps.nba_player_id,
        lps.game_id,
        lps.player_name,
        lps.team_tricode,
        lps.stats,
        lps.updated_at
    FROM live_player_stats lps
    INNER JOIN jsonb_array_elements(p_player_games) AS pg 
        ON lps.nba_player_id = (pg->>'nba_player_id')::INTEGER
        AND lps.game_id = pg->>'game_id';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old live stats (keeps last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_live_stats()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete stats older than 7 days
    DELETE FROM live_player_stats
    WHERE updated_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also clean up old update markers
    DELETE FROM live_stats_updates
    WHERE date < CURRENT_DATE - INTERVAL '7 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Grant permissions
-- ============================================================================

GRANT SELECT ON public.live_player_stats TO anon, authenticated;
GRANT ALL ON public.live_player_stats TO service_role;

GRANT SELECT ON public.live_stats_updates TO anon, authenticated;
GRANT ALL ON public.live_stats_updates TO service_role;

GRANT EXECUTE ON FUNCTION get_live_player_stats TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_game_live_stats TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_lineup_live_stats TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_live_stats TO service_role;

-- ============================================================================
-- 9. Create trigger to update player_id UUID automatically
-- ============================================================================

-- Function to populate player_id UUID from nba_player_id
CREATE OR REPLACE FUNCTION set_player_id_from_nba_player_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Try to find the player's UUID by their nba_player_id
    SELECT id INTO NEW.player_id
    FROM nba_players
    WHERE nba_player_id = NEW.nba_player_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER tr_live_stats_set_player_id
    BEFORE INSERT OR UPDATE ON live_player_stats
    FOR EACH ROW
    EXECUTE FUNCTION set_player_id_from_nba_player_id();

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Live player stats table created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Table Structure:';
    RAISE NOTICE '   - live_player_stats: Main table with raw stats';
    RAISE NOTICE '   - live_stats_updates: Update tracker';
    RAISE NOTICE '   - live_player_stats_detailed: View with joined data';
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Foreign Keys:';
    RAISE NOTICE '   - game_id → nba_games.game_id';
    RAISE NOTICE '   - nba_player_id → nba_players.nba_player_id';
    RAISE NOTICE '   - player_id → nba_players.id (auto-populated)';
    RAISE NOTICE '';
    RAISE NOTICE '📈 Indexes Created:';
    RAISE NOTICE '   - idx_live_player_stats_game_id';
    RAISE NOTICE '   - idx_live_player_stats_nba_player_id';
    RAISE NOTICE '   - idx_live_player_stats_updated_at';
    RAISE NOTICE '   - idx_live_player_stats_team_tricode';
    RAISE NOTICE '   - idx_live_player_stats_game_player (composite)';
    RAISE NOTICE '   - idx_live_player_stats_stats_gin (JSONB)';
    RAISE NOTICE '';
    RAISE NOTICE '🛠️ Helper Functions:';
    RAISE NOTICE '   - get_live_player_stats(game_id, nba_player_id)';
    RAISE NOTICE '   - get_game_live_stats(game_id)';
    RAISE NOTICE '   - get_lineup_live_stats(player_games_json)';
    RAISE NOTICE '   - cleanup_old_live_stats()';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 RLS Policies:';
    RAISE NOTICE '   - Anyone can read live stats';
    RAISE NOTICE '   - Only service role can write';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next Steps:';
    RAISE NOTICE '   1. Run your Python script to populate data';
    RAISE NOTICE '   2. Frontend fetches from live_player_stats';
    RAISE NOTICE '   3. Calculate fantasy points using fantasyScoring.ts';
    RAISE NOTICE '';
END $$;

