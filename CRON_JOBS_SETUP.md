# ⏰ Cron Jobs Setup Guide

This document explains all the cron jobs in the system and how they work.

## 🏗️ Architecture Overview

### Two Types of Cron Jobs:

1. **Database Cron (pg_cron) → Edge Functions** ✅
   - These work because Edge Functions run Deno/TypeScript
   - Examples: Player Props, Standings, Leaders
   - Set up via SQL migrations

2. **GitHub Actions → Python Scripts** ✅
   - Python scripts can't run in Edge Functions
   - Examples: Box Scores, Team Rosters
   - Set up via GitHub Actions workflows

## 📋 Current Cron Jobs

### ✅ Already Set Up (Database Cron → Edge Functions)

#### 1. Player Props (4 times daily)
- **Edge Function**: `import-player-props`
- **Cron Jobs**: 
  - 12:00 AM UTC (Midnight)
  - 11:00 AM UTC
  - 2:30 PM UTC
  - 5:00 PM UTC
- **Migration**: `20251110000000_setup_player_props_cron.sql`
- **Status**: ✅ Working (Edge Function exists)

#### 2. NBA Standings (Daily at 3 AM)
- **Edge Function**: `update-standings`
- **Cron Job**: 3:00 AM UTC daily
- **Migration**: `20250120000001_setup_standings_cron.sql`
- **Status**: ✅ Working (Edge Function exists)

#### 3. NBA Leaders (Daily at 3 AM)
- **Edge Function**: `update-leaders`
- **Cron Job**: 3:00 AM UTC daily
- **Migration**: `20250120000003_setup_leaders_cron.sql`
- **Status**: ✅ Working (Edge Function exists)

### ⚠️ Need Setup (GitHub Actions → Python Scripts)

#### 4. Daily Box Scores (Daily at 1:45 AM)
- **Python Script**: `scripts/setup/import_daily_boxscores.py`
- **Cron Job**: 1:45 AM UTC daily
- **GitHub Actions**: `.github/workflows/import-boxscores.yml`
- **Status**: ⚠️ Needs GitHub secrets configured

#### 5. Team Rosters (Daily at 4 AM)
- **Python Script**: `scripts/setup/import_nba_team_rosters.py`
- **Cron Job**: 4:00 AM UTC daily
- **GitHub Actions**: Need to create
- **Status**: ⚠️ Needs GitHub Actions workflow

## 🚀 Setup Instructions

### Step 1: Configure GitHub Secrets

Go to your GitHub repository:
1. **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `SUPABASE_URL`: `https://qbznyaimnrpibmahisue.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw`

### Step 2: Run Database Migrations

Run these migrations in Supabase SQL Editor to set up database cron jobs:

```sql
-- 1. Player Props (4 cron jobs)
-- File: supabase/migrations/20251110000000_setup_player_props_cron.sql

-- 2. Standings
-- File: supabase/migrations/20250120000001_setup_standings_cron.sql

-- 3. Leaders
-- File: supabase/migrations/20250120000003_setup_leaders_cron.sql

-- 4. Team Rosters (calls Edge Function - needs implementation)
-- File: supabase/migrations/20250120000005_setup_team_roster_cron.sql

-- 5. Box Scores (calls Edge Function - needs implementation)
-- File: supabase/migrations/20250120000006_setup_boxscores_cron.sql
```

### Step 3: Deploy Edge Functions

Deploy the Edge Functions that are called by database cron:

```bash
# Player Props (already exists)
supabase functions deploy import-player-props

# Standings (already exists)
supabase functions deploy update-standings

# Leaders (already exists)
supabase functions deploy update-leaders

# Team Rosters (needs to be created or use GitHub Actions)
# Box Scores (needs to be created or use GitHub Actions)
```

### Step 4: Verify All Cron Jobs

```sql
-- List all cron jobs
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    database,
    username
FROM cron.job
ORDER BY jobname;
```

## 🔍 Verification

### Check Database Cron Jobs

```sql
-- All database cron jobs
SELECT * FROM cron.job ORDER BY jobname;

-- Player Props jobs
SELECT * FROM cron.job WHERE jobname LIKE 'import-player-props%';

-- Other jobs
SELECT * FROM cron.job WHERE jobname IN (
    'update-nba-standings-cron',
    'update-nba-leaders-cron',
    'update-nba-team-rosters-cron',
    'import-daily-boxscores-cron'
);
```

### Check GitHub Actions

1. Go to GitHub → **Actions** tab
2. You should see:
   - ✅ Import Daily Box Scores (if secrets are set)
   - ⚠️ Import Team Rosters (needs to be created)

### Check Edge Functions

```bash
# List deployed functions
supabase functions list
```

## 📊 Summary

| Job | Type | Schedule | Status |
|-----|------|----------|--------|
| Player Props | Database Cron → Edge Function | 4x daily | ✅ Ready |
| Standings | Database Cron → Edge Function | Daily 3 AM | ✅ Ready |
| Leaders | Database Cron → Edge Function | Daily 3 AM | ✅ Ready |
| Box Scores | GitHub Actions → Python | Daily 1:45 AM | ⚠️ Needs secrets |
| Team Rosters | GitHub Actions → Python | Daily 4 AM | ⚠️ Needs workflow |

## 🐛 Troubleshooting

### Database Cron Not Running

1. Check if pg_cron is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Check job status:
   ```sql
   SELECT * FROM cron.job WHERE active = false;
   ```

3. Check job history:
   ```sql
   SELECT * FROM cron.job_run_details 
   ORDER BY start_time DESC 
   LIMIT 20;
   ```

### GitHub Actions Not Running

1. Check if secrets are set in GitHub
2. Check workflow file syntax
3. View Actions tab for error messages

### Edge Functions Not Working

1. Check function logs in Supabase Dashboard
2. Verify environment variables are set
3. Test manually via curl or Supabase CLI

