# SportsGameOdds API Integration Guide

This guide explains how to use the SportsGameOdds API to fetch NBA player props and integrate them with the HoopGeek app.

## Overview

The SportsGameOdds API provides betting odds and player props for NBA games. We use this data to:
1. Display player props on player spotlight posts
2. Calculate whether players hit their props after games
3. Show betting trends (trending hot/cold) based on prop hit rates

## API Setup

### API Key
Your API key is stored in environment variables:
- `VITE_SPORTS_ODDS_API_KEY=79ae5f47830d3d87e70896e36b5eefc3`

### Rate Limiting
The API has a rate limit of **10 requests per minute**. The SDK automatically handles rate limiting.

## Database Schema

We store player props in three main tables:

### 1. `player_props_games`
Stores game information for props (one row per game per day):
- `event_id` - SportsGameOdds event ID
- `game_date` - Date of the game
- `home_team`, `away_team` - Team names
- `home_team_tricode`, `away_team_tricode` - Team tricodes

### 2. `player_props`
Stores individual player props (one row per prop per bookmaker):
- `game_id` - Foreign key to `player_props_games`
- `player_name` - Player name from API
- `nba_player_id` - NBA.com player ID (for matching)
- `bet_type` - Type of prop (e.g., 'points', 'rebounds', 'assists')
- `line` - The over/under line (e.g., 25.5 for points)
- `price` - Odds in decimal format
- `bookmaker` - Bookmaker name

### 3. `player_props_name_mapping`
Manual mapping of API player names to database players (for edge cases).

## How It Works

### 1. Fetching Events

```typescript
import { getTodaysNBAGames } from '../utils/sportsGameOdds';

// Fetch today's NBA games with odds
const games = await getTodaysNBAGames();
```

The API returns events with this structure:
```typescript
{
  eventID: string,
  teams: {
    home: { name: string, ... },
    away: { name: string, ... }
  },
  status: {
    startsAt: string (ISO date),
    ...
  },
  odds: { 
    [oddID]: {
      betTypeID: string,
      line: number,
      price: string,
      bookmakerID: string,
      description: string,
      ...
    }
  }
}
```

### 2. Extracting Player Props

```typescript
import { extractPlayerProps } from '../utils/sportsGameOdds';

// Extract props for a specific player from an event
const props = extractPlayerProps(event, 'LeBron James');
```

This searches through the `odds` object to find props matching:
- Common stat types (points, rebounds, assists, etc.)
- Player name in description/betType

### 3. Calculating Prop Results

After a game is played, we compare props to boxscores:

```typescript
import { calculatePropResult } from '../utils/playerPropsCalculator';

const result = calculatePropResult('points', 25.5, {
  pts: 28, // Actual points scored
  reb: 8,
  ast: 10,
  // ...
});

// Returns:
// {
//   betType: 'points',
//   line: 25.5,
//   actualValue: 28,
//   hit: true, // Over hit
//   result: 'over'
// }
```

### 4. Calculating Daily Hit Rate

```typescript
import { getPlayerPropHitRateToday } from '../utils/playerPropsCalculator';

// Get hit rate for today
const hitRate = await getPlayerPropHitRateToday(nbaPlayerId);

// Returns:
// {
//   playerId: string,
//   nbaPlayerId: number,
//   playerName: string,
//   gameDate: string,
//   totalProps: 5,
//   oversHit: 4,
//   undersHit: 1,
//   pushes: 0,
//   hitRate: 80, // 80% of overs hit
//   trend: 'hot' // hot = >=70%, cold = <=30%, neutral = otherwise
// }
```

### 5. Displaying in UI

The `PlayerStatsCircle` component automatically shows prop hit rates on `player_spotlight` posts:

```typescript
<PlayerStatsCircle
  playerId={nbaPlayerId}
  gameId={gameId}
  playerName={playerName}
  postType="player_spotlight" // Enables prop hit rate display
/>
```

This displays a badge showing:
- **Hit rate percentage** (e.g., "80% OVERS")
- **Trend indicator** (🔥 hot, ❄️ cold, or neutral)
- **Color coding** (green for hot, red for cold)

## Example: Complete Workflow

### Step 1: Import Props (Daily Script)

Run the Python script daily to import props:
```bash
python scripts/setup/import_daily_player_props.py
```

This:
1. Fetches today's NBA games from your database
2. Matches them to SportsGameOdds events
3. Extracts all player props
4. Stores them in Supabase

### Step 2: After Games Complete

Once boxscores are available, the system automatically:
1. Calculates prop results (hit/miss)
2. Updates daily hit rates
3. Displays trends on player spotlight posts

### Step 3: Display in App

The `usePlayerPropHitRate` hook fetches hit rates:
```typescript
import { usePlayerPropHitRate } from '../hooks/usePlayerPropHitRate';

function PlayerSpotlightPost({ nbaPlayerId }) {
  const { data: hitRate } = usePlayerPropHitRate(nbaPlayerId);
  
  if (hitRate) {
    console.log(`Player hit ${hitRate.hitRate}% of overs today`);
    console.log(`Trend: ${hitRate.trend}`); // 'hot', 'cold', or 'neutral'
  }
}
```

## Bet Types Supported

The system supports these prop types:
- **Points** (`points`, `point`, `pts`)
- **Rebounds** (`rebounds`, `rebound`, `reb`)
- **Assists** (`assists`, `assist`, `ast`)
- **Steals** (`steals`, `steal`, `stl`)
- **Blocks** (`blocks`, `block`, `blk`)
- **Turnovers** (`turnovers`, `turnover`, `tov`)
- **Three-Pointers** (`threes`, `three`, `3pt`, `3-pointer`, `3pm`)
- **Free Throws** (`free-throws`, `free-throw`, `ftm`)

## Trend Calculation

Trends are calculated based on hit rate:
- **Hot** (🔥): ≥70% of overs hit - Encourages betting overs
- **Cold** (❄️): ≤30% of overs hit - Encourages betting unders
- **Neutral**: 31-69% - No strong trend

## Example API Calls

See `src/utils/sportsGameOddsExamples.ts` for detailed examples of:
- Fetching NBA events
- Finding player props
- Matching games to events
- Extracting odds data

## Troubleshooting

### No Props Available
- Check if props were imported for today's date
- Verify the player name matches between API and database
- Check `player_props_name_mapping` table for manual mappings

### Props Not Matching Boxscores
- Ensure boxscores are loaded after games complete
- Verify `nba_player_id` matches between props and boxscores
- Check that `game_id` matches between props and boxscores

### Rate Limiting
- The SDK handles rate limiting automatically
- If you see rate limit errors, reduce request frequency
- Consider caching results

## Next Steps

1. **Run the import script daily** to fetch props for upcoming games
2. **Monitor prop hit rates** to see betting trends
3. **Use trends to inform content** - highlight hot/cold players
4. **Expand bet types** as needed (double-doubles, triple-doubles, etc.)

## Resources

- [SportsGameOdds API Documentation](https://github.com/SportsGameOdds/sports-odds-api-typescript)
- Database schema: `supabase/migrations/20251107000000_create_player_props_system.sql`
- Import script: `scripts/setup/import_daily_player_props.py`

