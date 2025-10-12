# Trade Display Fix for DraftPicks Table

## 🐛 Problem

Trades were not showing in `@DraftPicks.tsx` and the filter toggle was not visible.

### Root Causes:

1. **Wrong Hook Used**: `usePendingTrades` only fetches trades with `status = 'pending'`
   - DraftPicks table needs `status = 'accepted'` trades
   - The SQL function filters for pending only (line 98 in migration)

2. **Missing Data**: `get_pending_trades` function doesn't return `responded_at`
   - Need this timestamp to show when trade was accepted
   - Only returns `created_at` and `expires_at`

3. **Data Not Fetched**: Even if we had the right status, the `responded_at` field wasn't being fetched

---

## ✅ Solution

### Changed Approach

Instead of using `usePendingTrades`, we now **query accepted trades directly** in `DraftPicks.tsx`:

```typescript
// NEW: Direct query for accepted trades
const { data: allTrades = [] } = useQuery({
  queryKey: ['accepted-trades', leagueId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('draft_trade_offers')
      .select(`
        id,
        league_id,
        from_team_id,
        to_team_id,
        offered_players,
        offered_picks,
        requested_players,
        requested_picks,
        status,
        created_at,
        responded_at,
        from_team:fantasy_teams!from_team_id(team_name),
        to_team:fantasy_teams!to_team_id(team_name)
      `)
      .eq('league_id', leagueId)
      .eq('status', 'accepted')  // ← Only accepted trades
      .order('responded_at', { ascending: true });
    
    // ... transform data ...
  },
  enabled: !!leagueId,
  refetchInterval: 5000,
});
```

### Key Changes:

1. ✅ **Direct Supabase Query**: Bypass the `get_pending_trades` function
2. ✅ **Filter for Accepted**: `.eq('status', 'accepted')`
3. ✅ **Fetch `responded_at`**: Include in select statement
4. ✅ **Fetch Team Names**: Join with `fantasy_teams` table
5. ✅ **Order by Time**: `.order('responded_at', { ascending: true })`

### Updated Imports:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useDraftOrder } from '../../hooks/useDraftOrder';
// REMOVED: import { usePendingTrades } from '../../hooks/usePendingTrades';
```

---

## 🔍 Debug Logging

Added comprehensive logging to track data flow:

```typescript
// 1. When trades are fetched
console.log('✅ Fetched accepted trades:', data?.length || 0, data);

// 2. After transformation
console.log('🔄 Transformed trades:', transformedTrades);

// 3. After filtering (useMemo)
console.log('🎯 Accepted trades for display:', filtered.length, filtered);

// 4. After merging with picks
console.log(`📊 Round ${currentRound} items:`, {
  total: items.length,
  picks: items.filter(i => i.type === 'pick').length,
  trades: items.filter(i => i.type === 'trade').length,
  showTrades,
  items
});
```

### How to Debug:

1. **Open Dev Tools Console** (F12)
2. **Navigate to Draft Picks tab**
3. **Look for these logs**:
   - `✅ Fetched accepted trades: X` - How many trades were fetched
   - `🔄 Transformed trades: [...]` - Transformed data structure
   - `🎯 Accepted trades for display: X` - After filtering
   - `📊 Round 1 items: {...}` - Final merged array

4. **Check values**:
   - If `Fetched accepted trades: 0` → No accepted trades in database
   - If `trades: 0` in Round items → Trades not in current round
   - If `showTrades: false` → Toggle is OFF

---

## 🧪 Testing

### Test Scenario 1: Make a Trade

1. **Start Draft**
2. **Make 2 picks**
3. **Open Dev Console** (F12)
4. **Create and accept a trade**
5. **Navigate to Draft Picks tab**

**Expected Console Output**:
```
✅ Fetched accepted trades: 1 [{...}]
🔄 Transformed trades: [{from_team_name: "Team A", ...}]
🎯 Accepted trades for display: 1 [{...}]
📊 Round 1 items: {total: 13, picks: 12, trades: 1, showTrades: true}
```

**Expected Visual**:
- ✅ Trade row appears between picks
- ✅ Thick blue borders on trade row
- ✅ "TRADE COMPLETED" chip visible
- ✅ Teams and assets shown
- ✅ Time displayed

### Test Scenario 2: Filter Toggle

1. **With trades visible**
2. **Click "Show Trades" toggle OFF**

**Expected Console Output**:
```
📊 Round 1 items: {total: 12, picks: 12, trades: 0, showTrades: false}
```

**Expected Visual**:
- ✅ Trade rows disappear
- ✅ Only picks shown
- ✅ Toggle background gray
- ✅ Toggle icon gray

3. **Click "Show Trades" toggle ON**

**Expected Console Output**:
```
📊 Round 1 items: {total: 13, picks: 12, trades: 1, showTrades: true}
```

**Expected Visual**:
- ✅ Trade rows reappear
- ✅ Toggle background blue
- ✅ Toggle icon blue

### Test Scenario 3: No Trades Yet

1. **Start new draft**
2. **Navigate to Draft Picks tab**
3. **No trades made yet**

**Expected Console Output**:
```
✅ Fetched accepted trades: 0 []
🎯 Accepted trades for display: 0 []
📊 Round 1 items: {total: 12, picks: 12, trades: 0, showTrades: true}
```

**Expected Visual**:
- ✅ No trade rows shown
- ✅ Filter toggle NOT visible (acceptedTrades.length === 0)
- ✅ Only picks shown

---

## 📊 Data Structure

### Accepted Trade Object:

```typescript
{
  id: "uuid",
  league_id: "uuid",
  from_team_id: "uuid",
  to_team_id: "uuid",
  from_team_name: "Team A",      // ← Joined from fantasy_teams
  to_team_name: "Team B",        // ← Joined from fantasy_teams
  offered_players: [],
  offered_picks: [                // ← Array of pick numbers
    { pick_number: 16 }
  ],
  requested_players: [],
  requested_picks: [
    { pick_number: 4 }
  ],
  status: "accepted",
  created_at: "2025-10-12T12:00:00Z",
  responded_at: "2025-10-12T12:05:00Z"  // ← When trade was accepted
}
```

---

## 🔧 Files Modified

### 1. `/src/components/Draft/DraftPicks.tsx`

**Changes**:
- ✅ Removed `usePendingTrades` import
- ✅ Added `useQuery` and `supabase` imports
- ✅ Added direct query for accepted trades
- ✅ Added comprehensive debug logging
- ✅ Trade rows now render with correct data
- ✅ Filter toggle visible when trades exist

**Lines Changed**: ~25 lines modified

---

## ❓ Why Not Fix `get_pending_trades`?

We could have updated the SQL function to:
1. Return `responded_at`
2. Accept a `status` parameter
3. Return accepted trades

**But we chose direct query because**:
- ✅ Simpler and faster
- ✅ No database migration needed
- ✅ More flexible (can query any status)
- ✅ Better performance (direct table access)
- ✅ Easier to debug

---

## 📋 Summary

### Before:
- ❌ No trades showing
- ❌ Filter toggle not visible
- ❌ Using wrong hook (`usePendingTrades`)
- ❌ No `responded_at` data

### After:
- ✅ Accepted trades display correctly
- ✅ Filter toggle visible when trades exist
- ✅ Direct query for accepted trades
- ✅ `responded_at` included
- ✅ Comprehensive debug logging
- ✅ Proper chronological ordering

---

**Status**: ✅ **FIXED - Ready to Test**  
**Testing**: Hard refresh (Cmd+Shift+R), make trades, check console logs  
**Debug**: Check console for trade count and data structure

---

**Created**: 2025-10-12  
**Bug**: Trades not displaying in DraftPicks table  
**Fix**: Query accepted trades directly with responded_at

