#!/usr/bin/env python3
"""
NBA Career Stats Import using nba_api library
Imports detailed career statistics using the official nba_api Python library
"""

import os
import sys
import time
from datetime import datetime
from supabase import create_client, Client
from typing import List, Dict, Any, Optional

# Configuration (support both frontend and backend env var names)
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL', 'https://qbznyaimnrpibmahisue.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    print("🔧 Setting up Supabase client...")
    
    if not SUPABASE_URL:
        raise Exception("SUPABASE_URL/VITE_SUPABASE_URL environment variable is not set")
    
    if not SUPABASE_SERVICE_KEY:
        raise Exception("SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY environment variable is not set")
    
    print(f"   Using Supabase URL: {SUPABASE_URL}")
    print(f"   Service key: {'*' * 20}{SUPABASE_SERVICE_KEY[-10:] if SUPABASE_SERVICE_KEY else 'None'}")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Supabase client initialized")
    return supabase

def get_players_for_career_stats(supabase: Client, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get players that need career stats imported (backwards-compatible helper)."""
    # Kept for compatibility; fetches up to `limit` or defaults to API cap (~1000)
    print("📋 Fetching players (non-paginated)...")
    query = supabase.table('players').select('id, nba_player_id, name, is_active').order('id')
    if limit:
        query = query.limit(limit)
    result = query.execute()
    players = result.data or []
    print(f"✅ Found {len(players)} players (non-paginated)")
    return players

def get_all_players_paginated(supabase: Client, page_size: int = 1000) -> List[Dict[str, Any]]:
    """Fetch all players in paginated batches to bypass 1000-row limit."""
    print("📋 Fetching players for career stats import (paginated)...")
    all_players: List[Dict[str, Any]] = []
    # First query just to get count
    head = supabase.table('players').select('id', count='exact').limit(1).execute()
    total = head.count or 0
    print(f"   Total players in DB: {total}")
    if total == 0:
        return []
    pages = (total + page_size - 1) // page_size
    for page in range(pages):
        start = page * page_size
        end = min(start + page_size - 1, total - 1)
        print(f"   Fetching players {start+1}-{end+1}...")
        batch = (
            supabase
            .table('players')
            .select('id, nba_player_id, name, is_active')
            .order('id')
            .range(start, end)
            .execute()
        )
        data = batch.data or []
        all_players.extend(data)
        # Gentle pace between pages
        time.sleep(0.5)
    print(f"✅ Found {len(all_players)} players (paginated)")
    return all_players

def calculate_fantasy_points(stats: Dict[str, Any]) -> float:
    """Calculate fantasy points based on standard scoring"""
    try:
        pts = float(stats.get('PTS', 0) or 0)
        reb = float(stats.get('REB', 0) or 0)
        ast = float(stats.get('AST', 0) or 0)
        stl = float(stats.get('STL', 0) or 0)
        blk = float(stats.get('BLK', 0) or 0)
        tov = float(stats.get('TOV', 0) or 0)
        
        # Standard fantasy scoring: 1pt per point, 1.2 per rebound, 1.5 per assist, 2 per steal/block, -1 per turnover
        fantasy_pts = pts + (reb * 1.2) + (ast * 1.5) + (stl * 2) + (blk * 2) - tov
        return round(fantasy_pts, 2)
    except:
        return 0.0

def safe_int(value):
    """Safely convert to int"""
    try:
        return int(value) if value is not None and value != '' else None
    except (ValueError, TypeError):
        return None

def safe_float(value):
    """Safely convert to float"""
    try:
        return float(value) if value is not None and value != '' else None
    except (ValueError, TypeError):
        return None

def import_career_totals_regular_season(supabase: Client, player_id: int, nba_player_id: int, career_data: Dict[str, Any]) -> bool:
    """Import career totals for regular season"""
    try:
        if 'CareerTotalsRegularSeason' not in career_data:
            return False
        
        totals = career_data['CareerTotalsRegularSeason']
        if not totals:
            return False
        
        # Get the first (and usually only) entry
        stats = totals[0]
        
        fantasy_pts = calculate_fantasy_points(stats)
        
        data = {
            'player_id': player_id,
            'nba_player_id': nba_player_id,
            'league_id': safe_int(stats.get('LEAGUE_ID')),
            'team_id': safe_int(stats.get('TEAM_ID')),
            'gp': safe_int(stats.get('GP')),
            'gs': safe_int(stats.get('GS')),
            'min_total': safe_int(stats.get('MIN')),
            'fgm': safe_int(stats.get('FGM')),
            'fga': safe_int(stats.get('FGA')),
            'fg_pct': safe_float(stats.get('FG_PCT')),
            'fg3m': safe_int(stats.get('FG3M')),
            'fg3a': safe_int(stats.get('FG3A')),
            'fg3_pct': safe_float(stats.get('FG3_PCT')),
            'ftm': safe_int(stats.get('FTM')),
            'fta': safe_int(stats.get('FTA')),
            'ft_pct': safe_float(stats.get('FT_PCT')),
            'oreb': safe_int(stats.get('OREB')),
            'dreb': safe_int(stats.get('DREB')),
            'reb': safe_int(stats.get('REB')),
            'ast': safe_int(stats.get('AST')),
            'stl': safe_int(stats.get('STL')),
            'blk': safe_int(stats.get('BLK')),
            'tov': safe_int(stats.get('TOV')),
            'pf': safe_int(stats.get('PF')),
            'pts': safe_int(stats.get('PTS')),
            'fantasy_pts': fantasy_pts
        }
        
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}
        
        # Upsert the data
        result = supabase.table('player_career_totals_regular_season').upsert(
            data, 
            on_conflict='player_id'
        ).execute()
        
        return len(result.data) > 0
        
    except Exception as e:
        print(f"❌ Error importing regular season career totals: {e}")
        return False

def import_season_totals_regular_season(supabase: Client, player_id: int, nba_player_id: int, career_data: Dict[str, Any]) -> int:
    """Import season totals for regular season (year by year)"""
    try:
        if 'SeasonTotalsRegularSeason' not in career_data:
            return 0
        
        seasons = career_data['SeasonTotalsRegularSeason']
        if not seasons:
            return 0
        
        imported_count = 0
        
        for season_stats in seasons:
            fantasy_pts = calculate_fantasy_points(season_stats)
            
            data = {
                'player_id': player_id,
                'nba_player_id': nba_player_id,
                'season_id': season_stats.get('SEASON_ID'),
                'league_id': safe_int(season_stats.get('LEAGUE_ID')),
                'team_id': safe_int(season_stats.get('TEAM_ID')),
                'team_abbreviation': season_stats.get('TEAM_ABBREVIATION'),
                'player_age': safe_int(season_stats.get('PLAYER_AGE')),
                'gp': safe_int(season_stats.get('GP')),
                'gs': safe_int(season_stats.get('GS')),
                'min_total': safe_int(season_stats.get('MIN')),
                'fgm': safe_int(season_stats.get('FGM')),
                'fga': safe_int(season_stats.get('FGA')),
                'fg_pct': safe_float(season_stats.get('FG_PCT')),
                'fg3m': safe_int(season_stats.get('FG3M')),
                'fg3a': safe_int(season_stats.get('FG3A')),
                'fg3_pct': safe_float(season_stats.get('FG3_PCT')),
                'ftm': safe_int(season_stats.get('FTM')),
                'fta': safe_int(season_stats.get('FTA')),
                'ft_pct': safe_float(season_stats.get('FT_PCT')),
                'oreb': safe_int(season_stats.get('OREB')),
                'dreb': safe_int(season_stats.get('DREB')),
                'reb': safe_int(season_stats.get('REB')),
                'ast': safe_int(season_stats.get('AST')),
                'stl': safe_int(season_stats.get('STL')),
                'blk': safe_int(season_stats.get('BLK')),
                'tov': safe_int(season_stats.get('TOV')),
                'pf': safe_int(season_stats.get('PF')),
                'pts': safe_int(season_stats.get('PTS')),
                'fantasy_pts': fantasy_pts
            }
            
            # Remove None values
            data = {k: v for k, v in data.items() if v is not None}
            
            # Skip if no season_id
            if not data.get('season_id'):
                continue
            
            # Upsert the data
            result = supabase.table('player_season_totals_regular_season').upsert(
                data, 
                on_conflict='player_id,season_id'
            ).execute()
            
            if len(result.data) > 0:
                imported_count += 1
        
        return imported_count
        
    except Exception as e:
        print(f"❌ Error importing regular season totals: {e}")
        return 0

def main():
    """Main function"""
    print("🚀 Starting NBA Career Stats Import using nba_api")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)
    
    try:
        # Import nba_api
        from nba_api.stats.endpoints import playercareerstats
        
        # Setup
        supabase = setup_supabase()
        
        # Get ALL players to process using pagination to bypass 1000-row cap
        players = get_all_players_paginated(supabase, page_size=1000)
        
        if not players:
            print("❌ No players found in database")
            return
        
        # Process players
        successful_updates = 0
        failed_updates = 0
        skipped_players = 0
        total_career_records = 0
        total_season_records = 0
        
        print(f"📝 Processing {len(players)} players...")
        
        for i, player in enumerate(players, 1):
            try:
                nba_player_id = player['nba_player_id']
                player_id = player['id']
                player_name = player['name']
                
                print(f"🏀 Fetching career stats for {player_name} (ID: {nba_player_id})...")
                
                # Fetch career stats using nba_api
                try:
                    career_stats = playercareerstats.PlayerCareerStats(player_id=nba_player_id)
                    career_data = career_stats.get_dict()
                except Exception as e:
                    print(f"⚠️  Error fetching career stats for {player_name}: {e}")
                    skipped_players += 1
                    continue
                
                if not career_data or not career_data.get('resultSets'):
                    print(f"⚠️  No career stats found for {player_name}")
                    skipped_players += 1
                    continue
                
                # Parse the result sets
                parsed_data = {}
                for result_set in career_data['resultSets']:
                    set_name = result_set['name']
                    headers = result_set['headers']
                    rows = result_set['rowSet']
                    
                    if rows and len(rows) > 0:
                        # Convert to list of dictionaries
                        set_data = []
                        for row in rows:
                            row_dict = {}
                            for j, header in enumerate(headers):
                                if j < len(row):
                                    row_dict[header] = row[j]
                            set_data.append(row_dict)
                        
                        parsed_data[set_name] = set_data
                
                # Import different types of career data
                career_imported = 0
                season_imported = 0
                
                # Import career totals
                if import_career_totals_regular_season(supabase, player_id, nba_player_id, parsed_data):
                    career_imported += 1
                
                # Import season totals
                season_imported += import_season_totals_regular_season(supabase, player_id, nba_player_id, parsed_data)
                
                if career_imported > 0 or season_imported > 0:
                    successful_updates += 1
                    total_career_records += career_imported
                    total_season_records += season_imported
                    print(f"✅ Updated {player_name} - {career_imported} career records, {season_imported} season records")
                else:
                    failed_updates += 1
                    print(f"❌ No data imported for {player_name}")
                
                # Progress indicator
                if i % 10 == 0:
                    print(f"📈 Progress: {i}/{len(players)} players processed")
                
                # Rate limiting - be respectful to NBA API
                time.sleep(2)  # 2 second delay between requests

                # Periodic cool-down every 500 players
                if i % 500 == 0:
                    print("⏸️  Cool-down pause (30s) to avoid rate limits...")
                    time.sleep(30)
                
            except Exception as e:
                print(f"❌ Error processing player {player.get('name', 'Unknown')}: {e}")
                failed_updates += 1
                continue
        
        # Summary
        print("\n" + "="*60)
        print("🎉 NBA Career Stats Import Complete!")
        print(f"📊 Summary:")
        print(f"   Total players processed: {len(players)}")
        print(f"   ✅ Successful updates: {successful_updates}")
        print(f"   ⚠️  Skipped (no data): {skipped_players}")
        print(f"   ❌ Failed updates: {failed_updates}")
        print(f"   📈 Success rate: {(successful_updates / len(players) * 100):.1f}%")
        print(f"   📊 Total career records: {total_career_records}")
        print(f"   📊 Total season records: {total_season_records}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60)
        
        # Verify some updates
        if successful_updates > 0:
            print("\n🔍 Verifying career stats...")
            result = supabase.table('player_career_totals_regular_season').select('player_id, gp, pts, reb, ast, fantasy_pts').limit(5).execute()
            for stats in result.data:
                player_result = supabase.table('players').select('name').eq('id', stats['player_id']).execute()
                player_name = player_result.data[0]['name'] if player_result.data else 'Unknown'
                print(f"   • {player_name}: {stats['gp']} games, {stats['pts']} pts, {stats['reb']} reb, {stats['ast']} ast, {stats['fantasy_pts']} fantasy pts")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
