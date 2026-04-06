#!/usr/bin/env bash
# Nightly feed scrape: 12 AM–7 AM EST window. Loops until all games for the
# previous day are complete (discover, metadata, play_by_play, player_stats, shot_charts)
# or until 7:00 AM EST. Uses "yesterday" in EST as the target date.
#
# run_feed_maintenance.sh uses per-step timeouts so it always finishes (no step can hang).
# Each round runs all 5 steps; then we audit. If incomplete, we sleep 15m and retry.
#
# Cron (12:01 AM EST): 1 0 * * * TZ=America/New_York /path/to/run_feed_nightly.sh
# Or if your system is already EST: 1 0 * * * /path/to/run_feed_nightly.sh
#
# If play_by_play or metadata often time out (NBA API slow), run more cautiously:
#   NBA_API_TIMEOUT=180 FEED_VIDEO_WORKERS=2 FEED_DELAY_BETWEEN_GAMES=45 ./run_feed_nightly.sh
#
set -e
FEED_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$FEED_DIR"
LOG_DIR="$FEED_DIR/logs"
mkdir -p "$LOG_DIR"

# Yesterday in EST
if TZ=America/New_York date -v-1d +%Y-%m-%d &>/dev/null; then
  START=$(TZ=America/New_York date -v-1d +%Y-%m-%d)
else
  START=$(TZ=America/New_York date -d "yesterday" +%Y-%m-%d)
fi
END="$START"
LOG="$LOG_DIR/feed_nightly_${START}.log"
LOCK="$FEED_DIR/.feed_nightly.lock"

# Prevent overlapping runs
if [ -f "$LOCK" ]; then
  echo "Lock file exists; exiting. Remove $LOCK if no other run is active." | tee -a "$LOG"
  exit 0
fi
echo "$(date -Iseconds) Starting nightly feed for $START" | tee -a "$LOG"
touch "$LOCK"
trap "rm -f '$LOCK'" EXIT

# 7 AM EST = stop time (we run until just before 7 AM)
is_after_7am_est() {
  local hour
  hour=$(TZ=America/New_York date +%H)
  [ "$hour" -ge 7 ]
}

round=0
while true; do
  round=$((round + 1))
  echo "" | tee -a "$LOG"
  echo "=== Round $round @ $(TZ=America/New_York date -Iseconds) ===" | tee -a "$LOG"
  if is_after_7am_est; then
    echo "Reached 7 AM EST; stopping." | tee -a "$LOG"
    break
  fi

  # Fetch live scoreboard: games still in progress get written to .skip_live_game_ids so scrapers skip them
  if python3 "$FEED_DIR/get_live_game_ids.py" > "$FEED_DIR/.skip_live_game_ids" 2>/dev/null; then
    n_skip=$(wc -l < "$FEED_DIR/.skip_live_game_ids" 2>/dev/null || echo 0)
    if [ -n "$n_skip" ] && [ "$n_skip" -gt 0 ]; then
      echo "Live scoreboard: $n_skip game(s) still in progress (will skip): $(cat "$FEED_DIR/.skip_live_game_ids" | tr '\n' ' ')" | tee -a "$LOG"
    else
      rm -f "$FEED_DIR/.skip_live_game_ids"
    fi
  else
    rm -f "$FEED_DIR/.skip_live_game_ids"
  fi

  # Full pipeline for the date range (tee so you see output when run manually)
  echo "--- run_feed_maintenance.sh $START $END ---" | tee -a "$LOG"
  if ! ./run_feed_maintenance.sh "$START" "$END" 2>&1 | tee -a "$LOG"; then
    echo "run_feed_maintenance exited with error (round $round)" | tee -a "$LOG"
  fi

  # Audit: how many games still incomplete?
  audit_out=$(python3 audit_feed_vs_nba_games.py "$START" "$END" --quiet 2>/dev/null || true)
  echo "$audit_out" | tee -a "$LOG"
  incomplete=99
  raw=$(echo "$audit_out" | grep -o 'INCOMPLETE=[0-9]*' | cut -d= -f2) || true
  [ -n "$raw" ] && incomplete=$raw

  if [ "${incomplete:-99}" -eq 0 ]; then
    echo "All games complete for $START; exiting." | tee -a "$LOG"
    break
  fi

  if is_after_7am_est; then
    echo "Reached 7 AM EST after round $round; stopping." | tee -a "$LOG"
    break
  fi

  echo "Incomplete: $incomplete; sleeping 15m before next round..." | tee -a "$LOG"
  sleep 900
done

echo "$(date -Iseconds) Nightly feed finished for $START" | tee -a "$LOG"
