import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
  Stack,
  IconButton,
  Alert,
  LinearProgress,
  Snackbar,
  Grid,
} from '@mui/joy';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  TrendingUp,
  TrendingDown,
  Add,
} from '@mui/icons-material';
import { usePlayersPaginated } from '../../hooks/useNBAData';
import { useNextPick } from '../../hooks/useNextPick';

interface DraftBestAvailableProps {
  leagueId: string;
}

export default function DraftBestAvailable({ leagueId }: DraftBestAvailableProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Check if draft is complete
  const { data: nextPick } = useNextPick(leagueId);
  const isDraftComplete = nextPick === null;

  // Get top available players (mock data for now)
  const { data: playersData, isLoading, error } = usePlayersPaginated(1, 20, {
    search: '',
    position: '',
    team: '',
    leagueId: isDraftComplete ? undefined : leagueId, // Don't fetch players if draft is complete
  });

  const bestAvailablePlayers = playersData?.players || [];

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

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp color="success" />;
      case 'down':
        return <TrendingDown color="danger" />;
      default:
        return null;
    }
  };

  const handleDraftPlayer = (player: any) => {
    setSnackbarMessage(`Drafted ${player.name}!`);
    setSnackbarOpen(true);
  };

  const nextPlayer = () => {
    setCurrentIndex((prev) => (prev + 1) % bestAvailablePlayers.length);
  };

  const prevPlayer = () => {
    setCurrentIndex((prev) => (prev - 1 + bestAvailablePlayers.length) % bestAvailablePlayers.length);
  };

  // Show draft complete message if draft is finished
  if (isDraftComplete) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Typography level="h2" sx={{ mb: 2, textAlign: 'center' }}>
          🎉 Draft Complete!
        </Typography>
        <Typography level="h4" sx={{ mb: 4, textAlign: 'center', color: 'neutral.500' }}>
          Your Draft is Complete
        </Typography>
        <Alert color="success" sx={{ maxWidth: 400, textAlign: 'center' }}>
          <Typography>
            All picks have been made! Check out your final roster and get ready for the season.
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <LinearProgress />
        <Typography sx={{ ml: 2 }}>Loading best available...</Typography>
      </Box>
    );
  }

  if (error || !bestAvailablePlayers.length) {
    return (
      <Alert color="warning">
        <Typography>No players available.</Typography>
      </Alert>
    );
  }

  const currentPlayer = bestAvailablePlayers[currentIndex];

  return (
    <Box>
      {/* Header */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography level="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            🏆 Best Available
          </Typography>
          <Typography level="body-sm" color="neutral">
            Player {currentIndex + 1} of {bestAvailablePlayers.length}
          </Typography>
        </CardContent>
      </Card>

      {/* Player Card Carousel */}
      <Card 
        variant="outlined" 
        sx={{ 
          mb: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
          {/* Player Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar 
              size="lg" 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 80,
                height: 80,
                fontSize: '2rem'
              }}
            >
              {currentPlayer.name?.charAt(0)}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography level="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {currentPlayer.name}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip 
                  size="sm" 
                  color={getPositionColor(currentPlayer.position)} 
                  variant="soft"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}
                >
                  {currentPlayer.position}
                </Chip>
                <Typography level="body-sm" sx={{ opacity: 0.9 }}>
                  {currentPlayer.team_abbreviation || currentPlayer.team_name}
                </Typography>
                {currentPlayer.jersey_number && (
                  <Typography level="body-sm" sx={{ opacity: 0.9 }}>
                    #{currentPlayer.jersey_number}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Box>

          {/* Player Stats */}
          <Box sx={{ flex: 1, mb: 3 }}>
            <Typography level="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Season Stats
            </Typography>
            <Grid container spacing={2}>
              <Grid xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                  <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                    24.5
                  </Typography>
                  <Typography level="body-sm" sx={{ opacity: 0.8 }}>
                    Points
                  </Typography>
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                  <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                    8.2
                  </Typography>
                  <Typography level="body-sm" sx={{ opacity: 0.8 }}>
                    Rebounds
                  </Typography>
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                  <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                    6.8
                  </Typography>
                  <Typography level="body-sm" sx={{ opacity: 0.8 }}>
                    Assists
                  </Typography>
                </Box>
              </Grid>
              <Grid xs={6}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                  <Typography level="h4" sx={{ fontWeight: 'bold' }}>
                    1.2
                  </Typography>
                  <Typography level="body-sm" sx={{ opacity: 0.8 }}>
                    Steals
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Draft Button */}
          <Button
            size="lg"
            variant="solid"
            color="success"
            startDecorator={<Add />}
            onClick={() => handleDraftPlayer(currentPlayer)}
            sx={{ 
              fontWeight: 'bold',
              fontSize: '1.1rem',
              py: 1.5
            }}
          >
            Draft {currentPlayer.name}
          </Button>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton
          variant="outlined"
          onClick={prevPlayer}
          disabled={bestAvailablePlayers.length <= 1}
        >
          <ChevronLeft />
        </IconButton>
        
        <Stack direction="row" spacing={1}>
          {bestAvailablePlayers.slice(0, 5).map((_, index) => (
            <Box
              key={index}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: index === currentIndex ? 'primary.500' : 'neutral.300',
                cursor: 'pointer'
              }}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
          {bestAvailablePlayers.length > 5 && (
            <Typography level="body-xs" sx={{ alignSelf: 'center', ml: 1 }}>
              +{bestAvailablePlayers.length - 5}
            </Typography>
          )}
        </Stack>
        
        <IconButton
          variant="outlined"
          onClick={nextPlayer}
          disabled={bestAvailablePlayers.length <= 1}
        >
          <ChevronRight />
        </IconButton>
      </Box>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        color="success"
        autoHideDuration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </Box>
  );
}
