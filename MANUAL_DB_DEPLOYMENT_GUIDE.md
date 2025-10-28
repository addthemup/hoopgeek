# 🗄️ Manual Database Deployment Guide

Since Supabase CLI is not installed, follow these steps to manually deploy the engagement tracking system.

---

## 📋 Step-by-Step Instructions

### 1. Open Supabase SQL Editor

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **"New Query"**

---

### 2. Deploy Engagement Tracking Tables

**Copy and paste this file into the SQL Editor:**

📁 **File:** `supabase/migrations/create_engagement_tracking_system.sql`

**To copy:**
```bash
cat supabase/migrations/create_engagement_tracking_system.sql
```

**Then:**
1. Paste the entire contents into the Supabase SQL Editor
2. Click **"Run"** (or press Cmd/Ctrl + Enter)
3. Wait for "Success" message

**This creates:**
- ✅ `user_engagement_sessions` table
- ✅ `user_post_views` table
- ✅ `engagement_events` table
- ✅ `dfs_user_statistics` table
- ✅ `daily_engagement_metrics` materialized view
- ✅ `dfs_conversion_funnel` materialized view
- ✅ All RLS policies and functions

---

### 3. Deploy DFS Statistics Triggers

**Copy and paste this file into the SQL Editor:**

📁 **File:** `supabase/migrations/create_dfs_stats_triggers.sql`

**To copy:**
```bash
cat supabase/migrations/create_dfs_stats_triggers.sql
```

**Then:**
1. Paste the entire contents into a new SQL Editor tab
2. Click **"Run"**
3. Wait for "Success" message

**This creates:**
- ✅ `recalculate_dfs_user_stats()` function
- ✅ Auto-update triggers on `dfs_entries`
- ✅ Auto-update triggers on `dfs_lineups`
- ✅ `recalculate_all_dfs_user_stats()` admin function

---

### 4. Refresh Materialized Views

**Run this query:**

```sql
SELECT refresh_daily_engagement_metrics();
```

**This initializes:**
- ✅ Daily engagement metrics
- ✅ DFS conversion funnel

---

### 5. Backfill Existing User Stats

**Run this query:**

```sql
SELECT * FROM recalculate_all_dfs_user_stats();
```

**This calculates:**
- ✅ DFS stats for all existing users
- ✅ Historical performance data

---

### 6. Set Up Daily Refresh Cron Job

**Run this query:**

```sql
SELECT cron.schedule(
  'refresh-engagement-metrics',
  '0 1 * * *',
  $$ SELECT refresh_daily_engagement_metrics(); $$
);
```

**This schedules:**
- ✅ Daily refresh at 1:00 AM UTC
- ✅ Automatic metrics updates

---

## ✅ Verification Checklist

After running all steps, verify the deployment:

### Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'user_engagement_sessions',
  'user_post_views',
  'engagement_events',
  'dfs_user_statistics'
);
```

**Expected:** 4 rows returned

### Check Materialized Views Exist
```sql
SELECT matviewname 
FROM pg_matviews 
WHERE schemaname = 'public'
AND matviewname IN (
  'daily_engagement_metrics',
  'dfs_conversion_funnel'
);
```

**Expected:** 2 rows returned

### Check Functions Exist
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
  'start_user_session',
  'end_user_session',
  'start_post_view',
  'update_post_view_progress',
  'end_post_view',
  'recalculate_dfs_user_stats',
  'refresh_daily_engagement_metrics'
);
```

**Expected:** 7 rows returned

### Check Triggers Exist
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name IN (
  'trigger_dfs_entry_stats_update',
  'trigger_lineup_created'
);
```

**Expected:** 2 rows returned

### Check Cron Job
```sql
SELECT * FROM cron.job 
WHERE jobname = 'refresh-engagement-metrics';
```

**Expected:** 1 row returned

---

## 🐛 Troubleshooting

### Issue: "relation already exists"
**Solution:** Tables already created. Skip to next step.

### Issue: "function does not exist"
**Solution:** Make sure you ran the SQL files in order (tables first, then triggers).

### Issue: "permission denied"
**Solution:** Ensure you're logged in as a Supabase admin/service role.

### Issue: "materialized view refresh failed"
**Solution:** 
```sql
-- Drop and recreate
DROP MATERIALIZED VIEW IF EXISTS daily_engagement_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS dfs_conversion_funnel CASCADE;
-- Then re-run the create_engagement_tracking_system.sql
```

### Issue: Cron not scheduling
**Solution:** Ensure pg_cron extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

## 📊 Test the System

### 1. Test Session Tracking
```sql
-- Start a test session (replace with your user ID)
SELECT start_user_session(
  'YOUR_USER_ID_HERE'::uuid,
  '/highlights',
  'Mozilla/5.0...',
  'desktop'
);

-- Check if session was created
SELECT * FROM user_engagement_sessions 
WHERE user_id = 'YOUR_USER_ID_HERE'::uuid
ORDER BY session_start DESC LIMIT 1;
```

### 2. Test Post View Tracking
```sql
-- Start a post view
SELECT start_post_view(
  'YOUR_USER_ID_HERE'::uuid,
  'POST_ID_HERE'::uuid,
  'SESSION_ID_FROM_ABOVE'::uuid,
  5, -- total slides
  false -- not clicked from avatar
);

-- Check if view was created
SELECT * FROM user_post_views
WHERE user_id = 'YOUR_USER_ID_HERE'::uuid
ORDER BY view_started_at DESC LIMIT 1;
```

### 3. Test DFS Stats
```sql
-- Check if any DFS stats exist
SELECT COUNT(*) FROM dfs_user_statistics;

-- If 0, and you have DFS entries, run:
SELECT * FROM recalculate_all_dfs_user_stats();

-- Then check again
SELECT * FROM dfs_user_statistics LIMIT 5;
```

---

## 🎯 What to Do Next

1. ✅ Deploy the frontend changes (already done in code)
2. ✅ Visit your app at `/settings` and click the Analytics tab (admin only)
3. ✅ Let the system run for 24 hours to collect initial data
4. ✅ Check the Analytics Dashboard to see metrics

---

## 📞 Need Help?

If you encounter any issues:

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Logs
   - Filter by "Postgres Logs"
   - Look for error messages

2. **Run Verification Queries:**
   - Use the queries above to check what's created
   - Note which step failed

3. **Manual Fix:**
   - Most issues can be fixed by re-running the specific SQL file
   - Use `DROP TABLE IF EXISTS` if needed to start fresh

---

## 🚀 Quick Deploy Commands

**All in one (copy/paste into SQL Editor):**

```sql
-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Run create_engagement_tracking_system.sql (copy entire file here)
-- [PASTE FILE CONTENTS]

-- 3. Run create_dfs_stats_triggers.sql (copy entire file here)
-- [PASTE FILE CONTENTS]

-- 4. Initialize views
SELECT refresh_daily_engagement_metrics();

-- 5. Backfill stats
SELECT * FROM recalculate_all_dfs_user_stats();

-- 6. Schedule cron
SELECT cron.schedule(
  'refresh-engagement-metrics',
  '0 1 * * *',
  $$ SELECT refresh_daily_engagement_metrics(); $$
);
```

---

**That's it! Your engagement tracking system is now deployed! 🎉**

