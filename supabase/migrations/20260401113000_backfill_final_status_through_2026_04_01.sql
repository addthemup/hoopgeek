-- Backfill game finalization flags through 2026-04-01 for hit-rate windows.
-- This aligns nba_games completion status and player_props_games finalized flag
-- for historical games through the requested date.

begin;

update public.nba_games
set
  game_status = 3,
  game_status_text = 'Final',
  updated_at = now()
where (game_date at time zone 'UTC')::date <= date '2026-04-01'
  and (
    game_status is distinct from 3
    or coalesce(game_status_text, '') <> 'Final'
  );

update public.player_props_games
set
  finalized = true,
  updated_at = now()
where game_date <= date '2026-04-01'
  and coalesce(finalized, false) = false;

commit;

