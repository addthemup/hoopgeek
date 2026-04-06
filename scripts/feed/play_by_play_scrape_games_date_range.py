#!/usr/bin/env python3
"""
Scrape play-by-play only (no video URLs) for NBA games in a date range.
Writes play_by_play/play_by_play_{game_id}.json with { "gameId", "playByPlay": { "allPlays": [...] } }.
"""

import nba_timeout_patch  # noqa: F401, E402
from nba_api.stats.endpoints.leaguegamefinder import LeagueGameFinder
from nba_api.stats.library.parameters import PlayerOrTeamAbbreviation, SeasonTypeNullable
from feed_error_utils import log_http_error, is_retryable_request_error
import argparse
import re
import json
import pandas as pd
import time
from datetime import datetime, timedelta
from pathlib import Path

FEED_DIR = Path(__file__).resolve().parent
PBP_DIR = FEED_DIR / "play_by_play"

try:
    from dotenv import load_dotenv
    project_root = FEED_DIR.parent.parent
    load_dotenv(project_root / ".env.local")
    load_dotenv(project_root / ".env")
except ImportError:
    pass
except Exception:
    pass


def validate_date(s):
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        raise argparse.ArgumentTypeError("Date must be YYYY-MM-DD")
    datetime.strptime(s, "%Y-%m-%d")
    return s


def filter_nba_games(df):
    if df is None or df.empty:
        return df
    nba_ids = set()
    for gid in df["GAME_ID"].unique():
        rows = df[df["GAME_ID"] == gid]
        ok = True
        for _, row in rows.iterrows():
            for col in ["TEAM_ID", "PLAYER1_TEAM_ID", "TEAM_ID_HOME", "TEAM_ID_AWAY"]:
                if col in row.index and pd.notna(row[col]):
                    try:
                        t = int(row[col])
                        if t < 1610000000 or t > 1610612800:
                            ok = False
                            break
                    except (ValueError, TypeError):
                        pass
            if not ok:
                break
        if ok or str(gid).startswith("002"):
            nba_ids.add(gid)
    return df[df["GAME_ID"].isin(nba_ids)]


def get_games_for_date(date_str, max_attempts=5, delay_seconds=300):
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            if attempt > 1:
                print(f"  Retry {attempt}/{max_attempts} for {date_str} (wait {delay_seconds}s)...")
            else:
                print(f"Querying games for {date_str}...")
            gf = LeagueGameFinder(
                player_or_team_abbreviation=PlayerOrTeamAbbreviation.team,
                season_nullable="2025-26",
                season_type_nullable=SeasonTypeNullable.regular,
                date_from_nullable=date_str,
                date_to_nullable=date_str,
                get_request=True,
            )
            df = gf.league_game_finder_results.get_data_frame()
            if df.empty:
                return None
            return filter_nba_games(df)
        except Exception as e:
            last_error = e
            log_http_error(f"discover games for {date_str} (LeagueGameFinder)", e)
            if attempt < max_attempts and is_retryable_request_error(e):
                time.sleep(delay_seconds)
                continue
            raise
    if last_error is not None:
        raise last_error
    return None


def get_unique_game_ids(df):
    if df is None or df.empty:
        return []
    out, seen = [], set()
    for _, row in df.iterrows():
        gid = row["GAME_ID"]
        if gid not in seen:
            seen.add(gid)
            out.append({"game_id": gid, "matchup": row["MATCHUP"], "date": str(row.get("GAME_DATE", "")).split(" ")[0] or ""})
    return out


def _safe(row, key, default=None):
    v = row.get(key, default)
    try:
        if pd.isna(v) or v == "":
            return default if default is not None else None
    except (TypeError, ValueError):
        pass
    return v if v is not None else default


def get_play_by_play(game_id):
    """Fetch PlayByPlayV3 only; return list of play objects (no mp4)."""
    from nba_api.stats.endpoints.playbyplayv3 import PlayByPlayV3
    try:
        print(f"  Fetching play-by-play for {game_id}...")
        pbp = PlayByPlayV3(game_id=game_id, get_request=True)
        time.sleep(1.0)
        if not pbp.play_by_play:
            return []
        df = pbp.play_by_play.get_data_frame()
        if df.empty:
            return []
        plays = []
        for _, row in df.iterrows():
            r = row.to_dict()
            play = {
                "gameId": game_id,
                "eventNum": _safe(r, "actionNumber"),
                "actionId": _safe(r, "actionId", 0) or 0,
                "period": _safe(r, "period", 1) or 1,
                "clock": _safe(r, "clock"),
                "description": _safe(r, "description", "") or "",
                "teamId": _safe(r, "teamId"),
                "teamTricode": _safe(r, "teamTricode"),
                "scoreHome": str(_safe(r, "scoreHome", "") or ""),
                "scoreAway": str(_safe(r, "scoreAway", "") or ""),
                "videoAvailable": _safe(r, "videoAvailable", 0) or 0,
                "actionType": _safe(r, "actionType"),
                "subType": _safe(r, "subType"),
                "shotResult": _safe(r, "shotResult"),
                "shotDistance": _safe(r, "shotDistance"),
                "isFieldGoal": _safe(r, "isFieldGoal", 0) or 0,
                "playerName": _safe(r, "playerName"),
                "playerNameI": _safe(r, "playerNameI"),
                "personId": _safe(r, "personId"),
                "xLegacy": _safe(r, "xLegacy"),
                "yLegacy": _safe(r, "yLegacy"),
                "location": _safe(r, "location"),
                "pointsTotal": _safe(r, "pointsTotal", 0) or 0,
                "mp4": None,
                "mp4_local": None,
            }
            plays.append(play)
        print(f"  ✓ {len(plays)} plays")
        return plays
    except Exception as e:
        print(f"  ✗ {e}")
        return []


def main():
    parser = argparse.ArgumentParser(description="Scrape play-by-play (no video) for date range")
    parser.add_argument("start_date", type=validate_date)
    parser.add_argument("end_date", type=validate_date)
    parser.add_argument("--max-retries", type=int, default=2)
    args = parser.parse_args()
    start = datetime.strptime(args.start_date, "%Y-%m-%d")
    end = datetime.strptime(args.end_date, "%Y-%m-%d")
    if start > end:
        print("Start must be <= end")
        return
    PBP_DIR.mkdir(parents=True, exist_ok=True)
    total_days = (end - start).days + 1
    successful, skipped, failed_list = 0, 0, []
    current = start
    day_num = 0
    while current <= end:
        day_num += 1
        date_str = current.strftime("%Y-%m-%d")
        print(f"\n--- DAY {day_num}/{total_days}: {date_str} ---")
        try:
            df = get_games_for_date(date_str)
            if df is None or df.empty:
                if current < end:
                    time.sleep(300)
                current += timedelta(days=1)
                continue
            games = get_unique_game_ids(df)
            for idx, g in enumerate(games, 1):
                game_id, matchup = g["game_id"], g["matchup"]
                out_file = PBP_DIR / f"play_by_play_{game_id}.json"
                if out_file.exists():
                    print(f"[{idx}/{len(games)}] {game_id} — skip")
                    skipped += 1
                    if idx < len(games):
                        time.sleep(5)
                    continue
                print(f"[{idx}/{len(games)}] {game_id} {matchup}")
                plays = get_play_by_play(game_id)
                payload = {"gameId": game_id, "playByPlay": {"allPlays": plays}}
                with open(out_file, "w") as f:
                    json.dump(payload, f, indent=2)
                successful += 1
                if len(plays) == 0:
                    failed_list.append(g)
                if idx < len(games):
                    time.sleep(300)
            if current < end:
                time.sleep(300)
        except Exception as e:
            print(f"Error: {e}")
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
            plays = get_play_by_play(game_id)
            out_file = PBP_DIR / f"play_by_play_{game_id}.json"
            with open(out_file, "w") as f:
                json.dump({"gameId": game_id, "playByPlay": {"allPlays": plays}}, f, indent=2)
            if len(plays) > 0:
                successful += 1
            else:
                still.append(g)
            time.sleep(300)
        failed_list = still
    print(f"\nDone. Successful: {successful}  Skipped: {skipped}  Failed: {len(failed_list)}")


if __name__ == "__main__":
    main()
