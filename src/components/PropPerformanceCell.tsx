import { useState } from 'react';
import { Box, Typography, Chip, Tooltip, Modal, ModalDialog, ModalClose, DialogTitle, Table } from '@mui/joy';
import { usePlayerLast10GamesProps } from '../hooks/usePlayerLast10GamesProps';
import { useOpponentTeamPropsPerformance } from '../hooks/useOpponentTeamPropsPerformance';

interface PropPerformanceCellProps {
  prop: {
    line: number;
    bet_type: string;
    nba_player_id: number;
    player_name: string;
  } | null;
  propResult: {
    actualValue: number;
    hit: boolean;
    result: 'over' | 'under' | 'push';
  } | null;
  gameState: 'upcoming' | 'live' | 'completed';
  opponentTeamTricode: string | null;
  isMobile: boolean;
  american_odds?: string;
  price?: string;
}

export default function PropPerformanceCell({
  prop,
  propResult,
  gameState,
  opponentTeamTricode,
  isMobile,
  american_odds,
  price,
}: PropPerformanceCellProps) {
  const [openModal, setOpenModal] = useState(false);

  // Fetch player's last 10 games performance (actual player_props lines per game)
  const { data: playerPerformance, isLoading: playerLoading } = usePlayerLast10GamesProps(
    prop?.nba_player_id || null,
    prop?.bet_type || '',
    !!prop && !!prop.bet_type && !!prop.nba_player_id,
    prop?.line != null ? Number(prop.line) : null
  );

  // Fetch opponent team's performance against this prop type
  const { data: opponentPerformance, isLoading: opponentLoading } = useOpponentTeamPropsPerformance(
    opponentTeamTricode,
    prop?.bet_type || '',
    !!opponentTeamTricode && !!prop?.bet_type
  );

  if (!prop) {
    return (
      <Typography sx={{ color: '#666666', fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
        -
      </Typography>
    );
  }

  const trailingModal = (
    <Modal open={openModal} onClose={() => setOpenModal(false)}>
      <ModalDialog
        sx={{ maxWidth: 420, bgcolor: '#1a1a1a', borderColor: '#333' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <ModalClose />
        <DialogTitle sx={{ color: '#FFFFFF' }}>
          Trailing props: {prop?.player_name} — {prop?.bet_type?.replace(/_/g, ' ')}
        </DialogTitle>
        <Box sx={{ pt: 0.5 }}>
          {playerLoading ? (
            <Typography sx={{ color: '#CCCCCC', fontSize: '0.875rem' }}>Loading...</Typography>
          ) : playerPerformance && playerPerformance.last10Games.length > 0 ? (
            <>
              <Typography level="body-sm" sx={{ color: '#CCCCCC', mb: 1 }}>
                Last {playerPerformance.total} games (actual prop lines) · {playerPerformance.hits}/{playerPerformance.total} hit over ({playerPerformance.hitRate != null ? playerPerformance.hitRate.toFixed(0) : '—'}%)
              </Typography>
              <Table size="sm" sx={{ '& th, & td': { color: '#ccc', fontSize: '0.75rem', py: 0.5 } }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Date</th>
                    <th style={{ textAlign: 'right' }}>Line</th>
                    <th style={{ textAlign: 'right' }}>Actual</th>
                    <th style={{ textAlign: 'center' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {playerPerformance.last10Games.map((row, idx) => (
                    <tr key={row.gameId + String(idx)}>
                      <td>{row.gameDate}</td>
                      <td style={{ textAlign: 'right' }}>{row.line ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{row.actualValue}</td>
                      <td style={{ textAlign: 'center' }}>
                        {row.result === 'over' ? (
                          <Typography component="span" sx={{ color: '#4CAF50', fontWeight: 600 }}>Over</Typography>
                        ) : row.result === 'under' ? (
                          <Typography component="span" sx={{ color: '#F44336', fontWeight: 600 }}>Under</Typography>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {opponentPerformance && opponentPerformance.hitRate != null && (
                <Typography level="body-sm" sx={{ color: '#CCCCCC', mt: 1.5 }}>
                  vs {opponentTeamTricode}: {opponentPerformance.hits}/{opponentPerformance.totalProps} hit over ({opponentPerformance.hitRate.toFixed(0)}%)
                </Typography>
              )}
            </>
          ) : (
            <Typography sx={{ color: '#CCCCCC', fontSize: '0.875rem' }}>
              No trailing prop data for this player and prop type.
            </Typography>
          )}
        </Box>
      </ModalDialog>
    </Modal>
  );

  const tooltipContent = (
    <Box sx={{ p: 1 }}>
      <Typography level="body-xs" sx={{ mb: 1, fontWeight: 'bold' }}>
        Performance History — click for game-by-game
      </Typography>
      {playerPerformance && playerPerformance.hitRate !== null && (
        <Typography level="body-xs" sx={{ mb: 0.5 }}>
          Player Last 10: {playerPerformance.hits}/{playerPerformance.total} ({playerPerformance.hitRate.toFixed(0)}%)
        </Typography>
      )}
      {opponentPerformance && opponentPerformance.hitRate !== null && (
        <Typography level="body-xs">
          vs {opponentTeamTricode}: {opponentPerformance.hits}/{opponentPerformance.totalProps} ({opponentPerformance.hitRate.toFixed(0)}%)
        </Typography>
      )}
      {(playerLoading || opponentLoading) && (
        <Typography level="body-xs" sx={{ color: '#CCCCCC', mt: 0.5 }}>
          Loading...
        </Typography>
      )}
    </Box>
  );

  const clickableCellSx = {
    cursor: 'pointer',
    display: 'inline-block',
    '&:hover': { opacity: 0.85 },
  };

  if (gameState === 'completed') {
    return (
      <>
        <Box onClick={() => setOpenModal(true)} sx={clickableCellSx}>
          <Tooltip title={tooltipContent} arrow placement="top">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: { xs: 0.25, md: 0.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, md: 0.5 } }}>
                <Typography sx={{ color: '#FFC72C', fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 600 }}>
                  {prop.line || 'N/A'}
                </Typography>
                <Typography sx={{ color: '#FFFFFF', fontSize: isMobile ? '0.6rem' : '0.7rem' }}>
                  /
                </Typography>
                <Typography sx={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 'bold' }}>
                  {propResult ? propResult.actualValue : 'N/A'}
                </Typography>
              </Box>
              {propResult && (
                <Chip
                  color={propResult.hit ? 'success' : 'danger'}
                  variant="solid"
                  size="sm"
                  sx={{ fontSize: isMobile ? '0.55rem' : '0.65rem', height: isMobile ? '16px' : '18px' }}
                >
                  {propResult.hit ? '✅' : '❌'}
                </Chip>
              )}
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
                {playerPerformance && playerPerformance.hitRate !== null && (
                  <Typography sx={{ color: playerPerformance.hitRate >= 60 ? '#4CAF50' : playerPerformance.hitRate <= 40 ? '#F44336' : '#FFC72C', fontSize: isMobile ? '0.5rem' : '0.6rem', fontWeight: 600 }}>
                    {playerPerformance.hits}/{playerPerformance.total}
                  </Typography>
                )}
                {opponentPerformance && opponentPerformance.hitRate !== null && (
                  <Typography sx={{ color: opponentPerformance.hitRate >= 60 ? '#4CAF50' : opponentPerformance.hitRate <= 40 ? '#F44336' : '#FFC72C', fontSize: isMobile ? '0.5rem' : '0.6rem', fontWeight: 600 }}>
                    vs {opponentTeamTricode}: {opponentPerformance.hitRate.toFixed(0)}%
                  </Typography>
                )}
              </Box>
            </Box>
          </Tooltip>
        </Box>
        {trailingModal}
      </>
    );
  }

  // For upcoming games, show prop line with performance history
  return (
    <>
      <Box onClick={() => setOpenModal(true)} sx={clickableCellSx}>
        <Tooltip title={tooltipContent} arrow placement="top">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: { xs: 0.125, md: 0.25 } }}>
            <Typography sx={{ color: '#FFC72C', fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 600 }}>
              {prop.line || 'N/A'}
            </Typography>
            <Typography sx={{ color: '#CCCCCC', fontSize: isMobile ? '0.55rem' : '0.65rem' }}>
              {american_odds || price || ''}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
              {playerPerformance && playerPerformance.hitRate !== null && (
                <Typography sx={{ color: playerPerformance.hitRate >= 60 ? '#4CAF50' : playerPerformance.hitRate <= 40 ? '#F44336' : '#FFC72C', fontSize: isMobile ? '0.5rem' : '0.6rem', fontWeight: 600 }}>
                  {playerPerformance.hits}/{playerPerformance.total}
                </Typography>
              )}
              {opponentPerformance && opponentPerformance.hitRate !== null && (
                <Typography sx={{ color: opponentPerformance.hitRate >= 60 ? '#4CAF50' : opponentPerformance.hitRate <= 40 ? '#F44336' : '#FFC72C', fontSize: isMobile ? '0.5rem' : '0.6rem', fontWeight: 600 }}>
                  vs {opponentTeamTricode}: {opponentPerformance.hitRate.toFixed(0)}%
                </Typography>
              )}
            </Box>
          </Box>
        </Tooltip>
      </Box>
      {trailingModal}
    </>
  );
}
