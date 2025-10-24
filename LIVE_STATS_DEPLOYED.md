# ✅ Live Stats System - DEPLOYED & WORKING

**Status:** 🟢 FULLY OPERATIONAL

---

## 🎉 What's Running

### Cloudflare Worker
- **URL:** https://hoopgeek-live-stats.awcarv.workers.dev
- **Schedule:** Every minute, 6 PM - 1 AM ET
- **Status:** Active ✅
- **Cost:** $0/month (free tier)

### Supabase Database
- **Table:** `live_player_stats`
- **Helper Functions:** `get_live_player_stats()`, `get_game_live_stats()`, `get_lineup_live_stats()`
- **Status:** Receiving data ✅

### Current Data
- ✅ 10+ players with live stats
- ✅ 2 games being tracked
- ✅ Last updated: Today

---

## 📱 Frontend Integration

### Option 1: Simple Query (No Real-Time)

```typescript
import { supabase } from '@/lib/supabaseClient';
import { calculateFantasyPoints, FANDUEL_SCORING } from '@/utils/fantasyScoring';

// Get live stats for a single player
async function getPlayerLiveStats(gameId: string, nbaPlayerId: number) {
  const { data } = await supabase
    .from('live_player_stats')
    .select('*')
    .eq('game_id', gameId)
    .eq('nba_player_id', nbaPlayerId)
    .single();

  if (!data) return null;

  return {
    ...data,
    fantasyPoints: calculateFantasyPoints(data.stats, FANDUEL_SCORING)
  };
}

// Usage
const stats = await getPlayerLiveStats('0022500001', 2544); // LeBron
console.log(`${stats.player_name}: ${stats.fantasyPoints} FD points`);
```

### Option 2: Real-Time Subscription (Updates Automatically)

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { calculateFantasyPoints, FANDUEL_SCORING } from '@/utils/fantasyScoring';

function LivePlayerCard({ gameId, nbaPlayerId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Fetch initial data
    const fetchStats = async () => {
      const { data } = await supabase
        .from('live_player_stats')
        .select('*')
        .eq('game_id', gameId)
        .eq('nba_player_id', nbaPlayerId)
        .single();
      
      if (data) setStats(data);
    };

    fetchStats();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`game_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_player_stats',
          filter: `game_id=eq.${gameId}`
        },
        (payload) => {
          if (payload.new.nba_player_id === nbaPlayerId) {
            setStats(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, nbaPlayerId]);

  if (!stats) return <div>Loading...</div>;

  const fantasyPoints = calculateFantasyPoints(stats.stats, FANDUEL_SCORING);

  return (
    <div className="player-card">
      <h3>{stats.player_name}</h3>
      <p>Team: {stats.team_tricode}</p>
      <p>Points: {stats.stats.pts}</p>
      <p>Rebounds: {stats.stats.reb}</p>
      <p>Assists: {stats.stats.ast}</p>
      <p className="fantasy-points">Fantasy: {fantasyPoints} pts</p>
      <small>Updated: {new Date(stats.updated_at).toLocaleTimeString()}</small>
    </div>
  );
}
```

### Option 3: DFS Lineup Tracker

```typescript
// Track entire DFS lineup in real-time
function DFSLineupTracker({ lineup }) {
  const [liveStats, setLiveStats] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    // Fetch live stats for all players in lineup
    const fetchLineupStats = async () => {
      const { data } = await supabase
        .rpc('get_lineup_live_stats', { 
          p_player_games: lineup // [{nba_player_id: 2544, game_id: '0022500001'}, ...]
        });

      if (data) {
        const withFantasyPoints = data.map(player => ({
          ...player,
          fantasyPoints: calculateFantasyPoints(player.stats, FANDUEL_SCORING)
        }));
        
        setLiveStats(withFantasyPoints);
        setTotalPoints(withFantasyPoints.reduce((sum, p) => sum + p.fantasyPoints, 0));
      }
    };

    fetchLineupStats();

    // Refresh every 30 seconds (or use real-time subscription)
    const interval = setInterval(fetchLineupStats, 30000);

    return () => clearInterval(interval);
  }, [lineup]);

  return (
    <div className="lineup-tracker">
      <h2>Your DFS Lineup</h2>
      <h3 className="total-points">Total: {totalPoints.toFixed(2)} FD Points</h3>
      
      {liveStats.map(player => (
        <div key={player.nba_player_id} className="player-row">
          <span>{player.player_name} ({player.team_tricode})</span>
          <span>{player.stats.pts} pts, {player.stats.reb} reb, {player.stats.ast} ast</span>
          <span className="fantasy-points">{player.fantasyPoints.toFixed(2)} FD</span>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔍 Monitoring & Debugging

### View Live Logs
```bash
cd /Users/adam/Desktop/hoopgeek/cloudflare-worker
npx wrangler tail
```

**You'll see:**
```
2025-10-22 20:00:00 🏀 Cron triggered - Starting live stats update...
2025-10-22 20:00:00 📊 Found 12 games today
2025-10-22 20:00:00 🎮 5 games are live or just finished
2025-10-22 20:00:03 ✅ Game 0022500123: 10 players updated
2025-10-22 20:00:04 ✅ Game 0022500124: 10 players updated
2025-10-22 20:00:05 ✅ Cron completed: { playersUpdated: 127 }
```

### Check Database Directly
```sql
-- In Supabase SQL Editor

-- Get most recent player stats
SELECT 
  player_name,
  team_tricode,
  stats->>'pts' as points,
  stats->>'reb' as rebounds,
  stats->>'ast' as assists,
  updated_at
FROM live_player_stats
ORDER BY updated_at DESC
LIMIT 10;

-- See how many players tracked per game
SELECT 
  game_id,
  COUNT(*) as player_count,
  MAX(updated_at) as last_updated
FROM live_player_stats
GROUP BY game_id
ORDER BY last_updated DESC;

-- Check worker execution history
SELECT * FROM live_stats_updates
ORDER BY last_updated DESC
LIMIT 10;
```

### Test Worker Manually
```bash
# Trigger worker outside cron schedule
curl https://hoopgeek-live-stats.awcarv.workers.dev
```

---

## 📊 Database Schema

### `live_player_stats` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `game_id` | VARCHAR(50) | FK to `nba_games` |
| `nba_player_id` | INTEGER | FK to `nba_players` |
| `player_name` | TEXT | Player name |
| `team_tricode` | VARCHAR(10) | "LAL", "GSW", etc. |
| `stats` | JSONB | **Raw stats** (pts, reb, ast, etc.) |
| `updated_at` | TIMESTAMPTZ | Last update time |

### `stats` JSONB Structure

Matches your `fantasyScoring.ts` `PlayerGameLog` interface exactly:

```json
{
  "pts": 24,
  "reb": 8,
  "ast": 5,
  "stl": 2,
  "blk": 1,
  "tov": 3,
  "fgm": 9,
  "fga": 18,
  "fg_pct": 0.50,
  "fg3m": 2,
  "fg3a": 6,
  "fg3_pct": 0.333,
  "ftm": 4,
  "fta": 5,
  "ft_pct": 0.80,
  "oreb": 2,
  "dreb": 6,
  "pf": 3,
  "min": 32,
  "plus_minus": 8
}
```

### Helper Functions

```typescript
// Get single player stats
const { data } = await supabase.rpc('get_live_player_stats', {
  p_game_id: '0022500001',
  p_nba_player_id: 2544
});

// Get all players in a game
const { data } = await supabase.rpc('get_game_live_stats', {
  p_game_id: '0022500001'
});

// Get multiple players (DFS lineup)
const { data } = await supabase.rpc('get_lineup_live_stats', {
  p_player_games: [
    { nba_player_id: 2544, game_id: '0022500001' },
    { nba_player_id: 201939, game_id: '0022500002' }
  ]
});
```

---

## 🗓️ Typical Game Day Flow

**5:00 PM ET** - Worker not running yet

**6:00 PM ET** - Cron starts, checks scoreboard, no games yet

**7:00 PM ET** - First games start, worker begins tracking

**7:30 PM ET** - More games start, worker tracking 8 games

**8:00 PM ET** - Peak time, 12 games active

**10:30 PM ET** - Early games finishing, late games starting

**12:00 AM ET** - Most games done, 1-2 still active

**1:00 AM ET** - Last West Coast games finish

**1:01 AM ET** - Cron stops running until tomorrow

---

## 💰 Cost & Usage

### Cloudflare Workers
- **Free tier:** 100,000 requests/day
- **Your usage:** ~7,000 requests/day (60/hr × 7 hrs)
- **Cost:** $0/month ✅

### Supabase
- **Database storage:** ~1-2 MB per game day
- **Season total:** ~100 MB
- **API requests:** Covered by your plan
- **Cost:** $0 additional ✅

**Total: $0/month** 🎉

---

## 🛡️ Security & Performance

✅ **Secrets stored securely** - In Cloudflare, not in code  
✅ **RLS policies enabled** - Public can read, only service role can write  
✅ **Indexes optimized** - Fast queries on game_id, player_id, updated_at  
✅ **Foreign keys enforced** - Data integrity guaranteed  
✅ **Idempotent upserts** - Safe to run multiple times  
✅ **Error handling** - Worker continues even if one game fails  

---

## 🔄 Maintenance

### Update Worker Code
1. Edit `cloudflare-worker/update-live-stats.js`
2. Run: `npx wrangler deploy`

### Change Cron Schedule
1. Edit `cloudflare-worker/wrangler.toml`
2. Change `crons` line
3. Run: `npx wrangler deploy`

### Clean Up Old Data
```sql
-- Run in Supabase SQL Editor weekly
SELECT cleanup_old_live_stats();  -- Removes stats older than 7 days
```

---

## 🎯 Next Steps for Your App

1. **Add to `/dfs/` page:**
   - Real-time lineup score tracker
   - Live leaderboard
   - Player performance indicators

2. **Add to `/fantasy/` page:**
   - Weekly player tracker
   - Live game scores
   - Lineup optimization suggestions

3. **Add notifications:**
   - Alert when lineup reaches certain score
   - Notify on player injury/exit
   - Celebrate milestones (double-double, etc.)

4. **Add analytics:**
   - Track which players perform best
   - Identify value picks
   - Season-long trends

---

## 📞 Need Help?

### Worker Issues
```bash
cd /Users/adam/Desktop/hoopgeek/cloudflare-worker
npx wrangler tail  # View live logs
```

### Database Issues
- Check Supabase logs: https://supabase.com/dashboard/project/qbznyaimnrpibmahisue/logs
- Query directly in SQL Editor

### Frontend Integration
- Check browser console for errors
- Verify Supabase client initialized correctly
- Test queries in Supabase API docs

---

## ✨ You're All Set!

Your live stats system is **production-ready** and already tracking games! 🎉

The worker will automatically:
- Run during NBA game hours
- Fetch live stats every minute
- Store raw data in Supabase
- Handle errors gracefully
- Cost you $0/month

Your frontend can:
- Query live stats anytime
- Subscribe to real-time updates
- Calculate fantasy points using `fantasyScoring.ts`
- Display live scores to users

**Everything is working perfectly!** 🚀

