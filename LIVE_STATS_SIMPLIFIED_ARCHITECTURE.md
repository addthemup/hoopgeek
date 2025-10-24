# 🎯 Simplified Live Stats Architecture

## Overview

**Backend fetches raw stats → Frontend calculates fantasy points**

This gives you maximum flexibility with your existing `fantasyScoring.ts` utility!

## 📊 Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                     EVERY 60 SECONDS                          │
│                    (During Game Times)                        │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
    ┌───────────────────────────────────────────┐
    │  Python Script on Server/VPS               │
    │  (update_live_fantasy_scores.py)           │
    ├────────────────────────────────────────────┤
    │  1. Fetch scoreboard from NBA Live API     │
    │  2. Get live games (status 2 or 3)         │
    │  3. For each game, fetch box score         │
    │  4. Extract raw player stats               │
    │  5. Store in live_player_stats table       │
    └───────────────────┬───────────────────────┘
                        ↓
    ┌───────────────────────────────────────────┐
    │  Supabase Database                         │
    │  (live_player_stats table)                 │
    ├────────────────────────────────────────────┤
    │  Stores:                                   │
    │  - game_id                                 │
    │  - nba_player_id                           │
    │  - player_name                             │
    │  - team_tricode                            │
    │  - stats: { pts, reb, ast, stl, blk, ... } │
    │  - updated_at                              │
    └───────────────────┬───────────────────────┘
                        ↓
    ┌───────────────────────────────────────────┐
    │  React Frontend                            │
    │  (Uses fantasyScoring.ts)                  │
    ├────────────────────────────────────────────┤
    │  1. Fetch live_player_stats                │
    │  2. For DFS entries:                       │
    │     → Get stats for roster players         │
    │     → calculateFantasyPoints(stats, format)│
    │     → Sum up total score                   │
    │  3. For Fantasy Leagues:                   │
    │     → Get stats for roster players         │
    │     → calculateFantasyPoints(stats, format)│
    │     → Calculate weekly average             │
    │  4. Display live leaderboards              │
    └────────────────────────────────────────────┘
```

## 🔧 What Python Script Does

**ONLY fetches and stores raw stats:**
- ✅ NBA API box scores
- ✅ Raw player statistics
- ✅ Game status updates
- ❌ No fantasy scoring calculations
- ❌ No leaderboard logic

## 💻 What Frontend Does

**Calculates everything using your `fantasyScoring.ts`:**
- ✅ Fantasy point calculations
- ✅ Multiple scoring formats (FanDuel, DraftKings, Yahoo, ESPN)
- ✅ Live leaderboards
- ✅ Custom league scoring
- ✅ Real-time updates

## 📝 Example: Live DFS Leaderboard Component

```typescript
import { calculateFantasyPoints, FANDUEL_SCORING } from '@/utils/fantasyScoring';
import { supabase } from '@/lib/supabase';

interface DFSEntry {
  id: number;
  user_id: string;
  roster: Array<{
    nba_player_id: number;
    game_id: string;
    player_name: string;
  }>;
}

export function LiveDFSLeaderboard({ poolId }: { poolId: number }) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to live stat updates
  useEffect(() => {
    const channel = supabase
      .channel('live-stats-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_player_stats' },
        () => {
          // Stats updated, recalculate leaderboard
          calculateLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolId]);

  // Calculate leaderboard with live scores
  async function calculateLeaderboard() {
    setLoading(true);

    // 1. Get all entries for this pool
    const { data: entries } = await supabase
      .from('dfs_entries')
      .select(`
        id,
        user_id,
        roster,
        users:user_id (username)
      `)
      .eq('pool_id', poolId);

    // 2. Calculate score for each entry
    const entriesWithScores = await Promise.all(
      entries.map(async (entry: DFSEntry) => {
        let totalScore = 0;
        const playerScores = [];

        // Get live stats for each player in roster
        for (const player of entry.roster) {
          const { data: liveStats } = await supabase
            .from('live_player_stats')
            .select('stats, player_name')
            .eq('game_id', player.game_id)
            .eq('nba_player_id', player.nba_player_id)
            .single();

          if (liveStats?.stats) {
            // Use your fantasyScoring.ts utility!
            const points = calculateFantasyPoints(
              liveStats.stats,
              FANDUEL_SCORING // or any other format
            );
            
            totalScore += points;
            playerScores.push({
              player_name: liveStats.player_name,
              points,
              stats: liveStats.stats
            });
          }
        }

        return {
          ...entry,
          currentScore: totalScore,
          playerScores
        };
      })
    );

    // 3. Sort by score
    const sorted = entriesWithScores.sort(
      (a, b) => b.currentScore - a.currentScore
    );

    setLeaderboard(sorted);
    setLoading(false);
  }

  // Initial load
  useEffect(() => {
    calculateLeaderboard();
    
    // Refresh every 60 seconds as backup
    const interval = setInterval(calculateLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [poolId]);

  if (loading) return <div>Loading leaderboard...</div>;

  return (
    <div className="space-y-4">
      <h2>Live DFS Leaderboard</h2>
      {leaderboard.map((entry, index) => (
        <div key={entry.id} className="flex items-center justify-between p-4 border rounded">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold">#{index + 1}</span>
            <div>
              <div className="font-semibold">{entry.users.username}</div>
              <div className="text-sm text-gray-600">
                {entry.playerScores.length} players
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{entry.currentScore.toFixed(2)}</div>
            <div className="text-sm text-gray-600">fantasy points</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## 🎨 Benefits of This Approach

### ✅ Flexibility
- Support multiple scoring formats
- Easy to add custom league rules
- No backend changes needed for scoring tweaks

### ✅ Simplicity
- Backend just fetches raw data
- One source of truth for scoring (`fantasyScoring.ts`)
- Easy to test and debug

### ✅ Performance
- Frontend calculations are fast
- Real-time updates via Supabase subscriptions
- Caching opportunities

### ✅ Customization
- Per-league scoring settings
- User-defined multipliers
- Custom bonuses and penalties

## 🚀 Deployment Checklist

- [ ] Deploy database schema (`DEPLOY_LIVE_FANTASY_TRACKING.sql`)
- [ ] Set up Supabase maintenance cron (`SETUP_SUPABASE_CRON_MAINTENANCE.sql`)
- [ ] Deploy Python script to VPS/server
- [ ] Set up cron job (every 60 seconds during games)
- [ ] Test Python script manually
- [ ] Verify stats are being stored in `live_player_stats`
- [ ] Build frontend components with `fantasyScoring.ts`
- [ ] Subscribe to real-time updates
- [ ] Test live leaderboards during actual games

## 📊 Database Table Schema

```sql
-- What Python script stores:
live_player_stats
├── game_id: text
├── nba_player_id: bigint
├── player_name: text
├── team_tricode: text
├── stats: jsonb  -- { pts, reb, ast, stl, blk, tov, fgm, fga, ... }
├── raw_stats: jsonb  -- Original NBA API response
└── updated_at: timestamptz
```

## 🎯 Summary

**Backend (Python)**: Fetches → Stores raw stats
**Frontend (TypeScript)**: Fetches → Calculates → Displays

Your `fantasyScoring.ts` handles all the scoring logic, so you can:
- Add new scoring formats easily
- Customize per league
- A/B test different scoring systems
- Change rules without touching backend

**Perfect separation of concerns!** 🎉

