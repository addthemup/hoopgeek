-- =====================================================
-- DRAFT AUTO-START CRON SETUP
-- =====================================================
-- This sets up a cron job that checks EVERY MINUTE for drafts
-- that should start at their exact draft_date timestamp
-- =====================================================

-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ===== STEP 1: Create the auto-start function =====
CREATE OR REPLACE FUNCTION check_and_start_scheduled_drafts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  draft_record RECORD;
  current_state RECORD;
BEGIN
  -- Find all drafts that should start NOW
  FOR draft_record IN 
    SELECT 
      fls.league_id,
      fls.draft_date,
      fls.season_year,
      fl.name as league_name
    FROM fantasy_league_seasons fls
    INNER JOIN fantasy_leagues fl ON fl.id = fls.league_id
    WHERE fls.draft_status = 'scheduled'
      -- Draft date has passed
      AND fls.draft_date <= NOW()
      -- But not more than 5 minutes ago (to avoid re-starting old drafts)
      AND fls.draft_date >= NOW() - INTERVAL '5 minutes'
  LOOP
    RAISE NOTICE '🚀 Auto-starting draft for league %: % (scheduled: %)', 
      draft_record.league_id, 
      draft_record.league_name,
      draft_record.draft_date;
    
    -- Update draft status to in_progress
    UPDATE fantasy_league_seasons
    SET draft_status = 'in_progress'
    WHERE league_id = draft_record.league_id
      AND season_year = draft_record.season_year
      AND draft_status = 'scheduled'; -- Only if still scheduled
    
    -- Check if draft_current_state exists for this league
    SELECT * INTO current_state
    FROM fantasy_draft_current_state
    WHERE league_id = draft_record.league_id;
    
    -- If no current state exists, initialize it
    IF NOT FOUND THEN
      RAISE NOTICE '📝 Initializing draft state for league %', draft_record.league_id;
      
      -- Call initialize_draft_state function
      BEGIN
        PERFORM initialize_draft_state(draft_record.league_id);
        RAISE NOTICE '✅ Draft state initialized for league %', draft_record.league_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '❌ Failed to initialize draft state for league %: %', 
          draft_record.league_id, SQLERRM;
      END;
    ELSE
      -- State exists, just make sure first pick has a timer
      UPDATE fantasy_draft_order
      SET 
        time_started = NOW(),
        time_expires = NOW() + INTERVAL '60 seconds'
      WHERE league_id = draft_record.league_id
        AND id = current_state.current_pick_id
        AND time_expires IS NULL;
        
      RAISE NOTICE '✅ Draft state already exists, ensured timer is set for league %', 
        draft_record.league_id;
    END IF;
    
    RAISE NOTICE '✅ Draft started successfully for league %', draft_record.league_id;
  END LOOP;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_and_start_scheduled_drafts() TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_start_scheduled_drafts() TO service_role;

-- ===== STEP 2: Remove any existing draft-related cron jobs =====
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) 
  FROM cron.job 
  WHERE jobname LIKE '%draft%';
END $$;

-- ===== STEP 3: Create cron job to run every minute =====
SELECT cron.schedule(
  'check-draft-start-times',
  '* * * * *', -- Every minute
  'SELECT check_and_start_scheduled_drafts();'
);

-- ===== STEP 4: Confirmation =====
DO $$
BEGIN
    RAISE NOTICE '✅ Draft auto-start system configured successfully!';
    RAISE NOTICE '✅ Function: check_and_start_scheduled_drafts()';
    RAISE NOTICE '✅ Cron job: check-draft-start-times (runs every minute)';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Test manually: SELECT check_and_start_scheduled_drafts();';
    RAISE NOTICE '📊 View cron jobs: SELECT * FROM cron.job;';
    RAISE NOTICE '📊 View cron history: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 How it works:';
    RAISE NOTICE '   1. Cron runs every minute';
    RAISE NOTICE '   2. Checks if draft_date <= NOW()';
    RAISE NOTICE '   3. Updates draft_status to ''in_progress''';
    RAISE NOTICE '   4. Initializes draft_current_state';
    RAISE NOTICE '   5. Sets timer for first pick';
    RAISE NOTICE '   6. Frontend detects change via Supabase Realtime';
END $$;

