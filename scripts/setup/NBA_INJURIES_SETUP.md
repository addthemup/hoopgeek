# NBA Injury Data Setup

This guide explains how to fetch and store NBA injury data using free sources.

## Overview

Since paid APIs like Rotowire aren't available, we use free alternatives:
1. **NBA.com API** - Official NBA stats API (may have injury endpoints)
2. **Web Scraping** - Scrape NBA.com injury reports page
3. **Game Data Extraction** - Extract injury indicators from existing game JSON files

## Database Schema

The `nba_injuries` table stores:
- Player reference (linked to `nba_players`)
- Injury type and description
- Injury status (Out, Questionable, Probable, Day-to-Day, Healthy)
- Dates (when injured, expected return)
- Source information

## Setup

### 1. Apply Database Migration

Run the migration in Supabase SQL editor:
```sql
-- File: supabase/migrations/20251204000000_create_nba_injuries.sql
```

### 2. Run Injury Fetcher Script

```bash
python3 scripts/setup/fetch_nba_injuries.py
```

## Free API Options

### Option 1: NBA.com Official API
The NBA stats API may have injury endpoints. Check:
- `https://stats.nba.com/stats/injuryreport`
- May require specific headers and authentication

### Option 2: Web Scraping
Scrape NBA.com injury reports:
- URL: `https://www.nba.com/injury-report`
- Parse HTML to extract player injury data
- More reliable but requires HTML parsing

### Option 3: BALDONTLIE API (Free)
- API: `https://www.balldontlie.io/`
- Free tier available
- May not have direct injury endpoint, but has player status

### Option 4: Extract from Game Data
Your existing game JSON files contain injury indicators:
- `"DND - Injury/Illness"` - Did Not Dress
- `"DNP - Injury/Illness"` - Did Not Play
- `"NWT - Injury/Illness"` - Not With Team

You can parse these from your game data files.

## Implementation Notes

The current script (`fetch_nba_injuries.py`) is a starting point. You'll need to:

1. **Verify NBA.com API Structure**
   - Check if `https://stats.nba.com/stats/injuryreport` exists
   - Adjust parsing logic based on actual API response

2. **Implement Web Scraping** (if API doesn't work)
   ```python
   from bs4 import BeautifulSoup
   
   # Scrape NBA.com injury reports page
   response = requests.get('https://www.nba.com/injury-report')
   soup = BeautifulSoup(response.content, 'html.parser')
   # Parse injury data from HTML
   ```

3. **Parse Game JSON Files**
   - Iterate through your game JSON files
   - Look for players with injury comments
   - Extract and store injury data

## Usage

### Query Active Injuries

```sql
SELECT * FROM active_injuries
WHERE injury_status IN ('Out', 'Questionable')
ORDER BY date_updated DESC;
```

### Get Player Injury Status

```sql
SELECT 
  p.name,
  i.injury_status,
  i.injury_description,
  i.date_updated
FROM nba_injuries i
JOIN nba_players p ON i.nba_player_id = p.nba_player_id
WHERE p.nba_player_id = 203999  -- LeBron James
ORDER BY i.date_updated DESC
LIMIT 1;
```

## Next Steps

1. **Test NBA.com API** - Verify if the injury endpoint works
2. **Implement Web Scraping** - If API doesn't work, scrape HTML
3. **Parse Game Data** - Extract injuries from existing JSON files
4. **Set Up Cron Job** - Automatically fetch injuries daily

## Troubleshooting

### No injuries found
- Check if NBA.com API endpoint is correct
- Verify API response structure
- Consider implementing web scraping as fallback

### Player not found
- Ensure player names match between injury source and database
- Check team abbreviations match
- May need fuzzy matching for player names

### Rate Limiting
- Add delays between API calls
- Cache responses
- Use multiple data sources

