-- =====================================================
-- CHECK FOR STALLED DRAFT PICKS
-- =====================================================
-- Find all picks that are incomplete but have no time_expires set
-- =====================================================

SELECT 
    fdo.league_id,
    fl.name as league_name,
    fdo.id as pick_id,
    fdo.pick_number,
    fdo.round,
    fdo.team_position,
    ft.team_name,
    fdo.is_completed,
    fdo.time_started,
    fdo.time_expires,
    fls.draft_status
FROM fantasy_draft_order fdo
JOIN fantasy_leagues fl ON fdo.league_id = fl.id
JOIN fantasy_teams ft ON fdo.league_id = ft.league_id AND fdo.team_position = ft.draft_position
JOIN fantasy_league_seasons fls ON fdo.league_id = fls.league_id
WHERE fdo.is_completed = FALSE
AND fdo.time_expires IS NULL
AND fls.draft_status = 'in_progress'
ORDER BY fdo.league_id, fdo.pick_number;

-- Count of stalled picks per league
SELECT 
    fdo.league_id,
    fl.name as league_name,
    COUNT(*) as stalled_picks_count
FROM fantasy_draft_order fdo
JOIN fantasy_leagues fl ON fdo.league_id = fl.id
JOIN fantasy_league_seasons fls ON fdo.league_id = fls.league_id
WHERE fdo.is_completed = FALSE
AND fdo.time_expires IS NULL
AND fls.draft_status = 'in_progress'
GROUP BY fdo.league_id, fl.name
ORDER BY stalled_picks_count DESC;

