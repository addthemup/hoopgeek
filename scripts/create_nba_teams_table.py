#!/usr/bin/env python3
"""
Create NBA teams table and populate it with data
"""

from supabase import create_client

# Configuration
SUPABASE_URL = "https://lsnqmdeagfzuvrypiiwi.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbnFtZGVhZ2Z6dXZyeXBpaXdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI1MTU5MSwiZXhwIjoyMDc0ODI3NTkxfQ.uOD1oFhjd6ISP7XJu7OtYYG_SwU7uZR74h8byY3HNPo"

def main():
    print("🚀 Creating NBA Teams Table")
    print("=" * 40)
    
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Supabase client initialized")
        
        # NBA teams data
        nba_teams_data = [
            {"nba_team_id": 1610612737, "team_name": "Atlanta Hawks", "team_abbreviation": "ATL", "team_city": "Atlanta", "team_code": "hawks", "conference": "Eastern", "division": "Southeast"},
            {"nba_team_id": 1610612738, "team_name": "Boston Celtics", "team_abbreviation": "BOS", "team_city": "Boston", "team_code": "celtics", "conference": "Eastern", "division": "Atlantic"},
            {"nba_team_id": 1610612739, "team_name": "Cleveland Cavaliers", "team_abbreviation": "CLE", "team_city": "Cleveland", "team_code": "cavaliers", "conference": "Eastern", "division": "Central"},
            {"nba_team_id": 1610612740, "team_name": "New Orleans Pelicans", "team_abbreviation": "NOP", "team_city": "New Orleans", "team_code": "pelicans", "conference": "Western", "division": "Southwest"},
            {"nba_team_id": 1610612741, "team_name": "Chicago Bulls", "team_abbreviation": "CHI", "team_city": "Chicago", "team_code": "bulls", "conference": "Eastern", "division": "Central"},
            {"nba_team_id": 1610612742, "team_name": "Dallas Mavericks", "team_abbreviation": "DAL", "team_city": "Dallas", "team_code": "mavericks", "conference": "Western", "division": "Southwest"},
            {"nba_team_id": 1610612743, "team_name": "Denver Nuggets", "team_abbreviation": "DEN", "team_city": "Denver", "team_code": "nuggets", "conference": "Western", "division": "Northwest"},
            {"nba_team_id": 1610612744, "team_name": "Golden State Warriors", "team_abbreviation": "GSW", "team_city": "San Francisco", "team_code": "warriors", "conference": "Western", "division": "Pacific"},
            {"nba_team_id": 1610612745, "team_name": "Houston Rockets", "team_abbreviation": "HOU", "team_city": "Houston", "team_code": "rockets", "conference": "Western", "division": "Southwest"},
            {"nba_team_id": 1610612746, "team_name": "LA Clippers", "team_abbreviation": "LAC", "team_city": "Los Angeles", "team_code": "clippers", "conference": "Western", "division": "Pacific"},
            {"nba_team_id": 1610612747, "team_name": "Los Angeles Lakers", "team_abbreviation": "LAL", "team_city": "Los Angeles", "team_code": "lakers", "conference": "Western", "division": "Pacific"},
            {"nba_team_id": 1610612748, "team_name": "Miami Heat", "team_abbreviation": "MIA", "team_city": "Miami", "team_code": "heat", "conference": "Eastern", "division": "Southeast"},
            {"nba_team_id": 1610612749, "team_name": "Milwaukee Bucks", "team_abbreviation": "MIL", "team_city": "Milwaukee", "team_code": "bucks", "conference": "Eastern", "division": "Central"},
            {"nba_team_id": 1610612750, "team_name": "Minnesota Timberwolves", "team_abbreviation": "MIN", "team_city": "Minneapolis", "team_code": "timberwolves", "conference": "Western", "division": "Northwest"},
            {"nba_team_id": 1610612751, "team_name": "Brooklyn Nets", "team_abbreviation": "BKN", "team_city": "Brooklyn", "team_code": "nets", "conference": "Eastern", "division": "Atlantic"},
            {"nba_team_id": 1610612752, "team_name": "New York Knicks", "team_abbreviation": "NYK", "team_city": "New York", "team_code": "knicks", "conference": "Eastern", "division": "Atlantic"},
            {"nba_team_id": 1610612753, "team_name": "Orlando Magic", "team_abbreviation": "ORL", "team_city": "Orlando", "team_code": "magic", "conference": "Eastern", "division": "Southeast"},
            {"nba_team_id": 1610612754, "team_name": "Indiana Pacers", "team_abbreviation": "IND", "team_city": "Indianapolis", "team_code": "pacers", "conference": "Eastern", "division": "Central"},
            {"nba_team_id": 1610612755, "team_name": "Philadelphia 76ers", "team_abbreviation": "PHI", "team_city": "Philadelphia", "team_code": "sixers", "conference": "Eastern", "division": "Atlantic"},
            {"nba_team_id": 1610612756, "team_name": "Phoenix Suns", "team_abbreviation": "PHX", "team_city": "Phoenix", "team_code": "suns", "conference": "Western", "division": "Pacific"},
            {"nba_team_id": 1610612757, "team_name": "Portland Trail Blazers", "team_abbreviation": "POR", "team_city": "Portland", "team_code": "blazers", "conference": "Western", "division": "Northwest"},
            {"nba_team_id": 1610612758, "team_name": "Sacramento Kings", "team_abbreviation": "SAC", "team_city": "Sacramento", "team_code": "kings", "conference": "Western", "division": "Pacific"},
            {"nba_team_id": 1610612759, "team_name": "San Antonio Spurs", "team_abbreviation": "SAS", "team_city": "San Antonio", "team_code": "spurs", "conference": "Western", "division": "Southwest"},
            {"nba_team_id": 1610612760, "team_name": "Oklahoma City Thunder", "team_abbreviation": "OKC", "team_city": "Oklahoma City", "team_code": "thunder", "conference": "Western", "division": "Northwest"},
            {"nba_team_id": 1610612761, "team_name": "Toronto Raptors", "team_abbreviation": "TOR", "team_city": "Toronto", "team_code": "raptors", "conference": "Eastern", "division": "Atlantic"},
            {"nba_team_id": 1610612762, "team_name": "Utah Jazz", "team_abbreviation": "UTA", "team_city": "Salt Lake City", "team_code": "jazz", "conference": "Western", "division": "Northwest"},
            {"nba_team_id": 1610612763, "team_name": "Memphis Grizzlies", "team_abbreviation": "MEM", "team_city": "Memphis", "team_code": "grizzlies", "conference": "Western", "division": "Southwest"},
            {"nba_team_id": 1610612764, "team_name": "Washington Wizards", "team_abbreviation": "WAS", "team_city": "Washington", "team_code": "wizards", "conference": "Eastern", "division": "Southeast"},
            {"nba_team_id": 1610612765, "team_name": "Detroit Pistons", "team_abbreviation": "DET", "team_city": "Detroit", "team_code": "pistons", "conference": "Eastern", "division": "Central"},
            {"nba_team_id": 1610612766, "team_name": "Charlotte Hornets", "team_abbreviation": "CHA", "team_city": "Charlotte", "team_code": "hornets", "conference": "Eastern", "division": "Southeast"}
        ]
        
        print(f"📊 Inserting {len(nba_teams_data)} NBA teams...")
        
        # Try to insert teams (this will create the table if it doesn't exist)
        inserted_count = 0
        for team in nba_teams_data:
            try:
                result = supabase.table('nba_teams').upsert(team).execute()
                inserted_count += 1
                print(f"   ✅ {team['team_name']} ({team['team_abbreviation']})")
            except Exception as e:
                print(f"   ⚠️  {team['team_name']}: {e}")
        
        print(f"\n✅ Successfully inserted {inserted_count}/{len(nba_teams_data)} NBA teams")
        
        # Verify the data
        try:
            teams_result = supabase.table('nba_teams').select('*').execute()
            print(f"🔍 Verification: {len(teams_result.data)} teams in database")
            
            # Show sample teams
            print("\n📋 Sample teams:")
            for team in teams_result.data[:5]:
                print(f"   • {team['team_name']} ({team['team_abbreviation']}) - {team['conference']} {team['division']}")
                
        except Exception as e:
            print(f"❌ Verification failed: {e}")
        
    except Exception as e:
        print(f"❌ Failed to create NBA teams: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
