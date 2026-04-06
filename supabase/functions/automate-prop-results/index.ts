/**
 * Automate prop_results feed posts per NBA game (post-game: props + boxscores).
 * Defers if no graded entries. Uses feed_automation_checkpoints.prop_results_batch_done.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { isDateInEST, getTodayEST, getYesterdayEST, utcToESTDate } from '../_shared/prop_prediction/nbaDateUtils.ts'
import { buildPropResultsSnapshot } from '../_shared/prop_results/buildPropResultsSnapshot.ts'

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

function sourceRefForGame(gameId: string): string {
  return `prop_results:${gameId}`
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

async function processGame(
  supabase: ReturnType<typeof createClient>,
  game: NbaGameRow,
  targetDate: string,
  force: boolean,
): Promise<Record<string, unknown>> {
  const gameId = game.game_id
  const away = game.away_team_tricode ?? ''
  const home = game.home_team_tricode ?? ''
  const matchup = `${away} @ ${home}`
  const cleanGameDate = game.game_date?.includes('T') ? game.game_date.split('T')[0] : game.game_date

  if (!force) {
    const { data: row } = await supabase
      .from('feed_automation_checkpoints')
      .select('prop_results_batch_done')
      .eq('game_id', gameId)
      .maybeSingle()
    if (row?.prop_results_batch_done === true) {
      return { game_id: gameId, skipped: true, reason: 'prop_results_batch_done' }
    }
  }

  const built = await buildPropResultsSnapshot(supabase, {
    targetDate,
    targetGameId: gameId,
    awayTricode: away,
    homeTricode: home,
  })

  if (!built) {
    return {
      game_id: gameId,
      deferred: true,
      reason: 'no_prop_results_yet',
      message: 'Box scores or matched props not ready — will not create an empty post.',
    }
  }

  const title = `Prop Results — ${matchup} — ${targetDate}`
  const description = `Post-game prop results for ${matchup} on ${targetDate} — overs, unders, pushes.`
  const slug = generateSlug(title, targetDate)
  const sourceRef = sourceRefForGame(gameId)

  const postRow = {
    post_type: 'prop_results',
    status: 'published',
    title,
    subtitle: targetDate,
    description,
    slug,
    cover_image_url: null,
    share_image_url: null,
    game_id: gameId,
    game_date: cleanGameDate || targetDate,
    team_tricodes: [away, home].filter(Boolean),
    player_ids: null,
    person_id: null,
    tags: ['props'],
    metadata: { prop_snapshot: built.prop_snapshot },
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

  if (!inserted?.id) {
    return { game_id: gameId, error: 'insert returned no id' }
  }

  const sectionRows = built.sections.map((s, i) => ({
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
    return { game_id: gameId, error: `sections: ${secErr.message}` }
  }

  const { data: existingCp } = await supabase.from('feed_automation_checkpoints').select('game_id').eq('game_id', gameId).maybeSingle()
  if (existingCp) {
    await supabase.from('feed_automation_checkpoints').update({ prop_results_batch_done: true }).eq('game_id', gameId)
  } else {
    await supabase.from('feed_automation_checkpoints').insert({
      game_id: gameId,
      prop_results_batch_done: true,
    })
  }

  return {
    game_id: gameId,
    created: true,
    post_id: inserted.id,
    source_ref: sourceRef,
    slug,
    props_count: Array.isArray((built.prop_snapshot as { props?: unknown }).props)
      ? (built.prop_snapshot as { props: unknown[] }).props.length
      : 0,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    let body: { date?: string; game_id?: string; force?: boolean; trigger?: string } = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    const force = body.force === true
    const gameIdArg = body.game_id && /^\d{10}$/.test(body.game_id) ? body.game_id : null
    let targetDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null

    if (gameIdArg && !targetDate) {
      const { data: gForDate } = await supabase
        .from('nba_games')
        .select('game_date')
        .eq('game_id', gameIdArg)
        .maybeSingle()
      if (gForDate?.game_date) targetDate = utcToESTDate(gForDate.game_date)
    }
    if (!targetDate) targetDate = body.trigger === 'cron_scheduled' ? getYesterdayEST() : getTodayEST()

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message:
            'POST JSON: {"date":"2026-03-21"} for all games that slate. Optional: "game_id":"0022501028", "force":true.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (gameIdArg) {
      const games = await fetchGamesForDate(supabase, targetDate)
      const game = games.find((g) => g.game_id === gameIdArg)
      if (!game) {
        const { data: single } = await supabase
          .from('nba_games')
          .select('game_id, game_date, home_team_tricode, away_team_tricode')
          .eq('game_id', gameIdArg)
          .maybeSingle()
        if (!single?.home_team_tricode || !single?.away_team_tricode) {
          return new Response(
            JSON.stringify({ error: 'game_id not found or missing tricodes', game_id: gameIdArg }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        const r = await processGame(supabase, single as NbaGameRow, targetDate, force)
        return new Response(JSON.stringify({ date: targetDate, ...r }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: typeof r.error === 'string' ? 500 : 200,
        })
      }
      const r = await processGame(supabase, game, targetDate, force)
      return new Response(JSON.stringify({ date: targetDate, ...r }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: typeof r.error === 'string' ? 500 : 200,
      })
    }

    const games = await fetchGamesForDate(supabase, targetDate)
    const results: Record<string, unknown>[] = []
    for (const g of games) {
      const r = await processGame(supabase, g, targetDate, force)
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
            deferred: results.filter((x) => x.deferred === true).length,
            skipped: results.filter((x) => x.skipped === true).length,
            errors: results.filter((x) => typeof x.error === 'string').length,
          },
        },
        null,
        2,
      ),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
