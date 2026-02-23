import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMediaQuery } from '@mui/material';
import {
  Box,
  Typography,
  Stack,
  Card,
  CardContent,
  Chip,
  Button,
  Table,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Sheet,
  IconButton,
  Modal,
  ModalDialog,
  ModalClose,
} from '@mui/joy';
import { ArrowBack, NavigateBefore, NavigateNext, CalendarToday, EmojiEvents, BarChart, TrendingUp, Analytics, ArrowUpward, ArrowDownward, Shield } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { supabase } from '../utils/supabase';
import { getTeamColors, getTeamPrimaryColor, getTeamSecondaryColor } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { FANDUEL_SCORING } from '../utils/fantasyScoring';
import { calculatePropResult } from '../utils/playerPropsCalculator';
import { filterFullGameProps } from '../utils/playerPropsFilter';
import { hexToRgba } from '../utils/colorUtils';
import BoxScore from '../components/BoxScore';
import { FeedPost } from '../utils/feedAlgorithm';
import { matchPlayerNames } from '../utils/playerNameMatcher';
import { loadGameJson, getScoreData, getFunScore, getLeadChanges, getDunkStats, getScoringMilestones, getTeamStats, getStoryData, getQuarterScores, type GameJsonData } from '../utils/gameJsonLoader';
import PropPerformanceCell from '../components/PropPerformanceCell';
import { useOpponentTeamPropsPerformance } from '../hooks/useOpponentTeamPropsPerformance';
import { usePredictorStats } from '../hooks/usePredictorStats';

interface GameData {
  game_id: string;
  game_status: number; // 1 = scheduled, 2 = live, 3 = finished
  game_status_text: string;
  home_team_tricode: string;
  away_team_tricode: string;
  home_team_score: number;
  away_team_score: number;
  game_date: string;
  arena_name?: string;
  arena_city?: string;
  home_team_id?: number;
  away_team_id?: number;
}

interface PlayerStat {
  nba_player_id: number;
  player_id?: string;
  player_name: string;
  team_tricode: string;
  stats: {
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
    tov?: number;
    fgm?: number;
    fga?: number;
    fg3m?: number;
    fg3a?: number;
    ftm?: number;
    fta?: number;
    min?: number;
    plus_minus?: number;
  };
  fantasy_points?: number;
}

interface BoxScorePlayer {
  nba_player_id: number;
  player_id?: string;
  player_name: string;
  team_tricode: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  min: number;
  plus_minus: number;
  fantasy_points: number;
}

interface RosterPlayer {
  id: string;
  player_id?: string;
  nba_player_id: number;
  player_name: string;
  position: string;
  jersey_number: string;
  team_abbreviation: string;
}

interface PlayerProp {
  id: string;
  bet_type: string;
  line: number;
  price: string;
  american_odds: string;
  bookmaker: string;
  player_name: string;
  nba_player_id: number;
  player_id?: string;
}

type PropsVsTeamModalData = {
  teamTricode: string;
  label: string;
  data: NonNullable<ReturnType<typeof useOpponentTeamPropsPerformance>['data']>;
} | null;

function PropsVsTeamRow({
  betType,
  label,
  homeTricode,
  awayTricode,
  isMobile,
}: {
  betType: string;
  label: string;
  homeTricode: string;
  awayTricode: string;
  isMobile: boolean;
}) {
  const { data: vsHome } = useOpponentTeamPropsPerformance(homeTricode, betType, !!homeTricode && !!betType);
  const { data: vsAway } = useOpponentTeamPropsPerformance(awayTricode, betType, !!awayTricode && !!betType);
  const [modalData, setModalData] = useState<PropsVsTeamModalData>(null);

  const formatCell = (data: typeof vsHome, teamTricode: string) => {
    if (!data) return <Typography sx={{ color: '#666', fontSize: isMobile ? '0.65rem' : '0.75rem' }}>—</Typography>;
    if (data.totalProps === 0) return <Typography sx={{ color: '#666', fontSize: isMobile ? '0.65rem' : '0.75rem' }}>No data</Typography>;
    const rate = data.hitRate != null ? data.hitRate.toFixed(0) : '—';
    const color = data.hitRate != null ? (data.hitRate >= 60 ? '#4CAF50' : data.hitRate <= 40 ? '#F44336' : '#FFC72C') : '#CCCCCC';
    return (
      <Box
        component="button"
        type="button"
        onClick={() => setModalData({ teamTricode, label, data })}
        sx={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'right',
          '&:hover': { opacity: 0.85 },
        }}
      >
        <Typography sx={{ color, fontSize: isMobile ? '0.65rem' : '0.75rem', fontWeight: 600 }}>
          {rate}% ({data.hits}/{data.totalProps})
        </Typography>
      </Box>
    );
  };

  const resultsToShow = modalData?.data.last10Games.filter(g => g.result !== null && g.result !== 'push') ?? [];

  return (
    <>
      <tr style={{ borderBottom: '1px solid #333' }}>
        <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.7rem' : '0.8rem', padding: '8px 12px' }}>{label}</td>
        <td style={{ textAlign: 'right', padding: '8px 12px' }}>{formatCell(vsHome, homeTricode)}</td>
        <td style={{ textAlign: 'right', padding: '8px 12px' }}>{formatCell(vsAway, awayTricode)}</td>
      </tr>
      <Modal open={!!modalData} onClose={() => setModalData(null)}>
        <ModalDialog
          sx={{
            maxWidth: 520,
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#1a1a1a',
          }}
        >
          <ModalClose sx={{ color: '#fff' }} />
          {modalData && (
            <>
              <Typography level="h6" sx={{ color: '#fff', mb: 1 }}>
                {modalData.label} vs {modalData.teamTricode}
              </Typography>
              <Typography level="body-sm" sx={{ color: '#999', mb: 2 }}>
                Last 10 games (actual prop lines) · {modalData.data.hits}/{modalData.data.totalProps} hit over
              </Typography>
              <Box sx={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
                <Table size="sm" sx={{ '& th, & td': { color: '#ccc', fontSize: '0.75rem', py: 0.75 } }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Player</th>
                      <th style={{ textAlign: 'right' }}>Date</th>
                      <th style={{ textAlign: 'right' }}>Line</th>
                      <th style={{ textAlign: 'right' }}>Actual</th>
                      <th style={{ textAlign: 'center' }}>Hit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultsToShow.map((row, i) => (
                      <tr key={`${row.opponentPlayerId}-${row.gameDate}-${i}`}>
                        <td>{row.opponentPlayerName}</td>
                        <td style={{ textAlign: 'right' }}>{row.gameDate}</td>
                        <td style={{ textAlign: 'right' }}>{row.line ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>{row.actualValue}</td>
                        <td style={{ textAlign: 'center' }}>
                          {row.hit === true ? (
                            <Typography component="span" sx={{ color: '#4CAF50', fontWeight: 600 }}>Over</Typography>
                          ) : (
                            <Typography component="span" sx={{ color: '#F44336', fontWeight: 600 }}>Under</Typography>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Box>
            </>
          )}
        </ModalDialog>
      </Modal>
    </>
  );
}

export default function GamePage() {
  const { id: gameId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isLandscapeMobile = isLandscape && isMobile;
  
  // Get return path from location state or default to /today
  const returnPath = (location.state as any)?.returnPath || '/today';
  const returnDate = (location.state as any)?.returnDate;
  
  // Get game date and set up date navigation
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => {
    if (returnDate) return dayjs(returnDate);
    return dayjs();
  });

  // Team toggle state - default to away team (MUST be before any conditional returns)
  const [selectedTeam, setSelectedTeam] = useState<'away' | 'home'>('away');
  
  // View toggle state - default to stats
  const [activeView, setActiveView] = useState<'stats' | 'props' | 'advanced' | 'propsVsTeams' | 'predictor'>('stats');
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };
  
  // Sortable header component
  const SortableHeader = ({ column, label }: { column: string; label: string }) => {
    const isSorted = sortColumn === column;
    return (
      <th 
        style={{ 
          color: '#FFFFFF', 
          fontSize: isMobile ? '0.65rem' : '0.75rem', 
          textAlign: 'right',
          cursor: 'pointer',
          userSelect: 'none',
          padding: isMobile ? '6px 3px' : '8px 4px'
        }}
        onClick={() => handleSort(column)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
          <span>{label}</span>
          {isSorted && (
            sortDirection === 'asc' ? (
              <ArrowUpward sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', color: '#FFC72C' }} />
            ) : (
              <ArrowDownward sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', color: '#FFC72C' }} />
            )
          )}
        </Box>
      </th>
    );
  };

  // Fetch game data
  const { data: gameData, isLoading: gameLoading } = useQuery<GameData | null>({
    queryKey: ['game-data-full', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      
      // Ensure gameId is a string and trim any whitespace
      const cleanGameId = String(gameId).trim();
      
      console.log('🔍 Fetching game data for gameId:', cleanGameId, 'Type:', typeof cleanGameId);
      
      // Try to fetch the game
      const { data, error } = await supabase
        .from('nba_games')
        .select('game_id, game_status, game_status_text, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_date, arena_name, arena_city')
        .eq('game_id', cleanGameId)
        .maybeSingle();
      
      // If not found, try without leading zeros (in case of format mismatch)
      if (!data && !error && cleanGameId.startsWith('00')) {
        const withoutLeadingZeros = cleanGameId.replace(/^0+/, '');
        console.log('🔍 Game not found, trying without leading zeros:', withoutLeadingZeros);
        const { data: altData, error: altError } = await supabase
          .from('nba_games')
          .select('game_id, game_status, game_status_text, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_date, arena_name, arena_city')
          .eq('game_id', withoutLeadingZeros)
          .maybeSingle();
        
        if (altData && !altError) {
          console.log('✅ Found game with alternative format');
          return {
            ...altData,
            home_team_id: undefined,
            away_team_id: undefined,
          };
        }
      }
      
      if (error) {
        // Log the error but don't throw - return null gracefully
        if (error.code !== 'PGRST116') { // PGRST116 = no rows found
          console.error('Error fetching game data:', error);
        } else {
          console.warn(`Game ${cleanGameId} not found in database (PGRST116)`);
        }
        return null;
      }
      
      if (!data) {
        console.warn(`Game ${cleanGameId} not found in database (no data returned)`);
        return null;
      }
      
      console.log('✅ Game data found:', { game_id: data.game_id, status: data.game_status_text });
      
      // Fetch team IDs separately if needed
      let homeTeamId: number | undefined;
      let awayTeamId: number | undefined;
      
      try {
        const { data: homeTeam } = await supabase
          .from('nba_teams')
          .select('team_id')
          .eq('abbreviation', data.home_team_tricode)
          .maybeSingle();
        
        const { data: awayTeam } = await supabase
          .from('nba_teams')
          .select('team_id')
          .eq('abbreviation', data.away_team_tricode)
          .maybeSingle();
        
        homeTeamId = homeTeam?.team_id;
        awayTeamId = awayTeam?.team_id;
      } catch (teamError) {
        console.warn('Error fetching team IDs:', teamError);
      }
      
      return {
        ...data,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
      };
    },
    enabled: !!gameId,
  });

  // Team analytics: fetch from nba_daily_team_stats table for this game date
  const predictorDateKey = gameData ? dayjs(gameData.game_date).format('YYYY-MM-DD') : null;
  const {
    data: predictorStats,
    isLoading: predictorStatsLoading,
    error: predictorStatsError,
  } = usePredictorStats({
    gameDate: predictorDateKey ?? null,
    homeTricode: gameData?.home_team_tricode ?? null,
    awayTricode: gameData?.away_team_tricode ?? null,
    enabled: !!predictorDateKey && !!gameData?.home_team_tricode && !!gameData?.away_team_tricode && activeView === 'predictor',
  });

  // Determine game state - compute this first so it can be used in enabled conditions
  const gameState = useMemo(() => {
    if (!gameData) return 'loading';
    if (gameData.game_status === 1) return 'upcoming';
    if (gameData.game_status === 2) return 'live';
    return 'completed';
  }, [gameData]);

  // Whether to show the status chip in the header.
  // If the game time is already shown in yellow below the teams (upcoming, 0–0),
  // we hide the chip to avoid showing the time twice.
  const showStatusChip = useMemo(() => {
    if (!gameData?.game_status_text) return false;

    const hasScores =
      gameData.home_team_score !== null && gameData.away_team_score !== null;
    const bothZero =
      hasScores &&
      gameData.home_team_score === 0 &&
      gameData.away_team_score === 0;

    if (gameState === 'upcoming' && (!hasScores || bothZero)) {
      return false;
    }

    return true;
  }, [gameData, gameState]);
  
  // Set default sort column based on gameState and activeView
  useEffect(() => {
    if (!sortColumn && gameState && gameState !== 'loading') {
      if (activeView === 'advanced') {
        setSortColumn('net_rtg');
      } else if (gameState === 'upcoming') {
        setSortColumn('mpg');
      } else {
        setSortColumn('fantasy_points');
      }
    }
  }, [gameState, sortColumn, activeView]);

  // Get current season for rosters - must be called before any conditional logic
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

  // Fetch live stats (for all games - live and completed) - always call this hook
  // Falls back to nba_boxscores if live_player_stats has no data
  const { data: liveStats, isLoading: liveStatsLoading } = useQuery<PlayerStat[]>({
    queryKey: ['live-player-stats-game', gameId],
    queryFn: async () => {
      // First, try to fetch from live_player_stats
      const { data: liveData, error: liveError } = await supabase
        .from('live_player_stats')
        .select('nba_player_id, player_id, player_name, team_tricode, team_id, stats')
        .eq('game_id', gameId)
        .order('team_tricode')
        .order('stats->min', { ascending: false, nullsFirst: false });
      
      if (liveError) {
        console.error('Error fetching live stats:', liveError);
      }
      
      console.log('📊 Raw live_player_stats data:', liveData?.length, liveData);
      
      // If we have data from live_player_stats, process and return it
      if (liveData && liveData.length > 0) {
        if (liveData.length > 0) {
          console.log('📊 Sample player data:', liveData[0]);
          console.log('📊 Stats type:', typeof liveData[0].stats, liveData[0].stats);
        }
        
        // Fetch player positions and team info
        const playerIds = liveData.map(p => p.nba_player_id);
        const teamIds = [...new Set(liveData.map(p => p.team_id).filter(Boolean))];
        let playerPositions: Map<number, string> = new Map();
        let playerTeams: Map<number, string> = new Map();
        let teamIdToTricode: Map<number, string> = new Map();
        
        // Fetch team abbreviations from team_id
        if (teamIds.length > 0) {
          const { data: teamsData } = await supabase
            .from('nba_teams')
            .select('team_id, abbreviation')
            .in('team_id', teamIds);
          
          if (teamsData) {
            teamsData.forEach(t => {
              if (t.abbreviation) {
                teamIdToTricode.set(t.team_id, t.abbreviation);
              }
            });
          }
        }
        
        if (playerIds.length > 0) {
          const { data: playersData } = await supabase
            .from('nba_players')
            .select('nba_player_id, position, team_abbreviation')
            .in('nba_player_id', playerIds);
          
          if (playersData) {
            playersData.forEach(p => {
              if (p.position) {
                playerPositions.set(p.nba_player_id, p.position);
              }
              if (p.team_abbreviation) {
                playerTeams.set(p.nba_player_id, p.team_abbreviation);
              }
            });
          }
        }
        
        return liveData.map((player) => {
          // If team_tricode is null, try to get it from team_id or player's current team
          const teamTricode = player.team_tricode 
            || (player.team_id ? teamIdToTricode.get(player.team_id) : null)
            || playerTeams.get(player.nba_player_id) 
            || null;
          // Parse stats - Supabase JSONB should be auto-parsed, but handle string case
          let stats = player.stats || {};
          if (typeof stats === 'string') {
            try {
              stats = JSON.parse(stats);
            } catch (e) {
              console.error('Error parsing stats JSON:', e, stats);
              stats = {};
            }
          }
          
          // Ensure stats is an object
          if (!stats || typeof stats !== 'object') {
            console.warn('Invalid stats for player:', player.player_name, stats);
            stats = {};
          }
          
          console.log('📊 Processed player:', player.player_name, 'team:', teamTricode, 'stats:', stats);
          
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
          
          // Only use roster (nba_players) for current team — do not fall back to game team_tricode,
          // so traded players are excluded once roster is updated.
          const currentTeam = playerTeams.get(player.nba_player_id) ?? undefined;
          const processedPlayer = {
            ...player,
            team_tricode: teamTricode,
            current_team_tricode: currentTeam,
            stats: stats, // Use parsed stats
            position: playerPositions.get(player.nba_player_id),
            fantasy_points: fantasyPoints,
          };
          
          return processedPlayer;
        });
      }
      
      // Fallback to nba_boxscores if no live_player_stats data
      console.log('📊 No live_player_stats data, falling back to nba_boxscores');
      const { data: boxScoreData, error: boxScoreError } = await supabase
        .from('nba_boxscores')
        .select('*')
        .eq('game_id', gameId)
        .order('team_tricode')
        .order('min', { ascending: false, nullsFirst: false });
      
      if (boxScoreError) {
        console.error('Error fetching box scores:', boxScoreError);
        return [];
      }
      
      if (!boxScoreData || boxScoreData.length === 0) {
        console.log('📊 No box score data found either');
        return [];
      }
      
      console.log('📊 Raw nba_boxscores data:', boxScoreData.length);
      
      // Fetch current team for each player so we only show players still on that team
      const boxScorePlayerIds = [...new Set((boxScoreData || []).map((p: any) => p.nba_player_id).filter(Boolean))];
      const currentTeamByNbaId = new Map<number, string>();
      if (boxScorePlayerIds.length > 0) {
        const { data: playersData } = await supabase
          .from('nba_players')
          .select('nba_player_id, team_abbreviation')
          .in('nba_player_id', boxScorePlayerIds);
        (playersData || []).forEach((p: any) => {
          if (p.team_abbreviation) currentTeamByNbaId.set(p.nba_player_id, p.team_abbreviation);
        });
      }
      
      // Transform nba_boxscores data to match live_player_stats format
      return boxScoreData.map((player) => {
        // Parse minutes (can be string like "37.00" or number)
        const min = typeof player.min === 'string' ? parseFloat(player.min) : (player.min || 0);
        
        // Build stats object from individual columns
        const stats = {
          min: min,
          pts: player.pts || 0,
          fgm: player.fgm || 0,
          fga: player.fga || 0,
          fg_pct: player.fg_pct ? parseFloat(player.fg_pct.toString()) : 0,
          fg3m: player.fg3m || 0,
          fg3a: player.fg3a || 0,
          fg3_pct: player.fg3_pct ? parseFloat(player.fg3_pct.toString()) : 0,
          ftm: player.ftm || 0,
          fta: player.fta || 0,
          ft_pct: player.ft_pct ? parseFloat(player.ft_pct.toString()) : 0,
          oreb: player.oreb || 0,
          dreb: player.dreb || 0,
          reb: player.reb || 0,
          ast: player.ast || 0,
          stl: player.stl || 0,
          blk: player.blk || 0,
          tov: player.tov || 0,
          pf: player.fouls_personal || 0,
          plus_minus: player.plus_minus_points || 0,
        };
        
        const fantasyPoints = FANDUEL_SCORING.calculatePoints({
          pts: stats.pts,
          reb: stats.reb,
          ast: stats.ast,
          stl: stats.stl,
          blk: stats.blk,
          tov: stats.tov,
          fgm: stats.fgm,
          fga: stats.fga,
          fg_pct: stats.fg_pct,
          fg3m: stats.fg3m,
          fg3a: stats.fg3a,
          fg3_pct: stats.fg3_pct,
          ftm: stats.ftm,
          fta: stats.fta,
          ft_pct: stats.ft_pct,
          oreb: stats.oreb,
          dreb: stats.dreb,
          pf: stats.pf,
          min: stats.min,
          plus_minus: stats.plus_minus,
        } as any);
        
        // Only use roster (nba_players) for current team — do not fall back to game team_tricode.
        const currentTeam = currentTeamByNbaId.get(player.nba_player_id) ?? undefined;
        return {
          nba_player_id: player.nba_player_id,
          player_id: player.player_id || null,
          player_name: player.player_name,
          team_tricode: player.team_tricode || null,
          current_team_tricode: currentTeam,
          team_id: player.team_id || null,
          stats: stats,
          position: player.position || null,
          fantasy_points: fantasyPoints,
        };
      });
    },
    enabled: !!gameId && !!gameData,
    refetchInterval: gameData?.game_status === 2 ? 30000 : false, // Refetch every 30 seconds for live games only
  });

  // Fetch feed posts for the game - sorted with fun_score first, then player_spotlight by fantasy points
  const { data: feedPosts, isLoading: feedPostsLoading } = useQuery<FeedPost[]>({
    queryKey: ['feed-posts-game', gameId],
    queryFn: async () => {
      if (!gameId) return [];
      
      const { data, error } = await supabase
        .from('feed_posts')
        .select('*')
        .eq('game_id', gameId)
        .eq('status', 'published')
        .in('post_type', ['fun_score', 'player_spotlight']);
      
      if (error) {
        console.error('Error fetching feed posts:', error);
        return [];
      }
      
      if (!data || data.length === 0) return [];
      
      // Sort posts: fun_score first, then player_spotlight by fantasy points (descending)
      const sortedPosts = [...data].sort((a, b) => {
        // Fun score posts always come first
        if (a.post_type === 'fun_score' && b.post_type !== 'fun_score') return -1;
        if (a.post_type !== 'fun_score' && b.post_type === 'fun_score') return 1;
        
        // If both are fun_score, keep original order (or sort by fun_score if needed)
        if (a.post_type === 'fun_score' && b.post_type === 'fun_score') {
          const funScoreA = typeof a.metadata === 'object' ? (a.metadata?.fun_score || 0) : 0;
          const funScoreB = typeof b.metadata === 'object' ? (b.metadata?.fun_score || 0) : 0;
          return funScoreB - funScoreA; // Higher fun_score first
        }
        
        // Both are player_spotlight - sort by fantasy points (descending)
        if (a.post_type === 'player_spotlight' && b.post_type === 'player_spotlight') {
          const metaA = typeof a.metadata === 'object' ? a.metadata : (typeof a.metadata === 'string' ? JSON.parse(a.metadata) : {});
          const metaB = typeof b.metadata === 'object' ? b.metadata : (typeof b.metadata === 'string' ? JSON.parse(b.metadata) : {});
          const fpA = metaA?.fantasyPoints || 0;
          const fpB = metaB?.fantasyPoints || 0;
          return fpB - fpA; // Higher fantasy points first
        }
        
        return 0;
      });
      
      return sortedPosts as FeedPost[];
    },
    enabled: !!gameId,
  });
  

  // Fetch box scores (for completed games) - always call this hook
  const { data: boxScores, isLoading: boxScoresLoading } = useQuery<BoxScorePlayer[]>({
    queryKey: ['boxscores-game', gameId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('nba_player_id, player_id, player_name, team_tricode, pts, reb, ast, stl, blk, tov, fgm, fga, fg3m, fg3a, ftm, fta, min, plus_minus_points')
        .eq('game_id', gameId)
        .order('team_tricode')
        .order('min', { ascending: false });
      
      if (error) {
        console.error('Error fetching box scores:', error);
        return [];
      }
      
      return (data || []).map((player) => {
        const fantasyPoints = FANDUEL_SCORING.calculatePoints({
          pts: player.pts || 0,
          reb: player.reb || 0,
          ast: player.ast || 0,
          stl: player.stl || 0,
          blk: player.blk || 0,
          tov: player.tov || 0,
          fgm: player.fgm || 0,
          fga: player.fga || 0,
          fg_pct: player.fga > 0 ? (player.fgm / player.fga) : 0,
          fg3m: player.fg3m || 0,
          fg3a: player.fg3a || 0,
          fg3_pct: player.fg3a > 0 ? (player.fg3m / player.fg3a) : 0,
          ftm: player.ftm || 0,
          fta: player.fta || 0,
          ft_pct: player.fta > 0 ? (player.ftm / player.fta) : 0,
          oreb: 0,
          dreb: 0,
          pf: 0,
          min: player.min || 0,
          plus_minus: player.plus_minus_points || 0,
        } as any);
        
        return {
          ...player,
          plus_minus: player.plus_minus_points || 0,
          fantasy_points: fantasyPoints,
        };
      });
    },
    enabled: !!gameId && !!gameData && gameData?.game_status === 3,
  });

  // Fetch player props: match by nba_game_id, or fallback by team tricodes + game_date (try multiple dates)
  const { data: playerProps, isLoading: propsLoading } = useQuery<PlayerProp[]>({
    queryKey: ['player-props-game', gameId, gameData?.game_date, gameData?.home_team_tricode, gameData?.away_team_tricode],
    queryFn: async () => {
      if (!gameData?.game_date) {
        console.log('[Props] queryFn skipped: no gameData.game_date', { gameData: !!gameData, game_date: gameData?.game_date });
        return [];
      }
      
      const rawDate = gameData.game_date;
      const gameDate = typeof rawDate === 'string' ? rawDate.split('T')[0] : String(rawDate).split('T')[0];
      const homeTricode = (gameData.home_team_tricode || '').trim().toUpperCase();
      const awayTricode = (gameData.away_team_tricode || '').trim().toUpperCase();
      
      const normalize = (s: string) => (s || '').trim().toUpperCase();
      const matchTeams = (h: string | null, a: string | null) =>
        h && a && (normalize(h) === homeTricode && normalize(a) === awayTricode) || (normalize(h) === awayTricode && normalize(a) === homeTricode);
      
      console.log('[Props] 🔍 Fetching player props for game:', { gameId, gameDate, homeTricode, awayTricode });
      
      let propsGame: { id: string } | null = null;
      
      // Step 1a: Try by nba_game_id if we have it (exact date)
      if (gameId) {
        const { data, error } = await supabase
          .from('player_props_games')
          .select('id, nba_game_id, game_date')
          .eq('nba_game_id', String(gameId))
          .eq('game_date', gameDate)
          .maybeSingle();
        console.log('[Props] Step 1a nba_game_id lookup:', { gameId, gameDate, found: !!data?.id, error: error?.message, data });
        if (!error && data?.id) {
          propsGame = data;
          console.log('[Props] ✅ Found player_props_games by nba_game_id:', propsGame.id);
        }
      }
      
      // Step 1b: Fallback – fetch candidates by date range (game_date can be off by 1 day due to timezone)
      if (!propsGame?.id && homeTricode && awayTricode) {
        const datesToTry = [gameDate];
        try {
          const d = new Date(gameDate);
          const prev = new Date(d); prev.setDate(prev.getDate() - 1);
          const next = new Date(d); next.setDate(next.getDate() + 1);
          datesToTry.push(prev.toISOString().split('T')[0], next.toISOString().split('T')[0]);
        } catch (_) {}
        console.log('[Props] Step 1b trying dates:', [...new Set(datesToTry)], 'looking for', { homeTricode, awayTricode });
        for (const d of [...new Set(datesToTry)]) {
          const { data: rows, error: err } = await supabase
            .from('player_props_games')
            .select('id, game_date, home_team_tricode, away_team_tricode, home_team, away_team')
            .eq('game_date', d)
            .limit(20);
          const candidates = (rows || []).map((r: any) => ({ id: r.id, game_date: r.game_date, home_team_tricode: r.home_team_tricode, away_team_tricode: r.away_team_tricode, home_team: r.home_team, away_team: r.away_team }));
          console.log('[Props] Step 1b player_props_games for date', d, ':', { rowCount: candidates.length, error: err?.message, rows: candidates });
          if (err || !rows?.length) continue;
          // Match by tricode (exact after normalize)
          let found = rows.find((r: any) => matchTeams(r.home_team_tricode, r.away_team_tricode));
          // Fallback: match by full team names (e.g. "Orlando Magic" contains ORL city, "Toronto Raptors" contains TOR city)
          const cityToTricode: Record<string, string> = { ORL: 'orlando', TOR: 'toronto', LAL: 'lakers', BOS: 'celtics', GSW: 'golden state', MIA: 'miami', PHX: 'phoenix', DEN: 'denver', MIL: 'milwaukee', PHI: 'philadelphia', DAL: 'dallas', BKN: 'brooklyn', NYK: 'new york', CHI: 'chicago', CLE: 'cleveland', IND: 'indiana', ATL: 'atlanta', WAS: 'washington', CHO: 'charlotte', DET: 'detroit', HOU: 'houston', SAS: 'san antonio', MEM: 'memphis', NOP: 'new orleans', MIN: 'minnesota', OKC: 'oklahoma', POR: 'portland', SAC: 'sacramento', UTA: 'utah' };
          if (!found?.id && rows.length > 0) {
            const homeKey = cityToTricode[homeTricode] || homeTricode.toLowerCase();
            const awayKey = cityToTricode[awayTricode] || awayTricode.toLowerCase();
            found = rows.find((r: any) => {
              const h = (r.home_team || '').toLowerCase();
              const a = (r.away_team || '').toLowerCase();
              const match1 = h.includes(homeKey) && a.includes(awayKey);
              const match2 = h.includes(awayKey) && a.includes(homeKey);
              return match1 || match2;
            }) || null;
            if (found?.id) console.log('[Props] ✅ Matched by full team name fallback:', found.home_team, found.away_team);
          }
          if (found?.id) {
            propsGame = { id: found.id };
            console.log('[Props] ✅ Found player_props_games by teams+date:', found.game_date, found.home_team_tricode ?? found.home_team, found.away_team_tricode ?? found.away_team, propsGame.id);
            break;
          }
        }
      }
      
      if (!propsGame?.id) {
        console.log('[Props] ⚠️ No player_props_games found (tried nba_game_id and team tricodes + date range). gameData.game_date=', gameData.game_date);
        return [];
      }
      
      // Step 2: Query all props where game_id matches the player_props_games.id (UUID); full-game only
      const { data: allPropsRaw, error: propsError } = await supabase
        .from('player_props')
        .select('id, bet_type, line, price, american_odds, bookmaker, player_name, nba_player_id, player_id, bet_type_id, raw_odd_data')
        .eq('game_id', propsGame.id)
        .order('player_name')
        .order('bet_type')
        .limit(10000);

      const allProps = filterFullGameProps(allPropsRaw ?? []);

      console.log('[Props] Step 2 player_props by game_id (UUID):', { propsGameId: propsGame.id, count: allProps?.length ?? 0, error: propsError?.message });
      if (propsError) {
        console.error('[Props] ❌ Error fetching player props:', propsError);
        return [];
      }

      console.log('[Props] ✅ Fetched', allProps?.length || 0, 'full-game props for game_id:', propsGame.id);
      return allProps || [];
    },
    enabled: !!gameData && !!gameData?.game_date,
  });

  // Fetch home team roster (for upcoming games) - always call this hook
  const { data: homeRoster, isLoading: homeRosterLoading } = useQuery<RosterPlayer[]>({
    queryKey: ['team-roster', gameData?.home_team_id, currentSeason],
    queryFn: async () => {
      if (!gameData?.home_team_id || !currentSeason) return [];
      
      const { data, error } = await supabase
        .from('nba_team_roster')
        .select('id, player_id, nba_player_id, player_name, position, jersey_number')
        .eq('team_id', gameData.home_team_id)
        .eq('season', currentSeason)
        .order('jersey_number', { ascending: true });
      
      if (error) {
        console.error('Error fetching home roster:', error);
        return [];
      }
      
      return (data || []).map((player: any) => ({
        ...player,
        team_abbreviation: gameData?.home_team_tricode || '',
      }));
    },
    enabled: !!gameData && !!gameData?.home_team_id && !!currentSeason && gameData?.game_status === 1,
  });

  // Fetch away team roster (for upcoming games) - always call this hook
  const { data: awayRoster, isLoading: awayRosterLoading } = useQuery<RosterPlayer[]>({
    queryKey: ['team-roster', gameData?.away_team_id, currentSeason],
    queryFn: async () => {
      if (!gameData?.away_team_id || !currentSeason) return [];
      
      const { data, error } = await supabase
        .from('nba_team_roster')
        .select('id, player_id, nba_player_id, player_name, position, jersey_number')
        .eq('team_id', gameData.away_team_id)
        .eq('season', currentSeason)
        .order('jersey_number', { ascending: true });
      
      if (error) {
        console.error('Error fetching away roster:', error);
        return [];
      }
      
      return (data || []).map((player: any) => ({
        ...player,
        team_abbreviation: gameData?.away_team_tricode || '',
      }));
    },
    enabled: !!gameData && !!gameData?.away_team_id && !!currentSeason && gameData?.game_status === 1,
  });

  // Calculate prop results for completed games - MUST be called before any returns
  const propResults = useMemo(() => {
    if (gameState !== 'completed' || !liveStats || !playerProps) return new Map();
    
    const results = new Map<string, Array<{ prop: PlayerProp; result: any }>>();
    
    liveStats.forEach((player) => {
      const stats = player.stats || {};
      const playerPropsForPlayer = playerProps.filter(
        p => p.nba_player_id === player.nba_player_id || 
        (p.player_id && p.player_id === player.player_id)
      );
      
      if (playerPropsForPlayer.length > 0) {
        const propResultsForPlayer = playerPropsForPlayer.map(prop => {
          const result = calculatePropResult(prop.bet_type, prop.line, {
            pts: stats.pts || 0,
            reb: stats.reb || 0,
            ast: stats.ast || 0,
            stl: stats.stl || 0,
            blk: stats.blk || 0,
            tov: stats.tov || 0,
            fg3m: stats.fg3m || 0,
            ftm: stats.ftm || 0,
          });
          
          return { prop, result };
        }).filter(item => item.result !== null);
        
        if (propResultsForPlayer.length > 0) {
          results.set(player.player_name, propResultsForPlayer);
        }
      }
    });
    
    return results;
  }, [liveStats, playerProps, gameState]);

  // Get current team data based on selection (must be before queries that use them)
  const currentTeamTricode = gameData ? (selectedTeam === 'away' 
    ? gameData?.away_team_tricode 
    : gameData?.home_team_tricode) : null;
  const opponentTeamTricode = gameData ? (selectedTeam === 'away' 
    ? gameData?.home_team_tricode 
    : gameData?.away_team_tricode) : null;
  const currentRoster = selectedTeam === 'away' ? awayRoster : homeRoster;
  const normalizeTricode = (s: string | null | undefined) => (s ?? '').toString().trim().toUpperCase();

  // First tab (basic stats) must use the same source of truth as advanced stats: nba_players.team_abbreviation.
  // Fetch current team from DB for game's players so we filter out traded players even if liveStats merge was stale.
  const { data: currentTeamNbaPlayerIds } = useQuery<Set<number>>({
    queryKey: ['game-current-team-player-ids', gameId, currentTeamTricode, liveStats?.length],
    queryFn: async () => {
      if (!currentTeamTricode || !liveStats?.length) return new Set<number>();
      const nbaPlayerIds = [...new Set((liveStats || []).map((p: any) => p.nba_player_id).filter(Boolean))];
      if (nbaPlayerIds.length === 0) return new Set<number>();
      const { data: rows } = await supabase
        .from('nba_players')
        .select('nba_player_id, team_abbreviation')
        .in('nba_player_id', nbaPlayerIds);
      const target = normalizeTricode(currentTeamTricode);
      const set = new Set<number>();
      (rows || []).forEach((r: any) => {
        if (r.nba_player_id != null && normalizeTricode(r.team_abbreviation) === target) set.add(r.nba_player_id);
      });
      return set;
    },
    enabled: !!currentTeamTricode && !!liveStats && liveStats.length > 0,
  });

  // For upcoming games, also derive the set of CURRENT active players for this team
  // from nba_players.team_abbreviation/is_active so the Stats tab never shows
  // players who have been traded away or are no longer on this team.
  const { data: upcomingTeamNbaPlayerIds } = useQuery<Set<number>>({
    queryKey: ['game-upcoming-team-player-ids', currentTeamTricode, currentSeason],
    queryFn: async () => {
      if (!currentTeamTricode || !currentSeason) return new Set<number>();
      const { data: rows, error } = await supabase
        .from('nba_players')
        .select('nba_player_id, team_abbreviation, is_active')
        .eq('team_abbreviation', currentTeamTricode)
        .eq('is_active', true);
      if (error) {
        console.error('❌ Error fetching upcoming team player ids:', error);
        return new Set<number>();
      }
      const set = new Set<number>();
      (rows || []).forEach((r: any) => {
        if (r.nba_player_id != null) set.add(r.nba_player_id);
      });
      return set;
    },
    enabled: gameState === 'upcoming' && !!currentTeamTricode,
  });

  // Only show players who are currently on this team (exclude traded players).
  // Use nba_players-based set when available (same as advanced tab); otherwise fall back to current_team_tricode/team_tricode.
  const currentTeamStats = (liveStats || []).filter(player => {
    if (currentTeamNbaPlayerIds != null && currentTeamNbaPlayerIds.size > 0) {
      return player.nba_player_id != null && currentTeamNbaPlayerIds.has(player.nba_player_id);
    }
    const fromRoster = (player as any).current_team_tricode;
    const effectiveTeam = fromRoster ?? player.team_tricode;
    return normalizeTricode(effectiveTeam) === normalizeTricode(currentTeamTricode);
  });

  // Match unmatched player names using the player name matcher utility
  const { data: playerNameMatches } = useQuery({
    queryKey: ['player-name-matches-for-props', playerProps?.length, currentTeamTricode],
    queryFn: async () => {
      if (!playerProps || playerProps.length === 0) {
        return new Map();
      }
      
      // Get unique unmatched player names (those without player_id)
      const unmatchedNames = [...new Set(
        playerProps
          .filter((p: any) => !p.player_id && p.player_name)
          .map((p: any) => p.player_name)
      )];
      
      if (unmatchedNames.length === 0) {
        return new Map();
      }
      
      console.log('🔍 Matching', unmatchedNames.length, 'unmatched player names...');
      
      // Match all unmatched names with team context
      const matches = await matchPlayerNames(supabase, unmatchedNames, {
        teamTricode: currentTeamTricode || undefined
      });
      
      console.log('✅ Matched', Array.from(matches.values()).filter(m => m !== null).length, 'out of', unmatchedNames.length, 'players');
      
      return matches;
    },
    enabled: !!playerProps && playerProps.length > 0,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Filter props by current team - show ALL players with props, not just those in roster
  // This uses a separate query to get player teams for filtering, including matched players
  const { data: playerTeamsMap } = useQuery<Map<string, string>>({
    queryKey: ['player-teams-for-props', playerProps?.length, currentTeamTricode, playerNameMatches?.size],
    queryFn: async () => {
      if (!playerProps || playerProps.length === 0 || !currentTeamTricode) {
        console.log('⚠️ Cannot build player teams map: missing playerProps or currentTeamTricode');
        return new Map();
      }
      
      // Get unique player_ids AND nba_player_ids from props
      const uniquePlayerIds = [...new Set(playerProps.map((p: any) => p.player_id).filter(Boolean))];
      const uniqueNbaPlayerIds = [...new Set(playerProps.map((p: any) => p.nba_player_id).filter(Boolean))];
      
      // Also include matched player IDs from player name matcher
      if (playerNameMatches) {
        playerNameMatches.forEach((match) => {
          if (match) {
            if (match.player_id && !uniquePlayerIds.includes(match.player_id)) {
              uniquePlayerIds.push(match.player_id);
            }
            if (match.nba_player_id && !uniqueNbaPlayerIds.includes(match.nba_player_id)) {
              uniqueNbaPlayerIds.push(match.nba_player_id);
            }
          }
        });
      }
      
      console.log('📊 Building player teams map:', {
        totalProps: playerProps.length,
        uniquePlayerIds: uniquePlayerIds.length,
        uniqueNbaPlayerIds: uniqueNbaPlayerIds.length,
        matchedPlayers: playerNameMatches?.size || 0
      });
      
      const map = new Map<string, string>();
      
      // Try to get teams by player_id first
      if (uniquePlayerIds.length > 0) {
        const { data: playersData, error: playersError } = await supabase
          .from('nba_players')
          .select('id, team_abbreviation')
          .in('id', uniquePlayerIds)
          .limit(200);
        
        if (playersError) {
          console.error('❌ Error fetching players by player_id:', playersError);
        } else if (playersData) {
          console.log('✅ Found', playersData.length, 'players by player_id');
          playersData.forEach((p: any) => {
            if (p.id && p.team_abbreviation) {
              map.set(p.id, p.team_abbreviation);
            }
          });
        }
      }
      
      // Also try to get teams by nba_player_id for props that don't have player_id
      if (uniqueNbaPlayerIds.length > 0) {
        const { data: playersByNbaId, error: nbaIdError } = await supabase
          .from('nba_players')
          .select('nba_player_id, team_abbreviation')
          .in('nba_player_id', uniqueNbaPlayerIds)
          .limit(200);
        
        if (nbaIdError) {
          console.error('❌ Error fetching players by nba_player_id:', nbaIdError);
        } else if (playersByNbaId) {
          console.log('✅ Found', playersByNbaId.length, 'players by nba_player_id');
          playersByNbaId.forEach((p: any) => {
            if (p.nba_player_id && p.team_abbreviation) {
              // Map by nba_player_id as well
              map.set(`nba_${p.nba_player_id}`, p.team_abbreviation);
            }
          });
        }
      }
      
      // Also add matched players' teams by player_id, nba_player_id, and by name (for props with null ids)
      if (playerNameMatches) {
        playerNameMatches.forEach((match, playerName) => {
          if (match && match.team_abbreviation) {
            if (match.player_id) {
              map.set(match.player_id, match.team_abbreviation);
            }
            if (match.nba_player_id) {
              map.set(`nba_${match.nba_player_id}`, match.team_abbreviation);
            }
            if (playerName) {
              map.set(`name_${playerName}`, match.team_abbreviation);
            }
          }
        });
      }
      
      // Fallback: for unique prop player names that have no match, try direct nba_players lookup by name
      const namesWithoutTeam = [...new Set(playerProps.map((p: any) => p.player_name).filter(Boolean))].filter(
        (name) => !map.has(`name_${name}`) && (!playerNameMatches || !playerNameMatches.get(name))
      );
      if (namesWithoutTeam.length > 0) {
        for (const name of namesWithoutTeam.slice(0, 50)) {
          const { data: playersByName } = await supabase
            .from('nba_players')
            .select('name, team_abbreviation')
            .ilike('name', name)
            .limit(1);
          if (playersByName?.[0]?.team_abbreviation) {
            map.set(`name_${name}`, playersByName[0].team_abbreviation);
          }
        }
      }
      
      console.log('📊 Player teams map size:', map.size, 'out of', uniquePlayerIds.length + uniqueNbaPlayerIds.length, 'unique players');
      console.log('📊 Sample mapped players:', Array.from(map.entries()).slice(0, 5));
      return map;
    },
    enabled: !!playerProps && playerProps.length > 0 && !!currentTeamTricode,
  });

  // Filter props to current team - show ALL players with props for this team
  // Use matched player info to enhance props and improve team filtering
  const teamProps = useMemo(() => {
    if (!playerProps || !currentTeamTricode) {
      return playerProps || [];
    }
    
    // Enhance props with matched player info
    const enhancedProps = playerProps.map((prop: any) => {
      // If prop already has player_id, use it as-is
      if (prop.player_id && prop.nba_player_id) {
        return prop;
      }
      
      // Try to match using player name matcher
      if (prop.player_name && playerNameMatches) {
        const match = playerNameMatches.get(prop.player_name);
        if (match) {
          return {
            ...prop,
            player_id: match.player_id,
            nba_player_id: match.nba_player_id,
            matched_team: match.team_abbreviation
          };
        }
      }
      
      return prop;
    });
    
    // If we don't have team mapping yet, return all props (better to show too many than too few)
    if (!playerTeamsMap || playerTeamsMap.size === 0) {
      console.log('⚠️ No player teams map available, showing all props');
      return enhancedProps;
    }
    
    const filtered = enhancedProps.filter((prop: any) => {
      let foundTeam: string | undefined = undefined;
      
      // Try to match by player_id first
      if (prop.player_id) {
        foundTeam = playerTeamsMap.get(prop.player_id);
      }
      
      // Fallback: try to match by nba_player_id if we didn't find a team
      if (!foundTeam && prop.nba_player_id) {
        foundTeam = playerTeamsMap.get(`nba_${prop.nba_player_id}`);
      }
      
      // Use matched team from player name matcher if available
      if (!foundTeam && prop.matched_team) {
        foundTeam = prop.matched_team;
      }
      
      // Fallback: lookup by player name (for props with null player_id/nba_player_id)
      if (!foundTeam && prop.player_name && playerTeamsMap) {
        foundTeam = playerTeamsMap.get(`name_${prop.player_name}`);
      }
      
      // If we found a team, check if it matches
      if (foundTeam) {
        return foundTeam === currentTeamTricode;
      }
      
      // If we can't determine the team, exclude it (prevents players from showing on both teams)
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Could not determine team for prop:', prop.player_name, 'player_id:', prop.player_id, 'nba_player_id:', prop.nba_player_id);
      }
      return false;
    });
    
    console.log('✅ Filtered props by team:', filtered.length, 'out of', enhancedProps.length, 'for team:', currentTeamTricode);
    console.log('📊 Unique players in filtered props:', [...new Set(filtered.map((p: any) => p.player_name))].length);
    return filtered;
  }, [playerProps, currentTeamTricode, playerTeamsMap, playerNameMatches]);

  // Fetch player stats for upcoming games - sorted by minutes played (descending)
  // MUST be called before any conditional returns
  const { data: upcomingPlayerStats, isLoading: upcomingStatsLoading } = useQuery({
    queryKey: ['upcoming-player-stats', currentTeamTricode, currentSeason, selectedTeam],
    queryFn: async () => {
      if (!currentTeamTricode || !currentSeason || gameState !== 'upcoming') return [];
      
      // Get player IDs from current roster
      const roster = currentRoster || [];
      const playerIds = roster
        .map((p: any) => p.player_id || (p.nba_player_id ? String(p.nba_player_id) : null))
        .filter(Boolean) as string[];
      
      if (playerIds.length === 0) return [];
      
      // Fetch stats from nba_boxscores for current season
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('player_id, nba_player_id, player_name, team_tricode, min, pts, reb, ast, stl, blk, fgm, fga, fg3m, fg3a, ftm, fta')
        .in('player_id', playerIds)
        .eq('season_year', currentSeason)
        .gt('min', 0)
        .order('min', { ascending: false });
      
      if (error) {
        console.error('Error fetching upcoming player stats:', error);
        return [];
      }
      
      // Calculate averages and sort by minutes played (descending)
      const statsMap = new Map<string, { 
        player_id: string; 
        nba_player_id: number; 
        player_name: string; 
        team_tricode: string; 
        min: number; 
        pts: number; 
        reb: number; 
        ast: number; 
        stl: number;
        blk: number;
        fgm: number;
        fga: number;
        fg3m: number;
        fg3a: number;
        ftm: number;
        fta: number;
        games: number;
      }>();
      
      (data || []).forEach((game: any) => {
        const key = game.player_id || String(game.nba_player_id);
        const existing = statsMap.get(key);
        const min = typeof game.min === 'string' ? parseFloat(game.min) : (game.min || 0);
        
        if (existing) {
          existing.min += min;
          existing.pts += game.pts || 0;
          existing.reb += game.reb || 0;
          existing.ast += game.ast || 0;
          existing.stl += game.stl || 0;
          existing.blk += game.blk || 0;
          existing.fgm += game.fgm || 0;
          existing.fga += game.fga || 0;
          existing.fg3m += game.fg3m || 0;
          existing.fg3a += game.fg3a || 0;
          existing.ftm += game.ftm || 0;
          existing.fta += game.fta || 0;
          existing.games += 1;
        } else {
          statsMap.set(key, {
            player_id: game.player_id || '',
            nba_player_id: game.nba_player_id,
            player_name: game.player_name,
            team_tricode: game.team_tricode || '',
            min: min,
            pts: game.pts || 0,
            reb: game.reb || 0,
            ast: game.ast || 0,
            stl: game.stl || 0,
            blk: game.blk || 0,
            fgm: game.fgm || 0,
            fga: game.fga || 0,
            fg3m: game.fg3m || 0,
            fg3a: game.fg3a || 0,
            ftm: game.ftm || 0,
            fta: game.fta || 0,
            games: 1,
          });
        }
      });
      
      // Convert to array and calculate averages, then sort by total minutes (descending)
      // Also filter by team_tricode to ensure we only show players from the current team
      return Array.from(statsMap.values())
        .filter(player => player.team_tricode === currentTeamTricode)
        .map(player => ({
          ...player,
          ppg: player.games > 0 ? player.pts / player.games : 0,
          rpg: player.games > 0 ? player.reb / player.games : 0,
          apg: player.games > 0 ? player.ast / player.games : 0,
          mpg: player.games > 0 ? player.min / player.games : 0,
          spg: player.games > 0 ? player.stl / player.games : 0,
          bpg: player.games > 0 ? player.blk / player.games : 0,
          fg_pct: player.fga > 0 ? player.fgm / player.fga : 0,
          fg3_pct: player.fg3a > 0 ? player.fg3m / player.fg3a : 0,
          ft_pct: player.fta > 0 ? player.ftm / player.fta : 0,
        }))
        .sort((a, b) => b.min - a.min); // Sort by total minutes played (descending)
    },
    enabled: gameState === 'upcoming' && !!currentTeamTricode && !!currentSeason && !!currentRoster,
  });

  // Fetch injuries for roster players (for upcoming games)
  const { data: playerInjuries } = useQuery<Map<number, any>>({
    queryKey: ['player-injuries-game', currentRoster?.length, gameData?.game_date],
    queryFn: async () => {
      if (!currentRoster || currentRoster.length === 0 || gameState !== 'upcoming') {
        return new Map();
      }
      
      // Get all nba_player_ids from roster
      const nbaPlayerIds = currentRoster
        .map((p: any) => p.nba_player_id)
        .filter((id: any) => id != null) as number[];
      
      if (nbaPlayerIds.length === 0) return new Map();
      
      // Fetch current injuries for these players
      const { data, error } = await supabase
        .from('nba_injuries')
        .select('*')
        .in('nba_player_id', nbaPlayerIds)
        .eq('is_current', true)
        .in('injury_status', ['Out', 'Questionable', 'Day-to-Day'])
        .order('date_updated', { ascending: false });
      
      if (error) {
        console.error('Error fetching player injuries:', error);
        return new Map();
      }
      
      // Create a map of nba_player_id -> latest injury
      const injuriesMap = new Map<number, any>();
      if (data) {
        data.forEach((injury: any) => {
          if (!injuriesMap.has(injury.nba_player_id)) {
            injuriesMap.set(injury.nba_player_id, injury);
          }
        });
      }
      
      return injuriesMap;
    },
    enabled: gameState === 'upcoming' && !!currentRoster && currentRoster.length > 0,
  });

  // Fetch advanced stats for the current game/team
  const { data: advancedStats, isLoading: advancedStatsLoading } = useQuery({
    queryKey: ['advanced-stats-game', gameId, currentTeamTricode, currentSeason, selectedTeam, gameState],
    queryFn: async () => {
      if (!currentTeamTricode || !currentSeason || !gameId) return [];
      
      // Get player IDs based on game state
      let playerIds: string[] = [];
      
      if (gameState === 'upcoming') {
        // For upcoming games, use roster
        const roster = currentRoster || [];
        playerIds = roster
          .map((p: any) => p.player_id)
          .filter(Boolean) as string[];
      } else {
        // For live/completed games, get player IDs from liveStats (only players currently on this team)
        const norm = (s: string | null | undefined) => (s ?? '').toString().trim().toUpperCase();
        const teamStats = (liveStats || []).filter((p: any) => {
          const effectiveTeam = p.current_team_tricode ?? p.team_tricode;
          return norm(effectiveTeam) === norm(currentTeamTricode);
        });
        
        // Try to use player_id directly from liveStats
        const directPlayerIds = teamStats
          .map((p: any) => p.player_id)
          .filter(Boolean) as string[];
        
        if (directPlayerIds.length > 0) {
          playerIds = [...new Set(directPlayerIds)];
        } else {
          // Fallback: map nba_player_id to player_id
          const nbaPlayerIds = [...new Set(teamStats.map((p: any) => p.nba_player_id).filter(Boolean))];
          
          if (nbaPlayerIds.length > 0) {
            const { data: players } = await supabase
              .from('nba_players')
              .select('id, nba_player_id')
              .in('nba_player_id', nbaPlayerIds);
            
            if (players && players.length > 0) {
              playerIds = players.map((p: any) => p.id).filter(Boolean) as string[];
            }
          }
        }
      }
      
      if (playerIds.length === 0) {
        return [];
      }
      
      // For live/completed games, fetch stats for this specific game
      // For upcoming games, calculate season averages
      if (gameState === 'live' || gameState === 'completed') {
        const { data, error } = await supabase
          .from('nba_player_game_stats')
          .select(`
            player_id,
            advanced_playerefficiencyrating,
            advanced_offensiverating,
            advanced_defensiverating,
            advanced_netrating,
            advanced_trueshootingpercentage,
            advanced_usagepercentage,
            advanced_assistratio,
            advanced_reboundpercentage,
            fourfactors_effectivefieldgoalpercentage,
            fourfactors_turnoverpercentage,
            nba_players!inner(nba_player_id, name, team_abbreviation)
          `)
          .eq('game_id', gameId)
          .in('player_id', playerIds);
        
        if (error) {
          console.error('❌ Error fetching advanced stats:', error);
          return [];
        }
        
        // Helper function to parse numeric values (handles strings and nulls)
        const parseStat = (value: any): number | null => {
          if (value === null || value === undefined) return null;
          const parsed = typeof value === 'string' ? parseFloat(value) : value;
          return isNaN(parsed) ? null : parsed;
        };
        
        // Get player names and filter by team
        return (data || [])
          .map((stat: any) => {
            const player = stat.nba_players;
            if (!player || player.team_abbreviation !== currentTeamTricode) return null;
            
            const parsedStats = {
              per: parseStat(stat.advanced_playerefficiencyrating),
              off_rtg: parseStat(stat.advanced_offensiverating),
              def_rtg: parseStat(stat.advanced_defensiverating),
              net_rtg: parseStat(stat.advanced_netrating),
              ts_pct: parseStat(stat.advanced_trueshootingpercentage),
              usg_pct: parseStat(stat.advanced_usagepercentage),
              ast_ratio: parseStat(stat.advanced_assistratio),
              reb_pct: parseStat(stat.advanced_reboundpercentage),
              efg_pct: parseStat(stat.fourfactors_effectivefieldgoalpercentage),
              tov_pct: parseStat(stat.fourfactors_turnoverpercentage),
            };
            
            // Only include players with at least one meaningful stat
            const hasValidStats = Object.values(parsedStats).some(v => v !== null && v !== 0);
            if (!hasValidStats) return null;
            
            return {
              player_id: stat.player_id,
              nba_player_id: player.nba_player_id,
              player_name: player.name,
              team_tricode: player.team_abbreviation,
              ...parsedStats,
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => {
            // Sort by net_rtg if available, otherwise off_rtg, otherwise per
            const aVal = a.net_rtg ?? a.off_rtg ?? a.per ?? 0;
            const bVal = b.net_rtg ?? b.off_rtg ?? b.per ?? 0;
            return bVal - aVal;
          });
      } else {
        // For upcoming games, calculate season averages
        const { data, error } = await supabase
          .from('nba_player_game_stats')
          .select(`
            player_id,
            advanced_playerefficiencyrating,
            advanced_offensiverating,
            advanced_defensiverating,
            advanced_netrating,
            advanced_trueshootingpercentage,
            advanced_usagepercentage,
            advanced_assistratio,
            advanced_reboundpercentage,
            fourfactors_effectivefieldgoalpercentage,
            fourfactors_turnoverpercentage
          `)
          .in('player_id', playerIds)
          .eq('season_year', currentSeason);
        
        if (error) {
          console.error('❌ Error fetching advanced stats:', error);
          return [];
        }
        
        // Helper function to parse numeric values (handles strings and nulls)
        const parseStat = (value: any): number | null => {
          if (value === null || value === undefined) return null;
          const parsed = typeof value === 'string' ? parseFloat(value) : value;
          return isNaN(parsed) ? null : parsed;
        };
        
        // Calculate averages - only count games with valid stats
        const statsMap = new Map<string, any>();
        
        (data || []).forEach((game: any) => {
          const key = game.player_id;
          const existing = statsMap.get(key);
          
          // Parse all stats
          const per = parseStat(game.advanced_playerefficiencyrating);
          const off_rtg = parseStat(game.advanced_offensiverating);
          const def_rtg = parseStat(game.advanced_defensiverating);
          const net_rtg = parseStat(game.advanced_netrating);
          const ts_pct = parseStat(game.advanced_trueshootingpercentage);
          const usg_pct = parseStat(game.advanced_usagepercentage);
          const ast_ratio = parseStat(game.advanced_assistratio);
          const reb_pct = parseStat(game.advanced_reboundpercentage);
          const efg_pct = parseStat(game.fourfactors_effectivefieldgoalpercentage);
          const tov_pct = parseStat(game.fourfactors_turnoverpercentage);
          
          // Only count games with at least one valid stat
          const hasValidStats = [per, off_rtg, def_rtg, net_rtg, ts_pct, usg_pct, ast_ratio, reb_pct, efg_pct, tov_pct]
            .some(v => v !== null && v !== 0);
          
          if (!hasValidStats) return; // Skip games with no valid stats
          
          if (existing) {
            existing.games += 1;
            if (per !== null) { existing.per_sum += per; existing.per_count += 1; }
            if (off_rtg !== null) { existing.off_rtg_sum += off_rtg; existing.off_rtg_count += 1; }
            if (def_rtg !== null) { existing.def_rtg_sum += def_rtg; existing.def_rtg_count += 1; }
            if (net_rtg !== null) { existing.net_rtg_sum += net_rtg; existing.net_rtg_count += 1; }
            if (ts_pct !== null) { existing.ts_pct_sum += ts_pct; existing.ts_pct_count += 1; }
            if (usg_pct !== null) { existing.usg_pct_sum += usg_pct; existing.usg_pct_count += 1; }
            if (ast_ratio !== null) { existing.ast_ratio_sum += ast_ratio; existing.ast_ratio_count += 1; }
            if (reb_pct !== null) { existing.reb_pct_sum += reb_pct; existing.reb_pct_count += 1; }
            if (efg_pct !== null) { existing.efg_pct_sum += efg_pct; existing.efg_pct_count += 1; }
            if (tov_pct !== null) { existing.tov_pct_sum += tov_pct; existing.tov_pct_count += 1; }
          } else {
            statsMap.set(key, {
              player_id: game.player_id,
              games: 1,
              per_sum: per ?? 0, per_count: per !== null ? 1 : 0,
              off_rtg_sum: off_rtg ?? 0, off_rtg_count: off_rtg !== null ? 1 : 0,
              def_rtg_sum: def_rtg ?? 0, def_rtg_count: def_rtg !== null ? 1 : 0,
              net_rtg_sum: net_rtg ?? 0, net_rtg_count: net_rtg !== null ? 1 : 0,
              ts_pct_sum: ts_pct ?? 0, ts_pct_count: ts_pct !== null ? 1 : 0,
              usg_pct_sum: usg_pct ?? 0, usg_pct_count: usg_pct !== null ? 1 : 0,
              ast_ratio_sum: ast_ratio ?? 0, ast_ratio_count: ast_ratio !== null ? 1 : 0,
              reb_pct_sum: reb_pct ?? 0, reb_pct_count: reb_pct !== null ? 1 : 0,
              efg_pct_sum: efg_pct ?? 0, efg_pct_count: efg_pct !== null ? 1 : 0,
              tov_pct_sum: tov_pct ?? 0, tov_pct_count: tov_pct !== null ? 1 : 0,
            });
          }
        });
        
        // Get player names and team info
        const { data: players } = await supabase
          .from('nba_players')
          .select('id, nba_player_id, name, team_abbreviation')
          .in('id', playerIds);
        
        const playerMap = new Map();
        (players || []).forEach((p: any) => {
          playerMap.set(p.id, { nba_player_id: p.nba_player_id, player_name: p.name, team_tricode: p.team_abbreviation });
        });
        
        return Array.from(statsMap.entries())
          .map(([playerId, stats]) => {
            const playerInfo = playerMap.get(playerId);
            if (!playerInfo || playerInfo.team_tricode !== currentTeamTricode) return null;
            
            // Calculate averages only for stats that have valid data
            const per = stats.per_count > 0 ? stats.per_sum / stats.per_count : null;
            const off_rtg = stats.off_rtg_count > 0 ? stats.off_rtg_sum / stats.off_rtg_count : null;
            const def_rtg = stats.def_rtg_count > 0 ? stats.def_rtg_sum / stats.def_rtg_count : null;
            const net_rtg = stats.net_rtg_count > 0 ? stats.net_rtg_sum / stats.net_rtg_count : null;
            const ts_pct = stats.ts_pct_count > 0 ? stats.ts_pct_sum / stats.ts_pct_count : null;
            const usg_pct = stats.usg_pct_count > 0 ? stats.usg_pct_sum / stats.usg_pct_count : null;
            const ast_ratio = stats.ast_ratio_count > 0 ? stats.ast_ratio_sum / stats.ast_ratio_count : null;
            const reb_pct = stats.reb_pct_count > 0 ? stats.reb_pct_sum / stats.reb_pct_count : null;
            const efg_pct = stats.efg_pct_count > 0 ? stats.efg_pct_sum / stats.efg_pct_count : null;
            const tov_pct = stats.tov_pct_count > 0 ? stats.tov_pct_sum / stats.tov_pct_count : null;
            
            // Only include players with at least one meaningful stat
            const hasValidStats = [per, off_rtg, def_rtg, net_rtg, ts_pct, usg_pct, ast_ratio, reb_pct, efg_pct, tov_pct]
              .some(v => v !== null && v !== 0);
            
            if (!hasValidStats) return null;
            
            return {
              player_id: playerId,
              nba_player_id: playerInfo.nba_player_id,
              player_name: playerInfo.player_name,
              team_tricode: playerInfo.team_tricode,
              per,
              off_rtg,
              def_rtg,
              net_rtg,
              ts_pct,
              usg_pct,
              ast_ratio,
              reb_pct,
              efg_pct,
              tov_pct,
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => (b?.per || 0) - (a?.per || 0));
      }
    },
    enabled: !!currentTeamTricode && !!currentSeason && !!gameId && (gameState === 'upcoming' ? !!currentRoster : !!liveStats),
  });

  // Load JSON game data for completed games (contains rich stats, fun score, play-by-play, etc.)
  const { data: gameJsonData, isLoading: gameJsonLoading } = useQuery<GameJsonData | null>({
    queryKey: ['game-json-data', gameId],
    queryFn: async () => {
      if (!gameId || gameState !== 'completed') return null;
      return await loadGameJson(gameId);
    },
    enabled: !!gameId && gameState === 'completed',
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // NOW we can have conditional returns - ALL hooks (including useMemo) are called above
  if (gameLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '80vh',
        bgcolor: '#000000',
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!gameData) {
    return (
      <Box sx={{ 
        bgcolor: '#000000',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}>
        <Box sx={{ 
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          minWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto',
          pt: { xs: 'calc(49px + 24px)', md: '50px' },
          pb: 4,
          px: { xs: 2, sm: 2, md: 2 },
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <Button 
            onClick={() => navigate('/today')}
            startDecorator={<ArrowBack />}
            variant="soft"
            color="neutral"
            sx={{ mb: 3, bgcolor: '#333333', color: '#FFFFFF', '&:hover': { bgcolor: '#444444' } }}
          >
          </Button>
          <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              Game not found. The game may not exist in the database or the game ID may be incorrect.
            </Typography>
          </Alert>
        </Box>
      </Box>
    );
  }

  const homeColors = getTeamColors(gameData?.home_team_tricode || '');
  const awayColors = getTeamColors(gameData?.away_team_tricode || '');

  // Get game date for navigation
  const gameDate = gameData?.game_date ? dayjs(gameData.game_date) : selectedDate;
  
  // Handle back navigation
  const handleBack = () => {
    navigate(returnPath, {
      state: returnDate ? { selectedDate: returnDate } : undefined
    });
  };

  return (
    <Box sx={{ 
      bgcolor: '#000000',
      minHeight: '100vh',
      overflowX: 'hidden',
      width: '100%',
    }}>
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        minWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto', 
        pt: isLandscapeMobile 
          ? '12px' // Minimal padding in landscape mobile
          : { xs: '12px', md: 'calc((100vh - 40px) / 16 + 20px)' }, // Minimal padding on mobile, normal on desktop
        pb: 2,
        px: { xs: 0, sm: 2, md: 2 },
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}>
        {/* Game Header: Split team avatar left, details right (matching player page format) */}
        {gameData && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'row',
            alignItems: 'center', 
            gap: { xs: 1.5, md: 2 }, 
            mb: 1, 
            px: { xs: 2, sm: 0 },
          }}>
            {/* Back Button */}
            <IconButton
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={handleBack}
              sx={{
                minWidth: 'auto',
                width: { xs: 28, md: 32 },
                height: { xs: 28, md: 32 },
                borderColor: '#FFFFFF',
                color: '#FFFFFF',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
              title="Back"
            >
              <ArrowBack sx={{ fontSize: { xs: '1rem', md: '1.125rem' } }} />
            </IconButton>

            {/* Split Team Avatar Section - Left side, matching feed avatar bar size */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              flexShrink: 0, 
              alignItems: 'center', 
              gap: 0.5, 
              position: 'relative',
            }}>
              <Box sx={{ 
                position: 'relative', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
              }}>
                {/* Split Team Avatar Container - Matching feed avatar bar size */}
                <Box
                  sx={{
                    position: 'relative',
                    width: { xs: 77, md: 83 },
                    height: { xs: 77, md: 83 },
                    borderRadius: '50%',
                    border: `3px solid ${
                      gameState === 'completed' ? '#666666' : 
                      gameState === 'live' ? '#FFC72C' : 
                      '#FFFFFF'
                    }`,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {/* Left half - Away team */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '50%',
                      height: '100%',
                      bgcolor: getTeamPrimaryColor(gameData.away_team_tricode),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Box
                      component="img"
                      src={getTeamLogoUrl(gameData.away_team_tricode)}
                      alt={gameData.away_team_tricode}
                      sx={{
                        width: '70%',
                        height: '70%',
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                  
                  {/* Vertical divider */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      width: '2px',
                      height: '100%',
                      bgcolor: '#000000',
                      zIndex: 1,
                    }}
                  />
                  
                  {/* Right half - Home team */}
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: '50%',
                      height: '100%',
                      bgcolor: getTeamPrimaryColor(gameData.home_team_tricode),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Box
                      component="img"
                      src={getTeamLogoUrl(gameData.home_team_tricode)}
                      alt={gameData.home_team_tricode}
                      sx={{
                        width: '70%',
                        height: '70%',
                        objectFit: 'contain',
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* Game Details Section - Right side */}
            <Box sx={{ 
              flex: 1, 
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              textAlign: 'left',
            }}>
              {/* Matchup with Score */}
              <Box sx={{ mb: 1, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography 
                    level="h1" 
                    sx={{
                      fontSize: { xs: '1.25rem', sm: '1.5rem', md: '2rem' },
                      fontWeight: 'bold',
                      lineHeight: 1.2,
                      m: 0,
                      p: 0,
                      color: '#FFFFFF',
                    }}
                  >
                    {gameData.away_team_tricode} @ {gameData.home_team_tricode}
                  </Typography>
                {showStatusChip && (
                    <Chip
                      size="sm"
                      color={gameState === 'live' ? 'danger' : gameState === 'completed' ? 'success' : 'neutral'}
                      variant="solid"
                      sx={{ 
                        fontWeight: 'bold',
                        fontSize: { xs: '0.75rem', md: '0.875rem' },
                      }}
                    >
                      {gameData.game_status_text}
                    </Chip>
                  )}
                </Box>
                {(() => {
                  const hasScores = gameData.home_team_score !== null && gameData.away_team_score !== null;
                  const bothZero = hasScores && gameData.home_team_score === 0 && gameData.away_team_score === 0;
                  
                  // For upcoming / not-started games, show tip-off time instead of "0 - 0"
                  if (gameState === 'upcoming' && gameData.game_status_text && (!hasScores || bothZero)) {
                    return (
                      <Typography 
                        level="h4" 
                        sx={{ 
                          fontWeight: 'bold', 
                          color: '#FFC72C', 
                          fontSize: { xs: '1rem', md: '1.25rem' },
                          mt: 0.5,
                        }}
                      >
                        {gameData.game_status_text}
                      </Typography>
                    );
                  }
                  
                  // For live/completed games with real scores, show the score
                  if (hasScores && !bothZero) {
                    return (
                      <Typography 
                        level="h4" 
                        sx={{ 
                          fontWeight: 'bold', 
                          color: '#FFC72C', 
                          fontSize: { xs: '1rem', md: '1.25rem' },
                          mt: 0.5,
                        }}
                      >
                        {gameData.away_team_score} - {gameData.home_team_score}
                      </Typography>
                    );
                  }
                  
                  return null;
                })()}
                {gameData.arena_name && (
                  <Typography 
                    level="body-sm" 
                    sx={{ 
                      color: '#CCCCCC', 
                      fontSize: { xs: '0.7rem', md: '0.75rem' },
                      mt: 0.5,
                    }}
                  >
                    {gameData.arena_name}
                    {gameData.arena_city && `, ${gameData.arena_city}`}
                  </Typography>
                )}
              </Box>

              {/* View Tabs: Stats, Props, Advanced */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: { xs: 1, md: 1.5 }, 
                flexWrap: 'wrap',
                width: '100%',
              }}>
                {/* Stats */}
                <IconButton
                  size="sm"
                  variant={activeView === 'stats' ? 'solid' : 'outlined'}
                  color={activeView === 'stats' ? 'primary' : 'neutral'}
                  onClick={() => setActiveView('stats')}
                  sx={{
                    fontSize: { xs: '0.65rem', md: '0.75rem' },
                    width: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                  }}
                >
                  <BarChart sx={{ fontSize: { xs: '0.75rem', md: '1rem' } }} />
                </IconButton>
                {/* Advanced stats */}
                <IconButton
                  size="sm"
                  variant={activeView === 'advanced' ? 'solid' : 'outlined'}
                  color={activeView === 'advanced' ? 'primary' : 'neutral'}
                  onClick={() => setActiveView('advanced')}
                  sx={{
                    fontSize: { xs: '0.65rem', md: '0.75rem' },
                    width: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                  }}
                >
                  <Analytics sx={{ fontSize: { xs: '0.75rem', md: '1rem' } }} />
                </IconButton>
                {/* Team analytics compare (predictor placeholder) */}
                <IconButton
                  size="sm"
                  variant={activeView === 'predictor' ? 'solid' : 'outlined'}
                  color={activeView === 'predictor' ? 'primary' : 'neutral'}
                  onClick={() => setActiveView('predictor')}
                  sx={{
                    fontSize: { xs: '0.65rem', md: '0.75rem' },
                    width: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                  }}
                  title="Team analytics comparison"
                >
                  <TrendingUp sx={{ fontSize: { xs: '0.75rem', md: '1rem' } }} />
                </IconButton>
                {/* Player props */}
                <IconButton
                  size="sm"
                  variant={activeView === 'props' ? 'solid' : 'outlined'}
                  color={activeView === 'props' ? 'primary' : 'neutral'}
                  onClick={() => setActiveView('props')}
                  sx={{
                    fontSize: { xs: '0.65rem', md: '0.75rem' },
                    width: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                  }}
                >
                  <EmojiEvents sx={{ fontSize: { xs: '0.75rem', md: '1rem' } }} />
                </IconButton>
                {/* Props vs teams (shield) */}
                <IconButton
                  size="sm"
                  variant={activeView === 'propsVsTeams' ? 'solid' : 'outlined'}
                  color={activeView === 'propsVsTeams' ? 'primary' : 'neutral'}
                  onClick={() => setActiveView('propsVsTeams')}
                  sx={{
                    fontSize: { xs: '0.65rem', md: '0.75rem' },
                    width: { xs: 28, md: 32 },
                    height: { xs: 28, md: 32 },
                  }}
                  title="Props vs teams (how players fare against each defense)"
                >
                  <Shield sx={{ fontSize: { xs: '0.75rem', md: '1rem' } }} />
                </IconButton>
                <Box sx={{ ml: { xs: 0.5, md: 1 }, display: 'flex', alignItems: 'center', gap: { xs: 0.25, md: 0.5 } }}>
                  <IconButton
                    size="sm"
                    variant={selectedTeam === 'away' ? 'solid' : 'outlined'}
                    onClick={() => setSelectedTeam('away')}
                    sx={{
                      p: { xs: 0.25, md: 0.5 },
                      width: { xs: 24, md: 28 },
                      height: { xs: 24, md: 28 },
                    }}
                    title="Away Team"
                  >
                    <Avatar
                      src={getTeamLogoUrl(gameData.away_team_tricode)}
                      alt={gameData.away_team_tricode}
                      sx={{ width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 } }}
                    />
                  </IconButton>
                  <IconButton
                    size="sm"
                    variant={selectedTeam === 'home' ? 'solid' : 'outlined'}
                    onClick={() => setSelectedTeam('home')}
                    sx={{
                      p: { xs: 0.25, md: 0.5 },
                      width: { xs: 24, md: 28 },
                      height: { xs: 24, md: 28 },
                    }}
                    title="Home Team"
                  >
                    <Avatar
                      src={getTeamLogoUrl(gameData.home_team_tricode)}
                      alt={gameData.home_team_tricode}
                      sx={{ width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 } }}
                    />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Enhanced Game Data Sections for Completed Games */}
        {gameState === 'completed' && gameJsonData && (
          <Box sx={{ px: { xs: 2, sm: 0 }, mb: 3 }}>
            {/* Fun Score Section */}
            {getFunScore(gameJsonData) !== null && (
              <Card sx={{ mb: 2, bgcolor: '#1a1a1a', border: '1px solid #333333' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 0.5 }}>
                        Fun Score
                      </Typography>
                      <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                        How exciting was this game?
                      </Typography>
                    </Box>
                    <Typography 
                      level="h1" 
                      sx={{ 
                        color: '#FFC72C', 
                        fontSize: { xs: '2rem', md: '3rem' },
                        fontWeight: 'bold'
                      }}
                    >
                      {getFunScore(gameJsonData)?.toFixed(1)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Lead Changes & Excitement Metrics */}
            {getLeadChanges(gameJsonData) && (
              <Card sx={{ mb: 2, bgcolor: '#1a1a1a', border: '1px solid #333333' }}>
                <CardContent>
                  <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 2 }}>
                    Game Excitement
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Total Lead Changes</Typography>
                      <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                        {getLeadChanges(gameJsonData)?.total || 0}
                      </Typography>
                    </Box>
                    {getLeadChanges(gameJsonData)?.last_5_minutes !== undefined && (
                      <Box>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Last 5 Minutes</Typography>
                        <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                          {getLeadChanges(gameJsonData)?.last_5_minutes || 0}
                        </Typography>
                      </Box>
                    )}
                    {getLeadChanges(gameJsonData)?.buzzer_beater !== undefined && getLeadChanges(gameJsonData)?.buzzer_beater! > 0 && (
                      <Box>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Buzzer Beaters</Typography>
                        <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                          {getLeadChanges(gameJsonData)?.buzzer_beater || 0}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Scoring Milestones */}
            {getScoringMilestones(gameJsonData) && (() => {
              const milestones = getScoringMilestones(gameJsonData);
              const hasMilestones = milestones && (
                (milestones['70 Ball'] && milestones['70 Ball'].length > 0) ||
                (milestones['60 Ball'] && milestones['60 Ball'].length > 0) ||
                (milestones['50 Ball'] && milestones['50 Ball'].length > 0) ||
                (milestones['40 Ball'] && milestones['40 Ball'].length > 0) ||
                (milestones['Triple Double'] && milestones['Triple Double'].length > 0)
              );
              
              if (!hasMilestones) return null;
              
              return (
                <Card sx={{ mb: 2, bgcolor: '#1a1a1a', border: '1px solid #333333' }}>
                  <CardContent>
                    <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 2 }}>
                      Scoring Milestones
                    </Typography>
                    <Stack spacing={1}>
                      {milestones['70 Ball'] && milestones['70 Ball'].length > 0 && milestones['70 Ball'].map(([name, points]: [string, number], idx: number) => (
                        <Chip key={`70-${idx}`} color="danger" variant="solid" sx={{ alignSelf: 'flex-start' }}>
                          🔥 {name}: {points} points
                        </Chip>
                      ))}
                      {milestones['60 Ball'] && milestones['60 Ball'].length > 0 && milestones['60 Ball'].map(([name, points]: [string, number], idx: number) => (
                        <Chip key={`60-${idx}`} color="danger" variant="solid" sx={{ alignSelf: 'flex-start' }}>
                          🔥 {name}: {points} points
                        </Chip>
                      ))}
                      {milestones['50 Ball'] && milestones['50 Ball'].length > 0 && milestones['50 Ball'].map(([name, points]: [string, number], idx: number) => (
                        <Chip key={`50-${idx}`} color="warning" variant="solid" sx={{ alignSelf: 'flex-start' }}>
                          ⭐ {name}: {points} points
                        </Chip>
                      ))}
                      {milestones['40 Ball'] && milestones['40 Ball'].length > 0 && milestones['40 Ball'].map(([name, points]: [string, number], idx: number) => (
                        <Chip key={`40-${idx}`} color="primary" variant="solid" sx={{ alignSelf: 'flex-start' }}>
                          {name}: {points} points
                        </Chip>
                      ))}
                      {milestones['Triple Double'] && milestones['Triple Double'].length > 0 && milestones['Triple Double'].map(([name, stats]: [string, string], idx: number) => (
                        <Chip key={`td-${idx}`} color="success" variant="solid" sx={{ alignSelf: 'flex-start' }}>
                          🎯 {name}: {stats}
                        </Chip>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Dunk Stats */}
            {getDunkStats(gameJsonData) && getDunkStats(gameJsonData)?.['Total Dunks']! > 0 && (
              <Card sx={{ mb: 2, bgcolor: '#1a1a1a', border: '1px solid #333333' }}>
                <CardContent>
                  <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 2 }}>
                    Dunk Stats
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Total Dunks</Typography>
                      <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                        {getDunkStats(gameJsonData)?.['Total Dunks'] || 0}
                      </Typography>
                    </Box>
                    {getDunkStats(gameJsonData)?.['Alley Oop']! > 0 && (
                      <Box>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Alley Oops</Typography>
                        <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                          {getDunkStats(gameJsonData)?.['Alley Oop'] || 0}
                        </Typography>
                      </Box>
                    )}
                    {getDunkStats(gameJsonData)?.['Putback']! > 0 && (
                      <Box>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Putback Dunks</Typography>
                        <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                          {getDunkStats(gameJsonData)?.['Putback'] || 0}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Team Advantages */}
            {getStoryData(gameJsonData)?.advantages && getStoryData(gameJsonData)!.advantages.length > 0 && (
              <Card sx={{ mb: 2, bgcolor: '#1a1a1a', border: '1px solid #333333' }}>
                <CardContent>
                  <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 2 }}>
                    Key Advantages
                  </Typography>
                  <Stack spacing={1.5}>
                    {getStoryData(gameJsonData)!.advantages.slice(0, 4).map((advantage, idx) => (
                      <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                            {advantage.stat_name}
                          </Typography>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>
                            {advantage.team} advantage
                          </Typography>
                        </Box>
                        <Typography level="body-md" sx={{ color: '#FFC72C', fontWeight: 'bold' }}>
                          +{advantage.diff.toFixed(advantage.diff % 1 === 0 ? 0 : 1)}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Advanced Team Stats */}
            {getTeamStats(gameJsonData) && (
              <Card sx={{ mb: 2, bgcolor: '#1a1a1a', border: '1px solid #333333' }}>
                <CardContent>
                  <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 2 }}>
                    Advanced Stats
                  </Typography>
                  <Stack spacing={1.5}>
                    {getTeamStats(gameJsonData)?.['Pace'] !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Pace</Typography>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                          {getTeamStats(gameJsonData)?.['Pace']?.toFixed(1)}
                        </Typography>
                      </Box>
                    )}
                    {getTeamStats(gameJsonData)?.['Combined Fast Break Points'] !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Fast Break Points</Typography>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                          {getTeamStats(gameJsonData)?.['Combined Fast Break Points']}
                        </Typography>
                      </Box>
                    )}
                    {getTeamStats(gameJsonData)?.['Combined Threes'] !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Total 3-Pointers</Typography>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                          {getTeamStats(gameJsonData)?.['Combined Threes']}
                        </Typography>
                      </Box>
                    )}
                    {getTeamStats(gameJsonData)?.['Combined Contested Shots'] !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>Contested Shots</Typography>
                        <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                          {getTeamStats(gameJsonData)?.['Combined Contested Shots']} ({getTeamStats(gameJsonData)?.['Combined Contested Shot %']?.toFixed(1)}%)
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {/* Quarter-by-Quarter Scores */}
            {getQuarterScores(gameJsonData) && (
              <Card sx={{ mb: 2, bgcolor: '#1a1a1a', border: '1px solid #333333' }}>
                <CardContent>
                  <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 2 }}>
                    Quarter Scores
                  </Typography>
                  <Table sx={{ bgcolor: 'transparent' }}>
                    <thead>
                      <tr>
                        <th style={{ color: '#CCCCCC', fontSize: '0.75rem', textAlign: 'left', padding: '8px' }}>Quarter</th>
                        <th style={{ color: '#CCCCCC', fontSize: '0.75rem', textAlign: 'right', padding: '8px' }}>{gameData.away_team_tricode}</th>
                        <th style={{ color: '#CCCCCC', fontSize: '0.75rem', textAlign: 'right', padding: '8px' }}>{gameData.home_team_tricode}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getQuarterScores(gameJsonData)!.map((q) => (
                        <tr key={q.quarter}>
                          <td style={{ color: '#FFFFFF', fontSize: '0.875rem', padding: '8px' }}>
                            Q{q.quarter}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '8px' }}>
                            {q.away}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '8px' }}>
                            {q.home}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '1px solid #333333' }}>
                        <td style={{ color: '#FFC72C', fontSize: '0.875rem', fontWeight: 'bold', padding: '8px' }}>
                          Final
                        </td>
                        <td style={{ color: '#FFC72C', fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right', padding: '8px' }}>
                          {gameData.away_team_score}
                        </td>
                        <td style={{ color: '#FFC72C', fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right', padding: '8px' }}>
                          {gameData.home_team_score}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </Box>
        )}

        {/* Content Area - Stats/Props/Advanced Tables */}
        {gameLoading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : !gameData ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Alert color="warning">
              <Typography>Game not found</Typography>
            </Alert>
          </Box>
        ) : activeView === 'props' ? (
          // Player Props View - Table format: one row per player, one column per prop type
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            {propsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (() => {
              // teamProps is already filtered by team in useMemo above
              // Show ALL players with props, regardless of roster membership

              if (teamProps.length === 0) {
                return (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography sx={{ color: '#CCCCCC', fontSize: '0.75rem' }}>
                      {playerProps && playerProps.length > 0 
                        ? `No props found for ${selectedTeam === 'away' ? gameData?.away_team_tricode : gameData?.home_team_tricode} players.`
                        : 'No player props available for this game'}
                    </Typography>
                  </Box>
                );
              }

              // Bookmaker priority: DraftKings > FanDuel > Consensus
              const getBookmakerPriority = (bookmaker: string): number => {
                const bookmakerLower = (bookmaker || '').toLowerCase();
                if (bookmakerLower.includes('draftkings') || bookmakerLower === 'draftkings') return 1;
                if (bookmakerLower.includes('fanduel') || bookmakerLower === 'fanduel') return 2;
                if (bookmakerLower === 'consensus') return 3;
                return 4;
              };

              // Group props by player and bet_type, then filter to show only ONE prop per bet_type
              const propsByPlayerAndType = new Map<string, PlayerProp[]>();
              teamProps.forEach(prop => {
                const key = `${prop.player_name || prop.nba_player_id}_${prop.bet_type}`;
                if (!propsByPlayerAndType.has(key)) {
                  propsByPlayerAndType.set(key, []);
                }
                propsByPlayerAndType.get(key)!.push(prop);
              });

              // Filter and prioritize props - ALWAYS take the one with the HIGHEST line value
              // If lines are equal, use bookmaker priority as tiebreaker
              const filteredProps: PlayerProp[] = [];
              propsByPlayerAndType.forEach((props) => {
                // Sort by line value (descending - highest first), then by bookmaker priority as tiebreaker
                props.sort((a, b) => {
                  const lineA = parseFloat(a.line?.toString() || '0');
                  const lineB = parseFloat(b.line?.toString() || '0');
                  
                  // First sort by line (descending - higher is better)
                  if (lineA !== lineB) {
                    return lineB - lineA;
                  }
                  
                  // If lines are equal, use bookmaker priority as tiebreaker
                  return getBookmakerPriority(a.bookmaker) - getBookmakerPriority(b.bookmaker);
                });
                
                // Take the first one (highest line, or best bookmaker if tied)
                const bestProp = props[0];
                if (bestProp) {
                  filteredProps.push(bestProp);
                }
              });

              // Get all unique bet types and sort them with new order and abbreviations
              const betTypes = Array.from(new Set(filteredProps.map(p => p.bet_type)));
              
              // Bet type to abbreviation mapping
              const betTypeAbbreviation: Record<string, string> = {
                // Main stats
                'points': 'PTS', 'pts': 'PTS', 'point': 'PTS',
                'rebounds': 'REB', 'reb': 'REB', 'rebound': 'REB',
                'assists': 'AST', 'ast': 'AST', 'assist': 'AST',
                'points_rebounds_assists': 'P+R+A', 'points+rebounds+assists': 'P+R+A',
                'threes': '3PM', '3pm': '3PM', 'three_pointers_made': '3PM', 'three_pointers': '3PM',
                'points_assists': 'PTS+AST', 'points+assists': 'PTS+AST',
                'rebounds_assists': 'AST+REB', 'rebounds+assists': 'AST+REB', 'assists_rebounds': 'AST+REB',
                'blocks_steals': 'STL+BLK', 'blocks+steals': 'STL+BLK', 'stocks': 'STL+BLK', 'steals_blocks': 'STL+BLK',
                'blocks': 'BLK', 'blk': 'BLK', 'block': 'BLK',
                'steals': 'STL', 'stl': 'STL', 'steal': 'STL',
                'turnovers': 'TO', 'tov': 'TO', 'turnover': 'TO',
                // Field goals
                'field_goals_made': 'FGM', 'fgm': 'FGM', 'field_goals': 'FGM',
                'free_throws_made': 'FTM', 'ftm': 'FTM', 'free_throws': 'FTM',
                'field_goals_attempted': 'FGA', 'fga': 'FGA', 'field_goal_attempts': 'FGA',
                'three_pointers_attempted': '3PA', '3pa': '3PA', 'three_point_attempts': '3PA', 'threes_attempted': '3PA',
                // Legacy mappings
                'points_rebounds': 'PTS+REB', 'points+rebounds': 'PTS+REB',
              };
              
              // Bet type order (priority order)
              const betTypeOrder: Record<string, number> = {
                'points': 1, 'pts': 1, 'point': 1,
                'rebounds': 2, 'reb': 2, 'rebound': 2,
                'assists': 3, 'ast': 3, 'assist': 3,
                'points_rebounds_assists': 4, 'points+rebounds+assists': 4,
                'threes': 5, '3pm': 5, 'three_pointers_made': 5, 'three_pointers': 5,
                'points_assists': 6, 'points+assists': 6,
                'rebounds_assists': 7, 'rebounds+assists': 7, 'assists_rebounds': 7,
                'blocks_steals': 8, 'blocks+steals': 8, 'stocks': 8, 'steals_blocks': 8,
                'blocks': 9, 'blk': 9, 'block': 9,
                'steals': 10, 'stl': 10, 'steal': 10,
                'turnovers': 11, 'tov': 11, 'turnover': 11,
                'field_goals_made': 12, 'fgm': 12, 'field_goals': 12,
                'free_throws_made': 13, 'ftm': 13, 'free_throws': 13,
                'field_goals_attempted': 14, 'fga': 14, 'field_goal_attempts': 14,
                'three_pointers_attempted': 15, '3pa': 15, 'three_point_attempts': 15, 'threes_attempted': 15,
              };
              
              betTypes.sort((a, b) => {
                const orderA = betTypeOrder[a.toLowerCase()] || 999;
                const orderB = betTypeOrder[b.toLowerCase()] || 999;
                return orderA - orderB;
              });

              // Group props by player
              const propsByPlayer = new Map<string, Map<string, PlayerProp>>();
              filteredProps.forEach(prop => {
                const playerKey = prop.player_name || `${prop.nba_player_id}`;
                if (!propsByPlayer.has(playerKey)) {
                  propsByPlayer.set(playerKey, new Map());
                }
                propsByPlayer.get(playerKey)!.set(prop.bet_type, prop);
              });

              // Get list of players from props (show ALL players with props, not just those in roster)
              // Create a map to store player info from props, using enhanced props with matched info
              const playersMap = new Map<string, { name: string; nba_player_id: number; player_id?: string }>();
              
              filteredProps.forEach(prop => {
                const playerKey = prop.player_name || `${prop.nba_player_id || prop.player_id}`;
                if (!playersMap.has(playerKey)) {
                  // Use matched player info if available, otherwise use prop info
                  const nbaPlayerId = prop.nba_player_id || (playerNameMatches?.get(prop.player_name)?.nba_player_id);
                  const playerId = prop.player_id || (playerNameMatches?.get(prop.player_name)?.player_id);
                  
                  playersMap.set(playerKey, {
                    name: prop.player_name,
                    nba_player_id: nbaPlayerId || 0,
                    player_id: playerId
                  });
                }
              });
              
              // Convert to array and sort by player name
              const players = Array.from(playersMap.values()).sort((a, b) => 
                (a.name || '').localeCompare(b.name || '')
              );
              
              console.log('📊 Players with props:', players.length, players.map(p => p.name));

              // For completed games, get actual stats and calculate prop results
              const getPropResult = (prop: PlayerProp) => {
                if (gameState !== 'completed' || !liveStats) return null;
                
                const player = liveStats.find(p => 
                  (p.player_id && p.player_id === prop.player_id) ||
                  (p.nba_player_id === prop.nba_player_id)
                );
                
                if (!player || !player.stats) return null;
                
                const stats = typeof player.stats === 'string' 
                  ? JSON.parse(player.stats) 
                  : player.stats;
                
                return calculatePropResult(prop.bet_type, prop.line, {
                  pts: stats.pts || 0,
                  reb: stats.reb || 0,
                  ast: stats.ast || 0,
                  stl: stats.stl || 0,
                  blk: stats.blk || 0,
                  tov: stats.tov || 0,
                  fg3m: stats.fg3m || 0,
                  ftm: stats.ftm || 0,
                });
              };

              // Format bet type for display using abbreviations
              const formatBetType = (betType: string): string => {
                const normalized = betType.toLowerCase();
                return betTypeAbbreviation[normalized] || betType.replace(/_/g, ' ').replace(/\+/g, '+').toUpperCase();
              };

              // Increased column width for better legibility
              const columnWidth = isMobile 
                ? (gameState === 'completed' ? 90 : 75)
                : (gameState === 'completed' ? 140 : 110);
              const playerColumnWidth = isMobile ? 140 : 180;
              const minWidth = playerColumnWidth + (betTypes.length * columnWidth);

              return (
                <Table sx={{ bgcolor: '#000000', width: '100%', minWidth: `${minWidth}px` }}>
                  <thead>
                    <tr>
                      <th style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', minWidth: `${playerColumnWidth}px`, width: `${playerColumnWidth}px`, position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#000000', padding: isMobile ? '8px 6px' : '12px' }}>Player</th>
                      {betTypes.map(betType => (
                        <th key={betType} style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 6px' : '12px 16px', minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}>
                          {formatBetType(betType)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, playerIndex) => {
                      const playerPropsMap = propsByPlayer.get(player.name || `${player.nba_player_id}`) || new Map();
                      // Try to find player in roster for jersey/position info, but don't require it
                      const rosterPlayer: any = currentRoster?.find((p: any) => 
                        (p.player_id && p.player_id === player.player_id) ||
                        (p.nba_player_id === player.nba_player_id) ||
                        (p.player_name === player.name)
                      ) || currentTeamStats?.find((p: any) =>
                        (p.player_id && p.player_id === player.player_id) ||
                        (p.nba_player_id === player.nba_player_id) ||
                        (p.player_name === player.name)
                      );
                      // Unique key: nba_player_id can be 0 or duplicated for unmatched names
                      const rowKey = [player.nba_player_id, player.player_id, player.name].filter(Boolean).join('_') || `player_${playerIndex}`;

                      return (
                        <tr
                          key={rowKey}
                          style={{
                            borderBottom: '1px solid #333333',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 199, 44, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td 
                            style={{ 
                              color: '#FFFFFF', 
                              fontSize: isMobile ? '0.65rem' : '0.75rem', 
                              padding: isMobile ? '8px 6px' : '12px',
                              minWidth: `${playerColumnWidth}px`,
                              width: `${playerColumnWidth}px`,
                              position: 'sticky',
                              left: 0,
                              zIndex: 9,
                              backgroundColor: 'transparent'
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, md: 0.5 } }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: isMobile ? '24px' : '30px', flexShrink: 0 }}>
                                {rosterPlayer?.jersey_number && (
                                  <Typography sx={{ color: '#FFFFFF', fontSize: isMobile ? '0.6rem' : '0.7rem', fontWeight: 'bold', lineHeight: 1 }}>
                                    #{rosterPlayer.jersey_number}
                                  </Typography>
                                )}
                                {rosterPlayer?.position && (
                                  <Typography sx={{ color: '#CCCCCC', fontSize: isMobile ? '0.55rem' : '0.65rem', lineHeight: 1 }}>
                                    {rosterPlayer.position}
                                  </Typography>
                                )}
                              </Box>
                              <Avatar
                                src={player.nba_player_id && player.nba_player_id > 0
                                  ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`
                                  : undefined
                                }
                                alt={player.name}
                                sx={{ width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 }, flexShrink: 0 }}
                              >
                                {(!player.nba_player_id || player.nba_player_id === 0) && (
                                  <Typography sx={{ fontSize: isMobile ? '0.5rem' : '0.6rem', color: '#FFFFFF' }}>
                                    {player.name?.charAt(0) || '?'}
                                  </Typography>
                                )}
                              </Avatar>
                              <Typography sx={{ 
                                color: '#FFFFFF', 
                                fontSize: isMobile ? '0.65rem' : '0.75rem',
                                whiteSpace: 'nowrap',
                                overflow: 'visible',
                                flex: 1,
                                minWidth: isMobile ? '80px' : '100px'
                              }}>
                                {player.name}
                              </Typography>
                            </Box>
                          </td>
                          {betTypes.map(betType => {
                            const prop = playerPropsMap.get(betType);
                            const propResult = prop ? getPropResult(prop) : null;

                            return (
                              <td 
                                key={betType}
                                style={{ 
                                  color: '#FFFFFF', 
                                  fontSize: isMobile ? '0.65rem' : '0.75rem', 
                                  textAlign: 'right', 
                                  padding: isMobile ? '8px 6px' : '12px 16px',
                                  minWidth: `${columnWidth}px`,
                                  width: `${columnWidth}px`
                                }}
                              >
                                <PropPerformanceCell
                                  prop={prop || null}
                                  propResult={propResult}
                                  gameState={gameState}
                                  opponentTeamTricode={opponentTeamTricode}
                                  isMobile={isMobile}
                                  american_odds={prop?.american_odds}
                                  price={prop?.price}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              );
            })()}
          </Box>
        ) : activeView === 'propsVsTeams' && gameData ? (
          // Props vs Teams: how players have fared against each team's defense (last 10 games)
          <Box sx={{ width: '100%', overflowX: 'auto', px: { xs: 2, sm: 0 } }}>
            <Typography level="body-sm" sx={{ color: '#CCCCCC', mb: 2 }}>
              Hit rates for player props against each team over their last 10 completed games. Higher % = opponents hit that prop more often. Click a cell to see the game-by-game breakdown.
            </Typography>
            <Table sx={{ bgcolor: '#000000', width: '100%', minWidth: isMobile ? '320px' : '500px' }}>
              <thead>
                <tr>
                  <th style={{ color: '#FFFFFF', fontSize: isMobile ? '0.7rem' : '0.8rem', textAlign: 'left', padding: '10px 12px' }}>Prop</th>
                  <th style={{ color: '#FFFFFF', fontSize: isMobile ? '0.7rem' : '0.8rem', textAlign: 'right', padding: '10px 12px' }}>
                    vs {gameData.home_team_tricode}
                  </th>
                  <th style={{ color: '#FFFFFF', fontSize: isMobile ? '0.7rem' : '0.8rem', textAlign: 'right', padding: '10px 12px' }}>
                    vs {gameData.away_team_tricode}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { betType: 'points', label: 'PTS' },
                  { betType: 'rebounds', label: 'REB' },
                  { betType: 'assists', label: 'AST' },
                  { betType: 'threes', label: '3PM' },
                  { betType: 'steals', label: 'STL' },
                  { betType: 'blocks', label: 'BLK' },
                  { betType: 'turnovers', label: 'TOV' },
                  { betType: 'blocks_steals', label: 'STL+BLK' },
                  { betType: 'points_rebounds', label: 'P+R' },
                  { betType: 'points_assists', label: 'P+A' },
                  { betType: 'rebounds_assists', label: 'R+A' },
                  { betType: 'points_rebounds_assists', label: 'P+R+A' },
                  { betType: 'freethrowsmade', label: 'FTM' },
                  { betType: 'fieldgoalsmade', label: 'FGM' },
                  { betType: 'fieldgoalsattempted', label: 'FGA' },
                  { betType: 'threepointersattempted', label: '3PA' },
                  { betType: 'twopointersmade', label: '2PM' },
                ].map(({ betType, label }) => (
                  <PropsVsTeamRow
                    key={betType}
                    betType={betType}
                    label={label}
                    homeTricode={gameData.home_team_tricode}
                    awayTricode={gameData.away_team_tricode}
                    isMobile={isMobile}
                  />
                ))}
              </tbody>
            </Table>
          </Box>
        ) : activeView === 'advanced' ? (
          // Advanced View - Display advanced stats
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            {advancedStatsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : !advancedStats || advancedStats.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ color: '#CCCCCC', fontSize: '0.75rem' }}>
                  {gameState === 'upcoming' 
                    ? 'Advanced stats will be available after the game starts'
                    : 'No advanced stats available for this game'}
                </Typography>
              </Box>
            ) : (
              <Table sx={{ bgcolor: '#000000', width: '100%', minWidth: isMobile ? '600px' : '800px' }}>
              <thead>
                <tr>
                    <th style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', minWidth: isMobile ? '140px' : '180px', width: isMobile ? '140px' : '180px', position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#000000', padding: isMobile ? '8px 6px' : '12px' }}>Player</th>
                    <SortableHeader column="off_rtg" label="ORtg" />
                    <SortableHeader column="def_rtg" label="DRtg" />
                    <SortableHeader column="net_rtg" label="NetRtg" />
                    <SortableHeader column="ts_pct" label="TS%" />
                    <SortableHeader column="usg_pct" label="USG%" />
                    <SortableHeader column="efg_pct" label="eFG%" />
                    <SortableHeader column="ast_ratio" label="Ast Ratio" />
                    <SortableHeader column="reb_pct" label="Reb%" />
                    <SortableHeader column="tov_pct" label="TOV%" />
                </tr>
              </thead>
              <tbody>
                  {(() => {
                    let sortedStats = [...advancedStats];
                    
                    // Apply sorting - handle nulls by putting them last
                    if (sortColumn) {
                      sortedStats.sort((a: any, b: any) => {
                        let aVal: number | null = null;
                        let bVal: number | null = null;
                        
                        if (sortColumn === 'off_rtg') {
                          aVal = a.off_rtg ?? null;
                          bVal = b.off_rtg ?? null;
                        } else if (sortColumn === 'def_rtg') {
                          aVal = a.def_rtg ?? null;
                          bVal = b.def_rtg ?? null;
                        } else if (sortColumn === 'net_rtg') {
                          aVal = a.net_rtg ?? null;
                          bVal = b.net_rtg ?? null;
                        } else if (sortColumn === 'ts_pct') {
                          aVal = a.ts_pct ?? null;
                          bVal = b.ts_pct ?? null;
                        } else if (sortColumn === 'usg_pct') {
                          aVal = a.usg_pct ?? null;
                          bVal = b.usg_pct ?? null;
                        } else if (sortColumn === 'efg_pct') {
                          aVal = a.efg_pct ?? null;
                          bVal = b.efg_pct ?? null;
                        } else if (sortColumn === 'ast_ratio') {
                          aVal = a.ast_ratio ?? null;
                          bVal = b.ast_ratio ?? null;
                        } else if (sortColumn === 'reb_pct') {
                          aVal = a.reb_pct ?? null;
                          bVal = b.reb_pct ?? null;
                        } else if (sortColumn === 'tov_pct') {
                          aVal = a.tov_pct ?? null;
                          bVal = b.tov_pct ?? null;
                        }
                        
                        // Handle nulls - put them at the end
                        if (aVal === null && bVal === null) return 0;
                        if (aVal === null) return 1; // a goes to end
                        if (bVal === null) return -1; // b goes to end
                        
                        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                      });
                    }
                    
                    return sortedStats.map((stat: any) => {
                      // Find player in roster for position/jersey
                      const rosterPlayer = (currentRoster || []).find((p: any) => 
                        p.player_id === stat.player_id || p.nba_player_id === stat.nba_player_id
                      );
                      const injury = playerInjuries?.get(stat.nba_player_id);
                      
                      return (
                        <tr
                          key={stat.player_id}
                          onClick={() => stat.player_id && navigate(`/player/${stat.player_id}`)}
                          style={{
                            cursor: 'pointer',
                            borderBottom: '1px solid #333333',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 199, 44, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td style={{ 
                            minWidth: isMobile ? '140px' : '180px', 
                            width: isMobile ? '140px' : '180px', 
                            maxWidth: isMobile ? '140px' : '180px',
                            position: 'sticky',
                            left: 0,
                            zIndex: 9,
                            backgroundColor: 'transparent',
                            padding: isMobile ? '8px 6px' : '12px'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, md: 0.5 } }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: isMobile ? '24px' : '30px', flexShrink: 0 }}>
                                {rosterPlayer?.jersey_number && (
                                  <Typography sx={{ color: '#FFFFFF', fontSize: isMobile ? '0.6rem' : '0.7rem', fontWeight: 'bold', lineHeight: 1 }}>
                                    #{rosterPlayer.jersey_number}
                                  </Typography>
                                )}
                                {rosterPlayer?.position && (
                                  <Typography sx={{ color: '#CCCCCC', fontSize: isMobile ? '0.55rem' : '0.65rem', lineHeight: 1 }}>
                                    {rosterPlayer.position}
                                  </Typography>
                                )}
                              </Box>
                              <Avatar
                                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${stat.nba_player_id}.png`}
                                alt={stat.player_name}
                                sx={{ width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 }, flexShrink: 0 }}
                              />
                              <Box sx={{ flex: 1, minWidth: isMobile ? '90px' : '120px', maxWidth: isMobile ? '100px' : '130px', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                <Typography sx={{ 
                                  color: '#FFFFFF', 
                                  fontSize: isMobile ? '0.65rem' : '0.75rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'visible',
                                }}>
                                  {stat.player_name}
                                </Typography>
                                {/* Injury status badges (same design as Stats view) */}
                                {injury && injury.injury_status === 'Out' && (
                                  <Chip
                                    size="sm"
                                    color="danger"
                                    variant="solid"
                                    sx={{ 
                                      fontSize: isMobile ? '0.55rem' : '0.65rem', 
                                      height: isMobile ? '14px' : '16px',
                                      fontWeight: 'bold',
                                      alignSelf: 'flex-start'
                                    }}
                                  >
                                    {injury.injury_status}
                                  </Chip>
                                )}
                                {injury && (injury.injury_status === 'Questionable' || injury.injury_status === 'Day-to-Day') && (
                                  <Chip
                                    size="sm"
                                    color="warning"
                                    variant="solid"
                                    sx={{ 
                                      fontSize: isMobile ? '0.55rem' : '0.65rem', 
                                      height: isMobile ? '14px' : '16px',
                                      fontWeight: 'bold',
                                      alignSelf: 'flex-start'
                                    }}
                                  >
                                    {injury.injury_status}
                                  </Chip>
                                )}
                              </Box>
                            </Box>
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.off_rtg !== null && stat.off_rtg !== undefined ? stat.off_rtg.toFixed(1) : 'N/A'}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.def_rtg !== null && stat.def_rtg !== undefined ? stat.def_rtg.toFixed(1) : 'N/A'}
                          </td>
                          <td style={{ color: '#FFC72C', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', fontWeight: 600, padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.net_rtg !== null && stat.net_rtg !== undefined ? stat.net_rtg.toFixed(1) : 'N/A'}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.ts_pct !== null && stat.ts_pct !== undefined ? (stat.ts_pct * 100).toFixed(1) + '%' : 'N/A'}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.usg_pct !== null && stat.usg_pct !== undefined ? (stat.usg_pct * 100).toFixed(1) + '%' : 'N/A'}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.efg_pct !== null && stat.efg_pct !== undefined ? (stat.efg_pct * 100).toFixed(1) + '%' : 'N/A'}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.ast_ratio !== null && stat.ast_ratio !== undefined ? stat.ast_ratio.toFixed(1) : 'N/A'}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.reb_pct !== null && stat.reb_pct !== undefined ? (stat.reb_pct * 100).toFixed(1) + '%' : 'N/A'}
                          </td>
                          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
                            {stat.tov_pct !== null && stat.tov_pct !== undefined ? (stat.tov_pct * 100).toFixed(1) + '%' : 'N/A'}
                  </td>
                </tr>
                      );
                    });
                  })()}
              </tbody>
            </Table>
            )}
          </Box>
        ) : activeView === 'predictor' ? (
          // Predictor / team analytics comparison – Phase 2: defense_dash_overall for this game's two teams
          <Box sx={{ p: 3 }}>
            <Card sx={{ bgcolor: '#1a1a1a', border: '1px solid #333333' }}>
              <CardContent>
                <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 1 }}>
                  Team Analytics Comparison
                </Typography>
                <Typography level="body-sm" sx={{ color: '#CCCCCC', mb: 2 }}>
                  Last 10 games team stats from <code>nba_daily_team_stats</code> for game date {predictorDateKey ?? '—'}.
                </Typography>
                {predictorStatsLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size="sm" />
                    <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                      Loading team stats...
                    </Typography>
                  </Box>
                ) : predictorStatsError ? (
                  <Typography level="body-sm" sx={{ color: '#f44336' }}>
                    {predictorStatsError instanceof Error ? predictorStatsError.message : 'Failed to load team stats.'}
                  </Typography>
                ) : predictorStats ? (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      maxHeight: '70vh',
                      overflowY: 'auto',
                      pr: 1,
                    }}
                  >
                    {Object.entries(predictorStats).map(([endpointName, slice]) => {
                      const hasData = slice.home || slice.away;
                      const sample = slice.home ?? slice.away ?? {};
                      const columns = Object.keys(sample).filter((k) => k !== 'TEAM');
                      return (
                        <Box key={endpointName}>
                          <Typography level="body-sm" sx={{ color: '#9e9e9e', mb: 0.5 }}>
                            {endpointName}
                          </Typography>
                          {hasData ? (
                            <Table
                              size="sm"
                              sx={{
                                bgcolor: '#0d0d0d',
                                '& th, & td': { borderColor: '#333', color: '#e0e0e0', fontSize: '0.75rem', padding: '6px 8px' },
                              }}
                            >
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'left' }}>Team</th>
                                  {columns.map((col) => (
                                    <th key={col} style={{ textAlign: 'right' }}>{col}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {slice.home && (
                                  <tr>
                                    <td>{gameData?.home_team_tricode} (H)</td>
                                    {columns.map((col) => (
                                      <td key={col} style={{ textAlign: 'right' }}>{slice.home![col] ?? '—'}</td>
                                    ))}
                                  </tr>
                                )}
                                {slice.away && (
                                  <tr>
                                    <td>{gameData?.away_team_tricode} (A)</td>
                                    {columns.map((col) => (
                                      <td key={col} style={{ textAlign: 'right' }}>{slice.away![col] ?? '—'}</td>
                                    ))}
                                  </tr>
                                )}
                              </tbody>
                            </Table>
                          ) : (
                            <Typography level="body-sm" sx={{ color: '#666' }}>
                              No {endpointName} data for this matchup.
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                    No team stats for this date. Data is stored in the <code>nba_daily_team_stats</code> table.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        ) : (
          // Stats View (default) - Single full-width table
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Table sx={{ bgcolor: '#000000', width: '100%', minWidth: isMobile ? '300px' : '400px' }}>
              <thead>
                <tr>
                  <th style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', minWidth: isMobile ? '140px' : '180px', width: isMobile ? '140px' : '180px', padding: isMobile ? '8px 6px' : '12px' }}>Player</th>
                  {gameState === 'upcoming' && (
                    <>
                      <SortableHeader column="mpg" label="MPG" />
                      <SortableHeader column="ppg" label="PPG" />
                      <SortableHeader column="rpg" label="RPG" />
                      <SortableHeader column="apg" label="APG" />
                      <SortableHeader column="spg" label="SPG" />
                      <SortableHeader column="bpg" label="BPG" />
                      <SortableHeader column="fg_pct" label="FG%" />
                      <SortableHeader column="fg3_pct" label="3P%" />
                      <SortableHeader column="ft_pct" label="FT%" />
          </>
        )}
                  {(gameState === 'live' || gameState === 'completed') && (
                    <>
                      <SortableHeader column="pts" label="PTS" />
                      <SortableHeader column="reb" label="REB" />
                      <SortableHeader column="ast" label="AST" />
                      <SortableHeader column="fantasy_points" label="FP" />
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {gameState === 'upcoming' ? (
                  // Render roster with stats for upcoming games - sorted by minutes played (descending)
                  (() => {
                    if (upcomingStatsLoading) {
                      return (
                        <tr>
                          <td colSpan={12} style={{ textAlign: 'center', padding: '20px' }}>
                            <CircularProgress size="sm" />
                          </td>
                        </tr>
                      );
                    }
                    
                    if (!upcomingPlayerStats || upcomingPlayerStats.length === 0) {
                      // Fallback to roster if no stats available - ensure we only show CURRENT active team players
                      const filteredRoster = (currentRoster || []).filter((player: any) => {
                        if (!currentTeamTricode) return true;
                        const teamOk = player.team_abbreviation === currentTeamTricode;
                        const idOk =
                          !upcomingTeamNbaPlayerIds ||
                          upcomingTeamNbaPlayerIds.size === 0 ||
                          (player.nba_player_id != null && upcomingTeamNbaPlayerIds.has(player.nba_player_id));
                        return teamOk && idOk;
                      });
                      return filteredRoster.map((player) => (
                    <GamePlayerRow
                      key={player.id}
                      player={player}
                      teamTricode={currentTeamTricode || ''}
                      gameState={gameState}
                      navigate={navigate}
                      playerProps={playerProps}
                      injury={playerInjuries?.get(player.nba_player_id)}
                      isMobile={isMobile}
                    />
                      ));
                    }
                    
                    // Map upcoming stats to roster players to get position and jersey number
                    // Filter to ensure we only show players from the CURRENT active team
                    const rosterMap = new Map();
                    (currentRoster || []).forEach((p: any) => {
                      const key = p.player_id || String(p.nba_player_id);
                      rosterMap.set(key, p);
                    });
                    
                    let filteredStats = upcomingPlayerStats.filter((stat) => {
                      if (currentTeamTricode && stat.team_tricode !== currentTeamTricode) return false;
                      if (upcomingTeamNbaPlayerIds && upcomingTeamNbaPlayerIds.size > 0) {
                        return stat.nba_player_id != null && upcomingTeamNbaPlayerIds.has(stat.nba_player_id);
                      }
                      return true;
                    });
                    
                    // Apply sorting
                    if (sortColumn) {
                      filteredStats = [...filteredStats].sort((a, b) => {
                        let aVal: number = 0;
                        let bVal: number = 0;
                        
                        if (sortColumn === 'mpg') {
                          aVal = a.mpg || 0;
                          bVal = b.mpg || 0;
                        } else if (sortColumn === 'ppg') {
                          aVal = a.ppg || 0;
                          bVal = b.ppg || 0;
                        } else if (sortColumn === 'rpg') {
                          aVal = a.rpg || 0;
                          bVal = b.rpg || 0;
                        } else if (sortColumn === 'apg') {
                          aVal = a.apg || 0;
                          bVal = b.apg || 0;
                        } else if (sortColumn === 'spg') {
                          aVal = a.spg || 0;
                          bVal = b.spg || 0;
                        } else if (sortColumn === 'bpg') {
                          aVal = a.bpg || 0;
                          bVal = b.bpg || 0;
                        } else if (sortColumn === 'fg_pct') {
                          aVal = a.fg_pct || 0;
                          bVal = b.fg_pct || 0;
                        } else if (sortColumn === 'fg3_pct') {
                          aVal = a.fg3_pct || 0;
                          bVal = b.fg3_pct || 0;
                        } else if (sortColumn === 'ft_pct') {
                          aVal = a.ft_pct || 0;
                          bVal = b.ft_pct || 0;
                        }
                        
                        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                      });
                    }
                    
                    return filteredStats.map((stat) => {
                      const rosterPlayer = rosterMap.get(stat.player_id || String(stat.nba_player_id));
                      return (
                        <GamePlayerRow
                          key={stat.player_id || stat.nba_player_id}
                          player={{
                            ...stat,
                            position: rosterPlayer?.position,
                            jersey_number: rosterPlayer?.jersey_number,
                            player_id: stat.player_id,
                            nba_player_id: stat.nba_player_id,
                            // Prefer full name from roster if available; fall back to boxscore name
                            player_name: rosterPlayer?.player_name || stat.player_name,
                          }}
                          teamTricode={currentTeamTricode || ''}
                          gameState={gameState}
                          navigate={navigate}
                          playerProps={playerProps}
                          stats={{
                            ppg: stat.ppg,
                            rpg: stat.rpg,
                            apg: stat.apg,
                            mpg: stat.mpg,
                            spg: stat.spg,
                            bpg: stat.bpg,
                            fg_pct: stat.fg_pct,
                            fg3_pct: stat.fg3_pct,
                            ft_pct: stat.ft_pct,
                          }}
                          injury={playerInjuries?.get(stat.nba_player_id)}
                          isMobile={isMobile}
                        />
                      );
                    });
                  })()
                ) : (
                  // Render live/completed game stats
                  (() => {
                    let sortedStats = [...currentTeamStats];
                    
                    // Apply sorting
                    if (sortColumn) {
                      sortedStats.sort((a, b) => {
                        let aVal: number = 0;
                        let bVal: number = 0;
                        
                        let aStats = a.stats || {};
                        if (typeof aStats === 'string') {
                          try {
                            aStats = JSON.parse(aStats);
                          } catch (e) {
                            aStats = {};
                          }
                        }
                        
                        let bStats = b.stats || {};
                        if (typeof bStats === 'string') {
                          try {
                            bStats = JSON.parse(bStats);
                          } catch (e) {
                            bStats = {};
                          }
                        }
                        
                        if (sortColumn === 'pts') {
                          aVal = aStats.pts || 0;
                          bVal = bStats.pts || 0;
                        } else if (sortColumn === 'reb') {
                          aVal = aStats.reb || 0;
                          bVal = bStats.reb || 0;
                        } else if (sortColumn === 'ast') {
                          aVal = aStats.ast || 0;
                          bVal = bStats.ast || 0;
                        } else if (sortColumn === 'fantasy_points') {
                          aVal = a.fantasy_points || 0;
                          bVal = b.fantasy_points || 0;
                        }
                        
                        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                      });
                    } else {
                      // Default sort by fantasy points descending
                      sortedStats.sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0));
                    }
                    
                    return sortedStats.map((player) => {
                      let parsedStats = player.stats || {};
                      if (typeof parsedStats === 'string') {
                        try {
                          parsedStats = JSON.parse(parsedStats);
                        } catch (e) {
                          parsedStats = {};
                        }
                      }
                      return (
                        <GamePlayerRow
                          key={`${player.nba_player_id}-${player.team_tricode}`}
                          player={player}
                          teamTricode={player.team_tricode}
                          gameState={gameState}
                          navigate={navigate}
                          playerProps={playerProps}
                          stats={parsedStats}
                          fantasyPoints={player.fantasy_points}
                          isMobile={isMobile}
                        />
                      );
                    });
                  })()
                )}
              </tbody>
            </Table>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Game Player Row Component
function GamePlayerRow({
  player,
  teamTricode,
  gameState,
  navigate,
  playerProps,
  stats,
  fantasyPoints,
  injury,
  isMobile
}: {
  player: any;
  teamTricode: string;
  gameState: string;
  navigate: (path: string) => void;
  playerProps?: PlayerProp[];
  stats?: any;
  fantasyPoints?: number;
  injury?: any;
  isMobile: boolean;
}) {
  // Prioritize player_id (UUID from nba_players), but fall back to nba_player_id if player_id is null
  // This handles cases where roster.player_id might be null or invalid
  const playerId = player.player_id || (player.nba_player_id ? String(player.nba_player_id) : player.id);
  const nbaPlayerId = player.nba_player_id;
  const playerName = player.player_name;
  const position = player.position || (player as any).position;
  const jerseyNumber = player.jersey_number;
  
  // Fetch season stats for upcoming games (only if stats not provided)
  const { data: seasonStats } = useQuery({
    queryKey: ['player-season-stats-2025-26', playerId],
    queryFn: async () => {
      if (!playerId) return null;
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('min, pts, reb, ast, stl, blk, fgm, fga, fg3m, fg3a, ftm, fta')
        .eq('player_id', playerId)
        .eq('season_year', '2025-26')
        .gte('game_date', '2025-10-21')
        .lte('game_date', '2026-04-12')
        .gt('min', 0);

      if (error) throw error;
      if (!data || data.length === 0) return { 
        ppg: 0, rpg: 0, apg: 0, mpg: 0, spg: 0, bpg: 0, 
        fg_pct: 0, fg3_pct: 0, ft_pct: 0 
      };

      const totals = data.reduce(
        (acc: { 
          min: number; pts: number; reb: number; ast: number; 
          stl: number; blk: number; fgm: number; fga: number;
          fg3m: number; fg3a: number; ftm: number; fta: number;
          games: number 
        }, game) => {
          const min = typeof game.min === 'string' ? parseFloat(game.min) : (game.min || 0);
          acc.min += min;
          acc.pts += game.pts || 0;
          acc.reb += game.reb || 0;
          acc.ast += game.ast || 0;
          acc.stl += game.stl || 0;
          acc.blk += game.blk || 0;
          acc.fgm += game.fgm || 0;
          acc.fga += game.fga || 0;
          acc.fg3m += game.fg3m || 0;
          acc.fg3a += game.fg3a || 0;
          acc.ftm += game.ftm || 0;
          acc.fta += game.fta || 0;
          acc.games += 1;
          return acc;
        },
        { min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, 
          fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, games: 0 }
      );

      return {
        ppg: totals.games > 0 ? totals.pts / totals.games : 0,
        rpg: totals.games > 0 ? totals.reb / totals.games : 0,
        apg: totals.games > 0 ? totals.ast / totals.games : 0,
        mpg: totals.games > 0 ? totals.min / totals.games : 0,
        spg: totals.games > 0 ? totals.stl / totals.games : 0,
        bpg: totals.games > 0 ? totals.blk / totals.games : 0,
        fg_pct: totals.fga > 0 ? totals.fgm / totals.fga : 0,
        fg3_pct: totals.fg3a > 0 ? totals.fg3m / totals.fg3a : 0,
        ft_pct: totals.fta > 0 ? totals.ftm / totals.fta : 0,
      };
    },
    enabled: gameState === 'upcoming' && !!playerId && !stats,
  });
  
  // Use provided stats if available, otherwise use fetched seasonStats
  const displayStats = gameState === 'upcoming' && stats 
    ? { 
        ppg: stats.ppg || 0, 
        rpg: stats.rpg || 0, 
        apg: stats.apg || 0,
        mpg: stats.mpg || 0,
        spg: stats.spg || 0,
        bpg: stats.bpg || 0,
        fg_pct: stats.fg_pct || 0,
        fg3_pct: stats.fg3_pct || 0,
        ft_pct: stats.ft_pct || 0,
      }
    : seasonStats;

  // Check if player has props
  const hasProps = playerProps?.some(p => 
    (p.nba_player_id === nbaPlayerId) || (p.player_id === playerId)
  ) || false;

  return (
    <tr
      onClick={() => playerId && navigate(`/player/${playerId}`)}
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid #333333',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 199, 44, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <td style={{ 
        minWidth: isMobile ? '140px' : '180px', 
        width: isMobile ? '140px' : '180px', 
        maxWidth: isMobile ? '140px' : '180px',
        padding: isMobile ? '8px 6px' : '12px'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.25, md: 0.5 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: isMobile ? '24px' : '30px', flexShrink: 0 }}>
            {jerseyNumber && (
              <Typography sx={{ color: '#FFFFFF', fontSize: isMobile ? '0.6rem' : '0.7rem', fontWeight: 'bold', lineHeight: 1 }}>
                #{jerseyNumber}
              </Typography>
            )}
            {position && (
              <Typography sx={{ color: '#CCCCCC', fontSize: isMobile ? '0.55rem' : '0.65rem', lineHeight: 1 }}>
                {position}
              </Typography>
            )}
          </Box>
          <Avatar
            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${nbaPlayerId}.png`}
            alt={playerName}
            sx={{ width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 }, flexShrink: 0 }}
          />
          <Box sx={{ flex: 1, minWidth: isMobile ? '90px' : '120px', maxWidth: isMobile ? '100px' : '130px', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography sx={{ 
            color: '#FFFFFF', 
            fontSize: isMobile ? '0.65rem' : '0.75rem',
            whiteSpace: 'nowrap',
            overflow: 'visible',
          }}>
            {playerName}
          </Typography>
            {injury && injury.injury_status === 'Out' && (
              <Chip
                size="sm"
                color="danger"
                variant="solid"
                sx={{ 
                  fontSize: isMobile ? '0.55rem' : '0.65rem', 
                  height: isMobile ? '14px' : '16px',
                  fontWeight: 'bold',
                  alignSelf: 'flex-start'
                }}
              >
                {injury.injury_status}
              </Chip>
            )}
            {injury && (injury.injury_status === 'Questionable' || injury.injury_status === 'Day-to-Day') && (
              <Chip
                size="sm"
                color="warning"
                variant="solid"
                sx={{ 
                  fontSize: isMobile ? '0.55rem' : '0.65rem', 
                  height: isMobile ? '14px' : '16px',
                  fontWeight: 'bold',
                  alignSelf: 'flex-start'
                }}
              >
                {injury.injury_status}
              </Chip>
            )}
          </Box>
        </Box>
      </td>
      {gameState === 'upcoming' && (
        <>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'mpg' in displayStats ? (displayStats.mpg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#FFC72C', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', fontWeight: 600, padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats ? (displayStats.ppg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats ? (displayStats.rpg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats ? (displayStats.apg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'spg' in displayStats ? (displayStats.spg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'bpg' in displayStats ? (displayStats.bpg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'fg_pct' in displayStats && displayStats.fg_pct !== undefined 
              ? (displayStats.fg_pct * 100).toFixed(1) + '%' 
              : 'N/A'}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'fg3_pct' in displayStats && displayStats.fg3_pct !== undefined 
              ? (displayStats.fg3_pct * 100).toFixed(1) + '%' 
              : 'N/A'}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'ft_pct' in displayStats && displayStats.ft_pct !== undefined 
              ? (displayStats.ft_pct * 100).toFixed(1) + '%' 
              : 'N/A'}
          </td>
        </>
      )}
      {(gameState === 'live' || gameState === 'completed') && (
        <>
          <td style={{ color: '#FFC72C', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', fontWeight: 600, padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {stats?.pts || 0}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {stats?.reb || 0}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {stats?.ast || 0}
          </td>
          <td style={{ color: '#FFFFFF', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {fantasyPoints?.toFixed(1) || '0.0'}
          </td>
        </>
      )}
    </tr>
  );
}
