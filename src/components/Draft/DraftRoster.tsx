import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Select,
  Option,
  Grid,
  Avatar,
  Chip,
  Stack,
  Alert,
  LinearProgress,
} from '@mui/joy';
import { useTeams } from '../../hooks/useTeams';
import { useTeamRoster } from '../../hooks/useTeamRoster';
import { FantasyTeam } from '../../types';

interface DraftRosterProps {
  leagueId: string;
}

export default function DraftRoster({ leagueId }: DraftRosterProps) {
  const { data: teams, isLoading: teamsLoading } = useTeams(leagueId);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  // Get the first team as default if no team is selected
  React.useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const { data: roster, isLoading: rosterLoading } = useTeamRoster(selectedTeamId);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'PG':
      case 'SG':
      case 'G':
        return 'primary';
      case 'SF':
      case 'PF':
      case 'F':
        return 'success';
      case 'C':
        return 'warning';
      case 'UTIL':
        return 'neutral';
      case 'BENCH':
        return 'secondary';
      case 'IR':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const getPositionLabel = (position: string, positionOrder: number) => {
    if (position === 'UTIL') {
      return `UTIL ${positionOrder - 7}`;
    }
    if (position === 'BENCH') {
      return `BENCH ${positionOrder - 10}`;
    }
    return position;
  };

  if (teamsLoading || rosterLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <LinearProgress />
        <Typography sx={{ ml: 2 }}>Loading roster...</Typography>
      </Box>
    );
  }

  if (!teams || teams.length === 0) {
    return (
      <Alert color="warning">
        <Typography>No teams found in this league.</Typography>
      </Alert>
    );
  }

  const selectedTeam = teams.find(team => team.id === selectedTeamId);

  return (
    <Box>
      {/* Team Selector */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography level="h6" sx={{ mb: 2 }}>
            Select Team
          </Typography>
          <Select
            value={selectedTeamId}
            onChange={(_, value) => setSelectedTeamId(value as string)}
            placeholder="Choose a team..."
            size="sm"
          >
            {teams.map((team) => (
              <Option key={team.id} value={team.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                    {team.team_name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {team.team_name}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {team.user_id ? 'Owner Assigned' : 'TBD'}
                    </Typography>
                  </Box>
                </Box>
              </Option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {/* Roster Display */}
      {selectedTeam && (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.500', width: 40, height: 40 }}>
                {selectedTeam.team_name.charAt(0)}
              </Avatar>
              <Box>
                <Typography level="h6" sx={{ fontWeight: 'bold' }}>
                  {selectedTeam.team_name}
                </Typography>
                <Typography level="body-sm" color="neutral">
                  {selectedTeam.user_id ? 'Owner Assigned' : 'TBD'} • {selectedTeam.wins}-{selectedTeam.losses}
                </Typography>
              </Box>
            </Box>

            {/* Roster Grid */}
            <Grid container spacing={1}>
              {roster?.map((rosterSpot) => {
                const player = rosterSpot.player;
                const isEmpty = !player;
                
                return (
                  <Grid xs={6} sm={4} md={3} key={rosterSpot.id}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        height: '100%',
                        minHeight: '120px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        p: 1,
                        bgcolor: isEmpty ? 'neutral.50' : 'background.surface'
                      }}
                    >
                      <Chip 
                        size="sm" 
                        color={getPositionColor(player?.position || rosterSpot.position)} 
                        variant="soft"
                        sx={{ mb: 1 }}
                      >
                        {player?.position || getPositionLabel(rosterSpot.position, rosterSpot.roster_spot?.position_order || 0)}
                      </Chip>
                      
                      <Avatar 
                        size="md" 
                        sx={{ 
                          bgcolor: isEmpty ? 'neutral.300' : 'primary.500',
                          width: 48,
                          height: 48,
                          mb: 1
                        }}
                      >
                        {isEmpty ? '?' : player?.name?.charAt(0)}
                      </Avatar>
                      
                      <Typography 
                        level="body-sm" 
                        sx={{ 
                          fontWeight: 'bold',
                          textAlign: 'center',
                          fontSize: '0.8rem'
                        }}
                      >
                        {isEmpty ? 'Empty' : player?.name}
                      </Typography>
                      
                      {player && (
                        <Typography 
                          level="body-xs" 
                          color="neutral"
                          sx={{ textAlign: 'center' }}
                        >
                          {player.team_abbreviation || player.team_name}
                        </Typography>
                      )}
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            {/* Roster Summary */}
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={2} justifyContent="space-around">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography level="h6" sx={{ fontWeight: 'bold' }}>
                    {roster?.filter(spot => spot.player).length || 0}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    Players
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography level="h6" sx={{ fontWeight: 'bold' }}>
                    {roster?.filter(spot => spot.is_starter && spot.player).length || 0}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    Starters
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography level="h6" sx={{ fontWeight: 'bold' }}>
                    {roster?.filter(spot => !spot.is_starter && !spot.roster_spot?.is_injured_reserve && spot.player).length || 0}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    Bench
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
