import { useState, useMemo } from 'react';
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
  LinearProgress,
} from '@mui/joy';
import { useTeamRoster } from '../hooks/useTeamRoster';
import { useTeams } from '../hooks/useTeams';
import TeamSchedule from '../components/TeamSchedule';
import { supabase } from '../utils/supabase';
import { useQuery } from '@tanstack/react-query';
import { useLeague } from '../hooks/useLeagues';
import PlayerPage from './PlayerPage';
import BasketballCourtMatchup from '../components/BasketballCourtMatchup';
import RecentTransactions from '../components/Team/RecentTransactions';
import TradingBlock from '../components/Team/TradingBlock';
import FuturePicks from '../components/Team/FuturePicks';
import TeamPerformanceRadial from '../components/Team/TeamPerformanceRadial';
import { useCurrentFantasyWeek } from '../hooks/useCurrentFantasyWeek';
import { useMatchups } from '../hooks/useMatchups';

interface TeamRosterProps {
  leagueId: string;
  teamId?: string;
}

export default function TeamRoster({ leagueId, teamId }: TeamRosterProps) {
  const { data: teams } = useTeams(leagueId);
  const { data: league } = useLeague(leagueId);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  
  // Determine which team to display
  const selectedTeam = teamId 
    ? teams?.find(t => t.id === teamId) 
    : teams?.[0]; // Fallback to first team if no teamId

  // Debug logging
  console.log('TeamRoster Debug:', {
    leagueId,
    teamId,
    selectedTeam: selectedTeam ? { id: selectedTeam.id, name: selectedTeam.team_name } : null,
    allTeams: teams?.map(t => ({ id: t.id, name: t.team_name }))
  });

  const { data: roster, isLoading, error } = useTeamRoster(selectedTeam?.id || '');

  // Sort roster spots: players first, then empty spots
  const sortedRoster = useMemo(() => {
    if (!roster) return [];
    
    return [...roster].sort((a, b) => {
      const aHasPlayer = !!a.player;
      const bHasPlayer = !!b.player;
      
      // If one has a player and the other doesn't, prioritize the one with a player
      if (aHasPlayer && !bHasPlayer) return -1;
      if (!aHasPlayer && bHasPlayer) return 1;
      
      // If both have players or both are empty, maintain original order
      return 0;
    });
  }, [roster]);

  // Get current fantasy week
  const { currentWeek: fantasyWeek, seasonPhase, isLoading: weekLoading } = useCurrentFantasyWeek();
  
  // Get current week matchups
  const { data: currentWeekMatchups, isLoading: matchupsLoading } = useMatchups(
    leagueId, 
    fantasyWeek?.week_number
  );

  // Calculate actual salary from roster
  const { data: actualSalary } = useQuery({
    queryKey: ['team-salary-usage', selectedTeam?.id],
    queryFn: async () => {
      if (!selectedTeam?.id) return 0;

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
          .eq('fantasy_team_id', selectedTeam.id)
          .not('player_id', 'is', null);

        if (error) {
          console.error(`Error fetching roster for salary calculation:`, error);
          return 0;
        }

        const totalSalary = rosterData?.reduce((sum, rosterSpot) => {
          const player = rosterSpot.player as any;
          const salaryData = player?.nba_hoopshype_salaries?.[0];
          const playerSalary = salaryData?.salary_2025_26 || 0;
          return sum + playerSalary;
        }, 0) || 0;

        return totalSalary;
      } catch (error) {
        console.error(`Error calculating salary:`, error);
        return 0;
      }
    },
    enabled: !!selectedTeam?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

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
        return 'neutral';
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

  // Calculate projected fantasy points for a player (same logic as DraftPlayers)
  const calculateProjectedFantasyPoints = (player: any) => {
    const projections = (player as any)?.nba_espn_projections?.[0];
    if (!projections) return 0;

    const {
      proj_2026_gp = 0,      // Games played
      proj_2026_pts = 0,     // Points per game
      proj_2026_reb = 0,     // Rebounds per game
      proj_2026_ast = 0,     // Assists per game
      proj_2026_stl = 0,     // Steals per game
      proj_2026_blk = 0,     // Blocks per game
      proj_2026_to = 0,      // Turnovers per game
      proj_2026_3pm = 0      // 3-pointers made per game
    } = projections;

    // Calculate total stats for the season
    const totalPts = proj_2026_pts * proj_2026_gp;
    const totalReb = proj_2026_reb * proj_2026_gp;
    const totalAst = proj_2026_ast * proj_2026_gp;
    const totalStl = proj_2026_stl * proj_2026_gp;
    const totalBlk = proj_2026_blk * proj_2026_gp;
    const totalTo = proj_2026_to * proj_2026_gp;
    const total3pm = proj_2026_3pm * proj_2026_gp;

    // Calculate field goals made (approximate from FG% and points)
    const total2ptFg = Math.max(0, (totalPts - (total3pm * 3)) / 2);
    const totalFg = total2ptFg + total3pm;

    // Calculate free throws made (approximate from FT% and points)
    const totalFt = Math.max(0, (totalPts - (totalFg * 2) - (total3pm * 1)) / 1);

    // Apply fantasy scoring formula
    const fantasyPoints = 
      (total3pm * 3) +           // 3-pt FG = 3pts
      (total2ptFg * 2) +         // 2-pt FG = 2pts  
      (totalFt * 1) +            // FT = 1pt
      (totalReb * 1.2) +         // Rebound = 1.2pts
      (totalAst * 1.5) +         // Assist = 1.5pts
      (totalBlk * 3) +           // Block = 3pts
      (totalStl * 3) +           // Steal = 3pts
      (totalTo * -1);            // Turnover = -1pt

    return Math.round(fantasyPoints);
  };

  const handlePlayerClick = (player: any) => {
    if (player && player.id) {
      setSelectedPlayer({ id: player.id.toString(), name: player.name });
    }
  };

  const handleBackToRoster = () => {
    setSelectedPlayer(null);
  };

  // Show player detail if a player is selected
  if (selectedPlayer) {
    return (
      <PlayerPage
        playerId={selectedPlayer.id}
        playerName={selectedPlayer.name}
        onBack={handleBackToRoster}
        leagueId={leagueId}
        teamName={selectedTeam?.team_name}
      />
    );
  }

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

  if (!selectedTeam) {
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
                {selectedTeam.team_name.charAt(0)}
              </Avatar>
              <Box>
                <Typography level="h2" sx={{ color: 'white' }}>{selectedTeam.team_name}</Typography>
                <Typography level="body-md" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  Owner: {selectedTeam.user_id ? 'awcarv@gmail.com' : 'TBD'}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    Gold 745
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    {selectedTeam.wins}-{selectedTeam.losses}-{selectedTeam.ties || 0}
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral" sx={{ '--Chip-color': 'white', '--Chip-background': 'rgba(255,255,255,0.2)' }}>
                    2nd Place
                  </Chip>
                </Stack>
              </Box>
            </Stack>
          </Grid>
          <Grid xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Typography level="h3" sx={{ color: 'white', mb: 1 }}>{selectedTeam.points_for || 650.5} Total Pts</Typography>
            <Typography level="body-md" sx={{ color: 'rgba(255,255,255,0.8)' }}>
              Streak: W2
            </Typography>
          </Grid>
        </Grid>
      </Card>

      {/* Roster Table */}
      <Card variant="outlined">
        <CardContent>
          {/* Roster Progress Summary in Header */}
          {league?.roster_positions && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {Object.entries(league.roster_positions).map(([position, requiredCount]) => {
                  const filledCount = sortedRoster?.filter(rosterSpot => {
                    const player = rosterSpot.player;
                    if (!player) return false;
                    
                    return (position === 'G' && (player.position === 'PG' || player.position === 'SG' || player.position === 'G')) ||
                           (position === 'F' && (player.position === 'SF' || player.position === 'PF' || player.position === 'F')) ||
                           (position === 'C' && (player.position === 'C' || player.position === 'Center')) ||
                           (position === 'UTIL' && (player.position === 'UTIL' || player.position === 'G' || player.position === 'F' || player.position === 'C'));
                  }).length || 0;
                  
                  const isComplete = filledCount >= (requiredCount as number);
                  const positionName = position === 'G' ? 'Guard' : 
                                     position === 'F' ? 'Forward' : 
                                     position === 'C' ? 'Center' : 
                                     position === 'UTIL' ? 'Utility' : position;
                  
                  return (
                    <Chip
                      key={position}
                      size="sm"
                      variant="soft"
                      color={isComplete ? 'success' : 'warning'}
                      sx={{ fontWeight: 'bold' }}
                    >
                      {positionName}: {filledCount}/{requiredCount as number}
                    </Chip>
                  );
                })}
              </Stack>
            </Box>
          )}
          
          <Box sx={{ overflowX: 'auto' }}>
            <Table hoverRow>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Position</th>
                  <th style={{ width: '200px' }}>Player</th>
                  <th style={{ width: '100px' }}>Team</th>
                  <th style={{ width: '100px' }}>2025-26 Salary</th>
                  <th style={{ width: '100px' }}>Proj Fantasy Pts</th>
                  <th style={{ width: '80px' }}>2026 PTS</th>
                  <th style={{ width: '80px' }}>2026 REB</th>
                  <th style={{ width: '80px' }}>2026 AST</th>
                  <th style={{ width: '60px' }}>MIN</th>
                  <th style={{ width: '60px' }}>STL</th>
                  <th style={{ width: '60px' }}>BLK</th>
                  <th style={{ width: '60px' }}>TO</th>
                </tr>
              </thead>
              <tbody>
                {sortedRoster?.map((rosterSpot) => {
                  const player = rosterSpot.player;
                  const isEmpty = !player;
                  
                  return (
                    <tr 
                      key={rosterSpot.id} 
                      style={{ 
                        cursor: !isEmpty ? 'pointer' : 'default',
                        opacity: isEmpty ? 0.6 : 1
                      }}
                      onClick={() => !isEmpty && player ? handlePlayerClick(player) : undefined}
                    >
                      <td>
                        <Chip 
                          size="sm" 
                          color={getPositionColor(player?.position || 'UTIL')} 
                          variant="soft"
                        >
                          {player?.position || (rosterSpot.is_injured_reserve ? 'IR' : 'Empty')}
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
                        <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                          {isEmpty ? '--' : formatSalary((player as any)?.nba_hoopshype_salaries?.[0]?.salary_2025_26 || 0)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right', fontWeight: 'bold', color: 'success.500' }}>
                          {isEmpty ? '--' : calculateProjectedFantasyPoints(player).toLocaleString()}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.nba_espn_projections?.[0]?.proj_2026_pts?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.nba_espn_projections?.[0]?.proj_2026_reb?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.nba_espn_projections?.[0]?.proj_2026_ast?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.nba_espn_projections?.[0]?.proj_2026_min?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.nba_espn_projections?.[0]?.proj_2026_stl?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.nba_espn_projections?.[0]?.proj_2026_blk?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.nba_espn_projections?.[0]?.proj_2026_to?.toFixed(1) || 'N/A')}
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
              <Typography level="title-md" sx={{ mb: 2 }}>
                Roster Summary
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Total Players:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {sortedRoster?.filter(spot => spot.player).length || 0} / {sortedRoster?.length || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Regular Spots:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {sortedRoster?.filter(spot => !spot.is_injured_reserve && spot.player).length || 0} / {sortedRoster?.filter(spot => !spot.is_injured_reserve).length || 0}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">IR Spots:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {sortedRoster?.filter(spot => spot.is_injured_reserve && spot.player).length || 0} / {sortedRoster?.filter(spot => spot.is_injured_reserve).length || 0}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2 }}>
                Salary Cap
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Used:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {formatSalary(actualSalary || 0)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Available:</Typography>
                  <Typography 
                    level="body-sm" 
                    sx={{ 
                      fontWeight: 'bold',
                      color: ((league?.salary_cap_amount || 100000000) - (actualSalary || 0)) < 0 ? 'danger.500' : 'success.500'
                    }}
                  >
                    {formatSalary((league?.salary_cap_amount || 100000000) - (actualSalary || 0))}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Total:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {formatSalary(league?.salary_cap_amount || 100000000)}
                  </Typography>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <LinearProgress 
                    determinate 
                    value={Math.min(((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) * 100, 100)}
                    color={
                      ((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.9 ? 'danger' : 
                      ((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.75 ? 'warning' : 
                      'success'
                    }
                    sx={{ height: 8 }}
                  />
                  <Typography level="body-xs" color="neutral" sx={{ textAlign: 'center', mt: 0.5 }}>
                    {(((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) * 100).toFixed(1)}% Used
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-md" sx={{ mb: 2 }}>
                Team Record
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Record:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {selectedTeam.wins}-{selectedTeam.losses}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Points For:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {selectedTeam.points_for.toFixed(1)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography level="body-sm">Points Against:</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {selectedTeam.points_against.toFixed(1)}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Matchup - Basketball Court Visualization */}
      {(() => {
        // Find current week matchup for this team
        const currentMatchup = currentWeekMatchups?.find(matchup => 
          matchup.fantasy_team1_id === selectedTeam?.id || matchup.fantasy_team2_id === selectedTeam?.id
        );
        
        // Get opponent team
        const opponentTeam = currentMatchup ? (
          currentMatchup.fantasy_team1_id === selectedTeam?.id ? currentMatchup.team2 : currentMatchup.team1
        ) : null;
        
        // Determine if this team is home or away
        const isHome = currentMatchup?.fantasy_team1_id === selectedTeam?.id;
        
        // Get team roster data for display
        const teamStarters = sortedRoster?.filter(r => r.player && !r.is_injured_reserve).slice(0, 5).map(r => ({
          id: r.player!.id as string,
          name: r.player!.name,
          position: r.player!.position || 'N/A',
          jersey_number: r.player!.jersey_number,
          team_abbreviation: r.player!.team_abbreviation || '',
        })) || [];
        
        const teamBench = sortedRoster?.filter(r => r.player && !r.is_injured_reserve).slice(5).map(r => ({
          id: r.player!.id as string,
          name: r.player!.name,
          position: r.player!.position || 'N/A',
          jersey_number: r.player!.jersey_number,
          team_abbreviation: r.player!.team_abbreviation || '',
        })) || [];
        
        // If no current matchup, show a placeholder
        if (!currentMatchup || !opponentTeam) {
          return (
            <Card variant="outlined" sx={{ mt: 3 }}>
              <CardContent>
                <Typography level="h4" sx={{ fontWeight: 'bold', mb: 2 }}>
                  🏀 Week {fantasyWeek?.week_number || 'TBD'} Matchup
                </Typography>
                <Typography color="neutral">
                  {seasonPhase === 'offseason' ? 'Season has not started yet' : 'No matchup scheduled for this week'}
                </Typography>
              </CardContent>
            </Card>
          );
        }
        
        return (
          <BasketballCourtMatchup
            homeTeam={isHome ? {
              name: selectedTeam.team_name,
              abbreviation: selectedTeam.team_name.substring(0, 3).toUpperCase(),
              starters: teamStarters,
              bench: teamBench,
            } : {
              name: opponentTeam.team_name,
              abbreviation: opponentTeam.team_name.substring(0, 3).toUpperCase(),
              starters: [], // Opponent roster not available in this context
              bench: [],
            }}
            awayTeam={isHome ? {
              name: opponentTeam.team_name,
              abbreviation: opponentTeam.team_name.substring(0, 3).toUpperCase(),
              starters: [], // Opponent roster not available in this context
              bench: [],
            } : {
              name: selectedTeam.team_name,
              abbreviation: selectedTeam.team_name.substring(0, 3).toUpperCase(),
              starters: teamStarters,
              bench: teamBench,
            }}
            weekNumber={fantasyWeek?.week_number || 0}
          />
        );
      })()}

      {/* Additional Modules Grid */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        {/* Recent Transactions */}
        <Grid xs={12} md={6}>
          <RecentTransactions teamId={selectedTeam.id} />
        </Grid>

        {/* Trading Block */}
        <Grid xs={12} md={6}>
          <TradingBlock teamId={selectedTeam.id} />
        </Grid>

        {/* Future Picks */}
        <Grid xs={12} md={6}>
          <FuturePicks teamId={selectedTeam.id} />
        </Grid>

        {/* Team Performance Radial */}
        <Grid xs={12} md={6}>
          <TeamPerformanceRadial teamId={selectedTeam.id} />
        </Grid>
      </Grid>

      {/* Team Schedule */}
      <Box sx={{ mt: 4 }}>
        <TeamSchedule teamId={selectedTeam.id} />
      </Box>
    </Box>
  );
}

