import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

export async function fetchGamesForDateRange(
  supabase: SupabaseClient,
  weekStart: string,
  weekEnd: string,
  teamTricodes?: string[],
): Promise<{ game_id: string }[]> {
  let query = supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode')
    .gte('game_date', `${weekStart}T00:00:00Z`)
    .lte('game_date', `${weekEnd}T23:59:59Z`)
    .order('game_date', { ascending: true })
    .order('game_id')
  if (teamTricodes && teamTricodes.length > 0) {
    const orConditions = teamTricodes.flatMap((t) => [`home_team_tricode.eq.${t}`, `away_team_tricode.eq.${t}`]).join(',')
    query = query.or(orConditions)
  }
  const { data, error } = await query
  if (error || !data) return []
  return data as { game_id: string }[]
}
