#!/usr/bin/env python3
"""
Backfill nba_totw (Team of the Week) for the 2025-26 season.

Same algorithm as nba_totn, applied to a week of boxscores:
  1. For each week (from nba_season_weeks), fetch all boxscores in [start, end]
  2. Fantasy points = PTS + REB*1.2 + AST*1.5 + STL*3 + BLK*3 - TOV  (same as TOTN)
  3. CUMULATIVE FP per player across the week (sum of all games)
  4. Selection score from cumulative: cumFP*0.8 + (cumFP/salary * 1M * 0.2)
     → This naturally rewards players who played more games over one-game wonders.
  5. Greedy pick under $208M salary cap (same as TOTN)
  6. STORED value = average FP per game (cumulative / games_played)
  7. Top 5 = starters, next 7 = bench

Usage:
    python3 scripts/setup/backfill_nba_totw.py --dry-run              # preview
    python3 scripts/setup/backfill_nba_totw.py --week-start 2026-02-02 # single week
    python3 scripts/setup/backfill_nba_totw.py                        # full backfill

Requires: supabase (pip install supabase)
"""

import os
import sys
import argparse
from collections import defaultdict
from datetime import datetime
from typing import List, Dict, Optional

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

# Same constants as TOTN / the /today/ module
SALARY_CAP = 208_000_000
DEFAULT_SALARY = 1_157_153  # League minimum
MAX_PLAYERS = 12


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


def load_weeks(supabase: Client) -> List[Dict]:
    """Load all nba_season_weeks for 2025-26 season (season_year=2026), weeks >= 1."""
    r = (
        supabase.table("nba_season_weeks")
        .select("week_number, start_date, end_date, season_year")
        .eq("season_year", 2026)
        .gte("week_number", 1)
        .order("start_date")
        .execute()
    )
    return r.data or []


def load_boxscores_for_range(supabase: Client, start_date: str, end_date: str) -> List[Dict]:
    """Load all boxscores for a date range where min > 0."""
    rows = []
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("nba_boxscores")
            .select("nba_player_id, pts, reb, ast, stl, blk, tov, min")
            .gte("game_date", start_date)
            .lte("game_date", end_date)
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


def compute_totw_for_week(
    boxscores: List[Dict],
    players: Dict[int, Dict],
    salaries: Dict[str, int],
) -> Optional[Dict]:
    """
    Same greedy algorithm as TOTN, but over a week of boxscores.
    - SELECT by cumulative FP (rewards players who played more games)
    - STORE average FP per game (normalised display value)
    """
    # Step 1: Accumulate per-player cumulative fantasy points
    # {nba_player_id: {"cum_fp": float, "games": int}}
    accum: Dict[int, Dict] = defaultdict(lambda: {"cum_fp": 0.0, "games": 0})

    for box in boxscores:
        nba_id = box.get("nba_player_id")
        if not nba_id:
            continue

        # Same formula as TOTN: STL*3, BLK*3
        fp = (
            (box.get("pts") or 0)
            + (box.get("reb") or 0) * 1.2
            + (box.get("ast") or 0) * 1.5
            + (box.get("stl") or 0) * 3
            + (box.get("blk") or 0) * 3
            - (box.get("tov") or 0)
        )

        accum[nba_id]["cum_fp"] += fp
        accum[nba_id]["games"] += 1

    if not accum:
        return None

    # Step 2: Build performance list with cumulative-based selection score
    performances = []
    for nba_id, stats in accum.items():
        player = players.get(nba_id)
        if not player:
            continue

        player_uuid = player["id"]
        salary = salaries.get(player_uuid, DEFAULT_SALARY)
        if salary <= 0:
            continue

        cum_fp = stats["cum_fp"]
        games = stats["games"]
        avg_fp = cum_fp / games

        # Selection score uses CUMULATIVE FP (same formula shape as TOTN)
        ppd = cum_fp / salary if salary > 0 else 0
        score = (cum_fp * 0.8) + (ppd * 1_000_000 * 0.2)

        performances.append({
            "player_uuid": player_uuid,
            "cum_fp": round(cum_fp, 1),
            "avg_fp": round(avg_fp, 1),
            "games_played": games,
            "salary": salary,
            "points_per_dollar": ppd,
            "selection_score": score,
        })

    if not performances:
        return None

    # Step 3: Greedy selection under $208M cap (identical to TOTN)
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
            key=lambda p: p["cum_fp"],
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

    # Step 4: Build single-row dict — DISPLAY average FP, not cumulative
    row = {
        "salary_cap": SALARY_CAP,
        "total_salary": used_salary,
        "total_avg_fantasy_points": round(sum(p["avg_fp"] for p in lineup), 1),
    }

    starter_prefixes = ["s1", "s2", "s3", "s4", "s5"]
    bench_prefixes = ["b1", "b2", "b3", "b4", "b5", "b6", "b7"]

    for i, prefix in enumerate(starter_prefixes):
        if i < len(lineup):
            row[f"{prefix}_player_id"] = lineup[i]["player_uuid"]
            row[f"{prefix}_avg_fantasy_points"] = lineup[i]["avg_fp"]
            row[f"{prefix}_salary"] = lineup[i]["salary"]
            row[f"{prefix}_games_played"] = lineup[i]["games_played"]
        else:
            row[f"{prefix}_player_id"] = None
            row[f"{prefix}_avg_fantasy_points"] = None
            row[f"{prefix}_salary"] = None
            row[f"{prefix}_games_played"] = None

    for i, prefix in enumerate(bench_prefixes):
        idx = 5 + i
        if idx < len(lineup):
            row[f"{prefix}_player_id"] = lineup[idx]["player_uuid"]
            row[f"{prefix}_avg_fantasy_points"] = lineup[idx]["avg_fp"]
            row[f"{prefix}_salary"] = lineup[idx]["salary"]
            row[f"{prefix}_games_played"] = lineup[idx]["games_played"]
        else:
            row[f"{prefix}_player_id"] = None
            row[f"{prefix}_avg_fantasy_points"] = None
            row[f"{prefix}_salary"] = None
            row[f"{prefix}_games_played"] = None

    return row


def run(
    single_week_start: Optional[str] = None,
    dry_run: bool = False,
    verbose: bool = False,
):
    supabase = setup_supabase(verbose=verbose)

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

    if verbose:
        print("Loading week schedule...")
    all_weeks = load_weeks(supabase)
    if verbose:
        print(f"  {len(all_weeks)} weeks loaded")

    if single_week_start:
        all_weeks = [w for w in all_weeks if w["start_date"] == single_week_start]
        if not all_weeks:
            print(f"❌ No week found starting {single_week_start}")
            return 0, 0, 0

    # Only process completed weeks (end_date < today)
    today = datetime.utcnow().date().isoformat()
    if not single_week_start:
        all_weeks = [w for w in all_weeks if w["end_date"] < today]
        if verbose:
            print(f"  {len(all_weeks)} completed weeks to process")

    upserted = 0
    skipped = 0

    for i, week in enumerate(all_weeks):
        ws = week["start_date"]
        we = week["end_date"]
        wn = week["week_number"]
        sy = week["season_year"]

        if verbose and i % 5 == 0:
            print(f"  Processing {i+1}/{len(all_weeks)}: week {wn} ({ws} to {we})")

        boxscores = load_boxscores_for_range(supabase, ws, we)
        if not boxscores:
            if verbose:
                print(f"    week {wn}: no boxscores, skipping")
            skipped += 1
            continue

        totw_row = compute_totw_for_week(boxscores, players, salaries)
        if not totw_row:
            if verbose:
                print(f"    week {wn}: no valid lineup, skipping")
            skipped += 1
            continue

        totw_row["week_start"] = ws
        totw_row["week_end"] = we
        totw_row["week_number"] = wn
        totw_row["season_year"] = sy
        totw_row["updated_at"] = datetime.utcnow().isoformat()

        if dry_run:
            s1_avg = totw_row.get("s1_avg_fantasy_points", 0) or 0
            s1_gp = totw_row.get("s1_games_played", 0) or 0
            print(
                f"  [DRY] week {wn} ({ws} to {we}): "
                f"total_avg={totw_row['total_avg_fantasy_points']} FP, "
                f"${totw_row['total_salary']:,} salary, "
                f"s1={s1_avg:.1f} avg ({s1_gp}gp)"
            )
            upserted += 1
            continue

        try:
            r = (
                supabase.table("nba_totw")
                .upsert(totw_row, on_conflict="week_start,week_end")
                .execute()
            )
            if r.data:
                upserted += 1
        except Exception as err:
            print(f"  ❌ Error upserting week {wn}: {err}")

    return upserted, skipped, len(all_weeks)


def main():
    ap = argparse.ArgumentParser(
        description="Backfill nba_totw (Team of the Week) for 2025-26 season"
    )
    ap.add_argument("--week-start", default=None, help="Single week start_date (YYYY-MM-DD)")
    ap.add_argument("--dry-run", action="store_true", help="Preview only, do not write")
    ap.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = ap.parse_args()

    upserted, skipped, total = run(
        single_week_start=args.week_start,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )

    print(f"✅ Done: {upserted} weeks upserted, {skipped} skipped, {total} total")
    if args.dry_run:
        print("Re-run without --dry-run to write to the database.")


if __name__ == "__main__":
    main()
