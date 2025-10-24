#!/usr/bin/env python3
"""
Import NBA games for the 2025-26 season from official NBA schedule JSON
Fetches data from: https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_9.json
Uses upsert logic to update any changed data - safe to run multiple times
Designed to run as a nightly cron job at 3-4 AM EST to keep schedule updated
"""

import os
import sys
import requests
from datetime import datetime
from supabase import create_client, Client

# Official NBA schedule JSON URL
NBA_SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_9.json"

def get_supabase_credentials():
    """Get Supabase credentials from environment variables"""
    url = os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("❌ Missing Supabase credentials in environment variables")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return url, key

def setup_supabase():
    """Initialize Supabase client"""
    url, key = get_supabase_credentials()
    supabase: Client = create_client(url, key)
    return supabase

def fetch_nba_schedule():
    """Fetch the official NBA schedule from cdn.nba.com"""
    print(f"🏀 Fetching official NBA schedule from {NBA_SCHEDULE_URL}...")
    
    try:
        response = requests.get(NBA_SCHEDULE_URL, timeout=30)
        response.raise_for_status()
        schedule_data = response.json()
        print("✅ Successfully fetched NBA schedule")
        return schedule_data
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching NBA schedule: {e}")
        sys.exit(1)
    except ValueError as e:
        print(f"❌ Error parsing JSON: {e}")
        sys.exit(1)

def parse_schedule_data(schedule_data):
    """Parse the NBA schedule JSON and convert to our database format"""
    print("📊 Parsing schedule data...")
    
    league_schedule = schedule_data.get('leagueSchedule', {})
    season_year = league_schedule.get('seasonYear', '2025-26')
    
    # Parse season weeks
    season_weeks = []
    weeks_data = league_schedule.get('weeks', [])
    
    # Deduplicate weeks by week_number (the JSON has some duplicates)
    weeks_by_number = {}
    for week in weeks_data:
        week_num = week.get('weekNumber')
        if week_num is not None and week_num not in weeks_by_number:
            weeks_by_number[week_num] = {
                'league_id': 0,
                'season_year': 2026,  # 2025-26 season
                'week_number': week_num,
                'week_name': week.get('weekName', f'Week {week_num}'),
                'start_date': week.get('startDate', '').split('T')[0] if week.get('startDate') else None,
                'end_date': week.get('endDate', '').split('T')[0] if week.get('endDate') else None,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
    
    season_weeks = list(weeks_by_number.values())
    print(f"  📅 Found {len(season_weeks)} season weeks")
    
    # Parse games
    games = []
    game_dates = league_schedule.get('gameDates', [])
    
    for game_date_obj in game_dates:
        date_games = game_date_obj.get('games', [])
        
        for game in date_games:
            # Skip games with non-NBA teams (international exhibition games)
            home_team_id = game.get('homeTeam', {}).get('teamId')
            away_team_id = game.get('awayTeam', {}).get('teamId')
            
            # NBA team IDs are in the range 1610612737-1610612766 (30 teams)
            if home_team_id < 1610000000 or away_team_id < 1610000000:
                continue  # Skip exhibition games with non-NBA teams
            
            # Parse game date/time
            game_datetime_str = game.get('gameDateTimeEst', game.get('gameDateEst', ''))
            if game_datetime_str:
                # Already in ISO format
                game_datetime = game_datetime_str
            else:
                # Fallback
                game_datetime = datetime.now().isoformat()
            
            # Determine week number
            week_number = game.get('weekNumber', 0)
            week_name = game.get('weekName', '')
            
            # If week is 0, it's preseason
            if week_number == 0:
                week_name = 'Preseason'
            
            # Get game label
            game_label = game.get('gameLabel', '')
            if game_label == 'Preseason' and week_number == 0:
                week_name = 'Preseason'
            
            # Create game record
            game_record = {
                'league_id': 0,
                'season_year': 2026,
                'game_date': game_datetime,
                'game_id': game.get('gameId'),
                'game_code': game.get('gameCode'),
                'game_status': game.get('gameStatus', 1),
                'game_status_text': game.get('gameStatusText', 'Scheduled').strip(),
                'game_sequence': game.get('gameSequence', 1),
                'home_team_id': home_team_id,
                'home_team_name': game.get('homeTeam', {}).get('teamName', ''),
                'home_team_city': game.get('homeTeam', {}).get('teamCity', ''),
                'home_team_tricode': game.get('homeTeam', {}).get('teamTricode', ''),
                'home_team_score': game.get('homeTeam', {}).get('score', 0),
                'away_team_id': away_team_id,
                'away_team_name': game.get('awayTeam', {}).get('teamName', ''),
                'away_team_city': game.get('awayTeam', {}).get('teamCity', ''),
                'away_team_tricode': game.get('awayTeam', {}).get('teamTricode', ''),
                'away_team_score': game.get('awayTeam', {}).get('score', 0),
                'week_number': week_number,
                'week_name': week_name,
                'arena_name': game.get('arenaName', ''),
                'arena_city': game.get('arenaCity', ''),
                'arena_state': game.get('arenaState', ''),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            games.append(game_record)
    
    print(f"  🏀 Parsed {len(games)} NBA games")
    
    return games, season_weeks

def import_to_database(supabase, games, season_weeks):
    """Import games and season weeks to database using upsert"""
    print(f"💾 Importing {len(games)} games and {len(season_weeks)} season weeks...")
    
    # Import season weeks first
    print("📅 Upserting season weeks...")
    try:
        result = supabase.table('nba_season_weeks').upsert(
            season_weeks,
            on_conflict='league_id,season_year,week_number'
        ).execute()
        print(f"✅ Upserted {len(season_weeks)} season weeks")
    except Exception as e:
        print(f"❌ Error upserting season weeks: {e}")
        return False
    
    # Import games in batches
    print("🏀 Upserting NBA games...")
    try:
        batch_size = 100
        total_batches = (len(games) + batch_size - 1) // batch_size
        
        for i in range(0, len(games), batch_size):
            batch = games[i:i + batch_size]
            result = supabase.table('nba_games').upsert(
                batch,
                on_conflict='game_id'
            ).execute()
            batch_num = i // batch_size + 1
            print(f"   Processed batch {batch_num}/{total_batches} ({len(batch)} games)")
        
        print(f"✅ Successfully upserted {len(games)} NBA games")
        return True
    except Exception as e:
        print(f"❌ Error upserting games: {e}")
        return False

def main():
    print("=" * 80)
    print("🚀 NBA Schedule Import - 2025-26 Season")
    print(f"⏰ Run time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    print("✅ Supabase client initialized")
    
    # Fetch schedule from NBA.com
    schedule_data = fetch_nba_schedule()
    
    # Parse the data
    games, season_weeks = parse_schedule_data(schedule_data)
    
    if not games:
        print("❌ No games to import!")
        sys.exit(1)
    
    # Import to database
    success = import_to_database(supabase, games, season_weeks)
    
    if success:
        print("=" * 80)
        print("🎉 NBA Schedule Import Completed!")
        print(f"📊 Games upserted: {len(games)}")
        print(f"📅 Season weeks upserted: {len(season_weeks)}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
    else:
        print("❌ Import failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
