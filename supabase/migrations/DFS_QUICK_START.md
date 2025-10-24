# DFS System - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Apply the Migration

```bash
cd /Users/adam/Desktop/hoopgeek

# The migration file is already created
# Just run:
supabase db push

# Or if using Supabase Dashboard:
# Copy the contents of create_dfs_system.sql
# Paste into SQL Editor and Execute
```

### Step 2: Verify Installation

```sql
-- Check all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'dfs_%'
ORDER BY table_name;

-- Should return 10 tables:
-- dfs_entries
-- dfs_lineups
-- dfs_lineup_positions
-- dfs_payouts
-- dfs_player_salaries
-- dfs_pool_games
-- dfs_pools
-- dfs_prize_structures
-- dfs_transactions
-- dfs_user_balances
```

### Step 3: Create Your First Pool

```sql
-- Create a pool for tomorrow's games
INSERT INTO dfs_pools (
  name,
  description,
  slate_name,
  slate_date,
  start_time,
  lock_time,
  entry_fee,
  min_entries,
  max_entries,
  max_entries_per_user,
  prize_pool,
  is_guaranteed,
  salary_cap,
  difficulty_tier,
  status,
  is_public
) VALUES (
  'NBA Main Slate - October 26',
  'Daily contest for all games on October 26, 2025',
  'Main Slate',
  '2025-10-26',
  '2025-10-26 13:00:00+00', -- 1 PM ET
  '2025-10-26 13:00:00+00', -- Locks at first game
  10.00, -- $10 entry
  10, -- Need at least 10 entries
  1000, -- Max 1000 entries
  3, -- Max 3 entries per user
  9000.00, -- $9000 prize pool (after 10% rake)
  true, -- Guaranteed
  207800000, -- $207.8M (standard difficulty)
  'standard',
  'scheduled',
  true
) RETURNING id;
-- Save this ID, you'll need it!
```

### Step 4: Add Games to the Pool

```sql
-- Replace 'your-pool-id' with the ID from Step 3
INSERT INTO dfs_pool_games (pool_id, game_id, game_date, home_team, away_team)
SELECT 
  'your-pool-id', -- ← Replace this
  game_id,
  game_date,
  home_team_tricode,
  away_team_tricode
FROM nba_games
WHERE game_date::date = '2025-10-26'
  AND game_status_text != 'Cancelled';
```

### Step 5: Generate Player Salaries

```sql
-- This is a simple example. You'll want to make this more sophisticated
-- based on projections, recent performance, matchups, etc.

INSERT INTO dfs_player_salaries (
  pool_id,
  player_id,
  nba_player_id,
  player_name,
  player_team,
  player_position,
  salary,
  projected_points
)
SELECT 
  'your-pool-id', -- ← Replace this
  p.id,
  p.nba_player_id,
  p.name,
  p.team_abbreviation,
  p.position,
  -- Simple salary calculation based on season averages
  -- You'll want to refine this significantly
  CASE 
    WHEN p.id IN (
      SELECT player_id FROM nba_boxscores
      WHERE season_year = '2025-26'
      GROUP BY player_id
      HAVING AVG(points + rebounds + assists) > 30
    ) THEN 11000000 -- $11M for superstars
    
    WHEN p.id IN (
      SELECT player_id FROM nba_boxscores
      WHERE season_year = '2025-26'
      GROUP BY player_id
      HAVING AVG(points + rebounds + assists) > 20
    ) THEN 8500000 -- $8.5M for all-stars
    
    WHEN p.id IN (
      SELECT player_id FROM nba_boxscores
      WHERE season_year = '2025-26'
      GROUP BY player_id
      HAVING AVG(points + rebounds + assists) > 15
    ) THEN 6500000 -- $6.5M for starters
    
    ELSE 4500000 -- $4.5M for role players
  END as salary,
  -- Projected points (you'll calculate this properly)
  35.0 as projected_points
FROM nba_players p
WHERE p.team_abbreviation IN (
  SELECT DISTINCT home_team FROM dfs_pool_games WHERE pool_id = 'your-pool-id'
  UNION
  SELECT DISTINCT away_team FROM dfs_pool_games WHERE pool_id = 'your-pool-id'
)
  AND p.is_active = true;
```

## 📊 Salary Cap Reference

### Three Difficulty Tiers

| Tier | Salary Cap | SQL Value | Description |
|------|-----------|-----------|-------------|
| **Elite** 🔥 | $154.6M | `154600000` | Hardest - Luxury Tax Threshold |
| **Pro** 💪 | $195.9M | `195900000` | Medium - First Apron |
| **Standard** ⭐ | $207.8M | `207800000` | Easiest - Second Apron |

### Example Pool Creation for Each Tier

```sql
-- Elite Difficulty ($154.6M)
INSERT INTO dfs_pools (
  name, slate_name, slate_date, start_time, lock_time,
  entry_fee, max_entries, salary_cap, difficulty_tier, status
) VALUES (
  'Elite Challenge - Oct 26',
  'Main Slate', '2025-10-26', 
  '2025-10-26 13:00:00+00', '2025-10-26 13:00:00+00',
  25.00, 500, 154600000, 'elite', 'scheduled'
);

-- Pro Difficulty ($195.9M)
INSERT INTO dfs_pools (
  name, slate_name, slate_date, start_time, lock_time,
  entry_fee, max_entries, salary_cap, difficulty_tier, status
) VALUES (
  'Pro Contest - Oct 26',
  'Main Slate', '2025-10-26',
  '2025-10-26 13:00:00+00', '2025-10-26 13:00:00+00',
  10.00, 1000, 195900000, 'pro', 'scheduled'
);

-- Standard Difficulty ($207.8M)
INSERT INTO dfs_pools (
  name, slate_name, slate_date, start_time, lock_time,
  entry_fee, max_entries, salary_cap, difficulty_tier, status
) VALUES (
  'Standard Play - Oct 26',
  'Main Slate', '2025-10-26',
  '2025-10-26 13:00:00+00', '2025-10-26 13:00:00+00',
  5.00, 2000, 207800000, 'standard', 'scheduled'
);
```

## 🎯 Unit Multipliers

### How Scoring Works

Your lineup has **three units** with different multipliers:

| Unit | Count | Multiplier | Example |
|------|-------|------------|---------|
| **Starters** | 5 | 1.00x | 50 FP → 50 points |
| **Rotation** | 3 | 0.75x | 40 FP → 30 points |
| **Bench** | 2 | 0.50x | 30 FP → 15 points |

**Total Lineup**: 10 players (5+3+2)

### Scoring Example

```
STARTERS (5 players at 1.0x):
1. LeBron James: 45 FP × 1.0 = 45.0 points
2. Stephen Curry: 42 FP × 1.0 = 42.0 points
3. Giannis: 48 FP × 1.0 = 48.0 points
4. Kevin Durant: 40 FP × 1.0 = 40.0 points
5. Nikola Jokic: 55 FP × 1.0 = 55.0 points
Starters Total: 230.0 points

ROTATION (3 players at 0.75x):
6. Jimmy Butler: 35 FP × 0.75 = 26.25 points
7. Jayson Tatum: 38 FP × 0.75 = 28.5 points
8. Anthony Davis: 40 FP × 0.75 = 30.0 points
Rotation Total: 84.75 points

BENCH (2 players at 0.5x):
9. Zion Williamson: 32 FP × 0.5 = 16.0 points
10. Devin Booker: 36 FP × 0.5 = 18.0 points
Bench Total: 34.0 points

LINEUP FINAL SCORE: 348.75 points
```

## 🔑 Key Frontend Hooks

### 1. Fetch Available Pools

```typescript
// hooks/useDFSPools.ts
export function useDFSPools() {
  return useQuery({
    queryKey: ['dfs-pools'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dfs_pools')
        .select('*')
        .eq('status', 'scheduled')
        .eq('is_public', true)
        .gte('slate_date', new Date().toISOString().split('T')[0])
        .order('start_time');
      
      if (error) throw error;
      return data;
    }
  });
}
```

### 2. Join a Pool

```typescript
// hooks/useJoinDFSPool.ts
export function useJoinDFSPool() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ poolId, userId }: { poolId: string; userId: string }) => {
      // Get pool details
      const { data: pool } = await supabase
        .from('dfs_pools')
        .select('*')
        .eq('id', poolId)
        .single();
      
      // Create entry
      const { data: entry, error: entryError } = await supabase
        .from('dfs_entries')
        .insert({
          pool_id: poolId,
          user_id: userId,
          entry_fee_paid: pool.entry_fee,
          status: 'active'
        })
        .select()
        .single();
      
      if (entryError) throw entryError;
      
      // Create lineup
      const { data: lineup, error: lineupError } = await supabase
        .from('dfs_lineups')
        .insert({
          entry_id: entry.id,
          pool_id: poolId,
          user_id: userId
        })
        .select()
        .single();
      
      if (lineupError) throw lineupError;
      
      return { entry, lineup };
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['dfs-pools']);
      queryClient.invalidateQueries(['user-entries']);
    }
  });
}
```

### 3. Build Lineup

```typescript
// hooks/useDFSLineupBuilder.ts
export function useAddPlayerToLineup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      lineupId,
      poolId,
      playerId,
      unit,
      position
    }: {
      lineupId: string;
      poolId: string;
      playerId: string;
      unit: 'starters' | 'rotation' | 'bench';
      position: number;
    }) => {
      // Get player salary info
      const { data: playerSalary } = await supabase
        .from('dfs_player_salaries')
        .select('*')
        .eq('pool_id', poolId)
        .eq('player_id', playerId)
        .single();
      
      // Determine multiplier
      const multiplier = unit === 'starters' ? 1.0 : 
                        unit === 'rotation' ? 0.75 : 0.5;
      
      // Add to lineup
      const { data, error } = await supabase
        .from('dfs_lineup_positions')
        .insert({
          lineup_id: lineupId,
          pool_id: poolId,
          player_id: playerId,
          nba_player_id: playerSalary.nba_player_id,
          unit,
          unit_position: position,
          player_name: playerSalary.player_name,
          player_team: playerSalary.player_team,
          player_position: playerSalary.player_position,
          player_salary: playerSalary.salary,
          unit_multiplier: multiplier
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { lineupId }) => {
      queryClient.invalidateQueries(['dfs-lineup', lineupId]);
      queryClient.invalidateQueries(['dfs-lineup-salary', lineupId]);
    }
  });
}
```

## 🎮 Frontend Components Needed

1. **`DFSPoolList.tsx`** - Browse available pools
2. **`DFSPoolDetails.tsx`** - Pool info, prize structure, rules
3. **`DFSLineupBuilder.tsx`** - Build your lineup (like Lineups.tsx but for DFS)
4. **`DFSPlayerCard.tsx`** - Player card with salary, projections
5. **`DFSLeaderboard.tsx`** - Live/final leaderboard
6. **`DFSUserDashboard.tsx`** - User's entries, history, stats
7. **`DFSTransactionHistory.tsx`** - Financial history

## 🧪 Test Your Setup

```sql
-- 1. Check tables exist
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name LIKE 'dfs_%';
-- Should return: 10

-- 2. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'dfs_%';
-- All should have rowsecurity = true

-- 3. Check prize structures
SELECT * FROM dfs_prize_structures;
-- Should have 4 default structures

-- 4. Check views
SELECT * FROM dfs_active_pools_summary LIMIT 1;
-- Should work without errors
```

## 🚨 Common Issues

### Issue: Can't see pools
**Solution**: Check RLS policies and ensure `is_public = true`

### Issue: Salary calculation wrong
**Solution**: Verify all 10 positions are filled and salaries are correct

### Issue: Multipliers not applied
**Solution**: Check `unit_multiplier` column in `dfs_lineup_positions`

### Issue: Can't join pool
**Solution**: Check pool status is `scheduled` and not full

## 📚 Next Steps

1. ✅ Apply migration
2. ✅ Create test pool
3. ✅ Add games and players
4. 🔲 Build frontend UI
5. 🔲 Implement lineup builder
6. 🔲 Add scoring logic
7. 🔲 Integrate payments
8. 🔲 Launch! 🚀

---

**Need help?** Check the full documentation in `DFS_SYSTEM_README.md`

