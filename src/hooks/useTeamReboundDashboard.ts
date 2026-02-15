import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface TeamReboundDashboardResponse {
  // Shape is intentionally loose for now – we'll refine as we add more endpoints
  raw: any
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const NBA_SERVICE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_NBA_SERVICE_URL
const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV

/** Build query string for teamdashptreb (same params as edge proxy). */
function teamdashptrebParams(teamId: number, season: string): string {
  const params = new URLSearchParams({
    TeamID: String(teamId),
    Season: season,
    SeasonType: 'Regular Season',
    PerMode: 'PerGame',
    LeagueID: '00',
    Month: '0',
    OpponentTeamID: '0',
    Period: '0',
    LastNGames: '0',
    DateFrom: '',
    DateTo: '',
    GameSegment: '',
    Location: '',
    Outcome: '',
    SeasonSegment: '',
    VsConference: '',
    VsDivision: '',
  })
  return params.toString()
}

/** In dev, fetch via Vite proxy so the request runs from your machine (TypeScript-only, no Python). */
async function fetchViaViteProxy(
  teamId: number,
  season: string
): Promise<TeamReboundDashboardResponse | null> {
  if (!IS_DEV || typeof fetch === 'undefined') return null
  const query = teamdashptrebParams(teamId, season)
  const url = `/api/nba/teamdashptreb?${query}`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const raw = await res.json()
    return { teamId, season, raw }
  } catch {
    return null
  }
}

/** Optional: when edge times out, try Python nba-service if VITE_NBA_SERVICE_URL is set. */
async function tryNbaServiceFallback(
  teamId: number,
  season: string
): Promise<TeamReboundDashboardResponse | null> {
  if (!NBA_SERVICE_URL || typeof fetch === 'undefined') return null
  const base = (NBA_SERVICE_URL as string).replace(/\/$/, '')
  const url = `${base}/teamdashptreb?teamId=${teamId}&season=${encodeURIComponent(season)}`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const body = (await res.json()) as { teamId?: number; season?: string; dataSets?: unknown }
    if (!body?.dataSets) return null
    return { raw: { teamId: body.teamId, season: body.season, dataSets: body.dataSets } }
  } catch {
    return null
  }
}

function getCacheKey(teamId: number, season: string) {
  return `teamdashptreb:${teamId}:${season}`
}

async function fetchTeamReboundDashboard(teamId: number, season: string): Promise<TeamReboundDashboardResponse> {
  const cacheKey = getCacheKey(teamId, season)

  if (typeof window !== 'undefined') {
    try {
      const cached = window.localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as { timestamp: number; data: TeamReboundDashboardResponse }
        if (Date.now() - parsed.timestamp < ONE_DAY_MS) {
          return parsed.data
        }
      }
    } catch (e) {
      console.warn('Failed to read team rebound cache from localStorage:', e)
    }
  }

  // In dev: try Vite proxy first (request from your machine, TypeScript-only, no Python)
  if (IS_DEV) {
    const fromVite = await fetchViaViteProxy(teamId, season)
    if (fromVite) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: fromVite }))
        } catch (e) {
          console.warn('Failed to write team rebound cache:', e)
        }
      }
      return fromVite
    }
  }

  // Optional: when VITE_NBA_SERVICE_URL is set, try Python nba-service before edge
  if (NBA_SERVICE_URL) {
    const fromService = await tryNbaServiceFallback(teamId, season)
    if (fromService) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: fromService }))
        } catch (e) {
          console.warn('Failed to write team rebound cache:', e)
        }
      }
      return fromService
    }
  }

  // Call Supabase Edge Function proxy (used in prod or when dev proxy / nba-service fail)
  const { data, error } = await supabase.functions.invoke<TeamReboundDashboardResponse>('nba-api-proxy', {
    body: {
      endpoint: 'team-rebound-dashboard',
      teamId,
      season,
    },
  })

  if (error) {
    let message = error.message
    const res = (error as { context?: Response }).context
    if (res && typeof res.json === 'function') {
      try {
        const body = (await res.json()) as { error?: string }
        if (body?.error) message = body.error
      } catch {
        // ignore
      }
    }
    throw new Error(message)
  }

  // Proxy returns 200 with { ok: false, error } on NBA API failure (timeout, 403, etc.)
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    const fallback = await tryNbaServiceFallback(teamId, season)
    if (fallback) return fallback
    const errMsg = (data as { error?: string }).error ?? 'Failed to load rebounding stats'
    throw new Error(errMsg)
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          timestamp: Date.now(),
          data,
        }),
      )
    } catch (e) {
      console.warn('Failed to write team rebound cache to localStorage:', e)
    }
  }

  return data as TeamReboundDashboardResponse
}

export function useTeamReboundDashboard(teamId?: number | null, season: string = '2025-26') {
  return useQuery({
    queryKey: ['team-rebound-dashboard', teamId, season],
    queryFn: () => {
      if (!teamId) {
        throw new Error('teamId is required for useTeamReboundDashboard')
      }
      return fetchTeamReboundDashboard(teamId, season)
    },
    enabled: !!teamId,
    staleTime: ONE_DAY_MS,
    cacheTime: ONE_DAY_MS,
  })
}

