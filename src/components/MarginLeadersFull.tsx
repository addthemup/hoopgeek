import { Box, Typography, Sheet, Avatar } from '@mui/joy';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { getTeamColors } from '../utils/nbaTeamColors';
import { useMarginBars } from '../contexts/MarginBarsContext';
import { getDataRowStyles } from '../utils/marginbarsStyles';
import { AnimatePresence } from 'framer-motion';
import SplitFlapRow from './SplitFlapRow';
import SplitFlapText from './SplitFlapText';
import { useQueryWithPreviousData } from '../hooks/useQueryWithPreviousData';
import LoadingAvatar from './LoadingAvatar';

interface Leader {
  id: string;
  player_id: string;
  nba_player_id: number;
  team_id: number | null;
  category: string;
  value: number;
  rank: number;
  season: string;
  games_played: number;
  player_name?: string;
  team_abbreviation?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  'PTS': 'PTS',
  'REB': 'REB',
  'AST': 'AST',
  'STL': 'STL',
  'BLK': 'BLK',
  'FG_PCT': 'FG%',
  'FG3_PCT': '3P%',
  'FT_PCT': 'FT%',
};

interface MarginLeadersFullProps {
  position: 'left' | 'right';
}

// Helper function to convert hex to rgba with opacity (matching MarginBars.tsx)
function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(255, 255, 255, ${opacity})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Component to handle player avatar with NBA.com headshots (using LoadingAvatar)
function PlayerAvatar({ 
  nbaPlayerId, 
  playerName, 
  teamColors 
}: { 
  nbaPlayerId?: number; 
  playerName?: string;
  teamColors: { primary: string; secondary: string };
}) {
  return (
    <LoadingAvatar
      nbaPlayerId={nbaPlayerId}
      playerName={playerName}
      size={50}
      teamColors={teamColors}
      sx={{
        width: '50px',
        height: '50px',
        border: `1px solid ${hexToRgba(teamColors.primary, 0.4)}`,
        fontSize: '0.65rem',
      }}
    />
  );
}

export default function MarginLeadersFull({ position }: MarginLeadersFullProps) {
  const { activeCategoryLeft, activeCategoryRight } = useMarginBars();
  const activeCategory = position === 'left' ? activeCategoryLeft : activeCategoryRight;
  const navigate = useNavigate();
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';

  const { data: leaders, isLoading } = useQueryWithPreviousData<Leader[]>({
    queryKey: ['nba-leaders-full', activeCategory],
    queryFn: async () => {
      // Get current season
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const season = month >= 10 
        ? `${year}-${(year + 1).toString().slice(-2)}`
        : `${year - 1}-${year.toString().slice(-2)}`;

      // Fetch top 15 leaders for the active category only
      const { data: leadersData, error: leadersError } = await supabase
        .from('nba_leaders')
        .select('*')
        .eq('season', season)
        .eq('category', activeCategory)
        .order('rank', { ascending: true })
        .limit(15);

      if (leadersError) {
        console.error(`Error fetching ${activeCategory} leaders:`, leadersError);
        return [];
      }

      if (!leadersData || leadersData.length === 0) {
        return [];
      }

      // Then fetch player info for each leader (including nba_player_id)
      const playerIds = leadersData.map(l => l.player_id);
      const { data: playersData, error: playersError } = await supabase
        .from('nba_players')
        .select('id, name, team_abbreviation, nba_player_id')
        .in('id', playerIds);

      if (playersError) {
        console.error(`Error fetching players for ${activeCategory}:`, playersError);
        return [];
      }

      // Map players by id
      const playersMap = new Map(playersData?.map(p => [p.id, p]) || []);

      // Combine leaders with player data
      return leadersData.map((l: any) => {
        const player = playersMap.get(l.player_id);
        return {
          ...l,
          player_name: player?.name,
          team_abbreviation: player?.team_abbreviation,
          nba_player_id: player?.nba_player_id || l.nba_player_id,
          value: typeof l.value === 'string' ? parseFloat(l.value) : l.value,
        };
      });
    },
    staleTime: 60 * 60 * 1000,
  });

  // Calculate row height to fit 16 rows in 100vh (1 header + 15 leaders, matching standings)
  const rowHeight = 'calc((100vh - 40px) / 16)';

  // Only show loading if we don't have any data (including previous data)
  if (isLoading && (!leaders || leaders.length === 0)) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  if (!leaders || leaders.length === 0) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
          No leaders data available
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
          {CATEGORY_LABELS[activeCategory] || activeCategory}
        </Typography>
      </Sheet>
      
      <AnimatePresence mode="popLayout">
        {leaders.slice(0, 15).map((leader, index) => {
          const teamColors = leader.team_abbreviation 
            ? getTeamColors(leader.team_abbreviation)
            : { primary: '#666666', secondary: '#999999' };

          const valueText = activeCategory.includes('PCT') 
            ? (leader.value * 100).toFixed(1) + '%'
            : leader.value.toFixed(1);

          return (
            <SplitFlapRow
              key={`${leader.id}-${activeCategory}`}
              index={index}
              keyValue={`${leader.id}-${activeCategory}`}
            >
              <Sheet
                onClick={() => {
                  if (isHomeRoute) {
                    // Filter feed by player on home screen
                    const newSearchParams = new URLSearchParams(window.location.search);
                    newSearchParams.set('filterPlayer', leader.player_id);
                    // Clear team filter if set
                    newSearchParams.delete('filterTeam');
                    navigate(`/?${newSearchParams.toString()}`, { replace: true });
                  } else {
                    // Navigate to player page on other screens
                    navigate(`/player/${leader.player_id}`);
                  }
                }}
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
                      value={leader.rank}
                      delay={index * 0.05}
                      characterDelay={0.02}
                      duration={0.35}
                      fontSize="2rem"
                      color="#ffffff"
                    />
                  </Box>

                  {/* Player Avatar */}
                  <PlayerAvatar 
                    nbaPlayerId={leader.nba_player_id}
                    playerName={leader.player_name}
                    teamColors={teamColors}
                  />

                  {/* Player Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                      sx={{
                        color: '#ffffff',
                        fontSize: '1rem',
                        lineHeight: 1.1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <SplitFlapText
                        value={leader.player_name?.split(' ').pop() || 'N/A'}
                        delay={index * 0.05 + 0.1}
                        characterDelay={0.025}
                        duration={0.35}
                        fontSize="1rem"
                        color="#ffffff"
                      />
                    </Box>
                  </Box>

                  {/* Value */}
                  <Box
                    sx={{
                      color: leader.value >= (activeCategory.includes('PCT') ? 0.5 : 20) ? 'rgba(184, 134, 11, 0.7)' : 'rgba(255, 255, 255, 0.5)',
                      fontSize: '.75rem',
                      minWidth: '28px',
                      textAlign: 'right',
                      lineHeight: 1.1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <SplitFlapText
                      value={valueText}
                      delay={index * 0.05 + 0.15}
                      characterDelay={0.02}
                      duration={0.3}
                      fontSize=".75rem"
                      color={leader.value >= (activeCategory.includes('PCT') ? 0.5 : 20) ? 'rgba(184, 134, 11, 0.7)' : 'rgba(255, 255, 255, 0.5)'}
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

