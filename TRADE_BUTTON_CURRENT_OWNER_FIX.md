# Trade Button Current Owner Fix

## 🐛 Issues Found

After trading picks, two UI bugs made the trade system confusing:

### Issue #1: Trade Button Targets Wrong Team ❌

**Problem**: 
When clicking the trade button on a **traded pick**, it would try to initiate a trade with the **original owner** instead of the **current owner**.

**Example**:
1. Team A has pick #3 (original owner)
2. Team B trades to get pick #3 from Team A
3. User clicks trade button on pick #3 card
4. ❌ Trade opens with **Team A** (original owner)
5. ✅ Should open with **Team B** (current owner)

**Root Cause**:
`DraftComponent.tsx` line 71 was using `pick.team_id` (original owner) instead of `pick.current_owner_id` (actual current owner):

```typescript
// ❌ WRONG: Uses original owner
const owningTeam = teams.find(t => t.id === pick.team_id);
```

**Result**: Users could accidentally initiate trades with themselves after picks changed hands.

---

### Issue #2: DraftPicks Table Doesn't Show Trades ❌

**Problem**:
The `DraftPicks.tsx` table view (full draft board) didn't show "→ Traded To X" indicators like the carousel does.

**Impact**:
- Users couldn't see which picks had been traded in the table view
- Only the carousel showed trade information
- Inconsistent UX between two views

---

## ✅ The Fixes

### Fix #1: Use Current Owner for Trade Button

**File**: `src/components/Draft/DraftComponent.tsx`

**Changed**:
```typescript
// ✅ CORRECT: Use current_owner_id to handle traded picks
const ownerId = pick.current_owner_id || pick.team_id;
const owningTeam = teams.find(t => t.id === ownerId);
```

**Logic**:
- If `pick.current_owner_id` is set → Pick was traded, use new owner
- If `pick.current_owner_id` is null → Pick not traded, use original owner (`team_id`)

**Result**:
- ✅ Trade button now opens trade with **actual current owner**
- ✅ No more accidental self-trades
- ✅ Works for both untrad and traded picks

---

### Fix #2: Add Trade Indicators to DraftPicks Table

**File**: `src/components/Draft/DraftPicks.tsx`

**Changed Team Column**:
```typescript
<Stack direction="row" spacing={1} alignItems="center">
  {/* Avatar shows current owner's initial with warning color if traded */}
  <Avatar size="sm" sx={{ bgcolor: pick.is_traded ? 'warning.500' : 'primary.500' }}>
    {(pick.is_traded ? pick.current_owner_name : pick.team_name)?.charAt(0) || '?'}
  </Avatar>
  
  <Box>
    {/* Show original team name */}
    <Typography level="body-sm" fontWeight="bold">
      {pick.original_team_name || pick.team_name || 'Empty Team'}
    </Typography>
    
    {/* Show trade indicator chip */}
    {pick.is_traded && pick.current_owner_name && (
      <Chip
        size="sm"
        color="primary"
        variant="soft"
        sx={{ fontSize: '0.65rem', height: '18px', mt: 0.5 }}
      >
        → {pick.current_owner_name}
      </Chip>
    )}
  </Box>
</Stack>
```

**Visual Changes**:
- ✅ Avatar background: Orange/Warning color if picked was traded
- ✅ Shows original team name on first line
- ✅ Shows "→ Current Team" chip below if traded
- ✅ Consistent with `DraftPicksCarousel.tsx` design

---

## 📊 Expected Behavior After Fix

### Scenario: Pick #3 traded from Team A to Team B

**Before Fixes** ❌:
1. **DraftPicksCarousel**: Shows "Team A → Team B" ✅
2. Click trade button → Opens trade with **Team A** ❌
3. **DraftPicks table**: Shows only "Team A" ❌

**After Fixes** ✅:
1. **DraftPicksCarousel**: Shows "Team A → Team B" ✅
2. Click trade button → Opens trade with **Team B** ✅
3. **DraftPicks table**: Shows "Team A → Team B" ✅

### Visual Comparison:

```
DraftPicksCarousel (Card View):
┌─────────────────────────────────────┐
│ [Avatar] Pick #3                    │
│          Team A                     │
│          → Team B  ← Trade chip     │
│          [Trade Button] ← Correct!  │
└─────────────────────────────────────┘

DraftPicks Table (Board View):
┌────────┬──────────────────┬─────────┐
│ Pick   │ Team             │ Player  │
├────────┼──────────────────┼─────────┤
│ #3     │ [⚠] Team A       │ ...     │
│        │     → Team B     │         │
│        │     [Trade Btn]  │         │
└────────┴──────────────────┴─────────┘
         ↑ Warning color avatar
         ↑ Trade indicator chip
```

---

## 🧪 Testing Checklist

Test with this scenario:

1. **Initial Setup**:
   - [ ] Team A has pick #3 (original)
   - [ ] Team B has pick #5 (original)

2. **Trade #1: Pick #3 for Pick #5**:
   - [ ] Accept trade
   - [ ] DraftPicksCarousel shows "Team A → Team B" on pick #3
   - [ ] DraftPicks table shows "Team A → Team B" on pick #3
   - [ ] Click trade button on pick #3 → Opens with **Team B** ✅

3. **Trade #2: Pick #3 for Pick #7** (trading it again):
   - [ ] Accept trade from Team B to Team C
   - [ ] DraftPicksCarousel shows "Team A → Team C" on pick #3
   - [ ] DraftPicks table shows "Team A → Team C" on pick #3
   - [ ] Click trade button on pick #3 → Opens with **Team C** ✅

4. **After Pick is Made**:
   - [ ] Team C makes pick #3
   - [ ] Player goes to **Team C's roster** ✅
   - [ ] Click trade button on completed pick #3 → Opens player trade with **Team C** ✅

5. **Untrad Picks (Control)**:
   - [ ] Pick #1 (never traded) → Trade button opens with original owner ✅
   - [ ] DraftPicks shows only team name, no chip ✅

---

## 🎯 Key Points

### What Was Fixed:
1. ✅ **Trade button now uses `current_owner_id`** instead of `team_id`
2. ✅ **DraftPicks table shows trade indicators** matching carousel
3. ✅ **Consistent UX** across all draft views

### What This Enables:
- ✅ Multiple trades of the same pick work correctly
- ✅ Users can't accidentally trade with themselves
- ✅ Full visibility of pick ownership in all views
- ✅ Proper trade context for both picks and players

### Data Flow:
```
1. Trade Accepted
   └─> draft_order.fantasy_team_id = new_owner_id

2. useDraftOrder.ts
   └─> Computes: current_owner_id, is_traded

3. DraftComponent.tsx handleInitiateTrade
   └─> Uses: current_owner_id (not team_id)

4. DraftPicks.tsx & DraftPicksCarousel.tsx
   └─> Display: original_team_name → current_owner_name
```

---

## 🔗 Related Files

- **Frontend (Component)**: `/src/components/Draft/DraftComponent.tsx` (handleInitiateTrade)
- **Frontend (Table)**: `/src/components/Draft/DraftPicks.tsx` (team column)
- **Frontend (Carousel)**: `/src/components/Draft/DraftPicksCarousel.tsx` (already correct)
- **Hook**: `/src/hooks/useDraftOrder.ts` (provides current_owner_id)

---

## 📚 Related Fixes

This completes the end-to-end pick trading system:

1. ✅ **Trade validation** (accept_trade_offer) - Fixed
2. ✅ **Pick ownership display** (useDraftOrder) - Fixed
3. ✅ **Player assignment** (make_draft_pick) - Fixed
4. ✅ **Available picks query** (useAvailableDraftPicks) - Fixed
5. ✅ **Trade button targeting** (DraftComponent) - **THIS FIX**
6. ✅ **Table view display** (DraftPicks) - **THIS FIX**

---

**Status**: ✅ **COMPLETE - Deployed via File Edits**  
**No Migration Required**: Frontend-only changes  
**Testing**: Ready to test immediately (hard refresh app)

---

**Created**: 2025-10-12  
**Files Modified**: 2 files (DraftComponent.tsx, DraftPicks.tsx)

