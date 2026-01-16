# 🏀 Daily NBA Data Maintenance Edge Function

This Supabase Edge Function orchestrates all daily maintenance tasks to run overnight. It calls all the individual maintenance edge functions in sequence and provides a comprehensive summary.

## 📋 Tasks Executed

The function runs these tasks in order:

1. **Import Daily Boxscores** (`import-boxscores`)
   - Imports box scores from today and the last 2 days (3 days total)
   
2. **Import Player Props** (`import-player-props`)
   - Imports player props for today's games
   
3. **Import NBA Standings** (`update-standings`)
   - Updates NBA conference standings
   
4. **Import NBA Leaders** (`update-leaders`)
   - Updates NBA statistical leaders
   
5. **Import NBA Team Rosters** (`import-team-rosters`)
   - Updates NBA team rosters

**Note:** Player Game Stats import (`import_player_game_stats.py`) is currently a Python script that processes JSON files. It may need to be run separately or converted to an edge function. You can add it as a separate task if needed.

## 🚀 Deployment

### 1. Deploy the Function

```bash
cd /Users/adam/Desktop/hoopgeek
npx supabase functions deploy daily-maintenance --no-verify-jwt
```

### 2. Environment Variables

The function automatically uses these environment variables (set by Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Schedule the Function

You can run the function:

#### Option A: Via Supabase Database Cron (Recommended)

Create a database cron job to run overnight (e.g., 3:00 AM UTC = 10:00 PM EST / 7:00 PM PST):

```sql
-- Run daily at 3:00 AM UTC (10:00 PM EST / 7:00 PM PST previous day)
SELECT cron.schedule(
  'daily-maintenance',
  '0 3 * * *', -- 3:00 AM UTC daily
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-maintenance',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object()
    );
  $$
);
```

#### Option B: Via External Cron (cron-job.org, GitHub Actions, etc.)

Make a POST request to:
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-maintenance
```

With headers:
```json
{
  "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY",
  "Content-Type": "application/json"
}
```

## 🧪 Testing

### Manual Test

```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-maintenance" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "success": true,
  "totalTasks": 5,
  "successful": 5,
  "failed": 0,
  "duration": "45234ms",
  "timestamp": "2025-01-20T03:00:00.000Z",
  "results": [
    {
      "name": "Import Daily Boxscores",
      "success": true,
      "duration": 12345,
      "message": "Imported 10 box scores"
    },
    {
      "name": "Import Player Props",
      "success": true,
      "duration": 8901,
      "message": "Imported 50 games and 500 player props"
    },
    // ... more tasks
  ],
  "failedTasks": []
}
```

## 📊 Monitoring

Check function logs in Supabase Dashboard:
- **Edge Functions** → **daily-maintenance** → **Logs**

Or via CLI:
```bash
npx supabase functions logs daily-maintenance
```

## 🔄 Error Handling

The function:
- ✅ Continues running even if one task fails
- ✅ Provides detailed error messages for each failed task
- ✅ Returns a summary with success/failure counts
- ✅ Logs all operations for debugging

## 📝 Notes

- Each task runs sequentially (one after another)
- If a task fails, the function continues with the next task
- The function returns `success: false` if any task fails, but still completes all tasks
- Total duration includes all task execution times

