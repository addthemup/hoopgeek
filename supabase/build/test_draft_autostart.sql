-- =====================================================
-- TEST DRAFT AUTO-START SYSTEM
-- =====================================================
-- This script helps you test the draft auto-start system
-- =====================================================

-- ===== TEST 1: Verify the function exists =====
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc 
WHERE proname = 'check_and_start_scheduled_drafts';

-- Expected: Should return 1 row with the function

-- ===== TEST 2: Verify the cron job exists =====
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  jobname,
  active
FROM cron.job 
WHERE jobname = 'check-draft-start-times';

-- Expected: Should return 1 row with schedule '* * * * *'

-- ===== TEST 3: Check draft status before test =====
SELECT 
  fl.name as league_name,
  fls.league_id,
  fls.draft_status,
  fls.draft_date,
  NOW() as current_time,
  fls.draft_date - NOW() as time_until_draft
FROM fantasy_league_seasons fls
INNER JOIN fantasy_leagues fl ON fl.id = fls.league_id
WHERE fls.draft_status IN ('scheduled', 'in_progress')
ORDER BY fls.draft_date;

-- ===== TEST 4: Set up a test draft (2 minutes from now) =====
-- IMPORTANT: Replace 'your-league-id' with an actual league ID from your database

-- First, get a league ID to test with:
SELECT id, name FROM fantasy_leagues LIMIT 5;

-- Then run this (replace the UUID):
/*
UPDATE fantasy_league_seasons
SET 
  draft_status = 'scheduled',
  draft_date = NOW() + INTERVAL '2 minutes'
WHERE league_id = 'your-league-id-here';
*/

-- ===== TEST 5: Manually trigger the function =====
-- This simulates what the cron job does
SELECT check_and_start_scheduled_drafts();

-- Expected: Should start any drafts where draft_date <= NOW()

-- ===== TEST 6: Check if draft started =====
SELECT 
  fl.name as league_name,
  fls.league_id,
  fls.draft_status,
  fls.draft_date,
  NOW() as current_time,
  fdcs.current_pick_number,
  fdcs.current_pick_id
FROM fantasy_league_seasons fls
INNER JOIN fantasy_leagues fl ON fl.id = fls.league_id
LEFT JOIN fantasy_draft_current_state fdcs ON fdcs.league_id = fls.league_id
WHERE fls.draft_status = 'in_progress'
ORDER BY fls.draft_date;

-- Expected: If draft started, should show current_pick_number = 1

-- ===== TEST 7: Check cron job execution history =====
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-draft-start-times')
ORDER BY start_time DESC 
LIMIT 10;

-- Expected: Should show recent executions every minute

-- ===== TEST 8: Check first pick has timer =====
SELECT 
  fdo.league_id,
  fdo.pick_number,
  fdo.round,
  fdo.fantasy_team_id,
  fdo.is_completed,
  fdo.time_started,
  fdo.time_expires,
  NOW() as current_time,
  fdo.time_expires - NOW() as time_remaining
FROM fantasy_draft_order fdo
INNER JOIN fantasy_draft_current_state fdcs ON fdcs.current_pick_id = fdo.id
WHERE fdo.is_completed = false
ORDER BY fdo.pick_number
LIMIT 1;

-- Expected: Should show time_expires set to ~60 seconds from time_started

-- ===== TROUBLESHOOTING =====

-- If cron job isn't running:
-- 1. Check if pg_cron extension is enabled:
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Check cron job status:
SELECT * FROM cron.job WHERE jobname = 'check-draft-start-times';

-- 3. Check for errors in cron execution:
SELECT * FROM cron.job_run_details 
WHERE status = 'failed' 
ORDER BY start_time DESC 
LIMIT 10;

-- ===== CLEANUP (if needed) =====
-- Reset a draft back to scheduled for re-testing:
/*
UPDATE fantasy_league_seasons
SET 
  draft_status = 'scheduled',
  draft_date = NOW() + INTERVAL '2 minutes'
WHERE league_id = 'your-league-id-here';

-- Also delete draft state if it exists:
DELETE FROM fantasy_draft_current_state WHERE league_id = 'your-league-id-here';

-- And reset draft order:
UPDATE fantasy_draft_order 
SET 
  is_completed = false,
  player_id = NULL,
  player_name = NULL,
  pick_made_at = NULL,
  time_started = NULL,
  time_expires = NULL,
  auto_pick_reason = NULL
WHERE league_id = 'your-league-id-here';
*/

DO $$
BEGIN
    RAISE NOTICE '📊 Test script ready!';
    RAISE NOTICE '✅ Follow the tests above in order';
    RAISE NOTICE '✅ Make sure to replace ''your-league-id'' with a real ID';
    RAISE NOTICE '✅ After setting draft_date to NOW() + 2 minutes, wait and watch it auto-start';
END $$;

