import { Box, Typography, Table, Sheet, Avatar, Chip } from '@mui/joy';
import { useStandings, StandingsTeam } from '../hooks/useStandings';
import { getTeamColors } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { useMediaQuery } from '@mui/material';
import { useMarginBars } from '../contexts/MarginBarsContext';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import MarginLeadersFull from './MarginLeadersFull';
import MarginPlayersOfNight from './MarginPlayersOfNight';
import MarginTeamRoster from './MarginTeamRoster';
import MarginPlayerProps from './MarginPlayerProps';
import MarginTeamStandings from './MarginTeamStandings';
import MarginTeamOfWeek from './MarginTeamOfWeek';
import MarginTeamOfWeekAverage from './MarginTeamOfWeekAverage';
import MarginLiveGameRoster from './MarginLiveGameRoster';
import { useQuery } from '@tanstack/react-query';
import { getDataRowStyles, headerRowStyles, hexToRgba } from '../utils/marginbarsStyles';
import { motion, AnimatePresence } from 'framer-motion';
import SplitFlapText from './SplitFlapText';

// Re-export for backward compatibility
export { hexToRgba, getDataRowStyles, headerRowStyles };

/**
 * Shared styling constants for all margin bar tables
 * 
 * IMPORTANT: All margin bar components (MarginTeamRoster, MarginTeamStandings, 
 * MarginPlayerProps, MarginLeadersFull, MarginPlayersOfNight, MarginTeamOfWeekAverage, etc.)
 * MUST use these exact styles to ensure consistency across all tables.
 * 
 * Usage:
 * - Import: import { MARGIN_BAR_STYLES, hexToRgba } from './MarginBars'
 * - Container: <Box sx={MARGIN_BAR_STYLES.containerPadding}>
 * - Header: <Sheet sx={MARGIN_BAR_STYLES.headerRow}>
 * - Header Typography: <Typography sx={MARGIN_BAR_STYLES.headerTypography}>
 * - Data Row: <Sheet sx={MARGIN_BAR_STYLES.dataRow(teamColors, position)}>
 */
export const MARGIN_BAR_STYLES = {
  rowHeight: 'calc((100vh - 40px) / 16)',
  containerPadding: { p: 0.5, pt: 0.5, height: '100%' },
  headerRow: headerRowStyles,
  headerTypography: {
    color: 'rgba(184, 134, 11, 0.7)',
    fontWeight: 700,
    fontSize: '1.5rem',
    textAlign: 'center',
    lineHeight: 1.1,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  dataRow: getDataRowStyles,
};

interface MarginBarsProps {
  conference: 'East' | 'West';
  position: 'left' | 'right';
}

export default function MarginBars({ conference, position }: MarginBarsProps) {
  // ALL hooks must be called in the same order on every render
  // No conditional returns before all hooks are called
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { data: standings, isLoading } = useStandings();
  const isDesktop = useMediaQuery('(min-width: 1500px)');
  const { activeView, currentRoute, marginBarsVisible } = useMarginBars();
  
  // Get filter params from URL
  const searchParams = new URLSearchParams(location.search);
  const filterTeam = searchParams.get('filterTeam');
  const selectedGameId = searchParams.get('gameId');
  
  // Determine route type
  const isSettingsRoute = location.pathname === '/settings';
  const isHomeRoute = location.pathname === '/';
  const isTodayRoute = location.pathname === '/today' || location.pathname.startsWith('/dfs');
  const isFantasyRoute = location.pathname === '/fantasy' || location.pathname === '/dashboard';
  const isPlayerRoute = location.pathname.startsWith('/player/');
  const isTeamRoute = location.pathname.startsWith('/team/');
  
  // Get game data if game is selected on today route
  const { data: selectedGameData } = useQuery({
    queryKey: ['selected-game', selectedGameId],
    queryFn: async () => {
      if (!isTodayRoute || !selectedGameId) return null;
      const { data } = await supabase
        .from('nba_games')
        .select('game_id, home_team_tricode, away_team_tricode')
        .eq('game_id', selectedGameId)
        .single();
      return data;
    },
    enabled: isTodayRoute && !!selectedGameId,
  });
  
  // Get team ID from filterTeam if on home route
  const { data: filteredTeamData } = useQuery({
    queryKey: ['filtered-team', filterTeam],
    queryFn: async () => {
      if (!isHomeRoute || !filterTeam) return null;
      const { data } = await supabase
        .from('nba_teams')
        .select('id, team_abbreviation')
        .eq('team_abbreviation', filterTeam)
        .single();
      return data;
    },
    enabled: isHomeRoute && !!filterTeam,
  });
  
  // For player route, get player data to determine team
  const { data: playerData } = useQuery({
    queryKey: ['player-for-roster', params.id],
    queryFn: async () => {
      if (!isPlayerRoute || !params.id) return null;
      const { data, error } = await supabase
        .from('nba_players')
        .select('id, name, team_abbreviation')
        .eq('id', params.id)
        .maybeSingle();
      
      // Handle error or no data - PGRST116 means 0 rows, which is fine with maybeSingle
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching player data in MarginBars:', error);
        return null;
      }
      
      return data;
    },
    enabled: isPlayerRoute && !!params.id,
  });
  
  // For player route, get team ID from team abbreviation
  const { data: playerTeamData } = useQuery({
    queryKey: ['player-team-id', playerData?.team_abbreviation],
    queryFn: async () => {
      if (!playerData?.team_abbreviation) return null;
      // Try team_abbreviation first, fallback to abbreviation
      let { data, error } = await supabase
        .from('nba_teams')
        .select('id')
        .eq('team_abbreviation', playerData.team_abbreviation)
        .maybeSingle();
      
      if (error || !data) {
        // Fallback to abbreviation column
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('nba_teams')
          .select('id')
          .eq('abbreviation', playerData.team_abbreviation)
          .maybeSingle();
        
        if (fallbackError && fallbackError.code !== 'PGRST116') {
          console.error('Error fetching team data in MarginBars:', fallbackError);
          return null;
        }
        
        return fallbackData;
      }
      
      return data;
    },
    enabled: !!playerData?.team_abbreviation,
  });

  // NOW we can do conditional returns after all hooks are called
  if (isSettingsRoute) {
    return null; // Disable margin bars on settings page
  }

  if (!isDesktop) {
    return null; // Only show on desktop
  }

  if (!marginBarsVisible) {
    return null; // Hide margin bars when toggle is off
  }

  const teams = conference === 'East' ? standings?.east || [] : standings?.west || [];
  
  // Calculate row height to fit 16 rows in 100vh (1 header + 15 teams, minus tab height ~40px)
  const availableHeight = 'calc(100vh - 40px)';
  const rowHeight = MARGIN_BAR_STYLES.rowHeight;

  if (isLoading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          left: position === 'left' ? 0 : undefined, // Far left edge of screen
          right: position === 'right' ? 0 : undefined, // Far right edge of screen
          top: 0,
          // Calculate width to extend from edge to main content (1035px centered)
          // Main content is centered, so margin bar width = (100vw - 1035px) / 2
          width: { md: 'calc((100vw - 1035px) / 2)' },
          height: '100vh',
          bgcolor: '#000000',
          borderRight: position === 'left' ? '1px solid rgba(184, 134, 11, 0.15)' : 'none',
          borderLeft: position === 'right' ? '1px solid rgba(184, 134, 11, 0.15)' : 'none',
          overflowY: 'auto',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 0.5, pt: 0.5, flex: '0 0 70vh', overflowY: 'auto' }}>
          <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
            Loading...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        left: position === 'left' ? 0 : undefined, // Far left edge of screen
        right: position === 'right' ? 0 : undefined, // Far right edge of screen
        top: 0,
        // Calculate width to extend from edge to main content (1035px centered)
        // Main content is centered, so margin bar width = (100vw - 1035px) / 2
        width: { md: 'calc((100vw - 1035px) / 2)' },
        height: '100vh',
        bgcolor: '#000000',
        borderRight: position === 'left' ? '1px solid rgba(255, 215, 0, 0.2)' : 'none',
        borderLeft: position === 'right' ? '1px solid rgba(255, 215, 0, 0.2)' : 'none',
        overflowY: 'hidden',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* No tabs here - tabs are in shared component */}

      {/* Content Area - 100% height */}
      <Box sx={{ 
        flex: 1,
        overflowY: 'auto',
        height: availableHeight,
        '&::-webkit-scrollbar': {
          width: '4px',
        },
        '&::-webkit-scrollbar-track': {
          background: '#000000',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(184, 134, 11, 0.25)',
          borderRadius: '2px',
        },
      }}>
        {/* Route-specific content rendering */}
        {/* Lazy load views - only mount the active view for better performance */}
        {isPlayerRoute ? (
          // Player Page: Team roster on left, props/stats on right
          position === 'left' ? (
            <MarginTeamRoster 
              teamId={playerTeamData?.id} 
              activePlayerId={params.id}
              position={position}
            />
          ) : (
            activeView === 'standings' && playerData ? (
              <MarginPlayerProps 
                playerId={params.id || ''} 
                playerName={playerData.name || ''}
                position={position}
              />
            ) : (
              <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
                <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
                  Player Stats
                </Typography>
              </Box>
            )
          )
        ) : isTeamRoute ? (
          // Team Page: Team roster on left, standings/stats on right
          position === 'left' ? (
            <MarginTeamRoster teamId={params.id} position={position} />
          ) : (
            activeView === 'standings' && params.id ? (
              <MarginTeamStandings teamId={params.id} position={position} />
            ) : (
              <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
                <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
                  Team Standings
                </Typography>
              </Box>
            )
          )
        ) : (
          // Home/Today/Fantasy routes - show different views based on activeView
          // If on today route with selected game, show live game rosters
          isTodayRoute && selectedGameId && selectedGameData ? (
            position === 'left' ? (
              <MarginLiveGameRoster
                gameId={selectedGameId}
                teamTricode={selectedGameData.away_team_tricode}
                position={position}
              />
            ) : (
              <MarginLiveGameRoster
                gameId={selectedGameId}
                teamTricode={selectedGameData.home_team_tricode}
                position={position}
              />
            )
          ) : isHomeRoute && filterTeam && position === 'left' ? (
            // If on home route with team filter, show roster on left
            <MarginTeamRoster 
              teamId={filteredTeamData?.id} 
              position={position}
            />
          ) : activeView === 'standings' ? (
            // Standings View - 1 header + 15 rows, 100% height
            <Box sx={MARGIN_BAR_STYLES.containerPadding}>
                {/* Header Row */}
                <Sheet sx={headerRowStyles}>
                  <Typography level="body-xs" sx={MARGIN_BAR_STYLES.headerTypography}>
                    {conference === 'East' ? 'Eastern' : 'Western'}
                  </Typography>
                </Sheet>
                
                <Box
                  sx={{
                    perspective: '1200px',
                    perspectiveOrigin: 'center center',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  <AnimatePresence mode="popLayout">
                    {teams.slice(0, 15).map((team, index) => {
                      const teamColors = getTeamColors(team.team_abbreviation);
                  
                      const handleTeamClick = async () => {
                        try {
                          // If on home screen, filter the feed instead of navigating
                          if (isHomeRoute) {
                            // Set URL param to filter feed by team
                            const newSearchParams = new URLSearchParams(window.location.search);
                            newSearchParams.set('filterTeam', team.team_abbreviation);
                            // Clear player filter if set
                            newSearchParams.delete('filterPlayer');
                            navigate(`/?${newSearchParams.toString()}`, { replace: true });
                          } else {
                            // On other screens, navigate to team page
                            const { data: teamData } = await supabase
                              .from('nba_teams')
                              .select('id')
                              .eq('team_id', team.team_id)
                              .single();
                            
                            if (teamData?.id) {
                              navigate(`/team/${teamData.id}`);
                            }
                          }
                        } catch (error) {
                          console.error('Error handling team click:', error);
                        }
                      };
                      
                      return (
                        <Box
                          key={`${team.id}-${team.conference_rank || index}`}
                          component={motion.div}
                          initial={{ 
                            rotateY: -90,
                            opacity: 0,
                            scale: 0.95,
                            transformOrigin: 'center center',
                          }}
                          animate={{ 
                            rotateY: 0,
                            opacity: 1,
                            scale: 1,
                            transformOrigin: 'center center',
                          }}
                          exit={{ 
                            rotateY: 90,
                            opacity: 0,
                            scale: 0.95,
                            transformOrigin: 'center center',
                          }}
                          transition={{ 
                            duration: 0.3,
                            delay: index * 0.03, // Stagger each row by 30ms (reduced)
                            ease: [0.16, 1, 0.3, 1], // Custom easing for mechanical feel
                          }}
                          style={{
                            transformStyle: 'preserve-3d',
                          }}
                        >
                          <Sheet
                            onClick={handleTeamClick}
                            sx={{
                              ...getDataRowStyles(teamColors, position),
                              transformStyle: 'preserve-3d',
                              backfaceVisibility: 'hidden',
                              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                              position: 'relative',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 0%, transparent 50%, rgba(0, 0, 0, 0.1) 100%)',
                                pointerEvents: 'none',
                                zIndex: 1,
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, position: 'relative', zIndex: 2 }}>
                              {/* Rank */}
                              <Box
                                sx={{
                              color: '#ffffff',
                              minWidth: '18px',
                              textAlign: 'center',
                              fontSize: '2rem',
                              lineHeight: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <SplitFlapText
                              value={team.conference_rank || index + 1}
                              delay={index * 0.05}
                              characterDelay={0.02}
                              duration={0.35}
                              fontSize="2rem"
                              color="#ffffff"
                            />
                              </Box>

                              {/* Team Avatar */}
                              <Avatar
                                src={getTeamLogoUrl(team.team_abbreviation)}
                                alt={team.team_abbreviation}
                                sx={{
                              width: '40px',
                              height: '40px',
                              border: `1px solid ${hexToRgba(teamColors.primary, 0.4)}`,
                              fontSize: '0.65rem',
                            }}
                          >
                            {team.team_abbreviation.charAt(0)}
                              </Avatar>

                              {/* Team Info */}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box
                                  sx={{
                                color: '#ffffff',
                                fontSize: '1.5rem',
                                lineHeight: 1.1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <SplitFlapText
                                value={team.team_abbreviation}
                                delay={index * 0.05 + 0.1}
                                characterDelay={0.025}
                                duration={0.35}
                                fontSize="1.5rem"
                                color="#ffffff"
                              />
                                </Box>
                                <Box
                                  sx={{
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    fontSize: '1rem',
                                    lineHeight: 1.1,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  <SplitFlapText
                                    value={`${team.wins}-${team.losses}`}
                                    delay={index * 0.05 + 0.15}
                                    characterDelay={0.02}
                                    duration={0.3}
                                    fontSize="1rem"
                                    color="rgba(255, 255, 255, 0.6)"
                                  />
                                </Box>
                              </Box>

                              {/* Games Back */}
                              <Box
                                sx={{
                              color: team.games_behind === 0 ? 'rgba(184, 134, 11, 0.7)' : 'rgba(255, 255, 255, 0.5)',
                              fontSize: '.75rem',
                              minWidth: '40px',
                              textAlign: 'right',
                              lineHeight: 1.1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <SplitFlapText
                              value={team.games_behind === 0 ? '—' : `${team.games_behind.toFixed(1)} GB`}
                              delay={index * 0.05 + 0.2}
                              characterDelay={0.02}
                              duration={0.3}
                              fontSize=".75rem"
                              color={team.games_behind === 0 ? 'rgba(184, 134, 11, 0.7)' : 'rgba(255, 255, 255, 0.5)'}
                              />
                              </Box>
                            </Box>
                          </Sheet>
                        </Box>
                      );
                    })}
                  </AnimatePresence>
                </Box>
              </Box>
          ) : activeView === 'leaders' ? (
            // Leaders View
            <MarginLeadersFull position={position} />
          ) : activeView === 'team-of-the-week' ? (
            // Team of the Week View - show on right, Team of Night on left
            position === 'right' ? (
              <MarginTeamOfWeekAverage position={position} />
            ) : (
              <MarginPlayersOfNight position={position} />
            )
          ) : (
            // Default: Players of the Night on left, Team of Week on right
            position === 'left' ? (
              <MarginPlayersOfNight position={position} />
            ) : (
              <MarginTeamOfWeekAverage position={position} />
            )
          )
        )}
      </Box>
    </Box>
  );
}


