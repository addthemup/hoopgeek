#!/usr/bin/env python3
"""
Generate OG Image for Feed Posts
Creates a 1200x630px image that mirrors the avatar bar visual design
"""

import os
import sys
import json
import requests
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from typing import Optional, Dict, Any, List
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

# Team colors (mirroring nbaTeamColors.ts)
TEAM_COLORS = {
    'ATL': {'primary': '#E03A3E', 'secondary': '#C1D32F'},
    'BOS': {'primary': '#007A33', 'secondary': '#BA9653'},
    'BKN': {'primary': '#000000', 'secondary': '#FFFFFF'},
    'CHA': {'primary': '#1D1160', 'secondary': '#00788C'},
    'CHI': {'primary': '#CE1141', 'secondary': '#000000'},
    'CLE': {'primary': '#860038', 'secondary': '#041E42'},
    'DAL': {'primary': '#00538C', 'secondary': '#002B5E'},
    'DEN': {'primary': '#0E2240', 'secondary': '#FEC524'},
    'DET': {'primary': '#C8102E', 'secondary': '#1D42BA'},
    'GSW': {'primary': '#1D428A', 'secondary': '#FFC72C'},
    'HOU': {'primary': '#CE1141', 'secondary': '#000000'},
    'IND': {'primary': '#002D62', 'secondary': '#FDBB30'},
    'LAC': {'primary': '#C8102E', 'secondary': '#1D428A'},
    'LAL': {'primary': '#552583', 'secondary': '#FDB927'},
    'MEM': {'primary': '#5D76A9', 'secondary': '#12173F'},
    'MIA': {'primary': '#98002E', 'secondary': '#F9A01B'},
    'MIL': {'primary': '#00471B', 'secondary': '#EEE1C6'},
    'MIN': {'primary': '#0C2340', 'secondary': '#236192'},
    'NOP': {'primary': '#0C2340', 'secondary': '#C8102E'},
    'NYK': {'primary': '#006BB6', 'secondary': '#F58426'},
    'OKC': {'primary': '#007AC1', 'secondary': '#EF3B24'},
    'ORL': {'primary': '#0077C0', 'secondary': '#C4CED4'},
    'PHI': {'primary': '#006BB6', 'secondary': '#ED174C'},
    'PHX': {'primary': '#1D1160', 'secondary': '#E56020'},
    'POR': {'primary': '#E03A3E', 'secondary': '#000000'},
    'SAC': {'primary': '#5A2D81', 'secondary': '#63727A'},
    'SAS': {'primary': '#C4CED4', 'secondary': '#000000'},
    'TOR': {'primary': '#CE1141', 'secondary': '#000000'},
    'UTA': {'primary': '#002B5C', 'secondary': '#F9A01B'},
    'WAS': {'primary': '#002B5C', 'secondary': '#E31837'},
}

# Team IDs for logos
TEAM_IDS = {
    'ATL': '1610612737', 'BOS': '1610612738', 'BKN': '1610612751', 'CHA': '1610612766',
    'CHI': '1610612741', 'CLE': '1610612739', 'DAL': '1610612742', 'DEN': '1610612743',
    'DET': '1610612765', 'GSW': '1610612744', 'HOU': '1610612745', 'IND': '1610612754',
    'LAC': '1610612746', 'LAL': '1610612747', 'MEM': '1610612763', 'MIA': '1610612748',
    'MIL': '1610612749', 'MIN': '1610612750', 'NOP': '1610612740', 'NYK': '1610612752',
    'OKC': '1610612760', 'ORL': '1610612753', 'PHI': '1610612755', 'PHX': '1610612756',
    'POR': '1610612757', 'SAC': '1610612758', 'SAS': '1610612759', 'TOR': '1610612761',
    'UTA': '1610612762', 'WAS': '1610612764',
}

def get_team_logo_url(tricode: str) -> str:
    """Get NBA team logo URL (use global secondary which might be PNG)"""
    team_id = TEAM_IDS.get(tricode, TEAM_IDS['ATL'])
    # Try PNG version first, fallback to SVG
    # Many teams have global secondary as PNG: https://cdn.nba.com/logos/nba/{team_id}/global/S/logo.png
    return f'https://cdn.nba.com/logos/nba/{team_id}/global/S/logo.png'

def get_player_avatar_url(player_id: int) -> str:
    """Get NBA player avatar URL"""
    return f'https://cdn.nba.com/headshots/nba/latest/1040x760/{player_id}.png'

def hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color to RGB"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def download_image(url: str) -> Optional[Image.Image]:
    """Download and open image from URL (PNG, JPG, etc. - not SVG)"""
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        if response.status_code == 200:
            # Skip SVG files - use PNG versions instead
            if url.endswith('.svg'):
                print(f"Skipping SVG, try PNG version: {url}")
                return None
            return Image.open(BytesIO(response.content)).convert('RGBA')
    except Exception as e:
        print(f"Error downloading image {url}: {e}")
    return None

def generate_og_image(
    post_id: str,
    output_path: str,
    team_tricodes: Optional[List[str]] = None,
    player_ids: Optional[List[int]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    game_date: Optional[str] = None,
    title: Optional[str] = None
) -> bool:
    """
    Generate OG image (1200x630px) that mirrors the avatar bar design
    
    Args:
        post_id: Feed post ID
        output_path: Where to save the generated image
        team_tricodes: List of team tricodes (e.g., ['LAL', 'BOS'])
        player_ids: List of player IDs
        metadata: Post metadata (scores, fun_score, fantasy_points, etc.)
        game_date: Game date string
        title: Post title
    """
    try:
        # Create base image (1200x630 - optimal OG image size)
        width, height = 1200, 630
        img = Image.new('RGB', (width, height), color='#1a1a1a')
        draw = ImageDraw.Draw(img)
        
        # Determine if this is a game (team) post or player post
        is_game_post = team_tricodes and len(team_tricodes) >= 2
        is_player_post = player_ids and len(player_ids) > 0
        
        metadata_dict = metadata if isinstance(metadata, dict) else (json.loads(metadata) if isinstance(metadata, str) else {})
        story_data = metadata_dict.get('story_data', {})
        if isinstance(story_data, str):
            story_data = json.loads(story_data)
        
        if is_game_post:
            # GAME POST: Split background with team colors (like avatar bar)
            away_team = team_tricodes[0]
            home_team = team_tricodes[1] if len(team_tricodes) > 1 else team_tricodes[0]
            
            away_color = TEAM_COLORS.get(away_team, {}).get('primary', '#1a1a1a')
            home_color = TEAM_COLORS.get(home_team, {}).get('primary', '#1a1a1a')
            
            # Draw split background
            draw.rectangle([(0, 0), (width // 2, height)], fill=hex_to_rgb(away_color))
            draw.rectangle([(width // 2, 0), (width, height)], fill=hex_to_rgb(home_color))
            
            # Draw vertical divider
            draw.line([(width // 2, height * 0.1), (width // 2, height * 0.7)], 
                     fill=(255, 255, 255, 100), width=2)
            
            # Download and draw team logos (centered in each half)
            away_logo_url = get_team_logo_url(away_team)
            home_logo_url = get_team_logo_url(home_team)
            
            logo_size = 200
            logo_y = height // 2 - logo_size // 2
            
            # Away team logo (left side)
            away_logo = download_image(away_logo_url)
            if away_logo:
                away_logo = away_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
                if away_logo.mode == 'RGBA':
                    img.paste(away_logo, (width // 4 - logo_size // 2, logo_y), away_logo)
                else:
                    img.paste(away_logo, (width // 4 - logo_size // 2, logo_y))
            
            # Home team logo (right side)
            home_logo = download_image(home_logo_url)
            if home_logo:
                home_logo = home_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
                if home_logo.mode == 'RGBA':
                    img.paste(home_logo, (3 * width // 4 - logo_size // 2, logo_y), home_logo)
                else:
                    img.paste(home_logo, (3 * width // 4 - logo_size // 2, logo_y))
            
            # Score badge at bottom center
            away_score = story_data.get('awayScore') or metadata_dict.get('awayPoints')
            home_score = story_data.get('homeScore') or metadata_dict.get('homePoints')
            
            if away_score is not None and home_score is not None:
                score_text = f"{away_score}-{home_score}"
                # Try to load a bold font, fallback to default
                try:
                    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 72)
                except:
                    try:
                        font = ImageFont.truetype("arial.ttf", 72)
                    except:
                        font = ImageFont.load_default()
                
                # Draw yellow badge background
                text_bbox = draw.textbbox((0, 0), score_text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]
                
                badge_padding = 30
                badge_y = height - 80
                badge_x = width // 2 - text_width // 2 - badge_padding
                badge_w = text_width + badge_padding * 2
                badge_h = text_height + badge_padding
                
                draw.rectangle(
                    [(badge_x, badge_y - badge_h // 2), (badge_x + badge_w, badge_y + badge_h // 2)],
                    fill=(255, 199, 44),  # #FFC72C
                    outline=(255, 255, 255),
                    width=4
                )
                
                # Draw score text
                draw.text(
                    (width // 2, badge_y),
                    score_text,
                    fill=(0, 0, 0),
                    font=font,
                    anchor="mm"
                )
            
            # Date at top center
            if game_date:
                try:
                    date_obj = datetime.fromisoformat(game_date.replace('Z', '+00:00'))
                    date_text = f"{date_obj.month}/{date_obj.day}"
                except:
                    date_text = ""
                
                if date_text:
                    try:
                        small_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 32)
                    except:
                        small_font = ImageFont.load_default()
                    
                    # Draw date badge
                    date_bbox = draw.textbbox((0, 0), date_text, font=small_font)
                    date_width = date_bbox[2] - date_bbox[0]
                    date_height = date_bbox[3] - date_bbox[1]
                    
                    date_padding = 15
                    date_y = 50
                    date_x = width // 2 - date_width // 2 - date_padding
                    date_w = date_width + date_padding * 2
                    date_h = date_height + date_padding
                    
                    draw.rectangle(
                        [(date_x, date_y - date_h // 2), (date_x + date_w, date_y + date_h // 2)],
                        fill=(0, 0, 0, 191),  # rgba(0,0,0,0.75)
                        outline=(255, 255, 255),
                        width=2
                    )
                    
                    draw.text(
                        (width // 2, date_y),
                        date_text,
                        fill=(255, 255, 255),
                        font=small_font,
                        anchor="mm"
                    )
                except Exception as e:
                    print(f"Error drawing date: {e}")
        
        elif is_player_post:
            # PLAYER POST: Show player avatar(s) with fantasy points
            primary_player_id = player_ids[0]
            player_avatar_url = get_player_avatar_url(primary_player_id)
            player_avatar = download_image(player_avatar_url)
            
            if player_avatar:
                # Center the player avatar (larger for OG image)
                avatar_size = 400
                player_avatar = player_avatar.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
                
                # Create circular mask
                mask = Image.new('L', (avatar_size, avatar_size), 0)
                mask_draw = ImageDraw.Draw(mask)
                mask_draw.ellipse([(0, 0), (avatar_size, avatar_size)], fill=255)
                
                # Paste avatar with circular mask
                avatar_x = width // 2 - avatar_size // 2
                avatar_y = height // 2 - avatar_size // 2 - 50
                
                if player_avatar.mode == 'RGBA':
                    img.paste(player_avatar, (avatar_x, avatar_y), mask)
                else:
                    img.paste(player_avatar, (avatar_x, avatar_y), mask)
            
            # Fantasy points badge at bottom
            fantasy_points = metadata_dict.get('fantasyPoints') or metadata_dict.get('fantasy_points')
            if fantasy_points and fantasy_points > 0:
                fp_text = f"{fantasy_points:.1f} FP"
                
                try:
                    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 72)
                except:
                    font = ImageFont.load_default()
                
                text_bbox = draw.textbbox((0, 0), fp_text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                
                badge_padding = 30
                badge_y = height - 80
                badge_x = width // 2 - text_width // 2 - badge_padding
                badge_w = text_width + badge_padding * 2
                
                draw.rectangle(
                    [(badge_x, badge_y - 40), (badge_x + badge_w, badge_y + 40)],
                    fill=(255, 199, 44),
                    outline=(255, 255, 255),
                    width=4
                )
                
                draw.text(
                    (width // 2, badge_y),
                    fp_text,
                    fill=(0, 0, 0),
                    font=font,
                    anchor="mm"
                )
        
        else:
            # Fallback: Generic design with title
            if title:
                try:
                    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 60)
                except:
                    font = ImageFont.load_default()
                
                draw.text(
                    (width // 2, height // 2),
                    title[:50],  # Truncate long titles
                    fill=(255, 255, 255),
                    font=font,
                    anchor="mm"
                )
        
        # Add HoopGeek branding at bottom
        try:
            brand_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 24)
        except:
            brand_font = ImageFont.load_default()
        
        brand_text = "HoopGeek"
        draw.text(
            (width - 150, height - 40),
            brand_text,
            fill=(255, 255, 255, 150),
            font=brand_font,
            anchor="mm"
        )
        
        # Save image
        img.save(output_path, 'PNG', quality=95)
        print(f"✅ Generated OG image: {output_path}")
        return True
        
    except Exception as e:
        print(f"❌ Error generating OG image: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: generate_og_image.py <post_id> <output_path> [json_data]")
        sys.exit(1)
    
    post_id = sys.argv[1]
    output_path = sys.argv[2]
    json_data = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    
    success = generate_og_image(
        post_id=post_id,
        output_path=output_path,
        team_tricodes=json_data.get('team_tricodes'),
        player_ids=json_data.get('player_ids'),
        metadata=json_data.get('metadata'),
        game_date=json_data.get('game_date'),
        title=json_data.get('title')
    )
    
    sys.exit(0 if success else 1)

