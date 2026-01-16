#!/usr/bin/env python3
"""
Import NBA games for 2025-11-10 from SportsGameOdds API
"""

import os
import sys
from datetime import datetime
from typing import List, Dict, Optional
from supabase import create_client, Client
import requests

# Try to load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except:
    pass

# API configuration
SPORTS_ODDS_API_KEY = os.getenv("VITE_SPORTS_ODDS_API_KEY") or os.getenv("SPORTS_ODDS_API_KEY") or "79ae5f47830d3d87e70896e36b5eefc3"
SPORTS_ODDS_BASE_URL = "https://api.sportsgameodds.com"

# Team name mapping
TEAM_NAME_MAP = {
    'ATL': ['Atlanta Hawks', 'Hawks'],
    'BOS': ['Boston Celtics', 'Celtics'],
    'BKN': ['Brooklyn Nets', 'Nets'],
    'CHA': ['Charlotte Hornets', 'Hornets'],
    'CHI': ['Chicago Bulls', 'Bulls'],
    'CLE': ['Cleveland Cavaliers', 'Cavaliers'],
    'DAL': ['Dallas Mavericks', 'Mavericks'],
    'DEN': ['Denver Nuggets', 'Nuggets'],
    'DET': ['Detroit Pistons', 'Pistons'],
    'GSW': ['Golden State Warriors', 'Warriors'],
    'HOU': ['Houston Rockets', 'Rockets'],
    'IND': ['Indiana Pacers', 'Pacers'],
    'LAC': ['LA Clippers', 'Clippers', 'Los Angeles Clippers'],
    'LAL': ['Los Angeles Lakers', 'Lakers'],
    'MEM': ['Memphis Grizzlies', 'Grizzlies'],
    'MIA': ['Miami Heat', 'Heat'],
    'MIL': ['Milwaukee Bucks', 'Bucks'],
    'MIN': ['Minnesota Timberwolves', 'Timberwolves'],
    'NOP': ['New Orleans Pelicans', 'Pelicans'],
    'NYK': ['New York Knicks', 'Knicks'],
    'OKC': ['Oklahoma City Thunder', 'Thunder'],
    'ORL': ['Orlando Magic', 'Magic'],
    'PHI': ['Philadelphia 76ers', '76ers'],
    'PHX': ['Phoenix Suns', 'Suns'],
    'POR': ['Portland Trail Blazers', 'Trail Blazers'],
    'SAC': ['Sacramento Kings', 'Kings'],
    'SAS': ['San Antonio Spurs', 'Spurs'],
    'TOR': ['Toronto Raptors', 'Raptors'],
    'UTA': ['Utah Jazz', 'Jazz'],
    'WAS': ['Washington Wizards', 'Wizards'],
}

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(url, key)

def fetch_sports_odds_events(target_date: str) -> List[Dict]:
    """Fetch NBA events from SportsGameOdds API"""
    if not SPORTS_ODDS_API_KEY:
        print("❌ Missing SPORTS_ODDS_API_KEY")
        return []
    
    try:
        print(f"📊 Fetching NBA events from SportsGameOdds API for {target_date}...")
        
        url = "https://api.sportsgameodds.com/v2/events"
        headers = {
            "x-api-key": SPORTS_ODDS_API_KEY,
            "Content-Type": "application/json"
        }
        params = {
            "leagueID": "NBA",
            "oddsAvailable": "true",
            "finalized": "false",
            "limit": "50"
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=20)
        response.raise_for_status()
        
        data = response.json()
        if isinstance(data, list):
            events = data
        elif isinstance(data, dict):
            events = data.get('data', [])
        else:
            events = []
        
        # Filter for target date
        target_events = []
        all_dates = set()
        for event in events:
            if event.get('status', {}).get('startsAt'):
                event_date = datetime.fromisoformat(event['status']['startsAt'].replace('Z', '+00:00'))
                event_date_str = event_date.strftime('%Y-%m-%d')
                all_dates.add(event_date_str)
                if event_date_str == target_date:
                    target_events.append(event)
        
        print(f"📅 Available dates in API: {sorted(all_dates)[:10]}")
        print(f"✅ Found {len(target_events)} events for {target_date}")
        
        if len(target_events) == 0 and len(events) > 0:
            print(f"\n⚠️  No events for {target_date}, but found {len(events)} total events")
            print(f"   First event date: {sorted(all_dates)[0] if all_dates else 'N/A'}")
        
        return target_events
        
    except Exception as e:
        print(f"❌ Error fetching from SportsGameOdds API: {e}")
        return []

def get_team_tricode_from_name(team_name: str) -> Optional[str]:
    """Get team tricode from team name"""
    team_name_lower = team_name.lower()
    for tricode, names in TEAM_NAME_MAP.items():
        if any(name.lower() in team_name_lower or team_name_lower in name.lower() for name in names):
            return tricode
    return None

def import_games(supabase: Client, events: List[Dict], target_date: str):
    """Import games into player_props_games table"""
    imported_count = 0
    
    for event in events:
        try:
            event_id = event.get('eventID', '')
            if not event_id:
                print(f"⚠️  Skipping event with no eventID")
                continue
            
            # Get team names from the new structure
            home_team_obj = event.get('teams', {}).get('home', {})
            away_team_obj = event.get('teams', {}).get('away', {})
            
            home_team = home_team_obj.get('names', {}).get('long') or home_team_obj.get('name', '')
            away_team = away_team_obj.get('names', {}).get('long') or away_team_obj.get('name', '')
            
            if not home_team or not away_team:
                print(f"⚠️  Skipping event {event_id} - missing team names")
                continue
            
            # Get tricodes
            home_tricode = home_team_obj.get('names', {}).get('short') or get_team_tricode_from_name(home_team)
            away_tricode = away_team_obj.get('names', {}).get('short') or get_team_tricode_from_name(away_team)
            
            starts_at = event.get('status', {}).get('startsAt')
            
            game_data = {
                'event_id': event_id,
                'game_date': target_date,
                'home_team': home_team,
                'away_team': away_team,
                'home_team_tricode': home_tricode,
                'away_team_tricode': away_tricode,
                'starts_at': starts_at,
                'league_id': 'NBA',
                'odds_available': True,
                'finalized': event.get('status', {}).get('finalized', False),
                'raw_event_data': event
            }
            
            print(f"📝 Importing: {away_team} @ {home_team} (Event ID: {event_id})")
            
            # Upsert game
            result = supabase.table('player_props_games').upsert(
                game_data,
                on_conflict='event_id,game_date'
            ).execute()
            
            if result.data:
                imported_count += 1
                print(f"   ✅ Imported successfully")
            else:
                print(f"   ⚠️  No data returned from upsert")
                
        except Exception as e:
            print(f"   ❌ Error importing game: {e}")
            import traceback
            traceback.print_exc()
    
    return imported_count

def main():
    # Try 2025-11-10 first, but also check 2025-11-11 (timezone difference)
    target_date = '2025-11-10'
    alt_date = '2025-11-11'
    
    print(f"🚀 Starting import for {target_date}\n")
    
    # Setup
    supabase = setup_supabase()
    
    # Fetch events - try both dates in case of timezone issues
    events = fetch_sports_odds_events(target_date)
    
    if not events:
        print(f"\n⚠️  No events found for {target_date}, trying {alt_date}...")
        events = fetch_sports_odds_events(alt_date)
        if events:
            target_date = alt_date
            print(f"✅ Using {target_date} instead")
    
    if not events:
        print(f"❌ No events found for {target_date} or {alt_date}")
        return
    
    # Import games
    print(f"\n📥 Importing {len(events)} games into database...\n")
    imported_count = import_games(supabase, events, target_date)
    
    print(f"\n✅ Import complete!")
    print(f"   Imported {imported_count} of {len(events)} games")
    
    # Verify
    print(f"\n🔍 Verifying import...")
    result = supabase.table('player_props_games') \
        .select('id, event_id, home_team, away_team, game_date') \
        .eq('game_date', target_date) \
        .execute()
    
    if result.data:
        print(f"   ✅ Found {len(result.data)} games in database for {target_date}")
        for game in result.data:
            print(f"      - {game.get('away_team')} @ {game.get('home_team')} (Event: {game.get('event_id')})")
    else:
        print(f"   ⚠️  No games found in database for {target_date}")

if __name__ == '__main__':
    main()

