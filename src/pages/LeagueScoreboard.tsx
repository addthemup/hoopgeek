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
  Alert,
  LinearProgress,
  Divider,
  Select,
  Option,
} from '@mui/joy';
import { useNavigate } from 'react-router-dom';
import { useLeague } from '../hooks/useLeagues';
import { useWeeklyMatchups, useCurrentWeek } from '../hooks/useWeeklyMatchups';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface LeagueScoreboardProps {
  leagueId: string;
}

export default function LeagueScoreboard({ leagueId }: LeagueScoreboardProps) {
  const navigate = useNavigate();
  const { data: league, isLoading: leagueLoading, error: leagueError } = useLeague(leagueId);
  const { data: currentWeekNumber, isLoading: weekLoading } = useCurrentWeek(leagueId);
  const [selectedWeek, setSelectedWeek] = React.useState<number | undefined>(undefined);
  
  // Use selectedWeek if set, otherwise use currentWeekNumber
  const displayWeek = selectedWeek !== undefined ? selectedWeek : currentWeekNumber;
  
  const { data: matchups = [], isLoading: matchupsLoading, error: matchupsError } = useWeeklyMatchups(
    leagueId,
    displayWeek
  );

  // Update selectedWeek when currentWeekNumber changes
  React.useEffect(() => {
    if (currentWeekNumber !== undefined && selectedWeek === undefined) {
      setSelectedWeek(currentWeekNumber);
    }
  }, [currentWeekNumber, selectedWeek]);

  const isLoading = leagueLoading || weekLoading || matchupsLoading;

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

  if (leagueError || !league) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-md">
            Failed to load league. Please try again.
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (matchupsError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography level="body-md">
            Failed to load matchups. Please try again.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleViewMatchup = (matchupId: string) => {
    navigate(`/league/${leagueId}/matchup/${matchupId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'live': return 'warning';
      case 'scheduled': return 'neutral';
      default: return 'neutral';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Final';
      case 'live': return 'Live';
      case 'scheduled': return 'Scheduled';
      default: return 'Unknown';
    }
  };

  const getMatchupTypeText = (seasonType: string) => {
    switch (seasonType) {
      case 'regular': return 'Regular Season';
      case 'playoff': return 'Playoff';
      case 'championship': return 'Championship';
      default: return 'Regular Season';
    }
  };

  const formatMatchupDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography level="h2" sx={{ mb: 1 }}>
              League Scoreboard
            </Typography>
            <Typography level="body-lg" color="neutral">
              {league.name || 'Unnamed League'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography level="body-sm" color="neutral">
              Week
            </Typography>
            <Select
              value={displayWeek}
              onChange={(_, value) => setSelectedWeek(value || undefined)}
              size="sm"
              sx={{ minWidth: 120 }}
            >
              {Array.from({ length: 25 }, (_, i) => i + 1).map((week) => (
                <Option key={week} value={week}>
                  Week {week}
                </Option>
              ))}
            </Select>
            {matchups.length > 0 && (
              <Chip
                color={getStatusColor(matchups[0].status)}
                variant="soft"
                size="sm"
              >
                {getStatusText(matchups[0].status)}
              </Chip>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Matchups */}
      {matchups.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography level="body-md" color="neutral">
                No matchups scheduled for Week {displayWeek}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {matchups.map((matchup) => {
            const team1Score = matchup.fantasy_team1_score || 0;
            const team2Score = matchup.fantasy_team2_score || 0;
            const team1IsWinner = team1Score > team2Score;
            const team2IsWinner = team2Score > team1Score;

            return (
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
                        Week {matchup.week_number} Matchup
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
                      {/* Team 1 */}
                      <Grid xs={12} md={5}>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Avatar
                            size="lg"
                            sx={{
                              bgcolor: team1IsWinner ? 'success.100' : 'neutral.100',
                              color: team1IsWinner ? 'success.700' : 'neutral.600',
                              fontSize: 'xl',
                              width: 60,
                              height: 60,
                            }}
                          >
                            {matchup.team1?.team_name?.charAt(0) || '?'}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography level="h5" sx={{ mb: 0.5 }}>
                              {matchup.team1?.team_name || 'Unknown Team'}
                            </Typography>
                            <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                              {matchup.team1?.wins || 0}-{matchup.team1?.losses || 0}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography level="h4" color={team1IsWinner ? 'success' : 'neutral'}>
                                {team1Score.toFixed(1)}
                              </Typography>
                              {team1IsWinner && matchup.status === 'completed' && (
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
                            {getStatusText(matchup.status)}
                          </Typography>
                          <Typography level="h6" color="primary">
                            VS
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {formatMatchupDate(matchup.matchup_date)}
                          </Typography>
                        </Box>
                      </Grid>

                      {/* Team 2 */}
                      <Grid xs={12} md={5}>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexDirection: 'row-reverse' }}>
                          <Avatar
                            size="lg"
                            sx={{
                              bgcolor: team2IsWinner ? 'success.100' : 'neutral.100',
                              color: team2IsWinner ? 'success.700' : 'neutral.600',
                              fontSize: 'xl',
                              width: 60,
                              height: 60,
                            }}
                          >
                            {matchup.team2?.team_name?.charAt(0) || '?'}
                          </Avatar>
                          <Box sx={{ flex: 1, textAlign: 'right' }}>
                            <Typography level="h5" sx={{ mb: 0.5 }}>
                              {matchup.team2?.team_name || 'Unknown Team'}
                            </Typography>
                            <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                              {matchup.team2?.wins || 0}-{matchup.team2?.losses || 0}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ justifyContent: 'flex-end' }}>
                              <Typography level="h4" color={team2IsWinner ? 'success' : 'neutral'}>
                                {team2Score.toFixed(1)}
                              </Typography>
                              {team2IsWinner && matchup.status === 'completed' && (
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
                      <Grid xs={6} md={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography level="body-sm" color="neutral">
                            Total Points
                          </Typography>
                          <Typography level="h6">
                            {(team1Score + team2Score).toFixed(1)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={6} md={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography level="body-sm" color="neutral">
                            Point Differential
                          </Typography>
                          <Typography level="h6" color={team1IsWinner || team2IsWinner ? 'success' : 'neutral'}>
                            {Math.abs(team1Score - team2Score).toFixed(1)}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={12} md={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography level="body-sm" color="neutral">
                            Matchup Type
                          </Typography>
                          <Chip size="sm" color="primary" variant="soft">
                            {getMatchupTypeText(matchup.season_type)}
                          </Chip>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
