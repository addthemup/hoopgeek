# Full Automation Chain (ET) Runbook

This runbook covers setup, verification, and recovery for the daily feed automation chain.

## 1) One-time setup

1. Deploy edge functions:
   - `automate-player-spotlights`
   - `automate-prop-results`
   - `automate-team-of-night`
   - `automate-prop-predictions`
   - `automate-injury-reports`
   - `ingest-game-highlights`
   - `import-player-props`
   - `fetch-injuries`
   - `import-boxscores`
2. Apply DB migrations (including `20260326103000_feed_full_automation_chain.sql`, `20260331100000_disable_upcoming_and_recap_automation.sql`, and game highlight ingest migrations).
3. Ensure DB settings are present:
   - `app.settings.service_role_key`
   - optional `app.settings.supabase_url` (falls back to production project URL if unset)
4. Confirm `pg_cron` and `pg_net` extensions are enabled.
5. Set edge function env guardrail: `GAME_HIGHLIGHTS_INGEST_ENABLED=true`.

## 2) Scheduled chain (ET)

Morning wave:
- 6:30 AM: `import-boxscores`
- 6:45 AM: `import-player-props`
- 6:50 AM: `fetch-injuries`
- 7:00 AM: `automate-player-spotlights`
- 7:05 AM: `automate-prop-results`
- 8:05 AM: `automate-team-of-night`
- 8:10 AM: `ingest-game-highlights`

Rolling wave:
- 11:00 AM - 11:00 PM hourly: `fetch-injuries`
- 11:02 AM - 11:02 PM hourly: `import-player-props`
- 11:10 AM - 11:10 PM hourly: `automate-prop-predictions`
- 11:15 AM - 11:15 PM hourly: `automate-injury-reports`
- 11:30 AM - 11:30 PM hourly: `ingest-game-highlights`

## 3) Verify jobs are installed

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'feed-chain-%'
ORDER BY jobname;
```

If no rows are returned, re-run migrations and check extension/permission errors.

## 4) Dry-run one slate manually (no force)

Use one target date (`YYYY-MM-DD`) and invoke in dependency order:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/import-boxscores" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual_validation"}'

curl -X POST "$SUPABASE_URL/functions/v1/import-player-props" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual_validation"}'

curl -X POST "$SUPABASE_URL/functions/v1/fetch-injuries" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -X POST "$SUPABASE_URL/functions/v1/automate-player-spotlights" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"scan":true}'

curl -X POST "$SUPABASE_URL/functions/v1/automate-prop-results" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-25"}'

curl -X POST "$SUPABASE_URL/functions/v1/automate-team-of-night" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-25"}'

curl -X POST "$SUPABASE_URL/functions/v1/automate-prop-predictions" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-25"}'

curl -X POST "$SUPABASE_URL/functions/v1/automate-injury-reports" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-03-25"}'

curl -X POST "$SUPABASE_URL/functions/v1/ingest-game-highlights" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"max_files":50,"delete_source":true}'
```

Run `ingest-game-highlights` twice to verify idempotent behavior and no duplicate clip rows.

## 5) Monitor execution health

```sql
SELECT
  j.jobname,
  d.status,
  d.start_time,
  d.end_time,
  d.return_message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname LIKE 'feed-chain-%'
ORDER BY d.start_time DESC
LIMIT 200;
```

## 6) Validate dedupe/checkpoints

Use `scripts/validate_feed_chain_idempotency.sql` and `scripts/validate_game_highlight_ingest.sql`.

Expected outcomes:
- No duplicate `source_ref` rows for post types in chain.
- No duplicate `(game_id, action_id, mp4_url)` clip rows.
- Checkpoint booleans on `feed_automation_checkpoints` move to true as data lands.
- Repeated runs should mostly return skipped/duplicate responses and not create extra posts.

## 7) Recovery playbook

- Single job failing: run the target function manually with same payload and inspect edge logs.
- Upstream data delay: keep rolling jobs enabled; they should backfill without duplicates.
- Bad run with `force:true`: re-run with default payload and validate `source_ref` uniqueness query.
- Full scheduler reset:
  1. Unschedule `feed-chain-%` jobs.
  2. Re-apply migration `20260326103000_feed_full_automation_chain.sql`.
  3. Confirm jobs in `cron.job`.

