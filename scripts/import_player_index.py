#!/usr/bin/env python3
"""
NBA PlayerIndex Import Script

This script imports player data from the NBA API PlayerIndex endpoint
and updates the players table with additional fields not available
in the commonplayerinfo endpoint.

PlayerIndex provides:
- Player slugs for URLs
- Team slugs and cities
- Defunct team status
- Country information
- Roster status
- Current season stats (PTS, REB, AST)
- Stats timeframe information
"""

import os
import sys
import time
import traceback
from typing import Dict, List, Optional, Any
import requests
from supabase import create_client, Client
from nba_api.stats.endpoints.playerindex import PlayerIndex
from nba_api.stats.library.parameters import ActiveNullable, HistoricalNullable

# Configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: Missing required environment variables")
    print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def setup_supabase() -> Client:
    """Initialize and test Supabase connection"""
    try:
        # Test connection
        result = supabase.table('players').select('id').limit(1).execute()
        print("✅ Supabase connection successful")
        return supabase
    except Exception as e:
        print(f"❌ Supabase connection failed: {e}")
        sys.exit(1)

def fetch_player_index_data(active_only: bool = True, historical: bool = False) -> List[Dict[str, Any]]:
    """
    Fetch player data from NBA API PlayerIndex endpoint
    
    Args:
        active_only: If True, only fetch active players
        historical: If True, include historical players
    
    Returns:
        List of player dictionaries
    """
    try:
        print(f"🏀 Fetching PlayerIndex data (active_only={active_only}, historical={historical})...")
        
        # Set parameters
        active_nullable = ActiveNullable.active_player if active_only else ActiveNullable.all_player
        historical_nullable = HistoricalNullable.season if historical else HistoricalNullable.none
        
        # Create PlayerIndex instance
        player_index = PlayerIndex(
            active_nullable=active_nullable,
            historical_nullable=historical_nullable,
            timeout=30
        )
        
        # Get the data
        player_index_data = player_index.get_data_frames()[0]
        
        print(f"✅ Successfully fetched {len(player_index_data)} players from PlayerIndex")
        return player_index_data.to_dict('records')
        
    except Exception as e:
        print(f"❌ Error fetching PlayerIndex data: {e}")
        traceback.print_exc()
        return []

def parse_player_index_data(player_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse and clean PlayerIndex data for database insertion
    
    Args:
        player_data: Raw player data from NBA API
        
    Returns:
        Cleaned player data dictionary
    """
    try:
        # Extract and clean data
        def safe_str_clean(value):
            """Safely clean string values, handling None, float, and other types"""
            if value is None:
                return None
            if isinstance(value, (int, float)):
                return str(value) if value != 0 else None
            return str(value).strip() or None
        
        parsed_data = {
            'nba_player_id': int(player_data.get('PERSON_ID', 0)),
            'player_slug': safe_str_clean(player_data.get('PLAYER_SLUG')),
            # Include canonical team fields from PlayerIndex
            'team_id': int(player_data.get('TEAM_ID')) if player_data.get('TEAM_ID') not in (None, '') else None,
            'team_name': safe_str_clean(player_data.get('TEAM_NAME')),
            'team_abbreviation': safe_str_clean(player_data.get('TEAM_ABBREVIATION')),
            'team_slug': safe_str_clean(player_data.get('TEAM_SLUG')),
            'team_city': safe_str_clean(player_data.get('TEAM_CITY')),
            'is_defunct': bool(player_data.get('IS_DEFUNCT', False)),
            'country': safe_str_clean(player_data.get('COUNTRY')),
            'roster_status': safe_str_clean(player_data.get('ROSTER_STATUS')),
            'stats_timeframe': safe_str_clean(player_data.get('STATS_TIMEFRAME')),
        }
        
        # Handle current season stats (can be None or empty)
        current_pts = player_data.get('PTS')
        current_reb = player_data.get('REB')
        current_ast = player_data.get('AST')
        
        if current_pts is not None and current_pts != '':
            try:
                parsed_data['current_pts'] = float(current_pts)
            except (ValueError, TypeError):
                parsed_data['current_pts'] = None
        else:
            parsed_data['current_pts'] = None
            
        if current_reb is not None and current_reb != '':
            try:
                parsed_data['current_reb'] = float(current_reb)
            except (ValueError, TypeError):
                parsed_data['current_reb'] = None
        else:
            parsed_data['current_reb'] = None
            
        if current_ast is not None and current_ast != '':
            try:
                parsed_data['current_ast'] = float(current_ast)
            except (ValueError, TypeError):
                parsed_data['current_ast'] = None
        else:
            parsed_data['current_ast'] = None
        
        return parsed_data
        
    except Exception as e:
        print(f"❌ Error parsing player data: {e}")
        traceback.print_exc()
        return {}

def update_player_in_database(player_data: Dict[str, Any]) -> bool:
    """
    Update player record in database with PlayerIndex data
    
    Args:
        player_data: Parsed player data
        
    Returns:
        True if successful, False otherwise
    """
    try:
        nba_player_id = player_data.get('nba_player_id')
        if not nba_player_id:
            print("❌ Missing NBA player ID")
            return False
        
        # Update the player record
        result = supabase.table('players').update({
            'player_slug': player_data.get('player_slug'),
            # Update canonical team fields
            'team_id': player_data.get('team_id'),
            'team_name': player_data.get('team_name'),
            'team_abbreviation': player_data.get('team_abbreviation'),
            'team_slug': player_data.get('team_slug'),
            'team_city': player_data.get('team_city'),
            'is_defunct': player_data.get('is_defunct'),
            'country': player_data.get('country'),
            'roster_status': player_data.get('roster_status'),
            'current_pts': player_data.get('current_pts'),
            'current_reb': player_data.get('current_reb'),
            'current_ast': player_data.get('current_ast'),
            'stats_timeframe': player_data.get('stats_timeframe'),
        }).eq('nba_player_id', nba_player_id).execute()
        
        if result.data:
            return True
        else:
            print(f"⚠️  No player found with NBA ID {nba_player_id}")
            return False
            
    except Exception as e:
        print(f"❌ Error updating player {player_data.get('nba_player_id')}: {e}")
        return False

def import_player_index_data(active_only: bool = True, historical: bool = False) -> None:
    """
    Main function to import PlayerIndex data
    
    Args:
        active_only: If True, only import active players
        historical: If True, include historical players
    """
    print("🚀 Starting PlayerIndex import...")
    print(f"📊 Configuration: active_only={active_only}, historical={historical}")
    
    # Setup Supabase
    setup_supabase()
    
    # Fetch data from NBA API
    players_data = fetch_player_index_data(active_only, historical)
    
    if not players_data:
        print("❌ No player data received from NBA API")
        return
    
    # Process players
    successful_updates = 0
    failed_updates = 0
    not_found = 0
    
    print(f"📝 Processing {len(players_data)} players...")
    
    for i, player_data in enumerate(players_data, 1):
        try:
            # Parse the data
            parsed_data = parse_player_index_data(player_data)
            
            if not parsed_data:
                failed_updates += 1
                continue
            
            # Update in database
            if update_player_in_database(parsed_data):
                successful_updates += 1
            else:
                not_found += 1
            
            # Progress indicator
            if i % 100 == 0:
                print(f"📈 Progress: {i}/{len(players_data)} players processed")
            
            # Rate limiting
            time.sleep(0.1)  # 100ms delay between requests
            
        except Exception as e:
            print(f"❌ Error processing player {i}: {e}")
            failed_updates += 1
            continue
    
    # Summary
    print("\n" + "="*50)
    print("🎉 PlayerIndex Import Complete!")
    print(f"📊 Summary:")
    print(f"   Total players processed: {len(players_data)}")
    print(f"   ✅ Successful updates: {successful_updates}")
    print(f"   ⚠️  Players not found in DB: {not_found}")
    print(f"   ❌ Failed updates: {failed_updates}")
    print(f"   📈 Success rate: {(successful_updates / len(players_data) * 100):.1f}%")
    print("="*50)

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import NBA PlayerIndex data')
    parser.add_argument('--active-only', action='store_true', default=True,
                       help='Import only active players (default: True)')
    parser.add_argument('--include-historical', action='store_true', default=False,
                       help='Include historical players (default: False)')
    parser.add_argument('--all-players', action='store_true', default=False,
                       help='Import all players (active and historical)')
    
    args = parser.parse_args()
    
    # Determine import scope
    if args.all_players:
        active_only = False
        historical = True
    else:
        active_only = args.active_only
        historical = args.include_historical
    
    # Run import
    import_player_index_data(active_only=active_only, historical=historical)

if __name__ == "__main__":
    main()
