#!/usr/bin/env python3
"""
Debug script to check NBA player ID mismatches
"""

import os
import sys
from datetime import datetime

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from nba_api.stats.endpoints import playergamelogs

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

def main():
    print("🔍 Debugging NBA Player ID mismatches...")
    
    # Setup
    supabase = setup_supabase()
    
    # Get sample players from database
    print("\n📋 Sample players from database:")
    result = supabase.table('players').select('nba_player_id, name').limit(10).execute()
    for player in result.data:
        print(f"   ID: {player['nba_player_id']}, Name: {player['name']}")
    
    # Get sample player IDs from NBA API
    print("\n🏀 Sample player IDs from NBA API:")
    try:
        game_logs = playergamelogs.PlayerGameLogs(
            season_nullable="2024-25",
            season_type_nullable="Regular Season"
        )
        
        game_logs_data = game_logs.get_data_frames()[0]
        
        # Get unique player IDs from API
        api_player_ids = game_logs_data['PLAYER_ID'].unique()[:10]
        api_player_names = game_logs_data['PLAYER_NAME'].unique()[:10]
        
        print("   API Player IDs:", api_player_ids.tolist())
        print("   API Player Names:", api_player_names.tolist())
        
        # Check if any match
        db_result = supabase.table('players').select('nba_player_id, name').execute()
        db_player_ids = {player['nba_player_id'] for player in db_result.data}
        
        matches = set(api_player_ids) & db_player_ids
        print(f"\n✅ Matching IDs: {matches}")
        print(f"❌ Non-matching API IDs: {set(api_player_ids) - db_player_ids}")
        
    except Exception as e:
        print(f"❌ Error getting API data: {e}")

if __name__ == "__main__":
    main()
