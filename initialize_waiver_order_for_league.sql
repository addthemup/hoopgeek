-- =====================================================
-- Initialize Waiver Order for League
-- =====================================================
-- This script checks if waiver order exists for your league
-- and initializes it if needed.
-- 
-- Your league settings show:
-- - waiver_type: 'faab'
-- - waiver_budget_amount: 100
-- - waiver_period_hours: 24
-- =====================================================

-- First, check if waiver order already exists
DO $$
DECLARE
    v_league_id UUID := 'de1e54c7-4b7e-4fa2-be1f-339c53c5500a';
    v_season_id UUID := 'ede8d74c-d93c-4e09-903b-b0db098af92d';
    v_existing_count INTEGER;
    v_result JSONB;
BEGIN
    -- Check if waiver order already exists
    SELECT COUNT(*) INTO v_existing_count
    FROM fantasy_waiver_order
    WHERE league_id = v_league_id AND season_id = v_season_id;
    
    RAISE NOTICE '📊 Existing waiver order records: %', v_existing_count;
    
    IF v_existing_count = 0 THEN
        RAISE NOTICE '🚀 Initializing waiver order...';
        
        -- Call the initialize function
        SELECT initialize_waiver_order(v_league_id, v_season_id) INTO v_result;
        
        RAISE NOTICE '✅ Result: %', v_result;
    ELSE
        RAISE NOTICE '✅ Waiver order already initialized';
    END IF;
END $$;

-- Display current waiver order
SELECT 
    ROW_NUMBER() OVER (ORDER BY wo.waiver_priority) as "Priority #",
    ft.team_name as "Team Name",
    wo.waiver_priority as "Waiver Priority",
    wo.remaining_budget as "FAAB Budget Remaining",
    wo.total_spent as "Total Spent",
    wo.total_claims as "Claims Made",
    wo.last_claim_date as "Last Claim Date"
FROM fantasy_waiver_order wo
JOIN fantasy_teams ft ON ft.id = wo.fantasy_team_id
WHERE wo.league_id = 'de1e54c7-4b7e-4fa2-be1f-339c53c5500a'
ORDER BY wo.waiver_priority ASC;

