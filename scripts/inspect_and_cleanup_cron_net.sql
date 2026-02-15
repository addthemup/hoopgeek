-- ============================================================
-- INSPECT & CLEANUP: cron.job_run_details + net._http_response
-- ============================================================
-- Run in Supabase SQL Editor. Use Part 1 to see what you have,
-- Part 2 for one-time cleanup, Part 3 (migration) for ongoing prune.
-- ============================================================

-- ============================================================
-- PART 1: INSPECTION — see what's running and how much data
-- ============================================================

-- 1a) All pg_cron jobs (what you have scheduled)
SELECT
  jobid,
  jobname,
  schedule,
  active,
  database,
  left(command::text, 80) AS command_preview
FROM cron.job
ORDER BY jobname;

-- 1b) cron.job_run_details: row counts and date range
SELECT
  'cron.job_run_details' AS table_name,
  count(*) AS row_count,
  min(start_time) AS oldest_run,
  max(start_time) AS newest_run
FROM cron.job_run_details;

-- 1c) cron.job_run_details: rows per job (which jobs log the most)
SELECT
  j.jobname,
  count(*) AS run_count,
  min(jrd.start_time) AS oldest,
  max(jrd.start_time) AS newest
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
GROUP BY j.jobname
ORDER BY run_count DESC;

-- 1d) net._http_response: row count and date range
--     (If you get "relation does not exist", try net.http_response_queue and use "created" column)
SELECT
  'net._http_response' AS table_name,
  count(*) AS row_count,
  min(created) AS oldest,
  max(created) AS newest
FROM net._http_response;

-- 1e) Recent cron runs (last 20)
SELECT
  j.jobname,
  jrd.status,
  jrd.start_time,
  jrd.end_time,
  jrd.end_time - jrd.start_time AS duration
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
ORDER BY jrd.start_time DESC
LIMIT 20;


-- ============================================================
-- PART 2: ONE-TIME CLEANUP — run when you want to free space now
-- ============================================================
-- Adjust the retention intervals if you want more/less history.
-- Example: keep last 7 days for cron, last 3 days for http responses.

-- 2a) Delete old cron run history (keeps last 7 days)
-- Run when ready (removes ~400k+ rows typically):
DELETE FROM cron.job_run_details
WHERE end_time < now() - interval '7 days';

-- 2b) Delete old pg_net HTTP responses (keeps last 3 days)
-- Uncomment and run when ready:
/*
DELETE FROM net._http_response
WHERE created < now() - interval '3 days';
*/

-- Optional: see how many rows would be deleted (dry run)
SELECT 'cron.job_run_details' AS tbl, count(*) AS rows_to_delete
FROM cron.job_run_details WHERE end_time < now() - interval '7 days'
UNION ALL
SELECT 'net._http_response', count(*)
FROM net._http_response WHERE created < now() - interval '3 days';


-- ============================================================
-- PART 3: ONGOING PRUNE (optional)
-- ============================================================
-- To prune automatically every day, apply the migration:
--   supabase/migrations/20260130000000_prune_cron_and_net.sql
-- That adds a daily cron job that deletes old rows from both tables.
