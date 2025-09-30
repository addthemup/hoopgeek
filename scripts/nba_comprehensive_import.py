#!/usr/bin/env python3
"""
Comprehensive NBA Data Import using nba_api library
Imports all players, their stats, and game logs
"""

import os
import sys
import json
import time
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from supabase import create_client, Client

# Configuration
SUPABASE_URL = "https://lsnqmdeagfzuvrypiiwi.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbnFtZGVhZ2Z6dXZyeXBpaXdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI1MTU5MSwiZXhwIjoyMDc0ODI3NTkxfQ.uOD1oFhjd6ISP7XJu7OtYYG_SwU7uZR74h8byY3HNPo"
USER_UID = "fd58dfb7-ad5d-43e2-b2c4-c254e2a29211"

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    print("🔧 Setting up Supabase client...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Supabase client initialized")
    return supabase

def get_all_players() -> List[Dict[str, Any]]:
    """Get all NBA players using nba_api"""
    print("🏀 Fetching all NBA players using nba_api...")
    
    try:
        from nba_api.stats.endpoints import commonallplayers
        
        # Get all players (current and historical)
        all_players_response = commonallplayers.CommonAllPlayers(
            is_only_current_season=0,
            league_id='00',
            season='2023-24',
            timeout=60
        )
        
        all_players_df = all_players_response.get_data_frames()[0]
        all_players = all_players_df.to_dict('records')
        
        print(f"📊 Found {len(all_players)} total players")
        
        # Get current season players for additional data
        current_players_response = commonallplayers.CommonAllPlayers(
            is_only_current_season=1,
            league_id='00',
            season='2023-24',
            timeout=60
        )
        
        current_players_df = current_players_response.get_data_frames()[0]
        current_players = current_players_df.to_dict('records')
        
        print(f"📊 Found {len(current_players)} current season players")
        
        # Merge data - prioritize current season data
        current_player_ids = {p['PERSON_ID'] for p in current_players}
        for player in all_players:
            if player['PERSON_ID'] in current_player_ids:
                # Update with current season data
                current_data = next(p for p in current_players if p['PERSON_ID'] == player['PERSON_ID'])
                player.update(current_data)
        
        return all_players
        
    except ImportError:
        print("❌ nba_api library not installed. Installing...")
        os.system("pip3 install nba_api")
        print("✅ nba_api installed. Please run the script again.")
        return []
    except Exception as e:
        print(f"❌ Error fetching players: {e}")
        return []

def get_player_details(player_id: int) -> Optional[Dict[str, Any]]:
    """Get detailed player information"""
    try:
        from nba_api.stats.endpoints import commonplayerinfo
        
        player_info_response = commonplayerinfo.CommonPlayerInfo(
            player_id=player_id,
            timeout=30
        )
        
        player_info_df = player_info_response.get_data_frames()[0]
        if not player_info_df.empty:
            return player_info_df.to_dict('records')[0]
        
        return None
        
    except Exception as e:
        print(f"   ❌ Error getting player details for {player_id}: {e}")
        return None

def get_player_season_stats(player_id: int, season: str = "2023-24") -> Optional[Dict[str, Any]]:
    """Get season stats for a player"""
    try:
        from nba_api.stats.endpoints import playergamelog
        
        game_log_response = playergamelog.PlayerGameLog(
            player_id=player_id,
            season=season,
            season_type_all_star='Regular Season',
            timeout=30
        )
        
        game_log_df = game_log_response.get_data_frames()[0]
        
        if game_log_df.empty:
            return None
        
        # Calculate season totals and averages
        totals = {
            'GP': len(game_log_df),
            'MIN': game_log_df['MIN'].sum(),
            'FGM': game_log_df['FGM'].sum(),
            'FGA': game_log_df['FGA'].sum(),
            'FG3M': game_log_df['FG3M'].sum(),
            'FG3A': game_log_df['FG3A'].sum(),
            'FTM': game_log_df['FTM'].sum(),
            'FTA': game_log_df['FTA'].sum(),
            'OREB': game_log_df['OREB'].sum(),
            'DREB': game_log_df['DREB'].sum(),
            'REB': game_log_df['REB'].sum(),
            'AST': game_log_df['AST'].sum(),
            'STL': game_log_df['STL'].sum(),
            'BLK': game_log_df['BLK'].sum(),
            'TOV': game_log_df['TOV'].sum(),
            'PF': game_log_df['PF'].sum(),
            'PTS': game_log_df['PTS'].sum(),
            'PLUS_MINUS': game_log_df['PLUS_MINUS'].sum()
        }
        
        gp = totals['GP']
        if gp == 0:
            return None
        
        # Calculate averages and percentages
        season_stats = {
            'player_id': player_id,
            'season': season,
            'gp': gp,
            'min_per_game': round(totals['MIN'] / gp, 2),
            'fgm_per_game': round(totals['FGM'] / gp, 2),
            'fga_per_game': round(totals['FGA'] / gp, 2),
            'fg_pct': round(totals['FGM'] / totals['FGA'], 3) if totals['FGA'] > 0 else 0,
            'fg3m_per_game': round(totals['FG3M'] / gp, 2),
            'fg3a_per_game': round(totals['FG3A'] / gp, 2),
            'fg3_pct': round(totals['FG3M'] / totals['FG3A'], 3) if totals['FG3A'] > 0 else 0,
            'ftm_per_game': round(totals['FTM'] / gp, 2),
            'fta_per_game': round(totals['FTA'] / gp, 2),
            'ft_pct': round(totals['FTM'] / totals['FTA'], 3) if totals['FTA'] > 0 else 0,
            'oreb_per_game': round(totals['OREB'] / gp, 2),
            'dreb_per_game': round(totals['DREB'] / gp, 2),
            'reb_per_game': round(totals['REB'] / gp, 2),
            'ast_per_game': round(totals['AST'] / gp, 2),
            'stl_per_game': round(totals['STL'] / gp, 2),
            'blk_per_game': round(totals['BLK'] / gp, 2),
            'tov_per_game': round(totals['TOV'] / gp, 2),
            'pf_per_game': round(totals['PF'] / gp, 2),
            'pts_per_game': round(totals['PTS'] / gp, 2),
            'plus_minus_per_game': round(totals['PLUS_MINUS'] / gp, 2),
            'fantasy_pts_per_game': round(calculate_fantasy_points(totals) / gp, 2),
            # Totals
            'total_min': totals['MIN'],
            'total_fgm': totals['FGM'],
            'total_fga': totals['FGA'],
            'total_fg3m': totals['FG3M'],
            'total_fg3a': totals['FG3A'],
            'total_ftm': totals['FTM'],
            'total_fta': totals['FTA'],
            'total_oreb': totals['OREB'],
            'total_dreb': totals['DREB'],
            'total_reb': totals['REB'],
            'total_ast': totals['AST'],
            'total_stl': totals['STL'],
            'total_blk': totals['BLK'],
            'total_tov': totals['TOV'],
            'total_pf': totals['PF'],
            'total_pts': totals['PTS'],
            'total_fantasy_pts': round(calculate_fantasy_points(totals), 2)
        }
        
        return season_stats
        
    except Exception as e:
        print(f"   ❌ Error getting season stats for {player_id}: {e}")
        return None

def get_player_game_logs(player_id: int, season: str = "2023-24") -> List[Dict[str, Any]]:
    """Get game logs for a player"""
    try:
        from nba_api.stats.endpoints import playergamelog
        
        game_log_response = playergamelog.PlayerGameLog(
            player_id=player_id,
            season=season,
            season_type_all_star='Regular Season',
            timeout=30
        )
        
        game_log_df = game_log_response.get_data_frames()[0]
        
        if game_log_df.empty:
            return []
        
        game_logs = []
        for _, row in game_log_df.iterrows():
            game_log = {
                'player_id': player_id,
                'nba_player_id': player_id,
                'game_id': row.get('Game_ID'),
                'game_date': row.get('GAME_DATE'),
                'matchup': row.get('MATCHUP'),
                'wl': row.get('WL'),
                'min': row.get('MIN'),
                'fgm': row.get('FGM'),
                'fga': row.get('FGA'),
                'fg_pct': row.get('FG_PCT'),
                'fg3m': row.get('FG3M'),
                'fg3a': row.get('FG3A'),
                'fg3_pct': row.get('FG3_PCT'),
                'ftm': row.get('FTM'),
                'fta': row.get('FTA'),
                'ft_pct': row.get('FT_PCT'),
                'oreb': row.get('OREB'),
                'dreb': row.get('DREB'),
                'reb': row.get('REB'),
                'ast': row.get('AST'),
                'stl': row.get('STL'),
                'blk': row.get('BLK'),
                'tov': row.get('TOV'),
                'pf': row.get('PF'),
                'pts': row.get('PTS'),
                'plus_minus': row.get('PLUS_MINUS'),
                'fantasy_pts': calculate_fantasy_points({
                    'PTS': row.get('PTS', 0),
                    'REB': row.get('REB', 0),
                    'AST': row.get('AST', 0),
                    'STL': row.get('STL', 0),
                    'BLK': row.get('BLK', 0),
                    'TOV': row.get('TOV', 0)
                })
            }
            game_logs.append(game_log)
        
        return game_logs
        
    except Exception as e:
        print(f"   ❌ Error getting game logs for {player_id}: {e}")
        return []

def calculate_fantasy_points(stats: Dict[str, Any]) -> float:
    """Calculate fantasy points based on standard scoring"""
    pts = stats.get('PTS', 0) * 1.0
    reb = stats.get('REB', 0) * 1.2
    ast = stats.get('AST', 0) * 1.5
    stl = stats.get('STL', 0) * 2.0
    blk = stats.get('BLK', 0) * 2.0
    tov = stats.get('TOV', 0) * -1.0
    
    return pts + reb + ast + stl + blk + tov

def parse_player_data(player: Dict[str, Any], player_details: Dict[str, Any] = None) -> Dict[str, Any]:
    """Parse player data for database insertion"""
    
    # Use player details if available, otherwise use basic player data
    if player_details:
        # Parse birth date
        birth_date = None
        if player_details.get('BIRTHDATE'):
            try:
                birth_date = player_details['BIRTHDATE'].split('T')[0]
            except:
                birth_date = None
        
        # Parse draft information
        draft_year = int(player_details['DRAFT_YEAR']) if player_details.get('DRAFT_YEAR') else None
        draft_round = int(player_details['DRAFT_ROUND']) if player_details.get('DRAFT_ROUND') else None
        draft_number = int(player_details['DRAFT_NUMBER']) if player_details.get('DRAFT_NUMBER') else None
        weight = int(player_details['WEIGHT']) if player_details.get('WEIGHT') else None
        
        return {
            'nba_player_id': player['PERSON_ID'],
            'name': player_details.get('DISPLAY_FIRST_LAST') or player['DISPLAY_FIRST_LAST'],
            'first_name': player_details.get('FIRST_NAME'),
            'last_name': player_details.get('LAST_NAME'),
            'position': player_details.get('POSITION'),
            'team_id': player.get('TEAM_ID'),
            'team_name': player.get('TEAM_NAME'),
            'team_abbreviation': player.get('TEAM_ABBREVIATION'),
            'jersey_number': player_details.get('JERSEY'),
            'height': player_details.get('HEIGHT'),
            'weight': weight,
            'age': player_details.get('AGE'),
            'birth_date': birth_date,
            'birth_city': player_details.get('BIRTH_CITY'),
            'birth_state': player_details.get('BIRTH_STATE'),
            'birth_country': player_details.get('BIRTH_COUNTRY'),
            'college': player_details.get('SCHOOL'),
            'draft_year': draft_year,
            'draft_round': draft_round,
            'draft_number': draft_number,
            'salary': 0,  # Will be updated separately
            'is_active': player.get('TO_YEAR') is None or (isinstance(player.get('TO_YEAR'), (int, float)) and player.get('TO_YEAR', 0) >= 2023),
            'is_rookie': player_details.get('SEASON_EXP', 0) == 0,
            'years_pro': player_details.get('SEASON_EXP', 0) or 0,
            'from_year': player.get('FROM_YEAR'),
            'to_year': player.get('TO_YEAR')
        }
    else:
        # Basic player data parsing
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
        
        is_active = player.get('TO_YEAR') is None or (isinstance(player.get('TO_YEAR'), (int, float)) and player.get('TO_YEAR', 0) >= 2023)
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

def import_players_to_database(supabase: Client, players: List[Dict[str, Any]]) -> Dict[str, int]:
    """Import players to database"""
    print("💾 Importing players to database...")
    
    stats = {'imported': 0, 'updated': 0, 'errors': 0}
    
    for i, player in enumerate(players):
        try:
            if i % 100 == 0:
                print(f"   Processing player {i + 1}/{len(players)}...")
            
            # Get detailed player info for active players
            player_details = None
            if player.get('TO_YEAR') is None or (isinstance(player.get('TO_YEAR'), (int, float)) and player.get('TO_YEAR', 0) >= 2023):
                player_details = get_player_details(player['PERSON_ID'])
                time.sleep(0.1)  # Small delay to avoid rate limiting
            
            player_data = parse_player_data(player, player_details)
            
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
            if i < 10:  # Only print first 10 errors
                print(f"❌ Error importing player {player.get('DISPLAY_FIRST_LAST', 'Unknown')}: {e}")
    
    return stats

def main():
    """Main function"""
    print("🚀 Starting Comprehensive NBA Data Import")
    print(f"👤 User UID: {USER_UID}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 80)
    
    try:
        # Setup
        supabase = setup_supabase()
        
        # Step 1: Get all players
        print("\n📋 STEP 1: Getting all NBA players...")
        players = get_all_players()
        
        if not players:
            print("❌ No players retrieved. Exiting.")
            return
        
        # Step 2: Import players to database
        print(f"\n💾 STEP 2: Importing {len(players)} players to database...")
        player_stats = import_players_to_database(supabase, players)
        print(f"✅ Players imported: {player_stats['imported']}, Errors: {player_stats['errors']}")
        
        # Step 3: Get season stats for active players (limited for testing)
        print(f"\n📊 STEP 3: Getting season stats for active players...")
        # Get active players - those who played in 2023-24 season
        active_players = [p for p in players if p.get('TO_YEAR') is None or p.get('TO_YEAR') == '' or (isinstance(p.get('TO_YEAR'), (int, float)) and p.get('TO_YEAR', 0) >= 2023)]
        print(f"Found {len(active_players)} active players")
        
        # Get season stats for first 50 active players (for testing)
        season_stats_imported = 0
        game_logs_imported = 0
        
        for i, player in enumerate(active_players[:50]):
            try:
                print(f"   📊 Processing {player.get('DISPLAY_FIRST_LAST', 'Unknown')} ({i + 1}/50)...")
                
                # Get player from database
                db_player = supabase.table('players').select('id').eq('nba_player_id', player['PERSON_ID']).execute()
                if not db_player.data:
                    continue
                
                player_id = db_player.data[0]['id']
                
                # Get season stats
                season_stats = get_player_season_stats(player['PERSON_ID'], "2023-24")
                if season_stats:
                    season_stats['player_id'] = player_id
                    season_stats['nba_player_id'] = player['PERSON_ID']
                    
                    # Import to database
                    supabase.table('player_season_stats').upsert(season_stats).execute()
                    season_stats_imported += 1
                
                # Get game logs (first 10 games for testing)
                game_logs = get_player_game_logs(player['PERSON_ID'], "2023-24")
                if game_logs:
                    # Import first 10 game logs
                    for game_log in game_logs[:10]:
                        game_log['player_id'] = player_id
                        supabase.table('player_game_logs').upsert(game_log).execute()
                        game_logs_imported += 1
                
                # Small delay to avoid rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                print(f"   ❌ Error processing {player.get('DISPLAY_FIRST_LAST', 'Unknown')}: {e}")
        
        # Final results
        print("\n" + "=" * 80)
        print("🎉 Comprehensive NBA Data Import Completed!")
        print(f"📊 Final Statistics:")
        print(f"   Players imported: {player_stats['imported']}")
        print(f"   Season stats imported: {season_stats_imported}")
        print(f"   Game logs imported: {game_logs_imported}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Verify import
        print("\n🔍 Verifying import...")
        players_count = supabase.table('players').select('id', count='exact').execute().count
        season_stats_count = supabase.table('player_season_stats').select('id', count='exact').execute().count
        game_logs_count = supabase.table('player_game_logs').select('id', count='exact').execute().count
        
        print(f"✅ Total players in database: {players_count}")
        print(f"✅ Total season stats in database: {season_stats_count}")
        print(f"✅ Total game logs in database: {game_logs_count}")
        
        # Show sample data
        print("\n📋 Sample of imported players with stats:")
        sample = supabase.table('players').select('name, position, team_name, is_active').limit(5).execute()
        for player in sample.data:
            status = "Active" if player['is_active'] else "Inactive"
            print(f"   • {player['name']} ({player['position']}) - {player['team_name']} - {status}")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
