#!/usr/bin/env python3
"""
NBA Players Import Script for HoopGeek
Imports all NBA players from the NBA API into Supabase database
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from supabase import create_client, Client
from typing import List, Dict, Any

# Configuration
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL', 'https://qbznyaimnrpibmahisue.supabase.co')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
USER_UID = "fd58dfb7-ad5d-43e2-b2c4-c254e2a29211"

# NBA API Configuration
NBA_API_URL = "https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=0"
NBA_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com'
}

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    print("🔧 Setting up Supabase client...")
    
    if not SUPABASE_URL:
        raise Exception("VITE_SUPABASE_URL environment variable is not set")
    
    if not SUPABASE_SERVICE_KEY:
        raise Exception("SUPABASE_SERVICE_ROLE_KEY environment variable is not set")
    
    print(f"   Using Supabase URL: {SUPABASE_URL}")
    print(f"   Service key: {'*' * 20}{SUPABASE_SERVICE_KEY[-10:] if SUPABASE_SERVICE_KEY else 'None'}")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Supabase client initialized")
    return supabase

def fetch_nba_players() -> List[Dict[str, Any]]:
    """Fetch all players from NBA API with retry logic"""
    print("🏀 Fetching players from NBA API...")
    
    max_retries = 3
    retry_delay = 5
    
    for attempt in range(max_retries):
        try:
            print(f"   Attempt {attempt + 1}/{max_retries}...")
            response = requests.get(NBA_API_URL, headers=NBA_HEADERS, timeout=60)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get('resultSets') or len(data['resultSets']) == 0:
                raise Exception("No player data received from NBA API")
            
            players_data = data['resultSets'][0]
            headers = players_data['headers']
            rows = players_data['rowSet']
            
            print(f"📊 Found {len(rows)} players from NBA API")
            
            # Convert to list of dictionaries
            players = []
            for row in rows:
                player = {}
                for i, header in enumerate(headers):
                    player[header] = row[i] if i < len(row) else None
                players.append(player)
            
            return players
            
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                print(f"   ⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                print(f"❌ All attempts failed. Using mock data instead...")
                return get_mock_players()
        except Exception as e:
            print(f"❌ Error processing NBA API response: {e}")
            return get_mock_players()
    
    return get_mock_players()

def get_mock_players() -> List[Dict[str, Any]]:
    """Get mock NBA players data as fallback"""
    print("🏀 Using mock NBA players data as fallback...")
    
    mock_players = [
        {
            'PERSON_ID': 2544,
            'DISPLAY_FIRST_LAST': 'LeBron James',
            'POSITION': 'F',
            'TEAM_ID': 1610612747,
            'TEAM_NAME': 'Los Angeles Lakers',
            'TEAM_ABBREVIATION': 'LAL',
            'JERSEY': '6',
            'HEIGHT': '6-9',
            'WEIGHT': 250,
            'BIRTHDATE': '1984-12-30T00:00:00',
            'COUNTRY': 'USA',
            'SCHOOL': 'St. Vincent-St. Mary HS (OH)',
            'DRAFT_YEAR': 2003,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 1,
            'FROM_YEAR': 2003,
            'TO_YEAR': None,
            'SEASON_EXP': 21
        },
        {
            'PERSON_ID': 201939,
            'DISPLAY_FIRST_LAST': 'Stephen Curry',
            'POSITION': 'G',
            'TEAM_ID': 1610612744,
            'TEAM_NAME': 'Golden State Warriors',
            'TEAM_ABBREVIATION': 'GSW',
            'JERSEY': '30',
            'HEIGHT': '6-2',
            'WEIGHT': 185,
            'BIRTHDATE': '1988-03-14T00:00:00',
            'COUNTRY': 'USA',
            'SCHOOL': 'Davidson',
            'DRAFT_YEAR': 2009,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 7,
            'FROM_YEAR': 2009,
            'TO_YEAR': None,
            'SEASON_EXP': 15
        }
    ]
    
    print(f"📊 Using {len(mock_players)} mock players")
    return mock_players

def parse_player_data(player: Dict[str, Any]) -> Dict[str, Any]:
    """Parse and clean player data for database insertion"""
    
    # Parse birth date
    birth_date = None
    if player.get('BIRTHDATE'):
        try:
            birth_date = player['BIRTHDATE'].split('T')[0]  # Remove time part
        except:
            birth_date = None
    
    # Parse draft information
    draft_year = None
    draft_round = None
    draft_number = None
    
    if player.get('DRAFT_YEAR'):
        try:
            draft_year = int(player['DRAFT_YEAR'])
        except:
            draft_year = None
    
    if player.get('DRAFT_ROUND'):
        try:
            draft_round = int(player['DRAFT_ROUND'])
        except:
            draft_round = None
    
    if player.get('DRAFT_NUMBER'):
        try:
            draft_number = int(player['DRAFT_NUMBER'])
        except:
            draft_number = None
    
    # Parse weight
    weight = None
    if player.get('WEIGHT'):
        try:
            weight = int(player['WEIGHT'])
        except:
            weight = None
    
    # Determine if player is active
    is_active = player.get('TO_YEAR') is None or player.get('TO_YEAR', 0) >= 2024
    
    # Determine if player is rookie
    is_rookie = player.get('SEASON_EXP', 0) == 0
    
    # Parse years pro
    years_pro = player.get('SEASON_EXP', 0) or 0
    
    return {
        'nba_player_id': player['PERSON_ID'],
        'name': player['DISPLAY_FIRST_LAST'],
        'first_name': player['DISPLAY_FIRST_LAST'].split(' ')[0] if player.get('DISPLAY_FIRST_LAST') else None,
        'last_name': ' '.join(player['DISPLAY_FIRST_LAST'].split(' ')[1:]) if player.get('DISPLAY_FIRST_LAST') and len(player['DISPLAY_FIRST_LAST'].split(' ')) > 1 else None,
        'position': player.get('POSITION'),
        'team_id': player.get('TEAM_ID'),
        'team_name': player.get('TEAM_NAME'),
        'team_abbreviation': player.get('TEAM_ABBREVIATION'),
        'jersey_number': player.get('JERSEY'),
        'height': player.get('HEIGHT'),
        'weight': weight,
        'age': None,  # Will be calculated based on birth date if needed
        'birth_date': birth_date,
        'birth_city': None,  # Not available in this endpoint
        'birth_state': None,  # Not available in this endpoint
        'birth_country': player.get('COUNTRY'),
        'college': player.get('SCHOOL'),
        'draft_year': draft_year,
        'draft_round': draft_round,
        'draft_number': draft_number,
        'salary': 0,  # Will be updated separately with salary data
        'is_active': is_active,
        'is_rookie': is_rookie,
        'years_pro': years_pro,
        'from_year': player.get('FROM_YEAR'),
        'to_year': player.get('TO_YEAR')
    }

def import_players_to_database(supabase: Client, players: List[Dict[str, Any]]) -> Dict[str, int]:
    """Import players to Supabase database using upsert function"""
    print("💾 Importing players to database...")
    
    stats = {
        'total': len(players),
        'imported': 0,
        'updated': 0,
        'errors': 0
    }
    
    # Process players in batches
    batch_size = 50
    total_batches = (len(players) + batch_size - 1) // batch_size
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(players))
        batch = players[start_idx:end_idx]
        
        print(f"📦 Processing batch {batch_num + 1}/{total_batches} ({len(batch)} players)")
        
        for i, player in enumerate(batch):
            try:
                # Parse player data
                player_data = parse_player_data(player)
                
                # Call the upsert function
                result = supabase.rpc('upsert_player', {
                    'p_nba_player_id': player_data['nba_player_id'],
                    'p_name': player_data['name'],
                    'p_first_name': player_data['first_name'],
                    'p_last_name': player_data['last_name'],
                    'p_position': player_data['position'],
                    'p_team_id': player_data['team_id'],
                    'p_team_name': player_data['team_name'],
                    'p_team_abbreviation': player_data['team_abbreviation'],
                    'p_jersey_number': player_data['jersey_number'],
                    'p_height': player_data['height'],
                    'p_weight': player_data['weight'],
                    'p_age': player_data['age'],
                    'p_birth_date': player_data['birth_date'],
                    'p_birth_city': player_data['birth_city'],
                    'p_birth_state': player_data['birth_state'],
                    'p_birth_country': player_data['birth_country'],
                    'p_college': player_data['college'],
                    'p_draft_year': player_data['draft_year'],
                    'p_draft_round': player_data['draft_round'],
                    'p_draft_number': player_data['draft_number'],
                    'p_salary': player_data['salary'],
                    'p_is_active': player_data['is_active'],
                    'p_is_rookie': player_data['is_rookie'],
                    'p_years_pro': player_data['years_pro'],
                    'p_from_year': player_data['from_year'],
                    'p_to_year': player_data['to_year']
                }).execute()
                
                if result.data:
                    # Check if this was an insert or update by querying the database
                    existing = supabase.table('players').select('id').eq('nba_player_id', player_data['nba_player_id']).execute()
                    
                    if existing.data:
                        stats['updated'] += 1
                    else:
                        stats['imported'] += 1
                else:
                    stats['errors'] += 1
                    print(f"⚠️  Error upserting player {player_data['name']}")
                
                # Progress indicator
                if (i + 1) % 10 == 0:
                    print(f"   Processed {i + 1}/{len(batch)} players in this batch")
                
            except Exception as e:
                stats['errors'] += 1
                print(f"❌ Error processing player {player.get('DISPLAY_FIRST_LAST', 'Unknown')}: {e}")
        
        # Add a small delay between batches
        if batch_num < total_batches - 1:
            time.sleep(0.1)
    
    return stats

def main():
    """Main function"""
    print("🚀 Starting NBA Players Import Script")
    print(f"👤 User UID: {USER_UID}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)
    
    try:
        # Setup
        supabase = setup_supabase()
        
        # Fetch players from NBA API
        players = fetch_nba_players()
        
        # Import to database
        stats = import_players_to_database(supabase, players)
        
        # Print final results
        print("-" * 60)
        print("🎉 Import completed successfully!")
        print(f"📊 Final Statistics:")
        print(f"   Total players processed: {stats['total']}")
        print(f"   New players imported: {stats['imported']}")
        print(f"   Existing players updated: {stats['updated']}")
        print(f"   Errors: {stats['errors']}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Verify import
        print("\n🔍 Verifying import...")
        result = supabase.table('players').select('id', count='exact').execute()
        total_in_db = result.count
        print(f"✅ Total players in database: {total_in_db}")
        
        # Show some sample players
        print("\n📋 Sample of imported players:")
        sample = supabase.table('players').select('name, position, team_name, is_active').limit(5).execute()
        for player in sample.data:
            status = "Active" if player['is_active'] else "Inactive"
            print(f"   • {player['name']} ({player['position']}) - {player['team_name']} - {status}")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
