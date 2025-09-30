#!/usr/bin/env python3
"""
Comprehensive NBA Data Import Script
Imports all players, their game logs, season stats, and career stats
"""

import os
import sys
import json
import time
import requests
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from supabase import create_client, Client

# Configuration
SUPABASE_URL = "https://lsnqmdeagfzuvrypiiwi.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbnFtZGVhZ2Z6dXZyeXBpaXdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI1MTU5MSwiZXhwIjoyMDc0ODI3NTkxfQ.uOD1oFhjd6ISP7XJu7OtYYG_SwU7uZR74h8byY3HNPo"
USER_UID = "fd58dfb7-ad5d-43e2-b2c4-c254e2a29211"

# NBA API Configuration
NBA_BASE_URL = "https://stats.nba.com/stats"
NBA_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com'
}

# Season configuration
CURRENT_SEASON = "2023-24"
SEASONS_TO_IMPORT = ["2023-24", "2022-23", "2021-22"]  # Last 3 seasons

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    print("🔧 Setting up Supabase client...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Supabase client initialized")
    return supabase

def make_nba_request(endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Make a request to NBA API with retry logic"""
    url = f"{NBA_BASE_URL}/{endpoint}"
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            print(f"   📡 Requesting: {endpoint} (attempt {attempt + 1}/{max_retries})")
            response = requests.get(url, headers=NBA_HEADERS, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            if data.get('resultSets') and len(data['resultSets']) > 0:
                return data
            else:
                raise Exception("No data received from NBA API")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                raise e
        except Exception as e:
            print(f"   ❌ Error: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
            else:
                raise e
    
    raise Exception("All retry attempts failed")

def fetch_all_players() -> List[Dict[str, Any]]:
    """Fetch all NBA players"""
    print("🏀 Fetching all NBA players...")
    
    data = make_nba_request("commonallplayers", {
        "LeagueID": "00",
        "Season": CURRENT_SEASON,
        "IsOnlyCurrentSeason": "0"  # Get all players, not just current season
    })
    
    players_data = data['resultSets'][0]
    headers = players_data['headers']
    rows = players_data['rowSet']
    
    players = []
    for row in rows:
        player = {}
        for i, header in enumerate(headers):
            player[header] = row[i] if i < len(row) else None
        players.append(player)
    
    print(f"📊 Found {len(players)} total players")
    return players

def fetch_player_game_logs(player_id: int, season: str) -> List[Dict[str, Any]]:
    """Fetch game logs for a specific player and season"""
    print(f"   📊 Fetching game logs for player {player_id} in {season}...")
    
    data = make_nba_request("playergamelog", {
        "PlayerID": str(player_id),
        "Season": season,
        "SeasonType": "Regular Season"
    })
    
    if not data.get('resultSets') or len(data['resultSets']) == 0:
        return []
    
    game_logs_data = data['resultSets'][0]
    headers = game_logs_data['headers']
    rows = game_logs_data['rowSet']
    
    game_logs = []
    for row in rows:
        game_log = {}
        for i, header in enumerate(headers):
            game_log[header] = row[i] if i < len(row) else None
        game_logs.append(game_log)
    
    print(f"   📈 Found {len(game_logs)} games for player {player_id}")
    return game_logs

def fetch_player_season_stats(player_id: int, season: str) -> Optional[Dict[str, Any]]:
    """Fetch season stats for a specific player and season"""
    print(f"   📊 Fetching season stats for player {player_id} in {season}...")
    
    data = make_nba_request("playergamelog", {
        "PlayerID": str(player_id),
        "Season": season,
        "SeasonType": "Regular Season"
    })
    
    if not data.get('resultSets') or len(data['resultSets']) == 0:
        return None
    
    # Calculate season totals from game logs
    game_logs_data = data['resultSets'][0]
    headers = game_logs_data['headers']
    rows = game_logs_data['rowSet']
    
    if not rows:
        return None
    
    # Initialize totals
    totals = {
        'GP': 0, 'MIN': 0, 'FGM': 0, 'FGA': 0, 'FG3M': 0, 'FG3A': 0,
        'FTM': 0, 'FTA': 0, 'OREB': 0, 'DREB': 0, 'REB': 0, 'AST': 0,
        'STL': 0, 'BLK': 0, 'TOV': 0, 'PF': 0, 'PTS': 0, 'PLUS_MINUS': 0
    }
    
    for row in rows:
        totals['GP'] += 1
        for i, header in enumerate(headers):
            if header in totals and row[i] is not None:
                totals[header] += row[i] or 0
    
    # Calculate averages and percentages
    gp = totals['GP']
    if gp == 0:
        return None
    
    season_stats = {
        'GP': gp,
        'MIN': totals['MIN'],
        'FGM': totals['FGM'],
        'FGA': totals['FGA'],
        'FG_PCT': totals['FGM'] / totals['FGA'] if totals['FGA'] > 0 else 0,
        'FG3M': totals['FG3M'],
        'FG3A': totals['FG3A'],
        'FG3_PCT': totals['FG3M'] / totals['FG3A'] if totals['FG3A'] > 0 else 0,
        'FTM': totals['FTM'],
        'FTA': totals['FTA'],
        'FT_PCT': totals['FTM'] / totals['FTA'] if totals['FTA'] > 0 else 0,
        'OREB': totals['OREB'],
        'DREB': totals['DREB'],
        'REB': totals['REB'],
        'AST': totals['AST'],
        'STL': totals['STL'],
        'BLK': totals['BLK'],
        'TOV': totals['TOV'],
        'PF': totals['PF'],
        'PTS': totals['PTS'],
        'PLUS_MINUS': totals['PLUS_MINUS'],
        # Per game averages
        'MIN_PER_GAME': totals['MIN'] / gp,
        'FGM_PER_GAME': totals['FGM'] / gp,
        'FGA_PER_GAME': totals['FGA'] / gp,
        'FG3M_PER_GAME': totals['FG3M'] / gp,
        'FG3A_PER_GAME': totals['FG3A'] / gp,
        'FTM_PER_GAME': totals['FTM'] / gp,
        'FTA_PER_GAME': totals['FTA'] / gp,
        'OREB_PER_GAME': totals['OREB'] / gp,
        'DREB_PER_GAME': totals['DREB'] / gp,
        'REB_PER_GAME': totals['REB'] / gp,
        'AST_PER_GAME': totals['AST'] / gp,
        'STL_PER_GAME': totals['STL'] / gp,
        'BLK_PER_GAME': totals['BLK'] / gp,
        'TOV_PER_GAME': totals['TOV'] / gp,
        'PF_PER_GAME': totals['PF'] / gp,
        'PTS_PER_GAME': totals['PTS'] / gp,
        'PLUS_MINUS_PER_GAME': totals['PLUS_MINUS'] / gp,
        'FANTASY_PTS_PER_GAME': calculate_fantasy_points(totals) / gp
    }
    
    print(f"   📈 Calculated season stats for player {player_id}")
    return season_stats

def calculate_fantasy_points(stats: Dict[str, Any]) -> float:
    """Calculate fantasy points based on standard scoring"""
    # Standard fantasy basketball scoring
    pts = stats.get('PTS', 0) * 1.0
    reb = stats.get('REB', 0) * 1.2
    ast = stats.get('AST', 0) * 1.5
    stl = stats.get('STL', 0) * 2.0
    blk = stats.get('BLK', 0) * 2.0
    tov = stats.get('TOV', 0) * -1.0
    
    return pts + reb + ast + stl + blk + tov

def import_players_to_database(supabase: Client, players: List[Dict[str, Any]]) -> Dict[str, int]:
    """Import players to database"""
    print("💾 Importing players to database...")
    
    stats = {'imported': 0, 'updated': 0, 'errors': 0}
    
    for player in players:
        try:
            player_data = parse_player_data(player)
            
            result = supabase.rpc('upsert_player', {
                'p_nba_player_id': player_data['nba_player_id'],
                'p_name': player_data['name'],
                'p_first_name': player_data['first_name'],
                'p_last_name': player_data['last_name'],
                'p_position': player_data['position'],
                'p_team_id': player_data['team_id'],
                'p_team_name': player_data['team_name'],
                'p_team_abbreviation': player_data['team_abbreviation'],
                'p_jersey_number': player_data['jersey_number'],
                'p_height': player_data['height'],
                'p_weight': player_data['weight'],
                'p_age': player_data['age'],
                'p_birth_date': player_data['birth_date'],
                'p_birth_city': player_data['birth_city'],
                'p_birth_state': player_data['birth_state'],
                'p_birth_country': player_data['birth_country'],
                'p_college': player_data['college'],
                'p_draft_year': player_data['draft_year'],
                'p_draft_round': player_data['draft_round'],
                'p_draft_number': player_data['draft_number'],
                'p_salary': player_data['salary'],
                'p_is_active': player_data['is_active'],
                'p_is_rookie': player_data['is_rookie'],
                'p_years_pro': player_data['years_pro'],
                'p_from_year': player_data['from_year'],
                'p_to_year': player_data['to_year']
            }).execute()
            
            if result.data:
                stats['imported'] += 1
            else:
                stats['errors'] += 1
                
        except Exception as e:
            stats['errors'] += 1
            print(f"❌ Error importing player {player.get('DISPLAY_FIRST_LAST', 'Unknown')}: {e}")
    
    return stats

def parse_player_data(player: Dict[str, Any]) -> Dict[str, Any]:
    """Parse player data for database insertion"""
    birth_date = None
    if player.get('BIRTHDATE'):
        try:
            birth_date = player['BIRTHDATE'].split('T')[0]
        except:
            birth_date = None
    
    draft_year = int(player['DRAFT_YEAR']) if player.get('DRAFT_YEAR') else None
    draft_round = int(player['DRAFT_ROUND']) if player.get('DRAFT_ROUND') else None
    draft_number = int(player['DRAFT_NUMBER']) if player.get('DRAFT_NUMBER') else None
    weight = int(player['WEIGHT']) if player.get('WEIGHT') else None
    
    is_active = player.get('TO_YEAR') is None or player.get('TO_YEAR', 0) >= 2024
    is_rookie = player.get('SEASON_EXP', 0) == 0
    years_pro = player.get('SEASON_EXP', 0) or 0
    
    return {
        'nba_player_id': player['PERSON_ID'],
        'name': player['DISPLAY_FIRST_LAST'],
        'first_name': player['DISPLAY_FIRST_LAST'].split(' ')[0] if player.get('DISPLAY_FIRST_LAST') else None,
        'last_name': ' '.join(player['DISPLAY_FIRST_LAST'].split(' ')[1:]) if player.get('DISPLAY_FIRST_LAST') and len(player['DISPLAY_FIRST_LAST'].split(' ')) > 1 else None,
        'position': player.get('POSITION'),
        'team_id': player.get('TEAM_ID'),
        'team_name': player.get('TEAM_NAME'),
        'team_abbreviation': player.get('TEAM_ABBREVIATION'),
        'jersey_number': player.get('JERSEY'),
        'height': player.get('HEIGHT'),
        'weight': weight,
        'age': None,
        'birth_date': birth_date,
        'birth_city': None,
        'birth_state': None,
        'birth_country': player.get('COUNTRY'),
        'college': player.get('SCHOOL'),
        'draft_year': draft_year,
        'draft_round': draft_round,
        'draft_number': draft_number,
        'salary': 0,
        'is_active': is_active,
        'is_rookie': is_rookie,
        'years_pro': years_pro,
        'from_year': player.get('FROM_YEAR'),
        'to_year': player.get('TO_YEAR')
    }

def main():
    """Main function"""
    print("🚀 Starting Comprehensive NBA Data Import")
    print(f"👤 User UID: {USER_UID}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 80)
    
    try:
        # Setup
        supabase = setup_supabase()
        
        # Step 1: Import all players
        print("\n📋 STEP 1: Importing all NBA players...")
        players = fetch_all_players()
        player_stats = import_players_to_database(supabase, players)
        print(f"✅ Players imported: {player_stats['imported']}, Errors: {player_stats['errors']}")
        
        # Step 2: Import game logs and season stats for recent seasons
        print(f"\n📊 STEP 2: Importing game logs and season stats for {len(SEASONS_TO_IMPORT)} seasons...")
        
        # Get players from database
        db_players = supabase.table('players').select('id, nba_player_id, name').execute()
        
        total_game_logs = 0
        total_season_stats = 0
        
        for season in SEASONS_TO_IMPORT:
            print(f"\n🏀 Processing season {season}...")
            
            for player in db_players.data[:10]:  # Limit to first 10 players for testing
                try:
                    nba_player_id = player['nba_player_id']
                    player_name = player['name']
                    
                    print(f"   👤 Processing {player_name} (ID: {nba_player_id})...")
                    
                    # Fetch and import game logs
                    game_logs = fetch_player_game_logs(nba_player_id, season)
                    if game_logs:
                        # Import game logs to database
                        for game_log in game_logs:
                            try:
                                # Parse and insert game log
                                game_log_data = parse_game_log_data(game_log, player['id'], nba_player_id)
                                supabase.table('player_game_logs').upsert(game_log_data).execute()
                                total_game_logs += 1
                            except Exception as e:
                                print(f"     ❌ Error importing game log: {e}")
                    
                    # Fetch and import season stats
                    season_stats = fetch_player_season_stats(nba_player_id, season)
                    if season_stats:
                        try:
                            season_data = parse_season_stats_data(season_stats, player['id'], nba_player_id, season)
                            supabase.table('player_season_stats').upsert(season_data).execute()
                            total_season_stats += 1
                        except Exception as e:
                            print(f"     ❌ Error importing season stats: {e}")
                    
                    # Small delay to avoid rate limiting
                    time.sleep(0.5)
                    
                except Exception as e:
                    print(f"   ❌ Error processing player {player.get('name', 'Unknown')}: {e}")
        
        # Final results
        print("\n" + "=" * 80)
        print("🎉 Comprehensive NBA Data Import Completed!")
        print(f"📊 Final Statistics:")
        print(f"   Players imported: {player_stats['imported']}")
        print(f"   Game logs imported: {total_game_logs}")
        print(f"   Season stats imported: {total_season_stats}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Verify import
        print("\n🔍 Verifying import...")
        players_count = supabase.table('players').select('id', count='exact').execute().count
        game_logs_count = supabase.table('player_game_logs').select('id', count='exact').execute().count
        season_stats_count = supabase.table('player_season_stats').select('id', count='exact').execute().count
        
        print(f"✅ Total players in database: {players_count}")
        print(f"✅ Total game logs in database: {game_logs_count}")
        print(f"✅ Total season stats in database: {season_stats_count}")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def parse_game_log_data(game_log: Dict[str, Any], player_id: int, nba_player_id: int) -> Dict[str, Any]:
    """Parse game log data for database insertion"""
    return {
        'player_id': player_id,
        'nba_player_id': nba_player_id,
        'game_id': game_log.get('Game_ID'),
        'game_date': game_log.get('GAME_DATE'),
        'matchup': game_log.get('MATCHUP'),
        'wl': game_log.get('WL'),
        'min': game_log.get('MIN'),
        'fgm': game_log.get('FGM'),
        'fga': game_log.get('FGA'),
        'fg_pct': game_log.get('FG_PCT'),
        'fg3m': game_log.get('FG3M'),
        'fg3a': game_log.get('FG3A'),
        'fg3_pct': game_log.get('FG3_PCT'),
        'ftm': game_log.get('FTM'),
        'fta': game_log.get('FTA'),
        'ft_pct': game_log.get('FT_PCT'),
        'oreb': game_log.get('OREB'),
        'dreb': game_log.get('DREB'),
        'reb': game_log.get('REB'),
        'ast': game_log.get('AST'),
        'stl': game_log.get('STL'),
        'blk': game_log.get('BLK'),
        'tov': game_log.get('TOV'),
        'pf': game_log.get('PF'),
        'pts': game_log.get('PTS'),
        'plus_minus': game_log.get('PLUS_MINUS'),
        'fantasy_pts': calculate_fantasy_points({
            'PTS': game_log.get('PTS', 0),
            'REB': game_log.get('REB', 0),
            'AST': game_log.get('AST', 0),
            'STL': game_log.get('STL', 0),
            'BLK': game_log.get('BLK', 0),
            'TOV': game_log.get('TOV', 0)
        })
    }

def parse_season_stats_data(season_stats: Dict[str, Any], player_id: int, nba_player_id: int, season: str) -> Dict[str, Any]:
    """Parse season stats data for database insertion"""
    return {
        'player_id': player_id,
        'nba_player_id': nba_player_id,
        'season': season,
        'gp': season_stats.get('GP'),
        'min_per_game': season_stats.get('MIN_PER_GAME'),
        'fgm_per_game': season_stats.get('FGM_PER_GAME'),
        'fga_per_game': season_stats.get('FGA_PER_GAME'),
        'fg_pct': season_stats.get('FG_PCT'),
        'fg3m_per_game': season_stats.get('FG3M_PER_GAME'),
        'fg3a_per_game': season_stats.get('FG3A_PER_GAME'),
        'fg3_pct': season_stats.get('FG3_PCT'),
        'ftm_per_game': season_stats.get('FTM_PER_GAME'),
        'fta_per_game': season_stats.get('FTA_PER_GAME'),
        'ft_pct': season_stats.get('FT_PCT'),
        'oreb_per_game': season_stats.get('OREB_PER_GAME'),
        'dreb_per_game': season_stats.get('DREB_PER_GAME'),
        'reb_per_game': season_stats.get('REB_PER_GAME'),
        'ast_per_game': season_stats.get('AST_PER_GAME'),
        'stl_per_game': season_stats.get('STL_PER_GAME'),
        'blk_per_game': season_stats.get('BLK_PER_GAME'),
        'tov_per_game': season_stats.get('TOV_PER_GAME'),
        'pf_per_game': season_stats.get('PF_PER_GAME'),
        'pts_per_game': season_stats.get('PTS_PER_GAME'),
        'plus_minus_per_game': season_stats.get('PLUS_MINUS_PER_GAME'),
        'fantasy_pts_per_game': season_stats.get('FANTASY_PTS_PER_GAME'),
        'total_min': season_stats.get('MIN'),
        'total_fgm': season_stats.get('FGM'),
        'total_fga': season_stats.get('FGA'),
        'total_fg3m': season_stats.get('FG3M'),
        'total_fg3a': season_stats.get('FG3A'),
        'total_ftm': season_stats.get('FTM'),
        'total_fta': season_stats.get('FTA'),
        'total_oreb': season_stats.get('OREB'),
        'total_dreb': season_stats.get('DREB'),
        'total_reb': season_stats.get('REB'),
        'total_ast': season_stats.get('AST'),
        'total_stl': season_stats.get('STL'),
        'total_blk': season_stats.get('BLK'),
        'total_tov': season_stats.get('TOV'),
        'total_pf': season_stats.get('PF'),
        'total_pts': season_stats.get('PTS'),
        'total_fantasy_pts': season_stats.get('FANTASY_PTS_PER_GAME', 0) * season_stats.get('GP', 0)
    }

if __name__ == "__main__":
    main()
