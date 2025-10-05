#!/usr/bin/env python3
"""
Test the Edge Function directly to see what error it's returning
"""

from supabase import create_client
import os
import json

# Get credentials from environment
SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def test_edge_function():
    print("🧪 Testing Edge Function directly...")
    
    try:
        # Test the Edge Function with the same data the frontend is sending
        result = supabase.functions.invoke('create-league', {
            'body': {
                'name': 'Test League',
                'description': 'Test Description',
                'maxTeams': 4,
                'scoringType': 'H2H_Points',
                'teamName': 'Test Team',
                'rosterConfig': {
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
            }
        })
        
        print("✅ Edge Function call successful")
        print(f"   Result: {result}")
        
    except Exception as e:
        print(f"❌ Edge Function call failed: {e}")
        print(f"   Error type: {type(e)}")
        print(f"   Error details: {str(e)}")
        
        # Try to get more details about the error
        if hasattr(e, 'details'):
            print(f"   Error details: {e.details}")
        if hasattr(e, 'message'):
            print(f"   Error message: {e.message}")

def test_database_function():
    print("\n🧪 Testing database function directly...")
    
    try:
        # Test the database function directly
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
        
        print("✅ Database function call successful")
        print(f"   Result: {result.data}")
        
        # Clean up the test league
        if result.data:
            supabase.table('leagues').delete().eq('id', result.data).execute()
            print("   ✅ Test league cleaned up")
        
    except Exception as e:
        print(f"❌ Database function call failed: {e}")
        print(f"   Error type: {type(e)}")
        print(f"   Error details: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting Edge Function and Database tests...\n")
    
    test_database_function()
    test_edge_function()
    
    print("\n🏁 Tests completed!")
