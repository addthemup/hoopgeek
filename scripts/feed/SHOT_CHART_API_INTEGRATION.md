# NBA API Shot Chart Integration

## Overview

This document describes the integration of the NBA API's `ShotChartDetail` endpoint with the existing shot chart visualization system.

## Changes Made

### 1. Python Script Updates (`scrape_games_date_range.py`)

#### New Function: `get_shot_chart_data()`
- Fetches shot chart data for all players in a game using the NBA API's `ShotChartDetail` endpoint
- Accepts `game_id` and `player_ids_by_team` dictionary
- Returns a dictionary mapping `player_id` to list of shot chart entries
- Includes rate limiting (0.6 seconds between requests)

#### Integration in `get_complete_game_data()`
- Extracts player IDs and team IDs from aggregated player stats
- Calls `get_shot_chart_data()` to fetch shot chart data
- Stores shot chart data in `game_data['shotChartData']` in the JSON file

### 2. Frontend Updates

#### `FeedContentManager.tsx`
- Updated to prefer NBA API shot chart data (`shotChartData`) over legacy `xLegacy/yLegacy` coordinates
- Falls back to `xLegacy/yLegacy` if shot chart data is not available
- Handles both uppercase and lowercase field names from the API response
- Maps NBA API fields to the shot chart interface:
  - `LOC_X` / `loc_x` → `locX`
  - `LOC_Y` / `loc_y` → `locY`
  - `SHOT_MADE_FLAG` / `shot_made_flag` → `shotResult`
  - `GAME_EVENT_ID` / `game_event_id` → `eventNum`

#### `ShotChartTable.tsx`
- Updated `ShotData` interface to support both coordinate systems:
  - `xLegacy` / `yLegacy` (legacy system)
  - `locX` / `locY` (NBA API system)
- Enhanced `normalizeShotCoordinates()` to handle both systems:
  - **NBA API (LOC_X/LOC_Y)**: Coordinates in inches from basket center
    - Conversion: `svgX = (locX * 5 / 12) + 125`, `svgY = (locY * 5 / 12)`
  - **Legacy (xLegacy/yLegacy)**: Existing calibrated system
    - Conversion: `svgX = (xLegacy + 250) / 2`, `svgY = yLegacy / 2`

## Coordinate Systems

### NBA API (LOC_X/LOC_Y)
- **Units**: Inches from basket center
- **LOC_X**: Horizontal position
  - Negative = left side
  - Positive = right side
  - 0 = center
  - Range: approximately -300 to +300 inches (25 feet left/right)
- **LOC_Y**: Distance from basket
  - Positive = away from basket
  - Range: 0 to 564 inches (47 feet to half court)

### Legacy (xLegacy/yLegacy)
- **Units**: Legacy coordinate units (10 units = 1 foot)
- **xLegacy**: Horizontal position
  - Negative = left side
  - Positive = right side
  - 0 = center
  - Range: approximately -250 to +250
- **yLegacy**: Distance from basket
  - Positive = away from basket
  - Range: 0 to 470 (47 feet to half court)

### SVG Coordinate System
- **Units**: SVG units (5 units = 1 foot)
- **Dimensions**: 250 × 235 (width × height)
- **Basket Position**: Top center at x=125, y=0

## Data Flow

1. **Scraping**: `scrape_games_date_range.py` fetches shot chart data for all players
2. **Storage**: Shot chart data stored in game JSON file under `shotChartData` key
3. **Feed Creation**: `FeedContentManager` reads `shotChartData` and creates shot chart slides
4. **Visualization**: `ShotChartTable` component renders shots using NBA API coordinates (preferred) or legacy coordinates (fallback)

## Benefits

1. **More Accurate**: NBA API provides official shot locations
2. **Consistent**: Uses the same data source as NBA.com
3. **Backward Compatible**: Falls back to legacy coordinates if API data unavailable
4. **Flexible**: Handles both coordinate systems seamlessly

## Usage

### For New Games
Shot chart data is automatically fetched when running:
```bash
python3 scrape_games_date_range.py 2025-12-01 2025-12-01
```

### For Existing Games
To add shot chart data to existing game JSON files, you would need to:
1. Re-run the scraping script (it will skip existing files by default)
2. Or create a separate script to fetch shot chart data for specific games

## API Rate Limiting

The integration includes rate limiting:
- 0.6 seconds between player shot chart requests
- This prevents hitting NBA API rate limits

## Error Handling

- If shot chart data fetch fails, the system falls back to legacy coordinates
- Missing or invalid coordinates are handled gracefully
- Both uppercase and lowercase field names are supported for robustness

