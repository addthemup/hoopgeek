import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

export type BoxScoreRow = Record<string, unknown>

export async function fetchPlayerGameLog(
  supabase: SupabaseClient,
  nbaPlayerId: number,
  startDate: string,
  endDate: string,
): Promise<BoxScoreRow[]> {
  const { data, error } = await supabase
    .from('nba_boxscores')
    .select(
      'game_id, game_date, matchup, nba_player_id, player_name, team_abbreviation, min, pts, reb, ast, stl, blk, tov, fgm, fga, fg_pct, fg3m, fg3a, fg3_pct, ftm, fta, ft_pct, plus_minus_points, is_starter, is_home_game',
    )
    .eq('nba_player_id', nbaPlayerId)
    .gte('game_date', startDate)
    .lte('game_date', endDate)
    .order('game_date', { ascending: true })
  if (error) return []
  return (data || []) as BoxScoreRow[]
}
