#!/usr/bin/env python3
"""
Backfill mp4 URLs for existing game JSON files.

The date range scraper saves PlayByPlayV3 data but the VideoEventsAsset
step often fails or is skipped. This script patches existing files:

1. Reads each JSON file
2. Finds plays with videoAvailable=1 but no mp4 URL
3. Fetches the mp4 URL from VideoEventsAsset for each action
4. Patches the file in place

Usage:
    python3 backfill_mp4.py                       # all files
    python3 backfill_mp4.py 0022400836.json       # single file
    python3 backfill_mp4.py --game-ids 0022400836 0022400718  # by game ID
    python3 backfill_mp4.py --team DET            # all DET games
    python3 backfill_mp4.py --date-range 2025-02-01 2025-02-28  # date range
"""

import json
import sys
import time
import argparse
import glob
from pathlib import Path

FEED_DIR = Path(__file__).resolve().parent
BATCH_SIZE = 5
DELAY_PER_REQUEST = 0.6
DELAY_PER_BATCH = 2.0
MAX_CONSECUTIVE_ERRORS = 5


def fetch_mp4_for_action(game_id: str, action_num: int) -> str | None:
    """Fetch mp4 URL for a single action from VideoEventsAsset."""
    try:
        from nba_api.stats.endpoints import videoeventsasset
        video_event = videoeventsasset.VideoEventsAsset(
            game_id=game_id,
            game_event_id=action_num,
            get_request=True
        )
        event_json = video_event.get_json()
        if not event_json:
            return None

        event_data = json.loads(event_json)
        result_sets = event_data.get('resultSets', {})
        meta = result_sets.get('Meta', {})
        video_urls = meta.get('videoUrls', [])

        if isinstance(video_urls, list) and len(video_urls) > 0:
            first = video_urls[0]
            if isinstance(first, dict):
                return (first.get('lurl') or first.get('murl') or
                        first.get('surl') or first.get('mp4') or first.get('url'))
            elif isinstance(first, str):
                return first
        elif isinstance(video_urls, dict):
            return (video_urls.get('lurl') or video_urls.get('murl') or
                    video_urls.get('surl') or video_urls.get('mp4') or video_urls.get('url'))
    except Exception:
        pass
    return None


def backfill_file(filepath: Path, dry_run: bool = False) -> dict:
    """Backfill mp4 URLs in a single JSON file. Returns stats dict."""
    stats = {'file': filepath.name, 'total_plays': 0, 'needs_mp4': 0, 'fetched': 0, 'errors': 0}

    with open(filepath) as f:
        data = json.load(f)

    game_id = data.get('gameId', filepath.stem)
    pbp = data.get('playByPlay', {})
    plays = pbp.get('allPlays', []) if isinstance(pbp, dict) else (pbp if isinstance(pbp, list) else [])
    stats['total_plays'] = len(plays)

    # Find plays that need mp4 URLs
    needs_backfill = []
    for i, play in enumerate(plays):
        if play.get('mp4'):
            continue
        if play.get('videoAvailable', 0) == 1:
            action_num = play.get('actionNumber') or play.get('eventNum')
            if action_num:
                needs_backfill.append((i, int(action_num)))

    stats['needs_mp4'] = len(needs_backfill)

    if len(needs_backfill) == 0:
        already_has = sum(1 for p in plays if p.get('mp4'))
        if already_has > 0:
            print(f"  {filepath.name}: already has {already_has} mp4 URLs, nothing to backfill")
        else:
            print(f"  {filepath.name}: {len(plays)} plays, none have videoAvailable=1")
        return stats

    print(f"  {filepath.name}: {len(needs_backfill)} plays need mp4 (of {len(plays)} total)")

    if dry_run:
        return stats

    consecutive_errors = 0
    patched = 0

    for batch_start in range(0, len(needs_backfill), BATCH_SIZE):
        batch = needs_backfill[batch_start:batch_start + BATCH_SIZE]

        for play_idx, action_num in batch:
            mp4_url = fetch_mp4_for_action(game_id, action_num)

            if mp4_url:
                plays[play_idx]['mp4'] = mp4_url
                patched += 1
                consecutive_errors = 0
            else:
                stats['errors'] += 1
                consecutive_errors += 1

            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                print(f"    Too many consecutive failures, pausing 10s...")
                time.sleep(10.0)
                consecutive_errors = 0

            time.sleep(DELAY_PER_REQUEST)

        if batch_start + BATCH_SIZE < len(needs_backfill):
            time.sleep(DELAY_PER_BATCH)

        if (batch_start + BATCH_SIZE) % 25 == 0 or batch_start + BATCH_SIZE >= len(needs_backfill):
            print(f"    Progress: {min(batch_start + BATCH_SIZE, len(needs_backfill))}/{len(needs_backfill)}, found {patched} mp4 URLs")

    stats['fetched'] = patched

    if patched > 0:
        # Write back
        if isinstance(pbp, dict):
            data['playByPlay']['allPlays'] = plays
        else:
            data['playByPlay'] = plays
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"    Saved {patched} new mp4 URLs to {filepath.name}")
    else:
        print(f"    No mp4 URLs found (API may not have video data for this game)")

    return stats


def get_files_to_process(args) -> list[Path]:
    """Determine which files to process based on CLI args."""
    if args.files:
        return [FEED_DIR / f if not Path(f).is_absolute() else Path(f) for f in args.files]

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
                if args.date_range:
                    if date < args.date_range[0] or date > args.date_range[1]:
                        continue
                filtered.append(f)
            except Exception:
                pass
        return filtered

    return all_files


def main():
    parser = argparse.ArgumentParser(description='Backfill mp4 URLs in game JSON files')
    parser.add_argument('files', nargs='*', help='Specific JSON files to process')
    parser.add_argument('--game-ids', nargs='+', help='Game IDs to process')
    parser.add_argument('--team', help='Only process games for this team tricode')
    parser.add_argument('--date-range', nargs=2, metavar=('START', 'END'), help='Date range (YYYY-MM-DD)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without fetching')
    parser.add_argument('--delay-between-games', type=int, default=30, help='Seconds between games (default: 30)')
    args = parser.parse_args()

    files = get_files_to_process(args)
    print(f"Found {len(files)} file(s) to process\n")

    if not files:
        print("No files matched the criteria.")
        return

    all_stats = []
    for i, filepath in enumerate(files):
        if i > 0:
            time.sleep(args.delay_between_games)
        print(f"[{i+1}/{len(files)}] Processing {filepath.name}...")
        stats = backfill_file(filepath, dry_run=args.dry_run)
        all_stats.append(stats)

    # Summary
    total_fetched = sum(s['fetched'] for s in all_stats)
    total_needed = sum(s['needs_mp4'] for s in all_stats)
    total_errors = sum(s['errors'] for s in all_stats)
    print(f"\n{'='*60}")
    print(f"Summary: {total_fetched} mp4 URLs fetched across {len(files)} files")
    print(f"  Needed: {total_needed}, Found: {total_fetched}, Errors: {total_errors}")


if __name__ == '__main__':
    main()
