#!/usr/bin/env python3
"""
Discover NBA games for a date range and write one JSON per day to discover/.

Uses LeagueGameFinder; filters out G League. Output: discover/discover_YYYY-MM-DD.json
with { "date": "YYYY-MM-DD", "games": [ { "game_id", "matchup", "date" } ] }.

Usage:
  python3 discover_games_date_range.py 2026-02-19 2026-02-24
"""

# Use longer NBA API timeout (see nba_timeout_patch; default 180s) and retries
import nba_timeout_patch  # noqa: F401, E402

from nba_api.stats.endpoints.leaguegamefinder import LeagueGameFinder
from nba_api.stats.library.parameters import PlayerOrTeamAbbreviation, SeasonTypeNullable
import argparse
import re
import json
import pandas as pd
import time
from datetime import datetime, timedelta
from pathlib import Path

from feed_error_utils import log_http_error, is_retryable_request_error
from nba_direct_fallback import fetch_leaguegamefinder_direct

FEED_DIR = Path(__file__).resolve().parent
DISCOVER_DIR = FEED_DIR / "discover"

try:
    from dotenv import load_dotenv
    project_root = FEED_DIR.parent.parent
    load_dotenv(project_root / ".env.local")
    load_dotenv(project_root / ".env")
except ImportError:
    pass
except Exception:
    pass


def validate_date(date_string):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_string):
        raise argparse.ArgumentTypeError("Date must be YYYY-MM-DD")
    datetime.strptime(date_string, "%Y-%m-%d")
    return date_string


def filter_nba_games(df):
    if df is None or df.empty:
        return df
    nba_game_ids = set()
    for game_id in df["GAME_ID"].unique():
        game_rows = df[df["GAME_ID"] == game_id]
        is_nba = True
        team_ids_found = set()
        for _, row in game_rows.iterrows():
            for col in ["TEAM_ID", "PLAYER1_TEAM_ID", "TEAM_ID_HOME", "TEAM_ID_AWAY"]:
                if col in row.index and pd.notna(row[col]):
                    try:
                        tid = int(row[col])
                        team_ids_found.add(tid)
                        if tid < 1610000000 or tid > 1610612800:
                            is_nba = False
                            break
                    except (ValueError, TypeError):
                        pass
            if not is_nba:
                break
        if team_ids_found and is_nba:
            nba_game_ids.add(game_id)
        elif not team_ids_found and str(game_id).startswith("002"):
            nba_game_ids.add(game_id)
    return df[df["GAME_ID"].isin(nba_game_ids)]


def get_games_for_date(game_date, max_attempts=5, delay_seconds=300):
    """Fetch games for a date; retry on timeout/connection errors. Lax: 5 min wait between retries."""
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            if attempt > 1:
                print(f"  Retry {attempt}/{max_attempts} for {game_date} (wait {delay_seconds}s)...")
            else:
                print(f"Querying games for {game_date}...")
            game_finder = LeagueGameFinder(
                player_or_team_abbreviation=PlayerOrTeamAbbreviation.team,
                season_nullable="2025-26",
                season_type_nullable=SeasonTypeNullable.regular,
                date_from_nullable=game_date,
                date_to_nullable=game_date,
                get_request=True,
            )
            df = game_finder.league_game_finder_results.get_data_frame()
            if df.empty:
                print(f"  No games for {game_date}")
                return None
            df = filter_nba_games(df)
            if df.empty:
                return None
            return df
        except Exception as e:
            last_error = e
            log_http_error(f"discover games for {game_date} (LeagueGameFinder)", e)
            if attempt < max_attempts and is_retryable_request_error(e):
                time.sleep(delay_seconds)
                continue
            break
    # Direct request fallback (same headers as standings/boxscores)
    if last_error is not None:
        print(f"  Trying direct request for {game_date}...")
        try:
            df_direct = fetch_leaguegamefinder_direct(game_date)
            if df_direct is not None and not df_direct.empty:
                df_direct = filter_nba_games(df_direct)
                if not df_direct.empty:
                    print(f"  ✓ Got {len(df_direct['GAME_ID'].unique())} games via direct request")
                    return df_direct
        except Exception as fallback_err:
            log_http_error(f"direct leaguegamefinder for {game_date}", fallback_err)
        raise last_error
    return None


def get_unique_games(df):
    if df is None or df.empty:
        return []
    out = []
    seen = set()
    for _, row in df.iterrows():
        gid = row["GAME_ID"]
        if gid not in seen:
            seen.add(gid)
            out.append({
                "game_id": gid,
                "matchup": row["MATCHUP"],
                "date": str(row["GAME_DATE"]).split(" ")[0] if pd.notna(row.get("GAME_DATE")) else "",
            })
    return out


def main():
    parser = argparse.ArgumentParser(description="Discover NBA games for a date range")
    parser.add_argument("start_date", type=validate_date, help="Start YYYY-MM-DD")
    parser.add_argument("end_date", type=validate_date, help="End YYYY-MM-DD")
    args = parser.parse_args()
    start = datetime.strptime(args.start_date, "%Y-%m-%d")
    end = datetime.strptime(args.end_date, "%Y-%m-%d")
    if start > end:
        print("Start must be <= end")
        return
    DISCOVER_DIR.mkdir(parents=True, exist_ok=True)
    current = start
    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        out_file = DISCOVER_DIR / f"discover_{date_str}.json"
        if out_file.exists():
            print(f"Skip {date_str} (exists)")
            current += timedelta(days=1)
            continue
        df = get_games_for_date(date_str)
        if df is None or df.empty:
            current += timedelta(days=1)
            continue
        games = get_unique_games(df)
        payload = {"date": date_str, "games": games}
        with open(out_file, "w") as f:
            json.dump(payload, f, indent=2)
        print(f"  Wrote discover_{date_str}.json ({len(games)} games)")
        current += timedelta(days=1)
        time.sleep(1.0)
    print("Done.")
    print(f"FEED_STEP_SUMMARY: discover | Done. Date range: {args.start_date} to {args.end_date}")


if __name__ == "__main__":
    main()
