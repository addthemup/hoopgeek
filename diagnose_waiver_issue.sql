-- =====================================================
-- DIAGNOSE WAIVER ISSUE
-- =====================================================
-- This script checks why dropped players aren't appearing in waivers

-- 1. Check if fantasy_players_on_waivers table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'fantasy_players_on_waivers'
        ) THEN '✅ fantasy_players_on_waivers table EXISTS'
        ELSE '❌ fantasy_players_on_waivers table MISSING - Run deploy_waiver_system_all_in_one.sql!'
    END as table_status;

-- 2. Check if there are ANY records in fantasy_players_on_waivers
SELECT 
    COUNT(*) as total_waiver_records,
    COUNT(CASE WHEN waiver_status = 'on_waivers' THEN 1 END) as on_waivers_count,
    COUNT(CASE WHEN waiver_status = 'free_agent' THEN 1 END) as free_agent_count
FROM fantasy_players_on_waivers;

-- 3. Check specific league's waiver data (REPLACE WITH YOUR LEAGUE ID)
-- Get your league ID first:
SELECT 
    l.id as league_id,
    l.name as league_name,
    ls.id as season_id,
    ls.waiver_type,
    ls.waiver_period_hours
FROM fantasy_leagues l
JOIN fantasy_league_seasons ls ON ls.league_id = l.id
WHERE ls.is_active = true
ORDER BY l.created_at DESC
LIMIT 5;

-- 4. Check ALL waiver records with player details
SELECT 
    fpw.id,
    fpw.league_id,
    fpw.season_id,
    fpw.player_id,
    np.name as player_name,
    fpw.waiver_status,
    fpw.dropped_at,
    fpw.becomes_free_agent_at,
    (fpw.becomes_free_agent_at - NOW()) as time_until_free_agent,
    ft.team_name as dropped_by_team,
    fpw.dropped_by_user_id
FROM fantasy_players_on_waivers fpw
JOIN nba_players np ON np.id = fpw.player_id
LEFT JOIN fantasy_teams ft ON ft.id = fpw.dropped_by_team_id
ORDER BY fpw.dropped_at DESC
LIMIT 20;

-- 5. Check recent transactions to see if player was dropped
SELECT 
    ft_trans.id,
    ft_trans.transaction_type,
    ft_trans.transaction_date,
    np.name as player_name,
    team.team_name as team_name,
    ft_trans.league_id,
    ft_trans.season_id,
    ft_trans.player_id
FROM fantasy_transactions ft_trans
JOIN nba_players np ON np.id = ft_trans.player_id
JOIN fantasy_teams team ON team.id = ft_trans.fantasy_team_id
WHERE ft_trans.transaction_type = 'cut'
ORDER BY ft_trans.transaction_date DESC
LIMIT 10;

-- 6. Cross-check: Are players in transactions but NOT in waivers?
SELECT 
    ft_trans.id as transaction_id,
    np.name as player_name,
    ft_trans.transaction_date as dropped_date,
    ft_trans.league_id,
    ft_trans.season_id,
    CASE 
        WHEN fpw.id IS NOT NULL THEN '✅ In waivers table'
        ELSE '❌ MISSING from waivers table!'
    END as waiver_status
FROM fantasy_transactions ft_trans
JOIN nba_players np ON np.id = ft_trans.player_id
LEFT JOIN fantasy_players_on_waivers fpw ON 
    fpw.player_id = ft_trans.player_id 
    AND fpw.league_id = ft_trans.league_id
    AND fpw.season_id = ft_trans.season_id
WHERE ft_trans.transaction_type = 'cut'
  AND ft_trans.transaction_date > NOW() - INTERVAL '1 day'
ORDER BY ft_trans.transaction_date DESC;

