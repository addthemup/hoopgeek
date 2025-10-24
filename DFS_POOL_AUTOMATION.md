# DFS Pool Automation Guide

## 🎯 Overview

Your DFS pools now automatically transition through their lifecycle using a **Cloudflare Worker** that runs every minute during game hours (6pm-1am ET).

## 📊 Pool Status Flow

```
scheduled → live → completed → finalized
```

### Status Transitions

| Status | When It Happens | What It Means |
|--------|----------------|---------------|
| **scheduled** | Pool is created | Games haven't started yet. Users can enter. |
| **live** | First game of slate starts | Pool is locked. No new entries. Scoring in progress. |
| **completed** | Last game of slate finishes | All games final. Final scoring begins. |
| **finalized** | Scoring complete | `finalized_at` timestamp set. Rankings finalized. |

## 🤖 Cloudflare Workers

### Worker 1: hoopgeek-live-stats

**Directory:** `cloudflare-worker/`
**File:** `update-live-stats.js`
**Schedule:** `* 18-23,0-1 * * *` (every minute, 6pm-1am ET)
**URL:** https://hoopgeek-live-stats.awcarv.workers.dev

**What It Does:**
- ✅ Fetches NBA scoreboard
- ✅ Processes LIVE games only (status = 2)
- ✅ Updates `live_player_stats` table
- ✅ Skips final games (handled by `nba_boxscores` via nightly import)

### Worker 2: hoopgeek-dfs

**Directory:** `cloudflare-worker-dfs/`
**File:** `update-dfs-pools.js`
**Schedule:** `*/5 18-23,0-1 * * *` (every 5 minutes, 6pm-1am ET)
**URL:** https://hoopgeek-dfs.awcarv.workers.dev

**What It Does:**
1. ✅ **Updates Pool Statuses**
   - Calls `update_dfs_pool_statuses()` database function
   - Transitions pools from `scheduled` → `live` → `completed`
   - Based on game statuses in `nba_games` table

2. ✅ **Finalizes Completed Pools**
   - Finds pools with `status = 'completed'` and `finalized_at IS NULL`
   - Calls `score_dfs_pool(pool_id)` to calculate final scores
   - Sets `finalized_at` timestamp
   - Rankings are locked

## 🗄️ Database Functions

### `update_dfs_pool_statuses()`

**File:** `supabase/migrations/update_dfs_pool_statuses_function.sql`

**Logic:**
```sql
-- scheduled → live: If ANY game in pool has started (game_status = 2 or 3)
-- live → completed: If ALL games in pool have finished (game_status = 3)
```

**Called by:** Cloudflare Worker

### `score_dfs_pool(p_pool_id UUID)`

**File:** `supabase/migrations/create_dfs_scoring_system.sql`

**What It Does:**
1. Calls `update_lineup_position_scores(pool_id)` - calculates player fantasy points
2. Calls `calculate_entry_scores(pool_id)` - sums weighted points for each entry
3. Calls `rank_pool_entries(pool_id)` - ranks entries by score

**Hybrid Scoring:**
- **Final games** (status = 3): Reads from `nba_boxscores` (authoritative)
- **Live games** (status = 2): Reads from `live_player_stats` (real-time)

**Called by:** Cloudflare Worker when pool is completed

## 🎨 Frontend Filtering

**File:** `src/components/DFS/UserStatsAndEntries.tsx`

**Logic:**
```typescript
// Upcoming Tab: status === 'scheduled'
const upcomingEntries = entries?.filter(entry => 
  entry.pool_status === 'scheduled'
);

// Live Tab: status === 'live'
const liveEntries = entries?.filter(entry => 
  entry.pool_status === 'live'
);

// Past Tab: status === 'completed' OR 'finalized'
const pastEntries = entries?.filter(entry => 
  entry.pool_status === 'completed' || entry.pool_status === 'finalized'
);
```

## 📋 Key Database Fields

### `dfs_pools` Table

| Field | Type | Purpose |
|-------|------|---------|
| `status` | TEXT | Current pool status (scheduled/live/completed/finalized) |
| `finalized_at` | TIMESTAMP | When scoring was finalized (NULL until finalization) |
| `lock_time` | TIMESTAMP | When pool locks for new entries |
| `start_time` | TIMESTAMP | When first game starts |
| `end_time` | TIMESTAMP | When last game is expected to end |

### `dfs_entries` Table

| Field | Type | Purpose |
|-------|------|---------|
| `final_points` | DECIMAL | Total fantasy points (set when pool finalizes) |
| `rank` | INTEGER | Entry's rank in pool (set when pool finalizes) |
| `final_rank` | INTEGER | Confirmed final rank (same as rank) |
| `percentile` | DECIMAL | Percentile ranking (0-100) |

## 🔄 Data Flow for Scoring

### Live Games (In Progress)
```
NBA API → Cloudflare Worker → live_player_stats → DFS Scoring
```

### Final Games (Completed)
```
NBA API → Python Import Script → nba_boxscores → DFS Scoring
```

**Python Script:** `scripts/setup/import_daily_boxscores.py`
- Run nightly at 3:30 AM EST via cron
- Imports final boxscores for yesterday's games
- Usage: `python3 import_daily_boxscores.py [YYYY-MM-DD]`

## 🚀 Manual Operations

### Test Workers
```bash
# Test live stats worker
curl https://hoopgeek-live-stats.awcarv.workers.dev

# Test DFS worker (pool status updates + finalization)
curl https://hoopgeek-dfs.awcarv.workers.dev
```

### View Worker Logs
```bash
# Live stats worker logs
cd cloudflare-worker
npx wrangler tail hoopgeek-live-stats

# DFS worker logs
cd cloudflare-worker-dfs
npx wrangler tail hoopgeek-dfs
```

### Manually Finalize a Pool
```sql
-- Score and rank entries
SELECT * FROM score_dfs_pool('pool_id_here');

-- Mark as finalized
UPDATE dfs_pools 
SET finalized_at = NOW() 
WHERE id = 'pool_id_here';
```

### Check Pool Status
```sql
SELECT 
  p.name,
  p.status,
  p.finalized_at,
  COUNT(pg.game_id) as total_games,
  COUNT(CASE WHEN g.game_status = 2 THEN 1 END) as live_games,
  COUNT(CASE WHEN g.game_status = 3 THEN 1 END) as final_games,
  COUNT(e.id) as total_entries
FROM dfs_pools p
LEFT JOIN dfs_pool_games pg ON p.id = pg.pool_id
LEFT JOIN nba_games g ON pg.game_id = g.game_id
LEFT JOIN dfs_entries e ON p.id = e.pool_id
WHERE p.id = 'pool_id_here'
GROUP BY p.id, p.name, p.status, p.finalized_at;
```

## 🎯 User Experience

### When Creating Entry
- ✅ Pool shows as "Upcoming" until first game starts
- ✅ Can enter/edit lineup until `lock_time`

### When Games Start
- ✅ Pool automatically transitions to "Live"
- ✅ Entry moves to "Live" tab
- ✅ Shows live scoring (updates every minute)

### When Games Finish
- ✅ Pool automatically transitions to "Completed"
- ✅ Worker finalizes pool (scores + ranks)
- ✅ Entry moves to "Past" tab
- ✅ Shows final score and rank

## 📝 Notes

- **Cron Schedule**: Worker only runs during typical NBA game hours (6pm-1am ET)
- **Manual Import**: Boxscores are imported via Python script (run nightly)
- **Hybrid Scoring**: Live games use API data, final games use database boxscores
- **Automatic**: No manual intervention needed for status transitions
- **Fallback**: If worker fails, pools can be manually finalized via SQL

## 🔍 Troubleshooting

### Pool stuck in "scheduled" when games are live?
```sql
-- Check game statuses
SELECT g.game_id, g.game_status, g.game_status_text
FROM dfs_pool_games pg
JOIN nba_games g ON pg.game_id = g.game_id
WHERE pg.pool_id = 'your_pool_id';

-- Manually trigger status update
SELECT * FROM update_dfs_pool_statuses();
```

### Pool stuck in "live" when games are finished?
```sql
-- Check if all games are final
SELECT 
  COUNT(*) as total_games,
  COUNT(CASE WHEN g.game_status = 3 THEN 1 END) as final_games
FROM dfs_pool_games pg
JOIN nba_games g ON pg.game_id = g.game_id
WHERE pg.pool_id = 'your_pool_id';

-- Manually trigger status update
SELECT * FROM update_dfs_pool_statuses();
```

### Entries not scoring correctly?
```sql
-- Check hybrid scoring function
SELECT * FROM update_lineup_position_scores('your_pool_id');

-- Check if boxscores exist for final games
SELECT g.game_id, g.game_status, COUNT(bs.nba_player_id) as players_with_boxscores
FROM dfs_pool_games pg
JOIN nba_games g ON pg.game_id = g.game_id
LEFT JOIN nba_boxscores bs ON bs.game_id = g.game_id
WHERE pg.pool_id = 'your_pool_id'
GROUP BY g.game_id, g.game_status;
```

