from datetime import datetime
import json

def parse_clock(clock_str):
    """Convert PT12M00.00S format to seconds"""
    # Remove 'PT' and 'S'
    time_str = clock_str.replace('PT', '').replace('S', '')
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
        if not play['scoreHome'] or not play['scoreAway']:
            continue
            
        score_home = int(play['scoreHome'])
        score_away = int(play['scoreAway'])
        
        # Determine current leader
        new_leader = None
        if score_home > score_away:
            new_leader = 'home'
        elif score_away > score_home:
            new_leader = 'away'
            
        # Check if in last 5 minutes of 4th period or overtime
        if play['period'] >= 4:  # Include overtime periods
            clock_seconds = parse_clock(play['clock'])
            
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
        if 'Dunk' in play.get('subType', '') and play.get('shotResult') == 'Made':
            # Skip if no scores are recorded
            if not play['scoreHome'] or not play['scoreAway']:
                continue
            
            # Verify score increased
            prev_home = int(play_by_play_data[i-1]['scoreHome']) if i > 0 and play_by_play_data[i-1]['scoreHome'] else 0
            prev_away = int(play_by_play_data[i-1]['scoreAway']) if i > 0 and play_by_play_data[i-1]['scoreAway'] else 0
            curr_home = int(play['scoreHome'])
            curr_away = int(play['scoreAway'])
            
            if (curr_home > prev_home) or (curr_away > prev_away):
                dunk_type = play['subType']
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
            shot_distance = play.get('shotDistance', 0)
            if shot_distance > 27:
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
            # Get traditional stats, default to 0 if None
            points = int(stats.get('traditional_PTS', 0) or 0)
            rebounds = int(stats.get('traditional_REB', 0) or 0)
            assists = int(stats.get('traditional_AST', 0) or 0)
            blocks = int(stats.get('traditional_BLK', 0) or 0)
            steals = int(stats.get('traditional_STL', 0) or 0)
            player_name = stats.get('traditional_PLAYER_NAME', 'Unknown Player')
            
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
    team1_name = team1.get('traditional_TEAM_ABBREVIATION', 'team1')
    team2_name = team2.get('traditional_TEAM_ABBREVIATION', 'team2')
    
    # Calculate margin of victory
    team1_pts = int(team1.get('traditional_PTS', 0))
    team2_pts = int(team2.get('traditional_PTS', 0))
    margin_of_victory = abs(team1_pts - team2_pts)
    
    # Calculate three point stats
    team1_threes = int(team1.get('traditional_FG3M', 0))
    team2_threes = int(team2.get('traditional_FG3M', 0))
    combined_threes = team1_threes + team2_threes
    
    team1_three_pct = float(team1.get('traditional_FG3_PCT', 0))
    team2_three_pct = float(team2.get('traditional_FG3_PCT', 0))
    combined_three_pct = (team1_three_pct + team2_three_pct) / 2
    
    # Calculate pace
    team1_pace = float(team1.get('advanced_pace', 0))
    team2_pace = float(team2.get('advanced_pace', 0))
    pace = (team1_pace + team2_pace) / 2
    
    # Calculate contested shots and percentages
    team1_contested = int(team1.get('playerTrack_contestedFieldGoalsMade', 0))
    team1_contested_att = int(team1.get('playerTrack_contestedFieldGoalsAttempted', 0))
    team2_contested = int(team2.get('playerTrack_contestedFieldGoalsMade', 0))
    team2_contested_att = int(team2.get('playerTrack_contestedFieldGoalsAttempted', 0))
    
    combined_contested_pct = 0
    if (team1_contested_att + team2_contested_att) > 0:
        combined_contested_pct = ((team1_contested + team2_contested) / 
                                (team1_contested_att + team2_contested_att) * 100)
    
    # Calculate contested three point percentages
    team1_contested_3 = int(team1.get('hustle_contestedShots3pt', 0))
    team2_contested_3 = int(team2.get('hustle_contestedShots3pt', 0))
    team1_3pa = int(team1.get('traditional_FG3A', 0))
    team2_3pa = int(team2.get('traditional_FG3A', 0))
    
    combined_contested_3_pct = 0
    if (team1_3pa + team2_3pa) > 0:
        combined_contested_3_pct = ((team1_contested_3 + team2_contested_3) / 
                                  (team1_3pa + team2_3pa) * 100)
    
    # Calculate other stats
    combined_contested_shots = (int(team1.get('hustle_contestedShots', 0)) + 
                              int(team2.get('hustle_contestedShots', 0)))
    
    combined_contested_threes = (int(team1.get('hustle_contestedShots3pt', 0)) + 
                               int(team2.get('hustle_contestedShots3pt', 0)))
    
    combined_fast_break = (int(team1.get('misc_pointsFastBreak', 0)) + 
                          int(team2.get('misc_pointsFastBreak', 0)))
    
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
            team1_name: int(team1.get('hustle_contestedShots', 0)),
            team2_name: int(team2.get('hustle_contestedShots', 0))
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
            team1_name: int(team1.get('misc_pointsFastBreak', 0)),
            team2_name: int(team2.get('misc_pointsFastBreak', 0))
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
        return 1.4  # Reduced from 2.0 to 1.4

def calculate_fun_score(team_stats, lead_changes, lead_changes_5min, lead_changes_1min, buzzer_beater_changes, deep_threes, four_pointers, scoring_milestones, dunk_stats):
    """Calculate the Fun Score for a game based on various exciting statistics"""
    fun_score = 20  # Start with a base score of 25 instead of 0
    print("\nFun Score Components:")
    
    # Three point shooting - increased base scoring
    three_pct = team_stats["Combined Three %"]
    three_pt_penalty = 0
    if three_pct < 30:  # Reduced penalty threshold
        three_pt_penalty = (30 - three_pct) * 0.5  # Reduced penalty multiplier
    three_pt_score = max(5, (three_pct / 4) - three_pt_penalty)  # Minimum score of 5
    fun_score += three_pt_score
    print(f"• Three Point Shooting: {three_pt_score:.1f} points ({three_pct}%)")
    
    # Contested shots - increased base scoring
    contested_three_pct = team_stats["Combined Contested Three %"]
    contested_penalty = 0
    if contested_three_pct < 30:
        contested_penalty = (30 - contested_three_pct) * 0.8  # Reduced penalty
    
    contested_three_score = team_stats["Combined Contested Threes"] * (contested_three_pct / 125)
    contested_shot_score = team_stats["Combined Contested Shots"] * (team_stats["Combined Contested Shot %"] / 100)
    contested_total = max(5, (contested_three_score + contested_shot_score) * 0.15 - contested_penalty)  # Minimum score of 5
    fun_score += contested_total
    print(f"• Contested Shots: {contested_total:.1f} points ({contested_three_pct}% contested 3s)")
    
    # Lead changes - increased base multipliers
    base_changes = lead_changes * 0.5  # Increased from 0.33
    changes_5min = lead_changes_5min * 2.0  # Increased from 1.5
    changes_1min = lead_changes_1min * 4.0  # Increased from 3.0
    buzzer_bonus = buzzer_beater_changes * 15
    
    lead_changes_total = max(5, base_changes + changes_5min + changes_1min + buzzer_bonus)  # Minimum score of 5
    fun_score += lead_changes_total
    print(f"• Lead Changes: {lead_changes_total:.1f} points")
    print(f"  - Base Changes: {base_changes:.1f} ({lead_changes} changes)")
    print(f"  - Last 5 Min: {changes_5min:.1f} ({lead_changes_5min} changes)")
    print(f"  - Last 1 Min: {changes_1min:.1f} ({lead_changes_1min} changes)")
    print(f"  - Buzzer Beaters: {buzzer_bonus:.1f} ({buzzer_beater_changes} beaters)")
    
    # Deep shots
    deep_shot_score = (deep_threes * 2.5) + (four_pointers * 4)
    fun_score += deep_shot_score
    print(f"• Deep Shots: {deep_shot_score:.1f} points")
    print(f"  - Deep Threes: {deep_threes * 3:.1f} ({deep_threes} shots)")
    print(f"  - Four Pointers: {four_pointers * 5:.1f} ({four_pointers} shots)")
    
    # Dunks
    dunk_score = dunk_stats["Total Dunks"] * 1  # Changed from 2.5 to 1.25
    fun_score += dunk_score
    print(f"• Dunks: {dunk_score:.1f} points ({dunk_stats['Total Dunks']} dunks)")
    
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
    print(f"• Scoring Milestones: {milestone_score:.1f} points")
    for detail in milestone_details:
        print(f"  - {detail}")
    
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
        print(f"• Close Game Bonus: {margin_bonus:.1f} points ({margin} point margin)")
    
    # Apply pace multiplier
    pace = team_stats["Pace"]
    pace_multiplier = pace / 100
    raw_score = fun_score * pace_multiplier
    
    # Apply the boost factor
    boost_factor = get_boost_factor(raw_score)
    if boost_factor > 1.0:
        final_score = raw_score * boost_factor
        print(f"\nRaw Score: {raw_score:.1f}")
        print(f"Pace Multiplier: {pace_multiplier:.2f} ({pace:.1f} pace)")
        print(f"Boost Factor: {boost_factor:.2f}")
    else:
        final_score = raw_score
        print(f"\nRaw Score: {raw_score:.1f}")
        print(f"Pace Multiplier: {pace_multiplier:.2f} ({pace:.1f} pace)")
        print("No boost applied (score >= 85)")
    
    # Apply reduction for high scores
    reduction_factor = get_reduction_factor(raw_score)
    final_score = raw_score * reduction_factor
    
    print(f"Final Fun Score: {final_score:.1f}")
    
    return round(final_score, 1)

def process_game_data(game_data):
    """Process the game data and return statistics"""
    output = {}
    
    for game_id, game_info in game_data.items():
        play_by_play = game_info['PlayByPlay']['PlayByPlay']
        team_stats = calculate_team_stats(game_info['AggregatedTeamStats'])
        
        if team_stats:
            total_changes, changes_under_5, changes_under_1, buzzer_beater_changes = calculate_lead_changes(play_by_play)
            dunk_stats = calculate_dunk_stats(play_by_play)
            deep_threes, four_pointers = calculate_deep_shots(play_by_play)
            scoring_milestones = calculate_scoring_milestones(game_info['AggregatedPlayerStats'])
            
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
            
            output[game_id] = {
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
    
    return output

def main(json_data):
    """Main function to process the game data"""
    try:
        game_data = json.loads(json_data) if isinstance(json_data, str) else json_data
        output = process_game_data(game_data)
        
        # Always print the output, whether called directly or through another script
        print("\nSCORE OUTPUT:")
        print(json.dumps(output, indent=4))
        
        return output
    except Exception as e:
        print(f"Error processing game data: {e}")
        return None

if __name__ == "__main__":
    # This will only run if Score.py is run directly
    # For testing purposes
    test_json = '''
    {
        "0022400599": {
            "PlayByPlay": {
                "PlayByPlay": [
                    // ... play by play data ...
                ]
            }
        }
    }
    '''
    main(test_json)