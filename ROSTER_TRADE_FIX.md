# Player Roster Trade Fix

## 🐛 Bug Identified

When trading **already-drafted players**, the `accept_trade_offer` function was only updating `draft_picks` (ownership tracking) but **NOT** `fantasy_team_players` (the actual roster table that displays in the UI).

### What Was Happening

1. ✅ Trade accepted → `draft_picks.fantasy_team_id` updated (correct owner)
2. ❌ BUT `fantasy_team_players` NOT updated (player still in old team's roster slot)
3. Result: Pick history shows correct owner, but roster shows wrong player

### The Problem

The `fantasy_team_players` table has pre-created rows for each roster position:
- Each team has ~15 rows (starters, bench, utility, IR)
- Each row has a `player_id` (NULL = empty spot)
- When trading, we need to:
  1. Clear player from old team's slot (set `player_id = NULL`)
  2. Find empty slot on new team
  3. Assign player to new slot

The old code was missing steps 1-3 entirely!

## ✅ Fix Applied

Created migration: `20251012000006_fix_player_roster_trades.sql`

### What It Does

Updated `accept_trade_offer` to properly move players between rosters:

```sql
-- For each traded player:

-- 1. Update ownership in draft_picks (was already working)
UPDATE draft_picks
SET fantasy_team_id = new_team_id
WHERE player_id = traded_player_id;

-- 2. Remove from old team's roster (NEW!)
UPDATE fantasy_team_players
SET player_id = NULL
WHERE fantasy_team_id = old_team_id
  AND player_id = traded_player_id;

-- 3. Find empty spot on new team (NEW!)
SELECT id INTO empty_spot_id
FROM fantasy_team_players
WHERE fantasy_team_id = new_team_id
  AND player_id IS NULL
LIMIT 1;

-- 4. Assign to new team's roster (NEW!)
UPDATE fantasy_team_players
SET player_id = traded_player_id
WHERE id = empty_spot_id;
```

### Error Handling

Added validation:
```sql
IF empty_spot_id IS NULL THEN
    RAISE EXCEPTION 'No empty roster spot available for player % on team %';
END IF;
```

Prevents trades if new team has no empty spots.

## 🚀 Deployment

### Option 1: Supabase CLI (Recommended)

```bash
cd /Users/adam/Desktop/hoopgeek
supabase db push
```

### Option 2: Supabase Dashboard (Manual)

1. Go to your Supabase project dashboard
2. Navigate to: **SQL Editor**
3. Click: **New Query**
4. Copy/paste contents of: `supabase/migrations/20251012000006_fix_player_roster_trades.sql`
5. Click: **Run**

### Option 3: Direct SQL

```bash
# If you have psql installed
psql YOUR_DATABASE_URL -f supabase/migrations/20251012000006_fix_player_roster_trades.sql
```

## 🧪 Testing After Deployment

### Test Scenario: Trade Completed Picks

**Setup**:
1. Team A drafts LeBron James (Pick #1)
2. Team B drafts Kevin Durant (Pick #2)

**Trade**:
3. Team A offers: LeBron James
4. Team B offers: Kevin Durant
5. Accept trade

**Expected Results After Fix**:

✅ **DraftRoster (Team A)**:
- Left column (roster): Shows Kevin Durant
- Right column (picks): Pick #1 shows Kevin Durant

✅ **DraftRoster (Team B)**:
- Left column (roster): Shows LeBron James
- Right column (picks): Pick #2 shows LeBron James

✅ **Team Page (league/team-a)**:
- Roster shows Kevin Durant

✅ **Team Page (league/team-b)**:
- Roster shows LeBron James

✅ **Draft Picks Carousel**:
- Pick #1: Shows Kevin Durant with "→ Team A" chip
- Pick #2: Shows LeBron James with "→ Team B" chip

### Test Scenario: Trade Pending Pick + Player

**Setup**:
1. Team A drafts LeBron James (Pick #1)
2. Pick #10 is pending (Team B's pick)

**Trade**:
3. Team A offers: LeBron James
4. Team B offers: Pick #10
5. Accept trade
6. Team A makes Pick #10 (drafts Giannis)

**Expected Results**:

✅ **After Trade Accepted**:
- Team B roster: Shows LeBron James
- Team A roster: Empty (waiting for Pick #10)

✅ **After Pick #10 Made**:
- Team A roster: Shows Giannis (from Pick #10)
- Team B roster: Still shows LeBron James

✅ **Picks Column**:
- Team A: Pick #10 shows Giannis with "Traded from Team B"
- Team B: Pick #1 shows LeBron James with "Traded from Team A"

## 📊 Database Tables Affected

### `draft_picks` (Ownership Tracking)
```sql
-- Tracks which team owns each pick/player
-- Used for: Pick history, trade tracking
-- Updated by: accept_trade_offer, make_draft_pick
```

### `fantasy_team_players` (Actual Roster)
```sql
-- Pre-created rows for each roster position
-- Used by: DraftRoster, Team page, roster queries
-- NOW UPDATED by: accept_trade_offer ← FIX
```

### `draft_order` (Pick Ownership)
```sql
-- Tracks which team owns future picks
-- Updated by: accept_trade_offer (for pick trades)
```

## 🔍 What Changed in the Code

### Before (Broken)
```sql
-- Only updated draft_picks
UPDATE draft_picks
SET fantasy_team_id = new_team_id
WHERE player_id = traded_player_id;

-- fantasy_team_players NOT updated!
-- Result: Player still in old team's roster slot
```

### After (Fixed)
```sql
-- 1. Update draft_picks (ownership)
UPDATE draft_picks
SET fantasy_team_id = new_team_id
WHERE player_id = traded_player_id;

-- 2. Clear from old roster
UPDATE fantasy_team_players
SET player_id = NULL
WHERE fantasy_team_id = old_team_id
  AND player_id = traded_player_id;

-- 3. Find empty spot on new roster
SELECT id INTO empty_spot_id
FROM fantasy_team_players
WHERE fantasy_team_id = new_team_id
  AND player_id IS NULL;

-- 4. Assign to new roster
UPDATE fantasy_team_players
SET player_id = traded_player_id
WHERE id = empty_spot_id;
```

## 🚨 Important Notes

### Roster Spot Availability

The fix adds a check for empty roster spots:

```sql
IF empty_spot_id IS NULL THEN
    RAISE EXCEPTION 'No empty roster spot available';
END IF;
```

**What This Means**:
- If a team has a full roster (all spots filled), they **cannot** trade for additional players
- This is intentional and prevents roster overflow
- Trade interface should show available roster spots before allowing trades

### Trade Validation

All existing validations still apply:
- ✅ Pick not already completed
- ✅ Pick belongs to correct team
- ✅ Trade not expired
- ✅ Correct team accepting
- ✅ **NEW**: Empty roster spots available

## 📋 Related Files

### Modified
- `/supabase/migrations/20251012000006_fix_player_roster_trades.sql` ← **NEW**

### Dependencies
- `/supabase/migrations/20251012000002_add_trade_management.sql` (original function)
- `/src/hooks/useTeamRoster.ts` (fetches fantasy_team_players)
- `/src/components/Draft/DraftRoster.tsx` (displays roster)

## 🎯 Next Steps

1. **Deploy Migration** (see deployment options above)
2. **Test Current Trades**: Existing trades in database may need manual fixes
3. **Make New Trade**: Test that roster updates correctly
4. **Verify UI**: Check DraftRoster, Team page, and Picks carousel

---

**Status**: ✅ **MIGRATION READY**  
**Action Required**: Run `supabase db push` or apply via Dashboard  
**Testing**: After deployment, make a player trade and verify roster updates

---

**Created**: 2025-10-12  
**Bug**: Players not moving between rosters in trades  
**Fix**: Added fantasy_team_players updates to accept_trade_offer

