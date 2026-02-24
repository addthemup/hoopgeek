#!/usr/bin/env python3
"""
Import game metadata from local JSON files into the nba_games Supabase table.

This ensures that fetchGamesForDateRange() in the PostCreator can discover
games that we already have local JSON files for.

Also fetches 2025-26 season games from the NBA API to populate the table
with current-season games (even if we don't have JSON files yet).

Usage:
    python3 import_games_to_supabase.py                # import from local files + NBA API
    python3 import_games_to_supabase.py --local-only    # only import from existing JSON files
    python3 import_games_to_supabase.py --api-only      # only fetch from NBA API
"""

import json
import os
import sys
import time
import argparse
import glob
from pathlib import Path
from datetime import datetime

FEED_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = FEED_DIR.parent.parent

# Load env
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / '.env.local')
    load_dotenv(PROJECT_ROOT / '.env')
except ImportError:
    pass


def get_supabase():
    """Create Supabase client with service role key."""
    url = os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
    if not url or not key:
        print("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    from supabase import create_client
    return create_client(url, key)


def import_from_local_files(supabase) -> int:
    """Import game metadata from local JSON files into nba_games."""
    files = sorted(FEED_DIR.glob('*.json'))
    files = [f for f in files if not f.name.startswith('._')]
    print(f"Scanning {len(files)} local JSON files...")

    rows = []
    for f in files:
        try:
            data = json.load(open(f))
            game_id = data.get('gameId', f.stem)
            meta = data.get('gameMetadata', {})
            home = meta.get('homeTeam', {})
            away = meta.get('awayTeam', {})

            if not home.get('abbreviation') and not away.get('abbreviation'):
                continue

            date_str = (meta.get('date') or '').split('T')[0]
            if not date_str:
                continue

            score_data = data.get('score', {})
            game_score = score_data.get(game_id, {})
            game_status = meta.get('status', 'Final')

            rows.append({
                'game_id': game_id,
                'game_date': date_str,
                'home_team_tricode': home.get('abbreviation'),
                'away_team_tricode': away.get('abbreviation'),
                'home_team_score': home.get('points'),
                'away_team_score': away.get('points'),
                'game_status_text': game_status or 'Final',
            })
        except Exception as e:
            continue

    print(f"Found {len(rows)} valid games from local files")

    if not rows:
        return 0

    # Upsert in batches
    batch_size = 50
    imported = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            result = supabase.table('nba_games').upsert(batch, on_conflict='game_id').execute()
            imported += len(batch)
        except Exception as e:
            print(f"  Error upserting batch: {e}")
    
    print(f"Imported {imported} games from local files")
    return imported


def import_from_nba_api(supabase, season: str = '2025-26') -> int:
    """Fetch games from NBA API and import into nba_games."""
    try:
        from nba_api.stats.endpoints.leaguegamefinder import LeagueGameFinder
        from nba_api.stats.library.parameters import PlayerOrTeamAbbreviation, SeasonTypeNullable
    except ImportError:
        print("nba_api not installed, skipping API import")
        return 0

    print(f"Fetching {season} season games from NBA API...")

    try:
        gf = LeagueGameFinder(
            player_or_team_abbreviation=PlayerOrTeamAbbreviation.team,
            season_nullable=season,
            season_type_nullable=SeasonTypeNullable.regular,
            get_request=True
        )
        df = gf.league_game_finder_results.get_data_frame()
    except Exception as e:
        print(f"Error fetching from NBA API: {e}")
        return 0

    if df is None or df.empty:
        print(f"No games found for {season}")
        return 0

    print(f"NBA API returned {len(df)} rows")

    # Group by game_id to get home/away pairs
    games = {}
    for _, row in df.iterrows():
        gid = row['GAME_ID']
        if gid not in games:
            games[gid] = {'game_id': gid, 'rows': []}
        games[gid]['rows'].append(row)

    rows = []
    for gid, info in games.items():
        game_rows = info['rows']
        date_str = game_rows[0].get('GAME_DATE', '')

        home_row = None
        away_row = None
        for r in game_rows:
            matchup = r.get('MATCHUP', '')
            if 'vs.' in matchup:
                home_row = r
            elif '@' in matchup:
                away_row = r

        if not home_row and not away_row:
            if len(game_rows) >= 2:
                home_row = game_rows[0]
                away_row = game_rows[1]
            elif len(game_rows) == 1:
                home_row = game_rows[0]

        home_tricode = home_row.get('TEAM_ABBREVIATION', '') if home_row is not None else ''
        away_tricode = away_row.get('TEAM_ABBREVIATION', '') if away_row is not None else ''
        home_pts = int(home_row.get('PTS', 0) or 0) if home_row is not None else None
        away_pts = int(away_row.get('PTS', 0) or 0) if away_row is not None else None

        rows.append({
            'game_id': gid,
            'game_date': date_str,
            'home_team_tricode': home_tricode,
            'away_team_tricode': away_tricode,
            'home_team_score': home_pts,
            'away_team_score': away_pts,
            'game_status_text': 'Final',
        })

    print(f"Parsed {len(rows)} unique games")

    batch_size = 50
    imported = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            supabase.table('nba_games').upsert(batch, on_conflict='game_id').execute()
            imported += len(batch)
        except Exception as e:
            print(f"  Error: {e}")

    print(f"Imported {imported} games from NBA API ({season})")
    return imported


def main():
    parser = argparse.ArgumentParser(description='Import games into nba_games table')
    parser.add_argument('--local-only', action='store_true')
    parser.add_argument('--api-only', action='store_true')
    parser.add_argument('--season', default='2025-26', help='NBA season (default: 2025-26)')
    args = parser.parse_args()

    supabase = get_supabase()
    total = 0

    if not args.api_only:
        total += import_from_local_files(supabase)

    if not args.local_only:
        total += import_from_nba_api(supabase, args.season)

    print(f"\nTotal: {total} games imported/updated")


if __name__ == '__main__':
    main()
