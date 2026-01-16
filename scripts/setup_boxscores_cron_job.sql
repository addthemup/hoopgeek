-- ============================================================================
-- SETUP BOX SCORES CRON JOB (EST Time)
-- ============================================================================
-- This script creates a cron job to import box scores daily
-- Run this in Supabase SQL Editor
-- ============================================================================

-- First, remove any existing boxscores cron job if it exists
DO $$
DECLARE
    job_rec RECORD;
BEGIN
    -- Try to unschedule by finding jobs with import-boxscores in command
    FOR job_rec IN 
        SELECT jobid FROM cron.job 
        WHERE command::text LIKE '%import-boxscores%'
    LOOP
        BEGIN
            PERFORM cron.unschedule(job_rec.jobid);
            RAISE NOTICE 'Removed existing job: %', job_rec.jobid;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not remove job %: %', job_rec.jobid, SQLERRM;
        END;
    END LOOP;
END $$;

-- ============================================================================
-- BOX SCORES CRON JOB
-- ============================================================================
-- Schedule: 3:30 AM EST (8:30 AM UTC) - Early morning to import yesterday's games
-- Note: EST is UTC-5, so 3:30 AM EST = 8:30 AM UTC
-- This runs the import for games from the previous day
-- ============================================================================
SELECT cron.schedule(
    'import-daily-boxscores-cron',
    '30 8 * * *',  -- Daily at 3:30 AM EST (8:30 AM UTC)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/import-boxscores',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled')
    );
    $$
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that the job was created
SELECT 
  jobid,
  schedule,
  active,
  CASE 
    WHEN schedule = '30 8 * * *' THEN '3:30 AM EST (8:30 AM UTC)'
    ELSE schedule
  END as schedule_description
FROM cron.job 
WHERE command::text LIKE '%import-boxscores%'
ORDER BY schedule;

-- ============================================================================
-- MANUALLY TRIGGER THE JOB (for testing)
-- ============================================================================
-- To manually trigger the boxscores import right now:
-- SELECT cron.run_job(
--   (SELECT jobid FROM cron.job 
--    WHERE command::text LIKE '%import-boxscores%' 
--    LIMIT 1)
-- );

