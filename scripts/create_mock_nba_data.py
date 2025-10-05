#!/usr/bin/env python3
"""
Create Mock NBA Data for Testing
Creates sample NBA games and season weeks data for testing the database schema
"""

import os
import sys
from datetime import datetime, date, timedelta

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client

def get_supabase_credentials():
    """Get Supabase credentials from environment variables"""
    url = os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('VITE_SUPABASE_ANON_KEY')
    
    if not url or not key:
        print("❌ Missing Supabase credentials in environment variables")
        print("Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY")
        sys.exit(1)
    
    return url, key

def setup_supabase():
    """Initialize Supabase client"""
    url, key = get_supabase_credentials()
    supabase: Client = create_client(url, key)
    return supabase

def create_mock_nba_games():
    """Create mock NBA games data"""
    print("🏀 Creating mock NBA games data...")
    
    # Sample NBA teams
    teams = [
        {"id": 1, "name": "Los Angeles Lakers", "city": "Los Angeles", "tricode": "LAL"},
        {"id": 2, "name": "Golden State Warriors", "city": "San Francisco", "tricode": "GSW"},
        {"id": 3, "name": "Boston Celtics", "city": "Boston", "tricode": "BOS"},
        {"id": 4, "name": "Miami Heat", "city": "Miami", "tricode": "MIA"},
        {"id": 5, "name": "Denver Nuggets", "city": "Denver", "tricode": "DEN"},
        {"id": 6, "name": "Phoenix Suns", "city": "Phoenix", "tricode": "PHX"},
    ]
    
    games = []
    game_id = 1000000
    
    # Create games for the next 30 days
    for day in range(30):
        game_date = date.today() + timedelta(days=day)
        
        # Create 3 games per day
        for game_num in range(3):
            home_team = teams[game_num * 2]
            away_team = teams[game_num * 2 + 1]
            
            game = {
                'league_id': 0,
                'season_year': 2025,
                'game_date': game_date.isoformat(),
                'game_id': str(game_id),
                'game_code': f"NBA{game_id}",
                'game_status': 1,  # 1=Not Started
                'game_status_text': 'Scheduled',
                'game_sequence': 1,
                'home_team_id': home_team['id'],
                'home_team_name': home_team['name'],
                'home_team_city': home_team['city'],
                'home_team_tricode': home_team['tricode'],
                'home_team_score': 0,
                'away_team_id': away_team['id'],
                'away_team_name': away_team['name'],
                'away_team_city': away_team['city'],
                'away_team_tricode': away_team['tricode'],
                'away_team_score': 0,
                'week_number': (day // 7) + 1,
                'week_name': f'Week {(day // 7) + 1}',
                'arena_name': f"{home_team['city']} Arena",
                'arena_city': home_team['city'],
                'arena_state': 'CA' if 'Los Angeles' in home_team['city'] or 'San Francisco' in home_team['city'] else 'FL' if 'Miami' in home_team['city'] else 'MA' if 'Boston' in home_team['city'] else 'CO' if 'Denver' in home_team['city'] else 'AZ',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            games.append(game)
            game_id += 1
    
    return games

def create_mock_season_weeks():
    """Create mock season weeks data"""
    print("📅 Creating mock season weeks data...")
    
    weeks = []
    for week_num in range(1, 27):
        start_date = date(2025, 1, 1) + timedelta(weeks=week_num-1)
        end_date = start_date + timedelta(days=6)
        
        week_data = {
            'league_id': 0,
            'season_year': 2025,
            'week_number': week_num,
            'week_name': f'Week {week_num}',
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        weeks.append(week_data)
    
    return weeks

def import_mock_data(supabase, games_data, weeks_data):
    """Import mock data to the database"""
    print("💾 Importing mock data to database...")
    
    try:
        # Import games
        print(f"📊 Importing {len(games_data)} mock games...")
        games_result = supabase.table('nba_games').upsert(
            games_data,
            on_conflict='game_id'
        ).execute()
        
        print(f"✅ Successfully imported {len(games_result.data)} games")
        
        # Import weeks
        print(f"📅 Importing {len(weeks_data)} season weeks...")
        weeks_result = supabase.table('nba_season_weeks').upsert(
            weeks_data,
            on_conflict='league_id,season_year,week_number'
        ).execute()
        
        print(f"✅ Successfully imported {len(weeks_result.data)} season weeks")
        
        return len(games_result.data), len(weeks_result.data)
        
    except Exception as e:
        print(f"❌ Error importing mock data: {e}")
        return 0, 0

def main():
    """Main function"""
    print("🚀 Creating Mock NBA Data for Testing")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    print("✅ Supabase client initialized")
    
    # Create mock data
    games_data = create_mock_nba_games()
    weeks_data = create_mock_season_weeks()
    
    # Import data
    games_imported, weeks_imported = import_mock_data(supabase, games_data, weeks_data)
    
    print("=" * 80)
    print("🎉 Mock NBA Data Creation Completed!")
    print(f"📊 Games imported: {games_imported}")
    print(f"📅 Season weeks imported: {weeks_imported}")

if __name__ == "__main__":
    main()
