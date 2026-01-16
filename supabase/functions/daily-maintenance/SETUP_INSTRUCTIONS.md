# 📝 Step-by-Step Setup Instructions

## Step 1: Access Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/qbznyaimnrpibmahisue
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"** button

## Step 2: Set Service Role Key (One-time setup)

**First, run this SQL to set up the service role key for cron jobs:**

```sql
-- Set the service role key for cron jobs to use
ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw';
```

**Note:** If you get an error saying you can't alter the database, you may need to set this via Supabase Dashboard → Settings → Database → Custom Postgres Config, or it may already be set.

## Step 3: Set Up the Cron Job

**Copy and paste this entire SQL into the SQL Editor and click "Run":**

```sql
-- =====================================================
-- CRON JOB: DAILY NBA DATA MAINTENANCE (Daily at 1:45 AM EST)
-- =====================================================

-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-maintenance-cron') THEN
        PERFORM cron.unschedule('daily-maintenance-cron');
        RAISE NOTICE 'Removed existing daily-maintenance-cron job';
    ELSE
        RAISE NOTICE 'No existing daily-maintenance-cron job to remove';
    END IF;
END $$;

-- Schedule the daily-maintenance to run daily at 1:45 AM EST
-- (1:45 AM EST = 6:45 AM UTC)
SELECT cron.schedule(
    'daily-maintenance-cron',                    -- Job name
    '45 6 * * *',                               -- Daily at 6:45 AM UTC (1:45 AM EST)
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/daily-maintenance',
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
WHERE jobname = 'daily-maintenance-cron';
```

**Expected Result:** You should see a row with:
- `jobname`: `daily-maintenance-cron`
- `schedule`: `45 6 * * *`
- `active`: `t` (true)

## Step 4: Test It Manually

**To test the function right now, run this SQL:**

```sql
-- Manually trigger the cron job
SELECT cron.run_job('daily-maintenance-cron');
```

**Or test via HTTP directly:**

```sql
-- Test the function directly
SELECT net.http_post(
    url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/daily-maintenance',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw'
    ),
    body := jsonb_build_object('trigger', 'manual_test')
) AS result;
```

## Step 5: Check Logs

After running, check the function logs:
1. Go to **Edge Functions** → **daily-maintenance** → **Logs**
2. You'll see detailed execution logs for each task

## Troubleshooting

### If you get an error about `app.settings.service_role_key`:

Try setting it via Supabase Dashboard:
1. Go to **Settings** → **Database**
2. Look for **Custom Postgres Config** or **Database Settings**
3. Add: `app.settings.service_role_key = 'your-service-role-key'`

Or use this alternative approach (directly in the SQL):

```sql
-- Alternative: Use the key directly in the cron job
SELECT cron.schedule(
    'daily-maintenance-cron',
    '45 6 * * *',
    $$
    SELECT net.http_post(
        url := 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/daily-maintenance',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw'
        ),
        body := jsonb_build_object('trigger', 'cron_scheduled')
    );
    $$
);
```







