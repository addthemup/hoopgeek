# 🔧 Draft Auto-Recovery System

## Overview

Your draft system now has **TWO layers of protection** against stalled picks:

### 1️⃣ **Built-in Auto-Recovery** (Primary)
The `draft-manager` Edge Function now **automatically detects and fixes** stalled picks every time it runs (every few seconds). This happens automatically with no setup required.

**What it does:**
- Checks every active draft for picks with `time_expires = NULL`
- Automatically sets `time_expires` based on team's autodraft status
- Logs the fix with full details

**Logs you'll see:**
```
🔧 Checking for stalled picks (null time_expires)...
⚠️ STALLED PICK DETECTED: League 5082f7c5-..., Pick #226 has null time_expires
🔧 AUTO-FIXING: Setting time_expires to 60s from now (2025-10-18T05:23:10.000Z)
✅ Fixed stalled pick #226 - draft will resume automatically
```

---

### 2️⃣ **SQL Function** (Backup / Manual)
A standalone SQL function that can be called manually or via a separate cron job.

---

## Setup Instructions

### ✅ **Step 1: Deploy the SQL Function**

Run this in your Supabase SQL Editor:

```sql
-- Copy from: /Users/adam/Desktop/hoopgeek/supabase/migrations/20251018_add_fix_stalled_picks_function.sql
```

This creates the `fix_stalled_draft_picks()` function.

---

### ✅ **Step 2: Test the Function**

Run this in your Supabase SQL Editor:

```sql
SELECT fix_stalled_draft_picks();
```

**Expected Result:**
```json
{
  "success": true,
  "fixed_count": 0,
  "message": "Fixed 0 stalled pick(s)",
  "timestamp": "2025-10-18T05:25:00.000Z"
}
```

If `fixed_count > 0`, it found and fixed stalled picks!

---

### ✅ **Step 3: Deploy Updated Draft-Manager**

The draft-manager now has built-in auto-recovery. Deploy the updated function:

```bash
cd /Users/adam/Desktop/hoopgeek
supabase functions deploy draft-manager
```

Or if you're running locally, restart it:
```bash
supabase functions serve draft-manager
```

---

## Optional: Set Up a Backup Cron Job

If you want a **separate backup system** that runs independently:

### Option A: Supabase Cron (Recommended)

1. Go to: **Supabase Dashboard → Database → Cron Jobs**
2. Click **"New Cron Job"**
3. Set up:
   - **Name:** `fix-stalled-draft-picks`
   - **Schedule:** `*/5 * * * *` (every 5 minutes)
   - **SQL Command:**
     ```sql
     SELECT fix_stalled_draft_picks();
     ```
4. Click **"Create"**

### Option B: Edge Function Cron

Create a new Edge Function that wraps the SQL function:

**File:** `supabase/functions/fix-stalled-picks/index.ts`
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔧 Running fix_stalled_draft_picks()...');
  
  const { data, error } = await supabase.rpc('fix_stalled_draft_picks');
  
  if (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('✅ Result:', data);
  
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
```

Then schedule it in your project settings:
1. **Supabase Dashboard → Edge Functions**
2. Find `fix-stalled-picks`
3. Click **"Schedule"**
4. Set to run every 5 minutes

---

## Manual Recovery (Emergency)

If you need to manually fix stalled picks right now:

### Quick Fix (Current Stalled Pick)
```sql
-- Run in Supabase SQL Editor
-- This fixes the current stalled pick from your logs
UPDATE fantasy_draft_order
SET 
    time_started = NOW(),
    time_expires = NOW() + INTERVAL '60 seconds'
WHERE id = '2f620787-e14b-478f-b9a4-be25488014db'
AND time_expires IS NULL;
```

### Fix All Stalled Picks
```sql
-- Run in Supabase SQL Editor
SELECT fix_stalled_draft_picks();
```

---

## Monitoring

### Check for Stalled Picks
```sql
-- Run in Supabase SQL Editor
SELECT 
    fdo.league_id,
    fl.name as league_name,
    fdo.pick_number,
    fdo.round,
    ft.team_name,
    fdo.time_started,
    fdo.time_expires,
    fls.draft_status
FROM fantasy_draft_order fdo
JOIN fantasy_leagues fl ON fdo.league_id = fl.id
JOIN fantasy_teams ft ON fdo.league_id = ft.league_id 
    AND fdo.team_position = ft.draft_position
JOIN fantasy_league_seasons fls ON fdo.league_id = fls.league_id
WHERE fdo.is_completed = FALSE
AND fdo.time_expires IS NULL
AND fls.draft_status = 'in_progress';
```

### Check Draft-Manager Logs

Look for these messages in your Edge Function logs:
- ✅ `Fixed stalled pick #226 - draft will resume automatically`
- ⚠️ `STALLED PICK DETECTED: League ...`
- ❌ `Failed to fix stalled pick: ...`

---

## How It Works

### Detection
1. Draft-manager runs every ~10 seconds
2. Fetches all active drafts with current picks
3. Checks if `time_expires IS NULL`

### Auto-Fix
1. Gets team's autodraft status
2. Gets league's `draft_time_per_pick` setting
3. Calculates expiration:
   - **3 seconds** if autodraft enabled
   - **League setting** (default 60s) if manual
4. Updates the pick with new `time_expires`
5. Draft resumes automatically on next cycle

### Advantages
- **Zero downtime**: Fixes happen in real-time
- **No data loss**: Only sets missing timestamps
- **Smart timing**: Respects autodraft settings
- **Safe**: Only touches incomplete picks with null time_expires

---

## Troubleshooting

### Draft is still stuck after fix
1. Check if draft-manager is running
2. Verify the pick was actually updated:
   ```sql
   SELECT * FROM fantasy_draft_order 
   WHERE id = '2f620787-e14b-478f-b9a4-be25488014db';
   ```
3. Check Edge Function logs for errors

### Auto-recovery isn't running
1. Verify draft-manager is deployed and running
2. Check if the cron trigger is active
3. Look for errors in Edge Function logs

### Too many picks getting stuck
- This indicates a deeper issue with `moveToNextPick()`
- Check Edge Function logs for errors during pick transitions
- Verify database constraints aren't blocking updates

---

## Prevention

The root cause is typically:
1. **Edge Function crash** mid-pick transition
2. **Database timeout** during high load
3. **Manual database manipulation** that skips the function

The auto-recovery system handles all these cases automatically! 🎯

