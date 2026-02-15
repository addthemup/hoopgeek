#!/usr/bin/env python3
"""
Script to scrape NBA 2025-26 season games for a date range with automatic processing.
Automatically scrapes all games from start_date to end_date with:
- 5 minute break between games
- 10 minute break between days
- Saves each game to a separate JSON file in this script's folder (scripts/feed/).

Use the separate script upload_feed_to_bucket.py to upload those files to Supabase Storage.
"""

from nba_api.stats.endpoints.leaguegamefinder import LeagueGameFinder
from nba_api.stats.library.parameters import PlayerOrTeamAbbreviation, SeasonTypeNullable
import sys
import argparse
import re
import json
import requests
import pandas as pd
import time
import os
from datetime import datetime, timedelta
from pathlib import Path

# Output directory: same folder as this script (scripts/feed/)
FEED_DIR = Path(__file__).resolve().parent

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    # Get the project root (assuming script is in scripts/feed/)
    project_root = FEED_DIR.parent.parent
    load_dotenv(project_root / '.env.local')
    load_dotenv(project_root / '.env')
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except Exception:
    pass


def validate_date(date_string):
    """
    Validate date format YYYY-MM-DD
    """
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_string):
        raise argparse.ArgumentTypeError(f"Date must be in format YYYY-MM-DD (e.g., 2025-10-31)")
    
    try:
        datetime.strptime(date_string, '%Y-%m-%d')
    except ValueError:
        raise argparse.ArgumentTypeError(f"Invalid date: {date_string}")
    
    return date_string


def get_games_for_date(game_date):
    """
    Get all games for a specific date with team information.
    Filters out G League games automatically.
    
    Args:
        game_date: Date string in format YYYY-MM-DD
    
    Returns:
        DataFrame with game information (NBA games only)
    """
    try:
        print(f"Querying games for {game_date}...")
        game_finder = LeagueGameFinder(
            player_or_team_abbreviation=PlayerOrTeamAbbreviation.team,
            season_nullable="2025-26",
            season_type_nullable=SeasonTypeNullable.regular,
            date_from_nullable=game_date,
            date_to_nullable=game_date,
            get_request=True
        )
        
        df = game_finder.league_game_finder_results.get_data_frame()
        
        if df.empty:
            print(f"\n⚠ WARNING: No games found for 2025-26 season on {game_date}")
            return None
        
        # Filter out G League games
        original_count = len(df['GAME_ID'].unique()) if not df.empty else 0
        df = filter_nba_games(df)
        filtered_count = len(df['GAME_ID'].unique()) if not df.empty else 0
        
        if original_count > filtered_count:
            print(f"  ✓ Filtered out {original_count - filtered_count} G League/non-NBA game(s)")
        
        if df.empty:
            print(f"\n⚠ WARNING: No NBA games found for 2025-26 season on {game_date} (after filtering)")
            return None
        
        return df
        
    except Exception as e:
        print(f"\n✗ FAIL: Error querying games")
        print(f"Error details: {str(e)}")
        raise


def display_games(df):
    """
    Display games in a numbered list with team matchups.
    
    Args:
        df: DataFrame with game information
    
    Returns:
        Dictionary mapping index to game_id
    """
    # Get unique games with team info
    games_info = []
    seen_game_ids = set()
    
    for _, row in df.iterrows():
        game_id = row['GAME_ID']
        if game_id not in seen_game_ids:
            seen_game_ids.add(game_id)
            # Get matchup info (format: "TEAM @ TEAM" or "TEAM vs. TEAM")
            matchup = row['MATCHUP']
            game_date = row['GAME_DATE']
            games_info.append({
                'game_id': game_id,
                'matchup': matchup,
                'date': game_date
            })
    
    print(f"\n{'='*60}")
    print(f"Games found: {len(games_info)}")
    print(f"{'='*60}\n")
    
    game_map = {}
    for idx, game in enumerate(games_info, 1):
        game_map[idx] = game['game_id']
        print(f"{idx}. Game ID: {game['game_id']} - {game['matchup']}")
    
    return game_map


def convert_pctime_to_iso8601(pctime_str):
    """
    Convert PCTIMESTRING (e.g., "11:36") to ISO 8601 duration format (e.g., "PT11M36.00S")
    """
    if not pctime_str or pd.isna(pctime_str):
        return None
    
    try:
        # Format is usually "MM:SS" or "M:SS"
        parts = str(pctime_str).split(':')
        if len(parts) == 2:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return f"PT{minutes}M{seconds:.2f}S"
    except:
        pass
    return None


def parse_description_for_shot_info(description):
    """
    Parse description to extract shot information like distance, type, result.
    Returns dict with actionType, subType, shotResult, shotDistance, isFieldGoal
    """
    if not description:
        return {}
    
    desc = str(description).upper()
    info = {
        'actionType': None,
        'subType': None,
        'shotResult': None,
        'shotDistance': None,
        'isFieldGoal': 0
    }
    
    # Check for shot types
    if 'JUMP SHOT' in desc:
        info['actionType'] = 'Jump Shot'
        info['subType'] = 'Jump Shot'
        info['isFieldGoal'] = 1
    elif 'LAYUP' in desc:
        info['actionType'] = 'Layup'
        info['subType'] = 'Layup'
        info['isFieldGoal'] = 1
    elif 'DUNK' in desc:
        info['actionType'] = 'Dunk'
        info['subType'] = 'Dunk'
        info['isFieldGoal'] = 1
    elif 'HOOK SHOT' in desc:
        info['actionType'] = 'Hook Shot'
        info['subType'] = 'Hook Shot'
        info['isFieldGoal'] = 1
    elif 'FLOATING JUMP SHOT' in desc:
        info['actionType'] = 'Floating Jump Shot'
        info['subType'] = 'Floating Jump Shot'
        info['isFieldGoal'] = 1
    elif 'PULLUP JUMP SHOT' in desc:
        info['actionType'] = 'Pullup Jump Shot'
        info['subType'] = 'Pullup Jump Shot'
        info['isFieldGoal'] = 1
    elif 'RUNNING JUMP SHOT' in desc or 'RUNNING PULL-UP JUMP SHOT' in desc:
        info['actionType'] = 'Running Jump Shot'
        info['subType'] = 'Running Jump Shot'
        info['isFieldGoal'] = 1
    elif '3PT' in desc or '3-PT' in desc:
        info['actionType'] = '3PT Jump Shot'
        info['subType'] = '3PT Jump Shot'
        info['isFieldGoal'] = 1
    
    # Check for shot result
    if 'MISS' in desc:
        info['shotResult'] = 'Missed'
        if info['actionType']:
            info['actionType'] = 'Missed Shot'
    elif 'PTS' in desc or 'POINTS' in desc:
        info['shotResult'] = 'Made'
    
    # Extract shot distance (e.g., "25' 3PT" or "15' Pullup")
    distance_match = re.search(r"(\d+)'", desc)
    if distance_match:
        info['shotDistance'] = int(distance_match.group(1))
    
    return info


def parse_score(score_str):
    """
    Parse score string (e.g., "100 - 95") to separate home and away scores.
    Returns tuple (scoreHome, scoreAway) or (None, None)
    """
    if not score_str or pd.isna(score_str):
        return ("", "")
    
    try:
        parts = str(score_str).split(' - ')
        if len(parts) == 2:
            return (parts[0].strip(), parts[1].strip())
    except:
        pass
    return ("", "")


def build_video_info_from_v3(game_id, action_num, video_url, pbp_row):
    """
    Build comprehensive video info dictionary from PlayByPlayV3 data.
    PlayByPlayV3 already has all the fields we need, so we just need to map them.
    
    Args:
        game_id: Game ID string
        action_num: Action number
        video_url: MP4 video URL
        pbp_row: Dictionary with play-by-play row data from PlayByPlayV3
    
    Returns:
        Dictionary with all video event fields matching the desired format
    """
    # Helper function to safely get value or None
    def safe_get(key, default=None):
        val = pbp_row.get(key, default)
        if pd.isna(val) or val == '':
            return default if default is not None else None
        # For numeric defaults, allow 0 values
        if default is not None and isinstance(default, (int, float)):
            return val if val is not None else default
        return val if val else (default if default is not None else None)
    
    # Build the video info dictionary using PlayByPlayV3 fields directly
    video_info = {
        'gameId': game_id,
        'eventNum': safe_get('actionNumber'),  # Use actionNumber as eventNum
        'actionId': safe_get('actionId', 0) or 0,
        'period': safe_get('period', 1) or 1,
        'clock': safe_get('clock'),  # Already in ISO 8601 format!
        'description': safe_get('description', ''),
        'teamId': safe_get('teamId'),
        'teamTricode': safe_get('teamTricode'),
        'scoreHome': str(safe_get('scoreHome', '')) if safe_get('scoreHome') else '',
        'scoreAway': str(safe_get('scoreAway', '')) if safe_get('scoreAway') else '',
        'videoAvailable': safe_get('videoAvailable', 0) or 0,
        'actionType': safe_get('actionType'),
        'subType': safe_get('subType'),
        'shotResult': safe_get('shotResult'),
        'shotDistance': safe_get('shotDistance'),
        'isFieldGoal': safe_get('isFieldGoal', 0) or 0,
        'playerName': safe_get('playerName'),
        'playerNameI': safe_get('playerNameI'),
        'personId': safe_get('personId'),
        'xLegacy': safe_get('xLegacy'),
        'yLegacy': safe_get('yLegacy'),
        'location': safe_get('location'),
        'pointsTotal': safe_get('pointsTotal', 0) or 0,
        'mp4': video_url,
        'mp4_local': None
    }
    
    return video_info


def build_video_info(game_id, event_id, video_url, description, pbp_row):
    """
    Build comprehensive video info dictionary matching the desired format.
    
    Args:
        game_id: Game ID string
        event_id: Event number
        video_url: MP4 video URL
        description: Event description
        pbp_row: Dictionary with play-by-play row data
    
    Returns:
        Dictionary with all video event fields
    """
    # Parse shot info from description
    shot_info = parse_description_for_shot_info(description)
    
    # Get player info (usually PLAYER1)
    player_id = pbp_row.get('PLAYER1_ID', 0)
    if pd.notna(player_id):
        player_id = int(player_id) if player_id else 0
    else:
        player_id = 0
    
    player_name = pbp_row.get('PLAYER1_NAME')
    player_name_i = pbp_row.get('PLAYER1_NAME')  # Format as "First Last" - might need parsing
    
    # Get team info
    team_id = pbp_row.get('PLAYER1_TEAM_ID', 0)
    if pd.notna(team_id):
        team_id = int(team_id) if team_id else 0
    else:
        team_id = 0
    
    team_tricode = pbp_row.get('PLAYER1_TEAM_ABBREVIATION', '')
    
    # Get period
    period = pbp_row.get('PERIOD', 1)
    if pd.notna(period):
        period = int(period)
    else:
        period = 1
    
    # Get clock time and convert to ISO 8601
    pctime = pbp_row.get('PCTIMESTRING', '')
    clock = convert_pctime_to_iso8601(pctime)
    
    # Get scores
    score_str = pbp_row.get('SCORE', '')
    score_home, score_away = parse_score(score_str)
    
    # Get action ID (EVENTMSGACTIONTYPE)
    action_id = pbp_row.get('EVENTMSGACTIONTYPE', 0)
    if pd.notna(action_id):
        action_id = int(action_id) if action_id else 0
    else:
        action_id = 0
    
    # Video available flag
    video_available = pbp_row.get('VIDEO_AVAILABLE_FLAG', 0)
    if pd.notna(video_available):
        video_available = int(video_available) if video_available else 0
    else:
        video_available = 0
    
    # Calculate points total from description
    points_total = 0
    if 'PTS' in description:
        pts_match = re.search(r'\((\d+)\s*PTS?\)', description.upper())
        if pts_match:
            points_total = int(pts_match.group(1))
    
    # Build the video info dictionary
    video_info = {
        'gameId': game_id,
        'eventNum': event_id,
        'actionId': action_id,
        'period': period,
        'clock': clock,
        'description': description,
        'teamId': team_id if team_id > 0 else None,
        'teamTricode': team_tricode if team_tricode else None,
        'scoreHome': score_home,
        'scoreAway': score_away,
        'videoAvailable': video_available,
        'actionType': shot_info.get('actionType'),
        'subType': shot_info.get('subType'),
        'shotResult': shot_info.get('shotResult'),
        'shotDistance': shot_info.get('shotDistance'),
        'isFieldGoal': shot_info.get('isFieldGoal', 0),
        'playerName': player_name if player_name and pd.notna(player_name) else None,
        'playerNameI': player_name_i if player_name_i and pd.notna(player_name_i) else None,
        'personId': player_id if player_id > 0 else None,
        'xLegacy': None,  # Not available in PlayByPlayV2
        'yLegacy': None,  # Not available in PlayByPlayV2
        'location': None,  # Could be derived but not directly available
        'pointsTotal': points_total,
        'mp4': video_url,
        'mp4_local': None
    }
    
    return video_info


def get_game_videos(game_id):
    """
    Get all video MP4 links for a specific game using VideoEventsAsset endpoint.
    First gets all event IDs from play-by-play, then queries videos for each event.
    This approach avoids missing events that aren't sequential.
    
    Args:
        game_id: Game ID string (e.g., "0022500001")
    
    Returns:
        List of video events with MP4 links
    """
    try:
        print(f"\nFetching video data for game {game_id}...")
        
        from nba_api.stats.endpoints.playbyplayv3 import PlayByPlayV3
        from nba_api.stats.endpoints import videoeventsasset
        
        videos = []
        
        # Step 1: Get all action numbers from play-by-play data using PlayByPlayV3
        print("  Step 1: Getting play-by-play data to find all action numbers...")
        try:
            pbp = PlayByPlayV3(game_id=game_id, get_request=True)
            
            # Add delay after play-by-play request
            time.sleep(1.0)
            
            if not pbp.play_by_play:
                print("  ✗ No play-by-play data found")
                return []
            
            pbp_df = pbp.play_by_play.get_data_frame()
            
            if pbp_df.empty:
                print("  ✗ Play-by-play DataFrame is empty")
                return []
            
            # Store all play-by-play data keyed by action number
            action_numbers = []
            pbp_data = {}  # Dictionary to store all play-by-play data by action number
            
            # PlayByPlayV3 uses 'actionNumber' as the column name
            if 'actionNumber' not in pbp_df.columns:
                print("  ✗ Could not find actionNumber column in play-by-play data")
                print(f"    Available columns: {list(pbp_df.columns)}")
                return []
            
            # Store all play-by-play rows by action number
            for _, row in pbp_df.iterrows():
                action_num = row['actionNumber']
                if pd.notna(action_num) and action_num > 0:
                    action_num_int = int(action_num)
                    if action_num_int not in action_numbers:
                        action_numbers.append(action_num_int)
                        # Store the entire row data for this action
                        pbp_data[action_num_int] = row.to_dict()
            
            action_numbers.sort()
            print(f"  ✓ Found {len(action_numbers)} unique action numbers (range: {min(action_numbers)} - {max(action_numbers)})")
            
        except Exception as e:
            print(f"  ✗ Error getting play-by-play data: {e}")
            import traceback
            traceback.print_exc()
            return []
        
        # Step 2: Query VideoEventsAsset for each action number
        # Note: VideoEventsAsset uses game_event_id which corresponds to actionNumber
        print(f"\n  Step 2: Querying videos for {len(action_numbers)} actions...")
        print(f"  This may take a while. Processing in batches with rate limiting...")
        print(f"  Estimated time: ~{len(action_numbers) * 0.6 / 60:.1f} minutes")
        print(f"  Note: Some actions may not have videos available yet (videos are processed after games)")
        
        found_descriptions = set()
        processed_count = 0
        success_count = 0
        error_count = 0
        consecutive_errors = 0
        null_url_count = 0  # Track actions with null URLs
        batch_size = 5  # Reduced batch size for more conservative rate limiting
        max_consecutive_errors = 10  # Bail out after this many consecutive errors
        should_bail = False  # Flag to break out of outer loop
        
        for i in range(0, len(action_numbers), batch_size):
            # Check if we should bail out due to too many errors
            if consecutive_errors >= max_consecutive_errors or should_bail:
                print(f"    ⚠️  Bailing out: {consecutive_errors} consecutive errors")
                print(f"    Processed {processed_count}/{len(action_numbers)} actions before bailing")
                break
            
            batch = action_numbers[i:i+batch_size]
            
            for action_num in batch:
                # Check consecutive errors before processing each action
                if consecutive_errors >= max_consecutive_errors:
                    print(f"    ⚠️  Bailing out: {consecutive_errors} consecutive errors")
                    should_bail = True
                    break
                try:
                    # VideoEventsAsset uses game_event_id which corresponds to actionNumber
                    video_event = videoeventsasset.VideoEventsAsset(
                        game_id=game_id,
                        game_event_id=action_num,
                        get_request=True
                    )
                    
                    event_json = video_event.get_json()
                    if not event_json:
                        processed_count += 1
                        continue
                    
                    event_data = json.loads(event_json)
                    
                    # Extract video URLs and playlist data
                    result_sets = event_data.get('resultSets', {})
                    meta = result_sets.get('Meta', {})
                    video_urls = meta.get('videoUrls', [])
                    playlist = result_sets.get('playlist', [])
                    
                    # Try alternative structures if initial extraction fails
                    if not video_urls:
                        # Try videoUrls directly in resultSets
                        video_urls = result_sets.get('videoUrls', [])
                    if not video_urls:
                        # Try videoUrls directly in event_data
                        video_urls = event_data.get('videoUrls', [])
                    if not playlist:
                        # Try playlist directly in resultSets
                        playlist = result_sets.get('playlist', [])
                    if not playlist:
                        # Try playlist directly in event_data
                        playlist = event_data.get('playlist', [])
                    
                    # Check if this action has video
                    if video_urls and playlist:
                        video_url = None
                        
                        # Try to get MP4 URL from videoUrls
                        # Check all possible URL fields: lurl (large), murl (medium), surl (small), mp4, url
                        if isinstance(video_urls, list) and len(video_urls) > 0:
                            first_video = video_urls[0]
                            if isinstance(first_video, dict):
                                # Try all possible URL fields in order of preference (large > medium > small > mp4 > url)
                                video_url = (first_video.get('lurl') or 
                                           first_video.get('murl') or 
                                           first_video.get('surl') or 
                                           first_video.get('mp4') or 
                                           first_video.get('url'))
                            elif isinstance(first_video, str):
                                video_url = first_video
                        elif isinstance(video_urls, dict):
                            # Handle case where videoUrls is a dict instead of list
                            video_url = (video_urls.get('lurl') or 
                                       video_urls.get('murl') or 
                                       video_urls.get('surl') or 
                                       video_urls.get('mp4') or 
                                       video_urls.get('url'))
                        
                        # Get description from playlist
                        description = None
                        if isinstance(playlist, list) and len(playlist) > 0:
                            first_play = playlist[0]
                            if isinstance(first_play, dict):
                                description = first_play.get('dsc', '') or first_play.get('description', '')
                        elif isinstance(playlist, dict):
                            # Handle case where playlist is a dict instead of list
                            description = playlist.get('dsc', '') or playlist.get('description', '')
                        
                        # Only add if we have a video URL
                        if video_url:
                            # Get play-by-play data for this action
                            pbp_row = pbp_data.get(action_num, {})
                            
                            # Use description from playlist, or fall back to play-by-play description
                            if not description:
                                description = pbp_row.get('description', f'Action {action_num}')
                            
                            # Build comprehensive video info with all fields from PlayByPlayV3
                            video_info = build_video_info_from_v3(
                                game_id=game_id,
                                action_num=action_num,
                                video_url=video_url,
                                pbp_row=pbp_row
                            )
                            
                            # Only add if we haven't seen this exact video before
                            video_key = f"{action_num}_{video_url}"
                            if video_key not in found_descriptions:
                                found_descriptions.add(video_key)
                                videos.append(video_info)
                                success_count += 1
                                
                                if success_count % 10 == 0:
                                    print(f"    ✓ Found {success_count} videos so far...")
                        else:
                            # Track null URLs
                            null_url_count += 1
                    
                    processed_count += 1
                    consecutive_errors = 0  # Reset on success
                    
                except Exception as e:
                    error_count += 1
                    consecutive_errors += 1
                    processed_count += 1
                    
                    # Exponential backoff on consecutive errors
                    if consecutive_errors > 0:
                        backoff_time = min(2.0 * (2 ** (consecutive_errors - 1)), 10.0)  # Max 10 seconds
                        if consecutive_errors <= 3:  # Only delay for first few errors
                            print(f"    ⚠ Error with action {action_num}, backing off {backoff_time:.1f}s...")
                            time.sleep(backoff_time)
                    
                    # Print error details periodically
                    if "Invalid game_event_id" not in str(e):
                        if processed_count % 20 == 0 or consecutive_errors > 3:
                            print(f"    ⚠ Error with action {action_num}: {str(e)[:50]}")
                    
                    # If too many consecutive errors, bail out early
                    if consecutive_errors >= max_consecutive_errors:
                        print(f"    ⚠️  Too many consecutive errors ({consecutive_errors}). Bailing out of video fetch.")
                        print(f"    This game may not have videos available yet. Will retry later.")
                        should_bail = True
                        break  # Exit the batch loop
                    
                    # If too many consecutive errors, take a longer break
                    if consecutive_errors >= 5:
                        print(f"    ⏸ Too many consecutive errors. Pausing for 10 seconds...")
                        time.sleep(10.0)
                    
                    continue
                
                # Conservative delay between requests to avoid rate limiting
                # Increased from 0.1s to 0.6s for better rate limit compliance
                time.sleep(0.6)
            
            # Progress update after each batch
            if (i + batch_size) % 25 == 0 or i + batch_size >= len(action_numbers):
                elapsed_estimate = processed_count * 0.6
                remaining_estimate = (len(action_numbers) - processed_count) * 0.6
                print(f"    📊 Processed {processed_count}/{len(action_numbers)} actions, "
                      f"found {success_count} videos, {error_count} errors")
                print(f"       Estimated remaining time: ~{remaining_estimate / 60:.1f} minutes")
            
            # Check if we should bail before next batch
            if should_bail:
                break
            
            # Longer delay between batches (increased from 0.5s to 2.0s)
            if i + batch_size < len(action_numbers):
                time.sleep(2.0)
        
        print(f"\n  ✓ Complete! Found {len(videos)} videos out of {len(action_numbers)} actions")
        print(f"  Summary: {success_count} successful, {error_count} errors, {null_url_count} with null URLs, {processed_count - success_count - error_count - null_url_count} no video data")
        
        # DEBUG: If no videos found, provide more diagnostic info
        if len(videos) == 0 and len(action_numbers) > 0:
            print(f"\n  ⚠ WARNING: No videos found! Diagnostic info:")
            print(f"    - Total actions processed: {processed_count}")
            print(f"    - Actions with errors: {error_count}")
            print(f"    - Actions with null URLs: {null_url_count}")
            print(f"    - Actions with no video data: {processed_count - success_count - error_count - null_url_count}")
            print(f"    - This might indicate:")
            print(f"      1. Videos not available yet (may need time to process after game)")
            print(f"      2. API response structure has changed")
            print(f"      3. Videos not available for this game/actions")
            print(f"      4. Rate limiting or API access issues")
            print(f"    - Check the DEBUG output above for response structure details")
            if null_url_count > 0:
                print(f"    - ⚠ {null_url_count} actions had video objects but all URL fields were null")
                print(f"      This suggests videos may not be processed/available yet")
        
        return videos
        
    except ImportError as e:
        print(f"\n✗ FAIL: Import error - {e}")
        print("Make sure nba_api is installed: pip install nba-api")
        return []
    except Exception as e:
        print(f"\n✗ FAIL: Error fetching videos for game {game_id}")
        print(f"Error details: {str(e)}")
        import traceback
        traceback.print_exc()
        return []


def get_boxscore_traditional(game_id):
    """
    Get box score traditional data using BoxScoreTraditionalV3 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats, TeamStats, TeamStarterBenchStats lists
    """
    try:
        print("  Fetching box score traditional data...")
        from nba_api.stats.endpoints.boxscoretraditionalv3 import BoxScoreTraditionalV3
        
        box_score = BoxScoreTraditionalV3(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': [],
            'TeamStats': [],
            'TeamStarterBenchStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        if box_score.team_stats:
            team_df = box_score.team_stats.get_data_frame()
            if not team_df.empty:
                box_score_data['TeamStats'] = team_df.to_dict('records')
        
        if box_score.team_starter_bench_stats:
            starter_bench_df = box_score.team_starter_bench_stats.get_data_frame()
            if not starter_bench_df.empty:
                box_score_data['TeamStarterBenchStats'] = starter_bench_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} players, "
              f"{len(box_score_data['TeamStats'])} teams")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score traditional: {e}")
        return {
            'PlayerStats': [],
            'TeamStats': [],
            'TeamStarterBenchStats': []
        }


def get_boxscore_advanced(game_id):
    """
    Get box score advanced data using BoxScoreAdvancedV3 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats and TeamStats lists
    """
    try:
        print("  Fetching box score advanced data...")
        from nba_api.stats.endpoints.boxscoreadvancedv3 import BoxScoreAdvancedV3
        
        box_score = BoxScoreAdvancedV3(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': [],
            'TeamStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        if box_score.team_stats:
            team_df = box_score.team_stats.get_data_frame()
            if not team_df.empty:
                box_score_data['TeamStats'] = team_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} players, "
              f"{len(box_score_data['TeamStats'])} teams")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score advanced: {e}")
        return {
            'PlayerStats': [],
            'TeamStats': []
        }


def get_game_metadata(game_id, game_df_row):
    """
    Build game metadata structure from game finder data.
    
    Args:
        game_id: Game ID string
        game_df_row: Row from LeagueGameFinder DataFrame
    
    Returns:
        Dictionary with game metadata
    """
    # Extract date from game
    game_date_str = game_df_row.get('GAME_DATE', '')
    
    # Get team info - we need to find home and away teams
    # In LeagueGameFinder, MATCHUP format is "TEAM @ TEAM" or "TEAM vs. TEAM"
    matchup = game_df_row.get('MATCHUP', '')
    
    # For now, create basic metadata structure
    # We can enhance this with more endpoints if needed
    metadata = {
        'date': f"{game_date_str}T00:00:00" if game_date_str else None,
        'arena': None,  # Would need additional endpoint
        'season': '2025-26',
        'status': None,
        'homeTeam': {
            'team_id': None,
            'abbreviation': None,
            'city': None,
            'name': None,
            'record': None,
            'quarters': [None] * 12,
            'points': None,
            'stats': {
                'fg_pct': None,
                'ft_pct': None,
                'fg3_pct': None,
                'ast': None,
                'reb': None,
                'tov': None
            }
        },
        'awayTeam': {
            'team_id': None,
            'abbreviation': None,
            'city': None,
            'name': None,
            'record': None,
            'quarters': [None] * 12,
            'points': None,
            'stats': {
                'fg_pct': None,
                'ft_pct': None,
                'fg3_pct': None,
                'ast': None,
                'reb': None,
                'tov': None
            }
        },
        'teamLeaders': {},
        'lastMeeting': None,
        'seriesStandings': None
    }
    
    return metadata


def get_boxscore_four_factors(game_id):
    """
    Get box score four factors data using BoxScoreFourFactorsV3 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats and TeamStats lists
    """
    try:
        print("  Fetching box score four factors data...")
        from nba_api.stats.endpoints.boxscorefourfactorsv3 import BoxScoreFourFactorsV3
        
        box_score = BoxScoreFourFactorsV3(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': [],
            'TeamStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        if box_score.team_stats:
            team_df = box_score.team_stats.get_data_frame()
            if not team_df.empty:
                box_score_data['TeamStats'] = team_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} players, "
              f"{len(box_score_data['TeamStats'])} teams")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score four factors: {e}")
        return {
            'PlayerStats': [],
            'TeamStats': []
        }


def get_boxscore_summary(game_id):
    """
    Get box score summary data using BoxScoreSummaryV2 endpoint.
    This includes game info, line scores, officials, inactive players, etc.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with all summary data sets
    """
    try:
        print("  Fetching box score summary data...")
        from nba_api.stats.endpoints.boxscoresummaryv2 import BoxScoreSummaryV2
        
        box_score = BoxScoreSummaryV2(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'AvailableVideo': [],
            'GameInfo': [],
            'GameSummary': [],
            'InactivePlayers': [],
            'LastMeeting': [],
            'LineScore': [],
            'Officials': [],
            'OtherStats': [],
            'SeasonSeries': []
        }
        
        if box_score.available_video:
            df = box_score.available_video.get_data_frame()
            if not df.empty:
                box_score_data['AvailableVideo'] = df.to_dict('records')
        
        if box_score.game_info:
            df = box_score.game_info.get_data_frame()
            if not df.empty:
                box_score_data['GameInfo'] = df.to_dict('records')
        
        if box_score.game_summary:
            df = box_score.game_summary.get_data_frame()
            if not df.empty:
                box_score_data['GameSummary'] = df.to_dict('records')
        
        if box_score.inactive_players:
            df = box_score.inactive_players.get_data_frame()
            if not df.empty:
                box_score_data['InactivePlayers'] = df.to_dict('records')
        
        if box_score.last_meeting:
            df = box_score.last_meeting.get_data_frame()
            if not df.empty:
                box_score_data['LastMeeting'] = df.to_dict('records')
        
        if box_score.line_score:
            df = box_score.line_score.get_data_frame()
            if not df.empty:
                box_score_data['LineScore'] = df.to_dict('records')
        
        if box_score.officials:
            df = box_score.officials.get_data_frame()
            if not df.empty:
                box_score_data['Officials'] = df.to_dict('records')
        
        if box_score.other_stats:
            df = box_score.other_stats.get_data_frame()
            if not df.empty:
                box_score_data['OtherStats'] = df.to_dict('records')
        
        if box_score.season_series:
            df = box_score.season_series.get_data_frame()
            if not df.empty:
                box_score_data['SeasonSeries'] = df.to_dict('records')
        
        print(f"    ✓ Found summary data: {len(box_score_data['LineScore'])} line scores, "
              f"{len(box_score_data['Officials'])} officials, "
              f"{len(box_score_data['InactivePlayers'])} inactive players")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score summary: {e}")
        return {
            'AvailableVideo': [],
            'GameInfo': [],
            'GameSummary': [],
            'InactivePlayers': [],
            'LastMeeting': [],
            'LineScore': [],
            'Officials': [],
            'OtherStats': [],
            'SeasonSeries': []
        }


def get_boxscore_scoring(game_id):
    """
    Get box score scoring data using BoxScoreScoringV3 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats and TeamStats lists
    """
    try:
        print("  Fetching box score scoring data...")
        from nba_api.stats.endpoints.boxscorescoringv3 import BoxScoreScoringV3
        
        box_score = BoxScoreScoringV3(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': [],
            'TeamStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        if box_score.team_stats:
            team_df = box_score.team_stats.get_data_frame()
            if not team_df.empty:
                box_score_data['TeamStats'] = team_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} players, "
              f"{len(box_score_data['TeamStats'])} teams")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score scoring: {e}")
        return {
            'PlayerStats': [],
            'TeamStats': []
        }


def get_boxscore_usage(game_id):
    """
    Get box score usage data using BoxScoreUsageV3 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats and TeamStats lists
    """
    try:
        print("  Fetching box score usage data...")
        from nba_api.stats.endpoints.boxscoreusagev3 import BoxScoreUsageV3
        
        box_score = BoxScoreUsageV3(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': [],
            'TeamStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        if box_score.team_stats:
            team_df = box_score.team_stats.get_data_frame()
            if not team_df.empty:
                box_score_data['TeamStats'] = team_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} players, "
              f"{len(box_score_data['TeamStats'])} teams")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score usage: {e}")
        return {
            'PlayerStats': [],
            'TeamStats': []
        }


def get_boxscore_player_track(game_id):
    """
    Get box score player track data using BoxScorePlayerTrackV3 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats and TeamStats lists
    """
    try:
        print("  Fetching box score player track data...")
        from nba_api.stats.endpoints.boxscoreplayertrackv3 import BoxScorePlayerTrackV3
        
        box_score = BoxScorePlayerTrackV3(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': [],
            'TeamStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        if box_score.team_stats:
            team_df = box_score.team_stats.get_data_frame()
            if not team_df.empty:
                box_score_data['TeamStats'] = team_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} players, "
              f"{len(box_score_data['TeamStats'])} teams")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score player track: {e}")
        return {
            'PlayerStats': [],
            'TeamStats': []
        }


def get_boxscore_misc(game_id):
    """
    Get box score misc data using BoxScoreMiscV3 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats and TeamStats lists
    """
    try:
        print("  Fetching box score misc data...")
        from nba_api.stats.endpoints.boxscoremiscv3 import BoxScoreMiscV3
        
        box_score = BoxScoreMiscV3(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': [],
            'TeamStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        if box_score.team_stats:
            team_df = box_score.team_stats.get_data_frame()
            if not team_df.empty:
                box_score_data['TeamStats'] = team_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} players, "
              f"{len(box_score_data['TeamStats'])} teams")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score misc: {e}")
        return {
            'PlayerStats': [],
            'TeamStats': []
        }


def get_boxscore_matchups(game_id):
    """
    Get box score matchups data using BoxScoreMatchupsV3 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats list (matchup data)
    """
    try:
        print("  Fetching box score matchups data...")
        from nba_api.stats.endpoints.boxscorematchupsv3 import BoxScoreMatchupsV3
        
        box_score = BoxScoreMatchupsV3(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} matchup records")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score matchups: {e}")
        return {
            'PlayerStats': []
        }


def get_boxscore_hustle(game_id):
    """
    Get box score hustle data using BoxScoreHustleV2 endpoint.
    
    Args:
        game_id: Game ID string
    
    Returns:
        Dictionary with PlayerStats and TeamStats lists
    """
    try:
        print("  Fetching box score hustle data...")
        from nba_api.stats.endpoints.boxscorehustlev2 import BoxScoreHustleV2
        
        box_score = BoxScoreHustleV2(game_id=game_id, get_request=True)
        time.sleep(1.0)  # Rate limiting
        
        box_score_data = {
            'PlayerStats': [],
            'TeamStats': []
        }
        
        if box_score.player_stats:
            player_df = box_score.player_stats.get_data_frame()
            if not player_df.empty:
                box_score_data['PlayerStats'] = player_df.to_dict('records')
        
        if box_score.team_stats:
            team_df = box_score.team_stats.get_data_frame()
            if not team_df.empty:
                box_score_data['TeamStats'] = team_df.to_dict('records')
        
        print(f"    ✓ Found {len(box_score_data['PlayerStats'])} players, "
              f"{len(box_score_data['TeamStats'])} teams")
        return box_score_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching box score hustle: {e}")
        return {
            'PlayerStats': [],
            'TeamStats': []
        }


def aggregate_player_stats(box_score_traditional, box_score_advanced, box_score_four_factors, box_score_hustle, box_score_misc, box_score_player_track, box_score_scoring, box_score_usage):
    """
    Aggregate player stats from multiple box score endpoints.
    Combines stats with prefixes (traditional_*, advanced_*, fourFactors_*, hustle_*, misc_*, playerTrack_*, scoring_*, usage_*) to avoid conflicts.
    
    Args:
        box_score_traditional: Dict with PlayerStats from BoxScoreTraditionalV3
        box_score_advanced: Dict with PlayerStats from BoxScoreAdvancedV3
        box_score_four_factors: Dict with PlayerStats from BoxScoreFourFactorsV3
        box_score_hustle: Dict with PlayerStats from BoxScoreHustleV2
        box_score_misc: Dict with PlayerStats from BoxScoreMiscV3
        box_score_player_track: Dict with PlayerStats from BoxScorePlayerTrackV3
        box_score_scoring: Dict with PlayerStats from BoxScoreScoringV3
        box_score_usage: Dict with PlayerStats from BoxScoreUsageV3
    
    Returns:
        Dictionary keyed by personId with aggregated player data
    """
    aggregated = {}
    
    # Helper function to initialize player entry
    def init_player_entry(player):
        return {
            'firstName': player.get('firstName'),
            'familyName': player.get('familyName'),
            'nameI': player.get('nameI'),
            'playerSlug': player.get('playerSlug'),
            'position': player.get('position'),
            'teamId': player.get('teamId'),
            'teamCity': player.get('teamCity'),
            'teamName': player.get('teamName'),
            'teamTricode': player.get('teamTricode'),
            'teamSlug': player.get('teamSlug'),
            'jerseyNum': player.get('jerseyNum'),
        }
    
    # Helper function to add stats with prefix
    def add_stats_with_prefix(aggregated, person_id_str, player, prefix, exclude_keys=None):
        if exclude_keys is None:
            exclude_keys = ['firstName', 'familyName', 'nameI', 'playerSlug', 
                          'position', 'teamId', 'teamCity', 'teamName', 
                          'teamTricode', 'teamSlug', 'jerseyNum', 'gameId', 'personId']
        
        for key, value in player.items():
            if key not in exclude_keys:
                aggregated[person_id_str][f'{prefix}_{key}'] = value
        aggregated[person_id_str][f'{prefix}_personId'] = player.get('personId')
        aggregated[person_id_str][f'{prefix}_gameId'] = player.get('gameId')
    
    # Process traditional stats first
    if box_score_traditional.get('PlayerStats'):
        for player in box_score_traditional['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Initialize player entry with basic info
            if person_id_str not in aggregated:
                aggregated[person_id_str] = init_player_entry(player)
            
            # Add traditional stats with prefix
            add_stats_with_prefix(aggregated, person_id_str, player, 'traditional')
    
    # Process advanced stats
    if box_score_advanced.get('PlayerStats'):
        for player in box_score_advanced['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Ensure player entry exists (use advanced data if traditional wasn't available)
            if person_id_str not in aggregated:
                aggregated[person_id_str] = init_player_entry(player)
            
            # Add advanced stats with prefix
            add_stats_with_prefix(aggregated, person_id_str, player, 'advanced')
    
    # Process four factors stats
    if box_score_four_factors.get('PlayerStats'):
        for player in box_score_four_factors['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Ensure player entry exists
            if person_id_str not in aggregated:
                aggregated[person_id_str] = init_player_entry(player)
            
            # Add four factors stats with prefix
            add_stats_with_prefix(aggregated, person_id_str, player, 'fourFactors')
    
    # Process hustle stats
    if box_score_hustle.get('PlayerStats'):
        for player in box_score_hustle['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Ensure player entry exists
            if person_id_str not in aggregated:
                aggregated[person_id_str] = init_player_entry(player)
            
            # Add hustle stats with prefix
            add_stats_with_prefix(aggregated, person_id_str, player, 'hustle')
    
    # Process misc stats
    if box_score_misc.get('PlayerStats'):
        for player in box_score_misc['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Ensure player entry exists
            if person_id_str not in aggregated:
                aggregated[person_id_str] = init_player_entry(player)
            
            # Add misc stats with prefix
            add_stats_with_prefix(aggregated, person_id_str, player, 'misc')
    
    # Process player track stats
    if box_score_player_track.get('PlayerStats'):
        for player in box_score_player_track['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Ensure player entry exists
            if person_id_str not in aggregated:
                aggregated[person_id_str] = init_player_entry(player)
            
            # Add player track stats with prefix
            add_stats_with_prefix(aggregated, person_id_str, player, 'playerTrack')
    
    # Process scoring stats
    if box_score_scoring.get('PlayerStats'):
        for player in box_score_scoring['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Ensure player entry exists
            if person_id_str not in aggregated:
                aggregated[person_id_str] = init_player_entry(player)
            
            # Add scoring stats with prefix
            add_stats_with_prefix(aggregated, person_id_str, player, 'scoring')
    
    # Process usage stats
    if box_score_usage.get('PlayerStats'):
        for player in box_score_usage['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Ensure player entry exists
            if person_id_str not in aggregated:
                aggregated[person_id_str] = init_player_entry(player)
            
            # Add usage stats with prefix
            add_stats_with_prefix(aggregated, person_id_str, player, 'usage')
    
    return aggregated


def build_unified_player_stats(game_id, box_score_traditional, box_score_advanced, box_score_four_factors, box_score_hustle, box_score_misc, box_score_player_track, box_score_scoring, box_score_usage, box_score_matchups):
    """
    Build a unified PlayerStats array with all stats merged into each player object.
    Uses traditional box score as the base structure and merges all other stats.
    
    Args:
        game_id: Game ID string
        box_score_traditional: Dict with PlayerStats from BoxScoreTraditionalV3
        box_score_advanced: Dict with PlayerStats from BoxScoreAdvancedV3
        box_score_four_factors: Dict with PlayerStats from BoxScoreFourFactorsV3
        box_score_hustle: Dict with PlayerStats from BoxScoreHustleV2
        box_score_misc: Dict with PlayerStats from BoxScoreMiscV3
        box_score_player_track: Dict with PlayerStats from BoxScorePlayerTrackV3
        box_score_scoring: Dict with PlayerStats from BoxScoreScoringV3
        box_score_usage: Dict with PlayerStats from BoxScoreUsageV3
        box_score_matchups: Dict with PlayerStats from BoxScoreMatchupsV3
    
    Returns:
        List of player dictionaries with all stats merged
    """
    unified_players = []
    
    # Create a map of personId -> player data for quick lookup
    player_map = {}
    
    # Helper function to safely merge stats into a player object
    def merge_stats(target_player, source_player, exclude_keys=None):
        if exclude_keys is None:
            exclude_keys = ['personId', 'gameId', 'teamId', 'teamCity', 'teamName', 
                          'teamTricode', 'teamSlug', 'firstName', 'familyName', 
                          'nameI', 'playerSlug', 'position', 'comment', 'jerseyNum']
        
        for key, value in source_player.items():
            if key not in exclude_keys:
                # Always add stats from other endpoints (overwrite if exists)
                # This merges all stats from all endpoints into one player object
                target_player[key] = value
    
    # Start with traditional box score as the base (it has the most complete player info)
    if box_score_traditional.get('PlayerStats'):
        for player in box_score_traditional['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            
            # Create a copy of the player dict as the base
            player_entry = player.copy()
            player_entry['gameId'] = game_id
            player_map[person_id_str] = player_entry
    
    # Merge advanced stats
    if box_score_advanced.get('PlayerStats'):
        for player in box_score_advanced['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            if person_id_str in player_map:
                merge_stats(player_map[person_id_str], player)
    
    # Merge four factors stats
    if box_score_four_factors.get('PlayerStats'):
        for player in box_score_four_factors['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            if person_id_str in player_map:
                merge_stats(player_map[person_id_str], player)
    
    # Merge hustle stats
    if box_score_hustle.get('PlayerStats'):
        for player in box_score_hustle['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            if person_id_str in player_map:
                merge_stats(player_map[person_id_str], player)
    
    # Merge misc stats
    if box_score_misc.get('PlayerStats'):
        for player in box_score_misc['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            if person_id_str in player_map:
                merge_stats(player_map[person_id_str], player)
    
    # Merge player track stats
    if box_score_player_track.get('PlayerStats'):
        for player in box_score_player_track['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            if person_id_str in player_map:
                merge_stats(player_map[person_id_str], player)
    
    # Merge scoring stats
    if box_score_scoring.get('PlayerStats'):
        for player in box_score_scoring['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            if person_id_str in player_map:
                merge_stats(player_map[person_id_str], player)
    
    # Merge usage stats
    if box_score_usage.get('PlayerStats'):
        for player in box_score_usage['PlayerStats']:
            person_id = player.get('personId')
            if not person_id:
                continue
            
            person_id_str = str(person_id)
            if person_id_str in player_map:
                merge_stats(player_map[person_id_str], player)
    
    # Convert map to list
    unified_players = list(player_map.values())
    
    # Sort by teamId, then by personId for consistent ordering
    unified_players.sort(key=lambda x: (x.get('teamId', 0), x.get('personId', 0)))
    
    return unified_players


def aggregate_team_stats(box_score_traditional, box_score_advanced, box_score_four_factors, box_score_hustle, box_score_misc, box_score_player_track, box_score_scoring, box_score_usage):
    """
    Aggregate team stats from multiple box score endpoints.
    Combines stats with prefixes (traditional_*, advanced_*, fourFactors_*, hustle_*, misc_*, playerTrack_*, scoring_*, usage_*) to avoid conflicts.
    
    Args:
        box_score_traditional: Dict with TeamStats from BoxScoreTraditionalV3
        box_score_advanced: Dict with TeamStats from BoxScoreAdvancedV3
        box_score_four_factors: Dict with TeamStats from BoxScoreFourFactorsV3
        box_score_hustle: Dict with TeamStats from BoxScoreHustleV2
        box_score_misc: Dict with TeamStats from BoxScoreMiscV3
        box_score_player_track: Dict with TeamStats from BoxScorePlayerTrackV3
        box_score_scoring: Dict with TeamStats from BoxScoreScoringV3
        box_score_usage: Dict with TeamStats from BoxScoreUsageV3
    
    Returns:
        Dictionary keyed by teamId with aggregated team data
    """
    aggregated = {}
    
    # Helper function to initialize team entry
    def init_team_entry(team):
        return {
            'teamId': team.get('teamId'),
            'teamCity': team.get('teamCity'),
            'teamName': team.get('teamName'),
            'teamTricode': team.get('teamTricode'),
            'teamSlug': team.get('teamSlug'),
        }
    
    # Helper function to add stats with prefix
    def add_stats_with_prefix(aggregated, team_id_str, team, prefix, exclude_keys=None):
        if exclude_keys is None:
            exclude_keys = ['teamId', 'teamCity', 'teamName', 'teamTricode', 'teamSlug', 'gameId']
        
        for key, value in team.items():
            if key not in exclude_keys:
                aggregated[team_id_str][f'{prefix}_{key}'] = value
        aggregated[team_id_str][f'{prefix}_teamId'] = team.get('teamId')
        aggregated[team_id_str][f'{prefix}_gameId'] = team.get('gameId')
    
    # Process traditional stats first
    if box_score_traditional.get('TeamStats'):
        for team in box_score_traditional['TeamStats']:
            team_id = team.get('teamId')
            if not team_id:
                continue
            
            team_id_str = str(team_id)
            
            # Initialize team entry with basic info
            if team_id_str not in aggregated:
                aggregated[team_id_str] = init_team_entry(team)
            
            # Add traditional stats with prefix
            add_stats_with_prefix(aggregated, team_id_str, team, 'traditional')
    
    # Process advanced stats
    if box_score_advanced.get('TeamStats'):
        for team in box_score_advanced['TeamStats']:
            team_id = team.get('teamId')
            if not team_id:
                continue
            
            team_id_str = str(team_id)
            
            if team_id_str not in aggregated:
                aggregated[team_id_str] = init_team_entry(team)
            
            add_stats_with_prefix(aggregated, team_id_str, team, 'advanced')
    
    # Process four factors stats
    if box_score_four_factors.get('TeamStats'):
        for team in box_score_four_factors['TeamStats']:
            team_id = team.get('teamId')
            if not team_id:
                continue
            
            team_id_str = str(team_id)
            
            if team_id_str not in aggregated:
                aggregated[team_id_str] = init_team_entry(team)
            
            add_stats_with_prefix(aggregated, team_id_str, team, 'fourFactors')
    
    # Process hustle stats
    if box_score_hustle.get('TeamStats'):
        for team in box_score_hustle['TeamStats']:
            team_id = team.get('teamId')
            if not team_id:
                continue
            
            team_id_str = str(team_id)
            
            if team_id_str not in aggregated:
                aggregated[team_id_str] = init_team_entry(team)
            
            add_stats_with_prefix(aggregated, team_id_str, team, 'hustle')
    
    # Process misc stats
    if box_score_misc.get('TeamStats'):
        for team in box_score_misc['TeamStats']:
            team_id = team.get('teamId')
            if not team_id:
                continue
            
            team_id_str = str(team_id)
            
            if team_id_str not in aggregated:
                aggregated[team_id_str] = init_team_entry(team)
            
            add_stats_with_prefix(aggregated, team_id_str, team, 'misc')
    
    # Process player track stats
    if box_score_player_track.get('TeamStats'):
        for team in box_score_player_track['TeamStats']:
            team_id = team.get('teamId')
            if not team_id:
                continue
            
            team_id_str = str(team_id)
            
            if team_id_str not in aggregated:
                aggregated[team_id_str] = init_team_entry(team)
            
            add_stats_with_prefix(aggregated, team_id_str, team, 'playerTrack')
    
    # Process scoring stats
    if box_score_scoring.get('TeamStats'):
        for team in box_score_scoring['TeamStats']:
            team_id = team.get('teamId')
            if not team_id:
                continue
            
            team_id_str = str(team_id)
            
            if team_id_str not in aggregated:
                aggregated[team_id_str] = init_team_entry(team)
            
            add_stats_with_prefix(aggregated, team_id_str, team, 'scoring')
    
    # Process usage stats
    if box_score_usage.get('TeamStats'):
        for team in box_score_usage['TeamStats']:
            team_id = team.get('teamId')
            if not team_id:
                continue
            
            team_id_str = str(team_id)
            
            if team_id_str not in aggregated:
                aggregated[team_id_str] = init_team_entry(team)
            
            add_stats_with_prefix(aggregated, team_id_str, team, 'usage')
    
    return aggregated


def tell_story(game_data):
    """
    Analyze game data and tell the story of how the game was won.
    Adapted to work with a single game object (not a dict of games).
    
    Args:
        game_data: Single game data dictionary with AggregatedTeamStats
    
    Returns:
        Dictionary with story output
    """
    story_output = {
        "matchup": None,
        "final_score": None,
        "advantages": [],
        "teams": {
            "winner": {},
            "loser": {}
        }
    }
    
    team_stats = game_data.get('AggregatedTeamStats', {})
    teams = list(team_stats.values())
    
    if len(teams) != 2:
        return story_output
    
    team1, team2 = teams[0], teams[1]
    
    # Determine winner
    team1_pts = int(team1.get('traditional_points', 0))
    team2_pts = int(team2.get('traditional_points', 0))
    winner = team1 if team1_pts > team2_pts else team2
    loser = team2 if team1_pts > team2_pts else team1
    
    # Extract teamId and teamTricode
    winner_team_id = int(winner.get('teamId', 0))
    winner_team_tricode = winner.get('teamTricode', '')
    loser_team_id = int(loser.get('teamId', 0))
    loser_team_tricode = loser.get('teamTricode', '')
    
    # Update story output with team information
    story_output['teams']['winner'] = {
        'name': winner.get('teamName', ''),
        'city': winner.get('teamCity', ''),
        'tricode': winner_team_tricode,
        'teamId': winner_team_id,
        'points': max(team1_pts, team2_pts)
    }
    
    story_output['teams']['loser'] = {
        'name': loser.get('teamName', ''),
        'city': loser.get('teamCity', ''),
        'tricode': loser_team_tricode,
        'teamId': loser_team_id,
        'points': min(team1_pts, team2_pts)
    }
    
    story_output['matchup'] = f"{winner.get('teamCity', '')} {winner.get('teamName', '')} vs {loser.get('teamCity', '')} {loser.get('teamName', '')}"
    story_output['final_score'] = f"{winner.get('teamCity', '')} {max(team1_pts, team2_pts)} - {loser.get('teamCity', '')} {min(team1_pts, team2_pts)}"
    
    # List of stats to compare
    stats_to_compare = {
        'advanced_assistToTurnover': ('Assist-to-Turnover', 0.2),
        'advanced_offensiveReboundPercentage': ('Offensive Rebound %', 0.1),
        'advanced_defensiveReboundPercentage': ('Defensive Rebound %', 0.1),
        'advanced_trueShootingPercentage': ('True Shooting %', 0.05),
        'fourFactors_freeThrowAttemptRate': ('Free Throw Rate', 0.1),
        'misc_pointsOffTurnovers': ('Points Off Turnovers', 5),
        'misc_pointsSecondChance': ('Second Chance Points', 5),
        'misc_pointsFastBreak': ('Fast Break Points', 5),
        'misc_pointsPaint': ('Points in Paint', 8),
        'misc_blocks': ('Blocks', 2),
        'playerTrack_touches': ('Ball Touches', 20),
        'playerTrack_passes': ('Total Passes', 25),
        'playerTrack_contestedFieldGoalPercentage': ('Contested FG%', 0.05),
        'playerTrack_uncontestedFieldGoalsPercentage': ('Uncontested FG%', 0.05),
        'playerTrack_defendedAtRimFieldGoalPercentage': ('Defended At Rim FG%', 0.08),
    }
    
    significant_advantages = []
    for stat_key, (stat_name, threshold) in stats_to_compare.items():
        winner_stat = float(winner.get(stat_key, 0))
        loser_stat = float(loser.get(stat_key, 0))
        
        diff = abs(winner_stat - loser_stat)
        if diff > threshold:
            # For Turnover %, lower is better so we flip the comparison
            if stat_key == 'fourFactors_teamTurnoverPercentage':
                advantage = winner_stat < loser_stat
            else:
                advantage = winner_stat > loser_stat
            
            # Only include advantages where the winner had the better stat
            if advantage:
                # Calculate weighted difference - reduce ball movement stats by 75%
                weighted_diff = diff
                if stat_key in ['playerTrack_touches', 'playerTrack_passes']:
                    weighted_diff = diff * 0.25
                
                significant_advantages.append({
                    'stat_name': stat_name,
                    'team': winner.get('teamCity', ''),
                    'teamId': winner_team_id,
                    'teamTricode': winner_team_tricode,
                    'value1': float(winner_stat),
                    'value2': float(loser_stat),
                    'diff': float(winner_stat - loser_stat),
                    'weighted_diff': weighted_diff
                })
    
    # Sort advantages by weighted difference magnitude
    significant_advantages.sort(key=lambda x: abs(x.get('weighted_diff', 0)), reverse=True)
    
    # Remove weighted_diff from final output
    for adv in significant_advantages:
        if 'weighted_diff' in adv:
            del adv['weighted_diff']
    
    story_output['advantages'] = significant_advantages[:15]
    
    return story_output


def parse_clock(clock_str):
    """Convert PT12M00.00S format to seconds"""
    if not clock_str:
        return 0
    # Remove 'PT' and 'S'
    time_str = str(clock_str).replace('PT', '').replace('S', '')
    # Split minutes and seconds
    if 'M' in time_str:
        minutes, seconds = time_str.split('M')
        return float(minutes) * 60 + float(seconds)
    return float(time_str)


def calculate_lead_changes(play_by_play_data):
    """Calculate total lead changes and lead changes in critical moments"""
    lead_changes = 0
    lead_changes_under_5 = 0
    lead_changes_under_1 = 0
    buzzer_beater_changes = 0
    current_leader = None
    
    for play in play_by_play_data:
        # Skip if no scores are recorded
        if not play.get('scoreHome') or not play.get('scoreAway'):
            continue
            
        try:
            score_home = int(play['scoreHome'])
            score_away = int(play['scoreAway'])
        except (ValueError, TypeError):
            continue
        
        # Determine current leader
        new_leader = None
        if score_home > score_away:
            new_leader = 'home'
        elif score_away > score_home:
            new_leader = 'away'
            
        # Check if in last 5 minutes of 4th period or overtime
        period = play.get('period', 1)
        if period >= 4:  # Include overtime periods
            clock = play.get('clock')
            if clock:
                try:
                    clock_seconds = parse_clock(clock)
                    
                    # Check for buzzer beater separately - any made shot in last 3 seconds
                    if clock_seconds <= 3 and play.get('shotResult') == 'Made':
                        buzzer_beater_changes += 1
                    
                    # Check for lead change
                    if new_leader and new_leader != current_leader and current_leader is not None:
                        lead_changes += 1
                        
                        if clock_seconds <= 300:  # 5 minutes = 300 seconds
                            lead_changes_under_5 += 1
                            
                            if clock_seconds <= 60:  # Last minute
                                lead_changes_under_1 += 1
                except (ValueError, TypeError):
                    pass
        else:
            # Handle lead changes in earlier periods
            if new_leader and new_leader != current_leader and current_leader is not None:
                lead_changes += 1
        
        current_leader = new_leader if new_leader else current_leader
    
    return lead_changes, lead_changes_under_5, lead_changes_under_1, buzzer_beater_changes


def calculate_dunk_stats(play_by_play_data):
    """Calculate statistics for different types of dunks"""
    dunk_stats = {
        "Alley Oop": 0,
        "Putback": 0,
        "Running": 0,
        "Driving": 0,
        "Tip": 0,
        "Cutting": 0,
        "Total Dunks": 0
    }
    
    for i, play in enumerate(play_by_play_data):
        sub_type = play.get('subType') or ''
        if sub_type and 'Dunk' in sub_type and play.get('shotResult') == 'Made':
            # Skip if no scores are recorded
            if not play.get('scoreHome') or not play.get('scoreAway'):
                continue
            
            try:
                # Verify score increased
                prev_home = int(play_by_play_data[i-1]['scoreHome']) if i > 0 and play_by_play_data[i-1].get('scoreHome') else 0
                prev_away = int(play_by_play_data[i-1]['scoreAway']) if i > 0 and play_by_play_data[i-1].get('scoreAway') else 0
                curr_home = int(play['scoreHome'])
                curr_away = int(play['scoreAway'])
            except (ValueError, TypeError, KeyError):
                continue
            
            if (curr_home > prev_home) or (curr_away > prev_away):
                dunk_type = sub_type
                dunk_stats["Total Dunks"] += 1
                
                # Check for each specific type
                for dunk_category in dunk_stats.keys():
                    if dunk_category != "Total Dunks" and dunk_category in dunk_type:
                        dunk_stats[dunk_category] += 1
                        break
    
    return dunk_stats


def calculate_deep_shots(play_by_play_data):
    """Calculate deep three pointers (>27 feet) and 'four pointers' (>30 feet)"""
    deep_threes = 0
    four_pointers = 0
    
    for play in play_by_play_data:
        if play.get('shotResult') == 'Made' and play.get('isFieldGoal') == 1:
            shot_distance = play.get('shotDistance')
            if shot_distance and shot_distance > 27:
                deep_threes += 1
                if shot_distance > 30:
                    four_pointers += 1
    
    return deep_threes, four_pointers


def calculate_scoring_milestones(player_stats):
    """Calculate which players hit scoring milestones (70, 60, 50, 40 points) and triple doubles"""
    milestones = {
        "70 Ball": [],
        "60 Ball": [],
        "50 Ball": [],
        "40 Ball": [],
        "Triple Double": []
    }
    
    for player_id, stats in player_stats.items():
        try:
            # Get traditional stats - check both prefixed and non-prefixed versions
            points = int(stats.get('traditional_points', stats.get('points', 0)) or 0)
            rebounds = int(stats.get('traditional_reboundsTotal', stats.get('reboundsTotal', 0)) or 0)
            assists = int(stats.get('traditional_assists', stats.get('assists', 0)) or 0)
            blocks = int(stats.get('traditional_blocks', stats.get('blocks', 0)) or 0)
            steals = int(stats.get('traditional_steals', stats.get('steals', 0)) or 0)
            
            # Get player name
            player_name = f"{stats.get('firstName', '')} {stats.get('familyName', '')}".strip()
            if not player_name:
                player_name = stats.get('nameI', 'Unknown Player')
            
            # Check for triple double (any combination of PTS/REB/AST/BLK/STL)
            stats_list = [points, rebounds, assists, blocks, steals]
            double_digits = sum(1 for stat in stats_list if stat >= 10)
            if double_digits >= 3:
                milestones["Triple Double"].append((
                    player_name, 
                    f"PTS: {points}, REB: {rebounds}, AST: {assists}, BLK: {blocks}, STL: {steals}"
                ))
            
            # Check scoring milestones
            if points >= 70:
                milestones["70 Ball"].append((player_name, points))
            elif points >= 60:
                milestones["60 Ball"].append((player_name, points))
            elif points >= 50:
                milestones["50 Ball"].append((player_name, points))
            elif points >= 40:
                milestones["40 Ball"].append((player_name, points))
                
        except (TypeError, ValueError):
            continue
    
    return milestones


def calculate_team_stats(team_stats):
    """Calculate combined and comparative team statistics"""
    # Get stats for both teams
    teams = list(team_stats.values())
    if len(teams) != 2:
        return None
    
    team1, team2 = teams[0], teams[1]
    
    # Get team names from the stats
    team1_name = team1.get('teamTricode', 'team1')
    team2_name = team2.get('teamTricode', 'team2')
    
    # Calculate margin of victory
    team1_pts = int(team1.get('traditional_points', 0))
    team2_pts = int(team2.get('traditional_points', 0))
    margin_of_victory = abs(team1_pts - team2_pts)
    
    # Calculate three point stats
    team1_threes = int(team1.get('traditional_threePointersMade', 0))
    team2_threes = int(team2.get('traditional_threePointersMade', 0))
    combined_threes = team1_threes + team2_threes
    
    team1_three_pct = float(team1.get('traditional_threePointersPercentage', 0) or 0)
    team2_three_pct = float(team2.get('traditional_threePointersPercentage', 0) or 0)
    combined_three_pct = (team1_three_pct + team2_three_pct) / 2
    
    # Calculate pace
    team1_pace = float(team1.get('advanced_pace', 0) or 0)
    team2_pace = float(team2.get('advanced_pace', 0) or 0)
    pace = (team1_pace + team2_pace) / 2 if (team1_pace + team2_pace) > 0 else 100
    
    # Calculate contested shots and percentages
    team1_contested = int(team1.get('playerTrack_contestedFieldGoalsMade', 0) or 0)
    team1_contested_att = int(team1.get('playerTrack_contestedFieldGoalsAttempted', 0) or 0)
    team2_contested = int(team2.get('playerTrack_contestedFieldGoalsMade', 0) or 0)
    team2_contested_att = int(team2.get('playerTrack_contestedFieldGoalsAttempted', 0) or 0)
    
    combined_contested_pct = 0
    if (team1_contested_att + team2_contested_att) > 0:
        combined_contested_pct = ((team1_contested + team2_contested) / 
                                (team1_contested_att + team2_contested_att) * 100)
    
    # Calculate contested three point percentages
    team1_contested_3 = int(team1.get('hustle_contestedShots3pt', 0) or 0)
    team2_contested_3 = int(team2.get('hustle_contestedShots3pt', 0) or 0)
    team1_3pa = int(team1.get('traditional_threePointersAttempted', 0) or 0)
    team2_3pa = int(team2.get('traditional_threePointersAttempted', 0) or 0)
    
    combined_contested_3_pct = 0
    if (team1_3pa + team2_3pa) > 0:
        combined_contested_3_pct = ((team1_contested_3 + team2_contested_3) / 
                                  (team1_3pa + team2_3pa) * 100)
    
    # Calculate other stats
    combined_contested_shots = (int(team1.get('hustle_contestedShots', 0) or 0) + 
                              int(team2.get('hustle_contestedShots', 0) or 0))
    
    combined_contested_threes = (int(team1.get('hustle_contestedShots3pt', 0) or 0) + 
                               int(team2.get('hustle_contestedShots3pt', 0) or 0))
    
    combined_fast_break = (int(team1.get('misc_pointsFastBreak', 0) or 0) + 
                          int(team2.get('misc_pointsFastBreak', 0) or 0))
    
    return {
        "Margin of Victory": margin_of_victory,
        "Combined Threes": combined_threes,
        "Team Threes": {
            team1_name: team1_threes,
            team2_name: team2_threes
        },
        "Combined Three %": round(combined_three_pct * 100, 1),
        "Team Three %": {
            team1_name: round(team1_three_pct * 100, 1),
            team2_name: round(team2_three_pct * 100, 1)
        },
        "Pace": round(pace, 1),
        "Team Pace": {
            team1_name: round(team1_pace, 1),
            team2_name: round(team2_pace, 1)
        },
        "Combined Contested Shots": combined_contested_shots,
        "Team Contested Shots": {
            team1_name: int(team1.get('hustle_contestedShots', 0) or 0),
            team2_name: int(team2.get('hustle_contestedShots', 0) or 0)
        },
        "Combined Contested Shot %": round(combined_contested_pct, 1),
        "Team Contested Shot %": {
            team1_name: round((team1_contested / team1_contested_att * 100) if team1_contested_att > 0 else 0, 1),
            team2_name: round((team2_contested / team2_contested_att * 100) if team2_contested_att > 0 else 0, 1)
        },
        "Combined Contested Threes": combined_contested_threes,
        "Team Contested Threes": {
            team1_name: team1_contested_3,
            team2_name: team2_contested_3
        },
        "Combined Contested Three %": round(combined_contested_3_pct, 1),
        "Team Contested Three %": {
            team1_name: round((team1_contested_3 / team1_3pa * 100) if team1_3pa > 0 else 0, 1),
            team2_name: round((team2_contested_3 / team2_3pa * 100) if team2_3pa > 0 else 0, 1)
        },
        "Combined Fast Break Points": combined_fast_break,
        "Team Fast Break Points": {
            team1_name: int(team1.get('misc_pointsFastBreak', 0) or 0),
            team2_name: int(team2.get('misc_pointsFastBreak', 0) or 0)
        }
    }


def get_reduction_factor(raw_score):
    """Scale down high scores to prevent inflation"""
    if raw_score >= 170:
        return 100 / raw_score  # Scale down to exactly 100
    elif raw_score >= 160:  # 160-170 -> 99-100
        return (99 + ((raw_score - 160) / 10)) / raw_score
    elif raw_score >= 150:  # 150-160 -> 98-99
        return (98 + ((raw_score - 150) / 10)) / raw_score
    elif raw_score >= 140:  # 140-150 -> 96-98
        return (96 + ((raw_score - 140) / 5)) / raw_score
    elif raw_score >= 130:  # 130-140 -> 94-96
        return (94 + ((raw_score - 130) / 5)) / raw_score
    elif raw_score >= 120:  # 120-130 -> 92-94
        return (92 + ((raw_score - 120) / 5)) / raw_score
    elif raw_score >= 110:  # 110-120 -> 90-92
        return (90 + ((raw_score - 110) / 5)) / raw_score
    elif raw_score >= 100:  # 100-110 -> 88-90
        return (88 + ((raw_score - 100) / 5)) / raw_score
    elif raw_score > 88:   # 88-100 -> 85-88
        return (85 + ((raw_score - 88) / 4)) / raw_score
    else:
        return 1.0  # No reduction needed


def get_boost_factor(score):
    """Revised boost factors to prevent extremely low scores"""
    if score >= 80:
        return 1.0
    elif score >= 70:
        return 1.1
    elif score >= 60:
        return 1.15
    elif score >= 50:
        return 1.2
    elif score >= 40:
        return 1.25
    elif score >= 30:
        return 1.3
    else:  # Below 30
        return 1.4


def calculate_fun_score(team_stats, lead_changes, lead_changes_5min, lead_changes_1min, buzzer_beater_changes, deep_threes, four_pointers, scoring_milestones, dunk_stats):
    """Calculate the Fun Score for a game based on various exciting statistics"""
    fun_score = 20  # Start with a base score
    print("\n  Fun Score Components:")
    
    # Three point shooting
    three_pct = team_stats["Combined Three %"]
    three_pt_penalty = 0
    if three_pct < 30:
        three_pt_penalty = (30 - three_pct) * 0.5
    three_pt_score = max(5, (three_pct / 4) - three_pt_penalty)
    fun_score += three_pt_score
    print(f"    • Three Point Shooting: {three_pt_score:.1f} points ({three_pct}%)")
    
    # Contested shots
    contested_three_pct = team_stats["Combined Contested Three %"]
    contested_penalty = 0
    if contested_three_pct < 30:
        contested_penalty = (30 - contested_three_pct) * 0.8
    
    contested_three_score = team_stats["Combined Contested Threes"] * (contested_three_pct / 125)
    contested_shot_score = team_stats["Combined Contested Shots"] * (team_stats["Combined Contested Shot %"] / 100)
    contested_total = max(5, (contested_three_score + contested_shot_score) * 0.15 - contested_penalty)
    fun_score += contested_total
    print(f"    • Contested Shots: {contested_total:.1f} points ({contested_three_pct}% contested 3s)")
    
    # Lead changes
    base_changes = lead_changes * 0.5
    changes_5min = lead_changes_5min * 2.0
    changes_1min = lead_changes_1min * 4.0
    buzzer_bonus = buzzer_beater_changes * 15
    
    lead_changes_total = max(5, base_changes + changes_5min + changes_1min + buzzer_bonus)
    fun_score += lead_changes_total
    print(f"    • Lead Changes: {lead_changes_total:.1f} points")
    print(f"      - Base Changes: {base_changes:.1f} ({lead_changes} changes)")
    print(f"      - Last 5 Min: {changes_5min:.1f} ({lead_changes_5min} changes)")
    print(f"      - Last 1 Min: {changes_1min:.1f} ({lead_changes_1min} changes)")
    print(f"      - Buzzer Beaters: {buzzer_bonus:.1f} ({buzzer_beater_changes} beaters)")
    
    # Deep shots
    deep_shot_score = (deep_threes * 2.5) + (four_pointers * 4)
    fun_score += deep_shot_score
    print(f"    • Deep Shots: {deep_shot_score:.1f} points")
    print(f"      - Deep Threes: {deep_threes * 3:.1f} ({deep_threes} shots)")
    print(f"      - Four Pointers: {four_pointers * 5:.1f} ({four_pointers} shots)")
    
    # Dunks
    dunk_score = dunk_stats["Total Dunks"] * 1
    fun_score += dunk_score
    print(f"    • Dunks: {dunk_score:.1f} points ({dunk_stats['Total Dunks']} dunks)")
    
    # Scoring milestones
    milestone_score = 0
    milestone_details = []
    for milestone, players in scoring_milestones.items():
        for i, player in enumerate(players):
            if milestone == "70 Ball":
                milestone_score += 25
                milestone_details.append(f"70pt game: {player[0]}")
            elif milestone == "60 Ball":
                milestone_score += 15
                milestone_details.append(f"60pt game: {player[0]}")
            elif milestone == "50 Ball":
                milestone_score += 10
                milestone_details.append(f"50pt game: {player[0]}")
            elif milestone == "40 Ball":
                milestone_score += 5
                milestone_details.append(f"40pt game: {player[0]}")
            elif milestone == "Triple Double":
                bonus = 5 if i == 0 else 10
                milestone_score += bonus
                milestone_details.append(f"Triple Double: {player[0]}")
    
    fun_score += milestone_score
    if milestone_score > 0:
        print(f"    • Scoring Milestones: {milestone_score:.1f} points")
        for detail in milestone_details:
            print(f"      - {detail}")
    
    # Add margin of victory bonus
    margin = team_stats["Margin of Victory"]
    margin_bonus = 0
    if 1 <= margin <= 3:
        margin_bonus = 20
    elif 4 <= margin <= 6:
        margin_bonus = 10
    elif 7 <= margin <= 8:
        margin_bonus = 5
    
    if margin_bonus > 0:
        fun_score += margin_bonus
        print(f"    • Close Game Bonus: {margin_bonus:.1f} points ({margin} point margin)")
    
    # Apply pace multiplier
    pace = team_stats["Pace"]
    pace_multiplier = pace / 100
    raw_score = fun_score * pace_multiplier
    
    # Apply the boost factor
    boost_factor = get_boost_factor(raw_score)
    if boost_factor > 1.0:
        final_score = raw_score * boost_factor
        print(f"\n    Raw Score: {raw_score:.1f}")
        print(f"    Pace Multiplier: {pace_multiplier:.2f} ({pace:.1f} pace)")
        print(f"    Boost Factor: {boost_factor:.2f}")
    else:
        final_score = raw_score
        print(f"\n    Raw Score: {raw_score:.1f}")
        print(f"    Pace Multiplier: {pace_multiplier:.2f} ({pace:.1f} pace)")
        print("    No boost applied (score >= 85)")
    
    # Apply reduction for high scores
    reduction_factor = get_reduction_factor(raw_score)
    final_score = raw_score * reduction_factor
    
    print(f"    Final Fun Score: {final_score:.1f}")
    
    return round(final_score, 1)


def calculate_game_score(game_data):
    """Calculate fun score and related statistics for a single game"""
    play_by_play = game_data.get('playByPlay', {}).get('allPlays', [])
    team_stats_dict = game_data.get('AggregatedTeamStats', {})
    
    if not team_stats_dict or len(team_stats_dict) < 2:
        return None
    
    team_stats = calculate_team_stats(team_stats_dict)
    
    if not team_stats:
        return None
    
    total_changes, changes_under_5, changes_under_1, buzzer_beater_changes = calculate_lead_changes(play_by_play)
    dunk_stats = calculate_dunk_stats(play_by_play)
    deep_threes, four_pointers = calculate_deep_shots(play_by_play)
    scoring_milestones = calculate_scoring_milestones(game_data.get('AggregatedPlayerStats', {}))
    
    fun_score = calculate_fun_score(
        team_stats, 
        total_changes, 
        changes_under_5,
        changes_under_1,
        buzzer_beater_changes,
        deep_threes, 
        four_pointers, 
        scoring_milestones,
        dunk_stats
    )
    
    return {
        "team_stats": team_stats,
        "lead_changes": {
            "total": total_changes,
            "last_5_minutes": changes_under_5,
            "last_minute": changes_under_1,
            "buzzer_beater": buzzer_beater_changes
        },
        "dunk_stats": dunk_stats,
        "deep_shots": {
            "deep_threes": deep_threes,
            "four_pointers": four_pointers
        },
        "scoring_milestones": scoring_milestones,
        "fun_score": fun_score
    }


def get_complete_game_data(game_id, game_df):
    """
    Get complete game data including videos, box score, and metadata.
    Structures data to match the desired JSON format.
    
    Args:
        game_id: Game ID string
        game_df: DataFrame from LeagueGameFinder with game info
    
    Returns:
        Complete game data dictionary matching the JSON structure
    """
    try:
        # Find the game row in the DataFrame
        game_row = None
        for _, row in game_df.iterrows():
            if row.get('GAME_ID') == game_id:
                game_row = row
                break
        
        if game_row is None:
            print(f"  ⚠ Could not find game info for {game_id}")
            game_row = {}
        
        # Initialize the complete game data structure
        game_data = {
            'gameId': game_id,
            'gameMetadata': get_game_metadata(game_id, game_row),
            'score': {
                game_id: {
                    'team_stats': {}
                }
            },
            'story': None,
            'script': None,
            'playByPlay': {
                'allPlays': []
            },
            'AggregatedPlayerStats': {},
            'AggregatedTeamStats': {},
            'PlayerStats': []
        }
        
        # Get box score data (needed for aggregation, but not stored in final output)
        box_score_traditional = get_boxscore_traditional(game_id)
        box_score_advanced = get_boxscore_advanced(game_id)
        box_score_four_factors = get_boxscore_four_factors(game_id)
        box_score_hustle = get_boxscore_hustle(game_id)
        box_score_misc = get_boxscore_misc(game_id)
        box_score_player_track = get_boxscore_player_track(game_id)
        box_score_scoring = get_boxscore_scoring(game_id)
        box_score_usage = get_boxscore_usage(game_id)
        box_score_summary = get_boxscore_summary(game_id)
        box_score_matchups = get_boxscore_matchups(game_id)
        
        # Aggregate player stats from all endpoints
        aggregated_players = aggregate_player_stats(
            box_score_traditional, 
            box_score_advanced, 
            box_score_four_factors,
            box_score_hustle,
            box_score_misc,
            box_score_player_track,
            box_score_scoring,
            box_score_usage
        )
        game_data['AggregatedPlayerStats'] = aggregated_players
        
        # Build unified PlayerStats array with all stats merged
        print("  Building unified player stats...")
        unified_player_stats = build_unified_player_stats(
            game_id,
            box_score_traditional,
            box_score_advanced,
            box_score_four_factors,
            box_score_hustle,
            box_score_misc,
            box_score_player_track,
            box_score_scoring,
            box_score_usage,
            box_score_matchups
        )
        game_data['PlayerStats'] = unified_player_stats
        
        # Aggregate team stats from all endpoints
        aggregated_teams = aggregate_team_stats(
            box_score_traditional,
            box_score_advanced,
            box_score_four_factors,
            box_score_hustle,
            box_score_misc,
            box_score_player_track,
            box_score_scoring,
            box_score_usage
        )
        game_data['AggregatedTeamStats'] = aggregated_teams
        
        # Enhance metadata with team info from box score
        if box_score_traditional.get('TeamStats'):
            team_stats = box_score_traditional['TeamStats']
            if len(team_stats) >= 2:
                # Update metadata with team info
                game_data['gameMetadata']['homeTeam'].update({
                    'team_id': team_stats[1].get('teamId'),
                    'abbreviation': team_stats[1].get('teamTricode'),
                    'city': team_stats[1].get('teamCity'),
                    'name': team_stats[1].get('teamName'),
                    'points': team_stats[1].get('points'),
                    'stats': {
                        'fg_pct': team_stats[1].get('fieldGoalsPercentage'),
                        'ft_pct': team_stats[1].get('freeThrowsPercentage'),
                        'fg3_pct': team_stats[1].get('threePointersPercentage'),
                        'ast': team_stats[1].get('assists'),
                        'reb': team_stats[1].get('reboundsTotal'),
                        'tov': team_stats[1].get('turnovers')
                    }
                })
                game_data['gameMetadata']['awayTeam'].update({
                    'team_id': team_stats[0].get('teamId'),
                    'abbreviation': team_stats[0].get('teamTricode'),
                    'city': team_stats[0].get('teamCity'),
                    'name': team_stats[0].get('teamName'),
                    'points': team_stats[0].get('points'),
                    'stats': {
                        'fg_pct': team_stats[0].get('fieldGoalsPercentage'),
                        'ft_pct': team_stats[0].get('freeThrowsPercentage'),
                        'fg3_pct': team_stats[0].get('threePointersPercentage'),
                        'ast': team_stats[0].get('assists'),
                        'reb': team_stats[0].get('reboundsTotal'),
                        'tov': team_stats[0].get('turnovers')
                    }
                })
        
        # Populate quarters, lastMeeting, seriesStandings, and teamLeaders from box_score_summary
        if box_score_summary:
            # Populate quarters from LineScore
            if box_score_summary.get('LineScore'):
                line_scores = box_score_summary['LineScore']
                # LineScore has entries for each team/period combination
                # We need to group by team and extract quarters
                home_quarters = [None] * 12
                away_quarters = [None] * 12
                home_team_id = game_data['gameMetadata']['homeTeam'].get('team_id')
                away_team_id = game_data['gameMetadata']['awayTeam'].get('team_id')
                
                for line_score in line_scores:
                    team_id = line_score.get('TEAM_ID')
                    period = line_score.get('PERIOD')
                    pts = line_score.get('PTS')
                    
                    if team_id == home_team_id and period and pts is not None:
                        # Period is 1-indexed, array is 0-indexed
                        if 1 <= period <= 12:
                            home_quarters[period - 1] = int(pts) if pts is not None else None
                    elif team_id == away_team_id and period and pts is not None:
                        if 1 <= period <= 12:
                            away_quarters[period - 1] = int(pts) if pts is not None else None
                
                game_data['gameMetadata']['homeTeam']['quarters'] = home_quarters
                game_data['gameMetadata']['awayTeam']['quarters'] = away_quarters
                
                # Also update record if available
                for line_score in line_scores:
                    team_id = line_score.get('TEAM_ID')
                    wins = line_score.get('W')
                    losses = line_score.get('L')
                    if team_id == home_team_id and wins is not None and losses is not None:
                        game_data['gameMetadata']['homeTeam']['record'] = f"{wins}-{losses}"
                    elif team_id == away_team_id and wins is not None and losses is not None:
                        game_data['gameMetadata']['awayTeam']['record'] = f"{wins}-{losses}"
            
            # Populate lastMeeting
            if box_score_summary.get('LastMeeting'):
                last_meetings = box_score_summary['LastMeeting']
                if last_meetings and len(last_meetings) > 0:
                    game_data['gameMetadata']['lastMeeting'] = last_meetings[0]  # Usually just one entry
            
            # Populate seriesStandings from SeasonSeries
            if box_score_summary.get('SeasonSeries'):
                season_series = box_score_summary['SeasonSeries']
                if season_series and len(season_series) > 0:
                    game_data['gameMetadata']['seriesStandings'] = season_series[0]  # Usually just one entry
            
            # Populate arena and status from GameInfo
            if box_score_summary.get('GameInfo'):
                game_info = box_score_summary['GameInfo']
                if game_info and len(game_info) > 0:
                    info = game_info[0]
                    if info.get('ARENA_NAME'):
                        game_data['gameMetadata']['arena'] = info.get('ARENA_NAME')
                    if info.get('GAME_STATUS_TEXT'):
                        game_data['gameMetadata']['status'] = info.get('GAME_STATUS_TEXT')
        
        # Get team leaders from ScoreboardV2
        try:
            print("  Fetching team leaders from scoreboard...", flush=True)
            from nba_api.stats.endpoints.scoreboardv2 import ScoreboardV2
            
            # Extract game date from game_row (most reliable source)
            game_date_str = None
            if game_row is not None:
                game_date_str = game_row.get('GAME_DATE', '')
            
            if not game_date_str:
                game_date_str = game_data['gameMetadata'].get('date', '')
            
            if game_date_str:
                # Convert from YYYY-MM-DD format to YYYYMMDD format for ScoreboardV2
                if 'T' in game_date_str:
                    game_date = game_date_str.split('T')[0].replace('-', '')
                else:
                    game_date = game_date_str.replace('-', '')
                
                try:
                    scoreboard = ScoreboardV2(game_date=game_date, get_request=True)
                    time.sleep(1.0)  # Rate limiting
                    
                    if scoreboard.team_leaders:
                        team_leaders_df = scoreboard.team_leaders.get_data_frame()
                        if not team_leaders_df.empty:
                            # Filter for this specific game
                            game_leaders = team_leaders_df[team_leaders_df['GAME_ID'] == game_id]
                            if not game_leaders.empty:
                                # Convert to list of records grouped by team
                                team_leaders_dict = {}
                                for _, row in game_leaders.iterrows():
                                    team_id = row.get('TEAM_ID')
                                    if team_id not in team_leaders_dict:
                                        team_leaders_dict[team_id] = []
                                    team_leaders_dict[team_id].append(row.to_dict())
                                
                                game_data['gameMetadata']['teamLeaders'] = team_leaders_dict
                                print(f"    ✓ Found team leaders for {len(team_leaders_dict)} teams", flush=True)
                            else:
                                print(f"    ⚠ No team leaders found for game {game_id} on date {game_date}", flush=True)
                    else:
                        print(f"    ⚠ ScoreboardV2 returned no team_leaders data", flush=True)
                except (json.JSONDecodeError, ValueError, Exception) as api_error:
                    print(f"    ⚠ Error fetching team leaders from API (date may not have data): {type(api_error).__name__}", flush=True)
                    # Continue without team leaders - this is not critical
        except Exception as e:
            print(f"    ⚠ Error fetching team leaders: {type(e).__name__}: {str(e)[:100]}", flush=True)
            # Continue without team leaders
        
        # Get videos and play-by-play
        print("  Fetching videos and play-by-play data...")
        videos = get_game_videos(game_id)
        
        # Check if video fetching failed critically (no videos and likely API issues)
        video_fetch_failed = False
        if not videos or len(videos) == 0:
            print("  ⚠️  WARNING: No videos found for this game")
            print("  This may indicate videos are not available yet or API issues")
            # Don't fail completely - continue with empty videos
            game_data['playByPlay']['allPlays'] = []
        else:
            # Add videos to playByPlay structure
            game_data['playByPlay']['allPlays'] = videos
            print(f"  ✓ Successfully fetched {len(videos)} videos")
        
        # Get shot chart data for all players
        # Extract player IDs and team IDs from aggregated player stats
        player_ids_by_team = {}
        if aggregated_players:
            for player_id_str, player_data in aggregated_players.items():
                try:
                    player_id = int(player_id_str)
                    team_id = player_data.get('traditional_teamId') or player_data.get('teamId')
                    if team_id and player_id:
                        if team_id not in player_ids_by_team:
                            player_ids_by_team[team_id] = []
                        if player_id not in player_ids_by_team[team_id]:
                            player_ids_by_team[team_id].append(player_id)
                except (ValueError, TypeError):
                    continue
        
        # Fetch shot chart data
        shot_chart_data = get_shot_chart_data(game_id, player_ids_by_team)
        if shot_chart_data:
            game_data['shotChartData'] = shot_chart_data
        
        # Generate story (after all data is collected)
        print("  Generating game story...")
        story = tell_story(game_data)
        game_data['story'] = story
        
        # Calculate fun score (after videos/play-by-play is fetched)
        print("  Calculating fun score...")
        score_data = calculate_game_score(game_data)
        if score_data:
            game_data['score'] = {
                game_id: score_data
            }
        else:
            print("    ⚠ Could not calculate fun score")
        
        return game_data
        
    except Exception as e:
        print(f"\n✗ FAIL: Error building complete game data")
        print(f"Error details: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def get_shot_chart_data(game_id, player_ids_by_team):
    """
    Fetch shot chart data for all players in a game using ShotChartDetail endpoint.
    
    Args:
        game_id: Game ID string
        player_ids_by_team: Dictionary mapping team_id to list of player_ids
    
    Returns:
        Dictionary mapping player_id to list of shot chart entries
    """
    try:
        print("  Fetching shot chart data...")
        from nba_api.stats.endpoints.shotchartdetail import ShotChartDetail
        from nba_api.stats.library.parameters import ContextMeasureSimple
        
        shot_chart_data = {}
        total_shots = 0
        
        # Fetch shot charts for each player
        for team_id, player_ids in player_ids_by_team.items():
            for player_id in player_ids:
                if not player_id or player_id == 0:
                    continue
                
                try:
                    # Fetch shot chart for this player in this game
                    shot_chart = ShotChartDetail(
                        team_id=team_id,
                        player_id=player_id,
                        game_id_nullable=game_id,
                        context_measure_simple=ContextMeasureSimple.default,
                        get_request=True
                    )
                    time.sleep(0.6)  # Rate limiting
                    
                    # Get shot chart detail data
                    if shot_chart.shot_chart_detail:
                        df = shot_chart.shot_chart_detail.get_data_frame()
                        if not df.empty:
                            # Filter to only shots from this game
                            # Handle both uppercase and lowercase column names
                            game_id_col = 'GAME_ID' if 'GAME_ID' in df.columns else 'game_id'
                            if game_id_col in df.columns:
                                game_shots = df[df[game_id_col] == game_id].to_dict('records')
                                if game_shots:
                                    shot_chart_data[player_id] = game_shots
                                    total_shots += len(game_shots)
                                    print(f"    ✓ Player {player_id}: {len(game_shots)} shots")
                            else:
                                # If GAME_ID column doesn't exist, assume all shots are from this game
                                # (since we filtered by game_id_nullable in the API call)
                                all_shots = df.to_dict('records')
                                if all_shots:
                                    shot_chart_data[player_id] = all_shots
                                    total_shots += len(all_shots)
                                    print(f"    ✓ Player {player_id}: {len(all_shots)} shots (no GAME_ID filter)")
                    
                except Exception as e:
                    # Silently skip if player has no shots or error occurs
                    continue
        
        print(f"    ✓ Total shots fetched: {total_shots} from {len(shot_chart_data)} players")
        return shot_chart_data
        
    except Exception as e:
        print(f"    ⚠ Error fetching shot chart data: {e}")
        return {}


def is_nba_game(row):
    """
    Check if a game is an NBA game (not G League).
    NBA team IDs are in the range 1610612737-1610612766 (30 teams).
    
    Args:
        row: DataFrame row with game information
    
    Returns:
        True if NBA game, False if G League or other
    """
    # Check various possible team ID column names
    team_id_columns = ['TEAM_ID', 'PLAYER1_TEAM_ID', 'TEAM_ID_HOME', 'TEAM_ID_AWAY']
    
    for col in team_id_columns:
        if col in row.index:
            team_id = row[col]
            if pd.notna(team_id):
                try:
                    team_id_int = int(team_id)
                    # NBA team IDs are in the range 1610612737-1610612766
                    # G League teams have IDs outside this range
                    if team_id_int < 1610000000 or team_id_int > 1610612800:
                        return False
                except (ValueError, TypeError):
                    pass
    
    # If we can't find team IDs, check if we can infer from game ID format
    # NBA game IDs typically start with "002" for regular season
    game_id = str(row.get('GAME_ID', ''))
    if game_id.startswith('002'):
        return True
    
    # If we can't determine, assume it's NBA (safer to include than exclude)
    return True


def filter_nba_games(df):
    """
    Filter DataFrame to only include NBA games (exclude G League games).
    
    Args:
        df: DataFrame with game information
    
    Returns:
        Filtered DataFrame with only NBA games
    """
    if df is None or df.empty:
        return df
    
    # Group by game_id to check all teams in each game
    nba_game_ids = set()
    
    for game_id in df['GAME_ID'].unique():
        game_rows = df[df['GAME_ID'] == game_id]
        
        # Check if all teams in this game are NBA teams
        is_nba = True
        team_ids_found = set()
        
        for _, row in game_rows.iterrows():
            # Check various possible team ID column names
            team_id_columns = ['TEAM_ID', 'PLAYER1_TEAM_ID', 'TEAM_ID_HOME', 'TEAM_ID_AWAY']
            
            for col in team_id_columns:
                if col in row.index:
                    team_id = row[col]
                    if pd.notna(team_id):
                        try:
                            team_id_int = int(team_id)
                            team_ids_found.add(team_id_int)
                            
                            # NBA team IDs are in the range 1610612737-1610612766
                            # G League teams have IDs outside this range
                            if team_id_int < 1610000000 or team_id_int > 1610612800:
                                is_nba = False
                                break
                        except (ValueError, TypeError):
                            pass
            
            if not is_nba:
                break
        
        # If we found team IDs and they're all in NBA range, it's an NBA game
        if team_ids_found:
            if is_nba:
                nba_game_ids.add(game_id)
        else:
            # If we can't find team IDs, check game ID format
            # NBA game IDs typically start with "002" for regular season
            if str(game_id).startswith('002'):
                nba_game_ids.add(game_id)
            # Otherwise, skip it (safer to exclude if we can't verify)
    
    # Filter to only NBA games
    filtered_df = df[df['GAME_ID'].isin(nba_game_ids)]
    
    return filtered_df


def get_unique_game_ids(df):
    """
    Get unique game IDs from a DataFrame, filtering out G League games.
    
    Args:
        df: DataFrame with game information
    
    Returns:
        List of unique game IDs with matchup info (NBA games only)
    """
    # Filter out G League games first
    df = filter_nba_games(df)
    
    if df is None or df.empty:
        return []
    
    games_info = []
    seen_game_ids = set()
    
    for _, row in df.iterrows():
        game_id = row['GAME_ID']
        if game_id not in seen_game_ids:
            seen_game_ids.add(game_id)
            matchup = row['MATCHUP']
            game_date = row['GAME_DATE']
            games_info.append({
                'game_id': game_id,
                'matchup': matchup,
                'date': game_date
            })
    
    return games_info


def is_valid_game_data(game_data):
    """
    Validate that scraped game data is complete enough to save.
    Returns (is_valid, reason) tuple.
    
    A game file is considered invalid (and should NOT be saved) if:
    - PlayerStats is empty (no box score data)
    - Both team abbreviations are missing/null
    - gameMetadata is missing
    """
    if not game_data:
        return False, "game_data is None"
    
    # Check metadata exists
    meta = game_data.get('gameMetadata', {})
    if not meta:
        return False, "no gameMetadata"
    
    # Check team abbreviations
    home_abbr = meta.get('homeTeam', {}).get('abbreviation')
    away_abbr = meta.get('awayTeam', {}).get('abbreviation')
    if not home_abbr and not away_abbr:
        return False, "no team abbreviations (game likely not played yet)"
    
    # Check PlayerStats is populated
    player_stats = game_data.get('PlayerStats', [])
    if not player_stats or len(player_stats) == 0:
        return False, "empty PlayerStats (box score not available)"
    
    return True, "ok"


def scrape_nba_game_ids_date_range(start_date, end_date, max_retries=3):
    """
    Main function: Get all games for a date range and scrape them automatically.
    Implements retry logic for failed games.
    
    Args:
        start_date: Start date string in format YYYY-MM-DD
        end_date: End date string in format YYYY-MM-DD
        max_retries: Maximum number of retry attempts for failed games (default: 3)
    """
    try:
        # Parse dates
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        
        # Validate date range
        if start > end:
            print(f"\n✗ FAIL: Start date must be before or equal to end date")
            return
        
        # Calculate total days
        total_days = (end - start).days + 1
        print(f"\n{'='*80}")
        print(f"Starting to scrape NBA 2025-26 season games from {start_date} to {end_date}")
        print(f"Total days to process: {total_days}")
        print(f"Max retries per failed game: {max_retries}")
        print(f"Output directory: {FEED_DIR}")
        print(f"{'='*80}\n")
        
        # Track statistics
        total_games = 0
        successful_games = 0
        failed_games = 0
        skipped_games = 0
        
        # Track failed games for retry
        failed_games_list = []  # List of game_info dicts that failed
        
        # Iterate through each date
        current_date = start
        day_count = 0
        
        while current_date <= end:
            day_count += 1
            date_str = current_date.strftime('%Y-%m-%d')
            
            print(f"\n{'='*80}")
            print(f"DAY {day_count}/{total_days}: {date_str}")
            print(f"{'='*80}\n")
            
            try:
                # Get games for this date
                df = get_games_for_date(date_str)
                if df is None or df.empty:
                    print(f"⚠ No games found for {date_str}, skipping...")
                    # Still add delay between days
                    if current_date < end:
                        print(f"\n⏸ Waiting 10 minutes before next day...")
                        time.sleep(600)  # 10 minutes = 600 seconds
                    current_date += timedelta(days=1)
                    continue
                
                # Get unique game IDs
                games_info = get_unique_game_ids(df)
                print(f"\nFound {len(games_info)} games for {date_str}:")
                for idx, game in enumerate(games_info, 1):
                    print(f"  {idx}. {game['game_id']} - {game['matchup']}")
                
                total_games += len(games_info)
                
                # Process each game
                for game_idx, game_info in enumerate(games_info, 1):
                    game_id = game_info['game_id']
                    matchup = game_info['matchup']
                    output_file = str(FEED_DIR / f"{game_id}.json")
                    
                    # Check if file already exists
                    if os.path.exists(output_file):
                        print(f"\n{'='*80}")
                        print(f"GAME {game_idx}/{len(games_info)} for {date_str}: {game_id}")
                        print(f"Matchup: {matchup}")
                        print(f"{'='*80}\n")
                        print(f"⏭ Game {game_id} already exists ({output_file}), skipping...")
                        skipped_games += 1
                        # Wait 5 seconds before next game (except after the last game of the day)
                        if game_idx < len(games_info):
                            print(f"\n⏸ Waiting 5 seconds before next game...")
                            time.sleep(5)  # 5 seconds
                        continue
                    
                    print(f"\n{'='*80}")
                    print(f"GAME {game_idx}/{len(games_info)} for {date_str}: {game_id}")
                    print(f"Matchup: {matchup}")
                    print(f"{'='*80}\n")
                    
                    game_success = False
                    try:
                        # Get all game data
                        game_data = get_complete_game_data(game_id, df)
                        
                        if game_data:
                            # ── Validate data quality before saving ──
                            is_valid, validity_reason = is_valid_game_data(game_data)
                            if not is_valid:
                                print(f"\n  ⚠️  SKIPPING SAVE for {game_id}: {validity_reason}")
                                print(f"  Game data is incomplete — will NOT create an empty shell file.")
                                failed_games += 1
                                failed_games_list.append(game_info)
                            else:
                                # Check if videos were successfully fetched
                                videos_count = 0
                                if 'playByPlay' in game_data and 'allPlays' in game_data['playByPlay']:
                                    videos_count = len(game_data['playByPlay']['allPlays'])
                                
                                # If no videos, mark for retry but still save (data is valid)
                                if videos_count == 0:
                                    print(f"  ⚠️  WARNING: No videos found for {game_id}")
                                    print(f"  Game data is valid and will be saved, but marked for video retry")
                                    failed_games_list.append(game_info)
                                else:
                                    game_success = True
                                
                                # Save complete game data to JSON file (in scripts/feed/)
                                with open(output_file, 'w') as f:
                                    json.dump(game_data, f, indent=2)
                                print(f"\n✓ Complete game data saved to {output_file}")
                                
                                if game_success:
                                    successful_games += 1
                                else:
                                    failed_games += 1
                                
                                # Print summary
                                if 'score' in game_data and game_data['score']:
                                    score_info = game_data['score'].get(game_id, {})
                                    if score_info:
                                        fun_score = score_info.get('fun_score', 'N/A')
                                        print(f"  Fun Score: {fun_score}")
                                
                                print(f"  Videos/Plays: {videos_count} events")
                                player_count = len(game_data.get('PlayerStats', []))
                                print(f"  Players: {player_count}")
                        else:
                            print(f"\n⚠ WARNING: Failed to fetch complete game data for {game_id}")
                            failed_games += 1
                            failed_games_list.append(game_info)
                    
                    except KeyboardInterrupt:
                        print(f"\n⚠ Interrupted by user")
                        raise
                    except Exception as e:
                        print(f"\n✗ FAIL: Error processing game {game_id}")
                        print(f"Error details: {str(e)}")
                        failed_games += 1
                        failed_games_list.append(game_info)
                        import traceback
                        traceback.print_exc()
                    
                    # Wait 5 minutes between games (except after the last game of the day)
                    if game_idx < len(games_info):
                        print(f"\n⏸ Waiting 5 minutes before next game...")
                        time.sleep(300)  # 5 minutes = 300 seconds
                
                # Wait 10 minutes between days (except after the last day)
                if current_date < end:
                    print(f"\n⏸ Waiting 10 minutes before next day...")
                    time.sleep(600)  # 10 minutes = 600 seconds
                
            except Exception as e:
                print(f"\n✗ FAIL: Error processing date {date_str}")
                print(f"Error details: {str(e)}")
                import traceback
                traceback.print_exc()
            
            # Move to next date
            current_date += timedelta(days=1)
        
        # Retry failed games
        retry_round = 0
        while failed_games_list and retry_round < max_retries:
            retry_round += 1
            print(f"\n{'='*80}")
            print(f"RETRY ROUND {retry_round}/{max_retries}")
            print(f"Retrying {len(failed_games_list)} failed games...")
            print(f"{'='*80}\n")
            
            # Wait before retry round
            if retry_round > 1:
                wait_minutes = 30 * retry_round  # Exponential backoff: 30, 60, 90 minutes
                print(f"⏸ Waiting {wait_minutes} minutes before retry round {retry_round}...")
                time.sleep(wait_minutes * 60)
            
            # Process failed games
            still_failed = []
            for game_info in failed_games_list:
                game_id = game_info['game_id']
                matchup = game_info['matchup']
                date_str = game_info['date']
                output_file = str(FEED_DIR / f"{game_id}.json")
                
                print(f"\n{'='*80}")
                print(f"RETRY: {game_id} - {matchup}")
                print(f"{'='*80}\n")
                
                try:
                    # Get games for this date again
                    df = get_games_for_date(date_str)
                    if df is None or df.empty:
                        print(f"  ⚠️  No games found for {date_str}, will retry later")
                        still_failed.append(game_info)
                        continue
                    
                    # Get all game data
                    game_data = get_complete_game_data(game_id, df)
                    
                    if game_data:
                        # Validate data quality before saving
                        is_valid, validity_reason = is_valid_game_data(game_data)
                        if not is_valid:
                            print(f"  ⚠️  Still invalid ({validity_reason}), will retry again")
                            still_failed.append(game_info)
                        else:
                            videos_count = 0
                            if 'playByPlay' in game_data and 'allPlays' in game_data['playByPlay']:
                                videos_count = len(game_data['playByPlay']['allPlays'])
                            
                            # Save valid data even without videos
                            with open(output_file, 'w') as f:
                                json.dump(game_data, f, indent=2)
                            print(f"  ✓ Complete game data saved to {output_file}")
                            
                            if videos_count == 0:
                                print(f"  ⚠️  No videos but data is valid — saved. Will retry for videos.")
                                still_failed.append(game_info)
                            else:
                                successful_games += 1
                                failed_games -= 1
                                print(f"  ✓ Successfully retried {game_id} with {videos_count} videos")
                    else:
                        print(f"  ⚠️  Failed to fetch game data, will retry")
                        still_failed.append(game_info)
                
                except Exception as e:
                    print(f"  ✗ Error on retry: {e}")
                    still_failed.append(game_info)
                
                # Wait between retries
                time.sleep(60)  # 1 minute between retries
            
            failed_games_list = still_failed
            
            if failed_games_list:
                print(f"\n⚠️  {len(failed_games_list)} games still failed after retry round {retry_round}")
            else:
                print(f"\n✓ All games successfully processed after retry round {retry_round}")
        
        # Print final summary
        print(f"\n{'='*80}")
        print(f"SCRAPING COMPLETE")
        print(f"{'='*80}")
        print(f"Total games processed: {total_games}")
        print(f"Successful: {successful_games}")
        print(f"Skipped (already exist): {skipped_games}")
        print(f"Failed: {failed_games}")
        if failed_games_list:
            print(f"\n⚠️  {len(failed_games_list)} games still failed after all retries:")
            for game_info in failed_games_list:
                print(f"  - {game_info['game_id']} - {game_info['matchup']}")
        print(f"{'='*80}\n")
        
    except ImportError as e:
        print(f"\n✗ FAIL: Import error - nba_api package may not be installed")
        print(f"Install it with: pip install nba-api")
        print(f"Error details: {str(e)}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ FAIL: Error occurred while scraping games")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Scrape NBA 2025-26 season games for a date range with automatic processing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python3 scrape_games_date_range.py 2025-10-29 2025-11-04
  python3 scrape_games_date_range.py 2025-10-31 2025-10-31  # Single day
        '''
    )
    parser.add_argument(
        'start_date',
        type=validate_date,
        help='Start date (format: YYYY-MM-DD, e.g., 2025-10-29)'
    )
    parser.add_argument(
        'end_date',
        type=validate_date,
        help='End date (format: YYYY-MM-DD, e.g., 2025-11-04)'
    )
    
    args = parser.parse_args()
    scrape_nba_game_ids_date_range(args.start_date, args.end_date)

