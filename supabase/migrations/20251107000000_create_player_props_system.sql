-- ============================================================================
-- PLAYER PROPS SYSTEM
-- ============================================================================
-- Stores player betting props from SportsGameOdds API
-- Keeps 30 days of trailing data, auto-cleans up old data
-- ============================================================================

-- ============================================================================
-- 1. PLAYER PROPS GAMES TABLE
-- ============================================================================
-- Stores game information for props (one row per game per day)

CREATE TABLE IF NOT EXISTS public.player_props_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Game Information
  event_id TEXT NOT NULL, -- SportsGameOdds event ID
  game_date DATE NOT NULL,
  
  -- Teams
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_tricode TEXT,
  away_team_tricode TEXT,
  
  -- Game Details
  starts_at TIMESTAMPTZ,
  league_id TEXT DEFAULT 'NBA',
  
  -- Metadata
  odds_available BOOLEAN DEFAULT TRUE,
  finalized BOOLEAN DEFAULT FALSE,
  raw_event_data JSONB, -- Store full event data for debugging
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_event_date UNIQUE(event_id, game_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_props_games_date ON player_props_games(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_props_games_event ON player_props_games(event_id);
CREATE INDEX IF NOT EXISTS idx_player_props_games_teams ON player_props_games(home_team_tricode, away_team_tricode);
CREATE INDEX IF NOT EXISTS idx_player_props_games_created ON player_props_games(created_at DESC);

-- ============================================================================
-- 2. PLAYER PROPS TABLE
-- ============================================================================
-- Stores individual player props (one row per prop per bookmaker)

CREATE TABLE IF NOT EXISTS public.player_props (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Game Reference
  game_id UUID NOT NULL REFERENCES player_props_games(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL, -- Denormalized for easier queries
  
  -- Player Information
  player_name TEXT NOT NULL,
  player_id UUID REFERENCES nba_players(id), -- Link to nba_players if available
  nba_player_id INTEGER, -- NBA.com player ID
  
  -- Bet Information
  bet_type TEXT NOT NULL, -- e.g., 'points', 'rebounds', 'assists'
  bet_type_id TEXT NOT NULL, -- SportsGameOdds bet type ID
  line NUMERIC, -- The line/over-under (e.g., 25.5 for points)
  price TEXT, -- Odds in decimal format (e.g., "1.91")
  american_odds TEXT, -- Converted American odds (e.g., "-110")
  
  -- Bookmaker
  bookmaker TEXT NOT NULL,
  bookmaker_id TEXT NOT NULL,
  
  -- Raw Data
  raw_odd_data JSONB, -- Store full odd data for debugging
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Game date for easier querying and cleanup
  game_date DATE NOT NULL,
  
  -- Constraints
  CONSTRAINT unique_prop UNIQUE(event_id, player_name, bet_type_id, bookmaker_id, game_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_props_game ON player_props(game_id);
CREATE INDEX IF NOT EXISTS idx_player_props_event ON player_props(event_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player ON player_props(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_props_nba_player ON player_props(nba_player_id) WHERE nba_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_player_props_name ON player_props(player_name);
CREATE INDEX IF NOT EXISTS idx_player_props_date ON player_props(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_props_bet_type ON player_props(bet_type);
CREATE INDEX IF NOT EXISTS idx_player_props_created ON player_props(created_at DESC);

-- ============================================================================
-- 3. PLAYER PROPS NAME MAPPING TABLE
-- ============================================================================
-- Allows manual mapping of API player names to database players
-- Useful for handling name variations and edge cases

CREATE TABLE IF NOT EXISTS public.player_props_name_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- API Name (from SportsGameOdds)
  api_player_name TEXT NOT NULL,
  
  -- Database Player Reference
  player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
  nba_player_id INTEGER,
  
  -- Context (optional, helps with disambiguation)
  team_tricode TEXT,
  league_id TEXT DEFAULT 'NBA',
  
  -- Confidence/Notes
  match_confidence NUMERIC DEFAULT 1.0, -- 0.0 to 1.0
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT unique_api_name UNIQUE(api_player_name, team_tricode, league_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_props_mapping_api_name ON player_props_name_mapping(api_player_name);
CREATE INDEX IF NOT EXISTS idx_player_props_mapping_player ON player_props_name_mapping(player_id);
CREATE INDEX IF NOT EXISTS idx_player_props_mapping_team ON player_props_name_mapping(team_tricode);

-- ============================================================================
-- 4. UPDATE TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_player_props_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_player_props_games_updated_at
  BEFORE UPDATE ON player_props_games
  FOR EACH ROW
  EXECUTE FUNCTION update_player_props_updated_at();

CREATE TRIGGER update_player_props_updated_at
  BEFORE UPDATE ON player_props
  FOR EACH ROW
  EXECUTE FUNCTION update_player_props_updated_at();

CREATE TRIGGER update_player_props_name_mapping_updated_at
  BEFORE UPDATE ON player_props_name_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_player_props_updated_at();

-- ============================================================================
-- 5. CLEANUP FUNCTION - DELETE DATA OLDER THAN 30 DAYS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_player_props()
RETURNS TABLE(deleted_games BIGINT, deleted_props BIGINT) AS $$
DECLARE
  cutoff_date DATE;
  games_deleted BIGINT;
  props_deleted BIGINT;
BEGIN
  -- Calculate cutoff date (30 days ago)
  cutoff_date := CURRENT_DATE - INTERVAL '30 days';
  
  -- Delete props older than 30 days (cascade will handle game deletion)
  DELETE FROM player_props
  WHERE game_date < cutoff_date;
  
  GET DIAGNOSTICS props_deleted = ROW_COUNT;
  
  -- Delete games older than 30 days (if no props remain)
  DELETE FROM player_props_games
  WHERE game_date < cutoff_date
    AND id NOT IN (SELECT DISTINCT game_id FROM player_props WHERE game_id IS NOT NULL);
  
  GET DIAGNOSTICS games_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT games_deleted, props_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Get player props for today
CREATE OR REPLACE FUNCTION get_player_props_for_today(
  p_player_id UUID DEFAULT NULL,
  p_nba_player_id INTEGER DEFAULT NULL,
  p_player_name TEXT DEFAULT NULL,
  p_team_tricode TEXT DEFAULT NULL
)
RETURNS TABLE (
  game_id UUID,
  event_id TEXT,
  game_date DATE,
  home_team TEXT,
  away_team TEXT,
  starts_at TIMESTAMPTZ,
  bet_type TEXT,
  bet_type_id TEXT,
  line NUMERIC,
  price TEXT,
  american_odds TEXT,
  bookmaker TEXT,
  bookmaker_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.game_id,
    pp.event_id,
    pp.game_date,
    g.home_team,
    g.away_team,
    g.starts_at,
    pp.bet_type,
    pp.bet_type_id,
    pp.line,
    pp.price,
    pp.american_odds,
    pp.bookmaker,
    pp.bookmaker_id
  FROM player_props pp
  JOIN player_props_games g ON pp.game_id = g.id
  WHERE pp.game_date = CURRENT_DATE
    AND (
      (p_player_id IS NOT NULL AND pp.player_id = p_player_id) OR
      (p_nba_player_id IS NOT NULL AND pp.nba_player_id = p_nba_player_id) OR
      (p_player_name IS NOT NULL AND LOWER(pp.player_name) = LOWER(p_player_name)) OR
      (p_team_tricode IS NOT NULL AND (g.home_team_tricode = p_team_tricode OR g.away_team_tricode = p_team_tricode))
    )
  ORDER BY pp.bet_type, pp.line, pp.bookmaker;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get player from mapping table
CREATE OR REPLACE FUNCTION get_player_from_mapping(
  p_api_name TEXT,
  p_team_tricode TEXT DEFAULT NULL
)
RETURNS TABLE (
  player_id UUID,
  nba_player_id INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.player_id,
    m.nba_player_id
  FROM player_props_name_mapping m
  WHERE LOWER(m.api_player_name) = LOWER(p_api_name)
    AND (p_team_tricode IS NULL OR m.team_tricode = p_team_tricode OR m.team_tricode IS NULL)
  ORDER BY 
    CASE WHEN m.team_tricode = p_team_tricode THEN 1 ELSE 2 END,
    m.match_confidence DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE player_props_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props_name_mapping ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for frontend)
CREATE POLICY "Allow public read access to player_props_games"
  ON player_props_games
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to player_props"
  ON player_props
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to player_props_name_mapping"
  ON player_props_name_mapping
  FOR SELECT
  USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to player_props_games"
  ON player_props_games
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to player_props"
  ON player_props
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to player_props_name_mapping"
  ON player_props_name_mapping
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 8. CLEANUP CRON JOB
-- ============================================================================
-- Sets up a daily cron job to clean up player props older than 30 days

-- Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-player-props') THEN
        PERFORM cron.unschedule('cleanup-old-player-props');
        RAISE NOTICE 'Removed existing cleanup-old-player-props job';
    END IF;
END $$;

-- Schedule cleanup to run daily at 2 AM
SELECT cron.schedule(
    'cleanup-old-player-props',           -- Job name
    '0 2 * * *',                          -- Daily at 2 AM
    $$
    SELECT cleanup_old_player_props();
    $$
);

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================

COMMENT ON TABLE player_props_games IS 'Stores game information for player props from SportsGameOdds API';
COMMENT ON TABLE player_props IS 'Stores individual player betting props';
COMMENT ON TABLE player_props_name_mapping IS 'Manual mapping of API player names to database players for props matching';
COMMENT ON FUNCTION cleanup_old_player_props() IS 'Deletes player props data older than 30 days';
