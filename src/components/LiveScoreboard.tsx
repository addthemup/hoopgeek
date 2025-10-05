import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Chip,
  LinearProgress,
  Alert,
  Divider,
} from '@mui/joy';
import { useLiveScoreboard, LiveGame, getGameStatusColor, formatGameTime } from '../hooks/useLiveScoreboard';

interface LiveScoreboardProps {
  gameDate?: string;
  maxGames?: number;
}

export default function LiveScoreboard({ gameDate, maxGames = 6 }: LiveScoreboardProps) {
  const { data: scoreboard, isLoading, error } = useLiveScoreboard(gameDate);

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LinearProgress sx={{ flex: 1 }} />
            <Typography level="body-sm">Loading live games...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Alert color="danger">
            <Typography level="body-md">
              Error loading live games: {error.message}
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!scoreboard || scoreboard.games.length === 0) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Alert color="warning">
            <Typography level="body-md">
              No games scheduled for today.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const games = scoreboard.games.slice(0, maxGames);

  const renderGameCard = (game: LiveGame) => {
    const statusColor = getGameStatusColor(game.gameStatus);
    const gameTime = formatGameTime(game);
    
    return (
      <Card 
        key={game.gameId}
        variant="outlined" 
        sx={{ 
          mb: 2,
          border: `2px solid ${statusColor}`,
          background: game.gameStatus === 2 
            ? 'linear-gradient(135deg, rgba(233, 69, 96, 0.1) 0%, rgba(233, 69, 96, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 8px 25px ${statusColor}30`
          }
        }}
      >
        <CardContent sx={{ p: 2 }}>
          {/* Game Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip 
                size="sm" 
                variant="soft" 
                sx={{ 
                  backgroundColor: statusColor,
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                {game.gameStatusText}
              </Chip>
              {game.nationalTV && (
                <Chip size="sm" variant="outlined" color="neutral">
                  {game.nationalTV}
                </Chip>
              )}
            </Box>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
              {gameTime}
            </Typography>
          </Box>

          {/* Teams and Scores */}
          <Stack spacing={1.5}>
            {/* Away Team */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', minWidth: '60px' }}>
                  {game.awayTeam.abbreviation}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                  {game.awayTeam.wins}-{game.awayTeam.losses}
                </Typography>
              </Box>
              <Typography 
                level="h6" 
                sx={{ 
                  fontWeight: 'bold',
                  color: game.gameStatus === 2 ? statusColor : 'text.primary'
                }}
              >
                {game.awayTeam.points}
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

            {/* Home Team */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold', minWidth: '60px' }}>
                  {game.homeTeam.abbreviation}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                  {game.homeTeam.wins}-{game.homeTeam.losses}
                </Typography>
              </Box>
              <Typography 
                level="h6" 
                sx={{ 
                  fontWeight: 'bold',
                  color: game.gameStatus === 2 ? statusColor : 'text.primary'
                }}
              >
                {game.homeTeam.points}
              </Typography>
            </Box>
          </Stack>

          {/* Arena */}
          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
              {game.arena}
            </Typography>
          </Box>

          {/* Quarter Scores (if available) */}
          {game.awayTeam.quarters.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 0.5 }}>
                Quarter Scores
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {game.awayTeam.quarters.map((score, index) => (
                    <Typography 
                      key={index}
                      level="body-xs" 
                      sx={{ 
                        minWidth: '20px', 
                        textAlign: 'center',
                        color: 'text.secondary'
                      }}
                    >
                      {score}
                    </Typography>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {game.homeTeam.quarters.map((score, index) => (
                    <Typography 
                      key={index}
                      level="body-xs" 
                      sx={{ 
                        minWidth: '20px', 
                        textAlign: 'center',
                        color: 'text.secondary'
                      }}
                    >
                      {score}
                    </Typography>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography level="h5" sx={{ fontWeight: 'bold' }}>
            🏀 Live Games
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
              Last updated: {new Date(scoreboard.lastUpdated).toLocaleTimeString()}
            </Typography>
            <Chip 
              size="sm" 
              variant="soft" 
              color="success"
              sx={{ fontSize: '0.7rem' }}
            >
              LIVE
            </Chip>
          </Box>
        </Box>
        
        <Grid container spacing={2}>
          {games.map((game) => (
            <Grid xs={12} md={6} lg={4} key={game.gameId}>
              {renderGameCard(game)}
            </Grid>
          ))}
        </Grid>

        {scoreboard.games.length > maxGames && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
              +{scoreboard.games.length - maxGames} more games today
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
