# Cloudflare Workers Architecture

## 🎯 Overview

The HoopGeek platform uses **three separate Cloudflare Workers** following the Single Responsibility Principle. Each worker has a specific job and runs on its own schedule.

## 📊 Worker Breakdown

### 1. hoopgeek-live-stats ✅ DEPLOYED

**Purpose:** Real-time NBA player stats during live games

**Directory:** `cloudflare-worker/`

**Schedule:** Every minute during game hours
```
* 18-23,0-1 * * *
```

**Responsibilities:**
- Fetch NBA scoreboard
- Process LIVE games only (status = 2)
- Update `live_player_stats` table
- Skip final games (handled by nightly import)

**URL:** https://hoopgeek-live-stats.awcarv.workers.dev

**Test:**
```bash
curl https://hoopgeek-live-stats.awcarv.workers.dev
```

---

### 2. hoopgeek-dfs ✅ DEPLOYED

**Purpose:** DFS pool lifecycle management

**Directory:** `cloudflare-worker-dfs/`

**Schedule:** Every 5 minutes during game hours
```
*/5 18-23,0-1 * * *
```

**Responsibilities:**
- Update pool statuses (scheduled → live → completed)
- Finalize completed pools (scoring + ranking)
- Set `finalized_at` timestamp

**URL:** https://hoopgeek-dfs.awcarv.workers.dev

**Test:**
```bash
curl https://hoopgeek-dfs.awcarv.workers.dev
```

---

### 3. hoopgeek-fantasy 🚧 FUTURE

**Purpose:** Fantasy league management

**Directory:** `cloudflare-worker-fantasy/` (not yet created)

**Schedule:** Specific times for different tasks
```
# Waiver processing
30 3 * * WED

# Weekly advancement
0 0 * * MON

# Daily standings
0 4 * * *
```

**Responsibilities:**
- Process waiver claims (Wednesday 3:30 AM)
- Advance matchup weeks (Monday 12:00 AM)
- Update league standings (Daily 4:00 AM)
- Send weekly recaps (Monday 9:00 AM)

---

## 🏗️ Architecture Benefits

### ✅ Single Responsibility
Each worker does ONE thing well. Easy to understand and maintain.

### ✅ Independent Schedules
Different frequencies for different needs:
- Live stats: Every minute (high frequency)
- DFS: Every 5 minutes (medium frequency)
- Fantasy: Specific times (low frequency)

### ✅ Fault Isolation
If one worker fails, others continue working. DFS pools can still finalize even if live stats is down.

### ✅ Independent Deployment
Deploy/test each worker separately without affecting others.

### ✅ Clear Logs
Know exactly where to look when debugging. Each worker has its own log stream.

### ✅ Easy Scaling
Adjust timeout/CPU limits per worker based on needs.

---

## 🔄 Data Flow

### Live Games
```
NBA API → live-stats worker → live_player_stats → DFS scoring
```

### Final Games
```
NBA API → Python import script → nba_boxscores → DFS scoring
```

### Pool Lifecycle
```
DFS worker → update_dfs_pool_statuses() → scheduled/live/completed
DFS worker → score_dfs_pool() → finalized_at set
```

---

## 🚀 Deployment

### Initial Setup (per worker)
```bash
cd [worker-directory]
npx wrangler login
echo "https://qbznyaimnrpibmahisue.supabase.co" | npx wrangler secret put SUPABASE_URL
echo "[service-role-key]" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
```

### Update Existing Worker
```bash
cd [worker-directory]
npx wrangler deploy
```

---

## 📊 Monitoring

### Check Worker Status
```bash
# View live-stats logs
cd cloudflare-worker
npx wrangler tail hoopgeek-live-stats

# View DFS logs
cd cloudflare-worker-dfs
npx wrangler tail hoopgeek-dfs
```

### Manual Trigger
```bash
# Trigger live-stats
curl https://hoopgeek-live-stats.awcarv.workers.dev

# Trigger DFS
curl https://hoopgeek-dfs.awcarv.workers.dev
```

---

## 🎯 When to Create New Workers

Create a new worker when:
1. **Different schedule needed** - New functionality runs at different frequency
2. **Different responsibility** - New functionality is conceptually separate
3. **Independent scaling** - New functionality has different resource needs
4. **Fault isolation desired** - Failure shouldn't affect other systems

Don't create a new worker when:
1. Functionality is tightly coupled to existing worker
2. Same schedule and responsibilities
3. Just a helper function for existing worker

---

## 📝 Best Practices

### ✅ DO
- Keep workers focused on ONE job
- Use clear, descriptive names
- Document what each worker does
- Set appropriate schedules
- Handle errors gracefully
- Log important events

### ❌ DON'T
- Mix unrelated responsibilities
- Run expensive operations too frequently
- Deploy without testing
- Forget to set secrets
- Ignore errors silently

---

## 🔮 Future Workers

Other potential workers:
- **hoopgeek-notifications**: Send email/SMS alerts
- **hoopgeek-analytics**: Calculate platform statistics
- **hoopgeek-cleanup**: Archive old data, clean up expired sessions
- **hoopgeek-health**: Monitor system health, alert on issues

---

## 📚 Related Documentation

- [DFS_POOL_AUTOMATION.md](./DFS_POOL_AUTOMATION.md) - Complete DFS automation guide
- [cloudflare-worker/README.md](./cloudflare-worker/README.md) - Live stats worker details
- [cloudflare-worker-dfs/README.md](./cloudflare-worker-dfs/README.md) - DFS worker details

