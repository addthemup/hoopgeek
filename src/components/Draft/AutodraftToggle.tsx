import React from 'react';
import { Box, Switch, Typography, Chip, Tooltip } from '@mui/joy';
import { useToggleTeamAutodraft } from '../../hooks/useTeamAutodraft';
import { useAuth } from '../../hooks/useAuth';
import { useTeams } from '../../hooks/useTeams';

interface AutodraftToggleProps {
  leagueId: string;
  teamId?: string;
  isCommissioner?: boolean;
  size?: 'sm' | 'md';
}

export default function AutodraftToggle({ 
  leagueId, 
  teamId, 
  isCommissioner = false, 
  size = 'md' 
}: AutodraftToggleProps) {
  const { user } = useAuth();
  const { data: teams } = useTeams(leagueId);
  const toggleAutodraft = useToggleTeamAutodraft();

  // Find the team to show autodraft status for
  const targetTeam = teamId 
    ? teams?.find(t => t.id === teamId)
    : teams?.find(t => t.user_id === user?.id);

  if (!targetTeam) {
    return null;
  }

  const canToggle = isCommissioner || targetTeam.user_id === user?.id;
  const isEnabled = targetTeam.autodraft_enabled;

  const handleToggle = () => {
    if (!canToggle) return;
    
    toggleAutodraft.mutate({
      teamId: targetTeam.id,
      enabled: !isEnabled,
      leagueId
    });
  };

  const getColor = () => {
    if (isEnabled) return 'success';
    return 'neutral';
  };

  const getVariant = () => {
    if (isEnabled) return 'soft';
    return 'outlined';
  };

  if (size === 'sm') {
    return (
      <Tooltip title={canToggle ? `Click to ${isEnabled ? 'disable' : 'enable'} autodraft` : 'Autodraft status'}>
        <Chip
          color={getColor()}
          variant={getVariant()}
          size="sm"
          sx={{ 
            cursor: canToggle ? 'pointer' : 'default',
            opacity: canToggle ? 1 : 0.7
          }}
          onClick={canToggle ? handleToggle : undefined}
        >
          🤖 {isEnabled ? 'ON' : 'OFF'}
        </Chip>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography level="body-sm" color="neutral">
        Auto-draft:
      </Typography>
      <Switch
        checked={isEnabled}
        onChange={handleToggle}
        disabled={!canToggle || toggleAutodraft.isPending}
        color={isEnabled ? 'success' : 'neutral'}
        size="sm"
      />
      <Typography level="body-sm" color={isEnabled ? 'success' : 'neutral'}>
        {isEnabled ? 'Enabled' : 'Disabled'}
      </Typography>
    </Box>
  );
}
