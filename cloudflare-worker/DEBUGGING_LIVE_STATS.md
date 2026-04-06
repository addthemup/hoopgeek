# Debugging live_player_stats (no data since 2/13)

Live stats are written by the **Cloudflare Worker** `hoopgeek-live-stats` (this folder). It runs on a **cron** and can also be triggered manually. If `live_player_stats` stopped updating (e.g. last rows 2/13), work through these checks.

## 1. Confirm the worker is deployed and cron is running

- Cloudflare Dashboard → Workers & Pages → **hoopgeek-live-stats** → **Triggers** → Cron Triggers.
- You should see crons like `* 23 * * *` and `* 0-10 * * *` (runs every minute during 23:00–10:59 UTC = 6 PM ET–5:59 AM ET).
- If the worker was redeployed without triggers, re-add the cron triggers in the dashboard.

## 2. Check secrets (env)

The worker needs:

- `SUPABASE_URL` – e.g. `https://xxxx.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` – service role key (not anon)

In Cloudflare: Worker → **Settings** → **Variables and Secrets**. If these were rotated (e.g. new Supabase project or key rotation), update them and redeploy.

## 3. Manual trigger and logs

- Get the worker URL from the dashboard (e.g. `https://hoopgeek-live-stats.<account>.workers.dev`).
- Open it in a browser or: `curl "https://YOUR_WORKER_URL"`.
- You should get JSON like:  
  `{ "success": true, "message": "Updated N players from M live games", ... }`  
  or an error object.
- In the dashboard, open **Logs** (Real-time or Logpush). Look for:
  - `Cron triggered` / `Manual trigger`
  - `Found X games today` / `X games are LIVE`
  - `Supabase upsert failed` (status + body) or other errors.

## 4. NBA API (scoreboard + boxscore)

The worker uses:

- Scoreboard: `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`
- Boxscore: `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_<gameId>.json`

Run the diagnostic script (see below) to confirm these return 200 and the expected shape. If the NBA changed URLs or response format, the worker may get no live games or fail when building the payload.

## 5. Supabase table schema

The worker sends **POST** (upsert) with:

- `game_id`, `nba_player_id`, `player_name`, `team_tricode`, `team_id`, `stats` (JSONB), `raw_stats` (JSONB), `updated_at`

Requirements:

- Table `live_player_stats` must have a **unique constraint** on `(game_id, nba_player_id)` so `on_conflict=game_id,nba_player_id` works.
- Any **NOT NULL** columns must either be in the payload or have a default. If you added e.g. `player_id UUID NOT NULL` or `season_year` without default, inserts will fail.
- RLS: use the **service role** key (worker uses it); RLS is bypassed. If the worker uses anon key by mistake, RLS could block writes.

In Supabase SQL Editor:

```sql
-- Check unique constraint exists
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.live_player_stats'::regclass AND contype = 'u';

-- Check columns (required vs nullable)
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'live_player_stats'
ORDER BY ordinal_position;
```

Fix schema or worker payload so that upserts succeed (no 400/409/500 from Supabase).

## 6. Diagnostic script (local)

From the directory that contains `check-nba-api.js` (no secrets needed; only hits NBA CDN). From project root that’s usually `cd cloudflare-worker`:

```bash
cd cloudflare-worker
node check-nba-api.js
```

This checks scoreboard and boxscore URLs and response shape. If scoreboard or boxscore returns 403/404 or a different structure, the NBA side changed and the worker may need URL or parsing updates.

## 7. Quick fixes

- **Cron not firing**: Re-add cron triggers in Cloudflare and redeploy.
- **Secrets wrong**: Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` and redeploy.
- **Schema mismatch**: Add defaults or make new columns nullable; or extend the worker payload to include required fields (e.g. resolve `nba_player_id` → `player_id` and send it).
- **NBA API change**: Update scoreboard/boxscore URLs or response parsing in `update-live-stats.js` to match current API.

After changes, trigger the worker manually and watch logs and `live_player_stats` (and `live_stats_updates`) for new rows.
