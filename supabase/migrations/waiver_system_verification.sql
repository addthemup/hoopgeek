-- =====================================================
-- WAIVER SYSTEM VERIFICATION & UTILITY QUERIES
-- =====================================================
-- Use these queries to verify the waiver system is working
-- and to inspect waiver data
-- =====================================================

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- 1. Check if waiver columns were added to fantasy_league_seasons
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'fantasy_league_seasons'
AND column_name LIKE 'waiver%'
ORDER BY ordinal_position;

-- 2. Check if waiver tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('fantasy_waiver_order', 'fantasy_waiver_claims', 'fantasy_players_on_waivers')
ORDER BY table_name;

-- 3. Check if waiver functions exist
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'initialize_waiver_order',
    'drop_player',
    'submit_waiver_claim',
    'get_available_players_for_league',
    'get_team_pending_claims',
    'cancel_waiver_claim'
)
ORDER BY routine_name;

-- 4. Check if indexes were created
SELECT 
    indexname,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND (
    indexname LIKE 'idx_fantasy_waiver%' OR
    indexname LIKE 'idx_fantasy_players_on_waivers%'
)
ORDER BY tablename, indexname;

-- 5. Check if RLS policies were created
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('fantasy_waiver_order', 'fantasy_waiver_claims', 'fantasy_players_on_waivers')
ORDER BY tablename, policyname;

-- =====================================================
-- UTILITY QUERIES FOR DEVELOPMENT & DEBUGGING
-- =====================================================

-- View current waiver order for a league
-- Replace YOUR_LEAGUE_ID with actual UUID
/*
SELECT 
    ft.team_name,
    wo.waiver_priority,
    wo.remaining_budget,
    wo.total_spent,
    wo.total_claims,
    wo.last_claim_date
FROM fantasy_waiver_order wo
JOIN fantasy_teams ft ON wo.fantasy_team_id = ft.id
WHERE wo.league_id = 'YOUR_LEAGUE_ID'
ORDER BY wo.waiver_priority ASC;
*/

-- View all players currently on waivers in a league
-- Replace YOUR_LEAGUE_ID with actual UUID
/*
SELECT 
    np.name as player_name,
    np.position,
    np.team_abbreviation as nba_team,
    pow.waiver_status,
    pow.becomes_free_agent_at,
    ft.team_name as dropped_by,
    pow.dropped_at,
    EXTRACT(EPOCH FROM (pow.becomes_free_agent_at - NOW())) / 3600 as hours_until_free_agent
FROM fantasy_players_on_waivers pow
JOIN nba_players np ON pow.player_id = np.id
JOIN fantasy_teams ft ON pow.dropped_by_team_id = ft.id
WHERE pow.league_id = 'YOUR_LEAGUE_ID'
AND pow.waiver_status IN ('on_waivers', 'free_agent')
ORDER BY pow.becomes_free_agent_at ASC;
*/

-- View all pending waiver claims for a league
-- Replace YOUR_LEAGUE_ID with actual UUID
/*
SELECT 
    ft.team_name,
    np.name as player_claiming,
    np.position,
    np_drop.name as player_dropping,
    wc.claim_type,
    wc.bid_amount,
    wc.priority_at_claim,
    wc.claim_date
FROM fantasy_waiver_claims wc
JOIN fantasy_teams ft ON wc.fantasy_team_id = ft.id
JOIN nba_players np ON wc.player_id = np.id
LEFT JOIN nba_players np_drop ON wc.drop_player_id = np_drop.id
WHERE wc.league_id = 'YOUR_LEAGUE_ID'
AND wc.status = 'pending'
ORDER BY 
    CASE wc.claim_type
        WHEN 'free_agent' THEN 1
        ELSE 2
    END,
    wc.priority_at_claim ASC,
    wc.bid_amount DESC NULLS LAST,
    wc.claim_date ASC;
*/

-- View waiver settings for all leagues
SELECT 
    fl.name as league_name,
    fls.season_year,
    fls.waiver_type,
    fls.waiver_period_hours,
    fls.waiver_process_time,
    fls.waiver_budget_amount,
    fls.waiver_min_bid,
    fls.waiver_priority_reset,
    fls.waiver_claim_days
FROM fantasy_league_seasons fls
JOIN fantasy_leagues fl ON fls.league_id = fl.id
WHERE fls.is_active = true
ORDER BY fl.name, fls.season_year DESC;

-- View transaction history for a team (includes cuts)
-- Replace YOUR_TEAM_ID with actual UUID
/*
SELECT 
    ft.transaction_type,
    np.name as player_name,
    np.position,
    np.team_abbreviation as nba_team,
    ft.transaction_date,
    ft.notes,
    ft.status
FROM fantasy_transactions ft
JOIN nba_players np ON ft.player_id = np.id
WHERE ft.fantasy_team_id = 'YOUR_TEAM_ID'
ORDER BY ft.transaction_date DESC
LIMIT 50;
*/

-- =====================================================
-- SAMPLE TEST SCENARIO
-- =====================================================
-- Use this to test the waiver system end-to-end

/*
-- Step 1: Get a test league and season
SELECT 
    fl.id as league_id,
    fl.name as league_name,
    fls.id as season_id,
    fls.season_year
FROM fantasy_leagues fl
JOIN fantasy_league_seasons fls ON fl.league_id = fls.id
WHERE fls.is_active = true
LIMIT 1;

-- Step 2: Initialize waiver order for the league
-- Replace with your league_id and season_id from Step 1
SELECT initialize_waiver_order(
    'YOUR_LEAGUE_ID'::uuid,
    'YOUR_SEASON_ID'::uuid
);

-- Step 3: Verify waiver order was created
SELECT 
    ft.team_name,
    wo.waiver_priority,
    wo.remaining_budget
FROM fantasy_waiver_order wo
JOIN fantasy_teams ft ON wo.fantasy_team_id = ft.id
WHERE wo.league_id = 'YOUR_LEAGUE_ID'
ORDER BY wo.waiver_priority;

-- Step 4: Drop a player (this will put them on waivers)
-- Replace with actual UUIDs from your league
SELECT drop_player(
    'YOUR_LEAGUE_ID'::uuid,
    'YOUR_SEASON_ID'::uuid,
    'YOUR_TEAM_ID'::uuid,
    'YOUR_PLAYER_ID'::uuid,
    'YOUR_USER_ID'::uuid,
    'Testing waiver system'
);

-- Step 5: Verify player is on waivers
SELECT 
    np.name,
    pow.waiver_status,
    pow.becomes_free_agent_at
FROM fantasy_players_on_waivers pow
JOIN nba_players np ON pow.player_id = np.id
WHERE pow.league_id = 'YOUR_LEAGUE_ID'
AND pow.player_id = 'YOUR_PLAYER_ID';

-- Step 6: Submit a waiver claim for that player
-- Replace with actual UUIDs
SELECT submit_waiver_claim(
    'YOUR_LEAGUE_ID'::uuid,
    'YOUR_SEASON_ID'::uuid,
    'CLAIMING_TEAM_ID'::uuid,
    'YOUR_PLAYER_ID'::uuid,
    'PLAYER_TO_DROP_ID'::uuid,  -- Optional
    5  -- Bid amount (for FAAB only)
);

-- Step 7: View pending claims
SELECT * FROM get_team_pending_claims('CLAIMING_TEAM_ID'::uuid);

-- Step 8: Cancel a claim (optional)
SELECT cancel_waiver_claim(
    'YOUR_CLAIM_ID'::uuid,
    'YOUR_USER_ID'::uuid
);
*/

-- =====================================================
-- CLEANUP QUERIES (USE WITH CAUTION!)
-- =====================================================
-- Only use these if you need to reset waiver data for testing

-- Clear all waiver data for a specific league (DANGEROUS!)
/*
DELETE FROM fantasy_waiver_claims WHERE league_id = 'YOUR_LEAGUE_ID';
DELETE FROM fantasy_players_on_waivers WHERE league_id = 'YOUR_LEAGUE_ID';
DELETE FROM fantasy_waiver_order WHERE league_id = 'YOUR_LEAGUE_ID';
*/

-- Clear all pending claims for a league
/*
DELETE FROM fantasy_waiver_claims 
WHERE league_id = 'YOUR_LEAGUE_ID' 
AND status = 'pending';
*/

-- =====================================================
-- MIGRATION ROLLBACK (IF NEEDED)
-- =====================================================
-- If you need to completely remove the waiver system

/*
-- Drop tables
DROP TABLE IF EXISTS fantasy_waiver_claims CASCADE;
DROP TABLE IF EXISTS fantasy_players_on_waivers CASCADE;
DROP TABLE IF EXISTS fantasy_waiver_order CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS initialize_waiver_order(UUID, UUID);
DROP FUNCTION IF EXISTS drop_player(UUID, UUID, UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS submit_waiver_claim(UUID, UUID, UUID, UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS get_available_players_for_league(UUID, UUID);
DROP FUNCTION IF EXISTS get_team_pending_claims(UUID);
DROP FUNCTION IF EXISTS cancel_waiver_claim(UUID, UUID);

-- Remove columns from fantasy_league_seasons
ALTER TABLE fantasy_league_seasons
DROP COLUMN IF EXISTS waiver_type,
DROP COLUMN IF EXISTS waiver_period_hours,
DROP COLUMN IF EXISTS waiver_process_time,
DROP COLUMN IF EXISTS waiver_budget_amount,
DROP COLUMN IF EXISTS waiver_min_bid,
DROP COLUMN IF EXISTS waiver_priority_reset,
DROP COLUMN IF EXISTS waiver_claim_days;
*/

-- =====================================================
-- END OF VERIFICATION & UTILITY QUERIES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Waiver system verification queries ready!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Run the verification queries above to check:';
    RAISE NOTICE '   1. Columns added to fantasy_league_seasons';
    RAISE NOTICE '   2. New tables created';
    RAISE NOTICE '   3. Functions created';
    RAISE NOTICE '   4. Indexes created';
    RAISE NOTICE '   5. RLS policies created';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Use the sample test scenario to verify end-to-end';
    RAISE NOTICE '🔍 Use utility queries to inspect waiver data';
    RAISE NOTICE '⚠️  Cleanup queries are available but use with caution!';
    RAISE NOTICE '';
END $$;

