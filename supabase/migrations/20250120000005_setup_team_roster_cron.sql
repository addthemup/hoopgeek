-- =====================================================
-- CRON JOB: UPDATE NBA TEAM ROSTERS (Daily at 4 AM)
-- =====================================================
-- This cron job calls the import-team-rosters Edge Function
-- to fetch and store NBA team roster data from the NBA API
-- =====================================================

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-nba-team-rosters-cron') THEN
        PERFORM cron.unschedule('update-nba-team-rosters-cron');
        RAISE NOTICE 'Removed existing update-nba-team-rosters-cron job';
    ELSE
        RAISE NOTICE 'No existing update-nba-team-rosters-cron job to remove';
    END IF;
END $$;

-- Schedule the import-team-rosters to run daily at 4 AM UTC
SELECT cron.schedule(
    'update-nba-team-rosters-cron',                    -- Job name
    '0 4 * * *',                                        -- Daily at 4 AM (UTC)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/import-team-rosters',
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
WHERE jobname = 'update-nba-team-rosters-cron';

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- Cron Schedule: '0 4 * * *' = Daily at 4 AM UTC
-- 
-- To manually trigger: 
--   SELECT cron.run_job('update-nba-team-rosters-cron');
-- 
-- To stop: 
--   SELECT cron.unschedule('update-nba-team-rosters-cron');
-- 
-- To list all jobs: 
--   SELECT * FROM cron.job;
-- 

