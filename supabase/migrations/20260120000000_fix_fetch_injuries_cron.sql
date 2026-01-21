-- =====================================================
-- FIX: FETCH NBA INJURY REPORTS CRON JOB
-- =====================================================
-- This migration fixes the fetch-injuries cron jobs
-- by using the service role key directly instead of
-- relying on app.settings.service_role_key which may not be set
-- =====================================================

-- Drop existing cron jobs if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-injuries-morning-cron') THEN
        PERFORM cron.unschedule('fetch-injuries-morning-cron');
        RAISE NOTICE 'Removed existing fetch-injuries-morning-cron job';
    ELSE
        RAISE NOTICE 'No existing fetch-injuries-morning-cron job to remove';
    END IF;
    
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-injuries-evening-cron') THEN
        PERFORM cron.unschedule('fetch-injuries-evening-cron');
        RAISE NOTICE 'Removed existing fetch-injuries-evening-cron job';
    ELSE
        RAISE NOTICE 'No existing fetch-injuries-evening-cron job to remove';
    END IF;
END $$;

-- Schedule the fetch-injuries to run daily at 8:05 AM EST
-- 8:05 AM EST = 13:05 UTC (EST is UTC-5, EDT is UTC-4)
-- Using 13:05 UTC to account for EST (will be 14:05 during EDT)
-- Using service role key directly instead of current_setting
SELECT cron.schedule(
    'fetch-injuries-morning-cron',                    -- Job name
    '5 13 * * *',                                     -- Daily at 13:05 UTC (8:05 AM EST / 9:05 AM EDT)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/fetch-injuries',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw'
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled')
    );
    $$
);

-- Schedule the fetch-injuries to run daily at 5:05 PM EST
-- 5:05 PM EST = 22:05 UTC (EST is UTC-5, EDT is UTC-4)
-- Using 22:05 UTC to account for EST (will be 23:05 during EDT)
-- Using service role key directly instead of current_setting
SELECT cron.schedule(
    'fetch-injuries-evening-cron',                    -- Job name
    '5 22 * * *',                                     -- Daily at 22:05 UTC (5:05 PM EST / 6:05 PM EDT)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/fetch-injuries',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw'
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled')
    );
    $$
);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- List the scheduled cron jobs
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
WHERE jobname IN ('fetch-injuries-morning-cron', 'fetch-injuries-evening-cron')
ORDER BY jobname;

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- Cron Schedule: 
--   Morning: '5 13 * * *' = Daily at 13:05 UTC (8:05 AM EST / 9:05 AM EDT)
--   Evening: '5 22 * * *' = Daily at 22:05 UTC (5:05 PM EST / 6:05 PM EDT)
-- 
-- The function prioritizes 08_00AM and 05_00PM PDF URL formats which have been successful.
-- 
-- To manually trigger: 
--   SELECT cron.run_job('fetch-injuries-morning-cron');
--   SELECT cron.run_job('fetch-injuries-evening-cron');
-- 
-- To stop: 
--   SELECT cron.unschedule('fetch-injuries-morning-cron');
--   SELECT cron.unschedule('fetch-injuries-evening-cron');
-- 
-- To list all jobs: SELECT * FROM cron.job;
-- 
-- To check if jobs are running:
--   SELECT * FROM cron.job_run_details 
--   WHERE jobid IN (
--     SELECT jobid FROM cron.job 
--     WHERE jobname IN ('fetch-injuries-morning-cron', 'fetch-injuries-evening-cron')
--   )
--   ORDER BY start_time DESC 
--   LIMIT 10;
