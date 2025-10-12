-- ============================================================================
-- DRAFT MANAGER CRON JOB SETUP
-- Sets up a cron job to call the draft-manager edge function every 10 seconds
-- ============================================================================

-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable the http extension (required for making HTTP requests from PostgreSQL)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- ============================================================================
-- Create a function that calls the draft-manager edge function
-- ============================================================================
CREATE OR REPLACE FUNCTION call_draft_manager()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status INTEGER;
  response_content TEXT;
  response_record RECORD;
BEGIN
  -- Make HTTP POST request to draft-manager edge function
  SELECT * INTO response_record
  FROM extensions.http_post(
    url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/draft-manager',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"}'::JSONB,
    body := '{}'::JSONB
  );
  
  response_status := response_record.status;
  response_content := response_record.content;
  
  -- Log the response (optional - for debugging)
  RAISE NOTICE 'Draft manager called - Status: % - Response: %', response_status, response_content;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error calling draft manager: %', SQLERRM;
END;
$$;

-- Grant execute permission to postgres (needed for cron)
GRANT EXECUTE ON FUNCTION call_draft_manager() TO postgres;

-- ============================================================================
-- Drop existing cron job if it exists
-- ============================================================================
DO $$ 
BEGIN
  PERFORM cron.unschedule('draft-manager-cron')
  WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'draft-manager-cron');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, that's fine
  NULL;
END $$;

-- ============================================================================
-- Create cron job that runs every minute
-- ============================================================================
SELECT cron.schedule(
  'draft-manager-cron',
  '* * * * *', -- Every minute
  'SELECT call_draft_manager();'
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- View all cron jobs
SELECT * FROM cron.job WHERE jobname LIKE 'draft-manager%';

-- View cron job run history (last 10 runs)
SELECT * FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'draft-manager%')
ORDER BY start_time DESC 
LIMIT 10;

-- Test the function manually
SELECT call_draft_manager();

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. This cron job runs every 1 MINUTE (not 10 seconds)
--    pg_cron doesn't support sub-minute intervals natively
-- 2. The frontend polling will handle the 10-second intervals
-- 3. This cron job acts as a BACKUP in case no users are online
-- 4. To disable: SELECT cron.unschedule('draft-manager-cron');
-- 5. To see logs: Check the cron.job_run_details table
-- 6. To test manually: SELECT call_draft_manager();
-- ============================================================================

