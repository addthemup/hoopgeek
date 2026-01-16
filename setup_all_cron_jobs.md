# ⏰ Complete Cron Jobs Setup Guide

## 🎯 Quick Answer

**You have:**
- ✅ **4 Player Props cron jobs** (Database cron → Edge Function) - Already working!
- ✅ **1 Standings cron job** (Database cron → Edge Function) - Already working!
- ✅ **1 Leaders cron job** (Database cron → Edge Function) - Already working!
- ⚠️ **1 Box Scores cron job** (GitHub Actions → Python) - Needs GitHub secrets
- ⚠️ **1 Team Rosters cron job** (GitHub Actions → Python) - Needs GitHub secrets

## 🏗️ How It Works

### Type 1: Database Cron → Edge Functions ✅
**These work because Edge Functions run Deno/TypeScript:**

1. **Player Props** (4 times daily)
   - 12:00 AM, 11:00 AM, 2:30 PM, 5:00 PM UTC
   - Edge Function: `import-player-props` ✅ EXISTS
   - Migration: `20251110000000_setup_player_props_cron.sql`

2. **Standings** (Daily 3 AM)
   - Edge Function: `update-standings` ✅ EXISTS
   - Migration: `20250120000001_setup_standings_cron.sql`

3. **Leaders** (Daily 3 AM)
   - Edge Function: `update-leaders` ✅ EXISTS
   - Migration: `20250120000003_setup_leaders_cron.sql`

### Type 2: GitHub Actions → Python Scripts ⚠️
**Python scripts CANNOT run in Edge Functions, so we use GitHub Actions:**

4. **Box Scores** (Daily 1:45 AM)
   - Python Script: `scripts/setup/import_daily_boxscores.py`
   - GitHub Actions: `.github/workflows/import-boxscores.yml` ✅ CREATED
   - Needs: GitHub secrets configured

5. **Team Rosters** (Daily 4 AM)
   - Python Script: `scripts/setup/import_nba_team_rosters.py`
   - GitHub Actions: `.github/workflows/import-team-rosters.yml` ✅ CREATED
   - Needs: GitHub secrets configured

## 🚀 Setup Steps

### Step 1: Add GitHub Secrets (Required for Box Scores & Team Rosters)

1. Go to your GitHub repository
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these two secrets:

**Secret 1:**
- Name: `SUPABASE_URL`
- Value: `https://qbznyaimnrpibmahisue.supabase.co`

**Secret 2:**
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw`

### Step 2: Run Database Migrations (For Edge Function Cron Jobs)

Run these in Supabase SQL Editor:

```sql
-- 1. Player Props (4 cron jobs)
-- Already exists: supabase/migrations/20251110000000_setup_player_props_cron.sql

-- 2. Standings
-- Already exists: supabase/migrations/20250120000001_setup_standings_cron.sql

-- 3. Leaders
-- Already exists: supabase/migrations/20250120000003_setup_leaders_cron.sql
```

### Step 3: Deploy Edge Functions

```bash
# Deploy all Edge Functions
supabase functions deploy import-player-props
supabase functions deploy update-standings
supabase functions deploy update-leaders
```

### Step 4: Verify Everything

#### Check Database Cron Jobs:
```sql
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
ORDER BY jobname;
```

You should see:
- `import-player-props-12am`
- `import-player-props-11am`
- `import-player-props-230pm`
- `import-player-props-5pm`
- `update-nba-standings-cron`
- `update-nba-leaders-cron`

#### Check GitHub Actions:
1. Go to GitHub → **Actions** tab
2. You should see:
   - ✅ Import Daily Box Scores
   - ✅ Import NBA Team Rosters

## 📊 Complete Cron Jobs List

| # | Job | Type | Schedule | Status |
|---|-----|------|----------|--------|
| 1 | Player Props (12am) | DB Cron → Edge Function | 12:00 AM UTC | ✅ Ready |
| 2 | Player Props (11am) | DB Cron → Edge Function | 11:00 AM UTC | ✅ Ready |
| 3 | Player Props (2:30pm) | DB Cron → Edge Function | 2:30 PM UTC | ✅ Ready |
| 4 | Player Props (5pm) | DB Cron → Edge Function | 5:00 PM UTC | ✅ Ready |
| 5 | Standings | DB Cron → Edge Function | 3:00 AM UTC | ✅ Ready |
| 6 | Leaders | DB Cron → Edge Function | 3:00 AM UTC | ✅ Ready |
| 7 | Box Scores | GitHub Actions → Python | 1:45 AM UTC | ⚠️ Needs secrets |
| 8 | Team Rosters | GitHub Actions → Python | 4:00 AM UTC | ⚠️ Needs secrets |

## 🔍 Verification Commands

### Check All Cron Jobs
```sql
SELECT * FROM cron.job ORDER BY jobname;
```

### Check GitHub Actions Status
- Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
- Look for workflow runs

### Test Manually

**Database Cron Jobs:**
```sql
-- Test player props
SELECT cron.run_job('import-player-props-12am');

-- Test standings
SELECT cron.run_job('update-nba-standings-cron');

-- Test leaders
SELECT cron.run_job('update-nba-leaders-cron');
```

**GitHub Actions:**
- Go to Actions tab
- Click on workflow
- Click "Run workflow" button

## ❓ FAQ

### Q: Can I run Python scripts in database cron?
**A:** No. Database cron can only call Edge Functions (Deno/TypeScript). Python scripts must run via GitHub Actions or external services.

### Q: Why do we have Edge Functions for some and GitHub Actions for others?
**A:** 
- **Edge Functions** (Deno/TypeScript): Player Props, Standings, Leaders - these are written in TypeScript
- **GitHub Actions** (Python): Box Scores, Team Rosters - these use Python libraries (nba-api)

### Q: Do I need to deploy Edge Functions?
**A:** Yes, for the database cron jobs to work:
```bash
supabase functions deploy import-player-props
supabase functions deploy update-standings
supabase functions deploy update-leaders
```

### Q: How do I know if cron jobs are running?
**A:** Check the cron job history:
```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

## ✅ Summary

**What's Already Working:**
- ✅ 4 Player Props cron jobs (via Edge Function)
- ✅ Standings cron job (via Edge Function)
- ✅ Leaders cron job (via Edge Function)

**What Needs Setup:**
- ⚠️ Add GitHub secrets for Box Scores & Team Rosters
- ⚠️ GitHub Actions will then run automatically

**Total: 8 cron jobs** (6 via database, 2 via GitHub Actions)

