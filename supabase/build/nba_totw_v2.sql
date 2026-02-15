-- =====================================================
-- NBA TEAM OF THE WEEK (nba_totw) - v2
-- Single denormalized row per week.
-- 12 players: 5 starters + 7 bench, selected by
-- CUMULATIVE fantasy points under a $208M salary cap
-- (same greedy algorithm as nba_totn).
-- Displayed values are AVERAGE FP per game.
-- =====================================================

DROP TABLE IF EXISTS nba_totw CASCADE;

CREATE TABLE nba_totw (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    week_number INTEGER NOT NULL,
    season_year INTEGER NOT NULL DEFAULT 2026,

    -- Team-level totals
    salary_cap BIGINT NOT NULL DEFAULT 208000000,
    total_salary BIGINT NOT NULL DEFAULT 0,
    total_avg_fantasy_points DECIMAL NOT NULL DEFAULT 0,

    -- Starter 1 (highest cumulative FP, display avg)
    s1_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s1_avg_fantasy_points DECIMAL,
    s1_salary BIGINT,
    s1_games_played INTEGER,

    -- Starter 2
    s2_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s2_avg_fantasy_points DECIMAL,
    s2_salary BIGINT,
    s2_games_played INTEGER,

    -- Starter 3
    s3_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s3_avg_fantasy_points DECIMAL,
    s3_salary BIGINT,
    s3_games_played INTEGER,

    -- Starter 4
    s4_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s4_avg_fantasy_points DECIMAL,
    s4_salary BIGINT,
    s4_games_played INTEGER,

    -- Starter 5
    s5_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s5_avg_fantasy_points DECIMAL,
    s5_salary BIGINT,
    s5_games_played INTEGER,

    -- Bench 1
    b1_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b1_avg_fantasy_points DECIMAL,
    b1_salary BIGINT,
    b1_games_played INTEGER,

    -- Bench 2
    b2_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b2_avg_fantasy_points DECIMAL,
    b2_salary BIGINT,
    b2_games_played INTEGER,

    -- Bench 3
    b3_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b3_avg_fantasy_points DECIMAL,
    b3_salary BIGINT,
    b3_games_played INTEGER,

    -- Bench 4
    b4_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b4_avg_fantasy_points DECIMAL,
    b4_salary BIGINT,
    b4_games_played INTEGER,

    -- Bench 5
    b5_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b5_avg_fantasy_points DECIMAL,
    b5_salary BIGINT,
    b5_games_played INTEGER,

    -- Bench 6
    b6_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b6_avg_fantasy_points DECIMAL,
    b6_salary BIGINT,
    b6_games_played INTEGER,

    -- Bench 7
    b7_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b7_avg_fantasy_points DECIMAL,
    b7_salary BIGINT,
    b7_games_played INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(week_start, week_end)
);

CREATE INDEX IF NOT EXISTS idx_nba_totw_week ON nba_totw(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_nba_totw_week_number ON nba_totw(season_year, week_number);

CREATE INDEX IF NOT EXISTS idx_nba_totw_s1 ON nba_totw(s1_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_s2 ON nba_totw(s2_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_s3 ON nba_totw(s3_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_s4 ON nba_totw(s4_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_s5 ON nba_totw(s5_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_b1 ON nba_totw(b1_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_b2 ON nba_totw(b2_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_b3 ON nba_totw(b3_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_b4 ON nba_totw(b4_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_b5 ON nba_totw(b5_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_b6 ON nba_totw(b6_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totw_b7 ON nba_totw(b7_player_id);

COMMENT ON TABLE nba_totw IS 'Team of the Week – one row per week (5 starters + 7 bench). Selected by cumulative FP, displays average FP.';
COMMENT ON COLUMN nba_totw.salary_cap IS 'Salary cap used for selection ($208M)';
COMMENT ON COLUMN nba_totw.total_salary IS 'Sum of all 12 player salaries';
COMMENT ON COLUMN nba_totw.total_avg_fantasy_points IS 'Sum of all 12 player average fantasy points';

-- RLS
ALTER TABLE nba_totw ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read nba_totw" ON nba_totw;
CREATE POLICY "Allow authenticated users to read nba_totw" ON nba_totw FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow service role to manage nba_totw" ON nba_totw;
CREATE POLICY "Allow service role to manage nba_totw" ON nba_totw FOR ALL TO service_role USING (true);
