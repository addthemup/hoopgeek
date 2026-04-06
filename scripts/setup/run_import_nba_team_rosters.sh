#!/bin/bash
# Weekly (or on-demand) NBA team roster import — NOT part of daily maintenance.
# Rosters change slowly; daily_maintenance skips this to keep the nightly run fast.
#
# Usage:
#   cd /path/to/hoopgeek && bash scripts/setup/run_import_nba_team_rosters.sh

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"
export VITE_SPORTS_ODDS_API_KEY="79ae5f47830d3d87e70896e36b5eefc3"
export SPORTS_ODDS_API_KEY="79ae5f47830d3d87e70896e36b5eefc3"

cd "$PROJECT_DIR"
mkdir -p "$PROJECT_DIR/logs"
LOG_FILE="$PROJECT_DIR/logs/import_nba_team_rosters.log"

echo "========================================"
echo "Import NBA Team Rosters (weekly / on-demand)"
echo "Started: $(date)"
echo "Log: $LOG_FILE"
echo "========================================"

python3 scripts/setup/import_nba_team_rosters.py 2>&1 | tee -a "$LOG_FILE"
EXIT_CODE=${PIPESTATUS[0]}

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ Completed at $(date)"
else
  echo "❌ Failed with exit code $EXIT_CODE at $(date)"
  exit "$EXIT_CODE"
fi
