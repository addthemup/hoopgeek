#!/usr/bin/env python3
"""
NBA Schedule Import Script
Imports NBA game schedule with proper times from official NBA API
"""

import os
import sys
import requests
from datetime import datetime
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client

def get_supabase_credentials():
    """Get Supabase credentials from environment variables"""
    url = os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return url, key

def fetch_nba_schedule():
    """Fetch NBA schedule from official NBA API"""
    print("🏀 Fetching NBA schedule from official API...")
    
    # NBA's official schedule endpoint
    url = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_9.json"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        print(f"✅ Successfully fetched schedule data")
        return data
    except Exception as e:
        print(f"❌ Error fetching schedule: {e}")
        return None

def transform_nba_game(game):
    """Transform NBA API game data to our database format"""
    try:
        # Use gameDateTimeUTC which is the correct UTC timestamp
        game_datetime_utc = game.get('gameDateTimeUTC')
        
        # Parse the UTC datetime
        if game_datetime_utc:
            game_date = datetime.fromisoformat(game_datetime_utc.replace('Z', '+00:00'))
        else:
            # Fallback to gameDateEst if UTC not available
            game_date = datetime.fromisoformat(game.get('gameDateEst', '').replace('Z', '+00:00'))
        
        home_team = game.get('homeTeam', {})
        away_team = game.get('awayTeam', {})
        
        game_data = {
            'league_id': 0,  # NBA
            'season_year': 2025,  # 2024-25 season
            'game_id': game.get('gameId'),
            'game_code': game.get('gameCode'),
            'game_date': game_date.isoformat(),  # Proper UTC timestamp
            'game_status': game.get('gameStatus', 1),
            'game_status_text': game.get('gameStatusText', 'Scheduled'),
            'game_sequence': game.get('gameSequence', 1),
            
            # Home team
            'home_team_id': home_team.get('teamId'),
            'home_team_name': home_team.get('teamName'),
            'home_team_city': home_team.get('teamCity'),
            'home_team_tricode': home_team.get('teamTricode'),
            'home_team_score': home_team.get('score', 0),
            
            # Away team
            'away_team_id': away_team.get('teamId'),
            'away_team_name': away_team.get('teamName'),
            'away_team_city': away_team.get('teamCity'),
            'away_team_tricode': away_team.get('teamTricode'),
            'away_team_score': away_team.get('score', 0),
            
            # Additional info
            'week_number': game.get('weekNumber'),
            'week_name': game.get('weekName'),
            'arena_name': game.get('arenaName'),
            'arena_city': game.get('arenaCity'),
            'arena_state': game.get('arenaState', ''),
            
            # Timestamps
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        return game_data
        
    except Exception as e:
        print(f"⚠️ Error transforming game {game.get('gameId')}: {e}")
        return None

def import_games(supabase, schedule_data, filter_future_only=False):
    """Import games from schedule data"""
    if not schedule_data:
        print("❌ No schedule data to import")
        return 0
    
    league_schedule = schedule_data.get('leagueSchedule', {})
    game_dates = league_schedule.get('gameDates', [])
    
    all_games = []
    today = datetime.now()
    
    for game_date in game_dates:
        games = game_date.get('games', [])
        for game in games:
            game_data = transform_nba_game(game)
            if game_data:
                # Optional: only import future games for DFS
                if filter_future_only:
                    game_datetime = datetime.fromisoformat(game_data['game_date'])
                    if game_datetime < today:
                        continue
                
                all_games.append(game_data)
    
    if not all_games:
        print("⚠️ No games to import")
        return 0
    
    print(f"💾 Importing {len(all_games)} games...")
    
    try:
        # Batch upsert games
        batch_size = 50
        imported_count = 0
        
        for i in range(0, len(all_games), batch_size):
            batch = all_games[i:i + batch_size]
            result = supabase.table('nba_games').upsert(
                batch,
                on_conflict='game_id'
            ).execute()
            imported_count += len(result.data)
            print(f"  Imported batch {i//batch_size + 1}: {len(result.data)} games")
        
        print(f"✅ Successfully imported {imported_count} games")
        return imported_count
        
    except Exception as e:
        print(f"❌ Error importing games: {e}")
        print(f"Error details: {str(e)}")
        return 0

def main():
    """Main import function"""
    print("🚀 Starting NBA Schedule Import")
    print("=" * 80)
    
    # Setup Supabase
    url, key = get_supabase_credentials()
    supabase = create_client(url, key)
    print("✅ Supabase client initialized")
    
    # Fetch schedule
    schedule_data = fetch_nba_schedule()
    
    if schedule_data:
        # Import all games (or set filter_future_only=True for only future games)
        games_imported = import_games(supabase, schedule_data, filter_future_only=False)
        
        print("=" * 80)
        print("🎉 NBA Schedule Import Completed!")
        print(f"📊 Games imported: {games_imported}")
        print("\n✨ Game times are now stored with proper UTC timestamps")
        print("   DFS pools will use correct lock times based on actual game start times")
    else:
        print("❌ Failed to fetch NBA schedule")
        sys.exit(1)

if __name__ == "__main__":
    main()

