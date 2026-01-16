#!/usr/bin/env python3
"""
Fix player_props game_date values that were stored in UTC instead of EST
This script:
1. Finds all player_props with their associated games
2. Gets the correct game_date from nba_games (UTC timestamp)
3. Converts to EST date and updates player_props.game_date
"""

import os
import sys
from datetime import datetime
from supabase import create_client, Client
import pytz

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except:
    pass

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_KEY must be set")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def utc_to_est_date(utc_date_str: str) -> str:
    """Convert UTC date string to EST/EDT date string (YYYY-MM-DD)"""
    try:
        # Parse UTC datetime
        if isinstance(utc_date_str, str):
            if 'T' in utc_date_str:
                # Full timestamp
                utc_dt = datetime.fromisoformat(utc_date_str.replace('Z', '+00:00'))
            else:
                # Date only - treat as UTC midnight
                utc_dt = datetime.fromisoformat(utc_date_str + 'T00:00:00+00:00')
        else:
            return None
        
        # Convert to EST/EDT
        est_tz = pytz.timezone('America/New_York')
        est_dt = utc_dt.astimezone(est_tz)
        
        # Return date string in YYYY-MM-DD format
        return est_dt.strftime('%Y-%m-%d')
    except Exception as e:
        print(f"⚠️  Error converting UTC to EST: {utc_date_str}, {e}")
        return None

def fix_player_props_dates():
    """Fix game_date values in player_props and player_props_games"""
    print("🔍 Finding all player_props with their associated games...")
    
    # Get all player_props with their game relationships
    props_result = supabase.table('player_props') \
        .select('id, game_id, game_date, player_props_games(id, nba_game_id, game_date)') \
        .execute()
    
    if not props_result.data:
        print("⚠️  No player_props found")
        return
    
    print(f"📊 Found {len(props_result.data)} player_props to check")
    
    # Get all unique nba_game_ids
    nba_game_ids = set()
    for prop in props_result.data:
        props_game = prop.get('player_props_games')
        if props_game:
            if isinstance(props_game, list) and len(props_game) > 0:
                nba_game_id = props_game[0].get('nba_game_id')
            elif isinstance(props_game, dict):
                nba_game_id = props_game.get('nba_game_id')
            else:
                nba_game_id = None
            
            if nba_game_id:
                nba_game_ids.add(nba_game_id)
    
    print(f"📊 Found {len(nba_game_ids)} unique nba_game_ids")
    
    # Fetch game dates from nba_games
    if nba_game_ids:
        games_result = supabase.table('nba_games') \
            .select('game_id, game_date') \
            .in_('game_id', list(nba_game_ids)) \
            .execute()
        
        # Create a map of game_id -> game_date (UTC)
        game_date_map = {}
        for game in games_result.data:
            game_date_map[game['game_id']] = game['game_date']
        
        print(f"📊 Found {len(game_date_map)} games in nba_games")
    else:
        game_date_map = {}
    
    # Process each prop
    updated_props = 0
    updated_games = 0
    errors = 0
    
    for prop in props_result.data:
        prop_id = prop['id']
        current_game_date = prop.get('game_date')
        props_game = prop.get('player_props_games')
        
        # Get nba_game_id from the relationship
        nba_game_id = None
        props_game_id = None
        props_game_current_date = None
        
        if props_game:
            if isinstance(props_game, list) and len(props_game) > 0:
                props_game_obj = props_game[0]
                nba_game_id = props_game_obj.get('nba_game_id')
                props_game_id = props_game_obj.get('id')
                props_game_current_date = props_game_obj.get('game_date')
            elif isinstance(props_game, dict):
                nba_game_id = props_game.get('nba_game_id')
                props_game_id = props_game.get('id')
                props_game_current_date = props_game.get('game_date')
        
        # Get correct EST date
        correct_est_date = None
        
        if nba_game_id and nba_game_id in game_date_map:
            # Use game_date from nba_games (UTC timestamp)
            utc_game_date = game_date_map[nba_game_id]
            correct_est_date = utc_to_est_date(utc_game_date)
        elif props_game_current_date:
            # Try to convert the existing game_date (might be UTC timestamp)
            correct_est_date = utc_to_est_date(props_game_current_date)
        elif current_game_date:
            # Try to convert the prop's game_date
            correct_est_date = utc_to_est_date(current_game_date)
        
        if not correct_est_date:
            errors += 1
            continue
        
        # Update prop if date is wrong
        if current_game_date != correct_est_date:
            try:
                supabase.table('player_props') \
                    .update({'game_date': correct_est_date}) \
                    .eq('id', prop_id) \
                    .execute()
                updated_props += 1
                if updated_props % 100 == 0:
                    print(f"  ✅ Updated {updated_props} props...")
            except Exception as e:
                print(f"❌ Error updating prop {prop_id}: {e}")
                errors += 1
        
        # Update player_props_games if date is wrong
        if props_game_id and props_game_current_date != correct_est_date:
            try:
                supabase.table('player_props_games') \
                    .update({'game_date': correct_est_date}) \
                    .eq('id', props_game_id) \
                    .execute()
                updated_games += 1
            except Exception as e:
                print(f"❌ Error updating game {props_game_id}: {e}")
                errors += 1
    
    print(f"\n{'=' * 80}")
    print(f"✅ MIGRATION COMPLETE")
    print(f"   Props updated: {updated_props}")
    print(f"   Games updated: {updated_games}")
    print(f"   Errors: {errors}")
    print(f"{'=' * 80}\n")

if __name__ == "__main__":
    print("🚀 Starting player_props game_date fix...")
    print("=" * 80)
    fix_player_props_dates()
