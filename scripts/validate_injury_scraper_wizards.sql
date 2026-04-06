-- Validate Wizards injury snapshot after running fetch-injuries for 2026-04-01.
-- 1) Expected Wizards "Out" names from the 5:00 PM PDF.
-- 2) Anthony Gill must NOT be current.

WITH expected_out(name) AS (
  VALUES
    ('Anthony Davis'),
    ('Kyshawn George'),
    ('Julian Reese'),
    ('D''Angelo Russell'),
    ('Alex Sarr'),
    ('Cam Whitmore'),
    ('Trae Young')
),
current_wizards AS (
  SELECT
    p.name,
    i.injury_status,
    i.is_current,
    i.date_updated,
    i.report_timestamp
  FROM nba_injuries i
  JOIN nba_players p ON p.nba_player_id = i.nba_player_id
  WHERE p.team_abbreviation = 'WAS'
    AND i.is_current = true
),
expected_check AS (
  SELECT
    e.name AS expected_name,
    EXISTS (
      SELECT 1
      FROM current_wizards cw
      WHERE cw.name = e.name
        AND cw.injury_status = 'Out'
    ) AS exists_as_out
  FROM expected_out e
),
anthony_gill_check AS (
  SELECT
    COALESCE(bool_or(i.is_current), false) AS anthony_gill_is_current
  FROM nba_injuries i
  JOIN nba_players p ON p.nba_player_id = i.nba_player_id
  WHERE p.name = 'Anthony Gill'
)
SELECT
  'expected_out_presence' AS check_type,
  expected_name AS subject,
  exists_as_out::text AS result
FROM expected_check
UNION ALL
SELECT
  'anthony_gill_current_flag' AS check_type,
  'Anthony Gill' AS subject,
  anthony_gill_is_current::text AS result
FROM anthony_gill_check
ORDER BY check_type, subject;
