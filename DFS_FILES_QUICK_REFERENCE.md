# DFS Files Quick Reference Card 📋

## 📁 File Structure

```
/Users/adam/Desktop/hoopgeek/
│
├── supabase/migrations/
│   ├── create_dfs_system.sql ...................... Core DFS tables & structure
│   ├── integrate_dfs_with_real_salaries.sql ....... Real NBA salary integration
│   ├── dfs_admin_pool_creation.sql ................ Admin functions to create pools
│   ├── dfs_team_of_week_function.sql .............. Team of Week display function
│   ├── create_admin_system.sql .................... Secure admin panel
│   └── verify_dfs_foreign_keys.sql ................ Verification script
│
├── src/components/DFS/
│   ├── TodaysContests.tsx ......................... MUI Joy Data Table for pools
│   └── TeamOfTheWeek.tsx .......................... Basketball court visualization
│
└── Documentation/
    ├── DFS_REAL_SALARY_DIFFERENTIATOR.md .......... Marketing & differentiator
    ├── DFS_BACKEND_COMPLETE_GUIDE.md .............. Technical guide
    ├── DFS_READY_TO_MIGRATE.md .................... Migration checklist
    ├── DFS_FOREIGN_KEY_REFERENCE.md ............... FK relationships
    └── DFS_FILES_QUICK_REFERENCE.md ............... This file
```

---

## 🔑 Key Database Relationships

```
nba_games (game_id)
    ↓ FK
dfs_pool_games (game_id) ──→ Admin selects games
    ↓
Auto-populates teams
    ↓
nba_players (team_abbreviation) ──→ Players from those teams
    ↓ FK
dfs_player_salaries (player_id) ──→ With REAL NBA salaries
    ↓ FK
dfs_lineup_positions (player_id) ──→ User builds lineup
```

---

## 🎯 Main Functions

### Admin Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `get_available_nba_games_for_dfs()` | Get games for a date | `DATE` | List of games |
| `get_dfs_players_for_games()` | Preview players | `game_ids[]` | Players from those teams |
| `create_dfs_pool_from_games()` | Create pool | Pool config + game IDs | Pool ID + stats |
| `update_dfs_player_projections()` | Update projections | `pool_id` | Players updated count |

### Public Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `get_dfs_team_of_week()` | Top 5 performers | None | 5 best players this week |
| `get_dfs_weekly_leaders_by_position()` | Top 10 per position | `position` | Top performers |
| `generate_dfs_salaries_from_real_contracts()` | Populate salaries | `pool_id` | Salary stats |
| `validate_dfs_lineup_salary()` | Check cap | `lineup_id` | Is valid + breakdown |

---

## 📊 Views

| View | Purpose | Access |
|------|---------|--------|
| `dfs_todays_contests` | Public pool listing | Everyone |
| `dfs_admin_pool_summary` | Admin dashboard | Admins only |
| `dfs_lineup_summary` | Lineup breakdown | Authenticated users |

---

## 💰 Salary Cap Tiers

```typescript
const SALARY_CAPS = {
  elite: 154_600_000,    // $154.6M - Luxury Tax (HARDEST)
  pro: 195_900_000,      // $195.9M - First Apron (MEDIUM)
  standard: 207_800_000  // $207.8M - Second Apron (EASIEST)
};
```

---

## 🏀 3-Unit System

```typescript
const LINEUP_STRUCTURE = {
  starters: {
    count: 5,
    multiplier: 1.0,
    positions: ['PG', 'SG', 'SF', 'PF', 'C']
  },
  rotation: {
    count: 3,
    multiplier: 0.75,
    positions: ['Any']
  },
  bench: {
    count: 2,
    multiplier: 0.5,
    positions: ['Any']
  }
};

// Total: 10 players per lineup
```

---

## 🚀 Quick Migration Commands

```sql
-- 1. Check prerequisites
SELECT 
  (SELECT COUNT(*) FROM nba_games) as games,
  (SELECT COUNT(*) FROM nba_players WHERE is_active = TRUE) as players,
  (SELECT COUNT(*) FROM nba_hoopshype_salaries WHERE salary_2025_26 IS NOT NULL) as salaries;

-- 2. Apply migrations (in Supabase SQL Editor)
-- Copy/paste each file in order:
-- - create_dfs_system.sql
-- - integrate_dfs_with_real_salaries.sql
-- - dfs_admin_pool_creation.sql
-- - dfs_team_of_week_function.sql
-- - create_admin_system.sql

-- 3. Verify
-- Copy/paste: verify_dfs_foreign_keys.sql

-- 4. Make yourself admin
INSERT INTO admin_users (user_id, email, role, is_active)
VALUES ('your-user-id', 'your-email', 'super_admin', TRUE);

-- 5. Test pool creation
SELECT * FROM create_dfs_pool_from_games(
  'admin-user-id'::UUID,
  'Test Pool',
  'Testing',
  'Test Slate',
  CURRENT_DATE,
  ARRAY['game-id-1', 'game-id-2'],
  5.00, 100, 'standard', 'top_n', FALSE, FALSE
);

-- 6. View pool
SELECT * FROM dfs_todays_contests;
```

---

## 🎨 Frontend Quick Start

```typescript
// 1. Import components
import TodaysContests from '../components/DFS/TodaysContests';
import TeamOfTheWeek from '../components/DFS/TeamOfTheWeek';

// 2. Add to DFS page
export default function DFS() {
  return (
    <Box>
      <TeamOfTheWeek />
      <TodaysContests />
    </Box>
  );
}

// 3. Add route
<Route path="dfs" element={<DFS />} />
```

---

## 🔍 Common Queries

### Get Available Games Today
```sql
SELECT * FROM get_available_nba_games_for_dfs(CURRENT_DATE);
```

### Preview Players for Games
```sql
SELECT * FROM get_dfs_players_for_games(
  ARRAY['0022500001', '0022500002']
);
```

### View Today's Contests
```sql
SELECT * FROM dfs_todays_contests;
```

### Get Team of the Week
```sql
SELECT * FROM get_dfs_team_of_week();
```

### Check Player's Real Salary
```sql
SELECT 
  p.name,
  p.team_abbreviation,
  hs.salary_2025_26
FROM nba_players p
JOIN nba_hoopshype_salaries hs ON p.id = hs.player_id
WHERE p.name ILIKE '%curry%';
```

### Find Pools a Player is in
```sql
SELECT 
  p.name,
  ps.pool_id,
  ps.salary,
  ps.projected_points
FROM dfs_player_salaries ps
JOIN nba_players p ON ps.player_id = p.id
WHERE p.name ILIKE '%lebron%';
```

---

## 🎯 Key Differentiators

| Feature | Traditional DFS | Your Platform |
|---------|----------------|---------------|
| **Salaries** | Fake ($11,500) | Real ($48.7M) |
| **Transparency** | Black box | Verifiable contracts |
| **Changes** | Daily | Fixed (season) |
| **Strategy** | "Fade" pricing | Build like GM |
| **Caps** | Arbitrary ($50K) | Real NBA ($154.6M+) |
| **Education** | None | Learn NBA economics |

---

## 📞 Help & References

- **Full Technical Guide**: `DFS_BACKEND_COMPLETE_GUIDE.md`
- **Marketing Strategy**: `DFS_REAL_SALARY_DIFFERENTIATOR.md`
- **Migration Guide**: `DFS_READY_TO_MIGRATE.md`
- **Foreign Keys**: `DFS_FOREIGN_KEY_REFERENCE.md`

---

## ✅ Pre-Migration Checklist

- [ ] `nba_games` table populated (1,230+ games)
- [ ] `nba_players` table populated (450+ active)
- [ ] `nba_hoopshype_salaries` has 2025-26 data (400+ players)
- [ ] `nba_boxscores` table populated (for fantasy pts)
- [ ] `nba_season_weeks` table exists (for Team of Week)

---

## 🚀 Post-Migration Checklist

- [ ] All SQL migrations applied
- [ ] Verification script shows all ✅
- [ ] Admin user created
- [ ] Test pool created successfully
- [ ] Pool appears in `dfs_todays_contests`
- [ ] Players have real salaries
- [ ] Team of Week displays
- [ ] Today's Contests table works

---

## 💡 Pro Tips

1. **Start with Standard difficulty** ($207.8M cap) - easiest to build lineups
2. **Test with 2-3 games** initially - easier to verify
3. **Use recent games** for testing - boxscore data available
4. **Check salary distribution** - should range from $1.1M to $51.9M
5. **Verify FKs** - run verification script after migration

---

**EVERYTHING IS READY. TIME TO MIGRATE! 🚀**

