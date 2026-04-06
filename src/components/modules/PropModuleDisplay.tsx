/**
 * Shared display component for prop prediction / results data.
 *
 * Used by:
 * 1. PropPredictionsModule & PropPerformanceModule in Today.tsx (live data)
 * 2. PostStory.tsx for prop_module sections (frozen data)
 *
 * Renders the same table visual regardless of data source.
 */

import { useState, useMemo } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  Tabs,
  TabList,
  Tab,
  Avatar,
  Alert,
} from '@mui/joy'
import type { PropModuleEntry, PropModuleEmbedMode } from '../../types/feed'

function formatBetType(betType: string): string {
  const normalized = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+').replace(/-/g, '+')

  if (normalized.includes('points+rebounds+assists') || normalized === 'par' || normalized.includes('par')) return 'P+A+R'
  if (normalized.includes('points+rebounds') || normalized.includes('pts+reb')) return 'P+R'
  if (normalized.includes('points+assists') || normalized.includes('pts+ast')) return 'P+A'
  if (normalized.includes('rebounds+assists') || normalized.includes('reb+ast') || normalized.includes('assists+rebounds')) return 'R+A'
  if (normalized.includes('blocks+steals') || normalized === 'stocks' || normalized.includes('stocks') || normalized.includes('steals+blocks')) return 'STL+BLK'

  const single = normalized.replace(/\+/g, '')
  const map: Record<string, string> = {
    points: 'PTS', point: 'PTS', pts: 'PTS',
    rebounds: 'REB', rebound: 'REB', reb: 'REB',
    assists: 'AST', assist: 'AST', ast: 'AST',
    steals: 'STL', steal: 'STL', stl: 'STL',
    blocks: 'BLK', block: 'BLK', blk: 'BLK',
    turnovers: 'TOV', turnover: 'TOV', tov: 'TOV',
    threes: '3PM', three: '3PM', '3pt': '3PM', '3pm': '3PM',
    threepointersmade: '3PM',
    fieldgoalsmade: 'FGM', fgm: 'FGM',
    freethrowsmade: 'FTM', ftm: 'FTM',
  }
  return map[single] || betType.toUpperCase()
}

interface Props {
  props: PropModuleEntry[]
  teams: string[]
  date: string
  mode: 'prediction' | 'results'
  title?: string
  /** Drawer-style single view; omit for legacy tabbed module. */
  embedMode?: PropModuleEmbedMode
  compact?: boolean
  onPlayerClick?: (nbaPlayerId: number) => void
}

type MainTabValue = 'hit_rate' | 'team_confidence' | 'player_confidence'

export default function PropModuleDisplay({
  props,
  teams,
  date,
  mode,
  title,
  embedMode,
  compact = false,
  onPlayerClick,
}: Props) {
  const [activeTab, setActiveTab] = useState<'hottest' | 'coldest'>('hottest')
  const [mainTab, setMainTab] = useState<MainTabValue>('hit_rate')

  const isEmbed =
    embedMode === 'over' ||
    embedMode === 'under' ||
    embedMode === 'team_confidence' ||
    embedMode === 'player_confidence'

  const effectiveMainTab: MainTabValue =
    embedMode === 'team_confidence'
      ? 'team_confidence'
      : embedMode === 'player_confidence'
        ? 'player_confidence'
        : embedMode === 'over' || embedMode === 'under'
          ? 'hit_rate'
          : mainTab

  const effectiveHitTab: 'hottest' | 'coldest' =
    embedMode === 'over' ? 'hottest' : embedMode === 'under' ? 'coldest' : activeTab

  const embedHeading =
    embedMode === 'over'
      ? 'Props · Over'
      : embedMode === 'under'
        ? 'Props · Under'
        : embedMode === 'team_confidence'
          ? 'Props · Team conf'
          : embedMode === 'player_confidence'
            ? 'Props · Player conf'
            : null

  const hasConfidenceData =
    mode === 'prediction' &&
    props.some((p) => p.team_confidence != null || p.player_confidence != null)

  // Results mode: aggregate by player, sort by over hit rate (highest at top, lowest at bottom)
  const resultsByPlayer = useMemo(() => {
    if (mode !== 'results' || props.length === 0) return []
    const byPlayer = new Map<
      number,
      { nba_player_id: number; player_name: string; team_tricode: string; oversHit: number; undersHit: number; total: number }
    >()
    for (const p of props) {
      const key = p.nba_player_id
      if (!byPlayer.has(key)) {
        byPlayer.set(key, {
          nba_player_id: p.nba_player_id,
          player_name: p.player_name,
          team_tricode: p.team_tricode,
          oversHit: 0,
          undersHit: 0,
          total: 0,
        })
      }
      const row = byPlayer.get(key)!
      row.total += 1
      if (p.result === 'over') row.oversHit += 1
      if (p.result === 'under') row.undersHit += 1
    }
    return Array.from(byPlayer.values())
      .filter((r) => r.total > 0)
      .sort((a, b) => (b.total ? b.oversHit / b.total : 0) - (a.total ? a.oversHit / a.total : 0))
  }, [mode, props])

  const sortedProps = useMemo(() => {
    if (mode === 'results') {
      return []
    }
    if (effectiveMainTab !== 'hit_rate') {
      return []
    }
    return effectiveHitTab === 'hottest'
      ? [...props]
          .filter((p) => p.over_hit_rate != null || p.over_odds != null)
          .sort((a, b) => (b.over_hit_rate ?? -1) - (a.over_hit_rate ?? -1) || (b.line - a.line))
          .slice(0, 15)
      : [...props]
          .filter((p) => p.under_hit_rate != null || p.under_odds != null)
          .sort((a, b) => (b.under_hit_rate ?? -1) - (a.under_hit_rate ?? -1) || (a.line - b.line))
          .slice(0, 15)
  }, [props, mode, effectiveMainTab, effectiveHitTab])

  const teamConfidenceProps = useMemo(
    () =>
      hasConfidenceData
        ? [...props].filter((p) => p.team_confidence != null).sort((a, b) => (b.team_confidence ?? -1) - (a.team_confidence ?? -1))
        : [],
    [props, hasConfidenceData]
  )

  const playerConfidenceProps = useMemo(
    () =>
      hasConfidenceData
        ? [...props].filter((p) => p.player_confidence != null).sort((a, b) => (b.player_confidence ?? -1) - (a.player_confidence ?? -1))
        : [],
    [props, hasConfidenceData]
  )

  const content = (
    <>
      {isEmbed && mode === 'prediction' && embedHeading && (
        <Typography level="title-sm" sx={{ fontWeight: 800, color: '#CCC', letterSpacing: '0.06em', textTransform: 'uppercase', mb: 1.5 }}>
          {embedHeading}
        </Typography>
      )}
      {(title || (!isEmbed && mode !== 'results')) && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {title && (
            <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFF' }}>
              {title}
            </Typography>
          )}
          {!isEmbed && mode !== 'results' && !hasConfidenceData && (
            <Tabs value={activeTab} onChange={(_e, val) => setActiveTab(val as 'hottest' | 'coldest')}>
              <TabList>
                <Tab value="hottest">Hottest</Tab>
                <Tab value="coldest">Coldest</Tab>
              </TabList>
            </Tabs>
          )}
          {!isEmbed && hasConfidenceData && (
            <Tabs value={mainTab} onChange={(_e, val) => setMainTab(val as MainTabValue)}>
              <TabList>
                <Tab value="hit_rate">HR / 10</Tab>
                <Tab value="team_confidence">Team conf</Tab>
                <Tab value="player_confidence">Player conf</Tab>
              </TabList>
            </Tabs>
          )}
          {!isEmbed && hasConfidenceData && mainTab === 'hit_rate' && (
            <Tabs value={activeTab} onChange={(_e, val) => setActiveTab(val as 'hottest' | 'coldest')}>
              <TabList>
                <Tab value="hottest">Over</Tab>
                <Tab value="coldest">Under</Tab>
              </TabList>
            </Tabs>
          )}
        </Box>
      )}

      {mode === 'results' && resultsByPlayer.length > 0 ? (
        <Table hoverRow size="sm">
          <thead>
            <tr>
              <th style={{ color: '#FFF' }}>Name</th>
              <th style={{ color: '#FFF' }}>Over</th>
              <th style={{ color: '#FFF' }}>Under</th>
              <th style={{ color: '#FFF' }}>Total Lines</th>
              <th style={{ color: '#FFF' }}>Hit Rate</th>
            </tr>
          </thead>
          <tbody>
            {resultsByPlayer.map((row) => {
              const pct = row.total ? Math.round((row.oversHit / row.total) * 100) : 0
              return (
                <tr
                  key={row.nba_player_id}
                  style={{ cursor: onPlayerClick ? 'pointer' : 'default' }}
                  onClick={() => onPlayerClick?.(row.nba_player_id)}
                >
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        src={
                          row.nba_player_id > 0
                            ? `https://cdn.nba.com/headshots/nba/latest/260x190/${row.nba_player_id}.png`
                            : undefined
                        }
                        alt={row.player_name}
                        sx={{ width: 24, height: 24 }}
                      >
                        {row.player_name?.charAt(0) || '?'}
                      </Avatar>
                      <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
                        {row.player_name}
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#10B981', fontWeight: 600 }}>
                      {row.oversHit}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#EF4444', fontWeight: 600 }}>
                      {row.undersHit}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#CCC' }}>
                      {row.total}
                    </Typography>
                  </td>
                  <td>
                    <Typography
                      level="body-sm"
                      sx={{
                        color: pct >= 70 ? '#10B981' : pct >= 50 ? '#FFC72C' : '#CCC',
                        fontWeight: 600,
                      }}
                    >
                      {pct}%
                    </Typography>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      ) : hasConfidenceData && effectiveMainTab === 'team_confidence' && teamConfidenceProps.length > 0 ? (
        <Table hoverRow size="sm" sx={{ '& thead th': { color: '#FFF' }, '& tbody td': { color: '#CCC' } }}>
          <thead>
            <tr>
              <th style={{ color: '#FFF' }}>Player</th>
              <th style={{ color: '#FFF' }}>Prop</th>
              <th style={{ color: '#FFF' }}>Line</th>
              <th style={{ color: '#FFF' }}>Opposition stat</th>
              <th style={{ color: '#FFF' }}>Team conf</th>
              <th style={{ color: '#FFF' }}>Player conf</th>
            </tr>
          </thead>
          <tbody>
            {teamConfidenceProps.map((prop, idx) => (
              <tr
                key={`${prop.nba_player_id}-${prop.bet_type}-${idx}`}
                style={{ cursor: onPlayerClick ? 'pointer' : 'default' }}
                onClick={() => onPlayerClick?.(prop.nba_player_id)}
              >
                <td>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      src={prop.nba_player_id > 0 ? `https://cdn.nba.com/headshots/nba/latest/260x190/${prop.nba_player_id}.png` : undefined}
                      alt={prop.player_name}
                      sx={{ width: 24, height: 24 }}
                    >
                      {prop.player_name?.charAt(0) || '?'}
                    </Avatar>
                    <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
                      {prop.player_name}
                    </Typography>
                  </Box>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCC' }}>
                    {formatBetType(prop.bet_type)}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                    {typeof prop.line === 'number' ? prop.line.toFixed(1) : 'N/A'}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCC' }}>
                    {prop.player_offense_stat_value != null && prop.opposition_stat_value != null
                      ? `${prop.player_offense_stat_label ?? prop.opposition_stat_label ?? ''} ${prop.player_offense_stat_value} vs Opp ${prop.opposition_stat_value}`
                      : `${prop.opposition_stat_label ?? '—'}${prop.opposition_stat_value != null ? ` ${prop.opposition_stat_value}` : ' —'}`}
                  </Typography>
                </td>
                <td>
                  <Typography
                    level="body-sm"
                    sx={{
                      color:
                        prop.team_confidence != null && prop.team_confidence >= 7
                          ? '#10B981'
                          : prop.team_confidence != null && prop.team_confidence >= 4
                            ? '#FFC72C'
                            : '#CCC',
                      fontWeight: 600,
                    }}
                  >
                    {prop.team_confidence != null ? `${prop.team_confidence}/10` : '—'}
                  </Typography>
                </td>
                <td>
                  <Typography
                    level="body-sm"
                    sx={{
                      color:
                        prop.player_confidence != null && prop.player_confidence >= 7
                          ? '#10B981'
                          : prop.player_confidence != null && prop.player_confidence >= 4
                            ? '#FFC72C'
                            : '#CCC',
                      fontWeight: 600,
                    }}
                  >
                    {prop.player_confidence != null ? `${prop.player_confidence}/10` : '—'}
                  </Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : hasConfidenceData && effectiveMainTab === 'player_confidence' && playerConfidenceProps.length > 0 ? (
        <Table hoverRow size="sm" sx={{ '& thead th': { color: '#FFF' }, '& tbody td': { color: '#CCC' } }}>
          <thead>
            <tr>
              <th style={{ color: '#FFF' }}>Player</th>
              <th style={{ color: '#FFF' }}>Prop</th>
              <th style={{ color: '#FFF' }}>Line</th>
              <th style={{ color: '#FFF' }}>Opposition stat</th>
              <th style={{ color: '#FFF' }}>Player conf</th>
              <th style={{ color: '#FFF' }}>Team conf</th>
            </tr>
          </thead>
          <tbody>
            {playerConfidenceProps.map((prop, idx) => (
              <tr
                key={`${prop.nba_player_id}-${prop.bet_type}-${idx}`}
                style={{ cursor: onPlayerClick ? 'pointer' : 'default' }}
                onClick={() => onPlayerClick?.(prop.nba_player_id)}
              >
                <td>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      src={prop.nba_player_id > 0 ? `https://cdn.nba.com/headshots/nba/latest/260x190/${prop.nba_player_id}.png` : undefined}
                      alt={prop.player_name}
                      sx={{ width: 24, height: 24 }}
                    >
                      {prop.player_name?.charAt(0) || '?'}
                    </Avatar>
                    <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
                      {prop.player_name}
                    </Typography>
                  </Box>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCC' }}>
                    {formatBetType(prop.bet_type)}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                    {typeof prop.line === 'number' ? prop.line.toFixed(1) : 'N/A'}
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ color: '#CCC' }}>
                    {`${prop.opposition_stat_label ?? '—'}${prop.opposition_stat_value != null ? ` ${prop.opposition_stat_value}` : ' —'}`}
                  </Typography>
                </td>
                <td>
                  <Typography
                    level="body-sm"
                    sx={{
                      color:
                        prop.player_confidence != null && prop.player_confidence >= 7
                          ? '#10B981'
                          : prop.player_confidence != null && prop.player_confidence >= 4
                            ? '#FFC72C'
                            : '#CCC',
                      fontWeight: 600,
                    }}
                  >
                    {prop.player_confidence != null ? `${prop.player_confidence}/10` : '—'}
                  </Typography>
                </td>
                <td>
                  <Typography
                    level="body-sm"
                    sx={{
                      color:
                        prop.team_confidence != null && prop.team_confidence >= 7
                          ? '#10B981'
                          : prop.team_confidence != null && prop.team_confidence >= 4
                            ? '#FFC72C'
                            : '#CCC',
                      fontWeight: 600,
                    }}
                  >
                    {prop.team_confidence != null ? `${prop.team_confidence}/10` : '—'}
                  </Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : mode !== 'results' && sortedProps.length > 0 ? (
        <Table hoverRow size="sm">
          <thead>
            <tr>
              <th style={{ color: '#FFF' }}>Player</th>
              <th style={{ color: '#FFF' }}>Prop</th>
              <th style={{ color: '#FFF' }}>Line</th>
              {mode === 'prediction' && <th style={{ color: '#FFF' }}>Last 10 Hit Rate</th>}
              {mode === 'results' && <th style={{ color: '#FFF' }}>Actual</th>}
              <th style={{ color: '#FFF' }}>Odds</th>
            </tr>
          </thead>
          <tbody>
            {sortedProps.map((prop, idx) => {
              const hitRate = effectiveHitTab === 'hottest' ? prop.over_hit_rate : prop.under_hit_rate
              const hits = effectiveHitTab === 'hottest' ? prop.over_hits : prop.under_hits
              const displayOdds = effectiveHitTab === 'hottest' ? prop.over_odds : prop.under_odds

              return (
                <tr
                  key={`${prop.nba_player_id}-${prop.bet_type}-${idx}`}
                  style={{ cursor: onPlayerClick ? 'pointer' : 'default' }}
                  onClick={() => onPlayerClick?.(prop.nba_player_id)}
                >
                  <td>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        src={
                          prop.nba_player_id > 0
                            ? `https://cdn.nba.com/headshots/nba/latest/260x190/${prop.nba_player_id}.png`
                            : undefined
                        }
                        alt={prop.player_name}
                        sx={{ width: 24, height: 24 }}
                      >
                        {prop.player_name?.charAt(0) || '?'}
                      </Avatar>
                      <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
                        {prop.player_name}
                      </Typography>
                    </Box>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ color: '#CCC' }}>
                      {formatBetType(prop.bet_type)}
                    </Typography>
                  </td>
                  <td>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                        {typeof prop.line === 'number' ? prop.line.toFixed(1) : 'N/A'}
                      </Typography>
                      {prop.line_movement != null && prop.line_movement !== 0 && (
                        <Chip
                          size="sm"
                          variant="soft"
                          color={prop.line_movement > 0 ? 'success' : 'danger'}
                          sx={{ height: '16px', fontSize: '0.65rem' }}
                        >
                          {prop.line_movement > 0 ? '↑' : '↓'} {Math.abs(prop.line_movement).toFixed(1)}
                        </Chip>
                      )}
                    </Stack>
                  </td>

                  {mode === 'prediction' && (
                    <td>
                      <Typography
                        level="body-sm"
                        sx={{
                          color:
                            (hitRate ?? 0) >= 70
                              ? '#10B981'
                              : (hitRate ?? 0) >= 50
                                ? '#FFC72C'
                                : '#CCC',
                          fontWeight: 600,
                        }}
                      >
                        {hitRate != null ? `${hitRate.toFixed(1)}%` : 'N/A'}
                        {' '}({hits ?? 0}/{prop.last10_total ?? 0})
                      </Typography>
                    </td>
                  )}

                  {mode === 'results' && (
                    <td>
                      <Typography
                        level="body-sm"
                        sx={{
                          color: prop.result === 'over' ? '#10B981' : prop.result === 'under' ? '#EF4444' : '#CCC',
                          fontWeight: 600,
                        }}
                      >
                        {prop.actual != null ? prop.actual.toFixed(1) : 'N/A'}
                      </Typography>
                    </td>
                  )}

                  <td>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {effectiveHitTab === 'hottest' && displayOdds ? (
                        <Chip size="sm" variant="soft" color="success" sx={{ fontSize: '0.7rem', height: '18px' }}>
                          O {displayOdds}
                        </Chip>
                      ) : effectiveHitTab === 'coldest' && displayOdds ? (
                        <Chip size="sm" variant="soft" color="danger" sx={{ fontSize: '0.7rem', height: '18px' }}>
                          U {displayOdds}
                        </Chip>
                      ) : (
                        <Typography level="body-sm" sx={{ color: '#CCC' }}>
                          {displayOdds || 'N/A'}
                        </Typography>
                      )}
                    </Stack>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      ) : hasConfidenceData && (effectiveMainTab === 'team_confidence' || effectiveMainTab === 'player_confidence') ? (
        <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333' }}>
          <Typography sx={{ color: '#FFF' }}>
            No {effectiveMainTab === 'team_confidence' ? 'team' : 'player'} confidence data for this game.
          </Typography>
        </Alert>
      ) : (
        <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333' }}>
          <Typography sx={{ color: '#FFF' }}>
            {mode === 'results'
              ? `No prop results for ${teams.join(' vs ')}.`
              : `No ${effectiveHitTab === 'hottest' ? 'over' : 'under'} props available for ${teams.join(' vs ')}.`}
          </Typography>
        </Alert>
      )}
    </>
  )

  if (compact) return <Box>{content}</Box>

  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333', height: '100%' }}>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
