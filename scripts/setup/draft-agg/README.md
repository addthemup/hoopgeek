# draft-agg – NBA draft rankings aggregation

Scrapes multiple NBA draft ranking sources (e.g. Tankathon Big Board) weekly and stores rankings so we can track movement until the draft and later link prospects to `nba_players` when drafted.

## Current status

- **Four sources** – Tankathon, NBADraft.net, ESPN, The Athletic. All documented in [FIELDS_AND_SCHEMA.md](./FIELDS_AND_SCHEMA.md).
- **Dynamic URLs:** ESPN and The Athletic use story IDs that change; we hardcode the current URL in the script and update when they publish a new big board. Tankathon and NBADraft.net have stable paths.
- **Storage:** We store one row per (source, draft_year, player_slug, snapshot_week) every week; see “Storage strategy” in FIELDS_AND_SCHEMA.md for the rationale vs store-only-on-change.
- **SQL** – `supabase/migrations/20260217000000_draft_rankings.sql`; run manually when ready.

## Scraper

`scrape_draft_rankings.py` scrapes all four sources and upserts into `draft_rankings` + creates/links `draft_prospects`.

```bash
# Dry run (parse only, no DB writes)
python3 scripts/setup/draft-agg/scrape_draft_rankings.py --dry-run

# One source with full debug
python3 scripts/setup/draft-agg/scrape_draft_rankings.py --source nbadraft_net --dry-run -v
python3 scripts/setup/draft-agg/scrape_draft_rankings.py --source nbadraft_net -v

# All sources (after migration + env)
python3 scripts/setup/draft-agg/scrape_draft_rankings.py
python3 scripts/setup/draft-agg/scrape_draft_rankings.py -v
```

- `--source`: `tankathon` | `nbadraft_net` | `espn` | `the_athletic` | `all` (default `all`).
- `-v` / `--verbose`: log every prospect get/create and first few upserts.
- Snapshot week = Monday of current week; draft_year = 2026.

After data looks good, add the script to `scripts/setup/run_daily_maintenance.sh` (e.g. step 16).

## nba_players matching

Table includes nullable `nba_player_id UUID REFERENCES nba_players(id)`. Once prospects are drafted and exist in `nba_players`, we can run a matching job (name + college + draft_year + height/weight) and set this FK.
