#!/usr/bin/env python3
"""
Score DFS Lineup Positions

This script finds all lineup positions that don't have scores (games_data is NULL or empty)
and scores them using the score_dfs_pool function. Shows a progress bar for tracking.

Usage:
    python scripts/score_dfs_lineup_positions.py --all-pools
    python scripts/score_dfs_lineup_positions.py --pool-id <pool_id>
    python scripts/score_dfs_lineup_positions.py --date 2025-11-18
"""

import os
import sys
import argparse
from typing import List, Dict, Optional
from supabase import create_client, Client

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass

# Try to import tqdm for progress bar, fallback to simple progress if not available
try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    print("⚠️  tqdm not installed. Install with: pip install tqdm")
    print("   Falling back to simple progress output...")

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials in environment variables")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(url, key)

def get_pools_with_unscored_positions(supabase: Client, pool_id: str = None, date: str = None) -> List[Dict]:
    """Get pools that have lineup positions without scores"""
    try:
        # Get pools based on filters
        if pool_id:
            # Get specific pool
            result = supabase.table('dfs_pools').select('id, name, slate_date, status').eq('id', pool_id).single().execute()
            pools = [result.data] if result.data else []
        elif date:
            # Get pools for date
            result = supabase.table('dfs_pools') \
                .select('id, name, slate_date, status') \
                .eq('slate_date', date) \
                .execute()
            pools = result.data or []
        else:
            # Get all pools
            result = supabase.table('dfs_pools') \
                .select('id, name, slate_date, status') \
                .execute()
            pools = result.data or []
        
        # Filter to only pools with unscored positions and get counts
        pools_with_unscored = []
        for pool in pools:
            # Check for unscored positions (games_data is NULL or raw_fantasy_points is NULL)
            # We need to check both conditions separately since Supabase Python client doesn't support OR easily
            
            # Check for NULL games_data
            unscored_games_data = supabase.table('dfs_lineup_positions') \
                .select('id', count='exact') \
                .eq('pool_id', pool['id']) \
                .is_('games_data', 'null') \
                .execute()
            
            # Check for NULL raw_fantasy_points
            unscored_points = supabase.table('dfs_lineup_positions') \
                .select('id', count='exact') \
                .eq('pool_id', pool['id']) \
                .is_('raw_fantasy_points', 'null') \
                .execute()
            
            # Count unique positions that have either condition
            # Get all positions and check manually
            all_positions = supabase.table('dfs_lineup_positions') \
                .select('id, games_data, raw_fantasy_points') \
                .eq('pool_id', pool['id']) \
                .execute()
            
            if all_positions.data:
                unscored_count = sum(1 for pos in all_positions.data 
                                    if pos.get('games_data') is None or pos.get('raw_fantasy_points') is None)
                
                if unscored_count > 0:
                    pool['unscored_count'] = unscored_count
                    pool['total_positions'] = len(all_positions.data)
                    pools_with_unscored.append(pool)
        
        return pools_with_unscored
        
    except Exception as e:
        print(f"❌ Error getting pools with unscored positions: {e}")
        import traceback
        traceback.print_exc()
        return []

def score_pool(supabase: Client, pool_id: str, pool_name: str = None) -> Dict:
    """Score a single pool"""
    try:
        result = supabase.rpc('score_dfs_pool', {'p_pool_id': pool_id}).execute()
        if result.data:
            return {
                'success': True,
                'pool_id': pool_id,
                'pool_name': pool_name,
                'positions_updated': result.data.get('positions_updated', 0),
                'entries_updated': result.data.get('entries_updated', 0),
                'entries_ranked': result.data.get('entries_ranked', 0),
            }
        else:
            return {
                'success': False,
                'pool_id': pool_id,
                'pool_name': pool_name,
                'error': 'No result returned'
            }
    except Exception as e:
        return {
            'success': False,
            'pool_id': pool_id,
            'pool_name': pool_name,
            'error': str(e)
        }

def main():
    parser = argparse.ArgumentParser(description='Score DFS lineup positions that are missing scores')
    parser.add_argument('--pool-id', type=str, help='Score a specific pool')
    parser.add_argument('--all-pools', action='store_true', help='Score all pools with unscored positions')
    parser.add_argument('--date', type=str, help='Score pools for a specific date (YYYY-MM-DD)')
    
    args = parser.parse_args()
    
    if not args.pool_id and not args.all_pools and not args.date:
        parser.print_help()
        sys.exit(1)
    
    supabase = setup_supabase()
    
    print("🔍 Finding pools with unscored lineup positions...")
    pools = get_pools_with_unscored_positions(supabase, args.pool_id, args.date)
    
    if not pools:
        print("✅ No pools found with unscored positions!")
        sys.exit(0)
    
    print(f"📊 Found {len(pools)} pool(s) with unscored positions")
    print()
    
    # Show summary
    for pool in pools:
        unscored = pool.get('unscored_count', '?')
        total = pool.get('total_positions', '?')
        print(f"   {pool['name']} ({pool['slate_date']}): {unscored}/{total} positions need scoring")
    print()
    
    # Score pools with progress bar
    if HAS_TQDM:
        results = []
        for pool in tqdm(pools, desc="Scoring pools", unit="pool"):
            result = score_pool(supabase, pool['id'], pool.get('name'))
            results.append(result)
    else:
        # Simple progress without tqdm
        results = []
        total = len(pools)
        for i, pool in enumerate(pools, 1):
            print(f"[{i}/{total}] Scoring {pool.get('name', pool['id'])}...", end=' ', flush=True)
            result = score_pool(supabase, pool['id'], pool.get('name'))
            results.append(result)
            if result['success']:
                print(f"✅ ({result.get('positions_updated', 0)} positions, {result.get('entries_ranked', 0)} entries ranked)")
            else:
                print(f"❌ Error: {result.get('error', 'Unknown error')}")
    
    # Summary
    print()
    print("=" * 60)
    print("📊 SCORING SUMMARY")
    print("=" * 60)
    
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    total_positions = sum(r.get('positions_updated', 0) for r in successful)
    total_entries = sum(r.get('entries_ranked', 0) for r in successful)
    
    print(f"✅ Successfully scored: {len(successful)}/{len(results)} pools")
    print(f"   Positions updated: {total_positions}")
    print(f"   Entries ranked: {total_entries}")
    
    if failed:
        print(f"\n❌ Failed: {len(failed)} pools")
        for result in failed:
            print(f"   - {result.get('pool_name', result['pool_id'])}: {result.get('error', 'Unknown error')}")
    
    print()

if __name__ == '__main__':
    main()

