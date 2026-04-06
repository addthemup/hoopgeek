/**
 * Transient automation for game recap posts.
 *
 * Creates one `game_recap` feed post per game JSON in Storage and links:
 * - latest prop_results post for the same game_id
 * - player_spotlight posts for the same game_id
 * Duplicate recaps (same source_ref) refresh metadata and append a prop_results post_link
 * when prop_results is published later (e.g. morning job order / backfill).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { isDateInEST, getTodayEST, getYesterdayEST } from '../_shared/prop_prediction/nbaDateUtils.ts'
import {
  buildRecapRichSections,
  getScoreGameSlice,
  parseAggregatedTeamStatsByTricode,
  sanitizeAggregatedSnapshot,
} from '../_shared/recap/buildRecapRichSections.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NbaGameRow {
  game_id: string
  game_date: string
  home_team_tricode: string | null
  away_team_tricode: string | null
}

interface ParsedGameJson {
  gameId: string
  gameDate: string | null
  title: string
  finalScore: string
  teamTricodes: string[]
  playerIds: string[]
  story: Record<string, unknown>
  score: Record<string, unknown>
  homeTeam: Record<string, unknown>
  awayTeam: Record<string, unknown>
  allPlays: Array<Record<string, unknown>>
}

function storageObjectPath(prefix: string, gameId: string): string {
  const p = prefix.replace(/\/$/, '')
  return p ? `${p}/${gameId}.json` : `${gameId}.json`
}

function randomSlugSuffix(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 4)
}

function generateSlug(title: string, gameDate?: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
  const datePart = gameDate || new Date().toISOString().slice(0, 10)
  return `${base}-${datePart}-${randomSlugSuffix()}`
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
    .select('game_id, game_date, home_team_tricode, away_team_tricode')
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

function parseGameJson(raw: Record<string, unknown>): ParsedGameJson | null {
  const gameId = String(raw.gameId ?? '')
  if (!/^\d{10}$/.test(gameId)) return null

  const meta = (raw.gameMetadata ?? {}) as Record<string, unknown>
  const home = (meta.homeTeam ?? {}) as Record<string, unknown>
  const away = (meta.awayTeam ?? {}) as Record<string, unknown>
  const homeAbbr = String(home.abbreviation ?? '')
  const awayAbbr = String(away.abbreviation ?? '')
  if (!homeAbbr || !awayAbbr) return null

  const gameDateRaw = String(meta.date ?? '')
  const gameDate = gameDateRaw.includes('T') ? gameDateRaw.split('T')[0] : gameDateRaw || null

  const story = (raw.story ?? {}) as Record<string, unknown>
  const title =
    String(story.matchup ?? '').trim() ||
    `${String(away.city ?? '')} ${String(away.name ?? awayAbbr)} vs ${String(home.city ?? '')} ${String(home.name ?? homeAbbr)}`.trim()
  const finalScore =
    String(story.final_score ?? '').trim() ||
    `${awayAbbr} ${String(away.points ?? '—')} - ${homeAbbr} ${String(home.points ?? '—')}`

  const playerStats = Array.isArray(raw.PlayerStats) ? (raw.PlayerStats as Array<Record<string, unknown>>) : []
  const playerIds = playerStats
    .map((p) => String(p.personId ?? p.nba_player_id ?? p.player_id ?? ''))
    .filter((v) => /^\d+$/.test(v))

  const score = (raw.score ?? {}) as Record<string, unknown>
  const pbp = (raw.playByPlay ?? {}) as Record<string, unknown>
  const allPlays = Array.isArray(pbp.allPlays) ? (pbp.allPlays as Array<Record<string, unknown>>) : []

  return {
    gameId,
    gameDate,
    title,
    finalScore,
    teamTricodes: [awayAbbr, homeAbbr],
    playerIds: Array.from(new Set(playerIds)),
    story,
    score,
    homeTeam: home,
    awayTeam: away,
    allPlays,
  }
}

/** Remove all feed_posts (and cascading sections) for this `source_ref` — handles duplicates and avoids silent delete failures. */
async function deleteFeedPostsBySourceRef(
  supabase: ReturnType<typeof createClient>,
  sourceRef: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rows, error: selErr } = await supabase.from('feed_posts').select('id').eq('source_ref', sourceRef)
  if (selErr) return { ok: false, error: selErr.message }
  for (const row of rows ?? []) {
    const id = row.id as string
    const { error: delErr } = await supabase.from('feed_posts').delete().eq('id', id)
    if (delErr) return { ok: false, error: delErr.message }
  }
  return { ok: true }
}

function buildVideoCarouselSectionContent(allPlays: Array<Record<string, unknown>>, maxClips = 8): Record<string, unknown> | null {
  const clips = allPlays
    .filter((p) => !!p?.mp4 && String(p.mp4).length > 0)
    .slice(0, maxClips)
    .map((p) => ({
      mp4: p.mp4,
      description: p.description ?? '',
      action_type: p.actionType ?? p.subType ?? '',
      period: p.period ?? 0,
      clock: p.clock ?? '',
    }))
  if (clips.length === 0) return null
  return { clips }
}

interface LinkedPropResultsPost {
  id: string
  slug: string
  title: string
  subtitle: string | null
  post_type: string
  cover_image_url: string | null
  game_date: string | null
  team_tricodes: string[] | null
}

async function fetchLatestPropResultsByGame(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
): Promise<LinkedPropResultsPost | null> {
  const { data } = await supabase
    .from('feed_posts')
    .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
    .eq('status', 'published')
    .eq('post_type', 'prop_results')
    .eq('game_id', gameId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LinkedPropResultsPost) || null
}

function recapPostLinkTargetId(section: { section_type: string; content: unknown }): string | null {
  if (section.section_type !== 'post_link') return null
  const c = section.content as Record<string, unknown>
  const pid = c?.post_id
  return pid != null ? String(pid) : null
}

/**
 * Re-runs after recap exists: add prop_results post_link + metadata when prop_results lands later.
 */
async function syncGameRecapPropResultsLink(
  supabase: ReturnType<typeof createClient>,
  recapPostId: string,
  gameId: string,
): Promise<Record<string, unknown>> {
  const sourceRef = `game_recap:${gameId}`
  const propResultsPost = await fetchLatestPropResultsByGame(supabase, gameId)

  const { data: postRow } = await supabase.from('feed_posts').select('metadata').eq('id', recapPostId).maybeSingle()
  const meta =
    postRow?.metadata && typeof postRow.metadata === 'object' ? (postRow.metadata as Record<string, unknown>) : {}
  const nextMeta = {
    ...meta,
    linked_prop_results_post_id: propResultsPost?.id ?? null,
  }
  const { error: metaErr } = await supabase.from('feed_posts').update({ metadata: nextMeta }).eq('id', recapPostId)
  if (metaErr) return { game_id: gameId, error: `sync_metadata: ${metaErr.message}` }

  if (!propResultsPost) {
    return {
      game_id: gameId,
      skipped: true,
      reason: 'duplicate_source_ref',
      source_ref: sourceRef,
      sync_note: 'no_prop_results_yet',
    }
  }

  const { data: sections, error: secReadErr } = await supabase
    .from('feed_post_sections')
    .select('id, section_order, section_type, content')
    .eq('post_id', recapPostId)
    .order('section_order', { ascending: true })
  if (secReadErr) return { game_id: gameId, error: `sync_sections_read: ${secReadErr.message}` }

  const linkedIds = new Set(
    (sections || []).map((s) => recapPostLinkTargetId(s as { section_type: string; content: unknown })).filter(Boolean) as string[],
  )

  if (linkedIds.has(propResultsPost.id)) {
    return {
      game_id: gameId,
      synced_links: true,
      prop_results_linked: true,
      prop_results_section_existed: true,
    }
  }

  let maxOrder = -1
  for (const s of sections || []) {
    const o = Number(s.section_order)
    if (Number.isFinite(o) && o > maxOrder) maxOrder = o
  }

  const { error: insErr } = await supabase.from('feed_post_sections').insert({
    post_id: recapPostId,
    section_order: maxOrder + 1,
    section_type: 'post_link',
    title: '',
    content: {
      post_id: propResultsPost.id,
      slug: propResultsPost.slug,
      title: propResultsPost.title,
      subtitle: propResultsPost.subtitle,
      preview_text: propResultsPost.subtitle ?? undefined,
      post_type: propResultsPost.post_type,
      cover_image_url: propResultsPost.cover_image_url,
      context: 'Prop Results',
      game_date: propResultsPost.game_date,
      team_tricodes: propResultsPost.team_tricodes,
    },
    player_id: null,
    team_tricode: null,
  })
  if (insErr) return { game_id: gameId, error: `sync_sections_insert: ${insErr.message}` }

  return {
    game_id: gameId,
    synced_links: true,
    added_prop_results_section: true,
    prop_results_linked: true,
  }
}

async function processGame(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  targetDate: string,
  force: boolean,
  bucket: string,
  jsonPrefix: string,
): Promise<Record<string, unknown>> {
  const sourceRef = `game_recap:${gameId}`
  if (!force) {
    const { data: exists } = await supabase.from('feed_posts').select('id').eq('source_ref', sourceRef).maybeSingle()
    if (exists?.id) return await syncGameRecapPropResultsLink(supabase, exists.id, gameId)
  } else {
    const del = await deleteFeedPostsBySourceRef(supabase, sourceRef)
    if (!del.ok) return { game_id: gameId, error: `force rebuild delete: ${del.error}` }
  }

  const objectPath = storageObjectPath(jsonPrefix, gameId)
  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(objectPath)
  if (dlErr || !blob) return { game_id: gameId, deferred: true, reason: 'missing_game_json', object_path: objectPath, error: dlErr?.message }

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(await blob.text()) as Record<string, unknown>
  } catch {
    return { game_id: gameId, error: 'invalid_json' }
  }

  const parsed = parseGameJson(raw)
  if (!parsed) return { game_id: gameId, error: 'could_not_parse_game_json' }

  const awayTri = parsed.teamTricodes[0] ?? ''
  const homeTri = parsed.teamTricodes[1] ?? ''
  const { away: aggregatedAway, home: aggregatedHome } = parseAggregatedTeamStatsByTricode(raw, awayTri, homeTri)
  const scoreGame = getScoreGameSlice(parsed.score as Record<string, unknown>, gameId)
  const funScoreRaw = scoreGame?.fun_score
  const funScore =
    typeof funScoreRaw === 'number'
      ? funScoreRaw
      : funScoreRaw != null && String(funScoreRaw).length > 0
        ? Number(funScoreRaw)
        : null
  const funScoreNum = funScore != null && Number.isFinite(funScore) ? funScore : null

  const recapRichSections = buildRecapRichSections({
    awayTricode: awayTri,
    homeTricode: homeTri,
    finalScoreLine: parsed.finalScore,
    funScore: funScoreNum,
    scoreGame,
    aggregatedAway,
    aggregatedHome,
  })

  const gameDate = parsed.gameDate || targetDate
  const title = parsed.title
  const subtitle = parsed.finalScore || targetDate
  const slug = generateSlug(title, gameDate)

  const propResultsPost = await fetchLatestPropResultsByGame(supabase, gameId)

  const { data: spotlightPosts } = await supabase
    .from('feed_posts')
    .select('id, slug, title, subtitle, post_type, cover_image_url, game_date, team_tricodes')
    .eq('status', 'published')
    .eq('post_type', 'player_spotlight')
    .eq('game_id', gameId)
    .order('published_at', { ascending: false })
    .limit(12)

  const postRow = {
    post_type: 'game_recap',
    status: 'published',
    source_ref: sourceRef,
    title,
    subtitle,
    description: null,
    slug,
    cover_image_url: null,
    share_image_url: null,
    game_id: gameId,
    game_date: gameDate,
    team_tricodes: parsed.teamTricodes,
    player_ids: parsed.playerIds,
    person_id: null,
    metadata: {
      score: parsed.score,
      story: parsed.story,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      fun_score: (parsed.score?.[gameId] as Record<string, unknown> | undefined)?.fun_score ?? null,
      story_data: parsed.story,
      json_storage_path: objectPath,
      linked_prop_results_post_id: propResultsPost?.id ?? null,
      aggregated_team_stats: {
        away: sanitizeAggregatedSnapshot(aggregatedAway),
        home: sanitizeAggregatedSnapshot(aggregatedHome),
      },
    },
    tags: ['recap', 'highlights'],
    created_by: null,
    author_name: 'HoopGeek',
    published_at: new Date().toISOString(),
  }

  const { data: inserted, error: insErr } = await supabase.from('feed_posts').insert(postRow).select('id').maybeSingle()
  if (insErr) {
    if (insErr.code === '23505' || String(insErr.message).toLowerCase().includes('duplicate')) {
      return {
        game_id: gameId,
        skipped: true,
        reason: 'duplicate_key',
        detail: insErr.message,
        source_ref: sourceRef,
      }
    }
    return { game_id: gameId, error: insErr.message }
  }
  if (!inserted?.id) return { game_id: gameId, error: 'insert_returned_no_id' }

  const sectionRows: Array<Record<string, unknown>> = []

  sectionRows.push({
    post_id: inserted.id,
    section_order: sectionRows.length,
    section_type: 'hero',
    title: '',
    content: {
      image_url: '',
      gradient_overlay: true,
      badge: 'Game Recap',
      team_tricode: parsed.teamTricodes[0] ?? null,
      score_line: subtitle,
      team_tricodes: parsed.teamTricodes,
    },
    player_id: null,
    team_tricode: parsed.teamTricodes[0] ?? null,
  })

  sectionRows.push({
    post_id: inserted.id,
    section_order: sectionRows.length,
    section_type: 'headline',
    title: '',
    content: { text: title, subtitle },
    player_id: null,
    team_tricode: null,
  })

  for (const rs of recapRichSections) {
    sectionRows.push({
      post_id: inserted.id,
      section_order: sectionRows.length,
      section_type: rs.section_type,
      title: rs.title,
      content: rs.content,
      player_id: null,
      team_tricode: null,
    })
  }

  const videoCarousel = buildVideoCarouselSectionContent(parsed.allPlays, 8)
  if (videoCarousel) {
    sectionRows.push({
      post_id: inserted.id,
      section_order: sectionRows.length,
      section_type: 'video_carousel',
      title: 'Highlights',
      content: videoCarousel,
      player_id: null,
      team_tricode: null,
    })
  }

  if (propResultsPost?.id) {
    sectionRows.push({
      post_id: inserted.id,
      section_order: sectionRows.length,
      section_type: 'post_link',
      title: '',
      content: {
        post_id: propResultsPost.id,
        slug: propResultsPost.slug,
        title: propResultsPost.title,
        subtitle: propResultsPost.subtitle,
        preview_text: propResultsPost.subtitle ?? undefined,
        post_type: propResultsPost.post_type,
        cover_image_url: propResultsPost.cover_image_url,
        context: 'Prop Results',
        game_date: propResultsPost.game_date,
        team_tricodes: propResultsPost.team_tricodes,
      },
      player_id: null,
      team_tricode: null,
    })
  }

  for (const p of spotlightPosts || []) {
    sectionRows.push({
      post_id: inserted.id,
      section_order: sectionRows.length,
      section_type: 'post_link',
      title: '',
      content: {
        post_id: p.id,
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        preview_text: p.subtitle ?? undefined,
        post_type: p.post_type,
        cover_image_url: p.cover_image_url,
        context: 'Player Spotlight',
        game_date: p.game_date,
        team_tricodes: p.team_tricodes,
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
    spotlight_links: (spotlightPosts || []).length,
    prop_results_linked: !!propResultsPost?.id,
    json_storage_path: objectPath,
    recap_rich_sections: recapRichSections.length,
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
    const bucket = Deno.env.get('FEED_JSON_BUCKET') || 'game-data'
    const jsonPrefix = Deno.env.get('FEED_JSON_PREFIX') || ''
    const supabase = createClient(supabaseUrl, serviceKey)

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message:
            'POST {"date":"2026-03-23"} for all games on a slate. Optional: {"game_id":"0022501037"}, {"force":true} to replace existing recap (delete + reinsert). See README.md.',
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

    let body: { date?: string; game_id?: string; force?: boolean; trigger?: string } = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const force = body.force === true
    const gameIdArg = body.game_id && /^\d{10}$/.test(body.game_id) ? body.game_id : null
    const targetDate =
      body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : body.trigger === 'cron_scheduled'
          ? getYesterdayEST()
          : getTodayEST()

    if (gameIdArg) {
      const result = await processGame(supabase, gameIdArg, targetDate, force, bucket, jsonPrefix)
      return new Response(JSON.stringify({ date: targetDate, ...result }, null, 2), {
        status: typeof result.error === 'string' ? 500 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const games = await fetchGamesForDate(supabase, targetDate)
    const results: Record<string, unknown>[] = []
    for (const g of games) {
      const r = await processGame(supabase, g.game_id, targetDate, force, bucket, jsonPrefix)
      results.push(r)
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

