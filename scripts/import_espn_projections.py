#!/usr/bin/env python3
"""
Import ESPN Projections Script
Imports ESPN fantasy basketball player projections from JSON into the database.
"""

import os
import json
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

def manual_match_projections(supabase: Client) -> int:
    """Manually match ESPN projections to players using exact and fuzzy name matching"""
    print("   🔍 Fetching players for matching...")
    
    # Get active players first (most likely to be in ESPN projections)
    active_players_result = supabase.table('players').select('id, name, team_name, is_active').eq('is_active', True).execute()
    active_players = active_players_result.data if active_players_result.data else []
    
    # Get all players as fallback
    all_players_result = supabase.table('players').select('id, name, team_name, is_active').execute()
    all_players = all_players_result.data if all_players_result.data else []
    
    if not all_players:
        print("   ❌ No players found in database")
        return 0
    
    print(f"   📋 Found {len(active_players)} active players, {len(all_players)} total players")
    
    # Get all unmatched projections
    projections_result = supabase.table('espn_player_projections').select('id, espn_name, espn_team').is_('player_id', 'null').execute()
    projections = projections_result.data if projections_result.data else []
    
    if not projections:
        print("   ✅ All projections already matched")
        return 0
    
    print(f"   📊 Found {len(projections)} unmatched projections")
    
    matched_count = 0
    
    # Create lookup dictionaries for faster matching
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
    
    # Create lookups for active players first, then all players
    active_lookup = create_lookup_dict(active_players)
    all_lookup = create_lookup_dict(all_players)
    
    # Match projections
    for projection in projections:
        espn_name = projection['espn_name'].lower().strip()
        espn_team = projection['espn_team']
        
        # Try active players first
        player = None
        confidence = 0.0
        
        if espn_name in active_lookup:
            player = active_lookup[espn_name]
            confidence = 1.0
        elif espn_name in all_lookup:
            player = all_lookup[espn_name]
            confidence = 0.9  # Slightly lower confidence for inactive players
        
        if player:
            # Update the projection with the matched player
            try:
                supabase.table('espn_player_projections').update({
                    'player_id': player['id'],
                    'matched_at': 'now()',
                    'match_confidence': confidence
                }).eq('id', projection['id']).execute()
                
                matched_count += 1
                status = "🟢" if player['is_active'] else "🟡"
                print(f"   {status} {projection['espn_name']} → {player['name']} (Active: {player['is_active']})")
                
            except Exception as e:
                print(f"   ❌ Error updating {projection['espn_name']}: {e}")
    
    return matched_count

def parse_stat_value(value, is_integer=False):
    """Parse a stat value, handling empty strings and dashes."""
    if value == "" or value == "--" or value is None:
        return None
    try:
        # Remove leading dots for percentages
        if value.startswith('.'):
            parsed_value = float(value)
        else:
            parsed_value = float(value)
        
        # Convert to integer if requested (for GP field)
        if is_integer:
            return int(parsed_value)
        
        return parsed_value
    except (ValueError, TypeError):
        return None

def import_espn_projections(supabase: Client, json_file: str):
    """Import ESPN projections from JSON file, only importing those that match existing players"""
    if not os.path.exists(json_file):
        print(f"❌ File {json_file} does not exist")
        return
    
    with open(json_file, 'r', encoding='utf-8') as f:
        projections = json.load(f)
    
    print(f"📊 Loaded {len(projections)} ESPN projections from {json_file}")
    
    # Get all players for matching (with pagination to get ALL players)
    print("🔍 Fetching all players for matching...")
    all_players = []
    page_size = 1000
    offset = 0
    
    while True:
        result = supabase.table('players').select('id, name, team_name, is_active').limit(page_size).offset(offset).execute()
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
    
    # Create lookup dictionary for matching
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
    
    # Clear existing projections
    try:
        supabase.table("espn_player_projections").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("🗑️  Cleared existing ESPN projections")
    except Exception as e:
        print(f"⚠️  Warning: Could not clear existing projections: {e}")
    
    # Track statistics
    imported_count = 0
    skipped_count = 0
    error_count = 0
    matched_players = []
    unmatched_players = []
    
    print("\n🔍 Matching and importing projections...")
    
    # Process each projection
    for projection in projections:
        try:
            # Extract basic info
            espn_name = projection.get("Name", "")
            espn_team = projection.get("Team", "")
            espn_position = projection.get("Position", "")
            
            if not espn_name:
                print(f"⚠️  Skipping projection with no name")
                skipped_count += 1
                continue
            
            # Try to match the player
            espn_name_lower = espn_name.lower().strip()
            matched_player = None
            confidence = 0.0
            
            
            if espn_name_lower in player_lookup:
                matched_player = player_lookup[espn_name_lower]
                confidence = 1.0 if matched_player['is_active'] else 0.9
            
            if not matched_player:
                # Player not found - skip this projection
                unmatched_players.append({
                    'espn_name': espn_name,
                    'espn_team': espn_team,
                    'espn_position': espn_position
                })
                skipped_count += 1
                continue
            
            # Player found - import the projection
            matched_players.append({
                'espn_name': espn_name,
                'matched_name': matched_player['name'],
                'matched_team': matched_player['team_name'],
                'is_active': matched_player['is_active'],
                'confidence': confidence
            })
            
            # Extract 2025 statistics
            stats_2025 = projection.get("2025 Statistics", {})
            stats_2025_gp = parse_stat_value(stats_2025.get("GP"), is_integer=True)
            stats_2025_min = parse_stat_value(stats_2025.get("MIN"))
            stats_2025_fg_pct = parse_stat_value(stats_2025.get("FG%"))
            stats_2025_ft_pct = parse_stat_value(stats_2025.get("FT%"))
            stats_2025_3pm = parse_stat_value(stats_2025.get("3PM"))
            stats_2025_reb = parse_stat_value(stats_2025.get("REB"))
            stats_2025_ast = parse_stat_value(stats_2025.get("AST"))
            stats_2025_ato = parse_stat_value(stats_2025.get("A/TO"))
            stats_2025_stl = parse_stat_value(stats_2025.get("STL"))
            stats_2025_blk = parse_stat_value(stats_2025.get("BLK"))
            stats_2025_to = parse_stat_value(stats_2025.get("TO"))
            stats_2025_pts = parse_stat_value(stats_2025.get("PTS"))
            
            # Extract 2026 projections
            proj_2026 = projection.get("2026 Projections", {})
            proj_2026_gp = parse_stat_value(proj_2026.get("GP"), is_integer=True)
            proj_2026_min = parse_stat_value(proj_2026.get("MIN"))
            proj_2026_fg_pct = parse_stat_value(proj_2026.get("FG%"))
            proj_2026_ft_pct = parse_stat_value(proj_2026.get("FT%"))
            proj_2026_3pm = parse_stat_value(proj_2026.get("3PM"))
            proj_2026_reb = parse_stat_value(proj_2026.get("REB"))
            proj_2026_ast = parse_stat_value(proj_2026.get("AST"))
            proj_2026_ato = parse_stat_value(proj_2026.get("A/TO"))
            proj_2026_stl = parse_stat_value(proj_2026.get("STL"))
            proj_2026_blk = parse_stat_value(proj_2026.get("BLK"))
            proj_2026_to = parse_stat_value(proj_2026.get("TO"))
            proj_2026_pts = parse_stat_value(proj_2026.get("PTS"))
            
            # Extract 2026 outlook
            outlook_2026 = projection.get("2026 Outlook", "")
            
            # Insert into database with matched player_id
            supabase.table("espn_player_projections").insert({
                "espn_name": espn_name,
                "espn_team": espn_team,
                "espn_position": espn_position,
                "player_id": matched_player['id'],
                "matched_at": "now()",
                "match_confidence": confidence,
                "stats_2025_gp": stats_2025_gp,
                "stats_2025_min": stats_2025_min,
                "stats_2025_fg_pct": stats_2025_fg_pct,
                "stats_2025_ft_pct": stats_2025_ft_pct,
                "stats_2025_3pm": stats_2025_3pm,
                "stats_2025_reb": stats_2025_reb,
                "stats_2025_ast": stats_2025_ast,
                "stats_2025_ato": stats_2025_ato,
                "stats_2025_stl": stats_2025_stl,
                "stats_2025_blk": stats_2025_blk,
                "stats_2025_to": stats_2025_to,
                "stats_2025_pts": stats_2025_pts,
                "proj_2026_gp": proj_2026_gp,
                "proj_2026_min": proj_2026_min,
                "proj_2026_fg_pct": proj_2026_fg_pct,
                "proj_2026_ft_pct": proj_2026_ft_pct,
                "proj_2026_3pm": proj_2026_3pm,
                "proj_2026_reb": proj_2026_reb,
                "proj_2026_ast": proj_2026_ast,
                "proj_2026_ato": proj_2026_ato,
                "proj_2026_stl": proj_2026_stl,
                "proj_2026_blk": proj_2026_blk,
                "proj_2026_to": proj_2026_to,
                "proj_2026_pts": proj_2026_pts,
                "outlook_2026": outlook_2026
            }).execute()
            
            imported_count += 1
            
        except Exception as e:
            print(f"❌ Error importing projection for {espn_name}: {e}")
            error_count += 1
    
    # Print summary
    print(f"\n📊 IMPORT SUMMARY:")
    print(f"✅ Successfully imported: {imported_count} projections")
    print(f"⏭️  Skipped (no match): {skipped_count} projections")
    print(f"❌ Failed to import: {error_count} projections")
    
    # Show matched players
    if matched_players:
        print(f"\n🎯 MATCHED PLAYERS ({len(matched_players)}):")
        for match in matched_players:
            status = "🟢" if match['is_active'] else "🟡"
            print(f"   {status} {match['espn_name']} → {match['matched_name']} ({match['matched_team']}) - Active: {match['is_active']}")
    
    # Show unmatched players
    if unmatched_players:
        print(f"\n❌ UNMATCHED PLAYERS ({len(unmatched_players)}):")
        print("   These players need manual name fixes in the JSON file:")
        for unmatched in unmatched_players:
            print(f"   • {unmatched['espn_name']} ({unmatched['espn_team']}) - {unmatched['espn_position']}")
    
    print(f"\n💡 To fix unmatched players:")
    print(f"   1. Edit the JSON file: {json_file}")
    print(f"   2. Change the 'Name' field to match a player in your database")
    print(f"   3. Re-run this script")

def main():
    """Main function"""
    try:
        supabase = get_supabase_client()
        import_espn_projections(supabase, "supabase/espn_projections.json")
        print("\n🎉 ESPN projections import completed!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
