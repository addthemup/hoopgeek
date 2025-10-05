import React from 'react';
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
} from '@mui/joy';
import { ArrowBack, TrendingUp, TrendingDown } from '@mui/icons-material';
import { usePlayerStats } from '../hooks/usePlayerStats';

interface PlayerDetailProps {
  playerId: string;
  playerName: string;
  onBack: () => void;
}

export default function PlayerDetail({ playerId, playerName, onBack }: PlayerDetailProps) {
  const { data: playerStats, isLoading, error } = usePlayerStats(playerId);

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

  const { player, seasonStats, recentGames } = playerStats;

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
                    #{player.jersey} • {player.position} • {player.team}
                  </Typography>
                  
                  <Chip 
                    color={getPositionColor(player.position)} 
                    variant="soft"
                    size="lg"
                    sx={{ mb: 2 }}
                  >
                    {player.position}
                  </Chip>
                </Box>

                <Divider sx={{ width: '100%' }} />

                <Stack spacing={1} sx={{ width: '100%' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Height</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.height}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Weight</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.weight} lbs</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Age</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.age}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Experience</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.experience} years</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">College</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>{player.college}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography level="body-sm" color="neutral">Draft</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {player.draftYear} • Round {player.draftRound} • Pick {player.draftNumber}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Season Stats Card */}
        <Grid xs={12} md={8}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                2024-25 Season Stats
              </Typography>
              
              <Grid container spacing={2}>
                <Grid xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                    <Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                      {seasonStats.points}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Points</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                    <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                      {seasonStats.rebounds}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Rebounds</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                    <Typography level="h3" sx={{ fontWeight: 'bold', color: 'warning.500' }}>
                      {seasonStats.assists}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Assists</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                    <Typography level="h3" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                      {seasonStats.fantasyPoints}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Fantasy Pts</Typography>
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Grid container spacing={2}>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {seasonStats.steals}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Steals</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {seasonStats.blocks}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Blocks</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {seasonStats.turnovers}
                    </Typography>
                    <Typography level="body-sm" color="neutral">Turnovers</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {seasonStats.fieldGoalPercentage}%
                    </Typography>
                    <Typography level="body-sm" color="neutral">FG%</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {seasonStats.threePointPercentage}%
                    </Typography>
                    <Typography level="body-sm" color="neutral">3P%</Typography>
                  </Box>
                </Grid>
                <Grid xs={6} sm={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                      {seasonStats.freeThrowPercentage}%
                    </Typography>
                    <Typography level="body-sm" color="neutral">FT%</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Games Card */}
        <Grid xs={12}>
          <Card variant="outlined">
            <CardContent>
              <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
                Recent Games
              </Typography>
              
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
                            vs {game.opponent}
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
