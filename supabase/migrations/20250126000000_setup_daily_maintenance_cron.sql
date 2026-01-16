-- =====================================================
-- CRON JOB: DAILY NBA DATA MAINTENANCE (Daily at 3 AM UTC)
-- =====================================================
-- This cron job calls the daily-maintenance Edge Function
-- to run all daily maintenance tasks overnight:
-- 1. Import Daily Boxscores
-- 2. Import Player Props
-- 3. Import NBA Standings
-- 4. Import NBA Leaders
-- 5. Import NBA Team Rosters
-- =====================================================

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-maintenance-cron') THEN
        PERFORM cron.unschedule('daily-maintenance-cron');
        RAISE NOTICE 'Removed existing daily-maintenance-cron job';
    ELSE
        RAISE NOTICE 'No existing daily-maintenance-cron job to remove';
    END IF;
END $$;

-- Schedule the daily-maintenance to run daily at 1:45 AM EST
-- (1:45 AM EST = 6:45 AM UTC)
SELECT cron.schedule(
    'daily-maintenance-cron',                    -- Job name
    '45 6 * * *',                               -- Daily at 6:45 AM UTC (1:45 AM EST)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/daily-maintenance',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled')
    );
    $$
);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- List the scheduled cron job
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobname
FROM cron.job
WHERE jobname = 'daily-maintenance-cron';

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- Cron Schedule: '45 6 * * *' = Daily at 6:45 AM UTC (1:45 AM EST)
-- This runs overnight to process all daily maintenance tasks
-- 
-- To manually trigger: SELECT cron.run_job('daily-maintenance-cron');
-- To stop: SELECT cron.unschedule('daily-maintenance-cron');
-- To list all jobs: SELECT * FROM cron.job;
-- 
-- =====================================================

