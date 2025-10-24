# DFS System - Foreign Key Relationships

## ✅ Fixed Foreign Key Issues

All DFS tables now have **proper FOREIGN KEY constraints** to NBA data tables.

## 🔗 Foreign Key Mappings

### DFS → NBA Data Relationships

| DFS Table | Column | References | NBA Table | NBA Column | Action |
|-----------|--------|------------|-----------|------------|--------|
| **dfs_pool_games** | `game_id` | → | `nba_games` | `game_id` | `ON DELETE RESTRICT` |
| **dfs_lineup_positions** | `player_id` | → | `nba_players` | `id` | `ON DELETE RESTRICT` |
| **dfs_player_salaries** | `player_id` | → | `nba_players` | `id` | `ON DELETE RESTRICT` |

### DFS Internal Relationships

| Table | Column | References | Action |
|-------|--------|------------|--------|
| **dfs_pool_games** | `pool_id` | → `dfs_pools(id)` | `ON DELETE CASCADE` |
| **dfs_entries** | `pool_id` | → `dfs_pools(id)` | `ON DELETE CASCADE` |
| **dfs_entries** | `user_id` | → `auth.users(id)` | `ON DELETE CASCADE` |
| **dfs_lineups** | `entry_id` | → `dfs_entries(id)` | `ON DELETE CASCADE` |
| **dfs_lineups** | `pool_id` | → `dfs_pools(id)` | `ON DELETE CASCADE` |
| **dfs_lineups** | `user_id` | → `auth.users(id)` | `ON DELETE CASCADE` |
| **dfs_lineup_positions** | `lineup_id` | → `dfs_lineups(id)` | `ON DELETE CASCADE` |
| **dfs_lineup_positions** | `pool_id` | → `dfs_pools(id)` | `ON DELETE CASCADE` |
| **dfs_player_salaries** | `pool_id` | → `dfs_pools(id)` | `ON DELETE CASCADE` |
| **dfs_payouts** | `entry_id` | → `dfs_entries(id)` | `ON DELETE CASCADE` |
| **dfs_payouts** | `pool_id` | → `dfs_pools(id)` | `ON DELETE CASCADE` |
| **dfs_payouts** | `user_id` | → `auth.users(id)` | `ON DELETE CASCADE` |
| **dfs_transactions** | `user_id` | → `auth.users(id)` | `ON DELETE CASCADE` |
| **dfs_transactions** | `pool_id` | → `dfs_pools(id)` | (nullable) |
| **dfs_transactions** | `entry_id` | → `dfs_entries(id)` | (nullable) |
| **dfs_transactions** | `payout_id` | → `dfs_payouts(id)` | (nullable) |
| **dfs_user_balances** | `user_id` | → `auth.users(id)` | `ON DELETE CASCADE` |

## 🎯 Key Points

### Why RESTRICT for NBA Data?

```sql
CONSTRAINT fk_dfs_pool_games_game 
  FOREIGN KEY (game_id) 
  REFERENCES nba_games(game_id) 
  ON DELETE RESTRICT
```

**Reasoning**: We use `RESTRICT` instead of `CASCADE` for NBA data because:
1. **Data Integrity**: We never want to accidentally delete NBA games/players
2. **Historical Accuracy**: DFS contests are historical records
3. **Audit Trail**: Need to preserve contest data even if NBA data changes

### Why CASCADE for DFS Internal?

```sql
CONSTRAINT fk_dfs_lineups_entry
  FOREIGN KEY (entry_id)
  REFERENCES dfs_entries(id)
  ON DELETE CASCADE
```

**Reasoning**: We use `CASCADE` for internal DFS relationships because:
1. **Clean Deletion**: Deleting a pool should delete all related entries/lineups
2. **Data Consistency**: Orphaned records serve no purpose
3. **User Privacy**: When user deletes account, all their data should be removed

## 📊 Data Type Alignment

### Game IDs
```sql
-- NBA Games
nba_games.game_id VARCHAR(50)

-- DFS Pool Games
dfs_pool_games.game_id VARCHAR(50)  ✅ Matches
```

### Player IDs
```sql
-- NBA Players
nba_players.id UUID (Primary Key)
nba_players.nba_player_id INTEGER (Unique)

-- DFS Tables
dfs_lineup_positions.player_id UUID  ✅ References nba_players.id
dfs_lineup_positions.nba_player_id INTEGER  ℹ️ Denormalized for convenience

dfs_player_salaries.player_id UUID  ✅ References nba_players.id
dfs_player_salaries.nba_player_id INTEGER  ℹ️ Denormalized for convenience
```

### Team Abbreviations
```sql
-- NBA Teams
nba_teams.abbreviation VARCHAR(10)

-- DFS Tables (denormalized)
dfs_pool_games.home_team VARCHAR(10)  ℹ️ Denormalized (no FK needed)
dfs_pool_games.away_team VARCHAR(10)  ℹ️ Denormalized (no FK needed)
dfs_lineup_positions.player_team VARCHAR(10)  ℹ️ Historical snapshot
dfs_player_salaries.player_team VARCHAR(10)  ℹ️ Historical snapshot
```

**Note**: Team abbreviations are denormalized for performance and historical accuracy. We don't enforce FK constraints on these because:
1. Players can be traded mid-season
2. We want to preserve the team they were on when the contest ran
3. Performance: No need to join to teams table for every query

## 🔍 Verification Queries

### Check All Foreign Keys
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'dfs_%'
ORDER BY tc.table_name, kcu.column_name;
```

### Verify Game References
```sql
-- Check that all DFS pool games reference valid NBA games
SELECT 
  pg.*,
  g.game_status_text,
  g.home_team_tricode,
  g.away_team_tricode
FROM dfs_pool_games pg
LEFT JOIN nba_games g ON pg.game_id = g.game_id
WHERE g.game_id IS NULL;
-- Should return 0 rows
```

### Verify Player References
```sql
-- Check that all DFS lineup positions reference valid players
SELECT 
  lp.*,
  p.name,
  p.team_abbreviation
FROM dfs_lineup_positions lp
LEFT JOIN nba_players p ON lp.player_id = p.id
WHERE p.id IS NULL;
-- Should return 0 rows

-- Check that all DFS player salaries reference valid players
SELECT 
  ps.*,
  p.name,
  p.team_abbreviation
FROM dfs_player_salaries ps
LEFT JOIN nba_players p ON ps.player_id = p.id
WHERE p.id IS NULL;
-- Should return 0 rows
```

## 🚨 Migration Impact

### Before Foreign Keys
```sql
-- Could insert invalid data
INSERT INTO dfs_pool_games (pool_id, game_id, ...)
VALUES ('valid-pool-id', 'FAKE-GAME-123', ...);
-- ❌ Would succeed, creating orphaned data
```

### After Foreign Keys
```sql
-- Cannot insert invalid data
INSERT INTO dfs_pool_games (pool_id, game_id, ...)
VALUES ('valid-pool-id', 'FAKE-GAME-123', ...);
-- ✅ ERROR: foreign key constraint "fk_dfs_pool_games_game" violated
```

## 📝 Best Practices

### When Creating Pools
```sql
-- 1. Always verify game exists before adding to pool
SELECT game_id FROM nba_games WHERE game_id = 'target-game-id';

-- 2. Use this pattern for bulk insert
INSERT INTO dfs_pool_games (pool_id, game_id, game_date, home_team, away_team)
SELECT 
  'your-pool-id',
  game_id,
  game_date,
  home_team_tricode,
  away_team_tricode
FROM nba_games
WHERE game_date::date = '2025-10-26'
  AND game_status != 5; -- Exclude cancelled games
```

### When Setting Player Salaries
```sql
-- 1. Always join to nba_players for valid data
INSERT INTO dfs_player_salaries (
  pool_id, player_id, nba_player_id, 
  player_name, player_team, salary
)
SELECT 
  'your-pool-id',
  p.id,                    -- UUID from nba_players
  p.nba_player_id,         -- Integer player ID
  p.name,
  p.team_abbreviation,
  calculate_salary(p.id)   -- Your salary calculation
FROM nba_players p
WHERE p.is_active = true
  AND p.team_abbreviation IN (
    SELECT DISTINCT home_team FROM dfs_pool_games 
    WHERE pool_id = 'your-pool-id'
  );
```

### When Building Lineups
```sql
-- 1. Always verify player exists and has salary in pool
INSERT INTO dfs_lineup_positions (
  lineup_id, pool_id, player_id, nba_player_id,
  unit, unit_position, player_name, player_team, player_salary, unit_multiplier
)
SELECT 
  'lineup-id',
  ps.pool_id,
  ps.player_id,           -- FK verified
  ps.nba_player_id,
  'starters',
  1,
  ps.player_name,
  ps.player_team,
  ps.salary,
  1.0
FROM dfs_player_salaries ps
WHERE ps.pool_id = 'pool-id'
  AND ps.player_id = 'target-player-id'
  AND ps.is_active = true;
```

## ✅ Summary

All foreign key relationships are now properly configured:

- ✅ **NBA Game References**: `dfs_pool_games` → `nba_games`
- ✅ **NBA Player References**: `dfs_lineup_positions`, `dfs_player_salaries` → `nba_players`
- ✅ **Referential Integrity**: `RESTRICT` prevents accidental NBA data deletion
- ✅ **Cascade Deletes**: Internal DFS relationships clean up automatically
- ✅ **Type Safety**: All column types match their reference tables

Your DFS system now has **bulletproof data integrity**! 🛡️

---

**No more orphaned data. No more invalid references. Just clean, reliable database relationships.** 🎯

