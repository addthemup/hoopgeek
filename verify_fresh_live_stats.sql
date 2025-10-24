-- Verify fresh live stats just came in!
SELECT 
  player_name,
  team_tricode,
  game_id,
  stats->>'pts' as points,
  stats->>'reb' as rebounds,
  stats->>'ast' as assists,
  stats->>'min' as minutes,
  updated_at,
  -- How many seconds ago was this updated?
  EXTRACT(EPOCH FROM (NOW() - updated_at)) as seconds_ago
FROM live_player_stats
WHERE updated_at > NOW() - INTERVAL '5 minutes'
ORDER BY updated_at DESC
LIMIT 20;

-- Count by game
SELECT 
  game_id,
  COUNT(*) as players,
  MAX(updated_at) as last_update,
  MAX(stats->>'pts') as highest_scorer_pts
FROM live_player_stats
WHERE updated_at > NOW() - INTERVAL '5 minutes'
GROUP BY game_id;

