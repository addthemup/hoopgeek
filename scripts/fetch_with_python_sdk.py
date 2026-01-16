#!/usr/bin/env python3
"""
Fetch NBA games and analyze odds structure using the Python SDK
"""

import os
import json
from datetime import datetime
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

API_KEY = os.getenv("VITE_SPORTS_ODDS_API_KEY") or os.getenv("SPORTS_ODDS_API_KEY") or "79ae5f47830d3d87e70896e36b5eefc3"

def analyze_odds_for_player_props(event):
    """Analyze odds structure to find player props"""
    if not hasattr(event, 'odds') or not event.odds:
        return {
            'total_odds': 0,
            'game_level': 0,
            'team_level': 0,
            'player_props': [],
            'sample_player_props': []
        }
    
    odds_dict = event.odds if isinstance(event.odds, dict) else {}
    total_odds = len(odds_dict)
    
    game_level = []
    team_level = []
    player_props = []
    
    # Player prop indicators
    player_stat_types = ['points', 'rebounds', 'rebound', 'assists', 'assist', 
                        'steals', 'steal', 'blocks', 'block', 'turnovers', 'turnover',
                        'threes', 'three', '3pt', '3pm']
    
    for odd_id, odd_data in odds_dict.items():
        # Handle both Pydantic models and dicts
        if hasattr(odd_data, 'to_dict'):
            # It's a Pydantic model
            odd_dict = odd_data.to_dict()
            stat_entity = odd_dict.get('statEntityID', '')
            bet_type = odd_dict.get('betTypeID', '')
            market_name = odd_dict.get('marketName', '')
            stat_id = odd_dict.get('statID', '')
        elif isinstance(odd_data, dict):
            stat_entity = odd_data.get('statEntityID', '')
            bet_type = odd_data.get('betTypeID', '')
            market_name = odd_data.get('marketName', '')
            stat_id = odd_data.get('statID', '')
        else:
            # Try attribute access
            stat_entity = getattr(odd_data, 'statEntityID', None) or ''
            bet_type = getattr(odd_data, 'betTypeID', None) or ''
            market_name = getattr(odd_data, 'marketName', None) or ''
            stat_id = getattr(odd_data, 'statID', None) or ''
        
        # Convert to lowercase for comparison
        stat_entity_lower = str(stat_entity).lower() if stat_entity else ''
        bet_type_lower = str(bet_type).lower() if bet_type else ''
        market_name_lower = str(market_name).lower() if market_name else ''
        stat_id_lower = str(stat_id).lower() if stat_id else ''
        odd_id_lower = str(odd_id).lower()
        
        # Check if this is a player prop
        # According to docs: Player props have statEntityID = ANY_PLAYER_ID (not 'all', 'home', or 'away')
        is_player_prop = False
        
        # Method 1: Check statEntityID - if it's not 'all', 'home', or 'away', it's a player prop
        if stat_entity_lower not in ['all', 'home', 'away', '']:
            # This is a player ID - definitely a player prop!
            is_player_prop = True
        
        # Method 2: Check marketName for player name patterns
        if market_name and not is_player_prop:
            # Look for patterns like "LeBron James Points Over/Under"
            words = market_name.split()
            if len(words) >= 2:
                # Check if first part looks like a name (has capital letters)
                first_part = ' '.join(words[:2])
                if first_part and first_part[0].isupper():
                    # Check if it contains a stat type
                    if any(stat in market_name_lower for stat in player_stat_types):
                        # Check if it's not a team name
                        team_indicators = ['points', 'total', 'over/under', 'spread', 'moneyline']
                        if not any(indicator in market_name_lower for indicator in team_indicators):
                            is_player_prop = True
        
        # Method 3: Check oddID pattern
        if not is_player_prop:
            # Player props might have patterns like: "points-{player}-game-ou-over"
            # or "rebounds-{player}-game-ou-over"
            if any(stat in odd_id_lower for stat in player_stat_types):
                # If it doesn't contain 'all-', 'home-', or 'away-', might be a player
                if 'all-' not in odd_id_lower and 'home-' not in odd_id_lower and 'away-' not in odd_id_lower:
                    # Check if it has a line value
                    has_line = False
                    if hasattr(odd_data, 'to_dict'):
                        odd_dict = odd_data.to_dict()
                        has_line = bool(odd_dict.get('bookOverUnder') or odd_dict.get('bookSpread') or odd_dict.get('line'))
                    elif isinstance(odd_data, dict):
                        has_line = bool(odd_data.get('bookOverUnder') or odd_data.get('bookSpread') or odd_data.get('line'))
                    else:
                        has_line = bool(
                            getattr(odd_data, 'bookOverUnder', None) or 
                            getattr(odd_data, 'bookSpread', None) or 
                            getattr(odd_data, 'line', None)
                        )
                    if has_line:
                        is_player_prop = True
        
        # Categorize
        if is_player_prop:
            # Get line value
            line = None
            if hasattr(odd_data, 'to_dict'):
                odd_dict = odd_data.to_dict()
                line = odd_dict.get('bookOverUnder') or odd_dict.get('bookSpread') or odd_dict.get('line')
            elif isinstance(odd_data, dict):
                line = odd_data.get('bookOverUnder') or odd_data.get('bookSpread') or odd_data.get('line')
            else:
                line = (
                    getattr(odd_data, 'bookOverUnder', None) or 
                    getattr(odd_data, 'bookSpread', None) or 
                    getattr(odd_data, 'line', None)
                )
            
            player_props.append({
                'oddID': odd_id,
                'marketName': market_name,
                'betTypeID': bet_type,
                'statEntityID': stat_entity,
                'statID': stat_id,
                'line': line,
                'raw': odd_data
            })
        elif stat_entity_lower == 'all':
            game_level.append(odd_id)
        elif stat_entity_lower in ['home', 'away']:
            team_level.append({
                'oddID': odd_id,
                'marketName': market_name,
                'statEntityID': stat_entity
            })
    
    return {
        'total_odds': total_odds,
        'game_level': len(game_level),
        'team_level': len(team_level),
        'player_props': len(player_props),
        'sample_player_props': player_props[:10],
        'all_player_props': player_props
    }

def main():
    target_date = '2025-11-11'  # Using 2025-11-11 since that's what the API has
    
    print(f"🚀 Fetching NBA games for {target_date} using Python SDK\n")
    
    # Initialize client
    client = SportsGameOdds(api_key_param=API_KEY)
    
    try:
        # Fetch events
        print("📊 Fetching events...")
        page = client.events.get(
            league_id='NBA',
            odds_available=True,
            finalized=False,
            limit=50
        )
        
        print(f"✅ Found {len(page.data)} total events\n")
        
        # Debug: Check first event structure
        if page.data:
            first_event = page.data[0]
            print("🔍 First event structure:")
            print(f"   Event ID: {getattr(first_event, 'eventID', 'N/A')}")
            print(f"   Has status: {hasattr(first_event, 'status')}")
            if hasattr(first_event, 'status'):
                status = first_event.status
                print(f"   Status type: {type(status)}")
                print(f"   Status attributes: {dir(status) if hasattr(status, '__dict__') else 'N/A'}")
                if hasattr(status, 'startsAt'):
                    print(f"   startsAt: {status.startsAt}")
                elif hasattr(status, 'starts_at'):
                    print(f"   starts_at: {status.starts_at}")
                else:
                    # Try to convert to dict
                    try:
                        status_dict = status.to_dict() if hasattr(status, 'to_dict') else dict(status) if hasattr(status, '__dict__') else {}
                        print(f"   Status dict keys: {list(status_dict.keys())[:10]}")
                    except:
                        print(f"   Status: {status}")
            print()
        
        # Filter for target date and show all available dates
        target_events = []
        all_dates = set()
        
        for event in page.data:
            # Try multiple ways to get the date
            starts_at = None
            if hasattr(event, 'status') and event.status:
                status = event.status
                starts_at = getattr(status, 'startsAt', None) or getattr(status, 'starts_at', None)
                if not starts_at and hasattr(status, 'to_dict'):
                    status_dict = status.to_dict()
                    starts_at = status_dict.get('startsAt') or status_dict.get('starts_at')
            
            if starts_at:
                try:
                    event_date = datetime.fromisoformat(str(starts_at).replace('Z', '+00:00'))
                    event_date_str = event_date.strftime('%Y-%m-%d')
                    all_dates.add(event_date_str)
                    if event_date_str == target_date:
                        target_events.append(event)
                except:
                    pass
        
        print(f"📅 Available dates in API: {sorted(all_dates)[:10]}")
        print(f"📅 Found {len(target_events)} events for {target_date}\n")
        
        # If no events for target date, try the first available date
        if not target_events and all_dates:
            first_date = sorted(all_dates)[0]
            print(f"⚠️  No events for {target_date}, trying {first_date} instead...\n")
            target_date = first_date
            for event in page.data:
                starts_at = None
                if hasattr(event, 'status') and event.status:
                    status = event.status
                    starts_at = getattr(status, 'startsAt', None) or getattr(status, 'starts_at', None)
                    if not starts_at and hasattr(status, 'to_dict'):
                        status_dict = status.to_dict()
                        starts_at = status_dict.get('startsAt') or status_dict.get('starts_at')
                
                if starts_at:
                    try:
                        event_date = datetime.fromisoformat(str(starts_at).replace('Z', '+00:00'))
                        event_date_str = event_date.strftime('%Y-%m-%d')
                        if event_date_str == target_date:
                            target_events.append(event)
                    except:
                        pass
        
        # If still no events, just analyze all events
        if not target_events:
            print(f"⚠️  No events found for {target_date}, analyzing all events instead...\n")
            target_events = page.data[:5]  # Analyze first 5 events
        
        # Analyze each event
        for i, event in enumerate(target_events, 1):
            print("=" * 70)
            
            # Get team names
            home_team = 'Unknown'
            away_team = 'Unknown'
            if hasattr(event, 'teams') and event.teams:
                if hasattr(event.teams, 'home') and event.teams.home:
                    if hasattr(event.teams.home, 'names') and event.teams.home.names:
                        home_team = event.teams.home.names.long or event.teams.home.names.medium or 'Unknown'
                    else:
                        home_team = getattr(event.teams.home, 'name', 'Unknown')
                
                if hasattr(event, 'teams') and event.teams and hasattr(event.teams, 'away') and event.teams.away:
                    if hasattr(event.teams.away, 'names') and event.teams.away.names:
                        away_team = event.teams.away.names.long or event.teams.away.names.medium or 'Unknown'
                    else:
                        away_team = getattr(event.teams.away, 'name', 'Unknown')
            
            print(f"\nGame {i}: {away_team} @ {home_team}")
            print(f"Event ID: {event.eventID if hasattr(event, 'eventID') else 'N/A'}")
            
            # Debug: Show sample odds structure
            if hasattr(event, 'odds') and event.odds:
                odds_dict = event.odds if isinstance(event.odds, dict) else {}
                if odds_dict:
                    print(f"\n🔍 Sample odds structure (first 5):")
                    sample_keys = list(odds_dict.keys())[:5]
                    for key in sample_keys:
                        odd_data = odds_dict[key]
                        # Try to get attributes
                        # Handle Pydantic models
                        if hasattr(odd_data, 'to_dict'):
                            odd_dict = odd_data.to_dict()
                            stat_entity = odd_dict.get('statEntityID')
                            bet_type = odd_dict.get('betTypeID')
                            market_name = odd_dict.get('marketName')
                        elif isinstance(odd_data, dict):
                            stat_entity = odd_data.get('statEntityID')
                            bet_type = odd_data.get('betTypeID')
                            market_name = odd_data.get('marketName')
                        else:
                            stat_entity = getattr(odd_data, 'statEntityID', None)
                            bet_type = getattr(odd_data, 'betTypeID', None)
                            market_name = getattr(odd_data, 'marketName', None)
                        
                        print(f"   OddID: {key[:60]}...")
                        print(f"      statEntityID: {stat_entity}")
                        print(f"      betTypeID: {bet_type}")
                        print(f"      marketName: {market_name}")
                        
                        # Try to_dict if it's a Pydantic model
                        if hasattr(odd_data, 'to_dict'):
                            odd_dict = odd_data.to_dict()
                            print(f"      (Has to_dict, keys: {list(odd_dict.keys())[:5]})")
                    print()
            
            # Analyze odds
            analysis = analyze_odds_for_player_props(event)
            
            print(f"\n📊 Odds Analysis:")
            print(f"   Total odds: {analysis['total_odds']}")
            print(f"   Game-level bets: {analysis['game_level']}")
            print(f"   Team-level bets: {analysis['team_level']}")
            print(f"   Player props: {analysis['player_props']}")
            
            if analysis['player_props'] > 0:
                print(f"\n   ✅ FOUND {analysis['player_props']} PLAYER PROPS!")
                
                # Filter for over/under props with lines (the ones we actually need)
                ou_props = [p for p in analysis['all_player_props'] if p['betTypeID'] == 'ou' and p['line'] is not None]
                print(f"   Over/Under props with lines: {len(ou_props)}")
                
                if ou_props:
                    print(f"\n   Sample Over/Under props (the ones we need):")
                    for prop in ou_props[:10]:
                        player_id = prop['statEntityID']
                        stat = prop['statID']
                        line = prop['line']
                        print(f"      - {stat.upper()} Over/Under")
                        print(f"        Player ID: {player_id}, Line: {line}")
                        print(f"        OddID: {prop['oddID'][:60]}...")
                else:
                    print(f"\n   ⚠️  No Over/Under props with lines found")
                    print(f"   Sample of all player props:")
                    for prop in analysis['sample_player_props'][:5]:
                        print(f"      - {prop['marketName']}")
                        print(f"        Stat: {prop['statID']}, Type: {prop['betTypeID']}, Line: {prop['line']}")
                        print(f"        Entity: {prop['statEntityID']}")
            else:
                print(f"\n   ❌ No player props found in this event")
                print(f"   Only game-level and team-level betting lines available")
            
            print()
        
        print("=" * 70)
        print(f"\n✅ Analysis complete!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()

