#!/usr/bin/env python3
"""
Simple connection test
"""

from supabase import create_client
import os

# Get credentials from environment
SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def test_connection():
    print("🔌 Testing Supabase connection...")
    
    try:
        # Test basic connection
        result = supabase.table('players').select('id', count='exact').limit(1).execute()
        print(f"✅ Connection successful - found {result.count} players")
        
        # Test leagues table
        leagues_result = supabase.table('leagues').select('*', count='exact').execute()
        print(f"✅ Leagues table accessible - found {leagues_result.count} leagues")
        
        # Test fantasy_teams table
        teams_result = supabase.table('fantasy_teams').select('*', count='exact').execute()
        print(f"✅ Fantasy teams table accessible - found {teams_result.count} teams")
        
        # Test weekly_matchups table
        matchups_result = supabase.table('weekly_matchups').select('*', count='exact').execute()
        print(f"✅ Weekly matchups table accessible - found {matchups_result.count} matchups")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection()
