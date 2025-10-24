-- Query to find all active players without 2025-26 salaries
SELECT 
  np.id,
  np.name,
  np.team_abbreviation,
  np.team_name,
  np.position,
  np.jersey_number,
  np.is_active,
  np.is_rookie,
  np.nba_player_id
FROM nba_players np
LEFT JOIN nba_hoopshype_salaries hs ON np.id = hs.player_id
WHERE np.is_active = true
  AND (hs.salary_2025_26 IS NULL OR hs.player_id IS NULL)
ORDER BY np.team_abbreviation, np.name;

-- Get count of players missing salaries
SELECT COUNT(*) as missing_salary_count
FROM nba_players np
LEFT JOIN nba_hoopshype_salaries hs ON np.id = hs.player_id
WHERE np.is_active = true
  AND (hs.salary_2025_26 IS NULL OR hs.player_id IS NULL);

