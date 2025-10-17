# Draft Roster Spots - Issue Analysis & Fix

## 🐛 The Problem

You reported that draft picks are **ADD-ing new rows** to `fantasy_roster_spots` instead of **UPDATE-ing existing rows**, causing:
1. Too many roster spots per team
2. Incorrect salary cap calculations
3. Roster bloat

---

## ✅ The Good News

After reviewing the code, **the logic is actually CORRECT** in all the right places:

### 1. `make_draft_pick` SQL Function (Correct! ✅)

```sql
-- Lines 119-146 in supabase/build/make_draft_pick.sql

-- Find the first AVAILABLE roster spot (player_id IS NULL)
SELECT id INTO available_spot_id
FROM fantasy_roster_spots
WHERE fantasy_team_id = draft_order_record.team_id
AND player_id IS NULL
ORDER BY created_at ASC
LIMIT 1;

-- UPDATE the existing spot (NOT INSERT!)
UPDATE fantasy_roster_spots
SET 
    player_id = player_id_param,
    assigned_at = NOW(),
    draft_round = draft_order_record.round,
    draft_pick = draft_order_record.pick_number,
    updated_at = NOW()
WHERE id = available_spot_id;
```

**This is the CORRECT implementation!** It:
- ✅ Finds an empty roster spot
- ✅ UPDATES it with the player
- ✅ NEVER inserts new spots

### 2. Draft Manager (Correct! ✅)

```typescript
// Lines 668-673 in supabase/functions/draft-manager/index.ts

const { data: pickResult, error: pickError } = await supabase
  .rpc('make_draft_pick', {
    league_id_param: leagueId,
    draft_order_id_param: currentPick.id,
    player_id_param: bestPlayer.id
  });
```

**Correctly calls the `make_draft_pick` function!**

### 3. Frontend Hook (Correct! ✅)

```typescript
// Lines 29-34 in src/hooks/useMakeDraftPick.ts

const { data, error } = await supabase
  .rpc('make_draft_pick', {
    league_id_param: leagueId,
    draft_order_id_param: draftOrder.id,
    player_id_param: playerId
  });
```

**Also correctly calls the `make_draft_pick` function!**

---

## 🤔 So What's Going Wrong?

If roster spots are being added incorrectly, it's likely happening in ONE of these scenarios:

### Scenario 1: Initial Roster Creation Running Multiple Times

The `useRosterManagement.ts` hook creates roster spots **on first team setup**. If this runs multiple times, you'll get duplicates.

**Check:**
- Are teams being created multiple times?
- Is the roster initialization running on every page load?

### Scenario 2: Database Has Duplicate Spots Already

If roster spots were created incorrectly in the past, they may still exist.

### Scenario 3: Different Code Path

There may be another place in the code that's inserting roster spots that we haven't found yet.

---

## 🔧 The Fix

### Step 1: Run the Diagnostic Script

```bash
# Connect to your Supabase database and run:
psql $DATABASE_URL -f supabase/build/fix_draft_roster_spots.sql
```

This script will:
1. ✅ Check each team's roster spot count
2. ✅ Find duplicate roster spots
3. ✅ Verify `make_draft_pick` function is correct
4. ✅ Clean up any duplicates
5. ✅ Provide a final report

### Step 2: Check the Output

The script will tell you:
- Which teams have too many/few roster spots
- If duplicates were found and removed
- If the `make_draft_pick` function is correct

### Step 3: Identify the Root Cause

Based on the script output, determine:

**If duplicates were found:**
- Something created extra roster spots
- Check when they were created (`created_at` timestamps)
- Look for patterns (all at once? gradually?)

**If roster counts are wrong:**
- Initial team setup is broken
- Check `useRosterManagement.ts` initialization logic

**If everything looks fine:**
- The issue may have been fixed already
- Or it's a display/query issue, not a data issue

---

## 🎯 Prevention

### Ensure Roster Spots Are Created Only Once

In `useRosterManagement.ts`, check if spots exist BEFORE creating:

```typescript
// Check if roster spots already exist
const { data: existingSpots } = await supabase
  .from('fantasy_roster_spots')
  .select('id')
  .eq('fantasy_team_id', fantasyTeamId)
  .limit(1);

if (existingSpots && existingSpots.length > 0) {
  console.log('✅ Roster spots already exist, skipping creation');
  return; // Don't create again!
}

// Only create if none exist
const rosterEntries = positions.map((position, index) => ({
  fantasy_team_id: fantasyTeamId,
  season_id: teamData.season_id,
  player_id: null,
  // ... rest of fields
}));

await supabase
  .from('fantasy_roster_spots')
  .insert(rosterEntries);
```

### Add a Database Constraint

Prevent duplicates at the database level:

```sql
-- Ensure each team has unique position_order values
CREATE UNIQUE INDEX IF NOT EXISTS unique_team_position 
ON fantasy_roster_spots(fantasy_team_id, position_order);
```

---

## 🔍 Debugging Queries

### Check Specific Team's Roster Spots

```sql
SELECT 
    ft.team_name,
    COUNT(frs.id) as total_spots,
    COUNT(frs.player_id) as filled_spots,
    COUNT(CASE WHEN frs.player_id IS NULL THEN 1 END) as empty_spots
FROM fantasy_teams ft
LEFT JOIN fantasy_roster_spots frs ON ft.id = frs.fantasy_team_id
WHERE ft.id = 'YOUR_TEAM_ID_HERE'
GROUP BY ft.team_name;
```

### See Which Picks Were Made

```sql
SELECT 
    fdp.pick_number,
    fdp.round,
    ft.team_name,
    np.name as player_name,
    fdp.created_at
FROM fantasy_draft_picks fdp
INNER JOIN fantasy_teams ft ON fdp.fantasy_team_id = ft.id
INNER JOIN nba_players np ON fdp.player_id = np.id
WHERE fdp.league_id = 'YOUR_LEAGUE_ID'
ORDER BY fdp.pick_number;
```

### Check for Duplicate Roster Spots

```sql
SELECT 
    fantasy_team_id,
    position_order,
    COUNT(*) as count
FROM fantasy_roster_spots
GROUP BY fantasy_team_id, position_order
HAVING COUNT(*) > 1;
```

---

## 📊 Expected vs Actual

### Expected Behavior:
1. Team is created → Roster spots are created (all with `player_id = NULL`)
2. Draft pick is made → ONE roster spot is UPDATED with `player_id`
3. Next pick → NEXT roster spot is UPDATED
4. After draft → All roster spots should have `player_id` (no extras)

### What You're Seeing:
- Roster spots > expected number
- Salary cap calculations off
- Suggests: Roster spots being created during draft, not just initial setup

---

## ✅ Action Items

1. **Run the diagnostic script**: `psql $DATABASE_URL -f supabase/build/fix_draft_roster_spots.sql`
2. **Review the output**: Look for duplicates or wrong counts
3. **Check timestamps**: When were extra spots created?
4. **Review roster initialization**: Check `useRosterManagement.ts` for multiple runs
5. **Add prevention**: Implement checks to prevent duplicate creation
6. **Test**: Start a new draft and monitor roster spot creation

---

## 🆘 If Issue Persists

If the diagnostic script shows everything is correct but you're still seeing issues:

1. **Check the database directly**: Query `fantasy_roster_spots` for a specific team
2. **Monitor in real-time**: Watch the database as you make a draft pick
3. **Check frontend**: Are multiple requests being sent?
4. **Check triggers**: Are there any database triggers on `fantasy_roster_spots`?
5. **Check other functions**: Search for any other code that touches roster spots

---

**The code logic is correct - we just need to find where the incorrect behavior is actually happening!** 🔍

