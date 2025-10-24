# Deploy Live Stats Worker Fix

## Problem
The Cloudflare worker was configured to run during UTC hours that didn't align with US NBA game times, causing live stats to not update during games.

## Solution
Updated the cron schedule to run from 23:00 UTC to 10:00 UTC, which covers 6:00 PM ET to 5:00 AM ET (all NBA game hours including West Coast games).

## Deployment Steps

### 1. Deploy the Updated Worker

```bash
cd cloudflare-worker
./deploy.sh
```

This will:
- Deploy the updated cron schedule
- Keep your existing secrets (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

### 2. Manually Trigger the Worker (Get Immediate Updates)

After deployment, you can manually trigger the worker to update live stats right now:

```bash
# Get your worker URL from Cloudflare dashboard or from previous deployment
# It should be something like: https://hoopgeek-live-stats.YOUR_SUBDOMAIN.workers.dev

curl https://hoopgeek-live-stats.YOUR_SUBDOMAIN.workers.dev
```

Or visit the URL in your browser to trigger it immediately.

### 3. Verify Live Stats Are Updating

Check the live_player_stats table in Supabase:

```sql
-- Check most recent updates
SELECT 
  player_name,
  team_tricode,
  stats->>'pts' as points,
  stats->>'reb' as rebounds,
  stats->>'ast' as assists,
  updated_at
FROM live_player_stats
ORDER BY updated_at DESC
LIMIT 20;

-- Check update status
SELECT * FROM live_stats_updates
ORDER BY last_updated DESC
LIMIT 5;
```

### 4. Monitor the Worker

```bash
# View real-time logs
cd cloudflare-worker
wrangler tail

# Check worker status
wrangler deployments list
```

## Updated Cron Schedule

**Old Schedule:**
```
["* 18-23,0-1 * * *"]  # 6 PM - 1 AM UTC = 1 PM - 8 PM ET (missed most games!)
```

**New Schedule:**
```
["* 23 * * *", "* 0-10 * * *"]  # 11 PM UTC - 10 AM UTC = 6 PM ET - 5 AM ET
```

This covers:
- Early East Coast games (7 PM ET)
- Prime time games (8 PM ET)
- Late West Coast games (10:30 PM PT / 1:30 AM ET)

## Changes Made

1. **Updated** `cloudflare-worker/wrangler.toml` - Fixed cron schedule
2. **Added** Loading indicator to entry details modal in PoolDetailsModal
3. **Updated** deploy.sh with correct time range in output message

## Testing

After deployment:
1. Wait for a minute for the cron to run (or trigger manually)
2. Check Supabase `live_player_stats` table for recent updates
3. Open your DFS app and view an entry - should show live scores
4. Verify the loading indicator appears when clicking entry details

