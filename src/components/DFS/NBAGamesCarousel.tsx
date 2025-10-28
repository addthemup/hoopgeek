import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  CardOverflow,
  IconButton,
  Skeleton,
} from '@mui/joy';
import {
  NavigateBefore,
  NavigateNext,
} from '@mui/icons-material';

interface NBAGame {
  gameId: string;
  gameStatus: number;
  gameStatusText: string;
  awayTeam: {
    id: number;
    name: string;
    abbreviation: string;
    points: number;
  };
  homeTeam: {
    id: number;
    name: string;
    abbreviation: string;
    points: number;
  };
}

interface NBAGamesCarouselProps {
  games: NBAGame[];
  isLoading?: boolean;
}

// Skeleton loader for game cards
function GameCardSkeleton() {
  return (
    <Card orientation="horizontal" variant="outlined" sx={{ width: 220, height: 80 }}>
      <CardOverflow>
        <Box sx={{ 
          width: 60,
          height: '100%',
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.25,
          bgcolor: 'background.level1',
          p: 0.5
        }}>
          <Skeleton variant="circular" width={26} height={26} />
          <Skeleton width={20} height={10} />
          <Skeleton variant="circular" width={26} height={26} />
        </Box>
      </CardOverflow>
      
      <CardContent sx={{ py: 0.75, px: 1 }}>
        <Stack spacing={0.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Skeleton width={40} height={12} />
            <Skeleton width={30} height={16} />
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Skeleton width={40} height={12} />
            <Skeleton width={30} height={16} />
          </Stack>
          <Skeleton width={60} height={10} sx={{ mt: 0.25 }} />
        </Stack>
      </CardContent>
      
      <CardOverflow
        variant="soft"
        sx={{
          px: 0.15,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderLeft: '1px solid',
          borderColor: 'divider',
          minWidth: '16px'
        }}
      >
        <Skeleton width={12} height={40} />
      </CardOverflow>
    </Card>
  );
}

export default function NBAGamesCarousel({ games, isLoading = false }: NBAGamesCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const cardWidth = 220; // Width of each game card (smaller horizontal card)
  const visibleCards = 5; // Number of cards visible at once on desktop
  const showCarousel = games.length > 5; // Show carousel navigation if more than 5 games

  const scrollLeft = () => {
    if (!carouselRef.current) return;
    const gap = 16;
    const newPosition = Math.max(0, scrollPosition - (cardWidth + gap));
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  const scrollRight = () => {
    if (!carouselRef.current) return;
    const gap = 16;
    const maxScroll = Math.max(0, (games.length - visibleCards) * (cardWidth + gap));
    const newPosition = Math.min(maxScroll, scrollPosition + (cardWidth + gap));
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  const handleScroll = () => {
    if (carouselRef.current) {
      setScrollPosition(carouselRef.current.scrollLeft);
    }
  };

  // Show skeleton loader while loading
  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        gap: 1.5, 
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        px: 1,
        py: 1
      }}>
        {[...Array(5)].map((_, index) => (
          <Box key={index} sx={{ minWidth: cardWidth }}>
            <GameCardSkeleton />
          </Box>
        ))}
      </Box>
    );
  }

  if (games.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography level="body-md" color="neutral">
          No games scheduled today
        </Typography>
      </Box>
    );
  }

  // If 5 or fewer games, show them in a simple row without carousel navigation
  if (!showCarousel) {
    return (
      <Box sx={{ 
        display: 'flex', 
        gap: 1.5, 
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        px: 1,
        py: 1
      }}>
        {games.map((game) => (
          <Box key={game.gameId} sx={{ minWidth: cardWidth }}>
            <GameCard game={game} />
          </Box>
        ))}
      </Box>
    );
  }

  // Show carousel with navigation for 6+ games
  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* Left Navigation Button */}
      <IconButton
        variant="outlined"
        size="sm"
        onClick={scrollLeft}
        disabled={scrollPosition <= 0}
        sx={{
          position: 'absolute',
          left: -20,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 2,
          bgcolor: 'background.body',
          border: '1px solid',
          borderColor: 'divider',
          display: { xs: 'none', md: 'flex' }
        }}
      >
        <NavigateBefore />
      </IconButton>

      {/* Right Navigation Button */}
      <IconButton
        variant="outlined"
        size="sm"
        onClick={scrollRight}
        disabled={scrollPosition >= (games.length - visibleCards) * (cardWidth + 16)}
        sx={{
          position: 'absolute',
          right: -20,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 2,
          bgcolor: 'background.body',
          border: '1px solid',
          borderColor: 'divider',
          display: { xs: 'none', md: 'flex' }
        }}
      >
        <NavigateNext />
      </IconButton>

      {/* Carousel Container */}
      <Box
        ref={carouselRef}
        onScroll={handleScroll}
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          },
          px: 1,
          py: 1,
          cursor: 'grab',
          '&:active': {
            cursor: 'grabbing'
          }
        }}
      >
        {games.map((game) => (
          <Box key={game.gameId} sx={{ minWidth: cardWidth }}>
            <GameCard game={game} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// Extracted GameCard component for reuse - Horizontal Card Layout (Compact)
function GameCard({ game }: { game: NBAGame }) {
  const isLive = game.gameStatus === 2;
  const isFinal = game.gameStatus === 3;
  const statusColor = isLive ? 'danger' : isFinal ? 'success' : 'neutral';
  
  // Generate team logo URLs from NBA CDN
  const awayTeamLogo = `https://cdn.nba.com/logos/nba/${game.awayTeam.id}/primary/L/logo.svg`;
  const homeTeamLogo = `https://cdn.nba.com/logos/nba/${game.homeTeam.id}/primary/L/logo.svg`;
  
  return (
    <Card orientation="horizontal" variant="outlined" sx={{ width: 220, height: 80 }}>
      {/* Team Logos Section */}
      <CardOverflow>
        <Box sx={{ 
          width: 60,
          height: '100%',
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.25,
          bgcolor: 'background.level1',
          p: 0.5
        }}>
          <Box
            component="img"
            src={awayTeamLogo}
            alt={game.awayTeam.abbreviation}
            sx={{ 
              width: 26, 
              height: 26,
              objectFit: 'contain'
            }}
          />
          <Typography level="body-xs" sx={{ fontWeight: 'bold', fontSize: '0.6rem' }}>VS</Typography>
          <Box
            component="img"
            src={homeTeamLogo}
            alt={game.homeTeam.abbreviation}
            sx={{ 
              width: 26, 
              height: 26,
              objectFit: 'contain'
            }}
          />
        </Box>
      </CardOverflow>
      
      {/* Game Info Section */}
      <CardContent sx={{ py: 0.75, px: 1 }}>
        <Stack spacing={0.25}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography level="body-xs" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
              {game.awayTeam.abbreviation}
            </Typography>
            <Typography level="h4" sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
              {game.awayTeam.points}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography level="body-xs" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}>
              {game.homeTeam.abbreviation}
            </Typography>
            <Typography level="h4" sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
              {game.homeTeam.points}
            </Typography>
          </Stack>
          <Typography level="body-xs" color="neutral" sx={{ mt: 0.25, fontSize: '0.65rem' }}>
            {game.gameStatusText}
          </Typography>
        </Stack>
      </CardContent>
      
      {/* Status Badge Section */}
      <CardOverflow
        variant="soft"
        color={statusColor}
        sx={{
          px: 0.15,
          writingMode: 'vertical-rl',
          justifyContent: 'center',
          fontSize: '0.5rem',
          fontWeight: 'xl',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          borderLeft: '1px solid',
          borderColor: 'divider',
          minWidth: '16px'
        }}
      >
        {isLive ? '🔴' : isFinal ? '✓' : '⏰'}
      </CardOverflow>
    </Card>
  );
}

