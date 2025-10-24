-- =====================================================
-- WAIVER SYSTEM DIAGNOSTIC SCRIPT
-- =====================================================
-- Run this to check if all waiver system components exist
-- =====================================================

\echo '🔍 Checking Waiver System Installation...'
\echo ''

-- Check if fantasy_transactions table exists
\echo '📋 1. Checking fantasy_transactions table...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'fantasy_transactions'
        ) 
        THEN '✅ fantasy_transactions table EXISTS'
        ELSE '❌ fantasy_transactions table MISSING'
    END as status;

-- Check if fantasy_players_on_waivers table exists
\echo ''
\echo '📋 2. Checking fantasy_players_on_waivers table...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'fantasy_players_on_waivers'
        ) 
        THEN '✅ fantasy_players_on_waivers table EXISTS'
        ELSE '❌ fantasy_players_on_waivers table MISSING'
    END as status;

-- Check if fantasy_waiver_claims table exists
\echo ''
\echo '📋 3. Checking fantasy_waiver_claims table...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'fantasy_waiver_claims'
        ) 
        THEN '✅ fantasy_waiver_claims table EXISTS'
        ELSE '❌ fantasy_waiver_claims table MISSING'
    END as status;

-- Check if fantasy_waiver_order table exists
\echo ''
\echo '📋 4. Checking fantasy_waiver_order table...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'fantasy_waiver_order'
        ) 
        THEN '✅ fantasy_waiver_order table EXISTS'
        ELSE '❌ fantasy_waiver_order table MISSING'
    END as status;

-- Check if drop_player function exists
\echo ''
\echo '📋 5. Checking drop_player function...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = 'drop_player'
            AND n.nspname = 'public'
        ) 
        THEN '✅ drop_player function EXISTS'
        ELSE '❌ drop_player function MISSING'
    END as status;

-- Check if waiver columns exist in fantasy_league_seasons
\echo ''
\echo '📋 6. Checking waiver columns in fantasy_league_seasons...'
SELECT 
    column_name,
    CASE 
        WHEN column_name IN ('waiver_type', 'waiver_period_hours', 'waiver_process_time', 'waiver_budget_amount', 'waiver_min_bid', 'waiver_priority_reset', 'waiver_claim_days')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'fantasy_league_seasons'
AND column_name IN ('waiver_type', 'waiver_period_hours', 'waiver_process_time', 'waiver_budget_amount', 'waiver_min_bid', 'waiver_priority_reset', 'waiver_claim_days')
ORDER BY column_name;

-- Show summary
\echo ''
\echo '📊 Summary:'
SELECT 
    COUNT(*) FILTER (WHERE table_name IN ('fantasy_transactions', 'fantasy_players_on_waivers', 'fantasy_waiver_claims', 'fantasy_waiver_order')) as tables_exist,
    4 as tables_needed
FROM information_schema.tables 
WHERE table_schema = 'public';

\echo ''
\echo '🎯 If any components are MISSING, run the deployment script or apply the migrations manually.'
\echo '📖 See DEPLOY_WAIVER_SYSTEM.md for detailed instructions.'

