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
import Trades from './Trades';

interface TeamRosterProps {
  leagueId: string;
  teamId?: string;
}

interface TradeContext {
  player: any;
  teamId: string;
  teamName: string;
}

// Component to handle player avatar with proper error handling
function PlayerAvatar({ player, isEmpty }: { player: any; isEmpty: boolean }) {
  const [imageError, setImageError] = useState(false);
  
  const imageUrl = !isEmpty && player?.nba_player_id && !imageError
    ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`
    : undefined;

  return (
    <Avatar 
      size="sm" 
      src={imageUrl}
      sx={{ 
        bgcolor: isEmpty ? 'neutral.300' : 'primary.500',
        width: 32,
        height: 32,
        '& img': {
          objectFit: 'cover'
        }
      }}
      onError={() => setImageError(true)}
    >
      {isEmpty ? '?' : player?.name?.charAt(0)}
    </Avatar>
  );
}

export default function TeamRoster({ leagueId, teamId }: TeamRosterProps) {
  const { data: teams } = useTeams(leagueId);
  const { data: league } = useLeague(leagueId);
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null);
  const [tradeContext, setTradeContext] = useState<TradeContext | null>(null);
  
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

  // Calculate actual salary from roster data
  const actualSalary = useMemo(() => {
    if (!roster) return 0;
    
    const total = roster.reduce((sum, rosterSpot) => {
      const player = rosterSpot.player as any;
      const salaryData = player?.nba_hoopshype_salaries?.[0];
      const playerSalary = salaryData?.salary_2025_26 || 0;
      return sum + playerSalary;
    }, 0);
    
    console.log('💰 Calculated total salary:', total, 'from', roster.filter(r => r.player).length, 'players');
    return total;
  }, [roster]);

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

  const handleInitiateTrade = (player: any, teamId: string, teamName: string) => {
    setTradeContext({ player, teamId, teamName });
  };

  const handleBackFromTrades = () => {
    setTradeContext(null);
  };

  // Show trades page if trade context is set
  if (tradeContext) {
    return <Trades leagueId={leagueId} tradeContext={tradeContext} onBack={handleBackFromTrades} />;
  }

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
          mb: 3,
          overflow: 'hidden',
          boxShadow: 'md',
        }}
      >
        <Box
          sx={{
            p: 3,
            background: 'linear-gradient(135deg, var(--joy-palette-primary-600) 0%, var(--joy-palette-primary-700) 100%)',
          }}
        >
          <Grid container spacing={3} alignItems="center">
            <Grid xs={12} md={6}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar 
                  sx={{ 
                    '--Avatar-size': '64px', 
                    border: '3px solid rgba(255,255,255,0.3)',
                    bgcolor: 'primary.800',
                    fontSize: '1.5rem',
                    fontWeight: 'bold'
                  }}
                >
                  {selectedTeam.team_name.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography level="h3" sx={{ color: 'white', fontWeight: 'bold' }}>
                    {selectedTeam.team_name}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                    {selectedTeam.is_commissioner && (
                      <Chip 
                        size="sm" 
                        variant="soft" 
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.15)',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      >
                        👑 Commissioner
                      </Chip>
                    )}
                    <Chip 
                      size="sm" 
                      variant="soft" 
                      sx={{ 
                        bgcolor: 'rgba(255,255,255,0.15)',
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    >
                      {selectedTeam.wins}W - {selectedTeam.losses}L
                    </Chip>
                  </Stack>
                </Box>
              </Stack>
            </Grid>
            <Grid xs={12} md={6}>
              <Stack spacing={2}>
                {/* Salary Cap Info */}
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography level="body-sm" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>
                      Salary Cap Usage
                    </Typography>
                    <Typography level="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                      {formatSalary(actualSalary || 0)} / {formatSalary(league?.salary_cap_amount || 100000000)}
                    </Typography>
                  </Stack>
                  <LinearProgress 
                    determinate 
                    value={Math.min(((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) * 100, 100)}
                    color={
                      ((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.9 ? 'danger' : 
                      ((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.75 ? 'warning' : 
                      'success'
                    }
                    sx={{ 
                      height: 8, 
                      mt: 1,
                      bgcolor: 'rgba(255,255,255,0.2)',
                      '& .MuiLinearProgress-indicator': {
                        bgcolor: ((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.9 ? '#ff4444' : 
                                 ((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) > 0.75 ? '#ffaa00' : 
                                 'rgba(255,255,255,0.9)'
                      }
                    }}
                  />
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                    <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {(((actualSalary || 0) / (league?.salary_cap_amount || 100000000)) * 100).toFixed(1)}% used
                    </Typography>
                    <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {formatSalary((league?.salary_cap_amount || 100000000) - (actualSalary || 0))} remaining
                    </Typography>
                  </Stack>
                </Box>
                
                {/* Quick Stats */}
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                      {sortedRoster?.filter(spot => spot.player).length || 0}/{sortedRoster?.length || 0}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Roster
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                      {selectedTeam.points_for.toFixed(1)}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Points For
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="h4" sx={{ color: 'white', fontWeight: 'bold' }}>
                      #{selectedTeam.current_standing || '--'}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Rank
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Box>
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
                          <PlayerAvatar 
                            player={player}
                            isEmpty={isEmpty}
                          />
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
          <RecentTransactions teamId={selectedTeam.id} leagueId={leagueId} />
        </Grid>

        {/* Trading Block */}
        <Grid xs={12} md={6}>
          <TradingBlock 
            teamId={selectedTeam.id} 
            leagueId={leagueId}
            onInitiateTrade={handleInitiateTrade}
          />
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

