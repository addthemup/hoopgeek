-- =====================================================
-- CRON JOB: IMPORT DAILY BOX SCORES (Daily at 1:45 AM)
-- =====================================================
-- This cron job calls the import-boxscores Edge Function
-- to fetch and store box score data for games from the previous day
-- =====================================================

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'import-daily-boxscores-cron') THEN
        PERFORM cron.unschedule('import-daily-boxscores-cron');
        RAISE NOTICE 'Removed existing import-daily-boxscores-cron job';
    ELSE
        RAISE NOTICE 'No existing import-daily-boxscores-cron job to remove';
    END IF;
END $$;

-- Schedule the import-boxscores to run daily at 1:45 AM UTC
-- Note: 1:45 AM UTC = 8:45 PM EST (previous day) or 9:45 PM EST (previous day) depending on DST
SELECT cron.schedule(
    'import-daily-boxscores-cron',                    -- Job name
    '45 1 * * *',                                      -- Daily at 1:45 AM (UTC)
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
WHERE jobname = 'import-daily-boxscores-cron';

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- Cron Schedule: '45 1 * * *' = Daily at 1:45 AM UTC
-- 
-- This runs the import for games from the previous day
-- (yesterday's games are imported early morning)
-- 
-- To manually trigger: 
--   SELECT cron.run_job('import-daily-boxscores-cron');
-- 
-- To stop: 
--   SELECT cron.unschedule('import-daily-boxscores-cron');
-- 
-- To list all jobs: 
--   SELECT * FROM cron.job;
-- 

