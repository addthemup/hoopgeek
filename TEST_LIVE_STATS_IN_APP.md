# Test Live Stats in Your App

## ✅ Worker Status
- **Deployed:** Yes ✅
- **URL:** https://hoopgeek-live-stats.awcarv.workers.dev
- **Schedule:** Every minute from 11 PM UTC - 10 AM UTC (6 PM ET - 5 AM ET)
- **Last Test:** Just ran successfully - updated 18 players from 2 live games

## 🧪 Testing Steps

### 1. Verify Database Has Fresh Data

Run this in Supabase SQL Editor:
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
```

You should see:
- ✅ Players with stats from tonight's games
- ✅ `updated_at` timestamps within the last few minutes
- ✅ Non-zero points, rebounds, assists

### 2. Test in Your DFS App

1. **Open your app** and navigate to a DFS pool
2. **View an entry** - Click on any submitted entry to see the lineup
3. **Check for loading indicator** - You should see "Loading entry details..." briefly
4. **Check for live scores** - Player tables should show current fantasy points
5. **Wait 30 seconds** - Scores should auto-refresh (if pool status is 'live')

### 3. Check Browser Console

Open DevTools (F12) and look for these logs:
```
🔍 Fetching leaderboard for pool: [pool-id] status: live
📝 Entry [entry-id] lineup positions: [number] players
✅ Entry [entry-id] total score: [score]
```

### 4. Verify Real-Time Updates

The app subscribes to live_player_stats changes:
- Updates happen every minute via the worker
- Frontend auto-refreshes every 30 seconds (if pool is live)
- Supabase Realtime pushes changes immediately

## 🐛 Troubleshooting

### Problem: "No live scores showing"

**Check 1: Pool Status**
```sql
SELECT id, name, status, slate_date 
FROM dfs_pools 
WHERE id = 'YOUR_POOL_ID';
```
- Status should be `'live'` not `'scheduled'` or `'completed'`
- Pool won't auto-update to live until games start (handled by DFS worker every 5 minutes)

**Check 2: Live Stats Data**
```sql
SELECT COUNT(*) FROM live_player_stats 
WHERE DATE(updated_at) = CURRENT_DATE;
```
- Should return > 0 if games are currently playing

**Check 3: Player IDs Match**
```sql
-- Check if your DFS lineup players have matching live stats
SELECT 
  lp.player_name,
  lp.nba_player_id,
  CASE 
    WHEN ls.id IS NOT NULL THEN 'Has live stats ✅'
    ELSE 'No live stats ❌'
  END as status
FROM dfs_lineup_positions lp
LEFT JOIN live_player_stats ls ON ls.nba_player_id = lp.nba_player_id
WHERE lp.lineup_id = 'YOUR_LINEUP_ID';
```

### Problem: "Loading indicator doesn't show"

Check the component in your browser DevTools:
- `leaderboardLoading` should be `true` initially
- `selectedEntry` should be `null` or `undefined` while loading
- Loading state should show for ~1-2 seconds

### Problem: "Stats are from last night"

**Likely causes:**
1. Current time is outside game hours (6 PM - 5 AM ET)
2. No games are currently live (check NBA schedule)
3. Worker hasn't run yet (wait 1 minute for next cron)

**Manual fix:**
```bash
# Trigger worker immediately
curl https://hoopgeek-live-stats.awcarv.workers.dev
```

## 📊 Monitor Worker Logs

```bash
cd /Users/adam/Desktop/hoopgeek/cloudflare-worker
npx wrangler tail hoopgeek-live-stats
```

You'll see:
```
🏀 Cron triggered - Starting live stats update...
📊 Found 14 games today
🎮 2 games are LIVE (ignoring final games)
📊 Processing 18 players for LIVE game 0022500123
✅ Updated 18 players for game 0022500123
✅ Cron completed: { success: true, message: "Updated 18 players from 2 live games", ... }
```

## 🎯 Expected Behavior

**When games are LIVE:**
- Worker runs every minute
- Updates 10-20 players per game
- Frontend shows real-time scores
- Scores update automatically

**When NO games are live:**
- Worker runs but finds 0 live games
- Returns: `{ gamesProcessed: 0, playersUpdated: 0 }`
- Frontend shows last known stats (may be from previous games)

## ✅ Success Criteria

You'll know it's working when:
1. ✅ Loading indicator appears when clicking entry details
2. ✅ Player tables show live fantasy points (not 0.0)
3. ✅ Scores update every 30-60 seconds during games
4. ✅ Browser console shows successful leaderboard fetches
5. ✅ SQL query shows fresh data (updated_at within last few minutes)

