# 🏀 Live Fantasy Score Tracking System

## Overview

This system uses the **NBA Live Data API** to track real-time fantasy scores for both DFS (daily fantasy sports) and traditional fantasy leagues. Player stats are updated every minute during games, providing live leaderboards and scoring.

## ✅ Why NBA Live API is Perfect for This

### Advantages:
1. **✅ Real-time updates** - Box scores update during games, not just after
2. **✅ Comprehensive stats** - All fantasy-relevant stats (pts, reb, ast, stl, blk, to, 3PM)
3. **✅ Game status tracking** - Know which games are live vs completed
4. **✅ Official source** - Direct from NBA.com, reliable and accurate
5. **✅ Player details** - Includes playing status, injury info, DNPs
6. **✅ Free API** - No cost, built into `nba_api` Python library

### How It Works:
```
Every 60 seconds during game times:
  1. Fetch scoreboard → Find live games
  2. For each live game → Fetch box score
  3. Extract player stats → Calculate fantasy points
  4. Update live_player_stats table
  5. Recalculate DFS entry scores
  6. Update fantasy league weekly averages
```

## 📊 Architecture

### Data Flow
```
NBA Live API → Box Scores → Fantasy Points Calculator
                                     ↓
                          live_player_stats table
                                     ↓
                    ┌────────────────┴────────────────┐
                    ↓                                  ↓
          DFS Entry Scores                    Fantasy League Scores
          (total for lineup)                  (weekly average)
```

### Database Tables

#### `live_player_stats`
Stores real-time player stats and calculated fantasy points
```sql
- game_id: NBA game ID
- nba_player_id: Player's NBA ID
- player_name: Player name
- fantasy_points: Calculated fantasy score
- stats: JSONB with all box score stats
- updated_at: Last update time
```

#### `dfs_entries` (updated)
```sql
+ current_score: Live total score for entry
+ player_scores: Array of each player's score
```

#### `fantasy_rosters` (updated)
```sql
+ weekly_score: Total points this week
+ weekly_average: Average per game this week
+ player_weekly_scores: Each player's weekly breakdown
```

## 🎮 Fantasy Scoring System

Default scoring (customize in `update_live_fantasy_scores.py`):

| Stat | Points |
|------|--------|
| Point | 1.0 |
| Rebound | 1.2 |
| Assist | 1.5 |
| Steal | 3.0 |
| Block | 3.0 |
| Turnover | -1.0 |
| 3-Pointer Made | 0.5 (bonus) |
| Double-Double | 1.5 (bonus) |
| Triple-Double | 3.0 (bonus) |

### Customizing Scoring
Edit `FANTASY_SCORING` in `scripts/setup/update_live_fantasy_scores.py`:
```python
FANTASY_SCORING = {
    'points': 1,
    'reboundsTotal': 1.2,
    'assists': 1.5,
    'steals': 3,
    'blocks': 3,
    'turnovers': -1,
    'threePointersMade': 0.5,
    'doubleDouble': 1.5,
    'tripleDouble': 3,
}
```

## 🚀 Setup Instructions

### 1. Deploy Database Schema

Run the SQL migration to create tables and functions:

```bash
# In Supabase SQL Editor, run:
DEPLOY_LIVE_FANTASY_TRACKING.sql
```

This creates:
- `live_player_stats` table
- `fantasy_rosters` table (if not exists)
- Helper functions for scoring and leaderboards
- RLS policies

### 2. Install Python Dependencies

```bash
pip install nba-api supabase
```

### 3. Set Up Live Tracking Cron Job

```bash
# Run the setup script
bash scripts/setup/setup_live_tracking_cron.sh

# Then add to crontab
crontab -e

# Add these lines:
# Live fantasy tracking - runs every minute during NBA game times
* 18-23 * * * /Users/adam/Desktop/hoopgeek/scripts/setup/run_live_tracking.sh
* 0-1 * * * /Users/adam/Desktop/hoopgeek/scripts/setup/run_live_tracking.sh
```

**Note**: Times are in your local timezone. Adjust for EST if needed:
- 6 PM - 11:59 PM EST: Main game window
- 12 AM - 1 AM EST: Late west coast games

### 4. Test the System

```bash
# Run manually to test
/Users/adam/Desktop/hoopgeek/scripts/setup/run_live_tracking.sh

# Check logs
tail -f /Users/adam/Desktop/hoopgeek/logs/live_fantasy_tracking.log
```

## 📱 Frontend Integration

### Get Live DFS Leaderboard

```typescript
// Fetch live leaderboard for a pool
const { data: leaderboard } = await supabase
  .rpc('get_live_dfs_leaderboard', { p_pool_id: poolId });

// Returns:
// [
//   { rank: 1, entry_id: 123, username: "player1", current_score: 245.5, ... },
//   { rank: 2, entry_id: 456, username: "player2", current_score: 238.2, ... },
//   ...
// ]
```

### Get Fantasy League Standings

```typescript
// Fetch weekly standings for a league
const { data: standings } = await supabase
  .rpc('get_fantasy_league_standings', { p_league_id: leagueId });

// Returns:
// [
//   { rank: 1, team_name: "Team A", weekly_average: 52.3, ... },
//   { rank: 2, team_name: "Team B", weekly_average: 48.7, ... },
//   ...
// ]
```

### Get Live Player Stats

```typescript
// Get current stats for a specific player
const { data: playerStats } = await supabase
  .from('live_player_stats')
  .select('*')
  .eq('nba_player_id', playerId)
  .eq('game_id', gameId)
  .single();

// Returns:
// {
//   fantasy_points: 34.5,
//   stats: {
//     points: 24,
//     reboundsTotal: 8,
//     assists: 5,
//     steals: 2,
//     blocks: 1,
//     ...
//   }
// }
```

### Subscribe to Real-Time Updates

```typescript
// Subscribe to live score updates
const subscription = supabase
  .channel('live-scores')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'dfs_entries',
      filter: `pool_id=eq.${poolId}`
    },
    (payload) => {
      console.log('Score updated!', payload.new.current_score);
      // Update UI with new scores
    }
  )
  .subscribe();
```

## 🎯 API Rate Limiting Strategy

### Best Practices:
1. **Only fetch during active games** - Script checks game status first
2. **60-second intervals** - Balances freshness vs API load
3. **Batch requests** - Fetches all games in one loop iteration
4. **Caches game status** - Doesn't re-fetch finished games

### NBA API Limits:
- No official rate limit, but be respectful
- 60-second polling is safe and recommended
- Script runs only during game times (6 PM - 1 AM)

## 📊 How It Compares to Alternatives

### Option 1: NBA Stats API (stats.nba.com)
- ❌ Only final box scores (no live updates)
- ❌ Updates after games complete
- ✅ More historical data

**Verdict**: Not suitable for live tracking

### Option 2: NBA Live API (live.nba.com)
- ✅ **Real-time updates during games** ← We use this!
- ✅ Comprehensive live stats
- ✅ Game status tracking
- ✅ Free and reliable

**Verdict**: **Perfect for live fantasy scoring**

### Option 3: Third-party APIs (SportsData.io, etc.)
- ✅ Real-time data
- ❌ **Costs money** ($50-200/month)
- ❌ Additional dependencies

**Verdict**: Unnecessary cost when NBA Live API is free

## 🔧 Monitoring & Maintenance

### Check System Health

```bash
# View recent logs
tail -100 /Users/adam/Desktop/hoopgeek/logs/live_fantasy_tracking.log

# Search for errors
grep "ERROR\|❌" /Users/adam/Desktop/hoopgeek/logs/live_fantasy_tracking.log

# Check last successful run
grep "✅" /Users/adam/Desktop/hoopgeek/logs/live_fantasy_tracking.log | tail -1
```

### Common Issues

**Issue**: No games found
- **Cause**: Script running when no games are live
- **Solution**: Normal behavior, script will resume when games start

**Issue**: API timeout
- **Cause**: NBA API temporarily unavailable
- **Solution**: Script will retry next minute, no action needed

**Issue**: Scores not updating in UI
- **Cause**: Frontend not polling/subscribing
- **Solution**: Implement real-time subscriptions or polling

### Cleanup Old Data

```sql
-- Run weekly to clean up old live stats (keeps last 7 days)
SELECT cleanup_old_live_stats();
```

## 🎮 Example: Complete DFS Flow

1. **User creates DFS entry**
   - Selects 8 players for tonight's games
   - Entry saved with roster info

2. **Games start at 7 PM**
   - Cron job starts running every minute
   - Fetches live box scores for active games

3. **Live score updates**
   - Player stats update every minute
   - DFS entry `current_score` recalculated
   - Leaderboard updates automatically

4. **User checks leaderboard**
   - Sees live rankings
   - Watches their score climb (or fall!)
   - Can see each player's contribution

5. **Games finish**
   - Final scores calculated
   - Winners determined
   - Payouts processed (if applicable)

## 📈 Performance Considerations

### Database Impact
- **Writes**: ~100-200 per minute during peak times
- **Reads**: User-driven (leaderboard queries)
- **Solution**: Indexes on key columns, efficient queries

### API Impact
- **Requests**: ~10-20 per minute (one per live game)
- **Data**: ~50KB per box score
- **Solution**: Only fetch during game times

### Scaling
- **Current**: Handles 100s of users easily
- **1000+ users**: Consider caching leaderboards
- **10,000+ users**: Use Redis for real-time data

## 🎯 Next Steps

### Enhancements to Consider:

1. **Live Notifications**
   - Push notifications when user's DFS entry moves up/down
   - Alerts for close matchups in fantasy leagues

2. **Advanced Stats**
   - Efficiency ratings
   - Usage rate
   - Pace-adjusted stats

3. **Projections**
   - Integrate with projections API
   - Show expected vs actual performance

4. **Mobile App**
   - React Native app with push notifications
   - Live score tracking on the go

## ✅ Conclusion

**Yes, the NBA Live Data API is an excellent choice** for tracking fantasy scores! It provides:
- ✅ Real-time updates
- ✅ Comprehensive stats
- ✅ Free and reliable
- ✅ Easy to integrate

Your setup is now ready to:
1. Track live DFS scores as games are played
2. Calculate fantasy league weekly averages
3. Provide real-time leaderboards
4. Scale to handle many users

**You're all set to go live! 🚀**

