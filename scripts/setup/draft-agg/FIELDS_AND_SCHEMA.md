# Draft aggregation – fields and schema

We scrape multiple NBA draft ranking sources weekly, store rankings per source per week, and later link prospects to `nba_players` when they are drafted.

---

## 1. Tankathon Big Board (https://tankathon.com/big_board)

**Page:** 2026 NBA Draft Big Board. Stats are “Per 36” by default, graded by position. Rankings can be viewed: Overall Rank, By School, By Position (PG/SG/SF/PF/C), By Class (Freshman–Senior, Other), and Advanced (Per 36 vs Per Game).

### Fields we need from Tankathon

| Field | Type | Notes | nba_players match |
|-------|------|--------|--------------------|
| **Identity & source** | | | |
| `source` | text | e.g. `'tankathon'` | — |
| `draft_year` | smallint | e.g. 2026 | `nba_players.draft_year` |
| `rank` | smallint | Overall rank on big board (1, 2, 3, …) | — |
| `tier` | text | e.g. `'TIER 1'`, `'THE REST'` (nullable) | — |
| **Player – matching** | | | |
| `player_name_full` | text | Display name, e.g. "Darryn Peterson" | `nba_players.name` |
| `player_name_first` | text | Parsed first name (optional) | `nba_players.first_name` |
| `player_name_last` | text | Parsed last name (optional) | `nba_players.last_name` |
| `player_slug` | text | Source-specific slug, e.g. `darryn-peterson` from URL | Stable per-source id |
| `source_player_url` | text | Full URL, e.g. https://tankathon.com/players/darryn-peterson | — |
| **Biographical** | | | |
| `position_primary` | text | Primary position, e.g. `'SG'`, `'PF'` | `nba_players.position` |
| `position_secondary` | text | Secondary if listed, e.g. `'PG'` for SG/PG (nullable) | — |
| `school_team` | text | College or team name, e.g. "Kansas", "Valencia", "Melbourne" | `nba_players.college` |
| `height_ft_in` | text | As shown, e.g. `6'6"`, `6'9.75"` | Parse to compare with `nba_players.height` |
| `height_inches` | integer | Optional: total inches for matching/sorting | — |
| `weight_lbs` | integer | e.g. 205 | `nba_players.weight` |
| `class_year` | text | Freshman | Sophomore | Junior | Senior | International | Other | — |
| `age_years` | decimal(4,1) | e.g. 19.4 | Can cross-check with `nba_players.birth_date` |
| **Stats – Per 36** | | | |
| `per36_pts` | decimal | | — |
| `per36_reb` | decimal | | — |
| `per36_ast` | decimal | | — |
| `per36_blk` | decimal | | — |
| `per36_stl` | decimal | | — |
| **Stats – Per game** | | | |
| `per_game_pts` | decimal | | — |
| `per_game_reb` | decimal | | — |
| `per_game_ast` | decimal | | — |
| `per_game_blk` | decimal | | — |
| `per_game_stl` | decimal | | — |
| **Advanced** | | | |
| `ts_pct` | decimal | True shooting % (e.g. .616) | — |
| `usg_pct` | decimal | Usage % | — |
| `obpm` | decimal | Offensive BPM | — |
| `dbpm` | decimal | Defensive BPM | — |
| `bpm` | decimal | Box Plus/Minus | — |
| **Snapshot / linkage** | | | |
| `snapshot_week` | date | Monday of week this ranking was scraped | — |
| `scraped_at` | timestamptz | When we scraped | — |
| `nba_player_id` | UUID | FK to `nba_players(id)` – set when prospect is drafted and we match | `nba_players.id` |

Tankathon also shows “By School” and “By Position” views; the same player can appear in multiple views but has one **overall rank** per snapshot. We store one row per (source, draft_year, player_slug, snapshot_week) with that overall rank and the stats from the main board.

---

## 2. NBADraft.net Mock Draft (https://www.nbadraft.net/nba-mock-drafts/?year-mock=2026)

**Page:** Mock draft by pick order (round 1 + 2). Table columns: **#** (pick), **Team**, **Player**, **H** (height), **W** (weight), **P** (position), **School**, **C** (class). We only store **rank** (pick position); team is ignored.

### Fields we store (all map to existing columns)

| nbadraft.net | Our column | Notes |
|--------------|------------|--------|
| # (pick 1–60) | `rank` | Pick position |
| Player name + link | `player_name_full`, `player_slug`, `source_player_url` | Slug from URL path, e.g. `darryn-peterson` |
| H (e.g. 6-5) | `height_ft_in` | Normalize to same format as Tankathon if desired (e.g. `6'5"`) |
| W (e.g. 195) | `weight_lbs` | |
| P (e.g. PG/SG) | `position_primary`, `position_secondary` | Parse first/second |
| School | `school_team` | College or country (e.g. Kansas, Mexico, Spain) |
| C (Fr./So./Jr./Sr./Intl.) | `class_year` | Map: Fr.→Freshman, So.→Sophomore, Jr.→Junior, Sr.→Senior, Intl.→International |
| — | `tier` | null |
| — | `age_years`, per36, per game, advanced | null (not on page) |

**Source value:** `'nbadraft_net'`.

---

## 3. ESPN Big Board (2026 NBA draft big board rankings)

**URL (dynamic; hardcode for now):**  
`https://www.espn.com/nba/story/_/id/46886245/2026-nba-draft-big-board-rankings-top-100-prospects-players`

**Page:** Article with long write-ups for top 25 and a compact list for 26–100. We **do not** scrape previous ranking, article text, or stats blurbs—only **rank** and fields needed to **match the player** across sources.

### What we scrape

- **Top 25:** Heading like `## 1. Darryn Peterson, PG/SG, Kansas` → rank, player name, position(s), school. Subline e.g. `Freshman | Height: 6-foot-6 | Age: 19.1 | Previous ranking: 1` → class_year, height_ft_in, age_years. **Ignore** “Previous ranking” and all prose/stats.
- **26–100:** Compact line e.g. `26. Amari Allen, SF/PF, Alabama | Age: 20.0` (with link) → rank, name, position, school_team, age_years. Height/class often missing; leave null.
- **Player link:** e.g. `https://www.espn.com/mens-college-basketball/player/_/id/5041955/darryn-peterson` → use last path segment as `player_slug` (`darryn-peterson`), store full URL in `source_player_url`.

### Fields we store (matching only; all map to existing columns)

| ESPN | Our column | Notes |
|------|------------|--------|
| Rank (1–100) | `rank` | |
| Player name (exact as written) | `player_name_full` | See naming conventions below |
| Player URL / path | `player_slug`, `source_player_url` | Slug = last path segment |
| Position from heading or list | `position_primary`, `position_secondary` | e.g. PG/SG |
| School/team from heading or list | `school_team` | e.g. Kansas, New Zealand Breakers |
| Height (top 25 only) | `height_ft_in` | e.g. 6-foot-6 or 6-9; normalize to one format |
| Age | `age_years` | |
| Class (top 25 only) | `class_year` | Freshman, Junior, Senior, etc. |
| — | `tier`, `weight_lbs`, per36, per game, advanced | null |

**Source value:** `'espn'`.

### Naming conventions (cross-source matching)

Sources use different name variants (e.g. “Darius Acuff Jr.” vs “Darius Acuff”, “Mikel Brown Jr.” vs “Mikel Brown”, “Patrick Ngongba II”, “Chris Cenac Jr.”). We store each source’s **exact** `player_name_full`. Matching across sites (and to `nba_players` later) should normalize: strip suffixes like Jr./II/III, handle spelling (e.g. Darryn vs Darryn), and combine with school_team, position, height, draft_year to resolve identity.

---

## 4. The Athletic (2026 NBA Draft Top 100)

**URL (dynamic; hardcode in script):**  
Syndicated table is available at NBA.com, e.g.  
`https://www.nba.com/news/the-athletic-2026-nba-draft-top-100-prospects`  
The Athletic’s own article URL on theathletic.com is dynamic (story id changes); use NBA.com for scraping or hardcode the current theathletic.com URL in the script and update when they publish a new big board.

**Page:** Article with intro text and a **table**: RANK | NAME | POSITION | SCHOOL | AGE | HT. Top 100. No player links in the table; no weight, no class. We only store **rank** and **matching fields**.

### Fields we store (all map to existing columns)

| The Athletic table | Our column | Notes |
|-------------------|------------|--------|
| RANK (1–100) | `rank` | |
| NAME | `player_name_full` | Exact as written (e.g. "Benett Stirtz" typo, "K.J. Lewis") |
| — | `player_slug` | Derive from name: lowercase, hyphenated (e.g. `aj-dybantsa`) |
| — | `source_player_url` | null (no per-player URL in table) |
| POSITION | `position_primary` | Wing, Guard, Forward, Big (or Wing/Forward → primary + secondary) |
| SCHOOL | `school_team` | e.g. Kansas, Connecticut, NZ Breakers, Melbourne United, Valencia, St. John's |
| AGE | `age_years` | |
| HT (e.g. 6-9, 6-8.5) | `height_ft_in` | Normalize to one format |
| — | `tier`, `weight_lbs`, `class_year`, per36, per game, advanced | null |

**Source value:** `'the_athletic'`.

---

## 5. Storage strategy: every week vs only on change

**Recommendation: store every week.**

- **Every week:** One row per (source, draft_year, player_slug, snapshot_week) on each run. "What was player X's rank on week Y?" is a single query. Full time series; no special logic for "first time we see this player" or missed weeks. Redundancy is small (e.g. 100 players × 4 sources × ~20 weeks ≈ 8k rows).
- **Only on change:** Insert only when `rank` differs from the previous week for that (source, draft_year, player_slug). Fewer rows and natural "movement" events, but "rank as of week Y" requires "latest row where snapshot_week ≤ Y" and is ambiguous if a week was skipped. More logic (fetch previous rank, compare, insert only if changed).

If you want both a full history and a compact "movement" view, keep **weekly snapshots** and add a view or a small `draft_rank_changes` table that records only (player_slug, source, draft_year, snapshot_week, rank, prev_rank) when rank changed—filled from the same scrape, no second write strategy.

---

## 6. Future sources (to be added)

When you add more sites, we will:

- Add new `source` values (e.g. `'espn'`, `'bleacher_report'`).
- Reuse the same **player-matching** and **biographical** columns where the source provides them; leave nullable where a source doesn’t.
- Add source-specific columns only if needed, or store extras in JSONB `source_meta` to keep the table stable.

---

## 7. nba_players matching (future-proofing)

For linking to `nba_players` after the draft:

- **Same fields:** `player_name_full` ↔ `name`, `player_name_first` / `player_name_last` ↔ `first_name` / `last_name`, `school_team` ↔ `college`, `height_*` ↔ `height`, `weight_lbs` ↔ `weight`, `position_primary` ↔ `position`, `draft_year` ↔ `draft_year`.
- **Stable id:** `(source, player_slug)` uniquely identifies a prospect per source; we can also add a canonical `draft_prospect_id` (e.g. in a `draft_prospects` table) and reference that from rankings.
- **Link:** `nba_player_id UUID REFERENCES nba_players(id)` on the rankings table; set when we run a matching job (by name + school + draft_year + height/weight, or by draft result).

---

## 8. Summary – field list (for SQL)

- **Core:** source, draft_year, rank, tier, snapshot_week, scraped_at  
- **Identity:** player_name_full, player_name_first, player_name_last, player_slug, source_player_url  
- **Bio:** position_primary, position_secondary, school_team, height_ft_in, height_inches, weight_lbs, class_year, age_years  
- **Per 36:** per36_pts, per36_reb, per36_ast, per36_blk, per36_stl  
- **Per game:** per_game_pts, per_game_reb, per_game_ast, per_game_blk, per_game_stl  
- **Advanced:** ts_pct, usg_pct, obpm, dbpm, bpm  
- **Link:** nba_player_id (nullable FK to nba_players)

Once we have all sources, we’ll add a single migration with any extra nullable columns or a small `source_meta` JSONB and you can run it manually.
