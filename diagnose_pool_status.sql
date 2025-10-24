-- Check current pool status and games
SELECT 
  dp.id,
  dp.name,
  dp.slate_date,
  dp.status as pool_status,
  dp.lock_time,
  dp.finalized_at,
  COUNT(dpg.game_id) as total_games,
  COUNT(CASE WHEN ng.game_status = 3 THEN 1 END) as finished_games,
  COUNT(CASE WHEN ng.game_status = 2 THEN 1 END) as live_games,
  COUNT(CASE WHEN ng.game_status = 1 THEN 1 END) as scheduled_games,
  MAX(ng.game_time_utc) as latest_game_time
FROM dfs_pools dp
LEFT JOIN dfs_pool_games dpg ON dp.id = dpg.pool_id
LEFT JOIN nba_games ng ON dpg.game_id = ng.game_id
WHERE dp.slate_date >= CURRENT_DATE - 2
GROUP BY dp.id, dp.name, dp.slate_date, dp.status, dp.lock_time, dp.finalized_at
ORDER BY dp.slate_date DESC, dp.created_at DESC;

-- Check individual game statuses for the most recent live pool
SELECT 
  dp.name as pool_name,
  ng.game_id,
  ng.home_team_tricode || ' vs ' || ng.away_team_tricode as matchup,
  ng.game_status,
  CASE ng.game_status
    WHEN 1 THEN '⏰ Not Started'
    WHEN 2 THEN '🔴 LIVE'
    WHEN 3 THEN '✅ Final'
    ELSE '❓ Unknown'
  END as status_text,
  ng.game_time_utc,
  ng.updated_at
FROM dfs_pools dp
JOIN dfs_pool_games dpg ON dp.id = dpg.pool_id
JOIN nba_games ng ON dpg.game_id = ng.game_id
WHERE dp.status = 'live'
ORDER BY ng.game_time_utc DESC;

-- Check if there's a DFS worker or update function
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%dfs%status%'
   OR routine_name LIKE '%update%pool%'
ORDER BY routine_name;

