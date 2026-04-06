/**
 * Single draft (tank race) post. source_ref: draft:{season}:{snapshot_date}
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { buildDraftSnapshot } from '../_shared/draft/buildDraftSnapshot.ts'
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

    let body: { force?: boolean } = {}
    if (req.method === 'POST') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }
    const force = body.force === true

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({ message: 'POST JSON: optional {"force":true} to bypass duplicate check on source_ref.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const built = await buildDraftSnapshot(supabase)
    if (!built) {
      return new Response(
        JSON.stringify({ deferred: true, reason: 'standings_unavailable', message: 'nba_standings empty or error for current season.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const sourceRef = `draft:${built.season}:${built.snapshot_date}`

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

    const title = `Tank Race — ${built.season}`
    const slug = generateSlug(`tank-race-${built.season}`, built.snapshot_date)
    const teamCount = Array.isArray((built.tank_snapshot as { rows?: unknown }).rows)
      ? (built.tank_snapshot as { rows: unknown[] }).rows.length
      : 0
    const description = `Lottery order (top 14 of ${teamCount || '?'} teams) and draft prospect rankings as of ${built.snapshot_date}.`

    const postRow = {
      post_type: 'draft',
      status: 'published',
      title,
      subtitle: built.snapshot_date,
      description,
      slug,
      cover_image_url: null,
      share_image_url: null,
      game_id: null,
      game_date: built.snapshot_date,
      team_tricodes: null,
      player_ids: null,
      person_id: null,
      tags: ['analysis'],
      metadata: { tank_snapshot: built.tank_snapshot },
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
      return new Response(JSON.stringify({ error: secErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    await markSlateAutomationDone(supabase, sourceRef)

    return new Response(
      JSON.stringify({ created: true, post_id: inserted.id, source_ref: sourceRef, slug, season: built.season }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
