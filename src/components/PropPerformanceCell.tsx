import { useState } from 'react';
import { Box, Typography, Chip, Tooltip, Modal, ModalDialog, ModalClose, DialogTitle, Table, Button } from '@mui/joy';
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
  compact?: boolean;
  cellButton?: boolean;
}

export default function PropPerformanceCell({
  prop,
  propResult,
  gameState,
  opponentTeamTricode,
  isMobile,
  american_odds,
  price,
  compact = false,
  cellButton = false,
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

  const getHitRateOutlineColor = (): string => {
    const rates = [playerPerformance?.hitRate, opponentPerformance?.hitRate].filter(
      (value): value is number => typeof value === 'number'
    );
    if (rates.length === 0) return 'rgba(148, 163, 184, 0.45)';
    const avg = rates.reduce((sum, value) => sum + value, 0) / rates.length;
    if (avg >= 60) return 'rgba(22, 163, 74, 0.7)';
    if (avg <= 40) return 'rgba(220, 38, 38, 0.7)';
    return 'rgba(217, 119, 6, 0.7)';
  };

  if (cellButton) {
    const playerRateText =
      playerPerformance && playerPerformance.hitRate !== null
        ? `${playerPerformance.hits}/${playerPerformance.total} (${playerPerformance.hitRate.toFixed(0)}%)`
        : 'Last 10: --';

    return (
      <>
        <Tooltip title={tooltipContent} arrow placement="top">
          <Button
            variant="soft"
            onClick={(e) => {
              e.stopPropagation();
              setOpenModal(true);
            }}
            sx={{
              width: '100%',
              minHeight: isMobile ? 84 : 102,
              borderRadius: 8,
              px: isMobile ? 0.8 : 1.1,
              py: isMobile ? 0.65 : 0.9,
              bgcolor: '#ffffff',
              border: '2px solid',
              borderColor: getHitRateOutlineColor(),
              color: '#0f172a',
              textTransform: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.2,
              '&:hover': { bgcolor: '#f8fafc' },
            }}
          >
            <Typography sx={{ color: '#0f172a', fontSize: isMobile ? '1.35rem' : '1.8rem', fontWeight: 900, lineHeight: 1 }}>
              {prop.line || 'N/A'}
            </Typography>
            <Typography sx={{ color: '#64748b', fontSize: isMobile ? '0.62rem' : '0.72rem', lineHeight: 1.1 }}>
              {american_odds || price || ''}
            </Typography>
            <Typography sx={{ color: '#334155', fontSize: isMobile ? '0.58rem' : '0.68rem', fontWeight: 700, lineHeight: 1.1 }}>
              {playerRateText}
            </Typography>
          </Button>
        </Tooltip>
        {trailingModal}
      </>
    );
  }

  if (gameState === 'completed') {
    if (compact) {
      return (
        <>
          <Box
            onClick={() => setOpenModal(true)}
            sx={{
              ...clickableCellSx,
              border: '1px solid',
              borderColor: getHitRateOutlineColor(),
              borderRadius: 6,
              px: 0.5,
              py: 0.25,
            }}
          >
            <Tooltip title={tooltipContent} arrow placement="top">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ color: '#FFC72C', fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 600 }}>
                  {prop.line || 'N/A'}
                </Typography>
                <Typography sx={{ color: '#FFFFFF', fontSize: isMobile ? '0.6rem' : '0.7rem' }}>/</Typography>
                <Typography sx={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 'bold' }}>
                  {propResult ? propResult.actualValue : 'N/A'}
                </Typography>
                {propResult && (
                  <Chip
                    color={propResult.hit ? 'success' : 'danger'}
                    variant="soft"
                    size="sm"
                    sx={{ fontSize: isMobile ? '0.5rem' : '0.6rem', height: isMobile ? '16px' : '18px' }}
                  >
                    {propResult.hit ? 'Hit' : 'Miss'}
                  </Chip>
                )}
              </Box>
            </Tooltip>
          </Box>
          {trailingModal}
        </>
      );
    }

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
  if (compact) {
    return (
      <>
        <Box
          onClick={() => setOpenModal(true)}
          sx={{
            ...clickableCellSx,
            border: '1px solid',
            borderColor: getHitRateOutlineColor(),
            borderRadius: 6,
            px: 0.5,
            py: 0.25,
          }}
        >
          <Tooltip title={tooltipContent} arrow placement="top">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ color: '#FFC72C', fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 600 }}>
                {prop.line || 'N/A'}
              </Typography>
              {!!(american_odds || price) && (
                <Typography sx={{ color: '#94a3b8', fontSize: isMobile ? '0.55rem' : '0.65rem' }}>
                  ({american_odds || price})
                </Typography>
              )}
            </Box>
          </Tooltip>
        </Box>
        {trailingModal}
      </>
    );
  }

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
