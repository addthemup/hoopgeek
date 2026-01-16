#!/usr/bin/env python3
"""
Generate Procedural Trailing Data for DFS Testing

This script generates realistic nba_boxscores data procedurally for testing DFS scoring.
It can generate data for specific games or date ranges, creating realistic player stats
based on historical averages or random distributions.

Usage:
    python scripts/generate_procedural_trailing_data.py --game-id 0022500357
    python scripts/generate_procedural_trailing_data.py --date 2025-12-07
    python scripts/generate_procedural_trailing_data.py --date-range 2025-11-01 2025-11-30
"""

import os
import sys
import random
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from supabase import create_client, Client

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials in environment variables")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(url, key)

def get_player_historical_averages(supabase: Client, nba_player_id: int) -> Optional[Dict]:
    """Get historical averages for a player from existing boxscores"""
    try:
        result = supabase.table('nba_boxscores') \
            .select('pts, reb, ast, stl, blk, tov, fg3m, fgm, fga, min') \
            .eq('nba_player_id', nba_player_id) \
            .limit(100) \
            .execute()
        
        if not result.data or len(result.data) == 0:
            return None
        
        # Calculate averages
        games = result.data
        return {
            'pts': sum(g.get('pts', 0) or 0 for g in games) / len(games),
            'reb': sum(g.get('reb', 0) or 0 for g in games) / len(games),
            'ast': sum(g.get('ast', 0) or 0 for g in games) / len(games),
            'stl': sum(g.get('stl', 0) or 0 for g in games) / len(games),
            'blk': sum(g.get('blk', 0) or 0 for g in games) / len(games),
            'tov': sum(g.get('tov', 0) or 0 for g in games) / len(games),
            'fg3m': sum(g.get('fg3m', 0) or 0 for g in games) / len(games),
            'fgm': sum(g.get('fgm', 0) or 0 for g in games) / len(games),
            'fga': sum(g.get('fga', 0) or 0 for g in games) / len(games),
            'min': sum(g.get('min', 0) or 0 for g in games) / len(games),
        }
    except Exception as e:
        print(f"⚠️  Error getting historical averages for player {nba_player_id}: {e}")
        return None

def generate_realistic_stats(player_avg: Optional[Dict], position: str = None) -> Dict:
    """Generate realistic stats based on player averages or position-based defaults"""
    
    if player_avg:
        # Use player's historical averages with some variance
        variance = 0.3  # 30% variance
        return {
            'pts': max(0, int(random.gauss(player_avg['pts'], player_avg['pts'] * variance))),
            'reb': max(0, int(random.gauss(player_avg['reb'], player_avg['reb'] * variance))),
            'ast': max(0, int(random.gauss(player_avg['ast'], player_avg['ast'] * variance))),
            'stl': max(0, int(random.gauss(player_avg['stl'], player_avg['stl'] * variance + 0.5))),
            'blk': max(0, int(random.gauss(player_avg['blk'], player_avg['blk'] * variance + 0.5))),
            'tov': max(0, int(random.gauss(player_avg['tov'], player_avg['tov'] * variance + 0.5))),
            'fg3m': max(0, int(random.gauss(player_avg['fg3m'], player_avg['fg3m'] * variance + 0.5))),
            'fgm': max(0, int(random.gauss(player_avg['fgm'], player_avg['fgm'] * variance))),
            'fga': max(0, int(random.gauss(player_avg['fga'], player_avg['fga'] * variance))),
            'min': max(0, min(48, round(random.gauss(player_avg['min'], player_avg['min'] * variance), 2))),
        }
    else:
        # Use position-based defaults
        defaults = {
            'PG': {'pts': 15, 'reb': 4, 'ast': 7, 'stl': 1.2, 'blk': 0.2, 'tov': 2.5, 'fg3m': 2, 'fgm': 6, 'fga': 13, 'min': 32},
            'SG': {'pts': 18, 'reb': 4, 'ast': 4, 'stl': 1.0, 'blk': 0.3, 'tov': 2.0, 'fg3m': 2.5, 'fgm': 7, 'fga': 15, 'min': 30},
            'SF': {'pts': 16, 'reb': 6, 'ast': 3, 'stl': 1.1, 'blk': 0.5, 'tov': 2.2, 'fg3m': 1.8, 'fgm': 6, 'fga': 13, 'min': 28},
            'PF': {'pts': 14, 'reb': 8, 'ast': 2, 'stl': 0.8, 'blk': 1.0, 'tov': 1.8, 'fg3m': 1.2, 'fgm': 6, 'fga': 12, 'min': 26},
            'C': {'pts': 12, 'reb': 10, 'ast': 2, 'stl': 0.6, 'blk': 1.5, 'tov': 2.0, 'fg3m': 0.3, 'fgm': 5, 'fga': 10, 'min': 24},
        }
        
        pos_defaults = defaults.get(position or 'SF', defaults['SF'])
        variance = 0.4
        
        return {
            'pts': max(0, int(random.gauss(pos_defaults['pts'], pos_defaults['pts'] * variance))),
            'reb': max(0, int(random.gauss(pos_defaults['reb'], pos_defaults['reb'] * variance))),
            'ast': max(0, int(random.gauss(pos_defaults['ast'], pos_defaults['ast'] * variance))),
            'stl': max(0, int(random.gauss(pos_defaults['stl'], pos_defaults['stl'] * variance + 0.5))),
            'blk': max(0, int(random.gauss(pos_defaults['blk'], pos_defaults['blk'] * variance + 0.5))),
            'tov': max(0, int(random.gauss(pos_defaults['tov'], pos_defaults['tov'] * variance + 0.5))),
            'fg3m': max(0, int(random.gauss(pos_defaults['fg3m'], pos_defaults['fg3m'] * variance + 0.5))),
            'fgm': max(0, int(random.gauss(pos_defaults['fgm'], pos_defaults['fgm'] * variance))),
            'fga': max(0, int(random.gauss(pos_defaults['fga'], pos_defaults['fga'] * variance))),
            'min': max(0, min(48, round(random.gauss(pos_defaults['min'], pos_defaults['min'] * variance), 2))),
        }

def generate_boxscore_for_player(
    supabase: Client,
    player: Dict,
    game: Dict,
    use_historical: bool = True
) -> Dict:
    """Generate a boxscore entry for a player in a game"""
    
    # Get player historical averages if available
    player_avg = None
    if use_historical:
        player_avg = get_player_historical_averages(supabase, player['nba_player_id'])
    
    # Generate stats
    stats = generate_realistic_stats(player_avg, player.get('position'))
    
    # Calculate derived stats
    fg_pct = round(stats['fgm'] / stats['fga'], 3) if stats['fga'] > 0 else 0.0
    fg3_pct = round(stats['fg3m'] / stats['fga'], 3) if stats['fga'] > 0 else 0.0
    ftm = max(0, int(stats['pts'] * 0.2))  # Rough estimate: ~20% of points from FTs
    fta = max(ftm, int(ftm * 1.3))  # Slightly more attempts than makes
    ft_pct = round(ftm / fta, 3) if fta > 0 else 0.0
    
    # Determine if starter (top 5 players by minutes typically start)
    is_starter = random.random() < 0.2  # 20% chance for now, could be improved
    
    # Determine home/away
    is_home = player.get('team_id') == game.get('home_team_id')
    
    return {
        'player_id': player.get('id'),
        'nba_player_id': player['nba_player_id'],
        'player_name': player.get('name') or player.get('player_name'),
        'game_id': game['game_id'],
        'game_date': game['game_date'].split('T')[0] if isinstance(game['game_date'], str) else game['game_date'],
        'season_year': game.get('season_year', '2025-26'),
        'matchup': f"{game.get('away_team_tricode', 'AWAY')} @ {game.get('home_team_tricode', 'HOME')}",
        'jersey_num': random.randint(0, 99),
        'position': player.get('position'),
        'team_id': player.get('team_id'),
        'team_abbreviation': player.get('team_abbreviation') or player.get('team_tricode'),
        'team_name': player.get('team_name'),
        'team_city': player.get('team_city'),
        'team_tricode': player.get('team_tricode') or player.get('team_abbreviation'),
        'min': stats['min'],
        'fgm': stats['fgm'],
        'fga': stats['fga'],
        'fg_pct': fg_pct,
        'fg3m': stats['fg3m'],
        'fg3a': int(stats['fga'] * 0.4),  # Rough estimate: 40% of FGA are 3s
        'fg3_pct': fg3_pct,
        'ftm': ftm,
        'fta': fta,
        'ft_pct': ft_pct,
        'oreb': max(0, int(stats['reb'] * 0.3)),  # ~30% offensive
        'dreb': max(0, stats['reb'] - int(stats['reb'] * 0.3)),
        'reb': stats['reb'],
        'ast': stats['ast'],
        'stl': stats['stl'],
        'blk': stats['blk'],
        'tov': stats['tov'],
        'fouls_personal': random.randint(0, 5),
        'pts': stats['pts'],
        'plus_minus_points': random.randint(-20, 20),
        'is_starter': is_starter,
        'is_home_game': is_home,
        'game_type': 'Regular Season',
    }

def get_game_players(supabase: Client, game: Dict) -> List[Dict]:
    """Get all players who played in a game (from rosters or historical data)"""
    try:
        # Try to get players from nba_team_rosters for the teams in the game
        home_team_id = game.get('home_team_id')
        away_team_id = game.get('away_team_id')
        
        players = []
        
        # Get home team players
        if home_team_id:
            result = supabase.table('nba_team_rosters') \
                .select('player_id, nba_player_id, player_name, position, team_id, team_tricode') \
                .eq('team_id', home_team_id) \
                .eq('season_year', 2025) \
                .limit(15) \
                .execute()
            players.extend(result.data or [])
        
        # Get away team players
        if away_team_id:
            result = supabase.table('nba_team_rosters') \
                .select('player_id, nba_player_id, player_name, position, team_id, team_tricode') \
                .eq('team_id', away_team_id) \
                .eq('season_year', 2025) \
                .limit(15) \
                .execute()
            players.extend(result.data or [])
        
        # If no roster data, try to get from existing boxscores for similar games
        if not players:
            # Get players from nba_players who might have played
            result = supabase.table('nba_players') \
                .select('id, nba_player_id, name') \
                .eq('is_active', True) \
                .limit(30) \
                .execute()
            players = result.data or []
        
        return players
    except Exception as e:
        print(f"⚠️  Error getting game players: {e}")
        return []

def generate_boxscores_for_game(
    supabase: Client,
    game_id: str,
    use_historical: bool = True,
    overwrite: bool = False
) -> int:
    """Generate boxscores for all players in a game"""
    print(f"\n🎮 Generating boxscores for game {game_id}...")
    
    # Get game info
    result = supabase.table('nba_games') \
        .select('*') \
        .eq('game_id', game_id) \
        .single() \
        .execute()
    
    if not result.data:
        print(f"❌ Game {game_id} not found")
        return 0
    
    game = result.data
    
    # Check if boxscores already exist
    if not overwrite:
        existing = supabase.table('nba_boxscores') \
            .select('id') \
            .eq('game_id', game_id) \
            .limit(1) \
            .execute()
        if existing.data:
            print(f"⚠️  Boxscores already exist for game {game_id}. Use --overwrite to regenerate.")
            return 0
    
    # Get players for this game
    players = get_game_players(supabase, game)
    if not players:
        print(f"⚠️  No players found for game {game_id}")
        return 0
    
    print(f"📊 Found {len(players)} players for game {game_id}")
    
    # Generate boxscores
    boxscores = []
    for player in players:
        try:
            boxscore = generate_boxscore_for_player(supabase, player, game, use_historical)
            boxscores.append(boxscore)
        except Exception as e:
            print(f"⚠️  Error generating boxscore for player {player.get('nba_player_id')}: {e}")
            continue
    
    # Insert boxscores
    if boxscores:
        try:
            result = supabase.table('nba_boxscores').upsert(
                boxscores,
                on_conflict='nba_player_id,game_id'
            ).execute()
            print(f"✅ Generated {len(boxscores)} boxscores for game {game_id}")
            return len(boxscores)
        except Exception as e:
            print(f"❌ Error inserting boxscores: {e}")
            return 0
    
    return 0

def generate_boxscores_for_date(
    supabase: Client,
    date: str,
    use_historical: bool = True,
    overwrite: bool = False
) -> int:
    """Generate boxscores for all games on a date"""
    print(f"\n📅 Generating boxscores for date {date}...")
    
    # Get games for this date
    result = supabase.table('nba_games') \
        .select('game_id') \
        .gte('game_date', f'{date}T00:00:00') \
        .lte('game_date', f'{date}T23:59:59') \
        .execute()
    
    games = result.data or []
    if not games:
        print(f"⚠️  No games found for date {date}")
        return 0
    
    print(f"🎮 Found {len(games)} games for date {date}")
    
    total_boxscores = 0
    for game in games:
        count = generate_boxscores_for_game(
            supabase,
            game['game_id'],
            use_historical,
            overwrite
        )
        total_boxscores += count
    
    print(f"\n✅ Generated {total_boxscores} total boxscores for date {date}")
    return total_boxscores

def generate_boxscores_for_date_range(
    supabase: Client,
    start_date: str,
    end_date: str,
    use_historical: bool = True,
    overwrite: bool = False
) -> int:
    """Generate boxscores for all games in a date range"""
    print(f"\n📅 Generating boxscores for date range {start_date} to {end_date}...")
    
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    
    total_boxscores = 0
    current = start
    
    while current <= end:
        date_str = current.strftime('%Y-%m-%d')
        count = generate_boxscores_for_date(supabase, date_str, use_historical, overwrite)
        total_boxscores += count
        current += timedelta(days=1)
    
    print(f"\n✅ Generated {total_boxscores} total boxscores for date range")
    return total_boxscores

def main():
    parser = argparse.ArgumentParser(description='Generate procedural trailing data for DFS testing')
    parser.add_argument('--game-id', type=str, help='Generate data for a specific game ID')
    parser.add_argument('--date', type=str, help='Generate data for a specific date (YYYY-MM-DD)')
    parser.add_argument('--date-range', nargs=2, metavar=('START', 'END'), help='Generate data for a date range (YYYY-MM-DD YYYY-MM-DD)')
    parser.add_argument('--no-historical', action='store_true', help='Do not use historical averages (use position defaults)')
    parser.add_argument('--overwrite', action='store_true', help='Overwrite existing boxscores')
    
    args = parser.parse_args()
    
    if not args.game_id and not args.date and not args.date_range:
        parser.print_help()
        sys.exit(1)
    
    supabase = setup_supabase()
    use_historical = not args.no_historical
    
    if args.game_id:
        generate_boxscores_for_game(supabase, args.game_id, use_historical, args.overwrite)
    elif args.date:
        generate_boxscores_for_date(supabase, args.date, use_historical, args.overwrite)
    elif args.date_range:
        generate_boxscores_for_date_range(supabase, args.date_range[0], args.date_range[1], use_historical, args.overwrite)

if __name__ == '__main__':
    main()

