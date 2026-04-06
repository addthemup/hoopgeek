# automate-player-spotlights

Edge Function: downloads game JSON from Storage (**bucket `game-data`**, object **`{gameId}.json` at bucket root** by default), then creates **player_spotlight** `feed_posts` (+ sections) for every player who has **at least one MP4** in that game’s play-by-play (same rule as Post Creator’s “all spotlight players” list).

Legacy layout `feed/{gameId}.json` is supported by setting the secret **`FEED_JSON_PREFIX=feed`**.

## Env (Supabase Dashboard → Edge Functions → Secrets)

| Secret | Required | Description |
|--------|----------|---------------|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role (bypasses RLS) |
| `FEED_GAME_DATA_BUCKET` | no | Default `game-data` |
| `FEED_JSON_PREFIX` | no | Default **empty** → `0022501002.json` at bucket root. Set `feed` for `feed/0022501002.json` |

## Invoke

`GET` returns usage JSON (200). **`POST` must include either `{"game_id":"..."}` or `{"scan":true}`** (otherwise 400).

**Scan** lists `*.json` (10-digit game id) at the bucket root (or under `FEED_JSON_PREFIX`):

```bash
curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/functions/v1/automate-player-spotlights" \
  -d '{"scan":true}'
```

**Single game:**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/functions/v1/automate-player-spotlights" \
  -d '{"game_id":"0022501002"}'
```

`force: true` re-runs even if `player_spotlight_batch_done` is already true (still skips duplicate `source_ref`).

## HTTP status

- **200** — Success, or skipped checkpoint, or “no MP4 players” warning.
- **404** — JSON file missing at the expected Storage path (`detail` often `Object not found`). Fix path / upload / `FEED_JSON_PREFIX`.
- **500** — Other errors (parse failure, DB error). Read JSON `error` / `detail`.

## Idempotency

- Each post uses `source_ref = player_spotlight:{gameId}:{personId}` (matches Post Creator).
- Re-inserts with the same `source_ref` are skipped (unique constraint).
- After a successful run for a game, `feed_automation_checkpoints.player_spotlight_batch_done` is set to `true`.

## Game JSON shape (Storage)

The function reads **`playerStats` or `PlayerStats`** (array of box score rows), optional **`AggregatedPlayerStats`** (object keyed by `personId` with `traditional_*` / `advanced_*` fields), **`playByPlay.allPlays`** (for MP4 URLs), and **`gameMetadata` / `story` / `score`** as before. Rows are merged so missing fields on the array can be filled from aggregated stats.

## `feed_posts.metadata.spotlight_player_stats`

Each automated player spotlight post includes a **whitelist** snapshot for UI and downstream features:

| Field | Description |
|-------|-------------|
| `personId`, `teamTricode` | Player and team |
| `minutes` | String (e.g. `38:37`) or null |
| `pts`, `reb`, `ast`, `stl`, `blk`, `tov`, `pf` | Counting stats |
| `fgm`, `fga`, `fg3m`, `fg3a`, `ftm`, `fta` | Shooting attempts |
| `plusMinus` | Number or null |
| `efgPct`, `tsPct`, `pie` | Rates (0–1) or null |

Client helpers in `hoopgeek/src/utils/feedPostMetadata.ts`: `getSpotlightPlayerStatsFromPost` (box snapshot), `getSpotlightAggregatedStatsFromPost` (full `AggregatedPlayerStats` row for the spotlight player when present).
