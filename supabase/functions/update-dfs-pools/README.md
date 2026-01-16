# 🏀 DFS Pool Management Edge Function

This Supabase Edge Function manages the lifecycle of DFS pools:
- Updates pool statuses (scheduled → live → completed)
- Finalizes completed pools (scoring + ranking)
- Updates entry statuses

## 📋 Features

- **Automatic Status Updates**: Transitions pools through their lifecycle based on game times
- **Pool Finalization**: Scores entries and ranks players when games complete
- **Error Handling**: Gracefully handles failures and logs errors
- **Manual Triggering**: Can be called manually for testing or troubleshooting

## 🚀 Deployment

### 1. Deploy the Function

```bash
cd /Users/adam/Desktop/hoopgeek
npx supabase functions deploy update-dfs-pools --no-verify-jwt
```

### 2. Environment Variables

The function automatically uses these environment variables (set by Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Schedule the Function

You can run the function:

#### Option A: Via Supabase Database Cron (Recommended)

Create a database cron job:

```sql
-- Run every 5 minutes during game hours (6pm-5am ET)
-- 23:00-23:59 UTC = 6-7 PM ET
-- 00:00-10:59 UTC = 7 PM - 5 AM ET
SELECT cron.schedule(
  'update-dfs-pools',
  '*/5 23 * * *', -- Every 5 minutes from 6-7 PM ET
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/update-dfs-pools',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object()
    );
  $$
);

-- Also schedule for 0-10 UTC (7 PM - 5 AM ET)
SELECT cron.schedule(
  'update-dfs-pools-night',
  '*/5 0-10 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/update-dfs-pools',
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
https://YOUR_PROJECT_ID.supabase.co/functions/v1/update-dfs-pools
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
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/update-dfs-pools" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "success": true,
  "message": "Updated 2 pool statuses, finalized 1 pools",
  "poolsUpdated": 2,
  "poolsFinalized": 1,
  "duration": "1234ms",
  "timestamp": "2025-01-20T12:00:00.000Z"
}
```

## 📊 Monitoring

Check function logs in Supabase Dashboard:
- **Edge Functions** → **update-dfs-pools** → **Logs**

Or via CLI:
```bash
npx supabase functions logs update-dfs-pools
```

## 🔄 Migration from Cloudflare Worker

This function replaces the Cloudflare Worker at `cloudflare-worker-dfs/update-dfs-pools.js`.

**Key Differences:**
- Uses Supabase client library instead of direct fetch calls
- Runs on Deno runtime instead of Cloudflare Workers
- Environment variables accessed via `Deno.env.get()`
- Scheduled via database cron instead of Cloudflare cron triggers

