/**
 * Minimal GameData shape for getPlayerHighlightClips (from game JSON in Storage).
 */
export type PlayByPlayAction = {
  personId: number | null
  playerName: string | null
  teamTricode: string | null
  actionType: string
  subType: string | null
  description: string
  mp4: string | null
  period: number
  clock: string
  shotResult: string | null
  isFieldGoal: number
  pointsTotal: number
}

export type GameData = {
  gameId: string
  gameDate: string | null
  teamTricodes: string[]
  playerStats: Array<Record<string, unknown>>
  playByPlay: PlayByPlayAction[]
}

export function rawJsonToGameData(raw: Record<string, unknown>): GameData | null {
  const gameId = String(raw.gameId ?? '')
  if (!/^\d{10}$/.test(gameId)) return null
  const meta = (raw.gameMetadata ?? {}) as Record<string, unknown>
  const home = (meta.homeTeam ?? {}) as Record<string, unknown>
  const away = (meta.awayTeam ?? {}) as Record<string, unknown>
  const ha = String(home.abbreviation ?? '')
  const aa = String(away.abbreviation ?? '')
  const dateRaw = String(meta.date ?? '')
  const gameDate = dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw || null
  const pbpRoot = raw.playByPlay as Record<string, unknown> | undefined
  const allPlays = (pbpRoot?.allPlays ?? raw.playByPlay ?? []) as Array<Record<string, unknown>>
  const ps = raw.PlayerStats
  const playerStats = Array.isArray(ps) ? (ps as Array<Record<string, unknown>>) : []

  const playByPlay: PlayByPlayAction[] = (Array.isArray(allPlays) ? allPlays : []).map((p) => ({
    personId: p.personId != null ? Number(p.personId) : null,
    playerName: (p.playerName ?? p.playerNameI ?? null) as string | null,
    teamTricode: (p.teamTricode ?? null) as string | null,
    actionType: String(p.actionType ?? ''),
    subType: p.subType != null ? String(p.subType) : null,
    description: String(p.description ?? ''),
    mp4: p.mp4 != null ? String(p.mp4) : null,
    period: Number(p.period ?? 0),
    clock: String(p.clock ?? ''),
    shotResult: p.shotResult != null ? String(p.shotResult) : null,
    isFieldGoal: Number(p.isFieldGoal ?? 0),
    pointsTotal: Number(p.pointsTotal ?? 0),
  }))

  return {
    gameId,
    gameDate,
    teamTricodes: [aa, ha].filter(Boolean),
    playerStats,
    playByPlay,
  }
}
