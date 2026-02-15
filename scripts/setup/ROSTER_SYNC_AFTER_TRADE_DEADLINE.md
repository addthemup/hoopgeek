# Roster sync after trade deadline

Use these scripts to get all players up to date with the rosters they are on **today** (e.g. after the trade deadline).

## Primary script (run this)

**`import_nba_team_rosters.py`**

- Fetches **current roster per team** from the NBA API (`CommonTeamRoster`) for the current season.
- Upserts into `nba_team_roster`.
- Updates `nba_players` with `team_id`, `team_abbreviation`, `team_name`, `team_city` for every player on a roster.
- After all teams are imported, **syncs player team assignments**: sets team for players on rosters and **clears team** for players not on any current roster (free agents / traded away).

**Run:**
```bash
cd /path/to/hoopgeek
python3 scripts/setup/import_nba_team_rosters.py
```

Or use the same env as daily maintenance (see `run_daily_maintenance.sh` for `SUPABASE_*` / `VITE_SUPABASE_*`).

---

## Optional: ensure all players exist first

**`import_nba_players_robust.py`**

- Fetches **all players** from the NBA API (`commonallplayers`) and upserts into `nba_players`.
- Use if you want to make sure new signings / two-ways are in the DB before assigning teams.
- Team info from this endpoint can lag; **team rosters** are the source of truth for “on which team today.”

**Run (optional, before team rosters if you like):**
```bash
python3 scripts/setup/import_nba_players_robust.py
```

---

## Optional: refresh detailed player info (including team)

**`import_comprehensive_player_data.py`**

- For **existing** `nba_players`, calls `CommonPlayerInfo` and updates fields including `team_id`, `team_name`, `team_abbreviation`, `roster_status`, `is_active`.
- Redundant for “who is on which team” if you already ran `import_nba_team_rosters.py`; use if you want the extra detail refreshed.

---

## Recommended order after trade deadline

1. **`import_nba_team_rosters.py`** — **required.** This is what gets everyone on the correct roster for today.
2. (Optional) **`import_nba_players_robust.py`** — only if you need to backfill new players first.
3. (Optional) **`import_comprehensive_player_data.py`** — only if you want comprehensive player/team detail refreshed.

Daily maintenance already runs **Import NBA Team Rosters** (step 7 in `run_daily_maintenance.sh`), so going forward a single run of that script (or the full maintenance) keeps rosters in sync.
