-- Fix draft state for league 37e1e0b2-a7c0-4581-8841-43124816915b

-- First, let's see what's in the database
SELECT 'fantasy_league_seasons' as table_name, league_id, draft_status, draft_date 
FROM fantasy_league_seasons 
WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b';

SELECT 'fantasy_draft_current_state' as table_name, * 
FROM fantasy_draft_current_state 
WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b';

SELECT 'fantasy_draft_order' as table_name, id, pick_number, round, is_completed, time_expires
FROM fantasy_draft_order 
WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b' 
AND pick_number <= 3;

-- Now let's fix the draft state
-- Step 1: Update fantasy_league_seasons to in_progress
UPDATE fantasy_league_seasons 
SET 
    draft_status = 'in_progress',
    draft_date = NOW()
WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b'
ORDER BY created_at DESC
LIMIT 1;

-- Step 2: Get the first pick
DO $$
DECLARE
    first_pick RECORD;
    total_picks INTEGER;
BEGIN
    -- Get first pick
    SELECT * INTO first_pick
    FROM fantasy_draft_order
    WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b'
    AND pick_number = 1
    LIMIT 1;
    
    -- Count total picks
    SELECT COUNT(*) INTO total_picks
    FROM fantasy_draft_order
    WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b';
    
    -- Create or update draft_current_state
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
        '37e1e0b2-a7c0-4581-8841-43124816915b',
        first_pick.season_id,
        first_pick.id,
        1,
        1,
        'in_progress',
        true,
        NOW(),
        total_picks,
        0,
        NOW()
    ) ON CONFLICT (league_id) DO UPDATE SET
        current_pick_id = first_pick.id,
        current_pick_number = 1,
        current_round = 1,
        draft_status = 'in_progress',
        is_auto_pick_active = true,
        draft_started_at = COALESCE(fantasy_draft_current_state.draft_started_at, NOW()),
        total_picks = total_picks,
        completed_picks = 0,
        last_activity_at = NOW(),
        updated_at = NOW();
    
    -- Set timer on first pick
    UPDATE fantasy_draft_order
    SET 
        time_started = NOW(),
        time_expires = NOW() + INTERVAL '60 seconds'
    WHERE id = first_pick.id;
    
    RAISE NOTICE '✅ Draft state initialized for league 37e1e0b2-a7c0-4581-8841-43124816915b';
    RAISE NOTICE '✅ First pick ID: %, Total picks: %', first_pick.id, total_picks;
END $$;

-- Verify the fix
SELECT 'After fix - fantasy_league_seasons' as table_name, league_id, draft_status, draft_date 
FROM fantasy_league_seasons 
WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b';

SELECT 'After fix - fantasy_draft_current_state' as table_name, * 
FROM fantasy_draft_current_state 
WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b';

SELECT 'After fix - first pick timer' as table_name, id, pick_number, time_started, time_expires
FROM fantasy_draft_order 
WHERE league_id = '37e1e0b2-a7c0-4581-8841-43124816915b' 
AND pick_number = 1;
