-- List all cron jobs with all available information
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
ORDER BY jobid;

-- Alternative: Get everything (if there are additional columns)
-- SELECT * FROM cron.job ORDER BY jobid;

