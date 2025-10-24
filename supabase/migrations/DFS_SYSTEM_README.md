# Daily Fantasy Sports (DFS) System - Complete Documentation

## 🎯 Overview

This is a comprehensive, production-ready DFS system designed for daily fantasy basketball contests with a unique **3-unit lineup structure**:

- **Starters** (5 players): 1.0x multiplier
- **Rotation** (3 players): 0.75x multiplier  
- **Bench** (2 players): 0.5x multiplier

## 🏗️ Architecture

### Database Schema

The system consists of **10 core tables** with full RLS policies, indexes, triggers, and views:

1. **`dfs_pools`** - Contest pools/slates
2. **`dfs_pool_games`** - Games included in each slate
3. **`dfs_entries`** - User contest entries
4. **`dfs_lineups`** - User lineups
5. **`dfs_lineup_positions`** - Individual player slots
6. **`dfs_player_salaries`** - Pool-specific player pricing
7. **`dfs_prize_structures`** - Prize distribution templates
8. **`dfs_payouts`** - Prize distributions
9. **`dfs_transactions`** - Financial ledger
10. **`dfs_user_balances`** - User account balances

### Salary Cap Tiers

Three difficulty tiers matching NBA salary cap structures:

| Tier | Cap Amount | Description |
|------|------------|-------------|
| **Elite** | $154.6M | Hardest - Luxury Tax Threshold |
| **Pro** | $195.9M | Medium - First Apron |
| **Standard** | $207.8M | Easiest - Second Apron |

## 📊 Data Flow

### 1. Pool Creation
```sql
INSERT INTO dfs_pools (
  name,
  slate_name,
  slate_date,
  start_time,
  lock_time,
  entry_fee,
  max_entries,
  salary_cap,
  difficulty_tier,
  status
) VALUES (
  'Sunday Main Slate',
  'Main Slate',
  '2025-10-26',
  '2025-10-26 13:00:00+00',
  '2025-10-26 13:00:00+00',
  10.00,
  1000,
  207800000, -- $207.8M
  'standard',
  'scheduled'
);
```

### 2. Add Games to Pool
```sql
INSERT INTO dfs_pool_games (pool_id, game_id, game_date, home_team, away_team)
SELECT 
  'pool-uuid',
  game_id,
  game_date,
  home_team_tricode,
  away_team_tricode
FROM nba_games
WHERE game_date::date = '2025-10-26'
  AND game_status IN (1, 2, 3); -- Scheduled, Live, or Final
```

### 3. Set Player Salaries
```sql
INSERT INTO dfs_player_salaries (
  pool_id,
  player_id,
  nba_player_id,
  player_name,
  player_team,
  salary,
  projected_points
)
SELECT 
  'pool-uuid',
  p.id,
  p.nba_player_id,
  p.name,
  p.team_abbreviation,
  -- Salary calculation based on projections, recent performance, etc.
  CASE 
    WHEN projected_fp > 50 THEN 11000000
    WHEN projected_fp > 40 THEN 9000000
    WHEN projected_fp > 30 THEN 7000000
    ELSE 5000000
  END as salary,
  projected_fp
FROM nba_players p
WHERE p.team_abbreviation IN (
  SELECT DISTINCT home_team FROM dfs_pool_games WHERE pool_id = 'pool-uuid'
  UNION
  SELECT DISTINCT away_team FROM dfs_pool_games WHERE pool_id = 'pool-uuid'
);
```

### 4. User Enters Contest
```sql
-- Create entry
INSERT INTO dfs_entries (pool_id, user_id, entry_fee_paid, status)
VALUES ('pool-uuid', 'user-uuid', 10.00, 'active')
RETURNING id;

-- Create lineup
INSERT INTO dfs_lineups (entry_id, pool_id, user_id)
VALUES ('entry-uuid', 'pool-uuid', 'user-uuid')
RETURNING id;
```

### 5. Build Lineup
```sql
-- Add starter (1.0x multiplier)
INSERT INTO dfs_lineup_positions (
  lineup_id,
  pool_id,
  player_id,
  nba_player_id,
  unit,
  unit_position,
  player_name,
  player_team,
  player_salary,
  unit_multiplier
) VALUES (
  'lineup-uuid',
  'pool-uuid',
  'player-uuid',
  2544, -- LeBron James
  'starters',
  1,
  'LeBron James',
  'LAL',
  11000000,
  1.00
);

-- Add rotation player (0.75x multiplier)
INSERT INTO dfs_lineup_positions (
  lineup_id,
  pool_id,
  player_id,
  nba_player_id,
  unit,
  unit_position,
  player_name,
  player_team,
  player_salary,
  unit_multiplier
) VALUES (
  'lineup-uuid',
  'pool-uuid',
  'player-uuid',
  201935, -- James Harden
  'rotation',
  1,
  'James Harden',
  'LAC',
  9500000,
  0.75
);

-- Add bench player (0.5x multiplier)
INSERT INTO dfs_lineup_positions (
  lineup_id,
  pool_id,
  player_id,
  nba_player_id,
  unit,
  unit_position,
  player_name,
  player_team,
  player_salary,
  unit_multiplier
) VALUES (
  'lineup-uuid',
  'pool-uuid',
  'player-uuid',
  1630166, -- Jalen Green
  'bench',
  1,
  'Jalen Green',
  'HOU',
  7000000,
  0.50
);
```

### 6. Calculate Total Salary
```sql
UPDATE dfs_lineups
SET 
  total_salary = (
    SELECT COALESCE(SUM(player_salary), 0)
    FROM dfs_lineup_positions
    WHERE lineup_id = 'lineup-uuid'
  ),
  remaining_salary = (
    SELECT p.salary_cap - COALESCE(SUM(lp.player_salary), 0)
    FROM dfs_pools p
    LEFT JOIN dfs_lineup_positions lp ON lp.lineup_id = 'lineup-uuid'
    WHERE p.id = 'pool-uuid'
    GROUP BY p.salary_cap
  ),
  is_complete = (
    SELECT COUNT(*) = (p.starters_count + p.rotation_count + p.bench_count)
    FROM dfs_pools p
    CROSS JOIN (
      SELECT COUNT(*) as player_count
      FROM dfs_lineup_positions
      WHERE lineup_id = 'lineup-uuid'
    ) lp
    WHERE p.id = 'pool-uuid'
  )
WHERE id = 'lineup-uuid';
```

### 7. Scoring After Games
```sql
-- Update player fantasy points
UPDATE dfs_lineup_positions lp
SET 
  raw_fantasy_points = (
    SELECT 
      COALESCE(SUM(
        (b.points * 1.0) +
        (b.three_pointers_made * 0.5) +
        (b.rebounds * 1.25) +
        (b.assists * 1.5) +
        (b.steals * 2.0) +
        (b.blocks * 2.0) +
        (b.turnovers * -1.0)
      ), 0)
    FROM nba_boxscores b
    JOIN dfs_pool_games pg ON b.game_id = pg.game_id
    WHERE b.player_id = lp.nba_player_id
      AND pg.pool_id = lp.pool_id
  ),
  weighted_points = raw_fantasy_points * unit_multiplier
WHERE pool_id = 'pool-uuid';

-- Calculate entry scores
UPDATE dfs_entries e
SET 
  raw_score = (
    SELECT COALESCE(SUM(raw_fantasy_points), 0)
    FROM dfs_lineup_positions lp
    JOIN dfs_lineups l ON lp.lineup_id = l.id
    WHERE l.entry_id = e.id
  ),
  final_score = (
    SELECT COALESCE(SUM(weighted_points), 0)
    FROM dfs_lineup_positions lp
    JOIN dfs_lineups l ON lp.lineup_id = l.id
    WHERE l.entry_id = e.id
  )
WHERE pool_id = 'pool-uuid';

-- Assign ranks
WITH ranked_entries AS (
  SELECT 
    id,
    RANK() OVER (PARTITION BY pool_id ORDER BY final_score DESC) as entry_rank
  FROM dfs_entries
  WHERE pool_id = 'pool-uuid'
)
UPDATE dfs_entries e
SET rank = re.entry_rank
FROM ranked_entries re
WHERE e.id = re.id;
```

### 8. Prize Distribution
```sql
-- Calculate prizes based on rank
WITH prize_calc AS (
  SELECT 
    e.id as entry_id,
    e.rank,
    p.prize_pool,
    CASE 
      WHEN e.rank = 1 THEN p.prize_pool * 0.40
      WHEN e.rank = 2 THEN p.prize_pool * 0.25
      WHEN e.rank = 3 THEN p.prize_pool * 0.15
      WHEN e.rank <= 10 THEN p.prize_pool * 0.05
      ELSE 0
    END as prize
  FROM dfs_entries e
  JOIN dfs_pools p ON e.pool_id = p.id
  WHERE p.id = 'pool-uuid'
)
UPDATE dfs_entries e
SET 
  prize_amount = pc.prize,
  status = 'completed'
FROM prize_calc pc
WHERE e.id = pc.entry_id;

-- Create payout records
INSERT INTO dfs_payouts (entry_id, pool_id, user_id, place, prize_amount, status)
SELECT 
  e.id,
  e.pool_id,
  e.user_id,
  e.rank,
  e.prize_amount,
  'pending'
FROM dfs_entries e
WHERE e.pool_id = 'pool-uuid'
  AND e.prize_amount > 0;
```

## 🔍 Key Queries

### Get Available Pools
```sql
SELECT * FROM dfs_active_pools_summary
WHERE status = 'scheduled'
  AND slate_date >= CURRENT_DATE
ORDER BY start_time;
```

### Get Pool Leaderboard
```sql
SELECT 
  e.rank,
  e.entry_name,
  e.final_score,
  e.prize_amount,
  u.email
FROM dfs_entries e
JOIN auth.users u ON e.user_id = u.id
WHERE e.pool_id = 'pool-uuid'
  AND e.status = 'completed'
ORDER BY e.rank;
```

### Get User's Entries
```sql
SELECT 
  e.*,
  p.name as pool_name,
  p.slate_date,
  l.total_salary,
  l.is_complete
FROM dfs_entries e
JOIN dfs_pools p ON e.pool_id = p.id
LEFT JOIN dfs_lineups l ON e.id = l.entry_id
WHERE e.user_id = 'user-uuid'
ORDER BY e.created_at DESC;
```

### Get Lineup with Players
```sql
SELECT 
  lp.*,
  lp.raw_fantasy_points,
  lp.weighted_points,
  CONCAT(
    CASE 
      WHEN lp.unit = 'starters' THEN 'S'
      WHEN lp.unit = 'rotation' THEN 'R'
      WHEN lp.unit = 'bench' THEN 'B'
    END,
    lp.unit_position
  ) as position_label
FROM dfs_lineup_positions lp
WHERE lp.lineup_id = 'lineup-uuid'
ORDER BY 
  CASE lp.unit
    WHEN 'starters' THEN 1
    WHEN 'rotation' THEN 2
    WHEN 'bench' THEN 3
  END,
  lp.unit_position;
```

### Player Ownership
```sql
UPDATE dfs_player_salaries ps
SET 
  ownership_count = (
    SELECT COUNT(*)
    FROM dfs_lineup_positions lp
    WHERE lp.pool_id = ps.pool_id
      AND lp.player_id = ps.player_id
  ),
  ownership_percentage = (
    SELECT (COUNT(*)::DECIMAL / NULLIF(p.current_entries, 0) * 100)
    FROM dfs_lineup_positions lp
    CROSS JOIN dfs_pools p
    WHERE lp.pool_id = ps.pool_id
      AND lp.player_id = ps.player_id
      AND p.id = ps.pool_id
  )
WHERE ps.pool_id = 'pool-uuid';
```

### User Statistics
```sql
SELECT * FROM dfs_user_statistics
WHERE user_id = 'user-uuid';
```

## 🎮 Frontend Integration

### Pool List Component
```typescript
interface DFSPool {
  id: string;
  name: string;
  slate_name: string;
  entry_fee: number;
  max_entries: number;
  current_entries: number;
  prize_pool: number;
  difficulty_tier: 'elite' | 'pro' | 'standard';
  salary_cap: number;
  start_time: string;
  lock_time: string;
}

const { data: pools } = useQuery({
  queryKey: ['dfs-pools'],
  queryFn: async () => {
    const { data } = await supabase
      .from('dfs_pools')
      .select('*')
      .eq('status', 'scheduled')
      .gte('slate_date', new Date().toISOString().split('T')[0])
      .order('start_time');
    return data as DFSPool[];
  }
});
```

### Lineup Builder Component
```typescript
const { data: availablePlayers } = useQuery({
  queryKey: ['dfs-player-salaries', poolId],
  queryFn: async () => {
    const { data } = await supabase
      .from('dfs_player_salaries')
      .select('*')
      .eq('pool_id', poolId)
      .eq('is_active', true)
      .order('salary', { ascending: false });
    return data;
  }
});

const addPlayerToLineup = useMutation({
  mutationFn: async ({
    lineupId,
    playerId,
    unit,
    position
  }: {
    lineupId: string;
    playerId: string;
    unit: 'starters' | 'rotation' | 'bench';
    position: number;
  }) => {
    const player = availablePlayers.find(p => p.player_id === playerId);
    
    const { data, error } = await supabase
      .from('dfs_lineup_positions')
      .insert({
        lineup_id: lineupId,
        pool_id: poolId,
        player_id: playerId,
        nba_player_id: player.nba_player_id,
        unit,
        unit_position: position,
        player_name: player.player_name,
        player_team: player.player_team,
        player_salary: player.salary,
        unit_multiplier: unit === 'starters' ? 1.0 : unit === 'rotation' ? 0.75 : 0.5
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['lineup', lineupId]);
    queryClient.invalidateQueries(['lineup-salary', lineupId]);
  }
});
```

## 🔐 Security Considerations

### RLS Policies
- ✅ Users can only view/edit their own entries and lineups
- ✅ Public pools are viewable by everyone
- ✅ Prize structures and player salaries are public for active pools
- ✅ Transactions and balances are private to each user

### Validation Rules
1. **Salary Cap**: Total lineup salary must not exceed pool cap
2. **Roster Size**: Must have exactly 5 starters, 3 rotation, 2 bench
3. **Unique Players**: Can't use same player twice in one lineup
4. **Entry Limits**: Respect max_entries_per_user
5. **Lock Time**: No lineup changes after pool locks

### Constraints
- Entry fees must be >= 0
- Prize amounts must be >= 0
- Salaries must be >= 0
- Unit positions must be valid for their unit
- Multipliers must be >= 0

## 🚀 Deployment Steps

1. **Run Migration**
```bash
cd /Users/adam/Desktop/hoopgeek
supabase migration new create_dfs_system
# Copy SQL content to migration file
supabase db push
```

2. **Verify Tables**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'dfs_%';
```

3. **Test RLS**
```sql
-- As authenticated user
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "user-uuid"}';

-- Try operations
SELECT * FROM dfs_pools;
SELECT * FROM dfs_entries WHERE user_id = 'user-uuid';
```

## 📈 Scaling Considerations

### Indexes
All critical queries are indexed:
- Pool lookups by status, date, visibility
- Entry lookups by user, pool, status
- Lineup position lookups by lineup, player
- Leaderboard queries by pool and score
- Transaction lookups by user and date

### Partitioning (Future)
For high volume, consider partitioning:
- `dfs_entries` by `created_at` (monthly)
- `dfs_transactions` by `created_at` (monthly)
- `dfs_lineup_positions` by `pool_id` (range)

### Caching Strategy
Cache these queries aggressively:
- Active pools list (5 minute cache)
- Player salaries (until lock time)
- Leaderboards for completed pools (indefinite)
- User stats (5 minute cache)

## 🧪 Testing Checklist

- [ ] Create pool with all three difficulty tiers
- [ ] Add games to pool slate
- [ ] Set player salaries
- [ ] User enters contest
- [ ] Build complete lineup (5+3+2)
- [ ] Validate salary cap enforcement
- [ ] Lock lineup at pool start
- [ ] Simulate games and update box scores
- [ ] Run scoring calculations
- [ ] Verify multipliers applied correctly
- [ ] Calculate final scores and ranks
- [ ] Distribute prizes
- [ ] Process payouts
- [ ] Verify transaction history

## 💰 Monetization Features

### Built-in Revenue Tracking
- `rake_percentage` on each pool (default 10%)
- Transaction ledger for full audit trail
- User balance management
- Payout processing tracking

### Future Enhancements
- Subscription tiers (premium users)
- Rake tiers based on volume
- Affiliate tracking
- Promotional bonus system
- Referral bonuses

## 🎯 Next Steps

1. **Build Frontend UI**
   - Pool list page
   - Pool details page
   - Lineup builder (based on existing Lineups.tsx)
   - Leaderboard page
   - User dashboard

2. **Edge Functions**
   - `auto-score-pools` - Automated scoring
   - `distribute-prizes` - Prize calculation and distribution
   - `process-payouts` - Payment processing
   - `calculate-player-salaries` - Dynamic salary generation

3. **Integrations**
   - Payment processor (Stripe/PayPal)
   - Email notifications
   - Push notifications
   - Social sharing

4. **Admin Tools**
   - Pool management dashboard
   - Transaction monitoring
   - User management
   - Fraud detection

---

**🏀 Ready for prime time. Let's build something amazing!**

