#!/usr/bin/env python3
"""
Import missing active players from 2024-25 season
"""

import os
import sys
from datetime import datetime

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from nba_api.stats.endpoints import playergamelogs, playerindex

def get_supabase_credentials():
    """Get Supabase credentials from environment variables"""
    url = os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        sys.exit(1)
    
    return url, key

def setup_supabase():
    """Initialize Supabase client"""
    url, key = get_supabase_credentials()
    supabase: Client = create_client(url, key)
    return supabase

def safe_int(value):
    """Safely convert value to integer"""
    if value is None or value == '' or value == 'None':
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None

def safe_str(value):
    """Safely convert value to string"""
    if value is None:
        return None
    return str(value).strip()

def main():
    print("🚀 Importing missing active players from 2024-25 season...")
    
    # Setup
    supabase = setup_supabase()
    
    try:
        # Get player game logs to find active players
        print("📊 Getting active players from 2024-25 game logs...")
        game_logs = playergamelogs.PlayerGameLogs(
            season_nullable="2024-25",
            season_type_nullable="Regular Season"
        )
        
        game_logs_data = game_logs.get_data_frames()[0]
        
        # Get unique active player IDs
        active_player_ids = game_logs_data['PLAYER_ID'].unique()
        print(f"✅ Found {len(active_player_ids)} active players in 2024-25")
        
        # Get existing players from database
        db_result = supabase.table('players').select('nba_player_id').execute()
        existing_player_ids = {player['nba_player_id'] for player in db_result.data}
        
        # Find missing players
        missing_player_ids = set(active_player_ids) - existing_player_ids
        print(f"📋 Found {len(missing_player_ids)} missing players")
        
        if not missing_player_ids:
            print("✅ All active players already in database!")
            return
        
        # Get player details from PlayerIndex
        print("📊 Getting player details from PlayerIndex...")
        player_index = playerindex.PlayerIndex(
            active_nullable="Y"  # Only active players
        )
        
        player_data = player_index.get_data_frames()[0]
        
        # Filter for missing players
        missing_players = player_data[player_data['PERSON_ID'].isin(missing_player_ids)]
        print(f"📋 Found details for {len(missing_players)} missing players")
        
        # Import missing players
        print("💾 Importing missing players...")
        players_to_import = []
        
        for _, row in missing_players.iterrows():
            player = {
                'nba_player_id': safe_int(row.get('PERSON_ID')),
                'name': safe_str(row.get('PLAYER_LAST_NAME')) + ', ' + safe_str(row.get('PLAYER_FIRST_NAME')),
                'first_name': safe_str(row.get('PLAYER_FIRST_NAME')),
                'last_name': safe_str(row.get('PLAYER_LAST_NAME')),
                'player_slug': safe_str(row.get('PLAYER_SLUG')),
                'position': safe_str(row.get('POSITION')),
                'team_id': safe_int(row.get('TEAM_ID')),
                'team_name': safe_str(row.get('TEAM_NAME')),
                'team_abbreviation': safe_str(row.get('TEAM_ABBREVIATION')),
                'team_slug': safe_str(row.get('TEAM_SLUG')),
                'team_city': safe_str(row.get('TEAM_CITY')),
                'is_defunct': bool(row.get('IS_DEFUNCT', False)),
                'jersey_number': safe_str(row.get('JERSEY_NUMBER')),
                'height': safe_str(row.get('HEIGHT')),
                'weight': safe_int(row.get('WEIGHT')),
                'college': safe_str(row.get('COLLEGE')),
                'country': safe_str(row.get('COUNTRY')),
                'draft_year': safe_int(row.get('DRAFT_YEAR')),
                'draft_round': safe_int(row.get('DRAFT_ROUND')),
                'draft_number': safe_int(row.get('DRAFT_NUMBER')),
                'roster_status': safe_str(row.get('ROSTER_STATUS')),
                'is_active': True,
                'is_rookie': False,  # Will be determined by draft year
            }
            players_to_import.append(player)
        
        # Import to database
        if players_to_import:
            result = supabase.table('players').upsert(
                players_to_import,
                on_conflict='nba_player_id'
            ).execute()
            
            print(f"✅ Successfully imported {len(result.data)} missing players")
            
            # Show some examples
            print("\n📋 Sample imported players:")
            for player in players_to_import[:5]:
                print(f"   • {player['name']} ({player['team_abbreviation']}) - ID: {player['nba_player_id']}")
        
    except Exception as e:
        print(f"❌ Error importing missing players: {e}")

if __name__ == "__main__":
    main()
