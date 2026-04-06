#!/usr/bin/env bash
# Run feed pipeline with Supabase and API env. Lax mode: no time caps, 5 min retry waits.
# Tracks success rate per step so you know if you need to re-run any component.
#
# Usage: ./run_feed_with_env.sh
#   Or:  ./run_feed_with_env.sh 2026-03-10 2026-03-01 2026-03-10
#        (discover_date, range_start, range_end)

FEED_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$FEED_DIR/../.." && pwd)"
RUN_ID="$(date +%Y%m%d_%H%M%S)"
LOG_DIR="$FEED_DIR/logs/run_$RUN_ID"
mkdir -p "$LOG_DIR"

export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"
export VITE_SPORTS_ODDS_API_KEY="79ae5f47830d3d87e70896e36b5eefc3"
export FEED_GAME_TIME_BUDGET_SEC=0
export FEED_DELAY_BETWEEN_GAMES=60
export NBA_API_TIMEOUT=300

DISCOVER_DATE="${1:-2026-03-10}"
RANGE_START="${2:-2026-03-01}"
RANGE_END="${3:-2026-03-10}"

echo "Logs: $LOG_DIR"
echo ""

run_step() {
  local name="$1"
  shift
  local log="$LOG_DIR/${name}.log"
  echo "=== $name ==="
  "$@" 2>&1 | tee "$log"
  local r=${PIPESTATUS[0]}
  if [[ $r -ne 0 ]]; then echo "[$name exited with error ($r)]"; fi
  echo ""
  return 0
}

cd "$FEED_DIR"

run_step "1_discover" python3 discover_games_date_range.py "$DISCOVER_DATE" "$DISCOVER_DATE"
run_step "2_mp4" python3 mp4_scrape_games_date_range.py "$DISCOVER_DATE" "$DISCOVER_DATE"
run_step "3_metadata" python3 metadata_scrape_games_date_range.py "$RANGE_START" "$RANGE_END"
run_step "4_player_stats" python3 player_stats_scrape_games_date_range.py "$RANGE_START" "$RANGE_END"
run_step "5_shot_charts" python3 shot_charts_scrape_games_date_range.py "$RANGE_START" "$RANGE_END"

echo "=== 6_import_daily_boxscores $RANGE_START → $RANGE_END ==="
import_log="$LOG_DIR/6_import_daily_boxscores.log"
( cd "$PROJECT_ROOT" && python3 scripts/setup/import_daily_boxscores.py --force "$RANGE_START" "$RANGE_END" 2>&1 | tee "$import_log" ) || echo "[import_daily_boxscores exited with error]"
echo ""

echo ""
echo "============================================================"
echo "SUCCESS RATE SUMMARY (re-run any step with failures if needed)"
echo "============================================================"
for f in "$LOG_DIR"/1_discover.log "$LOG_DIR"/2_mp4.log "$LOG_DIR"/3_metadata.log "$LOG_DIR"/4_player_stats.log "$LOG_DIR"/5_shot_charts.log "$LOG_DIR"/6_import_daily_boxscores.log; do
  if [[ -f "$f" ]]; then
    line=$(grep "FEED_STEP_SUMMARY:" "$f" 2>/dev/null || tail -1 "$f")
    echo "  $(basename "$f" .log): $line"
  fi
done
echo "============================================================"
echo "Done. Full logs: $LOG_DIR"
