import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  Avatar,
  Chip,
  Stack,
  Alert,
  Grid,
} from '@mui/joy';
import { useParams } from 'react-router-dom';
import { useTeamRoster } from '../hooks/useTeamRoster';
import { useTeams } from '../hooks/useTeams';
import { FantasyTeamPlayer } from '../types';
import TeamSchedule from '../components/TeamSchedule';

export default function TeamRoster() {
  const { id: leagueId } = useParams<{ id: string }>();
  const { data: teams } = useTeams(leagueId || '');
  
  // For now, show the first team's roster (in a real app, this would be the user's team)
  const userTeam = teams?.[0];
  const { data: roster, isLoading, error } = useTeamRoster(userTeam?.id || '');

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
      return `UTIL ${positionOrder - 7}`; // UTIL 1, UTIL 2, UTIL 3
    }
    if (position === 'BENCH') {
      return `BENCH ${positionOrder - 10}`; // BENCH 1, BENCH 2, BENCH 3
    }
    return position;
  };

  const formatSalary = (salary: number) => {
    if (salary >= 1000000) {
      return `$${(salary / 1000000).toFixed(1)}M`;
    }
    if (salary >= 1000) {
      return `$${(salary / 1000).toFixed(0)}K`;
    }
    return `$${salary}`;
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Loading roster...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert color="danger">
        <Typography>Error loading roster: {error.message}</Typography>
      </Alert>
    );
  }

  if (!userTeam) {
    return (
      <Alert color="warning">
        <Typography>No team found.</Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Team Header */}
      <Card
        variant="outlined"
        sx={{
          mb: 4,
          p: 3,
          background: 'linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)',
          color: 'white',
          boxShadow: 'lg',
        }}
      >
        <Grid container spacing={3} alignItems="center">
          <Grid xs={12} md={8}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ '--Avatar-size': '80px', border: '2px solid white', bgcolor: 'primary.500' }}>
                {userTeam.team_name.charAt(0)}
              </Avatar>
              <Box>
                <Typography level="h2" sx={{ color: 'white' }}>{userTeam.team_name}</Typography>
                <Typography level="body-md" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Owner: {userTeam.user_id ? 'awcarv@gmail.com' : 'TBD'}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    Gold 745
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    {userTeam.wins}-{userTeam.losses}-{userTeam.ties || 0}
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    2nd Place
                  </Chip>
                </Stack>
              </Box>
            </Stack>
          </Grid>
          <Grid xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Typography level="h3" sx={{ color: 'white', mb: 1 }}>{userTeam.points_for || 650.5} Total Pts</Typography>
            <Typography level="body-md" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Streak: W2
            </Typography>
          </Grid>
        </Grid>
      </Card>

      {/* Roster Table */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ overflowX: 'auto' }}>
            <Table hoverRow>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Position</th>
                  <th style={{ width: '200px' }}>Player</th>
                  <th style={{ width: '100px' }}>Team</th>
                  <th style={{ width: '80px' }}>Salary</th>
                  <th style={{ width: '60px' }}>MIN</th>
                  <th style={{ width: '60px' }}>PTS</th>
                  <th style={{ width: '60px' }}>REB</th>
                  <th style={{ width: '60px' }}>AST</th>
                  <th style={{ width: '60px' }}>STL</th>
                  <th style={{ width: '60px' }}>BLK</th>
                  <th style={{ width: '60px' }}>TO</th>
                  <th style={{ width: '80px' }}>Fantasy Pts</th>
                </tr>
              </thead>
              <tbody>
                {roster?.map((rosterSpot) => {
                  const player = rosterSpot.player;
                  const isEmpty = !player;
                  
                  return (
                    <tr key={rosterSpot.id}>
                      <td>
                        <Chip 
                          size="sm" 
                          color={getPositionColor(player?.position || rosterSpot.position)} 
                          variant="soft"
                        >
                          {player?.position || getPositionLabel(rosterSpot.position, rosterSpot.roster_spot?.position_order || 0)}
                        </Chip>
                      </td>
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar 
                            size="sm" 
                            sx={{ 
                              bgcolor: isEmpty ? 'neutral.300' : 'primary.500',
                              width: 32,
                              height: 32
                            }}
                          >
                            {isEmpty ? '?' : player?.name?.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                              {isEmpty ? 'Empty' : player?.name}
                            </Typography>
                            {player?.jersey_number && (
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                #{player.jersey_number}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {isEmpty ? '--' : player?.team_abbreviation || player?.team_name}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm">
                          {isEmpty ? '--' : formatSalary(player?.salary || 0)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : '0'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : '0'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : '0'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : '0'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : '0'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : '0'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : '0'}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {isEmpty ? '--' : '0.0'}
                        </Typography>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Box>
        </CardContent>
      </Card>

      {/* Roster Summary */}
      <Grid container spacing={2} sx={{ mt: 3 }}>
        <Grid xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h6" sx={{ mb: 2 }}>
                Roster Summary
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Total Players:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {roster?.filter(spot => spot.player).length || 0} / {roster?.length || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Starters:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {roster?.filter(spot => spot.is_starter && spot.player).length || 0} / 10
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Bench:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {roster?.filter(spot => !spot.is_starter && !spot.roster_spot?.is_injured_reserve && spot.player).length || 0} / 3
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">IR:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {roster?.filter(spot => spot.roster_spot?.is_injured_reserve && spot.player).length || 0} / 1
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h6" sx={{ mb: 2 }}>
                Salary Cap
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Used:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {formatSalary(userTeam.salary_cap_used)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Available:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {formatSalary(userTeam.salary_cap_max - userTeam.salary_cap_used)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Total:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {formatSalary(userTeam.salary_cap_max)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h6" sx={{ mb: 2 }}>
                Team Record
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Record:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {userTeam.wins}-{userTeam.losses}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Points For:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {userTeam.points_for.toFixed(1)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Points Against:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {userTeam.points_against.toFixed(1)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Team Schedule */}
      <Box sx={{ mt: 4 }}>
        <TeamSchedule teamId={userTeam.id} />
      </Box>
    </Box>
  );
}
