import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Avatar,
  LinearProgress,
  CircularProgress,
  Alert,
  Table,
} from '@mui/joy'
import { ArrowBack, Favorite, FavoriteBorder } from '@mui/icons-material'
import { supabase } from '../utils/supabase'
import IconButton from '@mui/joy/IconButton'
import { useAuth } from '../hooks/useAuth'
import { useIsTeamFavorited, useToggleFavoriteTeam } from '../hooks/useUserSettings'
import { useTeamReboundDashboard } from '../hooks/useTeamReboundDashboard'
import { useTeamGameLogs } from '../hooks/useTeamGameLogs'
import { useTeamDashPtShots } from '../hooks/useTeamDashPtShots'
import { useTeamEstimatedMetrics } from '../hooks/useTeamEstimatedMetrics'
import { useTeamPlayerDashboard } from '../hooks/useTeamPlayerDashboard'
import { useMediaQuery } from '@mui/material'
import TeamFourFactors from '../components/TeamFourFactors'
import TeamPageLayout from '../components/Feed/TeamPageLayout'
import type { TeamDrawerModule } from '../components/Feed/TeamPageLayout'
import { FeedCard } from './Highlights'
import type { FeedPost } from '../types/feed'
import { CONTENT_MAX_WIDTH } from '../constants/layout'

interface TeamData {
  id: string
  team_id: number
  abbreviation: string
  nickname: string
  city: string
  year_founded: number
  arena: string
  arena_capacity: number | null
  owner: string
  general_manager: string | null
  head_coach: string
  d_league_affiliation: string | null
  website: string | null
  twitter: string | null
  instagram: string | null
  facebook: string | null
  youtube: string | null
}

type ResultSet = { name: string; headers: string[]; rowSet: unknown[][] }

function getResultSet(raw: any, name: string): ResultSet | null {
  let sets = raw?.resultSets ?? raw?.dataSets
  if (!Array.isArray(sets) && raw?.resultSet != null) {
    sets = Array.isArray(raw.resultSet) ? raw.resultSet : [raw.resultSet]
  }
  if (Array.isArray(sets)) {
    const found = sets.find((s: ResultSet) => s.name === name)
    if (found) return found
    if (name === 'TeamEstimatedMetrics' && sets.length > 0) return sets[0]
    // NBA API sometimes uses different casing/names for teamplayerdashboard
    if (name === 'PlayersSeasonTotals' && sets.length > 0) {
      const withPlayerName = sets.find((s: ResultSet) =>
        Array.isArray(s?.rowSet) && s.rowSet.length > 0 &&
        (s.headers?.some((h: string) => h === 'PLAYER_NAME' || h === 'player_name') ?? false)
      )
      if (withPlayerName) return withPlayerName
      return sets[0]
    }
    return null
  }
  if (sets && typeof sets === 'object' && sets[name]) {
    const ds = sets[name]
    return Array.isArray(ds?.rowSet) ? { name, headers: ds.headers ?? [], rowSet: ds.rowSet } : null
  }
  return null
}

function rowToObj(rs: ResultSet, rowIndex: number): Record<string, unknown> {
  const row = rs.rowSet[rowIndex]
  if (!row) return {}
  return rs.headers.reduce((acc, h, i) => ({ ...acc, [h]: row[i] }), {} as Record<string, unknown>)
}

function ReboundingContent({ raw }: { raw: any }) {
  const overall = getResultSet(raw, 'OverallRebounding')
  const shotType = getResultSet(raw, 'ShotTypeRebounding')
  const contested = getResultSet(raw, 'NumContestedRebounding')

  if (!overall?.rowSet?.length) {
    return (
      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
        Rebounding data is cached for 24 hours. No splits available for this season yet.
      </Typography>
    )
  }

  const o = rowToObj(overall, 0) as Record<string, number | string>
  const fmt = (v: unknown) => (typeof v === 'number' ? (v as number).toFixed(1) : String(v ?? '—'))
  const pct = (v: unknown) => (typeof v === 'number' ? `${((v as number) * 100).toFixed(1)}%` : '—')

  return (
    <Stack spacing={2}>
      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
        Per-game rebounding splits (cached 24h). C = contested, UC = unopposed.
      </Typography>
      <Box>
        <Typography level="body-sm" sx={{ fontWeight: 600, mb: 0.5 }}>Overall</Typography>
        <Stack direction="row" flexWrap="wrap" gap={2} sx={{ typography: 'body-sm' }}>
          <span>REB: <strong>{fmt(o.REB)}</strong></span>
          <span>OREB: <strong>{fmt(o.OREB)}</strong></span>
          <span>DREB: <strong>{fmt(o.DREB)}</strong></span>
          <span>Contested %: <strong>{pct(o.C_REB_PCT)}</strong></span>
          <span>Unopposed %: <strong>{pct(o.UC_REB_PCT)}</strong></span>
        </Stack>
      </Box>
      {shotType && shotType.rowSet.length > 0 && (
        <Box>
          <Typography level="body-sm" sx={{ fontWeight: 600, mb: 0.5 }}>By shot type</Typography>
          <Table size="sm" sx={{ '& th, & td': { py: 0.5, fontSize: '0.75rem' } }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>REB</th>
                <th>Contested %</th>
                <th>Unopposed %</th>
              </tr>
            </thead>
            <tbody>
              {shotType.rowSet.map((_, i) => {
                const r = rowToObj(shotType, i) as Record<string, number | string>
                return (
                  <tr key={i}>
                    <td>{String(r.SHOT_TYPE_RANGE ?? '—')}</td>
                    <td>{fmt(r.REB)}</td>
                    <td>{pct(r.C_REB_PCT)}</td>
                    <td>{pct(r.UC_REB_PCT)}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Box>
      )}
      {contested && contested.rowSet.length > 0 && (
        <Box>
          <Typography level="body-sm" sx={{ fontWeight: 600, mb: 0.5 }}>By contest level</Typography>
          <Table size="sm" sx={{ '& th, & td': { py: 0.5, fontSize: '0.75rem' } }}>
            <thead>
              <tr>
                <th>Contest</th>
                <th>Freq</th>
                <th>REB</th>
                <th>Contested %</th>
              </tr>
            </thead>
            <tbody>
              {contested.rowSet.map((_, i) => {
                const r = rowToObj(contested, i) as Record<string, number | string>
                return (
                  <tr key={i}>
                    <td>{String(r.REB_NUM_CONTESTING_RANGE ?? '—')}</td>
                    <td>{pct(r.REB_FREQUENCY)}</td>
                    <td>{fmt(r.REB)}</td>
                    <td>{pct(r.C_REB_PCT)}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Box>
      )}
    </Stack>
  )
}

function TeamDashPtShotsContent({ raw }: { raw: any }) {
  const setNames = [
    'GeneralShooting',
    'DribbleShooting',
    'ShotClockShooting',
    'TouchTimeShooting',
    'ClosestDefenderShooting',
    'ClosestDefender10ftPlusShooting',
  ] as const
  const rangeCol: Record<string, string> = {
    GeneralShooting: 'SHOT_TYPE',
    DribbleShooting: 'DRIBBLE_RANGE',
    ShotClockShooting: 'SHOT_CLOCK_RANGE',
    TouchTimeShooting: 'TOUCH_TIME_RANGE',
    ClosestDefenderShooting: 'CLOSE_DEF_DIST_RANGE',
    ClosestDefender10ftPlusShooting: 'CLOSE_DEF_DIST_RANGE',
  }
  const title: Record<string, string> = {
    GeneralShooting: 'By shot type',
    DribbleShooting: 'By dribbles',
    ShotClockShooting: 'By shot clock',
    TouchTimeShooting: 'By touch time',
    ClosestDefenderShooting: 'By defender distance',
    ClosestDefender10ftPlusShooting: 'By defender (10ft+)',
  }

  const pct = (v: unknown) => (typeof v === 'number' ? `${((v as number) * 100).toFixed(1)}%` : '—')
  const fmt = (v: unknown) => (v == null ? '—' : typeof v === 'number' ? (v as number).toFixed(2) : String(v))

  let hasAny = false
  return (
    <Stack spacing={2}>
      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
        Per-game shooting splits (cached 24h). Freq = FGA frequency, eFG% = effective FG%.
      </Typography>
      {setNames.map((name) => {
        const rs = getResultSet(raw, name)
        if (!rs?.rowSet?.length) return null
        hasAny = true
        const rangeKey = rangeCol[name] ?? rs.headers[4]
        return (
          <Box key={name}>
            <Typography level="body-sm" sx={{ fontWeight: 600, mb: 0.5 }}>{title[name] ?? name}</Typography>
            <Table size="sm" sx={{ '& th, & td': { py: 0.5, fontSize: '0.75rem' } }}>
              <thead>
                <tr>
                  <th>Range</th>
                  <th>Freq</th>
                  <th>FG%</th>
                  <th>eFG%</th>
                  <th>2P%</th>
                  <th>3P%</th>
                </tr>
              </thead>
              <tbody>
                {rs.rowSet.map((_, i) => {
                  const r = rowToObj(rs, i) as Record<string, number | string>
                  return (
                    <tr key={i}>
                      <td>{String(r[rangeKey] ?? '—')}</td>
                      <td>{fmt(r.FGA_FREQUENCY)}</td>
                      <td>{pct(r.FG_PCT)}</td>
                      <td>{pct(r.EFG_PCT)}</td>
                      <td>{pct(r.FG2_PCT)}</td>
                      <td>{pct(r.FG3_PCT)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </Box>
        )
      })}
      {!hasAny && (
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Shot dashboard data is cached for 24 hours. No splits for this season yet.
        </Typography>
      )}
    </Stack>
  )
}

/** Returns the team row from estimated metrics raw data, or null. */
function getEstimatedMetricsRow(raw: any, teamId: number): Record<string, number | string> | null {
  const rs = getResultSet(raw, 'TeamEstimatedMetrics')
  if (!rs?.rowSet?.length) return null
  const teamIdIdx = rs.headers.findIndex((h: string) => h === 'TEAM_ID' || h === 'team_id')
  const teamRowIndex = teamIdIdx >= 0
    ? rs.rowSet.findIndex((row: unknown[]) => {
        const val = row[teamIdIdx]
        return Number(val) === Number(teamId) || String(val) === String(teamId)
      })
    : -1
  if (teamRowIndex < 0) return null
  return rowToObj(rs, teamRowIndex) as Record<string, number | string>
}

function TeamPlayerDashboardContent({ raw }: { raw: any }) {
  const players = getResultSet(raw, 'PlayersSeasonTotals')
  if (!players?.rowSet?.length) {
    return (
      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
        Player dashboard data is cached for 24 hours. No data for this season yet.
      </Typography>
    )
  }
  const fmt = (v: unknown) => (v == null ? '—' : typeof v === 'number' ? (v as number).toFixed(1) : String(v))
  const fmtInt = (v: unknown) => (v == null ? '—' : typeof v === 'number' ? String(Math.round(v as number)) : String(v))
  const pct = (v: unknown) => (typeof v === 'number' ? `${((v as number) * 100).toFixed(1)}%` : '—')
  const get = (r: Record<string, number | string>, key: string) => r[key] ?? r[key.toLowerCase()]
  return (
    <Stack spacing={1}>
      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
        Season totals per player (cached 24h).
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="sm" sx={{ '& th, & td': { py: 0.5, fontSize: '0.75rem' } }}>
          <thead>
            <tr>
              <th>Player</th>
              <th>GP</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>FG%</th>
              <th>3P%</th>
              <th>STL</th>
              <th>BLK</th>
              <th>TOV</th>
            </tr>
          </thead>
          <tbody>
            {players.rowSet.map((_, i) => {
              const r = rowToObj(players, i) as Record<string, number | string>
              return (
                <tr key={i}>
                  <td sx={{ fontWeight: 600 }}>{String(get(r, 'PLAYER_NAME') ?? '—')}</td>
                  <td>{fmtInt(get(r, 'GP'))}</td>
                  <td>{fmt(get(r, 'MIN'))}</td>
                  <td>{fmtInt(get(r, 'PTS'))}</td>
                  <td>{fmt(get(r, 'REB'))}</td>
                  <td>{fmt(get(r, 'AST'))}</td>
                  <td>{pct(get(r, 'FG_PCT'))}</td>
                  <td>{pct(get(r, 'FG3_PCT'))}</td>
                  <td>{fmt(get(r, 'STL'))}</td>
                  <td>{fmt(get(r, 'BLK'))}</td>
                  <td>{fmt(get(r, 'TOV'))}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Box>
    </Stack>
  )
}

function TeamGameLogsContent({ raw }: { raw: any }) {
  const logs = getResultSet(raw, 'TeamGameLogs')

  if (!logs?.rowSet?.length) {
    return (
      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
        Game logs are cached for 24 hours. No games for this season yet.
      </Typography>
    )
  }

  const fmt = (v: unknown) => (v == null ? '—' : typeof v === 'number' ? String(v) : String(v))
  const pct = (v: unknown) => (typeof v === 'number' ? `${((v as number) * 100).toFixed(1)}%` : '—')
  // Show last 20 games, most recent first (API returns chronological; reverse for recency)
  const reversed = [...logs.rowSet].reverse()
  const rows = reversed.slice(0, 20)

  return (
    <Stack spacing={1}>
      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
        Per-game totals (cached 24h). Most recent 20 games.
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="sm" sx={{ '& th, & td': { py: 0.5, fontSize: '0.75rem' } }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Matchup</th>
              <th>W/L</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>FG%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const origIndex = logs.rowSet.length - 1 - i
              const r = rowToObj(logs, origIndex) as Record<string, number | string>
              return (
                <tr key={origIndex}>
                  <td>{fmt(r.GAME_DATE)}</td>
                  <td>{fmt(r.MATCHUP)}</td>
                  <td>{fmt(r.WL)}</td>
                  <td>{fmt(r.PTS)}</td>
                  <td>{fmt(r.REB)}</td>
                  <td>{fmt(r.AST)}</td>
                  <td>{pct(r.FG_PCT)}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Box>
    </Stack>
  )
}

export default function TeamPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: teamData, isLoading, error } = useQuery({
    queryKey: ['team', id],
    queryFn: async () => {
      if (!id) throw new Error('Team ID is required')

      // Support both UUID team ids and numeric NBA team_ids in the URL
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id)

      const { data, error } = await supabase
        .from('nba_teams')
        .select('*')
        .eq(isUuid ? 'id' : 'team_id', isUuid ? id : Number(id))
        .single()

      if (error) {
        console.error('❌ Error fetching team:', error)
        throw new Error(`Failed to fetch team: ${error.message}`)
      }

      return data as TeamData
    },
    enabled: !!id,
  })

  const { data: isFavorite } = useIsTeamFavorited(user?.id, teamData?.team_id)
  const toggleFavoriteMutation = useToggleFavoriteTeam()

  // 2025-26 rebounding dashboard (cached in browser for 24 hours)
  const { data: reboundDashboard, isLoading: reboundLoading, error: reboundError } = useTeamReboundDashboard(
    teamData?.team_id ?? null,
    '2025-26',
  )
  const { data: gameLogs, isLoading: gameLogsLoading, error: gameLogsError } = useTeamGameLogs(
    teamData?.team_id ?? null,
    '2025-26',
  )
  const { data: dashPtShots, isLoading: dashPtShotsLoading, error: dashPtShotsError } = useTeamDashPtShots(
    teamData?.team_id ?? null,
    '2025-26',
  )
  const { data: estimatedMetrics, isLoading: estimatedMetricsLoading, error: estimatedMetricsError } = useTeamEstimatedMetrics(
    teamData?.team_id ?? null,
    '2025-26',
  )
  const { data: playerDashboard, isLoading: playerDashboardLoading, error: playerDashboardError } = useTeamPlayerDashboard(
    teamData?.team_id ?? null,
    '2025-26',
  )

  // Fetch feed posts relevant to this team (by team_tricodes)
  const teamAbbreviation = teamData?.abbreviation
  const { data: teamFeedPosts, isLoading: feedPostsLoading } = useQuery<FeedPost[]>({
    queryKey: ['team-feed-posts', teamAbbreviation],
    queryFn: async () => {
      if (!teamAbbreviation) return []

      const { data, error: feedErr } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('status', 'published')
        .contains('team_tricodes', [teamAbbreviation])
        .order('published_at', { ascending: false })
        .limit(50)

      if (feedErr) {
        console.error('Error fetching team feed posts:', feedErr)
        return []
      }

      return (data ?? []) as FeedPost[]
    },
    enabled: !!teamAbbreviation,
    staleTime: 1000 * 60 * 2,
  })

  // Detect mobile for proper spacing - hooks must be called before any conditional returns
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isMobileHeight = useMediaQuery('(max-height: 600px)')
  const isLandscapeMobile = isLandscape && isMobileHeight

  const handleFavoriteToggle = async () => {
    if (!user || !teamData) return
    
    try {
      await toggleFavoriteMutation.mutateAsync({ 
        userId: user.id, 
        teamId: teamData.team_id 
      })
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }

  if (isLoading) {
    return (
      <TeamPageLayout drawerModules={[]}>
        <Box sx={{ bgcolor: '#ffffff', minHeight: '100vh', py: 4 }}>
          <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', px: 2, width: '100%', boxSizing: 'border-box' }}>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography>Loading team data...</Typography>
          </Box>
        </Box>
      </TeamPageLayout>
    )
  }

  if (error || !teamData) {
    return (
      <TeamPageLayout drawerModules={[]}>
        <Box sx={{ bgcolor: '#ffffff', minHeight: '100vh', py: 4 }}>
          <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto', px: 2, width: '100%', boxSizing: 'border-box' }}>
            <Alert color="danger" sx={{ mb: 2 }}>
              {error instanceof Error ? error.message : 'Team not found'}
            </Alert>
            <IconButton onClick={() => navigate(-1)}>
              <ArrowBack />
            </IconButton>
          </Box>
        </Box>
      </TeamPageLayout>
    )
  }

  // ─── Drawer modules ─────────────────────────────────────────
  const playerDashboardDrawer = (
    <>
      {playerDashboardLoading && (
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading player stats...</Typography>
      )}
      {playerDashboardError && (
        <Typography level="body-sm" sx={{ color: 'danger.500' }}>
          {playerDashboardError instanceof Error ? playerDashboardError.message : 'Failed to load player dashboard.'}
        </Typography>
      )}
      {!playerDashboardLoading && !playerDashboardError && playerDashboard && (
        <TeamPlayerDashboardContent raw={playerDashboard.raw} />
      )}
    </>
  )

  const reboundingDrawer = (
    <>
      {reboundLoading && (
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading rebounding stats...</Typography>
      )}
      {reboundError && (
        <Typography level="body-sm" sx={{ color: 'danger.500' }}>
          {reboundError instanceof Error ? reboundError.message : 'Failed to load rebounding stats.'}
        </Typography>
      )}
      {!reboundLoading && !reboundError && reboundDashboard && (
        <ReboundingContent raw={reboundDashboard.raw} />
      )}
    </>
  )

  const shotDashboardDrawer = (
    <>
      {dashPtShotsLoading && (
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading shot splits...</Typography>
      )}
      {dashPtShotsError && (
        <Typography level="body-sm" sx={{ color: 'danger.500' }}>
          {dashPtShotsError instanceof Error ? dashPtShotsError.message : 'Failed to load shot dashboard.'}
        </Typography>
      )}
      {!dashPtShotsLoading && !dashPtShotsError && dashPtShots && (
        <TeamDashPtShotsContent raw={dashPtShots.raw} />
      )}
    </>
  )

  const gameLogsDrawer = (
    <>
      {gameLogsLoading && (
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading game logs...</Typography>
      )}
      {gameLogsError && (
        <Typography level="body-sm" sx={{ color: 'danger.500' }}>
          {gameLogsError instanceof Error ? gameLogsError.message : 'Failed to load game logs.'}
        </Typography>
      )}
      {!gameLogsLoading && !gameLogsError && gameLogs && (
        <TeamGameLogsContent raw={gameLogs.raw} />
      )}
    </>
  )

  const fourFactorsDrawer = (
    <TeamFourFactors teamId={teamData.team_id} />
  )

  const drawerModules: TeamDrawerModule[] = [
    { name: 'player_dashboard', content: playerDashboardDrawer },
    { name: 'rebounding', content: reboundingDrawer },
    { name: 'shot_dashboard', content: shotDashboardDrawer },
    { name: 'game_logs', content: gameLogsDrawer },
    { name: 'four_factors', content: fourFactorsDrawer },
  ]

  const drawerHeaderContent = (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 'md',
        bgcolor: '#111318',
        border: '1px solid #2A2D33',
        color: '#FFFFFF',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Avatar
          sx={{
            width: 44,
            height: 44,
            bgcolor: '#1C2027',
            color: '#FFFFFF',
            border: '2px solid #3B3F47',
            fontSize: '0.9rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {teamData.abbreviation}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography level="title-md" sx={{ fontWeight: 700, color: '#FFFFFF' }}>
            {teamData.city} {teamData.nickname}
          </Typography>
          <Typography level="body-sm" sx={{ color: '#B9BEC9' }}>
            {teamData.abbreviation}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, mt: 1.1, flexWrap: 'wrap' }}>
        <Typography level="body-sm" sx={{ color: '#E8EAF0' }}>
          <Box component="span" sx={{ fontWeight: 700, color: '#FFC72C' }}>Founded</Box> {teamData.year_founded}
        </Typography>
        <Typography level="body-sm" sx={{ color: '#E8EAF0' }}>
          <Box component="span" sx={{ fontWeight: 700, color: '#8BC1FF' }}>Coach</Box> {teamData.head_coach}
        </Typography>
      </Box>
    </Box>
  )

  return (
    <TeamPageLayout drawerModules={drawerModules} drawerHeaderContent={drawerHeaderContent}>
      <Box
        className="team-page-root"
        sx={{
          bgcolor: '#ffffff',
          minHeight: '100%',
          overflowX: 'hidden',
          overflowY: 'visible',
        }}
      >
        <Box
          className="team-page-content"
          sx={{
            maxWidth: CONTENT_MAX_WIDTH,
            mx: 'auto',
            px: 2,
            pt: isLandscapeMobile
              ? 0
              : { xs: 0, md: 0 },
            pb: 4,
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden',
            overflowY: 'visible',
          }}
        >
          {/* Header: title row + info bar */}
          <Box
            className="team-page-header"
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 5,
              bgcolor: '#ffffff',
              borderBottom: '1px solid',
              borderColor: 'divider',
              pt: 1,
              pb: 2,
              mb: 3,
              flexShrink: 0,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2, gap: 1.5 }}>
              <IconButton
                onClick={() => navigate(-1)}
                sx={{ '&:hover': { bgcolor: 'rgba(255, 215, 0, 0.1)' } }}
              >
                <ArrowBack />
              </IconButton>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: 'primary.500',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                }}
              >
                {teamData.abbreviation}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography level="h2" sx={{ fontWeight: 700 }}>
                  {teamData.city} {teamData.nickname}
                </Typography>
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>
                  {teamData.abbreviation}
                </Typography>
              </Box>
              {/* Estimated metrics (2025-26) */}
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: { xs: 1, sm: 1.5 },
                  typography: 'body-sm',
                  color: 'text.secondary',
                  py: 0.5,
                  px: 1,
                  borderRadius: 'sm',
                  bgcolor: 'background.level1',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {estimatedMetricsLoading && (
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>Loading…</Typography>
                )}
                {estimatedMetricsError && (
                  <Typography level="body-sm" sx={{ color: 'danger.500' }}>
                    {estimatedMetricsError instanceof Error ? estimatedMetricsError.message : 'Failed to load'}
                  </Typography>
                )}
                {!estimatedMetricsLoading && !estimatedMetricsError && estimatedMetrics && (() => {
                  const r = getEstimatedMetricsRow(estimatedMetrics.raw, teamData.team_id)
                  if (!r) return (
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>No metrics</Typography>
                  )
                  const num = (v: unknown): number | null => (v == null ? null : typeof v === 'number' ? v : parseFloat(String(v)))
                  const fmt = (v: unknown) => {
                    const n = num(v)
                    return n != null && Number.isFinite(n) ? n.toFixed(1) : (v != null ? String(v) : '—')
                  }
                  const fmtInt = (v: unknown) => {
                    const n = num(v)
                    return n != null && Number.isFinite(n) ? String(Math.round(n)) : (v != null ? String(v) : '—')
                  }
                  const pct = (v: unknown) => {
                    const n = num(v)
                    if (n == null || !Number.isFinite(n)) return v != null ? String(v) : '—'
                    const p = n > 1 ? n : n * 100
                    return `${p.toFixed(1)}%`
                  }
                  return (
                    <>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Record</Box> {fmtInt(r.W)}–{fmtInt(r.L)} ({pct(r.W_PCT)})</span>
                      <span sx={{ opacity: 0.6 }}>·</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>GP</Box> {fmtInt(r.GP)}</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Min</Box> {fmt(r.MIN)}</span>
                      <span sx={{ opacity: 0.6 }}>·</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Off Rtg</Box> {fmt(r.E_OFF_RATING)}</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Def Rtg</Box> {fmt(r.E_DEF_RATING)}</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Net Rtg</Box> {fmt(r.E_NET_RATING)}</span>
                      <span sx={{ opacity: 0.6 }}>·</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Pace</Box> {fmt(r.E_PACE)}</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>AST%</Box> {pct(r.E_AST_RATIO)}</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>OREB%</Box> {pct(r.E_OREB_PCT)}</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>DREB%</Box> {pct(r.E_DREB_PCT)}</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>REB%</Box> {pct(r.E_REB_PCT)}</span>
                      <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>TOV%</Box> {pct(r.E_TM_TOV_PCT)}</span>
                    </>
                  )
                })()}
              </Box>
              {user && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderRadius: 'sm',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isFavorite ? 'danger.50' : 'background.level1',
                  }}
                >
                  <IconButton
                    variant={isFavorite ? 'solid' : 'outlined'}
                    color={isFavorite ? 'danger' : 'neutral'}
                    size="sm"
                    sx={{ p: 0.5 }}
                    onClick={handleFavoriteToggle}
                    disabled={!user || toggleFavoriteMutation.isPending}
                    loading={toggleFavoriteMutation.isPending}
                  >
                    {isFavorite ? (
                      <Favorite sx={{ fontSize: '1.1rem' }} />
                    ) : (
                      <FavoriteBorder sx={{ fontSize: '1.1rem' }} />
                    )}
                  </IconButton>
                </Box>
              )}
            </Stack>

            {/* Info bar: team info (single nav strip) */}
            <Stack
              direction="row"
              flexWrap="wrap"
              gap={1.5}
              alignItems="center"
              sx={{
                typography: 'body-sm',
                color: 'text.secondary',
              }}
            >
              <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Founded</Box> {teamData.year_founded}</span>
              <span sx={{ opacity: 0.6 }}>·</span>
              <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Arena</Box> {teamData.arena}{teamData.arena_capacity ? ` (${teamData.arena_capacity.toLocaleString()})` : ''}</span>
              <span sx={{ opacity: 0.6 }}>·</span>
              <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Owner</Box> {teamData.owner}</span>
              {teamData.general_manager && (
                <>
                  <span sx={{ opacity: 0.6 }}>·</span>
                  <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>GM</Box> {teamData.general_manager}</span>
                </>
              )}
              <span sx={{ opacity: 0.6 }}>·</span>
              <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Head Coach</Box> {teamData.head_coach}</span>
              {teamData.d_league_affiliation && (
                <>
                  <span sx={{ opacity: 0.6 }}>·</span>
                  <span><Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>G League</Box> {teamData.d_league_affiliation}</span>
                </>
              )}
            </Stack>
          </Box>

          {/* Team Posts Feed */}
          <Box sx={{ mt: 2 }}>
            {feedPostsLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size="lg" sx={{ '--CircularProgress-trackColor': '#222', '--CircularProgress-progressColor': '#FFC72C' }} />
              </Box>
            )}

            {!feedPostsLoading && (!teamFeedPosts || teamFeedPosts.length === 0) && (
              <Box sx={{ textAlign: 'center', py: 8, px: 4 }}>
                <Typography level="h3" sx={{ color: '#FFFFFF', fontFamily: '"Libre Baskerville", serif', mb: 1 }}>
                  No stories yet
                </Typography>
                <Typography level="body-md" sx={{ color: '#888', maxWidth: 400, mx: 'auto' }}>
                  Stories featuring the {teamData.city} {teamData.nickname} will appear here.
                </Typography>
              </Box>
            )}

            {!feedPostsLoading && teamFeedPosts && teamFeedPosts.length > 0 && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                  },
                  gap: { xs: 2, md: 2.5 },
                }}
              >
                {teamFeedPosts.map((post) => (
                  <FeedCard
                    key={post.id}
                    post={post}
                    onClick={() => navigate(`/feed/${post.slug}`)}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </TeamPageLayout>
  )
}
