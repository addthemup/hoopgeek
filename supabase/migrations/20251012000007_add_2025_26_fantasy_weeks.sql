-- ============================================================================
-- Add 2025-26 NBA Fantasy Season Weeks (Including Preseason Sandbox)
-- ============================================================================
-- This migration adds the complete 2025-26 fantasy season schedule
-- Week 0 is the "Preseason" - a sandbox where lineups don't lock
-- Users can experiment with features before the real season starts

-- Insert fantasy season weeks for 2025-26 season
INSERT INTO fantasy_season_weeks (season_year, week_number, week_name, start_date, end_date, is_regular_season, is_playoff_week, playoff_round, is_active)
VALUES
  -- Week 0: PRESEASON SANDBOX (Lineups don't lock, results don't count)
  (2025, 0, 'Preseason', '2024-10-02', '2024-10-20', false, false, NULL, true),
  
  -- Regular Season Weeks
  (2025, 1, 'Week 1', '2024-10-21', '2024-10-27', true, false, NULL, true),
  (2025, 2, 'Week 2', '2024-10-28', '2024-11-03', true, false, NULL, true),
  (2025, 3, 'Week 3', '2024-11-04', '2024-11-10', true, false, NULL, true),
  (2025, 4, 'Week 4', '2024-11-11', '2024-11-17', true, false, NULL, true),
  (2025, 5, 'Week 5', '2024-11-18', '2024-11-24', true, false, NULL, true),
  (2025, 6, 'Week 6', '2024-11-25', '2024-12-01', true, false, NULL, true),
  (2025, 7, 'Week 7', '2024-12-02', '2024-12-08', true, false, NULL, true),
  (2025, 8, 'Week 8', '2024-12-09', '2024-12-15', true, false, NULL, true),
  (2025, 9, 'Week 9', '2024-12-16', '2024-12-22', true, false, NULL, true),
  (2025, 10, 'Week 10', '2024-12-23', '2024-12-29', true, false, NULL, true),
  (2025, 11, 'Week 11', '2024-12-30', '2025-01-05', true, false, NULL, true),
  (2025, 12, 'Week 12', '2025-01-06', '2025-01-12', true, false, NULL, true),
  (2025, 13, 'Week 13', '2025-01-13', '2025-01-19', true, false, NULL, true),
  (2025, 14, 'Week 14', '2025-01-20', '2025-01-26', true, false, NULL, true),
  (2025, 15, 'Week 15', '2025-01-27', '2025-02-02', true, false, NULL, true),
  (2025, 16, 'Week 16', '2025-02-03', '2025-02-09', true, false, NULL, true),
  (2025, 17, 'Week 17', '2025-02-10', '2025-02-16', true, false, NULL, true),
  (2025, 18, 'Week 18', '2025-02-17', '2025-02-23', true, false, NULL, true),
  (2025, 19, 'Week 19', '2025-02-24', '2025-03-02', true, false, NULL, true),
  (2025, 20, 'Week 20', '2025-03-03', '2025-03-09', true, false, NULL, true),
  (2025, 21, 'Week 21', '2025-03-10', '2025-03-16', true, false, NULL, true),
  (2025, 22, 'Week 22', '2025-03-17', '2025-03-23', true, false, NULL, true),
  (2025, 23, 'Week 23', '2025-03-24', '2025-03-30', true, false, NULL, true),
  (2025, 24, 'Week 24', '2025-03-31', '2025-04-06', true, false, NULL, true),
  (2025, 25, 'Week 25', '2025-04-07', '2025-04-13', true, false, NULL, true)
ON CONFLICT (season_year, week_number) DO UPDATE SET
  week_name = EXCLUDED.week_name,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_regular_season = EXCLUDED.is_regular_season,
  is_playoff_week = EXCLUDED.is_playoff_week,
  playoff_round = EXCLUDED.playoff_round,
  is_active = EXCLUDED.is_active;

-- Add helper function to check if current date is in preseason
CREATE OR REPLACE FUNCTION is_preseason(check_date date DEFAULT CURRENT_DATE)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM fantasy_season_weeks
    WHERE week_number = 0
      AND check_date BETWEEN start_date AND end_date
      AND is_active = true
  );
$$;

-- Add helper function to get current fantasy week (including preseason)
CREATE OR REPLACE FUNCTION get_current_fantasy_week(check_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  season_year integer,
  week_number integer,
  week_name text,
  start_date date,
  end_date date,
  is_regular_season boolean,
  is_playoff_week boolean,
  is_preseason boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    season_year,
    week_number,
    week_name,
    start_date,
    end_date,
    is_regular_season,
    is_playoff_week,
    (week_number = 0) as is_preseason
  FROM fantasy_season_weeks
  WHERE check_date BETWEEN start_date AND end_date
    AND is_active = true
  ORDER BY season_year DESC, week_number DESC
  LIMIT 1;
$$;

-- Comment on preseason week
COMMENT ON COLUMN fantasy_season_weeks.week_number IS 'Week number within the season. 0 = Preseason (sandbox), 1-25 = Regular season weeks';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fantasy_season_weeks_dates ON fantasy_season_weeks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fantasy_season_weeks_week_number ON fantasy_season_weeks(season_year, week_number);

