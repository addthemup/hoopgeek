#!/usr/bin/env python3
"""
One-time import script for NBA Standings
Fetches current standings from NBA API and stores in Supabase
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

# Team ID to abbreviation mapping
TEAM_ID_TO_ABBR = {
    1610612737: 'ATL', 1610612738: 'BOS', 1610612751: 'BKN', 1610612766: 'CHA',
    1610612741: 'CHI', 1610612739: 'CLE', 1610612742: 'DAL', 1610612743: 'DEN',
    1610612765: 'DET', 1610612744: 'GSW', 1610612745: 'HOU', 1610612754: 'IND',
    1610612746: 'LAC', 1610612747: 'LAL', 1610612763: 'MEM', 1610612748: 'MIA',
    1610612749: 'MIL', 1610612750: 'MIN', 1610612740: 'NOP', 1610612752: 'NYK',
    1610612760: 'OKC', 1610612753: 'ORL', 1610612755: 'PHI', 1610612756: 'PHX',
    1610612757: 'POR', 1610612758: 'SAC', 1610612759: 'SAS', 1610612761: 'TOR',
    1610612762: 'UTA', 1610612764: 'WAS'
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

def fetch_standings():
    """Fetch standings from NBA API"""
    season = get_current_season()
    url = f"https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season={season}&SeasonType=Regular%20Season"
    
    print(f"🏀 Fetching standings for season: {season}")
    print(f"📡 URL: {url}")
    
    try:
        response = requests.get(url, headers=NBA_HEADERS, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if not data.get('resultSets') or len(data['resultSets']) == 0:
            raise Exception("No standings data in response")
        
        standings = data['resultSets'][0]['rowSet']
        headers = data['resultSets'][0]['headers']
        
        # Map headers to indices
        header_map = {header: index for index, header in enumerate(headers)}
        
        print(f"✅ Retrieved {len(standings)} teams from NBA API")
        
        return standings, header_map, season
        
    except Exception as e:
        print(f"❌ Error fetching standings: {e}")
        raise

def transform_standings(standings, header_map, season):
    """Transform NBA API response to our format"""
    east_standings = []
    west_standings = []
    
    # Debug: print available headers
    print(f"📋 Available headers: {list(header_map.keys())[:10]}...")  # Print first 10
    
    for row in standings:
        team_id = row[header_map.get('TeamID', header_map.get('TEAM_ID', 0))]
        team_abbr = TEAM_ID_TO_ABBR.get(team_id, 'UNK')
        team_name = row[header_map.get('TeamName', header_map.get('TEAM_NAME', ''))] or ''
        conference = row[header_map.get('Conference', header_map.get('CONFERENCE', ''))] or ''
        wins = row[header_map.get('WINS', header_map.get('W', 0))] or 0
        losses = row[header_map.get('LOSSES', header_map.get('L', 0))] or 0
        win_percentage = float(row[header_map.get('WinPCT', header_map.get('W_PCT', 0))] or 0)
        games_behind = float(row[header_map.get('ConferenceGamesBack', header_map.get('CONF_GB', 0))] or 0)
        conference_rank = row[header_map.get('ConferenceRank', header_map.get('CONF_RANK', header_map.get('CONFERENCE_RANK', 0)))] or 0
        division = row[header_map.get('Division', header_map.get('DIVISION', None))] or None
        division_rank = row[header_map.get('DivisionRank', header_map.get('DIV_RANK', None))] if header_map.get('DivisionRank') or header_map.get('DIV_RANK') else None
        
        # Parse home/away records
        home_key = header_map.get('HOME') or header_map.get('HOME_RECORD')
        home_record = row[home_key] if home_key else '0-0'
        if isinstance(home_record, str) and '-' in home_record:
            home_wins = int(home_record.split('-')[0])
            home_losses = int(home_record.split('-')[1])
        else:
            home_wins = 0
            home_losses = 0
        
        away_key = header_map.get('ROAD') or header_map.get('ROAD_RECORD')
        away_record = row[away_key] if away_key else '0-0'
        if isinstance(away_record, str) and '-' in away_record:
            away_wins = int(away_record.split('-')[0])
            away_losses = int(away_record.split('-')[1])
        else:
            away_wins = 0
            away_losses = 0
        
        # Parse last 10 games
        last10_key = header_map.get('L10') or header_map.get('L10_RECORD')
        last10 = row[last10_key] if last10_key else '0-0'
        if isinstance(last10, str) and '-' in last10:
            last10_wins = int(last10.split('-')[0])
            last10_losses = int(last10.split('-')[1])
        else:
            last10_wins = 0
            last10_losses = 0
        
        streak_key = header_map.get('STRK') or header_map.get('STREAK')
        streak = row[streak_key] if streak_key else None
        
        team_data = {
            'team_id': team_id,
            'team_abbreviation': team_abbr,
            'team_name': team_name,
            'conference': conference,
            'wins': wins,
            'losses': losses,
            'win_percentage': round(win_percentage, 3),
            'games_behind': round(games_behind, 1),
            'conference_rank': conference_rank,
            'division': division,
            'division_rank': division_rank,
            'home_wins': home_wins,
            'home_losses': home_losses,
            'away_wins': away_wins,
            'away_losses': away_losses,
            'last_10_wins': last10_wins,
            'last_10_losses': last10_losses,
            'streak': streak,
            'season': season,
            'updated_at': datetime.now().isoformat(),
        }
        
        if conference == 'East':
            east_standings.append(team_data)
        elif conference == 'West':
            west_standings.append(team_data)
    
    # Sort by conference rank
    east_standings.sort(key=lambda x: x['conference_rank'])
    west_standings.sort(key=lambda x: x['conference_rank'])
    
    return east_standings + west_standings

def import_standings():
    """Main import function"""
    print("=" * 60)
    print("NBA STANDINGS IMPORT")
    print("=" * 60)
    
    try:
        # Fetch standings
        standings, header_map, season = fetch_standings()
        
        # Transform data
        print("\n📊 Transforming standings data...")
        transformed_standings = transform_standings(standings, header_map, season)
        
        print(f"✅ Transformed {len(transformed_standings)} teams")
        print(f"   - East: {len([t for t in transformed_standings if t['conference'] == 'East'])}")
        print(f"   - West: {len([t for t in transformed_standings if t['conference'] == 'West'])}")
        
        # Delete existing standings for this season
        print(f"\n🗑️  Deleting existing standings for season {season}...")
        delete_result = supabase.table('nba_standings').delete().eq('season', season).execute()
        print(f"✅ Deleted existing standings")
        
        # Insert new standings
        print(f"\n💾 Inserting {len(transformed_standings)} team standings...")
        
        # Insert in batches of 15 (to avoid potential issues)
        batch_size = 15
        for i in range(0, len(transformed_standings), batch_size):
            batch = transformed_standings[i:i + batch_size]
            result = supabase.table('nba_standings').insert(batch).execute()
            print(f"   ✅ Inserted batch {i // batch_size + 1} ({len(batch)} teams)")
        
        print("\n" + "=" * 60)
        print("✅ STANDINGS IMPORT COMPLETE!")
        print("=" * 60)
        print(f"📅 Season: {season}")
        print(f"📊 Total teams: {len(transformed_standings)}")
        print(f"   - Eastern Conference: {len([t for t in transformed_standings if t['conference'] == 'East'])}")
        print(f"   - Western Conference: {len([t for t in transformed_standings if t['conference'] == 'West'])}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    import_standings()

