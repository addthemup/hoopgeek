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

  // Generate roster configuration based on league settings
  const rosterConfiguration = useMemo(() => {
    if (!league?.roster_positions) {
      // Default configuration if not available
      return [
        { position: 'G', count: 2, filled: 0 },
        { position: 'F', count: 2, filled: 0 },
        { position: 'C', count: 1, filled: 0 },
        { position: 'UTIL', count: 3, filled: 0 }
      ];
    }

    const config = [];
    const rosterPos = league.roster_positions;

    // Add Guards
    if (rosterPos.G > 0) {
      config.push({ position: 'G', count: rosterPos.G, filled: 0 });
    }

    // Add Forwards
    if (rosterPos.F > 0) {
      config.push({ position: 'F', count: rosterPos.F, filled: 0 });
    }

    // Add Centers
    if (rosterPos.C > 0) {
      config.push({ position: 'C', count: rosterPos.C, filled: 0 });
    }

    // Add UTIL spots
    if (rosterPos.UTIL > 0) {
      config.push({ position: 'UTIL', count: rosterPos.UTIL, filled: 0 });
    }

    return config;
  }, [league?.roster_positions]);

  // Create a simple roster display that shows position requirements
  const rosterDisplay = useMemo(() => {
    if (!roster) return [];

    const players = roster.filter(spot => spot.player);
    

    // Create roster spots based on league configuration
    const rosterSpots = [];
    
    if (league?.roster_positions) {
      const rosterPos = league.roster_positions;
      
      // Add Guards
      for (let i = 0; i < (rosterPos.G || 0); i++) {
        rosterSpots.push({ position: 'G', index: i, player: null });
      }
      
      // Add Forwards
      for (let i = 0; i < (rosterPos.F || 0); i++) {
        rosterSpots.push({ position: 'F', index: i, player: null });
      }
      
      // Add Centers
      for (let i = 0; i < (rosterPos.C || 0); i++) {
        rosterSpots.push({ position: 'C', index: i, player: null });
      }
      
      // Add UTIL spots
      for (let i = 0; i < (rosterPos.UTIL || 0); i++) {
        rosterSpots.push({ position: 'UTIL', index: i, player: null });
      }
    } else {
      // Default configuration
      rosterSpots.push(
        { position: 'G', index: 0, player: null },
        { position: 'G', index: 1, player: null },
        { position: 'F', index: 0, player: null },
        { position: 'F', index: 1, player: null },
        { position: 'C', index: 0, player: null },
        { position: 'UTIL', index: 0, player: null },
        { position: 'UTIL', index: 1, player: null },
        { position: 'UTIL', index: 2, player: null }
      );
    }

    // Helper function to check if a player can play a position
    const canPlayPosition = (player: any, position: string) => {
      if (!player?.position) {
        return false;
      }
      
      const playerPositions = player.position.split(',').map((p: string) => p.trim());
      
      switch (position) {
        case 'G':
          // Check for both abbreviations and full words
          return playerPositions.some((p: string) => 
            ['PG', 'SG', 'G', 'Point Guard', 'Shooting Guard', 'Guard'].includes(p) ||
            p.toLowerCase().includes('guard')
          );
        case 'F':
          // Check for both abbreviations and full words
          return playerPositions.some((p: string) => 
            ['SF', 'PF', 'F', 'Small Forward', 'Power Forward', 'Forward'].includes(p) ||
            p.toLowerCase().includes('forward')
          );
        case 'C':
          // Check for both abbreviations and full words
          return playerPositions.some((p: string) => 
            ['C', 'Center'].includes(p) ||
            p.toLowerCase().includes('center')
          );
        case 'UTIL':
          return true; // Any player can be UTIL
        default:
          return playerPositions.includes(position);
      }
    };

    // Place players in appropriate spots
    const placedPlayers = new Set();
    
    // First pass: Fill required positions
    for (const spot of rosterSpots) {
      if (spot.position === 'UTIL') continue; // Skip UTIL for now
      
      const availablePlayer = players.find(player => 
        !placedPlayers.has(player.id) && 
        canPlayPosition(player, spot.position)
      );
      
      if (availablePlayer) {
        spot.player = availablePlayer;
        placedPlayers.add(availablePlayer.id);
      }
    }

    // Second pass: Fill UTIL spots with remaining players
    for (const spot of rosterSpots) {
      if (spot.position === 'UTIL' && !spot.player) {
        const availablePlayer = players.find(player => !placedPlayers.has(player.id));
        if (availablePlayer) {
          spot.player = availablePlayer;
          placedPlayers.add(availablePlayer.id);
        }
      }
    }

    return rosterSpots;
  }, [roster, league?.roster_positions]);

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
          .from('fantasy_roster_spots')
          .select(`
            player:player_id (
              nba_hoopshype_salaries (
                salary_2025_26
              )
            )
          `)
          .eq('fantasy_team_id', selectedTeamId);

        if (error) {
          console.error(`Error fetching roster for salary calculation:`, error);
          return 0;
        }

        const totalSalary = rosterData?.reduce((sum, rosterSpot) => {
          const player = rosterSpot.player as any;
          const playerSalary = player?.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0;
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

  // Helper function to check if a player can play a position
  const canPlayPosition = (player: any, position: string) => {
    if (!player?.position) return false;
    
    const playerPositions = player.position.split(',').map((p: string) => p.trim());
    
    switch (position) {
      case 'G':
        return playerPositions.some((p: string) => ['PG', 'SG', 'G'].includes(p));
      case 'F':
        return playerPositions.some((p: string) => ['SF', 'PF', 'F'].includes(p));
      case 'C':
        return playerPositions.some((p: string) => ['C'].includes(p));
      case 'UTIL':
        return true; // Any player can be UTIL
      default:
        return playerPositions.includes(position);
    }
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

            {/* Roster Configuration Grid */}
            <Grid container spacing={1}>
              {rosterDisplay.map((spot, index) => {
                const { position, player } = spot;
                const isEmpty = !player;
                
                return (
                  <Grid xs={6} sm={4} md={3} key={`${position}-${index}`}>
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
                        bgcolor: isEmpty ? 'neutral.50' : 'success.50',
                        borderColor: isEmpty ? 'neutral.300' : 'success.300'
                      }}
                    >
                      <Chip 
                        size="sm" 
                        color={getPositionColor(position)} 
                        variant={isEmpty ? "outlined" : "soft"}
                        sx={{ mb: 1 }}
                      >
                        {position}
                      </Chip>
                      
                      {player ? (
                        <>
                          <Avatar 
                            size="md" 
                            src={player.player?.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.player.nba_player_id}.png` : undefined}
                            sx={{ 
                              bgcolor: 'primary.500',
                              width: 48,
                              height: 48,
                              mb: 1,
                              '& img': {
                                objectFit: 'cover'
                              }
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.textContent = player.player?.name?.charAt(0) || '?';
                              }
                            }}
                          >
                            {player.player?.name?.charAt(0)}
                          </Avatar>
                          
                          <Typography 
                            level="body-sm" 
                            sx={{ 
                              fontWeight: 'bold',
                              textAlign: 'center',
                              fontSize: '0.8rem'
                            }}
                          >
                            {player.player?.name}
                          </Typography>
                          
                          <Typography 
                            level="body-xs" 
                            color="neutral"
                            sx={{ textAlign: 'center' }}
                          >
                            {player.player?.team_abbreviation || player.player?.team_name}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Avatar 
                            size="md" 
                            sx={{ 
                              bgcolor: 'neutral.300',
                              width: 48,
                              height: 48,
                              mb: 1
                            }}
                          >
                            ?
                          </Avatar>
                          
                          <Typography 
                            level="body-sm" 
                            sx={{ 
                              fontWeight: 'bold',
                              textAlign: 'center',
                              fontSize: '0.8rem',
                              color: 'neutral.500'
                            }}
                          >
                            Empty
                          </Typography>
                        </>
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
                        Total Players
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="h6" sx={{ fontWeight: 'bold' }}>
                        {rosterDisplay.filter(spot => spot.player).length}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        Filled Spots
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="h6" sx={{ fontWeight: 'bold' }}>
                        {rosterDisplay.filter(spot => !spot.player).length}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        Remaining
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
