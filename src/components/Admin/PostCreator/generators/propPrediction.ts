/**
 * Prop Prediction section generator.
 *
 * Carbon-copy of the Prop Predictions module in /feed drawer (Today.PropPredictionsModule):
 * same data flow — match props games → fetch all player_props → matchPlayerNames →
 * cleanPlayerProps → filterGamePropsOnly → last-10 hit rates → dedupe by player+bet_type →
 * enrich with team confidence and player confidence (nba_daily_team_stats, nba_daily_player_stats) → PropModuleEntry[].
 */

import { supabase } from '../../../../utils/supabase'
import { matchPropsGamesToNbaGames } from '../../../../utils/matchPropsGamesToNbaGames'
import { cleanPlayerProps, filterGamePropsOnly, type CleanedPlayerProp } from '../../../../utils/cleanPlayerProps'
import { matchPlayerNames } from '../../../../utils/playerNameMatcher'
import { calculatePropResult } from '../../../../utils/playerPropsCalculator'
import { enrichPropsWithTeamConfidence } from '../../../../utils/propPredictionsTeamConfidence'
import { enrichPropsWithPlayerConfidence } from '../../../../utils/propPredictionsPlayerConfidence'
import type {
  HeroContent,
  HeadlineContent,
  PropModuleContent,
  PropModuleEntry,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'

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

export async function generatePropPredictionSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  const { draft, targetTeams, targetGameId } = ctx
  const targetDate = ctx.targetDate?.includes('T') ? ctx.targetDate.split('T')[0] : ctx.targetDate
  if (!targetDate && !targetTeams?.length) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []

  const teamLabel = targetTeams?.length === 2
    ? `${targetTeams[0]} vs ${targetTeams[1]}`
    : targetTeams?.[0] || 'NBA'

  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: '',
      gradient_overlay: true,
      badge: 'PROP PREDICTIONS',
      team_tricodes: targetTeams?.length ? targetTeams : undefined,
    } satisfies HeroContent,
    player_id: null,
    team_tricode: targetTeams?.[0] || null,
  })

  sections.push({
    id: nextSectionId(),
    section_type: 'headline',
    title: '',
    content: {
      text: draft.title || `Prop Predictions — ${teamLabel}`,
      subtitle: draft.subtitle || targetDate || '',
    } satisfies HeadlineContent,
    player_id: null,
    team_tricode: null,
  })

  const nextDay = targetDate
    ? new Date(new Date(targetDate + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)
    : undefined

  const dateRange = targetDate && nextDay ? [targetDate, nextDay] : targetDate ? [targetDate] : []

  // 1. Build nba games for matching (same as prop results / Today prop predictor)
  let nbaGamesForMatching: NbaGameForMatching[] = []
  if (targetGameId) {
    const { data: nbaGame } = await supabase
      .from('nba_games')
      .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name, home_team_city, away_team_city')
      .eq('game_id', targetGameId)
      .single()
    if (nbaGame) nbaGamesForMatching = [nbaGame]
  } else if (targetDate && targetTeams?.length) {
    const { data: nbaGames } = await supabase
      .from('nba_games')
      .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name, home_team_city, away_team_city')
      .gte('game_date', `${targetDate}T00:00:00`)
      .lte('game_date', `${nextDay || targetDate}T23:59:59`)
      .or(targetTeams.map((t) => `home_team_tricode.eq.${t},away_team_tricode.eq.${t}`).join(','))
      .limit(20)
    nbaGamesForMatching = nbaGames || []
  }

  if (dateRange.length === 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No props available yet for ${teamLabel} on ${targetDate || 'today'}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  // 2. Fetch ALL player_props_games for date range (nba_game_id often null for upcoming)
  const { data: allPropsGames } = await supabase
    .from('player_props_games')
    .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, event_id')
    .in('game_date', dateRange)

  if (!allPropsGames?.length) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No props available yet for ${teamLabel} on ${targetDate || 'today'}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  // 3. Match props games to nba games (same as Prop Predictions module in drawer)
  let matchedPropsGameIds: string[] = []
  const propsGameMatches = matchPropsGamesToNbaGames(allPropsGames, nbaGamesForMatching)
  if (nbaGamesForMatching.length > 0) {
    const targetGameIds = new Set(nbaGamesForMatching.map((g) => g.game_id))
    matchedPropsGameIds = Array.from(propsGameMatches.entries())
      .filter(([, nbaGame]) => targetGameIds.has(nbaGame.game_id))
      .map(([propsGameId]) => propsGameId)
  }

  if (matchedPropsGameIds.length === 0 && targetTeams?.length === 2) {
    const [t1, t2] = targetTeams
    const matchupPropsGames = allPropsGames.filter((pg) => {
      const home = pg.home_team_tricode ?? ''
      const away = pg.away_team_tricode ?? ''
      return (home === t1 && away === t2) || (home === t2 && away === t1)
    })
    matchedPropsGameIds = matchupPropsGames.map((pg) => pg.id).filter(Boolean)
  }

  if (matchedPropsGameIds.length === 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No props available yet for ${teamLabel} on ${targetDate || 'today'}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  // 4. Fetch ALL player_props for matched games (same columns as drawer; need over+under rows for cleanPlayerProps)
  const { data: rawProps, error } = await supabase
    .from('player_props')
    .select('id, game_id, event_id, player_name, player_id, nba_player_id, bet_type, bet_type_id, line, game_date, created_at, updated_at, raw_odd_data')
    .in('game_id', matchedPropsGameIds)
    .in('game_date', dateRange)
    .order('player_name')
    .order('bet_type')
    .limit(2000)

  if (error || !rawProps?.length) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No props available yet for ${teamLabel} on ${targetDate || 'today'}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  // 5. Enhance with nba_game_id and player name matching (same as drawer)
  const propsGameToNbaGameMap = new Map<string, string>()
  propsGameMatches.forEach((nbaGame, propsGameId) => {
    if (nbaGamesForMatching.some((g) => g.game_id === nbaGame.game_id)) {
      propsGameToNbaGameMap.set(propsGameId, nbaGame.game_id)
    }
  })

  const unmatchedNames = [...new Set((rawProps as any[]).filter((p) => !p.player_id && p.player_name).map((p) => p.player_name))]
  let playerNameMatches = new Map<string, { player_id: string; nba_player_id: number; name: string; team_abbreviation?: string } | null>()
  if (unmatchedNames.length > 0) {
    const matches = await matchPlayerNames(supabase, unmatchedNames)
    matches.forEach((match, name) => {
      playerNameMatches.set(name, match as any)
    })
  }

  const enhancedProps = (rawProps as any[]).map((prop) => {
    const nbaGameId = propsGameToNbaGameMap.get(prop.game_id) ?? null
    if (prop.player_id && prop.nba_player_id) {
      return { ...prop, nba_game_id: nbaGameId }
    }
    if (prop.player_name && playerNameMatches.has(prop.player_name)) {
      const match = playerNameMatches.get(prop.player_name)
      if (match) {
        return {
          ...prop,
          player_id: match.player_id,
          nba_player_id: match.nba_player_id,
          nba_game_id: nbaGameId,
        }
      }
    }
    return { ...prop, nba_game_id: nbaGameId }
  })

  // 6. Clean and combine over/under → game-only (carbon copy of drawer)
  const cleanedProps = cleanPlayerProps(enhancedProps)
  const gamePropsOnly = filterGamePropsOnly(cleanedProps)

  if (gamePropsOnly.length === 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No full-game props available yet for ${teamLabel} on ${targetDate || 'today'}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  // 7. Last-10 hit rates using CURRENT line for all 10 games (same as PropPredictionsModule in Today)
  const cutoff = targetDate ? `${targetDate}T00:00:00.000Z` : new Date(Date.now() + 86400000).toISOString()
  const propsByPlayer = new Map<number, CleanedPlayerProp[]>()
  gamePropsOnly.forEach((p) => {
    if (p.nba_player_id) {
      if (!propsByPlayer.has(p.nba_player_id)) propsByPlayer.set(p.nba_player_id, [])
      propsByPlayer.get(p.nba_player_id)!.push(p)
    }
  })
  const uniquePlayerIds = Array.from(propsByPlayer.keys())
  const boxscoreCache = new Map<number, Array<{ game_id: string; pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fg3m: number; ftm: number; fg3a: number; fta: number; fgm: number; fga: number }>>()
  const batchSize = 20
  for (let i = 0; i < uniquePlayerIds.length; i += batchSize) {
    const batch = uniquePlayerIds.slice(i, i + batchSize)
    await Promise.all(
      batch.map(async (nbaPlayerId) => {
        const { data: recentBoxscores } = await supabase
          .from('nba_boxscores')
          .select('game_id, game_date, pts, reb, ast, stl, blk, tov, fg3m, ftm, fg3a, fta, fgm, fga')
          .eq('nba_player_id', nbaPlayerId)
          .lt('game_date', cutoff)
          .order('game_date', { ascending: false })
          .limit(10)
        if (recentBoxscores?.length) {
          boxscoreCache.set(
            nbaPlayerId,
            recentBoxscores.map((r) => ({
              game_id: r.game_id,
              pts: r.pts ?? 0,
              reb: r.reb ?? 0,
              ast: r.ast ?? 0,
              stl: r.stl ?? 0,
              blk: r.blk ?? 0,
              tov: r.tov ?? 0,
              fg3m: r.fg3m ?? 0,
              ftm: r.ftm ?? 0,
              fg3a: r.fg3a ?? 0,
              fta: r.fta ?? 0,
              fgm: r.fgm ?? 0,
              fga: r.fga ?? 0,
            }))
          )
        }
      })
    )
  }

  const propsWithHitRates = gamePropsOnly.map((prop) => {
    const nbaPlayerId = prop.nba_player_id
    if (!nbaPlayerId) {
      return { ...prop, overHitRate: null, underHitRate: null, overHits: 0, underHits: 0, last10Total: 0 }
    }
    const recentBoxscores = boxscoreCache.get(nbaPlayerId)
    if (!recentBoxscores?.length) {
      return { ...prop, overHitRate: null, underHitRate: null, overHits: 0, underHits: 0, last10Total: 0 }
    }
    const lineValue = prop.currentLine ?? prop.line ?? 0
    let overHits = 0
    let underHits = 0
    let total = 0
    for (const boxscore of recentBoxscores) {
      const result = calculatePropResult(prop.bet_type, lineValue, boxscore)
      if (!result) continue
      total += 1
      if (result.result === 'over') overHits += 1
      else if (result.result === 'under') underHits += 1
    }
    const overHitRate = total > 0 ? Math.round((overHits / total) * 10000) / 100 : null
    const underHitRate = total > 0 ? Math.round((underHits / total) * 10000) / 100 : null
    return { ...prop, overHitRate, underHitRate, overHits, underHits, last10Total: total }
  })

  // 8. Dedupe by player+bet_type, keep highest line (same as drawer)
  const byKey = new Map<string, (typeof propsWithHitRates)[0]>()
  propsWithHitRates.forEach((prop) => {
    const key = `${prop.nba_player_id}_${prop.bet_type}`
    const existing = byKey.get(key)
    const line = prop.currentLine ?? prop.line ?? 0
    if (!existing || (existing.currentLine ?? existing.line ?? 0) < line) {
      byKey.set(key, prop)
    }
  })

  const { data: players } = await supabase
    .from('nba_players')
    .select('nba_player_id, name, team_abbreviation')
    .in('nba_player_id', uniquePlayerIds)
  const playerMap = new Map((players || []).map((p) => [p.nba_player_id, p]))

  // Exclude FTM/FTA like the drawer (PropPredictionsModule isFtmOrFta)
  const isFtmOrFta = (betType: string) => {
    const n = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+')
    return n.includes('freethrowsmade') || n === 'ftm' || n.includes('freethrowsattempted') || n === 'fta'
  }

  const propsList = Array.from(byKey.values()).filter((prop) => {
    if (isFtmOrFta(prop.bet_type)) return false
    const teamTricode = playerMap.get(prop.nba_player_id)?.team_abbreviation ?? ''
    return !targetTeams?.length || targetTeams.includes(teamTricode)
  })

  // Attach player_props_games (and nba_game_id) so enrichment can resolve opposition team
  const propsForEnrichment = propsList.map((prop) => {
    const pg = allPropsGames?.find((g: { id: string }) => g.id === prop.game_id)
    const nbaGameId =
      (prop as { nba_game_id?: string | null }).nba_game_id ?? propsGameToNbaGameMap.get(prop.game_id) ?? null
    return {
      ...prop,
      nba_game_id: nbaGameId,
      player_props_games: pg
        ? { id: pg.id, home_team_tricode: pg.home_team_tricode, away_team_tricode: pg.away_team_tricode, nba_game_id: nbaGameId }
        : undefined,
    } as Record<string, unknown>
  })

  // Maps for team/player confidence (same as drawer)
  const gameIdToTeams = new Map(
    (allPropsGames ?? [])
      .filter((pg: { id: string }) => matchedPropsGameIds.includes(pg.id))
      .map((pg: { id: string; home_team_tricode?: string | null; away_team_tricode?: string | null }) => [
        pg.id,
        { home_team_tricode: (pg.home_team_tricode ?? '').trim(), away_team_tricode: (pg.away_team_tricode ?? '').trim() },
      ])
  )
  const nbaGameIdToTeams = new Map(
    nbaGamesForMatching.map((g) => [
      g.game_id,
      { home_team_tricode: (g.home_team_tricode ?? '').trim(), away_team_tricode: (g.away_team_tricode ?? '').trim() },
    ])
  )
  const playerTeamMap = new Map(
    (players ?? []).map((p: { nba_player_id: number; team_abbreviation?: string | null }) => [
      p.nba_player_id,
      (p.team_abbreviation ?? '').trim(),
    ])
  )

  // Fetch nba_daily_team_stats and nba_daily_player_stats for targetDate (with fallback to latest)
  let statsRows: { endpoint_name: string; data: string | object }[] = []
  if (targetDate) {
    const { data: rowsForDate } = await supabase
      .from('nba_daily_team_stats')
      .select('endpoint_name, data')
      .eq('date', targetDate)
    if (rowsForDate?.length) statsRows = rowsForDate
    else {
      const { data: latestRow } = await supabase.from('nba_daily_team_stats').select('date').order('date', { ascending: false }).limit(1).maybeSingle()
      const fallbackDate = (latestRow as { date?: string } | null)?.date
      if (fallbackDate) {
        const { data: rowsFallback } = await supabase.from('nba_daily_team_stats').select('endpoint_name, data').eq('date', fallbackDate)
        statsRows = rowsFallback ?? []
      }
    }
  }

  let playerStatsRows: { endpoint_name?: string; data?: string | object; date?: string }[] = []
  if (targetDate) {
    const { data: rowsForDate } = await supabase.from('nba_daily_player_stats').select('date, data, endpoint_name').eq('date', targetDate)
    if (rowsForDate?.length) playerStatsRows = rowsForDate
    else {
      const { data: fallback } = await supabase
        .from('nba_daily_player_stats')
        .select('date, data, endpoint_name')
        .order('date', { ascending: false })
        .limit(1)
      playerStatsRows = (fallback ?? []) as { endpoint_name?: string; data?: string | object; date?: string }[]
    }
  }

  const teamEnriched = enrichPropsWithTeamConfidence(
    propsForEnrichment,
    playerTeamMap,
    statsRows as import('../../../../utils/propPredictionsTeamConfidence').NbaDailyTeamStatsRow[],
    gameIdToTeams,
    nbaGameIdToTeams,
    playerStatsRows as import('../../../../utils/propPredictionsTeamConfidence').NbaDailyPlayerStatsRow[]
  )
  const playerEnriched = enrichPropsWithPlayerConfidence(
    propsForEnrichment,
    playerTeamMap,
    playerStatsRows as import('../../../../utils/propPredictionsPlayerConfidence').NbaDailyPlayerStatsRow[],
    gameIdToTeams,
    nbaGameIdToTeams
  )

  const entries: PropModuleEntry[] = []
  for (let i = 0; i < propsList.length; i++) {
    const prop = propsList[i]
    const teamRow = teamEnriched[i]
    const playerRow = playerEnriched[i]

    const displayName = playerMap.get(prop.nba_player_id)?.name ?? prop.player_name ?? `Player ${prop.nba_player_id}`
    const teamTricode = playerMap.get(prop.nba_player_id)?.team_abbreviation ?? ''
    const line = prop.currentLine ?? prop.line ?? 0
    const overOdds = prop.over?.american_odds ?? prop.over?.price ?? undefined
    const underOdds = prop.under?.american_odds ?? prop.under?.price ?? undefined
    const lineMovement = typeof (prop as CleanedPlayerProp).lineMovement === 'number' ? (prop as CleanedPlayerProp).lineMovement : undefined

    entries.push({
      nba_player_id: prop.nba_player_id,
      player_name: displayName,
      team_tricode: teamTricode,
      bet_type: prop.bet_type,
      line: typeof line === 'number' ? line : parseFloat(String(line)) || 0,
      ...(lineMovement != null && lineMovement !== 0 ? { line_movement: lineMovement } : {}),
      over_odds: overOdds,
      under_odds: underOdds,
      over_hit_rate: prop.overHitRate ?? null,
      under_hit_rate: prop.underHitRate ?? null,
      over_hits: prop.overHits ?? 0,
      under_hits: prop.underHits ?? 0,
      last10_total: prop.last10Total ?? 0,
      team_confidence: teamRow?.teamConfidence ?? null,
      player_confidence: playerRow?.playerConfidence ?? null,
      opposition_stat_label: teamRow?.oppositionStatLabel ?? playerRow?.oppositionStatLabel,
      opposition_stat_value: teamRow?.oppositionStatValue ?? playerRow?.oppositionStatValue ?? null,
      ...(teamRow?.playerOffenseStatLabel != null && { player_offense_stat_label: teamRow.playerOffenseStatLabel }),
      ...(teamRow?.playerOffenseStatValue !== undefined && { player_offense_stat_value: teamRow.playerOffenseStatValue }),
    })
  }

  const propModuleBase = {
    props: entries,
    teams: targetTeams ?? [],
    date: targetDate ?? '',
    mode: 'prediction' as const,
  }

  const embedModes: PropModuleContent['embedMode'][] = ['over', 'under', 'team_confidence', 'player_confidence']
  for (const embedMode of embedModes) {
    sections.push({
      id: nextSectionId(),
      section_type: 'prop_module',
      title: '',
      content: {
        ...propModuleBase,
        embedMode,
      } satisfies PropModuleContent,
      player_id: null,
      team_tricode: null,
    })
  }

  return sections
}
