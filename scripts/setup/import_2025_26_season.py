#!/usr/bin/env python3
"""
Import NBA games for the 2025-26 season
This script will import games starting 21 days from now
"""

import os
import sys
import requests
from datetime import datetime, timedelta
from supabase import create_client, Client

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

def get_nba_schedule_2025_26():
    """
    Get NBA schedule for 2025-26 season
    Since the season hasn't started yet, we'll create a mock schedule
    """
    print("🏀 Creating mock 2025-26 NBA schedule...")
    
    # Season starts 21 days from now
    season_start = datetime.now() + timedelta(days=21)
    season_year = 2026  # 2025-26 season
    
    # Create 26 weeks of games (standard NBA season)
    games = []
    season_weeks = []
    
    current_date = season_start
    week_number = 1
    
    # All-Star break is typically around week 15-16
    all_star_week = 15
    
    for week in range(1, 27):  # 26 weeks total
        week_start = current_date
        week_end = current_date + timedelta(days=6)
        
        # Create season week record
        week_data = {
            'league_id': 0,
            'season_year': season_year,
            'week_number': week,
            'week_name': f'Week {week}',
            'start_date': week_start.strftime('%Y-%m-%d'),
            'end_date': week_end.strftime('%Y-%m-%d'),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        season_weeks.append(week_data)
        
        # Skip All-Star break (2 weeks)
        if week == all_star_week:
            current_date += timedelta(days=14)  # Skip 2 weeks
            continue
        elif week == all_star_week + 1:
            current_date += timedelta(days=7)  # Skip 1 week
            continue
        
        # Create games for this week (3-4 games per day, 5-6 days per week)
        days_in_week = 6 if week <= 22 else 7  # More games in playoffs
        games_per_day = 4 if week <= 22 else 3  # Fewer games per day in playoffs
        
        for day in range(days_in_week):
            game_date = current_date + timedelta(days=day)
            
            # Skip some days randomly to make it realistic
            if day == 0 and week % 3 == 0:  # Skip some Mondays
                continue
            if day == 6 and week % 4 == 0:  # Skip some Sundays
                continue
                
            for game_num in range(games_per_day):
                # Create realistic game times
                if game_num == 0:
                    game_time = game_date.replace(hour=19, minute=0)  # 7:00 PM
                elif game_num == 1:
                    game_time = game_date.replace(hour=19, minute=30)  # 7:30 PM
                elif game_num == 2:
                    game_time = game_date.replace(hour=20, minute=0)  # 8:00 PM
                else:
                    game_time = game_date.replace(hour=22, minute=0)  # 10:00 PM
                
                # Mock team matchups (simplified)
                teams = [
                    ('ATL', 'Atlanta Hawks'), ('BOS', 'Boston Celtics'), ('BKN', 'Brooklyn Nets'),
                    ('CHA', 'Charlotte Hornets'), ('CHI', 'Chicago Bulls'), ('CLE', 'Cleveland Cavaliers'),
                    ('DAL', 'Dallas Mavericks'), ('DEN', 'Denver Nuggets'), ('DET', 'Detroit Pistons'),
                    ('GSW', 'Golden State Warriors'), ('HOU', 'Houston Rockets'), ('IND', 'Indiana Pacers'),
                    ('LAC', 'LA Clippers'), ('LAL', 'Los Angeles Lakers'), ('MEM', 'Memphis Grizzlies'),
                    ('MIA', 'Miami Heat'), ('MIL', 'Milwaukee Bucks'), ('MIN', 'Minnesota Timberwolves'),
                    ('NOP', 'New Orleans Pelicans'), ('NYK', 'New York Knicks'), ('OKC', 'Oklahoma City Thunder'),
                    ('ORL', 'Orlando Magic'), ('PHI', 'Philadelphia 76ers'), ('PHX', 'Phoenix Suns'),
                    ('POR', 'Portland Trail Blazers'), ('SAC', 'Sacramento Kings'), ('SAS', 'San Antonio Spurs'),
                    ('TOR', 'Toronto Raptors'), ('UTA', 'Utah Jazz'), ('WAS', 'Washington Wizards')
                ]
                
                # Pick two random teams
                import random
                home_team = random.choice(teams)
                away_team = random.choice([t for t in teams if t != home_team])
                
                game_id = f"NBA{season_year}{week:02d}{day:01d}{game_num:01d}"
                
                game_data = {
                    'league_id': 0,
                    'season_year': season_year,
                    'game_date': game_time.isoformat(),
                    'game_id': game_id,
                    'game_code': game_id,
                    'game_status': 1,  # 1 = Scheduled
                    'game_status_text': 'Scheduled',
                    'game_sequence': game_num + 1,
                    'home_team_id': teams.index(home_team) + 1,
                    'home_team_name': home_team[1],
                    'home_team_city': home_team[1].split(' ')[0],
                    'home_team_tricode': home_team[0],
                    'home_team_score': 0,
                    'away_team_id': teams.index(away_team) + 1,
                    'away_team_name': away_team[1],
                    'away_team_city': away_team[1].split(' ')[0],
                    'away_team_tricode': away_team[0],
                    'away_team_score': 0,
                    'week_number': week,
                    'week_name': f'Week {week}',
                    'arena_name': f'{home_team[1]} Arena',
                    'arena_city': home_team[1].split(' ')[0],
                    'arena_state': 'CA' if home_team[0] in ['LAL', 'LAC', 'GSW', 'SAC'] else 'NY',
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                games.append(game_data)
        
        current_date += timedelta(days=7)
    
    return games, season_weeks

def import_to_database(supabase, games, season_weeks):
    """Import games and season weeks to database"""
    print(f"💾 Importing {len(games)} games and {len(season_weeks)} season weeks...")
    
    # Import season weeks first
    print("📅 Creating season weeks...")
    try:
        result = supabase.table('nba_season_weeks').upsert(
            season_weeks,
            on_conflict='league_id,season_year,week_number'
        ).execute()
        print(f"✅ Created {len(season_weeks)} season weeks")
    except Exception as e:
        print(f"❌ Error creating season weeks: {e}")
        return False
    
    # Import games
    print("🏀 Importing NBA games...")
    try:
        # Process in batches to avoid timeout
        batch_size = 100
        for i in range(0, len(games), batch_size):
            batch = games[i:i + batch_size]
            result = supabase.table('nba_games').upsert(
                batch,
                on_conflict='game_id'
            ).execute()
            print(f"   Processed batch {i//batch_size + 1}/{(len(games) + batch_size - 1)//batch_size}")
        
        print(f"✅ Successfully imported {len(games)} NBA games")
        return True
    except Exception as e:
        print(f"❌ Error importing games: {e}")
        return False

def main():
    print("🚀 Starting 2025-26 NBA Season Import")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    print("✅ Supabase client initialized")
    
    # Get schedule data
    games, season_weeks = get_nba_schedule_2025_26()
    
    # Import to database
    success = import_to_database(supabase, games, season_weeks)
    
    if success:
        print("=" * 80)
        print("🎉 2025-26 NBA Season Import Completed!")
        print(f"📊 Games imported: {len(games)}")
        print(f"📅 Season weeks created: {len(season_weeks)}")
        print(f"📅 Season starts: {(datetime.now() + timedelta(days=21)).strftime('%Y-%m-%d')}")
        print("🏀 Ready for the 2025-26 season!")
    else:
        print("❌ Import failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
