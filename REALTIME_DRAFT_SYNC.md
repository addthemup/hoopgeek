# Realtime Draft & Roster Sync

## 🎯 What This Does

The `Players.tsx` page now **automatically refreshes** when:
- ✅ A player is drafted (manual pick or auto-draft)
- ✅ A player is added to any roster
- ✅ A player is dropped from any roster

This prevents confusion about which players are available during the draft and after.

## 🔧 How It Works

### 1. Supabase Realtime Subscriptions

The component subscribes to two database tables:

**`fantasy_draft_picks` table:**
- Detects when players are drafted
- Triggers on INSERT events
- Filtered to only the current league

**`fantasy_roster_spots` table:**
- Detects when players are added/dropped/traded
- Triggers on INSERT, UPDATE, DELETE events
- Affects all roster changes

### 2. Auto-Refresh Logic

When a change is detected:
1. Waits **1 second** to ensure database consistency
2. Invalidates the `free-agent-players` query
3. React Query automatically refetches the data
4. Players list updates with newly unavailable players removed

### 3. Works With All Draft Methods

✅ **Manual picks** in `DraftPicks.tsx`
✅ **Auto-draft** via `draft-manager` Edge Function
✅ **Best Available** picks
✅ **Trade picks**
✅ **Commissioner reversals**

## 🚀 Setup Instructions

### Step 1: Enable Realtime in Supabase (REQUIRED)

You must enable Realtime for the tables to receive updates.

**Option A: Supabase Dashboard**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Database** → **Replication** (left sidebar)
4. Find `fantasy_draft_picks` in the tables list
5. Click the toggle to enable Realtime
6. Repeat for `fantasy_roster_spots`

**Option B: Run SQL Migration**

1. Go to **SQL Editor** in Supabase Dashboard
2. Copy contents of `/Users/adam/Desktop/hoopgeek/supabase/migrations/enable_realtime_for_draft_and_roster.sql`
3. Paste and click **Run**
4. Verify you see 2 rows in the output

### Step 2: Verify Realtime is Working

After enabling Realtime:

1. Open your app in **two browser windows**
2. In Window 1: Go to the Players page
3. In Window 2: Go to the Draft page
4. In Window 2: Draft a player
5. In Window 1: Watch the Players list **automatically update** after ~1 second

You should see console logs in Window 1:
```
🔔 Setting up Realtime subscription for draft picks in league: [league-id]
🎯 Draft pick detected: [payload]
♻️ Invalidating free-agent-players query
```

## 📊 Performance

- **Minimal overhead**: Subscriptions are lightweight
- **No polling**: Uses Supabase's efficient WebSocket connections
- **Smart invalidation**: Only refreshes when changes occur
- **Debounced**: 1-second delay prevents rapid repeated fetches
- **Automatic cleanup**: Unsubscribes when component unmounts

## 🐛 Troubleshooting

### Players not updating after draft pick?

1. **Check Realtime is enabled:**
   ```sql
   SELECT tablename FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   AND tablename IN ('fantasy_draft_picks', 'fantasy_roster_spots');
   ```
   Should return 2 rows.

2. **Check browser console:**
   - Should see `🔔 Setting up Realtime subscription...`
   - Should see `🎯 Draft pick detected...` when pick happens
   - Should see `♻️ Invalidating free-agent-players query`

3. **Check Supabase logs:**
   - Go to Supabase Dashboard → **Logs**
   - Filter by "Realtime"
   - Look for subscription connections

### Still not working?

1. **Hard refresh the page** (Cmd/Ctrl + Shift + R)
2. **Check RLS policies** - Realtime requires proper RLS policies
3. **Check network tab** - Look for WebSocket connections to Supabase
4. **Restart your app** - Sometimes subscriptions need a fresh start

## 🔒 Security Notes

- Subscriptions respect RLS policies
- Users only see changes they're authorized to see
- League-specific filtering ensures no data leakage
- Realtime connections are authenticated via user's JWT

## 📝 Code Changes

**Modified Files:**
- ✅ `src/pages/Players.tsx` - Added Realtime subscriptions

**New Files:**
- ✅ `supabase/migrations/enable_realtime_for_draft_and_roster.sql` - SQL to enable Realtime

**No changes needed in:**
- Draft components (already work as-is)
- draft-manager Edge Function (already works as-is)
- Database schema (just need to enable Realtime)

## 🎉 Benefits

1. **Better UX**: Players see updates instantly without refreshing
2. **Less confusion**: No one can pick a player who's already drafted
3. **Real-time feel**: App feels more responsive and "live"
4. **Multi-user sync**: Multiple commissioners/drafters stay in sync
5. **Works everywhere**: Draft, Players page, Rosters all stay synchronized

## 🔮 Future Enhancements

Potential additions:
- Toast notifications when a player is drafted ("Player X was just drafted by Team Y")
- Visual indicator showing which player was just taken
- Sound effects for draft picks
- Animated removal of player from list
- Real-time draft order updates
- Live trade notifications

---

## 💡 Pro Tips

1. **Keep Players page open during draft** - You'll see picks happen in real-time
2. **Use multiple tabs** - Draft in one tab, browse players in another
3. **Watch console logs** - Great for debugging if something seems off
4. **Test with two accounts** - Best way to verify it's working

---

Need help? Check the console logs for detailed debugging info!

