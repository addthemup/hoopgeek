#!/usr/bin/env bash
# Test stats.nba.com teamdashptreb API directly (same URL/headers as the edge proxy).
# Usage: ./scripts/test_nba_teamdashptreb.sh [TEAM_ID] [SEASON]
# Example: ./scripts/test_nba_teamdashptreb.sh 1610612765 2025-26

TEAM_ID="${1:-1610612765}"
SEASON="${2:-2025-26}"
URL="https://stats.nba.com/stats/teamdashptreb?TeamID=${TEAM_ID}&Season=${SEASON}&SeasonType=Regular%20Season&PerMode=PerGame&LeagueID=00&Month=0&OpponentTeamID=0&Period=0&LastNGames=0&DateFrom=&DateTo=&GameSegment=&Location=&Outcome=&SeasonSegment=&VsConference=&VsDivision="

echo "Testing NBA API: teamdashptreb"
echo "  TeamID=$TEAM_ID  Season=$SEASON"
echo ""

curl -s -w "\n\nHTTP status: %{http_code}\nTime: %{time_total}s\n" \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: en-US,en;q=0.9' \
  -H 'Referer: https://stats.nba.com/' \
  -H 'Origin: https://stats.nba.com' \
  -H 'x-nba-stats-origin: stats' \
  -H 'x-nba-stats-token: true' \
  "$URL" | head -c 2000

echo ""
echo "(Output truncated to 2000 chars; full response is in curl stdout.)"
