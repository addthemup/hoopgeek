#!/usr/bin/env python3
"""
Direct requests to stats.nba.com with browser headers (same as standings/leaders).
Use when nba_api times out or is throttled. Import this after nba_timeout_patch if used.
"""

import os
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple

try:
    import requests
except ImportError:
    requests = None

import pandas as pd

# Same headers that work for standings/leaders/boxscores
NBA_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
}

FEED_DIRECT_TIMEOUT = int(os.environ.get("FEED_DIRECT_TIMEOUT", "90"))


def _date_yyyy_mm_dd_to_mm_dd_yyyy(date_str: str) -> str:
    """Convert YYYY-MM-DD to MM/DD/YYYY for NBA API."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%m/%d/%Y")
    except ValueError:
        return date_str


def fetch_leaguegamefinder_direct(
    game_date: str, season: Optional[str] = None
) -> Optional[pd.DataFrame]:
    """
    Fetch games for a date via direct request to leaguegamefinder.
    game_date: YYYY-MM-DD.
    season: NBA season label e.g. "2025-26"; defaults to 2025-26 if omitted.
    Returns DataFrame with LeagueGameFinder columns (GAME_ID, GAME_DATE, MATCHUP, etc.) or None.
    """
    if not requests:
        return None
    url = "https://stats.nba.com/stats/leaguegamefinder"
    date_param = _date_yyyy_mm_dd_to_mm_dd_yyyy(game_date)
    season_str = season or "2025-26"
    params = {
        "PlayerOrTeam": "T",
        "Season": season_str,
        "SeasonType": "Regular Season",
        "DateFrom": date_param,
        "DateTo": date_param,
    }
    try:
        r = requests.get(url, headers=NBA_HEADERS, params=params, timeout=FEED_DIRECT_TIMEOUT)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return None
    # New API may use resultSets or different structure
    result_sets = data.get("resultSets") or data.get("resultSet")
    if not result_sets:
        return None
    if isinstance(result_sets, dict):
        result_sets = [result_sets]
    for rs in result_sets:
        if not isinstance(rs, dict) or "headers" not in rs or "rowSet" not in rs:
            continue
        headers = rs.get("headers", [])
        row_set = rs.get("rowSet", [])
        if not headers or not row_set:
            continue
        df = pd.DataFrame(row_set, columns=headers)
        if not df.empty and "GAME_ID" in df.columns:
            return df
    return None


def fetch_boxscore_traditional_direct(game_id: str) -> Optional[Dict[str, List[Dict]]]:
    """
    Fetch box score traditional via direct request (boxScoreTraditional format).
    Returns dict with PlayerStats, TeamStats, TeamStarterBenchStats (list of dicts each)
    matching the shape expected by scrape_games_date_range / metadata / player_stats.
    """
    if not requests:
        return None
    url = "https://stats.nba.com/stats/boxscoretraditionalv3"
    params = {
        "GameID": game_id,
        "EndPeriod": "0",
        "EndRange": "0",
        "RangeType": "0",
        "StartPeriod": "0",
        "StartRange": "0",
    }
    try:
        r = requests.get(url, headers=NBA_HEADERS, params=params, timeout=FEED_DIRECT_TIMEOUT)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return None
    box = data.get("boxScoreTraditional")
    if not box or not isinstance(box, dict):
        return None
    player_stats_list: List[Dict[str, Any]] = []
    team_stats_list: List[Dict[str, Any]] = []
    for team_key in ("awayTeam", "homeTeam"):
        team = box.get(team_key) or {}
        if not isinstance(team, dict):
            continue
        team_id = team.get("teamId")
        team_city = team.get("teamCity") or ""
        team_name = team.get("teamName") or ""
        team_tricode = team.get("teamTricode") or ""
        team_points = 0
        for p in team.get("players") or []:
            if not isinstance(p, dict):
                continue
            stats = p.get("statistics") or {}
            row = {
                "personId": p.get("personId"),
                "nameI": p.get("nameI") or "",
                "teamId": team_id,
                "teamTricode": team_tricode,
                "teamName": f"{team_city} {team_name}".strip(),
                "teamCity": team_city,
                "position": p.get("position"),
                "jerseyNum": p.get("jerseyNum"),
                "minutes": stats.get("minutes"),
                "fieldGoalsMade": stats.get("fieldGoalsMade"),
                "fieldGoalsAttempted": stats.get("fieldGoalsAttempted"),
                "fieldGoalsPercentage": stats.get("fieldGoalsPercentage"),
                "threePointersMade": stats.get("threePointersMade"),
                "threePointersAttempted": stats.get("threePointersAttempted"),
                "threePointersPercentage": stats.get("threePointersPercentage"),
                "freeThrowsMade": stats.get("freeThrowsMade"),
                "freeThrowsAttempted": stats.get("freeThrowsAttempted"),
                "freeThrowsPercentage": stats.get("freeThrowsPercentage"),
                "reboundsOffensive": stats.get("reboundsOffensive"),
                "reboundsDefensive": stats.get("reboundsDefensive"),
                "reboundsTotal": stats.get("reboundsTotal"),
                "assists": stats.get("assists"),
                "steals": stats.get("steals"),
                "blocks": stats.get("blocks"),
                "turnovers": stats.get("turnovers"),
                "foulsPersonal": stats.get("foulsPersonal"),
                "points": stats.get("points"),
                "plusMinusPoints": stats.get("plusMinusPoints"),
            }
            player_stats_list.append(row)
            team_points += int(stats.get("points") or 0)
        team_stats_list.append({"teamId": team_id, "points": team_points})
    return {
        "PlayerStats": player_stats_list,
        "TeamStats": team_stats_list,
        "TeamStarterBenchStats": [],
    }


def fetch_playbyplay_v3_direct(
    game_id: str,
) -> Optional[Tuple[List[int], Dict[int, Dict[str, Any]]]]:
    """
    Full play-by-play via direct GET (browser headers). Same row shape as PlayByPlayV3
    DataFrame rows — works when nba_api/stats.nba.com read-timeout from default client.
    Returns (sorted action_numbers, pbp_data[action_num -> dict]) or None.
    """
    if not requests:
        return None
    url = "https://stats.nba.com/stats/playbyplayv3"
    params = {"GameID": str(game_id), "EndPeriod": "10", "StartPeriod": "0"}
    try:
        r = requests.get(url, headers=NBA_HEADERS, params=params, timeout=FEED_DIRECT_TIMEOUT)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return None
    game = data.get("game") or {}
    actions = game.get("actions")
    if not actions or not isinstance(actions, list):
        return None
    action_numbers: List[int] = []
    pbp_data: Dict[int, Dict[str, Any]] = {}
    for row in actions:
        if not isinstance(row, dict):
            continue
        an = row.get("actionNumber")
        if an is None:
            continue
        try:
            ai = int(an)
        except (TypeError, ValueError):
            continue
        if ai <= 0:
            continue
        if ai not in pbp_data:
            action_numbers.append(ai)
        pbp_data[ai] = dict(row)
    action_numbers.sort()
    if not action_numbers:
        return None
    return (action_numbers, pbp_data)
