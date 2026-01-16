# Player Charts - Quick Reference Summary

## 📊 15 Chart Ideas at a Glance

| # | Chart Name | Type | Key Metrics | Mobile Priority |
|---|------------|------|-------------|-----------------|
| 1 | **Advanced Metrics Radar** | Radar | Offensive/Defensive Rating, Usage %, PER | ⭐⭐⭐ High |
| 2 | **Pace Gauge** | Gauge | Pace vs League Avg | ⭐⭐⭐ High |
| 3 | **Shooting Efficiency Heatmap** | Heatmap | Zone shooting percentages | ⭐⭐ Medium |
| 4 | **Usage vs Efficiency Scatter** | Scatter | Usage % vs TS% | ⭐⭐⭐ High |
| 5 | **Four Factors Comparison** | Bar (Grouped) | eFG%, FTA Rate, OREB%, TOV% | ⭐⭐⭐ High |
| 6 | **Hustle Stats** | Bar (Horizontal) | Contested shots, deflections, charges | ⭐⭐ Medium |
| 7 | **Ball Movement Trends** | Line | Touches, passes, time of possession | ⭐⭐ Medium |
| 8 | **Shot Distance Distribution** | Bar | Shot attempts by zone | ⭐⭐ Medium |
| 9 | **Advanced Stats Time Series** | Line | PER, ORtg, DRtg trends | ⭐⭐⭐ High |
| 10 | **Impact Stats** | Bar | Points off TO, fast break, paint | ⭐⭐ Medium |
| 11 | **Contested vs Uncontested** | Bar (Grouped) | Shooting % on contested/uncontested | ⭐⭐ Medium |
| 12 | **Usage vs Assist Ratio** | Scatter | Playmaking at different usage | ⭐ Low |
| 13 | **Scoring Breakdown** | Pie/Donut | 2pt/3pt/FT point distribution | ⭐⭐ Medium |
| 14 | **Defensive Impact Radar** | Radar | Defensive metrics comparison | ⭐⭐ Medium |
| 15 | **Game Log Table with Sparklines** | Data Grid | All stats with mini-charts | ⭐⭐⭐ High |

---

## 🎯 MVP Phase 1 (Start Here)

### 1. Advanced Metrics Radar Chart
**Why:** Core player evaluation at a glance  
**Data Needed:**
- `advanced_offensiveRating`
- `advanced_defensiveRating`
- `advanced_usagePercentage`
- `advanced_playerEfficiencyRating`
- `advanced_trueShootingPercentage`

### 2. Pace Gauge
**Why:** Quick visual of playing style  
**Data Needed:**
- `advanced_pace`
- League average pace

### 3. Four Factors Bar Chart
**Why:** Fundamental basketball metrics  
**Data Needed:**
- `fourFactors_effectiveFieldGoalPercentage`
- `fourFactors_freeThrowAttemptRate`
- `fourFactors_offensiveReboundPercentage`
- `fourFactors_turnoverPercentage`

### 4. Usage vs Efficiency Scatter
**Why:** Shows value at different usage levels  
**Data Needed:**
- `advanced_usagePercentage`
- `advanced_trueShootingPercentage`
- `traditional_points`

### 5. Game Log Table with Sparklines
**Why:** Most requested feature, shows trends  
**Data Needed:**
- All traditional stats
- PER, TS%, Usage % per game

---

## 📦 Database Fields Needed (Lightweight)

**NOTE:** Traditional stats are already in `nba_boxscores` table. Only advanced/derived stats go in `nba_player_game_stats`.

### Essential Fields (Phase 1):
```sql
-- Traditional stats: Use nba_boxscores table (already exists)
-- Join via: nba_boxscores.player_id + nba_boxscores.game_id = nba_player_game_stats.player_id + nba_player_game_stats.game_id

-- Advanced (9 fields)
advanced_playerEfficiencyRating, advanced_offensiveRating,
advanced_defensiveRating, advanced_netRating,
advanced_trueShootingPercentage, advanced_usagePercentage,
advanced_assistRatio, advanced_reboundPercentage, advanced_pace

-- Four Factors (4 fields)
fourFactors_effectiveFieldGoalPercentage,
fourFactors_freeThrowAttemptRate,
fourFactors_offensiveReboundPercentage,
fourFactors_turnoverPercentage
```

### Extended Fields (Phase 2-3):
- Hustle stats (6 fields)
- Player tracking (6 fields)
- Scoring breakdown (5 fields)
- Misc impact stats (4 fields)

**Total: ~30 fields per game** (advanced/derived only)
**Traditional stats: Join with `nba_boxscores` table**

---

## 🚀 Next Steps

1. ✅ Review chart ideas
2. ⏳ Create migration for `nba_player_game_stats` table
3. ⏳ Create migration for `nba_league_averages` table
4. ⏳ Update scraping script to save to new tables
5. ⏳ Build MUI X chart components
6. ⏳ Add charts to PlayerPage tabs

---

## 📱 Mobile Considerations

- **Charts:** Max 300px height, full width
- **Tables:** Horizontal scroll, virtualized rows
- **Interactivity:** Touch tooltips, swipe navigation
- **Performance:** Lazy load, memoize calculations

