-- ============================================================================
-- DFS SCORING SYSTEM - Calculate and Update Fantasy Points
-- ============================================================================
-- This migration creates functions to:
-- 1. Calculate fantasy points from player stats (FanDuel scoring)
-- 2. Update lineup position scores
-- 3. Calculate entry totals and rank entries within pools
-- ============================================================================

-- ============================================================================
-- 1. Function to calculate FanDuel fantasy points from stats
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_fanduel_points(stats JSONB)
RETURNS DECIMAL AS $$
DECLARE
  points DECIMAL := 0;
BEGIN
  -- FanDuel Scoring:
  -- Points: 1 pt
  -- 3-Pointers Made: 0.5 pts (bonus, in addition to point)
  -- Rebounds: 1.25 pts
  -- Assists: 1.5 pts
  -- Steals: 2 pts
  -- Blocks: 2 pts
  -- Turnovers: -1 pt
  
  points := points + COALESCE((stats->>'pts')::DECIMAL, 0) * 1.0;
  points := points + COALESCE((stats->>'fg3m')::DECIMAL, 0) * 0.5;
  points := points + COALESCE((stats->>'reb')::DECIMAL, 0) * 1.25;
  points := points + COALESCE((stats->>'ast')::DECIMAL, 0) * 1.5;
  points := points + COALESCE((stats->>'stl')::DECIMAL, 0) * 2.0;
  points := points + COALESCE((stats->>'blk')::DECIMAL, 0) * 2.0;
  points := points + COALESCE((stats->>'tov')::DECIMAL, 0) * -1.0;
  
  RETURN points;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_fanduel_points IS 
'Calculates FanDuel fantasy points from a JSONB stats object.
Stats object should contain: pts, fg3m, reb, ast, stl, blk, tov';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_fanduel_points TO authenticated, service_role;

-- ============================================================================
-- 2. Function to update lineup position scores from live stats
-- ============================================================================

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
BEGIN
  -- Update each lineup position with their fantasy points
  -- This joins with live_player_stats to get current stats
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
          'fantasy_points', calculate_fanduel_points(lps.stats),
          'updated_at', lps.updated_at
        ) ORDER BY lps.game_id
      ) as games_data,
      -- Sum fantasy points across all games
      COALESCE(SUM(calculate_fanduel_points(lps.stats)), 0) as total_raw_points,
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
'Updates fantasy point scores for all lineup positions in a pool.
Fetches stats from live_player_stats and calculates FanDuel points.
Returns updated position scores.';

GRANT EXECUTE ON FUNCTION update_lineup_position_scores TO service_role;

-- ============================================================================
-- 3. Function to calculate entry totals and update entry scores
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_entry_scores(
  p_pool_id UUID
)
RETURNS TABLE(
  entry_id UUID,
  user_id UUID,
  lineup_id UUID,
  raw_score DECIMAL,
  final_score DECIMAL,
  player_count INTEGER
) AS $$
BEGIN
  -- Calculate total scores for all entries in a pool
  RETURN QUERY
  WITH entry_totals AS (
    SELECT 
      l.entry_id,
      e.user_id,
      l.id as lineup_id,
      COALESCE(SUM(lp.raw_fantasy_points), 0) as raw_score,
      COALESCE(SUM(lp.weighted_points), 0) as final_score,
      COUNT(lp.id)::INTEGER as player_count
    FROM dfs_lineups l
    JOIN dfs_entries e ON l.entry_id = e.id
    LEFT JOIN dfs_lineup_positions lp ON l.id = lp.lineup_id
    WHERE l.pool_id = p_pool_id
      AND e.is_submitted = TRUE
    GROUP BY l.entry_id, e.user_id, l.id
  )
  UPDATE dfs_entries e
  SET 
    lineup_id = et.lineup_id,
    raw_score = et.raw_score,
    final_score = et.final_score,
    final_points = et.final_score, -- Mirror for compatibility
    updated_at = NOW()
  FROM entry_totals et
  WHERE e.id = et.entry_id
  RETURNING 
    e.id as entry_id,
    e.user_id,
    et.lineup_id,
    e.raw_score,
    e.final_score,
    et.player_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_entry_scores IS 
'Calculates and updates total scores for all entries in a pool.
Sums raw_fantasy_points and weighted_points from lineup positions.
Returns updated entry scores.';

GRANT EXECUTE ON FUNCTION calculate_entry_scores TO service_role;

-- ============================================================================
-- 4. Function to rank entries within a pool
-- ============================================================================

CREATE OR REPLACE FUNCTION rank_pool_entries(
  p_pool_id UUID
)
RETURNS TABLE(
  entry_id UUID,
  user_id UUID,
  final_score DECIMAL,
  rank INTEGER,
  percentile DECIMAL,
  total_entries INTEGER
) AS $$
BEGIN
  -- Rank all entries in a pool by final_score (descending)
  RETURN QUERY
  WITH ranked_entries AS (
    SELECT 
      e.id,
      e.user_id,
      e.final_score,
      RANK() OVER (ORDER BY e.final_score DESC NULLS LAST) as entry_rank,
      COUNT(*) OVER () as total_entries
    FROM dfs_entries e
    WHERE e.pool_id = p_pool_id
      AND e.is_submitted = TRUE
      AND e.final_score IS NOT NULL
  )
  UPDATE dfs_entries e
  SET 
    rank = re.entry_rank,
    final_rank = re.entry_rank, -- Mirror for compatibility
    percentile = (re.entry_rank::DECIMAL / re.total_entries::DECIMAL) * 100,
    updated_at = NOW()
  FROM ranked_entries re
  WHERE e.id = re.id
  RETURNING 
    e.id as entry_id,
    e.user_id,
    e.final_score,
    e.rank,
    e.percentile,
    re.total_entries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rank_pool_entries IS 
'Ranks all submitted entries in a pool by final_score (highest first).
Calculates rank and percentile for each entry.
Returns ranking results.';

GRANT EXECUTE ON FUNCTION rank_pool_entries TO service_role;

-- ============================================================================
-- 5. Master function to score an entire pool (all-in-one)
-- ============================================================================

CREATE OR REPLACE FUNCTION score_dfs_pool(
  p_pool_id UUID
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  positions_updated INTEGER;
  entries_updated INTEGER;
  entries_ranked INTEGER;
BEGIN
  -- Step 1: Update lineup position scores from live stats
  SELECT COUNT(*) INTO positions_updated
  FROM update_lineup_position_scores(p_pool_id);
  
  -- Step 2: Calculate entry totals
  SELECT COUNT(*) INTO entries_updated
  FROM calculate_entry_scores(p_pool_id);
  
  -- Step 3: Rank entries
  SELECT COUNT(*) INTO entries_ranked
  FROM rank_pool_entries(p_pool_id);
  
  -- Step 4: Mark entries as scored
  UPDATE dfs_entries
  SET 
    scored_at = NOW(),
    updated_at = NOW()
  WHERE pool_id = p_pool_id
    AND is_submitted = TRUE
    AND scored_at IS NULL;
  
  -- Return summary
  result := jsonb_build_object(
    'pool_id', p_pool_id,
    'positions_updated', positions_updated,
    'entries_updated', entries_updated,
    'entries_ranked', entries_ranked,
    'scored_at', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION score_dfs_pool IS 
'Master function that scores an entire DFS pool:
1. Updates lineup position scores from live_player_stats
2. Calculates entry totals
3. Ranks entries
4. Marks entries as scored
Returns a summary of updates performed.';

GRANT EXECUTE ON FUNCTION score_dfs_pool TO service_role;

-- ============================================================================
-- 6. Function to get live scoring updates for frontend
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pool_live_scores(
  p_pool_id UUID
)
RETURNS TABLE(
  entry_id UUID,
  user_id UUID,
  entry_name TEXT,
  final_score DECIMAL,
  rank INTEGER,
  percentile DECIMAL,
  total_entries INTEGER,
  lineup_positions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as entry_id,
    e.user_id,
    e.entry_name,
    e.final_score,
    e.rank,
    e.percentile,
    (SELECT COUNT(*)::INTEGER FROM dfs_entries WHERE pool_id = p_pool_id AND is_submitted = TRUE) as total_entries,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'player_name', lp.player_name,
          'player_team', lp.player_team,
          'unit', lp.unit,
          'unit_position', lp.unit_position,
          'unit_multiplier', lp.unit_multiplier,
          'raw_fantasy_points', lp.raw_fantasy_points,
          'weighted_points', lp.weighted_points,
          'games_played', lp.games_played,
          'games_data', lp.games_data
        ) ORDER BY lp.unit, lp.unit_position
      )
      FROM dfs_lineup_positions lp
      WHERE lp.lineup_id = l.id
    ) as lineup_positions
  FROM dfs_entries e
  JOIN dfs_lineups l ON e.id = l.entry_id
  WHERE e.pool_id = p_pool_id
    AND e.is_submitted = TRUE
  ORDER BY e.rank ASC NULLS LAST, e.final_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_pool_live_scores IS 
'Gets live scores and rankings for all entries in a pool.
Includes detailed lineup positions with fantasy points.
Used by frontend for leaderboards and live updates.';

GRANT EXECUTE ON FUNCTION get_pool_live_scores TO authenticated, anon;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ DFS Scoring System created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Functions Created:';
  RAISE NOTICE '   - calculate_fanduel_points(stats) - Calculate fantasy points';
  RAISE NOTICE '   - update_lineup_position_scores(pool_id) - Update position scores';
  RAISE NOTICE '   - calculate_entry_scores(pool_id) - Calculate entry totals';
  RAISE NOTICE '   - rank_pool_entries(pool_id) - Rank entries';
  RAISE NOTICE '   - score_dfs_pool(pool_id) - Master scoring function';
  RAISE NOTICE '   - get_pool_live_scores(pool_id) - Get live scores for frontend';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Usage:';
  RAISE NOTICE '   -- Score an entire pool:';
  RAISE NOTICE '   SELECT * FROM score_dfs_pool(''pool-uuid'');';
  RAISE NOTICE '';
  RAISE NOTICE '   -- Get live scores for frontend:';
  RAISE NOTICE '   SELECT * FROM get_pool_live_scores(''pool-uuid'');';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Prerequisites:';
  RAISE NOTICE '   - Run CREATE_LIVE_PLAYER_STATS_TABLE.sql first';
  RAISE NOTICE '   - Populate live_player_stats with NBA API data';
  RAISE NOTICE '';
END $$;

