/**
 * Collect every play-by-play row with an MP4 where the player is involved:
 * primary actor (personId) or assister (parsed from description).
 * Dedupes by eventNum, sorts chronologically (period asc, clock desc within period).
 */

import type { GameData, PlayByPlayAction } from '../components/Admin/PostCreator/types'

export interface PlayLike {
  personId?: number | null
  playerName?: string | null
  playerNameI?: string | null
  description?: string | null
  mp4?: string | null
  period?: number
  clock?: string
  eventNum?: number | null
  actionId?: number | null
  [key: string]: unknown
}

export type AggregatedPlayerStatsMap = Record<string, Record<string, unknown>> | null | undefined

/** "... (Player Name 4 AST)" */
export function parseAssistPlayerFromDescription(description: string): string | null {
  if (!description) return null
  const assistMatch = description.match(/\(([^)]+)\s+\d+\s+AST\)/)
  if (assistMatch) return assistMatch[1].trim()
  return null
}

export function findPersonIdByNameFromAggregatedStats(
  playerName: string,
  aggregatedPlayerStats: AggregatedPlayerStatsMap,
  plays: PlayLike[],
): number | null {
  const normalizedPlayerName = playerName.trim().toLowerCase()
  if (!normalizedPlayerName) return null

  if (aggregatedPlayerStats && typeof aggregatedPlayerStats === 'object') {
    for (const [personIdStr, stats] of Object.entries(aggregatedPlayerStats)) {
      const fullName = `${stats.firstName || ''} ${stats.familyName || ''}`.trim()
      const nameI = String(stats.nameI || '')
      const lastName = String(stats.familyName || '')
      const firstName = String(stats.firstName || '')

      if (
        fullName.toLowerCase() === normalizedPlayerName ||
        nameI.toLowerCase() === normalizedPlayerName ||
        lastName.toLowerCase() === normalizedPlayerName ||
        (firstName && `${firstName} ${lastName}`.toLowerCase() === normalizedPlayerName)
      ) {
        const id = parseInt(personIdStr, 10)
        if (Number.isFinite(id) && id > 0) return id
      }

      const normalizedLastName = lastName.toLowerCase()
      if (normalizedLastName && normalizedLastName.includes(normalizedPlayerName)) {
        const id = parseInt(personIdStr, 10)
        if (Number.isFinite(id) && id > 0) return id
      }

      const playerNameParts = normalizedPlayerName.split(' ')
      if (playerNameParts.length > 0) {
        const lastPart = playerNameParts[playerNameParts.length - 1]
        if (normalizedLastName && normalizedLastName.includes(lastPart) && lastPart.length > 2) {
          const id = parseInt(personIdStr, 10)
          if (Number.isFinite(id) && id > 0) return id
        }
      }

      if (nameI) {
        const nameIParts = nameI.toLowerCase().split(' ')
        const pParts = normalizedPlayerName.split(' ')
        if (nameIParts.length === pParts.length) {
          if (nameIParts[nameIParts.length - 1] === pParts[pParts.length - 1]) {
            const id = parseInt(personIdStr, 10)
            if (Number.isFinite(id) && id > 0) return id
          }
        }
      }
    }
  }

  for (const play of plays) {
    if (play.playerName && play.playerName.toLowerCase() === normalizedPlayerName) {
      const id = play.personId != null ? Number(play.personId) : NaN
      if (Number.isFinite(id) && id > 0) return id
    }
    if (play.playerNameI && play.playerNameI.toLowerCase() === normalizedPlayerName) {
      const id = play.personId != null ? Number(play.personId) : NaN
      if (Number.isFinite(id) && id > 0) return id
    }
    if (play.playerName) {
      const playLastName = play.playerName.split(' ').slice(-1)[0].toLowerCase()
      const playerLastName = normalizedPlayerName.split(' ').slice(-1)[0]
      if (playLastName === playerLastName && playerLastName.length > 2) {
        const id = play.personId != null ? Number(play.personId) : NaN
        if (Number.isFinite(id) && id > 0) return id
      }
    }
  }

  return null
}

function playDedupeKey(p: PlayLike): string {
  if (p.eventNum != null && String(p.eventNum) !== '') return `e:${p.eventNum}`
  const pid = p.personId != null ? String(p.personId) : 'x'
  return `f:${p.period ?? 0}:${String(p.clock ?? '')}:${pid}:${String(p.description ?? '').slice(0, 80)}`
}

function clockToSecondsRemaining(clock: string | undefined): number {
  if (!clock || typeof clock !== 'string') return 0
  const nbaMatch = clock.match(/PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i)
  if (nbaMatch) {
    const minutes = nbaMatch[1] ? parseInt(nbaMatch[1], 10) : 0
    const seconds = nbaMatch[2] ? Math.floor(parseFloat(nbaMatch[2])) : 0
    return minutes * 60 + seconds
  }
  const displayMatch = clock.trim().match(/^(\d+):(\d{2})$/)
  if (displayMatch) {
    const minutes = parseInt(displayMatch[1], 10)
    const seconds = parseInt(displayMatch[2], 10)
    return minutes * 60 + seconds
  }
  return 0
}

/** Earlier in period = higher seconds remaining = first in chronological story order. */
export function sortPlaysChronological<T extends PlayLike>(plays: T[]): T[] {
  return [...plays].sort((a, b) => {
    const periodA = a.period ?? 0
    const periodB = b.period ?? 0
    if (periodA !== periodB) return periodA - periodB
    const secA = clockToSecondsRemaining(a.clock)
    const secB = clockToSecondsRemaining(b.clock)
    return secB - secA
  })
}

/**
 * All MP4 plays involving playerId (primary or assist), deduped, chronological.
 */
export function collectAllPlayerSpotlightPlaysWithMp4<T extends PlayLike>(
  playerId: number,
  allPlays: T[],
  aggregatedPlayerStats: AggregatedPlayerStatsMap,
): T[] {
  const withMp4 = allPlays.filter((p) => p.mp4 && String(p.mp4).length > 0) as T[]
  const byKey = new Map<string, T>()

  for (const play of withMp4) {
    const pid = play.personId != null ? Number(play.personId) : NaN
    if (Number.isFinite(pid) && pid === playerId) {
      const k = playDedupeKey(play)
      if (!byKey.has(k)) byKey.set(k, play)
    }
  }

  for (const play of withMp4) {
    const desc = String(play.description ?? '')
    const assistName = parseAssistPlayerFromDescription(desc)
    if (!assistName) continue
    const aid = findPersonIdByNameFromAggregatedStats(assistName, aggregatedPlayerStats, allPlays)
    if (aid !== playerId) continue
    const k = playDedupeKey(play)
    if (!byKey.has(k)) byKey.set(k, play)
  }

  return sortPlaysChronological(Array.from(byKey.values()))
}

/** Post Creator / UI: full clip list from loaded game JSON (uses raw.AggregatedPlayerStats). */
export function collectAllPlayerSpotlightPlaysFromGameData(
  playerId: number,
  allGameData: GameData[],
): PlayByPlayAction[] {
  const allPlays: PlayByPlayAction[] = []
  for (const gd of allGameData) {
    allPlays.push(...gd.playByPlay)
  }
  const raw = allGameData[0]?.raw as Record<string, unknown> | undefined
  const agg = raw?.AggregatedPlayerStats as AggregatedPlayerStatsMap
  return collectAllPlayerSpotlightPlaysWithMp4(
    playerId,
    allPlays as unknown as PlayLike[],
    agg,
  ) as unknown as PlayByPlayAction[]
}
