# Player Props Import System

This system caches player betting props from the SportsGameOdds API in your Supabase database to avoid making too many API requests.

## Setup

### 1. Run Database Migrations

```bash
# Apply the player props schema
supabase migration up

# Or apply specific migrations:
# - 20251107000000_create_player_props_system.sql
# - 20251107010000_setup_player_props_cleanup_cron.sql
```

### 2. Install Python Dependencies

The script requires:
- `supabase-py`
- `requests`
- `python-dotenv`

```bash
pip install supabase requests python-dotenv
```

### 3. Set Environment Variables

Make sure your `.env` file has:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SPORTS_ODDS_API_KEY=79ae5f47830d3d87e70896e36b5eefc3
```

### 4. Run the Import Script

**Manual run:**
```bash
python scripts/setup/import_daily_player_props.py
```

**For a specific date:**
```bash
python scripts/setup/import_daily_player_props.py --date 2025-11-07
```

## Automated Daily Import

### Option 1: Cron Job (Recommended)

Add to your system crontab:
```bash
# Run daily at 8 AM to fetch props for today's games
0 8 * * * cd /path/to/hoopgeek && python scripts/setup/import_daily_player_props.py
```

### Option 2: Supabase Edge Function + pg_cron

You can create a Supabase Edge Function that calls this script, then schedule it with pg_cron.

## How It Works

1. **Daily Import**: The script runs each morning to fetch props for today's games
2. **Data Storage**: Props are stored in `player_props` and `player_props_games` tables
3. **Auto Cleanup**: A cron job runs daily at 2 AM to delete data older than 30 days
4. **Frontend Query**: The frontend queries the database instead of the API directly

## Database Schema

### `player_props_games`
Stores game information for props (one row per game per day)

### `player_props`
Stores individual player props (one row per prop per bookmaker)

## Manual Cleanup

To manually clean up old data:
```sql
SELECT cleanup_old_player_props();
```

To check what would be deleted:
```sql
SELECT COUNT(*) FROM player_props WHERE game_date < CURRENT_DATE - INTERVAL '30 days';
SELECT COUNT(*) FROM player_props_games WHERE game_date < CURRENT_DATE - INTERVAL '30 days';
```

## Rate Limiting

The script includes rate limiting (10 requests/minute) to stay within API limits. The script will automatically wait if the rate limit is reached.

## Player Name Matching

The script uses multiple strategies to match API player names to database players:

1. **Manual Mapping Table** (highest priority)
   - Use `player_props_name_mapping` table for manual corrections
   - Run: `python scripts/setup/manage_player_props_mapping.py list-unmatched`
   - Then map: `python scripts/setup/manage_player_props_mapping.py map "API Name" <player-uuid>`

2. **Exact Match** (case-insensitive)
   - Tries exact name match first

3. **Team Context Match**
   - Uses team tricode to narrow down matches
   - More accurate when team is known

4. **Normalized Match**
   - Removes special characters, suffixes (Jr., Sr., etc.)
   - Matches first and last name separately

### Managing Mappings

```bash
# List unmatched player names
python scripts/setup/manage_player_props_mapping.py list-unmatched

# Search for a player in database
python scripts/setup/manage_player_props_mapping.py search "LeBron"

# Add a manual mapping
python scripts/setup/manage_player_props_mapping.py map "L. James" <player-uuid>

# List all current mappings
python scripts/setup/manage_player_props_mapping.py list-mappings
```

## Troubleshooting

### No props found
- Check that games are scheduled for today in `nba_games` table
- Verify the SportsGameOdds API key is correct
- Check API response structure matches expected format
- Check the `raw_event_data` JSONB column in `player_props_games` to see actual API response

### Player name matching issues
- The script tries multiple matching strategies automatically
- Check `player_props` table to see unmatched names: `SELECT DISTINCT player_name FROM player_props WHERE player_id IS NULL`
- Use the mapping tool to manually correct mismatches
- Check logs during import to see which names couldn't be matched

### Database connection errors
- Verify Supabase credentials in `.env`
- Check that migrations have been applied
- Ensure RLS policies allow service role access

