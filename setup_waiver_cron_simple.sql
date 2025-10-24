-- Simple Waiver Cron Setup (No superuser permissions needed)
-- This version stores the service role key directly in the cron job

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- IMPORTANT: Replace 'YOUR_SERVICE_ROLE_KEY_HERE' with your actual service role key
-- Get it from: Supabase Dashboard → Settings → API → service_role key (secret)

SELECT cron.schedule(
  'process-waivers-every-minute',
  '* * * * *',  -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/process-waivers-cron',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY_HERE"}'::jsonb
    ) as request_id;
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'process-waivers-every-minute';

-- Expected output:
-- You should see your cron job with schedule '* * * * *'

