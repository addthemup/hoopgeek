import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Avatar, Chip } from '@mui/joy';

interface TeamLinkProps {
  team: {
    id: string;
    team_name: string;
    wins?: number;
    losses?: number;
    ties?: number;
    points_for?: number;
    points_against?: number;
    draft_position?: number;
  };
  leagueId: string;
  variant?: 'default' | 'compact' | 'minimal';
  showRecord?: boolean;
  showPoints?: boolean;
  showDraftPosition?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'neutral' | 'success' | 'warning' | 'danger';
}

export function TeamLink({ 
  team, 
  leagueId, 
  variant = 'default',
  showRecord = false,
  showPoints = false,
  showDraftPosition = false,
  size = 'md',
  color = 'primary'
}: TeamLinkProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/league/${leagueId}/team/${team.id}`);
  };

  const getAvatarSize = () => {
    switch (size) {
      case 'sm': return 'sm';
      case 'lg': return 'lg';
      default: return 'md';
    }
  };

  const getTypographyLevel = () => {
    switch (size) {
      case 'sm': return 'body-sm';
      case 'lg': return 'title-md';
      default: return 'body-md';
    }
  };

  if (variant === 'minimal') {
    return (
      <Typography
        level={getTypographyLevel()}
        color={color}
        sx={{ 
          cursor: 'pointer',
          textDecoration: 'underline',
          '&:hover': { 
            textDecoration: 'none',
            opacity: 0.8 
          }
        }}
        onClick={handleClick}
      >
        {team.team_name}
      </Typography>
    );
  }

  if (variant === 'compact') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          p: 1,
          borderRadius: 'sm',
          '&:hover': {
            bgcolor: 'background.level1',
          }
        }}
        onClick={handleClick}
      >
        <Avatar size={getAvatarSize()} sx={{ bgcolor: `${color}.500` }}>
          {team.team_name.charAt(0)}
        </Avatar>
        <Box>
          <Typography level={getTypographyLevel()} sx={{ fontWeight: 'bold' }}>
            {team.team_name}
          </Typography>
          {showRecord && (
            <Typography level="body-xs" color="neutral">
              {team.wins || 0}-{team.losses || 0}-{team.ties || 0}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // Default variant
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        cursor: 'pointer',
        p: 2,
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          bgcolor: 'background.level1',
          borderColor: `${color}.300`,
          transform: 'translateY(-1px)',
          transition: 'all 0.2s ease-in-out'
        }
      }}
      onClick={handleClick}
    >
      <Avatar size={getAvatarSize()} sx={{ bgcolor: `${color}.500` }}>
        {team.team_name.charAt(0)}
      </Avatar>
      <Box sx={{ flexGrow: 1 }}>
        <Typography level={getTypographyLevel()} sx={{ fontWeight: 'bold', mb: 0.5 }}>
          {team.team_name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {showRecord && (
            <Chip size="sm" variant="soft" color="neutral">
              {team.wins || 0}-{team.losses || 0}-{team.ties || 0}
            </Chip>
          )}
          {showPoints && (
            <Chip size="sm" variant="soft" color="success">
              {team.points_for || 0} PF
            </Chip>
          )}
          {showDraftPosition && team.draft_position && (
            <Chip size="sm" variant="soft" color="warning">
              Pick #{team.draft_position}
            </Chip>
          )}
        </Box>
      </Box>
    </Box>
  );
}
