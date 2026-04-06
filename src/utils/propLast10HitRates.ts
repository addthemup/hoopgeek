/**
 * Batch computation of last-10-games hit rates for (player, bet_type).
 * Used by the prop prediction feed post generator so frozen prop_module entries
 * include over_hit_rate, under_hit_rate, last10_total.
 */

import { supabase } from './supabase'
import { calculatePropResult } from './playerPropsCalculator'
import { filterFullGameProps } from './playerPropsFilter'
import { matchPropsGamesToNbaGames } from './matchPropsGamesToNbaGames'
import { utcToESTDate } from './nbaDateUtils'

export interface Last10HitRates {
  overHitRate: number | null
  underHitRate: number | null
  overHits: number
  underHits: number
  total: number
}

type NbaGameForMatching = {
  game_id: string
  game_date: string
  home_team_tricode: string | null
  away_team_tricode: string | null
  home_team_name?: string | null
  away_team_name?: string | null
  home_team_city?: string | null
  away_team_city?: string | null
}

/**
 * Compute last-10-games over/under hit rates for multiple (nba_player_id, bet_type) pairs.
 * cutoffDate: ISO string; only games with game_date < cutoffDate are included (e.g. game day or tomorrow).
 * Returns Map keyed by `${nba_player_id}_${bet_type}`.
 */
export async function computeLast10HitRatesBatch(
  pairs: Array<{ nba_player_id: number; bet_type: string }>,
  cutoffDate: string
): Promise<Map<string, Last10HitRates>> {
  const result = new Map<string, Last10HitRates>()
  if (pairs.length === 0) return result

  const uniquePlayers = [...new Set(pairs.map((p) => p.nba_player_id))]
  const cutoff = cutoffDate.includes('T') ? cutoffDate : `${cutoffDate}T00:00:00.000Z`

  // 1. Last 10 boxscores per player (parallel)
  const boxscoresByPlayer = new Map<number, Array<{ game_id: string; game_date: string; pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fg3m: number; ftm: number; fgm: number; fga: number; fg3a: number; fta: number }>>()
  await Promise.all(
    uniquePlayers.map(async (nbaPlayerId) => {
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('game_id, game_date, pts, reb, ast, stl, blk, tov, fg3m, ftm, fgm, fga, fg3a, fta')
        .eq('nba_player_id', nbaPlayerId)
        .lt('game_date', cutoff)
        .order('game_date', { ascending: false })
        .limit(10)
      if (error || !data?.length) {
        boxscoresByPlayer.set(nbaPlayerId, [])
        return
      }
      boxscoresByPlayer.set(
        nbaPlayerId,
        data.map((r) => ({
          game_id: r.game_id,
          game_date: r.game_date,
          pts: r.pts ?? 0,
          reb: r.reb ?? 0,
          ast: r.ast ?? 0,
          stl: r.stl ?? 0,
          blk: r.blk ?? 0,
          tov: r.tov ?? 0,
          fg3m: r.fg3m ?? 0,
          ftm: r.ftm ?? 0,
          fgm: r.fgm ?? 0,
          fga: r.fga ?? 0,
          fg3a: r.fg3a ?? 0,
          fta: r.fta ?? 0,
        }))
      )
    })
  )

  const allGameIds = [...new Set([...boxscoresByPlayer.values()].flat().map((bs) => bs.game_id))]
  if (allGameIds.length === 0) {
    pairs.forEach((p) => result.set(`${p.nba_player_id}_${p.bet_type}`, { overHitRate: null, underHitRate: null, overHits: 0, underHits: 0, total: 0 }))
    return result
  }

  // 2. NBA games for matching
  const { data: nbaGamesRows } = await supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name, home_team_city, away_team_city')
    .in('game_id', allGameIds)
  const nbaGamesForMatching: NbaGameForMatching[] = (nbaGamesRows || []).map((g) => ({
    game_id: g.game_id,
    game_date: g.game_date,
    home_team_tricode: g.home_team_tricode ?? null,
    away_team_tricode: g.away_team_tricode ?? null,
    home_team_name: (g as Record<string, unknown>).home_team_name as string | null,
    away_team_name: (g as Record<string, unknown>).away_team_name as string | null,
    home_team_city: (g as Record<string, unknown>).home_team_city as string | null,
    away_team_city: (g as Record<string, unknown>).away_team_city as string | null,
  }))

  // 3. player_props_games for these games (by nba_game_id and by date range for fallback)
  const dateStrings = allGameIds.length
    ? [...new Set([...boxscoresByPlayer.values()].flat().map((bs) => utcToESTDate(bs.game_date)).filter(Boolean))]
    : []
  const sorted = dateStrings.slice().sort()
  const rangeMin =
    sorted.length > 0
      ? (() => {
          const [y, m, d] = sorted[0].split('-').map(Number)
          const dt = new Date(y, m - 1, d - 2)
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
        })()
      : ''
  const rangeMax =
    sorted.length > 0
      ? (() => {
          const [y, m, d] = sorted[sorted.length - 1].split('-').map(Number)
          const dt = new Date(y, m - 1, d + 2)
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
        })()
      : ''

  type PpgRow = { id: string; event_id?: string; nba_game_id: string | null; game_date: string; home_team_tricode: string | null; away_team_tricode: string | null; home_team: string | null; away_team: string | null }
  let allPropsGames: PpgRow[] = []
  const { data: ppgByNba } = await supabase
    .from('player_props_games')
    .select('id, event_id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team')
    .in('nba_game_id', allGameIds)
  if (ppgByNba?.length) allPropsGames = (ppgByNba as PpgRow[]).map((p) => ({ ...p, event_id: p.event_id ?? '' }))
  if (rangeMin && rangeMax) {
    const { data: ppgByDate } = await supabase
      .from('player_props_games')
      .select('id, event_id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team')
      .gte('game_date', rangeMin)
      .lte('game_date', rangeMax)
      .limit(3000)
    if (ppgByDate?.length) {
      const existingIds = new Set(allPropsGames.map((p) => p.id))
      const added = (ppgByDate as PpgRow[]).map((p) => ({ ...p, event_id: p.event_id ?? '' })).filter((p) => !existingIds.has(p.id))
      allPropsGames = [...allPropsGames, ...added]
    }
  }

  const propsGameMatches = matchPropsGamesToNbaGames(allPropsGames, nbaGamesForMatching)
  const ppgIdToNbaGameId = new Map<string, string>()
  allPropsGames.forEach((pg) => {
    if (pg.nba_game_id && allGameIds.includes(pg.nba_game_id)) ppgIdToNbaGameId.set(pg.id, pg.nba_game_id)
  })
  propsGameMatches.forEach((nbaGame, ppgId) => {
    if (allGameIds.includes(nbaGame.game_id)) ppgIdToNbaGameId.set(ppgId, nbaGame.game_id)
  })

  const ppgIds = Array.from(ppgIdToNbaGameId.keys())
  const uniqueBetTypes = [...new Set(pairs.map((p) => p.bet_type))]

  if (ppgIds.length === 0 || uniqueBetTypes.length === 0) {
    pairs.forEach((p) => result.set(`${p.nba_player_id}_${p.bet_type}`, { overHitRate: null, underHitRate: null, overHits: 0, underHits: 0, total: 0 }))
    return result
  }

  const { data: propsRaw } = await supabase
    .from('player_props')
    .select('game_id, nba_player_id, bet_type, line, raw_odd_data')
    .in('game_id', ppgIds)
    .in('nba_player_id', uniquePlayers)
    .in('bet_type', uniqueBetTypes)
    .limit(5000)
  const props = filterFullGameProps(propsRaw ?? [])

  const lineByPlayerBetGame = new Map<string, number>()
  for (const p of props) {
    const nbaGameId = ppgIdToNbaGameId.get(p.game_id)
    if (nbaGameId == null || p.line == null) continue
    const key = `${p.nba_player_id}_${p.bet_type}_${nbaGameId}`
    lineByPlayerBetGame.set(key, Number(p.line))
  }

  for (const { nba_player_id, bet_type } of pairs) {
    const boxscores = boxscoresByPlayer.get(nba_player_id) ?? []
    let overCount = 0
    let underCount = 0
    let total = 0
    for (const bs of boxscores) {
      const line = lineByPlayerBetGame.get(`${nba_player_id}_${bet_type}_${bs.game_id}`)
      if (line == null) continue
      const res = calculatePropResult(bet_type, line, bs)
      if (!res) continue
      if (res.result === 'push') continue
      total += 1
      if (res.result === 'over') overCount += 1
      else underCount += 1
    }
    const overHitRate = total > 0 ? Math.round((overCount / total) * 10000) / 100 : null
    const underHitRate = total > 0 ? Math.round((underCount / total) * 10000) / 100 : null
    result.set(`${nba_player_id}_${bet_type}`, { overHitRate, underHitRate, overHits: overCount, underHits: underCount, total })
  }

  return result
}
