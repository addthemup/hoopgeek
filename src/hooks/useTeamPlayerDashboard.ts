import { useQuery } from '@tanstack/react-query'
import { supabase } from '../utils/supabase'

export interface TeamPlayerDashboardResponse {
  teamId: number
  season: string
  raw: { resultSets?: Array<{ name: string; headers: string[]; rowSet: unknown[][] }> }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const NBA_SERVICE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_NBA_SERVICE_URL
const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV

function teamplayerdashboardParams(teamId: number, season: string): string {
  const params = new URLSearchParams({
    TeamID: String(teamId),
    Season: season,
    SeasonType: 'Regular Season',
    LeagueID: '00',
    LastNGames: '0',
    MeasureType: 'Base',
    Month: '0',
    OpponentTeamID: '0',
    PaceAdjust: 'N',
    PerMode: 'Totals',
    Period: '0',
    PlusMinus: 'N',
    Rank: 'N',
    DateFrom: '',
    DateTo: '',
    GameSegment: '',
    Location: '',
    Outcome: '',
    PORound: '0',
    SeasonSegment: '',
    ShotClockRange: '',
    VsConference: '',
    VsDivision: '',
  })
  return params.toString()
}

async function fetchViaViteProxy(
  teamId: number,
  season: string
): Promise<TeamPlayerDashboardResponse | null> {
  if (!IS_DEV || typeof fetch === 'undefined') return null
  const query = teamplayerdashboardParams(teamId, season)
  const url = `/api/nba/teamplayerdashboard?${query}`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const raw = await res.json()
    return { teamId, season, raw }
  } catch {
    return null
  }
}

async function tryNbaServiceFallback(
  teamId: number,
  season: string
): Promise<TeamPlayerDashboardResponse | null> {
  if (!NBA_SERVICE_URL || typeof fetch === 'undefined') return null
  const base = (NBA_SERVICE_URL as string).replace(/\/$/, '')
  const url = `${base}/teamplayerdashboard?teamId=${teamId}&season=${encodeURIComponent(season)}`
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const body = (await res.json()) as { teamId?: number; season?: string; teamPlayerDashboard?: unknown }
    if (!body?.teamPlayerDashboard) return null
    return { teamId, season, raw: { resultSets: (body.teamPlayerDashboard as { resultSets?: unknown[] })?.resultSets ?? [] } }
  } catch {
    return null
  }
}

function getCacheKey(teamId: number, season: string) {
  return `teamplayerdashboard:${teamId}:${season}`
}

async function fetchTeamPlayerDashboard(teamId: number, season: string): Promise<TeamPlayerDashboardResponse> {
  const cacheKey = getCacheKey(teamId, season)

  if (typeof window !== 'undefined') {
    try {
      const cached = window.localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as { timestamp: number; data: TeamPlayerDashboardResponse }
        if (Date.now() - parsed.timestamp < ONE_DAY_MS) {
          return parsed.data
        }
      }
    } catch (e) {
      console.warn('Failed to read team player dashboard cache from localStorage:', e)
    }
  }

  if (IS_DEV) {
    const fromVite = await fetchViaViteProxy(teamId, season)
    if (fromVite) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: fromVite }))
        } catch (e) {
          console.warn('Failed to write team player dashboard cache:', e)
        }
      }
      return fromVite
    }
  }

  if (NBA_SERVICE_URL) {
    const fromService = await tryNbaServiceFallback(teamId, season)
    if (fromService) {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: fromService }))
        } catch (e) {
          console.warn('Failed to write team player dashboard cache:', e)
        }
      }
      return fromService
    }
  }

  const { data, error } = await supabase.functions.invoke<TeamPlayerDashboardResponse>('nba-api-proxy', {
    body: {
      endpoint: 'team-player-dashboard',
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

  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    const fallback = await tryNbaServiceFallback(teamId, season)
    if (fallback) return fallback
    const errMsg = (data as { error?: string }).error ?? 'Failed to load player dashboard'
    throw new Error(errMsg)
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }))
    } catch (e) {
      console.warn('Failed to write team player dashboard cache:', e)
    }
  }

  return data as TeamPlayerDashboardResponse
}

export function useTeamPlayerDashboard(teamId?: number | null, season: string = '2025-26') {
  return useQuery({
    queryKey: ['team-player-dashboard', teamId, season],
    queryFn: () => {
      if (!teamId) {
        throw new Error('teamId is required for useTeamPlayerDashboard')
      }
      return fetchTeamPlayerDashboard(teamId, season)
    },
    enabled: !!teamId,
    staleTime: ONE_DAY_MS,
    cacheTime: ONE_DAY_MS,
  })
}
