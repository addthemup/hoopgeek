# NBA Injury Report Fetcher - Setup Guide

## Overview

This edge function scrapes the official NBA injury report PDFs that are published multiple times per day at:
`https://ak-static.cms.nba.com/referee/injury/Injury-Report_YYYY-MM-DD_HHAM.pdf`

## Quick Start

### 1. Apply Database Migration

Run the migration in Supabase SQL editor:
```sql
-- File: supabase/migrations/20251204000000_create_nba_injuries.sql
```

### 2. Deploy Edge Function

```bash
cd /Users/adam/Desktop/hoopgeek
npx supabase functions deploy fetch-injuries --no-verify-jwt
```

### 3. Test the Function

```bash
# Test via curl
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/fetch-injuries" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

Or test from your app:
```typescript
const { data, error } = await supabase.functions.invoke('fetch-injuries')
console.log(data)
```

## How It Works

1. **PDF URL Generation**: Tries multiple common times (8AM, 12PM, 4PM, 6PM) to find today's injury report
2. **PDF Fetching**: Downloads the PDF from NBA's CDN
3. **PDF Parsing**: Extracts text using `pdf-parse` library
4. **Data Extraction**: Parses the table structure to extract:
   - Player name
   - Team
   - Injury status (Out, Questionable, Probable, Available)
   - Injury reason/description
5. **Player Matching**: Matches players to your database by name and team
6. **Database Update**: Inserts new injury records (keeps history)

## PDF Format

The PDF contains a table like:
```
| Game Date | Game Time | Matchup | Team | Player Name | Current Status | Reason |
| 12/02/2025 | 07:00 (ET) | WAS@PHI | Philadelphia 76ers | Embiid, Joel | Out | Injury/Illness - Right Knee; Injury Recovery |
```

## Scheduling

Set up cron jobs to run multiple times per day:

```sql
-- Morning (8 AM EST = 1 PM UTC)
SELECT cron.schedule(
  'fetch-injuries-morning',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/fetch-injuries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object()
  );
  $$
);

-- Afternoon (12 PM EST = 5 PM UTC)
SELECT cron.schedule(
  'fetch-injuries-afternoon',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/fetch-injuries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object()
  );
  $$
);

-- Evening (4 PM EST = 9 PM UTC)
SELECT cron.schedule(
  'fetch-injuries-evening',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/fetch-injuries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object()
  );
  $$
);
```

## Querying Injury Data

### Get Latest Injury Status for All Players

```sql
SELECT DISTINCT ON (nba_player_id)
  i.*,
  p.name as player_name,
  p.team_abbreviation
FROM nba_injuries i
JOIN nba_players p ON i.nba_player_id = p.nba_player_id
ORDER BY nba_player_id, date_updated DESC;
```

### Get Only Currently Injured Players

```sql
SELECT * FROM active_injuries
WHERE injury_status IN ('Out', 'Questionable')
ORDER BY date_updated DESC;
```

### Get Injury Status for Specific Player

```sql
SELECT 
  i.injury_status,
  i.injury_description,
  i.date_updated
FROM nba_injuries i
WHERE i.nba_player_id = 203999  -- LeBron James
ORDER BY i.date_updated DESC
LIMIT 1;
```

## Troubleshooting

### PDF Not Found (404)
- The PDF may not be published yet for today
- Try different times (the function tries multiple automatically)
- Check if NBA changed the URL pattern

### No Injuries Parsed
- PDF format may have changed
- Check the PDF text extraction in logs
- May need to adjust parsing regex patterns

### Players Not Matched
- Player names may not match exactly (e.g., "Embiid, Joel" vs "Joel Embiid")
- Team abbreviations may differ
- Check the `skipped` count in response
- May need to improve fuzzy matching logic

### PDF Parsing Errors
- The `pdf-parse` library may need updates
- Consider alternative: use a PDF-to-text service
- May need to handle different PDF formats

## Response Format

```json
{
  "success": true,
  "date": "2025-12-02",
  "injuries_found": 45,
  "stored": 42,
  "skipped": 2,
  "errors": 1
}
```

## Notes

- The function keeps history of all injury updates (doesn't overwrite)
- Use `active_injuries` view or `DISTINCT ON` queries to get latest status
- Player matching uses fuzzy logic - may need refinement based on your data
- The function tries multiple PDF URLs automatically (different times)

