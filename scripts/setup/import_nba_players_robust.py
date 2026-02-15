#!/usr/bin/env python3
"""
NBA Players Import Script for HoopGeek - Robust Version
Imports all NBA players from the NBA API into Supabase database with better error handling.
Prints a list of players who were added and/or changed teams after the run.
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from supabase import create_client, Client
from typing import List, Dict, Any, Tuple, Optional

# Load .env from project root (works when run from repo root or scripts/setup/)
try:
    from dotenv import load_dotenv
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    _root = os.path.dirname(os.path.dirname(_script_dir))  # project root when script is in scripts/setup/
    load_dotenv(os.path.join(_root, '.env.local'))
    load_dotenv(os.path.join(_root, '.env'))
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except Exception:
    pass

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
USER_UID = "fd58dfb7-ad5d-43e2-b2c4-c254e2a29211"

# NBA API Configuration - Multiple endpoints to try
NBA_API_ENDPOINTS = [
    "https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=0",
    "https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2023-24&IsOnlyCurrentSeason=0",
    "https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2022-23&IsOnlyCurrentSeason=0"
]

NBA_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site'
}

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    print("🔧 Setting up Supabase client...")
    
    if not SUPABASE_URL:
        print("❌ Error: SUPABASE_URL (or VITE_SUPABASE_URL) must be set. Add to .env in project root or export.")
        sys.exit(1)
    
    if not SUPABASE_SERVICE_KEY:
        print("❌ Error: SUPABASE_SERVICE_ROLE_KEY must be set. Add to .env in project root or export.")
        sys.exit(1)
    
    print(f"   Using Supabase URL: {SUPABASE_URL}")
    print(f"   Service key: {'*' * 20}{SUPABASE_SERVICE_KEY[-10:] if SUPABASE_SERVICE_KEY else 'None'}")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Supabase client initialized")
    return supabase

def fetch_nba_players() -> List[Dict[str, Any]]:
    """Fetch all players from NBA API with multiple endpoint fallbacks"""
    print("🏀 Fetching players from NBA API...")
    
    max_retries = 2
    retry_delay = 3
    
    for endpoint_idx, endpoint in enumerate(NBA_API_ENDPOINTS):
        print(f"   Trying endpoint {endpoint_idx + 1}/{len(NBA_API_ENDPOINTS)}: {endpoint}")
        
        for attempt in range(max_retries):
            try:
                print(f"     Attempt {attempt + 1}/{max_retries}...")
                
                # Create session for connection pooling
                session = requests.Session()
                session.headers.update(NBA_HEADERS)
                
                response = session.get(endpoint, timeout=30)
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
                
                session.close()
                return players
                
            except requests.exceptions.RequestException as e:
                print(f"     ❌ Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    print(f"     ⏳ Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                else:
                    print(f"     ❌ All attempts failed for this endpoint")
            except Exception as e:
                print(f"     ❌ Error processing response: {e}")
                break
        
        # Try next endpoint
        if endpoint_idx < len(NBA_API_ENDPOINTS) - 1:
            print(f"   Moving to next endpoint...")
            time.sleep(1)
    
    print(f"❌ All endpoints failed. Using mock data instead...")
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
        },
        {
            'PERSON_ID': 203999,
            'DISPLAY_FIRST_LAST': 'Nikola Jokic',
            'POSITION': 'C',
            'TEAM_ID': 1610612743,
            'TEAM_NAME': 'Denver Nuggets',
            'TEAM_ABBREVIATION': 'DEN',
            'JERSEY': '15',
            'HEIGHT': '6-11',
            'WEIGHT': 284,
            'BIRTHDATE': '1995-02-19T00:00:00',
            'COUNTRY': 'Serbia',
            'SCHOOL': 'Mega Basket',
            'DRAFT_YEAR': 2014,
            'DRAFT_ROUND': 2,
            'DRAFT_NUMBER': 41,
            'FROM_YEAR': 2015,
            'TO_YEAR': None,
            'SEASON_EXP': 9
        },
        {
            'PERSON_ID': 201942,
            'DISPLAY_FIRST_LAST': 'Giannis Antetokounmpo',
            'POSITION': 'F',
            'TEAM_ID': 1610612749,
            'TEAM_NAME': 'Milwaukee Bucks',
            'TEAM_ABBREVIATION': 'MIL',
            'JERSEY': '34',
            'HEIGHT': '6-11',
            'WEIGHT': 242,
            'BIRTHDATE': '1994-12-06T00:00:00',
            'COUNTRY': 'Greece',
            'SCHOOL': 'Filathlitikos',
            'DRAFT_YEAR': 2013,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 15,
            'FROM_YEAR': 2013,
            'TO_YEAR': None,
            'SEASON_EXP': 11
        },
        {
            'PERSON_ID': 1629029,
            'DISPLAY_FIRST_LAST': 'Luka Doncic',
            'POSITION': 'G',
            'TEAM_ID': 1610612742,
            'TEAM_NAME': 'Dallas Mavericks',
            'TEAM_ABBREVIATION': 'DAL',
            'JERSEY': '77',
            'HEIGHT': '6-7',
            'WEIGHT': 230,
            'BIRTHDATE': '1999-02-28T00:00:00',
            'COUNTRY': 'Slovenia',
            'SCHOOL': 'Real Madrid',
            'DRAFT_YEAR': 2018,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 3,
            'FROM_YEAR': 2018,
            'TO_YEAR': None,
            'SEASON_EXP': 6
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
    to_year = player.get('TO_YEAR')
    if to_year is None:
        is_active = True
    else:
        try:
            to_year_int = int(to_year) if isinstance(to_year, str) else to_year
            is_active = to_year_int >= 2024
        except (ValueError, TypeError):
            is_active = True
    
    # Parse years pro
    season_exp = player.get('SEASON_EXP', 0)
    try:
        years_pro = int(season_exp) if isinstance(season_exp, str) else (season_exp or 0)
    except (ValueError, TypeError):
        years_pro = 0
    
    # Determine if player is rookie
    is_rookie = years_pro == 0
    
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

def _fetch_existing_players(supabase: Client, nba_player_ids: List[int]) -> Dict[int, Dict[str, Any]]:
    """Fetch existing nba_players by nba_player_id; returns dict nba_player_id -> { team_id, team_abbreviation, team_name }."""
    out = {}
    page_size = 500
    for start in range(0, len(nba_player_ids), page_size):
        chunk = nba_player_ids[start:start + page_size]
        r = supabase.table('nba_players').select('nba_player_id, team_id, team_abbreviation, team_name').in_('nba_player_id', chunk).execute()
        for row in (r.data or []):
            out[row['nba_player_id']] = {
                'team_id': row.get('team_id'),
                'team_abbreviation': row.get('team_abbreviation'),
                'team_name': row.get('team_name'),
            }
    return out


def import_players_to_database(
    supabase: Client, players: List[Dict[str, Any]]
) -> Tuple[Dict[str, int], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Import players to Supabase; returns (stats, added_list, changed_teams_list)."""
    print("💾 Importing players to database...")
    
    stats = {'total': len(players), 'imported': 0, 'updated': 0, 'errors': 0}
    added: List[Dict[str, Any]] = []
    changed_teams: List[Dict[str, Any]] = []
    
    # Pre-fetch existing players so we can detect adds and team changes
    nba_ids = []
    for p in players:
        try:
            nba_ids.append(int(p.get('PERSON_ID') or p.get('nba_player_id')))
        except (TypeError, ValueError):
            pass
    print(f"   Loading existing players for {len(nba_ids)} IDs...")
    existing = _fetch_existing_players(supabase, nba_ids)
    
    batch_size = 25
    total_batches = (len(players) + batch_size - 1) // batch_size
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(players))
        batch = players[start_idx:end_idx]
        
        print(f"📦 Processing batch {batch_num + 1}/{total_batches} ({len(batch)} players)")
        
        for i, player in enumerate(batch):
            try:
                player_data = parse_player_data(player)
                nba_id = player_data['nba_player_id']
                prev = existing.get(nba_id)
                is_new = prev is None
                new_team_id = player_data.get('team_id')
                new_team_abbr = (player_data.get('team_abbreviation') or '').strip() or None
                new_team_name = (player_data.get('team_name') or '').strip() or None
                
                result = supabase.rpc('upsert_nba_player', {
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
                    if is_new:
                        stats['imported'] += 1
                        added.append({
                            'name': player_data['name'],
                            'team': new_team_name or new_team_abbr or str(new_team_id) or '—',
                            'position': player_data.get('position') or '—',
                        })
                    else:
                        stats['updated'] += 1
                        old_id = prev.get('team_id')
                        old_abbr = (prev.get('team_abbreviation') or '').strip() or None
                        old_name = (prev.get('team_name') or '').strip() or None
                        team_changed = (
                            old_id != new_team_id
                            or (old_abbr or '') != (new_team_abbr or '')
                        )
                        if team_changed:
                            old_display = old_name or old_abbr or (str(old_id) if old_id else 'FA')
                            new_display = new_team_name or new_team_abbr or (str(new_team_id) if new_team_id else 'FA')
                            changed_teams.append({
                                'name': player_data['name'],
                                'old_team': old_display,
                                'new_team': new_display,
                            })
                else:
                    stats['errors'] += 1
                    print(f"⚠️  Error upserting player {player_data['name']}")
                
                if (i + 1) % 5 == 0:
                    print(f"   Processed {i + 1}/{len(batch)} players in this batch")
                
            except Exception as e:
                stats['errors'] += 1
                print(f"❌ Error processing player {player.get('DISPLAY_FIRST_LAST', 'Unknown')}: {e}")
        
        if batch_num < total_batches - 1:
            time.sleep(0.2)
    
    return stats, added, changed_teams

def main():
    """Main function"""
    print("🚀 Starting NBA Players Import Script (Robust Version)")
    print(f"👤 User UID: {USER_UID}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)
    
    try:
        # Setup
        supabase = setup_supabase()
        
        # Fetch players from NBA API
        players = fetch_nba_players()
        
        # Import to database
        stats, added, changed_teams = import_players_to_database(supabase, players)
        
        # Print final results
        print("-" * 60)
        print("🎉 Import completed successfully!")
        print(f"📊 Final Statistics:")
        print(f"   Total players processed: {stats['total']}")
        print(f"   New players imported: {stats['imported']}")
        print(f"   Existing players updated: {stats['updated']}")
        print(f"   Errors: {stats['errors']}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # List of players ADDED (new to DB)
        print("\n" + "=" * 60)
        print("📥 PLAYERS ADDED (new in database)")
        print("=" * 60)
        if not added:
            print("   (none)")
        else:
            for p in added:
                print(f"   • {p['name']}  |  {p['team']}  |  {p['position']}")
            print(f"   Total: {len(added)}")
        
        # List of players who CHANGED TEAMS
        print("\n" + "=" * 60)
        print("🔄 PLAYERS WHO CHANGED TEAMS")
        print("=" * 60)
        if not changed_teams:
            print("   (none)")
        else:
            for p in changed_teams:
                print(f"   • {p['name']}:  {p['old_team']}  →  {p['new_team']}")
            print(f"   Total: {len(changed_teams)}")
        
        # Verify import
        print("\n🔍 Verifying import...")
        result = supabase.table('nba_players').select('id', count='exact').execute()
        total_in_db = result.count
        print(f"✅ Total players in database: {total_in_db}")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
