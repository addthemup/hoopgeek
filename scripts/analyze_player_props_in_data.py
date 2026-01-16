#!/usr/bin/env python3
"""
Analyze the raw_event_data to see if it contains player props
"""

import json
import sys

# Sample data from the user
sample_data = {
    "odds": {
        "points-all-1q-eo-odd": {"betTypeID": "eo", "statEntityID": "all"},
        "points-away-game-ou-over": {
            "betTypeID": "ou",
            "statEntityID": "away",
            "bookOverUnder": "116.5",
            "marketName": "Milwaukee Bucks Points Over/Under"
        }
    }
}

def analyze_odds_structure(raw_event_data_str):
    """Analyze the odds structure to find player props"""
    try:
        if isinstance(raw_event_data_str, str):
            event_data = json.loads(raw_event_data_str)
        else:
            event_data = raw_event_data_str
        
        odds = event_data.get('odds', {})
        
        print(f"📊 Total odds entries: {len(odds)}\n")
        
        # Categorize odds
        game_level = []
        team_level = []
        player_level = []
        other = []
        
        # Patterns that indicate player props
        player_indicators = [
            # Look for player names in oddID or marketName
            # Common patterns: "points-{player}-", "rebounds-{player}-", etc.
        ]
        
        for odd_id, odd_data in odds.items():
            if not isinstance(odd_data, dict):
                continue
            
            bet_type = odd_data.get('betTypeID', '').lower()
            stat_entity = odd_data.get('statEntityID', '').lower()
            market_name = odd_data.get('marketName', '').lower()
            stat_id = odd_data.get('statID', '').lower()
            
            # Check if this is a player prop
            # Player props typically have:
            # 1. statEntityID that's not "all", "home", or "away"
            # 2. A player name in the marketName or oddID
            # 3. A line value (bookOverUnder, bookSpread, etc.)
            
            is_player_prop = False
            
            # Check if statEntityID suggests a player (not all/home/away)
            if stat_entity not in ['all', 'home', 'away']:
                # Could be a player ID or name
                is_player_prop = True
            
            # Check marketName for player names (common pattern: "Player Name - Stat Type")
            if market_name:
                # Look for patterns like "LeBron James Points" or "Stephen Curry Rebounds"
                words = market_name.split()
                if len(words) >= 2:
                    # Check if first two words look like a name (capitalized)
                    first_two = ' '.join(words[:2])
                    if first_two[0].isupper() and any(c.isupper() for c in first_two[1:]):
                        # Check if it's followed by a stat type
                        stat_types = ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'threes']
                        if any(stat in market_name for stat in stat_types):
                            is_player_prop = True
            
            # Check oddID pattern for player names
            # Pattern might be: "points-{player-name}-game-ou-over"
            odd_id_lower = odd_id.lower()
            if any(stat in odd_id_lower for stat in ['points', 'rebounds', 'assists', 'steals', 'blocks']):
                # If it's not "all", "home", or "away", might be a player
                if 'all-' not in odd_id_lower and 'home-' not in odd_id_lower and 'away-' not in odd_id_lower:
                    # Check if it has a line value
                    if odd_data.get('bookOverUnder') or odd_data.get('bookSpread') or odd_data.get('line'):
                        is_player_prop = True
            
            # Categorize
            if is_player_prop:
                player_level.append({
                    'oddID': odd_id,
                    'marketName': odd_data.get('marketName', ''),
                    'betTypeID': bet_type,
                    'statEntityID': stat_entity,
                    'line': odd_data.get('bookOverUnder') or odd_data.get('bookSpread') or odd_data.get('line'),
                    'statID': stat_id
                })
            elif stat_entity == 'all':
                game_level.append(odd_id)
            elif stat_entity in ['home', 'away']:
                team_level.append({
                    'oddID': odd_id,
                    'statEntityID': stat_entity,
                    'marketName': odd_data.get('marketName', '')
                })
            else:
                other.append(odd_id)
        
        # Print results
        print(f"🎮 Game-level bets: {len(game_level)}")
        print(f"   Examples: {game_level[:3]}")
        print(f"\n🏀 Team-level bets: {len(team_level)}")
        if team_level:
            print(f"   Examples:")
            for t in team_level[:3]:
                print(f"     - {t['marketName']} ({t['statEntityID']})")
        
        print(f"\n👤 Player-level props: {len(player_level)}")
        if player_level:
            print(f"   ✅ FOUND PLAYER PROPS!")
            print(f"   Examples:")
            for p in player_level[:10]:
                print(f"     - {p['marketName']} | Line: {p['line']} | Stat: {p['statID']}")
        else:
            print(f"   ❌ NO PLAYER PROPS FOUND")
            print(f"   This data only contains game-level and team-level betting lines")
        
        print(f"\n❓ Other/Unknown: {len(other)}")
        if other:
            print(f"   Examples: {other[:5]}")
        
        return {
            'game_level': len(game_level),
            'team_level': len(team_level),
            'player_level': len(player_level),
            'player_props': player_level
        }
        
    except Exception as e:
        print(f"❌ Error analyzing data: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    # You can paste the raw_event_data JSON here
    print("Analyzing odds structure for player props...\n")
    print("=" * 60)
    
    # For now, just show the analysis function
    print("\nTo analyze your data, call:")
    print("  analyze_odds_structure(raw_event_data_json_string)")
    print("\nThe function will categorize odds into:")
    print("  - Game-level bets (over/under, spreads for the game)")
    print("  - Team-level bets (team totals, team spreads)")
    print("  - Player-level props (individual player stats)")
    print("\n" + "=" * 60)

