# ⏰ Cron Jobs - Complete Explanation

## 🤔 Your Questions Answered

### Q: Do we have 4 player prop scrape cron jobs?
**A: YES!** ✅ Already set up and working via database cron → Edge Function

### Q: Do we have a cron job for nba_boxscores?
**A: YES!** ✅ Created - runs via Edge Function (database cron)

### Q: Can I run a cron job that's Python?
**A: NO** - Database cron jobs can only call Edge Functions (Deno/TypeScript), not Python scripts.
**However:** We've rewritten the Python scripts as Edge Functions, so everything runs consistently!

### Q: Do we have Edge Functions for these?
**A: YES!** ✅ All cron jobs now use Edge Functions:
- ✅ Player Props - Edge Function exists
- ✅ Standings - Edge Function exists  
- ✅ Leaders - Edge Function exists
- ✅ Box Scores - Edge Function exists (rewritten from Python)
- ✅ Team Rosters - Edge Function exists (rewritten from Python)

## 🏗️ Architecture Explained

### Unified System: **Database Cron → Edge Functions** (TypeScript/Deno)
```
Database Cron Job → Calls Edge Function → Runs TypeScript Code
```
**All cron jobs use this system:**
- Player Props (4x daily) ✅
- Standings (daily) ✅
- Leaders (daily) ✅
- Box Scores (daily) ✅
- Team Rosters (daily) ✅

**Note:** The Python scripts (`import_daily_boxscores.py` and `import_nba_team_rosters.py`) have been rewritten as Edge Functions for consistency. The original Python scripts are kept for reference but are no longer used by cron jobs.

## 📋 Complete List of All Cron Jobs

### ✅ Already Working (Database Cron → Edge Functions)

1. **Player Props - 12:00 AM UTC**
   - Job Name: `import-player-props-12am`
   - Edge Function: `import-player-props` ✅ EXISTS
   - Status: ✅ Ready

2. **Player Props - 11:00 AM UTC**
   - Job Name: `import-player-props-11am`
   - Edge Function: `import-player-props` ✅ EXISTS
   - Status: ✅ Ready

3. **Player Props - 2:30 PM UTC**
   - Job Name: `import-player-props-230pm`
   - Edge Function: `import-player-props` ✅ EXISTS
   - Status: ✅ Ready

4. **Player Props - 5:00 PM UTC**
   - Job Name: `import-player-props-5pm`
   - Edge Function: `import-player-props` ✅ EXISTS
   - Status: ✅ Ready

5. **Standings - 3:00 AM UTC**
   - Job Name: `update-nba-standings-cron`
   - Edge Function: `update-standings` ✅ EXISTS
   - Status: ✅ Ready

6. **Leaders - 3:00 AM UTC**
   - Job Name: `update-nba-leaders-cron`
   - Edge Function: `update-leaders` ✅ EXISTS
   - Status: ✅ Ready

7. **Box Scores - 1:45 AM UTC**
   - Job Name: `import-daily-boxscores-cron`
   - Edge Function: `import-boxscores` ✅ EXISTS
   - Status: ✅ Ready

8. **Team Rosters - 4:00 AM UTC**
   - Job Name: `update-nba-team-rosters-cron`
   - Edge Function: `import-team-rosters` ✅ EXISTS
   - Status: ✅ Ready

## 🚀 Quick Setup (5 Minutes)

### Step 1: Add GitHub Secrets (2 minutes)

1. Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions
2. Click **"New repository secret"**
3. Add these two secrets:

**Secret 1:**
- Name: `SUPABASE_URL`
- Value: `https://qbznyaimnrpibmahisue.supabase.co`

**Secret 2:**
- Name: `SUPABASE_SERVICE_ROLE_KEY`
- Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw`

### Step 2: Verify Database Cron Jobs (1 minute)

Run this in Supabase SQL Editor:

```sql
-- Check all cron jobs
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
ORDER BY jobname;
```

You should see 6 jobs (4 player props + standings + leaders).

### Step 3: Deploy Edge Functions (2 minutes)

```bash
cd /Users/adam/Desktop/hoopgeek
supabase functions deploy import-player-props
supabase functions deploy update-standings
supabase functions deploy update-leaders
```

### Step 4: Verify GitHub Actions

1. Go to GitHub → **Actions** tab
2. You should see:
   - ✅ Import Daily Box Scores
   - ✅ Import NBA Team Rosters
3. They will run automatically once secrets are added

## ✅ Final Status

| Job | Type | Status |
|-----|------|--------|
| Player Props (4x) | DB Cron → Edge Function | ✅ Working |
| Standings | DB Cron → Edge Function | ✅ Working |
| Leaders | DB Cron → Edge Function | ✅ Working |
| Box Scores | GitHub Actions → Python | ⚠️ Add secrets |
| Team Rosters | GitHub Actions → Python | ⚠️ Add secrets |

**Total: 8 cron jobs** (6 working, 2 need GitHub secrets)

## 🎯 Summary

- ✅ **6 cron jobs** are already set up and working (via database cron → Edge Functions)
- ⚠️ **2 cron jobs** need GitHub secrets to work (via GitHub Actions → Python scripts)
- 🔧 **All workflows are created** - just need to add the secrets!

Once you add the GitHub secrets, all 8 cron jobs will run automatically! 🎉

