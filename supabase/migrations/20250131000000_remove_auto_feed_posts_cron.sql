-- Migration: Remove cron job for automatic feed post creation
-- This removes the scheduled job since feed posts are now created browser-side

-- Drop the cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-create-feed-posts-cron') THEN
        PERFORM cron.unschedule('auto-create-feed-posts-cron');
        RAISE NOTICE 'Cron job auto-create-feed-posts-cron has been removed';
    ELSE
        RAISE NOTICE 'Cron job auto-create-feed-posts-cron does not exist';
    END IF;
END $$;

-- Verify the cron job was removed
SELECT 
    jobid,
    schedule,
    active,
    jobname
FROM cron.job
WHERE jobname = 'auto-create-feed-posts-cron';

