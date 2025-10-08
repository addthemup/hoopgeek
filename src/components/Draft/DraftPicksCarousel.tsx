import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardOverflow,
  AspectRatio,
  Avatar,
  Chip,
  IconButton,
  Stack,
} from '@mui/joy';
import { 
  Person, 
  Timer, 
  NavigateBefore, 
  NavigateNext,
  SportsBasketball 
} from '@mui/icons-material';
import { useDraftOrder } from '../../hooks/useDraftOrder';

interface DraftPicksCarouselProps {
  leagueId: string;
  currentPickNumber: number;
  timeRemaining?: string;
  isDraftStarted: boolean;
}

export default function DraftPicksCarousel({ 
  leagueId, 
  currentPickNumber, 
  timeRemaining,
  isDraftStarted 
}: DraftPicksCarouselProps) {
  const { data: draftOrder, isLoading } = useDraftOrder(leagueId);
  const [scrollPosition, setScrollPosition] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardWidth = 260; // Width of each card (matching template)
  const visibleCards = 3; // Number of cards visible at once

  // Calculate which picks to show
  const getVisiblePicks = () => {
    if (!draftOrder) return [];
    
    const currentIndex = draftOrder.findIndex(pick => pick.pick_number === currentPickNumber);
    if (currentIndex === -1) return [];
    
    // Show previous picks (infinite scroll left) - show all previous picks
    const startIndex = 0;
    // Show next 10 picks maximum from current pick
    const endIndex = Math.min(draftOrder.length, currentIndex + 11);
    
    return draftOrder.slice(startIndex, endIndex);
  };

  const visiblePicks = getVisiblePicks();
  const currentPickIndex = visiblePicks.findIndex(pick => pick.pick_number === currentPickNumber);

  const scrollToPick = (pickIndex: number) => {
    if (!carouselRef.current) return;
    
    const newPosition = pickIndex * cardWidth;
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  const scrollLeft = () => {
    if (!carouselRef.current) return;
    const newPosition = Math.max(0, scrollPosition - cardWidth);
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  const scrollRight = () => {
    if (!carouselRef.current) return;
    const maxScroll = Math.max(0, (visiblePicks.length - visibleCards) * cardWidth);
    const newPosition = Math.min(maxScroll, scrollPosition + cardWidth);
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  // Handle scroll events to update position
  const handleScroll = () => {
    if (carouselRef.current) {
      setScrollPosition(carouselRef.current.scrollLeft);
    }
  };

  // Auto-scroll to current pick when it changes
  useEffect(() => {
    if (currentPickIndex >= 0) {
      scrollToPick(currentPickIndex);
    }
  }, [currentPickNumber, currentPickIndex]);

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'PG': return 'primary';
      case 'SG': return 'success';
      case 'SF': return 'warning';
      case 'PF': return 'danger';
      case 'C': return 'neutral';
      default: return 'neutral';
    }
  };

  const getPickStatus = (pick: any) => {
    if (pick.is_completed) return 'completed';
    if (pick.pick_number === currentPickNumber) return 'current';
    return 'pending';
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <Typography>Loading picks...</Typography>
      </Box>
    );
  }

  if (!draftOrder || visiblePicks.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <Typography color="neutral">No picks available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      {/* Navigation Buttons */}
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
          borderColor: 'divider'
        }}
      >
        <NavigateBefore />
      </IconButton>

      <IconButton
        variant="outlined"
        size="sm"
        onClick={scrollRight}
        disabled={scrollPosition >= (visiblePicks.length - visibleCards) * cardWidth}
        sx={{
          position: 'absolute',
          right: -20,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 2,
          bgcolor: 'background.body',
          border: '1px solid',
          borderColor: 'divider'
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
          gap: 2,
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          },
          px: 1,
          py: 2
        }}
      >
        {visiblePicks.map((pick) => {
          const status = getPickStatus(pick);
          const isCurrentPick = pick.pick_number === currentPickNumber;
          
          return (
            <Card
              key={pick.pick_number}
              orientation="horizontal"
              variant="outlined"
              sx={{
                minWidth: cardWidth,
                maxWidth: cardWidth,
                border: isCurrentPick ? '2px solid' : '1px solid',
                borderColor: isCurrentPick ? 'warning.500' : 'divider',
                bgcolor: status === 'completed' 
                  ? 'success.50' 
                  : status === 'current' 
                    ? 'warning.50' 
                    : 'background.body',
                position: 'relative',
                animation: isCurrentPick && isDraftStarted ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0.7)' },
                  '70%': { boxShadow: '0 0 0 10px rgba(251, 191, 36, 0)' },
                  '100%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)' }
                }
              }}
            >
              <CardOverflow>
                <AspectRatio ratio="1" sx={{ width: 90 }}>
                  {pick.is_completed && pick.player_name ? (
                    <Avatar size="lg" sx={{ bgcolor: 'success.500', width: '100%', height: '100%' }}>
                      <Person />
                    </Avatar>
                  ) : isCurrentPick ? (
                    <Avatar size="lg" sx={{ bgcolor: 'warning.500', width: '100%', height: '100%' }}>
                      <SportsBasketball />
                    </Avatar>
                  ) : (
                    <Avatar size="lg" sx={{ bgcolor: 'neutral.300', width: '100%', height: '100%' }}>
                      ?
                    </Avatar>
                  )}
                </AspectRatio>
              </CardOverflow>
              
              <CardContent sx={{ flex: 1, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography level="h4" color={status === 'completed' ? 'success' : status === 'current' ? 'warning' : 'neutral'}>
                    #{pick.pick_number}
                  </Typography>
                  {isCurrentPick && isDraftStarted && timeRemaining && (
                    <Chip size="sm" color="warning" variant="soft">
                      <Timer sx={{ fontSize: 16, mr: 0.5 }} />
                      {timeRemaining}
                    </Chip>
                  )}
                </Box>
                
                <Typography 
                  textColor={status === 'completed' ? 'success.plainColor' : status === 'current' ? 'warning.plainColor' : 'neutral.plainColor'} 
                  sx={{ fontWeight: 'md', mb: 0.5 }}
                >
                  {pick.is_completed && pick.player_name ? pick.player_name : 
                   isCurrentPick ? 'On the Clock' : 'Upcoming Pick'}
                </Typography>
                
                <Typography level="body-sm" sx={{ mb: 1 }}>
                  {pick.team_name || 'Empty Team'} • Round {pick.round}
                </Typography>
                
                {pick.is_completed && pick.player_name && (
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip
                      size="sm"
                      color={getPositionColor(pick.position || '')}
                      variant="soft"
                    >
                      {pick.position}
                    </Chip>
                    <Typography level="body-xs" color="neutral">
                      {pick.team_abbreviation}
                    </Typography>
                  </Stack>
                )}
                
                {isCurrentPick && isDraftStarted && timeRemaining && (
                  <Typography level="body-xs" color="warning">
                    {timeRemaining} remaining
                  </Typography>
                )}
              </CardContent>
              
              <CardOverflow
                variant="soft"
                color={
                  status === 'completed' ? 'success' :
                  status === 'current' ? 'warning' : 'neutral'
                }
                sx={{
                  px: 0.2,
                  writingMode: 'vertical-rl',
                  justifyContent: 'center',
                  fontSize: 'xs',
                  fontWeight: 'xl',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  borderLeft: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {status === 'completed' ? 'Drafted' :
                 status === 'current' ? 'Current' : 'Pending'}
              </CardOverflow>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
