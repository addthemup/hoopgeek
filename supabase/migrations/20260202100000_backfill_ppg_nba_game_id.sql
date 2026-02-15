-- =============================================================================
-- Backfill player_props_games.nba_game_id (and tricodes) by matching on
-- game_date + team names when nba_game_id / tricodes are null.
-- nba_games has short names (e.g. "Pistons", "Wizards"); ppg has full names
-- ("Detroit Pistons"). We match by: exact, or "City Name", or ppg contains nickname.
-- Use EST date for nba_games so evening games match the correct calendar day.
-- =============================================================================

-- Helper: true when ppg_team (full name) matches nba home (city + teamName / nickname)
-- (Same expression used for away by passing g.away_team_city, g.away_team_name.)
-- ppg "Detroit Pistons" matches g.home_team_name "Pistons" + home_team_city "Detroit"
-- via exact "Detroit Pistons" or via ppg LIKE '%Pistons%'.

UPDATE player_props_games ppg
SET
  nba_game_id = g.game_id,
  home_team_tricode = COALESCE(ppg.home_team_tricode, g.home_team_tricode),
  away_team_tricode = COALESCE(ppg.away_team_tricode, g.away_team_tricode),
  updated_at = now()
FROM nba_games g
WHERE ppg.nba_game_id IS NULL
  AND g.game_status = 3
  AND ppg.game_date = (g.game_date AT TIME ZONE 'America/New_York')::date
  AND (
    -- Home/away order 1: ppg home vs g home, ppg away vs g away
    (
      ( LOWER(TRIM(ppg.home_team)) = LOWER(TRIM(g.home_team_name))
        OR LOWER(TRIM(ppg.home_team)) = LOWER(TRIM(TRIM(COALESCE(g.home_team_city,'')) || ' ' || TRIM(COALESCE(g.home_team_name,''))))
        OR ( TRIM(COALESCE(g.home_team_name,'')) <> '' AND LOWER(TRIM(ppg.home_team)) LIKE '%' || LOWER(TRIM(g.home_team_name)) || '%' )
      )
      AND
      ( LOWER(TRIM(ppg.away_team)) = LOWER(TRIM(g.away_team_name))
        OR LOWER(TRIM(ppg.away_team)) = LOWER(TRIM(TRIM(COALESCE(g.away_team_city,'')) || ' ' || TRIM(COALESCE(g.away_team_name,''))))
        OR ( TRIM(COALESCE(g.away_team_name,'')) <> '' AND LOWER(TRIM(ppg.away_team)) LIKE '%' || LOWER(TRIM(g.away_team_name)) || '%' )
      )
    )
    OR
    -- Home/away order 2: ppg home vs g away, ppg away vs g home
    (
      ( LOWER(TRIM(ppg.home_team)) = LOWER(TRIM(g.away_team_name))
        OR LOWER(TRIM(ppg.home_team)) = LOWER(TRIM(TRIM(COALESCE(g.away_team_city,'')) || ' ' || TRIM(COALESCE(g.away_team_name,''))))
        OR ( TRIM(COALESCE(g.away_team_name,'')) <> '' AND LOWER(TRIM(ppg.home_team)) LIKE '%' || LOWER(TRIM(g.away_team_name)) || '%' )
      )
      AND
      ( LOWER(TRIM(ppg.away_team)) = LOWER(TRIM(g.home_team_name))
        OR LOWER(TRIM(ppg.away_team)) = LOWER(TRIM(TRIM(COALESCE(g.home_team_city,'')) || ' ' || TRIM(COALESCE(g.home_team_name,''))))
        OR ( TRIM(COALESCE(g.home_team_name,'')) <> '' AND LOWER(TRIM(ppg.away_team)) LIKE '%' || LOWER(TRIM(g.home_team_name)) || '%' )
      )
    )
  );

-- Second pass: same team-name match but allow ppg.game_date within ±1 day of nba EST date
-- (Props feed sometimes uses next/prev calendar day.) Prefer exact date, then date-1, then date+1.
UPDATE player_props_games ppg
SET
  nba_game_id = sub.game_id,
  home_team_tricode = COALESCE(ppg.home_team_tricode, sub.home_team_tricode),
  away_team_tricode = COALESCE(ppg.away_team_tricode, sub.away_team_tricode),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (ppg2.id)
    ppg2.id AS ppg_id,
    g.game_id,
    g.home_team_tricode,
    g.away_team_tricode
  FROM player_props_games ppg2
  JOIN nba_games g ON g.game_status = 3
    AND ppg2.game_date IN (
      (g.game_date AT TIME ZONE 'America/New_York')::date - 1,
      (g.game_date AT TIME ZONE 'America/New_York')::date,
      (g.game_date AT TIME ZONE 'America/New_York')::date + 1
    )
    AND (
      ( ( LOWER(TRIM(ppg2.home_team)) = LOWER(TRIM(g.home_team_name)) OR LOWER(TRIM(ppg2.home_team)) = LOWER(TRIM(TRIM(COALESCE(g.home_team_city,'')) || ' ' || TRIM(COALESCE(g.home_team_name,'')))) OR ( TRIM(COALESCE(g.home_team_name,'')) <> '' AND LOWER(TRIM(ppg2.home_team)) LIKE '%' || LOWER(TRIM(g.home_team_name)) || '%' ) )
        AND ( LOWER(TRIM(ppg2.away_team)) = LOWER(TRIM(g.away_team_name)) OR LOWER(TRIM(ppg2.away_team)) = LOWER(TRIM(TRIM(COALESCE(g.away_team_city,'')) || ' ' || TRIM(COALESCE(g.away_team_name,'')))) OR ( TRIM(COALESCE(g.away_team_name,'')) <> '' AND LOWER(TRIM(ppg2.away_team)) LIKE '%' || LOWER(TRIM(g.away_team_name)) || '%' ) )
      )
      OR
      ( ( LOWER(TRIM(ppg2.home_team)) = LOWER(TRIM(g.away_team_name)) OR LOWER(TRIM(ppg2.home_team)) = LOWER(TRIM(TRIM(COALESCE(g.away_team_city,'')) || ' ' || TRIM(COALESCE(g.away_team_name,'')))) OR ( TRIM(COALESCE(g.away_team_name,'')) <> '' AND LOWER(TRIM(ppg2.home_team)) LIKE '%' || LOWER(TRIM(g.away_team_name)) || '%' ) )
        AND ( LOWER(TRIM(ppg2.away_team)) = LOWER(TRIM(g.home_team_name)) OR LOWER(TRIM(ppg2.away_team)) = LOWER(TRIM(TRIM(COALESCE(g.home_team_city,'')) || ' ' || TRIM(COALESCE(g.home_team_name,'')))) OR ( TRIM(COALESCE(g.home_team_name,'')) <> '' AND LOWER(TRIM(ppg2.away_team)) LIKE '%' || LOWER(TRIM(g.home_team_name)) || '%' ) )
      )
    )
  WHERE ppg2.nba_game_id IS NULL
  ORDER BY ppg2.id,
    CASE WHEN ppg2.game_date = (g.game_date AT TIME ZONE 'America/New_York')::date THEN 0
         WHEN ppg2.game_date = (g.game_date AT TIME ZONE 'America/New_York')::date - 1 THEN 1
         ELSE 2 END
) sub
WHERE ppg.id = sub.ppg_id;
