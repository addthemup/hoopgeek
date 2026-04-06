-- Full feed automation chain (ET): upstream imports + post generators.
-- Idempotent: unschedules existing chain jobs before creating them.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Prefer ET semantics for cron expressions. If this cannot be set in your environment,
-- jobs still schedule, but you must convert schedule strings to UTC manually.
DO $$
BEGIN
  EXECUTE 'ALTER DATABASE postgres SET cron.timezone = ''America/New_York''';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not set cron.timezone to America/New_York: %', SQLERRM;
END $$;

DO $$
DECLARE
  v_job_name text;
  v_job_names text[] := ARRAY[
    -- Upstream imports
    'feed-chain-import-boxscores-0630',
    'feed-chain-import-player-props-0645',
    'feed-chain-fetch-injuries-0650',
    -- Morning publish wave
    'feed-chain-automate-player-spotlights-0700',
    'feed-chain-automate-prop-results-0705',
    'feed-chain-automate-game-recaps-0800',
    'feed-chain-automate-team-of-night-0805',
    -- Late-day rolling data refresh + publish
    'feed-chain-fetch-injuries-hourly-11to23',
    'feed-chain-import-player-props-hourly-11to23',
    'feed-chain-automate-prop-predictions-hourly-11to23',
    'feed-chain-automate-injury-reports-hourly-11to23',
    'feed-chain-automate-upcoming-hourly-11to23'
  ];
BEGIN
  FOREACH v_job_name IN ARRAY v_job_names
  LOOP
    BEGIN
      PERFORM cron.unschedule(v_job_name);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;

-- 6:30 AM ET: import previous-night boxscores into db.
SELECT cron.schedule(
  'feed-chain-import-boxscores-0630',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/import-boxscores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled', 'stage', 'upstream-boxscores-0630')
  );
  $$
);

-- 6:45 AM ET: prime prop lines before morning wave.
SELECT cron.schedule(
  'feed-chain-import-player-props-0645',
  '45 6 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/import-player-props',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled', 'stage', 'upstream-props-0645')
  );
  $$
);

-- 6:50 AM ET: refresh injuries before morning automation.
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

-- 7:00 AM ET: player spotlights.
SELECT cron.schedule(
  'feed-chain-automate-player-spotlights-0700',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/automate-player-spotlights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled', 'scan', true)
  );
  $$
);

-- 7:05 AM ET: prop results.
SELECT cron.schedule(
  'feed-chain-automate-prop-results-0705',
  '5 7 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/automate-prop-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled')
  );
  $$
);

-- 8:00 AM ET: game recaps.
SELECT cron.schedule(
  'feed-chain-automate-game-recaps-0800',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/automate-game-recaps',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled')
  );
  $$
);

-- 8:05 AM ET: team of the night.
SELECT cron.schedule(
  'feed-chain-automate-team-of-night-0805',
  '5 8 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/automate-team-of-night',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled')
  );
  $$
);

-- 11:00 AM to 11:00 PM ET (hourly): keep injury table current as reports update.
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

-- 11:02 AM to 11:02 PM ET (hourly): refresh prop lines for late games.
SELECT cron.schedule(
  'feed-chain-import-player-props-hourly-11to23',
  '2 11-23 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/import-player-props',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled', 'stage', 'rolling-props')
  );
  $$
);

-- 11:10 AM to 11:10 PM ET (hourly): prop predictions.
SELECT cron.schedule(
  'feed-chain-automate-prop-predictions-hourly-11to23',
  '10 11-23 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/automate-prop-predictions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled')
  );
  $$
);

-- 11:15 AM to 11:15 PM ET (hourly): injury reports.
SELECT cron.schedule(
  'feed-chain-automate-injury-reports-hourly-11to23',
  '15 11-23 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/automate-injury-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled')
  );
  $$
);

-- 11:20 AM to 11:20 PM ET (hourly): upcoming posts after props + injuries.
SELECT cron.schedule(
  'feed-chain-automate-upcoming-hourly-11to23',
  '20 11-23 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/automate-upcoming',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled')
  );
  $$
);
