-- =====================================================
-- ENABLE PG_CRON FOR DRAFT MANAGER
-- =====================================================
-- This migration enables pg_cron extension and sets up
-- automatic cron jobs for the draft-manager function
-- =====================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on pg_cron to authenticated users
GRANT USAGE ON SCHEMA cron TO authenticated;
GRANT USAGE ON SCHEMA cron TO service_role;

-- =====================================================
-- CRON JOB: DRAFT MANAGER (Every 30 seconds)
-- =====================================================
-- This cron job calls the draft-manager Edge Function
-- to process active drafts and handle expired picks
-- =====================================================

-- Drop existing cron job if it exists (ignore error if job doesn't exist)
DO $$
BEGIN
    -- Only try to unschedule if the job exists
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'draft-manager-cron') THEN
        PERFORM cron.unschedule('draft-manager-cron');
        RAISE NOTICE 'Removed existing draft-manager-cron job';
    ELSE
        RAISE NOTICE 'No existing draft-manager-cron job to remove';
    END IF;
END $$;

-- Schedule the draft-manager to run every 30 seconds
SELECT cron.schedule(
    'draft-manager-cron',                    -- Job name
    '*/30 * * * *',                         -- Every 30 seconds
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/draft-manager',
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

-- Check if pg_cron is enabled
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE NOTICE '✅ pg_cron extension enabled successfully!';
    ELSE
        RAISE NOTICE '❌ pg_cron extension failed to enable';
    END IF;
END $$;

-- List all scheduled cron jobs
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
WHERE jobname = 'draft-manager-cron';

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- Cron Schedule Format: '*/30 * * * *' = Every 30 seconds
-- 
-- Other useful schedules:
-- - '*/1 * * * *' = Every minute (for testing)
-- - '*/5 * * * *' = Every 5 minutes (less frequent)
-- - '0 */1 * * *' = Every hour
-- 
-- To manually trigger: SELECT cron.run_job('draft-manager-cron');
-- To stop: SELECT cron.unschedule('draft-manager-cron');
-- To list all jobs: SELECT * FROM cron.job;
-- 
-- =====================================================
