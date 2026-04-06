import { Fragment, useState } from 'react';
import { Avatar, Box, Chip, IconButton, Table, Typography } from '@mui/joy';
import { Add, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import type { EstimatedRotationPlayer } from '../../utils/minutesEstimator';

interface PlayerProp {
  id: string;
  player_name: string;
  nba_player_id: number;
  bet_type: string;
  line: number;
  american_odds?: string;
  price?: string;
  game_id?: string;
  game_date?: string;
}

interface EstimatedRotationModuleProps {
  rows: EstimatedRotationPlayer[];
  isLoading?: boolean;
  teamTricode: string;
  isMobile: boolean;
  propByPlayer: Map<number, PlayerProp>;
  canAddPlayerToSlip: (nbaPlayerId: number | null) => boolean;
  onAddProp: (prop: PlayerProp) => void;
}

export default function EstimatedRotationModule({
  rows,
  isLoading = false,
  teamTricode,
  isMobile,
  propByPlayer,
  canAddPlayerToSlip,
  onAddProp,
}: EstimatedRotationModuleProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography level="body-sm" sx={{ color: '#666' }}>
          Building estimated rotation...
        </Typography>
      </Box>
    );
  }

  if (!rows.length) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography level="body-sm" sx={{ color: '#666' }}>
          No rotation estimate available for {teamTricode}.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Table size="sm" sx={{ bgcolor: '#fff', width: '100%', minWidth: isMobile ? '520px' : '680px' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Player</th>
            <th style={{ textAlign: 'right' }}>Base Min</th>
            <th style={{ textAlign: 'right' }}>Injury Delta</th>
            <th style={{ textAlign: 'right' }}>Est Min</th>
            <th style={{ textAlign: 'center' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowKey = `${row.nba_player_id}-${row.player_name}`;
            const isExpanded = expandedRows.has(rowKey);
            const prop = row.nba_player_id != null ? propByPlayer.get(row.nba_player_id) : undefined;
            const canAdd = canAddPlayerToSlip(row.nba_player_id);
            const spreadSignals = row.signals.filter((signal) => signal.toLowerCase().includes('spread'));
            const otherSignals = row.signals.filter((signal) => !signal.toLowerCase().includes('spread'));
            const isRecentlyActiveOut = row.signals.some((signal) =>
              signal.toLowerCase().includes('rotation gap signal')
            );
            const signalText =
              [...spreadSignals, ...otherSignals].slice(0, 3).join(' · ') ||
              'Recent-minute trend';
            const confidenceStyles =
              row.confidence === 'high'
                ? { bg: '#dcfce7', fg: '#166534' }
                : row.confidence === 'medium'
                  ? { bg: '#fef3c7', fg: '#92400e' }
                  : { bg: '#e2e8f0', fg: '#334155' };
            return (
              <Fragment key={rowKey}>
                <tr
                  style={{
                    borderBottom: index === 4 && !isExpanded ? '2px solid #94a3b8' : '1px solid #e2e8f0',
                  }}
                >
                  <td style={{ minWidth: isMobile ? '120px' : '160px' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.2 }}>
                      <Typography sx={{ fontSize: isMobile ? '0.64rem' : '0.74rem', textAlign: 'center', fontWeight: 600 }}>
                        {row.player_name}
                      </Typography>
                      <Avatar
                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${row.nba_player_id}.png`}
                        alt={row.player_name}
                        sx={{ width: { xs: 24, md: 30 }, height: { xs: 24, md: 30 }, flexShrink: 0 }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4 }}>
                        {(row.jersey_number || row.position) && (
                          <Typography sx={{ color: '#64748b', fontSize: isMobile ? '0.55rem' : '0.65rem', lineHeight: 1 }}>
                            {row.jersey_number ? `#${row.jersey_number}` : ''}
                            {row.jersey_number && row.position ? ' • ' : ''}
                            {row.position || ''}
                          </Typography>
                        )}
                        {isRecentlyActiveOut && (
                          <Chip
                            size="sm"
                            color="danger"
                            variant="solid"
                            sx={{
                              fontSize: '0.54rem',
                              fontWeight: 700,
                              bgcolor: '#dc2626 !important',
                              color: '#ffffff !important',
                            }}
                          >
                            OUT
                          </Chip>
                        )}
                      </Box>
                    </Box>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: isMobile ? '0.64rem' : '0.72rem' }}>{row.baseline_minutes.toFixed(1)}</td>
                  <td style={{ textAlign: 'right', color: row.injury_delta_minutes >= 0 ? '#16a34a' : '#dc2626', fontSize: isMobile ? '0.64rem' : '0.72rem' }}>
                    {row.injury_delta_minutes >= 0 ? '+' : ''}
                    {row.injury_delta_minutes.toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d4ed8', fontSize: isMobile ? '0.66rem' : '0.75rem' }}>
                    {row.estimated_minutes.toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() => toggleExpanded(rowKey)}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${row.player_name} details`}
                    >
                      {isExpanded ? <KeyboardArrowUp sx={{ fontSize: 18 }} /> : <KeyboardArrowDown sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </td>
                </tr>
                {isExpanded && (
                  <tr
                    key={`${rowKey}-expanded`}
                    style={{
                      borderBottom: index === 4 ? '2px solid #94a3b8' : '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                    }}
                  >
                    <td colSpan={5} style={{ padding: isMobile ? '8px 10px' : '10px 12px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                        <Chip
                          size="sm"
                          variant="solid"
                          sx={{
                            textTransform: 'uppercase',
                            fontSize: '0.58rem',
                            bgcolor: confidenceStyles.bg,
                            color: confidenceStyles.fg,
                          }}
                        >
                          {row.confidence}
                        </Chip>
                        {prop ? (
                          <IconButton
                            size="sm"
                            variant="soft"
                            color="neutral"
                            disabled={!canAdd}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddProp(prop);
                            }}
                            aria-label={`Add ${row.player_name} prop to slip`}
                          >
                            <Add sx={{ fontSize: 16 }} />
                          </IconButton>
                        ) : (
                          <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8' }}>No prop</Typography>
                        )}
                      </Box>
                      <Typography sx={{ mt: 0.8, fontSize: isMobile ? '0.62rem' : '0.7rem', color: '#475569' }}>
                        {signalText}
                      </Typography>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </Table>
    </Box>
  );
}
