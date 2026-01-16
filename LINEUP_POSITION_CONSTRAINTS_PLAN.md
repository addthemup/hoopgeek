# Team of the Night/Week Position Constraints Implementation Plan

## Requirements
- **Lineup Structure**: 12 players total
  - **Starters**: G, G, F, F, C (5 players, 1.0x multiplier)
  - **Rotation**: G, G, F, F, C (5 players, 0.75x multiplier)
  - **Bench**: Util, Util (2 players, 0.5x multiplier)

- **Position Eligibility**: 
  - Players can have dual positions (e.g., "Guard-Forward")
  - Must check if player can play required position
  - Util accepts any position

- **Optimization**:
  - Optimize based on **weighted fantasy points** = raw_points × multiplier
  - Still respect salary cap ($208M)
  - Maximize total weighted points

## Implementation Steps

### 1. Backend (SQL Functions)

#### Files to Update:
- `DEPLOY_OPTIMAL_LINEUP_OF_NIGHT.sql` - Main function for nightly lineups
- `DEPLOY_OPTIMAL_LINEUP_OF_WEEK.sql` - Main function for weekly lineups  
- `GENERATE_HISTORICAL_LINEUPS.sql` - Helper functions `get_optimal_lineup_for_date()` and `get_optimal_lineup_for_week()`

#### Algorithm Approach:
The constraint satisfaction problem is complex in pure SQL. Recommended approach:

**Option A: Iterative Greedy (Recommended)**
1. Process slots in order: Starters (1-5), Rotation (1-5), Bench (1-2)
2. For each slot:
   - Find all eligible players (not yet selected, position matches, fits in remaining cap)
   - Select player with highest weighted value (weighted_points / salary)
   - Add to lineup, update used players set, update remaining cap
3. Continue until all 12 slots filled or no more eligible players

**Option B: Multi-Strategy Optimization**
1. Try different strategies (value-first, points-first, balanced)
2. For each strategy, fill slots greedily
3. Return the lineup with highest total weighted points

#### Return Type Changes:
Add to return table:
- `lineup_unit TEXT` - 'starters', 'rotation', or 'bench'
- `unit_position INTEGER` - Position within unit (1-5 for starters/rotation, 1-2 for bench)
- `weighted_points DECIMAL` - fantasy_points × multiplier

### 2. Frontend (React Components)

#### Files to Update:
- `src/components/MarginPlayersOfNight.tsx` - Display nightly lineup
- `src/components/MarginTeamOfWeekAverage.tsx` - Display weekly lineup

#### Changes Needed:
- **No immediate changes required** - User said they don't need to display multipliers yet
- **Future**: Can add visual indicators for starters/rotation/bench when ready
- Components will automatically get new fields (`lineup_unit`, `unit_position`, `weighted_points`) but can ignore them for now

### 3. Cron Jobs

#### Files:
- `SETUP_LINEUP_CRON_JOBS.sql` - Already set up correctly

#### Changes Needed:
- **No changes required** - Cron jobs call the SQL functions, which will automatically use the updated logic
- Functions `generate_daily_team_of_night()` and `generate_weekly_team_of_week()` will work with updated return types

### 4. Historical Data Generation

#### Files:
- `GENERATE_HISTORICAL_LINEUPS.sql` - Helper functions need updating

#### Changes Needed:
- Update `get_optimal_lineup_for_date()` to match new algorithm
- Update `get_optimal_lineup_for_week()` to match new algorithm
- Update table schemas to store `lineup_unit`, `unit_position`, `weighted_points` if needed

## Implementation Priority

1. **High Priority**: Update `DEPLOY_OPTIMAL_LINEUP_OF_NIGHT.sql` with position constraints
2. **High Priority**: Update `DEPLOY_OPTIMAL_LINEUP_OF_WEEK.sql` with position constraints  
3. **Medium Priority**: Update helper functions in `GENERATE_HISTORICAL_LINEUPS.sql`
4. **Low Priority**: Frontend changes (not needed yet per user)

## Testing

After implementation, test:
- ✅ All 12 slots are filled
- ✅ Position constraints are respected (G G F F C for starters/rotation, Util Util for bench)
- ✅ No duplicate players
- ✅ Salary cap is respected
- ✅ Multipliers are applied correctly (1x, 0.75x, 0.5x)
- ✅ Optimization maximizes weighted points, not raw points

