/**
 * Prop Results section generator.
 *
 * Same data flow as PropPerformanceModule on /today/: player_props_games (often
 * nba_game_id null) → match to nba_games by date + tricodes → player_props →
 * nba_boxscores → calculatePropResult. Produces hero → headline → prop_module (frozen snapshot for the selected game).
 */

import { supabase } from '../../../../utils/supabase'
import { calculatePropResult } from '../../../../utils/playerPropsCalculator'
import { filterFullGameProps } from '../../../../utils/playerPropsFilter'
import { matchPropsGamesToNbaGames } from '../../../../utils/matchPropsGamesToNbaGames'
import type {
  HeroContent,
  HeadlineContent,
  PropModuleContent,
  PropModuleEntry,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'

export async function generatePropResultsSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  const { draft, targetTeams, targetGameId } = ctx
  const targetDate = ctx.targetDate?.includes('T') ? ctx.targetDate.split('T')[0] : ctx.targetDate
  if (!targetDate && !targetTeams?.length) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []

  const teamLabel =
    targetTeams?.length === 2 ? `${targetTeams[0]} vs ${targetTeams[1]}` : targetTeams?.[0] || 'NBA'

  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: '',
      gradient_overlay: true,
      badge: 'PROP RESULTS',
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
      text: draft.title || `Prop Results — ${teamLabel}`,
      subtitle: draft.subtitle || targetDate || '',
    } satisfies HeadlineContent,
    player_id: null,
    team_tricode: null,
  })

  const nextDay = targetDate
    ? new Date(new Date(targetDate + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)
    : undefined

  const dateRange = targetDate && nextDay ? [targetDate, nextDay] : targetDate ? [targetDate] : []

  // 1. Get nba game(s) for matching (player_props_games.nba_game_id is often null)
  let nbaGamesForMatching: Array<{ game_id: string; game_date: string; home_team_tricode: string | null; away_team_tricode: string | null; home_team_name?: string | null; away_team_name?: string | null; home_team_city?: string | null; away_team_city?: string | null }> = []
  if (targetGameId) {
    const { data: nbaGame } = await supabase
      .from('nba_games')
      .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name, home_team_city, away_team_city')
      .eq('game_id', targetGameId)
      .single()
    if (nbaGame) {
      nbaGamesForMatching = [nbaGame]
    }
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

  // 2. Fetch ALL player_props_games for date range (do not filter by nba_game_id; it's often null)
  if (dateRange.length === 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No prop results for ${teamLabel} on ${targetDate || 'today'}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  const { data: allPropsGames } = await supabase
    .from('player_props_games')
    .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, event_id')
    .in('game_date', dateRange)

  if (!allPropsGames?.length) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No prop results for ${teamLabel} on ${targetDate || 'today'}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  // 3. Match props games to nba games (same as PropPerformanceModule)
  const propsGameMatches = matchPropsGamesToNbaGames(allPropsGames, nbaGamesForMatching)

  let matchedPropsGameIds: string[]
  let nbaGameIdsForBoxscores: string[]
  const propsGameToNbaGame = new Map<string, string>()

  if (targetGameId) {
    matchedPropsGameIds = Array.from(propsGameMatches.entries())
      .filter(([, nbaGame]) => nbaGame.game_id === targetGameId)
      .map(([id]) => id)
    // Include any props games that already have nba_game_id set
    for (const pg of allPropsGames) {
      if (pg.nba_game_id === targetGameId && !matchedPropsGameIds.includes(pg.id)) {
        matchedPropsGameIds.push(pg.id)
      }
    }
    nbaGameIdsForBoxscores = [targetGameId]
    matchedPropsGameIds.forEach((id) => propsGameToNbaGame.set(id, targetGameId))
  } else {
    matchedPropsGameIds = Array.from(propsGameMatches.keys())
    nbaGameIdsForBoxscores = Array.from(new Set(Array.from(propsGameMatches.values()).map((g) => g.game_id)))
    propsGameMatches.forEach((nbaGame, propsGameId) => propsGameToNbaGame.set(propsGameId, nbaGame.game_id))
  }

  if (matchedPropsGameIds.length === 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No prop results for ${teamLabel} on ${targetDate || 'today'}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  // 4. Fetch player_props for matched props games (include bookmaker for tiebreaker)
  const { data: rawProps } = await supabase
    .from('player_props')
    .select('id, nba_player_id, bet_type, line, bet_type_id, game_id, raw_odd_data, bookmaker_id, bookmaker')
    .in('game_id', matchedPropsGameIds)
    .order('line', { ascending: false })
    .limit(500)

  const fullGamePropsRaw = filterFullGameProps(rawProps || [])

  // One prop per (nba_player_id, bet_type): keep highest line; if tied, prefer DraftKings > FanDuel > Consensus > others (same as import-player-props)
  const getBookmakerPriority = (bm: string | null | undefined): number => {
    const s = (bm ?? '').toLowerCase()
    if (s.includes('draftkings')) return 1
    if (s.includes('fanduel')) return 2
    if (s === 'consensus') return 3
    return 4
  }
  const byPlayerAndType = new Map<string, typeof fullGamePropsRaw>()
  for (const prop of fullGamePropsRaw) {
    if (prop.nba_player_id == null) continue
    const key = `${prop.nba_player_id}:${prop.bet_type ?? ''}`
    if (!byPlayerAndType.has(key)) byPlayerAndType.set(key, [])
    byPlayerAndType.get(key)!.push(prop)
  }
  const fullGameProps = Array.from(byPlayerAndType.values()).map((props) => {
    props.sort((a, b) => {
      const lineA = Number(a.line ?? 0)
      const lineB = Number(b.line ?? 0)
      if (lineA !== lineB) return lineB - lineA
      return getBookmakerPriority(a.bookmaker_id ?? a.bookmaker) - getBookmakerPriority(b.bookmaker_id ?? b.bookmaker)
    })
    return props[0]
  })

  if (fullGameProps.length === 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `No prop results available for ${teamLabel}.` },
      player_id: null,
      team_tricode: null,
    })
    return sections
  }

  const playerIds = Array.from(new Set(fullGameProps.map((p) => p.nba_player_id).filter(Boolean)))
  // 5. Fetch boxscores (full stat set for calculatePropResult: fgm, fga, fg3a, fta)
  const { data: boxscores } = await supabase
    .from('nba_boxscores')
    .select('nba_player_id, game_id, pts, reb, ast, stl, blk, tov, fg3m, ftm, fg3a, fta, fgm, fga')
    .in('nba_player_id', playerIds)
    .in('game_id', nbaGameIdsForBoxscores)

  const boxscoreMap = new Map<string, any>()
  for (const box of boxscores || []) {
    boxscoreMap.set(`${box.nba_player_id}:${box.game_id}`, box)
  }

  const { data: players } = await supabase
    .from('nba_players')
    .select('nba_player_id, name, team_abbreviation')
    .in('nba_player_id', playerIds)

  const playerMap = new Map((players || []).map((p) => [p.nba_player_id, p]))

  const entries: PropModuleEntry[] = []

  for (const prop of fullGameProps) {
    if (!prop.nba_player_id) continue
    const nbaGameId = propsGameToNbaGame.get(prop.game_id)
    if (!nbaGameId) continue

    const box = boxscoreMap.get(`${prop.nba_player_id}:${nbaGameId}`)
    if (!box) continue

    const calcResult = calculatePropResult(prop.bet_type, prop.line ?? 0, box)
    if (!calcResult) continue

    const player = playerMap.get(prop.nba_player_id)
    const teamTricode = player?.team_abbreviation ?? ''
    if (targetTeams?.length && !targetTeams.includes(teamTricode)) continue

    entries.push({
      nba_player_id: prop.nba_player_id,
      player_name: player?.name ?? `Player ${prop.nba_player_id}`,
      team_tricode: teamTricode,
      bet_type: prop.bet_type,
      line: prop.line ?? 0,
      actual: calcResult.actualValue,
      result: calcResult.result,
    })
  }

  sections.push({
    id: nextSectionId(),
    section_type: 'prop_module',
    title: '',
    content: {
      props: entries,
      teams: targetTeams ?? [],
      date: targetDate ?? '',
      mode: 'results',
    } satisfies PropModuleContent,
    player_id: null,
    team_tricode: null,
  })

  if (entries.length === 0) {
    sections.push({
      id: nextSectionId(),
      section_type: 'rich_text',
      title: '',
      content: { markdown: `Box scores not yet available. Results will be calculated once final stats are posted.` },
      player_id: null,
      team_tricode: null,
    })
  }

  return sections
}
