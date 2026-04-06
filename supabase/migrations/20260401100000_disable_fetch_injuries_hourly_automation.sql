-- Temporarily disable hourly fetch-injuries automation while parser parity is stabilized.
-- Idempotent and safe to re-run.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job_name text;
  v_job_id bigint;
  v_job_names text[] := ARRAY[
    'feed-chain-fetch-injuries-hourly-11to23',
    'feed-chain-fetch-injuries-0650',
    'fetch-injuries-morning',
    'fetch-injuries-afternoon',
    'fetch-injuries-evening'
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

  -- Defensive cleanup for any remaining jobs that target fetch-injuries endpoint.
  FOR v_job_id IN
    SELECT j.jobid
    FROM cron.job j
    WHERE j.command ILIKE '%/functions/v1/fetch-injuries%'
  LOOP
    BEGIN
      PERFORM cron.unschedule(v_job_id);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;
