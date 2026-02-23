-- =====================================================
-- Draft rankings aggregation (draft_rankings)
-- One row per (source, draft_year, player_slug, snapshot_week).
-- Run manually when ready; extend with more source-specific
-- columns or source_meta JSONB as you add sites.
-- =====================================================

CREATE TABLE IF NOT EXISTS draft_rankings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Source & snapshot
    source TEXT NOT NULL,
    draft_year SMALLINT NOT NULL,
    snapshot_week DATE NOT NULL,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Rank (overall on big board)
    rank SMALLINT NOT NULL,
    tier TEXT,

    -- Player identity (for matching to nba_players later)
    player_name_full TEXT NOT NULL,
    player_name_first TEXT,
    player_name_last TEXT,
    player_slug TEXT NOT NULL,
    source_player_url TEXT,

    -- Biographical (align with nba_players for matching)
    position_primary TEXT,
    position_secondary TEXT,
    school_team TEXT,
    height_ft_in TEXT,
    height_inches SMALLINT,
    weight_lbs SMALLINT,
    class_year TEXT,
    age_years DECIMAL(4, 1),

    -- Stats – Per 36
    per36_pts DECIMAL(6, 2),
    per36_reb DECIMAL(6, 2),
    per36_ast DECIMAL(6, 2),
    per36_blk DECIMAL(6, 2),
    per36_stl DECIMAL(6, 2),

    -- Stats – Per game
    per_game_pts DECIMAL(6, 2),
    per_game_reb DECIMAL(6, 2),
    per_game_ast DECIMAL(6, 2),
    per_game_blk DECIMAL(6, 2),
    per_game_stl DECIMAL(6, 2),

    -- Advanced
    ts_pct DECIMAL(5, 3),
    usg_pct DECIMAL(5, 2),
    obpm DECIMAL(5, 2),
    dbpm DECIMAL(5, 2),
    bpm DECIMAL(5, 2),

    -- Link to nba_players once drafted and matched
    nba_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,

    CONSTRAINT uq_draft_rankings_source_year_slug_week
        UNIQUE (source, draft_year, player_slug, snapshot_week)
);

CREATE INDEX IF NOT EXISTS idx_draft_rankings_source_year_week
    ON draft_rankings (source, draft_year, snapshot_week);
CREATE INDEX IF NOT EXISTS idx_draft_rankings_nba_player_id
    ON draft_rankings (nba_player_id) WHERE nba_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_draft_rankings_school_team
    ON draft_rankings (school_team);

COMMENT ON TABLE draft_rankings IS 'Weekly draft big board / rankings from multiple sources; link to nba_players when prospect is drafted.';
