#!/usr/bin/env python3
"""
Backfill nba_totn (Team of the Night) for the 2025-26 season.

Replicates the exact same greedy algorithm used in the /today/ module:
  1. Fetch nba_boxscores for a game_date (min > 0)
  2. Join with nba_players (active) and nba_hoopshype_salaries
  3. Fantasy points = PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV
  4. Selection score = fantasy_points*0.8 + (points_per_dollar * 1_000_000 * 0.2)
  5. Greedy: sort by selection_score, pick up to 12 players under $208M cap
     - First pass: top players by score that fit
     - Second pass: fill remaining with best value players
  6. Top 5 = starters (s1-s5), next 7 = bench (b1-b7)

Writes one denormalized row per game_date into nba_totn.

Usage:
    python3 scripts/setup/backfill_nba_totn.py --dry-run          # preview
    python3 scripts/setup/backfill_nba_totn.py --date 2026-02-08  # single date
    python3 scripts/setup/backfill_nba_totn.py                    # full backfill

Requires: supabase (pip install supabase)
"""

import os
import sys
import argparse
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ supabase not installed. pip install supabase")
    sys.exit(1)
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = lambda: None

DEFAULT_SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

# Same constants as the /today/ module
SALARY_CAP = 208_000_000
DEFAULT_SALARY = 1_157_153  # League minimum
MAX_PLAYERS = 12

SEASON_START = date(2025, 10, 21)
SEASON_END = date(2026, 2, 9)


def setup_supabase(verbose: bool = False) -> Client:
    if load_dotenv:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
        for p in [os.path.join(repo_root, ".env"), ".env", os.path.join(os.getcwd(), ".env")]:
            if os.path.isfile(p):
                load_dotenv(p)
                if verbose:
                    print(f"Loaded .env from {os.path.abspath(p)}")
                break
        else:
            if verbose:
                print("No .env found; using existing env vars")
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL") or DEFAULT_SUPABASE_URL
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or DEFAULT_SUPABASE_SERVICE_ROLE_KEY
    if not url or not key:
        print("❌ Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    return create_client(url, key)


def load_players(supabase: Client) -> Dict[int, Dict]:
    """Load all active nba_players keyed by nba_player_id."""
    players = {}
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("nba_players")
            .select("id, nba_player_id, name, team_abbreviation, position, jersey_number")
            .eq("is_active", True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not r.data:
            break
        for row in r.data:
            nba_id = row.get("nba_player_id")
            if nba_id:
                players[nba_id] = row
        offset += page_size
        if len(r.data) < page_size:
            break
    return players


def load_salaries(supabase: Client) -> Dict[str, int]:
    """Load salaries keyed by player UUID."""
    salaries = {}
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("nba_hoopshype_salaries")
            .select("player_id, salary_2025_26")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not r.data:
            break
        for row in r.data:
            pid = row.get("player_id")
            sal = row.get("salary_2025_26")
            if pid and sal:
                salaries[pid] = int(sal)
        offset += page_size
        if len(r.data) < page_size:
            break
    return salaries


def load_boxscores_for_date(supabase: Client, game_date: str) -> List[Dict]:
    """Load all boxscores for a single game_date where min > 0."""
    rows = []
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("nba_boxscores")
            .select("nba_player_id, pts, reb, ast, stl, blk, tov, min")
            .eq("game_date", game_date)
            .gt("min", 0)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not r.data:
            break
        rows.extend(r.data)
        offset += page_size
        if len(r.data) < page_size:
            break
    return rows


def compute_totn_for_date(
    boxscores: List[Dict],
    players: Dict[int, Dict],
    salaries: Dict[str, int],
) -> Optional[Dict]:
    """
    Replicate the /today/ greedy algorithm for a single night.
    Returns a dict ready for nba_totn upsert, or None if no valid lineup.
    """
    # Step 1: Calculate fantasy points & selection score for every player
    performances = []
    for box in boxscores:
        nba_id = box.get("nba_player_id")
        player = players.get(nba_id)
        if not player:
            continue

        player_uuid = player["id"]
        salary = salaries.get(player_uuid, DEFAULT_SALARY)
        if salary <= 0:
            continue

        fp = (
            (box.get("pts") or 0)
            + (box.get("reb") or 0) * 1.2
            + (box.get("ast") or 0) * 1.5
            + (box.get("stl") or 0) * 3
            + (box.get("blk") or 0) * 3
            - (box.get("tov") or 0)
        )

        ppd = fp / salary if salary > 0 else 0
        score = (fp * 0.8) + (ppd * 1_000_000 * 0.2)

        performances.append({
            "player_uuid": player_uuid,
            "fantasy_points": round(fp, 1),
            "salary": salary,
            "points_per_dollar": ppd,
            "selection_score": score,
        })

    if not performances:
        return None

    # Step 2: Greedy selection -- exact same logic as Today.tsx
    performances.sort(key=lambda p: p["selection_score"], reverse=True)

    lineup = []
    used_salary = 0
    used_ids = set()

    # First pass: top by selection_score
    for p in performances:
        if len(lineup) >= MAX_PLAYERS:
            break
        if used_salary + p["salary"] <= SALARY_CAP:
            lineup.append(p)
            used_salary += p["salary"]
            used_ids.add(p["player_uuid"])

    # Second pass: fill remaining with best value (still cap-constrained)
    if len(lineup) < MAX_PLAYERS:
        remaining_cap = SALARY_CAP - used_salary
        value_sorted = sorted(
            [p for p in performances if p["player_uuid"] not in used_ids and p["salary"] <= remaining_cap],
            key=lambda p: p["points_per_dollar"],
            reverse=True,
        )
        for p in value_sorted:
            if len(lineup) >= MAX_PLAYERS:
                break
            if used_salary + p["salary"] <= SALARY_CAP:
                lineup.append(p)
                used_salary += p["salary"]
                used_ids.add(p["player_uuid"])

    # Third pass: GUARANTEE all 12 slots filled — ignore salary cap
    if len(lineup) < MAX_PLAYERS:
        overflow = sorted(
            [p for p in performances if p["player_uuid"] not in used_ids],
            key=lambda p: p["fantasy_points"],
            reverse=True,
        )
        for p in overflow:
            if len(lineup) >= MAX_PLAYERS:
                break
            lineup.append(p)
            used_salary += p["salary"]
            used_ids.add(p["player_uuid"])

    if not lineup:
        return None

    # Step 3: Build the single-row dict
    row = {
        "salary_cap": SALARY_CAP,
        "total_salary": used_salary,
        "total_fantasy_points": round(sum(p["fantasy_points"] for p in lineup), 1),
    }

    # Starters = first 5, bench = next 7
    starter_prefixes = ["s1", "s2", "s3", "s4", "s5"]
    bench_prefixes = ["b1", "b2", "b3", "b4", "b5", "b6", "b7"]

    for i, prefix in enumerate(starter_prefixes):
        if i < len(lineup):
            row[f"{prefix}_player_id"] = lineup[i]["player_uuid"]
            row[f"{prefix}_fantasy_points"] = lineup[i]["fantasy_points"]
            row[f"{prefix}_salary"] = lineup[i]["salary"]
        else:
            row[f"{prefix}_player_id"] = None
            row[f"{prefix}_fantasy_points"] = None
            row[f"{prefix}_salary"] = None

    for i, prefix in enumerate(bench_prefixes):
        idx = 5 + i
        if idx < len(lineup):
            row[f"{prefix}_player_id"] = lineup[idx]["player_uuid"]
            row[f"{prefix}_fantasy_points"] = lineup[idx]["fantasy_points"]
            row[f"{prefix}_salary"] = lineup[idx]["salary"]
        else:
            row[f"{prefix}_player_id"] = None
            row[f"{prefix}_fantasy_points"] = None
            row[f"{prefix}_salary"] = None

    return row


def get_dates_with_games(supabase: Client, start: str, end: str) -> List[str]:
    """Get distinct game_dates that have boxscores in range."""
    # Supabase doesn't support DISTINCT easily, so fetch game_dates and dedupe
    dates = set()
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("nba_boxscores")
            .select("game_date")
            .gte("game_date", start)
            .lte("game_date", end)
            .gt("min", 0)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not r.data:
            break
        for row in r.data:
            dates.add(row["game_date"])
        offset += page_size
        if len(r.data) < page_size:
            break
    return sorted(dates)


def run(
    single_date: Optional[str] = None,
    dry_run: bool = False,
    verbose: bool = False,
):
    supabase = setup_supabase(verbose=verbose)

    # Pre-load players & salaries (constant across all dates)
    if verbose:
        print("Loading players...")
    players = load_players(supabase)
    if verbose:
        print(f"  {len(players)} active players loaded")

    if verbose:
        print("Loading salaries...")
    salaries = load_salaries(supabase)
    if verbose:
        print(f"  {len(salaries)} salary records loaded")

    # Determine dates to process
    if single_date:
        game_dates = [single_date]
    else:
        if verbose:
            print(f"Finding game dates from {SEASON_START} to {SEASON_END}...")
        game_dates = get_dates_with_games(
            supabase, SEASON_START.isoformat(), SEASON_END.isoformat()
        )
        if verbose:
            print(f"  {len(game_dates)} dates with boxscores")

    upserted = 0
    skipped = 0

    for i, gd in enumerate(game_dates):
        if verbose and i % 20 == 0:
            print(f"  Processing {i+1}/{len(game_dates)}: {gd}")

        boxscores = load_boxscores_for_date(supabase, gd)
        if not boxscores:
            if verbose:
                print(f"    {gd}: no boxscores, skipping")
            skipped += 1
            continue

        totn_row = compute_totn_for_date(boxscores, players, salaries)
        if not totn_row:
            if verbose:
                print(f"    {gd}: no valid lineup, skipping")
            skipped += 1
            continue

        totn_row["game_date"] = gd
        totn_row["updated_at"] = datetime.utcnow().isoformat()

        if dry_run:
            s1_id = totn_row.get("s1_player_id", "?")[:8] if totn_row.get("s1_player_id") else "?"
            print(
                f"  [DRY] {gd}: {totn_row['total_fantasy_points']:.1f} FP, "
                f"${totn_row['total_salary']:,} salary, "
                f"s1={s1_id}..."
            )
            upserted += 1
            continue

        try:
            r = (
                supabase.table("nba_totn")
                .upsert(totn_row, on_conflict="game_date")
                .execute()
            )
            if r.data:
                upserted += 1
        except Exception as err:
            print(f"  ❌ Error upserting {gd}: {err}")

    return upserted, skipped, len(game_dates)


def main():
    ap = argparse.ArgumentParser(
        description="Backfill nba_totn (Team of the Night) for 2025-26 season"
    )
    ap.add_argument("--date", default=None, help="Single date to process (YYYY-MM-DD)")
    ap.add_argument("--dry-run", action="store_true", help="Preview only, do not write")
    ap.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = ap.parse_args()

    upserted, skipped, total = run(
        single_date=args.date,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )

    print(f"✅ Done: {upserted} dates upserted, {skipped} skipped, {total} total")
    if args.dry_run:
        print("Re-run without --dry-run to write to the database.")


if __name__ == "__main__":
    main()
