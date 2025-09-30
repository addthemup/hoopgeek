#!/usr/bin/env python3
"""
Test NBA Players Import Script with Mock Data
Tests the database import functionality with sample NBA players
"""

import os
import sys
import json
import time
from datetime import datetime
from supabase import create_client, Client
from typing import List, Dict, Any

# Configuration
SUPABASE_URL = "https://lsnqmdeagfzuvrypiiwi.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbnFtZGVhZ2Z6dXZyeXBpaXdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI1MTU5MSwiZXhwIjoyMDc0ODI3NTkxfQ.uOD1oFhjd6ISP7XJu7OtYYG_SwU7uZR74h8byY3HNPo"
USER_UID = "fd58dfb7-ad5d-43e2-b2c4-c254e2a29211"

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    print("🔧 Setting up Supabase client...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Supabase client initialized")
    return supabase

def get_mock_players() -> List[Dict[str, Any]]:
    """Get mock NBA players data for testing"""
    print("🏀 Using mock NBA players data for testing...")
    
    mock_players = [
        {
            'PERSON_ID': 2544,
            'DISPLAY_FIRST_LAST': 'LeBron James',
            'POSITION': 'F',
            'TEAM_ID': 1610612747,
            'TEAM_NAME': 'Los Angeles Lakers',
            'TEAM_ABBREVIATION': 'LAL',
            'JERSEY': '6',
            'HEIGHT': '6-9',
            'WEIGHT': 250,
            'BIRTHDATE': '1984-12-30T00:00:00',
            'COUNTRY': 'USA',
            'SCHOOL': 'St. Vincent-St. Mary HS (OH)',
            'DRAFT_YEAR': 2003,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 1,
            'FROM_YEAR': 2003,
            'TO_YEAR': None,
            'SEASON_EXP': 21
        },
        {
            'PERSON_ID': 201939,
            'DISPLAY_FIRST_LAST': 'Stephen Curry',
            'POSITION': 'G',
            'TEAM_ID': 1610612744,
            'TEAM_NAME': 'Golden State Warriors',
            'TEAM_ABBREVIATION': 'GSW',
            'JERSEY': '30',
            'HEIGHT': '6-2',
            'WEIGHT': 185,
            'BIRTHDATE': '1988-03-14T00:00:00',
            'COUNTRY': 'USA',
            'SCHOOL': 'Davidson',
            'DRAFT_YEAR': 2009,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 7,
            'FROM_YEAR': 2009,
            'TO_YEAR': None,
            'SEASON_EXP': 15
        },
        {
            'PERSON_ID': 201142,
            'DISPLAY_FIRST_LAST': 'Kevin Durant',
            'POSITION': 'F',
            'TEAM_ID': 1610612756,
            'TEAM_NAME': 'Phoenix Suns',
            'TEAM_ABBREVIATION': 'PHX',
            'JERSEY': '35',
            'HEIGHT': '6-10',
            'WEIGHT': 240,
            'BIRTHDATE': '1988-09-29T00:00:00',
            'COUNTRY': 'USA',
            'SCHOOL': 'Texas',
            'DRAFT_YEAR': 2007,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 2,
            'FROM_YEAR': 2007,
            'TO_YEAR': None,
            'SEASON_EXP': 17
        },
        {
            'PERSON_ID': 203507,
            'DISPLAY_FIRST_LAST': 'Giannis Antetokounmpo',
            'POSITION': 'F',
            'TEAM_ID': 1610612749,
            'TEAM_NAME': 'Milwaukee Bucks',
            'TEAM_ABBREVIATION': 'MIL',
            'JERSEY': '34',
            'HEIGHT': '6-11',
            'WEIGHT': 242,
            'BIRTHDATE': '1994-12-06T00:00:00',
            'COUNTRY': 'Greece',
            'SCHOOL': 'Filathlitikos (Greece)',
            'DRAFT_YEAR': 2013,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 15,
            'FROM_YEAR': 2013,
            'TO_YEAR': None,
            'SEASON_EXP': 11
        },
        {
            'PERSON_ID': 1629029,
            'DISPLAY_FIRST_LAST': 'Luka Doncic',
            'POSITION': 'G',
            'TEAM_ID': 1610612742,
            'TEAM_NAME': 'Dallas Mavericks',
            'TEAM_ABBREVIATION': 'DAL',
            'JERSEY': '77',
            'HEIGHT': '6-7',
            'WEIGHT': 230,
            'BIRTHDATE': '1999-02-28T00:00:00',
            'COUNTRY': 'Slovenia',
            'SCHOOL': 'Real Madrid (Spain)',
            'DRAFT_YEAR': 2018,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 3,
            'FROM_YEAR': 2018,
            'TO_YEAR': None,
            'SEASON_EXP': 6
        },
        {
            'PERSON_ID': 203999,
            'DISPLAY_FIRST_LAST': 'Joel Embiid',
            'POSITION': 'C',
            'TEAM_ID': 1610612755,
            'TEAM_NAME': 'Philadelphia 76ers',
            'TEAM_ABBREVIATION': 'PHI',
            'JERSEY': '21',
            'HEIGHT': '7-0',
            'WEIGHT': 280,
            'BIRTHDATE': '1994-03-16T00:00:00',
            'COUNTRY': 'Cameroon',
            'SCHOOL': 'Kansas',
            'DRAFT_YEAR': 2014,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 3,
            'FROM_YEAR': 2014,
            'TO_YEAR': None,
            'SEASON_EXP': 10
        },
        {
            'PERSON_ID': 1628368,
            'DISPLAY_FIRST_LAST': 'Jayson Tatum',
            'POSITION': 'F',
            'TEAM_ID': 1610612738,
            'TEAM_NAME': 'Boston Celtics',
            'TEAM_ABBREVIATION': 'BOS',
            'JERSEY': '0',
            'HEIGHT': '6-8',
            'WEIGHT': 210,
            'BIRTHDATE': '1998-03-03T00:00:00',
            'COUNTRY': 'USA',
            'SCHOOL': 'Duke',
            'DRAFT_YEAR': 2017,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 3,
            'FROM_YEAR': 2017,
            'TO_YEAR': None,
            'SEASON_EXP': 7
        },
        {
            'PERSON_ID': 201935,
            'DISPLAY_FIRST_LAST': 'James Harden',
            'POSITION': 'G',
            'TEAM_ID': 1610612746,
            'TEAM_NAME': 'LA Clippers',
            'TEAM_ABBREVIATION': 'LAC',
            'JERSEY': '1',
            'HEIGHT': '6-5',
            'WEIGHT': 220,
            'BIRTHDATE': '1989-08-26T00:00:00',
            'COUNTRY': 'USA',
            'SCHOOL': 'Arizona State',
            'DRAFT_YEAR': 2009,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 3,
            'FROM_YEAR': 2009,
            'TO_YEAR': None,
            'SEASON_EXP': 15
        },
        {
            'PERSON_ID': 203954,
            'DISPLAY_FIRST_LAST': 'Nikola Jokic',
            'POSITION': 'C',
            'TEAM_ID': 1610612743,
            'TEAM_NAME': 'Denver Nuggets',
            'TEAM_ABBREVIATION': 'DEN',
            'JERSEY': '15',
            'HEIGHT': '6-11',
            'WEIGHT': 284,
            'BIRTHDATE': '1995-02-19T00:00:00',
            'COUNTRY': 'Serbia',
            'SCHOOL': 'Mega Basket (Serbia)',
            'DRAFT_YEAR': 2014,
            'DRAFT_ROUND': 2,
            'DRAFT_NUMBER': 41,
            'FROM_YEAR': 2014,
            'TO_YEAR': None,
            'SEASON_EXP': 10
        },
        {
            'PERSON_ID': 203076,
            'DISPLAY_FIRST_LAST': 'Anthony Davis',
            'POSITION': 'F-C',
            'TEAM_ID': 1610612747,
            'TEAM_NAME': 'Los Angeles Lakers',
            'TEAM_ABBREVIATION': 'LAL',
            'JERSEY': '3',
            'HEIGHT': '6-10',
            'WEIGHT': 253,
            'BIRTHDATE': '1993-03-11T00:00:00',
            'COUNTRY': 'USA',
            'SCHOOL': 'Kentucky',
            'DRAFT_YEAR': 2012,
            'DRAFT_ROUND': 1,
            'DRAFT_NUMBER': 1,
            'FROM_YEAR': 2012,
            'TO_YEAR': None,
            'SEASON_EXP': 12
        }
    ]
    
    print(f"📊 Using {len(mock_players)} mock players for testing")
    return mock_players

def parse_player_data(player: Dict[str, Any]) -> Dict[str, Any]:
    """Parse and clean player data for database insertion"""
    
    # Parse birth date
    birth_date = None
    if player.get('BIRTHDATE'):
        try:
            birth_date = player['BIRTHDATE'].split('T')[0]  # Remove time part
        except:
            birth_date = None
    
    # Parse draft information
    draft_year = None
    draft_round = None
    draft_number = None
    
    if player.get('DRAFT_YEAR'):
        try:
            draft_year = int(player['DRAFT_YEAR'])
        except:
            draft_year = None
    
    if player.get('DRAFT_ROUND'):
        try:
            draft_round = int(player['DRAFT_ROUND'])
        except:
            draft_round = None
    
    if player.get('DRAFT_NUMBER'):
        try:
            draft_number = int(player['DRAFT_NUMBER'])
        except:
            draft_number = None
    
    # Parse weight
    weight = None
    if player.get('WEIGHT'):
        try:
            weight = int(player['WEIGHT'])
        except:
            weight = None
    
    # Determine if player is active
    is_active = player.get('TO_YEAR') is None or player.get('TO_YEAR', 0) >= 2024
    
    # Determine if player is rookie
    is_rookie = player.get('SEASON_EXP', 0) == 0
    
    # Parse years pro
    years_pro = player.get('SEASON_EXP', 0) or 0
    
    return {
        'nba_player_id': player['PERSON_ID'],
        'name': player['DISPLAY_FIRST_LAST'],
        'first_name': player['DISPLAY_FIRST_LAST'].split(' ')[0] if player.get('DISPLAY_FIRST_LAST') else None,
        'last_name': ' '.join(player['DISPLAY_FIRST_LAST'].split(' ')[1:]) if player.get('DISPLAY_FIRST_LAST') and len(player['DISPLAY_FIRST_LAST'].split(' ')) > 1 else None,
        'position': player.get('POSITION'),
        'team_id': player.get('TEAM_ID'),
        'team_name': player.get('TEAM_NAME'),
        'team_abbreviation': player.get('TEAM_ABBREVIATION'),
        'jersey_number': player.get('JERSEY'),
        'height': player.get('HEIGHT'),
        'weight': weight,
        'age': None,  # Will be calculated based on birth date if needed
        'birth_date': birth_date,
        'birth_city': None,  # Not available in this endpoint
        'birth_state': None,  # Not available in this endpoint
        'birth_country': player.get('COUNTRY'),
        'college': player.get('SCHOOL'),
        'draft_year': draft_year,
        'draft_round': draft_round,
        'draft_number': draft_number,
        'salary': 0,  # Will be updated separately with salary data
        'is_active': is_active,
        'is_rookie': is_rookie,
        'years_pro': years_pro,
        'from_year': player.get('FROM_YEAR'),
        'to_year': player.get('TO_YEAR')
    }

def import_players_to_database(supabase: Client, players: List[Dict[str, Any]]) -> Dict[str, int]:
    """Import players to Supabase database using upsert function"""
    print("💾 Importing players to database...")
    
    stats = {
        'total': len(players),
        'imported': 0,
        'updated': 0,
        'errors': 0
    }
    
    for i, player in enumerate(players):
        try:
            # Parse player data
            player_data = parse_player_data(player)
            
            print(f"📝 Processing {player_data['name']} (NBA ID: {player_data['nba_player_id']})")
            
            # Call the upsert function
            result = supabase.rpc('upsert_player', {
                'p_nba_player_id': player_data['nba_player_id'],
                'p_name': player_data['name'],
                'p_first_name': player_data['first_name'],
                'p_last_name': player_data['last_name'],
                'p_position': player_data['position'],
                'p_team_id': player_data['team_id'],
                'p_team_name': player_data['team_name'],
                'p_team_abbreviation': player_data['team_abbreviation'],
                'p_jersey_number': player_data['jersey_number'],
                'p_height': player_data['height'],
                'p_weight': player_data['weight'],
                'p_age': player_data['age'],
                'p_birth_date': player_data['birth_date'],
                'p_birth_city': player_data['birth_city'],
                'p_birth_state': player_data['birth_state'],
                'p_birth_country': player_data['birth_country'],
                'p_college': player_data['college'],
                'p_draft_year': player_data['draft_year'],
                'p_draft_round': player_data['draft_round'],
                'p_draft_number': player_data['draft_number'],
                'p_salary': player_data['salary'],
                'p_is_active': player_data['is_active'],
                'p_is_rookie': player_data['is_rookie'],
                'p_years_pro': player_data['years_pro'],
                'p_from_year': player_data['from_year'],
                'p_to_year': player_data['to_year']
            }).execute()
            
            if result.data:
                # Check if this was an insert or update by querying the database
                existing = supabase.table('players').select('id').eq('nba_player_id', player_data['nba_player_id']).execute()
                
                if existing.data:
                    stats['updated'] += 1
                    print(f"   ✅ Updated existing player")
                else:
                    stats['imported'] += 1
                    print(f"   ✅ Imported new player")
            else:
                stats['errors'] += 1
                print(f"   ❌ Error upserting player")
            
        except Exception as e:
            stats['errors'] += 1
            print(f"❌ Error processing player {player.get('DISPLAY_FIRST_LAST', 'Unknown')}: {e}")
    
    return stats

def main():
    """Main function"""
    print("🚀 Starting NBA Players Import Test Script (Mock Data)")
    print(f"👤 User UID: {USER_UID}")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)
    
    try:
        # Setup
        supabase = setup_supabase()
        
        # Get mock players
        players = get_mock_players()
        
        # Import to database
        stats = import_players_to_database(supabase, players)
        
        # Print final results
        print("-" * 60)
        print("🎉 Import completed successfully!")
        print(f"📊 Final Statistics:")
        print(f"   Total players processed: {stats['total']}")
        print(f"   New players imported: {stats['imported']}")
        print(f"   Existing players updated: {stats['updated']}")
        print(f"   Errors: {stats['errors']}")
        print(f"🕐 Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Verify import
        print("\n🔍 Verifying import...")
        result = supabase.table('players').select('id', count='exact').execute()
        total_in_db = result.count
        print(f"✅ Total players in database: {total_in_db}")
        
        # Show some sample players
        print("\n📋 Sample of imported players:")
        sample = supabase.table('players').select('name, position, team_name, is_active').limit(5).execute()
        for player in sample.data:
            status = "Active" if player['is_active'] else "Inactive"
            print(f"   • {player['name']} ({player['position']}) - {player['team_name']} - {status}")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
