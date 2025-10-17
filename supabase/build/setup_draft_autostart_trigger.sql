-- =====================================================
-- DRAFT AUTO-START DATABASE TRIGGER
-- =====================================================
-- This creates a database function and trigger that automatically
-- starts drafts at their exact draft_date timestamp
-- =====================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS auto_start_draft_trigger ON fantasy_league_seasons;
DROP FUNCTION IF EXISTS check_and_start_scheduled_drafts();

-- Function to check and start scheduled drafts
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

-- =====================================================
-- SET UP PG_CRON JOB (if pg_cron is available)
-- =====================================================
DO $$
BEGIN
  -- Check if pg_cron is installed
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing cron job if it exists
    PERFORM cron.unschedule(jobid) 
    FROM cron.job 
    WHERE jobname = 'check-draft-start-times';
    
    -- Schedule the function to run every minute
    PERFORM cron.schedule(
      'check-draft-start-times',
      '* * * * *', -- Every minute
      'SELECT check_and_start_scheduled_drafts();'
    );
    
    RAISE NOTICE '✅ pg_cron job created: Runs every minute to check draft start times';
  ELSE
    RAISE NOTICE '⚠️  pg_cron extension not found. Draft auto-start will rely on edge function calls.';
  END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ Draft auto-start system configured';
    RAISE NOTICE '✅ Function: check_and_start_scheduled_drafts()';
    RAISE NOTICE '✅ Checks every minute for drafts that should start';
    RAISE NOTICE '✅ Starts drafts at their exact draft_date timestamp';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Test manually with: SELECT check_and_start_scheduled_drafts();';
    RAISE NOTICE '📊 View cron jobs with: SELECT * FROM cron.job WHERE jobname = ''check-draft-start-times'';';
END $$;

