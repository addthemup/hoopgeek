# NBA Data Sync (Schedule & Box Scores)

This directory contains scripts to automatically sync NBA data every night at 3:30 AM EST.

## Overview

Two data sources are synced nightly:

### 1. Schedule Sync
Fetches the complete NBA schedule from the official NBA CDN:
```
https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_9.json
```

This JSON file contains:
- All games for the 2025-26 season (1,265+ games)
- Real-time updates for scores, game statuses, and schedule changes
- Complete team information, arena details, and week assignments

### 2. Box Score Import
Fetches player stats from yesterday's completed games using the NBA API:
- Player stats for all games played the previous day
- Fantasy scoring data (points, rebounds, assists, etc.)
- Automatically updates lineup displays with game results

## Files

- **`import_2025_26_season.py`** - Schedule import script (fetches games from NBA.com)
- **`import_daily_boxscores.py`** - Box score import script (fetches stats from yesterday)
- **`setup_nightly_sync.sh`** - Setup script for configuring the nightly cron job
- **`run_nightly_sync.sh`** - Generated master script that runs both imports (created by setup script)

## Quick Start

### 1. Run the import scripts manually (first time)

**Schedule Import:**
```bash
cd /Users/adam/Desktop/hoopgeek
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
python3 scripts/setup/import_2025_26_season.py
```

**Box Score Import (yesterday's games):**
```bash
python3 scripts/setup/import_daily_boxscores.py
```

### 2. Set up nightly automatic sync

Run the setup script:

```bash
./scripts/setup/setup_nightly_sync.sh
```

This will create a `run_nightly_sync.sh` script that runs both imports and provide instructions for setting up a cron job.

### 3. Configure cron job

Edit your crontab:

```bash
crontab -e
```

Add one of these lines:

```bash
# Run at 3:30 AM EST every night
30 3 * * * /Users/adam/Desktop/hoopgeek/scripts/setup/run_nightly_sync.sh

# Or run at 4:00 AM EST every night
0 4 * * * /Users/adam/Desktop/hoopgeek/scripts/setup/run_nightly_sync.sh
```

## What Gets Imported

### Season Weeks
- Week 0: Preseason
- Weeks 1-27+: Regular season and playoffs
- Includes start date, end date, and week name for each week

### Games
- Game ID, game code, game status
- Home/away team IDs, names, and tricodes
- Scores (updated as games are played)
- Game date/time
- Arena information
- Week number assignment

### Data Updates

The import script uses **upsert logic**, which means:
- New games are inserted
- Existing games are updated with latest data
- No duplicates are created
- Safe to run multiple times

This keeps your database in sync with:
- Score updates as games finish
- Schedule changes (postponed/rescheduled games)
- Status updates (scheduled → in-progress → final)

## Monitoring

### View sync logs

**Schedule sync:**
```bash
tail -f /Users/adam/Desktop/hoopgeek/logs/nba_schedule_sync.log
```

**Box score import:**
```bash
tail -f /Users/adam/Desktop/hoopgeek/logs/nba_boxscore_import.log
```

### Test both syncs manually

```bash
/Users/adam/Desktop/hoopgeek/scripts/setup/run_nightly_sync.sh
```

## Verification

Run this SQL in your Supabase SQL editor to verify the data:

```sql
-- Check total games
SELECT COUNT(*) FROM nba_games WHERE season_year = 2026;
-- Should return ~1,265 games

-- Check games per team
SELECT 
  team,
  COUNT(*) as game_count
FROM (
  SELECT home_team_tricode as team FROM nba_games WHERE season_year = 2026
  UNION ALL
  SELECT away_team_tricode as team FROM nba_games WHERE season_year = 2026
) t
GROUP BY team
ORDER BY team;
-- Each team should have ~82 games (+ preseason)
```

## Troubleshooting

### Import fails with "Missing Supabase credentials"

Make sure environment variables are set in `run_nightly_sync.sh`:
```bash
export VITE_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
```

### Cron job doesn't run

1. Check cron is running: `sudo launchctl list | grep cron`
2. Check cron logs: `grep CRON /var/log/system.log`
3. Verify script has execute permissions: `ls -l scripts/setup/run_nightly_sync.sh`
4. Test script manually first

### Games not showing in app

1. Verify import completed successfully (check logs)
2. Run verification SQL queries
3. Check that `season_year = 2026` matches your app queries
4. Ensure `week_number` is correctly assigned

## Benefits of This Approach

### Schedule Sync
✅ **Real NBA data** - No mock/random games  
✅ **Always up-to-date** - Syncs nightly with official schedule  
✅ **Handles changes** - Automatically updates postponed/rescheduled games  
✅ **Reliable** - Fetches from NBA's official CDN  
✅ **Safe** - Upsert logic prevents duplicates  
✅ **Complete** - All 30 teams, 82 games each, plus preseason & playoffs

### Box Score Import
✅ **Automatic stats** - No manual entry needed  
✅ **Fantasy points** - Calculates points for all scoring formats  
✅ **Daily updates** - Every game's stats imported automatically  
✅ **Smart import** - Skips already-imported games  
✅ **Rate limited** - Won't overwhelm NBA API  
✅ **Player tracking** - Auto-creates new players as needed  

## Manual Run

To run both imports immediately (without waiting for cron):

```bash
cd /Users/adam/Desktop/hoopgeek
source scripts/setup/run_supa_setup.sh  # Sets env vars

# Run schedule sync
python3 scripts/setup/import_2025_26_season.py

# Run box score import
python3 scripts/setup/import_daily_boxscores.py
```

Or run the master script:
```bash
/Users/adam/Desktop/hoopgeek/scripts/setup/run_nightly_sync.sh
```

---

Last updated: October 20, 2025  
Next scheduled sync: 3:30 AM EST daily (both schedule and box scores)

