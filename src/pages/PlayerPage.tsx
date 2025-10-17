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
import { usePlayerComprehensive } from '../hooks/usePlayerComprehensive';
import { usePlayerUpcomingGames } from '../hooks/usePlayerUpcomingGames';
import PlayerActionButtons from '../components/PlayerActionButtons';

interface PlayerPageProps {
  playerId: string;
  playerName: string;
  onBack: () => void;
  leagueId?: string;
  teamName?: string;
}

export default function PlayerPage({ 
  playerId, 
  playerName, 
  onBack, 
  leagueId, 
  teamName 
}: PlayerPageProps) {
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

  const formatGamePercentage = (num: string | number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    const numValue = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(numValue)) return 'N/A';
    return `${(numValue * 100).toFixed(1)}%`;
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
                  playerId={playerId}
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
                      {formatSalary((playerData.player as any)?.nba_hoopshype_salaries?.[0]?.salary_2025_26)}
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
              <Tab>ESPN Projections</Tab>
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
                                  <Chip size="sm" color="neutral" variant="soft">
                                    N/A
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
                                    {formatGamePercentage(game.fg_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatGamePercentage(game.fg3_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm">
                                    {formatGamePercentage(game.ft_pct)}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                                    N/A
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
                              {playerData.player.nba_hoopshype_salaries?.[0]?.contract_years_remaining || 0}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Years Remaining</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={12} sm={6}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                              {playerData.player.nba_hoopshype_salaries?.[0]?.salary_2025_26 
                                ? `$${(playerData.player.nba_hoopshype_salaries[0].salary_2025_26 / 1000000).toFixed(1)}M` 
                                : 'N/A'}
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
                        {playerData.player.nba_hoopshype_salaries?.[0]?.salary_2026_27 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.nba_hoopshype_salaries[0].salary_2026_27 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2026-27</Typography>
                            </Box>
                          </Grid>
                        )}
                        {playerData.player.nba_hoopshype_salaries?.[0]?.salary_2027_28 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.nba_hoopshype_salaries[0].salary_2027_28 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2027-28</Typography>
                            </Box>
                          </Grid>
                        )}
                        {playerData.player.nba_hoopshype_salaries?.[0]?.salary_2028_29 && (
                          <Grid xs={6} sm={3}>
                            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                              <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                                ${(playerData.player.nba_hoopshype_salaries[0].salary_2028_29 / 1000000).toFixed(1)}M
                              </Typography>
                              <Typography level="body-sm" color="neutral">2028-29</Typography>
                            </Box>
                          </Grid>
                        )}
                      </Grid>

                      {(!playerData.player.nba_hoopshype_salaries?.[0]?.salary_2026_27 && 
                        !playerData.player.nba_hoopshype_salaries?.[0]?.salary_2027_28 && 
                        !playerData.player.nba_hoopshype_salaries?.[0]?.salary_2028_29) && (
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
              <Card variant="outlined">
                <CardContent>
                  <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    ESPN 2026 Projections
                  </Typography>
                  
                  {playerData.espnProjections ? (
                    <>
                      <Grid container spacing={2}>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                              {playerData.espnProjections.proj_2026_pts?.toFixed(1) || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Points per Game</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                              {playerData.espnProjections.proj_2026_reb?.toFixed(1) || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Rebounds per Game</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                              {playerData.espnProjections.proj_2026_ast?.toFixed(1) || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Assists per Game</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                            <Typography level="h3" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                              {playerData.espnProjections.proj_2026_gp || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Games Played</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Divider sx={{ my: 3 }} />

                      <Grid container spacing={2}>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {playerData.espnProjections.proj_2026_min?.toFixed(1) || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Minutes per Game</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {playerData.espnProjections.proj_2026_stl?.toFixed(1) || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Steals per Game</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {playerData.espnProjections.proj_2026_blk?.toFixed(1) || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Blocks per Game</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {playerData.espnProjections.proj_2026_3pm?.toFixed(1) || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">3-Pointers per Game</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {playerData.espnProjections.proj_2026_to?.toFixed(1) || 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Turnovers per Game</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {playerData.espnProjections.proj_2026_fg_pct ? `${(playerData.espnProjections.proj_2026_fg_pct * 100).toFixed(1)}%` : 'N/A'}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Field Goal %</Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {playerData.espnProjections.outlook_2026 && (
                        <>
                          <Divider sx={{ my: 3 }} />
                          <Typography level="h3" sx={{ mb: 2, fontWeight: 'bold' }}>
                            2026 Outlook
                          </Typography>
                          <Alert color="primary">
                            <Typography>
                              {playerData.espnProjections.outlook_2026}
                            </Typography>
                          </Alert>
                        </>
                      )}
                    </>
                  ) : (
                    <Alert color="warning">
                      <Typography>No ESPN projections available for this player.</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabPanel>

            <TabPanel value={5}>
              <UpcomingGamesTab playerId={playerId} />
            </TabPanel>
          </Tabs>
        </Grid>
      </Grid>
    </Box>
  );
}

// Upcoming Games Tab Component
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
