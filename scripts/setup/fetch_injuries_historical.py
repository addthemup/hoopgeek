#!/usr/bin/env python3
"""
NBA Injury Report Historical Data Fetcher

Fetches and stores historical injury report data by going backwards from today.
This is a one-time script to build up injury history in the database.

Two modes:
  - Local PDF (default): fetches PDFs with requests + PyPDF2, parses with built-in parser.
  - Edge Function (--use-edge-function): calls the deployed fetch-injuries Supabase function
    with ?date=YYYY-MM-DD&historical=true for each date. Uses the same parser as production
    and avoids PDF format/parsing issues.

Usage:
    python3 scripts/setup/fetch_injuries_historical.py [--days 7] [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD]
    python3 scripts/setup/fetch_injuries_historical.py --start-date 2026-01-20 --end-date 2026-02-09 --use-edge-function

Examples:
    # Fetch last 7 days (local PDF)
    python3 scripts/setup/fetch_injuries_historical.py --days 7

    # Build season history using the fixed Edge Function parser (recommended after PDF format issues)
    python3 scripts/setup/fetch_injuries_historical.py --start-date 2026-01-20 --end-date 2026-02-09 --use-edge-function --delay 1.0

    # Fetch specific date range (local PDF)
    python3 scripts/setup/fetch_injuries_historical.py --start-date 2025-01-01 --end-date 2025-01-07
"""

import os
import sys
import requests
import re
import argparse
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
import PyPDF2
from io import BytesIO
import time

# Load environment variables
load_dotenv()

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(supabase_url, supabase_key)


def generate_pdf_urls(target_date: date) -> List[str]:
    """Generate possible PDF URLs for a date - prioritize 5PM"""
    date_str = target_date.strftime('%Y-%m-%d')
    base_url = 'https://ak-static.cms.nba.com/referee/injury'
    
    # Prioritize 5PM (05_00PM) as it's the most comprehensive report
    # Then try other times as fallback
    times_new_format = ['05_00PM', '08_00AM', '10_00AM', '12_00PM', '04_00PM', '06_00PM']
    times_old_format = ['05PM', '08AM', '04PM', '12PM', '10AM', '06PM']
    
    # Generate URLs - try new format first (5PM first), then old format
    urls = []
    for time in times_new_format:
        urls.append(f"{base_url}/Injury-Report_{date_str}_{time}.pdf")
    for time in times_old_format:
        urls.append(f"{base_url}/Injury-Report_{date_str}_{time}.pdf")
    
    return urls


def fetch_injury_pdf(target_date: date) -> Optional[bytes]:
    """Fetch injury PDF from NBA CDN"""
    urls = generate_pdf_urls(target_date)
    
    for url in urls:
        try:
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            if response.status_code == 200 and 'pdf' in response.headers.get('content-type', '').lower():
                return response.content
        except Exception as e:
            continue
    
    return None


def parse_pdf_text(pdf_bytes: bytes) -> str:
    """Extract text from PDF"""
    try:
        pdf_file = BytesIO(pdf_bytes)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        return text
    except Exception as e:
        print(f"❌ Error parsing PDF: {e}")
        raise


# Import the parsing function from the main script
# We'll copy the parse_injury_data function here for standalone use
def parse_injury_data(text: str, report_date: date) -> List[Dict]:
    """Parse injury data from PDF text - handles word-by-word line splitting"""
    injuries = []
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    current_game_date = None
    current_game_time = None
    current_matchup = None
    current_team = None
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Detect game date (MM/DD/YYYY)
        date_match = re.match(r'^(\d{2}/\d{2}/\d{4})$', line)
        if date_match:
            current_game_date = date_match.group(1)
            i += 1
            continue
        
        # Detect game time (HH:MM)
        if re.match(r'^\d{1,2}:\d{2}$', line) and i + 1 < len(lines) and '(ET)' in lines[i + 1]:
            current_game_time = line
            i += 2
            continue
        
        # Detect matchup (TEAM@TEAM)
        matchup_match = re.match(r'^([A-Z]{3}@[A-Z]{3})$', line)
        if matchup_match:
            current_matchup = matchup_match.group(1)
            i += 1
            continue
        
        # Detect team names (may be split across lines)
        team_names = [
            'Washington Wizards', 'Philadelphia 76ers', 'Portland Trail Blazers',
            'Toronto Raptors', 'Memphis Grizzlies', 'San Antonio Spurs',
            'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
            'Boston Celtics', 'Oklahoma City Thunder', 'Golden State Warriors',
            'Denver Nuggets', 'Indiana Pacers', 'Cleveland Cavaliers',
            'Orlando Magic', 'Charlotte Hornets', 'LA Clippers', 'Los Angeles Clippers',
            'Atlanta Hawks', 'Brooklyn Nets', 'Chicago Bulls', 'Detroit Pistons',
            'Milwaukee Bucks', 'Sacramento Kings', 'Houston Rockets',
            'Miami Heat', 'Dallas Mavericks', 'Los Angeles Lakers',
            'Phoenix Suns', 'Utah Jazz'
        ]
        
        # Check if current line + next few lines form a team name
        for team_name in team_names:
            team_words = team_name.split()
            if i + len(team_words) <= len(lines):
                potential_team = ' '.join(lines[i:i+len(team_words)])
                if potential_team == team_name:
                    current_team = team_name
                    i += len(team_words)
                    break
        
        if current_team:
            # Skip "NOT YET SUBMITTED"
            if i < len(lines) and lines[i] == 'NOT' and i + 2 < len(lines) and lines[i+1] == 'YET' and lines[i+2] == 'SUBMITTED':
                i += 3
                continue
            
            # Look for player name pattern: "Last, First" format
            if i + 2 < len(lines):
                first_word = lines[i]
                second_word = lines[i + 1] if i + 1 < len(lines) else ''
                third_word = lines[i + 2] if i + 2 < len(lines) else ''
                
                # Pattern 1: Hyphenated last name
                if (i + 4 < len(lines) and 
                    first_word.endswith('-') and 
                    second_word.endswith(',') and
                    re.match(r'^[A-Z][a-z]+', third_word) and
                    lines[i + 3] in ['Out', 'Questionable', 'Probable', 'Available']):
                    last_name_part1 = first_word.rstrip('-')
                    last_name_part2 = second_word.rstrip(',')
                    first_name = third_word
                    status = lines[i + 3]
                    last_name = f"{last_name_part1}-{last_name_part2}"
                    player_parts = [last_name, first_name]
                    j = i + 4
                
                # Pattern 2: "Last Jr., First Status"
                elif (i + 3 < len(lines) and
                      re.match(r'^[A-Z][a-z]+$', first_word) and
                      second_word.endswith(',') and second_word in ['Jr.,', 'Jr,', 'III,', 'II,', 'IV,', 'Sr.,', 'Sr,'] and
                      re.match(r'^[A-Z][a-z]+', third_word) and
                      lines[i + 3] in ['Out', 'Questionable', 'Probable', 'Available']):
                    last_name = first_word
                    suffix = second_word.rstrip(',')
                    first_name = third_word
                    status = lines[i + 3]
                    last_name = f"{last_name} {suffix}"
                    player_parts = [last_name, first_name]
                    j = i + 4
                
                # Pattern 3: Standard "Last, First Status"
                elif (first_word.endswith(',') and 
                      re.match(r'^[A-Z][a-z]+', first_word) and
                      re.match(r'^[A-Z][a-z]+', second_word) and 
                      not second_word.endswith(',') and
                      third_word in ['Out', 'Questionable', 'Probable', 'Available']):
                    last_name = first_word.rstrip(',')
                    first_name = second_word
                    status = third_word
                    player_parts = [last_name, first_name]
                    j = i + 3
                
                else:
                    j = None
                
                if j is not None:
                    # Collect the reason starting after status
                    reason_parts = []
                    found_injury_illness = False
                    
                    while j < len(lines) and j < i + 25:
                        word = lines[j]
                        
                        if 'Injury/Illness' in word or (word == 'Injury' and j + 1 < len(lines) and lines[j+1] == 'Illness'):
                            found_injury_illness = True
                            if word == 'Injury' and j + 1 < len(lines) and lines[j+1] == 'Illness':
                                reason_parts.append('Injury/Illness')
                                j += 2
                                continue
                            else:
                                reason_parts.append(word)
                                j += 1
                                continue
                        
                        if not found_injury_illness:
                            j += 1
                            continue
                        
                        # Stop conditions for reason collection
                        if j + 2 < len(lines):
                            next_word = lines[j]
                            next_next = lines[j + 1] if j + 1 < len(lines) else ''
                            next_next_next = lines[j + 2] if j + 2 < len(lines) else ''
                            
                            # Check if this looks like start of new player
                            if (next_word.endswith(',') and 
                                re.match(r'^[A-Z][a-z]+', next_word) and
                                re.match(r'^[A-Z][a-z]+', next_next) and
                                next_next_next in ['Out', 'Questionable', 'Probable', 'Available']):
                                break
                            
                            if (next_word.endswith('-') and 
                                j + 4 < len(lines) and
                                next_next.endswith(',') and
                                re.match(r'^[A-Z][a-z]+', lines[j+2]) and
                                lines[j+3] in ['Out', 'Questionable', 'Probable', 'Available']):
                                break
                            
                            if (re.match(r'^[A-Z][a-z]+$', next_word) and
                                j + 3 < len(lines) and
                                next_next.endswith(',') and next_next in ['Jr.,', 'Jr,', 'III,', 'II,', 'IV,', 'Sr.,', 'Sr,'] and
                                re.match(r'^[A-Z][a-z]+', lines[j+2]) and
                                lines[j+3] in ['Out', 'Questionable', 'Probable', 'Available']):
                                break
                            
                            potential_team = ' '.join(lines[j:min(j+4, len(lines))])
                            if any(team_name in potential_team for team_name in team_names):
                                break
                        
                        reason_parts.append(word)
                        j += 1
                    
                    reason = ' '.join(reason_parts).strip()
                    player_name = f"{first_name} {last_name}"
                    
                    # Skip G League assignments
                    if 'G League' in reason or 'Two-Way' in reason or 'On Assignment' in reason:
                        i = j
                        continue
                    
                    if player_name and len(player_name) > 2:
                        injuries.append({
                            'player_name': player_name,
                            'team': current_team,
                            'status': status,
                            'reason': reason,
                            'game_date': current_game_date,
                            'game_time': current_game_time,
                            'matchup': current_matchup,
                        })
                    
                    i = j
                    continue
        
        i += 1
    
    return injuries


def normalize_team_name(team_name: str) -> str:
    """Convert team name to abbreviation"""
    team_map = {
        'Washington Wizards': 'WAS',
        'Philadelphia 76ers': 'PHI',
        'Portland Trail Blazers': 'POR',
        'Toronto Raptors': 'TOR',
        'Memphis Grizzlies': 'MEM',
        'San Antonio Spurs': 'SAS',
        'Minnesota Timberwolves': 'MIN',
        'New Orleans Pelicans': 'NOP',
        'New York Knicks': 'NYK',
        'Boston Celtics': 'BOS',
        'Oklahoma City Thunder': 'OKC',
        'Golden State Warriors': 'GSW',
        'Denver Nuggets': 'DEN',
        'Indiana Pacers': 'IND',
        'Cleveland Cavaliers': 'CLE',
        'Orlando Magic': 'ORL',
        'Charlotte Hornets': 'CHA',
        'LA Clippers': 'LAC',
        'Los Angeles Clippers': 'LAC',
        'Atlanta Hawks': 'ATL',
        'Brooklyn Nets': 'BKN',
        'Chicago Bulls': 'CHI',
        'Detroit Pistons': 'DET',
        'Milwaukee Bucks': 'MIL',
        'Sacramento Kings': 'SAC',
        'Houston Rockets': 'HOU',
        'Miami Heat': 'MIA',
        'Dallas Mavericks': 'DAL',
        'Los Angeles Lakers': 'LAL',
        'Phoenix Suns': 'PHX',
        'Utah Jazz': 'UTA',
    }
    return team_map.get(team_name, team_name)


def find_player_id(supabase: Client, player_name: str, team_abbreviation: str) -> Optional[int]:
    """Find NBA player ID from name and team"""
    try:
        # Try exact match first
        result = supabase.table('nba_players')\
            .select('nba_player_id, name')\
            .ilike('name', f'%{player_name}%')\
            .eq('team_abbreviation', team_abbreviation)\
            .eq('is_active', True)\
            .limit(5)\
            .execute()
        
        if result.data and len(result.data) > 0:
            if len(result.data) == 1:
                return result.data[0]['nba_player_id']
            
            # Try to find best match
            normalized_search = player_name.lower().replace(',', '').strip()
            for player in result.data:
                normalized_name = player['name'].lower().replace(',', '').strip()
                if normalized_name == normalized_search or normalized_search in normalized_name:
                    return player['nba_player_id']
            
            return result.data[0]['nba_player_id']
        
        # Try without team filter
        result2 = supabase.table('nba_players')\
            .select('nba_player_id')\
            .ilike('name', f'%{player_name}%')\
            .eq('is_active', True)\
            .limit(1)\
            .execute()
        
        if result2.data and len(result2.data) > 0:
            return result2.data[0]['nba_player_id']
        
        return None
    except Exception as e:
        return None


def normalize_injury_status(status: str) -> str:
    """Normalize injury status"""
    status_lower = status.lower().strip()
    if status_lower == 'out':
        return 'Out'
    elif status_lower == 'questionable':
        return 'Questionable'
    elif status_lower == 'probable':
        return 'Probable'
    elif status_lower == 'available':
        return 'Healthy'
    return 'Unknown'


def find_game_by_matchup(supabase: Client, matchup: str, game_date: str) -> Optional[str]:
    """Find game_id by matchup (e.g., 'LAL@GSW') and date"""
    if not matchup or not game_date:
        return None
    
    try:
        if '@' not in matchup:
            return None
        
        away_tricode, home_tricode = matchup.split('@')
        away_tricode = away_tricode.strip()
        home_tricode = home_tricode.strip()
        
        # Convert date format if needed (MM/DD/YYYY -> YYYY-MM-DD)
        if '/' in game_date:
            date_parts = game_date.split('/')
            if len(date_parts) == 3:
                month, day, year = date_parts
                game_date = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        
        result = supabase.table('nba_games') \
            .select('game_id') \
            .eq('game_date', game_date) \
            .eq('away_team_tricode', away_tricode) \
            .eq('home_team_tricode', home_tricode) \
            .limit(1) \
            .execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]['game_id']
        
        return None
    except Exception as e:
        return None


def delete_existing_injuries_for_date_range(supabase: Client, start_date: date, end_date: date):
    """Delete existing injury records for a date range (for overwrite mode)"""
    print(f"\n🗑️  Deleting existing injuries from {start_date} to {end_date}...")
    
    try:
        # Delete all injuries in the date range (historical data only, not current)
        result = supabase.table('nba_injuries') \
            .delete() \
            .gte('date_updated', start_date.isoformat()) \
            .lte('date_updated', f"{end_date.isoformat()}T23:59:59Z") \
            .eq('source', 'nba_official_pdf') \
            .execute()
        
        print(f"✅ Deleted existing injuries for date range")
        return True
    except Exception as e:
        print(f"⚠️  Warning: Could not delete existing injuries: {e}")
        return False


def store_injuries_for_date(supabase: Client, injuries: List[Dict], report_date: date, report_timestamp: datetime = None, overwrite: bool = True):
    """Store injuries for a specific date (historical mode - doesn't mark others as not current)"""
    if report_timestamp is None:
        report_timestamp = datetime.now()
    
    print(f"\n💾 Processing {len(injuries)} injuries from report dated {report_date}...")
    
    # If overwrite mode, delete existing records for this date first
    if overwrite:
        try:
            supabase.table('nba_injuries') \
                .delete() \
                .eq('date_updated', report_date.isoformat()) \
                .eq('source', 'nba_official_pdf') \
                .execute()
        except Exception as e:
            print(f"   ⚠️  Warning: Could not delete existing records for {report_date}: {e}")
    
    # For historical data, we don't want to mark other injuries as not current
    # We just insert/update injuries for this specific date
    
    stored = 0
    skipped = 0
    errors = 0
    
    for injury in injuries:
        try:
            team_abbreviation = normalize_team_name(injury['team'])
            nba_player_id = find_player_id(supabase, injury['player_name'], team_abbreviation)
            
            if not nba_player_id:
                skipped += 1
                continue
            
            # Find game_id by matchup
            game_id = None
            if injury.get('matchup') and injury.get('game_date'):
                game_id = find_game_by_matchup(supabase, injury['matchup'], injury['game_date'])
            
            # Parse injury type and description
            reason_parts = injury['reason'].split(';')
            injury_type = reason_parts[0].strip() if reason_parts else None
            injury_description = ';'.join(reason_parts[1:]).strip() if len(reason_parts) > 1 else injury['reason']
            
            # Extract injury type from description
            if injury_type and 'Injury/Illness' in injury_type:
                injury_type = injury_type.replace('Injury/Illness -', '').replace('Injury/Illness', '').strip()
            
            injury_data = {
                'nba_player_id': nba_player_id,
                'game_id': game_id,
                'injury_type': injury_type,
                'injury_description': injury_description or injury['reason'],
                'injury_status': normalize_injury_status(injury['status']),
                'date_updated': report_date.isoformat(),
                'report_timestamp': report_timestamp.isoformat(),
                'is_current': False,  # Historical data is not current
                'source': 'nba_official_pdf',
                'source_url': f"https://ak-static.cms.nba.com/referee/injury/Injury-Report_{report_date.strftime('%Y-%m-%d')}_*.pdf",
                'raw_data': {
                    'player_name': injury['player_name'],
                    'team': injury['team'],
                    'game_date': injury['game_date'],
                    'game_time': injury['game_time'],
                    'matchup': injury['matchup'],
                }
            }
            
            # Always insert new record (we deleted existing ones if overwrite mode)
            # This ensures we have a complete history with each day's report
            result = supabase.table('nba_injuries').insert(injury_data).execute()
            
            if result.data:
                stored += 1
            else:
                errors += 1
                
        except Exception as e:
            print(f"   ❌ Error storing injury for {injury['player_name']}: {e}")
            errors += 1
    
    return {
        'stored': stored,
        'skipped': skipped,
        'errors': errors
    }


def fetch_injuries_via_edge_function(target_date: date, func_url: str, auth_key: str) -> Dict:
    """Call the deployed fetch-injuries Edge Function for one date (historical mode)."""
    import urllib.request
    url = f"{func_url}?date={target_date.isoformat()}&historical=true"
    req = urllib.request.Request(url, method='POST', headers={
        'Authorization': f'Bearer {auth_key}',
        'Content-Type': 'application/json',
    }, data=b'{}')
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            import json
            body = json.loads(resp.read().decode())
            return {
                'date': target_date.isoformat(),
                'success': body.get('success', False),
                'reason': body.get('error') if not body.get('success') else None,
                'injuries_found': body.get('injuries_found', 0),
                'stored': body.get('stored', 0),
                'updated': body.get('updated', 0),
                'skipped': body.get('skipped', 0),
                'errors': body.get('errors', 0),
            }
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode()
            import json
            data = json.loads(err_body)
            return {
                'date': target_date.isoformat(),
                'success': False,
                'reason': data.get('error', err_body[:200]),
                'stored': 0, 'skipped': 0, 'errors': 0,
            }
        except Exception:
            return {
                'date': target_date.isoformat(),
                'success': False,
                'reason': str(e),
                'stored': 0, 'skipped': 0, 'errors': 0,
            }
    except Exception as e:
        return {
            'date': target_date.isoformat(),
            'success': False,
            'reason': str(e),
            'stored': 0, 'skipped': 0, 'errors': 0,
        }


def fetch_injuries_for_date(supabase: Client, target_date: date, overwrite: bool = True) -> Dict:
    """Fetch and store injuries for a single date (local PDF + parse)."""
    print(f"\n{'='*80}")
    print(f"📅 Processing date: {target_date}")
    print(f"{'='*80}")
    
    pdf_bytes = fetch_injury_pdf(target_date)
    
    if not pdf_bytes:
        print(f"⚠️  No PDF found for {target_date}")
        return {
            'date': target_date.isoformat(),
            'success': False,
            'reason': 'PDF not found',
            'stored': 0,
            'skipped': 0,
            'errors': 0
        }
    
    print(f"✅ Fetched PDF ({len(pdf_bytes)} bytes)")
    
    # Parse PDF
    try:
        pdf_text = parse_pdf_text(pdf_bytes)
        print(f"✅ Parsed PDF text ({len(pdf_text)} characters)")
    except Exception as e:
        print(f"❌ Error parsing PDF: {e}")
        return {
            'date': target_date.isoformat(),
            'success': False,
            'reason': f'PDF parsing error: {e}',
            'stored': 0,
            'skipped': 0,
            'errors': 0
        }
    
    # Extract injuries
    injuries = parse_injury_data(pdf_text, target_date)
    print(f"✅ Extracted {len(injuries)} injuries from PDF")
    
    if not injuries:
        print(f"⚠️  No injuries found in PDF for {target_date}")
        return {
            'date': target_date.isoformat(),
            'success': False,
            'reason': 'No injuries found',
            'stored': 0,
            'skipped': 0,
            'errors': 0
        }
    
    # Store injuries
    report_timestamp = datetime.now()
    result = store_injuries_for_date(supabase, injuries, target_date, report_timestamp, overwrite=overwrite)
    
    print(f"\n📊 Summary for {target_date}:")
    print(f"   Stored: {result['stored']}")
    print(f"   Skipped: {result['skipped']}")
    print(f"   Errors: {result['errors']}")
    
    return {
        'date': target_date.isoformat(),
        'success': True,
        'injuries_found': len(injuries),
        'stored': result.get('stored', 0),
        'skipped': result.get('skipped', 0),
        'errors': result.get('errors', 0)
    }


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Fetch historical NBA injury reports')
    parser.add_argument('--days', type=int, help='Number of days to go back from today (default: 7)')
    parser.add_argument('--start-date', type=str, help='Start date in YYYY-MM-DD format')
    parser.add_argument('--end-date', type=str, help='End date in YYYY-MM-DD format')
    parser.add_argument('--delay', type=float, default=1.0, help='Delay between requests in seconds (default: 1.0)')
    parser.add_argument('--use-edge-function', action='store_true', help='Call fetch-injuries Supabase function per date (historical=true). Uses fixed parser; no local PDF parse.')
    args = parser.parse_args()
    
    # Determine date range
    dates_to_process = []
    
    if args.start_date and args.end_date:
        start = datetime.strptime(args.start_date, '%Y-%m-%d').date()
        end = datetime.strptime(args.end_date, '%Y-%m-%d').date()
        current = start
        while current <= end:
            dates_to_process.append(current)
            current += timedelta(days=1)
    elif args.start_date and args.days:
        start = datetime.strptime(args.start_date, '%Y-%m-%d').date()
        for i in range(args.days):
            dates_to_process.append(start - timedelta(days=i))
    elif args.days:
        today = date.today()
        for i in range(args.days):
            dates_to_process.append(today - timedelta(days=i))
    else:
        today = date.today()
        for i in range(7):
            dates_to_process.append(today - timedelta(days=i))
    
    dates_to_process.sort()
    
    use_edge = getattr(args, 'use_edge_function', False)
    print("🏀 NBA Injury Report Historical Data Fetcher\n")
    print("=" * 80)
    print(f"📅 Processing {len(dates_to_process)} dates")
    print(f"   From: {dates_to_process[0]}")
    print(f"   To: {dates_to_process[-1]}")
    print(f"   Mode: {'Edge Function (historical=true)' if use_edge else 'Local PDF + parse'}")
    print(f"   Delay: {args.delay}s")
    print("=" * 80)
    
    if use_edge:
        supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
        auth_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        if not supabase_url or not auth_key:
            print("❌ For --use-edge-function set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
            sys.exit(1)
        func_url = f"{supabase_url.rstrip('/')}/functions/v1/fetch-injuries"
    else:
        supabase = setup_supabase()
        if dates_to_process:
            delete_existing_injuries_for_date_range(supabase, dates_to_process[0], dates_to_process[-1])
    
    results = []
    successful = 0
    failed = 0
    
    for i, target_date in enumerate(dates_to_process, 1):
        print(f"\n[{i}/{len(dates_to_process)}] Processing {target_date}...")
        
        if use_edge:
            result = fetch_injuries_via_edge_function(target_date, func_url, auth_key)
            if result.get('injuries_found') is not None:
                print(f"   Injuries: {result.get('injuries_found')} found, {result.get('stored', 0)} stored, {result.get('skipped', 0)} skipped")
        else:
            result = fetch_injuries_for_date(supabase, target_date, overwrite=True)
        
        results.append(result)
        if result['success']:
            successful += 1
        else:
            failed += 1
            print(f"   ❌ {result.get('reason', 'Unknown')}")
        
        if i < len(dates_to_process):
            time.sleep(args.delay)
    
    # Final summary
    print("\n" + "=" * 80)
    print("📊 FINAL SUMMARY")
    print("=" * 80)
    print(f"Total dates processed: {len(dates_to_process)}")
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"\nTotal injuries stored: {sum(r.get('stored', 0) for r in results)}")
    print(f"Total skipped: {sum(r.get('skipped', 0) for r in results)}")
    print(f"Total errors: {sum(r.get('errors', 0) for r in results)}")
    
    # Show failed dates
    failed_dates = [r['date'] for r in results if not r['success']]
    if failed_dates:
        print(f"\n⚠️  Failed dates ({len(failed_dates)}):")
        for date_str in failed_dates[:10]:  # Show first 10
            result = next(r for r in results if r['date'] == date_str)
            print(f"   - {date_str}: {result.get('reason', 'Unknown error')}")
        if len(failed_dates) > 10:
            print(f"   ... and {len(failed_dates) - 10} more")
    
    print("\n✅ Historical injury data fetch complete!")


if __name__ == '__main__':
    main()
