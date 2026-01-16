#!/usr/bin/env python3
"""
Generate OG Image and Upload to Supabase Storage
Called after feed post creation to generate and store the OG image
"""

import os
import sys
import json
import requests
from supabase import create_client, Client
from generate_og_image import generate_og_image
import tempfile

def upload_to_supabase(
    supabase: Client,
    local_path: str,
    post_id: str,
    bucket: str = "og-images"
) -> Optional[str]:
    """Upload OG image to Supabase Storage"""
    try:
        # Ensure bucket exists (create if needed - requires admin privileges)
        # For now, assume bucket exists
        
        # Upload file
        file_name = f"{post_id}.png"
        file_path = f"feed-posts/{file_name}"
        
        with open(local_path, 'rb') as f:
            supabase.storage.from_(bucket).upload(
                file_path,
                f.read(),
                file_options={"content-type": "image/png", "upsert": "true"}
            )
        
        # Get public URL
        public_url = supabase.storage.from_(bucket).get_public_url(file_path)
        print(f"✅ Uploaded OG image: {public_url}")
        return public_url
        
    except Exception as e:
        print(f"❌ Error uploading to Supabase: {e}")
        return None


def generate_and_upload_og_image(
    post_id: str,
    supabase_url: str,
    supabase_key: str,
    team_tricodes: Optional[list] = None,
    player_ids: Optional[list] = None,
    metadata: Optional[dict] = None,
    game_date: Optional[str] = None,
    title: Optional[str] = None
) -> Optional[str]:
    """
    Generate OG image and upload to Supabase Storage
    
    Returns the public URL of the uploaded image, or None on failure
    """
    try:
        # Initialize Supabase client
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Create temporary file for OG image
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
            tmp_path = tmp_file.name
        
        # Generate OG image
        success = generate_og_image(
            post_id=post_id,
            output_path=tmp_path,
            team_tricodes=team_tricodes,
            player_ids=player_ids,
            metadata=metadata,
            game_date=game_date,
            title=title
        )
        
        if not success:
            os.unlink(tmp_path)
            return None
        
        # Upload to Supabase Storage
        public_url = upload_to_supabase(supabase, tmp_path, post_id)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        return public_url
        
    except Exception as e:
        print(f"❌ Error in generate_and_upload_og_image: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: generate_and_upload_og.py <post_id> <supabase_url> <supabase_key> [json_data]")
        sys.exit(1)
    
    post_id = sys.argv[1]
    supabase_url = sys.argv[2]
    supabase_key = sys.argv[3]
    json_data = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
    
    public_url = generate_and_upload_og_image(
        post_id=post_id,
        supabase_url=supabase_url,
        supabase_key=supabase_key,
        team_tricodes=json_data.get('team_tricodes'),
        player_ids=json_data.get('player_ids'),
        metadata=json_data.get('metadata'),
        game_date=json_data.get('game_date'),
        title=json_data.get('title')
    )
    
    if public_url:
        print(public_url)  # Output URL for script to capture
        sys.exit(0)
    else:
        sys.exit(1)

