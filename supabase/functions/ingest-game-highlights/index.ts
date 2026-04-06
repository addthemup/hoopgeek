import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type JsonPlay = {
  eventNum?: number
  actionId?: number
  period?: number
  clock?: string
  description?: string
  actionType?: string
  subType?: string
  teamId?: number | null
  teamTricode?: string | null
  personId?: number | null
  playerName?: string | null
  scoreHome?: string
  scoreAway?: string
  mp4?: string | null
}

function storageObjectPath(prefix: string, gameId: string): string {
  const p = prefix.replace(/\/$/, '')
  return p ? `${p}/${gameId}.json` : `${gameId}.json`
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', enc)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function parseGameDate(raw: Record<string, unknown>): string | null {
  const dateRaw = String((raw?.gameMetadata as Record<string, unknown> | undefined)?.date ?? '')
  if (!dateRaw) return null
  const ymd = dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
}

function extractClips(raw: Record<string, unknown>) {
  const gameId = String(raw.gameId ?? '')
  if (!/^\d{10}$/.test(gameId)) return { gameId: null, clips: [] as JsonPlay[], gameDate: null as string | null }
  const allPlays = ((raw.playByPlay as Record<string, unknown> | undefined)?.allPlays ?? []) as JsonPlay[]
  const clips = allPlays.filter((p) => typeof p?.mp4 === 'string' && String(p.mp4).length > 0)
  const dedup = new Map<string, JsonPlay>()
  for (const c of clips) {
    const key = `${c.actionId ?? 'na'}:${c.eventNum ?? 'na'}:${String(c.mp4)}`
    if (!dedup.has(key)) dedup.set(key, c)
  }
  return { gameId, clips: Array.from(dedup.values()), gameDate: parseGameDate(raw) }
}

async function processSingleObject(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  options: { dryRun: boolean; deleteSource: boolean },
) {
  const startedAt = new Date().toISOString()
  const runInsert = await supabase
    .from('game_highlight_ingest_runs')
    .insert({
      game_id: path.replace(/\.json$/i, '').split('/').pop() || path,
      source_bucket: bucket,
      source_path: path,
      status: 'started',
      created_at: startedAt,
    })
    .select('id')
    .maybeSingle()
  const runId = runInsert.data?.id as string | undefined

  const finishRun = async (patch: Record<string, unknown>) => {
    if (!runId) return
    await supabase
      .from('game_highlight_ingest_runs')
      .update({ ...patch, completed_at: new Date().toISOString() })
      .eq('id', runId)
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path)
  if (dlErr || !blob) {
    await finishRun({ status: 'error', error_message: dlErr?.message ?? 'missing_blob' })
    return { path, error: dlErr?.message ?? 'missing_blob' }
  }

  const jsonText = await blob.text()
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    await finishRun({ status: 'error', error_message: 'invalid_json' })
    return { path, error: 'invalid_json' }
  }

  const sourceChecksum = await sha256Hex(jsonText)
  const { gameId, clips, gameDate } = extractClips(raw)
  if (!gameId) {
    await finishRun({ status: 'error', error_message: 'invalid_game_id', source_checksum: sourceChecksum })
    return { path, error: 'invalid_game_id' }
  }

  if (options.dryRun) {
    await finishRun({
      game_id: gameId,
      status: 'dry_run',
      source_checksum: sourceChecksum,
      clips_extracted: clips.length,
      clips_upserted: 0,
      deleted_source: false,
    })
    return { game_id: gameId, path, clips_extracted: clips.length, dry_run: true }
  }

  // Replace game clips atomically-ish: remove old game set, insert the new set.
  const { error: delErr } = await supabase.from('game_highlight_clips').delete().eq('game_id', gameId)
  if (delErr) {
    await finishRun({ game_id: gameId, status: 'error', error_message: `delete_existing: ${delErr.message}`, source_checksum: sourceChecksum })
    return { game_id: gameId, path, error: `delete_existing: ${delErr.message}` }
  }

  if (clips.length > 0) {
    const payload = clips.map((c) => ({
      game_id: gameId,
      game_date: gameDate,
      event_num: c.eventNum ?? null,
      action_id: c.actionId ?? null,
      period: c.period ?? null,
      clock: c.clock ?? null,
      description: c.description ?? null,
      action_type: c.actionType ?? null,
      sub_type: c.subType ?? null,
      team_id: c.teamId ?? null,
      team_tricode: c.teamTricode ?? null,
      person_id: c.personId ?? null,
      player_name: c.playerName ?? null,
      score_home: c.scoreHome ?? null,
      score_away: c.scoreAway ?? null,
      mp4_url: String(c.mp4),
      source_bucket: bucket,
      source_path: path,
      source_checksum: sourceChecksum,
    }))
    const { error: insErr } = await supabase.from('game_highlight_clips').insert(payload)
    if (insErr) {
      await finishRun({ game_id: gameId, status: 'error', error_message: `insert_clips: ${insErr.message}`, source_checksum: sourceChecksum })
      return { game_id: gameId, path, error: `insert_clips: ${insErr.message}` }
    }
  }

  // Verification before delete.
  const { count, error: countErr } = await supabase
    .from('game_highlight_clips')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .eq('source_checksum', sourceChecksum)

  if (countErr || (count ?? 0) !== clips.length) {
    await finishRun({
      game_id: gameId,
      status: 'error',
      source_checksum: sourceChecksum,
      clips_extracted: clips.length,
      clips_upserted: count ?? 0,
      error_message: `verification_failed expected=${clips.length} actual=${count ?? 0}`,
    })
    return { game_id: gameId, path, error: 'verification_failed', expected: clips.length, actual: count ?? 0 }
  }

  let deletedSource = false
  if (options.deleteSource) {
    const { error: rmErr } = await supabase.storage.from(bucket).remove([path])
    if (!rmErr) deletedSource = true
  }

  await finishRun({
    game_id: gameId,
    status: 'success',
    source_checksum: sourceChecksum,
    clips_extracted: clips.length,
    clips_upserted: clips.length,
    deleted_source: deletedSource,
  })

  return {
    game_id: gameId,
    path,
    clips_extracted: clips.length,
    clips_upserted: clips.length,
    deleted_source: deletedSource,
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

    // Rollout guardrail: no-op unless explicitly enabled.
    const enabled = String(Deno.env.get('GAME_HIGHLIGHTS_INGEST_ENABLED') ?? 'false').toLowerCase() === 'true'
    if (!enabled) {
      return new Response(JSON.stringify({ disabled: true, reason: 'Set GAME_HIGHLIGHTS_INGEST_ENABLED=true to enable' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'GET') {
      return new Response(
        JSON.stringify({
          message:
            'POST {"game_id":"0022501227"} or {"paths":["feed/0022501227.json"]}. Optional {"dry_run":false,"delete_source":true,"bucket":"game-data","prefix":"feed"}.',
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

    const body = await req.json().catch(() => ({})) as {
      game_id?: string
      paths?: string[]
      bucket?: string
      prefix?: string
      delete_source?: boolean
      dry_run?: boolean
      max_files?: number
    }

    const bucket = body.bucket || Deno.env.get('FEED_JSON_BUCKET') || 'game-data'
    const prefix = body.prefix || Deno.env.get('FEED_JSON_PREFIX') || ''
    const deleteSource = body.delete_source !== false
    const dryRun = body.dry_run === true
    const maxFiles = Math.max(1, Math.min(200, Number(body.max_files ?? 25)))
    const supabase = createClient(supabaseUrl, serviceKey)

    let paths: string[] = []
    if (Array.isArray(body.paths) && body.paths.length > 0) {
      paths = body.paths.filter((p) => typeof p === 'string' && p.endsWith('.json'))
    } else if (body.game_id && /^\d{10}$/.test(body.game_id)) {
      paths = [storageObjectPath(prefix, body.game_id)]
    } else {
      const { data: listed, error: listErr } = await supabase.storage.from(bucket).list(prefix, {
        limit: maxFiles,
        sortBy: { column: 'name', order: 'desc' },
      })
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      paths = (listed ?? [])
        .map((f) => `${prefix ? `${prefix.replace(/\/$/, '')}/` : ''}${String(f.name)}`)
        .filter((p) => p.endsWith('.json'))
    }

    const results: Array<Record<string, unknown>> = []
    for (const path of paths) {
      results.push(await processSingleObject(supabase, bucket, path, { deleteSource, dryRun }))
    }

    return new Response(
      JSON.stringify(
        {
          bucket,
          delete_source: deleteSource,
          dry_run: dryRun,
          files_processed: results.length,
          summary: {
            success: results.filter((r) => !r.error).length,
            errors: results.filter((r) => !!r.error).length,
            deleted_source: results.filter((r) => r.deleted_source === true).length,
          },
          results,
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
