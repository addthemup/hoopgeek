# Player Charts - Example Queries

## Overview
This document shows example Supabase queries for each chart type. All queries are optimized for mobile and use the `nba_player_game_stats` table.

---

## 📊 Chart Query Examples

### 1. Advanced Metrics Radar Chart

**Query:** Get player's advanced stats vs league averages

```typescript
// Get player's season averages from nba_player_game_stats
// Note: Traditional stats come from nba_boxscores (join if needed)
const { data: playerStats } = await supabase
  .from('nba_player_game_stats')
  .select(`
    advanced_offensiveRating,
    advanced_defensiveRating,
    advanced_usagePercentage,
    advanced_playerEfficiencyRating,
    advanced_trueShootingPercentage,
    advanced_assistRatio,
    advanced_reboundPercentage
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26')
  .not('advanced_offensiveRating', 'is', null);

// Calculate averages
const avgStats = calculateAverages(playerStats);

// Get league averages
const { data: leagueAvgs } = await supabase
  .from('nba_league_averages')
  .select('stat_name, stat_value')
  .eq('season_year', '2025-26')
  .eq('stat_type', 'advanced')
  .in('stat_name', [
    'offensiveRating',
    'defensiveRating',
    'usagePercentage',
    'playerEfficiencyRating',
    'trueShootingPercentage',
    'assistRatio',
    'reboundPercentage'
  ]);

// Format for radar chart
const radarData = [
  { metric: 'Offensive Rating', player: avgStats.offensiveRating, league: leagueAvgs.offensiveRating },
  { metric: 'Defensive Rating', player: avgStats.defensiveRating, league: leagueAvgs.defensiveRating },
  // ... etc
];
```

---

### 2. Pace Gauge Chart

**Query:** Get player's pace vs league average

```typescript
// Get player's average pace
const { data: playerPace } = await supabase
  .from('nba_player_game_stats')
  .select('advanced_pace')
  .eq('player_id', playerId)
  .eq('season_year', '2025-26')
  .not('advanced_pace', 'is', null);

const avgPace = playerPace.reduce((sum, p) => sum + p.advanced_pace, 0) / playerPace.length;

// Get league average pace
const { data: leaguePace } = await supabase
  .from('nba_league_averages')
  .select('stat_value')
  .eq('season_year', '2025-26')
  .eq('stat_type', 'advanced')
  .eq('stat_name', 'pace')
  .single();

// Gauge chart data
const gaugeData = {
  value: avgPace,
  min: 85, // Typical min
  max: 115, // Typical max
  average: leaguePace.stat_value
};
```

---

### 3. Four Factors Bar Chart

**Query:** Get four factors vs league average

```typescript
// Get player's four factors averages
const { data: playerStats } = await supabase
  .from('nba_player_game_stats')
  .select(`
    fourFactors_effectiveFieldGoalPercentage,
    fourFactors_freeThrowAttemptRate,
    fourFactors_offensiveReboundPercentage,
    fourFactors_turnoverPercentage
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26');

const playerAvgs = calculateAverages(playerStats);

// Get league averages
const { data: leagueAvgs } = await supabase
  .from('nba_league_averages')
  .select('stat_name, stat_value')
  .eq('season_year', '2025-26')
  .eq('stat_type', 'fourFactors')
  .in('stat_name', [
    'effectiveFieldGoalPercentage',
    'freeThrowAttemptRate',
    'offensiveReboundPercentage',
    'turnoverPercentage'
  ]);

// Format for grouped bar chart
const barData = [
  {
    factor: 'eFG%',
    player: playerAvgs.effectiveFieldGoalPercentage * 100,
    league: leagueAvgs.find(a => a.stat_name === 'effectiveFieldGoalPercentage').stat_value * 100
  },
  // ... etc
];
```

---

### 4. Usage vs Efficiency Scatter Plot

**Query:** Get usage % and TS% for each game

```typescript
// Get game-by-game usage and efficiency
const { data: scatterData } = await supabase
  .from('nba_player_game_stats')
  .select(`
    game_id,
    advanced_usagePercentage,
    advanced_trueShootingPercentage,
    traditional_points,
    nba_games!inner(game_date, home_team, away_team)
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26')
  .not('advanced_usagePercentage', 'is', null)
  .not('advanced_trueShootingPercentage', 'is', null)
  .order('nba_games.game_date', { ascending: true })
  .limit(20); // Last 20 games for mobile

// Format for scatter chart
const scatterPoints = scatterData.map(game => ({
  x: game.advanced_usagePercentage * 100,
  y: game.advanced_trueShootingPercentage * 100,
  size: game.traditional_points,
  gameDate: game.nba_games.game_date,
  opponent: `${game.nba_games.away_team} @ ${game.nba_games.home_team}`
}));
```

---

### 5. Advanced Stats Time Series

**Query:** Get PER trend over last 15 games

```typescript
// Get PER over time
const { data: timeSeriesData } = await supabase
  .from('nba_player_game_stats')
  .select(`
    advanced_playerEfficiencyRating,
    nba_games!inner(game_date)
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26')
  .not('advanced_playerEfficiencyRating', 'is', null)
  .order('nba_games.game_date', { ascending: true })
  .limit(15); // Last 15 games

// Format for line chart
const lineData = timeSeriesData.map(game => ({
  date: game.nba_games.game_date,
  per: game.advanced_playerEfficiencyRating
}));
```

---

### 6. Hustle Stats Comparison

**Query:** Get hustle stats per game averages

```typescript
// Get player's hustle stats
const { data: playerHustle } = await supabase
  .from('nba_player_game_stats')
  .select(`
    hustle_contestedShots,
    hustle_contestedShots3pt,
    hustle_deflections,
    hustle_looseBallsRecovered,
    hustle_chargesDrawn,
    hustle_screenAssists
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26');

// Calculate per-game averages
const hustleAvgs = calculateAverages(playerHustle);

// Get league averages (would need to be calculated from all players)
// For now, use hardcoded typical values or calculate separately
const leagueHustleAvgs = {
  contestedShots: 8.5,
  contestedShots3pt: 3.2,
  deflections: 2.1,
  looseBallsRecovered: 1.2,
  chargesDrawn: 0.1,
  screenAssists: 2.5
};

// Format for horizontal bar chart
const hustleData = [
  { stat: 'Contested Shots', player: hustleAvgs.contestedShots, league: leagueHustleAvgs.contestedShots },
  // ... etc
];
```

---

### 7. Game Log Table with Sparklines

**Query:** Get all stats for game log table (join with nba_boxscores for traditional stats)

```typescript
// Get advanced stats from nba_player_game_stats
const { data: advancedStats } = await supabase
  .from('nba_player_game_stats')
  .select(`
    game_id,
    advanced_playerEfficiencyRating,
    advanced_trueShootingPercentage,
    advanced_usagePercentage,
    nba_games!inner(game_date, home_team_tricode, away_team_tricode)
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26')
  .order('nba_games.game_date', { ascending: false })
  .range(0, 19); // First 20 games

// Get traditional stats from nba_boxscores
const { data: traditionalStats } = await supabase
  .from('nba_boxscores')
  .select('game_id, min, pts, reb, ast, stl, blk, tov')
  .eq('player_id', playerId)
  .eq('season_year', '2025-26')
  .order('game_date', { ascending: false })
  .range(0, 19);

// Merge the data
const gameLogs = advancedStats.map(adv => {
  const trad = traditionalStats.find(t => t.game_id === adv.game_id);
  return {
    ...adv,
    ...trad
  };
});

// Format for data grid
const tableRows = gameLogs.map(game => ({
  id: game.game_id,
  date: game.nba_games.game_date,
  opponent: `${game.nba_games.away_team_tricode} @ ${game.nba_games.home_team_tricode}`,
  min: game.min,
  pts: game.pts,
  reb: game.reb,
  ast: game.ast,
  per: game.advanced_playerEfficiencyRating,
  tsPct: game.advanced_trueShootingPercentage,
  usgPct: game.advanced_usagePercentage
}));

// For sparklines, fetch last 10 games for each metric
const sparklineData = {
  points: gameLogs.slice(0, 10).map(g => g.pts),
  rebounds: gameLogs.slice(0, 10).map(g => g.reb),
  assists: gameLogs.slice(0, 10).map(g => g.ast),
  per: gameLogs.slice(0, 10).map(g => g.advanced_playerEfficiencyRating),
  tsPct: gameLogs.slice(0, 10).map(g => g.advanced_trueShootingPercentage)
};
```

---

### 8. Shooting Efficiency Heatmap

**Query:** Get shooting percentages by zone

```typescript
// Get zone shooting percentages
const { data: shootingData } = await supabase
  .from('nba_player_game_stats')
  .select(`
    scoring_restrictedAreaFieldGoalsPercentage,
    scoring_paintFieldGoalsPercentage,
    scoring_midRangeFieldGoalsPercentage,
    scoring_aboveTheBreak3FieldGoalsPercentage,
    scoring_corner3FieldGoalsPercentage
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26')
  .not('scoring_restrictedAreaFieldGoalsPercentage', 'is', null);

// Calculate season averages
const zoneAvgs = calculateAverages(shootingData);

// Format for heatmap
const heatmapData = [
  { zone: 'Restricted Area (0-3ft)', percentage: zoneAvgs.restrictedArea * 100 },
  { zone: 'Paint (3-10ft)', percentage: zoneAvgs.paint * 100 },
  { zone: 'Mid-Range (10-16ft)', percentage: zoneAvgs.midRange * 100 },
  { zone: 'Above Break 3pt', percentage: zoneAvgs.aboveBreak3 * 100 },
  { zone: 'Corner 3pt', percentage: zoneAvgs.corner3 * 100 }
];
```

---

### 9. Contested vs Uncontested Shooting

**Query:** Get contested shooting percentages

```typescript
// Get contested shooting stats
const { data: contestedData } = await supabase
  .from('nba_player_game_stats')
  .select(`
    playerTrack_contestedFieldGoalPercentage,
    playerTrack_uncontestedFieldGoalsPercentage,
    playerTrack_defendedAtRimFieldGoalPercentage
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26')
  .not('playerTrack_contestedFieldGoalPercentage', 'is', null);

const contestedAvgs = calculateAverages(contestedData);

// Format for grouped bar chart
const contestedData = [
  {
    type: 'Contested',
    percentage: contestedAvgs.contestedFieldGoalPercentage * 100
  },
  {
    type: 'Uncontested',
    percentage: contestedAvgs.uncontestedFieldGoalsPercentage * 100
  },
  {
    type: 'Defended at Rim',
    percentage: contestedAvgs.defendedAtRimFieldGoalPercentage * 100
  }
];
```

---

### 10. Scoring Breakdown Pie Chart

**Query:** Get scoring distribution (from nba_boxscores)

```typescript
// Get scoring stats from nba_boxscores (traditional stats)
const { data: scoringData } = await supabase
  .from('nba_boxscores')
  .select(`
    pts,
    fg3m,
    ftm
  `)
  .eq('player_id', playerId)
  .eq('season_year', '2025-26');

// Calculate totals
const totals = scoringData.reduce((acc, game) => ({
  points: acc.points + (game.pts || 0),
  threes: acc.threes + ((game.fg3m || 0) * 3),
  fts: acc.fts + (game.ftm || 0),
  twos: acc.twos + (game.pts || 0) - 
        ((game.fg3m || 0) * 3) - 
        (game.ftm || 0)
}), { points: 0, threes: 0, fts: 0, twos: 0 });

// Format for pie chart
const pieData = [
  { label: '2-Pointers', value: totals.twos, percentage: (totals.twos / totals.points) * 100 },
  { label: '3-Pointers', value: totals.threes, percentage: (totals.threes / totals.points) * 100 },
  { label: 'Free Throws', value: totals.fts, percentage: (totals.fts / totals.points) * 100 }
];
```

---

## 🔧 Helper Functions

### Calculate Averages

```typescript
function calculateAverages(stats: any[]) {
  if (!stats || stats.length === 0) return {};
  
  const keys = Object.keys(stats[0]).filter(k => k !== 'game_id' && k !== 'id');
  const averages: any = {};
  
  keys.forEach(key => {
    const values = stats
      .map(s => s[key])
      .filter(v => v !== null && v !== undefined);
    
    if (values.length > 0) {
      averages[key] = values.reduce((sum, v) => sum + Number(v), 0) / values.length;
    }
  });
  
  return averages;
}
```

### Get League Averages (Batch)

```typescript
async function getLeagueAverages(season: string, statTypes: string[]) {
  const { data } = await supabase
    .from('nba_league_averages')
    .select('stat_type, stat_name, stat_value')
    .eq('season_year', season)
    .in('stat_type', statTypes);
  
  // Convert to map for easy lookup
  const leagueMap: Record<string, Record<string, number>> = {};
  
  data?.forEach(row => {
    if (!leagueMap[row.stat_type]) {
      leagueMap[row.stat_type] = {};
    }
    leagueMap[row.stat_type][row.stat_name] = row.stat_value;
  });
  
  return leagueMap;
}
```

---

## 📱 Mobile Optimization Tips

1. **Limit Data Points:**
   - Time series: 10-15 games max
   - Scatter plots: 20 games max
   - Tables: 20 rows per page with pagination

2. **Lazy Loading:**
   ```typescript
   // Load chart data only when tab is active
   const { data } = useQuery({
     queryKey: ['player-chart', chartType, playerId],
     queryFn: () => fetchChartData(chartType),
     enabled: activeTab === chartTabIndex
   });
   ```

3. **Memoization:**
   ```typescript
   const chartData = useMemo(() => {
     return processDataForChart(rawData);
   }, [rawData]);
   ```

4. **Virtual Scrolling:**
   - Use MUI X DataGrid virtualization
   - Load more data on scroll

---

## 🎯 Performance Considerations

1. **Index Usage:**
   - All queries use indexed columns (player_id, season_year, game_id)
   - Composite indexes for common query patterns

2. **Query Optimization:**
   - Use `.select()` to limit columns
   - Use `.limit()` for time series
   - Use `.range()` for pagination

3. **Caching:**
   - Cache league averages (rarely change)
   - Cache player season averages
   - Use React Query for automatic caching

