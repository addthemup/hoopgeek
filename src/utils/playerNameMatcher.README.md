# Player Name Matcher Utility

Centralized utility for matching player names from `player_props` to `nba_players` throughout the HoopGeek app.

## Features

- ✅ Handles name normalization (special characters, casing, hyphens, apostrophes)
- ✅ Caching for performance
- ✅ Team-based disambiguation
- ✅ React hooks for easy integration
- ✅ Batch matching support

## Basic Usage

### In TypeScript/JavaScript

```typescript
import { matchPlayerName } from '@/utils/playerNameMatcher'
import { supabase } from '@/utils/supabase'

// Match a single player
const match = await matchPlayerName(supabase, 'Nikola Vucevic')
if (match) {
  console.log(`Found: ${match.name}`)
  console.log(`Player ID: ${match.player_id}`)
  console.log(`NBA Player ID: ${match.nba_player_id}`)
  console.log(`Team: ${match.team_abbreviation}`)
}

// Match with team context (helps disambiguate)
const matchWithTeam = await matchPlayerName(supabase, 'Jabari Smith', {
  teamTricode: 'HOU'
})

// Match multiple players
import { matchPlayerNames } from '@/utils/playerNameMatcher'
const names = ['Nikola Vucevic', 'Luka Doncic', 'Unknown Player']
const matches = await matchPlayerNames(supabase, names)
matches.forEach((match, name) => {
  if (match) {
    console.log(`${name} → ${match.name}`)
  }
})
```

### In React Components

```typescript
import { usePlayerNameMatch } from '@/hooks/usePlayerNameMatcher'

function PlayerPropsTable({ propPlayerName }: { propPlayerName: string }) {
  const { data: match, isLoading } = usePlayerNameMatch(propPlayerName)
  
  if (isLoading) return <div>Loading...</div>
  if (!match) return <div>Player not found</div>
  
  return (
    <div>
      <p>Player: {match.name}</p>
      <p>Team: {match.team_abbreviation}</p>
    </div>
  )
}
```

### Batch Matching in React

```typescript
import { usePlayerNameMatches } from '@/hooks/usePlayerNameMatcher'

function PlayerPropsList({ playerNames }: { playerNames: string[] }) {
  const { data: matches, isLoading } = usePlayerNameMatches(playerNames)
  
  if (isLoading) return <div>Loading...</div>
  
  return (
    <ul>
      {playerNames.map(name => {
        const match = matches?.get(name)
        return (
          <li key={name}>
            {name} → {match ? match.name : 'Not found'}
          </li>
        )
      })}
    </ul>
  )
}
```

## API Reference

### `matchPlayerName(supabase, propPlayerName, options?)`

Matches a single player name.

**Parameters:**
- `supabase: SupabaseClient` - Supabase client instance
- `propPlayerName: string` - Player name from `player_props` table
- `options?: MatchOptions` - Optional matching options

**Returns:** `Promise<PlayerMatch | null>`

**MatchOptions:**
```typescript
interface MatchOptions {
  teamTricode?: string      // Team to help disambiguate
  useCache?: boolean        // Use cache (default: true)
  maxMatches?: number       // Max matches to consider (default: 10)
}
```

**PlayerMatch:**
```typescript
interface PlayerMatch {
  player_id: string           // UUID from nba_players.id
  nba_player_id: number       // NBA API player ID
  name: string                // Full player name from database
  team_abbreviation?: string  // Team tricode (if available)
}
```

### `matchPlayerNames(supabase, propPlayerNames, options?)`

Matches multiple player names at once.

**Parameters:**
- `supabase: SupabaseClient` - Supabase client instance
- `propPlayerNames: string[]` - Array of player names
- `options?: MatchOptions` - Optional matching options

**Returns:** `Promise<Map<string, PlayerMatch | null>>`

### `normalizePlayerName(name: string)`

Normalizes a player name for matching. Handles:
- Case differences
- Special characters (Vučević → Vucevic)
- Hyphens and apostrophes
- Jr/Sr suffixes
- Extra whitespace

**Example:**
```typescript
normalizePlayerName("Nikola Vučević")  // "nikola vucevic"
normalizePlayerName("De'Andre Hunter")  // "de andre hunter"
normalizePlayerName("Michael Porter Jr.")  // "michael porter"
```

### `clearMatchCache()`

Clears the in-memory match cache. Useful when player data is updated.

### `getCacheStats()`

Returns cache statistics (size and keys).

## React Hooks

### `usePlayerNameMatch(propPlayerName, options?)`

React hook for matching a single player name. Uses React Query for caching.

**Example:**
```typescript
const { data: match, isLoading, error } = usePlayerNameMatch('Nikola Vucevic')
```

### `usePlayerNameMatches(propPlayerNames, options?)`

React hook for matching multiple player names.

**Example:**
```typescript
const { data: matches, isLoading } = usePlayerNameMatches(['Player 1', 'Player 2'])
```

## Name Matching Logic

The matcher uses multiple strategies:

1. **Exact normalized match** - Normalized names match exactly
2. **First + Last name match** - Handles "Jabari Smith" matching "Jabari Smith Jr."
3. **Partial match** - One name contains the other (with first/last name validation)
4. **Team preference** - If multiple matches, prefer the one with matching team

## Examples

### Matching with Special Characters

```typescript
// These all match correctly:
await matchPlayerName(supabase, 'Nikola Vucevic')      // → Nikola Vučević
await matchPlayerName(supabase, 'Luka Doncic')          // → Luka Dončić
await matchPlayerName(supabase, 'Jusuf Nurkic')         // → Jusuf Nurkić
```

### Matching with Hyphens/Apostrophes

```typescript
await matchPlayerName(supabase, 'Deandre Hunter')      // → De'Andre Hunter
await matchPlayerName(supabase, 'Shai Gilgeousalexander') // → Shai Gilgeous-Alexander
await matchPlayerName(supabase, 'Dayron Sharpe')       // → Day'Ron Sharpe
```

### Matching with Jr/Sr

```typescript
await matchPlayerName(supabase, 'Jabari Smith')         // → Jabari Smith Jr.
await matchPlayerName(supabase, 'Michael Porter Jr')   // → Michael Porter Jr.
```

## Performance

- **Caching**: Results are cached in memory for performance
- **React Query**: Hooks use React Query for automatic caching and refetching
- **Batch Processing**: `matchPlayerNames` processes multiple names efficiently

## Integration Examples

### In Player Props Import Script

```typescript
import { matchPlayerName } from '@/utils/playerNameMatcher'

// When importing props
for (const prop of props) {
  const match = await matchPlayerName(supabase, prop.player_name)
  if (match) {
    prop.player_id = match.player_id
    prop.nba_player_id = match.nba_player_id
  }
}
```

### In Game Page Component

```typescript
import { usePlayerNameMatch } from '@/hooks/usePlayerNameMatcher'

function PlayerPropRow({ prop }: { prop: PlayerProp }) {
  const { data: match } = usePlayerNameMatch(prop.player_name)
  
  return (
    <tr>
      <td>{match?.name || prop.player_name}</td>
      <td>{match?.team_abbreviation || 'N/A'}</td>
    </tr>
  )
}
```

## Notes

- The matcher is case-insensitive
- Special characters are normalized (diacritics removed)
- Hyphens and apostrophes are treated as spaces
- Jr/Sr suffixes are ignored for matching
- Results are cached to avoid repeated database queries
