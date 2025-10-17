-- Check if we have duplicate roster spots or incorrectly created spots
SELECT 
    ft.team_name,
    ft.id as team_id,
    COUNT(frs.id) as total_roster_spots,
    COUNT(frs.player_id) as filled_spots,
    COUNT(CASE WHEN frs.player_id IS NULL THEN 1 END) as empty_spots
FROM fantasy_teams ft
LEFT JOIN fantasy_roster_spots frs ON ft.id = frs.fantasy_team_id
WHERE ft.league_id IN (
    SELECT id FROM fantasy_leagues LIMIT 5
)
GROUP BY ft.team_name, ft.id
ORDER BY total_roster_spots DESC;
