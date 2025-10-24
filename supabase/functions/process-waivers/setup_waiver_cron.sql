-- ============================================================================
-- WAIVER PROCESSING CRON JOB SETUP
-- ============================================================================
-- This sets up a nightly cron job to automatically process waiver claims
-- Runs at 3:00 AM EST (8:00 AM UTC) every day
-- ============================================================================

-- First, ensure pg_cron extension is enabled (ask Supabase support if not)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing job if it exists
SELECT cron.unschedule('process-waivers-nightly');

-- Create the cron job
-- Runs daily at 8:00 AM UTC (3:00 AM EST, 12:00 AM PST)
SELECT cron.schedule(
  'process-waivers-nightly',
  '0 8 * * *', -- Cron expression: minute hour day month weekday
  $$
  SELECT
    net.http_post(
      url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/process-waivers',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('scheduled', true)
    ) AS request_id;
  $$
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if cron job is scheduled
SELECT * FROM cron.job WHERE jobname = 'process-waivers-nightly';

-- Check cron job history (after it runs)
SELECT 
  jobid,
  jobname,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobname = 'process-waivers-nightly'
ORDER BY start_time DESC
LIMIT 10;

-- ============================================================================
-- ALTERNATIVE: Edge Function Webhook Approach
-- ============================================================================
-- If pg_cron is not available, you can use an external cron service like:
-- - cron-job.org
-- - GitHub Actions
-- - Vercel Cron Jobs
-- - Railway Cron Jobs
-- 
-- Make a POST request to:
-- https://qbznyaimnrpibmahisue.supabase.co/functions/v1/process-waivers
-- 
-- Headers:
-- Authorization: Bearer <SERVICE_ROLE_KEY>
-- Content-Type: application/json
--
-- Body:
-- {}
-- ============================================================================

-- ============================================================================
-- MANUAL TRIGGER (for testing)
-- ============================================================================
-- To manually trigger waiver processing for a specific league:
/*
SELECT
  net.http_post(
    url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/process-waivers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'leagueId', 'YOUR_LEAGUE_ID_HERE',
      'seasonId', 'YOUR_SEASON_ID_HERE',
      'manualTrigger', true
    )
  ) AS request_id;
*/

-- ============================================================================
-- CRON EXPRESSION GUIDE
-- ============================================================================
-- Format: minute hour day month weekday
--
-- Examples:
-- '0 8 * * *'     - Daily at 8:00 AM UTC (3:00 AM EST)
-- '0 3 * * *'     - Daily at 3:00 AM UTC (10:00 PM EST previous day)
-- '0 12 * * *'    - Daily at 12:00 PM UTC (7:00 AM EST)
-- '0 */6 * * *'   - Every 6 hours
-- '0 0 * * 0'     - Weekly on Sunday at midnight UTC
-- '*/30 * * * *'  - Every 30 minutes
--
-- EST/EDT is UTC-5 / UTC-4 (daylight saving)
-- ============================================================================

-- ============================================================================
-- UNINSTALL (if needed)
-- ============================================================================
-- To remove the cron job:
-- SELECT cron.unschedule('process-waivers-nightly');
-- ============================================================================

