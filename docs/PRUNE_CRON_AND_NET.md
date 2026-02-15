# Pruning cron.job_run_details and net._http_response

Your Supabase DB size is dominated by:

- **cron.job_run_details** — pg_cron logs every run (standings, leaders, boxscores, player props, injuries, daily maintenance, etc.). This table is **not** auto-pruned.
- **net._http_response** — pg_net stores HTTP responses from `net.http_post()` (used when cron calls your Edge Functions). This table is **not** auto-pruned.

## 1. See what you have

In **Supabase → SQL Editor**, run the **Part 1** blocks from:

**`scripts/inspect_and_cleanup_cron_net.sql`**

You’ll get:

- All scheduled cron jobs (`cron.job`)
- Row counts and date range for `cron.job_run_details`
- Rows per job (which jobs log the most)
- Row count and date range for `net._http_response`
- Last 20 cron runs

## 2. One-time cleanup (free space now)

In the same file, use **Part 2**:

1. Run the optional “dry run” query to see how many rows would be deleted.
2. Uncomment and run:
   - **2a** — deletes `cron.job_run_details` older than 7 days
   - **2b** — deletes `net._http_response` older than 3 days

Adjust the intervals in the `WHERE` clauses if you want different retention (e.g. 14 days for cron, 1 day for net).

**Note:** If `net._http_response` doesn’t exist, your project may use a different pg_net table/view name; check the schema and update the query.

## 3. Ongoing prune (daily job)

Apply the migration that adds a daily prune job:

- **`supabase/migrations/20260130000000_prune_cron_and_net.sql`**

It:

- Creates `prune_cron_and_net(cron_retention_days, net_retention_days)` (defaults: 7 and 3).
- Schedules a cron job **`prune-cron-and-net`** at 4:00 UTC daily to run that function.

After deploying, old rows are removed every day so `cron.job_run_details` and `net._http_response` don’t grow without bound.

## Summary

| Step | What to run | Where |
|------|-------------|--------|
| Inspect | Part 1 of `scripts/inspect_and_cleanup_cron_net.sql` | SQL Editor |
| One-time cleanup | Part 2 (uncomment 2a + 2b, adjust intervals) | SQL Editor |
| Ongoing prune | Migration `20260130000000_prune_cron_and_net.sql` | Deploy / migrate |
