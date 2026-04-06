#!/usr/bin/env python3
"""
Import NBA Team Rosters from NBA API
=====================================
This script scrapes team rosters from the NBA API and stores them in the database.
Should be run daily at 4 AM via cron job.

Uses nba_timeout_patch for longer timeouts; retries with backoff and delay between
teams to reduce rate-limiting. If stats.nba.com repeatedly times out, your IP may
be throttled—try a different network or VPN.
"""

import os
import sys
import time
import pandas as pd
from datetime import datetime
from supabase import create_client, Client
from nba_api.stats.endpoints import CommonTeamRoster
from nba_api.stats.library.parameters import Season

# Add parent directory to path for imports
_script_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(_script_dir))
sys.path.insert(0, _project_root)

# Longer NBA API timeout (same as boxscores/feed scripts) — apply before any nba_api calls
try:
    _feed_dir = os.path.join(os.path.dirname(_script_dir), "feed")
    if _feed_dir not in sys.path:
        sys.path.insert(0, _feed_dir)
    import nba_timeout_patch  # noqa: F401
except Exception:
    pass

# Delay between team requests to reduce rate-limiting (seconds). Env: NBA_ROSTER_DELAY_SEC
DELAY_BETWEEN_TEAMS_SEC = float(os.environ.get("NBA_ROSTER_DELAY_SEC", "2.0"))
# Retries per team on timeout/connection errors. Env: NBA_ROSTER_RETRIES
ROSTER_RETRIES = int(os.environ.get("NBA_ROSTER_RETRIES", "3"))
# Backoff between retries (seconds). Env: NBA_ROSTER_BACKOFF_SEC
ROSTER_BACKOFF_SEC = float(os.environ.get("NBA_ROSTER_BACKOFF_SEC", "15.0"))

# Load .env from project root (works when run from repo root or scripts/setup/)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_project_root, '.env.local'))
    load_dotenv(os.path.join(_project_root, '.env'))
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except Exception:
    pass

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("❌ Error: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set")
    sys.exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

def get_current_season():
    """Get current NBA season string (e.g., '2025-26')"""
    today = datetime.now()
    year = today.year
    month = today.month
    
    # NBA season typically starts in October (month 10)
    if month >= 10:
        season_start = year
        season_end = year + 1
    else:
        season_start = year - 1
        season_end = year
    
    return f"{season_start}-{str(season_end)[-2:]}"

def get_all_teams():
    """Get all NBA teams from database"""
    try:
        # Try team_abbreviation first, fallback to abbreviation
        try:
            response = supabase.table('nba_teams').select('team_id, team_abbreviation').execute()
            return response.data
        except:
            # Fallback to abbreviation if team_abbreviation doesn't exist
            response = supabase.table('nba_teams').select('team_id, abbreviation').execute()
            # Map abbreviation to team_abbreviation for consistency
            return [{'team_id': team['team_id'], 'team_abbreviation': team['abbreviation']} for team in response.data]
    except Exception as e:
        print(f"❌ Error fetching teams: {e}")
        return []

def find_player_by_nba_id(nba_player_id):
    """Find player in database by NBA player ID"""
    try:
        response = supabase.table('nba_players').select('id').eq('nba_player_id', nba_player_id).limit(1).execute()
        if response.data:
            return response.data[0]['id']
        return None
    except Exception as e:
        print(f"⚠️  Error finding player {nba_player_id}: {e}")
        return None

def _fetch_roster_df(team_id, season):
    """Fetch roster DataFrame from NBA API with retries and backoff. Raises on final failure."""
    last_err = None
    for attempt in range(1, ROSTER_RETRIES + 1):
        try:
            roster_data = CommonTeamRoster(team_id=team_id, season=season)
            return roster_data.common_team_roster.get_data_frame()
        except Exception as e:
            last_err = e
            is_retryable = (
                "timeout" in str(e).lower()
                or "timed out" in str(e).lower()
                or "Connection" in str(type(e).__name__)
                or "ConnectionPool" in str(e)
            )
            if attempt < ROSTER_RETRIES and is_retryable:
                wait = ROSTER_BACKOFF_SEC * attempt
                print(f"   ⏳ Attempt {attempt}/{ROSTER_RETRIES} failed ({e}); retrying in {wait:.0f}s...")
                time.sleep(wait)
            else:
                raise last_err
    raise last_err


def import_team_roster(team_id, season):
    """Import roster for a single team"""
    try:
        print(f"📋 Fetching roster for team {team_id} (season {season})...")
        
        roster_df = _fetch_roster_df(team_id, season)
        
        if roster_df.empty:
            print(f"⚠️  No roster data for team {team_id}")
            return 0
        
        imported_count = 0
        errors = []
        
        # Process each player in the roster
        for _, row in roster_df.iterrows():
            try:
                nba_player_id = int(row['PLAYER_ID'])
                player_name = row['PLAYER']
                player_slug = row.get('PLAYER_SLUG', '')
                jersey_number = str(row.get('NUM', '')) if pd.notna(row.get('NUM')) else None
                position = row.get('POSITION', '') if pd.notna(row.get('POSITION')) else None
                height = row.get('HEIGHT', '') if pd.notna(row.get('HEIGHT')) else None
                weight = int(row['WEIGHT']) if pd.notna(row.get('WEIGHT')) else None
                birth_date = row.get('BIRTH_DATE', '') if pd.notna(row.get('BIRTH_DATE')) else None
                age = int(row['AGE']) if pd.notna(row.get('AGE')) else None
                # Handle rookies - NBA API returns 'R' for rookies
                experience_years = None
                if pd.notna(row.get('EXP')):
                    exp_value = str(row['EXP']).strip()
                    if exp_value.upper() == 'R':
                        experience_years = 0  # Rookie = 0 years experience
                    else:
                        try:
                            experience_years = int(exp_value)
                        except (ValueError, TypeError):
                            experience_years = None
                school = row.get('SCHOOL', '') if pd.notna(row.get('SCHOOL')) else None
                
                # Parse birth date
                parsed_birth_date = None
                if birth_date:
                    try:
                        # NBA API format is typically "YYYY-MM-DD" or "MM/DD/YYYY"
                        if '/' in birth_date:
                            parsed_birth_date = datetime.strptime(birth_date, '%m/%d/%Y').date()
                        else:
                            parsed_birth_date = datetime.strptime(birth_date, '%Y-%m-%d').date()
                    except:
                        pass
                
                # Find player in our database
                player_id = find_player_by_nba_id(nba_player_id)
                
                # Prepare roster entry
                roster_entry = {
                    'team_id': int(team_id),
                    'season': season,
                    'nba_player_id': nba_player_id,
                    'player_name': player_name,
                    'player_slug': player_slug,
                    'jersey_number': jersey_number,
                    'position': position,
                    'height': height,
                    'weight': weight,
                    'birth_date': parsed_birth_date.isoformat() if parsed_birth_date else None,
                    'age': age,
                    'experience_years': experience_years,
                    'school': school,
                }
                
                # Add player_id if found
                if player_id:
                    roster_entry['player_id'] = player_id
                
                # Upsert roster entry (insert or update)
                supabase.table('nba_team_roster').upsert(
                    roster_entry,
                    on_conflict='team_id,season,nba_player_id'
                ).execute()
                
                # Update nba_players.team_id from roster data (more accurate than commonallplayers endpoint)
                if player_id:
                    # Get team info from nba_teams (abbreviation or team_abbreviation depending on schema)
                    team_response = supabase.table('nba_teams').select('team_id, abbreviation, city, nickname').eq('team_id', team_id).limit(1).execute()
                    if not team_response.data or len(team_response.data) == 0:
                        team_response = supabase.table('nba_teams').select('team_id, team_abbreviation, city, nickname').eq('team_id', team_id).limit(1).execute()
                    if team_response.data and len(team_response.data) > 0:
                        team_info = team_response.data[0]
                        abbr = team_info.get('abbreviation') or team_info.get('team_abbreviation') or ''
                        supabase.table('nba_players').update({
                            'team_id': int(team_id),
                            'team_name': f"{team_info.get('city', '')} {team_info.get('nickname', '')}".strip(),
                            'team_abbreviation': abbr,
                            'team_city': team_info.get('city') or '',
                            'updated_at': datetime.now().isoformat()
                        }).eq('id', player_id).execute()
                
                imported_count += 1
                
            except Exception as e:
                error_msg = f"Error processing player {row.get('PLAYER', 'Unknown')}: {e}"
                errors.append(error_msg)
                print(f"⚠️  {error_msg}")
        
        print(f"✅ Imported {imported_count} players for team {team_id}")
        if errors:
            print(f"⚠️  {len(errors)} errors occurred")
        
        return imported_count
        
    except Exception as e:
        print(f"❌ Error importing roster for team {team_id}: {e}")
        return 0

def main():
    """Main import function"""
    print("=" * 60)
    print("🏀 NBA Team Roster Import")
    print("=" * 60)
    
    season = get_current_season()
    print(f"📅 Season: {season}")
    print()
    
    # Get all teams
    teams = get_all_teams()
    if not teams:
        print("❌ No teams found in database")
        return
    
    print(f"📋 Found {len(teams)} teams")
    print()
    
    total_imported = 0
    total_errors = 0
    
    # Import roster for each team (delay between teams to reduce rate-limiting)
    for i, team in enumerate(teams):
        if i > 0 and DELAY_BETWEEN_TEAMS_SEC > 0:
            time.sleep(DELAY_BETWEEN_TEAMS_SEC)
        team_id = team['team_id']
        team_abbr = team['team_abbreviation']
        
        print(f"🏀 Processing {team_abbr} (ID: {team_id})...")
        imported = import_team_roster(team_id, season)
        
        if imported > 0:
            total_imported += imported
        else:
            total_errors += 1
        
        print()
    
    # After importing all rosters, sync player teams and mark free agents
    print("\n" + "=" * 60)
    print("🔄 Syncing player team assignments from roster data...")
    print("=" * 60)
    
    try:
        # Prefer the DB function so nba_players are overwritten in one SQL pass (handles moves correctly)
        try:
            rpc_result = supabase.rpc('sync_player_teams_from_roster', {'p_season': season}).execute()
            if rpc_result.data and isinstance(rpc_result.data, dict):
                d = rpc_result.data
            elif rpc_result.data and isinstance(rpc_result.data, list) and len(rpc_result.data) > 0:
                d = rpc_result.data[0]
            else:
                d = {}
            if d.get('success'):
                print(f"   ✅ RPC sync: {d.get('players_updated', 0)} players updated, {d.get('free_agents_cleared', 0)} free agents cleared")
                print("\n✅ Sync completed via sync_player_teams_from_roster()")
            else:
                print(f"   ⚠️  RPC returned: {d.get('error', d)}")
                raise RuntimeError("RPC sync failed")
        except Exception as rpc_err:
            print(f"   📝 RPC not available ({rpc_err}), performing manual sync...")
            
            # Manual sync: fetch ALL roster entries (paginate; default limit can truncate)
            roster_players = []
            page_size = 1000
            offset = 0
            while True:
                page = supabase.table('nba_team_roster').select('nba_player_id, team_id').eq('season', season).range(offset, offset + page_size - 1).execute()
                data = page.data or []
                roster_players.extend([r for r in data if r.get('team_id') is not None])
                if len(data) < page_size:
                    break
                offset += page_size
            # One row per player (if traded, same player can appear twice; keep last so current team wins)
            by_player = {r['nba_player_id']: r['team_id'] for r in roster_players}
            roster_players = [{'nba_player_id': pid, 'team_id': tid} for pid, tid in by_player.items()]
            
            if roster_players:
                updated = 0
                unique_team_ids = list(set(r['team_id'] for r in roster_players))
                teams_map = {}
                for team_id in unique_team_ids:
                    team_response = supabase.table('nba_teams').select('team_id, abbreviation, city, nickname').eq('team_id', team_id).limit(1).execute()
                    if team_response.data and len(team_response.data) > 0:
                        teams_map[team_id] = team_response.data[0]
                # Support schema with either abbreviation or team_abbreviation
                for roster_entry in roster_players:
                    nba_player_id = roster_entry['nba_player_id']
                    team_id = roster_entry['team_id']
                    if team_id not in teams_map:
                        continue
                    team = teams_map[team_id]
                    abbr = team.get('abbreviation') or team.get('team_abbreviation') or ''
                    player_update = supabase.table('nba_players').update({
                        'team_id': team_id,
                        'team_name': f"{team.get('city', '')} {team.get('nickname', '')}".strip(),
                        'team_abbreviation': abbr,
                        'team_city': team.get('city') or '',
                        'updated_at': datetime.now().isoformat()
                    }).eq('nba_player_id', nba_player_id).execute()
                    if player_update.data:
                        updated += 1
                print(f"   ✅ Updated {updated} players with team info from rosters")
            
            all_roster_player_ids = set(r['nba_player_id'] for r in roster_players)
            cleared = 0
            batch_size = 100
            offset = 0
            while True:
                players_response = supabase.table('nba_players').select('nba_player_id, id').neq('team_id', 0).range(offset, offset + batch_size - 1).execute()
                players_with_teams = [p for p in (players_response.data or []) if p.get('team_id') is not None and p.get('team_id') != 0]
                if not players_with_teams:
                    break
                for player in players_with_teams:
                    if player['nba_player_id'] not in all_roster_player_ids:
                        supabase.table('nba_players').update({
                            'team_id': None,
                            'team_name': None,
                            'team_abbreviation': None,
                            'team_city': None,
                            'updated_at': datetime.now().isoformat()
                        }).eq('id', player['id']).execute()
                        cleared += 1
                if len(players_with_teams) < batch_size:
                    break
                offset += batch_size
                if cleared % 50 == 0:
                    print(f"   ... cleared {cleared} so far...")
            print(f"   ✅ Cleared team info for {cleared} free agents")
            print("\n✅ Manual sync completed!")
        
    except Exception as e:
        print(f"⚠️  Error syncing player teams: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print(f"✅ Import complete!")
    print(f"   Total players imported: {total_imported}")
    print(f"   Teams with errors: {total_errors}")
    print("=" * 60)

if __name__ == "__main__":
    main()

