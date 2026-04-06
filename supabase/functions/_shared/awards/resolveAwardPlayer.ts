import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import type { ResolvedPlayer } from './resolveTotPlayers.ts'

/** Single player from nba_pow / nba_pom row (player_id → nba_players). */
export async function resolvePlayerFromAwardRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<ResolvedPlayer | null> {
  const playerId = row.player_id as string | undefined
  if (!playerId) return null

  const { data: p } = await supabase
    .from('nba_players')
    .select('id, name, team_abbreviation, nba_player_id, position, jersey_number')
    .eq('id', playerId)
    .maybeSingle()

  if (!p) return null
  return {
    id: p.id,
    name: p.name || 'Unknown',
    team_abbreviation: p.team_abbreviation ?? null,
    nba_player_id: p.nba_player_id != null ? Number(p.nba_player_id) : null,
    slot: 's1',
    role: 'Starter',
    fantasy_points: 0,
    salary: 0,
    position: p.position ?? null,
    jersey_number: p.jersey_number != null ? String(p.jersey_number) : null,
  }
}
