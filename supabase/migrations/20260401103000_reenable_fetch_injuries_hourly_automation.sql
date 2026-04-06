-- Re-enable fetch-injuries automation after parser stabilization.
-- Idempotent: unschedules then re-schedules known job names.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('feed-chain-fetch-injuries-0650'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('feed-chain-fetch-injuries-hourly-11to23'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 6:50 AM ET daily
SELECT cron.schedule(
  'feed-chain-fetch-injuries-0650',
  '50 6 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/fetch-injuries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled', 'stage', 'upstream-injuries-0650')
  );
  $$
);

-- 11:00 AM to 11:00 PM ET hourly
SELECT cron.schedule(
  'feed-chain-fetch-injuries-hourly-11to23',
  '0 11-23 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/fetch-injuries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled', 'stage', 'rolling-injuries')
  );
  $$
);
