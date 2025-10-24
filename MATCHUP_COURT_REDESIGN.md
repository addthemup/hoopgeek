# Matchup Court Redesign & Database Fix

## Issues Fixed

### 1. **Database Column Error** ✅
**Problem**: Query was trying to fetch `salary_2025_26` column from `nba_players` table, which doesn't exist.

**Error**:
```
column nba_players_1.salary_2025_26 does not exist
```

**Solution**:
- Changed query to use correct column name: `salary` (not `salary_2025_26`)
- Updated interface `MatchupPlayer` to reflect correct column
- Fixed in `/src/hooks/useMatchupDetails.ts`

**Files Modified**:
- `src/hooks/useMatchupDetails.ts` - Changed all references from `salary_2025_26` to `salary`

### 2. **NBA-Style Basketball Court Redesign** ✅
**Problem**: Original court design was basic and didn't look like an NBA court.

**Solution**: Complete redesign using MUI Joy components with:

#### Visual Court Features
- **Hardwood floor**: Classic NBA tan/brown color (#d4a574) with subtle wood grain texture
- **Court boundary**: Black borders with proper NBA dimensions
- **Center court circle**: Full center circle marking
- **Centerline**: Dividing line at 50%
- **Three-point arcs**: Left and right three-point arc circles
- **Responsive aspect ratio**: 
  - Desktop: 16:9 (landscape)
  - Mobile: 9:16 (portrait)

#### Player Layout
- **Three columns**: Starters | Rotation | Bench
- **Semi-transparent white cards** overlaying the court (95% opacity)
- **Color-coded multiplier chips**:
  - Green (success) for Starters (1.0×)
  - Yellow (warning) for Rotation (0.75×)
  - Gray (neutral) for Bench (0.5×)

#### Team Organization
- Each column divided into two sections (Team 1 / Team 2)
- Team name headers with team colors
- Clean dividers between teams
- "No players assigned" message for empty sections

#### Responsive Design
- Desktop: Three columns side-by-side
- Mobile: Three columns stacked vertically
- Player jerseys adjust size based on screen width
- Grid layout adapts from 3 columns (desktop) to 2 columns (mobile)

### 3. **Debug Logging Added** ✅
Added comprehensive console logging to help debug lineup issues:

```javascript
console.log('🏀 MatchupDetails Debug:', {
  matchupLoading,
  team1Loading,
  team2Loading,
  statsLoading,
  matchupId,
  leagueId,
  team1LineupCount: team1Lineup.length,
  team2LineupCount: team2Lineup.length,
  team1Lineup,
  team2Lineup,
  playerStats: Object.keys(playerStats).length,
});
```

This will help identify if:
- Lineups are loading correctly
- Players are being fetched from `fantasy_lineups` table
- Stats are being calculated

## Technical Details

### Database Schema
```sql
-- nba_players table has:
salary BIGINT DEFAULT 0  -- ✅ Use this

-- NOT salary_2025_26 (that's in nba_hoopshype_salaries table)
```

### Court CSS Structure
```javascript
<Box sx={{ background: '#d4a574' }}>  // Court floor
  <Box sx={{ border: '3px solid #000' }} />  // Boundary
  <Box sx={{ borderRadius: '50%' }} />  // Center circle
  <Box sx={{ width: '2px', bgcolor: '#000' }} />  // Centerline
  <Box sx={{ borderRadius: '50%' }} />  // 3pt arcs
  
  <Box sx={{ zIndex: 1 }}>  // Player cards on top
    // Three columns with semi-transparent cards
  </Box>
</Box>
```

### Player Lineup Fetching
The component now fetches lineup positions using the RPC function:
```javascript
supabase.rpc('get_lineup_positions', {
  p_league_id: leagueId,
  p_fantasy_team_id: teamId,
  p_lineup_type: null  // Get all types
})
```

## Why Players Might Not Show Up

If players still don't appear on the court, check:

1. **Are players in `fantasy_lineups` table?**
   ```sql
   SELECT * FROM fantasy_lineups 
   WHERE league_id = 'your-league-id' 
   AND fantasy_team_id = 'team-id';
   ```

2. **Do lineup positions exist?**
   ```sql
   SELECT * FROM lineup_positions 
   WHERE league_id = 'your-league-id' 
   AND fantasy_team_id = 'team-id';
   ```

3. **Is the RPC function working?**
   ```sql
   SELECT * FROM get_lineup_positions(
     'league-id',
     'team-id',
     NULL
   );
   ```

4. **Check the debug logs** in browser console for:
   - `team1LineupCount` and `team2LineupCount` should be > 0
   - `team1Lineup` and `team2Lineup` arrays should have player data
   - Look for any errors in the console

## Next Steps

If players still don't show:
1. Check the browser console logs for the debug output
2. Verify that teams have set their lineups in the Lineups page
3. Ensure the `get_lineup_positions` RPC function exists and works
4. Check if `fantasy_lineups` table has data for this matchup's week

## Files Modified
- ✅ `src/hooks/useMatchupDetails.ts` - Fixed salary column
- ✅ `src/pages/MatchupDetails.tsx` - Complete court redesign + debug logging

## Testing
1. Navigate to Scoreboard tab
2. Click any matchup card
3. Should see:
   - Beautiful NBA-style court background
   - Three columns (Starters/Rotation/Bench)
   - Player jerseys in each section (if lineups are set)
   - Live stats updating
   - Team totals at bottom

If no players show, check console logs for the debug output! 🏀

