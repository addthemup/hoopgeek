-- =====================================================
-- CRON JOB: UPDATE NBA LEADERS (Daily at 3 AM)
-- =====================================================
-- This cron job calls the update-leaders Edge Function
-- to fetch and store the latest NBA season leaders
-- =====================================================

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-nba-leaders-cron') THEN
        PERFORM cron.unschedule('update-nba-leaders-cron');
        RAISE NOTICE 'Removed existing update-nba-leaders-cron job';
    ELSE
        RAISE NOTICE 'No existing update-nba-leaders-cron job to remove';
    END IF;
END $$;

-- Schedule the update-leaders to run daily at 3 AM
SELECT cron.schedule(
    'update-nba-leaders-cron',                    -- Job name
    '0 3 * * *',                                    -- Daily at 3 AM (UTC)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/update-leaders',
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
WHERE jobname = 'update-nba-leaders-cron';

