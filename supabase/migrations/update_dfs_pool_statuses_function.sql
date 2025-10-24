-- ============================================================================
-- Function to update DFS pool statuses based on game completion
-- ============================================================================

-- This function checks all active DFS pools and updates their status based on the games:
-- - 'scheduled' → 'live' when first game starts (game_status = 2)
-- - 'live' → 'completed' when all games are finished (game_status = 3)

CREATE OR REPLACE FUNCTION update_dfs_pool_statuses()
RETURNS TABLE(
  pool_id UUID,
  old_status TEXT,
  new_status TEXT,
  total_games INTEGER,
  finished_games INTEGER,
  live_games INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH pool_game_status AS (
    SELECT 
      p.id as pool_id,
      p.status::TEXT as current_status,  -- Cast to TEXT for comparisons
      COUNT(pg.game_id) as total_games,
      -- Consider game finished if: game_status = 3 OR game ended >3 hours ago
      COUNT(CASE 
        WHEN g.game_status = 3 THEN 1 
        WHEN g.game_date < NOW() - INTERVAL '3 hours' THEN 1 
      END) as finished_games,
      -- Consider game live if: game_status = 2 OR game started <3 hours ago AND not finished
      COUNT(CASE 
        WHEN g.game_status = 2 THEN 1
        WHEN g.game_date < NOW() AND g.game_date > NOW() - INTERVAL '3 hours' AND g.game_status != 3 THEN 1
      END) as live_games,
      COUNT(CASE WHEN g.game_status = 1 AND g.game_date > NOW() THEN 1 END) as scheduled_games
    FROM dfs_pools p
    LEFT JOIN dfs_pool_games pg ON p.id = pg.pool_id
    LEFT JOIN nba_games g ON pg.game_id = g.game_id
    WHERE p.status IN ('scheduled', 'live')
    GROUP BY p.id, p.status
  ),
  status_updates AS (
    SELECT 
      pgs.pool_id,
      pgs.current_status as old_status,
      CASE
        -- All games finished → completed
        WHEN pgs.finished_games = pgs.total_games AND pgs.total_games > 0 THEN 'completed'
        -- At least one game is live or finished → live
        WHEN pgs.live_games > 0 OR pgs.finished_games > 0 THEN 'live'
        -- Otherwise keep as scheduled
        ELSE 'scheduled'
      END as new_status,
      pgs.total_games,
      pgs.finished_games,
      pgs.live_games
    FROM pool_game_status pgs
    WHERE 
      -- Only update if status needs to change
      CASE
        WHEN pgs.finished_games = pgs.total_games AND pgs.total_games > 0 THEN 'completed'
        WHEN pgs.live_games > 0 OR pgs.finished_games > 0 THEN 'live'
        ELSE 'scheduled'
      END != pgs.current_status
  )
  -- Perform the updates
  UPDATE dfs_pools p
  SET 
    status = su.new_status::dfs_pool_status,  -- Cast TEXT to ENUM
    updated_at = NOW()
  FROM status_updates su
  WHERE p.id = su.pool_id
  RETURNING 
    p.id as pool_id,
    su.old_status,
    su.new_status,
    su.total_games::INTEGER,
    su.finished_games::INTEGER,
    su.live_games::INTEGER;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_dfs_pool_statuses IS 
'Updates DFS pool statuses based on NBA game completion. 
Should be called periodically (e.g., every 5-10 minutes during game days) via cron job.
Returns a list of pools that were updated with their old and new statuses.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_dfs_pool_statuses() TO authenticated, service_role;

