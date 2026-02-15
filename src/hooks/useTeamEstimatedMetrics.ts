import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface TeamEstimatedMetricsResponse {
  season: string
  raw: { resultSets?: Array<{ name: string; headers: string[]; rowSet: unknown[][] }> }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const NBA_SERVICE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_NBA_SERVICE_URL
const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV

function teamestimatedmetricsParams(season: string): string {
  const params = new URLSearchParams({
    LeagueID: '00',
    Season: season,
    SeasonType: 'Regular Season',
  })
  return params.toString()
}

async function fetchViaViteProxy(season: string): Promise<TeamEstimatedMetricsResponse | null> {
  if (!IS_DEV || typeof fetch === 'undefined') return null
  const query = teamestimatedmetricsParams(season)
  const url = `/api/nba/teamestimatedmetrics?${query}`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const raw = await res.json()
    return { season, raw }
  } catch {
    return null
  }
}

async function tryNbaServiceFallback(season: string): Promise<TeamEstimatedMetricsResponse | null> {
  if (!NBA_SERVICE_URL || typeof fetch === 'undefined') return null
  const base = (NBA_SERVICE_URL as string).replace(/\/$/, '')
  const url = `${base}/teamestimatedmetrics?season=${encodeURIComponent(season)}`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const body = (await res.json()) as { season?: string; teamEstimatedMetrics?: unknown }
    if (!body?.teamEstimatedMetrics) return null
    return {
      season,
      raw: { resultSets: [{ name: 'TeamEstimatedMetrics', ...(body.teamEstimatedMetrics as object) }] },
    }
  } catch {
    return null
  }
}

function getCacheKey(season: string) {
  return `teamestimatedmetrics:${season}`
}

async function fetchTeamEstimatedMetrics(season: string): Promise<TeamEstimatedMetricsResponse> {
  const cacheKey = getCacheKey(season)

  if (typeof window !== 'undefined') {
    try {
      const cached = window.localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as { timestamp: number; data: TeamEstimatedMetricsResponse }
        if (Date.now() - parsed.timestamp < ONE_DAY_MS) {
          return parsed.data
        }
      }
    } catch (e) {
      console.warn('Failed to read team estimated metrics cache from localStorage:', e)
    }
  }

  if (IS_DEV) {
    const fromVite = await fetchViaViteProxy(season)
    if (fromVite) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: fromVite }))
        } catch (e) {
          console.warn('Failed to write team estimated metrics cache:', e)
        }
      }
      return fromVite
    }
  }

  if (NBA_SERVICE_URL) {
    const fromService = await tryNbaServiceFallback(season)
    if (fromService) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: fromService }))
        } catch (e) {
          console.warn('Failed to write team estimated metrics cache:', e)
        }
      }
      return fromService
    }
  }

  const { data, error } = await supabase.functions.invoke<TeamEstimatedMetricsResponse>('nba-api-proxy', {
    body: {
      endpoint: 'team-estimated-metrics',
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

  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    const fallback = await tryNbaServiceFallback(season)
    if (fallback) return fallback
    const errMsg = (data as { error?: string }).error ?? 'Failed to load estimated metrics'
    throw new Error(errMsg)
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }))
    } catch (e) {
      console.warn('Failed to write team estimated metrics cache:', e)
    }
  }

  return data as TeamEstimatedMetricsResponse
}

export function useTeamEstimatedMetrics(teamId?: number | null, season: string = '2025-26') {
  return useQuery({
    queryKey: ['team-estimated-metrics', season],
    queryFn: () => fetchTeamEstimatedMetrics(season),
    enabled: !!teamId,
    staleTime: ONE_DAY_MS,
    cacheTime: ONE_DAY_MS,
  })
}
