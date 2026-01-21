-- =====================================================
-- CHECK FETCH INJURIES CRON JOB STATUS
-- =====================================================
-- Run this to check if the cron jobs are set up correctly
-- =====================================================

-- Check if cron jobs exist and are active
SELECT 
    jobid,
    schedule,
    jobname,
    active,
    database,
    username
FROM cron.job
WHERE jobname IN ('fetch-injuries-morning-cron', 'fetch-injuries-evening-cron')
ORDER BY jobname;

-- Check recent job runs (if any)
SELECT 
    jrd.jobid,
    j.jobname,
    jrd.runid,
    jrd.job_pid,
    jrd.database,
    jrd.username,
    jrd.command,
    jrd.status,
    jrd.return_message,
    jrd.start_time,
    jrd.end_time,
    jrd.end_time - jrd.start_time AS duration
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('fetch-injuries-morning-cron', 'fetch-injuries-evening-cron')
ORDER BY jrd.start_time DESC
LIMIT 20;

-- Check if service role key setting exists
SELECT current_setting('app.settings.service_role_key', true) AS service_role_key_set;

-- Check recent injuries to see when they were last updated
SELECT 
    MAX(date_updated) as last_updated,
    COUNT(*) as total_injuries,
    COUNT(DISTINCT nba_player_id) as unique_players
FROM nba_injuries
WHERE is_current = true;
