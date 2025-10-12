# Traded Picks Player Assignment Fix

## 🚨 Critical Bugs Found

When picks are traded before being made, two critical bugs prevent the system from working correctly:

### Bug #1: `make_draft_pick` Ignores Trades ❌
**Location**: `supabase/migrations/add_draft_functions.sql` (lines 90-96)

**Problem**:
```sql
-- ❌ ALWAYS uses team_position, ignoring fantasy_team_id
SELECT id INTO team_id
FROM fantasy_teams
WHERE league_id = league_id_param
ORDER BY id
OFFSET (pick_record.team_position - 1)
LIMIT 1;
```

**Impact**:
- When pick #4 (traded TO user) is made → Player goes to WRONG team (original owner)
- When pick #16 (traded FROM user) is made → Player goes to WRONG team (user's team)
- `fantasy_team_id` column is completely ignored

### Bug #2: `useAvailableDraftPicks` Ignores Trades ❌
**Location**: `src/hooks/useAvailableDraftPicks.ts` (line 51)

**Problem**:
```typescript
// ❌ Only checks team_position
.eq('team_position', teamPosition)
```

**Impact**:
- After trading pick #16 for pick #4:
  - DraftTrade still shows user has pick #16 (wrong!)
  - DraftTrade doesn't show user has pick #4 (wrong!)
- Traded picks don't appear in the trade machine

## ✅ The Fixes

### Fix #1: Update `make_draft_pick` Function

**Migration**: `20251012000005_fix_make_draft_pick_trades.sql`

**New Logic**:
```sql
-- ✅ Check fantasy_team_id first (if pick was traded)
IF pick_record.fantasy_team_id IS NOT NULL THEN
  team_id := pick_record.fantasy_team_id;  -- Use new owner
  RAISE NOTICE 'Pick was traded to team %', team_id;
ELSE
  -- Compute from team_position (original owner)
  SELECT id INTO team_id
  FROM fantasy_teams
  WHERE league_id = league_id_param
  ORDER BY id
  OFFSET (pick_record.team_position - 1)
  LIMIT 1;
END IF;
```

**What This Fixes**:
- ✅ Players go to the correct team after pick trades
- ✅ Respects `fantasy_team_id` when set
- ✅ Falls back to `team_position` for untradedpicks
- ✅ Returns `was_traded` flag in result

### Fix #2: Update `useAvailableDraftPicks` Hook

**File**: `src/hooks/useAvailableDraftPicks.ts`

**New Query**:
```typescript
.eq('league_id', leagueId)
.eq('is_completed', false)
// ✅ Get BOTH original AND traded picks
.or(`and(fantasy_team_id.is.null,team_position.eq.${teamPosition}),fantasy_team_id.eq.${teamId}`)
.order('pick_number');
```

**What This Fixes**:
- ✅ Shows original picks (where `fantasy_team_id` IS NULL and `team_position` matches)
- ✅ Shows traded picks (where `fantasy_team_id` matches team ID)
- ✅ DraftTrade now displays correct available picks after trades
- ✅ Added `fantasy_team_id` to `AvailableDraftPick` interface

## 📊 Expected Behavior After Fix

### Scenario: Trade pick #16 for pick #4 (before draft starts)

**Before Fixes** ❌:
1. Trade accepted → Carousel shows swap ✅
2. Pick #4 made → Player goes to **original owner** (wrong!) ❌
3. DraftTrade still shows pick #16 in user's list ❌
4. Pick #16 made → Player goes to **user's team** (wrong!) ❌

**After Fixes** ✅:
1. Trade accepted → Carousel shows swap ✅
2. Pick #4 made → Player goes to **USER'S team** (correct!) ✅
3. DraftTrade shows pick #4 in user's list ✅
4. Pick #16 made → Player goes to **OTHER team** (correct!) ✅

### Visual Flow:

```
TRADE EXECUTED:
┌─────────────────────────────────────────┐
│ User Team:    Pick #16 → Pick #4        │
│ Other Team:   Pick #4  → Pick #16       │
└─────────────────────────────────────────┘

PICK #4 MADE (by user):
┌─────────────────────────────────────────┐
│ draft_order.fantasy_team_id = User ID   │
│ make_draft_pick uses fantasy_team_id    │
│ → Player assigned to USER'S TEAM ✅      │
└─────────────────────────────────────────┘

PICK #16 MADE (by other team):
┌─────────────────────────────────────────┐
│ draft_order.fantasy_team_id = Other ID  │
│ make_draft_pick uses fantasy_team_id    │
│ → Player assigned to OTHER TEAM ✅       │
└─────────────────────────────────────────┘
```

## 🎯 How to Apply

### Step 1: Apply Database Migration

The migration is **already in your clipboard**!

1. Open **Supabase SQL Editor**
2. Paste the migration
3. Click **Run**

### Step 2: Refresh Your App

1. **Hard refresh** (Cmd+Shift+R)
2. The frontend fix is already deployed (in `useAvailableDraftPicks.ts`)

### Step 3: Test the Fix

1. **Start a new draft** (or reset your test league)
2. **Trade picks** before making them (e.g., trade #16 for #4)
3. **Check DraftTrade**:
   - ✅ Should show pick #4 in your available picks
   - ✅ Should NOT show pick #16
4. **Make pick #4**:
   - ✅ Player should be added to YOUR roster
   - ✅ Check `@DraftPicksCarousel.tsx` - should show player on your team
5. **When pick #16 is made**:
   - ✅ Player should go to OTHER team's roster
   - ✅ Should NOT appear on your team

## 🔍 Technical Details

### Database Schema:
```sql
CREATE TABLE draft_order (
  id UUID PRIMARY KEY,
  league_id UUID NOT NULL,
  pick_number INTEGER NOT NULL,
  team_position INTEGER NOT NULL,  -- Original position (never changes)
  fantasy_team_id UUID,             -- Current owner (NULL = original, SET = traded)
  is_completed BOOLEAN DEFAULT FALSE,
  ...
);
```

### Pick Ownership Logic:

| `fantasy_team_id` | Owner | Scenario |
|-------------------|-------|----------|
| `NULL` | Original owner (from `team_position`) | Pick hasn't been traded |
| `<team_id>` | That team | Pick has been traded |

### Query Logic (Supabase `.or()` syntax):
```typescript
.or(`
  and(fantasy_team_id.is.null,team_position.eq.${teamPosition}),
  fantasy_team_id.eq.${teamId}
`)
```

This translates to SQL:
```sql
WHERE (
  (fantasy_team_id IS NULL AND team_position = X)
  OR fantasy_team_id = 'team-uuid'
)
```

## 🧪 Testing Checklist

- [ ] Create new league and start draft
- [ ] Trade pick #16 for pick #4 BEFORE picks are made
- [ ] Verify DraftTrade shows correct available picks
- [ ] User makes pick #4 → Player added to user's roster
- [ ] Other team makes pick #16 → Player added to other team's roster
- [ ] Trade pick #10 for pick #12 AFTER pick #4 but BEFORE pick #10
- [ ] Verify both picks reflect new ownership correctly
- [ ] Trade players after they're drafted → Separate functionality, should still work

## 🔗 Related Files

- **Migration**: `/supabase/migrations/20251012000005_fix_make_draft_pick_trades.sql`
- **Frontend Hook**: `/src/hooks/useAvailableDraftPicks.ts`
- **Original Function**: `/supabase/migrations/add_draft_functions.sql`
- **Trade Validation**: `/supabase/migrations/20251012000002_add_trade_management.sql`
- **Display Logic**: `/src/hooks/useDraftOrder.ts` (already fixed for display)

## 📚 Related Issues Fixed

1. ✅ **Pick trades display in carousel** (fixed in `useDraftOrder.ts`)
2. ✅ **NULL fantasy_team_id semantics** (fixed in migration 20251012000004_v2)
3. ✅ **Trade validation** (fixed in `accept_trade_offer`)
4. ✅ **Player assignment after pick trades** (THIS FIX)
5. ✅ **Available picks in trade machine** (THIS FIX)

## 🎉 Success Criteria

After applying this fix:

- ✅ Traded picks go to correct team when made
- ✅ DraftTrade shows correct available picks after trades
- ✅ Players are assigned to correct team rosters
- ✅ `make_draft_pick` respects `fantasy_team_id`
- ✅ `useAvailableDraftPicks` includes traded picks
- ✅ Complete pick trade workflow functions end-to-end

---

**Created**: 2025-10-12  
**Status**: ✅ **READY TO APPLY**  
**Priority**: 🔴 **CRITICAL** (Core draft functionality broken without this)

