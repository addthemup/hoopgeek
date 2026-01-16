# DFS Testing Scripts

This directory contains scripts for testing DFS functionality on a macro level by generating procedural data and populating pools with simulated entries.

## Overview

1. **`generate_procedural_trailing_data.py`** - Generates realistic `nba_boxscores` data for testing DFS scoring
2. **`populate_dfs_pools_with_entries.py`** - Populates existing `dfs_pools` with simulated entries from real users

## Prerequisites

1. Install required Python packages:
```bash
pip install supabase python-dotenv
```

2. Set environment variables:
```bash
export VITE_SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Or create a `.env` file:
```
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Apply the helper SQL migration:
```bash
# Run this in Supabase SQL Editor
psql -f supabase/migrations/add_dfs_testing_helpers.sql
```

## Scripts

### 1. Generate Procedural Trailing Data

Generates realistic `nba_boxscores` data for testing. This creates player stats that can be used to test DFS scoring calculations.

**Usage:**

```bash
# Generate data for a specific game
python scripts/generate_procedural_trailing_data.py --game-id 0022500357

# Generate data for a specific date
python scripts/generate_procedural_trailing_data.py --date 2025-12-07

# Generate data for a date range
python scripts/generate_procedural_trailing_data.py --date-range 2025-11-01 2025-11-30

# Use position defaults instead of historical averages
python scripts/generate_procedural_trailing_data.py --date 2025-12-07 --no-historical

# Overwrite existing boxscores
python scripts/generate_procedural_trailing_data.py --date 2025-12-07 --overwrite
```

**How it works:**
- For each game, it finds all players who should have played
- For each player, it either:
  - Uses their historical averages from existing boxscores (if available)
  - Uses position-based defaults (PG, SG, SF, PF, C)
- Generates realistic stats with variance
- Inserts/updates `nba_boxscores` table

**Options:**
- `--game-id`: Generate for a specific game ID
- `--date`: Generate for all games on a date (YYYY-MM-DD)
- `--date-range`: Generate for all games in a date range
- `--no-historical`: Don't use historical averages, use position defaults
- `--overwrite`: Overwrite existing boxscores

### 2. Populate DFS Pools with Entries

Populates existing `dfs_pools` with simulated entries from real users. Creates complete lineups that respect salary caps and roster requirements.

**Usage:**

```bash
# Populate a specific pool
python scripts/populate_dfs_pools_with_entries.py --pool-id <pool_id> --entries-per-pool 10

# Populate all pools
python scripts/populate_dfs_pools_with_entries.py --all-pools --entries-per-pool 10

# Populate pools for a specific date
python scripts/populate_dfs_pools_with_entries.py --date 2025-11-18 --entries-per-pool 5
```

**How it works:**
- Gets all available users from the database
- For each pool:
  - Gets all available players from `dfs_player_salaries`
  - Creates entries for multiple users
  - For each entry:
    - Selects a lineup strategy (balanced, stars_and_scrubs, random)
    - Creates a valid lineup respecting salary cap
    - Creates lineup positions (starters, rotation, bench)
    - Updates pool entry count

**Options:**
- `--pool-id`: Populate a specific pool
- `--all-pools`: Populate all pools
- `--date`: Populate pools for a specific date (YYYY-MM-DD)
- `--entries-per-pool`: Number of entries to create per pool (default: 10)

**Lineup Strategies:**
- `balanced`: Mix of high, mid, and low salary players
- `stars_and_scrubs`: Expensive stars + cheap scrubs
- `random`: Random selection

## Testing Workflow

1. **Generate trailing data for games:**
   ```bash
   # Generate data for games in your pools
   python scripts/generate_procedural_trailing_data.py --date 2025-11-18
   ```

2. **Populate pools with entries:**
   ```bash
   # Fill pools with simulated entries
   python scripts/populate_dfs_pools_with_entries.py --date 2025-11-18 --entries-per-pool 10
   ```

3. **Test scoring:**
   ```sql
   -- Run scoring function for a pool
   SELECT * FROM update_lineup_position_scores('pool-id-here');
   
   -- Check results
   SELECT 
     e.id,
     e.user_id,
     e.final_score,
     e.rank
   FROM dfs_entries e
   WHERE e.pool_id = 'pool-id-here'
   ORDER BY e.final_score DESC;
   ```

## Example: Complete Testing Session

```bash
# 1. Generate boxscores for a date range
python scripts/generate_procedural_trailing_data.py \
  --date-range 2025-11-01 2025-11-30 \
  --overwrite

# 2. Populate all pools for those dates
python scripts/populate_dfs_pools_with_entries.py \
  --date 2025-11-18 \
  --entries-per-pool 20

# 3. Test scoring (in Supabase SQL Editor)
SELECT * FROM update_lineup_position_scores('07382ee2-289c-445b-994d-de4e987796e7');

# 4. View leaderboard
SELECT 
  e.id,
  e.user_id,
  e.final_score,
  e.rank,
  l.total_salary
FROM dfs_entries e
JOIN dfs_lineups l ON e.lineup_id = l.id
WHERE e.pool_id = '07382ee2-289c-445b-994d-de4e987796e7'
ORDER BY e.final_score DESC
LIMIT 10;
```

## Notes

- Both scripts use the service role key to bypass RLS
- Generated data is realistic but synthetic - don't use for production analysis
- The populate script respects all pool constraints (salary cap, roster size, etc.)
- Historical averages are calculated from existing `nba_boxscores` data
- If no historical data exists, position-based defaults are used

## Troubleshooting

**"No users found"**
- Make sure you have users in your database
- Check that the `get_all_user_ids()` function exists
- Try using the `profiles` table fallback

**"No players found for pool"**
- Make sure `dfs_player_salaries` has data for the pool
- Check that players are marked as `is_active = true`

**"Not enough players"**
- Pools need at least `starters_count + rotation_count + bench_count` players
- Check `dfs_player_salaries` for the pool

**"Boxscores already exist"**
- Use `--overwrite` flag to regenerate
- Or delete existing boxscores first

