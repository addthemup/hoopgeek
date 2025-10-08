#!/usr/bin/env python3
"""
Import 2024-25 NBA Player Game Logs
Imports comprehensive player game log data from NBA API PlayerGameLogs endpoint
"""

import os
import sys
from datetime import datetime, date
import time
import json

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client, Client
from nba_api.stats.endpoints import playergamelogs
from nba_api.stats.library.parameters import Season, SeasonType

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

def safe_int(value):
    """Safely convert value to integer"""
    if value is None or value == '' or value == 'None':
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None

def safe_float(value):
    """Safely convert value to float"""
    if value is None or value == '' or value == 'None':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def safe_str(value):
    """Safely convert value to string"""
    if value is None:
        return None
    return str(value).strip()

def parse_game_date(date_str):
    """Parse game date string to date object"""
    if not date_str:
        return None
    try:
        # Handle both 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SS' formats
        if 'T' in date_str:
            return datetime.strptime(date_str.split('T')[0], '%Y-%m-%d').date()
        else:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return None

def get_all_players(supabase):
    """Get all players from database"""
    print("📋 Fetching all players from database...")
    
    try:
        # Get all players using pagination
        all_players = []
        page_size = 1000
        offset = 0
        
        while True:
            result = supabase.table('players').select('id, nba_player_id, name').limit(page_size).offset(offset).execute()
            
            if not result.data:
                break
                
            all_players.extend(result.data)
            offset += page_size
            
            if len(result.data) < page_size:
                break
        
        players = {player['nba_player_id']: player for player in all_players}
        print(f"✅ Found {len(players)} players in database")
        
        return players
    except Exception as e:
        print(f"❌ Error fetching players: {e}")
        return {}

def import_player_game_logs(supabase, season="2024-25", season_type="Regular Season"):
    """Import player game logs for the specified season"""
    print(f"🏀 Starting Player Game Logs Import for {season} - {season_type}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 80)
    
    # Get all players from database
    players = get_all_players(supabase)
    if not players:
        print("❌ No players found in database")
        return False
    
    try:
        # Get player game logs from NBA API
        print(f"📊 Getting player game logs from NBA API...")
        game_logs = playergamelogs.PlayerGameLogs(
            season_nullable=season,
            season_type_nullable=season_type
        )
        
        # Get the data
        game_logs_data = game_logs.get_data_frames()[0]  # Get the main dataframe
        
        print(f"✅ Found {len(game_logs_data)} game log records from NBA API")
        
        if len(game_logs_data) == 0:
            print("⚠️ No game log data found")
            return False
        
        # Process and import game logs
        print(f"💾 Processing and importing game logs...")
        
        batch_size = 100
        total_imported = 0
        total_skipped = 0
        total_errors = 0
        
        for i in range(0, len(game_logs_data), batch_size):
            batch = game_logs_data[i:i + batch_size]
            batch_data = []
            
            for _, row in batch.iterrows():
                try:
                    # Get player info
                    nba_player_id = safe_int(row.get('PLAYER_ID'))
                    if not nba_player_id or nba_player_id not in players:
                        total_skipped += 1
                        continue
                    
                    player_info = players[nba_player_id]
                    
                    # Parse game date
                    game_date = parse_game_date(row.get('GAME_DATE'))
                    if not game_date:
                        total_skipped += 1
                        continue
                    
                    # Create game log record
                    game_log = {
                        'player_id': player_info['id'],
                        'nba_player_id': nba_player_id,
                        'game_id': safe_str(row.get('GAME_ID')),
                        'season_year': safe_str(row.get('SEASON_YEAR')),
                        'player_name': safe_str(row.get('PLAYER_NAME')),
                        'team_id': safe_int(row.get('TEAM_ID')),
                        'team_abbreviation': safe_str(row.get('TEAM_ABBREVIATION')),
                        'team_name': safe_str(row.get('TEAM_NAME')),
                        'game_date': game_date.isoformat(),
                        'matchup': safe_str(row.get('MATCHUP')),
                        'wl': safe_str(row.get('WL')),
                        'min': safe_int(row.get('MIN')),
                        'fgm': safe_int(row.get('FGM')),
                        'fga': safe_int(row.get('FGA')),
                        'fg_pct': safe_float(row.get('FG_PCT')),
                        'fg3m': safe_int(row.get('FG3M')),
                        'fg3a': safe_int(row.get('FG3A')),
                        'fg3_pct': safe_float(row.get('FG3_PCT')),
                        'ftm': safe_int(row.get('FTM')),
                        'fta': safe_int(row.get('FTA')),
                        'ft_pct': safe_float(row.get('FT_PCT')),
                        'oreb': safe_int(row.get('OREB')),
                        'dreb': safe_int(row.get('DREB')),
                        'reb': safe_int(row.get('REB')),
                        'ast': safe_int(row.get('AST')),
                        'tov': safe_int(row.get('TOV')),
                        'stl': safe_int(row.get('STL')),
                        'blk': safe_int(row.get('BLK')),
                        'blka': safe_int(row.get('BLKA')),
                        'pf': safe_int(row.get('PF')),
                        'pfd': safe_int(row.get('PFD')),
                        'pts': safe_int(row.get('PTS')),
                        'plus_minus': safe_int(row.get('PLUS_MINUS')),
                        'nba_fantasy_pts': safe_float(row.get('NBA_FANTASY_PTS')),
                        'dd2': safe_int(row.get('DD2')),
                        'td3': safe_int(row.get('TD3')),
                        # Rankings
                        'gp_rank': safe_int(row.get('GP_RANK')),
                        'w_rank': safe_int(row.get('W_RANK')),
                        'l_rank': safe_int(row.get('L_RANK')),
                        'w_pct_rank': safe_int(row.get('W_PCT_RANK')),
                        'min_rank': safe_int(row.get('MIN_RANK')),
                        'fgm_rank': safe_int(row.get('FGM_RANK')),
                        'fga_rank': safe_int(row.get('FGA_RANK')),
                        'fg_pct_rank': safe_int(row.get('FG_PCT_RANK')),
                        'fg3m_rank': safe_int(row.get('FG3M_RANK')),
                        'fg3a_rank': safe_int(row.get('FG3A_RANK')),
                        'fg3_pct_rank': safe_int(row.get('FG3_PCT_RANK')),
                        'ftm_rank': safe_int(row.get('FTM_RANK')),
                        'fta_rank': safe_int(row.get('FTA_RANK')),
                        'ft_pct_rank': safe_int(row.get('FT_PCT_RANK')),
                        'oreb_rank': safe_int(row.get('OREB_RANK')),
                        'dreb_rank': safe_int(row.get('DREB_RANK')),
                        'reb_rank': safe_int(row.get('REB_RANK')),
                        'ast_rank': safe_int(row.get('AST_RANK')),
                        'tov_rank': safe_int(row.get('TOV_RANK')),
                        'stl_rank': safe_int(row.get('STL_RANK')),
                        'blk_rank': safe_int(row.get('BLK_RANK')),
                        'blka_rank': safe_int(row.get('BLKA_RANK')),
                        'pf_rank': safe_int(row.get('PF_RANK')),
                        'pfd_rank': safe_int(row.get('PFD_RANK')),
                        'pts_rank': safe_int(row.get('PTS_RANK')),
                        'plus_minus_rank': safe_int(row.get('PLUS_MINUS_RANK')),
                        'nba_fantasy_pts_rank': safe_int(row.get('NBA_FANTASY_PTS_RANK')),
                        'dd2_rank': safe_int(row.get('DD2_RANK')),
                        'td3_rank': safe_int(row.get('TD3_RANK')),
                    }
                    
                    batch_data.append(game_log)
                    
                except Exception as e:
                    print(f"⚠️ Error processing game log row: {e}")
                    total_errors += 1
                    continue
            
            # Import batch to database
            if batch_data:
                try:
                    result = supabase.table('player_game_logs').upsert(
                        batch_data,
                        on_conflict='player_id,game_id'
                    ).execute()
                    
                    batch_imported = len(result.data)
                    total_imported += batch_imported
                    
                    print(f"   Processed batch {i//batch_size + 1}/{(len(game_logs_data) + batch_size - 1)//batch_size}: {batch_imported} records imported")
                    
                except Exception as e:
                    print(f"❌ Error importing batch: {e}")
                    total_errors += len(batch_data)
                    continue
            
            # Rate limiting
            time.sleep(0.1)  # 100ms delay between batches
        
        # Summary
        print("=" * 80)
        print("🎉 Player Game Logs Import Complete!")
        print(f"📊 Summary:")
        print(f"   Total records processed: {len(game_logs_data)}")
        print(f"   ✅ Successfully imported: {total_imported}")
        print(f"   ⚠️  Skipped (no player match): {total_skipped}")
        print(f"   ❌ Errors: {total_errors}")
        print(f"   📈 Success rate: {(total_imported / len(game_logs_data) * 100):.1f}%")
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print(f"❌ Error importing player game logs: {e}")
        return False

def verify_import(supabase):
    """Verify the import by checking some sample data"""
    print("🔍 Verifying import...")
    
    try:
        # Get some sample game logs
        result = supabase.table('player_game_logs').select('*').limit(5).execute()
        
        if result.data:
            print(f"✅ Found {len(result.data)} sample game logs:")
            for log in result.data:
                print(f"   • {log['player_name']}: {log['pts']} pts, {log['reb']} reb, {log['ast']} ast on {log['game_date']}")
        else:
            print("⚠️ No game logs found in database")
            
        # Get total count
        count_result = supabase.table('player_game_logs').select('id', count='exact').execute()
        total_count = count_result.count
        print(f"📊 Total game logs in database: {total_count}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error verifying import: {e}")
        return False

def main():
    """Main function"""
    print("🚀 Starting 2024-25 Player Game Logs Import")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    print("✅ Supabase client initialized")
    
    # Import player game logs for 2024-25 regular season
    success = import_player_game_logs(supabase, "2024-25", "Regular Season")
    
    if success:
        verify_import(supabase)
    else:
        print("❌ Import failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
