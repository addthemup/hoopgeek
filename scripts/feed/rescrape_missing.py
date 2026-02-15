#!/usr/bin/env python3
"""
Re-scrape missing/failed game files for Jan-Feb 2026.

Optimized version that:
1. Groups missing games BY DATE — only calls get_games_for_date once per date
2. Caches the DataFrame for all games on the same date
3. Adaptive delays: backs off when hitting rate limits
4. Validates data quality before saving (no empty shells!)
5. Reduced delays since we're scraping old games during All-Star break

Usage:
    python3 rescrape_missing.py
"""

import sys
import os
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

# Ensure we can import from the same directory
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from scrape_games_date_range import (
    get_games_for_date,
    get_unique_game_ids,
    get_complete_game_data,
    is_valid_game_data,
    FEED_DIR,
)

# ── Configuration ──
START_DATE = "2026-01-01"
END_DATE = "2026-02-12"     # Last game day before All-Star break
DELAY_BETWEEN_GAMES = 120   # seconds between games on the same date
DELAY_BETWEEN_DAYS = 180    # seconds between date changes
MAX_RETRIES = 2
TIMEOUT_BACKOFF = 60        # extra seconds to add when hitting timeouts


def get_existing_game_ids():
    """Return set of game IDs that already have valid JSON files."""
    existing = set()
    for fname in os.listdir(FEED_DIR):
        if fname.endswith('.json') and not fname.startswith('._'):
            game_id = fname.replace('.json', '')
            fpath = os.path.join(FEED_DIR, fname)
            try:
                with open(fpath) as f:
                    data = json.load(f)
                is_valid, _ = is_valid_game_data(data)
                if is_valid:
                    existing.add(game_id)
            except Exception:
                pass
    return existing


def discover_missing_games(existing_ids):
    """
    Phase 1: Discover all missing game IDs grouped by date.
    Returns dict of {date_str: [(game_id, matchup), ...]}
    """
    start = datetime.strptime(START_DATE, '%Y-%m-%d')
    end = datetime.strptime(END_DATE, '%Y-%m-%d')

    missing_by_date = defaultdict(list)
    total_missing = 0

    current_date = start
    while current_date <= end:
        date_str = current_date.strftime('%Y-%m-%d')

        retries = 0
        while retries < 3:
            try:
                df = get_games_for_date(date_str)
                if df is None or df.empty:
                    break

                games_info = get_unique_game_ids(df)
                day_missing = []
                for g in games_info:
                    if g['game_id'] not in existing_ids:
                        day_missing.append((g['game_id'], g['matchup']))

                if day_missing:
                    print(f"  {date_str}: {len(day_missing)} missing out of {len(games_info)} games")
                    for gid, matchup in day_missing:
                        print(f"    • {gid} — {matchup}")
                    missing_by_date[date_str] = day_missing
                    total_missing += len(day_missing)
                else:
                    print(f"  {date_str}: ✓ all {len(games_info)} games present")
                break  # Success, move to next date

            except Exception as e:
                retries += 1
                if retries < 3:
                    print(f"  {date_str}: timeout, retrying in 30s... ({retries}/3)")
                    time.sleep(30)
                else:
                    print(f"  {date_str}: ✗ failed after 3 attempts: {e}")

        current_date += timedelta(days=1)
        time.sleep(2)  # Small delay between discovery queries

    return missing_by_date, total_missing


def scrape_game_with_retry(game_id, df, max_attempts=2):
    """
    Scrape a single game with retry logic. Returns (game_data, is_valid, reason).
    """
    for attempt in range(max_attempts):
        try:
            game_data = get_complete_game_data(game_id, df)
            if not game_data:
                if attempt < max_attempts - 1:
                    print(f"    Attempt {attempt+1} returned None, retrying in 60s...")
                    time.sleep(60)
                    continue
                return None, False, "returned None"

            is_valid, reason = is_valid_game_data(game_data)
            if not is_valid:
                if attempt < max_attempts - 1:
                    print(f"    Attempt {attempt+1} invalid ({reason}), retrying in 60s...")
                    time.sleep(60)
                    continue
                return game_data, False, reason

            return game_data, True, "ok"

        except Exception as e:
            if attempt < max_attempts - 1:
                print(f"    Attempt {attempt+1} error: {e}, retrying in 90s...")
                time.sleep(90)
            else:
                return None, False, str(e)[:100]

    return None, False, "max attempts reached"


def main():
    # Get existing valid files
    existing_ids = get_existing_game_ids()
    print(f"\n{'='*80}")
    print(f"RE-SCRAPE MISSING GAMES: {START_DATE} to {END_DATE}")
    print(f"Existing valid game files: {len(existing_ids)}")
    print(f"{'='*80}\n")

    # Phase 1: Discover
    print("Phase 1: Discovering missing games...\n")
    missing_by_date, total_missing = discover_missing_games(existing_ids)

    print(f"\nTotal missing games to scrape: {total_missing}")
    dates_with_missing = sorted(missing_by_date.keys())
    print(f"Dates with missing games: {len(dates_with_missing)}")

    if total_missing == 0:
        print("Nothing to do! All games are present.")
        return

    # Estimate time
    est_minutes = (total_missing * (DELAY_BETWEEN_GAMES + 300)) / 60  # ~5 min scrape + delay
    print(f"Estimated time: ~{est_minutes:.0f} minutes ({est_minutes/60:.1f} hours)\n")

    # Phase 2: Scrape, grouped by date
    print(f"\n{'='*80}")
    print(f"Phase 2: Scraping {total_missing} missing games across {len(dates_with_missing)} dates...")
    print(f"{'='*80}\n")

    successful = 0
    failed = 0
    failed_list = []
    game_counter = 0

    for date_idx, date_str in enumerate(dates_with_missing):
        games = missing_by_date[date_str]

        if date_idx > 0:
            print(f"\n⏸ Switching to next date, waiting {DELAY_BETWEEN_DAYS}s...")
            time.sleep(DELAY_BETWEEN_DAYS)

        print(f"\n{'='*60}")
        print(f"DATE: {date_str} — {len(games)} games to scrape")
        print(f"{'='*60}")

        # Get games DataFrame ONCE for this date
        df = None
        for attempt in range(3):
            try:
                df = get_games_for_date(date_str)
                if df is not None and not df.empty:
                    break
            except Exception as e:
                print(f"  ⚠ get_games_for_date failed (attempt {attempt+1}): {e}")
                time.sleep(45)

        if df is None or df.empty:
            print(f"  ✗ Could not get games for {date_str} after 3 attempts, skipping all")
            for gid, matchup in games:
                failed += 1
                failed_list.append((gid, matchup, date_str, "could not get date df"))
            continue

        # Scrape each game for this date
        for game_idx, (game_id, matchup) in enumerate(games):
            game_counter += 1
            output_file = str(FEED_DIR / f"{game_id}.json")

            # Skip if it now exists (e.g., from a previous partial run)
            if os.path.exists(output_file):
                try:
                    with open(output_file) as f:
                        existing = json.load(f)
                    is_valid, _ = is_valid_game_data(existing)
                    if is_valid:
                        print(f"\n  [{game_counter}/{total_missing}] {game_id} — ⏭ already exists, skipping")
                        successful += 1
                        continue
                except Exception:
                    pass  # Will re-scrape

            print(f"\n  [{game_counter}/{total_missing}] {game_id} — {matchup}")

            try:
                game_data, is_valid, reason = scrape_game_with_retry(game_id, df)

                if not is_valid:
                    print(f"    ✗ Invalid: {reason} — NOT saving")
                    failed += 1
                    failed_list.append((game_id, matchup, date_str, reason))
                else:
                    videos_count = len(game_data.get('playByPlay', {}).get('allPlays', []))
                    player_count = len(game_data.get('PlayerStats', []))

                    with open(output_file, 'w') as f:
                        json.dump(game_data, f, indent=2)

                    successful += 1
                    size_kb = os.path.getsize(output_file) / 1024
                    print(f"    ✓ Saved ({size_kb:.0f} KB) — {player_count} players, {videos_count} videos")

                    if videos_count == 0:
                        print(f"    ⚠ No videos (data is valid though)")

            except KeyboardInterrupt:
                print("\n\n⚠ Interrupted by user. Printing summary...\n")
                break
            except Exception as e:
                print(f"    ✗ Exception: {e}")
                failed += 1
                failed_list.append((game_id, matchup, date_str, str(e)[:80]))

            # Wait between games on the same date
            if game_idx < len(games) - 1:
                print(f"    ⏸ Waiting {DELAY_BETWEEN_GAMES}s...")
                time.sleep(DELAY_BETWEEN_GAMES)
        else:
            continue
        break  # Break outer loop on KeyboardInterrupt

    # Final summary
    print(f"\n{'='*80}")
    print(f"RE-SCRAPE COMPLETE")
    print(f"{'='*80}")
    print(f"Target games:  {total_missing}")
    print(f"Successful:    {successful}")
    print(f"Failed:        {failed}")

    if failed_list:
        print(f"\nFailed games:")
        for game_id, matchup, date_str, reason in failed_list:
            fpath = os.path.join(FEED_DIR, f"{game_id}.json")
            status = "✓ exists" if os.path.exists(fpath) else "✗ missing"
            print(f"  {status}  {game_id} — {matchup} ({date_str}): {reason}")

    print(f"{'='*80}\n")

    # Final file count
    final_valid = len(get_existing_game_ids())
    total_files = sum(1 for f in os.listdir(FEED_DIR) if f.endswith('.json') and not f.startswith('._'))
    print(f"Total game JSON files: {total_files}")
    print(f"Total valid game files: {final_valid}")


if __name__ == "__main__":
    main()
