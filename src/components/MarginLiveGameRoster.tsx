import { Box, Typography, Sheet } from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { getTeamColors } from '../utils/nbaTeamColors';
import { hexToRgba } from './MarginBars';
import { getDataRowStyles } from '../utils/marginbarsStyles';
import { AnimatePresence } from 'framer-motion';
import SplitFlapRow from './SplitFlapRow';
import SplitFlapText from './SplitFlapText';
import LoadingAvatar from './LoadingAvatar';
import { FANDUEL_SCORING } from '../utils/fantasyScoring';

interface LiveRosterPlayer {
  id: string;
  name: string;
  position: string;
  jersey_number: string;
  nba_player_id: number;
  team_abbreviation: string;
  liveStats?: {
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
    tov?: number;
    min?: number;
    fgm?: number;
    fga?: number;
    fg3m?: number;
    fg3a?: number;
    ftm?: number;
    fta?: number;
  };
  fantasy_points?: number;
}

interface MarginLiveGameRosterProps {
  gameId: string;
  teamTricode: string;
  position: 'left' | 'right';
}

export default function MarginLiveGameRoster({ 
  gameId, 
  teamTricode, 
  position 
}: MarginLiveGameRosterProps) {
  const navigate = useNavigate();
  const rowHeight = 'calc((100vh - 40px) / 16)';

  // Get team data
  const { data: teamData } = useQuery({
    queryKey: ['team-by-tricode', teamTricode],
    queryFn: async () => {
      const { data } = await supabase
        .from('nba_teams')
        .select('id, team_id, team_abbreviation, abbreviation')
        .or(`team_abbreviation.eq.${teamTricode},abbreviation.eq.${teamTricode}`)
        .single();
      return data;
    },
    enabled: !!teamTricode,
  });

  // Get current season
  const { data: currentSeason } = useQuery({
    queryKey: ['current-nba-season'],
    queryFn: async () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      
      if (month >= 10) {
        return `${year}-${(year + 1).toString().slice(-2)}`;
      } else {
        return `${year - 1}-${year.toString().slice(-2)}`;
      }
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Fetch roster players
  const { data: rosterPlayers, isLoading: rosterLoading } = useQuery({
    queryKey: ['nba-team-roster-live', teamData?.team_id, currentSeason],
    queryFn: async () => {
      if (!teamData?.team_id || !currentSeason) return [];
      
      const { data, error } = await supabase
        .from('nba_team_roster')
        .select(`
          id,
          player_id,
          nba_player_id,
          player_name,
          position,
          jersey_number,
          team_abbreviation
        `)
        .eq('team_id', teamData.team_id)
        .eq('season', currentSeason)
        .order('jersey_number', { ascending: true });
      
      if (error) {
        console.error('Error fetching roster:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!teamData?.team_id && !!currentSeason,
  });

  // Fetch live stats for all players in this game
  const { data: liveStats } = useQuery({
    queryKey: ['live-player-stats', gameId, teamTricode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_player_stats')
        .select('nba_player_id, stats')
        .eq('game_id', gameId)
        .eq('team_tricode', teamTricode);
      
      if (error) {
        console.error('Error fetching live stats:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!gameId && !!teamTricode,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Combine roster with live stats
  const playersWithStats: LiveRosterPlayer[] = (rosterPlayers || []).map((player: any) => {
    const liveStat = liveStats?.find((ls: any) => ls.nba_player_id === player.nba_player_id);
    const stats = liveStat?.stats || {};
    
    // Calculate fantasy points
    const fantasyPoints = FANDUEL_SCORING.calculatePoints({
      pts: stats.pts || 0,
      reb: stats.reb || 0,
      ast: stats.ast || 0,
      stl: stats.stl || 0,
      blk: stats.blk || 0,
      tov: stats.tov || 0,
      fgm: stats.fgm || 0,
      fga: stats.fga || 0,
      fg_pct: stats.fg_pct || 0,
      fg3m: stats.fg3m || 0,
      fg3a: stats.fg3a || 0,
      fg3_pct: stats.fg3_pct || 0,
      ftm: stats.ftm || 0,
      fta: stats.fta || 0,
      ft_pct: stats.ft_pct || 0,
      oreb: stats.oreb || 0,
      dreb: stats.dreb || 0,
      pf: stats.pf || 0,
      min: stats.min || 0,
      plus_minus: stats.plus_minus || 0,
    } as any);

    return {
      id: player.id,
      name: player.player_name,
      position: player.position,
      jersey_number: player.jersey_number,
      nba_player_id: player.nba_player_id,
      team_abbreviation: player.team_abbreviation,
      liveStats: stats,
      fantasy_points: fantasyPoints,
    };
  });

  // Sort by minutes played (descending), then by fantasy points
  const sortedPlayers = [...playersWithStats].sort((a, b) => {
    const aMin = a.liveStats?.min || 0;
    const bMin = b.liveStats?.min || 0;
    if (bMin !== aMin) {
      return bMin - aMin;
    }
    return (b.fantasy_points || 0) - (a.fantasy_points || 0);
  });

  const teamColors = getTeamColors(teamTricode);

  if (rosterLoading) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
        <Typography level="body-sm" sx={{ color: '#ffffff', textAlign: 'center', p: 2 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 0.5, 
      pt: 0.5, 
      height: '100%',
      perspective: '1200px',
      perspectiveOrigin: 'center center',
      transformStyle: 'preserve-3d',
    }}>
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
          {teamTricode}
        </Typography>
      </Sheet>
      
      <AnimatePresence mode="popLayout">
        {sortedPlayers.slice(0, 15).map((player, index) => {
          const handlePlayerClick = () => {
            if (player.id) {
              navigate(`/player/${player.id}`);
            }
          };

          return (
            <SplitFlapRow
              key={`${player.id}-${teamTricode}-${gameId}`}
              index={index}
              keyValue={`${player.id}-${teamTricode}-${gameId}`}
            >
              <Sheet
                onClick={handlePlayerClick}
                sx={{
                  ...getDataRowStyles(teamColors, position, rowHeight),
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  position: 'relative',
                  cursor: 'pointer',
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

                  {/* Player Name */}
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
                        value={player.name?.split(' ').pop() || 'N/A'}
                        delay={index * 0.05 + 0.1}
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
                        value={`${player.liveStats?.min || 0}' | ${player.fantasy_points?.toFixed(1) || '0.0'} FP`}
                        delay={index * 0.05 + 0.15}
                        characterDelay={0.02}
                        duration={0.3}
                        fontSize="0.75rem"
                        color="rgba(255, 255, 255, 0.6)"
                      />
                    </Box>
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

