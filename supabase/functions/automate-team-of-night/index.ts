/**
 * One Team of the Night post per slate date from nba_totn + optional game JSON from Storage.
 * source_ref: team_of_night:{YYYY-MM-DD}
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { isDateInEST, getTodayEST, getYesterdayEST } from '../_shared/prop_prediction/nbaDateUtils.ts'
import { resolvePlayersFromRow } from '../_shared/awards/resolveTotPlayers.ts'
import { loadGameJsonsForIds } from '../_shared/awards/loadGameJsonsFromStorage.ts'
import { buildTotLineupSections } from '../_shared/awards/buildTotLineupSnapshot.ts'
import type { GameData } from '../_shared/awards/gameDataFromRaw.ts'
import { isSlateAutomationDone, markSlateAutomationDone } from '../_shared/feed/slateCheckpoint.ts'

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

function filterRelevantGames(loaded: GameData[], nbaPlayerIds: number[]): GameData[] {
  const nbaIdSet = new Set(nbaPlayerIds)
  return loaded.filter((gd) => {
    const hasInStats = gd.playerStats?.some((ps) => nbaIdSet.has(Number((ps as Record<string, unknown>).personId)))
    const hasInPbp = (gd.playByPlay || []).some((p) => p.personId != null && nbaIdSet.has(Number(p.personId)))
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

    let body: { date?: string; force?: boolean; clip_count?: number; trigger?: string } = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    const force = body.force === true
    const clipsPerPlayer = Math.min(10, Math.max(1, Number(body.clip_count) || 3))
    let slateDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null
    if (!slateDate) slateDate = body.trigger === 'cron_scheduled' ? getYesterdayEST() : getTodayEST()

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message: 'POST JSON: {"date":"2026-03-21"} optional "force":true, "clip_count":3. Uses nba_totn + game-data JSON.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const sourceRef = `team_of_night:${slateDate}`

    if (!force) {
      if (await isSlateAutomationDone(supabase, sourceRef)) {
        return new Response(
          JSON.stringify({ skipped: true, reason: 'slate_automation_done', checkpoint_key: sourceRef }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const { data: existing } = await supabase.from('feed_posts').select('id').eq('source_ref', sourceRef).maybeSingle()
      if (existing?.id) {
        return new Response(JSON.stringify({ skipped: true, reason: 'duplicate_source_ref', source_ref: sourceRef }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { data: totnRow, error: totnErr } = await supabase.from('nba_totn').select('*').eq('game_date', slateDate).maybeSingle()

    if (totnErr || !totnRow) {
      return new Response(
        JSON.stringify({
          deferred: true,
          reason: 'no_totn_row',
          message: 'No nba_totn row for this date — run daily maintenance first.',
          date: slateDate,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const row = totnRow as Record<string, unknown>
    const resolvedPlayers = await resolvePlayersFromRow(supabase, row, 'totn')
    if (resolvedPlayers.length === 0) {
      return new Response(JSON.stringify({ deferred: true, reason: 'no_players_resolved', date: slateDate }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const teamSet = new Set<string>()
    for (const p of resolvedPlayers) {
      if (p.team_abbreviation) teamSet.add(p.team_abbreviation)
    }
    const teamTricodes = [...teamSet]
    const nbaPlayerIds = resolvedPlayers.map((p) => p.nba_player_id).filter((x): x is number => x != null)

    const gamesOnSlate = await fetchGamesForDate(supabase, slateDate)
    const gameIds = gamesOnSlate.map((g) => g.game_id)
    const loaded = await loadGameJsonsForIds(supabase, bucket, prefix, gameIds)
    const matchedGameData = filterRelevantGames(loaded, nbaPlayerIds)

    const totalFP = Number(row.total_fantasy_points) || 0
    const title = `Team of the Night — ${slateDate}`
    const subtitle = `${totalFP.toFixed(1)} Total Fantasy Points`

    const sections = buildTotLineupSections(
      'totn',
      resolvedPlayers,
      matchedGameData,
      {
        title,
        subtitle,
        totnDate: slateDate,
      },
      clipsPerPlayer,
    )

    const slug = generateSlug(`team-of-the-night-${slateDate}`, slateDate)

    const postRow = {
      post_type: 'team_of_night',
      status: 'published',
      title,
      subtitle,
      description: `Best fantasy lineup for games on ${slateDate} — ${resolvedPlayers.length} players with highlights and stats.`,
      slug,
      cover_image_url: null,
      share_image_url: null,
      game_id: null,
      game_date: slateDate,
      team_tricodes: teamTricodes.length ? teamTricodes : null,
      player_ids: nbaPlayerIds.length ? nbaPlayerIds : null,
      person_id: null,
      tags: ['awards', 'highlights'],
      metadata: {
        totn_row: row,
        totn_players: resolvedPlayers,
        total_salary: row.total_salary,
        salary_cap: row.salary_cap,
        total_fantasy_points: totalFP,
      },
      source_ref: sourceRef,
      created_by: null,
      author_name: 'HoopGeek',
      published_at: new Date().toISOString(),
    }

    const { data: inserted, error: insErr } = await supabase.from('feed_posts').insert(postRow).select('id').maybeSingle()

    if (insErr) {
      if (insErr.code === '23505' || String(insErr.message).toLowerCase().includes('duplicate')) {
        return new Response(JSON.stringify({ skipped: true, reason: 'duplicate_source_ref', source_ref: sourceRef }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!inserted?.id) {
      return new Response(JSON.stringify({ error: 'insert returned no id' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      return new Response(JSON.stringify({ error: secErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await markSlateAutomationDone(supabase, sourceRef)

    return new Response(
      JSON.stringify(
        {
          created: true,
          post_id: inserted.id,
          source_ref: sourceRef,
          slug,
          date: slateDate,
          games_json_loaded: loaded.length,
          relevant_games_for_clips: matchedGameData.length,
        },
        null,
        2,
      ),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
