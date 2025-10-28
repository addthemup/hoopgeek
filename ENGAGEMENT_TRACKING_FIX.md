# 🔧 Engagement Tracking Migration Fix

## Issue Fixed

**Error:** `ERROR: 42809: cannot create index on relation "dfs_user_statistics"`  
**Cause:** `dfs_user_statistics` already exists as a VIEW in your database  
**Solution:** Drop the existing view before creating it as a TABLE

---

## ✅ What Was Fixed

Updated `create_engagement_tracking_system.sql` to:

```sql
-- Drop existing view if it exists (from previous migrations)
DROP VIEW IF EXISTS public.dfs_user_statistics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.dfs_user_statistics CASCADE;

CREATE TABLE IF NOT EXISTS public.dfs_user_statistics (
  -- ... table definition
);
```

---

## 🚀 How to Deploy Now

### Option 1: Re-run the Full Migration (Recommended)

**In Supabase SQL Editor:**

1. Copy the entire updated `create_engagement_tracking_system.sql`
2. Paste into SQL Editor
3. Click "Run"

The migration will now:
- ✅ Drop the old view
- ✅ Create the table
- ✅ Create all indexes successfully

---

### Option 2: Quick Fix Only

If you want to just fix the specific error and continue:

**Run this first:**

```sql
-- Drop the conflicting view
DROP VIEW IF EXISTS public.dfs_user_statistics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.dfs_user_statistics CASCADE;
```

**Then run the table creation:**

```sql
CREATE TABLE IF NOT EXISTS public.dfs_user_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_contests_entered INTEGER DEFAULT 0,
  active_contests INTEGER DEFAULT 0,
  completed_contests INTEGER DEFAULT 0,
  total_entry_fees_paid DECIMAL(12, 2) DEFAULT 0.00,
  total_winnings DECIMAL(12, 2) DEFAULT 0.00,
  net_profit_loss DECIMAL(12, 2) DEFAULT 0.00,
  roi_percentage DECIMAL(10, 2),
  contests_won INTEGER DEFAULT 0,
  contests_cashed INTEGER DEFAULT 0,
  cash_rate DECIMAL(5, 2),
  win_rate DECIMAL(5, 2),
  avg_final_score DECIMAL(10, 2),
  best_final_score DECIMAL(10, 2),
  total_points_scored DECIMAL(15, 2) DEFAULT 0.00,
  avg_rank DECIMAL(10, 2),
  best_rank INTEGER,
  top_10_finishes INTEGER DEFAULT 0,
  top_25_percent_finishes INTEGER DEFAULT 0,
  total_lineups_created INTEGER DEFAULT 0,
  avg_salary_cap_used DECIMAL(5, 2),
  favorite_difficulty_tier TEXT,
  most_used_player_id BIGINT,
  most_successful_player_id BIGINT,
  avg_starters_overlap DECIMAL(5, 2),
  last_contest_entered_at TIMESTAMPTZ,
  last_prize_won_at TIMESTAMPTZ,
  longest_winning_streak INTEGER DEFAULT 0,
  current_winning_streak INTEGER DEFAULT 0,
  longest_losing_streak INTEGER DEFAULT 0,
  current_losing_streak INTEGER DEFAULT 0,
  skill_tier TEXT,
  confidence_score DECIMAL(5, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  first_contest_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT valid_counts CHECK (
    total_contests_entered >= 0 AND
    completed_contests >= 0 AND
    completed_contests <= total_contests_entered
  ),
  CONSTRAINT valid_money CHECK (
    total_entry_fees_paid >= 0 AND
    total_winnings >= 0
  ),
  CONSTRAINT valid_rates CHECK (
    (cash_rate IS NULL OR (cash_rate >= 0 AND cash_rate <= 100)) AND
    (win_rate IS NULL OR (win_rate >= 0 AND win_rate <= 100))
  )
);

-- Create indexes
CREATE INDEX idx_dfs_user_stats_user ON dfs_user_statistics(user_id);
CREATE INDEX idx_dfs_user_stats_roi ON dfs_user_statistics(roi_percentage DESC NULLS LAST);
CREATE INDEX idx_dfs_user_stats_cash_rate ON dfs_user_statistics(cash_rate DESC NULLS LAST);
CREATE INDEX idx_dfs_user_stats_net_profit ON dfs_user_statistics(net_profit_loss DESC);
CREATE INDEX idx_dfs_user_stats_skill_tier ON dfs_user_statistics(skill_tier);
```

---

## 🔍 Why This Happened

Your database likely had an older migration that created `dfs_user_statistics` as a VIEW (possibly from a previous DFS system setup).

**Views** can't have indexes, so when the migration tried to create indexes on what it thought was a table, it failed.

**The fix:** Drop the view first, then create it as a proper TABLE.

---

## ✅ Verification

After running the fix, verify the table was created:

```sql
-- Check table exists
SELECT table_type 
FROM information_schema.tables 
WHERE table_name = 'dfs_user_statistics';
-- Should return: "BASE TABLE"

-- Check indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'dfs_user_statistics';
-- Should return 5 indexes
```

---

## 🎯 Continue Deployment

Once this is fixed, continue with the rest of the deployment:

1. ✅ Run `create_dfs_stats_triggers.sql`
2. ✅ Refresh materialized views:
   ```sql
   SELECT refresh_daily_engagement_metrics();
   ```
3. ✅ Backfill stats:
   ```sql
   SELECT * FROM recalculate_all_dfs_user_stats();
   ```
4. ✅ Set up cron job:
   ```sql
   SELECT cron.schedule(
     'refresh-engagement-metrics',
     '0 1 * * *',
     $$ SELECT refresh_daily_engagement_metrics(); $$
   );
   ```

---

## 📊 All Good Now!

The migration file has been updated and should work cleanly on your next deployment or for future installs.

**Just re-run the updated SQL file and you're good to go! 🚀**

