# 📊 Daily Box Scores Import - Cron Setup Guide

This guide explains how to set up automatic daily imports of NBA box scores at 1:45 AM.

## 🎯 Overview

The box score import runs daily to fetch and store box score data for games from the previous day. This ensures your database always has the latest player statistics.

## ⏰ Schedule

- **Time**: 1:45 AM UTC daily
- **What it does**: Imports box scores for all completed games from yesterday
- **Script**: `scripts/setup/import_daily_boxscores.py`

## 🚀 Setup Options

### Option 1: GitHub Actions (Recommended)

GitHub Actions is the easiest way to run Python scripts on a schedule.

#### Step 1: Add Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

#### Step 2: Verify Workflow File

The workflow file is already created at:
```
.github/workflows/import-boxscores.yml
```

It will:
- Run daily at 1:45 AM UTC
- Install Python dependencies
- Execute the import script
- Import box scores for yesterday's games

#### Step 3: Enable Workflows

1. Go to **Actions** tab in your GitHub repository
2. The workflow should appear and will run automatically
3. You can manually trigger it using "Run workflow"

### Option 2: Database Cron (Alternative)

If you prefer using the database cron system:

#### Step 1: Run Migration

```sql
-- File: supabase/migrations/20250120000006_setup_boxscores_cron.sql
```

This creates a cron job that calls an Edge Function. However, since Edge Functions run Deno (not Python), you'll need to:

1. **Option A**: Use the Edge Function to trigger an external webhook that runs the Python script
2. **Option B**: Rewrite the import logic in Deno/TypeScript for the Edge Function
3. **Option C**: Use the Edge Function to call a service that executes the Python script

#### Step 2: Verify Cron Job

```sql
SELECT * FROM cron.job WHERE jobname = 'import-daily-boxscores-cron';
```

### Option 3: External Cron Service

Use a service like **cron-job.org** or **EasyCron**:

1. Create an account on the cron service
2. Set up a job to run daily at 1:45 AM UTC
3. Configure it to make an HTTP request to trigger your script
4. Or use their "run script" feature if they support Python

### Option 4: Local Server Cron (Development)

If you have a server running 24/7:

```bash
# Add to crontab
crontab -e

# Add this line (adjust path as needed):
45 1 * * * cd /Users/adam/Desktop/hoopgeek && /usr/bin/python3 scripts/setup/import_daily_boxscores.py >> /tmp/boxscores_import.log 2>&1
```

## 📋 Manual Execution

You can always run the script manually:

```bash
# Import yesterday's games
python3 scripts/setup/import_daily_boxscores.py

# Import specific date
python3 scripts/setup/import_daily_boxscores.py 2025-11-10

# Import date range
python3 scripts/setup/import_daily_boxscores.py 2025-11-03 2025-11-10
```

## 🔍 Verification

### Check Import Status

```sql
-- Check recent box scores
SELECT 
    game_date,
    COUNT(*) as player_count
FROM nba_boxscores
WHERE game_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY game_date
ORDER BY game_date DESC;
```

### Check Cron Job Status (if using database cron)

```sql
-- View scheduled job
SELECT * FROM cron.job WHERE jobname = 'import-daily-boxscores-cron';

-- View job history
SELECT * FROM cron.job_run_details 
WHERE jobname = 'import-daily-boxscores-cron'
ORDER BY start_time DESC
LIMIT 10;
```

### Check GitHub Actions (if using GitHub)

1. Go to **Actions** tab in GitHub
2. Click on "Import Daily Box Scores" workflow
3. View run history and logs

## 🐛 Troubleshooting

### Script Not Running

1. **Check environment variables**: Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
2. **Check Python dependencies**: Run `pip install nba-api supabase pandas python-dotenv`
3. **Check NBA API access**: The script needs internet access to fetch from NBA API
4. **Check logs**: Review error messages in the output

### Missing Box Scores

1. **Verify games exist**: Check `nba_games` table for completed games
2. **Check game status**: Games must be marked as completed
3. **Verify season year**: Script looks for `season_year = 2025` in `nba_games` table
4. **Check date format**: Ensure game dates are in correct format

### Rate Limiting

The script includes 1-second delays between API calls to avoid rate limiting. If you encounter issues:
- Increase the delay in the script
- Run imports during off-peak hours
- Contact NBA API support if persistent issues

## 📊 What Gets Imported

For each completed game, the script imports:
- Player statistics (points, rebounds, assists, etc.)
- Game scores (updates `nba_games` table)
- Player information (creates players if they don't exist)
- All box score data into `nba_boxscores` table

## 🔄 Update Schedule

The cron job runs at **1:45 AM UTC** which is:
- **8:45 PM EST** (previous day) during standard time
- **9:45 PM EST** (previous day) during daylight saving time

This ensures games from the previous day are imported early in the morning.

## 📝 Notes

- The script automatically skips games that already have box score data
- Game scores are always updated, even if box scores already exist
- The script handles missing players by creating them automatically
- All data is stored with proper foreign key relationships

