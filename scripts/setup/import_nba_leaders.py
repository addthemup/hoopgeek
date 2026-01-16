#!/usr/bin/env python3
"""
One-time import script for NBA Leaders
Fetches current season leaders from NBA API and stores in Supabase
"""

import os
import sys
import requests
from datetime import datetime
from supabase import create_client, Client

# Supabase credentials
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL', 'https://qbznyaimnrpibmahisue.supabase.co')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# NBA API headers
NBA_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com'
}

def get_current_season():
    """Get current NBA season string (e.g., '2024-25')"""
    current_date = datetime.now()
    year = current_date.year
    month = current_date.month
    
    # NBA season starts in October
    if month >= 10:
        return f"{year}-{str(year + 1)[-2:]}"
    else:
        return f"{year - 1}-{str(year)[-2:]}"

def fetch_leaders_for_category(category: str, season: str):
    """Fetch leaders for a specific category"""
    # Try 2024-25 season first (current season might not have data yet)
    url = f"https://stats.nba.com/stats/leagueleaders?LeagueID=00&PerMode=Totals&Season={season}&SeasonType=Regular%20Season&StatCategory={category}"
    
    try:
        response = requests.get(url, headers=NBA_HEADERS, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        print(f"   🔍 Response status: {response.status_code}")
        
        # Check for error messages
        if 'error' in data or 'Message' in data:
            print(f"   ⚠️  API Error: {data.get('error', data.get('Message', 'Unknown error'))}")
            return []
        
        # NBA API uses 'resultSet' (singular) not 'resultSets' (plural)
        if 'resultSet' not in data:
            print(f"   ⚠️  No resultSet in response")
            print(f"   📋 Response keys: {list(data.keys())}")
            return []
        
        result_set = data['resultSet']
        if not result_set or 'rowSet' not in result_set:
            print(f"   ⚠️  No rowSet in resultSet")
            return []
        
        standings = result_set['rowSet']
        headers = result_set['headers']
        
        print(f"   📊 Rows returned: {len(standings)}")
        print(f"   📋 Headers: {headers[:5]}...")
        
        if len(standings) == 0:
            print(f"   ⚠️  No standings data for {category}")
            return []
        
        # Map headers to indices
        header_map = {header: index for index, header in enumerate(headers)}
        
        # Get top 10 for each category
        leaders = []
        for index, row in enumerate(standings[:10]):
            try:
                player_id = row[header_map.get('PLAYER_ID')]
                team_id = row[header_map.get('TEAM_ID')]
                
                # Try different possible header names for the category value
                value_key = None
                for key in [category, f'{category}', f'AVG_{category}', f'TOT_{category}']:
                    if key in header_map:
                        value_key = key
                        break
                
                if not value_key:
                    # Try to find any column that might contain the stat
                    print(f"   ⚠️  Could not find value column for {category}, available: {list(header_map.keys())}")
                    continue
                
                value = float(row[header_map[value_key]] or 0)
                games_played = int(row[header_map.get('GP', header_map.get('G', 0))] or 0)
                
                leaders.append({
                    'nba_player_id': player_id,
                    'team_id': team_id,
                    'category': category,
                    'value': value,
                    'rank': index + 1,
                    'games_played': games_played,
                })
            except Exception as e:
                print(f"   ⚠️  Error processing row {index}: {e}")
                continue
        
        return leaders
        
    except Exception as e:
        print(f"❌ Error fetching {category} leaders: {e}")
        import traceback
        traceback.print_exc()
        return []

def import_leaders():
    """Main import function"""
    print("=" * 60)
    print("NBA LEADERS IMPORT")
    print("=" * 60)
    
    try:
        # Try current season first, fallback to 2024-25 if no data
        season = get_current_season()
        print(f"📅 Season: {season}")
        
        # If current season is 2025-26, also try 2024-25
        test_season = '2024-25' if season == '2025-26' else season
        
        # Categories to fetch
        categories = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'FG_PCT', 'FG3_PCT', 'FT_PCT']
        
        all_leaders = []
        
        for category in categories:
            print(f"\n📊 Fetching {category} leaders...")
            leaders = fetch_leaders_for_category(category, season)
            if not leaders and test_season != season:
                print(f"   🔄 Trying {test_season} season...")
                leaders = fetch_leaders_for_category(category, test_season)
            all_leaders.extend(leaders)
            print(f"   ✅ Retrieved {len(leaders)} {category} leaders")
        
        if not all_leaders:
            print("❌ No leaders data retrieved")
            sys.exit(1)
        
        print(f"\n📊 Total leader records: {len(all_leaders)}")
        
        # Fetch players to get UUID mapping
        print("\n🔍 Fetching player UUIDs...")
        nba_player_ids = list(set([l['nba_player_id'] for l in all_leaders]))
        
        # Fetch in batches
        players_map = {}
        batch_size = 50
        for i in range(0, len(nba_player_ids), batch_size):
            batch = nba_player_ids[i:i + batch_size]
            result = supabase.table('nba_players').select('id, nba_player_id').in_('nba_player_id', batch).execute()
            
            if result.data:
                for player in result.data:
                    players_map[player['nba_player_id']] = player['id']
        
        print(f"   ✅ Mapped {len(players_map)} players")
        
        # Map nba_player_id to player_id (UUID)
        leaders_with_ids = []
        missing_players = []
        
        for leader in all_leaders:
            player_id = players_map.get(leader['nba_player_id'])
            if not player_id:
                missing_players.append(leader['nba_player_id'])
                continue
            
            leaders_with_ids.append({
                'player_id': player_id,
                'nba_player_id': leader['nba_player_id'],
                'team_id': leader['team_id'],
                'category': leader['category'],
                'value': leader['value'],
                'rank': leader['rank'],
                'games_played': leader['games_played'],
                'season': season,
                'updated_at': datetime.now().isoformat(),
            })
        
        if missing_players:
            print(f"⚠️  Warning: {len(missing_players)} players not found in database")
        
        # Delete existing leaders for this season
        print(f"\n🗑️  Deleting existing leaders for season {season}...")
        delete_result = supabase.table('nba_leaders').delete().eq('season', season).execute()
        print(f"✅ Deleted existing leaders")
        
        # Insert new leaders
        print(f"\n💾 Inserting {len(leaders_with_ids)} leader records...")
        
        # Insert in batches of 20
        batch_size = 20
        for i in range(0, len(leaders_with_ids), batch_size):
            batch = leaders_with_ids[i:i + batch_size]
            result = supabase.table('nba_leaders').insert(batch).execute()
            print(f"   ✅ Inserted batch {i // batch_size + 1} ({len(batch)} records)")
        
        print("\n" + "=" * 60)
        print("✅ LEADERS IMPORT COMPLETE!")
        print("=" * 60)
        print(f"📅 Season: {season}")
        print(f"📊 Total records: {len(leaders_with_ids)}")
        print(f"📈 Categories: {', '.join(categories)}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    import_leaders()

