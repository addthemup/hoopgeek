import { Box, Typography, Sheet, Avatar } from '@mui/joy';
import { useStandings, StandingsTeam } from '../hooks/useStandings';
import { getTeamColors } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useQuery } from '@tanstack/react-query';
import { hexToRgba } from './MarginBars';
import { getDataRowStyles } from '../utils/marginbarsStyles';
import { AnimatePresence } from 'framer-motion';
import SplitFlapRow from './SplitFlapRow';
import SplitFlapText from './SplitFlapText';

interface MarginTeamStandingsProps {
  teamId: string;
  position: 'left' | 'right';
}

export default function MarginTeamStandings({ teamId, position }: MarginTeamStandingsProps) {
  const { data: standings, isLoading } = useStandings();
  const navigate = useNavigate();
  const rowHeight = 'calc((100vh - 40px) / 16)';

  // Get team data to determine conference
  const { data: teamData } = useQuery({
    queryKey: ['team-for-standings', teamId],
    queryFn: async () => {
      const { data } = await supabase
        .from('nba_teams')
        .select('team_abbreviation, conference')
        .eq('id', teamId)
        .single();
      return data;
    },
    enabled: !!teamId,
  });

  const conference = teamData?.conference === 'East' ? 'East' : 'West';
  const teams = conference === 'East' ? standings?.east || [] : standings?.west || [];
  
  // Find current team's rank
  const currentTeamRank = teams.findIndex(t => {
    // Match by team abbreviation
    return t.team_abbreviation === teamData?.team_abbreviation;
  });


  if (isLoading) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
          Loading...
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
            color: 'rgba(184, 134, 11, 0.7)',
            fontWeight: 700,
            fontSize: '1.5rem',
            textAlign: 'center',
            lineHeight: 1.1,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {conference === 'East' ? 'Eastern' : 'Western'}
        </Typography>
      </Sheet>
      
      <AnimatePresence mode="popLayout">
        {teams.slice(0, 15).map((team, index) => {
          const teamColors = getTeamColors(team.team_abbreviation);
          const isCurrentTeam = team.team_abbreviation === teamData?.team_abbreviation;
          
          const handleTeamClick = async () => {
            try {
              const { data: teamData } = await supabase
                .from('nba_teams')
                .select('id')
                .eq('team_id', team.team_id)
                .single();
              
              if (teamData?.id) {
                navigate(`/team/${teamData.id}`);
              }
            } catch (error) {
              console.error('Error navigating to team:', error);
            }
          };
          
          return (
            <SplitFlapRow
              key={`${team.id}-${team.conference_rank || index}`}
              index={index}
              keyValue={`${team.id}-${team.conference_rank || index}`}
            >
              <Sheet
                onClick={handleTeamClick}
                sx={{
                  ...getDataRowStyles(teamColors, position, rowHeight),
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
            </SplitFlapRow>
          );
        })}
      </AnimatePresence>
    </Box>
  );
}

