# League Creation Form - Weekly Lineup Updates

## Status: ✅ Database Migrations Complete

### What's Done:
1. ✅ Types updated (`leagueSettings.ts`) with lineup fields
2. ✅ Default settings updated (`useLeagueInitialization.ts`) with lineup defaults
3. ✅ Database migrations applied successfully

### What's Next: Update Frontend

## Changes Needed in LeagueCreationForm.tsx

### 1. Add New Step Between Roster and League Settings

**Current Steps:**
- Step 1: Basic Info
- Step 2: Roster Configuration  
- Step 3: League Settings
- Step 4: Invite Members

**New Steps:**
- Step 1: Basic Info
- Step 2: Roster Configuration
- **Step 3: Weekly Lineup Configuration** ← NEW!
- Step 4: League Settings
- Step 5: Invite Members

### 2. Add renderStep3() for Weekly Lineup Configuration

Insert this between renderStep2 and current renderStep3:

```typescript
const renderStep3 = () => {
  const rosterSize = Object.values(settings.roster_positions).reduce((sum, count) => sum + count, 0);
  const lineupSize = settings.starters_count + settings.rotation_count + settings.bench_count;
  const isLineupValid = lineupSize <= rosterSize;

  return (
    <Stack spacing={3}>
      <Typography level="h4" sx={{ mb: 2 }}>
        Weekly Lineup Configuration
      </Typography>
      
      <Typography level="body-md" sx={{ color: 'text.secondary' }}>
        Set up how many players are active each week and their fantasy point multipliers.
        Each week, you'll select players from your roster to fill these spots.
      </Typography>

      <Alert color={isLineupValid ? 'success' : 'danger'}>
        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
          Roster Size: {rosterSize} players
        </Typography>
        <Typography level="body-sm">
          Lineup Size: {lineupSize} players ({settings.starters_count} + {settings.rotation_count} + {settings.bench_count})
        </Typography>
        {!isLineupValid && (
          <Typography level="body-sm" color="danger" sx={{ mt: 1 }}>
            ❌ Lineup cannot exceed roster size!
          </Typography>
        )}
      </Alert>

      {/* STARTERS */}
      <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2, color: 'primary.700' }}>
            ⭐ Starters (Locked at 5)
          </Typography>
          <Grid container spacing={2}>
            <Grid xs={6}>
              <FormControl>
                <FormLabel>Number of Starters</FormLabel>
                <Input
                  value={5}
                  disabled
                  endDecorator="players"
                />
                <FormHelperText>Always 5 starters (NBA lineup)</FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={6}>
              <FormControl>
                <FormLabel>Points Multiplier</FormLabel>
                <Input
                  type="number"
                  value={settings.starters_multiplier}
                  onChange={(e) => handleSettingsChange('starters_multiplier', parseFloat(e.target.value))}
                  slotProps={{
                    input: {
                      min: 0,
                      max: 2,
                      step: 0.05
                    }
                  }}
                  endDecorator="x"
                />
                <FormHelperText>Default: 1.0x (100%)</FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ROTATION */}
      <Card variant="outlined" sx={{ bgcolor: 'warning.50' }}>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2, color: 'warning.700' }}>
            🔄 Rotation Players
          </Typography>
          <Grid container spacing={2}>
            <Grid xs={6}>
              <FormControl>
                <FormLabel>Number of Rotation Players</FormLabel>
                <Select
                  value={settings.rotation_count}
                  onChange={(_, value) => handleSettingsChange('rotation_count', value)}
                >
                  {[3, 4, 5, 6, 7].map(num => (
                    <Option key={num} value={num}>{num} players</Option>
                  ))}
                </Select>
                <FormHelperText>Range: 3-7 players</FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={6}>
              <FormControl>
                <FormLabel>Points Multiplier</FormLabel>
                <Input
                  type="number"
                  value={settings.rotation_multiplier}
                  onChange={(e) => handleSettingsChange('rotation_multiplier', parseFloat(e.target.value))}
                  slotProps={{
                    input: {
                      min: 0,
                      max: 2,
                      step: 0.05
                    }
                  }}
                  endDecorator="x"
                />
                <FormHelperText>Default: 0.75x (75%)</FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* BENCH */}
      <Card variant="outlined" sx={{ bgcolor: 'neutral.50' }}>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2, color: 'neutral.700' }}>
            📋 Bench Players
          </Typography>
          <Grid container spacing={2}>
            <Grid xs={6}>
              <FormControl>
                <FormLabel>Number of Bench Players</FormLabel>
                <Select
                  value={settings.bench_count}
                  onChange={(_, value) => handleSettingsChange('bench_count', value)}
                >
                  {[3, 4, 5].map(num => (
                    <Option key={num} value={num}>{num} players</Option>
                  ))}
                </Select>
                <FormHelperText>Range: 3-5 players</FormHelperText>
              </FormControl>
            </Grid>
            <Grid xs={6}>
              <FormControl>
                <FormLabel>Points Multiplier</FormLabel>
                <Input
                  type="number"
                  value={settings.bench_multiplier}
                  onChange={(e) => handleSettingsChange('bench_multiplier', parseFloat(e.target.value))}
                  slotProps={{
                    input: {
                      min: 0,
                      max: 2,
                      step: 0.05
                    }
                  }}
                  endDecorator="x"
                />
                <FormHelperText>Default: 0.5x (50%)</FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Alert color="primary" variant="soft">
        <Typography level="body-sm">
          💡 <strong>How it works:</strong> Each week, you'll set your lineup by assigning players from your roster to these tiers. 
          Starters get full points, rotation players get reduced points, and bench players get even fewer points.
        </Typography>
      </Alert>
    </Stack>
  );
};
```

### 3. Rename Existing Steps

- Rename current `renderStep3()` to `renderStep4()`
- Rename current `renderStep4()` to `renderStep5()`

### 4. Update Switch Statement

Change from:
```typescript
case 1: return renderStep1();
case 2: return renderStep2();
case 3: return renderStep3();
case 4: return renderStep4();
```

To:
```typescript
case 1: return renderStep1();
case 2: return renderStep2();
case 3: return renderStep3(); // NEW Weekly Lineup
case 4: return renderStep4(); // League Settings (was step 3)
case 5: return renderStep5(); // Invite Members (was step 4)
```

### 5. Update Step Validation

Add validation for step 3 in `validateCurrentStep()`:

```typescript
if (step === 3) {
  const rosterSize = Object.values(settings.roster_positions).reduce((sum, count) => sum + count, 0);
  const lineupSize = settings.starters_count + settings.rotation_count + settings.bench_count;
  
  if (lineupSize > rosterSize) {
    newErrors.push(`Lineup size (${lineupSize}) cannot exceed roster size (${rosterSize})`);
  }
  
  if (settings.starters_count !== 5) {
    newErrors.push('Starters count must be 5');
  }
  
  if (settings.rotation_count < 3 || settings.rotation_count > 7) {
    newErrors.push('Rotation count must be between 3 and 7');
  }
  
  if (settings.bench_count < 3 || settings.bench_count > 5) {
    newErrors.push('Bench count must be between 3 and 5');
  }
}
```

## Edge Function Update

Update `/supabase/functions/create-league/index.ts`:

```typescript
const { 
  name, 
  description, 
  maxTeams, 
  scoringType, 
  teamName,
  rosterConfig,
  draftDate,
  salaryCapAmount,
  // NEW: Lineup settings
  startersCount,
  startersMultiplier,
  rotationCount,
  rotationMultiplier,
  benchCount,
  benchMultiplier
} = body

// Call RPC with new parameters
const { data: leagueId, error: leagueError } = await userSupabase
  .rpc('create_league_with_commissioner', {
    league_name: name,
    league_description: description || null,
    max_teams_count: maxTeams,
    scoring_type_val: scoringType,
    team_name_val: teamName,
    salary_cap_enabled_val: true,
    salary_cap_amount_val: salaryCapAmount || 200000000,
    lineup_frequency_val: 'daily',
    roster_config: rosterConfig || defaultRosterConfig,
    draft_date_val: draftDate || null,
    // NEW: Lineup parameters
    starters_count_val: startersCount || 5,
    starters_multiplier_val: startersMultiplier || 1.0,
    rotation_count_val: rotationCount || 5,
    rotation_multiplier_val: rotationMultiplier || 0.75,
    bench_count_val: benchCount || 3,
    bench_multiplier_val: benchMultiplier || 0.5
  })
```

## Testing Checklist

After implementing:
- [ ] Form shows 5 steps instead of 4
- [ ] Step 3 shows weekly lineup configuration
- [ ] Validation works (lineup ≤ roster)
- [ ] Default values are correct (5, 1.0, 5, 0.75, 3, 0.5)
- [ ] Can adjust multipliers and counts
- [ ] Error shows when lineup > roster
- [ ] League creation passes lineup settings to database
- [ ] New league has lineup settings saved correctly

## Ready to Implement?

All migrations are complete. Just need to:
1. Update LeagueCreationForm.tsx (add step 3, rename others)
2. Update create-league Edge Function (pass new params)
3. Test league creation

Let me know when ready and I'll apply all the changes! 🚀

