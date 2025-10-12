# Weekly Lineup System

## Overview

Separates **roster** (drafted players) from **weekly lineups** (active players each week).

## Key Concepts

### Roster vs Lineup
- **Roster:** Players you've drafted (e.g., 2C + 4G + 4F + 5UTIL = 15 players)
- **Lineup:** Each week, select which players to activate with different point multipliers

### Lineup Tiers

| Tier | Count | Default Multiplier | Configurable Count |
|------|-------|-------------------|-------------------|
| **Starters** | 5 (locked) | 1.0x (100%) | ❌ Always 5 |
| **Rotation** | 3-7 | 0.75x (75%) | ✅ Yes |
| **Bench** | 3-5 | 0.5x (50%) | ✅ Yes |

### Validation Rules

```
Starters + Rotation + Bench ≤ Roster Size
```

Example:
- Roster: 15 players (2C, 4G, 4F, 5UTIL)
- Lineup: 5 starters + 5 rotation + 3 bench = 13 players ✅
- Can't exceed 15 total

## Database Schema

### `league_settings` (Updated)

New columns:
```sql
starters_count INTEGER DEFAULT 5 (always 5)
starters_multiplier DECIMAL(4,2) DEFAULT 1.0
rotation_count INTEGER DEFAULT 5 (3-7 range)
rotation_multiplier DECIMAL(4,2) DEFAULT 0.75
bench_count INTEGER DEFAULT 3 (3-5 range)
bench_multiplier DECIMAL(4,2) DEFAULT 0.5
```

### `weekly_lineups` (New Table)

```sql
CREATE TABLE weekly_lineups (
  id UUID PRIMARY KEY,
  league_id UUID REFERENCES leagues,
  fantasy_team_id UUID REFERENCES fantasy_teams,
  season_year INTEGER,  -- For dynasty leagues (2025, 2026, etc.)
  week_number INTEGER,  -- 0 (preseason), 1-25
  player_id INTEGER REFERENCES players,
  lineup_tier TEXT,  -- 'starter', 'rotation', 'bench'
  multiplier DECIMAL(4,2),  -- Denormalized for performance
  is_locked BOOLEAN,  -- True once week starts
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  UNIQUE(league_id, fantasy_team_id, season_year, week_number, player_id)
);
```

## Helper Functions

### `validate_lineup_size()`
Validates that lineup meets all requirements:
- Total lineup ≤ Roster size
- Exact starter count (5)
- Exact rotation count (as configured)
- Exact bench count (as configured)

### `lock_lineups_for_week()`
Locks all lineups when a week starts (prevents changes mid-week)

## Migrations

### Run in Order:

1. **`20251012000010_add_weekly_lineup_system.sql`**
   - Adds lineup settings to `league_settings`
   - Creates `weekly_lineups` table
   - Creates helper functions
   - Sets up RLS policies

2. **`20251012000011_update_create_league_with_lineups.sql`**
   - Updates `create_league_with_commissioner()` to accept lineup parameters
   - Validates lineup size vs roster size
   - Creates league settings with lineup configuration

## Frontend Updates Needed

### LeagueCreationForm.tsx

Add new section: **"Weekly Lineup Configuration"**

Fields needed:
- **Starters Count:** Display only (locked at 5)
- **Starters Multiplier:** Number input (0-2, step 0.05, default 1.0)
- **Rotation Count:** Number input (3-7, default 5)
- **Rotation Multiplier:** Number input (0-2, step 0.05, default 0.75)
- **Bench Count:** Number input (3-5, default 3)
- **Bench Multiplier:** Number input (0-2, step 0.05, default 0.5)

**Live Validation:**
```typescript
const rosterSize = calculateRosterSize(rosterConfig);
const lineupSize = startersCount + rotationCount + benchCount;
const isValid = lineupSize <= rosterSize;
```

**Visual Feedback:**
```
Roster Size: 15 players
Lineup Size: 13 players (5 + 5 + 3) ✅

OR

Roster Size: 15 players
Lineup Size: 18 players (5 + 7 + 6) ❌ Exceeds roster!
```

### Edge Function Update

Update `supabase/functions/create-league/index.ts`:

```typescript
const {
  // ... existing fields
  // Add lineup settings
  startersCount,
  startersMultiplier,
  rotationCount,
  rotationMultiplier,
  benchCount,
  benchMultiplier
} = body;

const { data, error } = await supabase.rpc('create_league_with_commissioner', {
  // ... existing params
  starters_count_val: startersCount || 5,
  starters_multiplier_val: startersMultiplier || 1.0,
  rotation_count_val: rotationCount || 5,
  rotation_multiplier_val: rotationMultiplier || 0.75,
  bench_count_val: benchCount || 3,
  bench_multiplier_val: benchMultiplier || 0.5
});
```

## Future Features

1. **Auto-fill Lineups:** Suggest optimal lineup based on projections
2. **Lineup Templates:** Save lineup configurations for quick reuse
3. **Injury Auto-Adjust:** Automatically bench injured players
4. **Lineup Optimizer:** AI-powered lineup suggestions
5. **Quick Swap:** Drag-and-drop interface for lineup management
6. **Lineup Alerts:** Notify when lineup is incomplete or suboptimal
7. **Historical Lineups:** View past week lineups and performance
8. **Copy Previous Week:** Start with last week's lineup as template

## Scoring Example

**Team Roster:** 15 players
**Week 5 Lineup:**
- **Starters (5):** Curry (45 pts × 1.0 = 45), LeBron (42 × 1.0 = 42), ...
- **Rotation (5):** Jokic (38 × 0.75 = 28.5), AD (35 × 0.75 = 26.25), ...
- **Bench (3):** Tatum (30 × 0.5 = 15), Embiid (28 × 0.5 = 14), ...

**Total Week Score:** Sum of all multiplied points

## Dynasty League Support

The `season_year` field allows tracking lineups across multiple seasons:
- **2025 Season:** `season_year = 2025`, `week_number = 0-25`
- **2026 Season:** `season_year = 2026`, `week_number = 0-25`

Perfect for dynasty leagues where teams persist year-over-year.

## Status

✅ **Migrations Created**
- `20251012000010_add_weekly_lineup_system.sql`
- `20251012000011_update_create_league_with_lineups.sql`

→ **Next: Update LeagueCreationForm.tsx**

