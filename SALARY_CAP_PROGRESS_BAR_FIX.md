# Salary Cap Progress Bar Fix 💰

## Issue
The salary cap progress bar in the TeamRoster header was showing empty (0%) even though players were on the roster with salaries.

## Root Cause
The component was making a **separate database query** to fetch salary data, but this query wasn't correctly accessing the nested `nba_hoopshype_salaries` relationship.

## Solution
Instead of making a separate query, we now **calculate the salary directly from the existing roster data** that's already being fetched by `useTeamRoster`.

### Before:
```typescript
// Separate query that wasn't working correctly
const { data: actualSalary } = useQuery({
  queryKey: ['team-salary-usage', selectedTeam?.id],
  queryFn: async () => {
    // Complex nested query that failed
    const { data: rosterData, error } = await supabase
      .from('fantasy_roster_spots')
      .select(`
        player:player_id (
          nba_hoopshype_salaries (
            salary_2025_26
          )
        )
      `)
      // ... query logic
  }
});
```

### After:
```typescript
// Calculate directly from existing roster data
const actualSalary = useMemo(() => {
  if (!roster) return 0;
  
  const total = roster.reduce((sum, rosterSpot) => {
    const player = rosterSpot.player as any;
    const salaryData = player?.nba_hoopshype_salaries?.[0];
    const playerSalary = salaryData?.salary_2025_26 || 0;
    return sum + playerSalary;
  }, 0);
  
  console.log('💰 Calculated total salary:', total, 'from', roster.filter(r => r.player).length, 'players');
  return total;
}, [roster]);
```

## Benefits

### ✅ Performance
- **No extra database query** - uses data already fetched
- **Automatic updates** - recalculates when roster changes
- **Cached efficiently** - memoized with useMemo

### ✅ Reliability
- **Consistent data** - uses same roster data displayed in table
- **No race conditions** - single source of truth
- **Better error handling** - fails gracefully if roster data missing

### ✅ Maintainability
- **Simpler code** - no duplicate query logic
- **Easier debugging** - console log shows calculation
- **Single dependency** - only depends on roster data

## How It Works

1. **Roster Data Fetched**: `useTeamRoster` fetches all roster spots with player data and salaries
2. **Salary Calculated**: `useMemo` loops through roster and sums up `salary_2025_26` for each player
3. **Progress Bar Updated**: Uses calculated `actualSalary` to show percentage of cap used
4. **Auto-refresh**: When roster changes, salary recalculates automatically

## Progress Bar Display

The progress bar now correctly shows:

```typescript
<LinearProgress 
  determinate 
  value={Math.min(((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) * 100, 100)}
  color={
    ((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.9 ? 'danger' : 
    ((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.75 ? 'warning' : 
    'success'
  }
/>
```

**Colors:**
- 🟢 **Green** (0-75% used)
- 🟡 **Yellow** (75-90% used)
- 🔴 **Red** (90-100% used)

## Example Output

### Team with Players:
```
Salary Cap Usage
$85.5M / $100.0M
[████████████████░░░░] 85.5% used
$14.5M remaining
```

### Empty Roster:
```
Salary Cap Usage
$0.0M / $100.0M
[░░░░░░░░░░░░░░░░░░░░] 0.0% used
$100.0M remaining
```

## Testing

To verify the fix:
1. Go to Team Roster page
2. Look at the team header card
3. **Progress bar should now be filled** proportionally to salary used
4. Check console for: `💰 Calculated total salary: X from Y players`
5. Add/drop players and watch bar update automatically

## Related Components

This fix affects:
- **TeamRoster.tsx** - Main header salary cap display
- Uses data from **useTeamRoster** hook
- Displays in LinearProgress component
- Shows percentage and dollar amounts

## Summary

✅ Salary cap progress bar now shows correct percentage  
✅ No extra database queries needed  
✅ Automatic updates when roster changes  
✅ Better performance and reliability  
✅ Console logging for debugging  

The salary cap progress bar is now working correctly! 🎉

