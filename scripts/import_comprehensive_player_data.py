#!/usr/bin/env python3
"""
Import comprehensive player data using CommonPlayerInfo endpoint
This provides much more detailed information than PlayerIndex
"""

import os
import time
import requests
from supabase import create_client, Client
from nba_api.stats.endpoints import CommonPlayerInfo
import pandas as pd
from typing import Dict, Any, Optional

# Supabase setup
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def safe_str(value: Any) -> Optional[str]:
    """Safely convert value to string, handling None and empty values"""
    if value is None or value == '' or pd.isna(value):
        return None
    return str(value).strip()

def safe_int(value: Any) -> Optional[int]:
    """Safely convert value to int, handling None and empty values"""
    if value is None or value == '' or pd.isna(value):
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None

def safe_float(value: Any) -> Optional[float]:
    """Safely convert value to float, handling None and empty values"""
    if value is None or value == '' or pd.isna(value):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None

def parse_height(height_str: str) -> Optional[str]:
    """Parse height string like '6-9' to inches or return as-is"""
    if not height_str or pd.isna(height_str):
        return None
    
    height_str = str(height_str).strip()
    
    # If it's already in inches format, return as-is
    if height_str.isdigit():
        return height_str
    
    # Parse feet-inches format like "6-9"
    if '-' in height_str:
        try:
            feet, inches = height_str.split('-')
            total_inches = int(feet) * 12 + int(inches)
            return str(total_inches)
        except (ValueError, IndexError):
            return height_str
    
    return height_str

def parse_birthdate(birthdate_str: str) -> Optional[str]:
    """Parse birthdate string to date format"""
    if not birthdate_str or pd.isna(birthdate_str):
        return None
    
    try:
        # Handle ISO format like "1986-06-03T00:00:00"
        if 'T' in birthdate_str:
            return birthdate_str.split('T')[0]
        return birthdate_str
    except:
        return None

def get_all_players(supabase: Client) -> Dict[int, Dict[str, Any]]:
    """Get all players from database"""
    print("📋 Fetching all players from database...")
    
    try:
        # Get all players using pagination
        all_players = []
        page_size = 1000
        offset = 0
        
        while True:
            result = supabase.table('players').select('id, nba_player_id, name').limit(page_size).offset(offset).execute()
            
            if not result.data:
                break
                
            all_players.extend(result.data)
            offset += page_size
            
            if len(result.data) < page_size:
                break
        
        players = {player['nba_player_id']: player for player in all_players}
        print(f"✅ Found {len(players)} players in database")
        
        return players
    except Exception as e:
        print(f"❌ Error fetching players: {e}")
        return {}

def update_player_comprehensive_data(supabase: Client, nba_player_id: int, player_data: Dict[str, Any]) -> bool:
    """Update player with comprehensive data from CommonPlayerInfo"""
    try:
        # Parse the comprehensive data
        parsed_data = {
            'nba_player_id': int(player_data.get('PERSON_ID', 0)),
            'first_name': safe_str(player_data.get('FIRST_NAME')),
            'last_name': safe_str(player_data.get('LAST_NAME')),
            'player_slug': safe_str(player_data.get('PLAYER_SLUG')),
            'birth_date': parse_birthdate(player_data.get('BIRTHDATE')),  # Fixed: birth_date not birthdate
            'college': safe_str(player_data.get('SCHOOL')),
            'country': safe_str(player_data.get('COUNTRY')),
            'height': parse_height(player_data.get('HEIGHT')),
            'weight': safe_int(player_data.get('WEIGHT')),
            'years_pro': safe_int(player_data.get('SEASON_EXP')),
            'jersey_number': safe_str(player_data.get('JERSEY')),
            'position': safe_str(player_data.get('POSITION')),
            'roster_status': safe_str(player_data.get('ROSTERSTATUS')),
            'team_id': safe_int(player_data.get('TEAM_ID')),
            'team_name': safe_str(player_data.get('TEAM_NAME')),
            'team_abbreviation': safe_str(player_data.get('TEAM_ABBREVIATION')),
            'team_slug': safe_str(player_data.get('TEAM_CODE')),
            'team_city': safe_str(player_data.get('TEAM_CITY')),
            'from_year': safe_int(player_data.get('FROM_YEAR')),
            'to_year': safe_int(player_data.get('TO_YEAR')),
            'draft_year': safe_int(player_data.get('DRAFT_YEAR')),
            'draft_round': safe_int(player_data.get('DRAFT_ROUND')),
            'draft_number': safe_int(player_data.get('DRAFT_NUMBER')),
            'is_active': player_data.get('ROSTERSTATUS') == 'Active',
            'is_rookie': safe_int(player_data.get('SEASON_EXP', 0)) == 0,
        }
        
        # Update the player in the database
        result = supabase.table('players').update(parsed_data).eq('nba_player_id', nba_player_id).execute()
        
        if result.data:
            print(f"✅ Updated {player_data.get('DISPLAY_FIRST_LAST', 'Unknown Player')} with comprehensive data")
            return True
        else:
            print(f"❌ Failed to update {player_data.get('DISPLAY_FIRST_LAST', 'Unknown Player')}")
            return False
            
    except Exception as e:
        print(f"❌ Error updating player {nba_player_id}: {e}")
        return False

def import_comprehensive_player_data(active_only: bool = True) -> None:
    """
    Main function to import comprehensive player data using CommonPlayerInfo
    
    Args:
        active_only: If True, only import active players
    """
    print("🚀 Starting comprehensive player data import...")
    print(f"📊 Configuration: active_only={active_only}")
    
    # Get all players from database
    players = get_all_players(supabase)
    
    if not players:
        print("❌ No players found in database")
        return
    
    # Process players
    successful_updates = 0
    failed_updates = 0
    not_found = 0
    
    print(f"📝 Processing {len(players)} players...")
    
    for i, (nba_player_id, player_info) in enumerate(players.items(), 1):
        try:
            # Get comprehensive player data from NBA API
            player_info_api = CommonPlayerInfo(player_id=nba_player_id)
            data_frames = player_info_api.get_data_frames()
            
            if not data_frames or len(data_frames) == 0:
                print(f"⚠️ No data found for player {player_info['name']} (ID: {nba_player_id})")
                not_found += 1
                continue
            
            # Get the main player data (first dataframe)
            main_data = data_frames[0]
            
            if main_data.empty:
                print(f"⚠️ Empty data for player {player_info['name']} (ID: {nba_player_id})")
                not_found += 1
                continue
            
            # Convert to dict for easier handling
            player_data = main_data.iloc[0].to_dict()
            
            # Update in database
            if update_player_comprehensive_data(supabase, nba_player_id, player_data):
                successful_updates += 1
            else:
                failed_updates += 1
            
            # Progress indicator
            if i % 50 == 0:
                print(f"📈 Progress: {i}/{len(players)} players processed")
            
            # Rate limiting - be more conservative with CommonPlayerInfo
            time.sleep(0.2)  # 200ms delay between requests
            
        except Exception as e:
            print(f"❌ Error processing player {player_info['name']} (ID: {nba_player_id}): {e}")
            failed_updates += 1
            continue
    
    # Summary
    print("\n" + "="*50)
    print("🎉 Comprehensive Player Data Import Complete!")
    print(f"📊 Summary:")
    print(f"   Total players processed: {len(players)}")
    print(f"   ✅ Successful updates: {successful_updates}")
    print(f"   ⚠️  Players not found in API: {not_found}")
    print(f"   ❌ Failed updates: {failed_updates}")
    print(f"   📈 Success rate: {(successful_updates / len(players) * 100):.1f}%")
    print("="*50)

if __name__ == "__main__":
    import_comprehensive_player_data(active_only=True)