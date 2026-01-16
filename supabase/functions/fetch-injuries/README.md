# NBA Injury Report Fetcher

Fetches and parses the official NBA injury report PDFs published multiple times per day.

## Overview

The NBA publishes official injury reports as PDFs at:
- `https://ak-static.cms.nba.com/referee/injury/Injury-Report_YYYY-MM-DD_HHAM.pdf`

This edge function:
1. Fetches the latest injury report PDF for today
2. Parses the PDF to extract injury data
3. Matches players to your database
4. Updates the `nba_injuries` table

## PDF Format

The PDF contains a table with:
- Game Date
- Game Time
- Matchup (e.g., "WAS@PHI")
- Team Name
- Player Name
- Current Status (Out, Questionable, Probable, Available)
- Reason (injury description)

## Deployment

### 1. Deploy the Function

```bash
cd /Users/adam/Desktop/hoopgeek
npx supabase functions deploy fetch-injuries --no-verify-jwt
```

### 2. Test the Function

```bash
# Fetch today's injuries
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/fetch-injuries \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# Fetch specific date
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/fetch-injuries?date=2025-12-02" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Usage

### Manual Trigger

```typescript
const { data, error } = await supabase.functions.invoke('fetch-injuries', {
  body: {}
})
```

### Scheduled via Cron

Add to your daily maintenance cron or create a separate schedule:

```sql
-- Run multiple times per day (8 AM, 12 PM, 4 PM, 6 PM EST)
SELECT cron.schedule(
  'fetch-injuries-morning',
  '0 13 * * *', -- 8 AM EST = 1 PM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/fetch-injuries',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object()
    );
  $$
);

SELECT cron.schedule(
  'fetch-injuries-afternoon',
  '0 17 * * *', -- 12 PM EST = 5 PM UTC
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/fetch-injuries',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object()
    );
  $$
);

SELECT cron.schedule(
  'fetch-injuries-evening',
  '0 21 * * *', -- 4 PM EST = 9 PM UTC
  $$
  SELECT
    net.http_post(
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

## Player Matching

The function matches players by:
1. Name similarity (fuzzy match)
2. Team abbreviation
3. Active player status

If a player can't be matched, it's skipped and logged.

## Injury Status Mapping

- `Out` → `Out`
- `Questionable` → `Questionable`
- `Probable` → `Probable`
- `Available` → `Healthy`

## Troubleshooting

### PDF Not Found
- The PDF may not be published yet for today
- Try different times (8AM, 12PM, 4PM, 6PM)
- Check if the URL pattern has changed

### No Injuries Parsed
- PDF format may have changed
- Check the PDF text extraction
- May need to adjust parsing logic

### Players Not Matched
- Player names may not match exactly
- Team abbreviations may differ
- Check the `skipped` count in response

### PDF Parsing Errors
- The `pdf-parse` library may need updates
- Consider alternative PDF parsing libraries
- May need to use a different approach for text extraction

## Dependencies

- `pdf-parse@1.1.1` - PDF text extraction (via esm.sh)
- `@supabase/supabase-js@2` - Supabase client

## Notes

- The function tries multiple PDF URLs for the same date (different times)
- Player matching uses fuzzy logic - may need refinement
- Injury data is upserted (updates existing records for same player/date)
- The `nba_injuries` table must exist (from migration)

