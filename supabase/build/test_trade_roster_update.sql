-- =====================================================
-- TEST: Verify Trade Roster Updates
-- =====================================================
-- This script helps diagnose why traded players aren't
-- appearing on team rosters after a trade is accepted.
-- =====================================================

-- Step 1: Check if there are any recent trades
SELECT 
    'Recent Trades' as check_name,
    dto.id as trade_id,
    dto.status,
    dto.created_at,
    dto.responded_at,
    ft_from.team_name as from_team,
    ft_to.team_name as to_team,
    dto.offered_players,
    dto.requested_players,
    dto.offered_picks,
    dto.requested_picks
FROM draft_trade_offers dto
JOIN fantasy_teams ft_from ON dto.from_team_id = ft_from.id
JOIN fantasy_teams ft_to ON dto.to_team_id = ft_to.id
WHERE dto.created_at > NOW() - INTERVAL '1 hour'
ORDER BY dto.created_at DESC
LIMIT 10;

-- Step 2: Check fantasy_roster_spots for the teams involved in recent trades
WITH recent_trades AS (
    SELECT 
        dto.from_team_id,
        dto.to_team_id,
        dto.offered_players,
        dto.requested_players
    FROM draft_trade_offers dto
    WHERE dto.status = 'accepted'
        AND dto.responded_at > NOW() - INTERVAL '1 hour'
    LIMIT 1
)
SELECT 
    'Roster Spots After Trade' as check_name,
    frs.id as roster_spot_id,
    frs.fantasy_team_id,
    ft.team_name,
    frs.player_id,
    np.name as player_name,
    frs.assigned_at,
    frs.assigned_by,
    CASE 
        WHEN frs.player_id = ANY((SELECT offered_players FROM recent_trades)) THEN 'OFFERED PLAYER'
        WHEN frs.player_id = ANY((SELECT requested_players FROM recent_trades)) THEN 'REQUESTED PLAYER'
        ELSE 'OTHER PLAYER'
    END as player_role_in_trade
FROM fantasy_roster_spots frs
JOIN fantasy_teams ft ON frs.fantasy_team_id = ft.id
LEFT JOIN nba_players np ON frs.player_id = np.id
WHERE frs.fantasy_team_id IN (
    SELECT from_team_id FROM recent_trades
    UNION
    SELECT to_team_id FROM recent_trades
)
ORDER BY ft.team_name, frs.assigned_at DESC;

-- Step 3: Check if player IDs match between draft_trade_offers and fantasy_roster_spots
WITH recent_trade AS (
    SELECT 
        dto.id as trade_id,
        dto.from_team_id,
        dto.to_team_id,
        dto.offered_players,
        dto.requested_players,
        ft_from.team_name as from_team,
        ft_to.team_name as to_team
    FROM draft_trade_offers dto
    JOIN fantasy_teams ft_from ON dto.from_team_id = ft_from.id
    JOIN fantasy_teams ft_to ON dto.to_team_id = ft_to.id
    WHERE dto.status = 'accepted'
        AND dto.responded_at > NOW() - INTERVAL '1 hour'
    ORDER BY dto.responded_at DESC
    LIMIT 1
)
SELECT 
    'Player ID Matching Check' as check_name,
    rt.trade_id,
    rt.from_team,
    rt.to_team,
    unnest(rt.offered_players) as offered_player_id,
    np.name as player_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM fantasy_roster_spots frs 
            WHERE frs.player_id = unnest(rt.offered_players)
        ) THEN 'FOUND IN ROSTER_SPOTS'
        ELSE 'NOT FOUND IN ROSTER_SPOTS'
    END as roster_spot_status,
    (
        SELECT frs.fantasy_team_id 
        FROM fantasy_roster_spots frs 
        WHERE frs.player_id = unnest(rt.offered_players) 
        LIMIT 1
    ) as current_team_id,
    (
        SELECT ft.team_name 
        FROM fantasy_roster_spots frs 
        JOIN fantasy_teams ft ON frs.fantasy_team_id = ft.id
        WHERE frs.player_id = unnest(rt.offered_players) 
        LIMIT 1
    ) as current_team_name
FROM recent_trade rt
LEFT JOIN nba_players np ON np.id = unnest(rt.offered_players);

-- Step 4: Check if the accept_trade_offer function exists and its definition
SELECT 
    'Function Check' as check_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.proname = 'accept_trade_offer';

-- Step 5: Manually test the UPDATE query that should move players
-- (This is what the accept_trade_offer function does internally)
WITH recent_trade AS (
    SELECT 
        dto.from_team_id,
        dto.to_team_id,
        dto.offered_players,
        dto.requested_players
    FROM draft_trade_offers dto
    WHERE dto.status = 'accepted'
        AND dto.responded_at > NOW() - INTERVAL '1 hour'
    ORDER BY dto.responded_at DESC
    LIMIT 1
)
SELECT 
    'Would UPDATE Query Work?' as check_name,
    frs.id as roster_spot_id,
    frs.fantasy_team_id as current_team_id,
    ft.team_name as current_team,
    frs.player_id,
    np.name as player_name,
    rt.to_team_id as should_move_to_team_id,
    (SELECT team_name FROM fantasy_teams WHERE id = rt.to_team_id) as should_move_to_team,
    CASE 
        WHEN frs.fantasy_team_id = rt.from_team_id THEN '✅ WOULD BE UPDATED'
        ELSE '❌ WOULD NOT BE UPDATED'
    END as update_status
FROM fantasy_roster_spots frs
JOIN fantasy_teams ft ON frs.fantasy_team_id = ft.id
LEFT JOIN nba_players np ON frs.player_id = np.id
CROSS JOIN recent_trade rt
WHERE frs.player_id = ANY(rt.offered_players);

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================
-- If the trade system is working correctly:
-- 1. Recent Trades should show accepted trades
-- 2. Roster Spots After Trade should show players on their NEW teams
-- 3. Player ID Matching Check should show FOUND IN ROSTER_SPOTS for all traded players
-- 4. Would UPDATE Query Work should show "✅ WOULD BE UPDATED" for offered players
--
-- If players aren't moving:
-- - Check if player_id format matches (UUID vs string)
-- - Check if fantasy_team_id is being updated
-- - Check if the UPDATE query conditions are correct
-- =====================================================

