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
import json
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from supabase import create_client, Client
from dotenv import load_dotenv
import PyPDF2
from io import BytesIO

# Load environment variables
load_dotenv()

def setup_supabase(allow_missing: bool = False) -> Optional[Client]:
    """Initialize Supabase client"""
    supabase_url = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    
    if not supabase_url or not supabase_key:
        if allow_missing:
            return None
        print("❌ Missing Supabase credentials")
        print("Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(supabase_url, supabase_key)


def generate_pdf_urls(target_date: date) -> List[str]:
    """Generate possible PDF URLs for a date - prioritize 5PM"""
    date_str = target_date.strftime('%Y-%m-%d')
    base_url = 'https://ak-static.cms.nba.com/referee/injury'
    
    # Prioritize the latest likely report first, then older snapshots.
    times_new_format = ['06_00PM', '05_00PM', '04_00PM', '12_00PM', '10_00AM', '08_00AM']
    times_old_format = ['06PM', '05PM', '04PM', '12PM', '10AM', '08AM']
    
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
    name_word_re = re.compile(r"^[A-Z][A-Za-z'’`.-]*$")

    def is_name_word(token: str) -> bool:
        return bool(name_word_re.match(token))

    def clean_reason(value: str) -> str:
        value = re.sub(
            r'Injury Report:\s*\d{2}/\d{2}/\d{2}\s+\d{2}:\d{2}\s+[AP]M\s+Page\s+\d+\s+of\s+\d+',
            '',
            value,
        )
        return re.sub(r'\s+', ' ', value).strip()

    def looks_like_player_start(idx: int) -> bool:
        statuses = {'Out', 'Questionable', 'Probable', 'Available'}
        if idx + 2 >= len(lines):
            return False
        a = lines[idx]
        b = lines[idx + 1]
        c = lines[idx + 2]
        if a.endswith(',') and is_name_word(a.rstrip(',')) and is_name_word(b) and c in statuses:
            return True
        if idx + 3 < len(lines):
            d = lines[idx + 3]
            if a.endswith(',') and is_name_word(a.rstrip(',')) and b in {'Jr.', 'Jr', 'III', 'II', 'IV', 'Sr.', 'Sr'} and is_name_word(c) and d in statuses:
                return True
            if a.endswith('-') and b.endswith(',') and is_name_word(c) and d in statuses:
                return True
        return False
    
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
                    is_name_word(third_word) and
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
                      is_name_word(first_word) and
                      second_word.endswith(',') and second_word in ['Jr.,', 'Jr,', 'III,', 'II,', 'IV,', 'Sr.,', 'Sr,'] and
                      is_name_word(third_word) and
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
                      is_name_word(first_word.rstrip(',')) and
                      is_name_word(second_word) and 
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
                    
                    while j < len(lines) and j < i + 25:  # Reason can be long
                        word = lines[j]
                        
                        # Normalize split "Injury Illness" token pair
                        if word == 'Injury' and j + 1 < len(lines) and lines[j+1] == 'Illness':
                            reason_parts.append('Injury/Illness')
                            j += 2
                            continue
                        
                        # Stop conditions for reason collection
                        # Check if next word is a potential new player name
                        if j + 2 < len(lines):
                            next_word = lines[j]
                            next_next = lines[j + 1] if j + 1 < len(lines) else ''
                            next_next_next = lines[j + 2] if j + 2 < len(lines) else ''
                            
                            # Check if this looks like start of new player
                            # Pattern 1: "Last, First Status"
                            if looks_like_player_start(j):
                                break
                            
                            # Pattern 2: "LastPart-, LastPart, First Status"
                            if (next_word.endswith('-') and 
                                j + 4 < len(lines) and
                                next_next.endswith(',') and
                                is_name_word(lines[j+2]) and
                                lines[j+3] in ['Out', 'Questionable', 'Probable', 'Available']):
                                break
                            
                            # Pattern 3: "Last Jr., First Status"
                            if (is_name_word(next_word) and
                                j + 3 < len(lines) and
                                next_next.endswith(',') and next_next in ['Jr.,', 'Jr,', 'III,', 'II,', 'IV,', 'Sr.,', 'Sr,'] and
                                is_name_word(lines[j+2]) and
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
                    
                    reason = clean_reason(' '.join(reason_parts).strip())
                    
                    # Build full player name (Last First format for database matching)
                    player_name = f"{first_name} {last_name}"
                    
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
                elif (is_name_word(first_word) and 
                      is_name_word(second_word) and
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
                    
                    while j < len(lines) and j < i + 25:
                        word = lines[j]
                        
                        if word == 'Injury' and j + 1 < len(lines) and lines[j+1] == 'Illness':
                            reason_parts.append('Injury/Illness')
                            j += 2
                            continue
                        
                        # Stop if next looks like new player
                        if j + 2 < len(lines):
                            next_word = lines[j]
                            next_next = lines[j + 1] if j + 1 < len(lines) else ''
                            next_next_next = lines[j + 2] if j + 2 < len(lines) else ''
                            
                            if looks_like_player_start(j):
                                break
                            
                            potential_team = ' '.join(lines[j:min(j+4, len(lines))])
                            if any(team_name in potential_team for team_name in team_names):
                                break
                        
                        reason_parts.append(word)
                        j += 1
                    
                    reason = clean_reason(' '.join(reason_parts).strip())
                    player_name = ' '.join(player_parts)
                    
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
    
    # Deduplicate duplicate parser rows that can appear around page breaks
    deduped = []
    seen = set()
    for inj in injuries:
        key = (
            inj.get('team', ''),
            inj.get('player_name', '').lower().strip(),
            inj.get('status', ''),
            inj.get('reason', ''),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(inj)

    return deduped


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


def normalize_apostrophes(value: str) -> str:
    return value.replace('’', "'").replace('`', "'")


def canonical_name(value: str) -> str:
    value = normalize_apostrophes(value).lower()
    value = re.sub(r"[.,]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def strip_suffixes(value: str) -> str:
    value = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", "", value, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", value).strip()


def build_search_names(player_name: str) -> List[str]:
    base = normalize_apostrophes(player_name).strip()
    parts = [p for p in re.split(r"\s+", base) if p]
    if len(parts) < 2:
        return [base]

    flipped = " ".join(reversed(parts))
    no_suffix = strip_suffixes(base)
    no_suffix_parts = [p for p in re.split(r"\s+", no_suffix) if p]
    no_suffix_flipped = " ".join(reversed(no_suffix_parts)) if len(no_suffix_parts) > 1 else no_suffix

    out = []
    for n in [base, flipped, no_suffix, no_suffix_flipped]:
        n = re.sub(r"\s+", " ", n).strip()
        if n and n not in out:
            out.append(n)
    return out


def find_player_id(supabase: Client, player_name: str, team_abbreviation: str) -> Tuple[Optional[int], str, List[str]]:
    """Find NBA player ID from name and team"""
    names_to_try = build_search_names(player_name)
    try:
        for name in names_to_try:
            result = supabase.table('nba_players')\
                .select('nba_player_id, name')\
                .ilike('name', f'%{name}%')\
                .eq('team_abbreviation', team_abbreviation)\
                .eq('is_active', True)\
                .limit(5)\
                .execute()

            if result.data and len(result.data) > 0:
                if len(result.data) == 1:
                    return result.data[0]['nba_player_id'], name, names_to_try

                normalized_search = canonical_name(name)
                for player in result.data:
                    normalized_name = canonical_name(player['name'])
                    if normalized_name == normalized_search or normalized_search in normalized_name:
                        return player['nba_player_id'], name, names_to_try
                return result.data[0]['nba_player_id'], name, names_to_try

        for name in names_to_try:
            result2 = supabase.table('nba_players')\
                .select('nba_player_id, name')\
                .ilike('name', f'%{name}%')\
                .eq('is_active', True)\
                .limit(1)\
                .execute()
            if result2.data and len(result2.data) > 0:
                return result2.data[0]['nba_player_id'], name, names_to_try

        return None, '', names_to_try
    except Exception as e:
        print(f"   ⚠️  Error finding player {player_name}: {e}")
        return None, '', names_to_try


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


def store_injuries(
    supabase: Optional[Client],
    injuries: List[Dict],
    report_date: date,
    report_timestamp: datetime = None,
    audit_only: bool = False,
):
    """Store injuries in database and mark old injuries as not current"""
    if report_timestamp is None:
        report_timestamp = datetime.now()
    
    print(f"\n💾 Processing {len(injuries)} injuries from report dated {report_date}...")
    
    # Team-level audit counters
    team_counts: Dict[str, Dict[str, int]] = {}
    for injury in injuries:
        team_abbrev = normalize_team_name(injury['team'])
        if team_abbrev not in team_counts:
            team_counts[team_abbrev] = {'parsed': 0, 'matched': 0, 'stored': 0, 'updated': 0, 'unmatched': 0}
        team_counts[team_abbrev]['parsed'] += 1

    if supabase is None:
        # Parse-only audit fallback (no DB credentials available)
        for injury in injuries:
            team_abbrev = normalize_team_name(injury.get('team', ''))
            if team_abbrev in team_counts:
                team_counts[team_abbrev]['unmatched'] += 1
        return {
            'stored': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0,
            'audit': {
                'parsed_count': len(injuries),
                'matched_count': 0,
                'unmatched_count': len(injuries),
                'deactivated_count': 0,
                'parsed_rows': injuries,
                'unmatched': [
                    {
                        'player_name': i.get('player_name'),
                        'team': i.get('team'),
                        'team_abbreviation': normalize_team_name(i.get('team', '')),
                        'status': i.get('status'),
                        'attempted_names': [],
                    }
                    for i in injuries
                ],
                'team_counts': team_counts,
            }
        }

    # Step 1: Snapshot current players before this run
    previous_current_player_ids = set()
    if not audit_only:
        try:
            all_current = supabase.table('nba_injuries') \
                .select('nba_player_id') \
                .eq('is_current', True) \
                .execute()
            if all_current.data:
                previous_current_player_ids = {row['nba_player_id'] for row in all_current.data}
            print(f"   📋 Found {len(previous_current_player_ids)} pre-run current injury players")
        except Exception as e:
            print(f"   ⚠️  Warning: Could not fetch pre-run current injuries: {e}")

    # Step 2: Get list of players on current report (to track who we process)
    current_report_player_ids = set()
    unmatched = []
    
    # Step 3: Process each injury from the current report
    stored = 0
    updated = 0
    skipped = 0
    errors = 0
    
    for injury in injuries:
        try:
            team_abbreviation = normalize_team_name(injury['team'])
            nba_player_id, matched_with, attempted_names = find_player_id(
                supabase, injury['player_name'], team_abbreviation
            )
            
            if not nba_player_id:
                print(f"   ⚠️  Could not find player: {injury['player_name']} ({team_abbreviation})")
                team_counts[team_abbreviation]['unmatched'] += 1
                unmatched.append({
                    'player_name': injury['player_name'],
                    'team': injury['team'],
                    'team_abbreviation': team_abbreviation,
                    'status': injury.get('status'),
                    'attempted_names': attempted_names,
                })
                skipped += 1
                continue
            
            current_report_player_ids.add(nba_player_id)
            team_counts[team_abbreviation]['matched'] += 1

            if not audit_only:
                try:
                    supabase.table('nba_players') \
                        .update({'team_abbreviation': team_abbreviation}) \
                        .eq('nba_player_id', nba_player_id) \
                        .neq('team_abbreviation', team_abbreviation) \
                        .execute()
                except Exception:
                    pass
            
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
            
            if audit_only:
                continue

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
                    team_counts[team_abbreviation]['updated'] += 1
                    print(f"   ✅ Updated: {injury['player_name']} ({injury['status']})")
                else:
                    errors += 1
            else:
                # Insert new record
                result = supabase.table('nba_injuries').insert(injury_data).execute()
                
                if result.data:
                    stored += 1
                    team_counts[team_abbreviation]['stored'] += 1
                    print(f"   ✅ Stored: {injury['player_name']} ({injury['status']})")
                else:
                    errors += 1
                
        except Exception as e:
            print(f"   ❌ Error storing injury for {injury['player_name']}: {e}")
            errors += 1
    
    deactivated_count = 0
    if not audit_only:
        # Step 4: For players NOT on the current report, mark previously-current rows as not current
        print(f"\n   🏥 Reconciling players not on current report...")
        try:
            players_to_mark_healthy = [
                player_id for player_id in previous_current_player_ids
                if player_id not in current_report_player_ids
            ]
            if players_to_mark_healthy:
                supabase.table('nba_injuries') \
                    .update({'is_current': False}) \
                    .in_('nba_player_id', players_to_mark_healthy) \
                    .eq('is_current', True) \
                    .execute()
                deactivated_count = len(players_to_mark_healthy)
                print(f"   ✅ Marked {deactivated_count} players as no longer on injury report")
        except Exception as e:
            print(f"   ⚠️  Warning: Could not reconcile players not on report: {e}")
    
    print(f"\n📊 Storage Summary:")
    print(f"   Stored: {stored}")
    print(f"   Updated: {updated}")
    print(f"   Skipped: {skipped}")
    print(f"   Errors: {errors}")
    if not audit_only:
        print(f"   Deactivated: {deactivated_count}")

    return {
        'stored': stored,
        'updated': updated,
        'skipped': skipped,
        'errors': errors,
        'audit': {
            'parsed_count': len(injuries),
            'matched_count': len(current_report_player_ids),
            'unmatched_count': len(unmatched),
            'deactivated_count': deactivated_count,
            'parsed_rows': injuries,
            'unmatched': unmatched,
            'team_counts': team_counts,
        }
    }


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Fetch NBA injury reports from PDF')
    parser.add_argument('--date', type=str, help='Date in YYYY-MM-DD format (default: today)')
    parser.add_argument('--audit-only', action='store_true', help='Parse and match only, do not write to database')
    args = parser.parse_args()
    
    # Determine target date
    if args.date:
        target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
    else:
        target_date = date.today()
    
    print("🏀 NBA Injury Report PDF Fetcher\n")
    print("=" * 80)
    print(f"📅 Target date: {target_date}")
    
    # Setup (audit-only can run parse-only without DB credentials)
    supabase = setup_supabase(allow_missing=args.audit_only)
    
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
    result = store_injuries(supabase, injuries, target_date, report_timestamp, audit_only=args.audit_only)
    if args.audit_only:
        if supabase is None:
            print("\n⚠️  Running parse-only audit (no Supabase credentials found).")
        print("\n🧪 Audit Summary:")
        print(json.dumps(result['audit'], indent=2))
    
    print("\n✅ Injury fetch complete!")


if __name__ == '__main__':
    main()

