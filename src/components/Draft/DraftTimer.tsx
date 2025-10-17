import React from 'react';
import { Box, Typography, Chip } from '@mui/joy';
import { Timer } from '@mui/icons-material';
import { useDraftTimer } from '../../hooks/useDraftTimer';

interface DraftTimerProps {
  leagueId: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export default function DraftTimer({ leagueId, size = 'md', showIcon = true }: DraftTimerProps) {
  const { timeRemaining, formattedTime, isActive, isDraftStarted, isDraftPaused } = useDraftTimer(leagueId);

  if (!isDraftStarted) {
    return null;
  }

  const getColor = () => {
    if (isDraftPaused) return 'neutral';
    if (timeRemaining <= 10) return 'danger';
    if (timeRemaining <= 30) return 'warning';
    return 'success';
  };

  const getSize = () => {
    switch (size) {
      case 'sm': return 'sm';
      case 'lg': return 'lg';
      default: return 'md';
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {showIcon && <Timer sx={{ fontSize: size === 'lg' ? '1.5rem' : '1rem' }} />}
      
      <Chip
        color={getColor()}
        size={getSize()}
        variant="soft"
        sx={{
          fontWeight: 'bold',
          animation: timeRemaining <= 10 && isActive ? 'blink 1s infinite' : 'none',
          '@keyframes blink': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.5 }
          }
        }}
      >
        {isDraftPaused ? 'PAUSED' : formattedTime}
      </Chip>
      
      {isDraftPaused && (
        <Typography level="body-sm" color="neutral">
          Draft is paused
        </Typography>
      )}
    </Box>
  );
}
