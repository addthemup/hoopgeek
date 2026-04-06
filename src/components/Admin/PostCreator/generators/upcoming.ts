/**
 * Upcoming (Game Preview) section generator.
 *
 * Produces a rich game preview post that borrows structure from the
 * former game page. Sections:
 *   hero → headline → stat_comparison (matchup) → injury_card[]
 *   → prop_card[] (top props) → post_link[] (related posts)
 *   → player_highlight[] (key players)
 *
 * Related posts are fetched from feed_posts and cross-linked:
 *   - Injury reports for either team
 *   - Prop predictions for this game
 *   - Recent player spotlights for key players
 *   - Recent POW/POM, TOTN/TOTW for either team
 *   - Recent game recaps between these teams
 */

import { supabase } from '../../../../utils/supabase'
import { filterFullGameProps } from '../../../../utils/playerPropsFilter'
import type {
  PostType,
  HeroContent,
  HeadlineContent,
  StatComparisonContent,
  InjuryCardContent,
  PropCardContent,
  PlayerHighlightContent,
  PostLinkContent,
  PullQuoteContent,
} from '../../../../types/feed'
import type { SectionDraft, GeneratorContext } from '../types'
import { nextSectionId, resetSectionIdCounter } from '../utils'

export async function generateUpcomingSections(ctx: GeneratorContext): Promise<SectionDraft[]> {
  const { draft, targetTeams, targetGameId } = ctx
  const targetDate = ctx.targetDate?.includes('T') ? ctx.targetDate.split('T')[0] : ctx.targetDate
  if (!targetTeams?.length || targetTeams.length < 2) return []

  resetSectionIdCounter()
  const sections: SectionDraft[] = []

  const away = targetTeams[0]
  const home = targetTeams[1]
  const matchupLabel = `${away} @ ${home}`

  // ─── Hero ─────────────────────────────────────────────────
  sections.push({
    id: nextSectionId(),
    section_type: 'hero',
    title: '',
    content: {
      image_url: '',
      gradient_overlay: true,
      badge: 'GAME PREVIEW',
      team_tricodes: [away, home],
      score_line: matchupLabel,
    } satisfies HeroContent,
    player_id: null,
    team_tricode: null,
  })

  // ─── Headline ─────────────────────────────────────────────
  sections.push({
    id: nextSectionId(),
    section_type: 'headline',
    title: '',
    content: {
      text: draft.title || matchupLabel,
      subtitle: draft.subtitle || targetDate || '',
    } satisfies HeadlineContent,
    player_id: null,
    team_tricode: null,
  })

  // ─── Team season stats (stat comparisons) ─────────────────
  const teamStats = await fetchTeamSeasonStats([away, home])
  if (teamStats.size === 2) {
    const awayStats = teamStats.get(away)!
    const homeStats = teamStats.get(home)!

    const comparisons: Array<{ label: string; awayVal: number; homeVal: number }> = [
      { label: 'PPG', awayVal: awayStats.ppg, homeVal: homeStats.ppg },
      { label: 'Record', awayVal: awayStats.wins, homeVal: homeStats.wins },
      { label: 'Off Rtg', awayVal: awayStats.offRtg, homeVal: homeStats.offRtg },
      { label: 'Def Rtg', awayVal: awayStats.defRtg, homeVal: homeStats.defRtg },
    ].filter(c => c.awayVal > 0 || c.homeVal > 0)

    for (const comp of comparisons) {
      sections.push({
        id: nextSectionId(),
        section_type: 'stat_comparison',
        title: comp.label,
        content: {
          title: comp.label,
          stat_name: comp.label,
          teams: [
            { tricode: away, value: Math.round(comp.awayVal * 10) / 10 },
            { tricode: home, value: Math.round(comp.homeVal * 10) / 10 },
          ],
          diff: Math.round((comp.homeVal - comp.awayVal) * 10) / 10,
        } satisfies StatComparisonContent,
        player_id: null,
        team_tricode: null,
      })
    }

    // Season record pull quote
    sections.push({
      id: nextSectionId(),
      section_type: 'pull_quote',
      title: '',
      content: {
        text: `${away} ${awayStats.wins}-${awayStats.losses} · ${home} ${homeStats.wins}-${homeStats.losses}`,
        attribution: '2025-26 Season',
        icon: 'chart',
      } satisfies PullQuoteContent,
      player_id: null,
      team_tricode: null,
    })
  }

  // ─── Injuries for both teams ──────────────────────────────
  const injuries = await fetchActiveInjuries([away, home])
  if (injuries.length > 0) {
    for (const inj of injuries.slice(0, 8)) {
      sections.push({
        id: nextSectionId(),
        section_type: 'injury_card',
        title: '',
        content: {
          player_id: inj.nba_player_id,
          player_name: inj.player_name,
          team_tricode: inj.team_abbreviation,
          status: inj.status,
          injury: inj.injury,
        } satisfies InjuryCardContent,
        player_id: inj.nba_player_id,
        team_tricode: inj.team_abbreviation,
      })
    }
  }

  // ─── Top prop predictions ─────────────────────────────────
  const topProps = await fetchTopProps(targetDate, targetGameId, [away, home])
  if (topProps.length > 0) {
    for (const prop of topProps.slice(0, 6)) {
      sections.push({
        id: nextSectionId(),
        section_type: 'prop_card',
        title: '',
        content: {
          player_id: prop.nba_player_id,
          player_name: prop.player_name,
          bet_type: prop.bet_type,
          line: prop.line,
          result: 'pending',
        } satisfies PropCardContent,
        player_id: prop.nba_player_id,
        team_tricode: prop.team_abbreviation || null,
      })
    }
  }

  // ─── Key players (top 3 per team by PPG) ──────────────────
  const keyPlayers = await fetchKeyPlayers([away, home])
  for (const kp of keyPlayers.slice(0, 6)) {
    sections.push({
      id: nextSectionId(),
      section_type: 'player_highlight',
      title: kp.name,
      content: {
        player_id: kp.nba_player_id,
        name: kp.name,
        team_tricode: kp.team_abbreviation,
        stats: { pts: kp.ppg, reb: kp.rpg, ast: kp.apg },
      } satisfies PlayerHighlightContent,
      player_id: kp.nba_player_id,
      team_tricode: kp.team_abbreviation,
    })
  }

  // ─── Related posts (post_link sections) ───────────────────
  const relatedPosts = await fetchRelatedPosts([away, home], targetDate)
  for (const rp of relatedPosts.slice(0, 8)) {
    sections.push({
      id: nextSectionId(),
      section_type: 'post_link',
      title: '',
      content: {
        post_id: rp.id,
        slug: rp.slug,
        title: rp.title,
        subtitle: rp.subtitle,
        preview_text: rp.subtitle ?? undefined,
        post_type: rp.post_type,
        cover_image_url: rp.cover_image_url,
        context: rp.context,
        game_date: rp.game_date,
        team_tricodes: rp.team_tricodes,
      } satisfies PostLinkContent,
      player_id: null,
      team_tricode: null,
    })
  }

  return sections
}

// ─── Data helpers ────────────────────────────────────────────

interface TeamSeasonStats {
  wins: number
  losses: number
  ppg: number
  offRtg: number
  defRtg: number
}

async function fetchTeamSeasonStats(teams: string[]): Promise<Map<string, TeamSeasonStats>> {
  const result = new Map<string, TeamSeasonStats>()

  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1
  const season = month >= 10
    ? `${year}-${(year + 1).toString().slice(-2)}`
    : `${year - 1}-${year.toString().slice(-2)}`

  const { data: standings } = await supabase
    .from('nba_standings')
    .select('team_abbreviation, wins, losses')
    .eq('season', season)
    .in('team_abbreviation', teams)

  for (const team of teams) {
    const s = standings?.find(r => r.team_abbreviation === team)

    // Fetch recent games for PPG
    const { data: recentGames } = await supabase
      .from('nba_games')
      .select('home_team_tricode, away_team_tricode, home_team_score, away_team_score')
      .or(`home_team_tricode.eq.${team},away_team_tricode.eq.${team}`)
      .eq('game_status', 3)
      .order('game_date', { ascending: false })
      .limit(20)

    let totalPts = 0
    if (recentGames?.length) {
      for (const g of recentGames) {
        totalPts += g.home_team_tricode === team
          ? (g.home_team_score || 0)
          : (g.away_team_score || 0)
      }
    }

    result.set(team, {
      wins: s?.wins || 0,
      losses: s?.losses || 0,
      ppg: recentGames?.length ? totalPts / recentGames.length : 0,
      offRtg: 0,
      defRtg: 0,
    })
  }

  return result
}

interface ActiveInjury {
  nba_player_id: number
  player_name: string
  team_abbreviation: string
  status: string
  injury: string
}

async function fetchActiveInjuries(teams: string[]): Promise<ActiveInjury[]> {
  // Query injuries and players separately (embedded joins can silently drop rows)
  const { data: rawInjuries } = await supabase
    .from('nba_injuries')
    .select('nba_player_id, injury_type, injury_description, injury_status')
    .eq('is_current', true)
    .in('injury_status', ['Out', 'Doubtful', 'Questionable', 'Day-to-Day'])
    .order('date_updated', { ascending: false })
    .limit(300)

  if (!rawInjuries?.length) return []

  const playerIds = Array.from(new Set(rawInjuries.map(i => i.nba_player_id).filter(Boolean)))
  const { data: players } = await supabase
    .from('nba_players')
    .select('nba_player_id, name, team_abbreviation')
    .in('nba_player_id', playerIds)

  const playerMap = new Map((players || []).map(p => [p.nba_player_id, p]))
  const teamSet = new Set(teams)
  const statusMap: Record<string, string> = {
    Out: 'OUT', Doubtful: 'DOUBTFUL', Questionable: 'QUESTIONABLE', 'Day-to-Day': 'DAY-TO-DAY',
  }
  const statusOrder: Record<string, number> = { OUT: 0, DOUBTFUL: 1, QUESTIONABLE: 2, 'DAY-TO-DAY': 3 }

  return rawInjuries
    .filter(d => {
      const p = playerMap.get(d.nba_player_id)
      return p && teamSet.has(p.team_abbreviation)
    })
    .map(d => {
      const p = playerMap.get(d.nba_player_id)!
      const injuryText = d.injury_type?.includes(' - ')
        ? d.injury_type.slice(d.injury_type.indexOf(' - ') + 3).trim()
        : d.injury_description || d.injury_type || 'Injury'
      return {
        nba_player_id: d.nba_player_id,
        player_name: p.name,
        team_abbreviation: p.team_abbreviation,
        status: statusMap[d.injury_status] || d.injury_status,
        injury: injuryText,
      }
    })
    .sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))
}

interface TopProp {
  nba_player_id: number
  player_name: string
  team_abbreviation: string | null
  bet_type: string
  line: number
}

async function fetchTopProps(
  targetDate: string | undefined,
  targetGameId: string | undefined,
  teams: string[]
): Promise<TopProp[]> {
  const nextDay = targetDate
    ? new Date(new Date(targetDate + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)
    : undefined

  let pgQuery = supabase
    .from('player_props_games')
    .select('id, nba_game_id')

  if (targetGameId) {
    pgQuery = pgQuery.eq('nba_game_id', targetGameId)
  } else if (targetDate) {
    pgQuery = pgQuery.in('game_date', [targetDate, ...(nextDay ? [nextDay] : [])])
    pgQuery = pgQuery.or(
      teams.map(t => `home_team_tricode.eq.${t},away_team_tricode.eq.${t}`).join(',')
    )
  }

  const { data: propsGames } = await pgQuery.limit(5)
  if (!propsGames?.length) return []

  const { data: rawProps } = await supabase
    .from('player_props')
    .select('nba_player_id, bet_type, line, bet_type_id, game_id, raw_odd_data')
    .in('game_id', propsGames.map(pg => pg.id))
    .order('line', { ascending: false })
    .limit(200)

  const fullGameProps = filterFullGameProps(rawProps || [])
  if (!fullGameProps.length) return []

  const playerIds = Array.from(new Set(fullGameProps.map(p => p.nba_player_id).filter(Boolean)))
  const { data: players } = await supabase
    .from('nba_players')
    .select('nba_player_id, name, team_abbreviation')
    .in('nba_player_id', playerIds)

  const playerMap = new Map((players || []).map(p => [p.nba_player_id, p]))

  // Pick top props: highest lines, points/rebounds/assists only
  const keyBets = new Set(['points', 'rebounds', 'assists'])
  const filtered = fullGameProps
    .filter(p => keyBets.has(p.bet_type))
    .sort((a, b) => (b.line ?? 0) - (a.line ?? 0))
    .slice(0, 6)

  return filtered.map(p => {
    const player = playerMap.get(p.nba_player_id)
    return {
      nba_player_id: p.nba_player_id,
      player_name: player?.name || `Player ${p.nba_player_id}`,
      team_abbreviation: player?.team_abbreviation || null,
      bet_type: p.bet_type,
      line: p.line ?? 0,
    }
  })
}

interface KeyPlayer {
  nba_player_id: number
  name: string
  team_abbreviation: string
  ppg: number
  rpg: number
  apg: number
}

async function fetchKeyPlayers(teams: string[]): Promise<KeyPlayer[]> {
  const allPlayers: KeyPlayer[] = []

  for (const team of teams) {
    const { data: players } = await supabase
      .from('nba_players')
      .select('nba_player_id, name, team_abbreviation')
      .eq('team_abbreviation', team)
      .eq('is_active', true)
      .limit(10)

    if (!players?.length) continue

    const nbaIds = players.map(p => p.nba_player_id).filter(Boolean)
    const { data: boxscores } = await supabase
      .from('nba_boxscores')
      .select('nba_player_id, pts, reb, ast')
      .in('nba_player_id', nbaIds)
      .gte('game_date', '2025-10-21')
      .gt('min', 0)

    const statsMap = new Map<number, { pts: number; reb: number; ast: number; gp: number }>()
    for (const box of boxscores || []) {
      const cur = statsMap.get(box.nba_player_id) || { pts: 0, reb: 0, ast: 0, gp: 0 }
      cur.pts += box.pts || 0
      cur.reb += box.reb || 0
      cur.ast += box.ast || 0
      cur.gp += 1
      statsMap.set(box.nba_player_id, cur)
    }

    const withStats = players
      .map(p => {
        const s = statsMap.get(p.nba_player_id)
        if (!s || s.gp === 0) return null
        return {
          nba_player_id: p.nba_player_id,
          name: p.name,
          team_abbreviation: p.team_abbreviation || team,
          ppg: Math.round((s.pts / s.gp) * 10) / 10,
          rpg: Math.round((s.reb / s.gp) * 10) / 10,
          apg: Math.round((s.ast / s.gp) * 10) / 10,
        }
      })
      .filter(Boolean) as KeyPlayer[]

    withStats.sort((a, b) => b.ppg - a.ppg)
    allPlayers.push(...withStats.slice(0, 3))
  }

  return allPlayers
}

interface RelatedPost {
  id: string
  slug: string
  title: string
  subtitle: string | null
  post_type: PostType
  cover_image_url: string | null
  game_date: string | null
  team_tricodes: string[] | null
  context: string
}

async function fetchRelatedPosts(teams: string[], targetDate?: string): Promise<RelatedPost[]> {
  const results: RelatedPost[] = []

  // Injury reports for these teams (last 3 days)
  const threeDaysAgo = targetDate
    ? new Date(new Date(targetDate + 'T00:00:00Z').getTime() - 3 * 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)

  const { data: injuryPosts } = await supabase
    .from('feed_posts')
    .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
    .eq('status', 'published')
    .eq('post_type', 'injury_report')
    .overlaps('team_tricodes', teams)
    .gte('published_at', threeDaysAgo)
    .order('published_at', { ascending: false })
    .limit(2)

  for (const p of injuryPosts || []) {
    results.push({ ...p, post_type: p.post_type as PostType, context: 'Injury Report' })
  }

  // Prop predictions for this game
  const { data: propPosts } = await supabase
    .from('feed_posts')
    .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
    .eq('status', 'published')
    .eq('post_type', 'prop_prediction')
    .overlaps('team_tricodes', teams)
    .gte('published_at', threeDaysAgo)
    .order('published_at', { ascending: false })
    .limit(2)

  for (const p of propPosts || []) {
    results.push({ ...p, post_type: p.post_type as PostType, context: 'Prop Predictions' })
  }

  // Recent POW/POM, TOTN/TOTW for these teams (last 14 days)
  const twoWeeksAgo = targetDate
    ? new Date(new Date(targetDate + 'T00:00:00Z').getTime() - 14 * 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)

  const { data: awardPosts } = await supabase
    .from('feed_posts')
    .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
    .eq('status', 'published')
    .in('post_type', ['team_of_night', 'team_of_week', 'player_of_week', 'player_of_month'])
    .overlaps('team_tricodes', teams)
    .gte('published_at', twoWeeksAgo)
    .order('published_at', { ascending: false })
    .limit(3)

  const contextMap: Record<string, string> = {
    team_of_night: 'Team of the Night',
    team_of_week: 'Team of the Week',
    player_of_week: 'Player of the Week',
    player_of_month: 'Player of the Month',
  }

  for (const p of awardPosts || []) {
    results.push({ ...p, post_type: p.post_type as PostType, context: contextMap[p.post_type] || 'Award' })
  }

  // Recent player spotlights for players on these teams (last 7 days)
  const oneWeekAgo = targetDate
    ? new Date(new Date(targetDate + 'T00:00:00Z').getTime() - 7 * 86400000).toISOString().slice(0, 10)
    : new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const { data: spotlightPosts } = await supabase
    .from('feed_posts')
    .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
    .eq('status', 'published')
    .eq('post_type', 'player_spotlight')
    .overlaps('team_tricodes', teams)
    .gte('published_at', oneWeekAgo)
    .order('published_at', { ascending: false })
    .limit(4)

  for (const p of spotlightPosts || []) {
    results.push({ ...p, post_type: p.post_type as PostType, context: 'Player Spotlight' })
  }

  // Recent game recaps between these teams (head-to-head)
  const { data: h2hPosts } = await supabase
    .from('feed_posts')
    .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
    .eq('status', 'published')
    .eq('post_type', 'game_recap')
    .contains('team_tricodes', teams)
    .order('published_at', { ascending: false })
    .limit(2)

  for (const p of h2hPosts || []) {
    results.push({ ...p, post_type: p.post_type as PostType, context: 'Previous Matchup' })
  }

  return results
}
