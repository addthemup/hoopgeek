# League Creation Form Improvements

## Summary of Changes

Fixed several disconnects between the League Creation Form and the actual draft/roster creation process:

### 1. **Draft Rounds Validation** ✅
- Added validation in Step 2: Roster size must equal Draft Rounds specified in Step 1
- Shows real-time alert in Step 2 indicating if roster size matches draft rounds
- Visual feedback: Green ✅ when valid, Yellow ⚠️ warning when invalid
- Prevents advancing to Step 3 if roster size doesn't match draft rounds

### 2. **Draft Date/Time Display Fix** ✅
- Fixed issue where selected draft date/time wasn't showing in the input field
- Now displays selected date/time below the input for verification
- Input field retains the selected value when clicked again

### 3. **Waiver Settings in League Creation** ✅
- Added Waiver Settings section to Step 1 of league creation
- Options include:
  - **Waiver Type**: None, Rolling, FAAB, Continuous
  - **Waiver Period**: Hours players stay on waivers (0-168 hours)
- Waiver settings now passed to the database when league is created

### 4. **Draft Configuration Fixed** ✅
- Draft Rounds and Draft Type now properly passed from frontend to Edge Function
- Edge Function now uses the commissioner-specified draft rounds instead of hardcoded 15
- Fantasy roster spots created match the specified draft rounds
- Draft order entries match the specified number of rounds

## Files Modified

### Frontend Files
1. **`src/components/LeagueCreationForm.tsx`**
   - Added Step 2 validation (roster size = draft rounds)
   - Added visual alert in Step 2 showing draft rounds vs roster size
   - Added Waiver Settings section to Step 1
   - Fixed draft date/time display issue
   - Added `toISOString().slice(0, 16)` conversion for datetime-local input

2. **`src/hooks/useLeagueInitializationMinimal.ts`**
   - Added `draftType` to edgeFunctionBody
   - Added `draftRounds` to edgeFunctionBody
   - Added `waiverType` to edgeFunctionBody
   - Added `waiverPeriodHours` to edgeFunctionBody

### Backend Files
3. **`supabase/functions/create-league/index.ts`**
   - Added `draftType` and `draftRounds` to destructured body params
   - Added `waiverType` and `waiverPeriodHours` to destructured body params
   - Updated fantasy_leagues insert to use `draftType` and `draftRounds` from body
   - Updated fantasy_league_seasons insert to include waiver settings:
     - `waiver_type`
     - `waiver_period_hours`
     - `faab_budget` (set to 100 if FAAB type selected)
     - `waiver_processing_day` (default: Wednesday)
     - `waiver_processing_time` (default: 03:00:00)
     - `waiver_order_reset_type` (default: weekly_inverse_standings)
     - `waiver_order_tie_breaker` (default: points_scored)

## Deployment Steps

### 1. Frontend Changes (Already Applied)
The frontend changes are already in your local files. Just ensure the app is running and test the league creation form.

### 2. Deploy Edge Function
```bash
cd /Users/adam/Desktop/hoopgeek
supabase functions deploy create-league
```

Or deploy via Supabase Dashboard:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to Edge Functions → create-league
4. Copy the contents of `supabase/functions/create-league/index.ts`
5. Paste and click "Deploy"

## Testing Checklist

- [ ] Create a new league with 12 teams and 12 draft rounds
- [ ] Verify in Step 2 that you see "✅ Roster size matches draft rounds!" when roster = 12
- [ ] Try to advance with roster size = 14 and verify error appears
- [ ] Select a draft date/time and verify it shows below the input
- [ ] Set waiver type to "FAAB" and waiver period to 72 hours
- [ ] Create the league
- [ ] Verify in database:
  - `fantasy_leagues.draft_rounds` = 12
  - `fantasy_leagues.draft_type` = 'snake' (or whatever you selected)
  - `fantasy_league_seasons.waiver_type` = 'faab'
  - `fantasy_league_seasons.waiver_period_hours` = 72
  - `fantasy_roster_spots` count = 12 per team
  - `fantasy_draft_order` has 12 rounds × 12 teams = 144 total picks

## Database Queries for Verification

After creating a test league, run these to verify:

```sql
-- Check league settings
SELECT 
  name, 
  draft_type, 
  draft_rounds 
FROM fantasy_leagues 
WHERE name = 'YOUR_TEST_LEAGUE_NAME';

-- Check season waiver settings
SELECT 
  waiver_type,
  waiver_period_hours,
  faab_budget
FROM fantasy_league_seasons 
WHERE league_id = 'YOUR_LEAGUE_ID';

-- Count roster spots per team
SELECT 
  ft.team_name,
  COUNT(frs.id) as roster_spots
FROM fantasy_teams ft
LEFT JOIN fantasy_roster_spots frs ON frs.fantasy_team_id = ft.id
WHERE ft.league_id = 'YOUR_LEAGUE_ID'
GROUP BY ft.id, ft.team_name;

-- Count draft picks
SELECT 
  MAX(round) as total_rounds,
  COUNT(*) as total_picks
FROM fantasy_draft_order
WHERE league_id = 'YOUR_LEAGUE_ID';
```

## Benefits

1. **Consistency**: Draft rounds now consistently match roster spots across the entire system
2. **Validation**: Users can't create invalid league configurations
3. **Transparency**: Users can see exactly what they've selected before creating the league
4. **Flexibility**: Commissioners can now configure waiver settings during league creation
5. **Correctness**: Draft system will create exactly the right number of picks based on commissioner settings

## Notes

- Default values are still set as fallbacks (15 rounds, 'snake' draft, 'rolling' waivers, 48 hours)
- The validation prevents creating leagues with mismatched roster/draft configurations
- All existing leagues are unaffected by these changes
- Future enhancement: Add FAAB budget input when FAAB waiver type is selected

