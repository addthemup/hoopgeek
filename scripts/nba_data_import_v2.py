#!/usr/bin/env python3
"""
NBA Data Import V2 - Focused on getting comprehensive player data
Uses multiple strategies to get all available data
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

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    print("🔧 Setting up Supabase client...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Supabase client initialized")
    return supabase

def make_nba_request(endpoint: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
    """Make a request to NBA API with retry logic"""
    url = f"{NBA_BASE_URL}/{endpoint}"
    max_retries = 2
    retry_delay = 3
    
    for attempt in range(max_retries):
        try:
            print(f"   📡 Requesting: {endpoint} (attempt {attempt + 1}/{max_retries})")
            response = requests.get(url, headers=NBA_HEADERS, params=params, timeout=45)
            response.raise_for_status()
            
            data = response.json()
            if data.get('resultSets') and len(data['resultSets']) > 0:
                return data
            else:
                print(f"   ⚠️  No data received from {endpoint}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                print(f"   ❌ All attempts failed for {endpoint}")
                return None
        except Exception as e:
            print(f"   ❌ Error: {e}")
            return None
    
    return None

def get_comprehensive_player_data() -> List[Dict[str, Any]]:
    """Get comprehensive player data using multiple strategies"""
    print("🏀 Fetching comprehensive NBA player data...")
    
    all_players = []
    
    # Strategy 1: Get all players (current and historical)
    print("\n📋 Strategy 1: Fetching all players...")
    data = make_nba_request("commonallplayers", {
        "LeagueID": "00",
        "Season": "2023-24",
        "IsOnlyCurrentSeason": "0"
    })
    
    if data:
        players_data = data['resultSets'][0]
        headers = players_data['headers']
        rows = players_data['rowSet']
        
        for row in rows:
            player = {}
            for i, header in enumerate(headers):
                player[header] = row[i] if i < len(row) else None
            all_players.append(player)
        
        print(f"✅ Found {len(all_players)} total players")
    
    # Strategy 2: Get current season players with more details
    print("\n📋 Strategy 2: Fetching current season players...")
    data = make_nba_request("commonallplayers", {
        "LeagueID": "00",
        "Season": "2023-24",
        "IsOnlyCurrentSeason": "1"
    })
    
    if data:
        current_players_data = data['resultSets'][0]
        headers = current_players_data['headers']
        rows = current_players_data['rowSet']
        
        current_players = []
        for row in rows:
            player = {}
            for i, header in enumerate(headers):
                player[header] = row[i] if i < len(row) else None
            current_players.append(player)
        
        print(f"✅ Found {len(current_players)} current season players")
        
        # Merge current season data with all players data
        current_player_ids = {p['PERSON_ID'] for p in current_players}
        for player in all_players:
            if player['PERSON_ID'] in current_player_ids:
                # Update with current season data
                current_data = next(p for p in current_players if p['PERSON_ID'] == player['PERSON_ID'])
                player.update(current_data)
    
    # Strategy 3: Get player details for active players
    print("\n📋 Strategy 3: Fetching player details...")
    active_players = [p for p in all_players if p.get('TO_YEAR') is None or p.get('TO_YEAR', 0) >= 2023]
    print(f"✅ Found {len(active_players)} active players")
    
    return all_players

def get_player_season_stats(player_id: int, season: str = "2023-24") -> Optional[Dict[str, Any]]:
    """Get season stats for a player"""
    print(f"   📊 Getting season stats for player {player_id}...")
    
    # Try different endpoints for season stats
    endpoints = [
        "playergamelog",
        "playerdashboardbygeneralsplits",
        "playerdashboardbyyearoveryear"
    ]
    
    for endpoint in endpoints:
        data = make_nba_request(endpoint, {
            "PlayerID": str(player_id),
            "Season": season,
            "SeasonType": "Regular Season"
        })
        
        if data and data.get('resultSets'):
            # Process the data based on endpoint
            if endpoint == "playergamelog":
                return process_game_log_stats(data, player_id, season)
            elif endpoint == "playerdashboardbygeneralsplits":
                return process_general_splits_stats(data, player_id, season)
    
    return None

def process_game_log_stats(data: Dict[str, Any], player_id: int, season: str) -> Optional[Dict[str, Any]]:
    """Process game log data to calculate season stats"""
    if not data.get('resultSets') or len(data['resultSets']) == 0:
        return None
    
    game_logs_data = data['resultSets'][0]
    headers = game_logs_data['headers']
    rows = game_logs_data['rowSet']
    
    if not rows:
        return None
    
    # Calculate totals
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

def process_general_splits_stats(data: Dict[str, Any], player_id: int, season: str) -> Optional[Dict[str, Any]]:
    """Process general splits data for season stats"""
    # This would process the general splits endpoint data
    # For now, return None to use game log processing
    return None

def calculate_fantasy_points(stats: Dict[str, Any]) -> float:
    """Calculate fantasy points based on standard scoring"""
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
    
    for i, player in enumerate(players):
        try:
            if i % 50 == 0:
                print(f"   Processing player {i + 1}/{len(players)}...")
            
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
            if i < 10:  # Only print first 10 errors
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
    
    is_active = player.get('TO_YEAR') is None or player.get('TO_YEAR', 0) >= 2023
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
    print("🚀 Starting NBA Data Import V2")
    print(f"👤 User UID: {USER_UID}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 80)
    
    try:
        # Setup
        supabase = setup_supabase()
        
        # Step 1: Get comprehensive player data
        print("\n📋 STEP 1: Getting comprehensive player data...")
        players = get_comprehensive_player_data()
        
        # Step 2: Import players to database
        print(f"\n💾 STEP 2: Importing {len(players)} players to database...")
        player_stats = import_players_to_database(supabase, players)
        print(f"✅ Players imported: {player_stats['imported']}, Errors: {player_stats['errors']}")
        
        # Step 3: Get season stats for active players (limited for testing)
        print(f"\n📊 STEP 3: Getting season stats for active players...")
        active_players = [p for p in players if p.get('TO_YEAR') is None or p.get('TO_YEAR', 0) >= 2023]
        print(f"Found {len(active_players)} active players")
        
        # Get season stats for first 20 active players (for testing)
        season_stats_imported = 0
        for i, player in enumerate(active_players[:20]):
            try:
                print(f"   📊 Processing {player.get('DISPLAY_FIRST_LAST', 'Unknown')} ({i + 1}/20)...")
                
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
                
                # Small delay to avoid rate limiting
                time.sleep(1)
                
            except Exception as e:
                print(f"   ❌ Error processing {player.get('DISPLAY_FIRST_LAST', 'Unknown')}: {e}")
        
        # Final results
        print("\n" + "=" * 80)
        print("🎉 NBA Data Import V2 Completed!")
        print(f"📊 Final Statistics:")
        print(f"   Players imported: {player_stats['imported']}")
        print(f"   Season stats imported: {season_stats_imported}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Verify import
        print("\n🔍 Verifying import...")
        players_count = supabase.table('players').select('id', count='exact').execute().count
        season_stats_count = supabase.table('player_season_stats').select('id', count='exact').execute().count
        
        print(f"✅ Total players in database: {players_count}")
        print(f"✅ Total season stats in database: {season_stats_count}")
        
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
