#!/usr/bin/env python3
"""
Scrape shot chart data for a date range. Writes shot_charts/shot_charts_{game_id}.json.
Uses get_boxscore_traditional (for player IDs by team) and get_shot_chart_data from scrape_games_date_range.
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
SHOT_CHARTS_DIR = FEED_DIR / "shot_charts"
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


def _player_ids_by_team_from_traditional(box_traditional):
    """Build { team_id: [player_id, ...] } from BoxScoreTraditionalV3 PlayerStats."""
    out = {}
    for row in (box_traditional.get("PlayerStats") or []):
        team_id = row.get("teamId")
        person_id = row.get("personId")
        if not team_id or not person_id:
            continue
        tid = int(team_id)
        pid = int(person_id)
        if tid not in out:
            out[tid] = []
        if pid not in out[tid]:
            out[tid].append(pid)
    return out


def fetch_shot_charts_for_game(game_id):
    """Fetch shot chart for all players in game. Returns { "gameId", "shotChartData" } or None."""
    try:
        box_traditional = big.get_boxscore_traditional(game_id)
        player_ids_by_team = _player_ids_by_team_from_traditional(box_traditional)
        if not player_ids_by_team:
            print("  No player IDs from box score")
            return {"gameId": game_id, "shotChartData": {}}
        shot_chart_data = big.get_shot_chart_data(game_id, player_ids_by_team)
        return {"gameId": game_id, "shotChartData": shot_chart_data or {}}
    except Exception as e:
        log_http_error(f"shot_charts for game {game_id} (box traditional + ShotChartDetail)", e)
        return None


def main():
    parser = argparse.ArgumentParser(description="Scrape shot charts for date range")
    parser.add_argument("start_date", type=validate_date)
    parser.add_argument("end_date", type=validate_date)
    parser.add_argument("--max-retries", type=int, default=2)
    args = parser.parse_args()
    start = datetime.strptime(args.start_date, "%Y-%m-%d")
    end = datetime.strptime(args.end_date, "%Y-%m-%d")
    if start > end:
        print("Start must be <= end")
        return
    SHOT_CHARTS_DIR.mkdir(parents=True, exist_ok=True)
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
                    log_http_error(f"shot_charts date range day {day_num}/{total_days} ({date_str})", e)
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
                out_file = SHOT_CHARTS_DIR / f"shot_charts_{game_id}.json"
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
                            future = ex.submit(fetch_shot_charts_for_game, game_id)
                            payload = future.result(timeout=GAME_TIME_BUDGET_SEC)
                    except (TimeoutError, FuturesTimeoutError):
                        print(f"  Time budget ({GAME_TIME_BUDGET_SEC}s) reached for {game_id}; skipping.")
                        payload = None
                else:
                    payload = fetch_shot_charts_for_game(game_id)
                if payload is not None:
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
            log_http_error(f"shot_charts date range day {day_num}/{total_days} ({date_str})", e)
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
            payload = fetch_shot_charts_for_game(game_id)
            out_file = SHOT_CHARTS_DIR / f"shot_charts_{game_id}.json"
            if payload is not None:
                with open(out_file, "w") as f:
                    json.dump(payload, f, indent=2)
                successful += 1
            else:
                still.append(g)
            time.sleep(300)
        failed_list = still
    print(f"\nDone. Successful: {successful}  Skipped: {skipped}  Failed: {len(failed_list)}")
    print(f"FEED_STEP_SUMMARY: shot_charts | Successful: {successful}  Skipped: {skipped}  Failed: {len(failed_list)}")


if __name__ == "__main__":
    main()
