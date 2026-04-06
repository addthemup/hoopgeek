/**
 * Player of the Month — one feed post per nba_pom row. source_ref: player_of_month:{YYYY-MM-01}:{conference}
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { resolvePlayerFromAwardRow } from '../_shared/awards/resolveAwardPlayer.ts'
import { fetchPlayerGameLog } from '../_shared/awards/fetchPlayerGameLog.ts'
import { fetchGamesForDateRange } from '../_shared/awards/fetchGamesForDateRange.ts'
import { loadGameJsonsForIds } from '../_shared/awards/loadGameJsonsFromStorage.ts'
import { buildPlayerAwardSnapshot } from '../_shared/awards/buildPlayerAwardSnapshot.ts'
import type { GameData } from '../_shared/awards/gameDataFromRaw.ts'
import { isSlateAutomationDone, markSlateAutomationDone } from '../_shared/feed/slateCheckpoint.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateSourceRef(
  postType: string,
  gameId: string | undefined,
  gameDate: string | undefined,
  disambiguator?: string | number | null,
): string {
  const base = gameId ? `${postType}:${gameId}` : gameDate ? `${postType}:${gameDate}` : `${postType}:${Date.now()}`
  if (disambiguator != null && disambiguator !== '') {
    const safe = String(disambiguator).toLowerCase().replace(/[^a-z0-9_-]/g, '_')
    return `${base}:${safe}`
  }
  return base
}

function generateSlug(title: string, gameDate?: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const datePart = gameDate || new Date().toISOString().slice(0, 10)
  const random = Math.random().toString(36).slice(2, 6)
  return `${base}${datePart ? '-' + datePart : ''}-${random}`
}

function filterRelevantGames(loaded: GameData[], nbaPlayerId: number): GameData[] {
  return loaded.filter((gd) => {
    const hasInStats = gd.playerStats?.some((ps) => Number((ps as Record<string, unknown>).personId) === nbaPlayerId)
    const hasInPbp = (gd.playByPlay || []).some((p) => p.personId != null && Number(p.personId) === nbaPlayerId)
    return hasInStats || hasInPbp
  })
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
    const bucket = Deno.env.get('FEED_GAME_DATA_BUCKET') ?? 'game-data'
    const prefix = (Deno.env.get('FEED_JSON_PREFIX') ?? '').replace(/\/$/, '')

    let body: { award_year?: number; award_month?: number; force?: boolean; clip_count?: number } = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    const force = body.force === true
    const clipsPerPlayer =
      typeof body.clip_count === 'number' ? Math.min(10, Math.max(0, body.clip_count)) : 3

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message: 'POST JSON: optional award_year, award_month; omit for latest period in nba_pom. Optional force, clip_count.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let awardYear: number | null = typeof body.award_year === 'number' ? body.award_year : null
    let awardMonth: number | null = typeof body.award_month === 'number' ? body.award_month : null

    if (awardYear == null || awardMonth == null) {
      const { data: latest } = await supabase
        .from('nba_pom')
        .select('award_year, award_month')
        .order('award_year', { ascending: false })
        .order('award_month', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (latest) {
        awardYear = Number(latest.award_year)
        awardMonth = Number(latest.award_month)
      }
    }

    if (awardYear == null || awardMonth == null || awardMonth < 1 || awardMonth > 12) {
      return new Response(JSON.stringify({ deferred: true, reason: 'no_pom_period', message: 'nba_pom has no rows or invalid period.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: pomRows, error: pomErr } = await supabase.from('nba_pom').select('*').eq('award_year', awardYear).eq('award_month', awardMonth)
    if (pomErr) throw new Error(pomErr.message)
    const rows = (pomRows || []) as Record<string, unknown>[]
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ deferred: true, reason: 'no_pom_rows', award_year: awardYear, award_month: awardMonth }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const year = awardYear
    const month = awardMonth
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })
    const periodLabel = `${monthName} ${year}`

    const created: { post_id: string; source_ref: string; conference: string | null }[] = []
    const skipped: { source_ref: string; reason: string }[] = []
    const errors: { conference: string | null; message: string }[] = []

    for (const row of rows) {
      const conference = row.conference != null ? String(row.conference) : null

      const player = await resolvePlayerFromAwardRow(supabase, row)
      if (!player?.nba_player_id) {
        errors.push({ conference, message: 'resolve_player_failed' })
        continue
      }

      const disambiguator =
        conference ||
        (player.nba_player_id != null ? String(player.nba_player_id) : String(row.id ?? ''))
      const sourceRef = generateSourceRef('player_of_month', undefined, monthStart, disambiguator)

      if (!force) {
        if (await isSlateAutomationDone(supabase, sourceRef)) {
          skipped.push({ source_ref: sourceRef, reason: 'slate_automation_done' })
          continue
        }
        const { data: existing } = await supabase.from('feed_posts').select('id').eq('source_ref', sourceRef).maybeSingle()
        if (existing?.id) {
          skipped.push({ source_ref: sourceRef, reason: 'duplicate_source_ref' })
          continue
        }
      }

      const teamTricode = player.team_abbreviation ? [player.team_abbreviation] : []
      const awardGameLog = await fetchPlayerGameLog(supabase, player.nba_player_id, monthStart, monthEnd)

      const monthGames = await fetchGamesForDateRange(supabase, monthStart, monthEnd, teamTricode)
      const gameIds = monthGames.map((g) => g.game_id)
      const loaded = await loadGameJsonsForIds(supabase, bucket, prefix, gameIds)
      const matchedGameData = filterRelevantGames(loaded, player.nba_player_id)

      const coverImageUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.nba_player_id}.png`
      const sections = buildPlayerAwardSnapshot('pom', player, row, awardGameLog, matchedGameData, coverImageUrl, clipsPerPlayer)

      const confLabel = conference ? `${conference} — ` : ''
      const title = `Player of the Month — ${confLabel}${periodLabel}`
      const subtitle = `${player.name}${player.team_abbreviation ? ` (${player.team_abbreviation})` : ''}`
      const slug = generateSlug(`pom-${String(awardYear)}-${String(awardMonth).padStart(2, '0')}`, monthStart)

      const postRow = {
        post_type: 'player_of_month',
        status: 'published',
        title,
        subtitle,
        description: `${player.name} — ${periodLabel}${conference ? ` (${conference})` : ''}.`,
        slug,
        cover_image_url: coverImageUrl,
        share_image_url: null,
        game_id: null,
        game_date: monthStart,
        team_tricodes: teamTricode.length ? teamTricode : null,
        player_ids: [player.nba_player_id],
        person_id: player.nba_player_id,
        tags: ['awards', 'highlights'],
        metadata: {
          pom_row: row,
          pom_player: player,
        },
        source_ref: sourceRef,
        created_by: null,
        author_name: 'HoopGeek',
        published_at: new Date().toISOString(),
      }

      const { data: inserted, error: insErr } = await supabase.from('feed_posts').insert(postRow).select('id').maybeSingle()

      if (insErr) {
        if (insErr.code === '23505' || String(insErr.message).toLowerCase().includes('duplicate')) {
          skipped.push({ source_ref: sourceRef, reason: 'duplicate_source_ref' })
        } else {
          errors.push({ conference, message: insErr.message })
        }
        continue
      }

      if (!inserted?.id) {
        errors.push({ conference, message: 'insert returned no id' })
        continue
      }

      const sectionRows = sections.map((s, i) => ({
        post_id: inserted.id,
        section_order: i,
        section_type: s.section_type,
        title: s.title,
        content: s.content,
        player_id: s.player_id,
        team_tricode: s.team_tricode,
      }))

      const { error: secErr } = await supabase.from('feed_post_sections').insert(sectionRows)
      if (secErr) {
        await supabase.from('feed_posts').delete().eq('id', inserted.id)
        errors.push({ conference, message: secErr.message })
        continue
      }

      await markSlateAutomationDone(supabase, sourceRef)

      created.push({ post_id: inserted.id, source_ref: sourceRef, conference })
    }

    return new Response(
      JSON.stringify({ award_year: awardYear, award_month: awardMonth, created, skipped, errors }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
