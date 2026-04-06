-- Schedule persisted MP4 highlight ingestion.
-- Function is self-guarded by GAME_HIGHLIGHTS_INGEST_ENABLED.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_job_name text;
  v_job_names text[] := ARRAY[
    'feed-chain-ingest-game-highlights-0810',
    'feed-chain-ingest-game-highlights-hourly-11to23'
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

-- 8:10 AM ET daily: ingest fresh clips and cleanup source JSON on success.
SELECT cron.schedule(
  'feed-chain-ingest-game-highlights-0810',
  '10 8 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/ingest-game-highlights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled', 'max_files', 60, 'delete_source', true)
  );
  $$
);

-- 11:30 AM - 11:30 PM ET hourly: catch late games / delayed uploads.
SELECT cron.schedule(
  'feed-chain-ingest-game-highlights-hourly-11to23',
  '30 11-23 * * *',
  $$
  SELECT net.http_post(
    url := COALESCE(NULLIF(current_setting('app.settings.supabase_url', true), ''), 'https://qbznyaimnrpibmahisue.supabase.co') || '/functions/v1/ingest-game-highlights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron_scheduled', 'max_files', 40, 'delete_source', true)
  );
  $$
);
