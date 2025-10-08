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
    salary_file = "supabase/hoopshype_salaries.json"
    if not os.path.exists(salary_file):
        print(f"❌ Salary file not found: {salary_file}")
        return
    
    with open(salary_file, "r", encoding="utf-8") as f:
        salary_data = json.load(f)
    
    print(f"📊 Loaded {len(salary_data)} players from salary data")
    
    # Track statistics
    updated_count = 0
    not_found_count = 0
    error_count = 0
    
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
            
            # Find the player in the database
            query = supabase.table("players").select("id, name, team_name")
            
            # Try exact name match first
            result = query.eq("name", player_name).execute()
            
            # If no exact match and we have team info, try with team
            if not result.data and normalized_team:
                result = query.eq("name", player_name).eq("team_name", normalized_team).execute()
            
            if not result.data:
                # Try case-insensitive match
                result = supabase.table("players").select("id, name, team_name").ilike("name", player_name).execute()
            
            if not result.data:
                print(f"❌ Player not found: {player_name} ({team_name})")
                not_found_count += 1
                continue
            
            # Update the player with salary data
            player_id = result.data[0]["id"]
            
            update_data = {
                "salary_2025_26": salaries["2025-26"],
                "salary_2026_27": salaries["2026-27"],
                "salary_2027_28": salaries["2027-28"],
                "salary_2028_29": salaries["2028-29"],
                "contract_years_remaining": contract_years
            }
            
            # Remove None values
            update_data = {k: v for k, v in update_data.items() if v is not None}
            
            supabase.table("players").update(update_data).eq("id", player_id).execute()
            
            print(f"✅ Updated: {player_name} ({team_name}) - {contract_years} years remaining")
            updated_count += 1
            
        except Exception as e:
            print(f"❌ Error updating {player_name}: {e}")
            error_count += 1
    
    print(f"\n📊 Import Summary:")
    print(f"   ✅ Successfully updated: {updated_count}")
    print(f"   ❌ Players not found: {not_found_count}")
    print(f"   ⚠️  Errors: {error_count}")
    print(f"   📈 Total processed: {len(salary_data)}")

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
