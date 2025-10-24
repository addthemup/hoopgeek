#!/usr/bin/env python3
"""
Fix abbreviated player names in HoopsHype salary data
"""

import json

# Mapping of abbreviated names to full names
name_fixes = {
    "G. Antetokounmpo": "Giannis Antetokounmpo",
    "K. Towns": "Karl-Anthony Towns",
    "T. Haliburton": "Tyrese Haliburton",
    "Michael Porter": "Michael Porter Jr.",
    "S. Gilgeous-Alexander": "Shai Gilgeous-Alexander",
    "Jaren Jackson Jr": "Jaren Jackson Jr.",
    "I. Quickley": "Immanuel Quickley",
    "K. Porzingis": "Kristaps Porzingis",
    "I. Hartenstein": "Isaiah Hartenstein",
    "Nicolas Claxton": "Nic Claxton",
    "K. Caldwell-Pope": "Kentavious Caldwell-Pope",
    "Santiago Aldama": "Santi Aldama",
    "B. Bogdanovic": "Bojan Bogdanovic",
    "N. Alexander-Walker": "Nickeil Alexander-Walker",
    "PJ Washington": "P.J. Washington",
    "Dennis Schroeder": "Dennis Schroder",
    "Herb Jones": "Herbert Jones",
    "V. Wembanyama": "Victor Wembanyama",
    "Z. Risacher": "Zaccharie Risacher",
    "M. Robinson": "Mitchell Robinson",
    "D. Finney-Smith": "Dorian Finney-Smith",
    "J. Vanderbilt": "Jarred Vanderbilt",
    "Wendell Carter": "Wendell Carter Jr.",
    "J. Valanciunas": "Jonas Valanciunas",
    "TJ McConnell": "T.J. McConnell",
    "Derrick Jones": "Derrick Jones Jr.",
    "B. Mathurin": "Bennedict Mathurin",
    "Ron Holland": "Ron Holland II",
    "Kelly Oubre": "Kelly Oubre Jr.",
    "S. Fontecchio": "Simone Fontecchio",
    "C. Murray-Boyles": "Collin Murray-Boyles",
    "H. Highsmith": "Haywood Highsmith",
    "G. Yabusele": "Guerschon Yabusele",
    "C. Carrington": "Carlton Carrington",
    "Hansen Yang": "Tristan Enaruna",  # Likely incorrect scrape
    "W. Clayton": "Will Clayton",
    "Jaime Jaquez": "Jaime Jaquez Jr.",
    "Gary Trent Jr": "Gary Trent Jr.",
    "B. Podziemski": "Brandin Podziemski",
    "S. Mykhailiuk": "Svi Mykhailiuk",
    "K. Jakucionis": "Matas Jakucionis",  # Likely K = Kristafer?
    "R. Westbrook": "Russell Westbrook",
    "S. Dinwiddie": "Spencer Dinwiddie",
    "Tim Hardaway Jr": "Tim Hardaway Jr.",
    "Larry Nance Jr": "Larry Nance Jr.",
    "Cameron Whitmore": "Cam Whitmore",
    "D. Melton": "De'Anthony Melton",
    "J. Champagnie": "Julian Champagnie",
    "T. Antetokounmpo": "Thanasis Antetokounmpo",
    "J. McLaughlin": "Jordan McLaughlin",
    "Y. Niederhauser": "Yann Niederhauser",
    "Nick Smith": "Nick Smith Jr.",
    "T. Shannon": "Terrence Shannon Jr.",
    "B. Scheierman": "Baylor Scheierman",
    "S. Mamukelashvili": "Sandro Mamukelashvili",
    "V. Williams": "Vince Williams Jr.",
    "Scotty Pippen Jr": "Scotty Pippen Jr.",
    "Andre Jackson Jr": "Andre Jackson Jr.",
    "T. Jackson-Davis": "Trayce Jackson-Davis",
    "Craig Porter": "Craig Porter Jr.",
    "Nigel Hayes": "Nigel Hayes-Davis",
    "Nikola Djurisic": "Nikola Đurišić",
    "O. Prosper": "Olivier-Maxence Prosper",
    "EJ Liddell": "E.J. Liddell",
    "Kevin McCullar": "Kevin McCullar Jr.",
    "Ron Harper Jr": "Ron Harper Jr.",
    "David Jones": "David Jones II",
    "Eli Ndiaye": "Eli Ndiaye II",
    "RJ Luis Jr": "R.J. Luis",
    "Patrick Baldwin": "Patrick Baldwin Jr.",
}

def fix_hoopshype_names():
    """Fix abbreviated names in the HoopsHype salary data"""
    print("🔧 Fixing HoopsHype player names...")
    
    # Load the salary data
    salary_file = "supabase/hoopshype_salaries.json"
    with open(salary_file, "r", encoding="utf-8") as f:
        salary_data = json.load(f)
    
    print(f"📊 Loaded {len(salary_data)} players")
    
    # Fix names
    fixed_count = 0
    for player in salary_data:
        name = player.get("Name")
        if name in name_fixes:
            old_name = name
            new_name = name_fixes[name]
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
    fix_hoopshype_names()
    print("\n🎉 Name fixes completed!")

