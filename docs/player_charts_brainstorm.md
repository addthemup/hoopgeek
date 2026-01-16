# Player Page Charts - Brainstorming Document

## Overview
This document outlines 15 chart ideas for the player page using aggregated player stats from the scraping script. All charts will use MUI X Charts and be optimized for mobile viewing.

## Database Structure
All new tables will have foreign keys:
- `player_id UUID REFERENCES nba_players(id)`
- `game_id VARCHAR(50) REFERENCES nba_games(game_id)`

---

## 📊 Chart Categories

### 1. **Advanced Metrics Comparison (Radial/Spider Chart)**
**Chart Type:** MUI X Radar Chart  
**Data Source:** `advanced_*` stats  
**Purpose:** Compare player vs league average on key advanced metrics

**Metrics to Compare:**
- `advanced_offensiveRating` vs League Avg
- `advanced_defensiveRating` vs League Avg
- `advanced_assistRatio` vs League Avg
- `advanced_reboundPercentage` vs League Avg
- `advanced_usagePercentage` vs League Avg
- `advanced_trueShootingPercentage` vs League Avg
- `advanced_playerEfficiencyRating` vs League Avg

**Mobile Optimization:**
- Show 5-6 key metrics (not all)
- Touch-friendly labels
- Color-coded: Green (above avg), Red (below avg)

---

### 2. **Pace Gauge Chart**
**Chart Type:** MUI X Gauge Chart  
**Data Source:** `advanced_pace`  
**Purpose:** Show player's pace compared to league average

**Implementation:**
- Center value: Player's pace
- Range: League min/max pace
- Color zones: Slow (blue), Average (yellow), Fast (red)

---

### 3. **Shooting Efficiency Heatmap**
**Chart Type:** MUI X Heatmap  
**Data Source:** `scoring_*` and `traditional_*` shooting stats  
**Purpose:** Visualize shooting percentages by zone/distance

**Metrics:**
- `scoring_restrictedAreaFieldGoalsPercentage` (0-3ft)
- `scoring_paintFieldGoalsPercentage` (3-10ft)
- `scoring_midRangeFieldGoalsPercentage` (10-16ft)
- `scoring_aboveTheBreak3FieldGoalsPercentage` (3pt)
- `traditional_threePointersPercentage` (Overall 3pt%)

**Mobile Optimization:**
- Simplified 5-zone heatmap
- Color gradient: Red (low %) → Green (high %)

---

### 4. **Usage & Efficiency Scatter Plot**
**Chart Type:** MUI X Scatter Chart  
**Data Source:** `advanced_usagePercentage` vs `advanced_trueShootingPercentage`  
**Purpose:** Show efficiency at different usage rates

**X-Axis:** Usage Percentage  
**Y-Axis:** True Shooting Percentage  
**Bubble Size:** Points per game  
**Comparison:** League average point overlay

**Mobile Optimization:**
- Single game dots (not all games)
- Touch to see game details
- League average line overlay

---

### 5. **Four Factors Bar Chart**
**Chart Type:** MUI X Bar Chart (Grouped)  
**Data Source:** `fourFactors_*` stats  
**Purpose:** Compare player's four factors vs league average

**Metrics:**
- `fourFactors_effectiveFieldGoalPercentage` (eFG%)
- `fourFactors_freeThrowAttemptRate` (FTA Rate)
- `fourFactors_offensiveReboundPercentage` (OREB%)
- `fourFactors_turnoverPercentage` (TOV%) - inverted (lower is better)

**Mobile Optimization:**
- Horizontal grouped bars
- Player vs League side-by-side
- Color-coded bars

---

### 6. **Hustle Stats Comparison**
**Chart Type:** MUI X Bar Chart (Horizontal)  
**Data Source:** `hustle_*` stats  
**Purpose:** Show defensive/hustle metrics

**Metrics:**
- `hustle_contestedShots` (per game)
- `hustle_contestedShots3pt` (per game)
- `hustle_chargesDrawn` (per game)
- `hustle_deflections` (per game)
- `hustle_looseBallsRecovered` (per game)
- `hustle_screenAssists` (per game)

**Mobile Optimization:**
- Horizontal bars for easy mobile viewing
- League average line overlay
- Per-game averages (not totals)

---

### 7. **Player Tracking - Ball Movement**
**Chart Type:** MUI X Line Chart  
**Data Source:** `playerTrack_*` stats  
**Purpose:** Track ball movement and touches over time

**Metrics:**
- `playerTrack_touches` (per game)
- `playerTrack_passes` (per game)
- `playerTrack_timeOfPossession` (seconds per game)
- `playerTrack_averageSpeed` (mph)

**Mobile Optimization:**
- Single line chart with multiple series
- Toggleable series
- Game-by-game trend

---

### 8. **Shot Distance Distribution**
**Chart Type:** MUI X Bar Chart  
**Data Source:** `scoring_*` distance stats  
**Purpose:** Show shot distribution by distance

**Metrics:**
- `scoring_restrictedAreaFieldGoalsAttempted` (0-3ft)
- `scoring_paintFieldGoalsAttempted` (3-10ft)
- `scoring_midRangeFieldGoalsAttempted` (10-16ft)
- `scoring_aboveTheBreak3FieldGoalsAttempted` (3pt)
- `scoring_corner3FieldGoalsAttempted` (Corner 3pt)

**Mobile Optimization:**
- Stacked or grouped bars
- Percentage labels
- Color-coded by efficiency

---

### 9. **Advanced Stats Time Series**
**Chart Type:** MUI X Line Chart  
**Data Source:** `advanced_*` stats over games  
**Purpose:** Show trends in key advanced metrics

**Metrics (Selectable):**
- `advanced_playerEfficiencyRating` (PER)
- `advanced_offensiveRating`
- `advanced_defensiveRating`
- `advanced_netRating`
- `advanced_trueShootingPercentage`

**Mobile Optimization:**
- Single metric at a time (dropdown selector)
- Last 10-15 games shown
- Smooth line with game markers

---

### 10. **Miscellaneous Impact Stats**
**Chart Type:** MUI X Bar Chart  
**Data Source:** `misc_*` stats  
**Purpose:** Show impact plays and situational stats

**Metrics:**
- `misc_pointsOffTurnovers` (per game)
- `misc_pointsSecondChance` (per game)
- `misc_pointsFastBreak` (per game)
- `misc_pointsPaint` (per game)
- `misc_blocks` (per game)
- `misc_steals` (per game)

**Mobile Optimization:**
- Horizontal grouped bars
- Player vs League comparison
- Per-game averages

---

### 11. **Contested vs Uncontested Shooting**
**Chart Type:** MUI X Bar Chart (Grouped)  
**Data Source:** `playerTrack_*` contested stats  
**Purpose:** Compare shooting on contested vs uncontested shots

**Metrics:**
- `playerTrack_contestedFieldGoalPercentage` vs `playerTrack_uncontestedFieldGoalsPercentage`
- `playerTrack_contestedFieldGoalsMade` vs `playerTrack_uncontestedFieldGoalsMade`
- `playerTrack_defendedAtRimFieldGoalPercentage` (Rim defense)

**Mobile Optimization:**
- Side-by-side grouped bars
- Percentage and makes shown
- Color-coded (contested = red, uncontested = green)

---

### 12. **Usage & Assist Ratio Correlation**
**Chart Type:** MUI X Scatter Chart  
**Data Source:** `advanced_usagePercentage` vs `advanced_assistRatio`  
**Purpose:** Show playmaking ability at different usage levels

**X-Axis:** Usage Percentage  
**Y-Axis:** Assist Ratio  
**Bubble Color:** Position (PG, SG, SF, PF, C)  
**Bubble Size:** Assists per game

**Mobile Optimization:**
- Simplified view (last 10 games)
- Touch for game details
- Position color legend

---

### 13. **Scoring Breakdown Pie Chart**
**Chart Type:** MUI X Pie Chart  
**Data Source:** `scoring_*` and `traditional_*` stats  
**Purpose:** Show how player scores (2pt, 3pt, FT)

**Metrics:**
- 2-Point Field Goals Made
- 3-Point Field Goals Made
- Free Throws Made
- Percentage of total points from each

**Mobile Optimization:**
- Donut chart with center total
- Color-coded segments
- Percentage labels

---

### 14. **Defensive Impact Radar Chart**
**Chart Type:** MUI X Radar Chart  
**Data Source:** `hustle_*` and `advanced_defensiveRating`  
**Purpose:** Show defensive metrics comparison

**Metrics:**
- `advanced_defensiveRating`
- `hustle_contestedShots` (per game)
- `hustle_deflections` (per game)
- `traditional_steals` (per game)
- `traditional_blocks` (per game)
- `hustle_chargesDrawn` (per game)

**Mobile Optimization:**
- 5-6 key metrics
- Player vs League average
- Touch-friendly labels

---

### 15. **Game-by-Game Performance Table with Charts**
**Chart Type:** MUI X Data Grid with Sparklines  
**Data Source:** All aggregated stats per game  
**Purpose:** Interactive table with inline mini-charts

**Columns:**
- Game Date
- Opponent
- Minutes
- Points (with sparkline)
- Rebounds (with sparkline)
- Assists (with sparkline)
- PER (with sparkline)
- True Shooting % (with sparkline)
- Usage % (with sparkline)

**Mobile Optimization:**
- Horizontal scrollable table
- Collapsible columns
- Touch-friendly row selection
- Mini sparklines in cells

---

## 📋 Database Migration Requirements

### Table: `nba_player_game_stats`
**NOTE:** Traditional stats (points, rebounds, assists, etc.) are already stored in `nba_boxscores`. This table only stores advanced/derived stats.

```sql
CREATE TABLE nba_player_game_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES nba_players(id) ON DELETE CASCADE,
    game_id VARCHAR(50) NOT NULL REFERENCES nba_games(game_id) ON DELETE CASCADE,
    season_year VARCHAR(10) NOT NULL,
    
    -- Advanced Stats (key metrics only)
    -- Traditional stats come from nba_boxscores via player_id + game_id join
    advanced_playerEfficiencyRating DECIMAL(5,2),
    advanced_offensiveRating DECIMAL(5,2),
    advanced_defensiveRating DECIMAL(5,2),
    advanced_netRating DECIMAL(5,2),
    advanced_trueShootingPercentage DECIMAL(5,3),
    advanced_usagePercentage DECIMAL(5,3),
    advanced_assistRatio DECIMAL(5,2),
    advanced_reboundPercentage DECIMAL(5,3),
    advanced_pace DECIMAL(5,2),
    
    -- Four Factors (key metrics)
    fourFactors_effectiveFieldGoalPercentage DECIMAL(5,3),
    fourFactors_freeThrowAttemptRate DECIMAL(5,3),
    fourFactors_offensiveReboundPercentage DECIMAL(5,3),
    fourFactors_turnoverPercentage DECIMAL(5,3),
    
    -- Hustle Stats (per game averages)
    hustle_contestedShots INTEGER,
    hustle_contestedShots3pt INTEGER,
    hustle_deflections INTEGER,
    hustle_looseBallsRecovered INTEGER,
    hustle_chargesDrawn INTEGER,
    hustle_screenAssists INTEGER,
    
    -- Misc Stats (key impact metrics)
    misc_pointsOffTurnovers INTEGER,
    misc_pointsSecondChance INTEGER,
    misc_pointsFastBreak INTEGER,
    misc_pointsPaint INTEGER,
    
    -- Player Tracking (key metrics)
    playerTrack_touches INTEGER,
    playerTrack_passes INTEGER,
    playerTrack_timeOfPossession DECIMAL(5,2),
    playerTrack_contestedFieldGoalPercentage DECIMAL(5,3),
    playerTrack_uncontestedFieldGoalsPercentage DECIMAL(5,3),
    playerTrack_defendedAtRimFieldGoalPercentage DECIMAL(5,3),
    
    -- Scoring Breakdown (zone percentages)
    scoring_restrictedAreaFieldGoalsPercentage DECIMAL(5,3),
    scoring_paintFieldGoalsPercentage DECIMAL(5,3),
    scoring_midRangeFieldGoalsPercentage DECIMAL(5,3),
    scoring_aboveTheBreak3FieldGoalsPercentage DECIMAL(5,3),
    scoring_corner3FieldGoalsPercentage DECIMAL(5,3),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(player_id, game_id)
);

-- Indexes for performance
CREATE INDEX idx_player_game_stats_player_id ON nba_player_game_stats(player_id);
CREATE INDEX idx_player_game_stats_game_id ON nba_player_game_stats(game_id);
CREATE INDEX idx_player_game_stats_season ON nba_player_game_stats(season_year);
CREATE INDEX idx_player_game_stats_player_season ON nba_player_game_stats(player_id, season_year);
```

### Table: `nba_league_averages` (for comparisons)
```sql
CREATE TABLE nba_league_averages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_year VARCHAR(10) NOT NULL,
    stat_type VARCHAR(50) NOT NULL, -- 'advanced', 'traditional', 'fourFactors', etc.
    stat_name VARCHAR(100) NOT NULL,
    stat_value DECIMAL(10,3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(season_year, stat_type, stat_name)
);

CREATE INDEX idx_league_averages_season ON nba_league_averages(season_year);
```

---

## 🎯 Implementation Priority

### Phase 1 (MVP - 5 charts):
1. Advanced Metrics Comparison (Radial Chart)
2. Pace Gauge Chart
3. Four Factors Bar Chart
4. Usage & Efficiency Scatter Plot
5. Game-by-Game Performance Table

### Phase 2 (Enhanced - 5 charts):
6. Shooting Efficiency Heatmap
7. Hustle Stats Comparison
8. Advanced Stats Time Series
9. Contested vs Uncontested Shooting
10. Scoring Breakdown Pie Chart

### Phase 3 (Advanced - 5 charts):
11. Player Tracking - Ball Movement
12. Shot Distance Distribution
13. Miscellaneous Impact Stats
14. Usage & Assist Ratio Correlation
15. Defensive Impact Radar Chart

---

## 📱 Mobile Optimization Guidelines

1. **Chart Sizing:**
   - Max height: 300px on mobile
   - Full width with padding
   - Touch-friendly tap targets (min 44x44px)

2. **Data Density:**
   - Show 10-15 data points max per chart
   - Use aggregation for time series (weekly/monthly)
   - Lazy load chart data

3. **Interactivity:**
   - Touch to see tooltips
   - Swipe between chart tabs
   - Collapsible sections

4. **Performance:**
   - Virtualize data grids
   - Memoize chart calculations
   - Use React.memo for chart components

---

## 🔗 Related Files

- Player Page: `src/pages/PlayerPage.tsx`
- Scraping Script: `scripts/feed/scrape_games_date_range.py`
- Database Schema: `supabase/build/nba.sql`

