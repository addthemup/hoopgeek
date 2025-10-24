-- =====================================================
-- CHECK PG_CRON STATUS
-- =====================================================
-- Run this in your Supabase SQL Editor to check if
-- pg_cron is enabled and the draft-manager job is running
-- =====================================================

-- 1. Check if pg_cron extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 2. Check all scheduled cron jobs
SELECT * FROM cron.job;

-- 3. Check recent cron job runs (last 50)
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 50;

-- 4. Check if draft-manager cron job exists
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active
FROM cron.job 
WHERE jobname = 'draft-manager-cron';

-- =====================================================
-- IMPORTANT NOTES:
-- =====================================================
-- If you see NO RESULTS for the cron job, it means:
-- 1. pg_cron is not enabled, OR
-- 2. The migration wasn't run, OR
-- 3. Supabase free tier doesn't support pg_cron
-- 
-- Many Supabase plans don't include pg_cron!
-- You may need to use an alternative approach.
-- =====================================================

