# Theoretical Player Spotlight Posts (4 games)

Grepped **play_by_play**, **player_stats**, and **shot_charts** for the four posts below. Data availability and a theoretical post shape for each.

---

## Data availability matrix

| Game ID       | Date       | Matchup    | play_by_play | player_stats | shot_charts |
|---------------|------------|------------|--------------|--------------|-------------|
| 0022500877    | 2026-03-01 | NOP @ LAC  | ✅           | ✅           | ❌ (Queen not in shotChartData) |
| 0022500881    | 2026-03-02 | DEN @ UTA  | ✅           | ❌ **missing** | ✅ (Keyonte George) |
| 0022500880    | 2026-03-02 | BOS @ MIL  | ✅           | ✅           | ❌ (Pritchard not in shotChartData) |
| 0022500863    | 2026-02-28 | POR @ CHA  | ✅           | ✅           | ✅ (Coby White) |

**Note:** `player_stats_0022500881.json` does not exist. For Keyonte George (DEN @ UTA), stats would need to be derived from play_by_play + shot_charts only, or the feed pipeline would need to generate/fetch that file.

---

## 1. Derik Queen — NOP @ LAC (0022500877) · person_id 1642852

### Data sources
- **play_by_play:** 118 events (Queen name/personId); multiple with MP4.
- **player_stats:** Full row + keyed `playerStatsByPersonId["1642852"]`.
- **shot_charts:** Queen not in `shotChartData` for this game (no key 1642852).

### Stats (from player_stats)
| Traditional | Value |
|------------|--------|
| MIN        | 29:01 |
| PTS        | 19    |
| REB        | 5 (1 OREB, 4 DREB) |
| AST        | 2     |
| STL        | 2     |
| BLK        | 1     |
| TOV        | 3     |
| PF         | 3     |
| FG         | 6/13 (46.2%) |
| 3P         | 0/1   |
| FT         | 7/7 (100%) |
| +/−        | -1    |

**Notable:** 63.2% of points in the paint, 2 second-chance, 2 fast-break, 5 fouls drawn. 50% of team steals, 33% of team blocks (good for “two-way” angle). 100% FT.

### Sample PBP (for clips / story)
- Queen 2' Driving Reverse Layup (4 PTS)
- Queen 3' Driving Layup (6 PTS)
- Queen STEAL (1 STL) / Queen STEAL (2 STL)
- Queen BLOCK (1 BLK)
- Queen 7' Driving Layup (14 PTS) (Murray 5 AST)
- Bey 2' Driving Finger Roll Layup (9 PTS) (Queen 1 AST)
- Free throws: Queen Free Throw 1 of 2, 2 of 2 (multiple trips)

### Theoretical post shape
- **Hero:** “Derik Queen” · 19 PTS · 5 REB · 2 AST · 2 STL · 1 BLK · 29 MIN.
- **Angle:** Two-way (2 STL, 1 BLK, 50% team STL share). Interior scorer (12 paint pts, 7/7 FT).
- **Sections:** Hero + headline + **video carousel** (best MP4s: layups, block, steals) + **stat card** (traditional + “12 pts in paint”, “7/7 FT”) + optional **play list** (no shot chart).
- **Elite callouts:** “7/7 from the line”, “2 steals, 1 block”, “12 points in the paint”.

---

## 2. Keyonte George — DEN @ UTA (0022500881) · person_id 1641718

### Data sources
- **play_by_play:** 56 events; multiple with MP4.
- **player_stats:** ❌ **No file** `player_stats_0022500881.json`.
- **shot_charts:** ✅ Key “1641718” (Keyonte George); 14 shot events with zone/distance/make.

### Stats (from PBP + shot_charts only)
- **Shot chart:** Mix of 2PT (driving floaters, layups, mid-range) and 3PT (pull-up, step-back, above break). Multiple made 3s and layups.
- **PBP descriptions (sample):** George 17' Driving Floating Jump Shot (5 PTS); George 6' Running Layup (7 PTS); George 14' Driving Floating (9 PTS); George 14' Turnaround Fadeaway (11 PTS); George 26' 3PT Pullup (14 PTS); George 24' 3PT Running Jump Shot (19 PTS); George 3' Driving Layup (21 PTS); George 25' 3PT Step Back (24 PTS). STEAL (1–4), REBOUND (Off:0 Def:1/2), 2 AST (Bailey, Filipowski), Free throws.
- **Derived narrative:** High-usage scorer (24+ PTS from PBP), 4 steals, 2 AST, some 3s and rim pressure.

### Theoretical post shape
- **Hero:** “Keyonte George” · PTS/REB/AST from **shot chart + PBP** (e.g. ~24 PTS, 2 AST, 4 STL if we parse PBP).
- **Angle:** Scoring burst + defensive activity (4 steals). **Shot chart section** is a strong differentiator (Kibo chart: scatter or zone summary).
- **Sections:** Hero + headline + **video carousel** (buckets + steals) + **shot chart** (LOC_X/LOC_Y, SHOT_ZONE_BASIC, make/miss) + optional “Shot breakdown” (e.g. “X/Y from 3”, “Z in the paint”).
- **Elite callouts:** “4 steals”, “24+ points”, “shot chart” (when we have it). **Generator must handle missing player_stats** (derive from PBP/shot_chart or skip full box).

---

## 3. Payton Pritchard — BOS @ MIL (0022500880) · person_id 1630202

### Data sources
- **play_by_play:** 109 events; many with MP4.
- **player_stats:** Full row + keyed `playerStatsByPersonId["1630202"]`.
- **shot_charts:** Pritchard not in `shotChartData` for this game.

### Stats (from player_stats)
| Traditional | Value |
|------------|--------|
| MIN        | 33:59 |
| PTS        | 25    |
| REB        | 4 (2 OREB, 2 DREB) |
| AST        | 9     |
| STL        | 0     |
| BLK        | 0     |
| TOV        | 1     |
| PF         | 1     |
| FG         | 10/23 (43.5%) |
| 3P         | 5/10 (50%) |
| FT         | 0/0   |
| +/−        | +15   |

**Advanced:** 119.4 ORtg, 93.7 DRtg, 25.7 Net; 50% AST%, 9.0 AST/TO; 54.3% eFG, 54.3% TS; 30% USG; 18.3% PIE. **Usage:** 47.4% of team assists, 33.8% of team points.

### Sample PBP (for clips)
- Pritchard 2' Driving Layup (2 PTS) (Garza 1 AST)
- Scheierman 26' 3PT (3 PTS) (Pritchard 3 AST) … multiple assist mentions
- Pritchard 28' 3PT Step Back (9 PTS)
- Pritchard 1' Running Layup (4 PTS) (White 2 AST)
- Pritchard 28' 3PT Pullup (22 PTS) (Hauser 1 AST)
- White 27' 3PT (18 PTS) (Pritchard 8 AST)

### Theoretical post shape
- **Hero:** “Payton Pritchard” · 25 PTS · 4 REB · 9 AST · 33 MIN.
- **Angle:** Playmaker (9 AST, 1 TO, 47% of team AST) + efficient shooting (5/10 from 3). No shot chart → use PBP + stats only.
- **Sections:** Hero + headline + **video carousel** (3s, layups, assists) + **stat card** (traditional + advanced: AST%, AST/TO, eFG%) + **assist highlights** (e.g. “Set up White, Scheierman, Gonzalez…”).
- **Elite callouts:** “9 AST, 1 TO”, “5/10 from 3”, “47% of team’s assists”, “25.7 Net”.

---

## 4. Coby White — POR @ CHA (0022500863) · person_id 1629632

### Data sources
- **play_by_play:** 65 events; multiple with MP4.
- **player_stats:** Full row + keyed `playerStatsByPersonId["1629632"]`.
- **shot_charts:** ✅ Key “1629632”; multiple shots with zones (above break 3, restricted area, layups).

### Stats (from player_stats)
| Traditional | Value |
|------------|--------|
| MIN        | 21:29 |
| PTS        | 20    |
| REB        | 3 (0 OREB, 3 DREB) |
| AST        | 1     |
| STL        | 0     |
| BLK        | 0     |
| TOV        | 2     |
| PF         | 4     |
| FG         | 5/13 (38.5%) |
| 3P         | 2/5 (40%) |
| FT         | 8/9 (88.9%) |
| +/−        | +1    |

**Misc:** 2 pts off turnovers, 2 fast-break, 6 paint; 5 fouls drawn; 1 screen assist (3 pts). **Player track:** 4.32 speed, 1.71 distance, 50 touches.

### Shot chart (sample)
- Made: 27' 3PT Pullup (Above the Break 3); 3' Driving Layup (Restricted Area); 3' Driving Layup (RA); 27' 3PT Step Back (Above the Break 3); Running Layup (RA).
- Misses: 2' Running Layup; 26' 3PT; 2' Driving Floating.

### Sample PBP
- White 27' 3PT Pullup (3 PTS)
- White 3' Driving Layup (9 PTS)
- White 27' 3PT Step Back (18 PTS) (Miller 2 AST)
- Diabate 2' Cutting Dunk (13 PTS) (White 1 AST)
- Free throws: 1 of 2, 2 of 2 (11 PTS); 1 of 2, 2 of 2 (15 PTS)

### Theoretical post shape
- **Hero:** “Coby White” · 20 PTS · 3 REB · 1 AST · 21 MIN.
- **Angle:** Scorer in limited minutes (20 in 21 min), 8/9 FT, 2/5 from 3. **Shot chart** for spatial story (above-break 3s + rim).
- **Sections:** Hero + headline + **video carousel** (3s, layups, assist) + **stat card** (traditional + “8/9 FT”, “5 fouls drawn”) + **shot chart** (Kibo: scatter or zone bar).
- **Elite callouts:** “20 in 21 minutes”, “8/9 from the line”, “5 fouls drawn”, “shot chart” (2/5 from 3, finishes at rim).

---

## Generator / pipeline takeaways

1. **player_stats missing (0022500881):** Generator should tolerate missing `PlayerStats` / `playerStatsByPersonId` and still build a post from **play_by_play** + **shot_charts** (e.g. Keyonte George). Consider a fallback: derive a minimal “stat line” from PBP event types (FGA/FGM, AST, REB, STL from descriptions) or mark “Stats from play-by-play”.
2. **shot_charts optional:** Queen and Pritchard have no shot chart for that game; Coby and George do. Use shot chart section only when `shotChartData[personId]` exists.
3. **Per-post angle:**  
   - **Queen:** two-way (STL/BLK), paint + FT.  
   - **George:** scoring + 4 STL + shot chart.  
   - **Pritchard:** playmaking (AST%, AST/TO) + 3P.  
   - **Coby:** efficiency in limited minutes + FT + shot chart.
4. **Kibo charts:**  
   - **Radar:** traditional stats (PTS, REB, AST, STL, BLK) when player_stats exists.  
   - **Shot chart:** scatter (LOC_X, LOC_Y) or bar by zone when shot_charts exist.  
   - **Bar/line:** e.g. “Points by quarter” if we aggregate PBP by period.
5. **Repeatability:** Same flow (grep game_id → load PBP + player_stats + shot_charts → pick angle from stats → build sections) works for more games; only 0022500881 needs a “no player_stats” path.
