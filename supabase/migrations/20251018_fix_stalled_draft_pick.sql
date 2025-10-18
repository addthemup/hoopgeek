-- =====================================================
-- FIX STALLED DRAFT PICK
-- =====================================================
-- Sets time_expires for the current pick that's stuck
-- with no expiration time
-- =====================================================

-- Update the stalled pick (ID: 2f620787-e14b-478f-b9a4-be25488014db)
-- Set it to expire 3 seconds from now so auto-pick can process it immediately
UPDATE fantasy_draft_order
SET 
    time_started = NOW(),
    time_expires = NOW() + INTERVAL '3 seconds'
WHERE id = '2f620787-e14b-478f-b9a4-be25488014db'
AND time_expires IS NULL;

-- Also fix ANY other picks in this league that might have null time_expires
-- This catches any other picks that got stuck
UPDATE fantasy_draft_order
SET 
    time_started = NOW(),
    time_expires = NOW() + INTERVAL '3 seconds'
WHERE league_id = (
    SELECT league_id FROM fantasy_draft_order WHERE id = '2f620787-e14b-478f-b9a4-be25488014db'
)
AND is_completed = FALSE
AND time_expires IS NULL;

-- Verification: Show the fixed pick
SELECT 
    id,
    pick_number,
    round,
    team_position,
    is_completed,
    time_started,
    time_expires,
    NOW() as current_time,
    EXTRACT(EPOCH FROM (time_expires - NOW())) as seconds_until_expires
FROM fantasy_draft_order
WHERE id = '2f620787-e14b-478f-b9a4-be25488014db';

