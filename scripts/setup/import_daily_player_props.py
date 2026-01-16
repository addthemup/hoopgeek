#!/usr/bin/env python3
"""
Import Player Props from SportsGameOdds API
Designed to run daily (morning) to fetch props for today's games
Fetches props for all NBA games scheduled for today and stores them in Supabase
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Any
from supabase import create_client, Client
import requests
import pytz

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except:
    pass

# SportsGameOdds API configuration
SPORTS_ODDS_API_KEY = os.getenv("VITE_SPORTS_ODDS_API_KEY") or os.getenv("SPORTS_ODDS_API_KEY")
SPORTS_ODDS_BASE_URL = "https://api.sportsgameodds.com"

# Rate limiting: 10 requests per minute
class RateLimiter:
    def __init__(self, max_requests=10, window_seconds=60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = []
    
    def wait_if_needed(self):
        now = time.time()
        # Remove requests older than window
        self.requests = [req_time for req_time in self.requests if now - req_time < self.window_seconds]
        
        # If at limit, wait
        if len(self.requests) >= self.max_requests:
            oldest = self.requests[0]
            wait_time = self.window_seconds - (now - oldest) + 1
            if wait_time > 0:
                print(f"⏳ Rate limit reached, waiting {wait_time:.1f}s...")
                time.sleep(wait_time)
        
        self.requests.append(time.time())

rate_limiter = RateLimiter()

# Team name mapping (tricode to possible full names)
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
        print("❌ Missing Supabase credentials in environment variables")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(url, key)

def get_todays_nba_games(supabase: Client, target_date: str = None) -> List[Dict]:
    """Get NBA games scheduled for today (or specified date)"""
    try:
        if target_date:
            game_date = target_date
        else:
            today = datetime.now()
            game_date = today.strftime('%Y-%m-%d')
        
        print(f"📅 Fetching NBA games scheduled for {game_date}...")
        
        # Query for games on this date
        result = supabase.table('nba_games') \
            .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name') \
            .eq('season_year', 2025) \
            .eq('game_date', game_date) \
            .order('game_date', desc=False) \
            .execute()
        
        games = []
        for game in result.data:
            games.append({
                'game_id': game['game_id'],
                'game_date': game['game_date'],
                'home_team_tricode': game['home_team_tricode'],
                'away_team_tricode': game['away_team_tricode'],
                'home_team_name': game.get('home_team_name', ''),
                'away_team_name': game.get('away_team_name', ''),
            })
        
        print(f"✅ Found {len(games)} NBA games scheduled for {game_date}")
        return games
        
    except Exception as e:
        print(f"❌ Error fetching games: {e}")
        return []

def fetch_sports_odds_events() -> List[Dict]:
    """Fetch NBA events from SportsGameOdds API
    Returns all events with their UTC dates for matching
    """
    if not SPORTS_ODDS_API_KEY:
        print("❌ Missing SPORTS_ODDS_API_KEY in environment variables")
        return []
    
    rate_limiter.wait_if_needed()
    
    try:
        print(f"📊 Fetching NBA events from SportsGameOdds API...")
        
        # Make direct API call to SportsGameOdds
        # Based on SDK source code, the API uses 'x-api-key' header (lowercase)
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
        # Handle both direct array and paginated response
        if isinstance(data, list):
            events = data
        elif isinstance(data, dict):
            events = data.get('data', [])
        else:
            events = []
        
        # Add UTC date to each event for matching
        # API stores times in UTC - we'll use UTC date for matching
        processed_events = []
        for event in events:
            if event.get('status', {}).get('startsAt'):
                try:
                    # Parse UTC time
                    event_date_utc = datetime.fromisoformat(event['status']['startsAt'].replace('Z', '+00:00'))
                    # Store UTC date string for matching
                    event['_utc_date'] = event_date_utc.strftime('%Y-%m-%d')
                    processed_events.append(event)
                except Exception as e:
                    print(f"  ⚠️  Could not parse date for event {event.get('eventID', 'unknown')}: {e}")
                    continue
        
        print(f"✅ Found {len(processed_events)} events with valid dates")
        return processed_events
        
    except Exception as e:
        print(f"❌ Error fetching from SportsGameOdds API: {e}")
        return []

def match_game_to_event(game: Dict, events: List[Dict]) -> Optional[Dict]:
    """Match a database game to a SportsGameOdds event"""
    home_tricode = game['home_team_tricode']
    away_tricode = game['away_team_tricode']
    
    home_names = TEAM_NAME_MAP.get(home_tricode, [])
    away_names = TEAM_NAME_MAP.get(away_tricode, [])
    
    if not home_names or not away_names:
        return None
    
    for event in events:
        home_team = event.get('teams', {}).get('home', {}).get('name', '')
        away_team = event.get('teams', {}).get('away', {}).get('name', '')
        
        # Check if teams match
        home_matches = any(name.lower() in home_team.lower() or home_team.lower() in name.lower() 
                          for name in home_names)
        away_matches = any(name.lower() in away_team.lower() or away_team.lower() in name.lower() 
                          for name in away_names)
        
        if home_matches and away_matches:
            return event
    
    return None

def normalize_player_name(name: str) -> str:
    """Normalize player name for matching"""
    if not name:
        return ""
    # Remove extra whitespace, convert to lowercase
    normalized = ' '.join(name.split()).lower()
    # Remove common suffixes and prefixes
    normalized = normalized.replace('jr.', '').replace('jr', '').replace('sr.', '').replace('sr', '')
    normalized = normalized.replace('ii', '').replace('iii', '').replace('iv', '')
    # Remove special characters but keep spaces
    normalized = ''.join(c if c.isalnum() or c.isspace() else ' ' for c in normalized)
    # Clean up multiple spaces
    normalized = ' '.join(normalized.split())
    return normalized

def match_player_by_name(supabase: Client, player_name: str, team_tricode: str = None) -> Optional[Dict]:
    """
    Match a player name from API to database player
    Returns dict with 'id' and 'nba_player_id' if found, None otherwise
    """
    if not player_name:
        return None
    
    # First, check manual mapping table
    try:
        mapping_result = supabase.table('player_props_name_mapping') \
            .select('player_id, nba_player_id') \
            .ilike('api_player_name', player_name) \
            .limit(1) \
            .execute()
        
        if mapping_result.data:
            # Get full player info
            player_result = supabase.table('nba_players') \
                .select('id, nba_player_id, name') \
                .eq('id', mapping_result.data[0]['player_id']) \
                .single() \
                .execute()
            
            if player_result.data:
                return {
                    'id': player_result.data['id'],
                    'nba_player_id': player_result.data.get('nba_player_id'),
                    'name': player_result.data['name']
                }
    except Exception as e:
        # If mapping table doesn't exist or query fails, continue with other strategies
        pass
    
    # Try multiple matching strategies
    strategies = [
        # 1. Exact match (case-insensitive)
        lambda: supabase.table('nba_players')
            .select('id, nba_player_id, name')
            .ilike('name', player_name)
            .eq('is_active', True)
            .limit(1)
            .execute(),
        
        # 2. Normalized match (remove special chars, normalize)
        lambda: supabase.table('nba_players')
            .select('id, nba_player_id, name')
            .ilike('name', f'%{player_name.split()[0]}%')  # First name
            .ilike('name', f'%{player_name.split()[-1]}%')  # Last name
            .eq('is_active', True)
            .limit(10)
            .execute(),
    ]
    
    # If we have team context, add team filter
    if team_tricode:
        strategies.insert(1, lambda: supabase.table('nba_players')
            .select('id, nba_player_id, name')
            .ilike('name', player_name)
            .eq('team_abbreviation', team_tricode)
            .eq('is_active', True)
            .limit(1)
            .execute())
    
    # Try each strategy
    for strategy in strategies:
        try:
            result = strategy()
            if result.data and len(result.data) > 0:
                # If multiple results, try to find best match
                if len(result.data) == 1:
                    return {
                        'id': result.data[0]['id'],
                        'nba_player_id': result.data[0].get('nba_player_id'),
                        'name': result.data[0]['name']
                    }
                else:
                    # Multiple matches - try to find best one
                    normalized_api_name = normalize_player_name(player_name)
                    for player in result.data:
                        normalized_db_name = normalize_player_name(player['name'])
                        if normalized_api_name == normalized_db_name:
                            return {
                                'id': player['id'],
                                'nba_player_id': player.get('nba_player_id'),
                                'name': player['name']
                            }
                    # If no exact normalized match, return first one
                    return {
                        'id': result.data[0]['id'],
                        'nba_player_id': result.data[0].get('nba_player_id'),
                        'name': result.data[0]['name']
                    }
        except Exception as e:
            print(f"    ⚠️  Error in matching strategy: {e}")
            continue
    
    return None

def extract_player_props(event: Dict, home_team_tricode: str = None, away_team_tricode: str = None) -> List[Dict]:
    """Extract player props from an event
    
    API structure:
    - odd_data['statID']: bet type (e.g., 'points', 'assists')
    - odd_data['statEntityID']: player identifier (e.g., 'SCOTTIE_BARNES_1_NBA')
    - odd_data['periodID']: period (e.g., 'game', '1q', '1h')
    - odd_data['betTypeID']: bet type ID (e.g., 'ou' for over/under)
    - odd_data['sideID']: 'over' or 'under'
    - odd_data['bookOverUnder']: the line
    - odd_data['byBookmaker']: dictionary of bookmakers with odds
    """
    props = []
    
    if not event.get('odds') or not isinstance(event['odds'], dict):
        return props
    
    # Track props by player+bet_type+period to combine over/under pairs
    props_by_key = {}
    
    # Common player prop types (matching API format)
    player_prop_types = [
        'points', 'rebounds', 'assists', 'steals', 'blocks',
        'threePointersMade', 'turnovers', 'points+rebounds', 
        'points+assists', 'rebounds+assists', 'points+rebounds+assists',
        'blocks+steals', 'doubleDouble', 'tripleDouble', 'fantasyScore'
    ]
    
    for odd_id, odd_data in event['odds'].items():
        if not isinstance(odd_data, dict):
            continue
        
        # Get structured data from odd_data
        stat_id = odd_data.get('statID', '').lower()
        stat_entity_id = odd_data.get('statEntityID', '')
        period_id = odd_data.get('periodID', 'game')
        bet_type_id = odd_data.get('betTypeID', '')
        side_id = odd_data.get('sideID', '').lower()
        
        # Check if this is a player prop
        # Player props have statEntityID ending with _NBA and statID in our list
        if stat_id not in player_prop_types:
            continue
        
        if not stat_entity_id.endswith('_NBA'):
            continue
        
        # Only process over/under bets for now
        if bet_type_id != 'ou' or side_id not in ['over', 'under']:
            continue
        
        # Extract player name from statEntityID (format: PLAYER_NAME_1_NBA)
        player_name_api = stat_entity_id.replace('_1_NBA', '').replace('_', ' ').title()
        
        # Get line from bookOverUnder
        line = odd_data.get('bookOverUnder')
        if line is not None:
            try:
                line = float(line)
            except:
                line = None
        
        # Get price from bookOdds (American odds format like '-110')
        # We'll store the first available bookmaker's odds
        book_odds = odd_data.get('bookOdds')
        price = None
        if book_odds:
            # Convert American odds to decimal
            try:
                if book_odds.startswith('+'):
                    decimal = 1 + (int(book_odds[1:]) / 100)
                else:
                    decimal = 1 + (100 / abs(int(book_odds)))
                price = decimal
            except:
                pass
        
        # If no bookOdds, try byBookmaker
        if price is None and odd_data.get('byBookmaker'):
            for bookmaker, book_data in odd_data['byBookmaker'].items():
                if book_data.get('odds'):
                    try:
                        odds_str = book_data['odds']
                        if odds_str.startswith('+'):
                            decimal = 1 + (int(odds_str[1:]) / 100)
                        else:
                            decimal = 1 + (100 / abs(int(odds_str)))
                        price = decimal
                        break
                    except:
                        pass
        
        # Create unique key for this prop (player + bet_type + period + line)
        prop_key = f"{player_name_api}|{stat_id}|{period_id}|{line}"
        
        if prop_key not in props_by_key:
            props_by_key[prop_key] = {
                'player_name': player_name_api,
                'bet_type': stat_id,
                'period': period_id,
                'line': line,
                'over_price': None,
                'under_price': None,
                'over_odd_id': None,
                'under_odd_id': None,
                'raw_odd_data': {}
            }
        
        # Store price for over/under
        if side_id == 'over':
            props_by_key[prop_key]['over_price'] = price
            props_by_key[prop_key]['over_odd_id'] = odd_id
        elif side_id == 'under':
            props_by_key[prop_key]['under_price'] = price
            props_by_key[prop_key]['under_odd_id'] = odd_id
        
        # Store raw data (use over if available, otherwise under)
        if side_id == 'over' or not props_by_key[prop_key]['raw_odd_data']:
            props_by_key[prop_key]['raw_odd_data'] = odd_data
    
    # Convert to list format
    for prop_data in props_by_key.values():
        # Only include props that have a line
        if prop_data['line'] is not None:
            props.append({
                'player_name': prop_data['player_name'],
                'bet_type': prop_data['bet_type'],
                'period': prop_data['period'],
                'line': prop_data['line'],
                'over_price': prop_data['over_price'],
                'under_price': prop_data['under_price'],
                'over_odd_id': prop_data['over_odd_id'],
                'under_odd_id': prop_data['under_odd_id'],
                'raw_odd_data': prop_data['raw_odd_data']
            })
    
    return props

def utc_to_est_date(utc_date_input) -> str:
    """Convert UTC date string or datetime to EST/EDT date string (YYYY-MM-DD)"""
    try:
        # Handle datetime objects
        if isinstance(utc_date_input, datetime):
            utc_dt = utc_date_input
            # If datetime is naive, assume UTC
            if utc_dt.tzinfo is None:
                utc_dt = utc_dt.replace(tzinfo=pytz.UTC)
        else:
            # Parse UTC datetime string
            utc_date_str = str(utc_date_input)
            if 'T' in utc_date_str:
                # Full timestamp
                utc_dt = datetime.fromisoformat(utc_date_str.replace('Z', '+00:00'))
            else:
                # Date only - treat as UTC midnight
                utc_dt = datetime.fromisoformat(utc_date_str + 'T00:00:00+00:00')
        
        # Convert to EST/EDT
        est_tz = pytz.timezone('America/New_York')
        est_dt = utc_dt.astimezone(est_tz)
        
        # Return date string in YYYY-MM-DD format
        return est_dt.strftime('%Y-%m-%d')
    except Exception as e:
        print(f"⚠️  Error converting UTC to EST: {utc_date_input}, {e}")
        # Fallback: try to extract date part
        if isinstance(utc_date_input, datetime):
            return utc_date_input.strftime('%Y-%m-%d')
        utc_date_str = str(utc_date_input)
        if 'T' in utc_date_str:
            return utc_date_str.split('T')[0]
        return utc_date_str

def store_game_and_props(supabase: Client, event: Dict, game: Dict, props: List[Dict]) -> int:
    """Store game and props in database"""
    try:
        # Use UTC date from event if available, otherwise use game_date
        game_date_str = game.get('game_date')
        if not game_date_str:
            # Fallback: get UTC date from event
            game_date_str = event.get('_utc_date')
        
        # Convert UTC date to EST date string
        if isinstance(game_date_str, str) or isinstance(game_date_str, datetime):
            # Convert UTC to EST
            est_date_str = utc_to_est_date(game_date_str)
            game_date = datetime.fromisoformat(est_date_str).date()
        elif hasattr(game_date_str, 'date'):
            # If it's already a date object, use it directly (shouldn't happen, but handle it)
            game_date = game_date_str.date()
        else:
            # Last resort: use today in EST
            est_tz = pytz.timezone('America/New_York')
            game_date = datetime.now(est_tz).date()
        
        # Extract team names from event
        home_team_obj = event.get('teams', {}).get('home', {})
        away_team_obj = event.get('teams', {}).get('away', {})
        home_names = home_team_obj.get('names', {}) if isinstance(home_team_obj.get('names'), dict) else {}
        away_names = away_team_obj.get('names', {}) if isinstance(away_team_obj.get('names'), dict) else {}
        
        home_team_name = home_names.get('long') or home_team_obj.get('name', '')
        away_team_name = away_names.get('long') or away_team_obj.get('name', '')
        
        # Prioritize tricodes from game object (from nba_games table - most reliable)
        # Fall back to event data only if game doesn't have them
        home_tricode = game.get('home_team_tricode') or home_names.get('short') or None
        away_tricode = game.get('away_team_tricode') or away_names.get('short') or None
        
        # Upsert game - this will update existing records with same event_id
        # Include nba_game_id from the game object to link to nba_games (if column exists)
        game_data = {
            'event_id': event.get('eventID', ''),
            'game_date': str(game_date),
            'home_team': home_team_name,
            'away_team': away_team_name,
            'home_team_tricode': home_tricode,
            'away_team_tricode': away_tricode,
            'starts_at': event.get('status', {}).get('startsAt'),
            'league_id': 'NBA',
            'odds_available': True,
            'finalized': event.get('status', {}).get('finalized', False),
            'raw_event_data': event
        }
        
        # Add nba_game_id if available (will be added after migration)
        if game.get('game_id'):
            game_data['nba_game_id'] = game.get('game_id')
        
        # Use upsert with conflict on event_id,game_date to update existing records
        # This will update tricodes if they were previously null
        try:
            result = supabase.table('player_props_games').upsert(
                game_data,
                on_conflict='event_id,game_date'
            ).execute()
            
            if not result.data:
                print(f"⚠️  Failed to store game {event.get('eventID')} - no data returned")
                return 0
            
            # Extract the game record ID
            game_record = result.data[0] if isinstance(result.data, list) else result.data
            if isinstance(game_record, dict):
                game_id = game_record['id']
            elif isinstance(game_record, list) and len(game_record) > 0:
                game_id = game_record[0]['id']
            else:
                print(f"⚠️  Failed to extract game_id from result: {result.data}")
                return 0
                
            # Debug: Log successful creation/update
            print(f"    📝 Created/updated player_props_games (id: {game_id}, event: {event.get('eventID')})")
        except Exception as e:
            error_msg = str(e)
            # If error is about nba_game_id column not existing, retry without it
            if 'nba_game_id' in error_msg.lower():
                print(f"    ⚠️  nba_game_id column not found, storing without it (run migration to add column)")
                game_data.pop('nba_game_id', None)
                try:
                    result = supabase.table('player_props_games').upsert(
                        game_data,
                        on_conflict='event_id,game_date'
                    ).execute()
                    
                    if not result.data:
                        print(f"⚠️  Failed to store game {event.get('eventID')} - no data returned")
                        return 0
                    
                    game_record = result.data[0] if isinstance(result.data, list) else result.data
                    if isinstance(game_record, dict):
                        game_id = game_record['id']
                    elif isinstance(game_record, list) and len(game_record) > 0:
                        game_id = game_record[0]['id']
                    else:
                        print(f"⚠️  Failed to extract game_id from result: {result.data}")
                        return 0
                    print(f"    📝 Created/updated player_props_games (id: {game_id}, event: {event.get('eventID')})")
                except Exception as e2:
                    print(f"❌ Error upserting player_props_games (retry): {e2}")
                    return 0
            else:
                print(f"❌ Error upserting player_props_games: {e}")
                print(f"    Game data keys: {list(game_data.keys())}")
                return 0
        
        # Store props with improved player matching
        stored_count = 0
        matched_count = 0
        unmatched_names = set()
        
        for prop in props:
            # Get bookmaker info from raw_odd_data
            raw_data = prop.get('raw_odd_data', {})
            bookmaker = raw_data.get('bookmakerID') or raw_data.get('bookmaker') or 'Unknown'
            bookmaker_id = raw_data.get('bookmakerID') or 'default'
            
            # Store over and under as separate records (or just over if under not available)
            for direction in ['over', 'under']:
                price = prop.get(f'{direction}_price')
                odd_id = prop.get(f'{direction}_odd_id')
                
                # Skip if no price for this direction
                if price is None or odd_id is None:
                    continue
                
                prop_data = {
                    'game_id': game_id,
                    'event_id': event.get('eventID', ''),
                    'player_name': prop['player_name'],
                    'bet_type': prop['bet_type'],
                    'bet_type_id': odd_id,  # Use the odd_id as bet_type_id
                    'line': prop['line'],
                    'price': str(price) if price is not None else None,
                    'american_odds': None,  # Can calculate if needed
                    'bookmaker': bookmaker,
                    'bookmaker_id': bookmaker_id,
                    'raw_odd_data': raw_data,
                    'game_date': str(game_date)
                }
                
                # Try to link to nba_players table using improved matching
                if prop['player_name']:
                    # Try matching with team context (more accurate)
                    player_match = match_player_by_name(
                        supabase, 
                        prop['player_name'],
                        game.get('home_team_tricode')  # Try home team first
                    )
                    
                    # If no match with home team, try away team
                    if not player_match:
                        player_match = match_player_by_name(
                            supabase,
                            prop['player_name'],
                            game.get('away_team_tricode')
                        )
                    
                    # If still no match, try without team context
                    if not player_match:
                        player_match = match_player_by_name(supabase, prop['player_name'])
                    
                    if player_match:
                        prop_data['player_id'] = player_match['id']
                        prop_data['nba_player_id'] = player_match.get('nba_player_id')
                        if matched_count == 0:  # Log first match
                            print(f"    ✅ Matched: {prop['player_name']} → {player_match['name']}")
                        matched_count += 1
                    else:
                        unmatched_names.add(prop['player_name'])
                        if len(unmatched_names) <= 5:  # Log first few unmatched
                            print(f"    ⚠️  Could not match: {prop['player_name']}")
                
                try:
                    supabase.table('player_props').upsert(
                        prop_data,
                        on_conflict='event_id,player_name,bet_type_id,bookmaker_id,game_date'
                    ).execute()
                    stored_count += 1
                except Exception as e:
                    print(f"⚠️  Error storing prop: {e}")
        
        print(f"✅ Stored {stored_count} props ({matched_count} matched to players) for game {event.get('eventID')}")
        if unmatched_names:
            print(f"    ⚠️  {len(unmatched_names)} unique player names could not be matched")
        
        return stored_count
        
    except Exception as e:
        print(f"❌ Error storing game and props: {e}")
        import traceback
        traceback.print_exc()
        return 0

def process_daily_props(target_date: str = None):
    """Main function to process daily player props
    Fetches all events from API and matches them to games based on UTC date
    """
    print(f"\n{'=' * 80}")
    print(f"🎲 DAILY PLAYER PROPS IMPORT")
    print(f"{'=' * 80}\n")
    
    supabase = setup_supabase()
    
    # Fetch all events from SportsGameOdds API (no date filtering)
    all_events = fetch_sports_odds_events()
    
    if not all_events:
        print("⚠️  No events found from SportsGameOdds API")
        return
    
    # Group events by UTC date
    events_by_date: Dict[str, List[Dict]] = {}
    for event in all_events:
        utc_date = event.get('_utc_date')
        if utc_date:
            if utc_date not in events_by_date:
                events_by_date[utc_date] = []
            events_by_date[utc_date].append(event)
    
    print(f"📅 Events found for {len(events_by_date)} date(s): {', '.join(sorted(events_by_date.keys()))}\n")
    
    # If target_date specified, only process that date
    if target_date:
        if target_date in events_by_date:
            events_by_date = {target_date: events_by_date[target_date]}
            print(f"🎯 Processing only date: {target_date}\n")
        else:
            print(f"⚠️  No events found for target date: {target_date}")
            return
    
    total_props = 0
    total_matched_games = 0
    total_games_processed = 0
    
    # Process each date
    for utc_date, events in events_by_date.items():
        print(f"\n{'─' * 80}")
        print(f"📅 Processing date: {utc_date} (UTC) - {len(events)} event(s)")
        print(f"{'─' * 80}\n")
        
        # Get games for this UTC date from database
        # Note: nba_games.game_date might be in different timezone, so we'll match by teams
        # We'll get games from a date range that could include this UTC date
        # (UTC date could be Nov 12 or Nov 13 depending on timezone)
        games_for_date = []
        
        # Try the UTC date and adjacent dates (UTC date might be different from local date)
        dates_to_check = [utc_date]
        try:
            date_obj = datetime.fromisoformat(f"{utc_date}T00:00:00")
            # Also check day before and after (in case of timezone differences)
            dates_to_check.append((date_obj - timedelta(days=1)).strftime('%Y-%m-%d'))
            dates_to_check.append((date_obj + timedelta(days=1)).strftime('%Y-%m-%d'))
        except:
            pass
        
        for check_date in dates_to_check:
            games = get_todays_nba_games(supabase, check_date)
            games_for_date.extend(games)
        
        # Remove duplicates
        seen_game_ids = set()
        unique_games = []
        for game in games_for_date:
            if game['game_id'] not in seen_game_ids:
                seen_game_ids.add(game['game_id'])
                unique_games.append(game)
        
        games_for_date = unique_games
        
        if not games_for_date:
            print(f"  ℹ️  No games found in database for date range around {utc_date}")
            continue
        
        print(f"  📊 Found {len(games_for_date)} game(s) in database to match")
        
        # Match games to events and store props
        matched_games = 0
        
        for game in games_for_date:
            event = match_game_to_event(game, events)
            if event:
                matched_games += 1
                total_matched_games += 1
                
                # Use UTC date from event for storing
                event_utc_date = event.get('_utc_date', utc_date)
                
                # Extract props with team context for better matching
                props = extract_player_props(
                    event, 
                    home_team_tricode=game['home_team_tricode'],
                    away_team_tricode=game['away_team_tricode']
                )
                if props:
                    # Create a game dict with UTC date for storage
                    game_with_utc_date = {**game, 'game_date': event_utc_date}
                    stored = store_game_and_props(supabase, event, game_with_utc_date, props)
                    total_props += stored
                    print(f"  ✅ Matched: {game['away_team_tricode']} @ {game['home_team_tricode']} - {stored} props stored")
                else:
                    print(f"  ⚠️  Matched but no props found: {game['away_team_tricode']} @ {game['home_team_tricode']}")
            else:
                print(f"  ⚠️  Could not match: {game['away_team_tricode']} @ {game['home_team_tricode']}")
        
        total_games_processed += len(games_for_date)
        print(f"  📊 Matched {matched_games}/{len(games_for_date)} games for {utc_date}")
    
    print(f"\n{'=' * 80}")
    print(f"✅ IMPORT COMPLETE")
    print(f"   Dates processed: {len(events_by_date)}")
    print(f"   Games processed: {total_games_processed}")
    print(f"   Games matched: {total_matched_games}")
    print(f"   Total props stored: {total_props}")
    print(f"{'=' * 80}\n")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Import daily player props from SportsGameOdds API')
    parser.add_argument('--date', type=str, help='Target date (YYYY-MM-DD), defaults to today')
    args = parser.parse_args()
    
    process_daily_props(args.date)

