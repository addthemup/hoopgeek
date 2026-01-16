import { Box, Typography, Sheet, Avatar } from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { getTeamColors } from '../utils/nbaTeamColors';
import { useState, useMemo } from 'react';
import { hexToRgba } from './MarginBars';
import { getDataRowStyles } from '../utils/marginbarsStyles';
import { AnimatePresence } from 'framer-motion';
import SplitFlapRow from './SplitFlapRow';
import SplitFlapText from './SplitFlapText';
import LoadingAvatar from './LoadingAvatar';

interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  team_abbreviation: string;
  jersey_number: string;
  nba_player_id: number;
  total_minutes: number; // Total minutes played across all games
}

interface MarginTeamRosterProps {
  teamId?: string;
  activePlayerId?: string;
  position: 'left' | 'right';
}

export default function MarginTeamRoster({ teamId, activePlayerId, position }: MarginTeamRosterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const isHomeRoute = location.pathname === '/';
  
  // Get team ID from route if not provided
  const resolvedTeamId = teamId || params.id;
  
  // First, get the team to find its abbreviation
  const { data: teamData } = useQuery({
    queryKey: ['nba-team', resolvedTeamId],
    queryFn: async () => {
      if (!resolvedTeamId) return null;
      
      const { data, error } = await supabase
        .from('nba_teams')
        .select('abbreviation, team_id')
        .eq('id', resolvedTeamId)
        .single();
      
      // Map abbreviation to team_abbreviation for consistency
      if (data) {
        data.team_abbreviation = data.abbreviation;
      }
      
      if (error) {
        console.error('Error fetching team:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!resolvedTeamId,
  });

  // Get current season
  const currentSeason = useQuery({
    queryKey: ['current-nba-season'],
    queryFn: async () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      // NBA season typically starts in October (month 10)
      let seasonStart, seasonEnd;
      if (month >= 10) {
        seasonStart = year;
        seasonEnd = year + 1;
      } else {
        seasonStart = year - 1;
        seasonEnd = year;
      }
      
      return `${seasonStart}-${seasonEnd.toString().slice(-2)}`;
    },
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
  });

  // Fetch roster players for this team from nba_team_roster table
  const { data: rosterPlayers, isLoading } = useQuery<RosterPlayer[]>({
    queryKey: ['nba-team-roster', teamData?.team_id, currentSeason.data],
    queryFn: async () => {
      if (!teamData?.team_id || !currentSeason.data) return [];
      
      // Fetch roster
      const { data: rosterData, error: rosterError } = await supabase
        .from('nba_team_roster')
        .select(`
          id,
          player_id,
          nba_player_id,
          player_name,
          position,
          jersey_number,
          nba_players!left(id, name, nba_player_id)
        `)
        .eq('team_id', teamData.team_id)
        .eq('season', currentSeason.data);
      
      if (rosterError) {
        console.error('Error fetching roster:', rosterError);
        return [];
      }
      
      if (!rosterData || rosterData.length === 0) return [];
      
      // Get all nba_player_ids to fetch total minutes
      const nbaPlayerIds = rosterData
        .map((r: any) => r.nba_player_id || r.nba_players?.nba_player_id)
        .filter((id: any) => id) as number[];
      
      // Fetch total minutes for each player from nba_boxscores
      const { data: minutesData, error: minutesError } = await supabase
        .from('nba_boxscores')
        .select('nba_player_id, min')
        .in('nba_player_id', nbaPlayerIds)
        .eq('season_year', currentSeason.data);
      
      if (minutesError) {
        console.error('Error fetching minutes:', minutesError);
      }
      
      // Calculate total minutes per player
      const minutesMap = new Map<number, number>();
      if (minutesData) {
        minutesData.forEach((boxscore: any) => {
          const playerId = boxscore.nba_player_id;
          const minutes = boxscore.min ? parseFloat(boxscore.min) : 0;
          minutesMap.set(playerId, (minutesMap.get(playerId) || 0) + minutes);
        });
      }
      
      // Transform to RosterPlayer format with total minutes
      const players = (rosterData || []).map((roster: any) => {
        const nbaPlayerId = roster.nba_player_id || roster.nba_players?.nba_player_id || 0;
        return {
          id: roster.player_id || roster.id, // Use player_id if available, fallback to roster id
          name: roster.player_name || roster.nba_players?.name || 'Unknown',
          position: roster.position || '',
          team_abbreviation: teamData.team_abbreviation,
          jersey_number: roster.jersey_number || '',
          nba_player_id: nbaPlayerId,
          total_minutes: minutesMap.get(nbaPlayerId) || 0,
        };
      }) as RosterPlayer[];
      
      // Sort by total minutes (descending), then by jersey number
      players.sort((a, b) => {
        if (b.total_minutes !== a.total_minutes) {
          return b.total_minutes - a.total_minutes; // Most minutes first
        }
        // If minutes are equal, sort by jersey number
        const aJersey = parseInt(a.jersey_number) || 999;
        const bJersey = parseInt(b.jersey_number) || 999;
        return aJersey - bJersey;
      });
      
      return players;
    },
    enabled: !!teamData?.team_id && !!currentSeason.data,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const rowHeight = 'calc((100vh - 40px) / 16)';
  const teamColors = teamData?.team_abbreviation 
    ? getTeamColors(teamData.team_abbreviation)
    : { primary: '#666666', secondary: '#999999' };


  if (isLoading) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!rosterPlayers || rosterPlayers.length === 0) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
          No roster data
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        p: 0.5, 
        pt: 0.5, 
        height: '100%',
        perspective: '1200px',
        perspectiveOrigin: 'center center',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Header Row */}
      <Sheet
        sx={{
          mb: 0.25,
          borderRadius: '4px',
          height: rowHeight,
          minHeight: '32px',
          bgcolor: '#000000',
          p: 0.5,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography
          level="body-xs"
          sx={{
            color: hexToRgba(teamColors.primary, 0.9),
            fontWeight: 700,
            fontSize: '1.5rem',
            textAlign: 'center',
            lineHeight: 1.1,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {teamData?.team_abbreviation || 'ROSTER'}
        </Typography>
      </Sheet>
      
      <AnimatePresence mode="popLayout">
        {rosterPlayers.slice(0, 15).map((player, index) => {
          const isActive = activePlayerId === player.id;
          
          return (
            <SplitFlapRow
              key={`${player.id}-${teamData?.team_abbreviation || 'roster'}`}
              index={index}
              keyValue={`${player.id}-${teamData?.team_abbreviation || 'roster'}`}
            >
              <Sheet
                onClick={() => {
                  if (isHomeRoute) {
                    // Filter feed by player on home screen
                    const newSearchParams = new URLSearchParams(window.location.search);
                    newSearchParams.set('filterPlayer', player.id);
                    // Clear team filter if set
                    newSearchParams.delete('filterTeam');
                    navigate(`/?${newSearchParams.toString()}`, { replace: true });
                  } else {
                    // Navigate to player page on other screens
                    navigate(`/player/${player.id}`);
                  }
                }}
                sx={{
                  ...getDataRowStyles(teamColors, position, rowHeight),
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  position: 'relative',
                  ...(isActive && {
                    border: `3px solid ${teamColors.secondary}`,
                    boxShadow: `0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 0 3px ${hexToRgba(teamColors.secondary, 0.5)}, 0 0 15px ${hexToRgba(teamColors.secondary, 0.4)}`,
                  }),
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, position: 'relative', zIndex: 2, width: '100%' }}>
                  {/* Jersey Number */}
                  <Box
                    sx={{
                      color: '#ffffff',
                      minWidth: '24px',
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SplitFlapText
                      value={player.jersey_number || '—'}
                      delay={index * 0.05}
                      characterDelay={0.02}
                      duration={0.35}
                      fontSize="1.5rem"
                      color="#ffffff"
                    />
                  </Box>

                  {/* Player Avatar */}
                  <LoadingAvatar
                    nbaPlayerId={player.nba_player_id}
                    playerName={player.name}
                    size={40}
                    teamColors={teamColors}
                    sx={{
                      width: '40px',
                      height: '40px',
                      border: `1px solid ${hexToRgba(teamColors.primary, 0.4)}`,
                      fontSize: '0.65rem',
                    }}
                  />

                  {/* Player Name - Bigger and takes up remaining space */}
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
                        value={player.name?.split(' ').pop() || 'N/A'}
                        delay={index * 0.05 + 0.1}
                        characterDelay={0.025}
                        duration={0.35}
                        fontSize="1.5rem"
                        color="#ffffff"
                      />
                    </Box>
                  </Box>

                  {/* Position - Far Right */}
                  <Box
                    sx={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '1.2rem',
                      lineHeight: 1.1,
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: '30px',
                      textAlign: 'right',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <SplitFlapText
                      value={player.position}
                      delay={index * 0.05 + 0.15}
                      characterDelay={0.02}
                      duration={0.3}
                      fontSize="1.2rem"
                      color="rgba(255, 255, 255, 0.6)"
                    />
                  </Box>
                </Box>
              </Sheet>
            </SplitFlapRow>
          );
        })}
      </AnimatePresence>
    </Box>
  );
}

