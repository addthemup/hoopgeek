/**
 * Shared display for Tank tab (draft race) — frozen data.
 * Used by PostStory for tank_module sections and can be used by
 * StandingsModule when given frozen data.
 */

import { Box, Typography, Card, CardContent, Table, Avatar } from '@mui/joy'
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos'
import type { TankModuleContent, TankRowEntry } from '../../types/feed'

interface Props {
  rows: TankRowEntry[]
  season?: string
  snapshotDate?: string
  title?: string
  compact?: boolean
  onTeamClick?: (teamInternalId: string | undefined, teamAbbreviation: string) => void
  onProspectClick?: (prospectId: string) => void
}

export default function TankModuleDisplay({
  rows,
  season,
  snapshotDate,
  title = 'Tank Race',
  compact = false,
  onTeamClick,
  onProspectClick,
}: Props) {
  const tableCell = (children: React.ReactNode, sx = {}) => (
    <td>
      <Typography level="body-sm" sx={{ color: '#E0E0E0', ...sx }}>
        {children}
      </Typography>
    </td>
  )

  const content = (
    <>
      {(title || season || snapshotDate) && (
        <Box sx={{ mb: 2 }}>
          {title && (
            <Typography level="h4" sx={{ color: '#FFF', fontWeight: 700, mb: 0.5 }}>
              {title}
            </Typography>
          )}
          {(season || snapshotDate) && (
            <Typography level="body-sm" sx={{ color: '#999' }}>
              {[season, snapshotDate].filter(Boolean).join(' · ')}
            </Typography>
          )}
        </Box>
      )}

      {rows.length === 0 ? (
        <Typography level="body-sm" sx={{ color: '#888' }}>
          No tank data for this snapshot.
        </Typography>
      ) : (
        <Table hoverRow size="sm">
          <thead>
            <tr>
              <th style={{ color: '#FFFFFF', width: 36 }}>Pick</th>
              <th style={{ color: '#FFFFFF', width: 56 }}></th>
              <th style={{ color: '#FFFFFF' }}>Prospect</th>
              <th style={{ color: '#FFFFFF', textAlign: 'right' }}>GB</th>
              <th style={{ color: '#FFFFFF', textAlign: 'right' }}>#1 Ovr</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.pick}-${row.team_id}`}
                style={{ cursor: onTeamClick ? 'pointer' : 'default' }}
                onClick={() => onTeamClick?.(row.team_internal_id, row.team_abbreviation)}
              >
                <td>
                  <Typography level="body-sm" sx={{ color: '#E0E0E0', fontWeight: 600 }}>
                    {row.pick}
                  </Typography>
                </td>
                <td>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                    <Avatar
                      src={getTeamLogoUrl(row.team_abbreviation)}
                      alt={row.team_abbreviation}
                      sx={{ width: 28, height: 28 }}
                    >
                      {row.team_abbreviation.charAt(0)}
                    </Avatar>
                    <Typography level="body-xs" sx={{ color: '#E0E0E0' }}>
                      {row.wins}-{row.losses}
                    </Typography>
                  </Box>
                </td>
                <td
                  onClick={(e) => {
                    e.stopPropagation()
                    if (row.prospect?.id) onProspectClick?.(row.prospect.id)
                  }}
                  style={{ cursor: row.prospect?.id && onProspectClick ? 'pointer' : 'default' }}
                >
                  {row.prospect ? (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.25,
                        py: 0.5,
                        '&:hover': onProspectClick && row.prospect?.id ? { '& .prospect-name': { color: '#FFC72C', textDecoration: 'underline' } } : {},
                      }}
                    >
                      <Typography className="prospect-name" level="body-sm" sx={{ color: '#E0E0E0', fontWeight: 600 }}>
                        {row.prospect.player_name_full}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#888' }}>
                        {row.prospect.school_team || '—'}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: '#888' }}>
                        {row.prospect.position_primary || '—'}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography level="body-sm" sx={{ color: '#888' }}>
                      —
                    </Typography>
                  )}
                </td>
                {tableCell(row.tank_gb === 0 ? '—' : row.tank_gb.toFixed(1), { textAlign: 'right' })}
                {tableCell(row.one_ovr_pct != null ? `${row.one_ovr_pct}%` : '—', { textAlign: 'right' })}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )

  if (compact) return <Box>{content}</Box>

  return (
    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: '100%' }}>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
