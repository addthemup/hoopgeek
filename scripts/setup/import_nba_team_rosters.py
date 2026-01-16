#!/usr/bin/env python3
"""
Import NBA Team Rosters from NBA API
=====================================
This script scrapes team rosters from the NBA API and stores them in the database.
Should be run daily at 4 AM via cron job.

Usage:
    python scripts/setup/import_nba_team_rosters.py
"""

import os
import sys
import pandas as pd
from datetime import datetime
from supabase import create_client, Client
from nba_api.stats.endpoints import CommonTeamRoster
from nba_api.stats.library.parameters import Season

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

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

def import_team_roster(team_id, season):
    """Import roster for a single team"""
    try:
        print(f"📋 Fetching roster for team {team_id} (season {season})...")
        
        # Fetch roster from NBA API
        roster_data = CommonTeamRoster(team_id=team_id, season=season)
        
        # Get the roster DataFrame
        roster_df = roster_data.common_team_roster.get_data_frame()
        
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
                    # Get team info from nba_teams
                    team_response = supabase.table('nba_teams').select('team_id, abbreviation, city, nickname').eq('team_id', team_id).limit(1).execute()
                    
                    if team_response.data and len(team_response.data) > 0:
                        team_info = team_response.data[0]
                        supabase.table('nba_players').update({
                            'team_id': int(team_id),
                            'team_name': f"{team_info['city']} {team_info['nickname']}",
                            'team_abbreviation': team_info['abbreviation'],
                            'team_city': team_info['city'],
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
    
    # Import roster for each team
    for team in teams:
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
        # First, try to create/update the sync function if it doesn't exist
        sync_function_sql = """
CREATE OR REPLACE FUNCTION sync_player_teams_from_roster(p_season TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    updated_count INTEGER := 0;
    cleared_count INTEGER := 0;
    current_season TEXT;
BEGIN
    -- Determine season to use
    IF p_season IS NULL THEN
        SELECT 
            CASE 
                WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 10 THEN 
                    EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || SUBSTRING((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT, 3, 2)
                ELSE 
                    (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT || '-' || SUBSTRING(EXTRACT(YEAR FROM CURRENT_DATE)::TEXT, 3, 2)
            END
        INTO current_season;
    ELSE
        current_season := p_season;
    END IF;
    
    -- Step 1: Update nba_players with team info from nba_team_roster (players who ARE on teams)
    UPDATE nba_players np
    SET 
        team_id = r.team_id,
        team_name = t.city || ' ' || t.nickname,
        team_abbreviation = t.abbreviation,
        team_city = t.city,
        updated_at = NOW()
    FROM nba_team_roster r
    JOIN nba_teams t ON r.team_id = t.team_id
    WHERE np.nba_player_id = r.nba_player_id
        AND r.season = current_season
        AND r.team_id IS NOT NULL
        AND (np.team_id IS NULL OR np.team_id != r.team_id OR np.team_id = 0);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Step 2: Clear team_id for players who are NOT in any current season roster (free agents)
    UPDATE nba_players np
    SET 
        team_id = NULL,
        team_name = NULL,
        team_abbreviation = NULL,
        team_city = NULL,
        updated_at = NOW()
    WHERE np.team_id IS NOT NULL
        AND np.team_id != 0
        AND NOT EXISTS (
            SELECT 1 
            FROM nba_team_roster r 
            WHERE r.nba_player_id = np.nba_player_id 
                AND r.season = current_season
                AND r.team_id IS NOT NULL
        );
    
    GET DIAGNOSTICS cleared_count = ROW_COUNT;
    
    result := jsonb_build_object(
        'success', TRUE,
        'season', current_season,
        'players_updated', updated_count,
        'free_agents_cleared', cleared_count,
        'message', format('Successfully synced %s players and cleared %s free agents from roster data', updated_count, cleared_count)
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', FALSE,
        'error', SQLERRM,
        'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
"""
        
        # Try to execute the function creation via raw SQL
        # Since Supabase Python client doesn't support DDL, we'll do the sync manually
        print("📝 Note: Function creation requires manual SQL execution.")
        print("   For now, performing manual sync...")
        
        # Manual sync: Update players on rosters
        print("\n   Step 1: Updating players on rosters...")
        update_query = f"""
        UPDATE nba_players np
        SET 
            team_id = r.team_id,
            team_name = t.city || ' ' || t.nickname,
            team_abbreviation = t.abbreviation,
            team_city = t.city,
            updated_at = NOW()
        FROM nba_team_roster r
        JOIN nba_teams t ON r.team_id = t.team_id
        WHERE np.nba_player_id = r.nba_player_id
            AND r.season = '{season}'
            AND r.team_id IS NOT NULL
            AND (np.team_id IS NULL OR np.team_id != r.team_id OR np.team_id = 0);
        """
        
        # We can't execute DDL/DML directly via Supabase Python client
        # So we'll use a workaround: update players one by one via the roster data
        # Get all roster entries for this season
        roster_response = supabase.table('nba_team_roster').select('nba_player_id, team_id').eq('season', season).execute()
        # Filter out None team_ids in Python
        roster_players = [r for r in (roster_response.data if roster_response.data else []) if r.get('team_id') is not None]
        
        if roster_players:
            updated = 0
            # Get unique team IDs to batch fetch team info
            unique_team_ids = list(set([r['team_id'] for r in roster_players]))
            teams_map = {}
            
            for team_id in unique_team_ids:
                team_response = supabase.table('nba_teams').select('team_id, abbreviation, city, nickname').eq('team_id', team_id).limit(1).execute()
                if team_response.data and len(team_response.data) > 0:
                    teams_map[team_id] = team_response.data[0]
            
            for roster_entry in roster_players:
                nba_player_id = roster_entry['nba_player_id']
                team_id = roster_entry['team_id']
                
                if team_id in teams_map:
                    team = teams_map[team_id]
                    # Update player
                    player_update = supabase.table('nba_players').update({
                        'team_id': team_id,
                        'team_name': f"{team['city']} {team['nickname']}",
                        'team_abbreviation': team['abbreviation'],
                        'team_city': team['city'],
                        'updated_at': datetime.now().isoformat()
                    }).eq('nba_player_id', nba_player_id).execute()
                    
                    if player_update.data:
                        updated += 1
            
            print(f"   ✅ Updated {updated} players with team info from rosters")
        
        # Step 2: Clear free agents (players not in any roster)
        print("\n   Step 2: Clearing free agents...")
        all_roster_player_ids = set([r['nba_player_id'] for r in roster_players])
        
        if all_roster_player_ids:
            # Get all players with team_id set (in batches to avoid timeout)
            cleared = 0
            batch_size = 100
            offset = 0
            
            while True:
                # Get players with team_id set (not null and not 0)
                players_response = supabase.table('nba_players').select('nba_player_id, id').neq('team_id', 0).range(offset, offset + batch_size - 1).execute()
                players_with_teams = [p for p in (players_response.data if players_response.data else []) if p.get('team_id') is not None and p.get('team_id') != 0]
                
                if not players_with_teams:
                    break
                
                for player in players_with_teams:
                    if player['nba_player_id'] not in all_roster_player_ids:
                        # Clear team info
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

