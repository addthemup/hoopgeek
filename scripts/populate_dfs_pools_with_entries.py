#!/usr/bin/env python3
"""
Populate DFS Pools with Simulated Entries

This script fills existing dfs_pools with simulated entries from existing users.
It ONLY uses players who actually played in games on the pool's slate date (from nba_boxscores).
It creates realistic lineups that respect salary caps and roster requirements.

Requirements:
- Pool must have games in dfs_pool_games
- nba_boxscores must have data for those games
- dfs_player_salaries must have entries for players who played

Usage:
    python scripts/populate_dfs_pools_with_entries.py --pool-id <pool_id>
    python scripts/populate_dfs_pools_with_entries.py --all-pools --entries-per-pool 10
    python scripts/populate_dfs_pools_with_entries.py --date 2025-11-18 --entries-per-pool 5
"""

import os
import sys
import random
import argparse
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

def get_all_users(supabase: Client) -> List[Dict]:
    """Get all users from auth.users (via service role)"""
    try:
        # Use RPC function or direct query if available
        # Note: This requires service role key to access auth.users
        result = supabase.rpc('get_all_user_ids').execute()
        if result.data:
            return result.data
    except Exception as e:
        print(f"⚠️  RPC function not available: {e}")
    
    try:
        # Fallback: Try to get users from profiles table
        result = supabase.table('profiles') \
            .select('id') \
            .limit(1000) \
            .execute()
        
        if result.data:
            return result.data
    except Exception as e:
        print(f"⚠️  Error getting users from profiles: {e}")
    
    # Alternative: Get users from any table that has user_id
    try:
        result = supabase.table('dfs_entries') \
            .select('user_id') \
            .limit(1000) \
            .execute()
        
        user_ids = list(set([entry['user_id'] for entry in (result.data or [])]))
        if user_ids:
            return [{'id': uid} for uid in user_ids]
    except Exception as e:
        print(f"⚠️  Error getting users from dfs_entries: {e}")
    
    # Last resort: return empty list
    print("❌ Could not find any users")
    return []

def get_pool_info(supabase: Client, pool_id: str) -> Optional[Dict]:
    """Get pool information"""
    try:
        result = supabase.table('dfs_pools') \
            .select('*') \
            .eq('id', pool_id) \
            .single() \
            .execute()
        return result.data
    except Exception as e:
        print(f"❌ Error getting pool info: {e}")
        return None

def get_pool_games(supabase: Client, pool_id: str) -> List[str]:
    """Get game IDs for games in this pool"""
    try:
        result = supabase.table('dfs_pool_games') \
            .select('game_id') \
            .eq('pool_id', pool_id) \
            .eq('is_included', True) \
            .execute()
        return [game['game_id'] for game in (result.data or [])]
    except Exception as e:
        print(f"❌ Error getting pool games: {e}")
        return []

def get_players_who_played(supabase: Client, game_ids: List[str]) -> List[int]:
    """Get nba_player_ids who actually played in these games (from nba_boxscores)"""
    if not game_ids:
        return []
    
    try:
        result = supabase.table('nba_boxscores') \
            .select('nba_player_id') \
            .in_('game_id', game_ids) \
            .execute()
        
        # Get unique player IDs
        player_ids = list(set([box['nba_player_id'] for box in (result.data or [])]))
        return player_ids
    except Exception as e:
        print(f"❌ Error getting players who played: {e}")
        return []

def get_pool_players(supabase: Client, pool_id: str, players_who_played: List[int] = None) -> List[Dict]:
    """Get available players for a pool, optionally filtered to only those who played"""
    try:
        query = supabase.table('dfs_player_salaries') \
            .select('*') \
            .eq('pool_id', pool_id) \
            .eq('is_active', True)
        
        # Filter to only players who actually played
        if players_who_played:
            query = query.in_('nba_player_id', players_who_played)
        
        result = query.order('salary', desc=False).execute()
        return result.data or []
    except Exception as e:
        print(f"❌ Error getting pool players: {e}")
        return []

def calculate_fantasy_points(stats: Dict, scoring_format: str = 'FanDuel') -> float:
    """Calculate fantasy points based on scoring format"""
    pts = stats.get('pts', 0) or 0
    reb = stats.get('reb', 0) or 0
    ast = stats.get('ast', 0) or 0
    stl = stats.get('stl', 0) or 0
    blk = stats.get('blk', 0) or 0
    tov = stats.get('tov', 0) or 0
    fg3m = stats.get('fg3m', 0) or 0
    
    if scoring_format == 'FanDuel':
        return (
            pts * 1.0 +
            reb * 1.2 +
            ast * 1.5 +
            stl * 2.0 +
            blk * 2.0 +
            tov * -1.0 +
            fg3m * 0.5
        )
    elif scoring_format == 'DraftKings':
        return (
            pts * 1.0 +
            reb * 1.25 +
            ast * 1.5 +
            stl * 2.0 +
            blk * 2.0 +
            tov * -0.5 +
            fg3m * 0.5
        )
    else:  # Default to FanDuel
        return (
            pts * 1.0 +
            reb * 1.2 +
            ast * 1.5 +
            stl * 2.0 +
            blk * 2.0 +
            tov * -1.0 +
            fg3m * 0.5
        )

def get_player_performance_data(
    supabase: Client,
    pool_id: str,
    game_ids: List[str],
    players: List[Dict],
    scoring_format: str
) -> Dict[int, Dict]:
    """Get actual performance data (fantasy points) for players from nba_boxscores"""
    if not game_ids or not players:
        return {}
    
    player_ids = [p['nba_player_id'] for p in players]
    
    try:
        # Get boxscore data for these players in these games
        result = supabase.table('nba_boxscores') \
            .select('nba_player_id, pts, reb, ast, stl, blk, tov, fg3m') \
            .in_('game_id', game_ids) \
            .in_('nba_player_id', player_ids) \
            .execute()
        
        # Aggregate stats per player (sum across all games in slate)
        player_stats = {}
        for boxscore in (result.data or []):
            nba_player_id = boxscore['nba_player_id']
            if nba_player_id not in player_stats:
                player_stats[nba_player_id] = {
                    'pts': 0,
                    'reb': 0,
                    'ast': 0,
                    'stl': 0,
                    'blk': 0,
                    'tov': 0,
                    'fg3m': 0,
                }
            
            player_stats[nba_player_id]['pts'] += boxscore.get('pts', 0) or 0
            player_stats[nba_player_id]['reb'] += boxscore.get('reb', 0) or 0
            player_stats[nba_player_id]['ast'] += boxscore.get('ast', 0) or 0
            player_stats[nba_player_id]['stl'] += boxscore.get('stl', 0) or 0
            player_stats[nba_player_id]['blk'] += boxscore.get('blk', 0) or 0
            player_stats[nba_player_id]['tov'] += boxscore.get('tov', 0) or 0
            player_stats[nba_player_id]['fg3m'] += boxscore.get('fg3m', 0) or 0
        
        # Calculate fantasy points and value for each player
        player_performance = {}
        for player in players:
            nba_player_id = player['nba_player_id']
            salary = player['salary']
            stats = player_stats.get(nba_player_id, {
                'pts': 0, 'reb': 0, 'ast': 0, 'stl': 0, 'blk': 0, 'tov': 0, 'fg3m': 0
            })
            
            fantasy_points = calculate_fantasy_points(stats, scoring_format)
            value = (fantasy_points / (salary / 1000.0)) if salary > 0 else 0
            
            player_performance[nba_player_id] = {
                'fantasy_points': fantasy_points,
                'value': value,
                'stats': stats,
            }
        
        return player_performance
    except Exception as e:
        print(f"⚠️  Error getting player performance data: {e}")
        return {}

def select_optimal_lineup(
    players: List[Dict],
    pool: Dict,
    strategy: str = 'balanced',
    user_seed: str = None,
    used_players: set = None,
    player_performance: Dict[int, Dict] = None
) -> List[Dict]:
    """Select an optimal lineup based on strategy, ensuring uniqueness per user"""
    
    salary_cap = pool['salary_cap']
    starters_count = pool['starters_count']
    rotation_count = pool['rotation_count']
    bench_count = pool['bench_count']
    
    # Use user_seed to create deterministic but unique lineups per user
    seed_value = 0
    random_state = random
    if user_seed:
        # Create a deterministic random state based on user ID
        seed_value = hash(user_seed) % (2**32)
        random_state = random.Random(seed_value)
    
    # Filter out already used players if provided (to ensure variety across users)
    available_players = players
    if used_players:
        available_players = [p for p in players if p['nba_player_id'] not in used_players]
        # If we don't have enough unique players, allow some overlap
        if len(available_players) < starters_count + rotation_count + bench_count:
            available_players = players
    
    # If we have performance data, use it to create competitive lineups
    if player_performance:
        # Add performance metrics to players
        for player in available_players:
            perf = player_performance.get(player['nba_player_id'], {})
            player['fantasy_points'] = perf.get('fantasy_points', 0)
            player['value'] = perf.get('value', 0)
        
        if strategy == 'stars_and_scrubs':
            # Pick top performers (by fantasy points) + best value plays
            sorted_by_points = sorted(available_players, key=lambda p: p.get('fantasy_points', 0), reverse=True)
            sorted_by_value = sorted(available_players, key=lambda p: p.get('value', 0), reverse=True)
            
            # Top performers for starters
            stars = sorted_by_points[:starters_count]
            # Best value for rotation
            value_plays = [p for p in sorted_by_value if p not in stars][:rotation_count]
            # Cheap value plays for bench
            cheap_value = [p for p in sorted_by_value if p not in stars and p not in value_plays][:bench_count]
            lineup = stars + value_plays + cheap_value
            
        elif strategy == 'balanced':
            # Mix of high performers and value plays
            sorted_by_points = sorted(available_players, key=lambda p: p.get('fantasy_points', 0), reverse=True)
            sorted_by_value = sorted(available_players, key=lambda p: p.get('value', 0), reverse=True)
            
            # Top 40% by points, rest by value
            high_performers = sorted_by_points[:int(starters_count * 0.4)]
            remaining = [p for p in available_players if p not in high_performers]
            sorted_remaining = sorted(remaining, key=lambda p: p.get('value', 0), reverse=True)
            
            mid_and_low = sorted_remaining[:starters_count - len(high_performers) + rotation_count + bench_count]
            lineup = high_performers + mid_and_low
            
        elif strategy == 'value':
            # Pure value plays - best points per dollar
            sorted_by_value = sorted(available_players, key=lambda p: p.get('value', 0), reverse=True)
            lineup = sorted_by_value[:starters_count + rotation_count + bench_count]
            
        else:  # random but still use performance data for variety
            # Weight random selection by value
            if user_seed:
                # Create weighted random selection
                weights = [p.get('value', 0.1) for p in available_players]
                # Normalize weights
                total_weight = sum(weights)
                if total_weight > 0:
                    weights = [w / total_weight for w in weights]
                lineup = random_state.choices(available_players, weights=weights, k=min(starters_count + rotation_count + bench_count, len(available_players)))
            else:
                lineup = random.sample(available_players, min(starters_count + rotation_count + bench_count, len(available_players)))
    else:
        # Fallback to salary-based selection if no performance data
        sorted_players = sorted(available_players, key=lambda p: p['salary'], reverse=True)
        
        if strategy == 'stars_and_scrubs':
            stars = sorted_players[:starters_count]
            scrubs = sorted_players[-bench_count:]
            rotation = sorted_players[starters_count:starters_count + rotation_count]
            lineup = stars + rotation + scrubs
        elif strategy == 'balanced':
            high_count = int(starters_count * 0.4)
            mid_count = int(starters_count * 0.6) + rotation_count
            
            if user_seed:
                offset = seed_value % max(1, len(sorted_players) // 4)
                high = sorted_players[offset:offset + high_count] if offset + high_count <= len(sorted_players) else sorted_players[:high_count]
                mid_start = (offset * 2) % max(1, len(sorted_players) - high_count)
                mid = sorted_players[mid_start:mid_start + mid_count] if mid_start + mid_count <= len(sorted_players) else sorted_players[high_count:high_count + mid_count]
                low = sorted_players[-bench_count:]
            else:
                high = sorted_players[:high_count]
                mid = sorted_players[high_count:high_count + mid_count]
                low = sorted_players[-bench_count:]
            
            lineup = (high + mid + low)[:starters_count + rotation_count + bench_count]
        else:
            if user_seed:
                lineup = random_state.sample(available_players, min(starters_count + rotation_count + bench_count, len(available_players)))
            else:
                lineup = random.sample(available_players, min(starters_count + rotation_count + bench_count, len(available_players)))
    
    # Ensure we don't exceed salary cap
    total_salary = sum(p['salary'] for p in lineup)
    attempts = 0
    max_attempts = 50
    
    while total_salary > salary_cap and attempts < max_attempts:
        attempts += 1
        # Remove most expensive player
        lineup = sorted(lineup, key=lambda p: p['salary'], reverse=True)
        removed = lineup.pop(0)
        total_salary -= removed['salary']
        
        # Try to add a cheaper player that fits
        remaining_players = [p for p in available_players if p not in lineup]
        remaining_players = sorted(remaining_players, key=lambda p: p['salary'])
        
        for player in remaining_players:
            if total_salary + player['salary'] <= salary_cap:
                lineup.append(player)
                total_salary += player['salary']
                break
        
        # If we can't find a replacement, try removing another expensive player
        if total_salary > salary_cap and len(lineup) < starters_count + rotation_count + bench_count:
            continue
    
    # Ensure we have the right number of players
    if len(lineup) < starters_count + rotation_count + bench_count:
        remaining_players = [p for p in available_players if p not in lineup]
        needed = (starters_count + rotation_count + bench_count) - len(lineup)
        for player in remaining_players[:needed]:
            if total_salary + player['salary'] <= salary_cap:
                lineup.append(player)
                total_salary += player['salary']
    
    return lineup[:starters_count + rotation_count + bench_count]

def create_entry_and_lineup(
    supabase: Client,
    pool_id: str,
    user_id: str,
    players: List[Dict],
    pool: Dict,
    user_seed: str = None,
    used_players: set = None,
    player_performance: Dict[int, Dict] = None
) -> Optional[str]:
    """Create a DFS entry and lineup for a user"""
    try:
        # Create entry
        entry_result = supabase.table('dfs_entries').insert({
            'pool_id': pool_id,
            'user_id': user_id,
            'entry_fee_paid': pool.get('entry_fee', 0),
            'status': 'active',
            'total_salary': 0,
            'projected_points': 0,
        }).execute()
        
        if not entry_result.data:
            print(f"❌ Failed to create entry for user {user_id}")
            return None
        
        entry_id = entry_result.data[0]['id']
        
        # Select lineup strategy based on user (deterministic but varied)
        if user_seed:
            strategy_seed = hash(user_seed + str(entry_id)) % 4
            strategies = ['balanced', 'stars_and_scrubs', 'value', 'random']
            strategy = strategies[strategy_seed]
        else:
            strategy = random.choice(['balanced', 'stars_and_scrubs', 'value', 'random'])
        
        lineup_players = select_optimal_lineup(
            players, 
            pool, 
            strategy, 
            user_seed=user_seed, 
            used_players=used_players,
            player_performance=player_performance
        )
        
        if len(lineup_players) < pool['starters_count'] + pool['rotation_count'] + pool['bench_count']:
            print(f"⚠️  Not enough players for complete lineup")
            return None
        
        # Create lineup
        total_salary = sum(p['salary'] for p in lineup_players)
        lineup_result = supabase.table('dfs_lineups').insert({
            'entry_id': entry_id,
            'pool_id': pool_id,
            'user_id': user_id,
            'total_salary': total_salary,
            'remaining_salary': pool['salary_cap'] - total_salary,
            'is_complete': True,
            'is_valid': True,
            'is_locked': pool.get('status') in ['live', 'scoring', 'final'],
        }).execute()
        
        if not lineup_result.data:
            print(f"❌ Failed to create lineup for entry {entry_id}")
            return None
        
        lineup_id = lineup_result.data[0]['id']
        
        # Create lineup positions
        positions = []
        
        # Starters
        for i, player in enumerate(lineup_players[:pool['starters_count']]):
            positions.append({
                'lineup_id': lineup_id,
                'pool_id': pool_id,
                'player_id': player['player_id'],
                'nba_player_id': player['nba_player_id'],
                'unit': 'starters',
                'unit_position': i + 1,
                'player_name': player['player_name'],
                'player_team': player['player_team'],
                'player_position': player.get('player_position'),
                'player_salary': player['salary'],
                'unit_multiplier': pool['starters_multiplier'],
            })
        
        # Rotation
        for i, player in enumerate(lineup_players[pool['starters_count']:pool['starters_count'] + pool['rotation_count']]):
            positions.append({
                'lineup_id': lineup_id,
                'pool_id': pool_id,
                'player_id': player['player_id'],
                'nba_player_id': player['nba_player_id'],
                'unit': 'rotation',
                'unit_position': i + 1,
                'player_name': player['player_name'],
                'player_team': player['player_team'],
                'player_position': player.get('player_position'),
                'player_salary': player['salary'],
                'unit_multiplier': pool['rotation_multiplier'],
            })
        
        # Bench
        for i, player in enumerate(lineup_players[pool['starters_count'] + pool['rotation_count']:]):
            positions.append({
                'lineup_id': lineup_id,
                'pool_id': pool_id,
                'player_id': player['player_id'],
                'nba_player_id': player['nba_player_id'],
                'unit': 'bench',
                'unit_position': i + 1,
                'player_name': player['player_name'],
                'player_team': player['player_team'],
                'player_position': player.get('player_position'),
                'player_salary': player['salary'],
                'unit_multiplier': pool['bench_multiplier'],
            })
        
        # Insert positions
        supabase.table('dfs_lineup_positions').insert(positions).execute()
        
        # Update entry with lineup_id
        supabase.table('dfs_entries').update({
            'lineup_id': lineup_id,
            'total_salary': total_salary,
        }).eq('id', entry_id).execute()
        
        # Update pool entry count
        try:
            supabase.rpc('increment_pool_entries', {'p_pool_id': pool_id}).execute()
        except:
            # Fallback: manual update
            pool_result = supabase.table('dfs_pools').select('current_entries').eq('id', pool_id).single().execute()
            if pool_result.data:
                current = pool_result.data.get('current_entries', 0)
                supabase.table('dfs_pools').update({'current_entries': current + 1}).eq('id', pool_id).execute()
        
        return entry_id
        
    except Exception as e:
        print(f"❌ Error creating entry/lineup: {e}")
        import traceback
        traceback.print_exc()
        return None

def populate_pool(
    supabase: Client,
    pool_id: str,
    num_entries: int,
    users: List[Dict]
) -> int:
    """Populate a pool with simulated entries"""
    print(f"\n🏊 Populating pool {pool_id} with {num_entries} entries...")
    
    # Get pool info
    pool = get_pool_info(supabase, pool_id)
    if not pool:
        print(f"❌ Pool {pool_id} not found")
        return 0
    
    print(f"📋 Pool: {pool['name']} ({pool['slate_date']})")
    print(f"   Salary Cap: ${pool['salary_cap']:,}")
    print(f"   Roster: {pool['starters_count']} starters, {pool['rotation_count']} rotation, {pool['bench_count']} bench")
    
    # Get games in this pool
    game_ids = get_pool_games(supabase, pool_id)
    if not game_ids:
        print(f"⚠️  No games found for pool {pool_id}")
        return 0
    
    print(f"🎮 Found {len(game_ids)} games in pool")
    
    # Get players who actually played in these games
    players_who_played = get_players_who_played(supabase, game_ids)
    if not players_who_played:
        print(f"⚠️  No players found in nba_boxscores for these games")
        print(f"   Make sure boxscore data exists for games: {game_ids[:3]}...")
        return 0
    
    print(f"👥 Found {len(players_who_played)} players who played in these games")
    
    # Get available players (filtered to only those who played)
    players = get_pool_players(supabase, pool_id, players_who_played)
    if not players:
        print(f"❌ No players found in dfs_player_salaries for pool {pool_id}")
        print(f"   Make sure dfs_player_salaries has entries for players who played")
        return 0
    
    print(f"✅ Found {len(players)} available players (who played + have salaries)")
    
    # Get actual performance data from nba_boxscores
    scoring_format = pool.get('scoring_format', 'FanDuel')
    print(f"📊 Fetching performance data from nba_boxscores (scoring: {scoring_format})...")
    player_performance = get_player_performance_data(
        supabase,
        pool_id,
        game_ids,
        players,
        scoring_format
    )
    
    if player_performance:
        avg_points = sum(p.get('fantasy_points', 0) for p in player_performance.values()) / len(player_performance)
        print(f"   Average fantasy points per player: {avg_points:.2f}")
        print(f"   Top performer: {max(player_performance.items(), key=lambda x: x[1].get('fantasy_points', 0))[1].get('fantasy_points', 0):.2f} pts")
    else:
        print(f"⚠️  No performance data found - will use salary-based selection")
    
    # Check if we have enough players
    required = pool['starters_count'] + pool['rotation_count'] + pool['bench_count']
    if len(players) < required:
        print(f"❌ Not enough players ({len(players)} < {required})")
        print(f"   Need at least {required} players who:")
        print(f"   1. Played in games on {pool['slate_date']}")
        print(f"   2. Have entries in dfs_player_salaries for this pool")
        return 0
    
    # Distribute entries across users
    # If we need more entries than users, allow multiple entries per user (if pool allows)
    max_entries_per_user = pool.get('max_entries_per_user', 1)
    entries_per_user = min(max_entries_per_user, max(1, (num_entries + len(users) - 1) // len(users)))
    
    print(f"👤 Distributing {num_entries} entries across {len(users)} users")
    print(f"   Max entries per user (pool limit): {max_entries_per_user}")
    print(f"   Entries per user (calculated): {entries_per_user}")
    
    # Shuffle users for variety
    shuffled_users = users.copy()
    random.shuffle(shuffled_users)
    
    # Track used players per user to ensure variety
    user_lineups = {}  # user_id -> set of nba_player_ids used
    user_entry_counts = {}  # user_id -> count of entries created
    
    # Create entries
    created = 0
    user_index = 0
    entry_count = 0
    
    while created < num_entries and entry_count < num_entries * 2:  # Safety limit
        if user_index >= len(shuffled_users):
            user_index = 0  # Cycle through users if needed
        
        user = shuffled_users[user_index]
        user_id = user['id']
        
        # Check if this user has reached their entry limit
        current_user_entries = user_entry_counts.get(user_id, 0)
        if current_user_entries >= entries_per_user:
            user_index += 1
            entry_count += 1
            continue
        
        # Get players already used by this user (to ensure variety)
        used_players = user_lineups.get(user_id, set())
        
        # Create entry with unique lineup
        entry_id = create_entry_and_lineup(
            supabase, 
            pool_id, 
            user_id, 
            players, 
            pool,
            user_seed=f"{user_id}_{current_user_entries}",  # Unique seed per user+entry
            used_players=used_players,
            player_performance=player_performance
        )
        
        if entry_id:
            created += 1
            user_entry_counts[user_id] = current_user_entries + 1
            
            # Track which players this user used
            if user_id not in user_lineups:
                user_lineups[user_id] = set()
            
            # Get the lineup positions to track used players
            try:
                lineup_result = supabase.table('dfs_lineups') \
                    .select('id') \
                    .eq('entry_id', entry_id) \
                    .single() \
                    .execute()
                
                if lineup_result.data:
                    positions_result = supabase.table('dfs_lineup_positions') \
                        .select('nba_player_id') \
                        .eq('lineup_id', lineup_result.data['id']) \
                        .execute()
                    
                    if positions_result.data:
                        for pos in positions_result.data:
                            user_lineups[user_id].add(pos['nba_player_id'])
            except Exception as e:
                pass  # If we can't track, that's okay
            
            if created % 10 == 0:
                print(f"   Created {created}/{num_entries} entries ({len(set(user_entry_counts.keys()))} unique users)...")
        
        user_index += 1
        entry_count += 1
    
    print(f"✅ Created {created} entries for pool {pool_id}")
    
    # Score the pool to populate games_data, raw_fantasy_points, and weighted_points
    if created > 0:
        print(f"📊 Scoring pool to populate games_data and calculate points...")
        try:
            result = supabase.rpc('score_dfs_pool', {'p_pool_id': pool_id}).execute()
            if result.data:
                print(f"   ✅ Pool scored successfully")
                print(f"   Positions updated: {result.data.get('positions_updated', 0)}")
                print(f"   Entries updated: {result.data.get('entries_updated', 0)}")
                print(f"   Entries ranked: {result.data.get('entries_ranked', 0)}")
            else:
                print(f"   ⚠️  Scoring completed but no result returned")
        except Exception as e:
            print(f"   ⚠️  Error scoring pool: {e}")
            print(f"   You may need to run: SELECT * FROM score_dfs_pool('{pool_id}');")
    
    return created

def main():
    parser = argparse.ArgumentParser(description='Populate DFS pools with simulated entries')
    parser.add_argument('--pool-id', type=str, help='Populate a specific pool')
    parser.add_argument('--all-pools', action='store_true', help='Populate all pools')
    parser.add_argument('--date', type=str, help='Populate pools for a specific date (YYYY-MM-DD)')
    parser.add_argument('--entries-per-pool', type=int, default=10, help='Number of entries per pool (default: 10)')
    
    args = parser.parse_args()
    
    if not args.pool_id and not args.all_pools and not args.date:
        parser.print_help()
        sys.exit(1)
    
    supabase = setup_supabase()
    
    # Get users
    print("👥 Fetching users...")
    users = get_all_users(supabase)
    if not users:
        print("❌ No users found")
        sys.exit(1)
    
    print(f"✅ Found {len(users)} users")
    
    # Get pools
    if args.pool_id:
        pools = [{'id': args.pool_id}]
    elif args.date:
        result = supabase.table('dfs_pools') \
            .select('id') \
            .eq('slate_date', args.date) \
            .execute()
        pools = result.data or []
    else:  # all_pools
        result = supabase.table('dfs_pools') \
            .select('id') \
            .execute()
        pools = result.data or []
    
    if not pools:
        print("❌ No pools found")
        sys.exit(1)
    
    print(f"🏊 Found {len(pools)} pools to populate")
    
    # Populate each pool
    total_created = 0
    for pool in pools:
        created = populate_pool(supabase, pool['id'], args.entries_per_pool, users)
        total_created += created
    
    print(f"\n✅ Total entries created: {total_created}")

if __name__ == '__main__':
    main()

