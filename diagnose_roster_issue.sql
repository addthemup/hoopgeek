-- =====================================================
-- DIAGNOSE ROSTER SPOT ISSUE
-- =====================================================
-- Run this to see what's actually happening in your database
-- =====================================================

-- 1. Check the actual make_draft_pick function in the database
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'make_draft_pick';

-- 2. Check for ANY triggers on fantasy_roster_spots
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'fantasy_roster_spots';

-- 3. Check for triggers on fantasy_draft_picks that might add roster spots
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'fantasy_draft_picks';

-- 4. For your specific team with 22 spots, show the details
-- Replace 'YOUR_TEAM_ID' with your actual team ID
/*
SELECT 
    frs.id,
    frs.player_id,
    np.name as player_name,
    frs.draft_round,
    frs.draft_pick,
    frs.created_at,
    frs.assigned_at
FROM fantasy_roster_spots frs
LEFT JOIN nba_players np ON frs.player_id = np.id
WHERE frs.fantasy_team_id = 'YOUR_TEAM_ID'
ORDER BY frs.created_at, frs.id;
*/

-- 5. Count roster spots per team in the league
SELECT 
    ft.team_name,
    COUNT(frs.id) as total_roster_spots,
    COUNT(frs.player_id) as filled_spots,
    MIN(frs.created_at) as first_spot_created,
    MAX(frs.created_at) as last_spot_created
FROM fantasy_teams ft
LEFT JOIN fantasy_roster_spots frs ON ft.id = frs.fantasy_team_id
WHERE ft.league_id IN (
    -- Get leagues that have drafts in progress or completed
    SELECT DISTINCT league_id 
    FROM fantasy_league_seasons 
    WHERE draft_status IN ('in_progress', 'completed')
    LIMIT 5
)
GROUP BY ft.id, ft.team_name
ORDER BY total_roster_spots DESC;

-- 6. Check if roster spots were created at draft time (BAD) or team creation time (GOOD)
-- Replace 'YOUR_TEAM_ID' with the team that has 22 spots
/*
SELECT 
    'Roster Spot Creation Timeline' as info,
    frs.id,
    frs.player_id,
    np.name as player_name,
    frs.created_at as roster_spot_created_at,
    frs.assigned_at as player_assigned_at,
    fdp.created_at as draft_pick_made_at,
    fdp.pick_number,
    CASE 
        WHEN frs.created_at < fdp.created_at THEN '✅ GOOD: Spot created before pick'
        WHEN frs.created_at = fdp.created_at OR frs.created_at > fdp.created_at - INTERVAL '1 second' 
             THEN '❌ BAD: Spot created during/after pick'
        ELSE '❓ Unknown timing'
    END as timing_analysis
FROM fantasy_roster_spots frs
LEFT JOIN nba_players np ON frs.player_id = np.id
LEFT JOIN fantasy_draft_picks fdp ON fdp.player_id = frs.player_id 
    AND fdp.fantasy_team_id = frs.fantasy_team_id
WHERE frs.fantasy_team_id = 'YOUR_TEAM_ID'
ORDER BY frs.created_at;
*/

