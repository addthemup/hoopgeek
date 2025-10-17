-- =====================================================
-- FIX MISSING DRAFT STATES
-- =====================================================
-- This script fixes leagues that are in_progress in fantasy_league_seasons
-- but missing from fantasy_draft_current_state
-- =====================================================

DO $$
DECLARE
    league_record RECORD;
    first_pick RECORD;
    total_picks INTEGER;
    season_record RECORD;
BEGIN
    -- Find all leagues that are in_progress but missing draft state
    FOR league_record IN
        SELECT 
            fls.league_id,
            fls.id as season_id,
            fl.name as league_name
        FROM fantasy_league_seasons fls
        JOIN fantasy_leagues fl ON fls.league_id = fl.id
        WHERE fls.draft_status = 'in_progress'
        AND fls.league_id NOT IN (
            SELECT league_id FROM fantasy_draft_current_state
        )
    LOOP
        RAISE NOTICE '🔧 Fixing draft state for league: % (%)', league_record.league_name, league_record.league_id;
        
        -- Get first pick from draft order
        SELECT * INTO first_pick
        FROM fantasy_draft_order
        WHERE league_id = league_record.league_id
        AND pick_number = 1
        LIMIT 1;
        
        IF NOT FOUND THEN
            RAISE NOTICE '❌ No draft order found for league: %', league_record.league_name;
            CONTINUE;
        END IF;
        
        -- Count total picks
        SELECT COUNT(*) INTO total_picks
        FROM fantasy_draft_order
        WHERE league_id = league_record.league_id;
        
        -- Create draft_current_state
        INSERT INTO fantasy_draft_current_state (
            league_id,
            season_id,
            current_pick_id,
            current_pick_number,
            current_round,
            draft_status,
            is_auto_pick_active,
            draft_started_at,
            total_picks,
            completed_picks,
            last_activity_at
        ) VALUES (
            league_record.league_id,
            league_record.season_id,
            first_pick.id,
            1,
            1,
            'in_progress',
            true,
            NOW(),
            total_picks,
            0,
            NOW()
        );
        
        -- Set timer on first pick if it doesn't have one
        UPDATE fantasy_draft_order
        SET 
            time_started = COALESCE(time_started, NOW()),
            time_expires = COALESCE(time_expires, NOW() + INTERVAL '60 seconds')
        WHERE id = first_pick.id
        AND (time_started IS NULL OR time_expires IS NULL);
        
        RAISE NOTICE '✅ Draft state created for %: Pick #1, Total picks: %', league_record.league_name, total_picks;
    END LOOP;
    
    RAISE NOTICE '✅ All missing draft states have been fixed';
END $$;

-- Verify the fixes
SELECT 'fantasy_league_seasons' as table_name, league_id, draft_status, draft_date 
FROM fantasy_league_seasons 
WHERE draft_status = 'in_progress'
ORDER BY league_id;

SELECT 'fantasy_draft_current_state' as table_name, league_id, current_pick_number, draft_status, draft_started_at
FROM fantasy_draft_current_state 
WHERE draft_status = 'in_progress'
ORDER BY league_id;
