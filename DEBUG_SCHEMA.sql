-- Quick schema check to find the right join
SELECT 
  column_name, 
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'nba_hoopshype_salaries'
  AND column_name LIKE '%player%'
ORDER BY ordinal_position;

-- Also check nba_players
SELECT 
  column_name, 
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'nba_players'
  AND column_name IN ('id', 'nba_player_id', 'player_id')
ORDER BY ordinal_position;

