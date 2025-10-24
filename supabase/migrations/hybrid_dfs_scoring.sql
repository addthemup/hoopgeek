-- DFS Scoring: Use nba_boxscores for final games, live_player_stats for live games
DROP FUNCTION IF EXISTS update_lineup_position_scores(UUID);

CREATE FUNCTION update_lineup_position_scores(p_pool_id UUID)
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
  SELECT scoring_format INTO v_scoring_format FROM dfs_pools WHERE id = p_pool_id;
  
  RETURN QUERY
  WITH player_scores AS (
    SELECT 
      lp.id as position_id,
      lp.nba_player_id,
      lp.unit_multiplier,
      jsonb_agg(
        jsonb_build_object(
          'game_id', COALESCE(bs.game_id, lps.game_id),
          'stats', CASE 
            -- Use nba_boxscores if game is final (status = 3)
            WHEN g.game_status = 3 AND bs.game_id IS NOT NULL THEN jsonb_build_object(
              'pts', bs.pts, 'reb', bs.reb, 'ast', bs.ast, 
              'stl', bs.stl, 'blk', bs.blk, 'tov', bs.tov, 'fg3m', bs.fg3m
            )
            -- Use live_player_stats for live games (status = 2)
            ELSE lps.stats
          END,
          'fantasy_points', calculate_fantasy_points(
            CASE 
              WHEN g.game_status = 3 AND bs.game_id IS NOT NULL THEN jsonb_build_object(
                'pts', bs.pts, 'reb', bs.reb, 'ast', bs.ast,
                'stl', bs.stl, 'blk', bs.blk, 'tov', bs.tov, 'fg3m', bs.fg3m
              )
              ELSE lps.stats
            END,
            v_scoring_format
          ),
          'source', CASE WHEN g.game_status = 3 AND bs.game_id IS NOT NULL THEN 'final' ELSE 'live' END
        ) ORDER BY COALESCE(bs.game_id, lps.game_id)
      ) FILTER (WHERE COALESCE(bs.game_id, lps.game_id) IS NOT NULL) as games_data,
      COALESCE(
        SUM(
          calculate_fantasy_points(
            CASE 
              WHEN g.game_status = 3 AND bs.game_id IS NOT NULL THEN jsonb_build_object(
                'pts', bs.pts, 'reb', bs.reb, 'ast', bs.ast,
                'stl', bs.stl, 'blk', bs.blk, 'tov', bs.tov, 'fg3m', bs.fg3m
              )
              ELSE lps.stats
            END,
            v_scoring_format
          )
        ),
        0
      ) as total_raw_points,
      COUNT(COALESCE(bs.game_id, lps.game_id)) as games_count
    FROM dfs_lineup_positions lp
    JOIN dfs_pool_games pg ON lp.pool_id = pg.pool_id
    JOIN nba_games g ON pg.game_id = g.game_id
    LEFT JOIN nba_boxscores bs ON bs.nba_player_id = lp.nba_player_id 
      AND bs.game_id = pg.game_id
      AND g.game_status = 3  -- Only use boxscores for final games
    LEFT JOIN live_player_stats lps ON lps.nba_player_id = lp.nba_player_id 
      AND lps.game_id = pg.game_id
      AND g.game_status = 2  -- Only use live stats for live games
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
  RETURNING lp.id, lp.nba_player_id, lp.raw_fantasy_points, lp.weighted_points, lp.games_played;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_lineup_position_scores TO service_role;

-- Test it now
SELECT * FROM score_dfs_pool('28ce1c05-b717-47dd-b43a-8b0206eecdfd');

-- Check results
SELECT 
  e.final_points,
  e.rank
FROM dfs_entries e
WHERE e.id = '4af0f004-f6d8-4820-9d94-d2a14b758aaf';

