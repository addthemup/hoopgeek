import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardOverflow,
  CardActions,
  Avatar,
  Chip,
  Button,
  ButtonGroup,
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
  Add,
  TrendingUp,
  TrendingDown,
} from '@mui/icons-material';
import { usePlayersPaginated } from '../../hooks/useNBAData';
import { useNextPick } from '../../hooks/useNextPick';

interface DraftBestAvailableProps {
  leagueId: string;
}

export default function DraftBestAvailable({ leagueId }: DraftBestAvailableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [cardsPerPage, setCardsPerPage] = useState(1);

  // Check if draft is complete
  const { data: nextPick } = useNextPick(leagueId);
  const isDraftComplete = nextPick === null;

  // Get all available players for global sorting (same logic as DraftPlayers)
  const { data: allPlayersData, isLoading, error } = usePlayersPaginated(1, 1000, {
    search: '',
    position: '',
    team: '',
    salary: '',
    showInactive: false,
    leagueId: isDraftComplete ? undefined : leagueId, // Don't fetch players if draft is complete
  });

  // Calculate projected fantasy points for a player (same logic as DraftPlayers)
  const calculateProjectedFantasyPoints = (player: any) => {
    const projections = (player as any).nba_espn_projections?.[0];
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
    // Assuming average 2-pt FG value of 2 points, we can estimate 2-pt FGs
    const total2ptFg = Math.max(0, (totalPts - (total3pm * 3)) / 2);
    const totalFg = total2ptFg + total3pm;

    // Calculate free throws made (approximate from FT% and points)
    // This is a rough estimate - in reality we'd need FTA data
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

  // Sort ALL players by projected fantasy points in descending order (same logic as DraftPlayers)
  const bestAvailablePlayers = allPlayersData?.players ? [...allPlayersData.players].sort((a, b) => {
    const aFantasy = calculateProjectedFantasyPoints(a);
    const bFantasy = calculateProjectedFantasyPoints(b);
    return bFantasy - aFantasy; // Descending order
  }) : [];

  // Calculate cards per page based on screen size
  useEffect(() => {
    const calculateCardsPerPage = () => {
      const width = window.innerWidth;
      if (width < 600) {
        return 1; // Mobile: 1 card
      } else if (width < 900) {
        return 2; // Small tablet: 2 cards
      } else if (width < 1200) {
        return 3; // Medium laptop: 3 cards
      } else {
        return 4; // Large screen: 4 cards
      }
    };

    setCardsPerPage(calculateCardsPerPage());

    const handleResize = () => {
      setCardsPerPage(calculateCardsPerPage());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate pagination
  const totalPages = Math.ceil(bestAvailablePlayers.length / cardsPerPage);
  const startIndex = currentPage * cardsPerPage;
  const endIndex = startIndex + cardsPerPage;
  const currentPlayers = bestAvailablePlayers.slice(startIndex, endIndex);

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
        return <TrendingDown color="error" />;
      default:
        return null;
    }
  };

  const handleDraftPlayer = (player: any) => {
    setSnackbarMessage(`Drafted ${player.name}!`);
    setSnackbarOpen(true);
  };

  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
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


  return (
    <Box>
      {/* Header */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography level="title-lg" sx={{ fontWeight: 'bold', mb: 1 }}>
            🏆 Best Available
          </Typography>
          <Typography level="body-sm" color="neutral">
            Showing {startIndex + 1}-{Math.min(endIndex, bestAvailablePlayers.length)} of {bestAvailablePlayers.length} players
          </Typography>
        </CardContent>
      </Card>

      {/* Player Cards Grid */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {currentPlayers.map((player) => (
          <Grid 
            key={player.id} 
            xs={12} 
            sm={6} 
            md={4} 
            lg={3}
        sx={{ 
          display: 'flex',
              justifyContent: 'center'
        }}
      >
            <Card sx={{ width: 320, maxWidth: '100%', boxShadow: 'lg' }}>
              <CardContent sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar 
                  src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
              sx={{ 
                    '--Avatar-size': '4rem',
                    bgcolor: 'primary.500',
                    fontSize: '1.5rem',
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
                      parent.textContent = player.name?.split(' ').map((n: string) => n[0]).join('') || '';
                    }
                  }}
                >
                  {player.name?.charAt(0)}
            </Avatar>
                <Chip 
                  size="sm" 
                  variant="soft"
                  color={getPositionColor(player.position)}
                  sx={{
                    mt: -1,
                    mb: 1,
                    border: '3px solid',
                    borderColor: 'background.surface',
                  }}
                >
                  {player.position}
                </Chip>
                <Typography level="title-lg">{player.name}</Typography>
                <Typography level="body-sm" sx={{ maxWidth: '24ch', mb: 1 }}>
                  {player.team_abbreviation || player.team_name}
                  {player.jersey_number && ` • #${player.jersey_number}`}
                </Typography>
                
                {/* Fantasy Points Display */}
                <Box sx={{ mb: 2 }}>
                  <Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.500' }}>
                    {calculateProjectedFantasyPoints(player).toLocaleString()}
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    Projected Fantasy Points
                  </Typography>
                </Box>

                {/* Key Stats Display */}
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-around', gap: 1 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {((player as any).nba_espn_projections?.[0]?.proj_2026_pts?.toFixed(1) || 'N/A')}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      PTS
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {((player as any).nba_espn_projections?.[0]?.proj_2026_reb?.toFixed(1) || 'N/A')}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      REB
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {((player as any).nba_espn_projections?.[0]?.proj_2026_ast?.toFixed(1) || 'N/A')}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      AST
                    </Typography>
                  </Box>
                </Box>

                {/* Salary Display */}
                <Box sx={{ mb: 2 }}>
                  <Typography level="h4" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                    {(player as any).nba_hoopshype_salaries?.[0]?.salary_2025_26 
                      ? `$${((player as any).nba_hoopshype_salaries[0].salary_2025_26 / 1000000).toFixed(1)}M`
                      : 'N/A'
                    }
                  </Typography>
                  <Typography level="body-sm" color="neutral">
                    2025-26 Salary
                  </Typography>
                </Box>
              </CardContent>
              <CardOverflow sx={{ bgcolor: 'background.level1' }}>
                <CardActions buttonFlex="1">
                  <ButtonGroup variant="outlined" sx={{ bgcolor: 'background.surface' }}>
          <Button
                      startDecorator={<Add />}
                      onClick={() => handleDraftPlayer(player)}
            color="success"
                    >
                      Draft Player
          </Button>
                  </ButtonGroup>
                </CardActions>
              </CardOverflow>
      </Card>
          </Grid>
        ))}
      </Grid>

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton
          variant="outlined"
          onClick={prevPage}
          disabled={totalPages <= 1}
        >
          <ChevronLeft />
        </IconButton>
        
        <Stack direction="row" spacing={1}>
          <Typography level="body-sm" sx={{ alignSelf: 'center', px: 2 }}>
            Page {currentPage + 1} of {totalPages}
            </Typography>
        </Stack>
        
        <IconButton
          variant="outlined"
          onClick={nextPage}
          disabled={totalPages <= 1}
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
