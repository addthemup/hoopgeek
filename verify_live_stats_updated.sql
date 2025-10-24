-- Verify Live Stats Are Updating
-- Run this in Supabase SQL Editor

-- Check most recent updates (should show stats from tonight's games)
SELECT 
  player_name,
  team_tricode,
  game_id,
  stats->>'pts' as points,
  stats->>'reb' as rebounds,
  stats->>'ast' as assists,
  stats->>'min' as minutes,
  updated_at,
  -- How long ago was this updated?
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_ago
FROM live_player_stats
ORDER BY updated_at DESC
LIMIT 20;

-- Check today's update status
SELECT 
  date,
  last_updated,
  status,
  games_processed,
  players_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 60 as minutes_since_update
FROM live_stats_updates
WHERE date = CURRENT_DATE
ORDER BY last_updated DESC
LIMIT 5;

-- Count total live stats today
SELECT 
  COUNT(*) as total_players,
  COUNT(DISTINCT game_id) as total_games
FROM live_player_stats
WHERE DATE(updated_at) = CURRENT_DATE;

-- Show all games with live stats today
SELECT 
  game_id,
  COUNT(*) as player_count,
  MAX(updated_at) as last_updated
FROM live_player_stats
WHERE DATE(updated_at) = CURRENT_DATE
GROUP BY game_id
ORDER BY last_updated DESC;

