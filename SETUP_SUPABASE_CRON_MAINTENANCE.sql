-- Supabase pg_cron Setup for Database Maintenance
-- These run inside Supabase and handle cleanup/maintenance tasks

-- ============================================================================
-- 1. Enable pg_cron extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. Clean up old live stats (keeps last 7 days)
-- ============================================================================

-- Runs daily at 6 AM
SELECT cron.schedule(
  'cleanup-old-live-stats',
  '0 6 * * *',  -- Every day at 6:00 AM
  'SELECT cleanup_old_live_stats();'
);

-- ============================================================================
-- 3. Archive completed DFS pools (moves to history)
-- ============================================================================

-- Runs daily at 7 AM
SELECT cron.schedule(
  'archive-completed-dfs-pools',
  '0 7 * * *',  -- Every day at 7:00 AM
  $$
  -- Archive DFS pools that are more than 7 days old
  UPDATE dfs_pools
  SET status = 'archived'
  WHERE game_date < CURRENT_DATE - INTERVAL '7 days'
    AND status = 'completed';
  $$
);

-- ============================================================================
-- 4. Update fantasy league weekly standings (runs Sunday night)
-- ============================================================================

-- Runs every Sunday at 11:59 PM to finalize weekly standings
SELECT cron.schedule(
  'finalize-weekly-fantasy-standings',
  '59 23 * * 0',  -- Sunday at 11:59 PM
  $$
  -- Mark the week as complete and calculate final standings
  UPDATE fantasy_rosters
  SET 
    weekly_score = 0,
    weekly_average = 0,
    player_weekly_scores = '[]'::jsonb
  WHERE league_id IN (
    SELECT id FROM leagues WHERE league_type = 'fantasy'
  );
  $$
);

-- ============================================================================
-- 5. View all scheduled cron jobs
-- ============================================================================

-- Run this to see what's scheduled:
SELECT * FROM cron.job;

-- ============================================================================
-- 6. To unschedule a job (if needed):
-- ============================================================================

-- SELECT cron.unschedule('job-name-here');

-- ============================================================================
-- SUCCESS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Supabase cron maintenance jobs configured!';
    RAISE NOTICE '';
    RAISE NOTICE 'Scheduled jobs:';
    RAISE NOTICE '  - cleanup-old-live-stats: Daily at 6:00 AM';
    RAISE NOTICE '  - archive-completed-dfs-pools: Daily at 7:00 AM';
    RAISE NOTICE '  - finalize-weekly-fantasy-standings: Sunday at 11:59 PM';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Live stats updates should run from your server using Python cron';
END $$;

