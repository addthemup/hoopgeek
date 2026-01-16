# Archived GitHub Actions Workflows

These workflows are **deprecated** and no longer used. The functionality has been moved to Edge Functions for consistency.

## Archived Workflows

- `import-boxscores.yml` - Replaced by `supabase/functions/import-boxscores/index.ts`
- `import-team-rosters.yml` - Replaced by `supabase/functions/import-team-rosters/index.ts`

## Why Archived?

All cron jobs now use a unified architecture:
- **Database Cron** → **Edge Function** (TypeScript/Deno)

This is more consistent, easier to maintain, and doesn't require GitHub secrets.

## Original Python Scripts

The original Python scripts are still available for reference:
- `scripts/setup/import_daily_boxscores.py`
- `scripts/setup/import_nba_team_rosters.py`

These can be used for one-time imports or local testing, but are no longer scheduled via cron.

