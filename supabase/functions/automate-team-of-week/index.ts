/**
 * One Team of the Week post per nba_totw row. source_ref: team_of_week:{week_start}
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { resolvePlayersFromRow } from '../_shared/awards/resolveTotPlayers.ts'
import { loadGameJsonsForIds } from '../_shared/awards/loadGameJsonsFromStorage.ts'
import { buildTotLineupSections } from '../_shared/awards/buildTotLineupSnapshot.ts'
import type { GameData } from '../_shared/awards/gameDataFromRaw.ts'
import { isSlateAutomationDone, markSlateAutomationDone } from '../_shared/feed/slateCheckpoint.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function fetchGamesForWeek(
  supabase: ReturnType<typeof createClient>,
  weekStart: string,
  weekEnd: string,
  teamTricodes: string[],
): Promise<{ game_id: string }[]> {
  let q = supabase
    .from('nba_games')
    .select('game_id, game_date, home_team_tricode, away_team_tricode')
    .gte('game_date', `${weekStart}T00:00:00Z`)
    .lte('game_date', `${weekEnd}T23:59:59Z`)
    .order('game_date', { ascending: true })
  if (teamTricodes.length > 0) {
    const orConditions = teamTricodes.flatMap((t) => [`home_team_tricode.eq.${t}`, `away_team_tricode.eq.${t}`]).join(',')
    q = q.or(orConditions)
  }
  const { data, error } = await q
  if (error || !data) return []
  return data as { game_id: string }[]
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

    let body: { week_start?: string; force?: boolean; clip_count?: number } = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    const force = body.force === true
    const clipsPerPlayer = Math.min(10, Math.max(1, Number(body.clip_count) || 3))

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message: 'POST JSON: {"week_start":"2026-03-17"} or omit for latest nba_totw week. Optional "force", "clip_count".',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let totwRow: Record<string, unknown> | null = null
    if (body.week_start && /^\d{4}-\d{2}-\d{2}$/.test(body.week_start)) {
      const { data, error } = await supabase.from('nba_totw').select('*').eq('week_start', body.week_start).maybeSingle()
      if (error) throw new Error(error.message)
      totwRow = data as Record<string, unknown> | null
    } else {
      const { data, error } = await supabase.from('nba_totw').select('*').order('week_start', { ascending: false }).limit(1).maybeSingle()
      if (error) throw new Error(error.message)
      totwRow = data as Record<string, unknown> | null
    }

    if (!totwRow) {
      return new Response(
        JSON.stringify({ deferred: true, reason: 'no_totw_row', message: 'No nba_totw row found — run maintenance first.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const weekStart = String(totwRow.week_start ?? '').slice(0, 10)
    const weekEnd = String(totwRow.week_end ?? '').slice(0, 10)
    const weekNum = Number(totwRow.week_number) || 0
    const sourceRef = `team_of_week:${weekStart}`

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

    const resolvedPlayers = await resolvePlayersFromRow(supabase, totwRow, 'totw')
    if (resolvedPlayers.length === 0) {
      return new Response(JSON.stringify({ deferred: true, reason: 'no_players_resolved', week_start: weekStart }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const teamSet = new Set<string>()
    for (const p of resolvedPlayers) {
      if (p.team_abbreviation) teamSet.add(p.team_abbreviation)
    }
    const teamTricodes = [...teamSet]
    const nbaPlayerIds = resolvedPlayers.map((p) => p.nba_player_id).filter((x): x is number => x != null)

    const weekGames = await fetchGamesForWeek(supabase, weekStart, weekEnd, teamTricodes)
    const gameIds = weekGames.map((g) => g.game_id)
    const loaded = await loadGameJsonsForIds(supabase, bucket, prefix, gameIds)
    const matchedGameData = filterRelevantGames(loaded, nbaPlayerIds)

    const totalFP = Number(totwRow.total_avg_fantasy_points) || 0
    const title = `Team of the Week — Week ${weekNum} (${weekStart} → ${weekEnd})`
    const subtitle = `${totalFP.toFixed(1)} Avg Fantasy Points`
    const week_name = `Week ${weekNum}`

    const sections = buildTotLineupSections(
      'totw',
      resolvedPlayers,
      matchedGameData,
      {
        title,
        subtitle,
        week_name,
        start_date: weekStart,
        end_date: weekEnd,
      },
      clipsPerPlayer,
    )

    const slug = generateSlug(`team-of-the-week-${weekStart}`, weekStart)

    const postRow = {
      post_type: 'team_of_week',
      status: 'published',
      title,
      subtitle,
      description: `Weekly best fantasy lineup (${weekStart}–${weekEnd}) — ${resolvedPlayers.length} players.`,
      slug,
      cover_image_url: null,
      share_image_url: null,
      game_id: null,
      game_date: weekStart,
      team_tricodes: teamTricodes.length ? teamTricodes : null,
      player_ids: nbaPlayerIds.length ? nbaPlayerIds : null,
      person_id: null,
      tags: ['awards', 'highlights'],
      metadata: {
        totw_row: totwRow,
        totw_players: resolvedPlayers,
        week_number: weekNum,
        week_start: weekStart,
        week_end: weekEnd,
        total_salary: totwRow.total_salary,
        salary_cap: totwRow.salary_cap,
        total_avg_fantasy_points: totalFP,
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
          week_start: weekStart,
          week_end: weekEnd,
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
