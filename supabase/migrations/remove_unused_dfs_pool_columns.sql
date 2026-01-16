-- ============================================================================
-- Remove Unused Columns from DFS Pools
-- ============================================================================
-- This migration removes is_beginner_friendly and all individual lineup
-- requirement columns since we're using the lineup_requirements JSONB column
-- instead. This cleans up the schema and removes unnecessary null columns.
-- ============================================================================

-- First, recreate views that depend on these columns
-- Drop and recreate dfs_active_pools_summary view (it uses SELECT p.*)
DROP VIEW IF EXISTS public.dfs_active_pools_summary CASCADE;

CREATE OR REPLACE VIEW public.dfs_active_pools_summary AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.pool_type,
  p.slate_name,
  p.slate_date,
  p.start_time,
  p.lock_time,
  p.end_time,
  p.entry_fee,
  p.min_entries,
  p.max_entries,
  p.max_entries_per_user,
  p.current_entries,
  p.prize_pool,
  p.prize_type,
  p.is_guaranteed,
  p.guaranteed_amount,
  p.rake_percentage,
  p.difficulty_tier,
  p.salary_cap,
  p.roster_size,
  p.starters_count,
  p.rotation_count,
  p.bench_count,
  p.starters_multiplier,
  p.rotation_multiplier,
  p.bench_multiplier,
  p.scoring_format,
  p.scoring_config,
  p.allow_late_swap,
  p.late_swap_until,
  p.status,
  p.is_public,
  p.is_featured,
  p.prize_structure_id,
  p.prize_distribution,
  p.allow_duplicates,
  p.require_unique_lineups,
  p.min_unique_players,
  p.created_by,
  p.created_by_admin_id,
  p.season_year,
  p.league_type,
  p.tags,
  p.rules_url,
  p.terms_url,
  p.metadata,
  p.created_at,
  p.updated_at,
  p.cancelled_at,
  p.finalized_at,
  p.icon_name,
  p.html_color_primary,
  p.html_color_secondary,
  p.lineup_requirements,
  COUNT(e.id) as total_entries,
  COUNT(DISTINCT e.user_id) as unique_users,
  (p.prize_pool - (p.prize_pool * p.rake_percentage / 100)) as net_prize_pool,
  (p.current_entries::DECIMAL / NULLIF(p.max_entries, 0) * 100) as fill_percentage
FROM dfs_pools p
LEFT JOIN dfs_entries e ON p.id = e.pool_id AND e.status = 'active'
WHERE p.status IN ('scheduled', 'filling', 'guaranteed', 'live')
GROUP BY p.id;

-- Now drop the columns
-- Drop is_beginner_friendly column
ALTER TABLE public.dfs_pools
  DROP COLUMN IF EXISTS is_beginner_friendly;

-- Drop all individual lineup requirement columns (we use JSONB instead)
ALTER TABLE public.dfs_pools
  DROP COLUMN IF EXISTS min_players_per_team,
  DROP COLUMN IF EXISTS max_players_per_team,
  DROP COLUMN IF EXISTS min_players_from_teams,
  DROP COLUMN IF EXISTS max_players_from_teams,
  DROP COLUMN IF EXISTS min_different_teams,
  DROP COLUMN IF EXISTS max_players_same_team,
  DROP COLUMN IF EXISTS required_player_ids,
  DROP COLUMN IF EXISTS required_player_groups,
  DROP COLUMN IF EXISTS excluded_player_ids,
  DROP COLUMN IF EXISTS max_rookies,
  DROP COLUMN IF EXISTS min_players_per_position,
  DROP COLUMN IF EXISTS max_players_per_position,
  DROP COLUMN IF EXISTS min_salary_per_position,
  DROP COLUMN IF EXISTS max_salary_per_position,
  DROP COLUMN IF EXISTS min_lineup_age,
  DROP COLUMN IF EXISTS max_lineup_age,
  DROP COLUMN IF EXISTS min_players_under_age,
  DROP COLUMN IF EXISTS max_players_over_age,
  DROP COLUMN IF EXISTS age_threshold,
  DROP COLUMN IF EXISTS min_players_per_game,
  DROP COLUMN IF EXISTS max_players_same_game,
  DROP COLUMN IF EXISTS required_game_ids,
  DROP COLUMN IF EXISTS min_players_home_teams,
  DROP COLUMN IF EXISTS max_players_home_teams,
  DROP COLUMN IF EXISTS min_players_away_teams,
  DROP COLUMN IF EXISTS max_players_away_teams,
  DROP COLUMN IF EXISTS min_players_from_winning_teams,
  DROP COLUMN IF EXISTS max_players_from_winning_teams,
  DROP COLUMN IF EXISTS min_players_from_losing_teams,
  DROP COLUMN IF EXISTS max_players_from_losing_teams,
  DROP COLUMN IF EXISTS min_players_top_teams,
  DROP COLUMN IF EXISTS max_players_top_teams,
  DROP COLUMN IF EXISTS top_teams_count,
  DROP COLUMN IF EXISTS min_players_bottom_teams,
  DROP COLUMN IF EXISTS max_players_bottom_teams,
  DROP COLUMN IF EXISTS bottom_teams_count,
  DROP COLUMN IF EXISTS min_players_east_conference,
  DROP COLUMN IF EXISTS max_players_east_conference,
  DROP COLUMN IF EXISTS min_players_west_conference,
  DROP COLUMN IF EXISTS max_players_west_conference,
  DROP COLUMN IF EXISTS max_players_same_division,
  DROP COLUMN IF EXISTS min_players_stat_threshold,
  DROP COLUMN IF EXISTS max_players_stat_threshold,
  DROP COLUMN IF EXISTS max_players_playoff_teams,
  DROP COLUMN IF EXISTS min_players_non_playoff_teams,
  DROP COLUMN IF EXISTS min_players_high_total_games,
  DROP COLUMN IF EXISTS max_players_high_total_games,
  DROP COLUMN IF EXISTS high_total_threshold,
  DROP COLUMN IF EXISTS min_players_close_games,
  DROP COLUMN IF EXISTS max_players_close_games,
  DROP COLUMN IF EXISTS close_game_spread_threshold;

