#!/usr/bin/env python3
"""
Generate matchups for existing leagues that don't have schedules yet
"""

from supabase import create_client
import os

# Get credentials from environment
SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def generate_matchups_for_league(league_id, league_name):
    print(f"\n🏀 Generating matchups for '{league_name}' (ID: {league_id[:8]}...)")
    
    try:
        # Check how many teams this league has
        teams_result = supabase.table('fantasy_teams').select('*', count='exact').eq('league_id', league_id).execute()
        team_count = teams_result.count
        print(f"   📊 League has {team_count} teams")
        
        if team_count < 2:
            print(f"   ❌ Cannot generate schedule - need at least 2 teams")
            return False
        
        # Check if matchups already exist
        matchups_result = supabase.table('weekly_matchups').select('*', count='exact').eq('league_id', league_id).execute()
        existing_matchups = matchups_result.count
        print(f"   📅 Currently has {existing_matchups} matchups")
        
        if existing_matchups > 0:
            print(f"   ⚠️  League already has matchups - skipping")
            return True
        
        # Generate the schedule
        print(f"   🚀 Generating schedule...")
        result = supabase.rpc('generate_league_schedule', {
            'league_id_param': league_id,
            'regular_season_weeks_param': 18,
            'playoff_teams_param': 6,
            'playoff_weeks_param': 3,
            'season_start_date_param': '2025-01-02'
        }).execute()
        
        print(f"   ✅ Schedule generation completed: {result.data}")
        
        # Verify matchups were created
        new_matchups_result = supabase.table('weekly_matchups').select('*', count='exact').eq('league_id', league_id).execute()
        new_matchups = new_matchups_result.count
        print(f"   📅 Now has {new_matchups} matchups")
        
        # Show sample matchups
        if new_matchups > 0:
            sample_matchups = supabase.table('weekly_matchups').select('week_number, season_type, status').eq('league_id', league_id).limit(5).execute()
            print(f"   📋 Sample matchups:")
            for matchup in sample_matchups.data:
                print(f"      • Week {matchup['week_number']} ({matchup['season_type']}) - {matchup['status']}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error generating matchups: {e}")
        return False

def main():
    print("🚀 Generating matchups for existing leagues...\n")
    
    # Get all leagues
    leagues_result = supabase.table('leagues').select('id, name, max_teams').execute()
    
    if not leagues_result.data:
        print("❌ No leagues found")
        return
    
    print(f"📋 Found {len(leagues_result.data)} leagues:")
    
    success_count = 0
    for league in leagues_result.data:
        league_id = league['id']
        league_name = league['name']
        max_teams = league['max_teams']
        
        print(f"   • {league_name} (Max teams: {max_teams})")
        
        if generate_matchups_for_league(league_id, league_name):
            success_count += 1
    
    print(f"\n🏁 Completed! Successfully generated matchups for {success_count}/{len(leagues_result.data)} leagues")

if __name__ == "__main__":
    main()
