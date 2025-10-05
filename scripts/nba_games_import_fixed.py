#!/usr/bin/env python3
"""
NBA Games Import Script - Fixed Version
Imports NBA game data using available nba_api endpoints
"""

import os
import sys
from datetime import datetime, date
import json

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from nba_api.stats.endpoints import leaguegamefinder
from nba_api.stats.library.parameters import Season

def get_supabase_credentials():
    """Get Supabase credentials from environment variables"""
    url = os.getenv('VITE_SUPABASE_URL')
    # Use service role key for database operations
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("❌ Missing Supabase credentials in environment variables")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        print(f"Current VITE_SUPABASE_URL: {url}")
        print(f"Current SUPABASE_SERVICE_ROLE_KEY: {'SET' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else 'NOT SET'}")
        sys.exit(1)
    
    return url, key

def setup_supabase():
    """Initialize Supabase client"""
    url, key = get_supabase_credentials()
    supabase: Client = create_client(url, key)
    return supabase

def get_nba_games_data():
    """Get NBA games data using LeagueGameFinder endpoint"""
    print("🏀 Fetching NBA games data...")
    
    try:
        # Get current season games using LeagueGameFinder
        print("📊 Getting current season games from LeagueGameFinder...")
        game_finder = leaguegamefinder.LeagueGameFinder(
            season_nullable="2024-25",  # Use 2024-25 season (should have games)
            season_type_nullable="Regular Season"
        )
        games_data = game_finder.get_data_frames()[0]  # Get the games dataframe
        
        print(f"✅ Found {len(games_data)} games from LeagueGameFinder")
        
        return games_data
        
    except Exception as e:
        print(f"❌ Error fetching NBA games data: {e}")
        return None

def transform_game_finder_to_nba_games(game_finder_df):
    """Transform LeagueGameFinder data to our nba_games table format"""
    games = []
    processed_games = set()  # To avoid duplicates
    
    for _, row in game_finder_df.iterrows():
        try:
            game_id = str(getattr(row, 'GAME_ID', ''))
            
            # Skip if we've already processed this game
            if game_id in processed_games:
                continue
            processed_games.add(game_id)
            
            # Parse game date
            game_date = None
            if hasattr(row, 'GAME_DATE') and row.GAME_DATE:
                try:
                    game_date = datetime.strptime(row.GAME_DATE, '%Y-%m-%d').date()
                except:
                    game_date = date.today()
            else:
                game_date = date.today()
            
            # Parse matchup to get home/away teams
            matchup = getattr(row, 'MATCHUP', '')
            home_team_id = getattr(row, 'TEAM_ID', 0)
            home_team_name = getattr(row, 'TEAM_NAME', '')
            home_team_abbreviation = getattr(row, 'TEAM_ABBREVIATION', '')
            
            # For now, we'll create a basic game record
            # In a real implementation, we'd need to match up home/away teams
            game = {
                'league_id': 0,  # NBA
                'season_year': 2025,  # 2024-25 season
                'game_date': game_date.isoformat(),
                'game_id': game_id,
                'game_code': f"NBA{game_id}",
                'game_status': 3,  # 3=Final
                'game_status_text': 'Final',
                'game_sequence': 1,
                'home_team_id': home_team_id,
                'home_team_name': home_team_name,
                'home_team_city': home_team_name.split()[-1] if home_team_name else '',
                'home_team_tricode': home_team_abbreviation,
                'home_team_score': getattr(row, 'PTS', 0),
                'away_team_id': 0,  # Will need to be determined from matchup
                'away_team_name': 'TBD',
                'away_team_city': '',
                'away_team_tricode': '',
                'away_team_score': 0,
                'week_number': 1,  # Default to week 1 for now
                'week_name': 'Week 1',
                'arena_name': '',
                'arena_city': '',
                'arena_state': '',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            games.append(game)
            
        except Exception as e:
            print(f"⚠️ Error processing game row: {e}")
            continue
    
    return games

def import_nba_games(supabase, games_data):
    """Import NBA games to the database"""
    if not games_data:
        print("❌ No games data to import")
        return
    
    print(f"💾 Importing {len(games_data)} NBA games to database...")
    
    try:
        # Use upsert to handle existing records
        result = supabase.table('nba_games').upsert(
            games_data,
            on_conflict='game_id'
        ).execute()
        
        print(f"✅ Successfully imported {len(result.data)} NBA games")
        return len(result.data)
        
    except Exception as e:
        print(f"❌ Error importing NBA games: {e}")
        return 0

def create_season_weeks(supabase):
    """Create basic season weeks structure"""
    print("📅 Creating season weeks structure...")
    
    # Create 26 weeks for the NBA season (roughly)
    weeks_data = []
    for week_num in range(1, 27):
        # Calculate proper dates for each week
        start_month = ((week_num - 1) // 4) + 1  # 4 weeks per month roughly
        start_day = ((week_num - 1) % 4) * 7 + 1  # Start of week
        end_day = start_day + 6  # End of week
        
        # Ensure we don't go beyond month 12
        if start_month > 12:
            start_month = 12
            start_day = min(start_day, 31)
            end_day = min(end_day, 31)
        
        week_data = {
            'league_id': 0,
            'season_year': 2025,
            'week_number': week_num,
            'week_name': f'Week {week_num}',
            'start_date': f'2025-{start_month:02d}-{start_day:02d}',
            'end_date': f'2025-{start_month:02d}-{end_day:02d}',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        weeks_data.append(week_data)
    
    try:
        result = supabase.table('nba_season_weeks').upsert(
            weeks_data,
            on_conflict='league_id,season_year,week_number'
        ).execute()
        
        print(f"✅ Created {len(result.data)} season weeks")
        return len(result.data)
        
    except Exception as e:
        print(f"❌ Error creating season weeks: {e}")
        return 0

def main():
    """Main import function"""
    print("🚀 Starting NBA Games Import (Fixed Version)")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    print("✅ Supabase client initialized")
    
    # Get NBA games data
    game_finder_data = get_nba_games_data()
    
    if game_finder_data is not None:
        # Transform and import games
        games_data = transform_game_finder_to_nba_games(game_finder_data)
        games_imported = import_nba_games(supabase, games_data)
        
        # Create season weeks
        weeks_created = create_season_weeks(supabase)
        
        print("=" * 80)
        print("🎉 NBA Games Import Completed!")
        print(f"📊 Games imported: {games_imported}")
        print(f"📅 Season weeks created: {weeks_created}")
        
    else:
        print("❌ Failed to fetch NBA games data")
        sys.exit(1)

if __name__ == "__main__":
    main()
