-- ============================================================================
-- CRON JOB: IMPORT PLAYER PROPS (4 times daily)
-- ============================================================================
-- This cron job calls the import-player-props Edge Function
-- to fetch and store player props from SportsGameOdds API
-- 
-- Schedule:
-- 1. 12:00 AM (Midnight) - Early morning update
-- 2. 11:00 AM - Pre-game update
-- 3. 2:30 PM - Afternoon update
-- 4. 5:00 PM - Final update (data considered final after this)
-- ============================================================================

-- Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron jobs if they exist
DO $$
BEGIN
    -- Drop all 4 jobs
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'import-player-props-12am') THEN
        PERFORM cron.unschedule('import-player-props-12am');
    END IF;
    
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'import-player-props-11am') THEN
        PERFORM cron.unschedule('import-player-props-11am');
    END IF;
    
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'import-player-props-230pm') THEN
        PERFORM cron.unschedule('import-player-props-230pm');
    END IF;
    
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'import-player-props-5pm') THEN
        PERFORM cron.unschedule('import-player-props-5pm');
    END IF;
END $$;

-- ============================================================================
-- JOB 1: 12:00 AM (Midnight) - Early morning update
-- ============================================================================
SELECT cron.schedule(
    'import-player-props-12am',
    '0 0 * * *',  -- Daily at midnight (00:00 UTC)
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
-- JOB 2: 11:00 AM - Pre-game update
-- ============================================================================
SELECT cron.schedule(
    'import-player-props-11am',
    '0 11 * * *',  -- Daily at 11:00 AM UTC
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
-- JOB 3: 2:30 PM - Afternoon update
-- ============================================================================
SELECT cron.schedule(
    'import-player-props-230pm',
    '30 14 * * *',  -- Daily at 2:30 PM UTC (14:30)
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
-- JOB 4: 5:00 PM - Final update (data considered final after this)
-- ============================================================================
SELECT cron.schedule(
    'import-player-props-5pm',
    '0 17 * * *',  -- Daily at 5:00 PM UTC (17:00)
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

-- List all scheduled cron jobs
SELECT 
    jobid,
    schedule,
    jobname,
    active,
    database,
    username
FROM cron.job
WHERE jobname LIKE 'import-player-props%'
ORDER BY jobname;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- Cron Schedule Format: 'minute hour day month weekday'
-- 
-- Times (UTC):
-- - 12:00 AM = '0 0 * * *'
-- - 11:00 AM = '0 11 * * *'
-- - 2:30 PM  = '30 14 * * *'
-- - 5:00 PM  = '0 17 * * *'
-- 
-- To manually trigger a job:
--   SELECT cron.run_job('import-player-props-12am');
-- 
-- To stop a job:
--   SELECT cron.unschedule('import-player-props-12am');
-- 
-- To view job run history:
--   SELECT * FROM cron.job_run_details 
--   WHERE jobname LIKE 'import-player-props%' 
--   ORDER BY start_time DESC 
--   LIMIT 20;
-- 
-- After the 5:00 PM scrape, the data is considered "final" for that day.
-- Games that start after 5:00 PM will use the data from the 5:00 PM scrape.
-- 

