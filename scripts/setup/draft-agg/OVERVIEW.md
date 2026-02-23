# Draft aggregation – hierarchical overview

## 1. Table: `draft_rankings`

One row per **(source, draft_year, player_slug, snapshot_week)**. Weekly snapshots from multiple ranking sources; later linked to `nba_players` when prospects are drafted.

```
draft_rankings
├── id (PK, UUID)
│
├── SOURCE & SNAPSHOT
│   ├── source (TEXT)           — 'tankathon' | 'nbadraft_net' | 'espn' | 'the_athletic'
│   ├── draft_year (SMALLINT)    — e.g. 2026
│   ├── snapshot_week (DATE)     — Monday of week scraped
│   └── scraped_at (TIMESTAMPTZ)
│
├── RANK
│   ├── rank (SMALLINT)          — position on board (1–100) or mock pick (1–60)
│   └── tier (TEXT, nullable)    — e.g. 'TIER 1' (Tankathon only)
│
├── PLAYER IDENTITY (for cross-source & nba_players matching)
│   ├── player_name_full (TEXT)   — display name as written by source
│   ├── player_name_first (TEXT)  — parsed (optional)
│   ├── player_name_last (TEXT)   — parsed (optional)
│   ├── player_slug (TEXT)        — stable per-source id (e.g. darryn-peterson)
│   └── source_player_url (TEXT)   — link to prospect on source site
│
├── BIOGRAPHICAL (for matching; align with nba_players)
│   ├── position_primary (TEXT)   — e.g. SG, PF, Wing, Guard
│   ├── position_secondary (TEXT)
│   ├── school_team (TEXT)       — college or intl team (→ nba_players.college)
│   ├── height_ft_in (TEXT)      — e.g. 6'6", 6-9
│   ├── height_inches (SMALLINT) — optional, for matching/sort
│   ├── weight_lbs (SMALLINT)
│   ├── class_year (TEXT)        — Freshman | Sophomore | Junior | Senior | International
│   └── age_years (DECIMAL 4,1)
│
├── STATS (Tankathon only; null for other sources)
│   ├── Per 36:  per36_pts, per36_reb, per36_ast, per36_blk, per36_stl
│   ├── Per game: per_game_pts, per_game_reb, per_game_ast, per_game_blk, per_game_stl
│   └── Advanced: ts_pct, usg_pct, obpm, dbpm, bpm
│
└── LINK TO NBA (set after draft + matching job)
    └── nba_player_id (UUID, nullable)  — FK → nba_players(id) ON DELETE SET NULL
```

**Unique constraint:** `(source, draft_year, player_slug, snapshot_week)`  
**Indexes:** `(source, draft_year, snapshot_week)`, `(nba_player_id)`, `(school_team)`

---

## 2. Future relationship: `draft_rankings` ↔ `nba_players`

```
┌─────────────────────────────────────────────────────────────────┐
│  nba_players (existing)                                         │
│  ├── id (UUID, PK)                                              │
│  ├── nba_player_id (int) — NBA API PERSON_ID                     │
│  ├── name, first_name, last_name                                │
│  ├── position, height, weight, birth_date, age                 │
│  ├── college                                                    │
│  ├── draft_year, draft_round, draft_number                     │
│  └── ...                                                        │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ nba_player_id (nullable FK)
                              │ Set when prospect is drafted and we match
┌─────────────────────────────────────────────────────────────────┐
│  draft_rankings                                                 │
│  One row per (source, draft_year, player_slug, snapshot_week)   │
│  ─────────────────────────────────────────────────────────────  │
│  Matching fields (used to resolve same prospect across sources  │
│  and to nba_players):                                            │
│    player_name_full  ↔ nba_players.name                         │
│    player_name_first ↔ nba_players.first_name                    │
│    player_name_last  ↔ nba_players.last_name                    │
│    school_team       ↔ nba_players.college                       │
│    height_ft_in / height_inches ↔ nba_players.height            │
│    weight_lbs        ↔ nba_players.weight                        │
│    position_primary ↔ nba_players.position                      │
│    draft_year        ↔ nba_players.draft_year                    │
└─────────────────────────────────────────────────────────────────┘
```

**Flow:**

1. **Today:** We scrape 4 sources weekly and insert/upsert into `draft_rankings`. `nba_player_id` is null (prospects not in NBA yet).
2. **After the draft:** New players are created in `nba_players` (e.g. via NBA API or roster import). We run a **matching job** that:
   - Compares `draft_rankings.player_name_full` (and name variants), `school_team`, `draft_year`, `height`, `weight`, `position` to `nba_players`.
   - Normalizes names (Jr./II/III, spelling) and handles multiple sources pointing at the same prospect.
   - Sets `draft_rankings.nba_player_id = nba_players.id` for matched rows.
3. **Result:** Historical rankings (by source and week) are tied to the canonical NBA player record; you can query “all draft rankings for this NBA player” or “where did this player rank the week before the draft?”

---

## 3. Field usage by source

| Group              | Tankathon | NBADraft.net | ESPN | The Athletic |
|--------------------|-----------|--------------|------|--------------|
| source, draft_year, snapshot_week, scraped_at | ✓ | ✓ | ✓ | ✓ |
| rank, tier         | ✓ rank, ✓ tier | ✓ rank | ✓ rank | ✓ rank |
| player_name_full, player_slug, source_player_url | ✓ | ✓ | ✓ | ✓ (slug derived) |
| position, school_team, height, weight, class_year, age_years | ✓ | ✓ | ✓ (partial) | ✓ (no weight/class) |
| per36 / per game / advanced | ✓ | — | — | — |
| nba_player_id      | Set later by matching job for all sources | | | |
