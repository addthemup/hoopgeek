#!/usr/bin/env python3
"""
Live Fantasy Score Updater
Fetches and stores raw player stats from live NBA games
Frontend handles fantasy scoring calculations using fantasyScoring.ts utility
Should run every 60 seconds during game times
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from supabase import create_client, Client
from nba_api.live.nba.endpoints import scoreboard, boxscore

def setup_supabase() -> Client:
    """Initialize Supabase client"""
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        print("❌ Missing Supabase credentials")
        sys.exit(1)
    
    return create_client(url, key)

def get_todays_live_games() -> List[Dict]:
    """Get all games happening today from NBA API"""
    try:
        board = scoreboard.ScoreBoard()
        games = board.games.get_dict()
        
        live_and_final_games = []
        for game in games:
            game_status = game.get('gameStatus', 1)
            # Status 1 = not started, 2 = in progress, 3 = final
            if game_status in [2, 3]:  # Only get live or just-finished games
                live_and_final_games.append({
                    'game_id': game['gameId'],
                    'status': game_status,
                    'status_text': game.get('gameStatusText', ''),
                    'home_team': game['homeTeam']['teamName'],
                    'away_team': game['awayTeam']['teamName'],
                })
        
        return live_and_final_games
    except Exception as e:
        print(f"❌ Error fetching live games: {e}")
        return []

def convert_minutes_to_int(minutes_str: str) -> Optional[int]:
    """Convert PT00M00.00S format to integer minutes"""
    if not minutes_str or minutes_str == 'PT00M00.00S':
        return 0
    
    try:
        # Format: PT32M33.00S
        minutes_str = minutes_str.replace('PT', '').replace('S', '')
        if 'M' in minutes_str:
            parts = minutes_str.split('M')
            minutes = int(parts[0])
            seconds = float(parts[1]) if len(parts) > 1 else 0
            return int(minutes + (seconds / 60.0))
        return 0
    except:
        return 0

def fetch_live_box_score(game_id: str) -> Optional[Dict]:
    """Fetch live box score for a game"""
    try:
        box = boxscore.BoxScore(game_id)
        return box.get_dict()
    except Exception as e:
        print(f"⚠️  Error fetching box score for {game_id}: {e}")
        return None

def update_player_live_stats(supabase: Client, game_id: str, box_score_data: Dict) -> int:
    """Update live raw stats for players in this game (frontend calculates fantasy points)"""
    if not box_score_data:
        return 0
    
    game = box_score_data.get('game', {})
    home_players = game.get('homeTeam', {}).get('players', [])
    away_players = game.get('awayTeam', {}).get('players', [])
    all_players = home_players + away_players
    
    updated_count = 0
    
    for player in all_players:
        person_id = player.get('personId')
        if not person_id:
            continue
        
        raw_stats = player.get('statistics', {})
        
        # Only update players who have played
        if raw_stats.get('minutes', 'PT00M00.00S') == 'PT00M00.00S':
            continue
        
        # Convert stats to match your fantasyScoring.ts PlayerGameLog interface
        converted_stats = {
            'pts': raw_stats.get('points', 0),
            'reb': raw_stats.get('reboundsTotal', 0),
            'ast': raw_stats.get('assists', 0),
            'stl': raw_stats.get('steals', 0),
            'blk': raw_stats.get('blocks', 0),
            'tov': raw_stats.get('turnovers', 0),
            'fgm': raw_stats.get('fieldGoalsMade', 0),
            'fga': raw_stats.get('fieldGoalsAttempted', 0),
            'fg_pct': raw_stats.get('fieldGoalsPercentage', 0),
            'fg3m': raw_stats.get('threePointersMade', 0),
            'fg3a': raw_stats.get('threePointersAttempted', 0),
            'fg3_pct': raw_stats.get('threePointersPercentage', 0),
            'ftm': raw_stats.get('freeThrowsMade', 0),
            'fta': raw_stats.get('freeThrowsAttempted', 0),
            'ft_pct': raw_stats.get('freeThrowsPercentage', 0),
            'oreb': raw_stats.get('reboundsOffensive', 0),
            'dreb': raw_stats.get('reboundsDefensive', 0),
            'pf': raw_stats.get('foulsPersonal', 0),
            'min': convert_minutes_to_int(raw_stats.get('minutes', 'PT00M00.00S')),
            'plus_minus': raw_stats.get('plusMinusPoints', 0),
        }
        
        # Update live stats in database (raw stats only, no fantasy points calculated)
        try:
            live_stat = {
                'game_id': game_id,
                'nba_player_id': person_id,
                'player_name': player.get('name'),
                'team_tricode': player.get('teamTricode'),
                'stats': converted_stats,
                'raw_stats': raw_stats,  # Keep original for reference
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            
            result = supabase.table('live_player_stats').upsert(
                live_stat,
                on_conflict='game_id,nba_player_id'
            ).execute()
            
            if result.data:
                updated_count += 1
        except Exception as e:
            print(f"⚠️  Error updating live stats for player {person_id}: {e}")
    
    return updated_count

def mark_stats_updated(supabase: Client) -> int:
    """Mark that live stats have been updated (frontend calculates scores using fantasyScoring.ts)"""
    try:
        # Just mark the timestamp so frontend knows to refetch
        # The frontend will:
        # 1. Fetch live_player_stats for players in DFS entries
        # 2. Use fantasyScoring.ts to calculate points per scoring format
        # 3. Display live leaderboards with calculated scores
        
        # Update a simple marker table or just return the update count
        today = datetime.now().date().isoformat()
        
        # Mark that today's stats have been updated
        marker = {
            'date': today,
            'last_updated': datetime.now(timezone.utc).isoformat(),
            'status': 'active'
        }
        
        result = supabase.table('live_stats_updates').upsert(
            marker,
            on_conflict='date'
        ).execute()
        
        return 1 if result.data else 0
    except Exception as e:
        print(f"⚠️  Note: Could not update marker (table may not exist): {e}")
        return 0

def get_stats_summary(supabase: Client) -> Dict:
    """Get summary of live stats for logging"""
    try:
        # Count active games and players
        result = supabase.table('live_player_stats') \
            .select('game_id, nba_player_id', count='exact') \
            .gt('updated_at', (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()) \
            .execute()
        
        if result.data:
            game_ids = set(stat['game_id'] for stat in result.data)
            return {
                'active_games': len(game_ids),
                'active_players': len(result.data),
                'games': list(game_ids)
            }
        return {'active_games': 0, 'active_players': 0, 'games': []}
    except Exception as e:
        return {'error': str(e)}

def main():
    """Main function to update live fantasy scores"""
    print("=" * 80)
    print("🏀 Live Fantasy Score Update")
    print(f"⏰ Run time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    supabase = setup_supabase()
    
    # Get today's live games
    live_games = get_todays_live_games()
    
    if not live_games:
        print("ℹ️  No live or recently completed games right now")
        return
    
    print(f"\n🎮 Found {len(live_games)} active games")
    
    total_players_updated = 0
    
    # Update player stats from each game
    for game in live_games:
        game_id = game['game_id']
        status = game['status_text']
        matchup = f"{game['away_team']} @ {game['home_team']}"
        
        print(f"\n📊 {game_id}: {matchup} ({status})")
        
        # Fetch live box score
        box_score = fetch_live_box_score(game_id)
        
        if box_score:
            # Update live player stats
            players_updated = update_player_live_stats(supabase, game_id, box_score)
            total_players_updated += players_updated
            print(f"   ✅ Updated {players_updated} players")
        else:
            print(f"   ⚠️  Could not fetch box score")
    
    # Mark stats as updated (frontend will calculate scores)
    print(f"\n✅ Marking stats update timestamp...")
    mark_stats_updated(supabase)
    
    # Get summary of what's active
    summary = get_stats_summary(supabase)
    
    print(f"\n{'=' * 80}")
    print(f"📊 Update Summary:")
    print(f"   Games processed: {len(live_games)}")
    print(f"   Players updated: {total_players_updated}")
    print(f"   Active games in last 10min: {summary.get('active_games', 0)}")
    print(f"   Active players in last 10min: {summary.get('active_players', 0)}")
    print(f"\n💡 Frontend will calculate fantasy scores using fantasyScoring.ts")
    print(f"{'=' * 80}")
    
    print(f"\n✅ Live fantasy score update completed!")

if __name__ == "__main__":
    main()

