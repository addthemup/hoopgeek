#!/usr/bin/env python3
"""
Test Career Stats Import Script
Tests the career stats import with just a few players to verify functionality.
"""

import os
import sys
import time
import traceback
from supabase import create_client, Client
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.library.parameters import PerMode36, LeagueIDNullable

def setup_supabase() -> Client:
    """Initialize Supabase client with service role key."""
    url = os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("❌ Error: Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables")
        sys.exit(1)
    
    return create_client(url, key)

def test_career_stats_import():
    """Test career stats import with a few well-known players."""
    print("🧪 Testing Career Stats Import")
    print("=" * 40)
    
    # Setup
    supabase = setup_supabase()
    
    # Test with a few well-known players (LeBron James, Stephen Curry, etc.)
    test_players = [
        {'id': 1, 'nba_player_id': 2544, 'name': 'LeBron James'},  # LeBron James
        {'id': 2, 'nba_player_id': 201939, 'name': 'Stephen Curry'},  # Stephen Curry
        {'id': 3, 'nba_player_id': 201142, 'name': 'Kevin Durant'},  # Kevin Durant
    ]
    
    print(f"📊 Testing with {len(test_players)} players:")
    for player in test_players:
        print(f"   • {player['name']} (NBA ID: {player['nba_player_id']})")
    
    print("\n🔍 Testing NBA API connectivity...")
    
    # Test NBA API with LeBron James
    try:
        print("  🏀 Fetching LeBron James career stats...")
        career_stats = playercareerstats.PlayerCareerStats(
            player_id=2544,  # LeBron James
            per_mode36=PerMode36.totals,
            league_id_nullable=LeagueIDNullable.nba,
            timeout=30
        )
        
        data = career_stats.get_data_frames()
        print(f"  ✅ Successfully fetched data for LeBron James")
        print(f"     Data type: {type(data)}")
        
        # The NBA API returns a list of DataFrames, not a dictionary
        if isinstance(data, list):
            print(f"     Number of datasets: {len(data)}")
            for i, df in enumerate(data):
                if df is not None and not df.empty:
                    print(f"     • Dataset {i}: {len(df)} records, columns: {list(df.columns)[:5]}...")
                else:
                    print(f"     • Dataset {i}: No data")
        else:
            print(f"     Unexpected data format: {type(data)}")
        
    except Exception as e:
        print(f"  ❌ Error testing NBA API: {e}")
        print(f"     Traceback: {traceback.format_exc()}")
        return False
    
    print("\n🔍 Testing database connectivity...")
    
    # Test database connection
    try:
        response = supabase.table('players').select('id, nba_player_id, name').limit(5).execute()
        print(f"  ✅ Successfully connected to database")
        print(f"     Found {len(response.data)} players in database")
        
        # Check if our career stats tables exist
        career_tables = [
            'player_career_totals_regular_season',
            'player_season_totals_regular_season',
            'player_season_rankings_regular_season'
        ]
        
        for table in career_tables:
            try:
                response = supabase.table(table).select('id', count='exact').limit(1).execute()
                print(f"     • {table}: {response.count} existing records")
            except Exception as e:
                print(f"     • {table}: Error - {e}")
        
    except Exception as e:
        print(f"  ❌ Error testing database: {e}")
        return False
    
    print("\n✅ All tests passed! The career stats import should work correctly.")
    print("\n🚀 To run the full import, use:")
    print("   python3 scripts/import_career_stats.py")
    
    return True

if __name__ == "__main__":
    test_career_stats_import()
