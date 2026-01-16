-- ============================================================================
-- SETUP PLAYER PROPS CRON JOBS
-- ============================================================================
-- This script creates 4 cron jobs to import player props throughout the day
-- Run this in Supabase SQL Editor
-- ============================================================================

-- First, remove any existing player props jobs if they exist
DO $$
DECLARE
    job_rec RECORD;
BEGIN
    -- Try to unschedule by finding jobs with import-player-props in command
    FOR job_rec IN 
        SELECT jobid FROM cron.job 
        WHERE command::text LIKE '%import-player-props%'
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
-- JOB 1: 12:00 AM EST (Midnight) - Early morning update
-- ============================================================================
SELECT cron.schedule(
    'import-player-props-12am',
    '0 5 * * *',  -- Daily at 12:00 AM EST (05:00 UTC)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/import-player-props',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled', 'time', '12am')
    );
    $$
);

-- ============================================================================
-- JOB 2: 11:00 AM EST - Pre-game update
-- ============================================================================
SELECT cron.schedule(
    'import-player-props-11am',
    '0 16 * * *',  -- Daily at 11:00 AM EST (16:00 UTC / 4:00 PM UTC)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/import-player-props',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled', 'time', '11am')
    );
    $$
);

-- ============================================================================
-- JOB 3: 2:30 PM EST - Afternoon update
-- ============================================================================
SELECT cron.schedule(
    'import-player-props-230pm',
    '30 19 * * *',  -- Daily at 2:30 PM EST (19:30 UTC / 7:30 PM UTC)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/import-player-props',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled', 'time', '2:30pm')
    );
    $$
);

-- ============================================================================
-- JOB 4: 5:00 PM EST - Final update (data considered final after this)
-- ============================================================================
SELECT cron.schedule(
    'import-player-props-5pm',
    '0 22 * * *',  -- Daily at 5:00 PM EST (22:00 UTC / 10:00 PM UTC)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/import-player-props',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled', 'time', '5pm')
    );
    $$
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Check that all 4 jobs were created
SELECT 
  jobid,
  schedule,
  active,
  CASE 
    WHEN schedule = '0 5 * * *' THEN '12:00 AM EST (Midnight)'
    WHEN schedule = '0 16 * * *' THEN '11:00 AM EST'
    WHEN schedule = '30 19 * * *' THEN '2:30 PM EST'
    WHEN schedule = '0 22 * * *' THEN '5:00 PM EST'
    ELSE schedule
  END as schedule_description
FROM cron.job 
WHERE command::text LIKE '%import-player-props%'
ORDER BY schedule;

-- ============================================================================
-- MANUALLY TRIGGER A JOB (for testing)
-- ============================================================================
-- To manually trigger the 11am job right now:
-- SELECT cron.run_job(
--   (SELECT jobid FROM cron.job 
--    WHERE command::text LIKE '%import-player-props%' 
--      AND command::text LIKE '%11am%' 
--    LIMIT 1)
-- );

