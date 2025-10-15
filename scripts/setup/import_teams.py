#!/usr/bin/env python3
"""
NBA Teams Import Script

This script imports NBA team data from the NBA API using the TeamDetails endpoint.
It fetches comprehensive team information including:
- Team background (arena, owner, coach, etc.)
- Team history
- Team awards (championships, conference, division)
- Hall of Fame members
- Retired numbers
- Social media links

Usage:
    python3 import_teams.py

Environment Variables Required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_KEY - Your Supabase service role key
"""

import os
import sys
import time
from typing import Dict, List, Optional, Any
from supabase import create_client, Client
from nba_api.stats.endpoints import teamdetails
from nba_api.stats.static import teams

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def get_supabase_client() -> Client:
    """Initialize and return Supabase client."""
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        sys.exit(1)
    
    return create_client(supabase_url, supabase_key)

def get_all_nba_teams() -> List[Dict[str, Any]]:
    """Get all NBA teams from the nba_api static data."""
    try:
        nba_teams = teams.get_teams()
        print(f"✅ Found {len(nba_teams)} NBA teams")
        return nba_teams
    except Exception as e:
        print(f"❌ Error fetching NBA teams: {e}")
        return []

def extract_social_media_links(social_sites: List[Dict]) -> Dict[str, Optional[str]]:
    """Extract social media links from team social sites data."""
    social_links = {
        'website': None,
        'twitter': None,
        'instagram': None,
        'facebook': None,
        'youtube': None
    }
    
    for site in social_sites:
        account_type = site.get('ACCOUNTTYPE', '').lower()
        website_link = site.get('WEBSITE_LINK', '')
        
        if 'website' in account_type or 'official' in account_type:
            social_links['website'] = website_link
        elif 'twitter' in account_type:
            social_links['twitter'] = website_link
        elif 'instagram' in account_type:
            social_links['instagram'] = website_link
        elif 'facebook' in account_type:
            social_links['facebook'] = website_link
        elif 'youtube' in account_type:
            social_links['youtube'] = website_link
    
    return social_links

def import_team_data(supabase: Client, team_id: int) -> bool:
    """Import comprehensive data for a single team."""
    try:
        print(f"📊 Fetching data for team ID: {team_id}")
        
        # Fetch team details from NBA API
        team_details = teamdetails.TeamDetails(team_id=team_id)
        
        # Extract team background data
        team_background = team_details.team_background.get_data_frame()
        if team_background.empty:
            print(f"⚠️ No background data found for team ID: {team_id}")
            return False
        
        bg = team_background.iloc[0]
        
        # Extract social media links
        social_sites = team_details.team_social_sites.get_data_frame()
        social_links = extract_social_media_links(social_sites.to_dict('records'))
        
        # Upsert main team record
        team_uuid = supabase.rpc('upsert_nba_team', {
            'p_team_id': int(bg['TEAM_ID']),
            'p_abbreviation': bg['ABBREVIATION'],
            'p_nickname': bg['NICKNAME'],
            'p_city': bg['CITY'],
            'p_year_founded': int(bg['YEARFOUNDED']) if bg['YEARFOUNDED'] else None,
            'p_arena': bg['ARENA'] if bg['ARENA'] else None,
            'p_arena_capacity': int(bg['ARENACAPACITY']) if bg['ARENACAPACITY'] else None,
            'p_owner': bg['OWNER'] if bg['OWNER'] else None,
            'p_general_manager': bg['GENERALMANAGER'] if bg['GENERALMANAGER'] else None,
            'p_head_coach': bg['HEADCOACH'] if bg['HEADCOACH'] else None,
            'p_d_league_affiliation': bg['DLEAGUEAFFILIATION'] if bg['DLEAGUEAFFILIATION'] else None,
            'p_website': social_links['website'],
            'p_twitter': social_links['twitter'],
            'p_instagram': social_links['instagram'],
            'p_facebook': social_links['facebook'],
            'p_youtube': social_links['youtube']
        }).execute()
        
        print(f"✅ Upserted team: {bg['CITY']} {bg['NICKNAME']}")
        
        # Import team history
        team_history = team_details.team_history.get_data_frame()
        for _, history in team_history.iterrows():
            supabase.rpc('add_team_history', {
                'p_team_id': int(bg['TEAM_ID']),
                'p_city': history['CITY'],
                'p_nickname': history['NICKNAME'],
                'p_year_founded': int(history['YEARFOUNDED']) if history['YEARFOUNDED'] else None,
                'p_year_active_till': int(history['YEARACTIVETILL']) if history['YEARACTIVETILL'] else None
            }).execute()
        
        if not team_history.empty:
            print(f"✅ Added {len(team_history)} history records")
        
        # Import team awards
        awards_data = [
            ('championship', team_details.team_awards_championships.get_data_frame()),
            ('conference', team_details.team_awards_conf.get_data_frame()),
            ('division', team_details.team_awards_div.get_data_frame())
        ]
        
        total_awards = 0
        for award_type, awards_df in awards_data:
            for _, award in awards_df.iterrows():
                supabase.rpc('add_team_award', {
                    'p_team_id': int(bg['TEAM_ID']),
                    'p_award_type': award_type,
                    'p_year_awarded': int(award['YEARAWARDED']) if award['YEARAWARDED'] else None,
                    'p_opposite_team': award['OPPOSITETEAM'] if award['OPPOSITETEAM'] else None
                }).execute()
                total_awards += 1
        
        if total_awards > 0:
            print(f"✅ Added {total_awards} award records")
        
        # Import Hall of Fame members
        hof_df = team_details.team_hof.get_data_frame()
        for _, hof in hof_df.iterrows():
            supabase.rpc('add_team_hof', {
                'p_team_id': int(bg['TEAM_ID']),
                'p_player_name': hof['PLAYER'],
                'p_player_id': int(hof['PLAYERID']) if hof['PLAYERID'] else None,
                'p_position': hof['POSITION'] if hof['POSITION'] else None,
                'p_jersey': hof['JERSEY'] if hof['JERSEY'] else None,
                'p_seasons_with_team': int(hof['SEASONSWITHTEAM']) if hof['SEASONSWITHTEAM'] else None,
                'p_year': int(hof['YEAR']) if hof['YEAR'] else None
            }).execute()
        
        if not hof_df.empty:
            print(f"✅ Added {len(hof_df)} Hall of Fame records")
        
        # Import retired numbers
        retired_df = team_details.team_retired.get_data_frame()
        for _, retired in retired_df.iterrows():
            supabase.rpc('add_team_retired', {
                'p_team_id': int(bg['TEAM_ID']),
                'p_player_name': retired['PLAYER'],
                'p_player_id': int(retired['PLAYERID']) if retired['PLAYERID'] else None,
                'p_position': retired['POSITION'] if retired['POSITION'] else None,
                'p_jersey': retired['JERSEY'] if retired['JERSEY'] else None,
                'p_seasons_with_team': int(retired['SEASONSWITHTEAM']) if retired['SEASONSWITHTEAM'] else None,
                'p_year': int(retired['YEAR']) if retired['YEAR'] else None
            }).execute()
        
        if not retired_df.empty:
            print(f"✅ Added {len(retired_df)} retired number records")
        
        return True
        
    except Exception as e:
        print(f"❌ Error importing team {team_id}: {e}")
        return False

def main():
    """Main function to import all NBA team data."""
    print("🚀 Starting NBA teams import...")
    
    # Initialize Supabase client
    supabase = get_supabase_client()
    
    # Get all NBA teams
    nba_teams = get_all_nba_teams()
    if not nba_teams:
        print("❌ No teams found to import")
        return
    
    # Import data for each team
    successful_imports = 0
    failed_imports = 0
    
    for i, team in enumerate(nba_teams, 1):
        team_id = team['id']
        team_name = f"{team['city']} {team['nickname']}"
        
        print(f"\n📋 Processing {i}/{len(nba_teams)}: {team_name} (ID: {team_id})")
        
        if import_team_data(supabase, team_id):
            successful_imports += 1
        else:
            failed_imports += 1
        
        # Add a small delay to avoid rate limiting
        time.sleep(0.5)
    
    # Print summary
    print(f"\n🎯 Import Summary:")
    print(f"✅ Successful imports: {successful_imports}")
    print(f"❌ Failed imports: {failed_imports}")
    print(f"📊 Total teams processed: {len(nba_teams)}")
    
    if successful_imports > 0:
        print(f"\n🎉 Successfully imported data for {successful_imports} NBA teams!")
        print("📋 Data includes: team details, history, awards, Hall of Fame, and retired numbers")
    
    if failed_imports > 0:
        print(f"\n⚠️ {failed_imports} teams failed to import. Check the logs above for details.")

if __name__ == "__main__":
    main()