#!/usr/bin/env python3
"""
Import NBA Game Odds and Spread Data
Fetches odds data from NBA API live endpoints and updates nba_games table
Designed to run daily to keep odds current for upcoming and live games
"""

import os
import sys
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from supabase import create_client, Client

# Try to load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except:
    pass

# Import NBA API
try:
    from nba_api.live.nba.endpoints import Odds
    from nba_api.stats.static import teams
except ImportError:
    print("❌ nba_api library not installed. Please install with: pip install nba_api")
    sys.exit(1)

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(url, key)

def get_today_games(supabase: Client, target_date: str = None) -> List[Dict]:
    """Get all games for today (or specified date)"""
    try:
        if target_date:
            game_date = target_date
        else:
            # Get today's date in EST
            now = datetime.now()
            game_date = now.strftime('%Y-%m-%d')
        
        print(f"📅 Fetching games for {game_date}...")
        
        # Query for games on this date
        result = supabase.table('nba_games') \
            .select('game_id, home_team_tricode, away_team_tricode, home_team_id, away_team_id, game_date, game_status') \
            .gte('game_date', f'{game_date}T00:00:00') \
            .lte('game_date', f'{game_date}T23:59:59') \
            .order('game_date', desc=False) \
            .execute()
        
        games = []
        if result.data and len(result.data) > 0:
            print(f"✅ Found {len(result.data)} games in database for {game_date}")
            for game in result.data:
                games.append({
                    'game_id': game['game_id'],
                    'home_team_id': game.get('home_team_id'),
                    'away_team_id': game.get('away_team_id'),
                    'home_team_tricode': game.get('home_team_tricode'),
                    'away_team_tricode': game.get('away_team_tricode'),
                    'game_date': game.get('game_date'),
                    'game_status': game.get('game_status', 1),
                })
        else:
            print(f"⚠️  No games found in database for {game_date}")
        
        return games
        
    except Exception as e:
        print(f"❌ Error fetching games: {e}")
        return []

def fetch_nba_odds() -> Optional[Dict]:
    """Fetch odds data from NBA API"""
    try:
        print("📊 Fetching odds from NBA API...")
        
        # Fetch odds using NBA API
        odds = Odds()
        games_list = odds.get_games().get_dict()
        
        if not games_list:
            print("⚠️  No games found in NBA odds API")
            return None
        
        print(f"✅ Retrieved odds for {len(games_list)} games from NBA API")
        
        # Transform to a map by game_id
        odds_map = {}
        for game in games_list:
            game_id = game.get('gameId')
            if not game_id:
                continue
            
            # Extract spread market
            spread_market = next((m for m in game.get('markets', []) if m.get('name') == 'spread'), None)
            two_way_market = next((m for m in game.get('markets', []) if m.get('name') == '2way'), None)
            total_market = next((m for m in game.get('markets', []) if m.get('name') == 'total'), None)
            
            odds_data = {
                'gameId': str(game_id),
                'homeTeamId': game.get('homeTeamId'),
                'awayTeamId': game.get('awayTeamId'),
                'spread': None,
                'homeSpread': None,
                'awaySpread': None,
                'overUnder': None,
                'homeMoneyline': None,
                'awayMoneyline': None,
                'rawData': game,
            }
            
            # Extract spread data (API may return spread as string, e.g. "-3.5" or "−3.5")
            if spread_market and spread_market.get('books'):
                first_book = spread_market['books'][0]
                for outcome in first_book.get('outcomes', []):
                    raw_spread = outcome.get('spread')
                    if raw_spread is not None:
                        try:
                            spread_val = float(str(raw_spread).strip().replace('\u2212', '-'))
                        except (ValueError, TypeError):
                            break
                        if outcome.get('type') == 'home':
                            odds_data['homeSpread'] = spread_val
                            odds_data['awaySpread'] = -spread_val  # Opposite of home spread
                        elif outcome.get('type') == 'away':
                            odds_data['awaySpread'] = spread_val
                            odds_data['homeSpread'] = -spread_val  # Opposite of away spread
                        odds_data['spread'] = spread_val if outcome.get('type') == 'home' else -spread_val
                        break
            
            # Extract moneyline data
            if two_way_market and two_way_market.get('books'):
                first_book = two_way_market['books'][0]
                for outcome in first_book.get('outcomes', []):
                    odds = outcome.get('odds')
                    if odds is not None:
                        try:
                            odds_int = int(float(odds))
                            if outcome.get('type') == 'home':
                                odds_data['homeMoneyline'] = odds_int
                            elif outcome.get('type') == 'away':
                                odds_data['awayMoneyline'] = odds_int
                        except (ValueError, TypeError):
                            pass
            
            # Extract over/under data
            if total_market and total_market.get('books'):
                first_book = total_market['books'][0]
                for outcome in first_book.get('outcomes', []):
                    total = outcome.get('total')
                    if total is not None:
                        try:
                            odds_data['overUnder'] = float(total)
                            break  # Both over and under have same total
                        except (ValueError, TypeError):
                            pass
            
            odds_map[str(game_id)] = odds_data
        
        return odds_map
        
    except Exception as e:
        print(f"❌ Error fetching NBA odds: {e}")
        import traceback
        traceback.print_exc()
        return None

def update_game_odds(supabase: Client, game_id: str, odds_data: Dict):
    """Update game odds in nba_games table"""
    try:
        update_data = {
            'home_spread': odds_data.get('homeSpread'),
            'away_spread': odds_data.get('awaySpread'),
            'over_under': odds_data.get('overUnder'),
            'home_moneyline': odds_data.get('homeMoneyline'),
            'away_moneyline': odds_data.get('awayMoneyline'),
            'odds_source': 'nba_api',
            'odds_updated_at': datetime.now().isoformat(),
            'raw_odds_data': odds_data.get('rawData'),
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        result = supabase.table('nba_games') \
            .update(update_data) \
            .eq('game_id', game_id) \
            .execute()
        
        if result.data:
            spread_str = f"{odds_data.get('homeSpread', 'N/A')}" if odds_data.get('homeSpread') else "N/A"
            ou_str = f"{odds_data.get('overUnder', 'N/A')}" if odds_data.get('overUnder') else "N/A"
            print(f"   ✅ Updated odds: Spread {spread_str}, O/U {ou_str}")
            return True
        else:
            print(f"   ⚠️  No game found in nba_games for {game_id}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error updating odds for {game_id}: {e}")
        return False

def process_date(supabase: Client, target_date: str = None):
    """Process odds for games on a specific date"""
    if target_date:
        date_str = target_date
    else:
        # Default to today
        now = datetime.now()
        date_str = now.strftime('%Y-%m-%d')
    
    print(f"\n{'=' * 80}")
    print(f"📅 Processing odds for date: {date_str}")
    print(f"{'=' * 80}")
    
    # Get games for this date
    games = get_today_games(supabase, date_str)
    
    if not games:
        print(f"ℹ️  No games found for {date_str}")
        return {
            'date': date_str,
            'total_games': 0,
            'updated_games': 0,
            'failed_games': 0
        }
    
    # Fetch odds from NBA API
    odds_map = fetch_nba_odds()
    
    if not odds_map:
        print("⚠️  Could not fetch odds data")
        return {
            'date': date_str,
            'total_games': len(games),
            'updated_games': 0,
            'failed_games': len(games)
        }
    
    print(f"\n🎮 Updating odds for {len(games)} games...")
    print("-" * 80)
    
    updated_count = 0
    failed_count = 0
    
    for i, game in enumerate(games, 1):
        game_id = game['game_id']
        matchup = f"{game['away_team_tricode']} @ {game['home_team_tricode']}"
        
        print(f"\n[{i}/{len(games)}] 🎮 {game_id}: {matchup}")
        
        # Find odds data for this game
        odds_data = odds_map.get(game_id)
        
        if not odds_data:
            # Try to match by team IDs
            odds_data = None
            for odds_game_id, odds in odds_map.items():
                if (odds.get('homeTeamId') == game.get('home_team_id') and 
                    odds.get('awayTeamId') == game.get('away_team_id')):
                    odds_data = odds
                    print(f"   📍 Matched by team IDs")
                    break
            
            if not odds_data:
                print(f"   ⚠️  No odds data found for this game")
                failed_count += 1
                continue
        
        # Update game odds
        if update_game_odds(supabase, game_id, odds_data):
            updated_count += 1
        else:
            failed_count += 1
        
        # Rate limiting - be nice to the API
        time.sleep(0.5)
    
    return {
        'date': date_str,
        'total_games': len(games),
        'updated_games': updated_count,
        'failed_games': failed_count
    }

def main():
    """Main function"""
    # Parse command line arguments
    target_date = None
    
    if len(sys.argv) >= 2:
        try:
            # Validate date format
            datetime.strptime(sys.argv[1], '%Y-%m-%d')
            target_date = sys.argv[1]
        except ValueError:
            print(f"❌ Invalid date format. Use YYYY-MM-DD (e.g., 2025-01-22)")
            sys.exit(1)
    
    print("=" * 80)
    print("🏀 NBA Game Odds Import")
    print(f"📅 Target date: {target_date or 'Today'}")
    print(f"⏰ Run time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    
    # Process odds
    result = process_date(supabase, target_date)
    
    # Print summary
    print(f"\n{'=' * 80}")
    print(f"🎯 Import Summary:")
    print(f"{'=' * 80}")
    print(f"   Date: {result['date']}")
    print(f"   Total games: {result['total_games']}")
    print(f"   ✅ Updated: {result['updated_games']}")
    print(f"   ❌ Failed: {result['failed_games']}")
    if result['total_games'] > 0:
        success_rate = (result['updated_games'] / result['total_games']) * 100
        print(f"   Success rate: {success_rate:.1f}%")
    print(f"{'=' * 80}")
    print(f"\n✅ Odds import completed!")

if __name__ == "__main__":
    main()

