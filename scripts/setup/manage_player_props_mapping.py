#!/usr/bin/env python3
"""
Helper script to manage player props name mappings
Allows you to manually map API player names to database players
"""

import os
import sys
from typing import Optional
from supabase import create_client, Client

try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except:
    pass

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        sys.exit(1)
    
    return create_client(url, key)

def list_unmatched_players(supabase: Client, limit: int = 20):
    """List player names from props that couldn't be matched"""
    print("\n📋 Unmatched Player Names from Props:")
    print("=" * 80)
    
    result = supabase.table('player_props') \
        .select('player_name, COUNT(*)') \
        .is_('player_id', 'null') \
        .limit(limit) \
        .execute()
    
    # Group by name and count
    from collections import Counter
    unmatched = Counter()
    
    # Get all unmatched props
    all_props = supabase.table('player_props') \
        .select('player_name') \
        .is_('player_id', 'null') \
        .execute()
    
    for prop in all_props.data:
        unmatched[prop['player_name']] += 1
    
    print(f"\nFound {len(unmatched)} unique unmatched player names:\n")
    for name, count in unmatched.most_common(limit):
        print(f"  • {name} ({count} props)")

def search_players(supabase: Client, search_term: str):
    """Search for players in database"""
    print(f"\n🔍 Searching for players matching '{search_term}':")
    print("=" * 80)
    
    result = supabase.table('nba_players') \
        .select('id, nba_player_id, name, team_abbreviation, position') \
        .ilike('name', f'%{search_term}%') \
        .eq('is_active', True) \
        .limit(10) \
        .execute()
    
    if not result.data:
        print("  No players found")
        return []
    
    print(f"\nFound {len(result.data)} players:\n")
    for i, player in enumerate(result.data, 1):
        print(f"  {i}. {player['name']} ({player.get('team_abbreviation', 'N/A')}) - {player.get('position', 'N/A')}")
        print(f"     ID: {player['id']}, NBA ID: {player.get('nba_player_id', 'N/A')}")
    
    return result.data

def add_mapping(supabase: Client, api_name: str, player_id: str, team_tricode: Optional[str] = None):
    """Add a manual mapping"""
    # Get player info
    player_result = supabase.table('nba_players') \
        .select('id, nba_player_id, name, team_abbreviation') \
        .eq('id', player_id) \
        .single() \
        .execute()
    
    if not player_result.data:
        print(f"❌ Player ID {player_id} not found")
        return False
    
    player = player_result.data
    
    mapping_data = {
        'api_player_name': api_name,
        'player_id': player['id'],
        'nba_player_id': player.get('nba_player_id'),
        'team_tricode': team_tricode or player.get('team_abbreviation'),
        'match_confidence': 1.0
    }
    
    try:
        result = supabase.table('player_props_name_mapping') \
            .upsert(mapping_data, on_conflict='api_player_name,team_tricode,league_id') \
            .execute()
        
        print(f"✅ Mapped '{api_name}' → {player['name']}")
        return True
    except Exception as e:
        print(f"❌ Error adding mapping: {e}")
        return False

def list_mappings(supabase: Client):
    """List all current mappings"""
    print("\n📋 Current Player Name Mappings:")
    print("=" * 80)
    
    result = supabase.table('player_props_name_mapping') \
        .select('api_player_name, player_id, team_tricode, match_confidence, nba_players!inner(name)') \
        .order('api_player_name') \
        .execute()
    
    if not result.data:
        print("  No mappings found")
        return
    
    print(f"\nFound {len(result.data)} mappings:\n")
    for mapping in result.data:
        player_name = mapping.get('nba_players', {}).get('name', 'Unknown')
        print(f"  • '{mapping['api_player_name']}' → {player_name}")
        if mapping.get('team_tricode'):
            print(f"    (Team: {mapping['team_tricode']})")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Manage player props name mappings')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # List unmatched
    subparsers.add_parser('list-unmatched', help='List unmatched player names')
    
    # Search players
    search_parser = subparsers.add_parser('search', help='Search for players')
    search_parser.add_argument('term', help='Search term')
    
    # Add mapping
    map_parser = subparsers.add_parser('map', help='Add a mapping')
    map_parser.add_argument('api_name', help='API player name')
    map_parser.add_argument('player_id', help='Database player UUID')
    map_parser.add_argument('--team', help='Team tricode (optional)')
    
    # List mappings
    subparsers.add_parser('list-mappings', help='List all mappings')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    supabase = setup_supabase()
    
    if args.command == 'list-unmatched':
        list_unmatched_players(supabase)
    elif args.command == 'search':
        search_players(supabase, args.term)
    elif args.command == 'map':
        add_mapping(supabase, args.api_name, args.player_id, args.team)
    elif args.command == 'list-mappings':
        list_mappings(supabase)

