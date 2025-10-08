import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  Avatar,
  Button,
  IconButton,
  Alert,
  LinearProgress,
  Sheet,
  Divider,
  Select,
  Option,
} from '@mui/joy';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeague } from '../hooks/useLeagues';
import { useAuth } from '../hooks/useAuth';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import SportsBasketballIcon from '@mui/icons-material/SportsBasketball';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VisibilityIcon from '@mui/icons-material/Visibility';

interface LeagueScoreboardProps {
  leagueId: string;
}

// Mock data for matchups
const mockMatchups = [
  {
    id: '1',
    week: 6,
    period: 'Oct 7 - 13',
    status: 'completed',
    matchups: [
      {
        id: '1-1',
        homeTeam: {
          id: '1',
          name: 'Team Ballers',
          owner: 'John Doe',
          logo: '🏀',
          record: '4-1-0',
          place: '2nd',
          score: 1247.3,
          isWinner: true,
        },
        awayTeam: {
          id: '2',
          name: 'Slam Dunk Squad',
          owner: 'Jane Smith',
          logo: '⚡',
          record: '3-2-0',
          place: '4th',
          score: 1189.7,
          isWinner: false,
        },
        matchupType: 'regular',
      },
      {
        id: '1-2',
        homeTeam: {
          id: '3',
          name: 'Hoops Heroes',
          owner: 'Bob Johnson',
          logo: '👑',
          record: '5-0-0',
          place: '1st',
          score: 1356.2,
          isWinner: true,
        },
        awayTeam: {
          id: '4',
          name: 'Court Kings',
          owner: 'Alice Brown',
          logo: '🏆',
          record: '2-3-0',
          place: '6th',
          score: 1098.4,
          isWinner: false,
        },
        matchupType: 'regular',
      },
      {
        id: '1-3',
        homeTeam: {
          id: '5',
          name: 'Dunk Dynasty',
          owner: 'Charlie Wilson',
          logo: '🔥',
          record: '3-2-0',
          place: '3rd',
          score: 1156.8,
          isWinner: true,
        },
        awayTeam: {
          id: '6',
          name: 'Basketball Beasts',
          owner: 'Diana Prince',
          logo: '💪',
          record: '1-4-0',
          place: '8th',
          score: 987.3,
          isWinner: false,
        },
        matchupType: 'regular',
      },
    ],
  },
  {
    id: '2',
    week: 5,
    period: 'Sep 30 - Oct 6',
    status: 'completed',
    matchups: [
      {
        id: '2-1',
        homeTeam: {
          id: '1',
          name: 'Team Ballers',
          owner: 'John Doe',
          logo: '🏀',
          record: '3-1-0',
          place: '2nd',
          score: 1189.2,
          isWinner: false,
        },
        awayTeam: {
          id: '3',
          name: 'Hoops Heroes',
          owner: 'Bob Johnson',
          logo: '👑',
          record: '4-0-0',
          place: '1st',
          score: 1298.7,
          isWinner: true,
        },
        matchupType: 'regular',
      },
      {
        id: '2-2',
        homeTeam: {
          id: '2',
          name: 'Slam Dunk Squad',
          owner: 'Jane Smith',
          logo: '⚡',
          record: '3-1-0',
          place: '3rd',
          score: 1156.4,
          isWinner: true,
        },
        awayTeam: {
          id: '4',
          name: 'Court Kings',
          owner: 'Alice Brown',
          logo: '🏆',
          record: '2-2-0',
          place: '5th',
          score: 1087.9,
          isWinner: false,
        },
        matchupType: 'regular',
      },
    ],
  },
];

export default function LeagueScoreboard({ leagueId }: LeagueScoreboardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: league, isLoading, error } = useLeague(leagueId);
  const { data: nbaScoreboard, isLoading: nbaLoading, error: nbaError } = useNBAScoreboard();

  const [selectedWeek, setSelectedWeek] = React.useState('6');

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography level="body-md" sx={{ mt: 2 }}>
          Loading scoreboard...
        </Typography>
      </Box>
    );
  }

  if (error || !league) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-md">
            Failed to load scoreboard. Please try again.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const currentWeek = mockMatchups.find(m => m.id === selectedWeek) || mockMatchups[0];

  const handleViewMatchup = (matchupId: string) => {
    navigate(`/league/${leagueId}/matchup/${matchupId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'live': return 'warning';
      case 'upcoming': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Final';
      case 'live': return 'Live';
      case 'upcoming': return 'Upcoming';
      default: return 'Unknown';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography level="h2" sx={{ mb: 1 }}>
              League Scoreboard
            </Typography>
            <Typography level="body-lg" color="neutral">
              {league.name} • {currentWeek.period}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Select
              value={selectedWeek}
              onChange={(_, value) => setSelectedWeek(value || '6')}
              size="sm"
              sx={{ minWidth: 200 }}
            >
              {mockMatchups.map((week) => (
                <Option key={week.id} value={week.id}>
                  Week {week.week} ({week.period})
                </Option>
              ))}
            </Select>
            <Chip
              color={getStatusColor(currentWeek.status)}
              variant="soft"
              size="sm"
            >
              {getStatusText(currentWeek.status)}
            </Chip>
          </Stack>
        </Stack>

        {/* League Stats Summary */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography level="h3" color="primary">
                    {currentWeek.matchups.length}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Matchups This Week
                  </Typography>
                </Box>
              </Grid>
              <Grid xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography level="h3" color="success">
                    {currentWeek.matchups.reduce((acc, m) => acc + (m.homeTeam.score + m.awayTeam.score), 0).toFixed(1)}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Total Points Scored
                  </Typography>
                </Box>
              </Grid>
              <Grid xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography level="h3" color="warning">
                    {Math.round(currentWeek.matchups.reduce((acc, m) => acc + (m.homeTeam.score + m.awayTeam.score), 0) / currentWeek.matchups.length)}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Average Points
                  </Typography>
                </Box>
              </Grid>
              <Grid xs={12} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography level="h3" color="info">
                    {currentWeek.matchups.filter(m => m.matchupType === 'regular').length}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Regular Season Games
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>

      {/* Matchups */}
      <Grid container spacing={3}>
        {currentWeek.matchups.map((matchup) => (
          <Grid xs={12} key={matchup.id}>
            <Card 
              variant="outlined" 
              sx={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 'md',
                  transform: 'translateY(-2px)',
                }
              }}
              onClick={() => handleViewMatchup(matchup.id)}
            >
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography level="h4">
                    Week {currentWeek.week} Matchup
                  </Typography>
                  <Button
                    variant="outlined"
                    size="sm"
                    endDecorator={<ArrowForwardIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewMatchup(matchup.id);
                    }}
                  >
                    View Details
                  </Button>
                </Stack>

                <Grid container spacing={3} alignItems="center">
                  {/* Away Team */}
                  <Grid xs={12} md={5}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar
                        size="lg"
                        sx={{
                          bgcolor: matchup.awayTeam.isWinner ? 'success.100' : 'neutral.100',
                          color: matchup.awayTeam.isWinner ? 'success.700' : 'neutral.600',
                          fontSize: 'xl',
                          width: 60,
                          height: 60,
                        }}
                      >
                        {matchup.awayTeam.logo}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography level="h5" sx={{ mb: 0.5 }}>
                          {matchup.awayTeam.name}
                        </Typography>
                        <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                          {matchup.awayTeam.owner} • {matchup.awayTeam.record} ({matchup.awayTeam.place})
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography level="h4" color={matchup.awayTeam.isWinner ? 'success' : 'neutral'}>
                            {matchup.awayTeam.score}
                          </Typography>
                          {matchup.awayTeam.isWinner && (
                            <EmojiEventsIcon sx={{ color: 'success.500', fontSize: 20 }} />
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </Grid>

                  {/* VS Section */}
                  <Grid xs={12} md={2}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                        {getStatusText(currentWeek.status)}
                      </Typography>
                      <Typography level="h6" color="primary">
                        VS
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        {currentWeek.period}
                      </Typography>
                    </Box>
                  </Grid>

                  {/* Home Team */}
                  <Grid xs={12} md={5}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ flexDirection: 'row-reverse' }}>
                      <Avatar
                        size="lg"
                        sx={{
                          bgcolor: matchup.homeTeam.isWinner ? 'success.100' : 'neutral.100',
                          color: matchup.homeTeam.isWinner ? 'success.700' : 'neutral.600',
                          fontSize: 'xl',
                          width: 60,
                          height: 60,
                        }}
                      >
                        {matchup.homeTeam.logo}
                      </Avatar>
                      <Box sx={{ flex: 1, textAlign: 'right' }}>
                        <Typography level="h5" sx={{ mb: 0.5 }}>
                          {matchup.homeTeam.name}
                        </Typography>
                        <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                          {matchup.homeTeam.owner} • {matchup.homeTeam.record} ({matchup.homeTeam.place})
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ justifyContent: 'flex-end' }}>
                          <Typography level="h4" color={matchup.homeTeam.isWinner ? 'success' : 'neutral'}>
                            {matchup.homeTeam.score}
                          </Typography>
                          {matchup.homeTeam.isWinner && (
                            <EmojiEventsIcon sx={{ color: 'success.500', fontSize: 20 }} />
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>

                {/* Quick Stats */}
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="body-sm" color="neutral">
                        Total Points
                      </Typography>
                      <Typography level="h6">
                        {(matchup.homeTeam.score + matchup.awayTeam.score).toFixed(1)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="body-sm" color="neutral">
                        Point Differential
                      </Typography>
                      <Typography level="h6" color={matchup.homeTeam.isWinner ? 'success' : 'danger'}>
                        {Math.abs(matchup.homeTeam.score - matchup.awayTeam.score).toFixed(1)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="body-sm" color="neutral">
                        Winner
                      </Typography>
                      <Typography level="h6" color="success">
                        {matchup.homeTeam.isWinner ? matchup.homeTeam.name : matchup.awayTeam.name}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography level="body-sm" color="neutral">
                        Matchup Type
                      </Typography>
                      <Chip size="sm" color="primary" variant="soft">
                        {matchup.matchupType === 'regular' ? 'Regular Season' : 'Playoffs'}
                      </Chip>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Card variant="outlined" sx={{ mt: 4 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography level="h5" sx={{ mb: 1 }}>
                League Analytics
              </Typography>
              <Typography level="body-sm" color="neutral">
                Dive deeper into league performance and trends
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startDecorator={<TrendingUpIcon />}>
                View Trends
              </Button>
              <Button variant="solid" startDecorator={<VisibilityIcon />}>
                Full Analytics
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* NBA Scoreboard Section */}
      <Card variant="outlined" sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography level="h4" sx={{ fontWeight: 'bold' }}>
              🏀 NBA Games Today
            </Typography>
            {nbaScoreboard && (
              <Typography level="body-xs" color="neutral">
                Last updated: {new Date(nbaScoreboard.lastUpdated).toLocaleTimeString()}
              </Typography>
            )}
          </Stack>
          
          {nbaLoading ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <LinearProgress />
              <Typography level="body-sm" sx={{ mt: 1 }}>
                Loading NBA games...
              </Typography>
            </Box>
          ) : nbaError ? (
            <Alert color="warning">
              <Typography level="body-sm">
                Unable to load NBA games. {nbaError.message}
              </Typography>
            </Alert>
          ) : nbaScoreboard && nbaScoreboard.games.length > 0 ? (
            <Stack spacing={2}>
              {nbaScoreboard.games.map((game) => (
                <Sheet key={game.gameId} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography level="body-xs" color="neutral">
                      {game.gameStatus === 1 ? 'Scheduled' : 
                       game.gameStatus === 2 ? 'Live' : 'Final'}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {game.gameStatusText}
                    </Typography>
                  </Stack>
                  <Grid container spacing={1} alignItems="center">
                    <Grid xs={5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.500', fontSize: '0.7rem' }}>
                          {game.awayTeam.abbreviation}
                        </Avatar>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {game.awayTeam.name}
                        </Typography>
                      </Stack>
                    </Grid>
                    <Grid xs={2} sx={{ textAlign: 'center' }}>
                      <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                        {game.awayTeam.points}
                      </Typography>
                    </Grid>
                    <Grid xs={5}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {game.homeTeam.name}
                        </Typography>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.500', fontSize: '0.7rem' }}>
                          {game.homeTeam.abbreviation}
                        </Avatar>
                      </Stack>
                    </Grid>
                  </Grid>
                  <Grid container spacing={1} sx={{ mt: 0.5 }}>
                    <Grid xs={5}></Grid>
                    <Grid xs={2} sx={{ textAlign: 'center' }}>
                      <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                        {game.homeTeam.points}
                      </Typography>
                    </Grid>
                    <Grid xs={5}></Grid>
                  </Grid>
                  {game.arena && game.arena !== 'Unknown Arena' && (
                    <Typography level="body-xs" color="neutral" sx={{ mt: 1, textAlign: 'center' }}>
                      {game.arena}
                    </Typography>
                  )}
                </Sheet>
              ))}
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography level="body-md" color="neutral">
                No NBA games scheduled for today.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
