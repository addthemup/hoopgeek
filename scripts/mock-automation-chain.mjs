/**
 * One-off: run feed automation edge functions in sequence and print aggregate counts.
 * Usage (from repo root): node scripts/mock-automation-chain.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnvLocal() {
  const raw = readFileSync(join(root, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return env
}

const env = loadEnvLocal()
const base = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

if (!base || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const slatePast = '2026-03-23'
const slateToday = '2026-03-24'

const stats = {
  postsCreated: 0,
  /** Hard failures: HTTP error, top-level error, batch errors count, spotlight errors strings */
  failures: 0,
  failureDetails: [],
}

function noteFailure(label, detail) {
  stats.failures += 1
  stats.failureDetails.push(`${label}: ${detail}`)
}

async function invoke(name, body) {
  const url = `${base}/functions/v1/${name}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { _raw: text.slice(0, 500) }
  }
  return { name, ok: res.ok, status: res.status, json }
}

function addCreated(n) {
  stats.postsCreated += Number(n) || 0
}

// --- 1) Prop results (past slate) ---
let gameIdsPast = []
{
  const r = await invoke('automate-prop-results', { date: slatePast, force: true })
  if (!r.ok || r.json?.error) {
    noteFailure('automate-prop-results', r.json?.error || `HTTP ${r.status}`)
  } else {
    const results = Array.isArray(r.json?.results) ? r.json.results : []
    gameIdsPast = [...new Set(results.map((x) => x.game_id).filter(Boolean))]
    addCreated(r.json?.summary?.created ?? 0)
    const errN = r.json?.summary?.errors ?? 0
    if (errN) {
      stats.failures += errN
      results.filter((x) => x.error).forEach((x) => stats.failureDetails.push(`prop_results ${x.game_id}: ${x.error}`))
    }
  }
  console.log(JSON.stringify({ step: 'automate-prop-results', status: r.status, summary: r.json?.summary, games: gameIdsPast.length }))
}

// --- 2) Player spotlights per game on that slate ---
for (const game_id of gameIdsPast) {
  const r = await invoke('automate-player-spotlights', { game_id, force: true })
  if (!r.ok) {
    noteFailure(`automate-player-spotlights ${game_id}`, `HTTP ${r.status}`)
    continue
  }
  const j = r.json
  if (j?.error && typeof j.error === 'string') {
    noteFailure(`automate-player-spotlights ${game_id}`, j.error)
    continue
  }
  addCreated(j?.created ?? 0)
  const errs = j?.errors
  if (Array.isArray(errs) && errs.length) {
    stats.failures += errs.length
    errs.forEach((e) => stats.failureDetails.push(`player_spotlight ${game_id}: ${e}`))
  }
}
console.log(JSON.stringify({ step: 'automate-player-spotlights', games: gameIdsPast.length }))

// --- 3) Game recaps (link prop_results + spotlights) ---
{
  const r = await invoke('automate-game-recaps', { date: slatePast, force: true })
  if (!r.ok || r.json?.error) {
    noteFailure('automate-game-recaps', r.json?.error || `HTTP ${r.status}`)
  } else {
    addCreated(r.json?.summary?.created ?? 0)
    const errN = r.json?.summary?.errors ?? 0
    if (errN) {
      stats.failures += errN
      const results = r.json?.results ?? []
      results.filter((x) => x.error).forEach((x) => stats.failureDetails.push(`game_recap ${x.game_id}: ${x.error}`))
    }
  }
  console.log(JSON.stringify({ step: 'automate-game-recaps', status: r.status, summary: r.json?.summary }))
}

// --- 4) Team of the Night (slate date for games on 3/23) ---
{
  const r = await invoke('automate-team-of-night', { date: slatePast, force: true })
  if (!r.ok || r.json?.error) {
    noteFailure('automate-team-of-night (slate)', r.json?.error || `HTTP ${r.status}`)
  } else if (r.json?.created === true) {
    addCreated(1)
  } else if (r.json?.deferred || r.json?.skipped) {
    // not a hard failure
  }
  console.log(JSON.stringify({ step: 'automate-team-of-night', date: slatePast, keys: r.json ? Object.keys(r.json) : [] }))
}

// Previous calendar week (Mon–Sun before 3/24): try TOTN for each day if not already there
const prevWeekDays = ['2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22']
for (const d of prevWeekDays) {
  const r = await invoke('automate-team-of-night', { date: d, force: false })
  if (!r.ok || r.json?.error) {
    noteFailure(`automate-team-of-night ${d}`, r.json?.error || `HTTP ${r.status}`)
    continue
  }
  if (r.json?.created === true) addCreated(1)
}
console.log(JSON.stringify({ step: 'automate-team-of-night-prev-week', days: prevWeekDays.length }))

// Team of the Week — previous ISO week starting Monday 2026-03-16
{
  const r = await invoke('automate-team-of-week', { week_start: '2026-03-16', force: false })
  if (!r.ok || r.json?.error) {
    noteFailure('automate-team-of-week', r.json?.error || `HTTP ${r.status}`)
  } else if (r.json?.created === true) {
    addCreated(1)
  }
  console.log(JSON.stringify({ step: 'automate-team-of-week', week_start: '2026-03-16', created: r.json?.created, skipped: r.json?.skipped, deferred: r.json?.deferred }))
}

// Draft post (Tuesday test — 2026-03-24 is Tuesday)
{
  const r = await invoke('automate-draft', { force: true })
  if (!r.ok || r.json?.error) {
    noteFailure('automate-draft', r.json?.error || `HTTP ${r.status}`)
  } else if (r.json?.created === true) {
    addCreated(1)
  }
  console.log(JSON.stringify({ step: 'automate-draft', created: r.json?.created, skipped: r.json?.skipped, deferred: r.json?.deferred }))
}

// --- Today slate: prop predictions, injury, upcoming ---
for (const [fn, label] of [
  ['automate-prop-predictions', 'prop_predictions'],
  ['automate-injury-reports', 'injury_reports'],
  ['automate-upcoming', 'upcoming'],
]) {
  const r = await invoke(fn, { date: slateToday, force: true })
  if (!r.ok || r.json?.error) {
    noteFailure(label, r.json?.error || `HTTP ${r.status}`)
  } else {
    addCreated(r.json?.summary?.created ?? 0)
    const errN = r.json?.summary?.errors ?? 0
    if (errN) {
      stats.failures += errN
      const results = r.json?.results ?? []
      results.filter((x) => x.error).forEach((x) => stats.failureDetails.push(`${label} ${x.game_id}: ${x.error}`))
    }
  }
  console.log(JSON.stringify({ step: fn, status: r.status, summary: r.json?.summary }))
}

console.log('\n=== SUMMARY ===')
console.log(JSON.stringify(stats, null, 2))
