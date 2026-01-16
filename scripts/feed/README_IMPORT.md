# Import Player Game Stats

This script imports player game statistics from JSON files into the `nba_player_game_stats` table.

## Prerequisites

1. **Python packages:**
   ```bash
   pip install supabase python-dotenv
   ```

2. **Environment variables:**
   Set these in your `.env` file or environment:
   - `VITE_SUPABASE_URL` or `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Database migration:**
   Make sure you've run the migration:
   ```sql
   -- Run: supabase/migrations/template_player_game_stats.sql
   ```

## Usage

### Basic Import
```bash
cd scripts/feed
python3 import_player_game_stats.py
```

### Dry Run (Test without importing)
```bash
python3 import_player_game_stats.py --dry-run
```

### Skip Existing Games
```bash
python3 import_player_game_stats.py --skip-existing
```

### Limit to First N Files (for testing)
```bash
python3 import_player_game_stats.py --limit 5
```

### Combine Options
```bash
python3 import_player_game_stats.py --dry-run --limit 3
```

## What It Does

1. **Scans** all JSON files in `scripts/feed/` directory (files starting with `002`)
2. **Extracts** player stats from `AggregatedPlayerStats` in each JSON file
3. **Looks up** player UUID from `nba_players` table using `nba_player_id`
4. **Maps** stats to database fields:
   - Advanced stats (PER, ORtg, DRtg, TS%, Usage%, etc.)
   - Four Factors (eFG%, FTA Rate, OREB%, TOV%)
   - Hustle stats (contested shots, deflections, charges, etc.)
   - Misc impact stats (points off TO, fast break, paint, etc.)
   - Player tracking (touches, passes, time of possession, etc.)
   - Scoring breakdown (zone percentages - may be NULL if not in JSON)
5. **Imports** using upsert (handles duplicates gracefully)

## Field Mapping

The script maps JSON fields to database columns:

| JSON Field | Database Field | Notes |
|------------|----------------|-------|
| `advanced_playerEfficiencyRating` | `advanced_playerEfficiencyRating` | PER |
| `advanced_offensiveRating` | `advanced_offensiveRating` | ORtg |
| `advanced_defensiveRating` | `advanced_defensiveRating` | DRtg |
| `advanced_netRating` | `advanced_netRating` | NetRtg |
| `advanced_trueShootingPercentage` | `advanced_trueShootingPercentage` | TS% |
| `advanced_usagePercentage` | `advanced_usagePercentage` | USG% |
| `advanced_assistRatio` | `advanced_assistRatio` | |
| `advanced_reboundPercentage` | `advanced_reboundPercentage` | |
| `advanced_pace` | `advanced_pace` | |
| `fourFactors_effectiveFieldGoalPercentage` | `fourFactors_effectiveFieldGoalPercentage` | eFG% |
| `fourFactors_freeThrowAttemptRate` | `fourFactors_freeThrowAttemptRate` | FTA Rate |
| `fourFactors_offensiveReboundPercentage` | `fourFactors_offensiveReboundPercentage` | OREB% |
| `fourFactors_teamTurnoverPercentage` | `fourFactors_turnoverPercentage` | Note: teamTurnoverPercentage in JSON |
| `hustle_contestedShots` | `hustle_contestedShots` | |
| `hustle_contestedShots3pt` | `hustle_contestedShots3pt` | |
| `hustle_deflections` | `hustle_deflections` | |
| `hustle_looseBallsRecoveredTotal` | `hustle_looseBallsRecovered` | Note: Total in JSON |
| `hustle_chargesDrawn` | `hustle_chargesDrawn` | |
| `hustle_screenAssists` | `hustle_screenAssists` | |
| `misc_pointsOffTurnovers` | `misc_pointsOffTurnovers` | |
| `misc_pointsSecondChance` | `misc_pointsSecondChance` | |
| `misc_pointsFastBreak` | `misc_pointsFastBreak` | |
| `misc_pointsPaint` | `misc_pointsPaint` | |
| `playerTrack_touches` | `playerTrack_touches` | |
| `playerTrack_passes` | `playerTrack_passes` | |
| `playerTrack_timeOfPossession` | `playerTrack_timeOfPossession` | |
| `playerTrack_contestedFieldGoalPercentage` | `playerTrack_contestedFieldGoalPercentage` | |
| `playerTrack_uncontestedFieldGoalsPercentage` | `playerTrack_uncontestedFieldGoalsPercentage` | |
| `playerTrack_defendedAtRimFieldGoalPercentage` | `playerTrack_defendedAtRimFieldGoalPercentage` | |
| `scoring_*` fields | `scoring_*` fields | May be NULL if not in JSON |

## Handling Missing Players

If a player's `nba_player_id` is not found in the `nba_players` table, that player's stats will be skipped. The script will:
- Log a warning
- Continue processing other players
- Report skipped players in the summary

## Error Handling

- **JSON decode errors**: File is skipped, error logged
- **Missing gameId**: File is skipped, error logged
- **Missing AggregatedPlayerStats**: File is skipped, error logged
- **Database errors**: Import fails for that file, error logged
- **Missing player**: Player is skipped, continues with others

## Output

The script provides:
- Progress updates for each file
- Summary statistics:
  - Files processed/successful/failed/skipped
  - Players processed/imported/skipped
  - Total time elapsed
  - List of errors (if any)

## Notes

- **Scoring breakdown fields** may be NULL if they're not in the JSON files
- The script uses **upsert** (ON CONFLICT DO UPDATE) to handle duplicates
- **Player ID lookup** is cached per file for performance
- Small delay (0.1s) between files to avoid rate limiting

## Troubleshooting

### "Missing Supabase credentials"
- Check your `.env` file or environment variables
- Make sure `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

### "Column not found in schema cache" (PGRST204 error)
**This is a Supabase schema cache issue.** After running the migration:

1. **Refresh the schema cache:**
   - Go to Supabase Dashboard
   - Navigate to **Settings > API**
   - Click **"Reload schema cache"** button
   - Wait 1-2 minutes for it to refresh

2. **Or verify columns exist:**
   - Run `scripts/feed/verify_table_columns.sql` in SQL Editor
   - Check that all 34 columns are listed
   - If columns are missing, re-run the migration

3. **If still not working:**
   - Wait 5-10 minutes (cache refreshes automatically)
   - Or restart your Supabase project

### "Player not found in nba_players"
- The player needs to exist in `nba_players` table first
- Check that `nba_player_id` matches between JSON and database

### "No JSON files found"
- Make sure you're running from `scripts/feed/` directory
- JSON files should start with `002` (game IDs)

### Import errors
- Check database connection
- Verify migration has been run completely
- Check table permissions (RLS policies)
- Verify all columns exist (run verify_table_columns.sql)

