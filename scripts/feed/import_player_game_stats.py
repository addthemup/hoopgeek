#!/usr/bin/env python3
"""
Import player game stats from JSON files into nba_player_game_stats table.

Usage:
    python3 import_player_game_stats.py [--dry-run] [--skip-existing] [--limit N]

Options:
    --dry-run          Show what would be imported without actually importing
    --skip-existing    Skip games that already have stats imported
    --limit N          Only process first N files (for testing)
"""

import json
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import time

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ Error: supabase-py not installed")
    print("Install it with: pip install supabase")
    sys.exit(1)

# Load environment variables
import os
from dotenv import load_dotenv

load_dotenv()

# Supabase credentials - defaults for this project
# Can be overridden by environment variables
SUPABASE_URL = (
    os.getenv('VITE_SUPABASE_URL') or 
    os.getenv('SUPABASE_URL') or 
    'https://qbznyaimnrpibmahisue.supabase.co'
)

SUPABASE_KEY = (
    os.getenv('SUPABASE_SERVICE_ROLE_KEY') or 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw'
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: Missing Supabase credentials")
    print("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables")
    sys.exit(1)


def safe_decimal(value: Any, default: Optional[float] = None) -> Optional[float]:
    """Safely convert value to decimal/float, handling None and empty strings"""
    if value is None or value == '' or value == 'None':
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    """Safely convert value to integer, handling None and empty strings"""
    if value is None or value == '' or value == 'None':
        return default
    try:
        return int(float(value))  # Handle string numbers like "32.5"
    except (ValueError, TypeError):
        return default


def get_player_id(supabase: Client, nba_player_id: int) -> Optional[str]:
    """Get player UUID from nba_players table using nba_player_id"""
    try:
        result = supabase.table('nba_players').select('id').eq('nba_player_id', nba_player_id).limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]['id']
        return None
    except Exception as e:
        print(f"    ⚠ Error looking up player {nba_player_id}: {e}")
        return None


def extract_player_stats(player_data: Dict, game_id: str, season_year: str) -> Optional[Dict]:
    """Extract and map player stats from JSON to database format"""
    # Get personId (nba_player_id) - it's the key in AggregatedPlayerStats
    # But also check if it's in the data itself
    person_id = player_data.get('traditional_personId') or player_data.get('advanced_personId')
    if not person_id:
        return None
    
    # Map stats from JSON to database fields
    # NOTE: PostgreSQL converts unquoted identifiers to lowercase, so all column names are lowercase
    stats = {
        'game_id': game_id,
        'season_year': season_year,
        
        # Advanced Stats (lowercase column names)
        'advanced_playerefficiencyrating': safe_decimal(player_data.get('advanced_playerEfficiencyRating')),
        'advanced_offensiverating': safe_decimal(player_data.get('advanced_offensiveRating')),
        'advanced_defensiverating': safe_decimal(player_data.get('advanced_defensiveRating')),
        'advanced_netrating': safe_decimal(player_data.get('advanced_netRating')),
        'advanced_trueshootingpercentage': safe_decimal(player_data.get('advanced_trueShootingPercentage')),
        'advanced_usagepercentage': safe_decimal(player_data.get('advanced_usagePercentage')),
        'advanced_assistratio': safe_decimal(player_data.get('advanced_assistRatio')),
        'advanced_reboundpercentage': safe_decimal(player_data.get('advanced_reboundPercentage')),
        'advanced_pace': safe_decimal(player_data.get('advanced_pace')),
        
        # Four Factors (lowercase column names)
        'fourfactors_effectivefieldgoalpercentage': safe_decimal(player_data.get('fourFactors_effectiveFieldGoalPercentage')),
        'fourfactors_freethrowattemptrate': safe_decimal(player_data.get('fourFactors_freeThrowAttemptRate')),
        'fourfactors_offensivereboundpercentage': safe_decimal(player_data.get('fourFactors_offensiveReboundPercentage')),
        'fourfactors_turnoverpercentage': safe_decimal(player_data.get('fourFactors_teamTurnoverPercentage')),  # Note: teamTurnoverPercentage in JSON
        
        # Hustle Stats (lowercase column names)
        'hustle_contestedshots': safe_int(player_data.get('hustle_contestedShots')),
        'hustle_contestedshots3pt': safe_int(player_data.get('hustle_contestedShots3pt')),
        'hustle_deflections': safe_int(player_data.get('hustle_deflections')),
        'hustle_looseballsrecovered': safe_int(player_data.get('hustle_looseBallsRecoveredTotal')),  # Note: Total in JSON
        'hustle_chargesdrawn': safe_int(player_data.get('hustle_chargesDrawn')),
        'hustle_screenassists': safe_int(player_data.get('hustle_screenAssists')),
        
        # Misc Impact Stats (lowercase column names)
        'misc_pointsoffturnovers': safe_int(player_data.get('misc_pointsOffTurnovers')),
        'misc_pointssecondchance': safe_int(player_data.get('misc_pointsSecondChance')),
        'misc_pointsfastbreak': safe_int(player_data.get('misc_pointsFastBreak')),
        'misc_pointspaint': safe_int(player_data.get('misc_pointsPaint')),
        
        # Player Tracking (lowercase column names)
        'playertrack_touches': safe_int(player_data.get('playerTrack_touches')),
        'playertrack_passes': safe_int(player_data.get('playerTrack_passes')),
        'playertrack_timeofpossession': safe_decimal(player_data.get('playerTrack_timeOfPossession')),
        'playertrack_contestedfieldgoalpercentage': safe_decimal(player_data.get('playerTrack_contestedFieldGoalPercentage')),
        'playertrack_uncontestedfieldgoalspercentage': safe_decimal(player_data.get('playerTrack_uncontestedFieldGoalsPercentage')),
        'playertrack_defendedatrimfieldgoalpercentage': safe_decimal(player_data.get('playerTrack_defendedAtRimFieldGoalPercentage')),
        
        # Scoring Breakdown (lowercase column names - these fields may not be in all JSON files)
        # Note: The JSON has different field names, so these will likely be NULL
        # If you need these, you may need to calculate them from other fields
        'scoring_restrictedareafieldgoalspercentage': safe_decimal(player_data.get('scoring_restrictedAreaFieldGoalsPercentage')),
        'scoring_paintfieldgoalspercentage': safe_decimal(player_data.get('scoring_paintFieldGoalsPercentage')),
        'scoring_midrangefieldgoalspercentage': safe_decimal(player_data.get('scoring_midRangeFieldGoalsPercentage')),
        'scoring_abovethebreak3fieldgoalspercentage': safe_decimal(player_data.get('scoring_aboveTheBreak3FieldGoalsPercentage')),
        'scoring_corner3fieldgoalspercentage': safe_decimal(player_data.get('scoring_corner3FieldGoalsPercentage')),
    }
    
    # Store personId for lookup
    stats['_nba_player_id'] = int(person_id)
    
    return stats


def process_json_file(supabase: Client, file_path: Path, dry_run: bool = False, skip_existing: bool = True) -> Dict[str, Any]:
    """Process a single JSON file and import player stats"""
    result = {
        'file': file_path.name,
        'success': False,
        'players_processed': 0,
        'players_imported': 0,
        'players_skipped': 0,
        'errors': []
    }
    
    try:
        print(f"\n📄 Processing {file_path.name}...")
        
        # Load JSON file
        with open(file_path, 'r') as f:
            game_data = json.load(f)
        
        # Extract game info
        game_id = game_data.get('gameId')
        if not game_id:
            result['errors'].append("Missing gameId")
            return result
        
        # Extract season from gameMetadata
        season_year = game_data.get('gameMetadata', {}).get('season', '2025-26')
        
        # Check if stats already exist (skip by default)
        if skip_existing:
            check_result = supabase.table('nba_player_game_stats').select('id').eq('game_id', game_id).limit(1).execute()
            if check_result.data and len(check_result.data) > 0:
                print(f"  ⏭ Skipping {game_id} (stats already exist - use --overwrite to re-import)")
                result['success'] = True
                result['players_skipped'] = -1  # Special flag for skipped
                return result
        
        # Get AggregatedPlayerStats
        aggregated_stats = game_data.get('AggregatedPlayerStats', {})
        if not aggregated_stats:
            result['errors'].append("No AggregatedPlayerStats found")
            print(f"  ⚠ No player stats found")
            return result
        
        print(f"  Found {len(aggregated_stats)} players")
        
        # Process each player
        players_to_import = []
        player_id_cache = {}  # Cache player_id lookups
        
        for person_id_str, player_data in aggregated_stats.items():
            result['players_processed'] += 1
            
            # Extract stats
            stats = extract_player_stats(player_data, game_id, season_year)
            if not stats:
                result['players_skipped'] += 1
                continue
            
            # Get player_id (UUID) from nba_players
            nba_player_id = stats.pop('_nba_player_id')
            
            # Check cache first
            if nba_player_id in player_id_cache:
                player_id = player_id_cache[nba_player_id]
            else:
                player_id = get_player_id(supabase, nba_player_id)
                if player_id:
                    player_id_cache[nba_player_id] = player_id
                else:
                    result['players_skipped'] += 1
                    result['errors'].append(f"Player {nba_player_id} not found in nba_players")
                    continue
            
            stats['player_id'] = player_id
            players_to_import.append(stats)
        
        # Import players (batch insert)
        if players_to_import and not dry_run:
            try:
                # Use upsert to handle duplicates (ON CONFLICT DO UPDATE)
                # Insert in smaller batches to avoid issues
                batch_size = 10
                imported_count = 0
                
                for i in range(0, len(players_to_import), batch_size):
                    batch = players_to_import[i:i+batch_size]
                    try:
                        insert_result = supabase.table('nba_player_game_stats').upsert(
                            batch,
                            on_conflict='player_id,game_id'
                        ).execute()
                        imported_count += len(batch)
                    except Exception as batch_error:
                        # If batch fails, try individual inserts to identify problem
                        error_msg = str(batch_error)
                        if 'PGRST204' in error_msg or 'schema cache' in error_msg:
                            # Schema cache issue - try refreshing or check column names
                            result['errors'].append(f"Schema cache error: {error_msg}")
                            print(f"  ⚠ Schema cache issue - may need to refresh in Supabase Dashboard")
                            # Try to continue with other batches
                            continue
                        else:
                            # Try inserting one at a time to find the problematic record
                            for player in batch:
                                try:
                                    supabase.table('nba_player_game_stats').upsert(
                                        [player],
                                        on_conflict='player_id,game_id'
                                    ).execute()
                                    imported_count += 1
                                except Exception as single_error:
                                    result['errors'].append(f"Player {player.get('player_id')}: {str(single_error)}")
                
                result['players_imported'] = imported_count
                result['success'] = True
                if imported_count > 0:
                    print(f"  ✅ Imported {imported_count} players")
                else:
                    print(f"  ⚠ No players imported (check errors above)")
                
            except Exception as e:
                result['errors'].append(f"Import error: {str(e)}")
                error_msg = str(e)
                if 'PGRST204' in error_msg or 'schema cache' in error_msg:
                    print(f"  ❌ Schema cache error: {e}")
                    print(f"  💡 Try refreshing schema cache in Supabase Dashboard > Settings > API")
                else:
                    print(f"  ❌ Import error: {e}")
        elif players_to_import and dry_run:
            result['players_imported'] = len(players_to_import)
            result['success'] = True
            print(f"  🔍 [DRY RUN] Would import {len(players_to_import)} players")
        else:
            result['success'] = True
            print(f"  ⚠ No players to import")
        
    except json.JSONDecodeError as e:
        result['errors'].append(f"JSON decode error: {str(e)}")
        print(f"  ❌ JSON error: {e}")
    except Exception as e:
        result['errors'].append(f"Unexpected error: {str(e)}")
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    return result


def main():
    parser = argparse.ArgumentParser(
        description='Import player game stats from JSON files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python3 import_player_game_stats.py                    # Import all, skip existing games
  python3 import_player_game_stats.py --dry-run          # Test run without importing
  python3 import_player_game_stats.py --overwrite        # Re-import all games (overwrite existing)
  python3 import_player_game_stats.py --limit 5          # Only process first 5 files
        '''
    )
    parser.add_argument('--dry-run', action='store_true', help='Show what would be imported without actually importing')
    parser.add_argument('--overwrite', action='store_true', help='Re-import games that already have stats (default: skip existing)')
    parser.add_argument('--skip-existing', action='store_true', help='Skip games that already have stats imported (default behavior)')
    parser.add_argument('--limit', type=int, help='Only process first N files (for testing)')
    
    args = parser.parse_args()
    
    # Default behavior: skip existing games unless --overwrite is specified
    skip_existing = not args.overwrite
    
    # Initialize Supabase client
    print("🔌 Connecting to Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Connected")
    
    # Verify table exists and check columns
    print("🔍 Verifying database table exists...")
    try:
        # Try to query the table structure - test with a column that should exist (lowercase)
        result = supabase.table('nba_player_game_stats').select('id, player_id, game_id, advanced_assistratio').limit(1).execute()
        print("✅ Table 'nba_player_game_stats' exists with expected columns")
    except Exception as e:
        error_msg = str(e)
        if 'PGRST204' in error_msg or 'schema cache' in error_msg:
            if 'advanced_assistratio' in error_msg.lower() or 'advanced_assistRatio' in error_msg:
                print("❌ Error: Column 'advanced_assistRatio' not found in table")
                print("\n🔧 This might be a schema cache issue. Try:")
                print("   1. Go to Supabase Dashboard > Settings > API")
                print("   2. Click 'Reload schema cache' or wait a few minutes")
                print("   3. Or verify the migration ran completely - check if all columns exist")
                print("\n   You can verify columns with:")
                print("   SELECT column_name FROM information_schema.columns")
                print("   WHERE table_name = 'nba_player_game_stats';")
                sys.exit(1)
            elif 'does not exist' in error_msg:
                print("❌ Error: Table 'nba_player_game_stats' does not exist or migration not run")
                print("\n📋 Please run the migration first:")
                print("   1. Copy supabase/migrations/20251106084615_create_player_game_stats.sql")
                print("   2. Run it in your Supabase SQL Editor")
                sys.exit(1)
            else:
                print(f"❌ Schema error: {error_msg}")
                print("\n🔧 Try refreshing the schema cache in Supabase Dashboard")
                sys.exit(1)
        else:
            # Re-raise if it's a different error
            raise
    
    # Find all JSON files in the feed directory
    script_dir = Path(__file__).parent
    json_files = sorted([f for f in script_dir.glob('*.json') if f.name.startswith('002')])
    
    if not json_files:
        print(f"❌ No JSON files found in {script_dir}")
        sys.exit(1)
    
    if args.limit:
        json_files = json_files[:args.limit]
        print(f"📋 Processing first {args.limit} files (limit mode)")
    
    print(f"\n📊 Found {len(json_files)} JSON files to process")
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No data will be imported\n")
    
    # Process files
    total_stats = {
        'files_processed': 0,
        'files_successful': 0,
        'files_failed': 0,
        'files_skipped': 0,
        'total_players_processed': 0,
        'total_players_imported': 0,
        'total_players_skipped': 0,
        'all_errors': []
    }
    
    start_time = time.time()
    
    for i, json_file in enumerate(json_files, 1):
        print(f"\n{'='*80}")
        print(f"File {i}/{len(json_files)}")
        print(f"{'='*80}")
        
        result = process_json_file(supabase, json_file, args.dry_run, skip_existing)
        
        total_stats['files_processed'] += 1
        
        if result['players_skipped'] == -1:  # Special flag for skipped game
            total_stats['files_skipped'] += 1
        elif result['success']:
            total_stats['files_successful'] += 1
            total_stats['total_players_processed'] += result['players_processed']
            total_stats['total_players_imported'] += result['players_imported']
            total_stats['total_players_skipped'] += result['players_skipped']
        else:
            total_stats['files_failed'] += 1
        
        if result['errors']:
            total_stats['all_errors'].extend([f"{json_file.name}: {e}" for e in result['errors']])
        
        # Small delay to avoid rate limiting
        if i < len(json_files):
            time.sleep(0.1)
    
    # Print summary
    elapsed_time = time.time() - start_time
    print(f"\n{'='*80}")
    print("📊 IMPORT SUMMARY")
    print(f"{'='*80}")
    print(f"Files processed: {total_stats['files_processed']}")
    print(f"  ✅ Successful: {total_stats['files_successful']}")
    print(f"  ⏭ Skipped: {total_stats['files_skipped']}")
    print(f"  ❌ Failed: {total_stats['files_failed']}")
    print(f"\nPlayers:")
    print(f"  Processed: {total_stats['total_players_processed']}")
    print(f"  Imported: {total_stats['total_players_imported']}")
    print(f"  Skipped: {total_stats['total_players_skipped']}")
    print(f"\n⏱ Time elapsed: {elapsed_time:.1f} seconds")
    
    if total_stats['all_errors']:
        print(f"\n⚠ Errors encountered ({len(total_stats['all_errors'])}):")
        for error in total_stats['all_errors'][:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(total_stats['all_errors']) > 10:
            print(f"  ... and {len(total_stats['all_errors']) - 10} more errors")
    
    if args.dry_run:
        print("\n🔍 This was a DRY RUN - no data was actually imported")
    
    print(f"{'='*80}\n")


if __name__ == "__main__":
    main()

