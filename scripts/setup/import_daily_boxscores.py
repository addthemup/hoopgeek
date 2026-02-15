#!/usr/bin/env python3
"""
Import NBA Box Scores for games played yesterday
Designed to run nightly at 3:30 AM EST via cron job
Fetches box score data for all completed games from the previous day
"""

import os
import sys
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from supabase import create_client, Client
from nba_api.stats.endpoints import boxscoretraditionalv3, scoreboardv2
import pandas as pd

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    from pathlib import Path
    
    # Get the project root (assuming script is in scripts/setup/ or scripts/feed/)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent  # Go up from scripts/setup/ or scripts/feed/ to project root
    
    # Try multiple common env file locations (project root first, then current directory)
    load_dotenv(project_root / '.env.local')
    load_dotenv(project_root / '.env')
    load_dotenv('.env.local')  # Also try current directory
    load_dotenv('.env')  # Also try current directory
except ImportError:
    pass  # dotenv not installed, skip
except:
    pass  # File not found, skip

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials in environment variables")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(url, key)

def get_yesterday_games(supabase: Client, target_date: str = None) -> List[Dict]:
    """Get all completed games from specified date (or yesterday if not specified)"""
    try:
        # Use provided date or yesterday
        if target_date:
            yesterday_date = target_date
        else:
            yesterday = datetime.now() - timedelta(days=1)
            yesterday_date = yesterday.strftime('%Y-%m-%d')
        
        print(f"📅 Fetching completed games from {yesterday_date}...")
        
        # Query for games from the date without season_year filter first to see what exists
        # This allows us to update scores even if status hasn't been updated yet
        result = supabase.table('nba_games') \
            .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_id, away_team_id, game_status, game_status_text, season_year') \
            .gte('game_date', f'{yesterday_date}T00:00:00') \
            .lte('game_date', f'{yesterday_date}T23:59:59') \
            .order('game_date', desc=False) \
            .execute()
        
        games = []
        if result.data and len(result.data) > 0:
            # Show what season_years we found
            season_years_found = set([g.get('season_year') for g in result.data if g.get('season_year')])
            print(f"🔍 Found {len(result.data)} games in database with season_years: {season_years_found}")
            for game in result.data:
                games.append({
                    'game_id': game['game_id'],
                    'date': game['game_date'].split('T')[0],
                    'home_team': game['home_team_tricode'],
                    'away_team': game['away_team_tricode'],
                    'home_team_id': game['home_team_id'],
                    'away_team_id': game['away_team_id']
                })
        else:
            print(f"⚠️  No games found in database for {yesterday_date}, trying NBA API...")
            # Try to fetch games from NBA API
            try:
                scoreboard = scoreboardv2.ScoreboardV2(game_date=yesterday_date)
                # Get available data frames
                available_frames = scoreboard.get_data_frames()
                game_header = scoreboard.game_header.get_data_frame()
                
                if game_header is not None and not game_header.empty and len(game_header) > 0:
                    print(f"✅ Found {len(game_header)} games from NBA API for {yesterday_date}")
                    for _, row in game_header.iterrows():
                        try:
                            games.append({
                                'game_id': str(int(row['GAME_ID'])),
                                'date': yesterday_date,
                                'home_team': row.get('HOME_TEAM_ABBREVIATION', ''),
                                'away_team': row.get('VISITOR_TEAM_ABBREVIATION', ''),
                                'home_team_id': int(row.get('HOME_TEAM_ID', 0)) if pd.notna(row.get('HOME_TEAM_ID')) else 0,
                                'away_team_id': int(row.get('VISITOR_TEAM_ID', 0)) if pd.notna(row.get('VISITOR_TEAM_ID')) else 0
                            })
                        except Exception as row_error:
                            print(f"⚠️  Error processing game row: {row_error}")
                            continue
                else:
                    print(f"⚠️  No games found in NBA API for {yesterday_date}")
            except Exception as e:
                print(f"⚠️  Error fetching from NBA API: {e}")
                import traceback
                traceback.print_exc()
        
        print(f"✅ Found {len(games)} completed games from {yesterday_date}")
        return games
        
    except Exception as e:
        print(f"❌ Error fetching games: {e}")
        return []

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

def check_if_box_score_exists(supabase: Client, game_id: str) -> bool:
    """Check if box score data already exists for this game"""
    try:
        result = supabase.table('nba_boxscores').select('game_id').eq('game_id', game_id).limit(1).execute()
        return len(result.data) > 0
    except:
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
        team_stats = box_score.team_stats.get_data_frame()
        
        print(f"✅ Retrieved {len(player_stats)} players from NBA API")
        
        # Extract team scores from team_stats
        away_score = 0
        home_score = 0
        if not team_stats.empty and len(team_stats) >= 2:
            # Team stats are usually ordered: away team first, then home team
            away_score = int(team_stats.iloc[0]['points']) if 'points' in team_stats.columns else 0
            home_score = int(team_stats.iloc[1]['points']) if len(team_stats) > 1 and 'points' in team_stats.columns else 0
        
        return {
            'game_id': game_id,
            'player_stats': player_stats,
            'team_stats': team_stats,
            'away_score': away_score,
            'home_score': home_score,
            'total_players': len(player_stats)
        }
        
    except Exception as e:
        print(f"❌ Error fetching box score for game {game_id}: {e}")
        return None

def update_game_scores(supabase: Client, game_id: str, away_score: int, home_score: int):
    """Update game scores and mark game as Final in nba_games (so 'last 10 completed games' includes it)."""
    try:
        result = supabase.table('nba_games') \
            .update({
                'away_team_score': away_score,
                'home_team_score': home_score,
                'game_status': 3,
                'game_status_text': 'Final',
            }) \
            .eq('game_id', game_id) \
            .execute()
        
        if result.data:
            print(f"✅ Updated scores and status=Final in nba_games: {away_score}-{home_score}")
        else:
            print(f"⚠️  No game found in nba_games for {game_id}")
    except Exception as e:
        print(f"❌ Error updating game scores: {e}")

def store_box_score_data(supabase: Client, box_score_data: Dict, game_info: Dict):
    """Store box score data in database"""
    try:
        game_id = box_score_data['game_id']
        stored_count = 0
        
        # Update game scores in nba_games table
        if 'away_score' in box_score_data and 'home_score' in box_score_data:
            update_game_scores(
                supabase, 
                game_id, 
                box_score_data['away_score'], 
                box_score_data['home_score']
            )
        
        print(f"💾 Storing {len(box_score_data['player_stats'])} players for game {game_id}...")
        
        # Store player stats
        for _, player_stat in box_score_data['player_stats'].iterrows():
            nba_player_id = int(float(player_stat.get('personId')))
            player_name = player_stat.get('nameI')
            team_id = int(float(player_stat.get('teamId')))
            
            # Get or create player
            player_id = get_or_create_player(supabase, nba_player_id, player_name, team_id)
            
            if not player_id:
                print(f"⚠️  Failed to get/create player: {player_name}")
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
            
            # Calculate season_year from game date
            date_obj = datetime.strptime(game_info['date'], '%Y-%m-%d')
            if date_obj.month >= 10:
                season_year_int = date_obj.year
            else:
                season_year_int = date_obj.year - 1
            season_year_str = f'{season_year_int}-{str(season_year_int + 1)[-2:]}'
            
            transformed_player = {
                'player_id': player_id,
                'nba_player_id': nba_player_id,
                'game_id': game_id,
                'game_date': game_info['date'],
                'season_year': season_year_str,
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
            
            # Insert into nba_boxscores (upsert to avoid duplicates)
            try:
                result = supabase.table('nba_boxscores').upsert(
                    transformed_player,
                    on_conflict='game_id,nba_player_id'
                ).execute()
                
                if result.data:
                    stored_count += 1
                    
            except Exception as e:
                print(f"❌ Database error for {player_name}: {e}")
        
        print(f"📊 Successfully stored {stored_count}/{len(box_score_data['player_stats'])} players for game {game_id}")
        return stored_count
        
    except Exception as e:
        print(f"❌ Error storing box score data: {e}")
        return 0

def process_date(supabase: Client, target_date: str, skip_existing: bool = True):
    """Process box scores for a single date"""
    print(f"\n{'=' * 80}")
    print(f"📅 Processing date: {target_date}")
    print(f"{'=' * 80}")
    
    # Get completed games from database for this date
    games = get_yesterday_games(supabase, target_date)
    
    if not games:
        print(f"ℹ️  No completed games found for {target_date}")
        return {
            'date': target_date,
            'total_games': 0,
            'skipped_games': 0,
            'successful_games': 0,
            'total_players': 0
        }
    
    total_players_imported = 0
    successful_games = 0
    skipped_games = 0
    
    print(f"\n🎮 Processing {len(games)} games...")
    print("-" * 80)
    
    for i, game_info in enumerate(games, 1):
        game_id = game_info['game_id']
        date = game_info['date']
        matchup = f"{game_info['away_team']} @ {game_info['home_team']}"
        
        print(f"\n[{i}/{len(games)}] 🎮 {game_id}: {matchup} ({date})")
        
        # Check if we already have box score data for this game
        box_score_exists = check_if_box_score_exists(supabase, game_id)
        
        if skip_existing and box_score_exists:
            print(f"⏭️  Box score already exists for {game_id}.")
            # Still fetch and update scores in nba_games table
            box_score_data = fetch_box_score(game_id)
            if box_score_data and 'away_score' in box_score_data and 'home_score' in box_score_data:
                update_game_scores(
                    supabase,
                    game_id,
                    box_score_data['away_score'],
                    box_score_data['home_score']
                )
            skipped_games += 1
            time.sleep(1)
            continue
        
        # Fetch box score
        box_score_data = fetch_box_score(game_id)
        
        if box_score_data:
            # Store in database
            stored_count = store_box_score_data(supabase, box_score_data, game_info)
            total_players_imported += stored_count
            successful_games += 1
        else:
            print(f"❌ Failed to fetch box score for game {game_id}")
        
        # Rate limiting - be nice to NBA API
        time.sleep(1)
    
    return {
        'date': target_date,
        'total_games': len(games),
        'skipped_games': skipped_games,
        'successful_games': successful_games,
        'total_players': total_players_imported
    }

def main():
    """Main function to fetch box scores for date range"""
    # Parse command line arguments
    start_date = None
    end_date = None
    skip_existing = True  # Default to skipping existing
    
    # Check for --force flag
    if '--force' in sys.argv or '-f' in sys.argv:
        skip_existing = False
        sys.argv = [arg for arg in sys.argv if arg not in ['--force', '-f']]
        print("⚠️  FORCE MODE: Will overwrite existing boxscores")
    
    if len(sys.argv) >= 2:
        try:
            start_date = datetime.strptime(sys.argv[1], '%Y-%m-%d')
        except ValueError:
            print(f"❌ Invalid start date format. Use YYYY-MM-DD (e.g., 2025-10-21)")
            sys.exit(1)
    
    if len(sys.argv) >= 3:
        try:
            end_date = datetime.strptime(sys.argv[2], '%Y-%m-%d')
        except ValueError:
            print(f"❌ Invalid end date format. Use YYYY-MM-DD (e.g., 2025-10-29)")
            sys.exit(1)
    
    # Default to yesterday if no dates provided
    if not start_date:
        start_date = datetime.now() - timedelta(days=1)
        end_date = start_date
    elif not end_date:
        end_date = start_date
    
    # Ensure start_date <= end_date
    if start_date > end_date:
        start_date, end_date = end_date, start_date
    
    print("=" * 80)
    print("🏀 NBA Daily Box Score Import")
    print(f"📅 Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    print(f"⏰ Run time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔄 Skip existing: {skip_existing}")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    
    # Process each date in the range
    current_date = start_date
    all_results = []
    
    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        result = process_date(supabase, date_str, skip_existing=skip_existing)
        all_results.append(result)
        current_date += timedelta(days=1)
    
    # Print summary
    print(f"\n{'=' * 80}")
    print(f"🎯 Overall Import Summary:")
    print(f"{'=' * 80}")
    
    total_games = sum(r['total_games'] for r in all_results)
    total_skipped = sum(r['skipped_games'] for r in all_results)
    total_successful = sum(r['successful_games'] for r in all_results)
    total_players = sum(r['total_players'] for r in all_results)
    
    print(f"   Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    print(f"   Total games found: {total_games}")
    print(f"   Games skipped (already imported): {total_skipped}")
    print(f"   Games processed: {total_games - total_skipped}")
    print(f"   Successful imports: {total_successful}")
    print(f"   Total players imported: {total_players}")
    if total_games - total_skipped > 0:
        print(f"   Success rate: {(total_successful/(total_games - total_skipped)*100):.1f}%")
    
    print(f"\n📊 Per-date breakdown:")
    for result in all_results:
        print(f"   {result['date']}: {result['successful_games']}/{result['total_games']} games, {result['total_players']} players")
    
    print(f"{'=' * 80}")
    print(f"\n✅ Box score import completed!")

if __name__ == "__main__":
    main()

