/**
 * Shared display component for injury data.
 *
 * Used by:
 * 1. InjuriesModule in Today.tsx (live data)
 * 2. PostStory.tsx for injury_module sections (frozen data)
 *
 * Renders the same table + progress-bar visual regardless of data source.
 */

import { useState, useMemo, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  Avatar,
  Alert,
} from '@mui/joy'
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos'
import type { InjuryModuleEntry, InjuryProgressSegment } from '../../types/feed'

const STATUS_COLOR_MAP: Record<string, 'danger' | 'warning' | 'neutral'> = {
  Out: 'danger',
  Doubtful: 'warning',
  Questionable: 'warning',
  'Day-to-Day': 'warning',
}

const PROGRESS_COLORS: Record<string, string> = {
  Healthy: '#10B981',
  Out: '#EF4444',
  Questionable: '#FF6B35',
  Probable: '#FFC72C',
}

interface Props {
  injuries: InjuryModuleEntry[]
  teams: string[]
  date: string
  title?: string
  /** Compact mode for embedded-in-post rendering (no outer card wrapper) */
  compact?: boolean
  onPlayerClick?: (nbaPlayerId: number) => void
}

export default function InjuryModuleDisplay({
  injuries,
  teams,
  date,
  title,
  compact = false,
  onPlayerClick,
}: Props) {
  const grouped = useMemo(() => {
    const result: Record<string, InjuryModuleEntry[]> = {
      Out: [],
      Doubtful: [],
      Questionable: [],
      'Day-to-Day': [],
    }
    for (const inj of injuries) {
      const bucket = result[inj.injury_status]
      if (bucket) bucket.push(inj)
      else {
        if (!result[inj.injury_status]) result[inj.injury_status] = []
        result[inj.injury_status].push(inj)
      }
    }
    return result
  }, [injuries])

  const availableStatuses = useMemo(() => {
    const statuses: string[] = []
    if ((grouped.Out?.length ?? 0) > 0) statuses.push('Out')
    if ((grouped.Doubtful?.length ?? 0) > 0) statuses.push('Doubtful')
    if ((grouped.Questionable?.length ?? 0) > 0) statuses.push('Questionable')
    if ((grouped['Day-to-Day']?.length ?? 0) > 0) statuses.push('Day-to-Day')
    return statuses
  }, [grouped])

  const [selectedStatus, setSelectedStatus] = useState('Out')

  useEffect(() => {
    if (availableStatuses.length > 0 && !availableStatuses.includes(selectedStatus)) {
      setSelectedStatus(availableStatuses[0])
    }
  }, [availableStatuses, selectedStatus])

  const visible = grouped[selectedStatus] || []

  const statusLabel = (s: string) => (s === 'Out' ? 'O' : s === 'Questionable' ? 'Q' : s)

  const content = (
    <>
      {title && (
        <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 2 }}>
          {title}
          {date && (
            <Typography level="body-xs" component="span" sx={{ color: '#999', ml: 1 }}>
              ({date})
            </Typography>
          )}
        </Typography>
      )}

      {availableStatuses.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {availableStatuses.map((status) => (
            <Chip
              key={status}
              size="md"
              color={STATUS_COLOR_MAP[status] ?? 'neutral'}
              variant={selectedStatus === status ? 'solid' : 'soft'}
              onClick={() => setSelectedStatus(status)}
              sx={{ cursor: 'pointer', fontWeight: selectedStatus === status ? 'bold' : 'normal' }}
            >
              {statusLabel(status)} ({grouped[status]?.length ?? 0})
            </Chip>
          ))}
        </Stack>
      )}

      {availableStatuses.length === 0 ? (
        <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333' }}>
          <Typography sx={{ color: '#FFF' }}>No injuries reported for {teams.join(' vs ')}.</Typography>
        </Alert>
      ) : (
        <Table hoverRow size="sm">
          <tbody>
            {visible.map((inj) => (
              <tr
                key={`${inj.nba_player_id}-${inj.injury_status}`}
                style={{ cursor: onPlayerClick ? 'pointer' : 'default' }}
                onClick={() => onPlayerClick?.(inj.nba_player_id)}
              >
                <td style={{ width: '100%' }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography level="body-sm" sx={{ color: '#FFF', fontWeight: 600 }}>
                        {inj.player_name}
                      </Typography>
                      <Chip size="sm" color={STATUS_COLOR_MAP[inj.injury_status] ?? 'neutral'} variant="soft">
                        {inj.injury_status}
                      </Chip>
                      {inj.team_tricode && (
                        <Avatar
                          src={getTeamLogoUrl(inj.team_tricode)}
                          alt={inj.team_tricode}
                          sx={{ width: 20, height: 20 }}
                        >
                          {inj.team_tricode.charAt(0)}
                        </Avatar>
                      )}
                    </Stack>

                    {inj.progress_segments.length > 0 && (
                      <Box sx={{ position: 'relative', width: '100%', height: 20, borderRadius: '4px', overflow: 'hidden' }}>
                        {inj.progress_segments.map((seg: InjuryProgressSegment, idx: number) => (
                          <Box
                            key={idx}
                            sx={{
                              position: 'absolute',
                              left: `${seg.startPercent}%`,
                              width: `${seg.widthPercent}%`,
                              height: '100%',
                              bgcolor: PROGRESS_COLORS[seg.status] ?? '#666',
                              borderRadius:
                                idx === 0 && idx === inj.progress_segments.length - 1
                                  ? '4px'
                                  : idx === 0
                                    ? '4px 0 0 4px'
                                    : idx === inj.progress_segments.length - 1
                                      ? '0 4px 4px 0'
                                      : '0',
                            }}
                            title={`${seg.status}: ${seg.startPercent.toFixed(1)}% – ${(seg.startPercent + seg.widthPercent).toFixed(1)}%`}
                          />
                        ))}
                      </Box>
                    )}

                    {inj.injury_type && (
                      <Typography level="body-xs" sx={{ color: '#CCC' }}>
                        {inj.injury_type.replace(/^Injury\/Illness\s*-\s*/i, '')}
                      </Typography>
                    )}
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
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
