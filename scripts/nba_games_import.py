#!/usr/bin/env python3
"""
NBA Games Import Script
Imports all NBA games for the 2025-26 season using the NBA API
"""

import os
import sys
from datetime import datetime, date
from supabase import create_client
from nba_api.stats.endpoints import ScheduleLeagueV2
import time

# Get credentials from environment
SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

def setup_supabase():
    """Initialize Supabase client"""
    print("🔧 Setting up Supabase client...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Supabase client initialized")
    return supabase

def parse_datetime(dt_string):
    """Parse datetime string from NBA API"""
    if not dt_string:
        return None
    try:
        # Handle different datetime formats from NBA API
        if 'T' in dt_string:
            return datetime.fromisoformat(dt_string.replace('Z', '+00:00'))
        else:
            return datetime.strptime(dt_string, '%Y-%m-%d %H:%M:%S')
    except:
        return None

def parse_date(date_string):
    """Parse date string from NBA API"""
    if not date_string:
        return None
    try:
        return datetime.strptime(date_string, '%Y-%m-%d').date()
    except:
        return None

def parse_time(time_string):
    """Parse time string from NBA API"""
    if not time_string:
        return None
    try:
        return datetime.strptime(time_string, '%H:%M:%S').time()
    except:
        return None

def import_nba_games(supabase, season="2025-26"):
    """Import NBA games for the specified season"""
    print(f"🏀 Starting NBA Games Import for {season}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 80)
    
    try:
        # Get schedule data from NBA API
        print(f"📋 STEP 1: Getting NBA schedule for {season}...")
        schedule = ScheduleLeagueV2(season=season)
        
        # Get season games data
        season_games = schedule.season_games.get_data_frame()
        season_weeks = schedule.season_weeks.get_data_frame()
        
        print(f"📊 Found {len(season_games)} games")
        print(f"📊 Found {len(season_weeks)} season weeks")
        
        # Import season weeks first
        print(f"💾 STEP 2: Importing {len(season_weeks)} season weeks...")
        weeks_data = []
        for _, week in season_weeks.iterrows():
            week_data = {
                'league_id': int(week.get('leagueId', 0)),
                'season_year': int(week.get('seasonYear', 2025)),
                'week_number': int(week.get('weekNumber', 0)),
                'week_name': week.get('weekName', ''),
                'start_date': parse_date(week.get('startDate')),
                'end_date': parse_date(week.get('endDate'))
            }
            weeks_data.append(week_data)
        
        if weeks_data:
            result = supabase.table('nba_season_weeks').upsert(weeks_data, on_conflict='league_id,season_year,week_number').execute()
            print(f"✅ Season weeks imported: {len(result.data)}")
        
        # Import games
        print(f"💾 STEP 3: Importing {len(season_games)} games...")
        games_data = []
        
        for i, game in season_games.iterrows():
            if i % 100 == 0:
                print(f"   Processing game {i+1}/{len(season_games)}...")
            
            # Parse game data
            game_data = {
                # Basic game info
                'league_id': int(game.get('leagueId', 0)),
                'season_year': int(game.get('seasonYear', 2025)),
                'game_date': parse_date(game.get('gameDate')),
                'game_id': str(game.get('gameId', '')),
                'game_code': game.get('gameCode', ''),
                'game_status': int(game.get('gameStatus', 1)),
                'game_status_text': game.get('gameStatusText', ''),
                'game_sequence': int(game.get('gameSequence', 0)) if game.get('gameSequence') else None,
                'game_date_est': parse_datetime(game.get('gameDateEst')),
                'game_time_est': parse_time(game.get('gameTimeEst')),
                'game_datetime_est': parse_datetime(game.get('gameDateTimeEst')),
                'game_date_utc': parse_datetime(game.get('gameDateUTC')),
                'game_time_utc': parse_time(game.get('gameTimeUTC')),
                'game_datetime_utc': parse_datetime(game.get('gameDateTimeUTC')),
                'away_team_time': parse_time(game.get('awayTeamTime')),
                'home_team_time': parse_time(game.get('homeTeamTime')),
                'day': int(game.get('day', 0)) if game.get('day') else None,
                'month_num': int(game.get('monthNum', 0)) if game.get('monthNum') else None,
                'week_number': int(game.get('weekNumber', 0)) if game.get('weekNumber') else None,
                'week_name': game.get('weekName', ''),
                'if_necessary': bool(game.get('ifNecessary', False)),
                'series_game_number': int(game.get('seriesGameNumber', 0)) if game.get('seriesGameNumber') else None,
                'game_label': game.get('gameLabel', ''),
                'game_sub_label': game.get('gameSubLabel', ''),
                'series_text': game.get('seriesText', ''),
                
                # Arena info
                'arena_name': game.get('arenaName', ''),
                'arena_state': game.get('arenaState', ''),
                'arena_city': game.get('arenaCity', ''),
                'postponed_status': game.get('postponedStatus', ''),
                'branch_link': game.get('branchLink', ''),
                'game_subtype': game.get('gameSubtype', ''),
                'is_neutral': bool(game.get('isNeutral', False)),
                
                # Home team info
                'home_team_id': int(game.get('homeTeam_teamId', 0)) if game.get('homeTeam_teamId') else None,
                'home_team_name': game.get('homeTeam_teamName', ''),
                'home_team_city': game.get('homeTeam_teamCity', ''),
                'home_team_tricode': game.get('homeTeam_teamTricode', ''),
                'home_team_slug': game.get('homeTeam_teamSlug', ''),
                'home_team_wins': int(game.get('homeTeam_wins', 0)) if game.get('homeTeam_wins') else None,
                'home_team_losses': int(game.get('homeTeam_losses', 0)) if game.get('homeTeam_losses') else None,
                'home_team_score': int(game.get('homeTeam_score', 0)) if game.get('homeTeam_score') else None,
                'home_team_seed': int(game.get('homeTeam_seed', 0)) if game.get('homeTeam_seed') else None,
                
                # Away team info
                'away_team_id': int(game.get('awayTeam_teamId', 0)) if game.get('awayTeam_teamId') else None,
                'away_team_name': game.get('awayTeam_teamName', ''),
                'away_team_city': game.get('awayTeam_teamCity', ''),
                'away_team_tricode': game.get('awayTeam_teamTricode', ''),
                'away_team_slug': game.get('awayTeam_teamSlug', ''),
                'away_team_wins': int(game.get('awayTeam_wins', 0)) if game.get('awayTeam_wins') else None,
                'away_team_losses': int(game.get('awayTeam_losses', 0)) if game.get('awayTeam_losses') else None,
                'away_team_score': int(game.get('awayTeam_score', 0)) if game.get('awayTeam_score') else None,
                'away_team_seed': int(game.get('awayTeam_seed', 0)) if game.get('awayTeam_seed') else None,
                
                # Points leaders
                'points_leaders_person_id': int(game.get('pointsLeaders_personId', 0)) if game.get('pointsLeaders_personId') else None,
                'points_leaders_first_name': game.get('pointsLeaders_firstName', ''),
                'points_leaders_last_name': game.get('pointsLeaders_lastName', ''),
                'points_leaders_team_id': int(game.get('pointsLeaders_teamId', 0)) if game.get('pointsLeaders_teamId') else None,
                'points_leaders_team_city': game.get('pointsLeaders_teamCity', ''),
                'points_leaders_team_name': game.get('pointsLeaders_teamName', ''),
                'points_leaders_team_tricode': game.get('pointsLeaders_teamTricode', ''),
                'points_leaders_points': int(game.get('pointsLeaders_points', 0)) if game.get('pointsLeaders_points') else None,
                
                # Broadcasters (simplified)
                'national_broadcasters_scope': game.get('nationalBroadcasters_broadcasterScope', ''),
                'national_broadcasters_media': game.get('nationalBroadcasters_broadcasterMedia', ''),
                'national_broadcasters_display': game.get('nationalBroadcasters_broadcasterDisplay', ''),
                'home_tv_broadcasters_display': game.get('homeTvBroadcasters_broadcasterDisplay', ''),
                'away_tv_broadcasters_display': game.get('awayTvBroadcasters_broadcasterDisplay', ''),
            }
            
            games_data.append(game_data)
        
        # Batch insert games
        print(f"💾 STEP 4: Inserting {len(games_data)} games to database...")
        if games_data:
            # Insert in batches to avoid timeout
            batch_size = 100
            total_inserted = 0
            
            for i in range(0, len(games_data), batch_size):
                batch = games_data[i:i + batch_size]
                result = supabase.table('nba_games').upsert(batch, on_conflict='game_id').execute()
                total_inserted += len(result.data)
                print(f"   Inserted batch {i//batch_size + 1}/{(len(games_data) + batch_size - 1)//batch_size} ({len(result.data)} games)")
                time.sleep(0.1)  # Small delay to avoid rate limiting
            
            print(f"✅ Games imported: {total_inserted}")
        
        print("=" * 80)
        print("🎉 NBA Games Import Completed!")
        print(f"📊 Final Statistics:")
        print(f"   Games imported: {len(games_data)}")
        print(f"   Season weeks imported: {len(weeks_data)}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        return False

def verify_import(supabase):
    """Verify the import was successful"""
    print("\n🔍 Verifying import...")
    
    try:
        # Check games count
        games_result = supabase.table('nba_games').select('*', count='exact').execute()
        print(f"✅ Total games in database: {games_result.count}")
        
        # Check season weeks count
        weeks_result = supabase.table('nba_season_weeks').select('*', count='exact').execute()
        print(f"✅ Total season weeks in database: {weeks_result.count}")
        
        # Show sample games
        sample_games = supabase.table('nba_games').select('game_date, home_team_name, away_team_name, game_status_text').limit(5).execute()
        print(f"📋 Sample games:")
        for game in sample_games.data:
            status = game.get('game_status_text', 'Unknown')
            home_team = game.get('home_team_name', 'Unknown')
            away_team = game.get('away_team_name', 'Unknown')
            game_date = game.get('game_date', 'Unknown')
            print(f"   • {game_date}: {away_team} @ {home_team} ({status})")
        
        return True
        
    except Exception as e:
        print(f"❌ Error verifying import: {e}")
        return False

def main():
    """Main function"""
    print("🚀 Starting NBA Games Import")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    
    # Import games for 2025-26 season
    success = import_nba_games(supabase, "2025-26")
    
    if success:
        verify_import(supabase)
    else:
        print("❌ Import failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
