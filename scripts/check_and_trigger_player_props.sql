-- Check cron job status for player props
-- Note: jobname might not exist in all pg_cron versions, so we filter by command content
SELECT 
  jobid,
  schedule,
  active,
  command
FROM cron.job 
WHERE command::text LIKE '%import-player-props%'
ORDER BY jobid;

-- Alternative: List all cron jobs to see what's available
-- SELECT * FROM cron.job;

-- Check if jobs are running (filter by jobid from above query)
-- First, get the jobid from the query above, then use it here:
-- SELECT 
--   jobid,
--   runid,
--   job_pid,
--   database,
--   username,
--   command,
--   status,
--   return_message,
--   start_time,
--   end_time
-- FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE command::text LIKE '%import-player-props%')
-- ORDER BY start_time DESC
-- LIMIT 10;

-- Check recent job runs (all jobs)
SELECT 
  jobid,
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
WHERE command::text LIKE '%import-player-props%'
ORDER BY start_time DESC
LIMIT 10;

-- ============================================================================
-- MANUALLY TRIGGER A JOB
-- ============================================================================
-- cron.run_job() requires a jobid (integer), not a jobname (string)
-- 
-- Option 1: Get jobid first, then run it (two separate queries)
-- Step 1: Find the jobid for the 11am job:
SELECT jobid 
FROM cron.job 
WHERE command::text LIKE '%import-player-props%' 
  AND command::text LIKE '%11am%'
LIMIT 1;

-- Step 2: Use the jobid from above (replace XXXX with actual jobid):
-- SELECT cron.run_job(XXXX);

-- Option 2: Run directly in one query (for 11am job):
-- SELECT cron.run_job(
--   (SELECT jobid FROM cron.job 
--    WHERE command::text LIKE '%import-player-props%' 
--      AND command::text LIKE '%11am%' 
--    LIMIT 1)
-- );

-- Option 3: Run all player props jobs (be careful - this runs all 4 jobs):
-- SELECT cron.run_job(jobid) 
-- FROM cron.job 
-- WHERE command::text LIKE '%import-player-props%';

