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

## Prospect headshot images (image_url)

`draft_prospects.image_url` can be set from ESPN’s headshot CDN. **Run all commands from the project root** (the `hoopgeek` directory that contains `scripts/`), e.g.:

```bash
cd /path/to/hoopgeek   # or: cd /Volumes/OneTouch/hoopgeek/hoopgeek
```

Install deps (including Selenium for search):

```bash
pip install -r scripts/setup/draft-agg/requirements.txt
```

**From draft_rankings (when ESPN scraper has run):**

```bash
python3 scripts/setup/draft-agg/backfill_prospect_images.py --dry-run
python3 scripts/setup/draft-agg/backfill_prospect_images.py
```

**Search for ESPN ID (when draft_rankings has no ESPN URLs):**  
Uses Chrome (Selenium) with **ESPN search** (`https://www.espn.com/search/_/q/{name}`); parses the result page for a mens-college-basketball player link and extracts the ID.

```bash
# Search via Chrome (default; most reliable)
python3 scripts/setup/draft-agg/backfill_prospect_images.py --search

# Dry run, first 5 only
python3 scripts/setup/draft-agg/backfill_prospect_images.py --search --dry-run --limit 5

# Use requests (may timeout): --search-engine=duckduckgo or --search-engine=google
python3 scripts/setup/draft-agg/backfill_prospect_images.py --search --search-engine=duckduckgo

# Optional: Google Images API (set GOOGLE_API_KEY + GOOGLE_CSE_ID)
python3 scripts/setup/draft-agg/backfill_prospect_images.py --search --search-engine=google_images
```

Other flags: `--no-verify` (skip HEAD check), `--overwrite` (replace existing `image_url`), `--delay N` (seconds between searches).

Image URL format:  
`https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/{id}.png`  
Prospects that still have no image after the run can be set manually in Supabase.

## nba_players matching

Table includes nullable `nba_player_id UUID REFERENCES nba_players(id)`. Once prospects are drafted and exist in `nba_players`, we can run a matching job (name + college + draft_year + height/weight) and set this FK.
