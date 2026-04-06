import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const TOTN_SLOTS = ['s1', 's2', 's3', 's4', 's5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] as const

export type ResolvedPlayer = {
  id: string
  name: string
  team_abbreviation: string | null
  nba_player_id: number | null
  slot: string
  role: 'Starter' | 'Bench'
  fantasy_points: number
  salary: number
  position?: string | null
  jersey_number?: string | null
}

export async function resolvePlayersFromRow(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  type: 'totn' | 'totw',
): Promise<ResolvedPlayer[]> {
  const ids: string[] = []
  for (const s of TOTN_SLOTS) {
    const pid = row[`${s}_player_id`] as string | undefined
    if (pid) ids.push(pid)
  }
  if (ids.length === 0) return []

  const { data: players } = await supabase
    .from('nba_players')
    .select('id, name, team_abbreviation, nba_player_id, position, jersey_number')
    .in('id', ids)

  const pMap: Record<string, Record<string, unknown>> = {}
  for (const p of players || []) pMap[p.id as string] = p as unknown as Record<string, unknown>

  const result: ResolvedPlayer[] = []
  for (const s of TOTN_SLOTS) {
    const pid = row[`${s}_player_id`] as string | undefined
    if (!pid) continue
    const info = (pMap[pid] || {
      name: 'Unknown',
      team_abbreviation: null,
      nba_player_id: null,
      position: null,
      jersey_number: null,
    }) as Record<string, unknown>
    const fpKey = type === 'totn' ? `${s}_fantasy_points` : `${s}_avg_fantasy_points`
    result.push({
      id: pid,
      name: String(info.name ?? 'Unknown'),
      team_abbreviation: (info.team_abbreviation as string | null) ?? null,
      nba_player_id: info.nba_player_id ? Number(info.nba_player_id) : null,
      slot: s,
      role: s.startsWith('s') ? 'Starter' : 'Bench',
      fantasy_points: Number(row[fpKey]) || 0,
      salary: Number(row[`${s}_salary`]) || 0,
      position: typeof info.position === 'string' ? info.position : null,
      jersey_number: info.jersey_number != null ? String(info.jersey_number) : null,
    })
  }
  return result
}
