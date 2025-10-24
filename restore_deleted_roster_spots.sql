-- =====================================================
-- RESTORE DELETED ROSTER SPOTS
-- =====================================================
-- This script restores roster spots that were accidentally
-- deleted by the drop_player function bug
-- =====================================================

-- First, let's see how many roster spots each team SHOULD have
-- based on their league's roster configuration

DO $$
DECLARE
    team_record RECORD;
    expected_spots INTEGER;
    actual_spots INTEGER;
    missing_spots INTEGER;
    position_key TEXT;
    position_count INTEGER;
    i INTEGER;
BEGIN
    RAISE NOTICE '🔍 Checking for missing roster spots...';
    RAISE NOTICE '';
    
    -- Loop through all active teams
    FOR team_record IN 
        SELECT 
            ft.id as team_id,
            ft.team_name,
            ft.league_id,
            ft.season_id,
            fls.roster_positions
        FROM fantasy_teams ft
        JOIN fantasy_league_seasons fls ON ft.season_id = fls.id
        WHERE ft.is_active = true
    LOOP
        -- Count actual roster spots
        SELECT COUNT(*) INTO actual_spots
        FROM fantasy_roster_spots
        WHERE fantasy_team_id = team_record.team_id;
        
        -- Calculate expected spots from roster_positions
        expected_spots := 0;
        IF team_record.roster_positions IS NOT NULL THEN
            FOR position_key, position_count IN 
                SELECT key, value::INTEGER 
                FROM jsonb_each_text(team_record.roster_positions)
            LOOP
                expected_spots := expected_spots + position_count;
            END LOOP;
        END IF;
        
        missing_spots := expected_spots - actual_spots;
        
        IF missing_spots > 0 THEN
            RAISE NOTICE '⚠️  Team: % (ID: %)', team_record.team_name, team_record.team_id;
            RAISE NOTICE '   Expected spots: %, Actual spots: %, Missing: %', 
                expected_spots, actual_spots, missing_spots;
            
            -- Try to recreate missing spots
            -- Note: We need to know which positions are missing
            -- For now, we'll just flag them for manual review
            RAISE NOTICE '   ⚠️  Manual intervention needed - check which positions are missing';
            RAISE NOTICE '';
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Roster spot check complete';
END $$;

-- =====================================================
-- MANUAL RESTORATION TEMPLATE
-- =====================================================
-- If spots are missing, use this template to restore them:
-- 
-- INSERT INTO fantasy_roster_spots (
--     fantasy_team_id,
--     position,
--     player_id,
--     created_at,
--     updated_at
-- ) VALUES (
--     'TEAM_ID_HERE',
--     'POSITION_HERE',  -- e.g., 'PG', 'SG', 'SF', 'PF', 'C', 'BENCH'
--     NULL,              -- No player assigned
--     NOW(),
--     NOW()
-- );

-- =====================================================
-- ALTERNATIVE: Check transaction history to see what was dropped
-- =====================================================

SELECT 
    ft.team_name,
    np.name as player_name,
    np.position,
    trans.transaction_date,
    trans.notes
FROM fantasy_transactions trans
JOIN fantasy_teams ft ON trans.fantasy_team_id = ft.id
JOIN nba_players np ON trans.player_id = np.id
WHERE trans.transaction_type = 'cut'
AND trans.transaction_date > NOW() - INTERVAL '1 hour'  -- Adjust timeframe as needed
ORDER BY trans.transaction_date DESC;

-- =====================================================
-- Check current roster spot counts by team
-- =====================================================

SELECT 
    ft.team_name,
    ft.id as team_id,
    COUNT(frs.id) as total_spots,
    COUNT(frs.player_id) as filled_spots,
    COUNT(*) FILTER (WHERE frs.player_id IS NULL) as empty_spots
FROM fantasy_teams ft
LEFT JOIN fantasy_roster_spots frs ON ft.id = frs.fantasy_team_id
WHERE ft.is_active = true
GROUP BY ft.id, ft.team_name
ORDER BY ft.team_name;

