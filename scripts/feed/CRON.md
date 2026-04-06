# Feed maintenance and cron

## One-off run (manual)

```bash
cd /path/to/hoopgeek/scripts/feed
./run_feed_maintenance.sh 2026-03-03 2026-03-03
```

Without arguments it uses **yesterday** as start and end.

## Nightly cron (wake up with JSONs)

Use **run_feed_nightly.sh**: it runs from 12:01 AM until 7 AM EST, re-running the full pipeline every 15 minutes until all games for “yesterday” are complete or 7 AM is reached.

1. **Cron entry (12:01 AM EST):**
   ```cron
   1 0 * * * TZ=America/New_York /Volumes/OneTouch/hoopgeek/hoopgeek/scripts/feed/run_feed_nightly.sh
   ```
   Or, if your Mac uses full paths for cron:
   ```cron
   1 0 * * * cd /Volumes/OneTouch/hoopgeek/hoopgeek/scripts/feed && TZ=America/New_York ./run_feed_nightly.sh
   ```

2. **Logs:** `scripts/feed/logs/feed_nightly_YYYY-MM-DD.log`

## Guaranteed finish

- **run_feed_maintenance.sh** runs all 5 steps (discover → metadata → play_by_play → player_stats → shot_charts) no matter what. Each step has a **timeout**; if a step hangs, it is killed and the next step runs. So the script always completes.
- Default timeouts (seconds): discover 600, metadata 3600, play_by_play 14400, player_stats 7200, shot_charts 7200. Override with env vars: `FEED_METADATA_TIMEOUT=7200`, etc.
- **run_feed_nightly.sh** loops until either all games are complete or 7 AM EST; then it exits. So the cron job always finishes.

## If something still fails

- Check the log for `Successful:`, `Failed:`, or `timed out`. Re-run the same date(s) manually if needed:
  ```bash
  ./run_feed_maintenance.sh 2026-03-03 2026-03-03
  ```
- **NBA API timeouts:** The feed uses a **180s** request timeout by default (patch overrides nba_api’s 30s). If you still see timeouts: `NBA_API_TIMEOUT=240`. Scripts also **retry** up to 3 times with 60s delay on timeout/connection errors.
- **MP4 step (play_by_play):** Default **1 worker**, **1s** between requests → ~7.5 min for 450 actions with few timeouts. **25‑min** cap per game then save and move on. Env: `FEED_VIDEO_WORKERS=1`, `FEED_VIDEO_DELAY_SEC=1.0`, `FEED_GAME_TIME_BUDGET_SEC=1500`. More workers can overload the API; use only if it’s stable.
- To be gentler on the API (slower but fewer failures): `FEED_VIDEO_WORKERS=2 FEED_DELAY_BETWEEN_GAMES=45`.
