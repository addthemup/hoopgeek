import { useMemo, useCallback, useEffect } from 'react'
import { Avatar, Box, Card, CardContent, Chip, CircularProgress, Typography } from '@mui/joy'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useSetFeedLayoutProps, useFeedLayout } from '../contexts/FeedLayoutContext'
import { useGamesByDate } from '../hooks/useGamesByDate'
import { useNBAScoreboard } from '../hooks/useNBAScoreboard'
import { getSiteDayEST, isDateInEST } from '../utils/nbaDateUtils'
import { getTeamLogoUrl } from '../utils/nbaTeamLogos'
import { formatAmericanOdds, moneylineToApproxSpread, resolveGameTeamLines } from '../utils/gameOddsResolver'
import { supabase } from '../utils/supabase'
import { fetchTeamOutPlayersFromRecentRotations } from '../utils/teamOutPlayersFromRotation'

type MergedGame = {
  game_id: string
  game_date: string
  home_team_tricode: string
  away_team_tricode: string
  home_team_name: string
  away_team_name: string
  home_team_score: number
  away_team_score: number
  game_status_text: string
  home_spread?: number | null
  away_spread?: number | null
  over_under?: number | null
}

type TeamRecord = { wins: number; losses: number }

function normalizeGameIdKey(value: string | number | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return raw
  const normalizedDigits = digits.replace(/^0+/, '')
  return normalizedDigits || '0'
}

function formatSpreadForDisplay(primary: number | null | undefined, opposite: number | null | undefined): string {
  const value = primary != null ? primary : opposite != null ? -opposite : null
  if (value == null || Number.isNaN(value)) return ''
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(n)) return ''
  const prefix = n > 0 ? '+' : ''
  return `${prefix}${n.toFixed(1)}`
}

function toDateOnly(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  return raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10)
}

function dayDistance(a: string, b: string): number {
  if (!a || !b) return 999
  const ta = new Date(`${a}T00:00:00Z`).getTime()
  const tb = new Date(`${b}T00:00:00Z`).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 999
  return Math.abs(Math.round((ta - tb) / 86400000))
}

function scoreboardGameMatchesESTDate(rawGameDate: string, estDateString: string): boolean {
  const gameDate = String(rawGameDate || '').trim()
  if (!gameDate) return false
  if (gameDate.includes('T') || gameDate.includes(' ')) {
    return isDateInEST(gameDate, estDateString)
  }
  return gameDate.slice(0, 10) === estDateString
}

function mergeGamesForDate(date: string, dbGames: any[] | undefined, scoreboardGames: any[] | undefined): MergedGame[] {
  const db = dbGames ?? []
  if (!scoreboardGames?.length) {
    return db
      .filter((g) => !!g.home_team_tricode && !!g.away_team_tricode && g.home_team_tricode !== g.away_team_tricode)
      .map((g) => ({ ...g, game_id: String(g.game_id) })) as MergedGame[]
  }
  const liveById = new Map<string, any>()
  for (const g of scoreboardGames) {
    const gameDate = String(g.gameDate ?? g.game_date ?? '')
    if (!scoreboardGameMatchesESTDate(gameDate, date)) continue
    const normalizedLiveId = normalizeGameIdKey(g.gameId ?? g.game_id)
    if (!normalizedLiveId) continue
    liveById.set(normalizedLiveId, g)
  }

  const merged: MergedGame[] = db.map((d: any) => {
    const normalizedDbId = normalizeGameIdKey(d.game_id)
    const live = normalizedDbId ? liveById.get(normalizedDbId) : undefined
    if (!live) return d as MergedGame
    return {
      ...d,
      home_team_score: Number(live.homeTeam?.points ?? d.home_team_score ?? 0),
      away_team_score: Number(live.awayTeam?.points ?? d.away_team_score ?? 0),
      game_status_text: String(live.gameStatusText ?? d.game_status_text ?? 'Scheduled'),
    }
  })

  const seen = new Set(merged.map((g) => normalizeGameIdKey(g.game_id)).filter(Boolean))
  for (const live of liveById.values()) {
    const id = String(live.gameId ?? live.game_id ?? '')
    const normalizedId = normalizeGameIdKey(id)
    if (!normalizedId || seen.has(normalizedId)) continue
    merged.push({
      game_id: id,
      game_date: String(live.gameDate ?? date),
      home_team_tricode: String(live.homeTeam?.abbreviation ?? ''),
      away_team_tricode: String(live.awayTeam?.abbreviation ?? ''),
      home_team_name: String(live.homeTeam?.name ?? live.homeTeam?.abbreviation ?? ''),
      away_team_name: String(live.awayTeam?.name ?? live.awayTeam?.abbreviation ?? ''),
      home_team_score: Number(live.homeTeam?.points ?? 0),
      away_team_score: Number(live.awayTeam?.points ?? 0),
      game_status_text: String(live.gameStatusText ?? 'Scheduled'),
    })
    seen.add(normalizedId)
  }

  const deduped = new Map<string, MergedGame>()
  for (const g of merged) {
    if (!g.home_team_tricode || !g.away_team_tricode || g.home_team_tricode === g.away_team_tricode) continue
    const key = normalizeGameIdKey(g.game_id)
    if (!key) continue
    if (!deduped.has(key)) deduped.set(key, { ...g, game_id: String(g.game_id) })
  }
  return Array.from(deduped.values())
}

export default function GamesHub() {
  const navigate = useNavigate()
  const siteDefault = getSiteDayEST(3)
  const { siteDate } = useFeedLayout()
  const selectedDate = siteDate || siteDefault
  const debugHomeCards =
    typeof window !== 'undefined' &&
    import.meta.env.DEV &&
    (window as any).__DEBUG_HOME_CARDS__ !== false

  const { data: gamesByDate, isLoading, error } = useGamesByDate(selectedDate)
  const { data: scoreboard } = useNBAScoreboard(selectedDate)

  const games = useMemo(
    () => mergeGamesForDate(selectedDate, gamesByDate as any[] | undefined, scoreboard?.games as any[] | undefined),
    [selectedDate, gamesByDate, scoreboard?.games],
  )

  const { data: standingsMap } = useQuery({
    queryKey: ['gameshub-standings', games.map((g) => `${g.home_team_tricode}-${g.away_team_tricode}`).join('|')],
    queryFn: async (): Promise<Map<string, TeamRecord>> => {
      if (!games.length) return new Map()
      const tri = new Set<string>()
      for (const g of games) {
        if (g.home_team_tricode) tri.add(g.home_team_tricode)
        if (g.away_team_tricode) tri.add(g.away_team_tricode)
      }
      const currentDate = new Date()
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const season = month >= 10 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`
      const { data } = await supabase
        .from('nba_standings')
        .select('team_abbreviation, wins, losses')
        .eq('season', season)
        .in('team_abbreviation', Array.from(tri))
      const out = new Map<string, TeamRecord>()
      for (const row of data ?? []) {
        out.set(String(row.team_abbreviation), { wins: Number(row.wins || 0), losses: Number(row.losses || 0) })
      }
      return out
    },
    enabled: games.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  const { data: spreadsByGameId } = useQuery({
    queryKey: ['gameshub-spreads-ppg', selectedDate, games.map((g) => g.game_id).join('|')],
    queryFn: async (): Promise<Map<string, { homeSpread: number; awaySpread: number; homeOdds?: string | null; awayOdds?: string | null }>> => {
      if (!games.length) return new Map()
      const normalizedGameIdToCanonical = new Map<string, string>()
      games.forEach((g) => {
        const normalized = normalizeGameIdKey(g.game_id)
        if (normalized) normalizedGameIdToCanonical.set(normalized, g.game_id)
      })
      const nextDay = (() => {
        const d = new Date(`${selectedDate}T00:00:00Z`)
        d.setUTCDate(d.getUTCDate() + 1)
        return d.toISOString().slice(0, 10)
      })()
      const afterNextDay = (() => {
        const d = new Date(`${selectedDate}T00:00:00Z`)
        d.setUTCDate(d.getUTCDate() + 2)
        return d.toISOString().slice(0, 10)
      })()
      const dateCandidates = [selectedDate, nextDay, afterNextDay]
      let { data: ppgRows, error } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, raw_event_data')
        .in('game_date', dateCandidates)
      if (error) return new Map()
      if (!ppgRows?.length) return new Map()

      const out = new Map<string, { homeSpread: number; awaySpread: number; homeOdds?: string | null; awayOdds?: string | null }>()
      const bestDistanceByGameId = new Map<string, number>()
      const normalizeName = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ')

      for (const pg of ppgRows as any[]) {
        let raw = pg.raw_event_data
        if (typeof raw === 'string') {
          try {
            raw = JSON.parse(raw) as Record<string, unknown>
          } catch {
            continue
          }
        }
        if (!raw || typeof raw !== 'object') continue
        const teams = (raw as any).teams as { home?: { names?: { short?: string; long?: string } }; away?: { names?: { short?: string; long?: string } } } | undefined

        let homeSpread: number | null = null
        let awaySpread: number | null = null
        let homeOdds: string | null = null
        let awayOdds: string | null = null
        const odds = (raw as any).odds as Record<string, Record<string, unknown>> | undefined
        if (odds) {
          for (const [key, odd] of Object.entries(odds)) {
            if (!odd || typeof odd !== 'object') continue
            const side = ((odd as any).sideID as string) || ''
            const marketName = String((odd as any).marketName || '').toLowerCase()
            const betType = String((odd as any).betTypeID || '').toLowerCase()
            const keyLower = key.toLowerCase()
            const isSpread = marketName.includes('spread') || betType === 'spread' || keyLower.includes('spread')
            if (!isSpread) continue
            const priceRaw = (odd as any).bookOdds ?? (odd as any).openBookOdds ?? null
            const spreadNum = (odd as any).bookSpread != null
              ? Number((odd as any).bookSpread)
              : (odd as any).openBookSpread != null
                ? Number((odd as any).openBookSpread)
                : NaN
            if (Number.isNaN(spreadNum)) continue
            if (side === 'home') homeSpread = spreadNum
            if (side === 'away') awaySpread = spreadNum
            if (side === 'home') homeOdds = priceRaw != null ? formatAmericanOdds(String(priceRaw)) : null
            if (side === 'away') awayOdds = priceRaw != null ? formatAmericanOdds(String(priceRaw)) : null
          }
          if (homeSpread != null && awaySpread == null) awaySpread = -homeSpread
          if (awaySpread != null && homeSpread == null) homeSpread = -awaySpread
        }

        if (homeSpread == null && awaySpread == null && odds) {
          const homeMl = (odds['points-home-game-ml-home'] as any)?.bookOdds ?? (odds['points-home-game-ml-home'] as any)?.openBookOdds
          const awayMl = (odds['points-away-game-ml-away'] as any)?.bookOdds ?? (odds['points-away-game-ml-away'] as any)?.openBookOdds
          const homeMlNum = homeMl != null ? parseFloat(String(homeMl).replace(/[^0-9.-]/g, '')) : NaN
          const awayMlNum = awayMl != null ? parseFloat(String(awayMl).replace(/[^0-9.-]/g, '')) : NaN
          if (!Number.isNaN(homeMlNum) && !Number.isNaN(awayMlNum)) {
            const derived = moneylineToApproxSpread(homeMlNum, awayMlNum)
            if (derived) {
              homeSpread = derived.homeSpread
              awaySpread = derived.awaySpread
              homeOdds = formatAmericanOdds(homeMl)
              awayOdds = formatAmericanOdds(awayMl)
            }
          }
        }

        if (homeSpread == null && awaySpread == null) continue
        const home = homeSpread ?? -awaySpread!
        const away = awaySpread ?? -homeSpread!

        const nbaId = normalizeGameIdKey(pg.nba_game_id)
        const canonicalGameId = nbaId ? normalizedGameIdToCanonical.get(nbaId) : undefined
        const pgDateOnly = toDateOnly(String(pg.game_date ?? ''))
        const distance = dayDistance(pgDateOnly, selectedDate)
        if (canonicalGameId) {
          const prevBest = bestDistanceByGameId.get(canonicalGameId) ?? Number.POSITIVE_INFINITY
          if (distance <= prevBest) {
            out.set(canonicalGameId, { homeSpread: home, awaySpread: away, homeOdds, awayOdds })
            bestDistanceByGameId.set(canonicalGameId, distance)
          }
          continue
        }

        const rowHomeTri = String(pg.home_team_tricode ?? teams?.home?.names?.short ?? '').trim().toUpperCase()
        const rowAwayTri = String(pg.away_team_tricode ?? teams?.away?.names?.short ?? '').trim().toUpperCase()
        if (rowHomeTri && rowAwayTri) {
          const matched = games.find((g) => {
            const gHome = String(g.home_team_tricode ?? '').trim().toUpperCase()
            const gAway = String(g.away_team_tricode ?? '').trim().toUpperCase()
            return (rowHomeTri === gHome && rowAwayTri === gAway) || (rowHomeTri === gAway && rowAwayTri === gHome)
          })
          if (matched?.game_id) {
            const gid = String(matched.game_id)
            const prevBest = bestDistanceByGameId.get(gid) ?? Number.POSITIVE_INFINITY
            if (distance <= prevBest) {
              out.set(gid, { homeSpread: home, awaySpread: away, homeOdds, awayOdds })
              bestDistanceByGameId.set(gid, distance)
            }
            continue
          }
        }

        const rowHomeName = normalizeName(String(pg.home_team ?? teams?.home?.names?.long ?? ''))
        const rowAwayName = normalizeName(String(pg.away_team ?? teams?.away?.names?.long ?? ''))
        const matchedByName = games.find((g) => {
          const gHomeName = normalizeName(String(g.home_team_name ?? ''))
          const gAwayName = normalizeName(String(g.away_team_name ?? ''))
          if (!rowHomeName || !rowAwayName || !gHomeName || !gAwayName) return false
          return (rowHomeName === gHomeName && rowAwayName === gAwayName) || (rowHomeName === gAwayName && rowAwayName === gHomeName)
        })
        if (matchedByName?.game_id) {
          const gid = String(matchedByName.game_id)
          const prevBest = bestDistanceByGameId.get(gid) ?? Number.POSITIVE_INFINITY
          if (distance <= prevBest) {
            out.set(gid, { homeSpread: home, awaySpread: away, homeOdds, awayOdds })
            bestDistanceByGameId.set(gid, distance)
          }
        }
      }
      return out
    },
    enabled: games.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  const { data: allGameProps } = useQuery({
    queryKey: ['gameshub-game-props-batch', selectedDate, games.map((g) => g.game_id).join('|')],
    queryFn: async (): Promise<Map<string, any[]>> => {
      if (!games.length) return new Map()
      const gameIds = games.map((g) => g.game_id).filter(Boolean)
      if (!gameIds.length) return new Map()
      const nextDay = (() => {
        const d = new Date(`${selectedDate}T00:00:00Z`)
        d.setUTCDate(d.getUTCDate() + 1)
        return d.toISOString().slice(0, 10)
      })()
      const afterNextDay = (() => {
        const d = new Date(`${selectedDate}T00:00:00Z`)
        d.setUTCDate(d.getUTCDate() + 2)
        return d.toISOString().slice(0, 10)
      })()
      const dateCandidates = [selectedDate, nextDay, afterNextDay]

      const gameTeamMap = new Map<string, { homeTricode: string | null; awayTricode: string | null; homeName: string | null; awayName: string | null }>()
      games.forEach((g) => {
        if (g.game_id) {
          gameTeamMap.set(g.game_id, {
            homeTricode: g.home_team_tricode || null,
            awayTricode: g.away_team_tricode || null,
            homeName: g.home_team_name || null,
            awayName: g.away_team_name || null,
          })
        }
      })

      let propsGames: any[] = []
      const { data: propsGamesByNbaId } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, event_id, home_team_tricode, away_team_tricode, home_team, away_team, raw_event_data')
        .in('nba_game_id', gameIds)
        .in('game_date', dateCandidates)
      if (propsGamesByNbaId && propsGamesByNbaId.length > 0) {
        propsGames = propsGamesByNbaId
      }
      const propsGameById = new Map<string, any>(propsGames.map((pg) => [String(pg.id), pg]))
      const { data: allPropsGamesForDate } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, event_id, home_team_tricode, away_team_tricode, home_team, away_team, raw_event_data')
        .in('game_date', dateCandidates)

      if (allPropsGamesForDate) {
        const normalizeName = (name: string) => name.toLowerCase().trim()
        const matchedFallbackGames = allPropsGamesForDate.filter((pg) => {
          let raw = pg.raw_event_data as any
          if (typeof raw === 'string') {
            try { raw = JSON.parse(raw) } catch { raw = null }
          }
          const teams = raw?.teams as { home?: { names?: { short?: string; long?: string } }; away?: { names?: { short?: string; long?: string } } } | undefined
          const rowHomeTri = String(pg.home_team_tricode ?? teams?.home?.names?.short ?? '').trim().toUpperCase()
          const rowAwayTri = String(pg.away_team_tricode ?? teams?.away?.names?.short ?? '').trim().toUpperCase()
          const rowHomeName = String(pg.home_team ?? teams?.home?.names?.long ?? '').trim()
          const rowAwayName = String(pg.away_team ?? teams?.away?.names?.long ?? '').trim()
          return Array.from(gameTeamMap.values()).some((gameTeams) => {
            if (rowHomeTri && rowAwayTri && gameTeams.homeTricode && gameTeams.awayTricode) {
              return (
                (rowHomeTri === gameTeams.homeTricode && rowAwayTri === gameTeams.awayTricode) ||
                (rowHomeTri === gameTeams.awayTricode && rowAwayTri === gameTeams.homeTricode)
              )
            }
            if (rowHomeName && rowAwayName && gameTeams.homeName && gameTeams.awayName) {
              const pgHome = normalizeName(rowHomeName)
              const pgAway = normalizeName(rowAwayName)
              const gameHome = normalizeName(gameTeams.homeName)
              const gameAway = normalizeName(gameTeams.awayName)
              return (
                (pgHome === gameHome && pgAway === gameAway) ||
                (pgHome === gameAway && pgAway === gameHome)
              )
            }
            return false
          })
        })
        matchedFallbackGames.forEach((pg) => {
          propsGameById.set(String(pg.id), pg)
        })
      }
      propsGames = Array.from(propsGameById.values())

      const propsGameIds = propsGames?.map((pg) => pg.id).filter(Boolean) || []
      if (!propsGameIds.length) return new Map()
      const propsFetchLimit = Math.max(2000, propsGameIds.length * 900)

      const normalizeName = (s: string) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ')
      const eventIdToGameId = new Map<string, string>()
      const nbaIdToGameId = new Map<string, string>()
      for (const pg of propsGames) {
        let canonicalGameId: string | null = null
        const pgNba = String(pg?.nba_game_id ?? '').trim()
        if (pgNba && gameTeamMap.has(pgNba)) {
          canonicalGameId = pgNba
        } else {
          let raw = pg?.raw_event_data as any
          if (typeof raw === 'string') {
            try { raw = JSON.parse(raw) } catch { raw = null }
          }
          const teams = raw?.teams as { home?: { names?: { short?: string; long?: string } }; away?: { names?: { short?: string; long?: string } } } | undefined
          const rowHomeTri = String(pg?.home_team_tricode ?? teams?.home?.names?.short ?? '').trim().toUpperCase()
          const rowAwayTri = String(pg?.away_team_tricode ?? teams?.away?.names?.short ?? '').trim().toUpperCase()
          if (rowHomeTri && rowAwayTri) {
            const triMatch = games.find((g) => {
              const gHome = String(g.home_team_tricode ?? '').trim().toUpperCase()
              const gAway = String(g.away_team_tricode ?? '').trim().toUpperCase()
              return (rowHomeTri === gHome && rowAwayTri === gAway) || (rowHomeTri === gAway && rowAwayTri === gHome)
            })
            canonicalGameId = triMatch?.game_id ?? null
          }
          if (!canonicalGameId) {
            const rowHomeName = normalizeName(String(pg?.home_team ?? teams?.home?.names?.long ?? ''))
            const rowAwayName = normalizeName(String(pg?.away_team ?? teams?.away?.names?.long ?? ''))
            const nameMatch = games.find((g) => {
              const gHome = normalizeName(String(g.home_team_name ?? ''))
              const gAway = normalizeName(String(g.away_team_name ?? ''))
              if (!rowHomeName || !rowAwayName || !gHome || !gAway) return false
              return (rowHomeName === gHome && rowAwayName === gAway) || (rowHomeName === gAway && rowAwayName === gHome)
            })
            canonicalGameId = nameMatch?.game_id ?? null
          }
        }
        if (pg?.event_id && canonicalGameId) eventIdToGameId.set(String(pg.event_id), canonicalGameId)
        if (pgNba && canonicalGameId) nbaIdToGameId.set(pgNba, canonicalGameId)
      }

      const { data: propsData, error } = await supabase
        .from('player_props')
        .select(`
          id,
          game_id,
          game_date,
          line,
          american_odds,
          price,
          bet_type,
          bet_type_id,
          player_props_games!inner (
            id,
            event_id,
            game_date,
            home_team_tricode,
            away_team_tricode,
            nba_game_id
          )
        `)
        .in('game_date', dateCandidates)
        .in('game_id', propsGameIds)
        .order('line', { ascending: true })
        .limit(propsFetchLimit)

      if (error || !propsData) return new Map()

      const propsMap = new Map<string, any[]>()
      propsData.forEach((prop: any) => {
        const propsGame = prop.player_props_games
        if (!propsGame) return
        const byEvent = propsGame.event_id ? eventIdToGameId.get(String(propsGame.event_id)) : undefined
        const byNba = propsGame.nba_game_id ? nbaIdToGameId.get(String(propsGame.nba_game_id)) : undefined
        const canonical = byEvent ?? byNba
        if (!canonical) return
        if (!propsMap.has(canonical)) propsMap.set(canonical, [])
        propsMap.get(canonical)?.push(prop)
      })

      return propsMap
    },
    enabled: games.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const { data: outPlayersByTeam } = useQuery({
    queryKey: [
      'gameshub-out-players-by-team',
      selectedDate,
      games.map((g) => `${g.away_team_tricode}-${g.home_team_tricode}`).join('|'),
    ],
    queryFn: async (): Promise<Map<string, Array<{ nbaPlayerId: number; playerName: string; teamTricode: string }>>> => {
      if (!games.length) return new Map()
      const teamTricodes = Array.from(
        new Set(
          games
            .flatMap((g) => [String(g.home_team_tricode ?? ''), String(g.away_team_tricode ?? '')])
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean),
        ),
      )
      if (!teamTricodes.length) return new Map()
      return fetchTeamOutPlayersFromRecentRotations({
        teamTricodes,
        asOfDate: selectedDate,
        lookbackGames: 5,
      })
    },
    enabled: games.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!debugHomeCards) return
    const dbCount = (gamesByDate || []).length
    const scoreboardCount = (scoreboard?.games || []).length
    const mergedCount = games.length
    const scoreboardDates = Array.from(
      new Set((scoreboard?.games || []).map((g: any) => String(g.gameDate || g.game_date || '')))
    )
    const mergedDates = Array.from(new Set(games.map((g) => String(g.game_date || ''))))
    console.groupCollapsed(`[GamesHub][merge] ${selectedDate} db=${dbCount} scoreboard=${scoreboardCount} merged=${mergedCount}`)
    console.log('scoreboardDates(raw):', scoreboardDates)
    console.log('mergedGameDates(raw):', mergedDates)
    console.log('mergedGameIds:', games.map((g) => g.game_id))
    console.groupEnd()
  }, [debugHomeCards, selectedDate, gamesByDate, scoreboard?.games, games])

  useEffect(() => {
    if (!debugHomeCards || games.length === 0) return
    const rows = games.map((g) => {
      const spread = spreadsByGameId?.get(g.game_id)
      const props = allGameProps?.get(g.game_id) ?? []
      return {
        game_id: g.game_id,
        matchup: `${g.away_team_tricode} @ ${g.home_team_tricode}`,
        game_date: g.game_date,
        hasSpreadMap: Boolean(spread),
        spreadFromMap: spread ? `${spread.awaySpread}/${spread.homeSpread}` : null,
        propsCount: props.length,
      }
    })
    console.groupCollapsed(`[GamesHub][odds-map] ${selectedDate} games=${games.length}`)
    console.table(rows)
    console.groupEnd()
  }, [debugHomeCards, selectedDate, games, spreadsByGameId, allGameProps])

  const emptyFilters = useMemo<never[]>(() => [], [])
  const gameLinkState = useMemo(
    () => ({ returnPath: `/?date=${selectedDate}`, returnDate: selectedDate }),
    [selectedDate]
  )
  const handleGameClick = useCallback((game: { game_id: string }) => {
    navigate(`/game/${game.game_id}`, { state: gameLinkState })
  }, [navigate, gameLinkState])

  const feedLayoutProps = useMemo(() => ({
    filterDrawerContent: null,
    activeFilters: emptyFilters,
    hasGameHeader: false,
    onGameClick: handleGameClick,
  }), [emptyFilters, handleGameClick])

  useSetFeedLayoutProps(feedLayoutProps)

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, pt: { xs: 2, md: 3 }, pb: 6 }}>
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress size="lg" sx={{ '--CircularProgress-trackColor': '#222', '--CircularProgress-progressColor': '#FFC72C' }} />
        </Box>
      )}

      {error && (
        <Typography level="body-md" sx={{ color: '#EF4444', py: 4 }}>
          Failed to load games for this date.
        </Typography>
      )}

      {!isLoading && !error && games.length === 0 && (
        <Typography level="body-md" sx={{ color: '#A0A0A0', py: 6 }}>
          No games available for this date.
        </Typography>
      )}

      {!isLoading && !error && games.length > 0 && (
        <Box
          key={`games-grid-${selectedDate}`}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: { xs: 1.5, md: 2 },
            '@container (min-width: 560px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            '@container (min-width: 850px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {games.map((game, index) => (
            (() => {
              const spreadFromPpg = spreadsByGameId?.get(game.game_id)
              const resolvedLines = resolveGameTeamLines({
                homeTricode: String(game.home_team_tricode ?? ''),
                awayTricode: String(game.away_team_tricode ?? ''),
                gameProps: allGameProps?.get(game.game_id) ?? [],
                initial: {
                  awaySpread: spreadFromPpg?.awaySpread ?? game.away_spread ?? null,
                  homeSpread: spreadFromPpg?.homeSpread ?? game.home_spread ?? null,
                  awaySpreadOdds: spreadFromPpg?.awayOdds ?? null,
                  homeSpreadOdds: spreadFromPpg?.homeOdds ?? null,
                },
              })
              const resolvedAwaySpread = resolvedLines.awaySpread
              const resolvedHomeSpread = resolvedLines.homeSpread
              const awayOdds = resolvedLines.awaySpreadOdds ?? resolvedLines.awayMoneylineOdds
              const homeOdds = resolvedLines.homeSpreadOdds ?? resolvedLines.homeMoneylineOdds
              const hasSpread = resolvedAwaySpread != null || resolvedHomeSpread != null
              const hasTeamOdds = hasSpread || !!awayOdds || !!homeOdds
              const awayOutPlayers = outPlayersByTeam?.get(String(game.away_team_tricode ?? '').trim().toUpperCase()) ?? []
              const homeOutPlayers = outPlayersByTeam?.get(String(game.home_team_tricode ?? '').trim().toUpperCase()) ?? []
              const hasAnyOutPlayers = awayOutPlayers.length > 0 || homeOutPlayers.length > 0
              return (
            <motion.div
              key={game.game_id}
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.34, ease: 'easeOut', delay: Math.min(index * 0.045, 0.28) }}
              whileHover={{ y: -4 }}
              style={{ height: '100%' }}
            >
            <Card
              variant="outlined"
              component={RouterLink}
              to={`/game/${game.game_id}`}
              state={gameLinkState}
              sx={{
                bgcolor: '#101010',
                borderColor: 'rgba(255,255,255,0.08)',
                cursor: 'pointer',
                textDecoration: 'none',
                color: 'inherit',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                borderRadius: '14px',
                boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
                transition: 'border-color 180ms ease, box-shadow 220ms ease',
                '&:hover, &:focus, &:active, &:visited': {
                  textDecoration: 'none',
                  color: 'inherit',
                },
                '&:hover': {
                  borderColor: 'rgba(255,199,44,0.55)',
                  boxShadow: '0 14px 30px rgba(0,0,0,0.34)',
                },
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  flexShrink: 0,
                  overflow: 'hidden',
                  bgcolor: '#050505',
                  position: 'relative',
                  borderBottom: '1px solid #1E1E1E',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(10,10,10,1) 45%, rgba(0,0,0,1) 100%)',
                  }}
                />
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.25 }}>
                  <Box sx={{ position: 'relative', width: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.45 }}>
                    <Box
                      component="img"
                      src={getTeamLogoUrl(game.away_team_tricode)}
                      alt={game.away_team_tricode}
                      sx={{ width: 68, height: 68, objectFit: 'contain', opacity: 0.9 }}
                    />
                    <Typography level="body-sm" sx={{ color: '#CFCFCF', fontWeight: 800, fontSize: '0.78rem' }}>
                      {standingsMap?.get(game.away_team_tricode)
                        ? `${standingsMap.get(game.away_team_tricode)!.wins}-${standingsMap.get(game.away_team_tricode)!.losses}`
                        : '--'}
                    </Typography>
                  </Box>
                  <Typography sx={{ color: '#FFC72C', fontWeight: 900, fontSize: '1.02rem', letterSpacing: '0.12em' }}>
                    VS
                  </Typography>
                  <Box sx={{ position: 'relative', width: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.45 }}>
                    <Box
                      component="img"
                      src={getTeamLogoUrl(game.home_team_tricode)}
                      alt={game.home_team_tricode}
                      sx={{ width: 68, height: 68, objectFit: 'contain', opacity: 0.9 }}
                    />
                    <Typography level="body-sm" sx={{ color: '#CFCFCF', fontWeight: 800, fontSize: '0.78rem' }}>
                      {standingsMap?.get(game.home_team_tricode)
                        ? `${standingsMap.get(game.home_team_tricode)!.wins}-${standingsMap.get(game.home_team_tricode)!.losses}`
                        : '--'}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.58) 0%, transparent 48%, transparent 100%)',
                  }}
                />
              </Box>
              <CardContent sx={{ gap: 1.1, py: 1.3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography level="body-sm" sx={{ color: '#D8D8D8', fontWeight: 800, fontSize: '0.92rem' }}>
                    {game.away_team_tricode} @ {game.home_team_tricode}
                  </Typography>
                  <Chip
                    size="sm"
                    sx={{
                      bgcolor: 'rgba(255,199,44,0.13)',
                      color: '#FFD86B',
                      fontWeight: 800,
                      fontSize: '0.76rem',
                      borderRadius: '999px',
                      height: 22,
                    }}
                  >
                    {game.game_status_text}
                  </Chip>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                  {game.over_under != null && (
                    <Typography level="body-sm" sx={{ color: '#FBC47A', fontWeight: 700, fontSize: '0.82rem' }}>
                      O/U {Number(game.over_under).toFixed(1)}
                    </Typography>
                  )}
                </Box>
                {hasTeamOdds && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.45 }}>
                    <Typography level="body-sm" sx={{ color: '#D8D8D8', fontWeight: 800, fontSize: '0.92rem' }}>
                      {game.away_team_tricode} {formatSpreadForDisplay(resolvedAwaySpread, resolvedHomeSpread) || '--'}{awayOdds ? ` (${awayOdds})` : ''}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: '#D8D8D8', fontWeight: 800, fontSize: '0.92rem' }}>
                      {game.home_team_tricode} {formatSpreadForDisplay(resolvedHomeSpread, resolvedAwaySpread) || '--'}{homeOdds ? ` (${homeOdds})` : ''}
                    </Typography>
                  </Box>
                )}
                {hasAnyOutPlayers && (
                  <Box sx={{ mt: 0.35, pt: 0.65, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography level="body-xs" sx={{ color: '#ff8b8b', fontWeight: 800, letterSpacing: '0.04em', mb: 0.45 }}>
                      OUT
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.55 }}>
                      {[{ tri: game.away_team_tricode, players: awayOutPlayers }, { tri: game.home_team_tricode, players: homeOutPlayers }].map((team) => (
                        <Box key={String(team.tri)} sx={{ display: 'flex', flexDirection: 'column', gap: 0.38, minWidth: 0 }}>
                          {team.players.slice(0, 2).map((player) => (
                            <Box key={`${team.tri}-${player.nbaPlayerId}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.45, minWidth: 0 }}>
                              <Avatar
                                size="sm"
                                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nbaPlayerId}.png`}
                                alt={player.playerName}
                                sx={{ width: 20, height: 20, flexShrink: 0 }}
                              />
                              <Typography
                                level="body-xs"
                                sx={{
                                  color: '#ECECEC',
                                  fontWeight: 700,
                                  fontSize: '0.68rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  minWidth: 0,
                                }}
                              >
                                {player.playerName}
                              </Typography>
                              <Box
                                sx={{
                                  flexShrink: 0,
                                  width: 14,
                                  height: 14,
                                  borderRadius: '999px',
                                  bgcolor: '#DC2626',
                                  color: '#FFFFFF',
                                  fontSize: '0.56rem',
                                  fontWeight: 900,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: 1,
                                }}
                              >
                                O
                              </Box>
                            </Box>
                          ))}
                          {team.players.length > 2 && (
                            <Typography level="body-xs" sx={{ color: '#B0B0B0', fontSize: '0.62rem', pl: 0.2 }}>
                              +{team.players.length - 2} more
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
            </motion.div>
              )
            })()
          ))}
        </Box>
      )}
    </Box>
  )
}

