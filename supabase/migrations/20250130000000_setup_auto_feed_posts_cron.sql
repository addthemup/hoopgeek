-- Migration: Set up cron job for automatic feed post creation
-- This runs nightly at 2:00 AM UTC to process new game JSON files

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-feed-posts-cron') THEN
        PERFORM cron.unschedule('auto-create-feed-posts-cron');
    END IF;
END $$;

-- Schedule the edge function to run daily at 2:00 AM UTC
SELECT cron.schedule(
    'auto-create-feed-posts-cron',
    '0 2 * * *',  -- Daily at 2:00 AM UTC (adjust as needed)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/auto-create-feed-posts',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled')
    );
    $$
);

-- Verify the cron job was created
SELECT 
    jobid,
    schedule,
    active,
    jobname
FROM cron.job
WHERE jobname = 'auto-create-feed-posts-cron';

