# 🏀 NBA Team Roster System Setup

This document explains how to set up the NBA team roster scraping system that runs daily at 4 AM.

## 📋 Overview

The system consists of:
1. **Database Table**: `nba_team_roster` - Stores team rosters scraped from NBA API
2. **Python Script**: `scripts/setup/import_nba_team_rosters.py` - Scrapes rosters from NBA API
3. **Cron Job**: Runs daily at 4 AM UTC to keep rosters up to date
4. **Frontend Component**: `MarginTeamRoster` - Displays rosters in margin bars

## 🗄️ Database Setup

### 1. Run Migration

Apply the database migration to create the `nba_team_roster` table:

```bash
# In Supabase SQL Editor or via CLI
supabase db push
```

Or manually run:
```sql
-- File: supabase/migrations/20250120000004_create_nba_team_roster.sql
```

This creates:
- `nba_team_roster` table with foreign keys to `nba_teams` and `nba_players`
- Indexes for performance
- RLS policies for public read access
- Helper function for current season calculation

### 2. Verify Table

```sql
SELECT * FROM nba_team_roster LIMIT 5;
```

## 🐍 One-Time Import

### Prerequisites

Install required Python packages:
```bash
pip install nba-api supabase pandas
```

### Set Environment Variables

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Or use `.env` file:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Run Import Script

```bash
cd /Users/adam/Desktop/hoopgeek
python scripts/setup/import_nba_team_rosters.py
```

This will:
- Fetch all NBA teams from your database
- For each team, fetch roster from NBA API
- Match players to your `nba_players` table by `nba_player_id`
- Insert/update roster entries in `nba_team_roster` table

## ⏰ Cron Job Setup

### Option 1: Database Cron (Recommended)

The migration `20250120000005_setup_team_roster_cron.sql` sets up a cron job that calls an Edge Function.

**Note**: You'll need to create an Edge Function that runs the Python script, or modify the cron to call a different endpoint.

### Option 2: External Cron Service

Use a service like:
- **cron-job.org**
- **GitHub Actions** (scheduled workflows)
- **Cloudflare Workers** (scheduled triggers)

Example GitHub Actions workflow (`.github/workflows/import-rosters.yml`):

```yaml
name: Import NBA Rosters

on:
  schedule:
    - cron: '0 4 * * *'  # 4 AM UTC daily
  workflow_dispatch:  # Allow manual trigger

jobs:
  import:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install nba-api supabase pandas
      - run: python scripts/setup/import_nba_team_rosters.py
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### Option 3: Local Cron (Development)

On macOS/Linux, add to crontab:

```bash
crontab -e
```

Add:
```
0 4 * * * cd /Users/adam/Desktop/hoopgeek && /usr/bin/python3 scripts/setup/import_nba_team_rosters.py >> /tmp/nba_roster_import.log 2>&1
```

## 🔍 Verification

### Check Roster Data

```sql
-- Count rosters by team
SELECT 
    t.team_abbreviation,
    COUNT(*) as player_count
FROM nba_team_roster r
JOIN nba_teams t ON r.team_id = t.team_id
WHERE r.season = '2025-26'
GROUP BY t.team_abbreviation
ORDER BY player_count DESC;
```

### Check Cron Job Status

```sql
-- View scheduled cron jobs
SELECT * FROM cron.job WHERE jobname = 'update-nba-team-rosters-cron';

-- View cron job history
SELECT * FROM cron.job_run_details 
WHERE jobname = 'update-nba-team-rosters-cron'
ORDER BY start_time DESC
LIMIT 10;
```

### Manual Trigger (if using database cron)

```sql
SELECT cron.run_job('update-nba-team-rosters-cron');
```

## 🎨 Frontend Usage

The `MarginTeamRoster` component automatically uses the `nba_team_roster` table:

```tsx
<MarginTeamRoster 
  teamId="team-uuid" 
  activePlayerId="player-uuid" // Optional: highlights active player
/>
```

The component:
- Fetches roster from `nba_team_roster` table
- Links to `nba_players` for additional player data
- Displays players sorted by jersey number
- Highlights active player if provided
- Navigates to player page on click

## 📊 Data Structure

### nba_team_roster Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `team_id` | INTEGER | Foreign key to `nba_teams.team_id` |
| `season` | TEXT | Season (e.g., "2025-26") |
| `player_id` | UUID | Foreign key to `nba_players.id` (nullable) |
| `nba_player_id` | INTEGER | NBA API player ID |
| `player_name` | TEXT | Player name from NBA API |
| `jersey_number` | TEXT | Jersey number |
| `position` | TEXT | Player position |
| `height` | TEXT | Height (e.g., "6-8") |
| `weight` | INTEGER | Weight in pounds |
| `birth_date` | DATE | Birth date |
| `age` | INTEGER | Age |
| `experience_years` | INTEGER | Years of NBA experience |
| `school` | TEXT | College/school |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

### Unique Constraint

The table has a unique constraint on `(team_id, season, nba_player_id)` to prevent duplicates.

## 🔧 Troubleshooting

### No Roster Data

1. Check if import script ran successfully
2. Verify NBA API is accessible
3. Check team IDs match between `nba_teams` and NBA API
4. Review error logs

### Missing Player Links

If `player_id` is null:
- Player may not exist in `nba_players` table yet
- `nba_player_id` should still be populated for matching
- Run player import script to populate `nba_players` table

### Cron Job Not Running

1. Verify pg_cron extension is enabled
2. Check cron job is scheduled: `SELECT * FROM cron.job;`
3. Review cron job history for errors
4. Check Edge Function logs (if using Edge Function approach)

## 📝 Notes

- Rosters are updated daily at 4 AM UTC
- Data is cached for 5 minutes in the frontend
- Roster data is public (read-only via RLS)
- Players are matched by `nba_player_id` when linking to `nba_players` table

