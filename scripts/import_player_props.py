#!/usr/bin/env python3
"""
Import Player Props from SportsGameOdds API using Python SDK
Maps player IDs to nba_players and stores props in Supabase
"""

import os
import sys
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple
from supabase import create_client, Client
from sports_odds_api import SportsGameOdds

# Try to load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except:
    pass

# Configuration
API_KEY = os.getenv("VITE_SPORTS_ODDS_API_KEY") or os.getenv("SPORTS_ODDS_API_KEY") or "79ae5f47830d3d87e70896e36b5eefc3"
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Team tricode mapping
TEAM_TRICODE_MAP = {
    'ATL': 'Atlanta Hawks',
    'BOS': 'Boston Celtics',
    'BKN': 'Brooklyn Nets',
    'CHA': 'Charlotte Hornets',
    'CHI': 'Chicago Bulls',
    'CLE': 'Cleveland Cavaliers',
    'DAL': 'Dallas Mavericks',
    'DEN': 'Denver Nuggets',
    'DET': 'Detroit Pistons',
    'GSW': 'Golden State Warriors',
    'HOU': 'Houston Rockets',
    'IND': 'Indiana Pacers',
    'LAC': 'LA Clippers',
    'LAL': 'Los Angeles Lakers',
    'MEM': 'Memphis Grizzlies',
    'MIA': 'Miami Heat',
    'MIL': 'Milwaukee Bucks',
    'MIN': 'Minnesota Timberwolves',
    'NOP': 'New Orleans Pelicans',
    'NYK': 'New York Knicks',
    'OKC': 'Oklahoma City Thunder',
    'ORL': 'Orlando Magic',
    'PHI': 'Philadelphia 76ers',
    'PHX': 'Phoenix Suns',
    'POR': 'Portland Trail Blazers',
    'SAC': 'Sacramento Kings',
    'SAS': 'San Antonio Spurs',
    'TOR': 'Toronto Raptors',
    'UTA': 'Utah Jazz',
    'WAS': 'Washington Wizards',
}

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_player_name(api_name: str) -> str:
    """Convert API player ID format to normalized name"""
    # API format: ALEXANDRE_SARR_1_NBA -> Alexandre Sarr
    # Remove trailing _1_NBA or similar patterns
    name = api_name.replace('_1_NBA', '').replace('_NBA', '')
    # Replace underscores with spaces
    name = name.replace('_', ' ')
    # Title case
    return name.title()

def find_player_in_db(supabase: Client, api_player_id: str, team_tricode: Optional[str] = None) -> Optional[Dict]:
    """Find player in nba_players table by name matching"""
    normalized_name = normalize_player_name(api_player_id)
    
    # Try exact match first
    query = supabase.table('nba_players').select('id, nba_player_id, name, team_abbreviation')
    
    # Build query with name matching
    # Supabase doesn't support .ilike() directly, need to use filter
    result = query.ilike('name', normalized_name).limit(10).execute()
    
    if result.data and len(result.data) > 0:
        # Filter by exact match first
        exact_matches = [p for p in result.data if p['name'].lower() == normalized_name.lower()]
        if exact_matches:
            # If team_tricode provided, prefer team match
            if team_tricode:
                team_matches = [p for p in exact_matches if p.get('team_abbreviation') == team_tricode]
                if team_matches:
                    return team_matches[0]
            return exact_matches[0]
        
        # If team_tricode provided, prefer team match
        if team_tricode:
            team_matches = [p for p in result.data if p.get('team_abbreviation') == team_tricode]
            if team_matches:
                return team_matches[0]
        
        # Return first match
        return result.data[0]
    
    # Try partial match with first and last name
    parts = normalized_name.split()
    if len(parts) >= 2:
        first_name = parts[0]
        last_name = ' '.join(parts[1:])
        
        # Try matching with first name
        query = supabase.table('nba_players').select('id, nba_player_id, name, team_abbreviation')
        result = query.ilike('name', f'%{first_name}%').limit(20).execute()
        
        if result.data and len(result.data) > 0:
            # Filter results that also contain last name
            filtered = [p for p in result.data if last_name.lower() in p['name'].lower()]
            
            if filtered:
                # Prefer exact first+last match
                for player in filtered:
                    player_parts = player['name'].split()
                    if len(player_parts) >= 2:
                        if player_parts[0].lower() == first_name.lower() and ' '.join(player_parts[1:]).lower() == last_name.lower():
                            if team_tricode and player.get('team_abbreviation') == team_tricode:
                                return player
                            return player
                
                # Return first match
                if team_tricode:
                    team_matches = [p for p in filtered if p.get('team_abbreviation') == team_tricode]
                    if team_matches:
                        return team_matches[0]
                return filtered[0]
    
    return None

def extract_player_props_from_event(event: Any) -> List[Dict]:
    """Extract player props from an event"""
    props = []
    
    if not hasattr(event, 'odds') or not event.odds:
        return props
    
    odds_dict = event.odds if isinstance(event.odds, dict) else {}
    
    for odd_id, odd_data in odds_dict.items():
        # Handle Pydantic models
        if hasattr(odd_data, 'to_dict'):
            odd_dict = odd_data.to_dict()
        elif isinstance(odd_data, dict):
            odd_dict = odd_data
        else:
            continue
        
        stat_entity = odd_dict.get('statEntityID', '')
        bet_type_id = odd_dict.get('betTypeID', '')
        stat_id = odd_dict.get('statID', '')
        
        # Check if this is a player prop (statEntityID is not 'all', 'home', or 'away')
        stat_entity_lower = str(stat_entity).lower() if stat_entity else ''
        if stat_entity_lower in ['all', 'home', 'away', '']:
            continue
        
        # Only include over/under props with lines
        if bet_type_id != 'ou':
            continue
        
        line = odd_dict.get('bookOverUnder') or odd_dict.get('bookSpread') or odd_dict.get('line')
        if line is None:
            continue
        
        # Get side (over/under)
        side_id = odd_dict.get('sideID', '')
        if side_id not in ['over', 'under']:
            continue
        
        # Get odds
        book_odds = odd_dict.get('bookOdds')
        fair_odds = odd_dict.get('fairOdds')
        
        # Get bookmaker info (use first available bookmaker)
        by_bookmaker = odd_dict.get('byBookmaker', {})
        bookmaker_name = 'consensus'
        bookmaker_id = 'consensus'
        
        if by_bookmaker and isinstance(by_bookmaker, dict):
            # Get first available bookmaker
            for bm_id, bm_data in by_bookmaker.items():
                if isinstance(bm_data, dict) and bm_data.get('available', False):
                    bookmaker_id = bm_id
                    bookmaker_name = bm_id.title()  # Simple formatting
                    book_odds = bm_data.get('odds', book_odds)
                    break
        
        props.append({
            'oddID': odd_id,
            'playerID': stat_entity,  # API player ID like ALEXANDRE_SARR_1_NBA
            'statID': stat_id,  # e.g., 'points', 'rebounds', 'assists'
            'betTypeID': bet_type_id,  # 'ou' for over/under
            'sideID': side_id,  # 'over' or 'under'
            'line': float(line) if line else None,
            'bookOdds': book_odds,
            'fairOdds': fair_odds,
            'bookmakerID': bookmaker_id,
            'bookmakerName': bookmaker_name,
            'rawData': odd_dict,
        })
    
    return props

def import_game_and_props(supabase: Client, event: Any, target_date: str) -> Tuple[int, int]:
    """Import a game and its player props"""
    # Get event ID
    event_id = event.eventID if hasattr(event, 'eventID') else ''
    if not event_id:
        return 0, 0
    
    # Get team names
    home_team = 'Unknown'
    away_team = 'Unknown'
    home_tricode = None
    away_tricode = None
    
    if hasattr(event, 'teams') and event.teams:
        if hasattr(event.teams, 'home') and event.teams.home:
            if hasattr(event.teams.home, 'names') and event.teams.home.names:
                home_team = event.teams.home.names.long or event.teams.home.names.medium or 'Unknown'
            home_tricode = getattr(event.teams.home, 'tricode', None)
        
        if hasattr(event.teams, 'away') and event.teams.away:
            if hasattr(event.teams.away, 'names') and event.teams.away.names:
                away_team = event.teams.away.names.long or event.teams.away.names.medium or 'Unknown'
            away_tricode = getattr(event.teams.away, 'tricode', None)
    
    # Get start time
    starts_at = None
    if hasattr(event, 'status') and event.status:
        starts_at = getattr(event.status, 'starts_at', None)
    
    # Get finalized status
    finalized = False
    if hasattr(event, 'status') and event.status:
        finalized = getattr(event.status, 'finalized', False)
    
    # Convert event to dict for raw_event_data
    raw_event_dict = {}
    if hasattr(event, 'to_dict'):
        try:
            raw_event_dict = event.to_dict()
            # Convert any datetime objects to strings
            def convert_datetime(obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                elif isinstance(obj, dict):
                    return {k: convert_datetime(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_datetime(item) for item in obj]
                return obj
            raw_event_dict = convert_datetime(raw_event_dict)
        except:
            raw_event_dict = {}
    
    # Import/update game
    game_data = {
        'event_id': event_id,
        'game_date': target_date,
        'home_team': home_team,
        'away_team': away_team,
        'home_team_tricode': home_tricode,
        'away_team_tricode': away_tricode,
        'starts_at': starts_at.isoformat() if starts_at else None,
        'league_id': 'NBA',
        'odds_available': True,
        'finalized': finalized,
        'raw_event_data': raw_event_dict
    }
    
    result = supabase.table('player_props_games').upsert(
        game_data,
        on_conflict='event_id,game_date'
    ).execute()
    
    if not result.data:
        print(f"  ⚠️  Failed to import game {event_id}")
        return 0, 0
    
    game_id = result.data[0]['id']
    print(f"  ✅ Imported game: {away_team} @ {home_team}")
    
    # Extract player props
    props = extract_player_props_from_event(event)
    print(f"  📊 Found {len(props)} player props")
    
    if not props:
        return 1, 0
    
    # Import props
    props_imported = 0
    props_to_insert = []
    
    for prop in props:
        # Find player in database
        player = find_player_in_db(supabase, prop['playerID'], home_tricode or away_tricode)
        
        player_id = None
        nba_player_id = None
        player_name = normalize_player_name(prop['playerID'])
        
        if player:
            player_id = player['id']
            nba_player_id = player.get('nba_player_id')
            player_name = player['name']  # Use database name
        
        # Convert raw data to JSON-serializable format
        def convert_to_json(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif isinstance(obj, dict):
                return {k: convert_to_json(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_json(item) for item in obj]
            elif hasattr(obj, '__dict__'):
                return convert_to_json(obj.__dict__)
            return obj
        
        raw_odd_data = convert_to_json(prop['rawData'])
        
        # Prepare prop data
        prop_data = {
            'game_id': game_id,
            'event_id': event_id,
            'player_name': player_name,
            'player_id': player_id,
            'nba_player_id': nba_player_id,
            'bet_type': prop['statID'],  # e.g., 'points', 'rebounds'
            'bet_type_id': f"{prop['statID']}-{prop['sideID']}",  # e.g., 'points-over'
            'line': prop['line'],
            'price': prop['bookOdds'] or prop['fairOdds'],
            'american_odds': prop['bookOdds'],  # Already in American format
            'bookmaker': prop['bookmakerName'],
            'bookmaker_id': prop['bookmakerID'],
            'raw_odd_data': raw_odd_data,
            'game_date': target_date,
        }
        
        props_to_insert.append(prop_data)
    
    # Deduplicate props before inserting
    # Use a set to track unique props based on the unique constraint
    seen_props = set()
    unique_props = []
    
    for prop in props_to_insert:
        # Create a unique key based on the constraint
        unique_key = (
            prop['event_id'],
            prop['player_name'],
            prop['bet_type_id'],
            prop['bookmaker_id'],
            prop['game_date']
        )
        
        if unique_key not in seen_props:
            seen_props.add(unique_key)
            unique_props.append(prop)
    
    print(f"  🔄 Deduplicated: {len(props_to_insert)} -> {len(unique_props)} props")
    
    # Batch insert props (upsert to avoid duplicates)
    if unique_props:
        # Split into batches of 100
        batch_size = 100
        for i in range(0, len(unique_props), batch_size):
            batch = unique_props[i:i + batch_size]
            result = supabase.table('player_props').upsert(
                batch,
                on_conflict='event_id,player_name,bet_type_id,bookmaker_id,game_date'
            ).execute()
            
            if result.data:
                props_imported += len(result.data)
    
    print(f"  ✅ Imported {props_imported} player props")
    
    return 1, props_imported

def main():
    """Main import function"""
    today = datetime.now()
    target_date = today.strftime('%Y-%m-%d')
    tomorrow_date = (today + timedelta(days=1)).strftime('%Y-%m-%d')
    
    print(f"🚀 Starting player props import for {target_date}\n")
    
    # Setup clients
    supabase = setup_supabase()
    client = SportsGameOdds(api_key_param=API_KEY)
    
    try:
        # Fetch events
        print("📊 Fetching NBA events from SportsGameOdds API...")
        page = client.events.get(
            league_id='NBA',
            odds_available=True,
            finalized=False,
            limit=50
        )
        
        print(f"✅ Found {len(page.data)} total events\n")
        
        # Collect all available dates
        available_dates = set()
        events_by_date = {}
        
        for event in page.data:
            if hasattr(event, 'status') and event.status:
                starts_at = getattr(event.status, 'starts_at', None)
                if starts_at:
                    try:
                        event_date = datetime.fromisoformat(str(starts_at).replace('Z', '+00:00'))
                        event_date_str = event_date.strftime('%Y-%m-%d')
                        available_dates.add(event_date_str)
                        
                        if event_date_str not in events_by_date:
                            events_by_date[event_date_str] = []
                        events_by_date[event_date_str].append(event)
                    except:
                        pass
        
        print(f"📅 Available dates: {sorted(available_dates)[:5]}")
        
        # Try today first, then tomorrow
        target_events = events_by_date.get(target_date, [])
        if not target_events:
            print(f"⚠️  No events for {target_date}, trying {tomorrow_date}...")
            target_events = events_by_date.get(tomorrow_date, [])
            if target_events:
                target_date = tomorrow_date
        
        print(f"📅 Found {len(target_events)} events for {target_date}\n")
        
        if not target_events:
            print("❌ No events found for today or tomorrow")
            if available_dates:
                print(f"   Available dates: {sorted(available_dates)}")
            return
        
        # Import each game
        total_games = 0
        total_props = 0
        
        for i, event in enumerate(target_events, 1):
            event_id = event.eventID if hasattr(event, 'eventID') else f'event_{i}'
            print(f"\n[{i}/{len(target_events)}] Processing event: {event_id}")
            
            games, props = import_game_and_props(supabase, event, target_date)
            total_games += games
            total_props += props
        
        print(f"\n{'='*70}")
        print(f"✅ Import complete!")
        print(f"   Games imported: {total_games}")
        print(f"   Player props imported: {total_props}")
        print(f"{'='*70}\n")
        
    except Exception as e:
        print(f"❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
