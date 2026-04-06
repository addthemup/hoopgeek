/**
 * Mirrors src/components/Admin/PostCreator/generators/propResults.ts for Edge automation.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { matchPropsGamesToNbaGames } from '../prop_prediction/matchPropsGamesToNbaGames.ts'
import { calculatePropResult } from '../prop_prediction/calculatePropResult.ts'
import { filterFullGameProps } from './filterFullGameProps.ts'
import type { SectionRow } from '../prop_prediction/buildPropPredictionSnapshot.ts'

export async function buildPropResultsSnapshot(
  supabase: SupabaseClient,
  params: {
    targetDate: string
    targetGameId: string
    awayTricode: string
    homeTricode: string
  },
): Promise<{ prop_snapshot: Record<string, unknown>; sections: SectionRow[] } | null> {
  const targetDate = params.targetDate.includes('T') ? params.targetDate.split('T')[0] : params.targetDate
  const targetTeams = [params.awayTricode, params.homeTricode].filter(Boolean)
  if (!targetDate || targetTeams.length < 2) return null

  const nextDay = new Date(new Date(targetDate + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)
  const dateRange = [targetDate, nextDay]

  const { data: nbaGame } = await supabase
    .from('nba_games')
    .select(
      'game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name, home_team_city, away_team_city',
    )
    .eq('game_id', params.targetGameId)
    .single()

  const nbaGamesForMatching = nbaGame
    ? [
        nbaGame as {
          game_id: string
          game_date: string
          home_team_tricode: string | null
          away_team_tricode: string | null
          home_team_name?: string | null
          away_team_name?: string | null
          home_team_city?: string | null
          away_team_city?: string | null
        },
      ]
    : []
  if (nbaGamesForMatching.length === 0) return null

  const { data: allPropsGames } = await supabase
    .from('player_props_games')
    .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, event_id')
    .in('game_date', dateRange)

  if (!allPropsGames?.length) return null

  const propsGameMatches = matchPropsGamesToNbaGames(allPropsGames, nbaGamesForMatching)
  const targetGameId = params.targetGameId

  let matchedPropsGameIds = Array.from(propsGameMatches.entries())
    .filter(([, nbaG]) => nbaG.game_id === targetGameId)
    .map(([id]) => id)

  for (const pg of allPropsGames) {
    if (pg.nba_game_id === targetGameId && !matchedPropsGameIds.includes(pg.id)) {
      matchedPropsGameIds.push(pg.id)
    }
  }

  if (matchedPropsGameIds.length === 0 && targetTeams.length === 2) {
    const [t1, t2] = targetTeams
    const matchupPropsGames = allPropsGames.filter((pg) => {
      const home = pg.home_team_tricode ?? ''
      const away = pg.away_team_tricode ?? ''
      return (home === t1 && away === t2) || (home === t2 && away === t1)
    })
    matchedPropsGameIds = matchupPropsGames.map((pg) => pg.id).filter(Boolean)
  }

  if (matchedPropsGameIds.length === 0) return null

  const propsGameToNbaGame = new Map<string, string>()
  matchedPropsGameIds.forEach((id) => propsGameToNbaGame.set(id, targetGameId))

  const { data: rawProps } = await supabase
    .from('player_props')
    .select('id, nba_player_id, bet_type, line, bet_type_id, game_id, raw_odd_data, bookmaker_id, bookmaker')
    .in('game_id', matchedPropsGameIds)
    .order('line', { ascending: false })
    .limit(500)

  const fullGamePropsRaw = filterFullGameProps(rawProps || [])

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

  if (fullGameProps.length === 0) return null

  const playerIds = Array.from(new Set(fullGameProps.map((p) => p.nba_player_id).filter(Boolean))) as number[]
  const nbaGameIdsForBoxscores = [targetGameId]

  const { data: boxscores } = await supabase
    .from('nba_boxscores')
    .select('nba_player_id, game_id, pts, reb, ast, stl, blk, tov, fg3m, ftm, fg3a, fta, fgm, fga')
    .in('nba_player_id', playerIds)
    .in('game_id', nbaGameIdsForBoxscores)

  const boxscoreMap = new Map<string, Record<string, unknown>>()
  for (const box of boxscores || []) {
    boxscoreMap.set(`${box.nba_player_id}:${box.game_id}`, box as Record<string, unknown>)
  }

  const { data: players } = await supabase
    .from('nba_players')
    .select('nba_player_id, name, team_abbreviation')
    .in('nba_player_id', playerIds)

  const playerMap = new Map((players || []).map((p) => [p.nba_player_id, p]))

  const entries: Record<string, unknown>[] = []

  for (const prop of fullGameProps) {
    if (!prop.nba_player_id) continue
    const nbaGId = propsGameToNbaGame.get(prop.game_id)
    if (!nbaGId) continue

    const box = boxscoreMap.get(`${prop.nba_player_id}:${nbaGId}`)
    if (!box) continue

    const calcResult = calculatePropResult(prop.bet_type, Number(prop.line ?? 0), box as Parameters<typeof calculatePropResult>[2])
    if (!calcResult) continue

    const player = playerMap.get(prop.nba_player_id)
    const teamTricode = player?.team_abbreviation ?? ''
    if (targetTeams.length && !targetTeams.includes(teamTricode)) continue

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

  if (entries.length === 0) return null

  const teamLabel = `${targetTeams[0]} @ ${targetTeams[1]}`
  const propModuleContent = {
    props: entries,
    teams: targetTeams,
    date: targetDate,
    mode: 'results' as const,
  }

  const sections: SectionRow[] = [
    {
      section_type: 'hero',
      title: '',
      content: {
        image_url: '',
        gradient_overlay: true,
        badge: 'PROP RESULTS',
        team_tricodes: targetTeams,
      },
      player_id: null,
      team_tricode: targetTeams[0] || null,
    },
    {
      section_type: 'headline',
      title: '',
      content: {
        text: `Prop Results — ${teamLabel}`,
        subtitle: targetDate,
      },
      player_id: null,
      team_tricode: null,
    },
    {
      section_type: 'prop_module',
      title: '',
      content: propModuleContent as unknown as Record<string, unknown>,
      player_id: null,
      team_tricode: null,
    },
  ]

  return {
    prop_snapshot: propModuleContent as unknown as Record<string, unknown>,
    sections,
  }
}
