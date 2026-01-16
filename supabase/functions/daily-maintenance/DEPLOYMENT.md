# 🚀 Daily Maintenance Deployment Guide

## ✅ Deployment Status

The function has been **deployed successfully**! 

You can view it in the Supabase Dashboard:
https://supabase.com/dashboard/project/qbznyaimnrpibmahisue/functions

## 📋 Next Steps

### 1. Set Up the Cron Job

Run the migration to schedule the function to run at **1:45 AM EST** (6:45 AM UTC) every night:

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/20250126000000_setup_daily_maintenance_cron.sql
```

Or manually create the cron job:

```sql
-- Drop existing cron job if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-maintenance-cron') THEN
        PERFORM cron.unschedule('daily-maintenance-cron');
    END IF;
END $$;

-- Schedule for 1:45 AM EST (6:45 AM UTC)
SELECT cron.schedule(
    'daily-maintenance-cron',
    '45 6 * * *',  -- Daily at 6:45 AM UTC = 1:45 AM EST
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
```

### 2. Test the Function Manually

You can test the function in several ways:

#### Option A: Via Supabase Dashboard
1. Go to **Edge Functions** → **daily-maintenance**
2. Click **Invoke Function**
3. Use the service role key for authorization

#### Option B: Via curl (may timeout if tasks take long)
```bash
curl -X POST "https://qbznyaimnrpibmahisue.supabase.co/functions/v1/daily-maintenance" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Option C: Via Database (Recommended for testing)
```sql
-- Manually trigger the cron job
SELECT cron.run_job('daily-maintenance-cron');
```

### 3. Monitor the Function

#### Check Logs in Supabase Dashboard:
1. Go to **Edge Functions** → **daily-maintenance** → **Logs**
2. You'll see detailed logs for each task

#### Check Cron Job Status:
```sql
-- View the cron job
SELECT * FROM cron.job WHERE jobname = 'daily-maintenance-cron';

-- View recent cron job runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-maintenance-cron')
ORDER BY start_time DESC 
LIMIT 10;
```

## ⚠️ Important Notes

1. **Timeout Warning**: The function may take several minutes to complete all tasks. If testing via curl, it may timeout, but the function will still complete in the background.

2. **Task Execution**: The function runs these tasks sequentially:
   - Import Daily Boxscores
   - Import Player Props
   - Import NBA Standings
   - Import NBA Leaders
   - Import NBA Team Rosters

3. **Error Handling**: If one task fails, the function continues with the remaining tasks and provides a summary at the end.

4. **Schedule**: The function is set to run at **1:45 AM EST** (6:45 AM UTC) every night.

## 🔍 Verification

After the first run, check:
1. **Function Logs** in Supabase Dashboard for detailed execution logs
2. **Database Tables** to verify data was imported:
   - `nba_boxscores`
   - `player_props`
   - `nba_standings`
   - `nba_leaders`
   - `nba_team_roster`

## 📊 Expected Response

When successful, the function returns:
```json
{
  "success": true,
  "totalTasks": 5,
  "successful": 5,
  "failed": 0,
  "duration": "45234ms",
  "timestamp": "2025-01-20T06:45:00.000Z",
  "results": [
    {
      "name": "Import Daily Boxscores",
      "success": true,
      "duration": 12345,
      "message": "..."
    },
    // ... more tasks
  ],
  "failedTasks": []
}
```

