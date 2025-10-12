#!/usr/bin/env python3
"""
Import ESPN Projections and HoopHype Salaries
Loads data from JSON files into Supabase database
"""

import json
import os
import sys
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_supabase_client() -> Client:
    """Create and return Supabase client"""
    url = os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise ValueError("Missing Supabase credentials in environment")
    
    return create_client(url, key)

def clean_salary_string(salary_str):
    """Convert salary string like '$59,606,817' to integer 59606817"""
    if not salary_str or salary_str == 'null':
        return None
    
    # Remove $, commas, and convert to int
    cleaned = salary_str.replace('$', '').replace(',', '')
    try:
        return int(cleaned)
    except ValueError:
        return None

def normalize_name(name):
    """Normalize player name for matching"""
    if not name:
        return ""
    
    # Convert to lowercase and strip whitespace
    normalized = name.lower().strip()
    
    # Handle common name variations
    replacements = {
        'g. antetokounmpo': 'giannis antetokounmpo',
        'k. towns': 'karl-anthony towns',
        'k. caldwell-pope': 'kentavious caldwell-pope',
        'o.g. anunoby': 'og anunoby',
        'p.j. washington': 'pj washington',
        'r.j. barrett': 'rj barrett',
        't.j. mcconnell': 'tj mcconnell',
        'a.j. green': 'aj green',
        'k.j. martin': 'kj martin',
        'd.j. murray': 'dejounte murray',
        'c.j. mccollum': 'cj mccollum',
        'j.j. redick': 'jj redick',
        'iii': '',  # Remove III, Jr., etc.
        'jr.': '',
        'jr': '',
        'ii': '',
    }
    
    for old, new in replacements.items():
        normalized = normalized.replace(old, new)
    
    return normalized.strip()

def find_player_by_name(supabase, name):
    """Find player in database by name"""
    normalized = normalize_name(name)
    
    # Try exact match first
    result = supabase.table('players').select('id, name').ilike('name', name).limit(1).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    
    # Try normalized match
    result = supabase.table('players').select('id, name').execute()
    for player in result.data:
        if normalize_name(player['name']) == normalized:
            return player
    
    # Try partial match (last name)
    parts = normalized.split()
    if len(parts) > 1:
        last_name = parts[-1]
        result = supabase.table('players').select('id, name').ilike('name', f'%{last_name}%').limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]
    
    return None

def import_salaries(supabase, json_file_path):
    """Import HoopHype salaries from JSON file"""
    print(f"\n{'='*80}")
    print(f"IMPORTING SALARIES FROM: {json_file_path}")
    print(f"{'='*80}\n")
    
    with open(json_file_path, 'r') as f:
        salaries_data = json.load(f)
    
    updated_count = 0
    not_found_count = 0
    skipped_count = 0
    
    for salary_record in salaries_data:
        name = salary_record.get('Name')
        salary_str = salary_record.get('2025-26')
        
        if not name or not salary_str or salary_str == 'null':
            skipped_count += 1
            continue
        
        salary = clean_salary_string(salary_str)
        if not salary:
            skipped_count += 1
            continue
        
        # Find player in database
        player = find_player_by_name(supabase, name)
        
        if not player:
            print(f"❌ Player not found: {name}")
            not_found_count += 1
            continue
        
        # Update player's salary
        try:
            supabase.table('players').update({
                'salary_2025_26': salary
            }).eq('id', player['id']).execute()
            
            print(f"✅ Updated {player['name']}: ${salary:,}")
            updated_count += 1
        except Exception as e:
            print(f"❌ Error updating {name}: {e}")
    
    print(f"\n{'='*80}")
    print(f"SALARY IMPORT SUMMARY:")
    print(f"  ✅ Updated: {updated_count}")
    print(f"  ❌ Not Found: {not_found_count}")
    print(f"  ⏭️  Skipped: {skipped_count}")
    print(f"{'='*80}\n")

def import_projections(supabase, json_file_path):
    """Import ESPN projections from JSON file"""
    print(f"\n{'='*80}")
    print(f"IMPORTING PROJECTIONS FROM: {json_file_path}")
    print(f"{'='*80}\n")
    
    with open(json_file_path, 'r') as f:
        projections_data = json.load(f)
    
    inserted_count = 0
    updated_count = 0
    not_found_count = 0
    
    for proj_record in projections_data:
        name = proj_record.get('Name')
        proj_2026 = proj_record.get('2026 Projections', {})
        
        if not name or not proj_2026:
            continue
        
        # Find player in database
        player = find_player_by_name(supabase, name)
        
        if not player:
            print(f"❌ Player not found: {name}")
            not_found_count += 1
            continue
        
        # Prepare projection data
        projection_data = {
            'player_id': player['id'],
            'proj_2026_gp': float(proj_2026.get('GP', 0)) if proj_2026.get('GP') else 0,
            'proj_2026_min': float(proj_2026.get('MIN', 0)) if proj_2026.get('MIN') else 0,
            'proj_2026_pts': float(proj_2026.get('PTS', 0)) if proj_2026.get('PTS') else 0,
            'proj_2026_reb': float(proj_2026.get('REB', 0)) if proj_2026.get('REB') else 0,
            'proj_2026_ast': float(proj_2026.get('AST', 0)) if proj_2026.get('AST') else 0,
            'proj_2026_stl': float(proj_2026.get('STL', 0)) if proj_2026.get('STL') else 0,
            'proj_2026_blk': float(proj_2026.get('BLK', 0)) if proj_2026.get('BLK') else 0,
            'proj_2026_to': float(proj_2026.get('TO', 0)) if proj_2026.get('TO') else 0,
            'proj_2026_3pm': float(proj_2026.get('3PM', 0)) if proj_2026.get('3PM') else 0,
            'proj_2026_fg_pct': float(proj_2026.get('FG%', 0)) if proj_2026.get('FG%') else 0,
            'proj_2026_ft_pct': float(proj_2026.get('FT%', 0)) if proj_2026.get('FT%') else 0,
        }
        
        # Check if projection already exists
        existing = supabase.table('espn_player_projections').select('id').eq('player_id', player['id']).limit(1).execute()
        
        try:
            if existing.data and len(existing.data) > 0:
                # Update existing projection
                supabase.table('espn_player_projections').update(projection_data).eq('player_id', player['id']).execute()
                print(f"🔄 Updated projection for {player['name']}")
                updated_count += 1
            else:
                # Insert new projection
                supabase.table('espn_player_projections').insert(projection_data).execute()
                print(f"✅ Inserted projection for {player['name']}")
                inserted_count += 1
        except Exception as e:
            print(f"❌ Error importing projection for {name}: {e}")
    
    print(f"\n{'='*80}")
    print(f"PROJECTION IMPORT SUMMARY:")
    print(f"  ✅ Inserted: {inserted_count}")
    print(f"  🔄 Updated: {updated_count}")
    print(f"  ❌ Not Found: {not_found_count}")
    print(f"{'='*80}\n")

def main():
    """Main import function"""
    print("\n🏀 IMPORTING NBA PLAYER DATA\n")
    
    # Get Supabase client
    try:
        supabase = get_supabase_client()
        print("✅ Connected to Supabase\n")
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        sys.exit(1)
    
    # Get file paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    salaries_file = os.path.join(script_dir, 'supabase', 'hoopshype_salaries.json')
    projections_file = os.path.join(script_dir, 'supabase', 'espn_projections.json')
    
    # Check if files exist
    if not os.path.exists(salaries_file):
        print(f"❌ Salaries file not found: {salaries_file}")
        sys.exit(1)
    
    if not os.path.exists(projections_file):
        print(f"❌ Projections file not found: {projections_file}")
        sys.exit(1)
    
    # Import data
    import_salaries(supabase, salaries_file)
    import_projections(supabase, projections_file)
    
    print("\n✅ IMPORT COMPLETE!\n")

if __name__ == "__main__":
    main()

