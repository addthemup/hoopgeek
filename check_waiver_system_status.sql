-- =====================================================
-- Check Waiver System Status
-- =====================================================
-- This checks if all waiver system components are deployed

-- 1. Check if fantasy_waiver_order table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'fantasy_waiver_order'
        ) THEN '✅ fantasy_waiver_order table EXISTS'
        ELSE '❌ fantasy_waiver_order table MISSING'
    END as table_status;

-- 2. Check if fantasy_waiver_claims table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'fantasy_waiver_claims'
        ) THEN '✅ fantasy_waiver_claims table EXISTS'
        ELSE '❌ fantasy_waiver_claims table MISSING'
    END as table_status;

-- 3. Check if fantasy_players_on_waivers table exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'fantasy_players_on_waivers'
        ) THEN '✅ fantasy_players_on_waivers table EXISTS'
        ELSE '❌ fantasy_players_on_waivers table MISSING'
    END as table_status;

-- 4. Check if initialize_waiver_order function exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'initialize_waiver_order'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ initialize_waiver_order() function EXISTS'
        ELSE '❌ initialize_waiver_order() function MISSING'
    END as function_status;

-- 5. Check if drop_player function exists (should handle waivers)
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'drop_player'
            AND routine_type = 'FUNCTION'
        ) THEN '✅ drop_player() function EXISTS'
        ELSE '❌ drop_player() function MISSING'
    END as function_status;

-- 6. Check if waiver columns exist in fantasy_league_seasons
SELECT 
    column_name,
    data_type,
    CASE 
        WHEN column_name IN ('waiver_type', 'waiver_period_hours', 'waiver_budget_amount', 'waiver_min_bid') 
        THEN '✅ REQUIRED'
        ELSE '✓ Optional'
    END as importance
FROM information_schema.columns
WHERE table_name = 'fantasy_league_seasons'
AND column_name LIKE '%waiver%'
ORDER BY column_name;
