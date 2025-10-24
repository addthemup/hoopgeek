# Cloudflare Worker: DFS Pool Management

## Overview

This worker manages the DFS pool lifecycle, running every 5 minutes during game hours (6pm-1am ET).

## What It Does

1. **Updates Pool Statuses**
   - `scheduled` → `live` (when first game starts)
   - `live` → `completed` (when all games finish)
   - Calls database function: `update_dfs_pool_statuses()`

2. **Finalizes Completed Pools**
   - Finds pools with `status = 'completed'` and `finalized_at IS NULL`
   - Calls `score_dfs_pool(pool_id)` to calculate final scores and rankings
   - Sets `finalized_at` timestamp
   - Entries move to "Past" tab in UI

## Schedule

```
*/5 18-23,0-1 * * *
```
- Runs every 5 minutes from 6pm-1am ET
- Less frequent than live-stats (every minute) since status changes aren't as time-sensitive

## Setup

### 1. Install Dependencies
```bash
cd cloudflare-worker-dfs
npm install
```

### 2. Login to Cloudflare
```bash
npx wrangler login
```

### 3. Set Secrets
```bash
npx wrangler secret put SUPABASE_URL
# Enter: https://qbznyaimnrpibmahisue.supabase.co

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Enter: [your service role key]
```

### 4. Deploy
```bash
npm run deploy
```

## Testing

### Manual Trigger
```bash
curl https://hoopgeek-dfs.awcarv.workers.dev
```

### Watch Logs
```bash
npm run tail
```

## Database Functions Used

### `update_dfs_pool_statuses()`
- Updates pool statuses based on game statuses
- Returns: Array of updated pools with old/new status

### `score_dfs_pool(p_pool_id UUID)`
- Calculates player fantasy points (hybrid: live_player_stats + nba_boxscores)
- Sums weighted points for each entry
- Ranks entries by score
- Returns: Array of scored entries

## Error Handling

- If scoring fails, pool remains in `completed` status without `finalized_at`
- Worker will retry on next run (5 minutes later)
- Check logs for detailed error messages

## Related Workers

- **hoopgeek-live-stats**: Updates live player stats every minute
- **hoopgeek-fantasy**: Processes waivers, advances weeks (future)

