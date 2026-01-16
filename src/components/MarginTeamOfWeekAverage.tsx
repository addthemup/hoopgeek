import { Box, Typography, Avatar, Sheet } from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { getTeamColors } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { useNavigate, useLocation } from 'react-router-dom';
import { hexToRgba } from './MarginBars';
import { getDataRowStyles, headerRowStyles } from '../utils/marginbarsStyles';
import { AnimatePresence } from 'framer-motion';
import SplitFlapRow from './SplitFlapRow';
import SplitFlapText from './SplitFlapText';
import { useQueryWithPreviousData } from '../hooks/useQueryWithPreviousData';
import LoadingAvatar from './LoadingAvatar';

interface WeekPlayer {
  player_id: string | null;
  nba_player_id: number;
  player_name: string;
  team: string;
  player_position: string;
  jersey_number: string;
  salary: number;
  avg_fantasy_points: number;
  games_played: number;
  lineup_order?: number;
  lineup_unit?: string;
  unit_position?: number;
  weighted_points?: number;
}

interface MarginTeamOfWeekAverageProps {
  position: 'left' | 'right';
}

export default function MarginTeamOfWeekAverage({ position }: MarginTeamOfWeekAverageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';
  const { data: weekPlayers, isLoading } = useQueryWithPreviousData<WeekPlayer[]>({
    queryKey: ['optimal-lineup-of-the-week'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_optimal_lineup_of_the_week');

      if (error) {
        console.error('Error fetching players of week:', error);
        return [];
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Use same row height calculation as standings (16 rows total: 1 header + 3 section headers + 12 player rows)
  const rowHeight = 'calc((100vh - 40px) / 16)';
  
  // Get previous week info for header
  const { data: previousWeek } = useQuery({
    queryKey: ['previous-week-for-totw'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_season_weeks')
        .select('week_number, start_date, end_date')
        .eq('season_year', 2026)
        .eq('league_id', 0)
        .lt('end_date', new Date().toISOString().split('T')[0])
        .order('end_date', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) return null;
      return data;
    },
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });
  
  const weekString = previousWeek 
    ? `W${previousWeek.week_number}` 
    : 'W?';
  
  // Helper to get position priority for sorting (C=1, F=2, G=3, Util=4)
  const getPositionPriority = (pos: string): number => {
    const upperPos = pos.toUpperCase();
    if (upperPos.includes('C') || upperPos === 'CENTER') return 1;
    if (upperPos.includes('F') || upperPos.includes('FORWARD')) return 2;
    if (upperPos.includes('G') || upperPos.includes('GUARD')) return 3;
    return 4; // Util or other
  };

  // Group players by lineup_unit and sort by position (C, F, F, G, G)
  const starters = (weekPlayers || [])
    .filter(p => p.lineup_unit === 'starters')
    .sort((a, b) => {
      const priorityA = getPositionPriority(a.player_position || '');
      const priorityB = getPositionPriority(b.player_position || '');
      if (priorityA !== priorityB) return priorityA - priorityB;
      // If same position type, sort by unit_position
      return (a.unit_position || 0) - (b.unit_position || 0);
    });
  
  const rotation = (weekPlayers || [])
    .filter(p => p.lineup_unit === 'rotation')
    .sort((a, b) => {
      const priorityA = getPositionPriority(a.player_position || '');
      const priorityB = getPositionPriority(b.player_position || '');
      if (priorityA !== priorityB) return priorityA - priorityB;
      return (a.unit_position || 0) - (b.unit_position || 0);
    });
  
  const bench = (weekPlayers || [])
    .filter(p => p.lineup_unit === 'bench')
    .sort((a, b) => (a.unit_position || 0) - (b.unit_position || 0));
  
  // Position labels for each unit (display order)
  const startersPositions = ['C', 'F', 'F', 'G', 'G'];
  const rotationPositions = ['C', 'F', 'F', 'G', 'G'];
  const benchPositions = ['Util', 'Util'];

  if (isLoading) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  // Helper to render a section header
  const renderSectionHeader = (title: string) => (
    <Sheet
      key={`header-${title}`}
      sx={headerRowStyles}
    >
      <Typography
        level="body-xs"
        sx={{
          color: 'rgba(184, 134, 11, 0.7)',
          fontWeight: 700,
          fontSize: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </Typography>
    </Sheet>
  );

  // Helper to render a player row
  const renderPlayerRow = (player: WeekPlayer | null, positionLabel: string, index: number, globalIndex: number) => {
    if (!player) {
      // Empty row placeholder
      return (
        <Sheet
          key={`empty-${index}`}
          sx={{
            mb: 0.25,
            borderRadius: '4px',
            height: rowHeight,
            background: 'linear-gradient(to right, rgba(184, 134, 11, 0.3), rgba(184, 134, 11, 0.5))',
            p: 0.5,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.3, width: '100%' }}>
            <Typography
              level="body-xs"
              sx={{
                color: 'rgba(184, 134, 11, 0.3)',
                fontWeight: 600,
                minWidth: '32px',
                fontSize: '0.75rem',
              }}
            >
              {positionLabel}
            </Typography>
            <Box sx={{ flex: 1 }} />
          </Box>
        </Sheet>
      );
    }

    const teamColors = getTeamColors(player.team);

    const handlePlayerClick = () => {
      if (player.player_id) {
        if (isHomeRoute) {
          // Filter feed by player on home screen
          const newSearchParams = new URLSearchParams(window.location.search);
          newSearchParams.set('filterPlayer', player.player_id);
          // Clear team filter if set
          newSearchParams.delete('filterTeam');
          navigate(`/?${newSearchParams.toString()}`, { replace: true });
        } else {
          // Navigate to player page on other screens
          navigate(`/player/${player.player_id}`);
        }
      }
    };

    return (
      <SplitFlapRow
        key={`${player.player_id || `player-${index}`}-${weekString}`}
        index={globalIndex}
        keyValue={`${player.player_id || `player-${index}`}-${weekString}`}
      >
        <Sheet
          onClick={handlePlayerClick}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', position: 'relative', zIndex: 2 }}>
            {/* Position Label */}
            <Box
              sx={{
                color: 'rgba(184, 134, 11, 0.7)',
                minWidth: '32px',
                fontSize: '0.75rem',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <SplitFlapText
                value={positionLabel}
                delay={globalIndex * 0.05}
                characterDelay={0.02}
                duration={0.3}
                fontSize="0.75rem"
                color="rgba(184, 134, 11, 0.7)"
              />
            </Box>

            {/* Player Avatar */}
            <LoadingAvatar
              nbaPlayerId={player.nba_player_id}
              playerName={player.player_name}
              size={40}
              teamColors={teamColors}
              sx={{
                width: '40px',
                height: '40px',
                border: `1px solid ${hexToRgba(teamColors.primary, 0.4)}`,
                fontSize: '0.65rem',
              }}
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
                  value={player.player_name?.split(' ').pop() || 'N/A'}
                  delay={globalIndex * 0.05 + 0.1}
                  characterDelay={0.025}
                  duration={0.35}
                  fontSize="1rem"
                  color="#ffffff"
                />
              </Box>
              <Box
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.75rem',
                  lineHeight: 1.1,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <SplitFlapText
                  value={player.player_position}
                  delay={globalIndex * 0.05 + 0.15}
                  characterDelay={0.02}
                  duration={0.3}
                  fontSize="0.75rem"
                  color="rgba(255, 255, 255, 0.6)"
                />
              </Box>
            </Box>

            {/* Average Fantasy Points and Salary */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
              <Box
                sx={{
                  color: 'rgba(184, 134, 11, 0.7)',
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
                  value={`${player.avg_fantasy_points.toFixed(1)} FP`}
                  delay={globalIndex * 0.05 + 0.2}
                  characterDelay={0.02}
                  duration={0.3}
                  fontSize=".75rem"
                  color="rgba(184, 134, 11, 0.7)"
                />
              </Box>
              <Box
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '.65rem',
                  textAlign: 'right',
                  lineHeight: 1.1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                <SplitFlapText
                  value={`$${((player.salary || 0) / 1000000).toFixed(1)}M`}
                  delay={globalIndex * 0.05 + 0.25}
                  characterDelay={0.02}
                  duration={0.3}
                  fontSize=".65rem"
                  color="rgba(255, 255, 255, 0.5)"
                />
              </Box>
            </Box>
          </Box>
        </Sheet>
      </SplitFlapRow>
    );
  };

  // Only show empty state if we're not loading and have no data
  if (!isLoading && (!weekPlayers || weekPlayers.length === 0)) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            No lineup available
          </Typography>
          <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.3)', mt: 1 }}>
            No games this week or no data available
          </Typography>
        </Box>
      </Box>
    );
  }

  // Show loading only if we have no data at all (including previous)
  if (isLoading && (!weekPlayers || weekPlayers.length === 0)) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography level="body-sm" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            Loading...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Calculate global indices for staggered animation
  let globalIndex = 0;

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
          p: 0.5,
          borderRadius: '4px',
          height: rowHeight,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          bgcolor: 'rgba(184, 134, 11, 0.08)',
          border: '1px solid rgba(184, 134, 11, 0.2)',
          borderLeft: '2px solid rgba(184, 134, 11, 0.5)',
        }}
      >
        <Typography
          level="body-xs"
          sx={{
            color: 'rgba(184, 134, 11, 0.7)',
            fontWeight: 700,
            fontSize: '1.2rem',
            textAlign: 'center',
            lineHeight: 1.1,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          TOTW
        </Typography>
        <Typography
          level="body-xs"
          sx={{
            color: 'rgba(184, 134, 11, 0.5)',
            fontWeight: 500,
            fontSize: '0.9rem',
            textAlign: 'center',
            lineHeight: 1,
            mt: 0.25,
          }}
        >
          {weekString}
        </Typography>
      </Sheet>

      <AnimatePresence mode="popLayout">
        {/* Starters Section */}
        {renderSectionHeader('Starters')}
        {startersPositions.map((pos, idx) => {
          const currentIndex = globalIndex++;
          return renderPlayerRow(starters[idx] || null, pos, idx, currentIndex);
        })}

        {/* Rotation Section */}
        {renderSectionHeader('Rotation')}
        {rotationPositions.map((pos, idx) => {
          const currentIndex = globalIndex++;
          return renderPlayerRow(rotation[idx] || null, pos, idx, currentIndex);
        })}

        {/* Bench Section */}
        {renderSectionHeader('Bench')}
        {benchPositions.map((pos, idx) => {
          const currentIndex = globalIndex++;
          return renderPlayerRow(bench[idx] || null, pos, idx, currentIndex);
        })}
      </AnimatePresence>
    </Box>
  );
}

