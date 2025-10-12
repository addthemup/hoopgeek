# Schedule Dates & Playoff Weeks - FIXED ✅

## What Was Wrong

### ❌ Problem 1: Dates Didn't Match Database
Your team schedule showed:
- Week 0: Sep 22-28 (should be Oct 2-20)
- Week 1: Oct 11-17 (should be Oct 21-26)
- Week 2: Oct 18-24 (should be Oct 27 - Nov 2)

**Root Cause:** Schedule generator was calculating dates manually instead of using `fantasy_season_weeks` table.

### ❌ Problem 2: Wrong Playoff Weeks
For 3-week playoff, schedule showed:
- Weeks 19, 20, 21 = Playoffs (WRONG!)

Should be:
- Weeks 23, 24, 25 = Playoffs (last 3 weeks)

**Root Cause:** Playoffs started at `regular_season_weeks + 1` instead of `total_weeks - playoff_weeks + 1`.

### ❌ Problem 3: No Rotation
Teams played same opponent every week:
- Week 1: Team A vs Team B
- Week 2: Team A vs Team B (again!)
- Week 3: Team A vs Team B (again!)

**Root Cause:** No rotation algorithm implemented.

## What's Fixed

### ✅ Fix 1: Uses `fantasy_season_weeks` Table

**Before:**
```sql
-- Manual calculation (WRONG)
matchup_date := season_start_date + (week_num - 1) * INTERVAL '7 days';
```

**After:**
```sql
-- Fetch from database (CORRECT)
SELECT start_date, end_date INTO week_record
FROM fantasy_season_weeks
WHERE season_year = 2025 AND week_number = week_num;

INSERT INTO weekly_matchups (matchup_date, ...)
VALUES (week_record.start_date, ...);
```

### ✅ Fix 2: Correct Playoff Week Calculation

**Before:**
```sql
-- Playoffs started too early
playoff_start_week := regular_season_weeks + 1; -- Week 19!
```

**After:**
```sql
-- Playoffs are LAST N weeks
const total_weeks = 25;
playoff_start_week := total_weeks - playoff_weeks + 1; -- Week 23 for 3-week playoff!
regular_season_weeks := playoff_start_week - 1; -- Weeks 1-22
```

**Examples:**
- 2-week playoff: Weeks **24, 25** (regular season = weeks 1-23)
- 3-week playoff: Weeks **23, 24, 25** (regular season = weeks 1-22)
- 4-week playoff: Weeks **22, 23, 24, 25** (regular season = weeks 1-21)
- 5-week playoff: Weeks **21, 22, 23, 24, 25** (regular season = weeks 1-20)

### ✅ Fix 3: Round-Robin Rotation

**Circle Method Algorithm:**
1. Fix one team in position 1
2. Rotate all other teams clockwise each week
3. Pair teams across the circle

**Result:**
- Week 1: Team A vs Team J, Team B vs Team I, Team C vs Team H...
- Week 2: Team A vs Team I, Team J vs Team H, Team B vs Team G...
- Week 3: Team A vs Team H, Team I vs Team G, Team J vs Team F...

Every team plays every other team!

### ✅ Fix 4: Preseason Week 0

**Added:**
- Week 0 with `is_preseason = true`
- Random team pairings
- Does NOT count in standings
- Shows "Preseason (Practice)" badge

## Files Updated

### Database
1. `supabase/migrations/20251012000008_add_is_preseason_column.sql` - Adds preseason flag
2. `supabase/migrations/20251012000009_fix_schedule_generator.sql` - Complete rewrite
3. `supabase/database.sql` - Updated function call

### Frontend
4. `src/hooks/useTeamSchedule.ts` - Joins with `fantasy_season_weeks`, fetches preseason flag
5. `src/components/TeamSchedule.tsx` - Displays preseason badge

## Expected Schedule After Fix

### For 3-Week Playoff League (Your Case)

```
Week 0: Oct 2-20       [Preseason (Practice)] ⚠️
Week 1: Oct 21-26      [Regular Season] ✓
Week 2: Oct 27-Nov 2   [Regular Season] ✓
Week 3: Nov 3-9        [Regular Season] ✓
...
Week 22: Mar 16-22     [Regular Season] ✓
Week 23: Mar 23-29     [Playoff Round 1] 🏆
Week 24: Mar 30-Apr 5  [Playoff Round 2] 🏆
Week 25: Apr 6-12      [Championship] 🏆
```

### For 2-Week Playoff League

```
Week 0: Oct 2-20       [Preseason] ⚠️
Weeks 1-23: Regular Season ✓
Week 24: Mar 30-Apr 5  [Playoff Round 1] 🏆
Week 25: Apr 6-12      [Championship] 🏆
```

## How to Apply

### Step 1: Run Migrations

```bash
cd /Users/adam/Desktop/hoopgeek
supabase db push
```

Or manually via Supabase Dashboard → SQL Editor:
1. Run `20251012000008_add_is_preseason_column.sql`
2. Run `20251012000009_fix_schedule_generator.sql`

### Step 2: Regenerate Schedule for Existing League

If you want to fix the schedule for your current league:

```sql
-- Delete old schedule
DELETE FROM weekly_matchups WHERE league_id = 'YOUR_LEAGUE_ID';

-- Regenerate with correct function
SELECT generate_league_schedule(
  'YOUR_LEAGUE_ID'::uuid,
  22,  -- regular_season_weeks (will be recalculated)
  6,   -- playoff_teams
  3,   -- playoff_weeks (weeks 23, 24, 25)
  2025 -- season_year
);
```

### Step 3: Verify

Check your team schedule - dates should now match `fantasy_season_weeks`!

```
✅ Week 0: Oct 2-20 (Preseason)
✅ Week 1: Oct 21-26
✅ Week 2: Oct 27 - Nov 2
✅ Week 3: Nov 3-9
...
✅ Week 23: Mar 23-29 (Playoff)
✅ Week 24: Mar 30 - Apr 5 (Playoff)
✅ Week 25: Apr 6-12 (Championship)
```

## Testing Your Schedule

### Query to Verify

```sql
-- Check that schedule matches fantasy_season_weeks
SELECT 
  wm.week_number,
  fsw.week_name,
  fsw.start_date as expected_start,
  wm.matchup_date as actual_start,
  CASE 
    WHEN fsw.start_date = wm.matchup_date THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status,
  wm.season_type,
  wm.is_preseason
FROM weekly_matchups wm
JOIN fantasy_season_weeks fsw 
  ON fsw.week_number = wm.week_number 
  AND fsw.season_year = wm.season_year
WHERE wm.league_id = 'YOUR_LEAGUE_ID'
ORDER BY wm.week_number;
```

Expected: All rows should show `✅ MATCH`

### Check Playoff Weeks

```sql
-- Verify playoffs are in the correct weeks
SELECT week_number, season_type, is_preseason
FROM weekly_matchups
WHERE league_id = 'YOUR_LEAGUE_ID'
  AND season_type = 'playoff'
ORDER BY week_number;
```

For 3-week playoff, should return:
- Week 23 (playoff)
- Week 24 (playoff)
- Week 25 (playoff)

### Check Rotation

```sql
-- Verify teams don't play same opponent multiple times in a row
WITH matchup_pairs AS (
  SELECT 
    week_number,
    LEAST(fantasy_team1_id::text, fantasy_team2_id::text) || '-' || 
    GREATEST(fantasy_team1_id::text, fantasy_team2_id::text) as pair
  FROM weekly_matchups
  WHERE league_id = 'YOUR_LEAGUE_ID'
    AND season_type = 'regular'
  ORDER BY week_number
)
SELECT 
  week_number,
  pair,
  LAG(week_number) OVER (PARTITION BY pair ORDER BY week_number) as prev_week
FROM matchup_pairs
WHERE LAG(week_number) OVER (PARTITION BY pair ORDER BY week_number) IS NOT NULL
  AND week_number = LAG(week_number) OVER (PARTITION BY pair ORDER BY week_number) + 1;
```

Expected: No rows (teams never play back-to-back weeks)

## Benefits

### ✅ Accurate Dates
- Matches official NBA season calendar
- Consistent across all views
- No more manual calculations

### ✅ Flexible Playoffs
- Commissioners choose 2-5 week playoffs
- Always ends on Week 25 (season finale)
- Regular season adjusts automatically

### ✅ Fair Competition
- Round-robin ensures everyone plays everyone
- No repeat matchups until necessary
- Balanced schedule

### ✅ Preseason Practice
- Week 0 for learning the platform
- Doesn't affect standings
- Set lineups without pressure

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Week 0 Dates** | Sep 22-28 ❌ | Oct 2-20 ✅ |
| **Week 1 Dates** | Oct 11-17 ❌ | Oct 21-26 ✅ |
| **Playoff Weeks (3-week)** | 19, 20, 21 ❌ | 23, 24, 25 ✅ |
| **Schedule Rotation** | None ❌ | Round-robin ✅ |
| **Preseason** | Missing ❌ | Week 0 ✅ |
| **Date Source** | Calculated ❌ | Database ✅ |

**Status: ✅ READY TO DEPLOY**

