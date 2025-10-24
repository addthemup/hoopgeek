#!/usr/bin/env python3
"""
Fix player names in HoopsHype salary data to match database exactly
"""

import json

# Mapping of names in JSON to correct database names
name_mapping = {
    "Eli Ndiaye": "Eli John Ndiaye",
    "K. Porzingis": "Kristaps Porziņģis",
    "N. Alexander-Walker": "Nickeil Alexander-Walker",
    "Nikola Djurisic": "Nikola Đurišić",
    "Z. Risacher": "Zaccharie Risacher",
    "EJ Liddell": "E.J. Liddell",
    "H. Highsmith": "Haywood Highsmith",
    "Michael Porter": "Michael Porter Jr.",
    "Nicolas Claxton": "Nic Claxton",
    "B. Scheierman": "Baylor Scheierman",
    "RJ Luis Jr": "RJ Luis Jr.",
    "Ron Harper Jr": "Ron Harper Jr.",
    "S. Dinwiddie": "Spencer Dinwiddie",
    "Craig Porter": "Craig Porter Jr.",
    "Larry Nance Jr": "Larry Nance Jr.",
    "Hansen Yang": "Tristan Enaruna",
    "PJ Washington": "P.J. Washington",
    "Tim Hardaway Jr": "Tim Hardaway Jr.",
    "Ron Holland": "Ronald Holland II",
    "B. Podziemski": "Brandin Podziemski",
    "D. Melton": "De'Anthony Melton",
    "T. Jackson-Davis": "Trayce Jackson-Davis",
    "D. Finney-Smith": "Dorian Finney-Smith",
    "Jabari Smith": "Jabari Smith Jr.",
    "B. Mathurin": "Bennedict Mathurin",
    "T. Haliburton": "Tyrese Haliburton",
    "TJ McConnell": "T.J. McConnell",
    "B. Bogdanovic": "Bogdan Bogdanović",
    "Derrick Jones": "Derrick Jones Jr.",
    "Patrick Baldwin": "Patrick Baldwin Jr.",
    "Y. Niederhauser": "Yanic Konan Niederhäuser",
    "J. Vanderbilt": "Jarred Vanderbilt",
    "Nick Smith": "Nick Smith Jr.",
    "Jaren Jackson Jr": "Jaren Jackson Jr.",
    "K. Caldwell-Pope": "Kentavious Caldwell-Pope",
    "Santiago Aldama": "Santi Aldama",
    "Scotty Pippen Jr": "Scotty Pippen Jr.",
    "V. Williams": "Vince Williams Jr.",
    "Jaime Jaquez": "Jaime Jaquez Jr.",
    "K. Jakucionis": "Kasparas Jakučionis",
    "S. Fontecchio": "Simone Fontecchio",
    "Andre Jackson Jr": "Andre Jackson Jr.",
    "Gary Trent Jr": "Gary Trent Jr.",
    "G. Antetokounmpo": "Giannis Antetokounmpo",
    "Kevin Porter": "Kevin Porter Jr.",
    "T. Antetokounmpo": "Thanasis Antetokounmpo",
    "T. Shannon": "Terrence Shannon Jr.",
    "Herb Jones": "Herbert Jones",
    "G. Yabusele": "Guerschon Yabusele",
    "K. Towns": "Karl-Anthony Towns",
    "Kevin McCullar": "Kevin McCullar Jr.",
    "M. Robinson": "Mitchell Robinson",
    "I. Hartenstein": "Isaiah Hartenstein",
    "S. Gilgeous-Alexander": "Shai Gilgeous-Alexander",
    "Wendell Carter": "Wendell Carter Jr.",
    "Kelly Oubre": "Kelly Oubre Jr.",
    "Nigel Hayes": "Nigel Hayes-Davis",
    "Dennis Schroeder": "Dennis Schröder",
    "David Jones": "David Jones Garcia",
    "J. McLaughlin": "Jordan McLaughlin",
    "J. Champagnie": "Julian Champagnie",
    "V. Wembanyama": "Victor Wembanyama",
    "C. Murray-Boyles": "Collin Murray-Boyles",
    "I. Quickley": "Immanuel Quickley",
    "S. Mamukelashvili": "Sandro Mamukelashvili",
    "S. Mykhailiuk": "Svi Mykhailiuk",
    "W. Clayton": "Walter Clayton Jr.",
    "C. Carrington": "Bub Carrington",
    "Cameron Whitmore": "Cam Whitmore",
    "J. Valanciunas": "Jonas Valančiūnas",
    "O. Prosper": "Olivier-Maxence Prosper",
    "R. Westbrook": "Russell Westbrook",
}

def fix_player_names():
    """Fix player names in the HoopsHype salary data"""
    print("🔧 Fixing player names to match database...")
    
    # Load the salary data
    salary_file = "scripts/supabase/hoopshype_salaries.json"
    with open(salary_file, "r", encoding="utf-8") as f:
        salary_data = json.load(f)
    
    print(f"📊 Loaded {len(salary_data)} players")
    
    # Fix names
    fixed_count = 0
    for player in salary_data:
        name = player.get("Name")
        if name in name_mapping:
            old_name = name
            new_name = name_mapping[name]
            player["Name"] = new_name
            print(f"   ✅ {old_name} → {new_name}")
            fixed_count += 1
    
    # Save the updated data
    with open(salary_file, "w", encoding="utf-8") as f:
        json.dump(salary_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Fixed {fixed_count} player names")
    print(f"💾 Saved to {salary_file}")
    
    return fixed_count

if __name__ == "__main__":
    fix_player_names()
    print("\n🎉 Name fixes completed!")

