import { useState } from 'react';
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
  Button,
  LinearProgress,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Divider,
} from '@mui/joy';
import { ArrowBack, CalendarToday, NavigateBefore, NavigateNext } from '@mui/icons-material';
import { useTeamRoster } from '../hooks/useTeamRoster';
import { useTeams } from '../hooks/useTeams';
import TeamSchedule from '../components/TeamSchedule';
import { supabase } from '../utils/supabase';
import { useQuery } from '@tanstack/react-query';
import { useLeague } from '../hooks/useLeagues';
import { usePlayerComprehensive } from '../hooks/usePlayerComprehensive';
import { usePlayerUpcomingGames } from '../hooks/usePlayerUpcomingGames';
import PlayerActionButtons from '../components/PlayerActionButtons';
import BasketballCourtMatchup from '../components/BasketballCourtMatchup';
import RecentTransactions from '../components/Team/RecentTransactions';
import TradingBlock from '../components/Team/TradingBlock';
import FuturePicks from '../components/Team/FuturePicks';
import TeamPerformanceRadial from '../components/Team/TeamPerformanceRadial';

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

  // Calculate actual salary from roster
  const { data: actualSalary } = useQuery({
    queryKey: ['team-salary-usage', selectedTeam?.id],
    queryFn: async () => {
      if (!selectedTeam?.id) return 0;

      try {
        const { data: rosterData, error } = await supabase
          .from('fantasy_team_players')
          .select(`
            player:player_id (
              salary_2025_26
            )
          `)
          .eq('fantasy_team_id', selectedTeam.id);

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
    const projections = (player as any)?.espn_player_projections?.[0];
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
      <EnhancedPlayerDetail
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
                {roster?.map((rosterSpot) => {
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
                            src={!isEmpty && player?.nba_player_id ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png` : undefined}
                            sx={{ 
                              bgcolor: isEmpty ? 'neutral.300' : 'primary.500',
                              width: 32,
                              height: 32,
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
                          {isEmpty ? '--' : formatSalary(player?.salary_2025_26 || 0)}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right', fontWeight: 'bold', color: 'success.500' }}>
                          {isEmpty ? '--' : calculateProjectedFantasyPoints(player).toLocaleString()}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.espn_player_projections?.[0]?.proj_2026_pts?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.espn_player_projections?.[0]?.proj_2026_reb?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.espn_player_projections?.[0]?.proj_2026_ast?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.espn_player_projections?.[0]?.proj_2026_min?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.espn_player_projections?.[0]?.proj_2026_stl?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.espn_player_projections?.[0]?.proj_2026_blk?.toFixed(1) || 'N/A')}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ textAlign: 'right' }}>
                          {isEmpty ? '--' : ((player as any)?.espn_player_projections?.[0]?.proj_2026_to?.toFixed(1) || 'N/A')}
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
      <BasketballCourtMatchup
        homeTeam={{
          name: selectedTeam.team_name,
          abbreviation: selectedTeam.team_name.substring(0, 3).toUpperCase(),
          starters: roster?.filter(r => r.is_starter && r.player).map(r => ({
            id: r.player!.id,
            name: r.player!.name,
            position: r.player!.position || 'N/A',
            jersey_number: r.player!.jersey_number,
            team_abbreviation: r.player!.team_abbreviation || '',
          })) || [],
          bench: roster?.filter(r => !r.is_starter && r.player).map(r => ({
            id: r.player!.id,
            name: r.player!.name,
            position: r.player!.position || 'N/A',
            jersey_number: r.player!.jersey_number,
            team_abbreviation: r.player!.team_abbreviation || '',
          })) || [],
        }}
        awayTeam={{
          name: 'Opponent Team',
          abbreviation: 'OPP',
          starters: [],
          bench: [],
        }}
        weekNumber={1}
      />

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

// Enhanced Player Detail Component (complete version from Players.tsx)
function EnhancedPlayerDetail({ 
  playerId, 
  playerName, 
  onBack, 
  leagueId, 
  teamName 
}: { 
  playerId: string; 
  playerName: string; 
  onBack: () => void; 
  leagueId?: string;
  teamName?: string;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [gameLogsPage, setGameLogsPage] = useState(1);
  const [gameLogsPageSize] = useState(20);
  
  const { 
    data: playerData, 
    isLoading: loading, 
    error 
  } = usePlayerComprehensive(playerId, gameLogsPage, gameLogsPageSize);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2 }}>
            Back to {teamName ? `${teamName} Roster` : 'Roster'}
          </Button>
          <LinearProgress sx={{ flex: 1 }} />
        </Box>
        <Typography>Loading player data...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2 }}>
            Back to {teamName ? `${teamName} Roster` : 'Roster'}
          </Button>
        </Box>
        <Alert color="danger">
          <Typography>Error loading player data: {error.message}</Typography>
        </Alert>
      </Box>
    );
  }

  if (!playerData) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2 }}>
            Back to {teamName ? `${teamName} Roster` : 'Roster'}
          </Button>
        </Box>
        <Alert color="warning">
          <Typography>No player data found</Typography>
        </Alert>
      </Box>
    );
  }

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString();
  };

  const formatPercentage = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatSalary = (salary: number | undefined) => {
    if (salary === undefined || salary === null) return 'N/A';
    return `$${(salary / 1000000).toFixed(1)}M`;
  };

  const formatHeight = (height: string | undefined) => {
    if (!height || height === 'N/A') return 'N/A';
    
    // If height is already in feet-inches format, return as-is
    if (height.includes('-')) return height;
    
    // Convert inches to feet-inches format
    const totalInches = parseInt(height);
    if (isNaN(totalInches)) return height;
    
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    
    return `${feet}'${inches}"`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Player Info Card */}
        <Grid xs={12} md={4}>
          <Card variant="outlined" sx={{ height: 'fit-content', position: 'relative' }}>
            <CardContent>
              {/* Action Buttons positioned in top right corner of card */}
              <Box sx={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 2
              }}>
                <PlayerActionButtons
                  playerId={parseInt(playerId)}
                  playerName={playerName}
                  leagueId={leagueId}
                />
              </Box>
              
              <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
                {/* Back Button */}
                <Button 
                  variant="outlined" 
                  startDecorator={<ArrowBack />} 
                  onClick={onBack} 
                  size="sm"
                  sx={{ alignSelf: 'flex-start', mb: 1 }}
                >
                  Back
                </Button>
                
                <Avatar
                  size="lg"
                  src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerData.player.nba_player_id}.png`}
                  sx={{ 
                    width: 120, 
                    height: 120,
                    bgcolor: 'primary.500',
                    fontSize: '2rem',
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
                      parent.textContent = playerData.player.name.split(' ').map((n: string) => n[0]).join('');
                    }
                  }}
                >
                  {playerData.player.name.split(' ').map((n: string) => n[0]).join('')}
                </Avatar>
                
                <Box>
                  <Typography level="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {playerData.player.name}
                  </Typography>
                  <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
                    #{playerData.player.jersey_number || 'N/A'} • {playerData.player.position || 'N/A'} • {playerData.player.team_name || 'N/A'}
                  </Typography>
                  
                  <Chip 
                    color="primary" 
                    variant="soft"
                    size="lg"
                    sx={{ mb: 2 }}
                  >
                    {playerData.player.position || 'N/A'}
                  </Chip>
                </Box>

                <Divider sx={{ width: '100%' }} />

                <Stack spacing={1} sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Height</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{formatHeight(playerData.player.height)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Weight</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.weight ? `${playerData.player.weight} lbs` : 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Age</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.age || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Experience</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.years_pro ? `${playerData.player.years_pro} years` : 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">College</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.college || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Draft</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {playerData.player.draft_year ? `${playerData.player.draft_year} • Round ${playerData.player.draft_round} • Pick ${playerData.player.draft_number}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Birth Place</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {playerData.player.birth_city && playerData.player.birth_state ? `${playerData.player.birth_city}, ${playerData.player.birth_state}` : playerData.player.birth_country || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Salary</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {formatSalary(playerData.player.salary_2025_26)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Status</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {playerData.player.is_active ? 'Active' : 'Inactive'}
                      {playerData.player.is_rookie && ' • Rookie'}
                    </Typography>
                  </Box>
                  {playerData.player.team_city && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Team City</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.team_city}</Typography>
                    </Box>
                  )}
                  {playerData.player.roster_status && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Roster Status</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.roster_status}</Typography>
                    </Box>
                  )}
                  {playerData.player.country && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Country</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{playerData.player.country}</Typography>
                    </Box>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Stats Cards */}
        <Grid xs={12} md={8}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue as number)}>
            <TabList>
              <Tab>Career Stats</Tab>
              <Tab>Season Breakdown</Tab>
              <Tab>2024-25 Game Logs</Tab>
              <Tab>Contract Data</Tab>
              <Tab>Upcoming Games</Tab>
            </TabList>

            <TabPanel value={0}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Career Statistics
                  </Typography>
                  
                  {playerData.careerStats ? (
                    <>
                      <Grid container spacing={2}>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                              {formatNumber(playerData.careerStats.pts)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Career Points</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                              {formatNumber(playerData.careerStats.reb)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Career Rebounds</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                              {formatNumber(playerData.careerStats.ast)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Career Assists</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                              {formatNumber(playerData.careerStats.fantasy_pts)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Career Fantasy Pts</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3 }} />

                      <Grid container spacing={2}>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatNumber(playerData.careerStats.gp)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Games Played</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatNumber(playerData.careerStats.stl)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Steals</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatNumber(playerData.careerStats.blk)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Blocks</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(playerData.careerStats.fg_pct)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">FG%</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(playerData.careerStats.fg3_pct)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">3P%</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(playerData.careerStats.ft_pct)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">FT%</Typography>
                          </Box>
                        </Grid>
                      </Grid>
                    </>
                  ) : (
                    <Alert color="warning">
                      <Typography>No career statistics available</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={1}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Season Breakdown
                  </Typography>
                  
                  {playerData.seasonBreakdown && playerData.seasonBreakdown.length > 0 ? (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table hoverRow size="sm">
                        <thead>
                          <tr>
                            <th>Season</th>
                            <th>Team</th>
                            <th>Age</th>
                            <th>GP</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>FG%</th>
                            <th>3P%</th>
                            <th>FT%</th>
                            <th>Fantasy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playerData.seasonBreakdown.map((season, index) => (
                            <tr key={index}>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                  {season.season_id}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {season.team_abbreviation}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {season.player_age}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {season.gp}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                                  {season.pts}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                                  {season.reb}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                  {season.ast}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {formatPercentage(season.fg_pct)}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {formatPercentage(season.fg3_pct)}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {formatPercentage(season.ft_pct)}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                                  {season.fantasy_pts}
                                </Typography>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Box>
                  ) : (
                    <Alert color="warning">
                      <Typography>No season breakdown available</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={2}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    2024-25 Game Logs
                  </Typography>
                  
                  {playerData.recentGameLogs && playerData.recentGameLogs.length > 0 ? (
                    <>
                      <Box sx={{ overflowX: 'auto' }}>
                        <Table hoverRow size="sm">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Matchup</th>
                              <th>Result</th>
                              <th>Min</th>
                              <th>PTS</th>
                              <th>REB</th>
                              <th>AST</th>
                              <th>STL</th>
                              <th>BLK</th>
                              <th>FG%</th>
                              <th>3P%</th>
                              <th>FT%</th>
                              <th>Fantasy</th>
                            </tr>
                          </thead>
                          <tbody>
                            {playerData.recentGameLogs.map((game, index) => (
                              <tr key={index}>
                                <td>
                                  <Typography level="body-sm">
                                    {new Date(game.game_date).toLocaleDateString()}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                    {game.matchup}
                                  </Typography>
                                </td>
                                <td>
                                  <Chip size="sm" color={game.wl === 'W' ? 'success' : 'danger'} variant="soft">
                                    {game.wl}
                                  </Chip>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {game.min || 'N/A'}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                                    {game.pts || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                                    {game.reb || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                    {game.ast || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {game.stl || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {game.blk || 0}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatPercentage(game.fg_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatPercentage(game.fg3_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatPercentage(game.ft_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                                    {game.nba_fantasy_pts || 0}
                                  </Typography>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </Box>

                      {/* Game Logs Pagination */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                        <Typography level="body-sm" color="neutral">
                          Showing {((gameLogsPage - 1) * gameLogsPageSize) + 1} to {Math.min(gameLogsPage * gameLogsPageSize, playerData.gameLogsPagination.total)} of {playerData.gameLogsPagination.total} games
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="outlined"
                            size="sm"
                            startDecorator={<NavigateBefore />}
                            onClick={() => setGameLogsPage(gameLogsPage - 1)}
                            disabled={gameLogsPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outlined"
                            size="sm"
                            endDecorator={<NavigateNext />}
                            onClick={() => setGameLogsPage(gameLogsPage + 1)}
                            disabled={gameLogsPage >= playerData.gameLogsPagination.totalPages}
                          >
                            Next
                          </Button>
                        </Stack>
                      </Box>
                    </>
                  ) : (
                    <Alert color="warning">
                      <Typography>No 2024-25 game logs available</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Contract Data
                  </Typography>
                  
                  {playerData.player ? (
                    <>
                      <Grid container spacing={2}>
                        <Grid xs={12} sm={6}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                              {playerData.player.contract_years_remaining || 0}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Years Remaining</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={12} sm={6}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                              ${playerData.player.salary_2025_26 ? (playerData.player.salary_2025_26 / 1000000).toFixed(1) + 'M' : 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Current Salary (2025-26)</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3 }} />

                      <Typography level="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
                        Future Salary Breakdown
                      </Typography>
                      
                      <Grid container spacing={2}>
                        {playerData.player.salary_2026_27 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.salary_2026_27 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2026-27</Typography>
                            </Box>
                          </Grid>
                        )}
                        {playerData.player.salary_2027_28 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.salary_2027_28 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2027-28</Typography>
                            </Box>
                          </Grid>
                        )}
                        {playerData.player.salary_2028_29 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.salary_2028_29 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2028-29</Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>

                      {(!playerData.player.salary_2026_27 && 
                        !playerData.player.salary_2027_28 && !playerData.player.salary_2028_29) && (
                        <Alert color="warning" sx={{ mt: 2 }}>
                          <Typography>
                            No future contract data available for this player.
                          </Typography>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <Alert color="warning">
                      <Typography>No contract data available for this player.</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={4}>
              <UpcomingGamesTab playerId={playerId} />
            </TabPanel>
          </Tabs>
        </Grid>
      </Grid>
    </Box>
  );
}

// Upcoming Games Tab Component (copied from Players.tsx)
function UpcomingGamesTab({ playerId }: { playerId: string }) {
  const { data: upcomingGames, isLoading, error } = usePlayerUpcomingGames(playerId);

  if (isLoading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CalendarToday color="primary" />
            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
              Upcoming Games
            </Typography>
          </Box>
          <LinearProgress />
          <Typography sx={{ mt: 2 }}>Loading upcoming games...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CalendarToday color="primary" />
            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
              Upcoming Games
            </Typography>
          </Box>
          <Alert color="danger">
            <Typography>Error loading upcoming games: {error.message}</Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!upcomingGames || upcomingGames.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CalendarToday color="primary" />
            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
              Upcoming Games
            </Typography>
          </Box>
          <Alert color="neutral">
            <Typography>No upcoming games found for this player's team.</Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const formatGameDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatGameTime = (timeString?: string) => {
    if (!timeString) return 'TBD';
    const time = new Date(`2000-01-01T${timeString}`);
    return time.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <CalendarToday color="primary" />
          <Typography level="h4" sx={{ fontWeight: 'bold' }}>
            Upcoming Games - 2025-26 Season
          </Typography>
        </Box>

        <Table hoverRow>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Matchup</th>
              <th>Location</th>
              <th>Fantasy Week</th>
            </tr>
          </thead>
          <tbody>
            {upcomingGames.map((game) => (
              <tr
                key={game.id}
                style={{
                  borderLeft: game.is_week_start ? '4px solid #000' : 'none',
                  borderRight: game.is_week_end ? '4px solid #000' : 'none',
                  backgroundColor: game.is_week_start || game.is_week_end ? '#f5f5f5' : 'transparent'
                }}
              >
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {formatGameDate(game.game_date)}
                  </Typography>
                  {(game.is_week_start || game.is_week_end) && (
                    <Chip
                      size="sm"
                      color="primary"
                      variant="solid"
                      sx={{ mt: 0.5, fontSize: '0.7rem' }}
                    >
                      {game.is_week_start ? 'Week Start' : 'Week End'}
                    </Chip>
                  )}
                </td>
                <td>
                  <Typography level="body-sm">
                    {formatGameTime(game.game_time_est)}
                  </Typography>
                </td>
                <td>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {game.away_team_tricode}
                    </Typography>
                    <Typography level="body-sm" color="neutral">
                      @
                    </Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {game.home_team_tricode}
                    </Typography>
                  </Box>
                </td>
                <td>
                  <Typography level="body-sm">
                    {game.arena_name && game.arena_city 
                      ? `${game.arena_city}` 
                      : 'TBD'
                    }
                  </Typography>
                </td>
                <td>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {game.fantasy_week_name || 'TBD'}
                  </Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Alert color="neutral" sx={{ mt: 2 }}>
          <Typography level="body-sm">
            <strong>Note:</strong> Games with bold black borders mark the start and end of fantasy weeks. 
            This helps you plan your lineup changes for optimal scoring periods.
          </Typography>
        </Alert>
      </CardContent>
    </Card>
  );
}
