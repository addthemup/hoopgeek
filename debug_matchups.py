#!/usr/bin/env python3
"""
Debug script to check if matchups exist in the database
"""

from supabase import create_client
import os

# Get credentials from environment
SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_matchups():
    print("🔍 Checking for matchups in database...")
    
    # Check if weekly_matchups table exists and has data
    try:
        result = supabase.table('weekly_matchups').select('*', count='exact').execute()
        print(f"✅ weekly_matchups table exists with {result.count} total matchups")
        
        if result.count > 0:
            # Show sample matchups
            sample = supabase.table('weekly_matchups').select('*').limit(5).execute()
            print("\n📋 Sample matchups:")
            for matchup in sample.data:
                print(f"  • Week {matchup['week_number']}: {matchup['fantasy_team1_id']} vs {matchup['fantasy_team2_id']} ({matchup['status']})")
        else:
            print("❌ No matchups found in database")
            
    except Exception as e:
        print(f"❌ Error checking matchups: {e}")
    
    # Check leagues
    try:
        leagues_result = supabase.table('leagues').select('*', count='exact').execute()
        print(f"\n🏀 Found {leagues_result.count} leagues")
        
        if leagues_result.count > 0:
            # Show sample leagues
            sample_leagues = supabase.table('leagues').select('id, name, max_teams, created_at').limit(3).execute()
            print("\n📋 Sample leagues:")
            for league in sample_leagues.data:
                print(f"  • {league['name']} (ID: {league['id'][:8]}..., Teams: {league['max_teams']})")
                
                # Check matchups for this league
                league_matchups = supabase.table('weekly_matchups').select('*', count='exact').eq('league_id', league['id']).execute()
                print(f"    └─ {league_matchups.count} matchups for this league")
                
    except Exception as e:
        print(f"❌ Error checking leagues: {e}")
    
    # Check fantasy teams
    try:
        teams_result = supabase.table('fantasy_teams').select('*', count='exact').execute()
        print(f"\n👥 Found {teams_result.count} fantasy teams")
        
        if teams_result.count > 0:
            # Show sample teams
            sample_teams = supabase.table('fantasy_teams').select('id, team_name, league_id, user_id').limit(5).execute()
            print("\n📋 Sample teams:")
            for team in sample_teams.data:
                owner_status = "Has Owner" if team['user_id'] else "No Owner"
                print(f"  • {team['team_name']} (League: {team['league_id'][:8]}..., {owner_status})")
                
    except Exception as e:
        print(f"❌ Error checking teams: {e}")

if __name__ == "__main__":
    check_matchups()
