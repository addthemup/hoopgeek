import { useState, useRef, useEffect } from 'react';
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
  SwapHoriz
} from '@mui/icons-material';
import { useDraftOrder } from '../../hooks/useDraftOrder';
import { useToggleTeamAutoDraft } from '../../hooks/useDraftState';
import { useTeams } from '../../hooks/useTeams';
import { getTeamColors } from '../../utils/nbaTeamColors';
import { useDraftTimer } from '../../hooks/useDraftTimer';
import { useDraftPicksIntegration } from '../../hooks/useDraftIntegration';

interface DraftPicksCarouselProps {
  leagueId: string;
  currentPickNumber: number;
  isDraftStarted: boolean;
  isCommissioner: boolean;
  onInitiateTrade: (pick: any) => void;
}

export default function DraftPicksCarousel({ 
  leagueId, 
  currentPickNumber, 
  isDraftStarted,
  isCommissioner,
  onInitiateTrade
}: DraftPicksCarouselProps) {
  const { data: draftOrder, isLoading } = useDraftOrder(leagueId);
  const { data: teams } = useTeams(leagueId);
  const toggleTeamAutoDraft = useToggleTeamAutoDraft();
  
  // Use new timer hook for real-time database updates
  const { timeRemaining, formattedTime, isActive } = useDraftTimer(leagueId);
  const { currentPick } = useDraftPicksIntegration();
  
  const [scrollPosition, setScrollPosition] = useState(0);
  const [userInteracting, setUserInteracting] = useState(false);
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
    
    // Position at the left edge
    const gap = 16; // 2 * 8px gap between cards
    const padding = 8; // px: 1 in sx = 8px
    const newPosition = padding + (pickIndex * (cardWidth + gap));
    
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  const scrollLeft = () => {
    if (!carouselRef.current) return;
    setUserInteracting(true);
    const gap = 16; // 2 * 8px gap between cards
    const newPosition = Math.max(0, scrollPosition - (cardWidth + gap));
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  const scrollRight = () => {
    if (!carouselRef.current) return;
    setUserInteracting(true);
    const gap = 16; // 2 * 8px gap between cards
    const maxScroll = Math.max(0, (visiblePicks.length - visibleCards) * (cardWidth + gap));
    const newPosition = Math.min(maxScroll, scrollPosition + (cardWidth + gap));
    carouselRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });
    setScrollPosition(newPosition);
  };

  const handleUserInteraction = () => {
    setUserInteracting(true);
  };

  // Handle scroll events to update position
  const handleScroll = () => {
    if (carouselRef.current) {
      setScrollPosition(carouselRef.current.scrollLeft);
      handleUserInteraction();
    }
  };

  // Auto-scroll to current pick when it changes
  useEffect(() => {
    if (currentPickIndex >= 0 && carouselRef.current) {
      scrollToPick(currentPickIndex);
    }
  }, [currentPickNumber, currentPickIndex]);


  // Debug countdown state
  useEffect(() => {
    console.log('🕐 Zustand Countdown Debug:', {
      isDraftStarted,
      currentPickNumber,
      timeRemaining,
      formattedTime,
      isActive,
      currentPick: currentPick ? {
        pickNumber: currentPick.pickNumber,
        timeExpires: currentPick.timeExpires,
        isCompleted: currentPick.isCompleted
      } : null,
    });
  }, [isDraftStarted, currentPickNumber, timeRemaining, formattedTime, isActive, currentPick]);

  // Shorten position strings
  const shortenPosition = (position: string): string => {
    if (!position) return '';
    if (position.includes('Guard')) return 'G';
    if (position.includes('Forward')) return 'F';
    if (position.includes('Center')) return 'C';
    // Already short positions (PG, SG, SF, PF, C)
    return position;
  };

  // Calculate remaining salary cap for a team
  const getRemainingSalaryCap = (teamId: string) => {
    if (!teams || !draftOrder) {
      return null;
    }
    
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      return null;
    }
    
    // Get all completed picks for this team
    const teamPicks = draftOrder.filter(pick => 
      pick.team_id === teamId && 
      pick.is_completed && 
      pick.salary_2025_26
    );
    
    // Calculate total salary spent
    const totalSalarySpent = teamPicks.reduce((sum, pick) => sum + (pick.salary_2025_26 || 0), 0);
    
    // Get the actual salary cap from fantasy_league_seasons (fallback to 200M if not set)
    // Note: We need to fetch this from the league season, not the team
    const salaryCap = team.fantasy_league_seasons?.salary_cap_amount || 200000000; // Use actual league season salary cap
    const remainingCap = salaryCap - totalSalarySpent;
    
    return {
      totalSpent: totalSalarySpent,
      remaining: remainingCap,
      percentage: (totalSalarySpent / salaryCap) * 100
    };
  };


  // Handle team-specific autopick toggle
  const handleToggleTeamAutoDraft = async (teamId: string, currentEnabled: boolean) => {
    if (!isCommissioner) return;
    
    try {
      await toggleTeamAutoDraft.mutateAsync({
        teamId,
        enabled: !currentEnabled
      });
    } catch (error) {
      console.error('Error toggling team auto draft:', error);
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
        disabled={scrollPosition >= (visiblePicks.length - visibleCards) * (cardWidth + 16)}
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
        onMouseMove={handleUserInteraction}
        onTouchStart={handleUserInteraction}
        onTouchMove={handleUserInteraction}
        onMouseEnter={handleUserInteraction}
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
          py: 2,
          cursor: userInteracting ? 'grab' : 'default',
          '&:active': {
            cursor: 'grabbing'
          }
        }}
      >
        {visiblePicks.map((pick) => {
          const status = getPickStatus(pick);
          const isCurrentPick = pick.pick_number === currentPickNumber;
          
          // Debug logging for trade indicators
          if (pick.is_completed && pick.player_name) {
            console.log('🔍 DraftPicksCarousel - Pick Debug:', {
              pickNumber: pick.pick_number,
              playerName: pick.player_name,
              isTraded: pick.is_traded,
              originalTeamName: pick.original_team_name,
              currentOwnerName: pick.current_owner_name,
              teamName: pick.team_name,
              originalTeamId: pick.original_team_id,
              currentOwnerId: pick.current_owner_id,
              teamId: pick.team_id,
              playerWasTraded: pick.player_was_traded,
              playerTradedToTeam: pick.player_traded_to_team
            });
          }
          
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
            
            {/* Trade Indicators */}
            {/* Pick Trade Indicator (before player is drafted) */}
            {!pick.is_completed && pick.is_traded && pick.current_owner_name && (
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
            
            {/* Player Trade Indicator (after player is drafted) */}
            {pick.is_completed && pick.player_was_traded && pick.player_traded_to_team && (
              <Chip
                color="success"
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
                → {pick.player_traded_to_team}
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
                  {isCurrentPick && isActive && timeRemaining > 0 && (
                    <Chip
                      color={timeRemaining <= 10 ? 'danger' : 'warning'}
                      size="sm"
                      startDecorator={<Timer />}
                      sx={{ 
                        mt: 0.25, 
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        px: 0.75,
                        py: 0.25,
                        minHeight: 'auto',
                        animation: timeRemaining <= 10 ? 'blink 1s infinite' : 'none',
                        '@keyframes blink': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.5 }
                        }
                      }}
                    >
                      {formattedTime}
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
                  
                  {/* Show remaining salary cap for pending picks */}
                  {!pick.is_completed && pick.team_id && (
                    (() => {
                      const teamId = pick.team_id;
                      const capInfo = getRemainingSalaryCap(teamId);
                      if (!capInfo) return null;
                      
                      const isOverCap = capInfo.remaining < 0;
                      const isNearCap = capInfo.remaining < 10000000; // Less than 10M remaining
                      
                      return (
                        <Typography 
                          level="body-xs" 
                          sx={{ 
                            fontSize: '0.6rem', 
                            fontWeight: 'bold', 
                            color: isOverCap ? 'danger.500' : isNearCap ? 'warning.500' : 'primary.500',
                            mt: 0.15, 
                            lineHeight: 1.1 
                          }}
                        >
                          {isOverCap ? 'Over Cap' : `$${(capInfo.remaining / 1000000).toFixed(1)}M left`}
                        </Typography>
                      );
                    })()
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
                {/* Team Autopick Toggle Button - Only for commissioners */}
                {isCommissioner && !pick.is_completed && (
                  <IconButton
                    size="sm"
                    variant="soft"
                    color={pick.autodraft_enabled ? "success" : "neutral"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUserInteraction();
                      handleToggleTeamAutoDraft(pick.team_id, pick.autodraft_enabled || false);
                    }}
                    sx={{ 
                      minWidth: 24,
                      minHeight: 24,
                      borderRadius: '50%',
                      boxShadow: 'sm'
                    }}
                    title={pick.autodraft_enabled ? `Disable Auto Draft for ${pick.team_name}` : `Enable Auto Draft for ${pick.team_name}`}
                  >
                    🤖
                  </IconButton>
                )}
                
                {/* Trade Button */}
                <IconButton
                  size="sm"
                  variant="soft"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUserInteraction();
                    onInitiateTrade(pick);
                  }}
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
