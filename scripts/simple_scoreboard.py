#!/usr/bin/env python3
"""
Simple Live Scoreboard using NBA API
This version works around the WinProbability issue
"""

import os
import sys
import json
from datetime import datetime, timedelta
from nba_api.stats.endpoints import scoreboardv2
from nba_api.stats.library.parameters import DayOffset, GameDate, LeagueID

def get_simple_scoreboard(game_date=None, day_offset=0):
    """
    Fetch live scoreboard data using NBA API ScoreboardV2
    """
    try:
        print(f"🏀 Fetching live scoreboard data...")
        
        # Set up parameters
        params = {
            'day_offset': day_offset,
            'league_id': LeagueID.default
        }
        
        if game_date:
            params['game_date'] = game_date
        
        # Fetch data from NBA API
        scoreboard = scoreboardv2.ScoreboardV2(**params)
        
        # Extract game data
        games_data = []
        
        # Get game headers
        game_headers = scoreboard.game_header.get_data_frame()
        line_scores = scoreboard.line_score.get_data_frame()
        
        print(f"📊 Found {len(game_headers)} games")
        
        for _, game in game_headers.iterrows():
            game_id = game['GAME_ID']
            
            # Get line scores for this game
            game_line_scores = line_scores[line_scores['GAME_ID'] == game_id]
            
            if len(game_line_scores) < 2:
                continue  # Skip if we don't have both teams
                
            # Separate home and away teams
            home_team = game_line_scores[game_line_scores['TEAM_ID'] == game['HOME_TEAM_ID']].iloc[0]
            away_team = game_line_scores[game_line_scores['TEAM_ID'] == game['VISITOR_TEAM_ID']].iloc[0]
            
            # Extract quarter scores
            def get_quarter_scores(team_data):
                quarters = []
                for i in range(1, 5):  # Q1-Q4
                    q_key = f'PTS_QTR{i}'
                    if q_key in team_data and pd.notna(team_data[q_key]):
                        quarters.append(int(team_data[q_key]))
                    else:
                        quarters.append(0)
                return quarters
            
            # Build game object
            game_data = {
                'gameId': str(game_id),
                'gameDate': game['GAME_DATE_EST'],
                'gameStatus': int(game['GAME_STATUS_ID']),
                'gameStatusText': game['GAME_STATUS_TEXT'],
                'homeTeam': {
                    'id': int(game['HOME_TEAM_ID']),
                    'abbreviation': home_team['TEAM_ABBREVIATION'],
                    'city': home_team['TEAM_CITY_NAME'],
                    'name': home_team['TEAM_NAME'],
                    'wins': int(home_team['TEAM_WINS_LOSSES'].split('-')[0]) if home_team['TEAM_WINS_LOSSES'] else 0,
                    'losses': int(home_team['TEAM_WINS_LOSSES'].split('-')[1]) if home_team['TEAM_WINS_LOSSES'] else 0,
                    'points': int(home_team['PTS']) if pd.notna(home_team['PTS']) else 0,
                    'quarters': get_quarter_scores(home_team)
                },
                'awayTeam': {
                    'id': int(game['VISITOR_TEAM_ID']),
                    'abbreviation': away_team['TEAM_ABBREVIATION'],
                    'city': away_team['TEAM_CITY_NAME'],
                    'name': away_team['TEAM_NAME'],
                    'wins': int(away_team['TEAM_WINS_LOSSES'].split('-')[0]) if away_team['TEAM_WINS_LOSSES'] else 0,
                    'losses': int(away_team['TEAM_WINS_LOSSES'].split('-')[1]) if away_team['TEAM_WINS_LOSSES'] else 0,
                    'points': int(away_team['PTS']) if pd.notna(away_team['PTS']) else 0,
                    'quarters': get_quarter_scores(away_team)
                },
                'arena': game.get('ARENA_NAME', 'Unknown Arena'),
                'nationalTV': game.get('NATL_TV_BROADCASTER_ABBREVIATION', None)
            }
            
            # Add live period info if game is live
            if game['GAME_STATUS_ID'] == 2:  # Live
                game_data['livePeriod'] = int(game.get('LIVE_PERIOD', 1))
                game_data['liveTime'] = game.get('LIVE_PC_TIME', '')
            
            games_data.append(game_data)
        
        result = {
            'games': games_data,
            'eastStandings': [],
            'westStandings': [],
            'lastUpdated': datetime.now().isoformat(),
            'gameDate': game_date or datetime.now().strftime('%Y-%m-%d')
        }
        
        print(f"✅ Successfully fetched {len(games_data)} games")
        return result
        
    except Exception as e:
        print(f"❌ Error fetching live scoreboard: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """Main function to fetch and display live scoreboard"""
    print("🚀 NBA Live Scoreboard API (Simple Version)")
    print("=" * 50)
    
    # Get today's games
    today_data = get_simple_scoreboard()
    
    if today_data:
        print(f"\n📅 Games for {today_data['gameDate']}:")
        print(f"🕐 Last updated: {today_data['lastUpdated']}")
        
        for game in today_data['games']:
            status_emoji = {
                1: "⏰",  # Scheduled
                2: "🔴",  # Live
                3: "✅"   # Final
            }.get(game['gameStatus'], "❓")
            
            print(f"\n{status_emoji} {game['awayTeam']['abbreviation']} @ {game['homeTeam']['abbreviation']}")
            print(f"   Status: {game['gameStatusText']}")
            print(f"   Score: {game['awayTeam']['points']} - {game['homeTeam']['points']}")
            print(f"   Arena: {game['arena']}")
            
            if game.get('nationalTV'):
                print(f"   TV: {game['nationalTV']}")
        
        # Save to file
        with open('live_scoreboard.json', 'w') as f:
            json.dump(today_data, f, indent=2)
        print(f"\n💾 Saved data to live_scoreboard.json")
        
        print(f"\n🎉 Live scoreboard data fetched successfully!")
        print(f"📊 Total games: {len(today_data['games'])}")
        print(f"🏀 Live games: {len([g for g in today_data['games'] if g['gameStatus'] == 2])}")
        print(f"✅ Final games: {len([g for g in today_data['games'] if g['gameStatus'] == 3])}")
        
    else:
        print("❌ Failed to fetch live scoreboard data")

if __name__ == "__main__":
    # Import pandas here to avoid import issues
    try:
        import pandas as pd
        main()
    except ImportError:
        print("❌ pandas is required. Install with: pip install pandas")
        sys.exit(1)
