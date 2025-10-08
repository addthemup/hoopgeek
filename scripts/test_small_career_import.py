#!/usr/bin/env python3
"""
Small Career Stats Import Test
Imports career stats for just a few players to test the full pipeline.
"""

import os
import sys
import time
from supabase import create_client, Client
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.library.parameters import PerMode36, LeagueIDNullable

def setup_supabase() -> Client:
    """Initialize Supabase client with service role key."""
    url = os.getenv('VITE_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("❌ Error: Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables")
        sys.exit(1)
    
    return create_client(url, key)

def safe_int(value):
    """Safely convert value to integer."""
    try:
        if value is None or value == '':
            return None
        return int(float(value))
    except:
        return None

def safe_float(value):
    """Safely convert value to float."""
    try:
        if value is None or value == '':
            return None
        return float(value)
    except:
        return None

def safe_str(value, max_length=None):
    """Safely convert value to string with optional length limit."""
    try:
        if value is None:
            return None
        str_value = str(value)
        if max_length and len(str_value) > max_length:
            return str_value[:max_length]
        return str_value
    except:
        return None

def calculate_fantasy_points(row):
    """Calculate fantasy points from basic stats."""
    try:
        pts = float(row.get('PTS', 0) or 0)
        reb = float(row.get('REB', 0) or 0)
        ast = float(row.get('AST', 0) or 0)
        stl = float(row.get('STL', 0) or 0)
        blk = float(row.get('BLK', 0) or 0)
        tov = float(row.get('TOV', 0) or 0)
        fg3m = float(row.get('FG3M', 0) or 0)
        
        # Standard fantasy scoring: PTS=1, REB=1.2, AST=1.5, STL=2, BLK=2, TOV=-1, 3PM=0.5
        fantasy_pts = (pts * 1.0) + (reb * 1.2) + (ast * 1.5) + (stl * 2.0) + (blk * 2.0) - (tov * 1.0) + (fg3m * 0.5)
        return round(fantasy_pts, 2)
    except:
        return 0.0

def test_career_stats_import():
    """Test career stats import with LeBron James."""
    print("🧪 Testing Career Stats Import with LeBron James")
    print("=" * 50)
    
    # Setup
    supabase = setup_supabase()
    
    # Test with LeBron James
    player_id = 1  # Assuming LeBron is player ID 1 in our database
    nba_player_id = 2544
    player_name = "LeBron James"
    
    print(f"🏀 Testing with {player_name} (NBA ID: {nba_player_id})")
    
    try:
        # Fetch career stats from NBA API
        print("  📡 Fetching career stats from NBA API...")
        career_stats = playercareerstats.PlayerCareerStats(
            player_id=nba_player_id,
            per_mode36=PerMode36.totals,
            league_id_nullable=LeagueIDNullable.nba,
            timeout=30
        )
        
        # Get the regular season career totals
        regular_season_df = career_stats.career_totals_regular_season.get_data_frame()
        print(f"  ✅ Fetched regular season career totals: {len(regular_season_df)} records")
        
        if not regular_season_df.empty:
            # Get the first (and usually only) row
            row = regular_season_df.iloc[0].to_dict()
            print(f"  📊 Sample data:")
            print(f"     • Games Played: {row.get('GP', 'N/A')}")
            print(f"     • Points: {row.get('PTS', 'N/A')}")
            print(f"     • Rebounds: {row.get('REB', 'N/A')}")
            print(f"     • Assists: {row.get('AST', 'N/A')}")
            
            # Prepare data for database
            data = {
                'player_id': player_id,
                'nba_player_id': nba_player_id,
                'league_id': safe_int(row.get('LEAGUE_ID')),
                'team_id': safe_int(row.get('TEAM_ID')),
                'gp': safe_int(row.get('GP')),
                'gs': safe_int(row.get('GS')),
                'min_total': safe_int(row.get('MIN')),
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
                'stl': safe_int(row.get('STL')),
                'blk': safe_int(row.get('BLK')),
                'tov': safe_int(row.get('TOV')),
                'pf': safe_int(row.get('PF')),
                'pts': safe_int(row.get('PTS')),
                'fantasy_pts': calculate_fantasy_points(row)
            }
            
            print(f"  💾 Inserting into database...")
            
            # Insert into database
            response = supabase.table('player_career_totals_regular_season').upsert(data, on_conflict='player_id').execute()
            print(f"  ✅ Successfully inserted career stats for {player_name}")
            
            # Verify the insert
            verify_response = supabase.table('player_career_totals_regular_season').select('*').eq('player_id', player_id).execute()
            if verify_response.data:
                record = verify_response.data[0]
                print(f"  🔍 Verification:")
                print(f"     • Player ID: {record.get('player_id')}")
                print(f"     • Games Played: {record.get('gp')}")
                print(f"     • Points: {record.get('pts')}")
                print(f"     • Fantasy Points: {record.get('fantasy_pts')}")
            
        else:
            print("  ⚠️  No regular season career data found")
        
        # Test season totals
        print("\n  📊 Testing season totals...")
        season_totals_df = career_stats.season_totals_regular_season.get_data_frame()
        print(f"  ✅ Fetched season totals: {len(season_totals_df)} records")
        
        if not season_totals_df.empty:
            # Insert first few seasons as a test
            test_seasons = season_totals_df.head(3)  # Just test with first 3 seasons
            success_count = 0
            
            for _, row in test_seasons.iterrows():
                season_data = {
                    'player_id': player_id,
                    'nba_player_id': nba_player_id,
                    'season_id': safe_str(row.get('SEASON_ID'), 10),
                    'league_id': safe_int(row.get('LEAGUE_ID')),
                    'team_id': safe_int(row.get('TEAM_ID')),
                    'team_abbreviation': safe_str(row.get('TEAM_ABBREVIATION'), 10),
                    'player_age': safe_int(row.get('PLAYER_AGE')),
                    'gp': safe_int(row.get('GP')),
                    'gs': safe_int(row.get('GS')),
                    'min_total': safe_int(row.get('MIN')),
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
                    'stl': safe_int(row.get('STL')),
                    'blk': safe_int(row.get('BLK')),
                    'tov': safe_int(row.get('TOV')),
                    'pf': safe_int(row.get('PF')),
                    'pts': safe_int(row.get('PTS')),
                    'fantasy_pts': calculate_fantasy_points(row)
                }
                
                try:
                    response = supabase.table('player_season_totals_regular_season').upsert(season_data, on_conflict='player_id,season_id').execute()
                    success_count += 1
                    print(f"     ✅ Inserted season {season_data['season_id']}")
                except Exception as e:
                    print(f"     ❌ Error inserting season {season_data.get('season_id', 'Unknown')}: {e}")
            
            print(f"  📊 Successfully inserted {success_count}/{len(test_seasons)} season records")
        
        print("\n✅ Career stats import test completed successfully!")
        print("\n🚀 The full import script should work correctly.")
        
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return False
    
    return True

if __name__ == "__main__":
    test_career_stats_import()
