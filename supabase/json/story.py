import json

def calculate_stat_difference(stat1, stat2, threshold=0.1):
    """Calculate the direct difference between two stats"""
    return abs(stat1 - stat2)

def tell_story(game_data):
    """Analyze game data and tell the story of how the game was won"""
    story_output = {
        "matchup": None,
        "final_score": None,
        "advantages": [],
        "teams": {
            "winner": {},
            "loser": {}
        }
    }
    
    for game_id, game_info in game_data.items():
        team_stats = game_info['AggregatedTeamStats']
        teams = list(team_stats.values())
        if len(teams) != 2:
            return story_output
        
        team1, team2 = teams[0], teams[1]
        
        # Determine winner
        team1_pts = int(team1.get('traditional_PTS', 0))
        team2_pts = int(team2.get('traditional_PTS', 0))
        winner = team1 if team1_pts > team2_pts else team2
        loser = team2 if team1_pts > team2_pts else team1
        margin = abs(team1_pts - team2_pts)
        
        # Extract teamId and teamTricode
        winner_team_id = int(winner.get('traditional_teamId', 0))
        winner_team_tricode = winner.get('teamTricode', '')
        loser_team_id = int(loser.get('traditional_teamId', 0))
        loser_team_tricode = loser.get('teamTricode', '')
        
        # Update story output with team information
        story_output['teams']['winner'] = {
            'name': winner['teamName'],
            'city': winner['teamCity'],
            'tricode': winner_team_tricode,
            'teamId': winner_team_id,
            'points': max(team1_pts, team2_pts)
        }
        
        story_output['teams']['loser'] = {
            'name': loser['teamName'],
            'city': loser['teamCity'],
            'tricode': loser_team_tricode,
            'teamId': loser_team_id,
            'points': min(team1_pts, team2_pts)
        }
        
        story_output['matchup'] = f"{winner['teamCity']} {winner['teamName']} vs {loser['teamCity']} {loser['teamName']}"
        story_output['final_score'] = f"{winner['teamCity']} {max(team1_pts, team2_pts)} - {loser['teamCity']} {min(team1_pts, team2_pts)}"
        
        # List of stats to compare
        stats_to_compare = {
            # 'advanced_assistPercentage': ('Assist %', 0.1),
            'advanced_assistToTurnover': ('Assist-to-Turnover', 0.2),
            'advanced_offensiveReboundPercentage': ('Offensive Rebound %', 0.1),
            'advanced_defensiveReboundPercentage': ('Defensive Rebound %', 0.1),
            # 'advanced_reboundPercentage': ('Total Rebound %', 0.1),
            'advanced_trueShootingPercentage': ('True Shooting %', 0.05),
            'fourFactors_freeThrowAttemptRate': ('Free Throw Rate', 0.1),
            # 'fourFactors_teamTurnoverPercentage': ('Turnover %', 0.1),
            # 'hustle_deflections': ('Deflections', 5),
            # 'hustle_screenAssistPoints': ('Screen Assist Points', 5),
            # 'hustle_looseBallsRecoveredTotal': ('Loose Balls Recovered', 2),
            'misc_pointsOffTurnovers': ('Points Off Turnovers', 5),
            'misc_pointsSecondChance': ('Second Chance Points', 5),
            'misc_pointsFastBreak': ('Fast Break Points', 5),
            'misc_pointsPaint': ('Points in Paint', 8),
            'misc_blocks': ('Blocks', 2),
            # 'playerTrack_distance': ('Distance Traveled', 1.0),
            
            # New Player Tracking Stats
            'playerTrack_touches': ('Ball Touches', 20),  # Significant difference in touches
            'playerTrack_passes': ('Total Passes', 25),   # Meaningful gap in ball movement
            'playerTrack_contestedFieldGoalPercentage': ('Contested FG%', 0.05),  # 5% difference is significant
            'playerTrack_uncontestedFieldGoalsPercentage': ('Uncontested FG%', 0.05),  # 5% difference is significant
            'playerTrack_defendedAtRimFieldGoalPercentage': ('Defended At Rim FG%', 0.08),  # 8% difference is significant
        }
        
        significant_advantages = []
        for stat_key, (stat_name, threshold) in stats_to_compare.items():
            winner_stat = float(winner.get(stat_key, 0))
            loser_stat = float(loser.get(stat_key, 0))
            
            diff = calculate_stat_difference(winner_stat, loser_stat)
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
                        'team': winner['teamCity'],
                        'teamId': winner_team_id,
                        'teamTricode': winner_team_tricode,
                        'value1': float(winner[stat_key]),
                        'value2': float(loser[stat_key]),
                        'diff': float(winner[stat_key] - loser[stat_key]),
                        'weighted_diff': weighted_diff  # Add weighted difference for sorting
                    })
        
        # Sort advantages by weighted difference magnitude
        significant_advantages.sort(key=lambda x: abs(x.get('weighted_diff', 0)), reverse=True)
        
        # Remove weighted_diff from final output
        for adv in significant_advantages:
            if 'weighted_diff' in adv:
                del adv['weighted_diff']
            
        story_output['advantages'] = significant_advantages[:15]
        
        # Print JSON output
        print("\nSTORY OUTPUT:")
        print(json.dumps(story_output, indent=2))
        
        return story_output

def main(json_data):
    """Main function to process the game data"""
    try:
        return tell_story(json_data)
    except Exception as e:
        print(f"Error analyzing game data: {e}")
        return None

if __name__ == "__main__":
    # For testing purposes
    test_json = '''
    {
        "0022300629": {
            "AggregatedTeamStats": {
                // ... team stats ...
            }
        }
    }
    '''
    main(test_json)