#!/usr/bin/env python3
"""
Import HoopsHype salary data into the database
"""

import json
import os
import sys
from typing import Dict, List, Any, Optional
from supabase import create_client, Client

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_supabase_client() -> Client:
    """Get Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not service_key:
        raise ValueError("Missing required environment variables: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
    
    return create_client(url, service_key)

def parse_salary_value(salary_str: Optional[str]) -> Optional[int]:
    """Parse salary string to integer (remove $ and commas)"""
    if not salary_str or salary_str == "null":
        return None
    
    # Remove $ and commas, then convert to int
    try:
        cleaned = salary_str.replace("$", "").replace(",", "")
        return int(cleaned)
    except (ValueError, AttributeError):
        return None

def calculate_contract_years_remaining(salaries: Dict[str, Optional[int]]) -> int:
    """Calculate how many years remaining on contract based on non-null salaries"""
    years = 0
    for year in ["2025-26", "2026-27", "2027-28", "2028-29"]:
        if salaries.get(year) is not None:
            years += 1
    return years

def normalize_team_name(team_name: str) -> str:
    """Normalize team names to match database format"""
    # Common team name mappings
    team_mappings = {
        "LA Clippers": "Los Angeles Clippers",
        "Golden State Warriors": "Golden State Warriors",
        "Denver Nuggets": "Denver Nuggets",
        "Philadelphia 76ers": "Philadelphia 76ers",
        "Phoenix Suns": "Phoenix Suns",
        "Milwaukee Bucks": "Milwaukee Bucks",
        "Minnesota Timberwolves": "Minnesota Timberwolves",
        "Boston Celtics": "Boston Celtics",
        "Los Angeles Lakers": "Los Angeles Lakers",
        "Chicago Bulls": "Chicago Bulls",
        "Utah Jazz": "Utah Jazz",
        "Atlanta Hawks": "Atlanta Hawks",
        "Houston Rockets": "Houston Rockets",
        "Miami Heat": "Miami Heat",
        "Cleveland Cavaliers": "Cleveland Cavaliers",
        "New Orleans Pelicans": "New Orleans Pelicans",
        "Brooklyn Nets": "Brooklyn Nets",
        "Toronto Raptors": "Toronto Raptors",
        "Washington Wizards": "Washington Wizards",
        "Sacramento Kings": "Sacramento Kings",
        "Portland Trail Blazers": "Portland Trail Blazers",
        "Orlando Magic": "Orlando Magic",
        "Detroit Pistons": "Detroit Pistons",
        "Charlotte Hornets": "Charlotte Hornets",
        "Indiana Pacers": "Indiana Pacers",
        "San Antonio Spurs": "San Antonio Spurs",
        "Team 5312": "Free Agent"  # Handle special case
    }
    
    return team_mappings.get(team_name, team_name)

def import_hoopshype_salaries(supabase: Client) -> None:
    """Import HoopsHype salary data"""
    print("🏀 Importing HoopsHype Salary Data")
    print("=" * 50)
    
    # Load the salary data
    salary_file = "scripts/supabase/hoopshype_salaries.json"
    if not os.path.exists(salary_file):
        print(f"❌ Salary file not found: {salary_file}")
        return
    
    with open(salary_file, "r", encoding="utf-8") as f:
        salary_data = json.load(f)
    
    print(f"📊 Loaded {len(salary_data)} players from salary data")
    
    # Clear existing salary data to prevent duplicates
    try:
        supabase.table("nba_hoopshype_salaries").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("🗑️  Cleared existing HoopsHype salary data")
    except Exception as e:
        print(f"⚠️  Warning: Could not clear existing salary data: {e}")
    
    # Get all players for matching (with pagination to get ALL players)
    print("🔍 Fetching all players for matching...")
    all_players = []
    page_size = 1000
    offset = 0
    
    while True:
        result = supabase.table('nba_players').select('id, name, team_name, is_active').limit(page_size).offset(offset).execute()
        if not result.data:
            break
        all_players.extend(result.data)
        print(f"   📄 Fetched page {offset//page_size + 1}: {len(result.data)} players (total: {len(all_players)})")
        offset += page_size
        if len(result.data) < page_size:
            break
    
    print(f"   ✅ Fetched {len(all_players)} players from database")
    
    if not all_players:
        print("❌ No players found in database")
        return
    
    print(f"📋 Found {len(all_players)} players in database")
    
    # Create lookup dictionary for matching (same as ESPN script)
    def create_lookup_dict(players_list):
        lookup = {}
        for player in players_list:
            # Create multiple lookup keys for each player
            name_key = player['name'].lower().strip()
            lookup[name_key] = player
            
            # Also try without common suffixes
            name_no_suffix = name_key.replace(' jr', '').replace(' sr', '').replace(' iii', '').replace(' ii', '').replace(' iv', '')
            if name_no_suffix != name_key:
                lookup[name_no_suffix] = player
            
            # Try without accents/special characters
            import unicodedata
            name_no_accents = ''.join(c for c in unicodedata.normalize('NFD', name_key) if unicodedata.category(c) != 'Mn')
            if name_no_accents != name_key:
                lookup[name_no_accents] = player
                
        return lookup
    
    player_lookup = create_lookup_dict(all_players)
    print(f"   📋 Created lookup dictionary with {len(player_lookup)} keys")
    
    # Track statistics
    imported_count = 0
    skipped_count = 0
    error_count = 0
    matched_players = []
    unmatched_players = []
    
    print("\n🔍 Matching and importing salary data...")
    
    for player_data in salary_data:
        try:
            player_name = player_data.get("Name")
            team_name = player_data.get("Team")
            
            if not player_name:
                print(f"⚠️  Skipping player with no name")
                continue
            
            # Normalize team name
            normalized_team = normalize_team_name(team_name) if team_name else None
            
            # Parse salary values
            salaries = {
                "2025-26": parse_salary_value(player_data.get("2025-26")),
                "2026-27": parse_salary_value(player_data.get("2026-27")),
                "2027-28": parse_salary_value(player_data.get("2027-28")),
                "2028-29": parse_salary_value(player_data.get("2028-29"))
            }
            
            # Calculate contract years remaining
            contract_years = calculate_contract_years_remaining(salaries)
            
            # Try to match the player using improved lookup
            player_name_lower = player_name.lower().strip()
            matched_player = None
            confidence = 0.0
            
            if player_name_lower in player_lookup:
                matched_player = player_lookup[player_name_lower]
                confidence = 1.0 if matched_player['is_active'] else 0.9
            
            if not matched_player:
                # Player not found - skip this salary record
                unmatched_players.append({
                    'player_name': player_name,
                    'team_name': team_name
                })
                skipped_count += 1
                continue
            
            # Player found - import the salary data
            matched_players.append({
                'player_name': player_name,
                'matched_name': matched_player['name'],
                'matched_team': matched_player['team_name'],
                'is_active': matched_player['is_active'],
                'confidence': confidence
            })
            
            # Insert salary data into nba_hoopshype_salaries table
            player_id = matched_player['id']
            
            salary_data = {
                "player_name": player_name,
                "team_name": normalized_team,
                "player_id": player_id,
                "matched_at": "now()",
                "match_confidence": 1.0,
                "salary_2025_26": salaries["2025-26"],
                "salary_2026_27": salaries["2026-27"],
                "salary_2027_28": salaries["2027-28"],
                "salary_2028_29": salaries["2028-29"],
                "contract_years_remaining": contract_years
            }
            
            # Remove None values
            salary_data = {k: v for k, v in salary_data.items() if v is not None}
            
            supabase.table("nba_hoopshype_salaries").insert(salary_data).execute()
            
            status = "🟢" if matched_player['is_active'] else "🟡"
            print(f"   {status} {player_name} → {matched_player['name']} ({matched_player['team_name']}) - {contract_years} years remaining")
            imported_count += 1
            
        except Exception as e:
            print(f"❌ Error importing salary for {player_name}: {e}")
            error_count += 1
    
    # Print summary
    print(f"\n📊 IMPORT SUMMARY:")
    print(f"✅ Successfully imported: {imported_count} salary records")
    print(f"⏭️  Skipped (no match): {skipped_count} salary records")
    print(f"❌ Failed to import: {error_count} salary records")
    
    # Show matched players
    if matched_players:
        print(f"\n🎯 MATCHED PLAYERS ({len(matched_players)}):")
        for match in matched_players:
            status = "🟢" if match['is_active'] else "🟡"
            print(f"   {status} {match['player_name']} → {match['matched_name']} ({match['matched_team']}) - Active: {match['is_active']}")
    
    # Show unmatched players
    if unmatched_players:
        print(f"\n❌ UNMATCHED PLAYERS ({len(unmatched_players)}):")
        print("   These players need manual name fixes in the JSON file:")
        for unmatched in unmatched_players:
            print(f"   • {unmatched['player_name']} ({unmatched['team_name']})")
    
    print(f"\n💡 To fix unmatched players:")
    print(f"   1. Edit the JSON file: {salary_file}")
    print(f"   2. Change the 'Name' field to match a player in your database")
    print(f"   3. Re-run this script")

def main():
    """Main function"""
    try:
        supabase = get_supabase_client()
        import_hoopshype_salaries(supabase)
        print("\n🎉 HoopsHype salary import completed!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
