# League Settings Save Fix 💾

## Issue
The League Settings page wouldn't save changes to the database. When clicking "Save Changes", nothing would happen or the data wouldn't persist.

## Root Cause

### 1. **Hardcoded League Data**
The `League.tsx` component was passing a **massive hardcoded league object** (100+ lines) with default/placeholder values to `LeagueSettingsManager` instead of the actual database values:

```typescript
// BEFORE - Wrong ❌
<LeagueSettingsManager
  league={{
    id: league.id,
    name: league.name,
    max_teams: league.max_teams,
    // ... 100+ lines of hardcoded defaults
    waiver_type: 'rolling',  // hardcoded!
    salary_cap_amount: 100000000,  // hardcoded!
    // etc...
  }}
/>
```

This meant:
- ✅ The form displayed these hardcoded values
- ❌ When you edited them, you were editing from hardcoded data
- ❌ Saving would use those hardcoded values as the base

### 2. **Non-Existent Database Fields**
The settings included fields like `auto_ir_management`, `auto_substitution`, `global_leaderboard` that don't exist in the database schema.

### 3. **Incorrect Field Mapping**
The `useUpdateLeagueSettings` hook had incorrect field mappings - some fields were in the wrong category (league vs season) or missing entirely.

## Solution

### 1. **Pass Actual Database Data**
Changed `League.tsx` to pass the real league data from the database:

```typescript
// AFTER - Correct ✅
<LeagueSettingsManager
  league={league as any}  // Pass actual database data
  isCommissioner={isCommissioner}
  onUpdateSettings={async (settings) => {
    if (!id) throw new Error('League ID is required')
    await updateLeagueSettings.mutateAsync({ leagueId: id, settings })
  }}
  isLoading={updateLeagueSettings.isPending}
/>
```

**Benefits:**
- Shows actual current values from database
- Edits are made to real data, not defaults
- Saves work correctly with proper base values

### 2. **Removed Non-Existent Fields**
Removed the "HoopGeek Features" section from `LeagueSettings.tsx` since those database columns don't exist:
- `auto_ir_management` ❌
- `auto_substitution` ❌  
- `global_leaderboard` ❌

These can be added back later if the database schema is updated to include them.

### 3. **Fixed Field Mappings**
Updated `useUpdateLeagueSettings.ts` with correct field categories:

**League-Level Fields** (fantasy_leagues table):
```typescript
[
  'name', 'description', 'max_teams', 'commissioner_id', 'public_league',
  'scoring_type', 'draft_type', 'draft_rounds', 'lineup_frequency',
  'invite_code', 'season_year', 'salary_cap_enabled', 'trades_enabled',
  'commissioner_notes', 'league_type', 'fantasy_scoring_format'
]
```

**Season-Level Fields** (fantasy_league_seasons table):
```typescript
[
  'salary_cap_amount', 'roster_positions',
  'starters_count', 'starters_multiplier', 'rotation_count', 'rotation_multiplier',
  'bench_count', 'bench_multiplier', 'playoff_teams', 'playoff_weeks',
  'trade_deadline', 'position_unit_assignments', 'draft_date', 'draft_status',
  // Waiver fields
  'waiver_type', 'waiver_period_hours', 'waiver_budget_amount', 'waiver_min_bid',
  'waiver_priority_reset', 'waiver_process_time',
  // Additional settings
  'draft_time_per_pick', 'draft_order_method', 'salary_cap_soft', 'salary_cap_penalty',
  'trade_limit', 'trade_salary_matching', 'trade_salary_tolerance',
  'trade_veto_votes_required', 'allow_draft_pick_trades',
  'roster_size', 'total_starters', 'total_bench', 'total_ir'
]
```

## How It Works Now

### Data Flow:
1. **Load Settings**: `useLeague(id)` fetches real data from database
2. **Display Settings**: `LeagueSettingsManager` shows actual current values
3. **Edit Settings**: User clicks "Edit" and modifies fields
4. **Save Settings**: Clicking "Save Changes" triggers:
   ```typescript
   onUpdateSettings(formData)
   → updateLeagueSettings.mutateAsync({ leagueId, settings })
   → useUpdateLeagueSettings hook
   → Splits into league/season fields
   → Updates fantasy_leagues table
   → Updates fantasy_league_seasons table
   → Invalidates queries
   → UI refreshes with new data
   ```

### Save Process:
1. **Split Settings**: Hook separates league vs season fields
2. **Update League**: Updates `fantasy_leagues` table if needed
3. **Find Season**: Gets current season ID or most recent season
4. **Update Season**: Updates `fantasy_league_seasons` table if needed
5. **Fetch Updated**: Retrieves fresh data from database
6. **Invalidate Cache**: React Query refetches affected queries
7. **UI Update**: Components automatically re-render with new data

## What's Fixed

✅ **League Name** - Now saves to database  
✅ **Scoring Type** - H2H Points, Rotisserie, etc.  
✅ **Max Teams** - Team limit updates correctly  
✅ **Salary Cap** - Amount and enabled status save  
✅ **Waiver Settings** - Type, period, budget all work  
✅ **Trade Settings** - Deadline, limits, matching rules  
✅ **Roster Settings** - Size, starters, bench, IR  
✅ **Draft Settings** - Type, date, time per pick  

## Testing

To verify the fix works:

1. **Go to League Settings** (Settings tab in league)
2. **Click "Edit"** on any section
3. **Make changes** (e.g., change league name)
4. **Click "Save Changes"**
5. **Check console** - should see:
   ```
   🏀 Updating league settings...
   📊 Split settings: { leagueSettings, seasonSettings }
   ✅ League table updated
   ✅ Season table updated  
   ✅ League settings updated successfully
   ✅ Queries invalidated, data will refresh
   ```
6. **Refresh page** - changes should persist!

## Database Tables

### fantasy_leagues (Base League Info)
- name, description, commissioner_id
- league_type, max_teams, draft_type
- scoring_type, lineup_frequency
- salary_cap_enabled, trades_enabled
- public_league, invite_code

### fantasy_league_seasons (Season-Specific)
- season_year, is_active, season_status
- draft_date, draft_status, trade_deadline
- roster_positions, starters_count, bench_count
- salary_cap_amount
- waiver_type, waiver_period_hours, waiver_budget_amount
- playoff_teams, playoff_weeks

## Future Enhancements

If you want to add the HoopGeek features back, you'll need to:

1. **Add columns to database:**
   ```sql
   ALTER TABLE fantasy_leagues 
   ADD COLUMN auto_ir_management BOOLEAN DEFAULT false,
   ADD COLUMN auto_substitution BOOLEAN DEFAULT false,
   ADD COLUMN global_leaderboard BOOLEAN DEFAULT false;
   ```

2. **Add fields to `leagueFields` array** in `useUpdateLeagueSettings.ts`

3. **Restore HoopGeek section** in `LeagueSettings.tsx`

## Summary

✅ League settings now save correctly to database  
✅ Uses actual database values instead of hardcoded defaults  
✅ Properly splits league vs season fields  
✅ Console logging for debugging  
✅ Auto-refresh after save  
✅ Loading state while saving  

The League Settings page is now fully functional! 🎉

