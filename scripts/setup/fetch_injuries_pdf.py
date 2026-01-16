#!/usr/bin/env python3
"""
NBA Injury Report PDF Fetcher

Fetches and parses the official NBA injury report PDFs.
This is a more reliable alternative to the Edge Function for PDF parsing.

Usage:
    python3 scripts/setup/fetch_injuries_pdf.py [--date YYYY-MM-DD]
"""

import os
import sys
import requests
import re
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
import PyPDF2
from io import BytesIO

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
            print(f"📄 Trying to fetch: {url}")
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            if response.status_code == 200 and 'pdf' in response.headers.get('content-type', '').lower():
                print(f"✅ Found PDF at: {url}")
                return response.content
        except Exception as e:
            print(f"⚠️  Failed to fetch {url}: {e}")
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
            # Pattern: Word ending with comma, followed by another capitalized word, then status
            if i + 2 < len(lines):
                first_word = lines[i]
                second_word = lines[i + 1] if i + 1 < len(lines) else ''
                third_word = lines[i + 2] if i + 2 < len(lines) else ''
                
                # Pattern 1: Hyphenated last name: "LastPart-, LastPart, First Status"
                # Example: "Jackson-, Davis, Trayce Questionable"
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
                
                # Pattern 2: "Last Jr., First Status" (suffix after last name)
                # Example: "Pippen Jr., Scotty Out"
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
                    
                    # Check if there's a middle name or suffix before status
                    # Actually, status is already at i+2, so we're good
                    
                    # Now collect the reason starting after status
                    reason_parts = []
                    found_injury_illness = False
                    
                    while j < len(lines) and j < i + 25:  # Reason can be long
                        word = lines[j]
                        
                        # Start collecting after "Injury/Illness"
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
                        # Check if next word is a potential new player name
                        if j + 2 < len(lines):
                            next_word = lines[j]
                            next_next = lines[j + 1] if j + 1 < len(lines) else ''
                            next_next_next = lines[j + 2] if j + 2 < len(lines) else ''
                            
                            # Check if this looks like start of new player
                            # Pattern 1: "Last, First Status"
                            if (next_word.endswith(',') and 
                                re.match(r'^[A-Z][a-z]+', next_word) and
                                re.match(r'^[A-Z][a-z]+', next_next) and
                                next_next_next in ['Out', 'Questionable', 'Probable', 'Available']):
                                break
                            
                            # Pattern 2: "LastPart-, LastPart, First Status"
                            if (next_word.endswith('-') and 
                                j + 4 < len(lines) and
                                next_next.endswith(',') and
                                re.match(r'^[A-Z][a-z]+', lines[j+2]) and
                                lines[j+3] in ['Out', 'Questionable', 'Probable', 'Available']):
                                break
                            
                            # Pattern 3: "Last Jr., First Status"
                            if (re.match(r'^[A-Z][a-z]+$', next_word) and
                                j + 3 < len(lines) and
                                next_next.endswith(',') and next_next in ['Jr.,', 'Jr,', 'III,', 'II,', 'IV,', 'Sr.,', 'Sr,'] and
                                re.match(r'^[A-Z][a-z]+', lines[j+2]) and
                                lines[j+3] in ['Out', 'Questionable', 'Probable', 'Available']):
                                break
                            
                            # Check if this is a team name
                            potential_team = ' '.join(lines[j:min(j+4, len(lines))])
                            if any(team_name in potential_team for team_name in team_names):
                                break
                        
                        reason_parts.append(word)
                        j += 1
                        
                        # Stop at semicolon if it's the end of a major section
                        if word.endswith(';') and len(reason_parts) > 3:
                            # Might be end, but continue to get more details
                            pass
                    
                    reason = ' '.join(reason_parts).strip()
                    
                    # Build full player name (Last First format for database matching)
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
                
                # Also handle names without comma (First Last format)
                # Pattern: "First Last Status" where both are capitalized words
                elif (re.match(r'^[A-Z][a-z]+$', first_word) and 
                      re.match(r'^[A-Z][a-z]+', second_word) and
                      third_word in ['Out', 'Questionable', 'Probable', 'Available']):
                    # This might be a player name in "First Last" format
                    first_name = first_word
                    last_name = second_word
                    status = third_word
                    
                    # Check for suffix (Jr., III, etc.)
                    player_parts = [first_name, last_name]
                    j = i + 3
                    
                    # Check for suffix
                    if j < len(lines):
                        suffix_word = lines[j]
                        if suffix_word in ['Jr.', 'Jr', 'III', 'II', 'IV']:
                            player_parts.append(suffix_word)
                            j += 1
                            # Status should be at j now
                            if j < len(lines) and lines[j] in ['Out', 'Questionable', 'Probable', 'Available']:
                                status = lines[j]
                                j += 1
                    
                    # Collect reason
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
                        
                        # Stop if next looks like new player
                        if j + 2 < len(lines):
                            next_word = lines[j]
                            next_next = lines[j + 1] if j + 1 < len(lines) else ''
                            next_next_next = lines[j + 2] if j + 2 < len(lines) else ''
                            
                            if (next_word.endswith(',') and 
                                re.match(r'^[A-Z][a-z]+', next_word) and
                                re.match(r'^[A-Z][a-z]+', next_next) and
                                next_next_next in ['Out', 'Questionable', 'Probable', 'Available']):
                                break
                            
                            potential_team = ' '.join(lines[j:min(j+4, len(lines))])
                            if any(team_name in potential_team for team_name in team_names):
                                break
                        
                        reason_parts.append(word)
                        j += 1
                    
                    reason = ' '.join(reason_parts).strip()
                    player_name = ' '.join(player_parts)
                    
                    # Skip G League
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
        print(f"   ⚠️  Error finding player {player_name}: {e}")
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
        # Parse matchup: "LAL@GSW" -> away="LAL", home="GSW"
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
        
        # Query nba_games table
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
        print(f"   ⚠️  Error finding game for matchup {matchup}: {e}")
        return None


def store_injuries(supabase: Client, injuries: List[Dict], report_date: date, report_timestamp: datetime = None):
    """Store injuries in database and mark old injuries as not current"""
    if report_timestamp is None:
        report_timestamp = datetime.now()
    
    print(f"\n💾 Processing {len(injuries)} injuries from report dated {report_date}...")
    
    # Step 1: Mark all existing injuries as not current (they're from older reports)
    print("   📋 Marking old injuries as not current...")
    try:
        update_result = supabase.table('nba_injuries') \
            .update({'is_current': False}) \
            .eq('is_current', True) \
            .execute()
        print(f"   ✅ Marked existing injuries as not current")
    except Exception as e:
        print(f"   ⚠️  Warning: Could not mark old injuries as not current: {e}")
    
    # Step 2: Get list of players on current report (to track who we process)
    current_report_player_ids = set()
    
    # Step 3: Process each injury from the current report
    stored = 0
    updated = 0
    skipped = 0
    errors = 0
    
    for injury in injuries:
        try:
            team_abbreviation = normalize_team_name(injury['team'])
            nba_player_id = find_player_id(supabase, injury['player_name'], team_abbreviation)
            
            if not nba_player_id:
                print(f"   ⚠️  Could not find player: {injury['player_name']} ({team_abbreviation})")
                skipped += 1
                continue
            
            current_report_player_ids.add(nba_player_id)
            
            # Find game_id by matchup
            game_id = None
            if injury.get('matchup') and injury.get('game_date'):
                game_id = find_game_by_matchup(supabase, injury['matchup'], injury['game_date'])
                if game_id:
                    print(f"   🔗 Linked {injury['player_name']} to game {game_id}")
            
            # Parse injury type and description
            reason_parts = injury['reason'].split(';')
            injury_type = reason_parts[0].strip() if reason_parts else None
            injury_description = ';'.join(reason_parts[1:]).strip() if len(reason_parts) > 1 else injury['reason']
            
            # Extract injury type from description (remove "Injury/Illness - " prefix)
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
                'is_current': True,  # Mark as current since it's on this report
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
            
            # Check if player already has a current injury record
            existing = supabase.table('nba_injuries') \
                .select('id') \
                .eq('nba_player_id', nba_player_id) \
                .eq('is_current', True) \
                .limit(1) \
                .execute()
            
            if existing.data and len(existing.data) > 0:
                # Update existing record
                result = supabase.table('nba_injuries') \
                    .update(injury_data) \
                    .eq('id', existing.data[0]['id']) \
                    .execute()
                
                if result.data:
                    updated += 1
                    print(f"   ✅ Updated: {injury['player_name']} ({injury['status']})")
                else:
                    errors += 1
            else:
                # Insert new record
                result = supabase.table('nba_injuries').insert(injury_data).execute()
                
                if result.data:
                    stored += 1
                    print(f"   ✅ Stored: {injury['player_name']} ({injury['status']})")
                else:
                    errors += 1
                
        except Exception as e:
            print(f"   ❌ Error storing injury for {injury['player_name']}: {e}")
            errors += 1
    
    # Step 4: For players NOT on the current report, ensure their injuries are marked as not current
    # (This handles cases where a player was on a previous report but is now healthy)
    print(f"\n   🏥 Checking players not on current report...")
    try:
        # Get all players with current injuries
        all_current_injuries = supabase.table('nba_injuries') \
            .select('nba_player_id') \
            .eq('is_current', True) \
            .execute()
        
        if all_current_injuries.data:
            players_to_mark_healthy = [
                inj['nba_player_id'] 
                for inj in all_current_injuries.data 
                if inj['nba_player_id'] not in current_report_player_ids
            ]
            
            if players_to_mark_healthy:
                # Mark these players' injuries as not current (they're no longer on the report)
                for player_id in players_to_mark_healthy:
                    supabase.table('nba_injuries') \
                        .update({'is_current': False}) \
                        .eq('nba_player_id', player_id) \
                        .eq('is_current', True) \
                        .execute()
                
                print(f"   ✅ Marked {len(players_to_mark_healthy)} players as no longer on injury report")
    except Exception as e:
        print(f"   ⚠️  Warning: Could not check players not on report: {e}")
    
    print(f"\n📊 Storage Summary:")
    print(f"   Stored: {stored}")
    print(f"   Updated: {updated}")
    print(f"   Skipped: {skipped}")
    print(f"   Errors: {errors}")


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fetch NBA injury reports from PDF')
    parser.add_argument('--date', type=str, help='Date in YYYY-MM-DD format (default: today)')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
    else:
        target_date = date.today()
    
    print("🏀 NBA Injury Report PDF Fetcher\n")
    print("=" * 80)
    print(f"📅 Target date: {target_date}")
    
    # Setup
    supabase = setup_supabase()
    
    # Fetch PDF
    pdf_bytes = fetch_injury_pdf(target_date)
    
    if not pdf_bytes:
        print("\n❌ Could not fetch injury report PDF")
        print("💡 The PDF may not be published yet or URL pattern changed")
        sys.exit(1)
    
    print(f"✅ Fetched PDF ({len(pdf_bytes)} bytes)")
    
    # Parse PDF
    pdf_text = parse_pdf_text(pdf_bytes)
    print(f"✅ Parsed PDF text ({len(pdf_text)} characters)")
    
    # Extract injuries
    injuries = parse_injury_data(pdf_text, target_date)
    print(f"✅ Extracted {len(injuries)} injuries from PDF")
    
    if not injuries:
        print("\n⚠️  No injuries found in PDF")
        print("💡 PDF format may have changed")
        sys.exit(1)
    
    # Store injuries (with current timestamp for report_timestamp)
    report_timestamp = datetime.now()
    store_injuries(supabase, injuries, target_date, report_timestamp)
    
    print("\n✅ Injury fetch complete!")


if __name__ == '__main__':
    main()

