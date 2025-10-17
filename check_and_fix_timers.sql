-- =====================================================
-- CHECK AND FIX FIRST PICK TIMERS
-- =====================================================
-- This script checks if first picks have timers and sets them if missing
-- =====================================================

-- Check current state of first picks
SELECT 'Current first picks status:' as info;
SELECT 
    fdo.league_id,
    fdo.pick_number,
    fdo.time_started,
    fdo.time_expires,
    fdo.is_completed,
    fl.name as league_name
FROM fantasy_draft_order fdo
JOIN fantasy_leagues fl ON fdo.league_id = fl.id
WHERE fdo.pick_number = 1
AND fdo.league_id IN (
    SELECT league_id FROM fantasy_draft_current_state WHERE draft_status = 'in_progress'
)
ORDER BY fdo.league_id;

-- Fix missing timers for first picks
DO $$
DECLARE
    first_pick RECORD;
BEGIN
    -- Find first picks that don't have timers set
    FOR first_pick IN
        SELECT 
            fdo.id,
            fdo.league_id,
            fl.name as league_name
        FROM fantasy_draft_order fdo
        JOIN fantasy_leagues fl ON fdo.league_id = fl.id
        WHERE fdo.pick_number = 1
        AND fdo.league_id IN (
            SELECT league_id FROM fantasy_draft_current_state WHERE draft_status = 'in_progress'
        )
        AND (fdo.time_started IS NULL OR fdo.time_expires IS NULL)
    LOOP
        RAISE NOTICE '🔧 Setting timer for first pick in league: % (%)', first_pick.league_name, first_pick.league_id;
        
        -- Set timer on first pick (60 seconds from now)
        UPDATE fantasy_draft_order
        SET 
            time_started = NOW(),
            time_expires = NOW() + INTERVAL '60 seconds'
        WHERE id = first_pick.id;
        
        RAISE NOTICE '✅ Timer set for %: expires at %', first_pick.league_name, NOW() + INTERVAL '60 seconds';
    END LOOP;
    
    RAISE NOTICE '✅ All first pick timers have been set';
END $$;

-- Verify the fixes
SELECT 'After fix - first picks with timers:' as info;
SELECT 
    fdo.league_id,
    fdo.pick_number,
    fdo.time_started,
    fdo.time_expires,
    fdo.is_completed,
    fl.name as league_name,
    EXTRACT(EPOCH FROM (fdo.time_expires - NOW())) as seconds_remaining
FROM fantasy_draft_order fdo
JOIN fantasy_leagues fl ON fdo.league_id = fl.id
WHERE fdo.pick_number = 1
AND fdo.league_id IN (
    SELECT league_id FROM fantasy_draft_current_state WHERE draft_status = 'in_progress'
)
ORDER BY fdo.league_id;
