#!/usr/bin/env python3
"""
Backfill traditional box score stats (pts/reb/ast/stl/blk) into existing JSON files.

Existing files have boxScoreData with advanced/hustle/misc/etc but are
missing the traditional endpoint data (BoxScoreTraditionalV3). This script:

1. Reads each JSON file
2. Checks if PlayerStats is empty and boxScoreData.traditional is missing
3. Fetches BoxScoreTraditionalV3 from the NBA API
4. Merges it into boxScoreData and builds a unified PlayerStats array
5. Saves the patched file

Usage:
    python3 backfill_traditional_stats.py                      # all files needing it
    python3 backfill_traditional_stats.py --team DET           # DET games only
    python3 backfill_traditional_stats.py --game-ids 0022400836
    python3 backfill_traditional_stats.py --dry-run            # preview only
"""

import json
import sys
import time
import argparse
from pathlib import Path

FEED_DIR = Path(__file__).resolve().parent
DELAY_BETWEEN_REQUESTS = 1.5
DELAY_BETWEEN_GAMES = 5


def fetch_traditional_boxscore(game_id: str) -> dict | None:
    """Fetch BoxScoreTraditionalV3 for a game."""
    try:
        from nba_api.stats.endpoints.boxscoretraditionalv3 import BoxScoreTraditionalV3
        box = BoxScoreTraditionalV3(game_id=game_id, get_request=True)
        time.sleep(DELAY_BETWEEN_REQUESTS)

        result = {'PlayerStats': [], 'TeamStats': [], 'TeamStarterBenchStats': []}

        if box.player_stats:
            df = box.player_stats.get_data_frame()
            if not df.empty:
                result['PlayerStats'] = df.to_dict('records')

        if box.team_stats:
            df = box.team_stats.get_data_frame()
            if not df.empty:
                result['TeamStats'] = df.to_dict('records')

        if box.team_starter_bench_stats:
            df = box.team_starter_bench_stats.get_data_frame()
            if not df.empty:
                result['TeamStarterBenchStats'] = df.to_dict('records')

        return result
    except Exception as e:
        print(f"    Error fetching traditional stats: {e}")
        return None


def build_unified_player_stats(traditional: dict, bsd: dict) -> list:
    """Build a unified PlayerStats array from traditional + other box score data."""
    players = {}

    # Start with traditional (has pts/reb/ast/stl/blk)
    for p in traditional.get('PlayerStats', []):
        pid = p.get('personId')
        if not pid:
            continue
        players[pid] = {**p}

    # Merge other endpoints
    for ep_name in ['advanced', 'hustle', 'playerTrack', 'defensive', 'misc', 'scoring', 'fourFactors', 'usage']:
        ep = bsd.get(ep_name, {})
        for p in ep.get('PlayerStats', []):
            pid = p.get('personId')
            if not pid:
                continue
            if pid not in players:
                players[pid] = {
                    'personId': pid,
                    'firstName': p.get('firstName'),
                    'familyName': p.get('familyName'),
                    'nameI': p.get('nameI'),
                    'teamTricode': p.get('teamTricode'),
                    'teamId': p.get('teamId'),
                    'position': p.get('position'),
                    'jerseyNum': p.get('jerseyNum'),
                }
            # Merge non-identity fields
            skip = {'personId', 'gameId', 'teamId', 'teamCity', 'teamName',
                    'teamTricode', 'teamSlug', 'firstName', 'familyName',
                    'nameI', 'playerSlug', 'position', 'comment', 'jerseyNum'}
            for k, v in p.items():
                if k not in skip and k not in players[pid]:
                    players[pid][k] = v

    return sorted(players.values(), key=lambda x: (x.get('teamId', 0), x.get('personId', 0)))


def needs_backfill(filepath: Path) -> bool:
    """Check if a file needs traditional stats backfill."""
    try:
        data = json.load(open(filepath))
        ps = data.get('PlayerStats', [])
        bsd = data.get('boxScoreData', {})
        trad = bsd.get('traditional', {})
        trad_players = trad.get('PlayerStats', []) if isinstance(trad, dict) else []

        # Needs backfill if both top-level PlayerStats and traditional are empty
        return len(ps) == 0 and len(trad_players) == 0
    except Exception:
        return False


def backfill_file(filepath: Path, dry_run: bool = False) -> dict:
    """Backfill a single file. Returns stats."""
    stats = {'file': filepath.name, 'had_stats': False, 'fetched': False, 'players': 0}

    data = json.load(open(filepath))
    game_id = data.get('gameId', filepath.stem)
    bsd = data.get('boxScoreData', {})

    # Check if already has traditional data
    trad = bsd.get('traditional', {})
    trad_players = trad.get('PlayerStats', []) if isinstance(trad, dict) else []
    top_ps = data.get('PlayerStats', [])

    if len(top_ps) > 0 or len(trad_players) > 0:
        stats['had_stats'] = True
        print(f"  {filepath.name}: already has stats (PlayerStats={len(top_ps)}, traditional={len(trad_players)})")
        return stats

    if dry_run:
        print(f"  {filepath.name}: NEEDS backfill")
        return stats

    print(f"  {filepath.name}: fetching traditional box score for {game_id}...")
    traditional = fetch_traditional_boxscore(game_id)

    if not traditional or len(traditional.get('PlayerStats', [])) == 0:
        print(f"    No traditional stats returned (game may be too old)")
        return stats

    stats['fetched'] = True
    stats['players'] = len(traditional['PlayerStats'])

    # Store traditional data in boxScoreData
    if 'boxScoreData' not in data:
        data['boxScoreData'] = {}
    data['boxScoreData']['traditional'] = traditional

    # Build unified PlayerStats
    unified = build_unified_player_stats(traditional, data['boxScoreData'])
    data['PlayerStats'] = unified
    print(f"    Built unified PlayerStats with {len(unified)} players")

    # Save
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"    Saved {filepath.name}")

    return stats


def get_files(args) -> list[Path]:
    """Get files to process based on args."""
    all_files = sorted(FEED_DIR.glob('*.json'))
    all_files = [f for f in all_files if not f.name.startswith('._')]

    if args.game_ids:
        ids = set(args.game_ids)
        return [f for f in all_files if f.stem in ids]

    if args.team or args.date_range:
        filtered = []
        for f in all_files:
            try:
                data = json.load(open(f))
                meta = data.get('gameMetadata', {})
                ht = meta.get('homeTeam', {}).get('abbreviation', '')
                at = meta.get('awayTeam', {}).get('abbreviation', '')
                date = (meta.get('date') or '').split('T')[0]

                if args.team and args.team not in (ht, at):
                    continue
                if args.date_range and (date < args.date_range[0] or date > args.date_range[1]):
                    continue
                filtered.append(f)
            except Exception:
                pass
        return filtered

    # Default: only files that actually need it
    return [f for f in all_files if needs_backfill(f)]


def main():
    parser = argparse.ArgumentParser(description='Backfill traditional box score stats')
    parser.add_argument('--game-ids', nargs='+', help='Game IDs to process')
    parser.add_argument('--team', help='Team tricode filter')
    parser.add_argument('--date-range', nargs=2, metavar=('START', 'END'))
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, help='Max files to process')
    args = parser.parse_args()

    files = get_files(args)
    if args.limit:
        files = files[:args.limit]

    print(f"Found {len(files)} file(s) to process\n")
    if not files:
        return

    all_stats = []
    for i, f in enumerate(files):
        if i > 0:
            time.sleep(DELAY_BETWEEN_GAMES)
        print(f"[{i+1}/{len(files)}]")
        s = backfill_file(f, dry_run=args.dry_run)
        all_stats.append(s)

    fetched = sum(1 for s in all_stats if s['fetched'])
    total_players = sum(s['players'] for s in all_stats)
    print(f"\nDone: {fetched}/{len(files)} files updated, {total_players} total player stat records")


if __name__ == '__main__':
    main()
