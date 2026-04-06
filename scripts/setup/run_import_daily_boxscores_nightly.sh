#!/usr/bin/env bash
# Nightly import of daily box scores. Runs at 1 AM EST.
# Uses yesterday and today (in EST) so we capture last night's games and the day before.
#
# Cron: 0 1 * * * TZ=America/New_York /Volumes/OneTouch/hoopgeek/hoopgeek/scripts/setup/run_import_daily_boxscores_nightly.sh
#
set -e
ROOT="/Volumes/OneTouch/hoopgeek"
cd "$ROOT"

# Yesterday and today in EST (so at 1 AM EST we get previous calendar day + current day)
if TZ=America/New_York date -v-1d +%Y-%m-%d &>/dev/null 2>&1; then
  YESTERDAY=$(TZ=America/New_York date -v-1d +%Y-%m-%d)
  TODAY=$(TZ=America/New_York date +%Y-%m-%d)
else
  YESTERDAY=$(TZ=America/New_York date -d "yesterday" +%Y-%m-%d)
  TODAY=$(TZ=America/New_York date +%Y-%m-%d)
fi

export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"
export VITE_SPORTS_ODDS_API_KEY="79ae5f47830d3d87e70896e36b5eefc3"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../feed/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/import_boxscores_${YESTERDAY}_${TODAY}.log"

echo "$(date -Iseconds) Import boxscores $YESTERDAY -> $TODAY" | tee -a "$LOG"
python3 hoopgeek/scripts/setup/import_daily_boxscores.py --force "$YESTERDAY" "$TODAY" 2>&1 | tee -a "$LOG"
echo "$(date -Iseconds) Done" | tee -a "$LOG"
