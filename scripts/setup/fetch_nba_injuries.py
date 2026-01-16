#!/usr/bin/env python3
"""
NBA Injury Data Fetcher

Fetches injury data from free sources:
1. BALDONTLIE API (free NBA API)
2. NBA.com scraping (fallback)

Usage:
    python3 scripts/setup/fetch_nba_injuries.py
"""

import os
import sys
import json
import requests
import time
from datetime import datetime, date
from typing import List, Dict, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# NBA API headers (for scraping)
NBA_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com'
}

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(supabase_url, supabase_key)


def fetch_balldontlie_injuries() -> List[Dict]:
    """
    Fetch injuries from BALDONTLIE free API
    API: https://www.balldontlie.io/
    """
    print("📡 Fetching injuries from BALDONTLIE API...")
    
    try:
        # BALDONTLIE doesn't have a direct injuries endpoint, but we can check player status
        # For now, we'll use a different approach - scrape from NBA.com
        # This is a placeholder for future BALDONTLIE integration
        print("   ⚠️  BALDONTLIE API doesn't have direct injury endpoint")
        return []
    except Exception as e:
        print(f"   ❌ Error fetching from BALDONTLIE: {e}")
        return []


def fetch_nba_com_injuries() -> List[Dict]:
    """
    Scrape injury data from NBA.com injury reports
    This is a fallback method when APIs aren't available
    """
    print("📡 Scraping injuries from NBA.com...")
    
    try:
        # NBA.com injury report endpoint (may vary)
        # Try the official NBA API first
        url = "https://stats.nba.com/stats/injuryreport"
        
        response = requests.get(url, headers=NBA_HEADERS, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Got response from NBA.com")
            return parse_nba_api_injuries(data)
        else:
            print(f"   ⚠️  NBA.com API returned status {response.status_code}")
            return []
            
    except Exception as e:
        print(f"   ❌ Error scraping NBA.com: {e}")
        return []


def parse_nba_api_injuries(data: Dict) -> List[Dict]:
    """Parse NBA API injury response"""
    injuries = []
    
    try:
        # NBA API structure may vary - adjust based on actual response
        if 'resultSets' in data and len(data['resultSets']) > 0:
            result_set = data['resultSets'][0]
            headers = result_set.get('headers', [])
            rows = result_set.get('rowSet', [])
            
            # Map headers to indices
            header_map = {header: idx for idx, header in enumerate(headers)}
            
            for row in rows:
                injury = {
                    'player_id': row[header_map.get('PLAYER_ID', 0)] if 'PLAYER_ID' in header_map else None,
                    'player_name': row[header_map.get('PLAYER_NAME', 1)] if 'PLAYER_NAME' in header_map else None,
                    'team_id': row[header_map.get('TEAM_ID', 2)] if 'TEAM_ID' in header_map else None,
                    'team_abbreviation': row[header_map.get('TEAM_ABBREVIATION', 3)] if 'TEAM_ABBREVIATION' in header_map else None,
                    'injury_type': row[header_map.get('INJURY_TYPE', 4)] if 'INJURY_TYPE' in header_map else None,
                    'injury_description': row[header_map.get('INJURY_DESCRIPTION', 5)] if 'INJURY_DESCRIPTION' in header_map else None,
                    'injury_status': row[header_map.get('INJURY_STATUS', 6)] if 'INJURY_STATUS' in header_map else 'Unknown',
                    'date_injured': row[header_map.get('DATE_INJURED', 7)] if 'DATE_INJURED' in header_map else None,
                }
                injuries.append(injury)
        
        print(f"   ✅ Parsed {len(injuries)} injuries")
        return injuries
        
    except Exception as e:
        print(f"   ❌ Error parsing NBA API response: {e}")
        return []


def extract_injuries_from_game_data(supabase: Client) -> List[Dict]:
    """
    Extract injury information from existing game data
    Looks for "DND - Injury/Illness", "DNP - Injury/Illness" comments in box scores
    """
    print("📊 Extracting injuries from existing game data...")
    
    try:
        # Query recent games to find injury indicators
        # This is a simplified approach - in practice, you'd parse the JSON files
        # For now, we'll focus on the API/scraping approach
        
        # Get players who have recent "DND" or "DNP" status
        # This would require parsing the game JSON files or querying a processed table
        print("   ℹ️  Game data extraction requires parsing JSON files")
        print("   💡 Consider running this after processing game data")
        return []
        
    except Exception as e:
        print(f"   ❌ Error extracting from game data: {e}")
        return []


def normalize_injury_status(status: str) -> str:
    """Normalize injury status to standard values"""
    status_lower = status.lower().strip()
    
    if 'out' in status_lower:
        return 'Out'
    elif 'questionable' in status_lower or 'q' == status_lower:
        return 'Questionable'
    elif 'probable' in status_lower or 'p' == status_lower:
        return 'Probable'
    elif 'day-to-day' in status_lower or 'dtd' in status_lower:
        return 'Day-to-Day'
    elif 'healthy' in status_lower or 'active' in status_lower:
        return 'Healthy'
    else:
        return 'Unknown'


def get_nba_player_id(supabase: Client, player_name: str, team_abbreviation: Optional[str] = None) -> Optional[int]:
    """Get NBA player ID from player name"""
    try:
        query = supabase.table('nba_players').select('nba_player_id').ilike('name', f'%{player_name}%')
        
        if team_abbreviation:
            query = query.eq('team_abbreviation', team_abbreviation)
        
        result = query.limit(1).execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]['nba_player_id']
        
        return None
    except Exception as e:
        print(f"   ⚠️  Error finding player {player_name}: {e}")
        return None


def store_injuries(supabase: Client, injuries: List[Dict]):
    """Store injuries in database"""
    print(f"\n💾 Storing {len(injuries)} injuries...")
    
    stored = 0
    skipped = 0
    errors = 0
    
    for injury in injuries:
        try:
            # Get NBA player ID
            nba_player_id = injury.get('player_id')
            if not nba_player_id:
                # Try to find by name
                player_name = injury.get('player_name')
                if player_name:
                    nba_player_id = get_nba_player_id(
                        supabase, 
                        player_name, 
                        injury.get('team_abbreviation')
                    )
            
            if not nba_player_id:
                print(f"   ⚠️  Could not find player: {injury.get('player_name', 'Unknown')}")
                skipped += 1
                continue
            
            # Prepare injury data
            injury_data = {
                'nba_player_id': nba_player_id,
                'injury_type': injury.get('injury_type'),
                'injury_description': injury.get('injury_description'),
                'injury_status': normalize_injury_status(injury.get('injury_status', 'Unknown')),
                'date_injured': injury.get('date_injured'),
                'expected_return_date': injury.get('expected_return_date'),
                'source': injury.get('source', 'nba_api'),
                'source_url': injury.get('source_url'),
                'raw_data': injury.get('raw_data', {})
            }
            
            # Insert or update (using unique constraint)
            result = supabase.table('nba_injuries').upsert(
                injury_data,
                on_conflict='nba_player_id,date_updated'
            ).execute()
            
            if result.data:
                stored += 1
                print(f"   ✅ Stored injury for player ID {nba_player_id}")
            else:
                errors += 1
                
        except Exception as e:
            print(f"   ❌ Error storing injury: {e}")
            errors += 1
    
    print(f"\n📊 Storage Summary:")
    print(f"   Stored: {stored}")
    print(f"   Skipped: {skipped}")
    print(f"   Errors: {errors}")


def main():
    """Main function"""
    print("🏀 NBA Injury Data Fetcher\n")
    print("=" * 80)
    
    # Setup
    supabase = setup_supabase()
    
    # Fetch injuries from multiple sources
    all_injuries = []
    
    # Try NBA.com API first
    nba_injuries = fetch_nba_com_injuries()
    if nba_injuries:
        all_injuries.extend(nba_injuries)
    
    # Try BALDONTLIE (placeholder)
    balldontlie_injuries = fetch_balldontlie_injuries()
    if balldontlie_injuries:
        all_injuries.extend(balldontlie_injuries)
    
    # Extract from game data (if available)
    game_injuries = extract_injuries_from_game_data(supabase)
    if game_injuries:
        all_injuries.extend(game_injuries)
    
    if not all_injuries:
        print("\n⚠️  No injuries found from any source")
        print("💡 You may need to:")
        print("   1. Check NBA.com API endpoint structure")
        print("   2. Implement web scraping for NBA.com injury reports")
        print("   3. Use a different free API source")
        return
    
    # Store injuries
    store_injuries(supabase, all_injuries)
    
    print("\n✅ Injury fetch complete!")


if __name__ == '__main__':
    main()

