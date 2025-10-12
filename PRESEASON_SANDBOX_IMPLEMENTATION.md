# Preseason Sandbox Implementation

## Overview
The Preseason (Week 0) acts as a sandbox environment where users can learn the system before the regular season starts. Key differences:

1. **Lineups Don't Lock** - Users can change players throughout the week
2. **Results Don't Count** - Games played don't affect standings
3. **Matchups Generated** - Teams still get opponents to test against
4. **Full Feature Access** - All features work exactly like regular season

## Database Changes

### Migration: `20251012000007_add_2025_26_fantasy_weeks.sql`
- ✅ Added Week 0 (Preseason): October 2-20, 2024
- ✅ Added Weeks 1-25 for 2025-26 season
- ✅ Created `is_preseason()` helper function
- ✅ Created `get_current_fantasy_week()` function (includes is_preseason flag)
- ✅ Added indexes for performance

### Week Structure
```sql
-- Week 0: Preseason (is_regular_season = false, is_playoff_week = false)
-- Week 1-25: Regular Season (is_regular_season = true, is_playoff_week = false)
```

## Frontend Changes Needed

### 1. Lineups Page (`Lineups.tsx`)
**Current State:** Uses `useCurrentFantasyWeek()` to get season phase

**Changes Needed:**
```typescript
// Detect if we're in preseason
const isPreseason = seasonPhase === 'preseason';

// Show preseason banner
{isPreseason && (
  <Alert color="warning" sx={{ mb: 2 }}>
    <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
      🏀 Preseason Sandbox Mode
    </Typography>
    <Typography level="body-sm">
      This is a practice week! Lineups don't lock and results don't count in standings.
      Experiment with features and get comfortable before the regular season starts.
    </Typography>
  </Alert>
)}

// Modify lineup locking logic
const lineupsLocked = !isPreseason && /* existing lock logic */;

// Show different status for preseason
{isPreseason ? (
  <Chip color="warning" variant="soft">
    Sandbox Mode - Lineups Never Lock
  </Chip>
) : lineupsLocked ? (
  <Chip color="danger">Locked</Chip>
) : (
  <Chip color="success">Open</Chip>
)}
```

### 2. League Home (`LeagueHome.tsx`)
**Changes Needed:**
```typescript
// Show preseason message where appropriate
{seasonPhase === 'preseason' && (
  <Card>
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Avatar sx={{ bgcolor: 'warning.500' }}>
          🏀
        </Avatar>
        <Box>
          <Typography level="h4" sx={{ fontWeight: 'bold' }}>
            Preseason Practice Week
          </Typography>
          <Typography level="body-md" color="neutral">
            The regular season hasn't started yet. Use this week to set lineups,
            make trades, and learn the platform. Results won't count in standings!
          </Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
)}
```

### 3. Matchups Generation
**Need to create:** Function to generate preseason matchups when league is created

```typescript
// In create-league edge function or similar
async function generatePreseasonMatchups(leagueId: string, teams: Team[]) {
  // Get preseason week
  const { data: preseasonWeek } = await supabase
    .from('fantasy_season_weeks')
    .select('*')
    .eq('season_year', 2025)
    .eq('week_number', 0)
    .single();
    
  if (!preseasonWeek) return;
  
  // Generate matchups (same logic as regular season)
  // But mark them as preseason
  const matchups = [];
  
  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 < teams.length) {
      matchups.push({
        league_id: leagueId,
        season_year: 2025,
        week_number: 0,
        fantasy_team1_id: teams[i].id,
        fantasy_team2_id: teams[i + 1].id,
        is_preseason: true, // NEW FLAG
        status: 'scheduled'
      });
    }
  }
  
  await supabase.from('matchups').insert(matchups);
}
```

### 4. Standings Page
**Changes Needed:**
- Show note that preseason results don't count
- Maybe hide standings during preseason or show "Preview Only"

```typescript
{seasonPhase === 'preseason' && (
  <Alert color="info" sx={{ mb: 2 }}>
    Preseason games are for practice only and do not affect standings.
  </Alert>
)}
```

### 5. Scoreboard / Matchups Display
**Changes Needed:**
- Label preseason matchups clearly
- Show "Practice Match" or similar indicator

```typescript
{matchup.is_preseason && (
  <Chip size="sm" color="warning" variant="soft">
    Practice Match
  </Chip>
)}
```

## Backend Changes Needed

### 1. Matchups Table
**Add Column:**
```sql
ALTER TABLE matchups ADD COLUMN IF NOT EXISTS is_preseason boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_matchups_preseason ON matchups(is_preseason);
```

### 2. Update Scoring Function
**Modify** scoring calculation to skip preseason results from standings:

```sql
CREATE OR REPLACE FUNCTION calculate_matchup_scores(matchup_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  v_matchup matchups;
  v_is_preseason boolean;
  -- ... other variables
BEGIN
  SELECT * INTO v_matchup FROM matchups WHERE id = matchup_id_param;
  
  -- Calculate scores as normal
  -- ... existing logic
  
  -- Check if preseason
  SELECT is_preseason INTO v_is_preseason FROM matchups WHERE id = matchup_id_param;
  
  -- Only update standings if NOT preseason
  IF NOT v_is_preseason THEN
    -- Update team wins/losses/points
    -- ... existing standings logic
  END IF;
  
  RETURN result_json;
END;
$$ LANGUAGE plpgsql;
```

### 3. Create League Function
**Update** to generate preseason matchups:

```sql
-- In create_league function
-- After creating teams, generate preseason matchups
SELECT generate_matchups_for_week(league_id_param, 2025, 0, true); -- true = is_preseason
```

## Testing Checklist

### Setup
- [ ] Run migration to add fantasy weeks
- [ ] Create test league
- [ ] Verify preseason week exists (Week 0)
- [ ] Verify preseason matchups are generated

### Lineups
- [ ] During preseason: Can change lineups anytime
- [ ] Preseason banner shows on Lineups page
- [ ] Status shows "Sandbox Mode"
- [ ] After preseason: Normal lock behavior returns

### Matchups
- [ ] Preseason matchups show "Practice Match" label
- [ ] Scores calculate normally
- [ ] Results visible but marked as preseason

### Standings
- [ ] Preseason results don't affect W/L records
- [ ] Preseason games don't count in points for/against
- [ ] Warning shows that it's preseason

### Week Transition
- [ ] When Week 1 starts, preseason ends
- [ ] Normal lineup locking kicks in
- [ ] Standings start tracking

## Future Enhancements

1. **Preseason Stats Dashboard**
   - Show mock standings
   - Highlight top scorers
   - "What If" scenarios

2. **Practice Modes**
   - Multiple preseason weeks
   - Reset preseason scores
   - Tutorial overlay

3. **Lineup Templates**
   - Save preseason lineups as templates
   - Quick-set for Week 1

4. **Notifications**
   - Remind users preseason is ending
   - Prompt to finalize Week 1 lineups

## Timeline

**Phase 1: Database (15 min)**
- ✅ Run migration
- Add is_preseason column to matchups

**Phase 2: Matchup Generation (30 min)**
- Update create-league function
- Add preseason matchup generation
- Test matchup creation

**Phase 3: Lineups UI (45 min)**
- Add preseason detection
- Update lock logic
- Add banner/messaging

**Phase 4: Other Pages (30 min)**
- Update League Home
- Update Standings
- Update Scoreboard/Matchups

**Phase 5: Scoring Logic (30 min)**
- Update scoring to skip standings during preseason
- Test that results don't affect records

**Total Estimated Time:** 2.5 hours

## Next Steps

After preseason is fully implemented:
1. ✅ Users can practice during Week 0
2. → Build full lineup management system
3. → Build scoring calculation system
4. → Set up nightly NBA stats import
5. → Automate weekly scoring updates
6. → Launch! 🚀

