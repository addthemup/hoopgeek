# Import Player Props Edge Function

This Edge Function imports player props from the SportsGameOdds API and stores them in Supabase.

## Schedule

The function runs 4 times daily via cron jobs:

1. **12:00 AM UTC** (Midnight) - Early morning update
2. **11:00 AM UTC** - Pre-game update  
3. **2:30 PM UTC** (14:30) - Afternoon update
4. **5:00 PM UTC** (17:00) - **Final update** (data considered final after this)

> **Note:** Times are in UTC. If you need EST/PST times, adjust the cron schedule in the migration file.

## How It Works

1. Fetches NBA events from SportsGameOdds API
2. Filters events for today (or tomorrow if no events today)
3. Extracts player props (over/under with lines)
4. Maps API player IDs to `nba_players` table
5. Stores props in `player_props` table

## Data Finalization

After the **5:00 PM** scrape, the data is considered "final" for that day. Games that start after 5:00 PM will use the data from the 5:00 PM scrape.

## Environment Variables

Make sure these are set in your Supabase project:

- `VITE_SPORTS_ODDS_API_KEY` or `SPORTS_ODDS_API_KEY` - Your SportsGameOdds API key
- `SUPABASE_URL` - Your Supabase project URL (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (auto-set)

## Deployment

1. Deploy the Edge Function:
   ```bash
   supabase functions deploy import-player-props
   ```

2. Run the migration to set up cron jobs:
   ```bash
   supabase migration up
   ```

   Or run the SQL directly in Supabase SQL Editor:
   ```sql
   -- Run: supabase/migrations/20251110000000_setup_player_props_cron.sql
   ```

## Manual Testing

You can manually trigger the function:

```bash
curl -X POST https://qbznyaimnrpibmahisue.supabase.co/functions/v1/import-player-props \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual"}'
```

Or via Supabase SQL:
```sql
SELECT cron.run_job('import-player-props-12am');
```

## Monitoring

Check cron job status:
```sql
SELECT * FROM cron.job 
WHERE jobname LIKE 'import-player-props%';
```

View job run history:
```sql
SELECT * FROM cron.job_run_details 
WHERE jobname LIKE 'import-player-props%' 
ORDER BY start_time DESC 
LIMIT 20;
```

## Adjusting Times

To change the schedule times, edit the cron expressions in:
`supabase/migrations/20251110000000_setup_player_props_cron.sql`

Cron format: `minute hour day month weekday`

Example (EST to UTC conversion):
- 12:00 AM EST = 5:00 AM UTC = `0 5 * * *`
- 11:00 AM EST = 4:00 PM UTC = `0 16 * * *`
- 2:30 PM EST = 7:30 PM UTC = `30 19 * * *`
- 5:00 PM EST = 10:00 PM UTC = `0 22 * * *`

