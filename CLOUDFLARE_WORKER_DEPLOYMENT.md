# 🚀 Cloudflare Worker Deployment Guide - Live NBA Stats

Perfect! You're already on Cloudflare, so this is the **BEST** solution for you.

---

## ✅ Why Cloudflare Workers is Perfect for This

- ✅ **You already have it** - No new accounts needed
- ✅ **Free tier is generous** - 100,000 requests/day (you'll use ~7,000/day)
- ✅ **Cron triggers included** - Free, reliable scheduling
- ✅ **Fast execution** - No cold starts like Supabase Edge Functions
- ✅ **Global edge network** - Low latency
- ✅ **Easy to deploy** - One command
- ✅ **Easy to monitor** - Built-in dashboard

---

## 📋 Prerequisites

1. ✅ Cloudflare account (you have this)
2. ✅ Supabase account (you have this)
3. ✅ Node.js installed (you have this)

---

## 🛠️ One-Time Setup (10 minutes)

### Step 1: Install Wrangler CLI

```bash
cd /Users/adam/Desktop/hoopgeek
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

This will open a browser window. Click "Allow" to authorize Wrangler.

---

### Step 2: Deploy the SQL Table to Supabase

Open Supabase SQL Editor and run:
```sql
-- Paste contents of: CREATE_LIVE_PLAYER_STATS_TABLE.sql
```

**This creates:**
- `live_player_stats` table (with foreign keys to nba_players, nba_games)
- `live_stats_updates` marker table
- Indexes for fast queries
- Helper functions
- RLS policies

---

### Step 3: Set Environment Variables

```bash
cd /Users/adam/Desktop/hoopgeek/cloudflare-worker

# Set Supabase URL
wrangler secret put SUPABASE_URL
# When prompted, paste: https://qbznyaimnrpibmahisue.supabase.co

# Set Supabase Service Role Key
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# When prompted, paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw
```

---

### Step 4: Deploy the Worker

```bash
cd /Users/adam/Desktop/hoopgeek/cloudflare-worker

# Deploy!
wrangler deploy
```

**Output:**
```
✨ Compiled Worker successfully
🌍 Uploading... Done!
✨ Deployment complete!
🌐 https://hoopgeek-live-stats.YOUR-SUBDOMAIN.workers.dev
```

---

## 🎉 That's It! Your Worker is Now Running

The worker will automatically:
- ✅ Run every minute from 6 PM to 1 AM ET (NBA game hours)
- ✅ Check for live games
- ✅ Fetch box scores for active games
- ✅ Store raw stats in `live_player_stats` table
- ✅ Skip execution when no games are live (saves resources)

---

## 🧪 Testing

### Test Manually (Right Now)

```bash
# Get your worker URL from the deploy output, then:
curl https://hoopgeek-live-stats.YOUR-SUBDOMAIN.workers.dev
```

**Or test in browser:**
Just visit your worker URL in a browser.

**Expected response (when no games are live):**
```json
{
  "success": true,
  "message": "No live games right now",
  "gamesProcessed": 0,
  "playersUpdated": 0,
  "duration": "342ms",
  "timestamp": "2025-10-22T20:15:00.000Z"
}
```

**Expected response (during games):**
```json
{
  "success": true,
  "message": "Updated 287 players from 12 games",
  "gamesProcessed": 12,
  "playersUpdated": 287,
  "duration": "4523ms",
  "timestamp": "2025-10-22T20:15:00.000Z"
}
```

---

## 📊 Monitoring

### View Logs in Real-Time

```bash
wrangler tail
```

This shows live logs as your worker runs.

### View in Dashboard

1. Go to: https://dash.cloudflare.com
2. Click "Workers & Pages"
3. Click "hoopgeek-live-stats"
4. Click "Logs" tab

**You'll see:**
- 🏀 Cron triggered logs
- 📊 Games found/processed
- ✅ Success messages
- ❌ Any errors

---

## 🔄 How the Cron Schedule Works

```toml
crons = ["* 18-23,0-1 * * *"]
```

**Translation:**
- `*` = Every minute
- `18-23,0-1` = Hours 6 PM to 11 PM, and 12 AM to 1 AM (ET)
- `* * *` = Every day, every month, every day of week

**Why these hours?**
- NBA games typically start between 7 PM - 10:30 PM ET
- Games last ~2.5 hours
- Covers all regular season games
- West Coast games (10:30 PM ET start) finish by 1 AM ET

**When no games are live:**
- Worker runs, checks scoreboard, finds 0 live games
- Returns immediately (fast, no API calls wasted)
- Costs virtually nothing

---

## 💰 Cost Breakdown

### Cloudflare Workers Free Tier:
- 100,000 requests/day
- Unlimited cron triggers
- **Your usage:** ~7,000 cron triggers/day during season
- **Cost:** $0/month ✅

### If You Exceed Free Tier (unlikely):
- Workers Paid: $5/month for first 10 million requests
- **You won't hit this** unless you have millions of manual API calls

### Total Cost: **$0/month** 🎉

---

## 🎮 Frontend Integration

Your frontend can now fetch live stats:

```typescript
// In your /dfs/ or /fantasy/ page

import { supabase } from './supabaseClient';

// Get live stats for a specific player in a game
async function getLivePlayerStats(gameId: string, nbaPlayerId: number) {
  const { data, error } = await supabase
    .from('live_player_stats')
    .select('*')
    .eq('game_id', gameId)
    .eq('nba_player_id', nbaPlayerId)
    .single();
  
  if (error) return null;
  return data;
}

// Get all live stats for a game
async function getGameLiveStats(gameId: string) {
  const { data, error } = await supabase
    .from('live_player_stats')
    .select('*')
    .eq('game_id', gameId)
    .order('team_tricode', { ascending: true });
  
  return data || [];
}

// Get live stats for multiple players (DFS lineup)
async function getLineupLiveStats(playerGames: Array<{nba_player_id: number, game_id: string}>) {
  const { data, error } = await supabase
    .rpc('get_lineup_live_stats', { 
      p_player_games: playerGames 
    });
  
  return data || [];
}

// Calculate fantasy points using your utility
import { calculateFantasyPoints, FANDUEL_SCORING } from '@/utils/fantasyScoring';

const liveStats = await getLivePlayerStats('0022500123', 2544);
if (liveStats) {
  // Raw stats stored by worker
  const stats = liveStats.stats;
  
  // Calculate fantasy points on frontend
  const fantasyPoints = calculateFantasyPoints(stats, FANDUEL_SCORING);
  
  console.log(`${liveStats.player_name}: ${fantasyPoints} FD points`);
}
```

---

## 🔧 Configuration Changes

### Change Cron Schedule

Edit `wrangler.toml`:
```toml
# Run every 2 minutes instead of every minute
crons = ["*/2 18-23,0-1 * * *"]

# Or run 24/7 (not recommended, wastes resources)
crons = ["* * * * *"]
```

Then redeploy:
```bash
wrangler deploy
```

### Update Environment Variables

```bash
wrangler secret put SUPABASE_URL
# Or
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

---

## 🐛 Troubleshooting

### Worker Not Running?

**Check cron status:**
```bash
wrangler deployments list
```

**Check logs:**
```bash
wrangler tail
```

### No Data in Database?

**Check Supabase table exists:**
```sql
SELECT * FROM live_player_stats LIMIT 10;
```

**Check RLS policies:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'live_player_stats';
```

### Worker Timing Out?

**Check worker logs for errors:**
```bash
wrangler tail
```

**Common causes:**
- Supabase credentials incorrect
- NBA API temporarily down
- Database connection issues

### Still Having Issues?

**View detailed logs:**
1. Go to Cloudflare Dashboard
2. Workers & Pages → hoopgeek-live-stats
3. Logs tab
4. Look for error messages

---

## 🚀 Next Steps

1. ✅ **Deploy SQL table** - Run `CREATE_LIVE_PLAYER_STATS_TABLE.sql` in Supabase
2. ✅ **Deploy worker** - Run `wrangler deploy`
3. ✅ **Test manually** - Visit worker URL
4. ✅ **Monitor logs** - Run `wrangler tail`
5. ✅ **Integrate frontend** - Fetch from `live_player_stats` table
6. ✅ **Calculate fantasy points** - Use your `fantasyScoring.ts` utility

---

## 📈 What Happens During a Game Night

**6:00 PM ET:**
- Cron triggers worker
- Worker checks NBA scoreboard
- No games started yet
- Returns in ~200ms

**7:00 PM ET:**
- Cron triggers worker
- Finds 5 games live
- Fetches box scores for all 5 games
- Updates 127 players in database
- Returns in ~3 seconds

**7:01 PM ET:**
- Cron triggers again
- Updates same 5 games with new stats
- Only updates players whose stats changed
- Returns in ~2 seconds

**8:00 PM ET:**
- 7 more games started (12 total)
- Updates 287 players across 12 games
- Returns in ~5 seconds

**10:30 PM ET:**
- First games finishing
- Some games status = 3 (final)
- Still updates final stats (for late entries)
- Returns in ~4 seconds

**1:00 AM ET:**
- All games finished
- Worker checks scoreboard
- Finds 0 live games
- Returns immediately (~200ms)

**1:01 AM ET - 5:59 PM ET:**
- Worker NOT running (cron schedule)
- Saves resources
- No cost incurred

---

## 🎉 You're All Set!

Your live stats system is now:
- ✅ Running automatically during games
- ✅ Storing raw stats in Supabase
- ✅ Ready for frontend to calculate fantasy points
- ✅ Costing $0/month
- ✅ Fully managed by Cloudflare

**No VPS needed!**  
**No Edge Functions timeouts!**  
**Just works!** 🚀

