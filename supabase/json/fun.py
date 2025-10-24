from nba_api.stats.endpoints import scoreboardv2, boxscoretraditionalv2, playbyplayv3
from nba_api.stats.endpoints._base import Endpoint
from nba_api.stats.library.http import NBAStatsHTTP
import json
import os
from pathlib import Path

class BoxScoreAdvancedV3(Endpoint):
    endpoint = "boxscoreadvancedv3"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personId", "firstName", "familyName", "nameI", "playerSlug", "position",
            "comment", "jerseyNum", "minutes", "estimatedOffensiveRating", "offensiveRating",
            "estimatedDefensiveRating", "defensiveRating", "estimatedNetRating", "netRating",
            "assistPercentage", "assistToTurnover", "assistRatio", "offensiveReboundPercentage",
            "defensiveReboundPercentage", "reboundPercentage", "turnoverRatio",
            "effectiveFieldGoalPercentage", "trueShootingPercentage", "usagePercentage",
            "estimatedUsagePercentage", "estimatedPace", "pace", "pacePer40", "possessions", "PIE"
        ],
        "TeamStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "minutes", "estimatedOffensiveRating", "offensiveRating", "estimatedDefensiveRating",
            "defensiveRating", "estimatedNetRating", "netRating", "assistPercentage",
            "assistToTurnover", "assistRatio", "offensiveReboundPercentage",
            "defensiveReboundPercentage", "reboundPercentage", "estimatedTeamTurnoverPercentage",
            "turnoverRatio", "effectiveFieldGoalPercentage", "trueShootingPercentage",
            "usagePercentage", "estimatedUsagePercentage", "estimatedPace", "pace", "pacePer40",
            "possessions", "PIE"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")
        self.team_stats = data_sets.get("TeamStats")

class BoxScoreDefensiveV2(Endpoint):
    endpoint = "boxscoredefensivev2"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personId", "firstName", "familyName", "nameI", "playerSlug", "position",
            "comment", "jerseyNum", "matchupMinutes", "partialPossessions", "switchesOn",
            "playerPoints", "defensiveRebounds", "matchupAssists", "matchupTurnovers",
            "steals", "blocks", "matchupFieldGoalsMade", "matchupFieldGoalsAttempted",
            "matchupFieldGoalPercentage", "matchupThreePointersMade",
            "matchupThreePointersAttempted", "matchupThreePointerPercentage"
        ],
        "TeamStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "minutes"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")
        self.team_stats = data_sets.get("TeamStats")

class BoxScoreFourFactorsV3(Endpoint):
    endpoint = "boxscorefourfactorsv3"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personId", "firstName", "familyName", "nameI", "playerSlug", "position",
            "comment", "jerseyNum", "minutes", "effectiveFieldGoalPercentage",
            "freeThrowAttemptRate", "teamTurnoverPercentage", "offensiveReboundPercentage",
            "oppEffectiveFieldGoalPercentage", "oppFreeThrowAttemptRate",
            "oppTeamTurnoverPercentage", "oppOffensiveReboundPercentage"
        ],
        "TeamStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "minutes", "effectiveFieldGoalPercentage", "freeThrowAttemptRate",
            "teamTurnoverPercentage", "offensiveReboundPercentage",
            "oppEffectiveFieldGoalPercentage", "oppFreeThrowAttemptRate",
            "oppTeamTurnoverPercentage", "oppOffensiveReboundPercentage"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")
        self.team_stats = data_sets.get("TeamStats")

class BoxScoreHustleV2(Endpoint):
    endpoint = "boxscorehustlev2"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personId", "firstName", "familyName", "nameI", "playerSlug", "position",
            "comment", "jerseyNum", "minutes", "points", "contestedShots",
            "contestedShots2pt", "contestedShots3pt", "deflections", "chargesDrawn",
            "screenAssists", "screenAssistPoints", "looseBallsRecoveredOffensive",
            "looseBallsRecoveredDefensive", "looseBallsRecoveredTotal",
            "offensiveBoxOuts", "defensiveBoxOuts", "boxOutPlayerTeamRebounds",
            "boxOutPlayerRebounds", "boxOuts"
        ],
        "TeamStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "minutes", "points", "contestedShots", "contestedShots2pt",
            "contestedShots3pt", "deflections", "chargesDrawn", "screenAssists",
            "screenAssistPoints", "looseBallsRecoveredOffensive",
            "looseBallsRecoveredDefensive", "looseBallsRecoveredTotal",
            "offensiveBoxOuts", "defensiveBoxOuts", "boxOutPlayerTeamRebounds",
            "boxOutPlayerRebounds", "boxOuts"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")
        self.team_stats = data_sets.get("TeamStats")

class BoxScoreMatchupsV3(Endpoint):
    endpoint = "boxscorematchupsv3"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personIdOff", "firstNameOff", "familyNameOff", "nameIOff", "playerSlugOff",
            "jerseyNumOff", "personIdDef", "firstNameDef", "familyNameDef", "nameIDef",
            "playerSlugDef", "positionDef", "commentDef", "jerseyNumDef", "matchupMinutes",
            "matchupMinutesSort", "partialPossessions", "percentageDefenderTotalTime",
            "percentageOffensiveTotalTime", "percentageTotalTimeBothOn", "switchesOn",
            "playerPoints", "teamPoints", "matchupAssists", "matchupPotentialAssists",
            "matchupTurnovers", "matchupBlocks", "matchupFieldGoalsMade",
            "matchupFieldGoalsAttempted", "matchupFieldGoalsPercentage",
            "matchupThreePointersMade", "matchupThreePointersAttempted",
            "matchupThreePointersPercentage", "helpBlocks", "helpFieldGoalsMade",
            "helpFieldGoalsAttempted", "helpFieldGoalsPercentage", "matchupFreeThrowsMade",
            "matchupFreeThrowsAttempted", "shootingFouls"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")

class BoxScoreMiscV3(Endpoint):
    endpoint = "boxscoremiscv3"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personId", "firstName", "familyName", "nameI", "playerSlug", "position",
            "comment", "jerseyNum", "minutes", "pointsOffTurnovers", "pointsSecondChance",
            "pointsFastBreak", "pointsPaint", "oppPointsOffTurnovers",
            "oppPointsSecondChance", "oppPointsFastBreak", "oppPointsPaint",
            "blocks", "blocksAgainst", "foulsPersonal", "foulsDrawn"
        ],
        "TeamStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "minutes", "pointsOffTurnovers", "pointsSecondChance", "pointsFastBreak",
            "pointsPaint", "oppPointsOffTurnovers", "oppPointsSecondChance",
            "oppPointsFastBreak", "oppPointsPaint", "blocks", "blocksAgainst",
            "foulsPersonal", "foulsDrawn"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")
        self.team_stats = data_sets.get("TeamStats")

class BoxScorePlayerTrackV3(Endpoint):
    endpoint = "boxscoreplayertrackv3"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personId", "firstName", "familyName", "nameI", "playerSlug", "position",
            "comment", "jerseyNum", "minutes", "speed", "distance",
            "reboundChancesOffensive", "reboundChancesDefensive", "reboundChancesTotal",
            "touches", "secondaryAssists", "freeThrowAssists", "passes", "assists",
            "contestedFieldGoalsMade", "contestedFieldGoalsAttempted",
            "contestedFieldGoalPercentage", "uncontestedFieldGoalsMade",
            "uncontestedFieldGoalsAttempted", "uncontestedFieldGoalsPercentage",
            "fieldGoalPercentage", "defendedAtRimFieldGoalsMade",
            "defendedAtRimFieldGoalsAttempted", "defendedAtRimFieldGoalPercentage"
        ],
        "TeamStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "minutes", "distance", "reboundChancesOffensive", "reboundChancesDefensive",
            "reboundChancesTotal", "touches", "secondaryAssists", "freeThrowAssists",
            "passes", "assists", "contestedFieldGoalsMade", "contestedFieldGoalsAttempted",
            "contestedFieldGoalPercentage", "uncontestedFieldGoalsMade",
            "uncontestedFieldGoalsAttempted", "uncontestedFieldGoalsPercentage",
            "fieldGoalPercentage", "defendedAtRimFieldGoalsMade",
            "defendedAtRimFieldGoalsAttempted", "defendedAtRimFieldGoalPercentage"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")
        self.team_stats = data_sets.get("TeamStats")

class BoxScoreScoringV3(Endpoint):
    endpoint = "boxscorescoringv3"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personId", "firstName", "familyName", "nameI", "playerSlug", "position",
            "comment", "jerseyNum", "minutes", "percentageFieldGoalsAttempted2pt",
            "percentageFieldGoalsAttempted3pt", "percentagePoints2pt",
            "percentagePointsMidrange2pt", "percentagePoints3pt",
            "percentagePointsFastBreak", "percentagePointsFreeThrow",
            "percentagePointsOffTurnovers", "percentagePointsPaint",
            "percentageAssisted2pt", "percentageUnassisted2pt",
            "percentageAssisted3pt", "percentageUnassisted3pt",
            "percentageAssistedFGM", "percentageUnassistedFGM"
        ],
        "TeamStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "minutes", "percentageFieldGoalsAttempted2pt",
            "percentageFieldGoalsAttempted3pt", "percentagePoints2pt",
            "percentagePointsMidrange2pt", "percentagePoints3pt",
            "percentagePointsFastBreak", "percentagePointsFreeThrow",
            "percentagePointsOffTurnovers", "percentagePointsPaint",
            "percentageAssisted2pt", "percentageUnassisted2pt",
            "percentageAssisted3pt", "percentageUnassisted3pt",
            "percentageAssistedFGM", "percentageUnassistedFGM"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")
        self.team_stats = data_sets.get("TeamStats")

class BoxScoreUsageV3(Endpoint):
    endpoint = "boxscoreusagev3"
    expected_data = {
        "PlayerStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "personId", "firstName", "familyName", "nameI", "playerSlug", "position",
            "comment", "jerseyNum", "minutes", "usagePercentage",
            "percentageFieldGoalsMade", "percentageFieldGoalsAttempted",
            "percentageThreePointersMade", "percentageThreePointersAttempted",
            "percentageFreeThrowsMade", "percentageFreeThrowsAttempted",
            "percentageReboundsOffensive", "percentageReboundsDefensive",
            "percentageReboundsTotal", "percentageAssists", "percentageTurnovers",
            "percentageSteals", "percentageBlocks", "percentageBlocksAllowed",
            "percentagePersonalFouls", "percentagePersonalFoulsDrawn",
            "percentagePoints"
        ],
        "TeamStats": [
            "gameId", "teamId", "teamCity", "teamName", "teamTricode", "teamSlug",
            "minutes", "usagePercentage", "percentageFieldGoalsMade",
            "percentageFieldGoalsAttempted", "percentageThreePointersMade",
            "percentageThreePointersAttempted", "percentageFreeThrowsMade",
            "percentageFreeThrowsAttempted", "percentageReboundsOffensive",
            "percentageReboundsDefensive", "percentageReboundsTotal",
            "percentageAssists", "percentageTurnovers", "percentageSteals",
            "percentageBlocks", "percentageBlocksAllowed", "percentagePersonalFouls",
            "percentagePersonalFoulsDrawn", "percentagePoints"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.player_stats = data_sets.get("PlayerStats")
        self.team_stats = data_sets.get("TeamStats")

class PlayByPlayV3(Endpoint):
    endpoint = "playbyplayv3"
    expected_data = {
        "AvailableVideo": ["videoAvailable"],
        "PlayByPlay": [
            "gameId", "actionNumber", "clock", "period", "teamId", "teamTricode",
            "personId", "playerName", "playerNameI", "xLegacy", "yLegacy",
            "shotDistance", "shotResult", "isFieldGoal", "scoreHome", "scoreAway",
            "pointsTotal", "location", "description", "actionType", "subType",
            "videoAvailable", "actionId"
        ]
    }

    def __init__(self, game_id, proxy=None, headers=None, timeout=30):
        self.proxy = proxy
        self.headers = headers
        self.timeout = timeout
        self.parameters = {"GameID": game_id}
        self.get_request()

    def get_request(self):
        self.nba_response = NBAStatsHTTP().send_api_request(
            endpoint=self.endpoint,
            parameters=self.parameters,
            proxy=self.proxy,
            headers=self.headers,
            timeout=self.timeout,
        )
        self.load_response()

    def load_response(self):
        data_sets = self.nba_response.get_data_sets(self.endpoint)
        self.available_video = data_sets.get("AvailableVideo")
        self.play_by_play = data_sets.get("PlayByPlay")

def get_games_for_date(date=None):
    """Fetch and display games for a given date"""
    if date is None:
        date = input("Enter the date (YYYY-MM-DD): ")
    
    game_id = input("Enter game ID (or press Enter to fetch games): ").strip()
    
    # If game ID provided, check for existing JSON first
    if game_id:
        json_path = Path(f"games/{game_id}/{game_id}.json")
        if json_path.exists():
            print(f"\nFound existing game data at {json_path}")
            print("Skipping data collection and proceeding to video creation...")
            return create_highlight_video(game_id)
    
    # If no game_id or no existing JSON, proceed with normal flow
    try:
        print(f"Fetching games for {date}...")
        scoreboard = scoreboardv2.ScoreboardV2(game_date=date)
        
        # Get all relevant data sets
        game_headers = scoreboard.game_header.get_dict()
        line_scores = scoreboard.line_score.get_dict()
        team_leaders = scoreboard.team_leaders.get_dict()
        last_meetings = scoreboard.last_meeting.get_dict()
        series_standings = scoreboard.series_standings.get_dict()
        east_standings = scoreboard.east_conf_standings_by_day.get_dict()
        west_standings = scoreboard.west_conf_standings_by_day.get_dict()
        
        if not game_headers['data']:
            print("No games found for this date.")
            return None

        # Create a mapping of game IDs to their full data
        games_data = {}
        
        for header in game_headers['data']:
            game_id = header[2]  # GAME_ID index
            
            # Get line scores for this game
            game_scores = [score for score in line_scores['data'] if score[2] == game_id]
            home_score = next((score for score in game_scores if score[3] == header[6]), None)  # Match HOME_TEAM_ID
            away_score = next((score for score in game_scores if score[3] == header[7]), None)  # Match VISITOR_TEAM_ID
            
            # Get team leaders for this game
            game_leaders = [leader for leader in team_leaders['data'] if leader[0] == game_id]
            
            # Get last meeting data
            last_meeting = next((meeting for meeting in last_meetings['data'] if meeting[0] == game_id), None)
            
            # Get series standings
            series = next((series for series in series_standings['data'] if series[0] == game_id), None)
            
            # Store all data for this game
            games_data[game_id] = {
                'header': {
                    'game_date': header[0],
                    'game_sequence': header[1],
                    'game_id': game_id,
                    'game_status': header[4],
                    'home_team_id': header[6],
                    'visitor_team_id': header[7],
                    'season': header[8],
                    'arena': header[15]
                },
                'scores': {
                    'home': {
                        'team_id': home_score[3] if home_score else None,
                        'abbreviation': home_score[4] if home_score else None,
                        'city': home_score[5] if home_score else None,
                        'name': home_score[6] if home_score else None,
                        'record': home_score[7] if home_score else None,
                        'quarters': home_score[8:20] if home_score else None,
                        'points': home_score[22] if home_score else None,
                        'stats': {
                            'fg_pct': home_score[23] if home_score else None,
                            'ft_pct': home_score[24] if home_score else None,
                            'fg3_pct': home_score[25] if home_score else None,
                            'ast': home_score[26] if home_score else None,
                            'reb': home_score[27] if home_score else None,
                            'tov': home_score[28] if home_score else None
                        }
                    },
                    'away': {
                        'team_id': away_score[3] if away_score else None,
                        'abbreviation': away_score[4] if away_score else None,
                        'city': away_score[5] if away_score else None,
                        'name': away_score[6] if away_score else None,
                        'record': away_score[7] if away_score else None,
                        'quarters': away_score[8:20] if away_score else None,
                        'points': away_score[22] if away_score else None,
                        'stats': {
                            'fg_pct': away_score[23] if away_score else None,
                            'ft_pct': away_score[24] if away_score else None,
                            'fg3_pct': away_score[25] if away_score else None,
                            'ast': away_score[26] if away_score else None,
                            'reb': away_score[27] if away_score else None,
                            'tov': away_score[28] if away_score else None
                        }
                    }
                },
                'leaders': {
                    team_leader[3]: {  # team nickname as key
                        'points': {
                            'player_id': team_leader[5],
                            'player_name': team_leader[6],
                            'value': team_leader[7]
                        },
                        'rebounds': {
                            'player_id': team_leader[8],
                            'player_name': team_leader[9],
                            'value': team_leader[10]
                        },
                        'assists': {
                            'player_id': team_leader[11],
                            'player_name': team_leader[12],
                            'value': team_leader[13]
                        }
                    } for team_leader in game_leaders
                },
                'last_meeting': {
                    'date': last_meeting[2] if last_meeting else None,
                    'home_team': {
                        'id': last_meeting[3] if last_meeting else None,
                        'city': last_meeting[4] if last_meeting else None,
                        'name': last_meeting[5] if last_meeting else None,
                        'abbreviation': last_meeting[6] if last_meeting else None,
                        'points': last_meeting[7] if last_meeting else None
                    },
                    'away_team': {
                        'id': last_meeting[8] if last_meeting else None,
                        'city': last_meeting[9] if last_meeting else None,
                        'name': last_meeting[10] if last_meeting else None,
                        'abbreviation': last_meeting[11] if last_meeting else None,
                        'points': last_meeting[12] if last_meeting else None
                    }
                } if last_meeting else None,
                'series': {
                    'home_wins': series[4] if series else None,
                    'home_losses': series[5] if series else None,
                    'leader': series[6] if series else None
                } if series else None
            }

        # Print available games
        print(f"\nGames on {date}:")
        for idx, (game_id, game) in enumerate(games_data.items(), 1):
            home = game['scores']['home']
            away = game['scores']['away']
            print(f"{idx}. {away['abbreviation']} {away['points']} @ {home['abbreviation']} {home['points']} "
                  f"({game['header']['game_status']}) - ID: {game_id}")

        return games_data

    except Exception as e:
        print(f"Error fetching games: {e}")
        return None

def create_highlight_video(game_id):
    """Create highlight video directly from existing JSON"""
    try:
        from Tape import main as create_tape
        return create_tape(game_id)
    except Exception as e:
        print(f"Error creating highlight video: {e}")
        return False

def aggregate_player_stats(traditional_data, advanced_data, defensive_data, four_factors_data, 
                         hustle_data, matchups_data, misc_data, player_track_data, 
                         scoring_data, usage_data):
    """Aggregates all player stats into a single dictionary keyed by personId"""
    aggregated = {}
    
    # Helper function to add stats with prefix
    def add_stats(player_id, stats_dict, prefix):
        if player_id not in aggregated:
            # Initialize with player info if present
            aggregated[player_id] = {
                k: stats_dict[k] for k in [
                    'firstName', 'familyName', 'nameI', 'playerSlug', 'position',
                    'teamId', 'teamCity', 'teamName', 'teamTricode', 'teamSlug', 'jerseyNum'
                ] if k in stats_dict
            }
        
        # Add prefixed stats
        for k, v in stats_dict.items():
            if k not in ['firstName', 'familyName', 'nameI', 'playerSlug', 'position',
                        'teamId', 'teamCity', 'teamName', 'teamTricode', 'teamSlug',
                        'jerseyNum', 'gameId', 'comment', 'PLAYER_ID', 'TEAM_ID']:  # Added uppercase versions
                aggregated[player_id][f"{prefix}_{k}"] = v

    # Process each stat type
    for player in traditional_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "traditional")
    
    for player in advanced_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "advanced")
    
    for player in defensive_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "defensive")
    
    for player in four_factors_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "fourFactors")
    
    for player in hustle_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "hustle")
    
    # Special handling for matchups data - only use personIdDef
    for matchup in matchups_data.get("PlayerStats", []):
        if "personIdDef" in matchup:
            add_stats(matchup["personIdDef"], matchup, "matchup")
    
    for player in misc_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "misc")
    
    for player in player_track_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "playerTrack")
    
    for player in scoring_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "scoring")
    
    for player in usage_data.get("PlayerStats", []):
        add_stats(player.get("PLAYER_ID") or player.get("personId"), player, "usage")
    
    return aggregated

def aggregate_team_stats(traditional_data, advanced_data, defensive_data, four_factors_data,
                        hustle_data, misc_data, player_track_data, scoring_data, usage_data):
    """Aggregates all team stats into a single dictionary keyed by teamId"""
    aggregated = {}
    
    # Helper function to add stats with prefix
    def add_stats(team_id, stats_dict, prefix):
        if team_id not in aggregated:
            # Initialize with team info if present
            aggregated[team_id] = {
                k: stats_dict[k] for k in [
                    'teamCity', 'teamName', 'teamTricode', 'teamSlug',
                    'TEAM_CITY', 'TEAM_NAME', 'TEAM_ABBREVIATION'  # Added uppercase versions
                ] if k in stats_dict
            }
            
            # Convert uppercase keys to lowercase if needed
            if 'TEAM_CITY' in aggregated[team_id]:
                aggregated[team_id]['teamCity'] = aggregated[team_id].pop('TEAM_CITY')
            if 'TEAM_NAME' in aggregated[team_id]:
                aggregated[team_id]['teamName'] = aggregated[team_id].pop('TEAM_NAME')
            if 'TEAM_ABBREVIATION' in aggregated[team_id]:
                aggregated[team_id]['teamTricode'] = aggregated[team_id].pop('TEAM_ABBREVIATION')
        
        # Add prefixed stats
        for k, v in stats_dict.items():
            if k not in ['teamCity', 'teamName', 'teamTricode', 'teamSlug',
                        'teamId', 'gameId', 'TEAM_ID', 'TEAM_CITY', 'TEAM_NAME',
                        'TEAM_ABBREVIATION']:
                aggregated[team_id][f"{prefix}_{k}"] = v

    # Process each stat type
    for team in traditional_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "traditional")
    
    for team in advanced_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "advanced")
    
    for team in defensive_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "defensive")
    
    for team in four_factors_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "fourFactors")
    
    for team in hustle_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "hustle")
    
    for team in misc_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "misc")
    
    for team in player_track_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "playerTrack")
    
    for team in scoring_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "scoring")
    
    for team in usage_data.get("TeamStats", []):
        add_stats(team.get("TEAM_ID") or team.get("teamId"), team, "usage")
    
    return aggregated

def query_game_details(games_data):
    """Query and process details for a selected game"""
    try:
        game_number = int(input("\nEnter the number of the game to view details: ")) - 1
        
        # Get list of game IDs in order
        game_ids = list(games_data.keys())
        
        if 0 <= game_number < len(game_ids):
            game_id = game_ids[game_number]
            game_info = games_data[game_id]
            
            # Fetch all stats
            boxscore_traditional = boxscoretraditionalv2.BoxScoreTraditionalV2(game_id=game_id)
            boxscore_advanced = BoxScoreAdvancedV3(game_id=game_id)
            boxscore_defensive = BoxScoreDefensiveV2(game_id=game_id)
            boxscore_four_factors = BoxScoreFourFactorsV3(game_id=game_id)
            boxscore_hustle = BoxScoreHustleV2(game_id=game_id)
            boxscore_matchups = BoxScoreMatchupsV3(game_id=game_id)
            boxscore_misc = BoxScoreMiscV3(game_id=game_id)
            boxscore_player_track = BoxScorePlayerTrackV3(game_id=game_id)
            boxscore_scoring = BoxScoreScoringV3(game_id=game_id)
            boxscore_usage = BoxScoreUsageV3(game_id=game_id)
            play_by_play = playbyplayv3.PlayByPlayV3(game_id=game_id)

            # Get traditional data
            traditional_data = json.loads(boxscore_traditional.get_normalized_json())

            # Normalize stats format
            def normalize_stats(stats_data):
                if not stats_data:
                    return []
                try:
                    if hasattr(stats_data, 'get_dict'):
                        data_dict = stats_data.get_dict()
                    else:
                        data_dict = stats_data
                        
                    if 'headers' not in data_dict:
                        return []
                    return [dict(zip(data_dict['headers'], row)) for row in data_dict['data']]
                except:
                    return []

            # Process all stats
            advanced_data = {
                "PlayerStats": normalize_stats(boxscore_advanced.player_stats),
                "TeamStats": normalize_stats(boxscore_advanced.team_stats)
            }
            defensive_data = {
                "PlayerStats": normalize_stats(boxscore_defensive.player_stats),
                "TeamStats": normalize_stats(boxscore_defensive.team_stats)
            }
            four_factors_data = {
                "PlayerStats": normalize_stats(boxscore_four_factors.player_stats),
                "TeamStats": normalize_stats(boxscore_four_factors.team_stats)
            }
            hustle_data = {
                "PlayerStats": normalize_stats(boxscore_hustle.player_stats),
                "TeamStats": normalize_stats(boxscore_hustle.team_stats)
            }
            matchups_data = {
                "PlayerStats": normalize_stats(boxscore_matchups.player_stats)
            }
            misc_data = {
                "PlayerStats": normalize_stats(boxscore_misc.player_stats),
                "TeamStats": normalize_stats(boxscore_misc.team_stats)
            }
            player_track_data = {
                "PlayerStats": normalize_stats(boxscore_player_track.player_stats),
                "TeamStats": normalize_stats(boxscore_player_track.team_stats)
            }
            scoring_data = {
                "PlayerStats": normalize_stats(boxscore_scoring.player_stats),
                "TeamStats": normalize_stats(boxscore_scoring.team_stats)
            }
            usage_data = {
                "PlayerStats": normalize_stats(boxscore_usage.player_stats),
                "TeamStats": normalize_stats(boxscore_usage.team_stats)
            }
            play_by_play_data = {
                "AvailableVideo": normalize_stats(play_by_play.available_video),
                "PlayByPlay": normalize_stats(play_by_play.play_by_play)
            }

            # Add PlayByPlay data to game_info
            game_info['PlayByPlay'] = play_by_play_data
            
            # Add BoxScoreData to game_info
            game_info['BoxScoreData'] = {
                'advanced': advanced_data,
                'defensive': defensive_data,
                'fourFactors': four_factors_data,
                'hustle': hustle_data,
                'matchups': matchups_data,
                'misc': misc_data,
                'playerTrack': player_track_data,
                'scoring': scoring_data,
                'usage': usage_data
            }
            
            # Combine data
            combined_data = {
                game_id: {
                    "AggregatedTeamStats": aggregate_team_stats(
                        traditional_data, advanced_data, defensive_data, four_factors_data,
                        hustle_data, misc_data, player_track_data, scoring_data, usage_data
                    ),
                    "AggregatedPlayerStats": aggregate_player_stats(
                        traditional_data, advanced_data, defensive_data, four_factors_data,
                        hustle_data, matchups_data, misc_data, player_track_data,
                        scoring_data, usage_data
                    ),
                    "PlayByPlay": play_by_play_data,
                    "ScoreboardData": game_info,
                    "gameMetadata": {  # Add gameMetadata here
                        "date": game_info.get('header', {}).get('game_date'),
                        "arena": game_info.get('header', {}).get('arena'),
                        "season": game_info.get('header', {}).get('season'),
                        "status": game_info.get('header', {}).get('game_status'),
                        "homeTeam": game_info.get('scores', {}).get('home', {}),
                        "awayTeam": game_info.get('scores', {}).get('away', {}),
                        "teamLeaders": game_info.get('leaders', {}),
                        "lastMeeting": game_info.get('last_meeting'),
                        "seriesStandings": game_info.get('series')
                    }
                }
            }
        
            # Run analysis in order
            print("\n=== GAME SCORE ANALYSIS ===")
            import Score
            score_data = Score.main(combined_data)
            
            print("\n=== GAME STORY ANALYSIS ===")
            import Story
            story_data = Story.main(combined_data)
            
            print("\n=== VIDEO SCRIPT ===")
            import Script
            script_data = Script.main(combined_data, story_data)
            
            print("\n=== VIDEO DETAILS ===")
            import Video
            video_data = Video.main(script_data)
            
            # Save the combined data
            os.makedirs(f"games/{game_id}", exist_ok=True)
            output_path = f"games/{game_id}/{game_id}.json"
            
            print("\n=== CONCATENATING DATA ===")
            import Concatenate
            Concatenate.main(
                score_data=score_data,
                story_data=story_data,
                script_data=script_data,
                video_data=video_data,
                scoreboard_data=games_data,  # Pass the scoreboard data
                output_file=output_path
            )
            
            print("\n=== CREATING HIGHLIGHT VIDEO ===")
            create_highlight_video(game_id)

            print('\n=== PLAY BY PLAY DATA ===')
            print(json.dumps(play_by_play_data, indent=2))

            # After aggregating the data in query_game_details function
            game_info['AggregatedPlayerStats'] = aggregate_player_stats(
                traditional_data, advanced_data, defensive_data, four_factors_data,
                hustle_data, matchups_data, misc_data, player_track_data,
                scoring_data, usage_data
            )
            
            game_info['AggregatedTeamStats'] = aggregate_team_stats(
                traditional_data, advanced_data, defensive_data, four_factors_data,
                hustle_data, misc_data, player_track_data, scoring_data, usage_data
            )
            
            # Update the games_data with the new game_info
            games_data[game_id] = game_info

        else:
            print("Invalid selection.")
    except ValueError:
        print("Invalid input. Please enter a number.")
    except Exception as e:
        print(f"Error fetching game details: {e}")

def main():
    games = get_games_for_date()
    if games:
        query_game_details(games)

if __name__ == "__main__":
    main()