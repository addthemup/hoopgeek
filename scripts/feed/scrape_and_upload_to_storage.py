#!/usr/bin/env python3
"""
Modified version of scrape_games_date_range.py that uploads JSON files directly to Supabase Storage
instead of saving locally. This can be called from an edge function or run standalone.
"""

import sys
import os
from pathlib import Path

# Add the scripts/feed directory to the path
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

# Import the original scraping script as a module
import importlib.util
spec = importlib.util.spec_from_file_location("scrape_games_date_range", script_dir / "scrape_games_date_range.py")
scrape_module = importlib.util.module_from_spec(spec)
sys.modules["scrape_games_date_range"] = scrape_module
spec.loader.exec_module(scrape_module)

# Import functions from the module
get_games_for_date = scrape_module.get_games_for_date
get_complete_game_data = scrape_module.get_complete_game_data
get_unique_game_ids = scrape_module.get_unique_game_ids
validate_date = scrape_module.validate_date

from supabase import create_client
import json
from datetime import datetime

def upload_to_storage(supabase, game_data, game_id, bucket_name='game-data'):
    """Upload game data JSON to Supabase Storage"""
    try:
        json_str = json.dumps(game_data, indent=2)
        file_path = f"{game_id}.json"
        
        result = supabase.storage.from_(bucket_name).upload(
            file_path,
            json_str.encode('utf-8'),
            file_options={'content-type': 'application/json', 'upsert': 'true'}
        )
        print(f"  ✅ Uploaded to storage: {file_path}")
        return True
    except Exception as e:
        print(f"  ❌ Error uploading to storage: {e}")
        return False

def scrape_date_to_storage(target_date, supabase_url=None, supabase_key=None):
    """
    Scrape games for a specific date and upload to Supabase Storage
    
    Args:
        target_date: Date string in format YYYY-MM-DD
        supabase_url: Supabase project URL (or from env)
        supabase_key: Supabase service role key (or from env)
    
    Returns:
        dict with results
    """
    # Get Supabase credentials
    supabase_url = supabase_url or os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    supabase_key = supabase_key or os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase URL and key must be provided or set in environment variables")
    
    supabase = create_client(supabase_url, supabase_key)
    
    print(f"\n{'='*80}")
    print(f"Scraping games for {target_date} and uploading to Supabase Storage")
    print(f"{'='*80}\n")
    
    # Get games for the date
    df = get_games_for_date(target_date)
    if df is None or df.empty:
        print(f"⚠️ No games found for {target_date}")
        return {
            'success': True,
            'date': target_date,
            'games_found': 0,
            'games_processed': 0,
            'games_uploaded': 0,
            'errors': []
        }
    
    # Get unique game IDs
    games_info = get_unique_game_ids(df)
    print(f"Found {len(games_info)} games for {target_date}")
    
    games_processed = 0
    games_uploaded = 0
    errors = []
    
    # Process each game
    for idx, game_info in enumerate(games_info, 1):
        game_id = game_info['game_id']
        matchup = game_info['matchup']
        
        print(f"\n{'='*80}")
        print(f"Game {idx}/{len(games_info)}: {game_id}")
        print(f"Matchup: {matchup}")
        print(f"{'='*80}\n")
        
        try:
            # Get complete game data
            game_data = get_complete_game_data(game_id, df)
            
            if game_data:
                # Upload to storage
                if upload_to_storage(supabase, game_data, game_id):
                    games_uploaded += 1
                    print(f"✅ Successfully uploaded {game_id}")
                else:
                    errors.append(f"Failed to upload {game_id}")
                    print(f"❌ Failed to upload {game_id}")
                
                games_processed += 1
            else:
                errors.append(f"Failed to get data for {game_id}")
                print(f"❌ Failed to get game data for {game_id}")
        
        except Exception as e:
            error_msg = f"Error processing {game_id}: {str(e)}"
            errors.append(error_msg)
            print(f"❌ {error_msg}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*80}")
    print(f"Scraping complete for {target_date}")
    print(f"{'='*80}")
    print(f"Games found: {len(games_info)}")
    print(f"Games processed: {games_processed}")
    print(f"Games uploaded: {games_uploaded}")
    print(f"Errors: {len(errors)}")
    
    return {
        'success': len(errors) == 0,
        'date': target_date,
        'games_found': len(games_info),
        'games_processed': games_processed,
        'games_uploaded': games_uploaded,
        'errors': errors
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scrape_and_upload_to_storage.py YYYY-MM-DD")
        print("Example: python3 scrape_and_upload_to_storage.py 2025-11-28")
        sys.exit(1)
    
    target_date = sys.argv[1]
    validate_date(target_date)
    
    result = scrape_date_to_storage(target_date)
    
    if result['success']:
        print(f"\n✅ Successfully scraped and uploaded {result['games_uploaded']} games")
        sys.exit(0)
    else:
        print(f"\n⚠️ Completed with {len(result['errors'])} errors")
        sys.exit(1)

