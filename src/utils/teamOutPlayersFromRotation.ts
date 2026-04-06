import { supabase } from './supabase'

export interface TeamOutPlayer {
  nbaPlayerId: number
  playerName: string
  teamTricode: string
}

interface FetchTeamOutPlayersParams {
  teamTricodes: string[]
  asOfDate?: string | null
  lookbackGames?: number
}

function toDateOnly(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return raw.includes('T') ? raw.slice(0, 10) : raw
}

export async function fetchTeamOutPlayersFromRecentRotations({
  teamTricodes,
  asOfDate,
  lookbackGames = 5,
}: FetchTeamOutPlayersParams): Promise<Map<string, TeamOutPlayer[]>> {
  const uniqueTeams = Array.from(
    new Set(teamTricodes.map((t) => String(t ?? '').trim().toUpperCase()).filter(Boolean)),
  )
  if (!uniqueTeams.length) return new Map()

  let boxscoresQuery = supabase
    .from('nba_boxscores')
    .select('team_tricode, nba_player_id, player_name, game_date, min')
    .in('team_tricode', uniqueTeams)
    .not('nba_player_id', 'is', null)
    .order('game_date', { ascending: false })
    .limit(Math.max(3000, uniqueTeams.length * 900))

  const asOfDateOnly = toDateOnly(asOfDate)
  if (asOfDateOnly) {
    boxscoresQuery = boxscoresQuery.lt('game_date', `${asOfDateOnly}T23:59:59Z`)
  }

  const { data: boxscoreRows, error: boxscoreError } = await boxscoresQuery
  if (boxscoreError || !boxscoreRows?.length) return new Map()

  const teamDates = new Map<string, Set<string>>()
  const teamRotationPlayerIds = new Map<string, Set<number>>()
  const playerNameById = new Map<number, string>()

  for (const row of boxscoreRows as any[]) {
    const team = String(row.team_tricode ?? '').trim().toUpperCase()
    const nbaPlayerId = Number(row.nba_player_id)
    if (!team || !Number.isFinite(nbaPlayerId)) continue

    const minuteValue = Number.parseFloat(String(row.min ?? '0'))
    if (!Number.isFinite(minuteValue) || minuteValue <= 0) continue

    const gameDate = toDateOnly(String(row.game_date ?? ''))
    if (!gameDate) continue

    const existingDates = teamDates.get(team) ?? new Set<string>()
    if (!existingDates.has(gameDate) && existingDates.size >= lookbackGames) continue

    existingDates.add(gameDate)
    teamDates.set(team, existingDates)

    const ids = teamRotationPlayerIds.get(team) ?? new Set<number>()
    ids.add(nbaPlayerId)
    teamRotationPlayerIds.set(team, ids)

    if (!playerNameById.has(nbaPlayerId)) {
      playerNameById.set(nbaPlayerId, String(row.player_name ?? '').trim())
    }
  }

  const allRotationPlayerIds = Array.from(
    new Set(Array.from(teamRotationPlayerIds.values()).flatMap((ids) => Array.from(ids))),
  )
  if (!allRotationPlayerIds.length) return new Map()

  const { data: injuryRows, error: injuryError } = await supabase
    .from('nba_injuries')
    .select('nba_player_id, injury_status, date_updated')
    .in('nba_player_id', allRotationPlayerIds)
    .eq('is_current', true)
    .ilike('injury_status', '%out%')
    .order('date_updated', { ascending: false })

  if (injuryError || !injuryRows?.length) return new Map()

  const outPlayerIds = new Set<number>()
  for (const injury of injuryRows as any[]) {
    const nbaPlayerId = Number(injury.nba_player_id)
    if (!Number.isFinite(nbaPlayerId) || outPlayerIds.has(nbaPlayerId)) continue
    outPlayerIds.add(nbaPlayerId)
  }

  const result = new Map<string, TeamOutPlayer[]>()
  for (const [team, ids] of teamRotationPlayerIds.entries()) {
    const players = Array.from(ids)
      .filter((id) => outPlayerIds.has(id))
      .map((id) => ({
        nbaPlayerId: id,
        playerName: playerNameById.get(id) || 'Unknown',
        teamTricode: team,
      }))
      .sort((a, b) => a.playerName.localeCompare(b.playerName))
    result.set(team, players)
  }

  return result
}

