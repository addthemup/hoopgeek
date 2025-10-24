# 🚀 Live Stats Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR SETUP                            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Server/VPS (Python Cron)        Supabase (pg_cron)     │
│  ├─ Live stats updates    ──┐    ├─ Database cleanup    │
│  │  Every 60 seconds         │    │  Daily at 6 AM       │
│  │  During games only        │    ├─ Archive old pools   │
│  └─ Fetches NBA API      ────┼───▶│  Daily at 7 AM       │
│                               │    └─ Weekly resets       │
│                               │       Sundays 11:59 PM    │
│                               │                           │
│  Frontend (React/TypeScript)  │                           │
│  ├─ Fetches live_player_stats │                          │
│  ├─ Uses fantasyScoring.ts ◀──┘                          │
│  └─ Calculates live scores                               │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Recommended Setup: Hybrid Approach

### Why Hybrid?
- ✅ **Python on server**: Best for NBA API calls (mature library, easy to work with)
- ✅ **Supabase pg_cron**: Perfect for database maintenance tasks
- ✅ **Cost-effective**: Cheap VPS + free Supabase features
- ✅ **Reliable**: Each component does what it's best at

---

## 📋 Step-by-Step Deployment

### 1️⃣ Deploy Database Schema

In Supabase SQL Editor, run these files in order:

```sql
-- 1. Create live tracking tables and functions
DEPLOY_LIVE_FANTASY_TRACKING.sql

-- 2. Set up maintenance cron jobs
SETUP_SUPABASE_CRON_MAINTENANCE.sql
```

### 2️⃣ Choose Your Server Option

#### Option A: Cheap VPS (Recommended)

**DigitalOcean Droplet** ($6/month)
```bash
# 1. Create a droplet (Ubuntu 22.04)
# 2. SSH into it
ssh root@your-droplet-ip

# 3. Install dependencies
apt update
apt install -y python3 python3-pip git

# 4. Clone your repo
cd /opt
git clone https://github.com/yourusername/hoopgeek.git
cd hoopgeek

# 5. Install Python packages
pip3 install nba-api supabase

# 6. Set up environment variables
cat > /opt/hoopgeek/.env << EOF
VITE_SUPABASE_URL=https://qbznyaimnrpibmahisue.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
EOF

# 7. Create logs directory
mkdir -p /opt/hoopgeek/logs

# 8. Set up cron job
crontab -e

# Add these lines (runs every minute during game times):
* 18-23 * * * cd /opt/hoopgeek && export $(cat .env | xargs) && python3 scripts/setup/update_live_fantasy_scores.py >> logs/live_tracking.log 2>&1
* 0-1 * * * cd /opt/hoopgeek && export $(cat .env | xargs) && python3 scripts/setup/update_live_fantasy_scores.py >> logs/live_tracking.log 2>&1

# 9. Test it manually
cd /opt/hoopgeek
export $(cat .env | xargs)
python3 scripts/setup/update_live_fantasy_scores.py
```

#### Option B: AWS EC2 (Free Tier for 1 Year)

```bash
# 1. Launch EC2 t3.micro instance (free tier)
# 2. Follow same steps as DigitalOcean above
# 3. Configure security group (no inbound ports needed)
```

#### Option C: Fly.io (Has Free Tier)

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Create Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "scripts/setup/update_live_fantasy_scores.py"]
EOF

# 3. Create fly.toml
fly launch

# 4. Deploy
fly deploy
```

#### Option D: Your Local Machine (Free, if always on)

```bash
# Just run the setup script we already created
bash scripts/setup/setup_live_tracking_cron.sh

# Then add to crontab
crontab -e
# (follow instructions from setup script)
```

### 3️⃣ Verify It's Working

```bash
# Check logs
tail -f /opt/hoopgeek/logs/live_tracking.log

# You should see:
# ✅ Found X active games
# ✅ Updated Y players
```

### 4️⃣ Monitor the System

Create a simple monitoring script:

```bash
# /opt/hoopgeek/scripts/check_health.sh
#!/bin/bash

LOG_FILE="/opt/hoopgeek/logs/live_tracking.log"
LAST_RUN=$(tail -1 "$LOG_FILE" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}')

if [ -z "$LAST_RUN" ]; then
    echo "❌ No recent runs found"
    exit 1
fi

# Check if last run was within last 5 minutes
LAST_TIMESTAMP=$(date -d "$LAST_RUN" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S" "$LAST_RUN" +%s)
CURRENT_TIMESTAMP=$(date +%s)
DIFF=$((CURRENT_TIMESTAMP - LAST_TIMESTAMP))

if [ $DIFF -gt 300 ]; then
    echo "❌ Last run was $DIFF seconds ago (too long)"
    exit 1
else
    echo "✅ System healthy - last run $DIFF seconds ago"
    exit 0
fi
```

---

## 🔄 How the Frontend Integrates

Your React app fetches raw stats and calculates scores client-side:

```typescript
// Example: Live DFS Leaderboard Component
import { calculateFantasyPoints, FANDUEL_SCORING } from '@/utils/fantasyScoring';

function LiveDFSLeaderboard({ poolId }: { poolId: number }) {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    // Subscribe to live stats updates
    const subscription = supabase
      .channel('live-stats')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_player_stats'
        },
        () => {
          fetchAndCalculateScores();
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  async function fetchAndCalculateScores() {
    // 1. Get all entries for this pool
    const { data: entries } = await supabase
      .from('dfs_entries')
      .select('*, user:users(username)')
      .eq('pool_id', poolId);

    // 2. For each entry, fetch live stats and calculate score
    const entriesWithScores = await Promise.all(
      entries.map(async (entry) => {
        let totalScore = 0;

        // Get stats for each player in roster
        for (const player of entry.roster) {
          const { data: liveStats } = await supabase
            .from('live_player_stats')
            .select('stats')
            .eq('game_id', player.game_id)
            .eq('nba_player_id', player.nba_player_id)
            .single();

          if (liveStats) {
            // Use your fantasyScoring.ts utility
            const points = calculateFantasyPoints(
              liveStats.stats,
              FANDUEL_SCORING
            );
            totalScore += points;
          }
        }

        return { ...entry, currentScore: totalScore };
      })
    );

    // 3. Sort by score and update state
    const sorted = entriesWithScores.sort((a, b) => b.currentScore - a.currentScore);
    setEntries(sorted);
  }

  // Initial load
  useEffect(() => {
    fetchAndCalculateScores();
  }, [poolId]);

  return (
    <div>
      {entries.map((entry, index) => (
        <div key={entry.id}>
          #{index + 1} - {entry.user.username} - {entry.currentScore} pts
        </div>
      ))}
    </div>
  );
}
```

---

## 💰 Cost Breakdown

### Option 1: Cheap VPS
- **DigitalOcean Droplet**: $6/month
- **Supabase**: Free tier
- **Total**: **$6/month**

### Option 2: AWS Free Tier
- **EC2 t3.micro**: Free for first year
- **Supabase**: Free tier
- **Total**: **$0/month** (first year)

### Option 3: Fly.io
- **Free tier**: 3 shared CPU VMs
- **Supabase**: Free tier
- **Total**: **$0/month** (with limits)

### Option 4: Local Machine
- **Cost**: Free
- **Requirement**: Always-on computer

---

## 🔧 Troubleshooting

### Issue: Script not running
```bash
# Check if cron is running
systemctl status cron

# Check cron logs
grep CRON /var/log/syslog

# Verify environment variables are set
cd /opt/hoopgeek
export $(cat .env | xargs)
echo $VITE_SUPABASE_URL
```

### Issue: No stats being updated
```bash
# Run manually to see errors
cd /opt/hoopgeek
export $(cat .env | xargs)
python3 scripts/setup/update_live_fantasy_scores.py

# Check if games are actually live
# (Script only updates during live games)
```

### Issue: Database connection fails
```sql
-- Check if tables exist
SELECT * FROM live_player_stats LIMIT 1;

-- Check if RLS policies allow service role
SELECT * FROM pg_policies WHERE tablename = 'live_player_stats';
```

---

## 📊 Performance Monitoring

### Database Queries to Monitor System

```sql
-- Check recent live stats updates
SELECT 
  COUNT(*) as active_players,
  MAX(updated_at) as last_update,
  COUNT(DISTINCT game_id) as active_games
FROM live_player_stats
WHERE updated_at > NOW() - INTERVAL '10 minutes';

-- Check system health
SELECT * FROM live_stats_updates ORDER BY last_updated DESC LIMIT 1;

-- See which games are being tracked
SELECT DISTINCT game_id, COUNT(*) as player_count
FROM live_player_stats
WHERE updated_at > NOW() - INTERVAL '1 hour'
GROUP BY game_id;
```

---

## 🎯 Summary

**For Live Stats** → Python cron on cheap VPS ($6/month)
- Runs every minute during games
- Fetches NBA API
- Stores raw stats

**For Maintenance** → Supabase pg_cron (free)
- Daily cleanup
- Weekly resets
- Archive old data

**For Fantasy Scoring** → Frontend TypeScript (free)
- Uses your `fantasyScoring.ts`
- Supports multiple formats
- Real-time calculations

**Total Cost**: $6/month (or free with AWS/Fly.io free tiers)

---

## ✅ You're Ready!

1. ✅ Deploy database schema
2. ✅ Set up cheap VPS with cron
3. ✅ Configure Supabase maintenance jobs
4. ✅ Frontend fetches and calculates using `fantasyScoring.ts`

Your live fantasy tracking system is production-ready! 🚀

