#!/usr/bin/env python3
"""
Get Season Stats for Current NBA Players
Focuses on getting 2023-24 season stats for active players
"""

import os
import sys
import time
from datetime import datetime
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

def get_current_season_players() -> List[Dict[str, Any]]:
    """Get current season players using nba_api"""
    print("🏀 Fetching current season players...")
    
    try:
        from nba_api.stats.endpoints import commonallplayers
        
        # Get current season players
        current_players_response = commonallplayers.CommonAllPlayers(
            is_only_current_season=1,
            league_id='00',
            season='2023-24',
            timeout=60
        )
        
        current_players_df = current_players_response.get_data_frames()[0]
        current_players = current_players_df.to_dict('records')
        
        print(f"📊 Found {len(current_players)} current season players")
        return current_players
        
    except Exception as e:
        print(f"❌ Error fetching current players: {e}")
        return []

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
            'GP': int(len(game_log_df)),
            'MIN': int(game_log_df['MIN'].sum()),
            'FGM': int(game_log_df['FGM'].sum()),
            'FGA': int(game_log_df['FGA'].sum()),
            'FG3M': int(game_log_df['FG3M'].sum()),
            'FG3A': int(game_log_df['FG3A'].sum()),
            'FTM': int(game_log_df['FTM'].sum()),
            'FTA': int(game_log_df['FTA'].sum()),
            'OREB': int(game_log_df['OREB'].sum()),
            'DREB': int(game_log_df['DREB'].sum()),
            'REB': int(game_log_df['REB'].sum()),
            'AST': int(game_log_df['AST'].sum()),
            'STL': int(game_log_df['STL'].sum()),
            'BLK': int(game_log_df['BLK'].sum()),
            'TOV': int(game_log_df['TOV'].sum()),
            'PF': int(game_log_df['PF'].sum()),
            'PTS': int(game_log_df['PTS'].sum()),
            'PLUS_MINUS': int(game_log_df['PLUS_MINUS'].sum())
        }
        
        gp = totals['GP']
        if gp == 0:
            return None
        
        # Calculate averages and percentages
        season_stats = {
            'player_id': int(player_id),
            'season': season,
            'gp': int(gp),
            'min_per_game': float(round(totals['MIN'] / gp, 2)),
            'fgm_per_game': float(round(totals['FGM'] / gp, 2)),
            'fga_per_game': float(round(totals['FGA'] / gp, 2)),
            'fg_pct': float(round(totals['FGM'] / totals['FGA'], 3)) if totals['FGA'] > 0 else 0.0,
            'fg3m_per_game': float(round(totals['FG3M'] / gp, 2)),
            'fg3a_per_game': float(round(totals['FG3A'] / gp, 2)),
            'fg3_pct': float(round(totals['FG3M'] / totals['FG3A'], 3)) if totals['FG3A'] > 0 else 0.0,
            'ftm_per_game': float(round(totals['FTM'] / gp, 2)),
            'fta_per_game': float(round(totals['FTA'] / gp, 2)),
            'ft_pct': float(round(totals['FTM'] / totals['FTA'], 3)) if totals['FTA'] > 0 else 0.0,
            'oreb_per_game': float(round(totals['OREB'] / gp, 2)),
            'dreb_per_game': float(round(totals['DREB'] / gp, 2)),
            'reb_per_game': float(round(totals['REB'] / gp, 2)),
            'ast_per_game': float(round(totals['AST'] / gp, 2)),
            'stl_per_game': float(round(totals['STL'] / gp, 2)),
            'blk_per_game': float(round(totals['BLK'] / gp, 2)),
            'tov_per_game': float(round(totals['TOV'] / gp, 2)),
            'pf_per_game': float(round(totals['PF'] / gp, 2)),
            'pts_per_game': float(round(totals['PTS'] / gp, 2)),
            'plus_minus_per_game': float(round(totals['PLUS_MINUS'] / gp, 2)),
            'fantasy_pts_per_game': float(round(calculate_fantasy_points(totals) / gp, 2)),
            # Totals
            'total_min': int(totals['MIN']),
            'total_fgm': int(totals['FGM']),
            'total_fga': int(totals['FGA']),
            'total_fg3m': int(totals['FG3M']),
            'total_fg3a': int(totals['FG3A']),
            'total_ftm': int(totals['FTM']),
            'total_fta': int(totals['FTA']),
            'total_oreb': int(totals['OREB']),
            'total_dreb': int(totals['DREB']),
            'total_reb': int(totals['REB']),
            'total_ast': int(totals['AST']),
            'total_stl': int(totals['STL']),
            'total_blk': int(totals['BLK']),
            'total_tov': int(totals['TOV']),
            'total_pf': int(totals['PF']),
            'total_pts': int(totals['PTS']),
            'total_fantasy_pts': float(round(calculate_fantasy_points(totals), 2))
        }
        
        return season_stats
        
    except Exception as e:
        print(f"   ❌ Error getting season stats for {player_id}: {e}")
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

def main():
    """Main function"""
    print("🚀 Starting Season Stats Import")
    print(f"👤 User UID: {USER_UID}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 80)
    
    try:
        # Setup
        supabase = setup_supabase()
        
        # Step 1: Get current season players
        print("\n📋 STEP 1: Getting current season players...")
        current_players = get_current_season_players()
        
        if not current_players:
            print("❌ No current players retrieved. Exiting.")
            return
        
        # Step 2: Get season stats for current players
        print(f"\n📊 STEP 2: Getting season stats for {len(current_players)} current players...")
        
        season_stats_imported = 0
        errors = 0
        
        for i, player in enumerate(current_players):
            try:
                player_name = player.get('DISPLAY_FIRST_LAST', 'Unknown')
                player_id = player['PERSON_ID']
                
                print(f"   📊 Processing {player_name} ({i + 1}/{len(current_players)})...")
                
                # Get player from database
                db_player = supabase.table('players').select('id').eq('nba_player_id', player_id).execute()
                if not db_player.data:
                    print(f"     ⚠️  Player {player_name} not found in database")
                    continue
                
                db_player_id = db_player.data[0]['id']
                
                # Get season stats
                season_stats = get_player_season_stats(player_id, "2023-24")
                if season_stats:
                    season_stats['player_id'] = db_player_id
                    season_stats['nba_player_id'] = player_id
                    
                    # Import to database
                    supabase.table('player_season_stats').upsert(season_stats).execute()
                    season_stats_imported += 1
                    print(f"     ✅ Imported season stats for {player_name}")
                else:
                    print(f"     ⚠️  No season stats found for {player_name}")
                
                # Small delay to avoid rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                errors += 1
                print(f"   ❌ Error processing {player.get('DISPLAY_FIRST_LAST', 'Unknown')}: {e}")
        
        # Final results
        print("\n" + "=" * 80)
        print("🎉 Season Stats Import Completed!")
        print(f"📊 Final Statistics:")
        print(f"   Current players processed: {len(current_players)}")
        print(f"   Season stats imported: {season_stats_imported}")
        print(f"   Errors: {errors}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Verify import
        print("\n🔍 Verifying import...")
        players_count = supabase.table('players').select('id', count='exact').execute().count
        season_stats_count = supabase.table('player_season_stats').select('id', count='exact').execute().count
        
        print(f"✅ Total players in database: {players_count}")
        print(f"✅ Total season stats in database: {season_stats_count}")
        
        # Show sample data
        print("\n📋 Sample of players with season stats:")
        sample = supabase.table('player_season_stats').select('nba_player_id, season, gp, pts_per_game, reb_per_game, ast_per_game').limit(5).execute()
        for stat in sample.data:
            print(f"   • Player {stat['nba_player_id']}: {stat['gp']} games, {stat['pts_per_game']} PPG, {stat['reb_per_game']} RPG, {stat['ast_per_game']} APG")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
