/**
 * Transient automation for "upcoming" feed posts.
 *
 * Goal: reliably create upcoming posts for a full slate date with rich-enough data
 * and explicit links to the same game's injury_report + prop_prediction posts.
 * If the post already exists (duplicate source_ref), refreshes metadata and appends any
 * missing post_link sections when those related posts appear later (hourly cron).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { isDateInEST, getTodayEST } from '../_shared/prop_prediction/nbaDateUtils.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NbaGameRow {
  game_id: string
  game_date: string
  home_team_tricode: string | null
  away_team_tricode: string | null
  home_team_name?: string | null
  away_team_name?: string | null
  game_time_et?: string | null
}

/** Card row for post_link sections + metadata cross-links */
interface LinkedFeedPost {
  id: string
  slug: string
  title: string
  subtitle: string | null
  post_type: string
  cover_image_url: string | null
  game_date: string | null
  team_tricodes: string[] | null
}

async function fetchLatestPublishedByGame(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  postType: 'injury_report' | 'prop_prediction',
): Promise<LinkedFeedPost | null> {
  const { data } = await supabase
    .from('feed_posts')
    .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
    .eq('status', 'published')
    .eq('post_type', postType)
    .eq('game_id', gameId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LinkedFeedPost) || null
}

function postLinkTargetId(section: { section_type: string; content: unknown }): string | null {
  if (section.section_type !== 'post_link') return null
  const c = section.content as Record<string, unknown>
  const pid = c?.post_id
  return pid != null ? String(pid) : null
}

function addCalendarDayYMD(ymd: string): string {
  const parts = ymd.split('-').map((x) => parseInt(x, 10))
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return ymd
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function moneylineToApproxSpread(homeMl: number, awayMl: number): { homeSpread: number; awaySpread: number } | null {
  const mlToImplied = (american: number) =>
    american >= 0 ? 100 / (100 + american) : Math.abs(american) / (Math.abs(american) + 100)
  const homeImplied = mlToImplied(homeMl)
  const awayImplied = mlToImplied(awayMl)
  const sum = homeImplied + awayImplied
  if (sum < 0.01) return null
  const homeFair = homeImplied / sum
  const diff = homeFair - 0.5
  const spreadHalf = Math.max(-15, Math.min(15, diff * 24))
  const homeSpread = Math.round(spreadHalf * 2) / 2
  const awaySpread = Math.round(-spreadHalf * 2) / 2
  return { homeSpread, awaySpread }
}

function parseSpreadsFromRawEventData(raw: Record<string, unknown>): { homeSpread: number; awaySpread: number } | null {
  let homeSpread: number | null = null
  let awaySpread: number | null = null
  const odds = raw.odds as Record<string, Record<string, unknown>> | undefined
  if (odds) {
    for (const [key, odd] of Object.entries(odds)) {
      if (!odd || typeof odd !== 'object') continue
      const side = String((odd as { sideID?: string }).sideID || '')
      const marketName = String((odd as { marketName?: string }).marketName || '').toLowerCase()
      const betType = String((odd as { betTypeID?: string }).betTypeID || '').toLowerCase()
      const keyLower = (key || '').toLowerCase()
      const isSpread = marketName.includes('spread') || betType === 'spread' || keyLower.includes('spread')
      if (isSpread) {
        let spreadNum = NaN
        if ((odd as { bookSpread?: unknown }).bookSpread != null) {
          spreadNum = Number((odd as { bookSpread?: unknown }).bookSpread)
        } else if ((odd as { openBookSpread?: unknown }).openBookSpread != null) {
          spreadNum = Number((odd as { openBookSpread?: unknown }).openBookSpread)
        } else if ((odd as { bookOdds?: unknown }).bookOdds != null) {
          spreadNum = parseFloat(String((odd as { bookOdds?: unknown }).bookOdds).replace(/[^0-9.-]/g, ''))
        }
        if (!Number.isNaN(spreadNum)) {
          if (side === 'home') homeSpread = spreadNum
          else if (side === 'away') awaySpread = spreadNum
        }
      }
    }
    if (homeSpread != null && awaySpread == null) awaySpread = -homeSpread
    if (awaySpread != null && homeSpread == null) homeSpread = -awaySpread
  }
  if (homeSpread == null && awaySpread == null && odds) {
    const homeMl =
      (odds['points-home-game-ml-home'] as { bookOdds?: unknown } | undefined)?.bookOdds ??
      (odds['points-home-game-ml-home'] as { openBookOdds?: unknown } | undefined)?.openBookOdds
    const awayMl =
      (odds['points-away-game-ml-away'] as { bookOdds?: unknown } | undefined)?.bookOdds ??
      (odds['points-away-game-ml-away'] as { openBookOdds?: unknown } | undefined)?.openBookOdds
    const homeMlNum = homeMl != null ? parseFloat(String(homeMl).replace(/[^0-9.-]/g, '')) : NaN
    const awayMlNum = awayMl != null ? parseFloat(String(awayMl).replace(/[^0-9.-]/g, '')) : NaN
    if (!Number.isNaN(homeMlNum) && !Number.isNaN(awayMlNum)) {
      const derived = moneylineToApproxSpread(homeMlNum, awayMlNum)
      if (derived) {
        homeSpread = derived.homeSpread
        awaySpread = derived.awaySpread
      }
    }
  }
  if (homeSpread == null && awaySpread == null) return null
  const home = homeSpread ?? -awaySpread!
  const away = awaySpread ?? -homeSpread!
  return { homeSpread: home, awaySpread: away }
}

async function fetchSpreadMetadataForGame(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  targetDate: string,
  awayTricode: string,
  homeTricode: string,
  awayName?: string | null,
  homeName?: string | null,
): Promise<{ home_spread: number | null; away_spread: number | null }> {
  const nextDay = addCalendarDayYMD(targetDate)
  const { data: ppgRows, error } = await supabase
    .from('player_props_games')
    .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, raw_event_data')
    .in('game_date', [targetDate, nextDay])
  if (error || !ppgRows?.length) return { home_spread: null, away_spread: null }

  const normalizeName = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ')
  const gAway = awayTricode.trim().toUpperCase()
  const gHome = homeTricode.trim().toUpperCase()

  for (const pg of ppgRows as Array<Record<string, unknown>>) {
    let raw = pg.raw_event_data
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw) as Record<string, unknown>
      } catch {
        continue
      }
    }
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const teams = r.teams as
      | { home?: { names?: { short?: string } }; away?: { names?: { short?: string } } }
      | undefined
    const pgHomeTricode = String(teams?.home?.names?.short || pg.home_team_tricode || '').trim().toUpperCase()
    const pgAwayTricode = String(teams?.away?.names?.short || pg.away_team_tricode || '').trim().toUpperCase()

    const matchById = pg.nba_game_id === gameId
    const matchByTri =
      !!pgHomeTricode &&
      !!pgAwayTricode &&
      ((pgHomeTricode === gHome && pgAwayTricode === gAway) || (pgHomeTricode === gAway && pgAwayTricode === gHome))
    const pgHomeN = normalizeName(String(pg.home_team || ''))
    const pgAwayN = normalizeName(String(pg.away_team || ''))
    const gnHome = normalizeName(String(homeName || ''))
    const gnAway = normalizeName(String(awayName || ''))
    const matchByName =
      !!pgHomeN &&
      !!pgAwayN &&
      !!gnHome &&
      !!gnAway &&
      ((pgHomeN === gnHome && pgAwayN === gnAway) || (pgHomeN === gnAway && pgAwayN === gnHome))

    if (!matchById && !matchByTri && !matchByName) continue

    const spreads = parseSpreadsFromRawEventData(r)
    if (spreads) return { home_spread: spreads.homeSpread, away_spread: spreads.awaySpread }
  }
  return { home_spread: null, away_spread: null }
}

/**
 * Hourly re-runs hit duplicate source_ref — refresh metadata + append post_link rows when
 * prop_prediction / injury_report were created after the first upcoming pass.
 */
async function syncUpcomingPostLinks(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  gameId: string,
): Promise<Record<string, unknown>> {
  const injuryPost = await fetchLatestPublishedByGame(supabase, gameId, 'injury_report')
  const propPredictionPost = await fetchLatestPublishedByGame(supabase, gameId, 'prop_prediction')

  const { data: postRow } = await supabase
    .from('feed_posts')
    .select('metadata, game_date, team_tricodes')
    .eq('id', postId)
    .maybeSingle()
  const meta =
    postRow?.metadata && typeof postRow.metadata === 'object' ? (postRow.metadata as Record<string, unknown>) : {}
  const tri = (postRow?.team_tricodes as string[] | null) ?? null
  const gd =
    postRow?.game_date != null
      ? String(postRow.game_date).includes('T')
        ? String(postRow.game_date).split('T')[0]
        : String(postRow.game_date).slice(0, 10)
      : ''
  let home_spread: number | null = null
  let away_spread: number | null = null
  let game_time_et: string | null = null
  if (tri && tri.length >= 2 && gd.length === 10) {
    const sm = await fetchSpreadMetadataForGame(supabase, gameId, gd, tri[0], tri[1], null, null)
    home_spread = sm.home_spread
    away_spread = sm.away_spread
  }
  const { data: nbaRow } = await supabase.from('nba_games').select('game_time_et').eq('game_id', gameId).maybeSingle()
  if (nbaRow?.game_time_et != null && String(nbaRow.game_time_et).trim()) {
    game_time_et = String(nbaRow.game_time_et).trim()
  }
  const nextMeta = {
    ...meta,
    linked_injury_post_id: injuryPost?.id ?? null,
    linked_prop_prediction_post_id: propPredictionPost?.id ?? null,
    home_spread,
    away_spread,
    ...(game_time_et ? { game_time_et } : {}),
  }
  const { error: metaErr } = await supabase.from('feed_posts').update({ metadata: nextMeta }).eq('id', postId)
  if (metaErr) return { game_id: gameId, error: `sync_metadata: ${metaErr.message}` }

  const { data: sections, error: secReadErr } = await supabase
    .from('feed_post_sections')
    .select('id, section_order, section_type, content')
    .eq('post_id', postId)
    .order('section_order', { ascending: true })
  if (secReadErr) return { game_id: gameId, error: `sync_sections_read: ${secReadErr.message}` }

  const linkedPostIds = new Set(
    (sections || []).map((s) => postLinkTargetId(s as { section_type: string; content: unknown })).filter(Boolean) as string[],
  )

  let maxOrder = -1
  for (const s of sections || []) {
    const o = Number(s.section_order)
    if (Number.isFinite(o) && o > maxOrder) maxOrder = o
  }

  const newSections: Array<Record<string, unknown>> = []

  if (propPredictionPost && !linkedPostIds.has(propPredictionPost.id)) {
    maxOrder += 1
    newSections.push({
      post_id: postId,
      section_order: maxOrder,
      section_type: 'post_link',
      title: '',
      content: {
        post_id: propPredictionPost.id,
        slug: propPredictionPost.slug,
        title: propPredictionPost.title,
        subtitle: propPredictionPost.subtitle,
        preview_text: propPredictionPost.subtitle ?? undefined,
        post_type: propPredictionPost.post_type,
        cover_image_url: propPredictionPost.cover_image_url,
        context: 'Prop Predictions',
        game_date: propPredictionPost.game_date,
        team_tricodes: propPredictionPost.team_tricodes,
      },
      player_id: null,
      team_tricode: null,
    })
  }

  if (injuryPost && !linkedPostIds.has(injuryPost.id)) {
    maxOrder += 1
    newSections.push({
      post_id: postId,
      section_order: maxOrder,
      section_type: 'post_link',
      title: '',
      content: {
        post_id: injuryPost.id,
        slug: injuryPost.slug,
        title: injuryPost.title,
        subtitle: injuryPost.subtitle,
        preview_text: injuryPost.subtitle ?? undefined,
        post_type: injuryPost.post_type,
        cover_image_url: injuryPost.cover_image_url,
        context: 'Injury Report',
        game_date: injuryPost.game_date,
        team_tricodes: injuryPost.team_tricodes,
      },
      player_id: null,
      team_tricode: null,
    })
  }

  if (newSections.length > 0) {
    const { error: insErr } = await supabase.from('feed_post_sections').insert(newSections)
    if (insErr) return { game_id: gameId, error: `sync_sections_insert: ${insErr.message}` }
  }

  return {
    game_id: gameId,
    synced_links: true,
    added_sections: newSections.length,
    prop_predictions_linked: !!propPredictionPost?.id,
    injury_report_linked: !!injuryPost?.id,
  }
}

function generateSlug(title: string, gameDate?: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
  const datePart = gameDate || new Date().toISOString().slice(0, 10)
  const random = Math.random().toString(36).slice(2, 6)
  return `${base}-${datePart}-${random}`
}

async function fetchGamesForDate(
  supabase: ReturnType<typeof createClient>,
  gameDate: string,
): Promise<NbaGameRow[]> {
  const date = new Date(`${gameDate}T00:00:00Z`)
  const startUTC = new Date(date.getTime() - 6 * 60 * 60 * 1000).toISOString()
  const endUTC = new Date(date.getTime() + 30 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name, game_time_et')
    .gte('game_date', startUTC)
    .lte('game_date', endUTC)
    .not('home_team_tricode', 'is', null)
    .not('away_team_tricode', 'is', null)
    .order('game_date', { ascending: true })
    .order('game_id')

  if (error || !data) return []
  return (data as NbaGameRow[]).filter(
    (g) =>
      isDateInEST(g.game_date, gameDate) &&
      g.home_team_tricode &&
      g.away_team_tricode &&
      g.home_team_tricode !== g.away_team_tricode,
  )
}

async function fetchInjuriesForTeams(
  supabase: ReturnType<typeof createClient>,
  teams: string[],
): Promise<Array<{ nba_player_id: number; player_name: string; team_abbreviation: string; status: string; injury: string }>> {
  const { data: rawInjuries } = await supabase
    .from('nba_injuries')
    .select('nba_player_id, injury_type, injury_description, injury_status')
    .eq('is_current', true)
    .in('injury_status', ['Out', 'Doubtful', 'Questionable', 'Day-to-Day'])
    .order('date_updated', { ascending: false })
    .limit(300)
  if (!rawInjuries?.length) return []

  const playerIds = Array.from(new Set(rawInjuries.map((i) => i.nba_player_id).filter(Boolean)))
  const { data: players } = await supabase
    .from('nba_players')
    .select('nba_player_id, name, team_abbreviation')
    .in('nba_player_id', playerIds)

  const playerMap = new Map((players || []).map((p) => [p.nba_player_id, p]))
  const teamSet = new Set(teams)
  const statusMap: Record<string, string> = {
    Out: 'OUT',
    Doubtful: 'DOUBTFUL',
    Questionable: 'QUESTIONABLE',
    'Day-to-Day': 'DAY-TO-DAY',
  }

  return rawInjuries
    .filter((row) => {
      const p = playerMap.get(row.nba_player_id)
      return p && teamSet.has(p.team_abbreviation)
    })
    .map((row) => {
      const p = playerMap.get(row.nba_player_id)!
      const injuryText = row.injury_type?.includes(' - ')
        ? row.injury_type.slice(row.injury_type.indexOf(' - ') + 3).trim()
        : row.injury_description || row.injury_type || 'Injury'
      return {
        nba_player_id: row.nba_player_id,
        player_name: p.name,
        team_abbreviation: p.team_abbreviation,
        status: statusMap[row.injury_status] || row.injury_status,
        injury: injuryText,
      }
    })
    .slice(0, 8)
}

async function fetchTopPlayersForTeams(
  supabase: ReturnType<typeof createClient>,
  teams: string[],
): Promise<Array<{ nba_player_id: number; name: string; team_abbreviation: string; ppg: number; rpg: number; apg: number }>> {
  const results: Array<{ nba_player_id: number; name: string; team_abbreviation: string; ppg: number; rpg: number; apg: number }> = []

  for (const team of teams) {
    const { data: players } = await supabase
      .from('nba_players')
      .select('nba_player_id, name, team_abbreviation')
      .eq('team_abbreviation', team)
      .eq('is_active', true)
      .limit(12)
    if (!players?.length) continue

    const ids = players.map((p) => p.nba_player_id).filter(Boolean)
    const { data: box } = await supabase
      .from('nba_boxscores')
      .select('nba_player_id, pts, reb, ast, min')
      .in('nba_player_id', ids)
      .gte('game_date', '2025-10-21')

    const agg = new Map<number, { pts: number; reb: number; ast: number; gp: number }>()
    for (const row of box || []) {
      const cur = agg.get(row.nba_player_id) || { pts: 0, reb: 0, ast: 0, gp: 0 }
      cur.pts += Number(row.pts || 0)
      cur.reb += Number(row.reb || 0)
      cur.ast += Number(row.ast || 0)
      cur.gp += 1
      agg.set(row.nba_player_id, cur)
    }

    const teamLeaders = players
      .map((p) => {
        const s = agg.get(p.nba_player_id)
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
      .filter(Boolean) as Array<{ nba_player_id: number; name: string; team_abbreviation: string; ppg: number; rpg: number; apg: number }>

    teamLeaders.sort((a, b) => b.ppg - a.ppg)
    results.push(...teamLeaders.slice(0, 3))
  }

  return results.slice(0, 6)
}

async function processGame(
  supabase: ReturnType<typeof createClient>,
  game: NbaGameRow,
  targetDate: string,
  force: boolean,
): Promise<Record<string, unknown>> {
  const gameId = game.game_id
  const away = game.away_team_tricode ?? ''
  const home = game.home_team_tricode ?? ''
  const sourceRef = `upcoming:${gameId}`

  if (!away || !home) return { game_id: gameId, error: 'missing_team_tricodes' }

  if (!force) {
    const { data: existing } = await supabase.from('feed_posts').select('id').eq('source_ref', sourceRef).maybeSingle()
    if (existing?.id) return await syncUpcomingPostLinks(supabase, existing.id, gameId)
  }

  const gameDateClean = game.game_date?.includes('T') ? game.game_date.split('T')[0] : game.game_date
  const title = `${game.away_team_name || away} vs ${game.home_team_name || home}`
  const subtitle = `${away} @ ${home} • ${targetDate}`
  const slug = generateSlug(title, targetDate)

  const injuries = await fetchInjuriesForTeams(supabase, [away, home])
  const topPlayers = await fetchTopPlayersForTeams(supabase, [away, home])

  const injuryPost = await fetchLatestPublishedByGame(supabase, gameId, 'injury_report')
  const propPredictionPost = await fetchLatestPublishedByGame(supabase, gameId, 'prop_prediction')

  const spreadMeta = await fetchSpreadMetadataForGame(
    supabase,
    gameId,
    targetDate,
    away,
    home,
    game.away_team_name,
    game.home_team_name,
  )
  const gameTimeEt =
    game.game_time_et != null && String(game.game_time_et).trim() ? String(game.game_time_et).trim() : null

  const postRow = {
    post_type: 'upcoming',
    status: 'published',
    title,
    subtitle,
    description: `Game preview for ${away} @ ${home} on ${targetDate}.`,
    slug,
    cover_image_url: null,
    share_image_url: null,
    game_id: gameId,
    game_date: gameDateClean || targetDate,
    team_tricodes: [away, home],
    player_ids: topPlayers.map((p) => String(p.nba_player_id)),
    person_id: null,
    tags: ['recap', 'analysis'],
    metadata: {
      matchup: `${away} @ ${home}`,
      linked_injury_post_id: injuryPost?.id ?? null,
      linked_prop_prediction_post_id: propPredictionPost?.id ?? null,
      home_spread: spreadMeta.home_spread,
      away_spread: spreadMeta.away_spread,
      ...(gameTimeEt ? { game_time_et: gameTimeEt } : {}),
    },
    source_ref: sourceRef,
    created_by: null,
    author_name: 'HoopGeek',
    published_at: new Date().toISOString(),
  }

  const { data: inserted, error: insErr } = await supabase.from('feed_posts').insert(postRow).select('id').maybeSingle()
  if (insErr) {
    if (insErr.code === '23505' || String(insErr.message).toLowerCase().includes('duplicate')) {
      return { game_id: gameId, skipped: true, reason: 'duplicate_source_ref', source_ref: sourceRef }
    }
    return { game_id: gameId, error: insErr.message }
  }
  if (!inserted?.id) return { game_id: gameId, error: 'insert_returned_no_id' }

  const sectionRows: Array<Record<string, unknown>> = [
    {
      post_id: inserted.id,
      section_order: 0,
      section_type: 'hero',
      title: '',
      content: {
        image_url: '',
        gradient_overlay: true,
        badge: 'GAME PREVIEW',
        team_tricodes: [away, home],
        score_line: `${away} @ ${home}`,
      },
      player_id: null,
      team_tricode: null,
    },
    {
      post_id: inserted.id,
      section_order: 1,
      section_type: 'headline',
      title: '',
      content: { text: title, subtitle },
      player_id: null,
      team_tricode: null,
    },
  ]

  // Injury cards
  for (const inj of injuries) {
    sectionRows.push({
      post_id: inserted.id,
      section_order: sectionRows.length,
      section_type: 'injury_card',
      title: '',
      content: {
        player_id: inj.nba_player_id,
        player_name: inj.player_name,
        team_tricode: inj.team_abbreviation,
        status: inj.status,
        injury: inj.injury,
      },
      player_id: inj.nba_player_id,
      team_tricode: inj.team_abbreviation,
    })
  }

  // Key players
  for (const p of topPlayers) {
    sectionRows.push({
      post_id: inserted.id,
      section_order: sectionRows.length,
      section_type: 'player_highlight',
      title: p.name,
      content: {
        player_id: p.nba_player_id,
        name: p.name,
        team_tricode: p.team_abbreviation,
        stats: { pts: p.ppg, reb: p.rpg, ast: p.apg },
      },
      player_id: p.nba_player_id,
      team_tricode: p.team_abbreviation,
    })
  }

  // Required post links
  if (propPredictionPost?.id) {
    sectionRows.push({
      post_id: inserted.id,
      section_order: sectionRows.length,
      section_type: 'post_link',
      title: '',
      content: {
        post_id: propPredictionPost.id,
        slug: propPredictionPost.slug,
        title: propPredictionPost.title,
        subtitle: propPredictionPost.subtitle,
        preview_text: propPredictionPost.subtitle ?? undefined,
        post_type: propPredictionPost.post_type,
        cover_image_url: propPredictionPost.cover_image_url,
        context: 'Prop Predictions',
        game_date: propPredictionPost.game_date,
        team_tricodes: propPredictionPost.team_tricodes,
      },
      player_id: null,
      team_tricode: null,
    })
  }

  if (injuryPost?.id) {
    sectionRows.push({
      post_id: inserted.id,
      section_order: sectionRows.length,
      section_type: 'post_link',
      title: '',
      content: {
        post_id: injuryPost.id,
        slug: injuryPost.slug,
        title: injuryPost.title,
        subtitle: injuryPost.subtitle,
        preview_text: injuryPost.subtitle ?? undefined,
        post_type: injuryPost.post_type,
        cover_image_url: injuryPost.cover_image_url,
        context: 'Injury Report',
        game_date: injuryPost.game_date,
        team_tricodes: injuryPost.team_tricodes,
      },
      player_id: null,
      team_tricode: null,
    })
  }

  const { error: secErr } = await supabase.from('feed_post_sections').insert(sectionRows)
  if (secErr) {
    await supabase.from('feed_posts').delete().eq('id', inserted.id)
    return { game_id: gameId, error: `sections: ${secErr.message}` }
  }

  return {
    game_id: gameId,
    created: true,
    post_id: inserted.id,
    source_ref: sourceRef,
    slug,
    injuries_added: injuries.length,
    key_players_added: topPlayers.length,
    prop_predictions_linked: !!propPredictionPost?.id,
    injury_report_linked: !!injuryPost?.id,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message:
            'POST {"date":"2026-03-24"} for full slate. Optional {"game_id":"0022501047"} and {"force":true}. Duplicate upcoming rows are link-synced (prop_prediction + injury_report) on each run.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body: { date?: string; game_id?: string; force?: boolean } = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const targetDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : getTodayEST()
    const gameIdArg = body.game_id && /^\d{10}$/.test(body.game_id) ? body.game_id : null
    const force = body.force === true

    if (gameIdArg) {
      const { data: game } = await supabase
        .from('nba_games')
        .select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name')
        .eq('game_id', gameIdArg)
        .maybeSingle()
      if (!game) {
        return new Response(JSON.stringify({ error: 'game_id not found', game_id: gameIdArg }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const result = await processGame(supabase, game as NbaGameRow, targetDate, force)
      return new Response(JSON.stringify({ date: targetDate, ...result }, null, 2), {
        status: typeof result.error === 'string' ? 500 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const games = await fetchGamesForDate(supabase, targetDate)
    const results: Record<string, unknown>[] = []
    for (const g of games) {
      results.push(await processGame(supabase, g, targetDate, force))
    }

    return new Response(
      JSON.stringify(
        {
          date: targetDate,
          games_on_slate: games.length,
          results,
          summary: {
            created: results.filter((x) => x.created === true).length,
            synced_links: results.filter((x) => x.synced_links === true).length,
            deferred: results.filter((x) => x.deferred === true).length,
            skipped: results.filter((x) => x.skipped === true).length,
            errors: results.filter((x) => typeof x.error === 'string').length,
          },
        },
        null,
        2,
      ),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

