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
} from '@mui/joy';
import { 
  Timer, 
  NavigateBefore, 
  NavigateNext,
  SwapHoriz,
  SmartToy,
  Person
} from '@mui/icons-material';
import { useDraftOrder } from '../../hooks/useDraftOrder';
import { supabase } from '../../utils/supabase';
import { getTeamColors } from '../../utils/nbaTeamColors';

interface DraftPicksCarouselProps {
  leagueId: string;
  currentPickNumber: number;
  timeRemaining?: string;
  isDraftStarted: boolean;
  isCommissioner?: boolean;
  onInitiateTrade: (pick: any) => void;
}

export default function DraftPicksCarousel({ 
  leagueId, 
  currentPickNumber, 
  timeRemaining,
  isDraftStarted,
  isCommissioner = false,
  onInitiateTrade
}: DraftPicksCarouselProps) {
  const { data: draftOrder, isLoading } = useDraftOrder(leagueId);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [togglingAutodraft, setTogglingAutodraft] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardWidth = 180; // Width of each card (compact size)
  const visibleCards = 4; // Number of cards visible at once

  // Calculate which picks to show
  const getVisiblePicks = () => {
    if (!draftOrder) return [];
    
    const currentIndex = draftOrder.findIndex(pick => pick.pick_number === currentPickNumber);
    if (currentIndex === -1) return [];
    
    // Show previous picks (infinite scroll left) - show all previous picks
    const startIndex = 0;
    // Show next 20 picks maximum from current pick
    const endIndex = Math.min(draftOrder.length, currentIndex + 21);
    
    return draftOrder.slice(startIndex, endIndex);
  };

  const visiblePicks = getVisiblePicks();
  const currentPickIndex = visiblePicks.findIndex(pick => pick.pick_number === currentPickNumber);

  // Calculate number of teams in the league (from round 1 picks)
  const numberOfTeams = draftOrder?.filter(pick => pick.round === 1).length || 10;

  // Helper to get pick number within the round
  const getPickInRound = (pickNumber: number) => {
    return ((pickNumber - 1) % numberOfTeams) + 1;
  };

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

  // Auto-scroll to current pick when it changes - position it at the far left
  useEffect(() => {
    if (currentPickIndex >= 0 && carouselRef.current) {
      // Position current pick at the far left of the viewport
      const newPosition = currentPickIndex * cardWidth;
      carouselRef.current.scrollTo({
        left: newPosition,
        behavior: 'smooth'
      });
      setScrollPosition(newPosition);
    }
  }, [currentPickNumber, currentPickIndex]);

  // Format seconds to "M:SS" format
  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return '0:00';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate and update countdown timer from database time_expires
  useEffect(() => {
    if (!isDraftStarted) {
      setCountdown(null);
      return;
    }

    // Find the current pick
    const currentPick = visiblePicks.find(pick => pick.pick_number === currentPickNumber);
    
    if (!currentPick || !currentPick.time_expires) {
      setCountdown(null);
      return;
    }

    // Calculate initial countdown from database timestamp
    const calculateRemainingSeconds = () => {
      const expiresAt = new Date(currentPick.time_expires!).getTime();
      const now = Date.now();
      const remainingMs = expiresAt - now;
      return Math.max(0, Math.floor(remainingMs / 1000));
    };

    // Set initial countdown
    setCountdown(calculateRemainingSeconds());

    // Update countdown every second
    const interval = setInterval(() => {
      const remaining = calculateRemainingSeconds();
      setCountdown(remaining);
      
      // Stop the interval if time is up
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    // Cleanup interval on unmount or when dependencies change
    return () => clearInterval(interval);
  }, [currentPickNumber, isDraftStarted, visiblePicks]);

  // Shorten position strings
  const shortenPosition = (position: string): string => {
    if (!position) return '';
    if (position.includes('Guard')) return 'G';
    if (position.includes('Forward')) return 'F';
    if (position.includes('Center')) return 'C';
    // Already short positions (PG, SG, SF, PF, C)
    return position;
  };

  const getPositionColor = (position: string) => {
    const shortPos = shortenPosition(position);
    switch (shortPos) {
      case 'G':
      case 'PG': return 'primary';
      case 'SG': return 'success';
      case 'F':
      case 'SF': return 'warning';
      case 'PF': return 'danger';
      case 'C': return 'neutral';
      default: return 'neutral';
    }
  };

  // Toggle autodraft for a team (commissioner only)
  const handleToggleAutodraft = async (pick: any, currentAutodraftStatus: boolean) => {
    if (!isCommissioner) return;
    
    setTogglingAutodraft(pick.team_id);
    try {
      const { error } = await supabase
        .from('fantasy_teams')
        .update({ autodraft_enabled: !currentAutodraftStatus })
        .eq('id', pick.team_id);

      if (error) {
        console.error('Error toggling autodraft:', error);
      }
    } catch (error) {
      console.error('Error toggling autodraft:', error);
    } finally {
      setTogglingAutodraft(null);
    }
  };

  const getPickStatus = (pick: any) => {
    if (pick.is_completed) {
      // Check if pick was forfeited due to cap
      if (pick.auto_pick_reason === 'insufficient_cap_space') {
        return 'forfeited';
      }
      return 'completed';
    }
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
            <Box key={pick.pick_number} sx={{ position: 'relative' }}>
              <Card
                orientation="horizontal"
                variant="outlined"
                sx={{
                  width: cardWidth,
                  minWidth: cardWidth,
                  height: 65,
                  minHeight: 65,
                  maxHeight: 65,
                  border: isCurrentPick ? '2px solid' : '1px solid',
                  borderColor: isCurrentPick ? 'warning.500' : status === 'forfeited' ? 'danger.500' : 'divider',
                  bgcolor: status === 'completed' 
                    ? 'success.50' 
                    : status === 'forfeited'
                      ? 'danger.50'
                      : status === 'current' 
                        ? 'warning.50' 
                        : 'background.body',
                  opacity: status === 'forfeited' ? 0.7 : 1,
                  animation: isCurrentPick && isDraftStarted ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0.7)' },
                    '70%': { boxShadow: '0 0 0 10px rgba(251, 191, 36, 0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)' }
                  }
                }}
              >
                {/* Avatar Section */}
                <CardOverflow>
                  <AspectRatio ratio="1" sx={{ width: 60 }}>
                    {status === 'forfeited' ? (
                      // Forfeited pick - show cap icon
                      <Avatar size="sm" sx={{ bgcolor: 'danger.500', width: '100%', height: '100%', fontSize: '1.2rem' }}>
                        💸
                      </Avatar>
                    ) : pick.is_completed && pick.nba_player_id ? (
                      // Completed pick - show player image with team colors
                      <Avatar 
                        size="sm" 
                        src={`https://cdn.nba.com/headshots/nba/latest/260x190/${pick.nba_player_id}.png`}
                        sx={{ 
                          bgcolor: pick.team_abbreviation 
                            ? getTeamColors(pick.team_abbreviation).primary 
                            : 'success.500',
                          width: '100%', 
                          height: '100%',
                          fontSize: '1rem',
                          '& img': {
                            objectFit: 'cover'
                          }
                        }}
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && pick.player_name) {
                            parent.textContent = pick.player_name.split(' ').map(n => n[0]).join('');
                          }
                        }}
                      >
                        {pick.player_name?.split(' ').map(n => n[0]).join('') || '?'}
                      </Avatar>
                    ) : isCurrentPick ? (
                      // Current pick - show timer
                      <Avatar size="sm" sx={{ bgcolor: 'warning.500', width: '100%', height: '100%' }}>
                        <Timer />
                      </Avatar>
              ) : (
                // Pending pick - show current owner's team initial (or original if not traded)
                <Avatar size="sm" sx={{ bgcolor: pick.is_traded ? 'primary.400' : 'neutral.300', width: '100%', height: '100%', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {(pick.is_traded ? pick.current_owner_name : pick.team_name)?.charAt(0) || '?'}
                </Avatar>
              )}
                  </AspectRatio>
                </CardOverflow>
                
                {/* Content Section */}
                <CardContent sx={{ pt: 0, pb: 0.25, px: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                  <Typography 
                    textColor={
                      status === 'forfeited' ? 'danger.plainColor' :
                      status === 'completed' ? 'success.plainColor' : 
                      status === 'current' ? 'warning.plainColor' : 
                      'neutral.plainColor'
                    } 
                    sx={{ fontWeight: 'md', fontSize: '0.75rem', lineHeight: 1.1, mb: 0.25 }}
                  >
                    {status === 'forfeited' ? 'FORFEITED' :
                     pick.is_completed && pick.player_name ? pick.player_name : 
                     isCurrentPick ? 'On the Clock' : `Pick #${pick.pick_number}`}
                  </Typography>
                  
            <Typography level="body-xs" sx={{ fontSize: '0.65rem', opacity: 0.8, lineHeight: 1.1 }}>
              {pick.original_team_name || pick.team_name || 'Empty Team'}
            </Typography>
            
            {/* Traded Indicator */}
            {pick.is_traded && pick.current_owner_name && (
              <Chip
                color="primary"
                size="sm"
                variant="soft"
                sx={{ 
                  mt: 0.25, 
                  fontSize: '0.55rem',
                  px: 0.5,
                  py: 0.15,
                  minHeight: 'auto',
                  height: '14px'
                }}
              >
                → {pick.current_owner_name}
              </Chip>
            )}
            
            {/* Cap Out Message */}
            {status === 'forfeited' && (
                    <Chip
                      color="danger"
                      size="sm"
                      sx={{ 
                        mt: 0.25, 
                        fontSize: '0.6rem',
                        px: 0.75,
                        py: 0.25,
                        minHeight: 'auto'
                      }}
                    >
                      Over Cap
                    </Chip>
                  )}
                  
                  {/* Countdown Timer for Current Pick */}
                  {isCurrentPick && countdown !== null && (
                    <Chip
                      color={countdown <= 10 ? 'danger' : 'warning'}
                      size="sm"
                      startDecorator={<Timer />}
                      sx={{ 
                        mt: 0.25, 
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        px: 0.75,
                        py: 0.25,
                        minHeight: 'auto',
                        animation: countdown <= 10 ? 'blink 1s infinite' : 'none',
                        '@keyframes blink': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.5 }
                        }
                      }}
                    >
                      {formatTime(countdown)}
                    </Chip>
                  )}
                  
                  {pick.is_completed && pick.position && (
                    <Typography level="body-xs" sx={{ fontSize: '0.6rem', opacity: 0.7, mt: 0.15, lineHeight: 1.1 }}>
                      {shortenPosition(pick.position)} • {pick.team_abbreviation}
                    </Typography>
                  )}
                  
                  {pick.is_completed && pick.salary_2025_26 && (
                    <Typography level="body-xs" sx={{ fontSize: '0.6rem', fontWeight: 'bold', color: 'success.500', mt: 0.15, lineHeight: 1.1 }}>
                      ${(pick.salary_2025_26 / 1000000).toFixed(1)}M
                    </Typography>
                  )}
                </CardContent>
              
                {/* Side Label */}
                <CardOverflow
                  variant="soft"
                  color={
                    status === 'forfeited' ? 'danger' :
                    status === 'completed' ? 'success' :
                    status === 'current' ? 'warning' : 'neutral'
                  }
                  sx={{
                    px: 0.2,
                    writingMode: 'vertical-rl',
                    justifyContent: 'center',
                    fontSize: '0.6rem',
                    fontWeight: 'xl',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    borderLeft: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {status === 'forfeited' ? '✗' :
                   status === 'completed' ? '✓' :
                   status === 'current' ? '•' : `${pick.round}.${getPickInRound(pick.pick_number)}`}
                </CardOverflow>
              </Card>
              
              {/* Action Buttons - Positioned absolutely below card */}
              <Box sx={{ 
                position: 'absolute',
                bottom: -8,
                right: 4,
                zIndex: 10,
                display: 'flex',
                gap: 0.5
              }}>
                {/* Autodraft Toggle Button - Commissioner only */}
                {isCommissioner && (
                  <IconButton
                    size="sm"
                    variant="soft"
                    color={pick.autodraft_enabled ? 'success' : 'neutral'}
                    onClick={() => handleToggleAutodraft(pick, pick.autodraft_enabled || false)}
                    loading={togglingAutodraft === pick.team_id}
                    disabled={togglingAutodraft === pick.team_id}
                    sx={{ 
                      minWidth: 24,
                      minHeight: 24,
                      borderRadius: '50%',
                      boxShadow: 'sm'
                    }}
                    title={pick.autodraft_enabled ? 'Disable Autodraft' : 'Enable Autodraft'}
                  >
                    {pick.autodraft_enabled ? <SmartToy sx={{ fontSize: '0.9rem' }} /> : <Person sx={{ fontSize: '0.9rem' }} />}
                  </IconButton>
                )}
                
                {/* Trade Button */}
                <IconButton
                  size="sm"
                  variant="soft"
                  color="primary"
                  onClick={() => onInitiateTrade(pick)}
                  sx={{ 
                    minWidth: 24,
                    minHeight: 24,
                    borderRadius: '50%',
                    boxShadow: 'sm'
                  }}
                  title="Initiate Trade"
                >
                  <SwapHoriz sx={{ fontSize: '0.9rem' }} />
                </IconButton>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
