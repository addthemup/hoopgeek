#!/usr/bin/env python3
"""
Split existing monolithic game JSON files in feed/ into the bit-based folder structure.

Reads every 00225XXXXX.json in the script directory (feed/), then writes:
  discover/discover_YYYY-MM-DD.json         — one per date, list of games
  play_by_play/play_by_play_{game_id}.json — gameId, matchup, date, videos: [full play objects with mp4]
  metadata/metadata_{game_id}.json         — gameId, gameMetadata, score
  player_stats/player_stats_{game_id}.json — gameId, PlayerStats, etc.
  shot_charts/shot_charts_{game_id}.json   — gameId, shotChartData
  (Type prefix in filename so files are identifiable when outside the directory.)

Does NOT delete or move the original game JSON files. Only writes into discover/,
play_by_play/, metadata/, etc.

Usage:
  cd feed && python3 split_feed_into_folders.py
  python3 split_feed_into_folders.py --dry-run
"""

import json
import re
import os
import argparse
from pathlib import Path
from collections import defaultdict

# Game ID pattern: 00225XXXXX (NBA 2025-26 regular season)
GAME_ID_PATTERN = re.compile(r"^00225\d{5}\.json$")
FEED_DIR = Path(__file__).resolve().parent

FOLDERS = ("discover", "play_by_play", "metadata", "player_stats", "shot_charts")


def date_from_metadata(game_metadata):
    """Return YYYY-MM-DD from gameMetadata.date (e.g. 2025-12-25T00:00:00)."""
    if not game_metadata:
        return None
    raw = game_metadata.get("date")
    if not raw:
        return None
    return str(raw).split("T")[0]


def matchup_from_metadata(game_metadata):
    """Build matchup string away @ home from gameMetadata."""
    if not game_metadata:
        return ""
    home = game_metadata.get("homeTeam") or {}
    away = game_metadata.get("awayTeam") or {}
    away_abbr = away.get("abbreviation") or ""
    home_abbr = home.get("abbreviation") or ""
    return f"{away_abbr} @ {home_abbr}".strip()


def process_file(path, games_by_date, dry_run):
    """Load one game JSON and queue writes for each bit. Populate games_by_date for discover."""
    try:
        with open(path, "r") as f:
            data = json.load(f)
    except Exception as e:
        print(f"  ✗ Skip {path.name}: {e}")
        return False

    game_id = data.get("gameId")
    if not game_id or not str(game_id).startswith("00225"):
        print(f"  ✗ Skip {path.name}: missing or invalid gameId")
        return False

    meta = data.get("gameMetadata") or {}
    date_str = date_from_metadata(meta)
    matchup = matchup_from_metadata(meta)
    if not date_str:
        print(f"  ✗ Skip {path.name}: no date in gameMetadata")
        return False

    # Discover: collect for this date
    games_by_date[date_str].append({
        "game_id": game_id,
        "matchup": matchup,
        "date": date_str,
    })

    if dry_run:
        return True

    # play_by_play (PBP with video URLs: gameId, matchup, date, videos)
    pbp = data.get("playByPlay") or {}
    videos = [p for p in (pbp.get("allPlays") or []) if isinstance(p, dict) and p.get("mp4")]
    pbp_payload = {"gameId": game_id, "matchup": matchup, "date": date_str, "videos": videos}
    (FEED_DIR / "play_by_play").mkdir(parents=True, exist_ok=True)
    with open(FEED_DIR / "play_by_play" / f"play_by_play_{game_id}.json", "w") as f:
        json.dump(pbp_payload, f, indent=2)

    # metadata
    meta_payload = {
        "gameId": game_id,
        "gameMetadata": meta,
        "score": data.get("score"),
    }
    (FEED_DIR / "metadata").mkdir(parents=True, exist_ok=True)
    with open(FEED_DIR / "metadata" / f"metadata_{game_id}.json", "w") as f:
        json.dump(meta_payload, f, indent=2)

    # player_stats
    stats_payload = {
        "gameId": game_id,
        "PlayerStats": data.get("PlayerStats"),
        "AggregatedPlayerStats": data.get("AggregatedPlayerStats"),
        "AggregatedTeamStats": data.get("AggregatedTeamStats"),
    }
    (FEED_DIR / "player_stats").mkdir(parents=True, exist_ok=True)
    with open(FEED_DIR / "player_stats" / f"player_stats_{game_id}.json", "w") as f:
        json.dump(stats_payload, f, indent=2)

    # shot_charts (optional)
    if data.get("shotChartData") is not None:
        sc_payload = {"gameId": game_id, "shotChartData": data["shotChartData"]}
        (FEED_DIR / "shot_charts").mkdir(parents=True, exist_ok=True)
        with open(FEED_DIR / "shot_charts" / f"shot_charts_{game_id}.json", "w") as f:
            json.dump(sc_payload, f, indent=2)

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Split feed game JSON files into discover/, mp4_urls/, metadata/, etc."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only scan and report; do not write files",
    )
    args = parser.parse_args()

    # Find all game JSONs in feed/ (same directory as this script)
    candidates = [f for f in FEED_DIR.iterdir() if f.is_file() and GAME_ID_PATTERN.match(f.name)]
    if not candidates:
        print(f"No game JSON files (00225XXXXX.json) found in {FEED_DIR}")
        return

    print(f"Found {len(candidates)} game JSON files in {FEED_DIR}")
    if args.dry_run:
        print("Dry run: no files will be written.\n")

    games_by_date = defaultdict(list)
    ok = 0
    for path in sorted(candidates):
        if process_file(path, games_by_date, args.dry_run):
            ok += 1
            if args.dry_run:
                print(f"  Would process {path.name}")

    if args.dry_run:
        print(f"\nWould write discover/ for {len(games_by_date)} dates")
        for d in sorted(games_by_date.keys()):
            print(f"  {d}.json: {len(games_by_date[d])} games")
        return

    # Write discover/ one file per date
    (FEED_DIR / "discover").mkdir(parents=True, exist_ok=True)
    for date_str in sorted(games_by_date.keys()):
        # Dedupe by game_id
        seen = set()
        games = []
        for g in games_by_date[date_str]:
            if g["game_id"] not in seen:
                seen.add(g["game_id"])
                games.append(g)
        payload = {"date": date_str, "games": games}
        with open(FEED_DIR / "discover" / f"discover_{date_str}.json", "w") as f:
            json.dump(payload, f, indent=2)
        print(f"  discover/discover_{date_str}.json ({len(games)} games)")

    print(f"\nDone. Processed {ok}/{len(candidates)} files.")
    print("New folders:", ", ".join(FOLDERS))
    print("Original game JSON files were NOT deleted — you can zip them and move out of feed/.")


if __name__ == "__main__":
    main()
