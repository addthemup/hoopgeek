#!/usr/bin/env python3
"""
Helper script to upload game JSON files to Supabase Storage
Use this in your scrape_games_date_range.py script
"""

import os
import json
from supabase import create_client, Client
from typing import Optional

def setup_supabase_storage() -> Optional[Client]:
    """Initialize Supabase client for storage operations"""
    supabase_url = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("⚠️  Supabase credentials not found in environment variables")
        print("   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        return None
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        return supabase
    except Exception as e:
        print(f"❌ Error initializing Supabase client: {e}")
        return None


def upload_game_to_storage(
    supabase: Client,
    game_data: dict,
    game_id: str,
    bucket_name: str = 'game-data'
) -> bool:
    """
    Upload game JSON data to Supabase Storage
    
    Args:
        supabase: Supabase client instance
        game_data: Game data dictionary to upload
        game_id: Game ID (used as filename)
        bucket_name: Storage bucket name (default: 'game-data')
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Convert game_data to JSON string
        json_str = json.dumps(game_data, indent=2)
        
        # Upload to storage
        file_path = f"{game_id}.json"
        
        # Use upsert to overwrite if file exists
        response = supabase.storage.from_(bucket_name).upload(
            file_path,
            json_str.encode('utf-8'),
            file_options={
                "content-type": "application/json",
                "upsert": "true"
            }
        )
        
        print(f"  ✅ Uploaded to storage: {file_path}")
        return True
        
    except Exception as e:
        print(f"  ⚠️  Error uploading to storage: {e}")
        return False


def check_file_exists_in_storage(
    supabase: Client,
    game_id: str,
    bucket_name: str = 'game-data'
) -> bool:
    """
    Check if a game JSON file already exists in storage
    
    Args:
        supabase: Supabase client instance
        game_id: Game ID to check
        bucket_name: Storage bucket name (default: 'game-data')
    
    Returns:
        True if file exists, False otherwise
    """
    try:
        file_path = f"{game_id}.json"
        files = supabase.storage.from_(bucket_name).list(path='', {
            'search': file_path
        })
        
        return any(f['name'] == file_path for f in files)
        
    except Exception as e:
        print(f"  ⚠️  Error checking storage: {e}")
        return False


# Example usage in your scrape_games_date_range.py:
"""
# At the top of your script:
from upload_to_storage import setup_supabase_storage, upload_game_to_storage, check_file_exists_in_storage

# Initialize Supabase (do this once at the start)
supabase_storage = setup_supabase_storage()

# In your get_complete_game_data function, after saving locally:
if supabase_storage:
    # Check if file already exists (optional - skip if exists)
    if not check_file_exists_in_storage(supabase_storage, game_id):
        upload_game_to_storage(supabase_storage, game_data, game_id)
    else:
        print(f"  ⏭️  File already exists in storage, skipping upload")
"""

