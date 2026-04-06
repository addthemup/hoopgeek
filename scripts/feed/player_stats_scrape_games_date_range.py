#!/usr/bin/env python3
"""
Scrape player stats (unified PlayerStats + AggregatedPlayerStats + AggregatedTeamStats) for a date range.
Writes player_stats/player_stats_{game_id}.json.
Uses all box score endpoints and aggregation from scrape_games_date_range.
"""

import argparse
import os
import re
import json
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime, timedelta
from pathlib import Path

FEED_DIR = Path(__file__).resolve().parent
PLAYER_STATS_DIR = FEED_DIR / "player_stats"
DISCOVER_DIR = FEED_DIR / "discover"
GAME_TIME_BUDGET_SEC = int(os.environ.get("FEED_GAME_TIME_BUDGET_SEC", "0"))  # 0 = no limit

try:
    from dotenv import load_dotenv
    project_root = FEED_DIR.parent.parent
    load_dotenv(project_root / ".env.local")
    load_dotenv(project_root / ".env")
except ImportError:
    pass
except Exception:
    pass

import sys
sys.path.insert(0, str(FEED_DIR))
import scrape_games_date_range as big
from feed_error_utils import log_http_error
from feed_skip_live import load_skip_live_game_ids


def validate_date(s):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        raise argparse.ArgumentTypeError("Date must be YYYY-MM-DD")
    datetime.strptime(s, "%Y-%m-%d")
    return s


def load_games_from_discover(date_str):
    path = DISCOVER_DIR / f"discover_{date_str}.json"
    if not path.exists():
        return None
    try:
        with open(path, "r") as f:
            data = json.load(f)
        games = data.get("games") or []
        return games if games else None
    except Exception:
        return None


def get_games_for_date(date_str):
    return big.get_games_for_date(date_str)


def get_unique_game_ids(df):
    return big.get_unique_game_ids(df)


def fetch_player_stats_for_game(game_id):
    """Fetch all box scores, aggregate, build unified PlayerStats. Returns dict or None."""
    try:
        box_traditional = big.get_boxscore_traditional(game_id)
        box_advanced = big.get_boxscore_advanced(game_id)
        box_four_factors = big.get_boxscore_four_factors(game_id)
        box_hustle = big.get_boxscore_hustle(game_id)
        box_misc = big.get_boxscore_misc(game_id)
        box_player_track = big.get_boxscore_player_track(game_id)
        box_scoring = big.get_boxscore_scoring(game_id)
        box_usage = big.get_boxscore_usage(game_id)
        box_matchups = big.get_boxscore_matchups(game_id)
        aggregated_players = big.aggregate_player_stats(
            box_traditional, box_advanced, box_four_factors,
            box_hustle, box_misc, box_player_track, box_scoring, box_usage,
        )
        aggregated_teams = big.aggregate_team_stats(
            box_traditional, box_advanced, box_four_factors,
            box_hustle, box_misc, box_player_track, box_scoring, box_usage,
        )
        unified = big.build_unified_player_stats(
            game_id,
            box_traditional, box_advanced, box_four_factors,
            box_hustle, box_misc, box_player_track, box_scoring, box_usage,
            box_matchups,
        )
        return {
            "gameId": game_id,
            "PlayerStats": unified,
            "AggregatedPlayerStats": aggregated_players,
            "AggregatedTeamStats": aggregated_teams,
        }
    except Exception as e:
        log_http_error(f"player_stats for game {game_id} (box scores + aggregation)", e)
        return None


def main():
    parser = argparse.ArgumentParser(description="Scrape player stats for date range")
    parser.add_argument("start_date", type=validate_date)
    parser.add_argument("end_date", type=validate_date)
    parser.add_argument("--max-retries", type=int, default=2)
    args = parser.parse_args()
    start = datetime.strptime(args.start_date, "%Y-%m-%d")
    end = datetime.strptime(args.end_date, "%Y-%m-%d")
    if start > end:
        print("Start must be <= end")
        return
    PLAYER_STATS_DIR.mkdir(parents=True, exist_ok=True)
    skip_live = load_skip_live_game_ids()
    if skip_live:
        print(f"Skipping {len(skip_live)} game(s) still live on scoreboard: {sorted(skip_live)}")
    total_days = (end - start).days + 1
    successful, skipped, failed_list = 0, 0, []
    current = start
    day_num = 0
    while current <= end:
        day_num += 1
        date_str = current.strftime("%Y-%m-%d")
        print(f"\n--- DAY {day_num}/{total_days}: {date_str} ---")
        try:
            df = None
            games = load_games_from_discover(date_str)
            if games is None:
                try:
                    df = get_games_for_date(date_str)
                    if df is None or df.empty:
                        if current < end:
                            time.sleep(300)
                        current += timedelta(days=1)
                        continue
                    games = get_unique_game_ids(df)
                except Exception as e:
                    log_http_error(f"player_stats date range day {day_num}/{total_days} ({date_str})", e)
                    games = load_games_from_discover(date_str)
                    if games is None:
                        print(f"  Skipping {date_str}: API failed and no discover file.")
                        current += timedelta(days=1)
                        continue
            else:
                print(f"  Using discover/discover_{date_str}.json ({len(games)} games)")
            if skip_live:
                games = sorted(games, key=lambda g: (g["game_id"] in skip_live, g["game_id"]))
            for idx, g in enumerate(games, 1):
                game_id, matchup = g["game_id"], g["matchup"]
                if game_id in skip_live:
                    print(f"[{idx}/{len(games)}] {game_id} — skip (still live)")
                    skipped += 1
                    if idx < len(games):
                        time.sleep(2)
                    continue
                out_file = PLAYER_STATS_DIR / f"player_stats_{game_id}.json"
                if out_file.exists():
                    print(f"[{idx}/{len(games)}] {game_id} — skip")
                    skipped += 1
                    if idx < len(games):
                        time.sleep(5)
                    continue
                print(f"[{idx}/{len(games)}] {game_id} {matchup}")
                if GAME_TIME_BUDGET_SEC > 0:
                    try:
                        with ThreadPoolExecutor(max_workers=1) as ex:
                            future = ex.submit(fetch_player_stats_for_game, game_id)
                            payload = future.result(timeout=GAME_TIME_BUDGET_SEC)
                    except (TimeoutError, FuturesTimeoutError):
                        print(f"  Time budget ({GAME_TIME_BUDGET_SEC}s) reached for {game_id}; skipping.")
                        payload = None
                else:
                    payload = fetch_player_stats_for_game(game_id)
                if payload and (payload.get("PlayerStats") or payload.get("AggregatedPlayerStats")):
                    with open(out_file, "w") as f:
                        json.dump(payload, f, indent=2)
                    successful += 1
                else:
                    failed_list.append(g)
                if idx < len(games):
                    time.sleep(300)
            if current < end:
                time.sleep(300)
        except Exception as e:
            log_http_error(f"player_stats date range day {day_num}/{total_days} ({date_str})", e)
            import traceback
            traceback.print_exc()
        current += timedelta(days=1)
    for _ in range(args.max_retries):
        if not failed_list:
            break
        print(f"\nRetry {len(failed_list)} games...")
        time.sleep(300)
        still = []
        for g in failed_list:
            game_id = g["game_id"]
            payload = fetch_player_stats_for_game(game_id)
            out_file = PLAYER_STATS_DIR / f"player_stats_{game_id}.json"
            if payload and (payload.get("PlayerStats") or payload.get("AggregatedPlayerStats")):
                with open(out_file, "w") as f:
                    json.dump(payload, f, indent=2)
                successful += 1
            else:
                still.append(g)
            time.sleep(300)
        failed_list = still
    print(f"\nDone. Successful: {successful}  Skipped: {skipped}  Failed: {len(failed_list)}")
    print(f"FEED_STEP_SUMMARY: player_stats | Successful: {successful}  Skipped: {skipped}  Failed: {len(failed_list)}")


if __name__ == "__main__":
    main()
