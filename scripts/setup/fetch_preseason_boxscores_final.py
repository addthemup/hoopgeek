#!/usr/bin/env python3
"""
Fetch NBA Preseason Box Scores using known game IDs from schedule
This script fetches box score data using the NBA API BoxScoreTraditionalV3 endpoint
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import List, Dict, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
from nba_api.stats.endpoints import boxscoretraditionalv3

# Load environment variables from .env.local
load_dotenv('.env.local')

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    # Try different environment variable names
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    print(f"🔍 Environment check:")
    print(f"   VITE_SUPABASE_URL: {'✅' if os.getenv('VITE_SUPABASE_URL') else '❌'}")
    print(f"   SUPABASE_URL: {'✅' if os.getenv('SUPABASE_URL') else '❌'}")
    print(f"   SUPABASE_SERVICE_ROLE_KEY: {'✅' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else '❌'}")
    
    if not url or not key:
        print(f"❌ Missing environment variables:")
        print(f"   URL: {url}")
        print(f"   KEY: {'Present' if key else 'Missing'}")
        raise Exception("Missing Supabase environment variables")
    
    print(f"✅ Supabase client initialized with URL: {url[:30]}...")
    return create_client(url, key)

def convert_minutes_to_integer(minutes_str):
    """Convert MM:SS format to integer minutes"""
    if not minutes_str or minutes_str == "":
        return None
    
    try:
        if ':' in str(minutes_str):
            parts = str(minutes_str).split(':')
            minutes = int(parts[0])
            seconds = int(parts[1]) if len(parts) > 1 else 0
            return int(minutes + (seconds / 60.0))
        else:
            return int(minutes_str)
    except:
        return None

def get_or_create_game(supabase: Client, game_id: str, game_info: Dict):
    """Get existing game or create new one"""
    try:
        # First, try to find existing game
        result = supabase.table('nba_games').select('game_id').eq('game_id', game_id).execute()
        
        if result.data and len(result.data) > 0:
            return True  # Game exists
        
        # If not found, create new game
        new_game = {
            'game_id': game_id,
            'game_code': game_id,
            'game_date': game_info['date'],
            'season_year': 2025,
            'home_team_tricode': game_info['home_team'],
            'away_team_tricode': game_info['away_team'],
            'home_team_name': f"{game_info['home_team']} Team",  # Placeholder
            'away_team_name': f"{game_info['away_team']} Team",  # Placeholder
            'home_team_id': 1,  # Placeholder - will need proper team IDs
            'away_team_id': 2,  # Placeholder - will need proper team IDs
            'game_status': 3,  # Final
            'game_status_text': 'Final'
        }
        
        result = supabase.table('nba_games').insert(new_game).execute()
        
        if result.data and len(result.data) > 0:
            print(f"✅ Created game: {game_id}")
            return True
        else:
            print(f"❌ Failed to create game: {game_id}")
            return False
            
    except Exception as e:
        print(f"❌ Error with game {game_id}: {e}")
        return False

def get_or_create_player(supabase: Client, nba_player_id: int, player_name: str, team_id: int):
    """Get existing player or create new one"""
    try:
        # First, try to find existing player by nba_player_id
        result = supabase.table('nba_players').select('id').eq('nba_player_id', nba_player_id).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]['id']
        
        # If not found, create new player
        new_player = {
            'nba_player_id': nba_player_id,
            'name': player_name,
            'team_id': team_id,
            'is_active': True
        }
        
        result = supabase.table('nba_players').insert(new_player).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]['id']
        else:
            return None
            
    except Exception as e:
        print(f"❌ Error with player {player_name}: {e}")
        return None

def fetch_box_score(game_id: str) -> Optional[Dict]:
    """Fetch box score for a specific game"""
    try:
        print(f"📊 Fetching box score for game {game_id}...")
        
        # Get box score from NBA API
        box_score = boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id)
        player_stats = box_score.player_stats.get_data_frame()
        
        print(f"✅ Retrieved {len(player_stats)} players from NBA API")
        
        return {
            'game_id': game_id,
            'player_stats': player_stats,
            'total_players': len(player_stats)
        }
        
    except Exception as e:
        print(f"❌ Error fetching box score for game {game_id}: {e}")
        return None

def store_box_score_data(supabase: Client, box_score_data: Dict, game_info: Dict):
    """Store box score data in database"""
    try:
        game_id = box_score_data['game_id']
        stored_count = 0
        
        print(f"💾 Storing {len(box_score_data['player_stats'])} players for game {game_id}...")
        
        # Store player stats
        for _, player_stat in box_score_data['player_stats'].iterrows():
            nba_player_id = int(float(player_stat.get('personId')))
            player_name = player_stat.get('nameI')
            team_id = int(float(player_stat.get('teamId')))
            
            # Get or create player
            player_id = get_or_create_player(supabase, nba_player_id, player_name, team_id)
            
            if not player_id:
                print(f"❌ Failed to get/create player: {player_name}")
                continue
            
            minutes_played = convert_minutes_to_integer(player_stat.get('minutes'))
            
            # Helper function to convert to int or None
            def to_int_or_none(value):
                if value is None or value == "":
                    return None
                try:
                    return int(float(value))
                except:
                    return None
            
            transformed_player = {
                'player_id': player_id,
                'nba_player_id': nba_player_id,
                'game_id': game_id,
                'game_date': game_info['date'],
                'season_year': '2025-26',
                'player_name': player_name,
                'matchup': f"{game_info['away_team']} @ {game_info['home_team']}",
                'jersey_num': to_int_or_none(player_stat.get('jerseyNum')),
                'position': player_stat.get('position'),
                'team_id': team_id,
                'team_abbreviation': player_stat.get('teamTricode'),
                'team_name': player_stat.get('teamName'),
                'team_city': player_stat.get('teamCity'),
                'team_tricode': player_stat.get('teamTricode'),
                'min': minutes_played,
                'fgm': to_int_or_none(player_stat.get('fieldGoalsMade')),
                'fga': to_int_or_none(player_stat.get('fieldGoalsAttempted')),
                'fg_pct': player_stat.get('fieldGoalsPercentage'),
                'fg3m': to_int_or_none(player_stat.get('threePointersMade')),
                'fg3a': to_int_or_none(player_stat.get('threePointersAttempted')),
                'fg3_pct': player_stat.get('threePointersPercentage'),
                'ftm': to_int_or_none(player_stat.get('freeThrowsMade')),
                'fta': to_int_or_none(player_stat.get('freeThrowsAttempted')),
                'ft_pct': player_stat.get('freeThrowsPercentage'),
                'oreb': to_int_or_none(player_stat.get('reboundsOffensive')),
                'dreb': to_int_or_none(player_stat.get('reboundsDefensive')),
                'reb': to_int_or_none(player_stat.get('reboundsTotal')),
                'ast': to_int_or_none(player_stat.get('assists')),
                'stl': to_int_or_none(player_stat.get('steals')),
                'blk': to_int_or_none(player_stat.get('blocks')),
                'tov': to_int_or_none(player_stat.get('turnovers')),
                'fouls_personal': to_int_or_none(player_stat.get('foulsPersonal')),
                'pts': to_int_or_none(player_stat.get('points')),
                'plus_minus_points': to_int_or_none(player_stat.get('plusMinusPoints')),
            }
            
            # Insert into nba_boxscores
            try:
                result = supabase.table('nba_boxscores').insert(transformed_player).execute()
                
                if result.data:
                    stored_count += 1
                    print(f"✅ Stored stats for {player_name} - {transformed_player['pts']} pts")
                else:
                    print(f"❌ Failed to store stats for {player_name}")
                    
            except Exception as e:
                print(f"❌ Database error for {player_name}: {e}")
        
        print(f"📊 Successfully stored {stored_count}/{len(box_score_data['player_stats'])} players for game {game_id}")
        return stored_count
        
    except Exception as e:
        print(f"❌ Error storing box score data: {e}")
        return 0

def main():
    """Main function to fetch preseason box scores"""
    print("🏀 NBA Preseason Box Score Import (2025-10-02 to 2025-10-13)")
    print("=" * 60)
    
    # Setup
    supabase = setup_supabase()
    
    # Load preseason games from our extracted list
    try:
        with open('preseason_games_2025.json', 'r') as f:
            preseason_games = json.load(f)
        print(f"📋 Loaded {len(preseason_games)} preseason games")
    except FileNotFoundError:
        print("❌ preseason_games_2025.json not found. Run extract_preseason_games.py first.")
        return
    
    total_players_imported = 0
    successful_games = 0
    
    print(f"\n🎮 Processing {len(preseason_games)} games...")
    print("-" * 60)
    
    for i, game_info in enumerate(preseason_games, 1):
        game_id = game_info['game_id']
        date = game_info['date']
        matchup = f"{game_info['away_team']} @ {game_info['home_team']}"
        
        print(f"\n[{i}/{len(preseason_games)}] 🎮 {game_id}: {matchup} ({date})")
        
        # Step 1: Create or verify game exists
        if not get_or_create_game(supabase, game_id, game_info):
            print(f"❌ Failed to create game {game_id}. Skipping.")
            continue
        
        # Step 2: Fetch box score
        box_score_data = fetch_box_score(game_id)
        
        if box_score_data:
            # Step 3: Store in database
            stored_count = store_box_score_data(supabase, box_score_data, game_info)
            total_players_imported += stored_count
            successful_games += 1
        else:
            print(f"❌ Failed to fetch box score for game {game_id}")
        
        # Rate limiting
        time.sleep(1)
    
    print(f"\n🎯 Import Summary:")
    print(f"   Total games processed: {len(preseason_games)}")
    print(f"   Successful games: {successful_games}")
    print(f"   Total players imported: {total_players_imported}")
    print(f"   Success rate: {(successful_games/len(preseason_games)*100):.1f}%")
    
    print(f"\n✅ Preseason box score import completed!")

if __name__ == "__main__":
    main()
