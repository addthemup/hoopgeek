-- Verify all cron jobs are set up
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    CASE 
        WHEN jobname LIKE 'import-player-props%' THEN 'Player Props (Edge Function)'
        WHEN jobname = 'update-nba-standings-cron' THEN 'Standings (Edge Function)'
        WHEN jobname = 'update-nba-leaders-cron' THEN 'Leaders (Edge Function)'
        WHEN jobname = 'update-nba-team-rosters-cron' THEN 'Team Rosters (GitHub Actions)'
        WHEN jobname = 'import-daily-boxscores-cron' THEN 'Box Scores (GitHub Actions)'
        ELSE 'Other'
    END as job_type
FROM cron.job
ORDER BY jobname;
