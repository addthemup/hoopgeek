import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  Chip,
  Stack,
  Button,
  Alert,
  LinearProgress,
  Divider,
  Table,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import { ArrowBack } from '@mui/icons-material';
import { usePlayerStats } from '../hooks/usePlayerStats';
import { useState } from 'react';

interface PlayerDetailProps {
  playerId: string;
  onBack: () => void;
}

export default function PlayerDetail({ playerId, onBack }: PlayerDetailProps) {
  const { data: playerStats, isLoading, error } = usePlayerStats(playerId);
  const [activeTab, setActiveTab] = useState(0);

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            variant="outlined"
            startDecorator={<ArrowBack />}
            onClick={onBack}
            size="sm"
            sx={{ mr: 2 }}
          >
            Back to Players
          </Button>
          <LinearProgress sx={{ flex: 1 }} />
        </Box>
        <Typography>Loading player stats...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            variant="outlined"
            startDecorator={<ArrowBack />}
            onClick={onBack}
            size="sm"
            sx={{ mr: 2 }}
          >
            Back to Players
          </Button>
        </Box>
        <Alert color="danger">
          <Typography>Error loading player stats: {error.message}</Typography>
        </Alert>
      </Box>
    );
  }

  if (!playerStats) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            variant="outlined"
            startDecorator={<ArrowBack />}
            onClick={onBack}
            size="sm"
            sx={{ mr: 2 }}
          >
            Back to Players
          </Button>
        </Box>
        <Alert color="warning">
          <Typography>No player data found</Typography>
        </Alert>
      </Box>
    );
  }

  const { player, careerStats, seasonBreakdown, recentGames } = playerStats;

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
      default:
        return 'neutral';
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString();
  };

  const formatPercentage = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return `${num.toFixed(1)}%`;
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
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startDecorator={<ArrowBack />}
          onClick={onBack}
          size="sm"
          sx={{ mr: 2 }}
        >
          Back to Players
        </Button>
        <Typography level="h2" component="h1" sx={{ fontWeight: 'bold' }}>
          {player.name}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Player Info Card */}
        <Grid xs={12} md={4}>
          <Card variant="outlined" sx={{ height: 'fit-content' }}>
            <CardContent>
              <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
                <Avatar
                  size="lg"
                  sx={{ 
                    width: 120, 
                    height: 120,
                    bgcolor: 'primary.500',
                    fontSize: '2rem'
                  }}
                >
                  {player.name.split(' ').map(n => n[0]).join('')}
                </Avatar>
                
                <Box>
                  <Typography level="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {player.name}
                  </Typography>
                  <Typography level="body-md" color="neutral" sx={{ mb: 2 }}>
                    #{player.jersey_number || 'N/A'} • {player.position || 'N/A'} • {player.team_name || 'N/A'}
                  </Typography>
                  
                  <Chip 
                    color={getPositionColor(player.position || '')} 
                    variant="soft"
                    size="lg"
                    sx={{ mb: 2 }}
                  >
                    {player.position || 'N/A'}
                  </Chip>
                </Box>

                <Divider sx={{ width: '100%' }} />

                <Stack spacing={1} sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Height</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{formatHeight(player.height)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Weight</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.weight ? `${player.weight} lbs` : 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Age</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.age || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Experience</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.years_pro ? `${player.years_pro} years` : 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">College</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.college || 'N/A'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Draft</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {player.draft_year ? `${player.draft_year} • Round ${player.draft_round} • Pick ${player.draft_number}` : 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Birth Place</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {player.birth_city && player.birth_state ? `${player.birth_city}, ${player.birth_state}` : player.birth_country || 'N/A'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Salary</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {formatSalary(player.salary)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Status</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {player.is_active ? 'Active' : 'Inactive'}
                      {player.is_rookie && ' • Rookie'}
                    </Typography>
                  </Box>
                  {player.team_city && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Team City</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.team_city}</Typography>
                    </Box>
                  )}
                  {player.roster_status && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Roster Status</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.roster_status}</Typography>
                    </Box>
                  )}
                  {player.country && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography level="body-sm" color="neutral">Country</Typography>
                      <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.country}</Typography>
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
              <Tab>Recent Games</Tab>
            </TabList>

            <TabPanel value={0}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Career Statistics
              </Typography>
              
                  {careerStats ? (
                    <>
              <Grid container spacing={2}>
                <Grid xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                    <Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                              {formatNumber(careerStats.pts)}
                    </Typography>
                            <Typography level="body-sm" color="neutral">Career Points</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                    <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                              {formatNumber(careerStats.reb)}
                    </Typography>
                            <Typography level="body-sm" color="neutral">Career Rebounds</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                    <Typography level="h3" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                              {formatNumber(careerStats.ast)}
                    </Typography>
                            <Typography level="body-sm" color="neutral">Career Assists</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                    <Typography level="h3" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                              {formatNumber(careerStats.fantasy_pts)}
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
                              {formatNumber(careerStats.gp)}
                            </Typography>
                            <Typography level="body-sm" color="neutral">Games Played</Typography>
                          </Box>
                        </Grid>
                        <Grid xs={6} sm={4}>
                          <Box sx={{ textAlign: 'center', p: 2 }}>
                            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatNumber(careerStats.stl)}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Steals</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatNumber(careerStats.blk)}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Blocks</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(careerStats.fg_pct ? careerStats.fg_pct * 100 : undefined)}
                    </Typography>
                    <Typography level="body-sm" color="neutral">FG%</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(careerStats.fg3_pct ? careerStats.fg3_pct * 100 : undefined)}
                    </Typography>
                    <Typography level="body-sm" color="neutral">3P%</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                              {formatPercentage(careerStats.ft_pct ? careerStats.ft_pct * 100 : undefined)}
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
                  
                  {seasonBreakdown && seasonBreakdown.length > 0 ? (
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
                          {seasonBreakdown.map((season, index) => (
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
                                  {formatPercentage(season.fg_pct ? season.fg_pct * 100 : undefined)}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {formatPercentage(season.fg3_pct ? season.fg3_pct * 100 : undefined)}
                                </Typography>
                              </td>
                              <td>
                                <Typography level="body-sm">
                                  {formatPercentage(season.ft_pct ? season.ft_pct * 100 : undefined)}
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
                Recent Games
              </Typography>
              
                  {recentGames && recentGames.length > 0 ? (
              <Box sx={{ overflowX: 'auto' }}>
                <Table hoverRow size="sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Opponent</th>
                      <th>Points</th>
                      <th>Rebounds</th>
                      <th>Assists</th>
                      <th>Fantasy Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGames.map((game, index) => (
                      <tr key={index}>
                        <td>
                          <Typography level="body-sm">
                            {new Date(game.date).toLocaleDateString()}
                          </Typography>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                                  {game.opponent}
                          </Typography>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                            {game.points}
                          </Typography>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                            {game.rebounds}
                          </Typography>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                            {game.assists}
                          </Typography>
                        </td>
                        <td>
                          <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                            {game.fantasyPoints}
                          </Typography>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Box>
                  ) : (
                    <Alert color="warning">
                      <Typography>No recent games available</Typography>
                    </Alert>
                  )}
            </CardContent>
          </Card>
            </TabPanel>
          </Tabs>
        </Grid>
      </Grid>
    </Box>
  );
}