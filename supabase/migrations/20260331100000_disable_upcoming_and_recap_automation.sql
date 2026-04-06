-- Disable automation for upcoming + game recap feed posts.
-- Keeps all other feed automation jobs active.

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job_name text;
  v_job_id bigint;
  v_job_names text[] := ARRAY[
    -- Current chain job names
    'feed-chain-automate-game-recaps-0800',
    'feed-chain-automate-upcoming-hourly-11to23',
    -- Legacy/transient names, if any
    'automate-game-recaps',
    'automate-upcoming'
  ];
BEGIN
  -- Unschedule known names (idempotent).
  FOREACH v_job_name IN ARRAY v_job_names
  LOOP
    BEGIN
      PERFORM cron.unschedule(v_job_name);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;

  -- Defensive cleanup: remove any cron job still targeting these endpoints.
  FOR v_job_id IN
    SELECT j.jobid
    FROM cron.job j
    WHERE j.command ILIKE '%/functions/v1/automate-game-recaps%'
       OR j.command ILIKE '%/functions/v1/automate-upcoming%'
  LOOP
    BEGIN
      PERFORM cron.unschedule(v_job_id);
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;
