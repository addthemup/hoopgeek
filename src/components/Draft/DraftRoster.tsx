import React, { useState, useMemo } from 'react';
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
  Divider,
  List,
  ListItem,
  ListItemDecorator,
  ListItemContent,
} from '@mui/joy';
import { CheckCircle, Schedule, SwapHoriz, Cancel } from '@mui/icons-material';
import { useTeams } from '../../hooks/useTeams';
import { useTeamRoster } from '../../hooks/useTeamRoster';
import { useLeague } from '../../hooks/useLeagues';
import { useDraftOrder } from '../../hooks/useDraftOrder';
import { supabase } from '../../utils/supabase';
import { useQuery } from '@tanstack/react-query';
import { FantasyTeam } from '../../types';

interface DraftRosterProps {
  leagueId: string;
}

export default function DraftRoster({ leagueId }: DraftRosterProps) {
  const { data: teams, isLoading: teamsLoading } = useTeams(leagueId);
  const { data: league } = useLeague(leagueId);
  const { data: draftOrder, isLoading: draftOrderLoading } = useDraftOrder(leagueId);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  // Get the first team as default if no team is selected
  React.useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const { data: roster, isLoading: rosterLoading } = useTeamRoster(selectedTeamId);

  // Filter picks for the selected team (including traded picks)
  const teamPicks = useMemo(() => {
    if (!draftOrder || !selectedTeamId) return [];
    
    // Get picks where current_owner_id matches (handles traded picks)
    return draftOrder
      .filter(pick => pick.current_owner_id === selectedTeamId)
      .sort((a, b) => a.pick_number - b.pick_number);
  }, [draftOrder, selectedTeamId]);

  // Calculate team's current salary usage
  const { data: teamSalary } = useQuery({
    queryKey: ['team-draft-salary', selectedTeamId],
    queryFn: async () => {
      if (!selectedTeamId) return 0;

      try {
        const { data: rosterData, error } = await supabase
          .from('fantasy_team_players')
          .select(`
            player:player_id (
              salary_2025_26
            )
          `)
          .eq('fantasy_team_id', selectedTeamId);

        if (error) {
          console.error(`Error fetching roster for salary calculation:`, error);
          return 0;
        }

        const totalSalary = rosterData?.reduce((sum, rosterSpot) => {
          const player = rosterSpot.player as any;
          const playerSalary = player?.salary_2025_26 || 0;
          return sum + playerSalary;
        }, 0) || 0;

        return totalSalary;
      } catch (error) {
        console.error(`Error calculating salary:`, error);
        return 0;
      }
    },
    enabled: !!selectedTeamId,
    staleTime: 1000 * 5, // Refresh every 5 seconds during draft
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const formatSalary = (salary: number) => {
    if (salary >= 1000000) {
      return `$${(salary / 1000000).toFixed(1)}M`;
    }
    if (salary >= 1000) {
      return `$${(salary / 1000).toFixed(0)}K`;
    }
    return `$${salary}`;
  };

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
      {/* Team Header */}
      {selectedTeam && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Team Info */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.500', width: 40, height: 40 }}>
                  {selectedTeam.team_name.charAt(0)}
                </Avatar>
                <Box>
                  <Typography level="h6" sx={{ fontWeight: 'bold' }}>
                    {selectedTeam.team_name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {formatSalary(teamSalary || 0)}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      /
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      {formatSalary(league?.salary_cap_amount || 100000000)}
                    </Typography>
                    <Chip 
                      size="sm" 
                      variant="soft"
                      color={
                        ((teamSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.9 ? 'danger' : 
                        ((teamSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.75 ? 'warning' : 
                        'success'
                      }
                    >
                      {formatSalary((league?.salary_cap_amount || 100000000) - (teamSalary || 0))} left
                    </Chip>
                  </Stack>
                </Box>
              </Box>

              {/* Team Selector Dropdown */}
              <Select
                value={selectedTeamId}
                onChange={(_, value) => setSelectedTeamId(value as string)}
                placeholder="Switch team..."
                size="sm"
                sx={{ minWidth: 180 }}
              >
                {teams.map((team) => (
                  <Option key={team.id} value={team.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                        {team.team_name.charAt(0)}
                      </Avatar>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                        {team.team_name}
                      </Typography>
                    </Box>
                  </Option>
                ))}
              </Select>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      {selectedTeam && (
        <Grid container spacing={2}>
          {/* Left Column: Roster */}
          <Grid xs={12} lg={8}>
            <Card variant="outlined">
              <CardContent>
                <Typography level="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Current Roster
                </Typography>

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
                        src={!isEmpty && player?.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png` : undefined}
                        sx={{ 
                          bgcolor: isEmpty ? 'neutral.300' : 'primary.500',
                          width: 48,
                          height: 48,
                          mb: 1,
                          '& img': {
                            objectFit: 'cover'
                          }
                        }}
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.textContent = isEmpty ? '?' : player?.name?.charAt(0) || '?';
                          }
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
          </Grid>

          {/* Right Column: Draft Picks */}
          <Grid xs={12} lg={4}>
            <Card variant="outlined" sx={{ position: 'sticky', top: 16 }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Typography level="h6" sx={{ fontWeight: 'bold' }}>
                    Draft Picks
                  </Typography>
                  <Chip size="sm" color="primary" variant="soft">
                    {teamPicks.length}
                  </Chip>
                </Stack>

                <Divider sx={{ mb: 2 }} />

                {teamPicks.length === 0 ? (
                  <Alert color="neutral" sx={{ textAlign: 'center' }}>
                    <Typography level="body-sm">
                      No picks for this team
                    </Typography>
                  </Alert>
                ) : (
                  <List size="sm" sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                    {teamPicks.map((pick) => {
                      const isCompleted = pick.is_completed;
                      const isTraded = pick.is_traded;
                      const isForfeited = pick.auto_pick_reason === 'insufficient_cap_space';
                      
                      return (
                        <ListItem
                          key={pick.pick_number}
                          sx={{
                            bgcolor: isCompleted 
                              ? 'success.50' 
                              : isForfeited
                                ? 'danger.50'
                                : 'background.surface',
                            borderRadius: 'sm',
                            mb: 1,
                            border: '1px solid',
                            borderColor: isTraded ? 'primary.300' : 'divider',
                          }}
                        >
                          <ListItemDecorator>
                            {isForfeited ? (
                              <Avatar size="sm" sx={{ bgcolor: 'danger.500' }}>
                                <Cancel />
                              </Avatar>
                            ) : isCompleted ? (
                              <Avatar size="sm" sx={{ bgcolor: 'success.500' }}>
                                <CheckCircle />
                              </Avatar>
                            ) : isTraded ? (
                              <Avatar size="sm" sx={{ bgcolor: 'primary.500' }}>
                                <SwapHoriz />
                              </Avatar>
                            ) : (
                              <Avatar size="sm" sx={{ bgcolor: 'neutral.300' }}>
                                <Schedule />
                              </Avatar>
                            )}
                          </ListItemDecorator>
                          
                          <ListItemContent>
                            <Stack spacing={0.5}>
                              {/* Pick Number and Round */}
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                  Pick #{pick.pick_number}
                                </Typography>
                                <Chip size="sm" variant="outlined" color="neutral">
                                  Round {pick.round}
                                </Chip>
                              </Stack>

                              {/* Player Name (if completed) */}
                              {isCompleted && pick.player_name && (
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.700' }}>
                                  {pick.player_name}
                                </Typography>
                              )}

                              {/* Player Details (if completed) */}
                              {isCompleted && (
                                <Stack direction="row" spacing={1} alignItems="center">
                                  {pick.position && (
                                    <Chip size="sm" variant="soft" color="primary">
                                      {pick.position}
                                    </Chip>
                                  )}
                                  {pick.team_abbreviation && (
                                    <Typography level="body-xs" color="neutral">
                                      {pick.team_abbreviation}
                                    </Typography>
                                  )}
                                  {pick.salary_2025_26 && (
                                    <Typography level="body-xs" fontWeight="bold" color="success">
                                      {formatSalary(pick.salary_2025_26)}
                                    </Typography>
                                  )}
                                </Stack>
                              )}

                              {/* Trade Indicator */}
                              {isTraded && (
                                <Chip size="sm" color="primary" variant="soft">
                                  Traded from {pick.original_team_name}
                                </Chip>
                              )}

                              {/* Forfeited Indicator */}
                              {isForfeited && (
                                <Chip size="sm" color="danger" variant="soft">
                                  Forfeited (Cap)
                                </Chip>
                              )}

                              {/* Pending Indicator */}
                              {!isCompleted && !isForfeited && (
                                <Typography level="body-xs" color="neutral">
                                  Not yet selected
                                </Typography>
                              )}
                            </Stack>
                          </ListItemContent>
                        </ListItem>
                      );
                    })}
                  </List>
                )}

                {/* Picks Summary */}
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={2} justifyContent="space-around">
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {teamPicks.filter(p => p.is_completed).length}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      Completed
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {teamPicks.filter(p => !p.is_completed).length}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      Pending
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {teamPicks.filter(p => p.is_traded).length}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      Traded
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
