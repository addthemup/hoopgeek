-- =====================================================
-- CRON JOB: UPDATE NBA STANDINGS (Daily at 3 AM)
-- =====================================================
-- This cron job calls the update-standings Edge Function
-- to fetch and store the latest NBA standings data
-- =====================================================

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-nba-standings-cron') THEN
        PERFORM cron.unschedule('update-nba-standings-cron');
        RAISE NOTICE 'Removed existing update-nba-standings-cron job';
    ELSE
        RAISE NOTICE 'No existing update-nba-standings-cron job to remove';
    END IF;
END $$;

-- Schedule the update-standings to run daily at 3 AM
SELECT cron.schedule(
    'update-nba-standings-cron',                    -- Job name
    '0 3 * * *',                                    -- Daily at 3 AM (UTC)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/update-standings',
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
WHERE jobname = 'update-nba-standings-cron';

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- Cron Schedule: '0 3 * * *' = Daily at 3 AM UTC
-- 
-- To manually trigger: SELECT cron.run_job('update-nba-standings-cron');
-- To stop: SELECT cron.unschedule('update-nba-standings-cron');
-- To list all jobs: SELECT * FROM cron.job;
-- 
-- =====================================================

