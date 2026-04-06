#!/usr/bin/env python3
"""
Audit: Compare Supabase nba_games (completed) vs local feed files.

For a date range, reports:
- How many games in nba_games (game_status=3) in that range
- How many have a matching play_by_play JSON
- How many of those have more than MIN_VIDEOS (default 200) in the videos array

Usage:
  python3 audit_feed_vs_nba_games.py 2026-02-19 2026-03-04
  python3 audit_feed_vs_nba_games.py   # defaults to 2026-02-19 2026-03-04
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional

FEED_DIR = Path(__file__).resolve().parent
PLAY_BY_PLAY_DIR = FEED_DIR / "play_by_play"
MIN_VIDEOS_DEFAULT = 200

try:
    from dotenv import load_dotenv
    project_root = FEED_DIR.parent.parent
    load_dotenv(project_root / ".env.local")
    load_dotenv(project_root / ".env")
except ImportError:
    pass
except Exception:
    pass


def get_supabase():
    url = os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    from supabase import create_client
    return create_client(url, key)


def parse_game_date(val):
    """Return YYYY-MM-DD from DB game_date (string or timestamp)."""
    if val is None:
        return None
    s = str(val)
    if "T" in s:
        s = s.split("T")[0]
    if len(s) >= 10:
        return s[:10]
    return s


def get_completed_games_in_range(supabase, start_date: str, end_date: str):
    """
    Fetch nba_games where game_status = 3 (final) and game_date in [start_date, end_date].
    Returns list of dicts with at least game_id, game_date (parsed), home/away tricode.
    """
    # Supabase: game_date may be timestamptz or date; filter by range
    try:
        # Include end_date full day: end_date 23:59:59
        r = (
            supabase.table("nba_games")
            .select("game_id, game_date, home_team_tricode, away_team_tricode, game_status")
            .eq("game_status", 3)
            .gte("game_date", f"{start_date}T00:00:00")
            .lte("game_date", f"{end_date}T23:59:59")
            .order("game_date")
            .execute()
        )
    except Exception as e:
        # Some schemas use date type without time
        try:
            r = (
                supabase.table("nba_games")
                .select("game_id, game_date, home_team_tricode, away_team_tricode, game_status")
                .eq("game_status", 3)
                .gte("game_date", start_date)
                .lte("game_date", end_date)
                .order("game_date")
                .execute()
            )
        except Exception as e2:
            print(f"Query error: {e}")
            print(f"Fallback error: {e2}")
            return []
    rows = r.data or []
    out = []
    for row in rows:
        gid = row.get("game_id")
        if not gid:
            continue
        date_parsed = parse_game_date(row.get("game_date"))
        out.append({
            "game_id": str(gid),
            "game_date": date_parsed,
            "home_team_tricode": row.get("home_team_tricode"),
            "away_team_tricode": row.get("away_team_tricode"),
        })
    return out


def count_videos_in_pbp_json(path: Path) -> Optional[int]:
    """Return len(videos) if file exists and is valid JSON with 'videos' key; else None."""
    if not path.exists():
        return None
    try:
        with open(path, "r") as f:
            data = json.load(f)
        videos = data.get("videos") or (data.get("playByPlay") or {}).get("allPlays") or []
        return len(videos)
    except Exception:
        return None


def run_audit(start_date: str, end_date: str, min_videos: int = MIN_VIDEOS_DEFAULT, quiet: bool = False):
    supabase = get_supabase()
    games = get_completed_games_in_range(supabase, start_date, end_date)
    total = len(games)

    has_pbp = 0
    has_min_videos = 0
    by_count = []

    for g in games:
        gid = g["game_id"]
        path = PLAY_BY_PLAY_DIR / f"play_by_play_{gid}.json"
        n = count_videos_in_pbp_json(path)
        if n is not None:
            has_pbp += 1
            if n > min_videos:
                has_min_videos += 1
            by_count.append((gid, g.get("game_date"), g.get("away_team_tricode"), g.get("home_team_tricode"), n))
        else:
            by_count.append((gid, g.get("game_date"), g.get("away_team_tricode"), g.get("home_team_tricode"), None))

    incomplete = total - has_min_videos

    if quiet:
        print(f"TOTAL={total} COMPLETE={has_min_videos} INCOMPLETE={incomplete}")
        return {"total": total, "has_pbp": has_pbp, "has_min_videos": has_min_videos, "incomplete": incomplete}

    # Report
    print(f"\n{'='*60}")
    print(f"Feed vs nba_games audit: {start_date} → {end_date}")
    print(f"Threshold: > {min_videos} videos in play_by_play JSON = 'complete'")
    print(f"{'='*60}")
    print(f"Completed games in nba_games (game_status=3):  {total}")
    print(f"With matching play_by_play JSON file:          {has_pbp}")
    print(f"With > {min_videos} videos (mp4s):             {has_min_videos}")
    print(f"Missing or incomplete:                        {incomplete}")
    print(f"{'='*60}\n")

    # List games with no file or low count
    missing_or_incomplete = [(gid, date, away, home, n) for gid, date, away, home, n in by_count if n is None or n <= min_videos]
    if missing_or_incomplete:
        print("Game IDs missing or incomplete (need (re)scrape):")
        for gid, date, away, home, n in sorted(missing_or_incomplete, key=lambda x: (x[1] or "", x[0])):
            n_str = str(n) if n is not None else "no file"
            print(f"  {gid}  {date}  {away or '?'} @ {home or '?'}  videos={n_str}")
        print()

    # Optional: full table
    print("All games in range (game_id, date, matchup, video_count):")
    for gid, date, away, home, n in sorted(by_count, key=lambda x: (x[1] or "", x[0])):
        n_str = str(n) if n is not None else "—"
        ok = "✓" if n is not None and n > min_videos else " "
        print(f"  {ok} {gid}  {date}  {away or '?'} @ {home or '?'}  {n_str}")
    print()
    return {"total": total, "has_pbp": has_pbp, "has_min_videos": has_min_videos, "incomplete": incomplete}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit feed play_by_play vs Supabase nba_games")
    parser.add_argument("start_date", nargs="?", default="2026-02-19", help="Start date YYYY-MM-DD")
    parser.add_argument("end_date", nargs="?", default="2026-03-04", help="End date YYYY-MM-DD")
    parser.add_argument("--min-videos", type=int, default=MIN_VIDEOS_DEFAULT, help=f"Min videos to count as complete (default {MIN_VIDEOS_DEFAULT})")
    parser.add_argument("--quiet", "-q", action="store_true", help="Print only TOTAL= COMPLETE= INCOMPLETE= for scripting")
    args = parser.parse_args()
    run_audit(args.start_date, args.end_date, args.min_videos, quiet=args.quiet)
