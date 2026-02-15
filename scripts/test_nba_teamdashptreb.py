#!/usr/bin/env python3
"""
Test stats.nba.com teamdashptreb API directly.
Usage:
  python scripts/test_nba_teamdashptreb.py [TEAM_ID] [SEASON]
Example:
  python scripts/test_nba_teamdashptreb.py 1610612765 2025-26
"""
import json
import sys
import urllib.parse
import urllib.request

TEAM_ID = int(sys.argv[1]) if len(sys.argv) > 1 else 1610612765
SEASON = sys.argv[2] if len(sys.argv) > 2 else "2025-26"

BASE = "https://stats.nba.com/stats/teamdashptreb"
PARAMS = {
    "TeamID": TEAM_ID,
    "Season": SEASON,
    "SeasonType": "Regular Season",
    "PerMode": "PerGame",
    "LeagueID": "00",
    "Month": "0",
    "OpponentTeamID": "0",
    "Period": "0",
    "LastNGames": "0",
    "DateFrom": "",
    "DateTo": "",
    "GameSegment": "",
    "Location": "",
    "Outcome": "",
    "SeasonSegment": "",
    "VsConference": "",
    "VsDivision": "",
}
QUERY = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in PARAMS.items())
URL = f"{BASE}?{QUERY}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://stats.nba.com/",
    "Origin": "https://stats.nba.com",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}

def main():
    req = urllib.request.Request(URL, headers=HEADERS)
    print(f"Testing NBA API: teamdashptreb\n  TeamID={TEAM_ID}  Season={SEASON}\n")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
            data = json.loads(body)
            print(f"HTTP {resp.status}")
            if "resultSets" in data:
                for rs in data["resultSets"]:
                    name = rs.get("name", "?")
                    rows = len(rs.get("rowSet", []))
                    print(f"  resultSet: {name}  rows={rows}")
            else:
                print(json.dumps(data, indent=2)[:1500])
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} {e.reason}")
        try:
            print(e.read().decode()[:500])
        except Exception:
            pass
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
