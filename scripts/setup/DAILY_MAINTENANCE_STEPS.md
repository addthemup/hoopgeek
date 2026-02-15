# Daily maintenance – what runs and how to run it

## Terminal command (copy into notes)

From the **project root** (hoopgeek repo):

```bash
cd /Volumes/OneTouch/hoopgeek/hoopgeek && bash scripts/setup/run_daily_maintenance.sh
```

Or from anywhere, using the script’s absolute path:

```bash
bash /Volumes/OneTouch/hoopgeek/hoopgeek/scripts/setup/run_daily_maintenance.sh
```

(The script `cd`s to the project root internally, but it resolves `PROJECT_DIR` from the script’s location, so running from project root is safest.)

---

## Step-by-step: what happens when you run it

### Setup (before any script)

1. **Paths** – Script dir and project root are derived from the script’s path; project root is set to two levels above `scripts/setup/`.
2. **Env** – Exports:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SPORTS_ODDS_API_KEY`, `SPORTS_ODDS_API_KEY`
3. **Logging** – Creates `logs/` if needed; all script output is appended to `logs/daily_maintenance.log` and also printed to the terminal.
4. **CWD** – Shell changes to project root (`$PROJECT_DIR`).
5. **Counters** – Initializes success/fail counts and the list of failed script names.

### Script 1 – Import Daily Boxscores  
`scripts/setup/import_daily_boxscores.py`

- Uses **yesterday’s date** (no args) or a date range if you had passed start/end dates.
- Loads completed games from `nba_games` for that date (or from NBA API if none in DB).
- For each game, fetches box score from the NBA API and upserts into `nba_boxscores` (and creates/updates players in `nba_players` as needed).
- By default **skips** games that already have boxscores; use `--force` to re-import.
- Updates game scores/status in `nba_games` when boxscore is imported.

### Script 2 – Mark Games With Boxscores Final  
`scripts/setup/mark_games_with_boxscores_final.py`

- Finds all games in `nba_games` that have at least one row in `nba_boxscores`.
- Sets those games to **Final** (e.g. `game_status = 3` / status text “Final”) so the app treats them as completed.

### Script 3 – Import Player Props  
`scripts/import_player_props.py`

- Imports player props for **three days**: today, tomorrow, and the day after.
- Calls SportsGameOdds API for NBA events, groups by date, then for each of those three dates:
  - Inserts/updates `player_props_games` (one row per game/event).
  - Fetches and dedupes player props, matches players to `nba_players`, then inserts/updates `player_props`.
- Ensures props and games are in sync for the next few days (including after trade deadline).

### Script 4 – Import Game Odds  
`scripts/setup/import_game_odds.py`

- Targets **today’s** games in `nba_games`.
- Fetches odds from the NBA API (spreads, totals, moneylines).
- Writes them into `nba_games` (or the table your app uses for game odds).

### Script 5 – Import NBA Standings  
`scripts/setup/import_nba_standings.py`

- Fetches current **league standings** (e.g. from `stats.nba.com` leaguestandings) for the current season.
- Replaces (or upserts) standings in your standings table so win/loss, rank, etc. are up to date.

### Script 6 – Import NBA Leaders  
`scripts/setup/import_nba_leaders.py`

- Fetches **season leaders** (e.g. PPG, RPG, APG, etc.) from the NBA API.
- Stores/updates them in your DB for whatever table or feature uses “leaders” (e.g. Today page or leaders module).

### Script 7 – Import NBA Team Rosters  
`scripts/setup/import_nba_team_rosters.py`

- Determines **current season** (e.g. 2025-26).
- For each team in `nba_teams`, calls NBA API `CommonTeamRoster` and gets the current roster.
- Upserts into `nba_team_roster` (by team, season, player).
- Updates `nba_players` with current `team_id`, `team_abbreviation`, `team_name`, `team_city` for each player on a roster.
- **Sync step**: sets team for players on rosters and **clears** team for players not on any roster (free agents).  
  → This is the step that keeps rosters correct after trade deadline.

### Script 8 – Import Player Game Stats  
`scripts/feed/import_player_game_stats.py`

- Reads **JSON files** (e.g. in `scripts/feed/` or a configured path) that contain advanced or extra stats per player per game.
- Imports/updates those into your DB (e.g. `player_game_stats` or similar); typically **skips** games that already have stats unless you pass something like `--overwrite`.
- Can be slow if there are many files.

### After all 8 scripts

- **Summary** – Prints total scripts, how many succeeded, how many failed, and the names of any failed scripts.
- **Log reminder** – Tells you the full log path: `logs/daily_maintenance.log`.
- **Exit code** – Exits with `1` if any script failed, `0` if all succeeded (useful for cron or CI).

---

## One-line command for notes

```bash
cd /Volumes/OneTouch/hoopgeek/hoopgeek && bash scripts/setup/run_daily_maintenance.sh
```
