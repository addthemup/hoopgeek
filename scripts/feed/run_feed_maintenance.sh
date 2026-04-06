#!/usr/bin/env bash
# Run all 5 feed scrapers for a date range in order (discover → metadata → play_by_play → player_stats → shot_charts).
# Each step runs even if the previous failed (so nightly loop can retry and make progress).
# Usage:
#   ./run_feed_maintenance.sh START_DATE END_DATE
# Examples:
#   ./run_feed_maintenance.sh 2026-03-01 2026-03-02
#   ./run_feed_maintenance.sh 2026-02-19 2026-02-28
#   ./run_feed_maintenance.sh   # uses yesterday for both start and end (daily maintenance)
#
# Run from repo root or from this directory:
#   cd hoopgeek/scripts/feed && ./run_feed_maintenance.sh 2026-03-01 2026-03-02
#
# Cron (nightly at 12:01 AM EST, loop until 7 AM): use run_feed_nightly.sh instead.
# Override timeouts (seconds): FEED_DISCOVER_TIMEOUT, FEED_METADATA_TIMEOUT, FEED_MP4_TIMEOUT, FEED_PLAYER_STATS_TIMEOUT, FEED_SHOT_CHARTS_TIMEOUT
FEED_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$FEED_DIR"

if [ -n "$1" ] && [ -n "$2" ]; then
  START="$1"
  END="$2"
else
  # Default: yesterday (macOS)
  if date -v-1d +%Y-%m-%d &>/dev/null; then
    START=$(date -v-1d +%Y-%m-%d)
    END=$START
  else
    START=$(date -d "yesterday" +%Y-%m-%d)
    END=$START
  fi
fi

# Per-step timeouts (seconds). Step is killed after this so the job always completes.
DISCOVER_TIMEOUT="${FEED_DISCOVER_TIMEOUT:-600}"
METADATA_TIMEOUT="${FEED_METADATA_TIMEOUT:-3600}"
MP4_TIMEOUT="${FEED_MP4_TIMEOUT:-14400}"
PLAYER_STATS_TIMEOUT="${FEED_PLAYER_STATS_TIMEOUT:-7200}"
SHOT_CHARTS_TIMEOUT="${FEED_SHOT_CHARTS_TIMEOUT:-7200}"

# Unbuffered output so progress appears in real time (not only when step finishes)
export PYTHONUNBUFFERED=1

run_step() {
  python3 "$FEED_DIR/run_with_timeout.py" "$1" -- python3 -u "$FEED_DIR/$2" "$START" "$END"
}

LOG="$FEED_DIR/feed_maintenance_${START}_${END}.log"
echo "=== Feed maintenance $START → $END ===" | tee "$LOG"
echo "Log: $LOG" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# Run each step; do not exit on failure. Timeouts ensure we never hang.
echo "--- 1/5 discover (timeout ${DISCOVER_TIMEOUT}s) ---" | tee -a "$LOG"
run_step "$DISCOVER_TIMEOUT" "discover_games_date_range.py" 2>&1 | tee -a "$LOG" || true
echo "" | tee -a "$LOG"

echo "--- 2/5 metadata (timeout ${METADATA_TIMEOUT}s) ---" | tee -a "$LOG"
run_step "$METADATA_TIMEOUT" "metadata_scrape_games_date_range.py" 2>&1 | tee -a "$LOG" || true
echo "" | tee -a "$LOG"

echo "--- 3/5 play_by_play (mp4) (timeout ${MP4_TIMEOUT}s) ---" | tee -a "$LOG"
run_step "$MP4_TIMEOUT" "mp4_scrape_games_date_range.py" 2>&1 | tee -a "$LOG" || true
echo "" | tee -a "$LOG"

echo "--- 4/5 player_stats (timeout ${PLAYER_STATS_TIMEOUT}s) ---" | tee -a "$LOG"
run_step "$PLAYER_STATS_TIMEOUT" "player_stats_scrape_games_date_range.py" 2>&1 | tee -a "$LOG" || true
echo "" | tee -a "$LOG"

echo "--- 5/5 shot_charts (timeout ${SHOT_CHARTS_TIMEOUT}s) ---" | tee -a "$LOG"
run_step "$SHOT_CHARTS_TIMEOUT" "shot_charts_scrape_games_date_range.py" 2>&1 | tee -a "$LOG" || true
echo "" | tee -a "$LOG"

echo "=== Done. Check log for 'Successful' / 'Skipped' / 'Failed' per script. ===" | tee -a "$LOG"
echo "Summary lines from log:"
grep -E "Successful:|Done\.|Skip|timed out" "$LOG" | tail -25 || true
