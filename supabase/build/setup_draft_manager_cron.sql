-- =====================================================
-- DRAFT MANAGER CRON JOB (SIMPLIFIED)
-- =====================================================
-- This processes draft picks directly in PostgreSQL
-- No Edge Function needed - everything runs in the database!
-- =====================================================

-- ===== STEP 1: Create function to process expired picks =====
CREATE OR REPLACE FUNCTION process_expired_draft_picks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  draft_record RECORD;
  pick_record RECORD;
  best_player RECORD;
  team_record RECORD;
BEGIN
  -- Find all active drafts with expired picks
  FOR draft_record IN 
    SELECT 
      fdcs.league_id,
      fdcs.current_pick_id,
      fdcs.current_pick_number,
      fdo.time_expires,
      fdo.fantasy_team_id,
      ft.autodraft_enabled,
      ft.team_name
    FROM fantasy_draft_current_state fdcs
    INNER JOIN fantasy_draft_order fdo ON fdcs.current_pick_id = fdo.id
    INNER JOIN fantasy_teams ft ON fdo.fantasy_team_id = ft.id
    WHERE fdcs.draft_status = 'in_progress'
      AND fdo.is_completed = FALSE
      AND fdo.time_expires IS NOT NULL
      AND fdo.time_expires < NOW()
  LOOP
    RAISE NOTICE '⏰ Pick #% expired for % - processing...', 
      draft_record.current_pick_number, 
      draft_record.team_name;
    
    -- Enable autodraft for this team (they missed their pick)
    IF NOT draft_record.autodraft_enabled THEN
      UPDATE fantasy_teams
      SET autodraft_enabled = TRUE
      WHERE id = draft_record.fantasy_team_id;
      
      RAISE NOTICE '⚡ Enabled autodraft for %', draft_record.team_name;
    END IF;
    
    -- Get best available player using the existing RPC function
    SELECT * INTO best_player
    FROM get_best_available_player_progressive(
      draft_record.league_id,
      draft_record.fantasy_team_id,
      draft_record.current_pick_number
    )
    LIMIT 1;
    
    IF best_player.player_id IS NOT NULL THEN
      RAISE NOTICE '🌟 Auto-picking % for %', best_player.player_name, draft_record.team_name;
      
      -- Make the pick using the existing make_draft_pick function
      PERFORM make_draft_pick(
        draft_record.current_pick_id,
        best_player.player_id::uuid,
        'auto_pick'
      );
      
      RAISE NOTICE '✅ Auto-picked % for %', best_player.player_name, draft_record.team_name;
    ELSE
      RAISE WARNING '❌ No available player found for %', draft_record.team_name;
    END IF;
    
  END LOOP;
  
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_expired_draft_picks() TO authenticated;
GRANT EXECUTE ON FUNCTION process_expired_draft_picks() TO service_role;

-- ===== STEP 2: Remove any existing draft-manager cron jobs =====
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) 
  FROM cron.job 
  WHERE jobname IN ('draft-manager-continuous', 'process-draft-picks');
  
  RAISE NOTICE '🧹 Cleaned up old draft cron jobs';
END $$;

-- ===== STEP 3: Create cron job to run every minute =====
SELECT cron.schedule(
  'process-draft-picks',
  '* * * * *', -- Every minute
  'SELECT process_expired_draft_picks();'
);

-- ===== STEP 4: Confirmation =====
DO $$
BEGIN
    RAISE NOTICE '✅ Draft Manager cron job configured successfully!';
    RAISE NOTICE '✅ Function: process_expired_draft_picks()';
    RAISE NOTICE '✅ Cron job: process-draft-picks (runs every minute)';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Test manually: SELECT process_expired_draft_picks();';
    RAISE NOTICE '📊 View cron jobs: SELECT * FROM cron.job WHERE jobname = ''process-draft-picks'';';
    RAISE NOTICE '📊 View cron history: SELECT * FROM cron.job_run_details WHERE jobname = ''process-draft-picks'' ORDER BY start_time DESC LIMIT 10;';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 How it works:';
    RAISE NOTICE '   1. Cron runs every minute';
    RAISE NOTICE '   2. Checks for expired picks (time_expires < NOW())';
    RAISE NOTICE '   3. Enables autodraft for teams that missed picks';
    RAISE NOTICE '   4. Calls get_best_available_player_progressive()';
    RAISE NOTICE '   5. Calls make_draft_pick() to complete the pick';
    RAISE NOTICE '   6. Works even when browser is closed ✅';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ No Edge Functions needed - everything runs in PostgreSQL!';
END $$;

