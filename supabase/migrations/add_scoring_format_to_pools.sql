-- ============================================================================
-- Add scoring format to DFS pools
-- ============================================================================
-- This migration adds a scoring_format column to dfs_pools table
-- to track which fantasy scoring system is used for each pool
-- ============================================================================

-- Add scoring format column to dfs_pools
ALTER TABLE dfs_pools
ADD COLUMN IF NOT EXISTS scoring_format TEXT DEFAULT 'FanDuel' CHECK (
  scoring_format IN ('FanDuel', 'DraftKings', 'Yahoo', 'ESPN', 'Custom')
);

-- Create index for querying by scoring format
CREATE INDEX IF NOT EXISTS idx_dfs_pools_scoring_format 
ON dfs_pools(scoring_format);

-- Update the scoring config column to store detailed scoring settings (optional)
COMMENT ON COLUMN dfs_pools.scoring_format IS 
'Fantasy scoring system used for this pool: FanDuel, DraftKings, Yahoo, ESPN, or Custom';

COMMENT ON COLUMN dfs_pools.scoring_config IS 
'Optional JSONB field for custom scoring multipliers and bonuses';

-- Update existing pools to have FanDuel as default
UPDATE dfs_pools 
SET scoring_format = 'FanDuel' 
WHERE scoring_format IS NULL;

-- ============================================================================
-- Update the create_dfs_pool_from_games function to accept scoring_format
-- ============================================================================

-- Drop the old function first (need to specify all parameters)
DROP FUNCTION IF EXISTS create_dfs_pool_from_games(
  TEXT, TEXT, TEXT, DATE, TEXT[], DECIMAL, INTEGER, INTEGER, TEXT,
  BIGINT, INTEGER, INTEGER, INTEGER, DECIMAL, DECIMAL, DECIMAL
);

CREATE OR REPLACE FUNCTION create_dfs_pool_from_games(
  p_pool_name TEXT,
  p_slate_name TEXT,
  p_description TEXT,
  p_slate_date DATE,
  p_game_ids TEXT[],
  p_entry_fee DECIMAL DEFAULT 0.00,
  p_max_entries INTEGER DEFAULT 100,
  p_max_entries_per_user INTEGER DEFAULT 1,
  p_difficulty_tier TEXT DEFAULT 'standard',
  p_salary_cap BIGINT DEFAULT 150000000,
  p_starters_count INTEGER DEFAULT 5,
  p_rotation_count INTEGER DEFAULT 3,
  p_bench_count INTEGER DEFAULT 2,
  p_starters_multiplier DECIMAL DEFAULT 1.00,
  p_rotation_multiplier DECIMAL DEFAULT 0.75,
  p_bench_multiplier DECIMAL DEFAULT 0.50,
  p_scoring_format TEXT DEFAULT 'FanDuel'
)
RETURNS TABLE(
  pool_id UUID,
  games_added INTEGER,
  players_added INTEGER
) AS $$
DECLARE
  v_pool_id UUID;
  v_games_added INTEGER;
  v_players_added INTEGER;
  v_lock_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
BEGIN
  -- Calculate lock time (earliest game start time)
  SELECT MIN(game_date) INTO v_lock_time
  FROM nba_games
  WHERE game_id = ANY(p_game_ids);
  
  -- Calculate end time (latest game + 4 hours for overtime)
  SELECT MAX(game_date) + INTERVAL '4 hours' INTO v_end_time
  FROM nba_games
  WHERE game_id = ANY(p_game_ids);
  
  -- Create the pool with scoring format
  INSERT INTO dfs_pools (
    name,
    slate_name,
    description,
    slate_date,
    lock_time,
    end_time,
    entry_fee,
    max_entries,
    max_entries_per_user,
    difficulty_tier,
    salary_cap,
    roster_size,
    starters_count,
    rotation_count,
    bench_count,
    starters_multiplier,
    rotation_multiplier,
    bench_multiplier,
    scoring_format,
    status,
    is_public
  ) VALUES (
    p_pool_name,
    p_slate_name,
    p_description,
    p_slate_date,
    v_lock_time,
    v_end_time,
    p_entry_fee,
    p_max_entries,
    p_max_entries_per_user,
    p_difficulty_tier,
    p_salary_cap,
    p_starters_count + p_rotation_count + p_bench_count,
    p_starters_count,
    p_rotation_count,
    p_bench_count,
    p_starters_multiplier,
    p_rotation_multiplier,
    p_bench_multiplier,
    p_scoring_format,
    'scheduled',
    TRUE
  )
  RETURNING id INTO v_pool_id;
  
  -- Link games to the pool
  INSERT INTO dfs_pool_games (pool_id, game_id, home_team, away_team)
  SELECT 
    v_pool_id,
    g.game_id,
    g.home_team_tricode,
    g.away_team_tricode
  FROM nba_games g
  WHERE g.game_id = ANY(p_game_ids);
  
  GET DIAGNOSTICS v_games_added = ROW_COUNT;
  
  -- Add players from those games to the player pool with real salaries
  INSERT INTO dfs_player_salaries (
    pool_id,
    player_id,
    nba_player_id,
    player_name,
    team,
    position,
    salary
  )
  SELECT DISTINCT
    v_pool_id,
    p.id,
    p.nba_player_id,
    p.name,
    p.team_abbreviation,
    p.position,
    COALESCE(s.salary_2025_26, 5000000) as salary
  FROM nba_players p
  LEFT JOIN nba_hoopshype_salaries s ON p.id = s.player_id
  WHERE p.team_abbreviation IN (
    SELECT DISTINCT home_team_tricode FROM nba_games WHERE game_id = ANY(p_game_ids)
    UNION
    SELECT DISTINCT away_team_tricode FROM nba_games WHERE game_id = ANY(p_game_ids)
  )
  AND p.is_active = TRUE;
  
  GET DIAGNOSTICS v_players_added = ROW_COUNT;
  
  RETURN QUERY SELECT v_pool_id, v_games_added, v_players_added;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_dfs_pool_from_games IS 
'Creates a DFS pool with games, players, and specified scoring format';

GRANT EXECUTE ON FUNCTION create_dfs_pool_from_games TO authenticated, service_role;

-- ============================================================================
-- Update the scoring function to use pool's scoring format
-- ============================================================================

-- Update calculate_fanduel_points to be generic and accept 3PM bonus parameter
CREATE OR REPLACE FUNCTION calculate_fantasy_points(
  stats JSONB,
  scoring_format TEXT DEFAULT 'FanDuel'
)
RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
BEGIN
  -- Base scoring (same for most formats)
  points := points + COALESCE((stats->>'pts')::DECIMAL, 0) * 1.0;
  points := points + COALESCE((stats->>'ast')::DECIMAL, 0) * 1.5;
  points := points + COALESCE((stats->>'stl')::DECIMAL, 0) * 2.0;
  points := points + COALESCE((stats->>'blk')::DECIMAL, 0) * 2.0;
  
  -- Format-specific scoring
  CASE scoring_format
    WHEN 'FanDuel' THEN
      -- FanDuel: 1.2 per reb, -1 per tov, no 3PM bonus
      points := points + COALESCE((stats->>'reb')::DECIMAL, 0) * 1.2;
      points := points + COALESCE((stats->>'tov')::DECIMAL, 0) * -1.0;
      
    WHEN 'DraftKings' THEN
      -- DraftKings: 1.25 per reb, -0.5 per tov, bonuses for double-double/triple-double
      points := points + COALESCE((stats->>'reb')::DECIMAL, 0) * 1.25;
      points := points + COALESCE((stats->>'tov')::DECIMAL, 0) * -0.5;
      -- TODO: Add double-double (1.5) and triple-double (3.0) bonuses
      
    WHEN 'Yahoo', 'ESPN' THEN
      -- Yahoo/ESPN: 1.0 per reb, -1 per tov
      points := points + COALESCE((stats->>'reb')::DECIMAL, 0) * 1.0;
      points := points + COALESCE((stats->>'tov')::DECIMAL, 0) * -1.0;
      
    ELSE
      -- Default to FanDuel
      points := points + COALESCE((stats->>'reb')::DECIMAL, 0) * 1.2;
      points := points + COALESCE((stats->>'tov')::DECIMAL, 0) * -1.0;
  END CASE;
  
  RETURN ROUND(points, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_fantasy_points IS 
'Calculates fantasy points from stats JSONB based on scoring format (FanDuel, DraftKings, Yahoo, ESPN)';

GRANT EXECUTE ON FUNCTION calculate_fantasy_points TO authenticated, service_role;

-- Update the scoring function to use pool's scoring format
CREATE OR REPLACE FUNCTION update_lineup_position_scores(
  p_pool_id UUID
)
RETURNS TABLE(
  position_id UUID,
  nba_player_id INTEGER,
  raw_points DECIMAL,
  weighted_points DECIMAL,
  games_count INTEGER
) AS $$
DECLARE
  v_scoring_format TEXT;
BEGIN
  -- Get the pool's scoring format
  SELECT scoring_format INTO v_scoring_format
  FROM dfs_pools
  WHERE id = p_pool_id;
  
  -- Update each lineup position with their fantasy points using the pool's scoring format
  RETURN QUERY
  WITH player_scores AS (
    SELECT 
      lp.id as position_id,
      lp.nba_player_id,
      lp.unit_multiplier,
      -- Get all games for this pool
      jsonb_agg(
        jsonb_build_object(
          'game_id', lps.game_id,
          'stats', lps.stats,
          'fantasy_points', calculate_fantasy_points(lps.stats, v_scoring_format),
          'updated_at', lps.updated_at
        ) ORDER BY lps.game_id
      ) as games_data,
      -- Sum fantasy points across all games using pool's scoring format
      COALESCE(SUM(calculate_fantasy_points(lps.stats, v_scoring_format)), 0) as total_raw_points,
      COUNT(lps.game_id) as games_count
    FROM dfs_lineup_positions lp
    JOIN dfs_pool_games pg ON lp.pool_id = pg.pool_id
    LEFT JOIN live_player_stats lps ON lps.nba_player_id = lp.nba_player_id 
      AND lps.game_id = pg.game_id
    WHERE lp.pool_id = p_pool_id
    GROUP BY lp.id, lp.nba_player_id, lp.unit_multiplier
  )
  UPDATE dfs_lineup_positions lp
  SET 
    raw_fantasy_points = ps.total_raw_points,
    weighted_points = ps.total_raw_points * ps.unit_multiplier,
    games_played = ps.games_count,
    games_data = ps.games_data,
    updated_at = NOW()
  FROM player_scores ps
  WHERE lp.id = ps.position_id
  RETURNING 
    lp.id as position_id,
    lp.nba_player_id,
    lp.raw_fantasy_points as raw_points,
    lp.weighted_points as weighted_points,
    lp.games_played as games_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_lineup_position_scores IS 
'Updates fantasy point scores for all lineup positions in a pool using the pool''s scoring format';

GRANT EXECUTE ON FUNCTION update_lineup_position_scores TO service_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Scoring format added to DFS pools!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Changes:';
  RAISE NOTICE '   - Added scoring_format column to dfs_pools';
  RAISE NOTICE '   - Updated create_dfs_pool_from_games() to accept scoring_format';
  RAISE NOTICE '   - Updated calculate_fantasy_points() to support multiple formats';
  RAISE NOTICE '   - Updated update_lineup_position_scores() to use pool scoring format';
  RAISE NOTICE '';
  RAISE NOTICE '🎮 Supported Formats:';
  RAISE NOTICE '   - FanDuel (default)';
  RAISE NOTICE '   - DraftKings';
  RAISE NOTICE '   - Yahoo';
  RAISE NOTICE '   - ESPN';
  RAISE NOTICE '   - Custom';
  RAISE NOTICE '';
END $$;

