-- ============================================================================
-- CRON JOB: Calculate Player Prop Hit Rates
-- ============================================================================
-- Runs daily at 4:45 AM EST (9:45 AM UTC in winter, 8:45 AM UTC in summer)
-- EST is UTC-5, so 4:45 AM EST = 9:45 AM UTC
-- EDT is UTC-4, so 4:45 AM EDT = 8:45 AM UTC
-- Using 9:45 AM UTC to cover EST (winter time)
-- ============================================================================

-- Delete existing cron job if it exists
DELETE FROM cron.job WHERE jobname = 'calculate-prop-hit-rates';

-- Insert new cron job
-- Runs at 4:45 AM EST (9:45 AM UTC in winter, 8:45 AM UTC in summer)
-- EST is UTC-5, EDT is UTC-4
-- Using 9:45 AM UTC to cover EST (winter time)
INSERT INTO cron.job (
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
) VALUES (
  'calculate-prop-hit-rates',
  '45 9 * * *', -- 9:45 AM UTC daily (4:45 AM EST in winter)
  $$
    SELECT
      net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/calculate-prop-hit-rates',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw'
        ),
        body := '{}'::jsonb
      ) AS request_id;
  $$,
  'localhost',
  5432,
  'postgres',
  'postgres',
  true
);

-- Note: To handle EDT (summer time), you may want to adjust the schedule
-- EDT is UTC-4, so 4:45 AM EDT = 8:45 AM UTC
-- You could use: '45 8,9 * * *' to run at both 8:45 and 9:45 UTC
-- Or use a more sophisticated approach with timezone-aware scheduling

