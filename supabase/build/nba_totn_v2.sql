-- =====================================================
-- NBA TEAM OF THE NIGHT (nba_totn) - v2
-- Single denormalized row per game date.
-- 12 players: 5 starters + 7 bench, selected by the
-- same greedy algorithm used in the /today/ module.
-- =====================================================

DROP TABLE IF EXISTS nba_totn CASCADE;

CREATE TABLE nba_totn (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_date DATE NOT NULL UNIQUE,

    -- Team-level totals
    salary_cap BIGINT NOT NULL DEFAULT 208000000,
    total_salary BIGINT NOT NULL DEFAULT 0,
    total_fantasy_points DECIMAL NOT NULL DEFAULT 0,

    -- Starter 1  (highest selection_score)
    s1_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s1_fantasy_points DECIMAL,
    s1_salary BIGINT,

    -- Starter 2
    s2_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s2_fantasy_points DECIMAL,
    s2_salary BIGINT,

    -- Starter 3
    s3_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s3_fantasy_points DECIMAL,
    s3_salary BIGINT,

    -- Starter 4
    s4_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s4_fantasy_points DECIMAL,
    s4_salary BIGINT,

    -- Starter 5
    s5_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    s5_fantasy_points DECIMAL,
    s5_salary BIGINT,

    -- Bench 1
    b1_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b1_fantasy_points DECIMAL,
    b1_salary BIGINT,

    -- Bench 2
    b2_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b2_fantasy_points DECIMAL,
    b2_salary BIGINT,

    -- Bench 3
    b3_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b3_fantasy_points DECIMAL,
    b3_salary BIGINT,

    -- Bench 4
    b4_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b4_fantasy_points DECIMAL,
    b4_salary BIGINT,

    -- Bench 5
    b5_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b5_fantasy_points DECIMAL,
    b5_salary BIGINT,

    -- Bench 6
    b6_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b6_fantasy_points DECIMAL,
    b6_salary BIGINT,

    -- Bench 7
    b7_player_id UUID REFERENCES nba_players(id) ON DELETE SET NULL,
    b7_fantasy_points DECIMAL,
    b7_salary BIGINT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nba_totn_game_date ON nba_totn(game_date);

-- Player-slot indexes for "find all nights where player X was TOTN"
CREATE INDEX IF NOT EXISTS idx_nba_totn_s1 ON nba_totn(s1_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_s2 ON nba_totn(s2_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_s3 ON nba_totn(s3_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_s4 ON nba_totn(s4_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_s5 ON nba_totn(s5_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_b1 ON nba_totn(b1_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_b2 ON nba_totn(b2_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_b3 ON nba_totn(b3_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_b4 ON nba_totn(b4_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_b5 ON nba_totn(b5_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_b6 ON nba_totn(b6_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_totn_b7 ON nba_totn(b7_player_id);

COMMENT ON TABLE nba_totn IS 'Team of the Night – one denormalized row per game date (5 starters + 7 bench)';
COMMENT ON COLUMN nba_totn.salary_cap IS 'Salary cap used for selection ($208M)';
COMMENT ON COLUMN nba_totn.total_salary IS 'Sum of all 12 player salaries';
COMMENT ON COLUMN nba_totn.total_fantasy_points IS 'Sum of all 12 player fantasy points';

-- RLS
ALTER TABLE nba_totn ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read nba_totn" ON nba_totn;
CREATE POLICY "Allow authenticated users to read nba_totn" ON nba_totn FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow service role to manage nba_totn" ON nba_totn;
CREATE POLICY "Allow service role to manage nba_totn" ON nba_totn FOR ALL TO service_role USING (true);
