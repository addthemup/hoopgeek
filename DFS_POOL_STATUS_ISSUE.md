# DFS Pool Status Issue - Diagnosis

## 🔍 Problem
Pools are stuck in "live" status even after all games have ended.

## 🐛 Root Cause
**The DFS Cloudflare Worker has the SAME timezone issue as the live-stats worker!**

### Current Cron Schedule
```toml
crons = ["*/5 18-23,0-1 * * *"]
```

This runs:
- Every 5 minutes
- During 18-23 and 0-1 UTC
- Which is **1 PM - 8 PM ET** (missing late games!)

### What Should Happen
1. DFS worker runs every 5 minutes
2. Calls `update_dfs_pool_statuses()` function
3. Function checks if all games in pool are finished (game_status = 3)
4. Updates pool: `live` → `completed`
5. Then finalizes the pool (scores + rankings)

### What's Actually Happening
Games end at 10-11 PM ET, but worker isn't running because it's outside the cron window!

## ✅ Fix Required

### 1. Update Cron Schedule
Change to match live-stats worker:
```toml
crons = ["*/5 23 * * *", "*/5 0-10 * * *"]
```

This covers:
- 23:00-23:59 UTC (6 PM - 7 PM ET)
- 00:00-10:59 UTC (7 PM - 5 AM ET)
- Runs every 5 minutes (vs every 1 minute for live-stats)

### 2. Deploy Updated Worker
```bash
cd cloudflare-worker-dfs
npx wrangler deploy
```

### 3. Manually Fix Stuck Pool (Immediate)
Run this query in Supabase SQL Editor:
```sql
-- Manually trigger the status update function
SELECT * FROM update_dfs_pool_statuses();

-- If pools are now completed, finalize them
-- (This would normally happen automatically via the worker)
```

Or trigger the worker manually via HTTP:
```bash
curl -X POST https://hoopgeek-dfs.[your-worker-subdomain].workers.dev/
```

## 📊 How to Verify

1. Check pool statuses:
```sql
SELECT 
  dp.name,
  dp.status,
  COUNT(dpg.game_id) as total_games,
  COUNT(CASE WHEN ng.game_status = 3 THEN 1 END) as finished_games
FROM dfs_pools dp
LEFT JOIN dfs_pool_games dpg ON dp.id = dpg.pool_id
LEFT JOIN nba_games ng ON dpg.game_id = ng.game_id
WHERE dp.slate_date >= CURRENT_DATE - 1
GROUP BY dp.id, dp.name, dp.status;
```

2. Check worker logs:
```bash
cd cloudflare-worker-dfs
npx wrangler tail --format pretty
```

Expected output when working:
```
✅ Updated 1 pool status(es)
   • Pool [...]: live → completed
✅ Finalized 1 pool(s)
```

