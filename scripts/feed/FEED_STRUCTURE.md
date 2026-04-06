# Feed folder structure

## Current primary format (PostCreator + Game page)

**One file per game** locally (e.g. `scripts/feed/0022501002.json`). It contains `gameMetadata`, `score`, `story`, `playByPlay`, `PlayerStats`, `AggregatedPlayerStats`, `shotChartData`, etc.—the output of `scrape_games_date_range.py`. Upload to **Storage** bucket `game-data` at **`{game_id}.json`** (bucket root), unless `FEED_OBJECT_PREFIX` is set (e.g. `feed/`).

The Vite dev API `GET /api/local-feed/{game_id}.json` serves that file as-is. It only merges legacy `player_stats/` or `shot_charts/` folders when the root JSON is missing those sections.

---

## Legacy: one folder per **bit** of data

Each bit can be scraped (or backfilled) by its own script and cron job. If one bit fails, others can still run; retries can target a single folder.

```
feed/
  discover/            # Games per day (from LeagueGameFinder).
                       # Files: discover_2025-10-31.json → { "date", "games": [...] }

  play_by_play/        # PBP with MP4 URLs (single source for plays + video).
                       # Files: play_by_play_0022500123.json → { "gameId", "matchup", "date", "videos": [...] }

  metadata/            # Game-level metadata + score.
                       # Files: metadata_0022500123.json → { "gameId", "gameMetadata", "score" }

  player_stats/        # PlayerStats + AggregatedPlayerStats + AggregatedTeamStats.
                       # Files: player_stats_0022500123.json → { "gameId", "PlayerStats", ... }

  shot_charts/         # Shot chart data (optional).
                       # Files: shot_charts_0022500123.json → { "gameId", "shotChartData" }
```
Type prefix in each filename so files are identifiable when outside the directory.

**Scripts** (live at `feed/` or `feed/scripts/`):

- **discover** → `discover_games_date_range.py` — writes `discover/discover_YYYY-MM-DD.json`
- **play_by_play** → `mp4_scrape_games_date_range.py` — writes `play_by_play/play_by_play_{game_id}.json` (PBP + video URLs)
- **metadata** → (later) — writes `metadata/metadata_{game_id}.json`
- **player_stats** → (later) — writes `player_stats/player_stats_{game_id}.json`
- **shot_charts** → (later) — writes `shot_charts/shot_charts_{game_id}.json`

**Cron:** Run one script per bit. Each script only touches its folder; retry or loop back for failed/skipped jobs.

---

### Scripts total (one per folder = 5 scripts)

| # | Folder         | Script (to build or exists)     | Source / what it fetches | Status   |
|---|----------------|----------------------------------|---------------------------|----------|
| 1 | discover/      | discover_games_date_range.py    | LeagueGameFinder for date range → list of game_id, matchup, date | **to build** |
| 2 | play_by_play/  | mp4_scrape_games_date_range.py  | PlayByPlayV3 + VideoEventsAsset → gameId, matchup, date, videos | **exists** ✓ |
| 3 | metadata/      | metadata_scrape_games_date_range.py | get_game_metadata + box score summary → gameMetadata, score | **to build** |
| 4 | player_stats/  | player_stats_scrape_games_date_range.py | All box score endpoints + aggregation → PlayerStats, etc. | **to build** |
| 5 | shot_charts/   | shot_charts_scrape_games_date_range.py | Shot chart endpoint → shotChartData | **to build** |

**Suggested cron order (one at a time, loop back on failure):**  
1. discover  
2. metadata  
3. play_by_play (mp4_scrape_games_date_range.py — heaviest, rate-limited)  
4. player_stats  
5. shot_charts (optional)

**Nightly automation (12 AM–7 AM EST):**  
- **run_feed_nightly.sh** — Runs at 12:01 AM EST for **yesterday’s** games. Loops: full pipeline (all 5 steps) → audit → if any games still incomplete and before 7 AM EST, sleep 15m and repeat. Stops at 7 AM EST or when all games have play_by_play with >200 videos.  
- **Cron (12:01 AM EST):**  
  `1 0 * * * TZ=America/New_York /Volumes/OneTouch/hoopgeek/hoopgeek/scripts/feed/run_feed_nightly.sh >> /Volumes/OneTouch/hoopgeek/hoopgeek/scripts/feed/logs/feed_nightly.log 2>&1`  
  (Adjust path to your repo; ensure `logs/` exists or the script creates it.)

**Audit (feed vs nba_games):**  
- **audit_feed_vs_nba_games.py** — Compares Supabase `nba_games` (game_status=3) in a date range to local `play_by_play/*.json`. Reports how many have a matching file and how many have >200 videos. Use `--quiet` for scripting (prints `TOTAL= COMPLETE= INCOMPLETE=`).

**Aggregation:** A separate step (or app) can read from these folders and build the full game payload when needed.
