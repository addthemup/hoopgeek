# Schedule Generator Fix

## Problems Fixed

### 1. ❌ No Schedule Rotation
**Before:** Teams played the same opponent EVERY week of the season
- Week 1: Team 1 vs Team 10, Team 2 vs Team 9, etc.
- Week 2: Team 1 vs Team 10, Team 2 vs Team 9, etc. (SAME!)
- Week 3: Team 1 vs Team 10, Team 2 vs Team 9, etc. (SAME!)

**After:** Proper round-robin rotation using the "Circle Method"
- Week 1: Team 1 vs Team 10, Team 2 vs Team 9, etc.
- Week 2: Team 1 vs Team 9, Team 10 vs Team 8, etc. (ROTATED!)
- Week 3: Team 1 vs Team 8, Team 9 vs Team 7, etc. (ROTATED!)

### 2. ❌ No Preseason Matchups
**Before:** No Week 0 matchups generated

**After:** 
- Generates Week 0 (Preseason) matchups
- Marked with `is_preseason = true`
- Scheduled 19 days before regular season start
- Results don't count in standings
- Random pairings for practice

## How It Works

### Preseason (Week 0)
```sql
-- Week 0: Preseason Sandbox
-- Date: season_start_date - 19 days (Oct 2 if season starts Oct 21)
-- Teams are randomly paired
-- is_preseason = true
-- Results do NOT affect standings
```

Example for 10-team league:
- Team 3 vs Team 7
- Team 1 vs Team 9
- Team 5 vs Team 2
- Team 8 vs Team 4
- Team 10 vs Team 6

### Regular Season (Weeks 1-25)
Uses the **Circle Method** (Round-Robin Tournament Algorithm):

1. **Keep one team fixed** (Team 1 stays in position 1)
2. **Rotate all other teams** clockwise each week
3. **Pair teams** across the circle

Example for 6-team league:

**Week 1:**
```
Fixed: Team 1
Circle: [Team 2, Team 3, Team 4, Team 5, Team 6]

Matchups:
- Team 1 vs Team 6 (positions 1 & 6)
- Team 2 vs Team 5 (positions 2 & 5)
- Team 3 vs Team 4 (positions 3 & 4)
```

**Week 2 (Rotate Circle):**
```
Fixed: Team 1
Circle: [Team 6, Team 2, Team 3, Team 4, Team 5] (rotated)

Matchups:
- Team 1 vs Team 5 (NEW!)
- Team 6 vs Team 4 (NEW!)
- Team 2 vs Team 3 (NEW!)
```

**Week 3 (Rotate Again):**
```
Fixed: Team 1
Circle: [Team 5, Team 6, Team 2, Team 3, Team 4]

Matchups:
- Team 1 vs Team 4 (NEW!)
- Team 5 vs Team 3 (NEW!)
- Team 6 vs Team 2 (NEW!)
```

### Playoff Schedule
- Generated after regular season
- Based on final standings (top N teams)
- Bracket-style matchups

## Benefits

✅ **Preseason Sandbox**
- Teams can practice lineup management
- Test features without consequences
- Learn the platform before season starts

✅ **Fair Schedule**
- Every team plays every other team (round-robin)
- No team plays the same opponent back-to-back
- Balanced matchups throughout season

✅ **Proper Tracking**
- `is_preseason` flag separates practice from real games
- Easy to filter out preseason results from standings
- Scoring logic can ignore preseason games

## Database Changes

### Migration File
`supabase/migrations/20251012000009_fix_schedule_generator.sql`

### Key Changes
1. Dropped old `generate_league_schedule` function
2. Created new version with:
   - Preseason matchup generation
   - Round-robin rotation algorithm
   - Proper `is_preseason` flag

### Running the Migration
```bash
cd /Users/adam/Desktop/hoopgeek
supabase db push
```

Or manually apply via Supabase Dashboard SQL Editor.

## Testing

### Test Preseason Generation
```sql
-- After creating a league, check for preseason matchups
SELECT 
  week_number,
  fantasy_team1_id,
  fantasy_team2_id,
  matchup_date,
  is_preseason
FROM weekly_matchups
WHERE league_id = 'YOUR_LEAGUE_ID'
  AND week_number = 0
ORDER BY matchup_date;
```

Expected: Should see Week 0 matchups with `is_preseason = true`

### Test Schedule Rotation
```sql
-- Check that teams don't play same opponent every week
SELECT 
  wm.week_number,
  ft1.team_name as team1,
  ft2.team_name as team2
FROM weekly_matchups wm
JOIN fantasy_teams ft1 ON wm.fantasy_team1_id = ft1.id
JOIN fantasy_teams ft2 ON wm.fantasy_team2_id = ft2.id
WHERE wm.league_id = 'YOUR_LEAGUE_ID'
  AND wm.season_type = 'regular'
ORDER BY wm.week_number, ft1.team_name;
```

Expected: Different matchups each week!

### Test Preseason Filtering
```sql
-- Get only REAL season games (exclude preseason)
SELECT *
FROM weekly_matchups
WHERE league_id = 'YOUR_LEAGUE_ID'
  AND is_preseason = false
ORDER BY week_number;
```

## Frontend Updates Needed

### 1. Standings Calculation
Make sure standings SKIP preseason games:

```typescript
// When calculating W/L records
const { data: matchups } = await supabase
  .from('weekly_matchups')
  .select('*')
  .eq('league_id', leagueId)
  .eq('is_preseason', false) // ← IMPORTANT!
  .eq('status', 'completed');
```

### 2. League Home Display
Show preseason message if we're in Week 0:

```typescript
{currentWeek?.week_number === 0 && (
  <Alert color="warning">
    <Typography>
      🏀 Preseason Practice Week - Results don't count in standings!
    </Typography>
  </Alert>
)}
```

### 3. Matchups List
Tag preseason games:

```typescript
{matchup.is_preseason && (
  <Chip size="sm" color="warning" variant="soft">
    Practice Game
  </Chip>
)}
```

### 4. Lineups Page
Allow lineup changes during preseason even after games start:

```typescript
const lineupsLocked = seasonPhase !== 'preseason' && /* existing lock logic */;
```

## Next Steps

1. ✅ Run the migration
2. ✅ Update frontend to handle preseason properly (`TeamSchedule.tsx` and `useTeamSchedule.ts`)
3. ✅ Join with `fantasy_season_weeks` for accurate dates
4. ✅ Display preseason badge in UI
5. → Update scoring functions to skip `is_preseason = true` matchups
6. → Test creating a new league and verify schedule looks good
7. → Build full lineup locking system that respects preseason

## Notes

- Preseason date is hardcoded as 19 days before regular season start
- This matches NBA preseason timing (Oct 2-20 → Oct 21 start)
- Playoff matchups are simplified and don't use actual standings yet
- Future: Reseed playoffs based on actual regular season results

