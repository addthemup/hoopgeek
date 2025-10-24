-- Diagnose why waiver claims are failing

-- 1. Check the failed claims and their reasons
SELECT 
    fwc.id,
    fwc.status,
    fwc.failure_reason,
    fwc.bid_amount,
    fwc.priority,
    fwc.submitted_at,
    fwc.processed_at,
    ft.team_name as claiming_team,
    np.name as player_name,
    np2.name as player_to_drop
FROM fantasy_waiver_claims fwc
JOIN fantasy_teams ft ON ft.id = fwc.fantasy_team_id
JOIN nba_players np ON np.id = fwc.player_id
LEFT JOIN nba_players np2 ON np2.id = fwc.player_to_drop_id
WHERE fwc.status = 'failed'
ORDER BY fwc.processed_at DESC
LIMIT 10;

-- 2. Check roster spots for the claiming team
SELECT 
    frs.id,
    frs.player_id,
    np.name as player_name,
    frs.is_injured_reserve
FROM fantasy_roster_spots frs
LEFT JOIN nba_players np ON np.id = frs.player_id
WHERE frs.fantasy_team_id = (
    SELECT fantasy_team_id 
    FROM fantasy_waiver_claims 
    WHERE status = 'failed' 
    ORDER BY processed_at DESC 
    LIMIT 1
)
ORDER BY frs.player_id NULLS FIRST;

-- 3. Check if waiver order exists for the teams
SELECT 
    fwo.fantasy_team_id,
    ft.team_name,
    fwo.waiver_priority,
    fwo.remaining_budget,
    fwo.total_spent
FROM fantasy_waiver_order fwo
JOIN fantasy_teams ft ON ft.id = fwo.fantasy_team_id
WHERE fwo.league_id = (
    SELECT league_id 
    FROM fantasy_waiver_claims 
    WHERE status = 'failed' 
    ORDER BY processed_at DESC 
    LIMIT 1
)
ORDER BY fwo.waiver_priority;

