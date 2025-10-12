# Timestamp Fix for Draft Picks Table

## 🐛 Problem

The `@DraftPicks.tsx` table was using **WRONG** timestamps to sort picks and trades chronologically:

### Before (Broken):
```typescript
// ❌ Used time_started (when timer started, not when pick was made)
timestamp: pick.time_started ? new Date(pick.time_started) : new Date(0)

// ❌ Used created_at (when offer was created, not when trade was accepted)
const tradeTimestamp = new Date(trade.created_at);
```

**Result**: Trades appeared at wrong times, not matching when they actually happened.

---

## ✅ Solution

### Database Timestamps Available:

1. **For Draft Picks**:
   - ✅ `draft_picks.created_at` - When pick was actually made (DEFAULT NOW())

2. **For Trades**:
   - ✅ `draft_trade_offers.responded_at` - When trade was accepted/rejected
   - ✅ `draft_trade_offers.created_at` - When offer was created (fallback)

---

## 🔧 Changes Made

### 1. Updated `useDraftOrder` Hook

**File**: `/src/hooks/useDraftOrder.ts`

**Added field to interface**:
```typescript
export interface DraftOrderPick {
  // ... existing fields ...
  pick_made_at?: string // NEW: Timestamp when pick was actually made
}
```

**Updated query to fetch timestamp**:
```typescript
const { data: completedPicks } = await supabase
  .from('draft_picks')
  .select(`
    pick_number,
    player_id,
    fantasy_team_id,
    created_at,  // ← NEW: Fetch this
    players!inner (...)
  `)
```

**Mapped to result**:
```typescript
return {
  // ... existing fields ...
  pick_made_at: completedPick?.created_at, // NEW
}
```

### 2. Updated `usePendingTrades` Hook

**File**: `/src/hooks/usePendingTrades.ts`

**Added field to interface**:
```typescript
export interface PendingTrade {
  // ... existing fields ...
  responded_at?: string; // NEW: When trade was accepted/rejected
}
```

*Note: The `get_pending_trades` RPC function already returns `responded_at`, so no SQL changes needed!*

### 3. Updated `DraftPicks` Component

**File**: `/src/components/Draft/DraftPicks.tsx`

**Fixed pick timestamps** (line 57-66):
```typescript
// Add all picks with their timestamps
roundPicks.forEach(pick => {
  items.push({
    type: 'pick',
    data: pick,
    // ✅ Use pick_made_at (when pick was actually made)
    timestamp: pick.pick_made_at ? new Date(pick.pick_made_at) : new Date(0)
  });
});
```

**Fixed trade timestamps** (line 68-71):
```typescript
// Add accepted trades with their responded_at timestamp
acceptedTrades.forEach(trade => {
  // ✅ Use responded_at (when trade was accepted), fallback to created_at
  const tradeTimestamp = trade.responded_at ? new Date(trade.responded_at) : new Date(trade.created_at);
```

**Fixed trade display time** (line 270):
```typescript
<Typography level="body-xs" color="neutral">
  {new Date(trade.responded_at || trade.created_at).toLocaleTimeString()}
</Typography>
```

---

## 📊 How It Works Now

### Timeline Example:

```
12:00:00 PM - Pick #1 made (LeBron James) → uses draft_picks.created_at
12:00:15 PM - Pick #2 made (Kevin Durant) → uses draft_picks.created_at
12:00:45 PM - Trade offer created (Pick #16 for Pick #4)
12:01:00 PM - Pick #3 made (Giannis) → uses draft_picks.created_at
12:01:30 PM - Trade accepted → uses draft_trade_offers.responded_at ✅
12:02:00 PM - Pick #4 made (Luka) → uses draft_picks.created_at
```

### Displayed in Table:
```
┌─────────────────────────────────────────────┐
│ #1  │ Team A │ LeBron James │ 12:00:00 PM  │
│ #2  │ Team B │ Kevin Durant │ 12:00:15 PM  │
│ #3  │ Team C │ Giannis      │ 12:01:00 PM  │
├─────────────────────────────────────────────┤
│ TRADE: Team A ↔ Team B     12:01:30 PM      │ ← Correct time!
│ Sent: Pick #16  Received: Pick #4           │
├─────────────────────────────────────────────┤
│ #4  │ Team B │ Luka Doncic  │ 12:02:00 PM  │
└─────────────────────────────────────────────┘
```

---

## 🧪 Testing

### Test Scenario: Make Picks and Trade

1. **Make 3 picks** in sequence
2. **Create trade offer** (pick for pick)
3. **Wait 30 seconds**
4. **Accept trade**
5. **Make 2 more picks**

### Expected Result:

✅ **Draft Picks Table**:
- Picks appear in order they were made (by `created_at`)
- Trade appears at the time it was **accepted** (by `responded_at`)
- Trade is positioned chronologically between the correct picks
- Time displayed next to trade is acceptance time

### Before Fix:
❌ Trade appeared at wrong time (when offer was created)  
❌ Trade might show before picks that were made after the offer

### After Fix:
✅ Trade appears at correct time (when accepted)  
✅ Trade is positioned correctly in chronological order

---

## 📋 Summary of Changes

### Files Modified:
1. ✅ `/src/hooks/useDraftOrder.ts`
   - Added `pick_made_at` field
   - Updated query to fetch `created_at` from `draft_picks`

2. ✅ `/src/hooks/usePendingTrades.ts`
   - Added `responded_at` field to interface

3. ✅ `/src/components/Draft/DraftPicks.tsx`
   - Updated pick timestamp to use `pick_made_at`
   - Updated trade timestamp to use `responded_at`
   - Updated trade display time

### Database Schema:
✅ **No migrations needed** - timestamps already exist!
- `draft_picks.created_at` (already exists)
- `draft_trade_offers.responded_at` (already exists)

---

## 🎯 Result

**Before**: Trades appeared at random/wrong times  
**After**: Perfect chronological order showing actual pick and trade times  

**Hard refresh** your app and test! The Draft Picks table should now show the correct timeline! 🎉

---

**Status**: ✅ **COMPLETE - Ready to Test**  
**No Migration Required**: Frontend-only changes  
**Testing**: Hard refresh, make picks, make trades, check order

---

**Created**: 2025-10-12  
**Bug**: Draft Picks table showing wrong timestamps  
**Fix**: Use actual timestamps from database (pick_made_at, responded_at)

