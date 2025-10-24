-- Diagnose why DFS entry modal isn't showing live stats

-- 1. Check your pool status (should be 'live' for live scores to show)
SELECT 
  id,
  name,
  slate_date,
  status,
  lock_time,
  CASE 
    WHEN status = 'live' THEN '✅ Pool is live'
    WHEN status = 'scheduled' THEN '⚠️ Pool hasn't started yet'
    WHEN status = 'completed' THEN 'ℹ️ Pool is completed'
    ELSE '❓ Unknown status'
  END as status_message
FROM dfs_pools
WHERE slate_date >= CURRENT_DATE - 1
ORDER BY slate_date DESC, created_at DESC
LIMIT 5;

-- 2. Check if pool has games assigned
SELECT 
  dp.name as pool_name,
  dp.status as pool_status,
  dpg.game_id,
  ng.home_team_tricode || ' vs ' || ng.away_team_tricode as matchup,
  ng.game_status,
  CASE ng.game_status
    WHEN 1 THEN 'Not started'
    WHEN 2 THEN '🔴 LIVE'
    WHEN 3 THEN 'Final'
    ELSE 'Unknown'
  END as game_status_text
FROM dfs_pools dp
LEFT JOIN dfs_pool_games dpg ON dp.id = dpg.pool_id
LEFT JOIN nba_games ng ON dpg.game_id = ng.game_id
WHERE dp.slate_date >= CURRENT_DATE - 1
ORDER BY dp.created_at DESC
LIMIT 10;

-- 3. Check if live_player_stats exist for today's games
SELECT 
  game_id,
  COUNT(*) as players_with_stats,
  MAX(updated_at) as last_update,
  EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 60 as minutes_ago,
  MAX((stats->>'pts')::int) as highest_points
FROM live_player_stats
WHERE DATE(updated_at) = CURRENT_DATE
GROUP BY game_id
ORDER BY last_update DESC;

-- 4. Sample live stats from current games
SELECT 
  lps.game_id,
  lps.player_name,
  lps.team_tricode,
  lps.stats->>'pts' as points,
  lps.stats->>'reb' as rebounds,
  lps.stats->>'ast' as assists,
  lps.updated_at
FROM live_player_stats lps
WHERE DATE(lps.updated_at) = CURRENT_DATE
ORDER BY lps.updated_at DESC
LIMIT 10;

-- 5. Check if your entries have lineup positions with valid nba_player_ids
SELECT 
  de.id as entry_id,
  dp.name as pool_name,
  dp.status,
  dlp.player_name,
  dlp.nba_player_id,
  CASE 
    WHEN lps.id IS NOT NULL THEN '✅ Has live stats'
    ELSE '❌ No live stats'
  END as live_stats_status,
  lps.stats->>'pts' as live_points
FROM dfs_entries de
JOIN dfs_pools dp ON de.pool_id = dp.id
JOIN dfs_lineups dl ON dl.entry_id = de.id
JOIN dfs_lineup_positions dlp ON dlp.lineup_id = dl.id
LEFT JOIN live_player_stats lps ON lps.nba_player_id = dlp.nba_player_id 
  AND DATE(lps.updated_at) = CURRENT_DATE
WHERE dp.slate_date >= CURRENT_DATE
AND de.is_submitted = true
ORDER BY de.created_at DESC
LIMIT 20;

