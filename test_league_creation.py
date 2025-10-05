#!/usr/bin/env python3
"""
Test script to debug league creation and schedule generation
"""

from supabase import create_client
import os

# Get credentials from environment
SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def test_schedule_generation():
    print("🧪 Testing schedule generation function...")
    
    # First, let's test if the function exists
    try:
        # Test with a dummy league ID to see if the function exists
        result = supabase.rpc('generate_league_schedule', {
            'league_id_param': '00000000-0000-0000-0000-000000000000',
            'regular_season_weeks_param': 18,
            'playoff_teams_param': 6,
            'playoff_weeks_param': 3,
            'season_start_date_param': '2025-01-02'
        }).execute()
        
        print("✅ generate_league_schedule function exists and is callable")
        
    except Exception as e:
        print(f"❌ Error calling generate_league_schedule: {e}")
        print("   This means the function doesn't exist or has an error")
        return False
    
    return True

def test_league_creation_function():
    print("\n🧪 Testing create_league_with_commissioner function...")
    
    try:
        # Test if the function exists by calling it with minimal params
        result = supabase.rpc('create_league_with_commissioner', {
            'league_name': 'Test League',
            'league_description': 'Test Description',
            'max_teams_count': 4,
            'scoring_type_val': 'H2H_Points',
            'team_name_val': 'Test Team',
            'salary_cap_enabled_val': True,
            'salary_cap_amount_val': 100000000,
            'lineup_frequency_val': 'daily',
            'roster_config': {
                "PG": 1,
                "SG": 1,
                "SF": 1,
                "PF": 1,
                "C": 1,
                "G": 1,
                "F": 1,
                "UTIL": 3,
                "BENCH": 3,
                "IR": 1
            }
        }).execute()
        
        print("✅ create_league_with_commissioner function exists and works")
        print(f"   Created league ID: {result.data}")
        
        # Check if matchups were created
        league_id = result.data
        matchups = supabase.table('weekly_matchups').select('*', count='exact').eq('league_id', league_id).execute()
        print(f"   Generated {matchups.count} matchups for the test league")
        
        # Clean up the test league
        supabase.table('leagues').delete().eq('id', league_id).execute()
        print("   ✅ Test league cleaned up")
        
        return True
        
    except Exception as e:
        print(f"❌ Error calling create_league_with_commissioner: {e}")
        print("   This means the function doesn't exist or has an error")
        return False

def check_database_schema():
    print("\n🔍 Checking database schema...")
    
    # Check if all required tables exist
    tables_to_check = [
        'leagues',
        'fantasy_teams', 
        'weekly_matchups',
        'league_schedule_settings',
        'roster_spots',
        'fantasy_team_players'
    ]
    
    for table in tables_to_check:
        try:
            result = supabase.table(table).select('*', count='exact').limit(1).execute()
            print(f"✅ {table} table exists")
        except Exception as e:
            print(f"❌ {table} table missing or error: {e}")

if __name__ == "__main__":
    print("🚀 Starting database function tests...\n")
    
    check_database_schema()
    
    if test_schedule_generation():
        test_league_creation_function()
    
    print("\n🏁 Tests completed!")
