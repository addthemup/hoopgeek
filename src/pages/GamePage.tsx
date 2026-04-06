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
import { ArrowBack, NavigateBefore, NavigateNext, CalendarToday, EmojiEvents, BarChart, TrendingUp, Analytics, ArrowUpward, ArrowDownward, Shield, Add } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { supabase } from '../utils/supabase';
import { getTeamColors, getTeamPrimaryColor, getTeamSecondaryColor } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { FANDUEL_SCORING } from '../utils/fantasyScoring';
import { calculatePropResult } from '../utils/playerPropsCalculator';
import { filterFullGameProps } from '../utils/playerPropsFilter';
import { hexToRgba } from '../utils/colorUtils';
import BoxScore from '../components/BoxScore';
import { matchPlayerNames } from '../utils/playerNameMatcher';
import { loadGameJson, getScoreData, getFunScore, getLeadChanges, getDunkStats, getScoringMilestones, getTeamStats, getStoryData, getQuarterScores, type GameJsonData } from '../utils/gameJsonLoader';
import PropPerformanceCell from '../components/PropPerformanceCell';
import { useOpponentTeamPropsPerformance } from '../hooks/useOpponentTeamPropsPerformance';
import { usePredictorStats } from '../hooks/usePredictorStats';
import GamePageLayout from '../components/Feed/GamePageLayout';
import { useGameDrawer } from '../components/Feed/GamePageLayout';
import { useGameModuleVisibility, DEFAULT_GAME_MODULES } from '../hooks/useGameModuleVisibility';
import { useSlipBuilder, propToSlipLeg } from '../contexts/SlipBuilderContext';
import { useFeedDrawerRestoreOptional } from '../contexts/FeedDrawerRestoreContext';
import { useEstimatedRotation } from '../hooks/useEstimatedRotation';
import EstimatedRotationModule from '../components/Game/EstimatedRotationModule';
import { buildTeamExploitations, getBetTypeForMatchupEndpoint } from '../utils/exploitationScoring';
import { fetchTeamOutPlayersFromRecentRotations } from '../utils/teamOutPlayersFromRotation';
import { fetchTeamAverageRotationSize } from '../utils/teamRotationSize';
import { formatESTTime } from '../utils/nbaDateUtils';
import { resolveGameTeamLines, moneylineToApproxSpread, parseAmericanOddsNumber, formatAmericanOdds, type TeamLinesByGame } from '../utils/gameOddsResolver';
import { MATCHUP_FACTORS } from '../utils/matchupFactors';
import { predictorTeamNameToTricode } from '../utils/predictorTeamNameToTricode';
import { ExploitsDashboard, type ExploitSidebarRow, type ExploitChartType } from '../components/kibo-ui/exploits-dashboard';

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
  home_spread?: number | null;
  away_spread?: number | null;
  over_under?: number | null;
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
  game_id?: string;
  game_date?: string;
}

interface GameHighlightClip {
  id: string;
  game_id: string;
  period: number | null;
  clock: string | null;
  description: string | null;
  action_type: string | null;
  player_name: string | null;
  team_tricode: string | null;
  mp4_url: string;
}

type PropsVsTeamModalData = {
  teamTricode: string;
  label: string;
  data: NonNullable<ReturnType<typeof useOpponentTeamPropsPerformance>['data']>;
} | null;

const normalizeBetType = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[+\s]/g, '_')
    .replace(/__+/g, '_')
    .trim();

const canonicalizeBetType = (value: string) =>
  normalizeBetType(value).replace(/[^a-z0-9]/g, '');

const expandBetTypeAliases = (value: string) => {
  const normalized = normalizeBetType(value);
  const aliases = new Set<string>([normalized]);
  if (normalized === 'points') aliases.add('point');
  if (normalized === 'rebounds') aliases.add('rebound');
  if (normalized === 'assists') aliases.add('assist');
  if (normalized === 'threes') {
    aliases.add('three');
    aliases.add('threepointersmade');
  }
  if (normalized === 'threepointersmade') aliases.add('threes');
  if (normalized === 'blocks_steals') {
    aliases.add('stocks');
    aliases.add('steals_blocks');
    aliases.add('blocks+steals');
  }
  if (normalized === 'points_rebounds_assists') aliases.add('pra');
  if (normalized === 'points_rebounds') aliases.add('pr');
  if (normalized === 'points_assists') aliases.add('pa');
  if (normalized === 'rebounds_assists') aliases.add('ra');
  return aliases;
};

// Assign chart styles intentionally across all 16 strategy categories.
const EXPLOIT_CHART_SEQUENCE: ExploitChartType[] = [
  'radar',
  'line',
  'bar',
  'area',
  'radial',
  'pie',
  'bar',
  'line',
  'radar',
  'radial',
  'pie',
  'bar',
  'line',
  'area',
  'radar',
  'radial',
];

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
              <Typography level="title-lg" sx={{ color: '#fff', mb: 1 }}>
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

export interface GamePageProps {
  /** When provided (e.g. embedded in feed with ?game=), use this instead of route params. */
  gameId?: string;
  /** When true, use compact layout (no large top padding) for embedding in feed below the filter bar. */
  embeddedInFeed?: boolean;
}

export default function GamePage(props: GamePageProps = {}) {
  const { id: paramId } = useParams<{ id: string }>();
  const gameId = props.gameId ?? paramId ?? undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isLandscapeMobile = isLandscape && isMobile;
  const textScale = 1.1;
  const { addLeg: addToSlip, canAddPlayer: canAddPlayerToSlip } = useSlipBuilder();
  const gameDrawer = useGameDrawer();
  const feedRestore = useFeedDrawerRestoreOptional();

  const storageReturnPath = (() => {
    try {
      return window.sessionStorage.getItem('hoopgeek:returnPath') || undefined;
    } catch {
      return undefined;
    }
  })();
  const storageReturnDate = (() => {
    try {
      return window.sessionStorage.getItem('hoopgeek:returnDate') || undefined;
    } catch {
      return undefined;
    }
  })();
  
  // Optional return path from caller; otherwise fall back to browser history/root.
  const returnPath = ((location.state as any)?.returnPath as string | undefined) || storageReturnPath;
  const returnDate = (location.state as any)?.returnDate || storageReturnDate;

  // Handle back navigation
  function handleBack() {
    try {
      window.sessionStorage.removeItem('hoopgeek:returnPath');
      window.sessionStorage.removeItem('hoopgeek:returnDate');
    } catch {
      // ignore storage errors
    }
    if (returnPath) {
      navigate(returnPath, {
        state: returnDate ? { selectedDate: returnDate } : undefined
      });
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  }
  
  // Get game date and set up date navigation
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => {
    if (returnDate) return dayjs(returnDate);
    return dayjs();
  });

  // Team toggle state - restore per-game selection when available.
  const [selectedTeam, setSelectedTeam] = useState<'away' | 'home'>(() => {
    try {
      const saved = window.sessionStorage.getItem(`hoopgeek:game:selectedTeam:${gameId ?? 'unknown'}`);
      return saved === 'home' ? 'home' : 'away';
    } catch {
      return 'away';
    }
  });
  const [statsTab, setStatsTab] = useState<'box_score' | 'basic' | 'advanced' | 'props' | 'hit_rates' | 'estimated_rotation' | 'exploits'>('basic');
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [canQueryGameHighlights, setCanQueryGameHighlights] = useState(true);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(`hoopgeek:game:selectedTeam:${gameId ?? 'unknown'}`);
      if (saved === 'home' || saved === 'away') {
        setSelectedTeam(saved);
        return;
      }
    } catch {
      // ignore storage errors
    }
    setSelectedTeam('away');
  }, [gameId]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(`hoopgeek:game:selectedTeam:${gameId ?? 'unknown'}`, selectedTeam);
    } catch {
      // ignore storage errors
    }
  }, [gameId, selectedTeam]);
  
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
  const STAT_COLUMN_MIN = 56;
  const SortableHeader = ({ column, label }: { column: string; label: string }) => {
    const isSorted = sortColumn === column;
    return (
      <th 
        style={{ 
          color: '#334155',
          fontSize: isMobile ? '0.65rem' : '0.75rem', 
          textAlign: 'right',
          cursor: 'pointer',
          userSelect: 'none',
          padding: isMobile ? '6px 3px' : '8px 4px',
          minWidth: STAT_COLUMN_MIN,
          width: STAT_COLUMN_MIN,
        }}
        onClick={() => handleSort(column)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
          <span>{label}</span>
          {isSorted && (
            sortDirection === 'asc' ? (
              <ArrowUpward sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', color: '#2563eb' }} />
            ) : (
              <ArrowDownward sx={{ fontSize: isMobile ? '0.7rem' : '0.875rem', color: '#2563eb' }} />
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
        .select('game_id, game_status, game_status_text, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_date, arena_name, arena_city, home_spread, away_spread, over_under')
        .eq('game_id', cleanGameId)
        .maybeSingle();
      
      // If not found, try without leading zeros (in case of format mismatch)
      if (!data && !error && cleanGameId.startsWith('00')) {
        const withoutLeadingZeros = cleanGameId.replace(/^0+/, '');
        console.log('🔍 Game not found, trying without leading zeros:', withoutLeadingZeros);
        const { data: altData, error: altError } = await supabase
          .from('nba_games')
          .select('game_id, game_status, game_status_text, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_date, arena_name, arena_city, home_spread, away_spread, over_under')
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
    enabled: !!predictorDateKey && !!gameData?.home_team_tricode && !!gameData?.away_team_tricode,
  });

  // Determine game state - compute this first so it can be used in enabled conditions
  const gameState = useMemo(() => {
    if (!gameData) return 'loading';
    const statusText = String(gameData.game_status_text ?? '').trim().toLowerCase();
    const isLiveByText =
      statusText.includes('live') ||
      statusText.includes('in progress') ||
      /\bq[1-4]\b/.test(statusText) ||
      statusText.includes('half') ||
      statusText.includes('ot');
    const isFinalByText = statusText.startsWith('final');

    if (gameData.game_status === 1 && isLiveByText) return 'live';
    if ((gameData.game_status === 1 || gameData.game_status === 2) && isFinalByText) return 'completed';
    if (gameData.game_status === 1) return 'upcoming';
    if (gameData.game_status === 2) return 'live';
    return 'completed';
  }, [gameData]);
  const gameHasStarted = gameState === 'live' || gameState === 'completed';

  useEffect(() => {
    if (!gameHasStarted && statsTab === 'box_score') {
      setStatsTab('basic');
    }
  }, [gameHasStarted, statsTab]);

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
  
  // Set default sort column based on gameState
  useEffect(() => {
    if (!sortColumn && gameState && gameState !== 'loading') {
      if (gameState === 'upcoming') {
        setSortColumn('mpg');
      } else {
        setSortColumn('fantasy_points');
      }
    }
  }, [gameState, sortColumn]);

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

  // Fetch persisted MP4 highlight clips for the game.
  const { data: gameHighlightClips, isLoading: gameHighlightClipsLoading } = useQuery<GameHighlightClip[]>({
    queryKey: ['game-highlight-clips', gameId],
    queryFn: async () => {
      if (!gameId) return [];

      const { data, error } = await supabase
        .from('game_highlight_clips')
        .select('id, game_id, period, clock, description, action_type, player_name, team_tricode, mp4_url')
        .eq('game_id', gameId)
        .order('period', { ascending: true })
        .order('id', { ascending: true })
        .limit(60);

      if (error) {
        // Some environments may not have this table yet; fail soft without noisy console spam.
        if (error.code === 'PGRST205') {
          setCanQueryGameHighlights(false);
          return [];
        }
        if (error.code !== 'PGRST205') {
          console.error('Error fetching game highlight clips:', error);
        }
        return [];
      }

      return (data ?? []) as GameHighlightClip[];
    },
    enabled: !!gameId && canQueryGameHighlights,
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
        .select('id, game_id, bet_type, line, price, american_odds, bookmaker, player_name, nba_player_id, player_id, bet_type_id, raw_odd_data')
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
  const formatSpreadForHeader = (value: number | null | undefined): string => {
    if (value == null || Number.isNaN(value)) return '--';
    return `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}`;
  };
  const formatSpreadWithOddsForHeader = (
    spread: number | null | undefined,
    odds: string | null | undefined
  ): string => {
    const spreadText = formatSpreadForHeader(spread);
    if (!odds) return spreadText;
    return `${spreadText} (${odds})`;
  };

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

  // Build a set of players who logged minutes in this team's last 5 games.
  const { data: last5ActiveTeamPlayerIds } = useQuery<Set<number>>({
    queryKey: ['game-last5-active-player-ids', currentTeamTricode, gameData?.game_date],
    queryFn: async () => {
      if (!currentTeamTricode) return new Set<number>();

      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('game_id, game_date, nba_player_id, min')
        .eq('team_tricode', currentTeamTricode)
        .gt('min', 0)
        .order('game_date', { ascending: false })
        .limit(220);

      if (error) {
        console.error('Error fetching last 5 active team players:', error);
        return new Set<number>();
      }

      const gameIds = new Set<string>();
      const selectedRows: any[] = [];
      for (const row of data || []) {
        if (!row.game_id) continue;
        if (!gameIds.has(row.game_id) && gameIds.size >= 5) continue;
        gameIds.add(row.game_id);
        selectedRows.push(row);
      }

      const playerIds = new Set<number>();
      selectedRows.forEach((row) => {
        if (row.nba_player_id != null) {
          playerIds.add(row.nba_player_id);
        }
      });
      return playerIds;
    },
    enabled: !!currentTeamTricode,
  });

  // Build active player-id sets for both teams (same source of truth as Basic).
  const { data: activeTeamPlayerIdsByTricode } = useQuery<Map<string, Set<number>>>({
    queryKey: [
      'game-active-player-ids-by-team',
      gameData?.home_team_tricode,
      gameData?.away_team_tricode,
      gameState,
    ],
    queryFn: async () => {
      const teams = [gameData?.home_team_tricode, gameData?.away_team_tricode]
        .map((t) => String(t ?? '').trim().toUpperCase())
        .filter(Boolean);
      const out = new Map<string, Set<number>>();
      teams.forEach((t) => out.set(t, new Set<number>()));
      if (!teams.length || gameState !== 'upcoming') return out;

      const { data, error } = await supabase
        .from('nba_players')
        .select('nba_player_id, team_abbreviation, is_active')
        .in('team_abbreviation', teams)
        .eq('is_active', true);
      if (error) {
        console.error('Error fetching active player ids by team:', error);
        return out;
      }

      (data || []).forEach((row: any) => {
        const team = String(row.team_abbreviation ?? '').trim().toUpperCase();
        const id = Number(row.nba_player_id);
        if (!team || !Number.isFinite(id)) return;
        const set = out.get(team) ?? new Set<number>();
        set.add(id);
        out.set(team, set);
      });
      return out;
    },
    enabled: gameState === 'upcoming' && !!gameData,
  });

  // Build recent-activity sets (last 5 team games) for both teams.
  const { data: last5ActivePlayerIdsByTricode } = useQuery<Map<string, Set<number>>>({
    queryKey: [
      'game-last5-active-player-ids-by-team',
      gameData?.home_team_tricode,
      gameData?.away_team_tricode,
      gameData?.game_date,
      gameState,
    ],
    queryFn: async () => {
      const teams = [gameData?.home_team_tricode, gameData?.away_team_tricode]
        .map((t) => String(t ?? '').trim().toUpperCase())
        .filter(Boolean);
      const out = new Map<string, Set<number>>();
      teams.forEach((t) => out.set(t, new Set<number>()));
      if (!teams.length || gameState !== 'upcoming') return out;

      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('team_tricode, game_id, game_date, nba_player_id, min')
        .in('team_tricode', teams)
        .gt('min', 0)
        .order('game_date', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching last 5 active players by team:', error);
        return out;
      }

      teams.forEach((team) => {
        const teamRows = (data || []).filter((row: any) => String(row.team_tricode ?? '').trim().toUpperCase() === team);
        const gameIds = new Set<string>();
        const playerIds = new Set<number>();
        for (const row of teamRows) {
          const gameId = String(row.game_id ?? '').trim();
          if (!gameId) continue;
          if (!gameIds.has(gameId) && gameIds.size >= 5) continue;
          gameIds.add(gameId);
          const id = Number(row.nba_player_id);
          if (Number.isFinite(id)) playerIds.add(id);
        }
        out.set(team, playerIds);
      });

      return out;
    },
    enabled: gameState === 'upcoming' && !!gameData,
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

  // Pull game-line context from player_props_games.raw_event_data to mirror feed line cards.
  const { data: headerRawLines } = useQuery<TeamLinesByGame | null>({
    queryKey: ['game-header-raw-lines', gameId, gameData?.game_date, gameData?.home_team_tricode, gameData?.away_team_tricode],
    queryFn: async () => {
      if (!gameData?.game_date || !gameData?.home_team_tricode || !gameData?.away_team_tricode) return null;

      const gameDate = String(gameData.game_date).slice(0, 10);
      const homeTri = String(gameData.home_team_tricode).trim().toUpperCase();
      const awayTri = String(gameData.away_team_tricode).trim().toUpperCase();
      const datesToTry = [gameDate];
      try {
        const d = new Date(gameDate);
        const prev = new Date(d); prev.setDate(prev.getDate() - 1);
        const next = new Date(d); next.setDate(next.getDate() + 1);
        datesToTry.push(prev.toISOString().slice(0, 10), next.toISOString().slice(0, 10));
      } catch (_) {}

      let matchedRow: any = null;
      for (const d of [...new Set(datesToTry)]) {
        const { data: rows, error } = await supabase
          .from('player_props_games')
          .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, raw_event_data')
          .eq('game_date', d)
          .limit(30);
        if (error || !rows?.length) continue;

        const byGameId = rows.find((r: any) => String(r.nba_game_id || '') === String(gameId || ''));
        if (byGameId) {
          matchedRow = byGameId;
          break;
        }

        const byTricode = rows.find((r: any) => {
          const rHome = String(r.home_team_tricode || '').trim().toUpperCase();
          const rAway = String(r.away_team_tricode || '').trim().toUpperCase();
          return (rHome === homeTri && rAway === awayTri) || (rHome === awayTri && rAway === homeTri);
        });
        if (byTricode) {
          matchedRow = byTricode;
          break;
        }
      }

      if (!matchedRow?.raw_event_data) return null;
      let raw = matchedRow.raw_event_data as any;
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch {
          return null;
        }
      }
      const odds = raw?.odds as Record<string, Record<string, unknown>> | undefined;
      if (!odds) return null;

      let homeSpread: number | null = null;
      let awaySpread: number | null = null;
      let homeSpreadOdds: string | null = null;
      let awaySpreadOdds: string | null = null;
      let homeMoneyline: number | null = null;
      let awayMoneyline: number | null = null;
      let homeMoneylineOdds: string | null = null;
      let awayMoneylineOdds: string | null = null;

      for (const [key, odd] of Object.entries(odds)) {
        if (!odd || typeof odd !== 'object') continue;
        const side = String(odd.sideID || '');
        const marketName = String(odd.marketName || '').toLowerCase();
        const betType = String(odd.betTypeID || '').toLowerCase();
        const keyLower = String(key || '').toLowerCase();
        const oddsText = formatAmericanOdds(odd.bookOdds ?? odd.openBookOdds);
        const oddsNum = parseAmericanOddsNumber(odd.bookOdds ?? odd.openBookOdds);

        const isSpread = marketName.includes('spread') || betType === 'spread' || keyLower.includes('spread');
        if (isSpread) {
          const spreadNum = odd.bookSpread != null
            ? Number(odd.bookSpread)
            : odd.openBookSpread != null
              ? Number(odd.openBookSpread)
              : NaN;
          if (!Number.isNaN(spreadNum)) {
            if (side === 'home') {
              homeSpread = spreadNum;
              homeSpreadOdds = oddsText;
            } else if (side === 'away') {
              awaySpread = spreadNum;
              awaySpreadOdds = oddsText;
            }
          }
        }

        const isMoneyline = marketName.includes('moneyline') || betType.includes('ml') || keyLower.includes('-ml-') || keyLower.includes('moneyline');
        if (isMoneyline && oddsNum != null) {
          if (side === 'home') {
            homeMoneyline = oddsNum;
            homeMoneylineOdds = oddsText;
          } else if (side === 'away') {
            awayMoneyline = oddsNum;
            awayMoneylineOdds = oddsText;
          }
        }
      }

      if (homeSpread != null && awaySpread == null) awaySpread = -homeSpread;
      if (awaySpread != null && homeSpread == null) homeSpread = -awaySpread;
      if (homeSpread == null && awaySpread == null && homeMoneyline != null && awayMoneyline != null) {
        const derived = moneylineToApproxSpread(homeMoneyline, awayMoneyline);
        if (derived) {
          homeSpread = derived.homeSpread;
          awaySpread = derived.awaySpread;
          if (homeSpreadOdds == null) homeSpreadOdds = homeMoneylineOdds;
          if (awaySpreadOdds == null) awaySpreadOdds = awayMoneylineOdds;
        }
      }

      if (homeSpread == null && awaySpread == null) return null;
      return {
        homeSpread: homeSpread ?? -awaySpread!,
        awaySpread: awaySpread ?? -homeSpread!,
        homeSpreadOdds,
        awaySpreadOdds,
        homeMoneyline,
        awayMoneyline,
        homeMoneylineOdds,
        awayMoneylineOdds,
      };
    },
    enabled: !!gameData?.game_date && !!gameData?.home_team_tricode && !!gameData?.away_team_tricode,
    staleTime: 2 * 60 * 1000,
  });

  const headerTeamLines = useMemo(() => {
    if (!gameData) {
      return {
        awaySpread: null as number | null,
        homeSpread: null as number | null,
        awaySpreadOdds: null as string | null,
        homeSpreadOdds: null as string | null,
      };
    }
    const resolved = resolveGameTeamLines({
      homeTricode: gameData.home_team_tricode,
      awayTricode: gameData.away_team_tricode,
      gameProps: playerProps || [],
      initial: {
        homeSpread: headerRawLines?.homeSpread ?? gameData.home_spread ?? null,
        awaySpread: headerRawLines?.awaySpread ?? gameData.away_spread ?? null,
        homeSpreadOdds: headerRawLines?.homeSpreadOdds ?? null,
        awaySpreadOdds: headerRawLines?.awaySpreadOdds ?? null,
      },
    });
    return {
      awaySpread: resolved.awaySpread,
      homeSpread: resolved.homeSpread,
      awaySpreadOdds: resolved.awaySpreadOdds,
      homeSpreadOdds: resolved.homeSpreadOdds,
    };
  }, [gameData, playerProps, headerRawLines]);

  const { data: headerStandingsMap } = useQuery({
    queryKey: ['game-header-standings', gameData?.home_team_tricode, gameData?.away_team_tricode, gameData?.game_date],
    queryFn: async () => {
      if (!gameData?.home_team_tricode || !gameData?.away_team_tricode) return new Map<string, { wins: number; losses: number }>();
      const currentDate = gameData?.game_date ? new Date(gameData.game_date) : new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const season = month >= 10
        ? `${year}-${(year + 1).toString().slice(-2)}`
        : `${year - 1}-${year.toString().slice(-2)}`;

      const { data } = await supabase
        .from('nba_standings')
        .select('team_abbreviation, wins, losses')
        .eq('season', season)
        .in('team_abbreviation', [gameData.home_team_tricode, gameData.away_team_tricode]);

      const map = new Map<string, { wins: number; losses: number }>();
      (data || []).forEach((team: any) => {
        map.set(team.team_abbreviation, { wins: team.wins || 0, losses: team.losses || 0 });
      });
      return map;
    },
    enabled: !!gameData?.home_team_tricode && !!gameData?.away_team_tricode,
    staleTime: 10 * 60 * 1000,
  });

  const handleAddPropToSlip = useCallback(
    (prop: PlayerProp, side: 'over' | 'under' = 'over') => {
      const leg = propToSlipLeg({
        ...prop,
        displaySide: side,
        displayOdds: prop.american_odds || prop.price,
        game_id: prop.game_id,
        game_date: gameData?.game_date,
      });
      if (!leg) return;
      const result = addToSlip(leg);
      if (result.added) {
        if (feedRestore) {
          feedRestore.goToProfileSlipBuilderAfterAdd({
            feedDrawerTab: 'props',
            drawerProfileMode: false,
            moduleName: 'prop_predictions_over',
            propUi: {
              mainTab: 'hit_rate',
              activeTab: 'hottest',
              propTypeFilter: 'all',
              hitRatePage: 1,
              teamConfidencePage: 1,
              playerConfidencePage: 1,
            },
            dateString: selectedDate.format('YYYY-MM-DD'),
          });
        } else {
          gameDrawer?.openDrawer();
        }
      }
    },
    [addToSlip, gameData?.game_date, gameId, feedRestore, gameDrawer, selectedDate]
  );

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

  const advancedMpgByKey = useMemo(() => {
    const map = new Map<string, number>();

    if (gameState === 'upcoming') {
      (upcomingPlayerStats || []).forEach((player: any) => {
        const mpg = Number(player?.mpg || 0);
        if (!Number.isFinite(mpg) || mpg <= 0) return;
        if (player.player_id) map.set(`id:${player.player_id}`, mpg);
        if (player.nba_player_id) map.set(`nba:${player.nba_player_id}`, mpg);
      });
      return map;
    }

    (currentTeamStats || []).forEach((player: any) => {
      const stats = typeof player.stats === 'string'
        ? (() => {
            try {
              return JSON.parse(player.stats);
            } catch {
              return {};
            }
          })()
        : (player.stats || {});
      const min = Number(stats?.min || 0);
      if (!Number.isFinite(min) || min <= 0) return;
      if (player.player_id) map.set(`id:${player.player_id}`, min);
      if (player.nba_player_id) map.set(`nba:${player.nba_player_id}`, min);
    });

    return map;
  }, [gameState, upcomingPlayerStats, currentTeamStats]);

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
        .in('injury_status', ['Out', 'Questionable', 'Probable', 'Day-to-Day'])
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

  const bestPropByPlayer = useMemo(() => {
    const map = new Map<number, PlayerProp>();
    teamProps.forEach((prop) => {
      if (!prop.nba_player_id) return;
      const existing = map.get(prop.nba_player_id);
      if (!existing || Number(prop.line ?? 0) > Number(existing.line ?? 0)) {
        map.set(prop.nba_player_id, prop);
      }
    });
    return map;
  }, [teamProps]);

  const filteredHomeRosterForEstimatedRotation = useMemo(() => {
    const team = String(gameData?.home_team_tricode ?? '').trim().toUpperCase();
    const activeIds = team ? activeTeamPlayerIdsByTricode?.get(team) : undefined;
    const recentIds = team ? last5ActivePlayerIdsByTricode?.get(team) : undefined;
    return (homeRoster ?? []).filter((player: any) => {
      const id = player.nba_player_id;
      const activeOk = !activeIds || activeIds.size === 0 || (id != null && activeIds.has(id));
      const recentOk = !recentIds || recentIds.size === 0 || (id != null && recentIds.has(id));
      return activeOk && recentOk;
    });
  }, [homeRoster, gameData?.home_team_tricode, activeTeamPlayerIdsByTricode, last5ActivePlayerIdsByTricode]);

  const filteredAwayRosterForEstimatedRotation = useMemo(() => {
    const team = String(gameData?.away_team_tricode ?? '').trim().toUpperCase();
    const activeIds = team ? activeTeamPlayerIdsByTricode?.get(team) : undefined;
    const recentIds = team ? last5ActivePlayerIdsByTricode?.get(team) : undefined;
    return (awayRoster ?? []).filter((player: any) => {
      const id = player.nba_player_id;
      const activeOk = !activeIds || activeIds.size === 0 || (id != null && activeIds.has(id));
      const recentOk = !recentIds || recentIds.size === 0 || (id != null && recentIds.has(id));
      return activeOk && recentOk;
    });
  }, [awayRoster, gameData?.away_team_tricode, activeTeamPlayerIdsByTricode, last5ActivePlayerIdsByTricode]);

  const { data: averageRotationSizeByTeam } = useQuery({
    queryKey: [
      'game-avg-rotation-size-by-team',
      gameData?.home_team_tricode,
      gameData?.away_team_tricode,
      gameData?.game_date,
      gameState,
    ],
    queryFn: async () => {
      if (!gameData) return new Map();
      return fetchTeamAverageRotationSize({
        teamTricodes: [gameData.home_team_tricode, gameData.away_team_tricode],
        asOfDate: gameData.game_date,
        lookbackGames: 10,
      });
    },
    enabled: gameState === 'upcoming' && !!gameData,
    staleTime: 10 * 60 * 1000,
  });

  const homeRotationSizeTarget = useMemo(() => {
    const tri = String(gameData?.home_team_tricode ?? '').trim().toUpperCase();
    const avg = tri ? averageRotationSizeByTeam?.get(tri)?.averageRotationSize : undefined;
    if (typeof avg !== 'number' || !Number.isFinite(avg) || avg <= 0) return null;
    return Math.max(5, Math.min(12, Math.round(avg)));
  }, [gameData?.home_team_tricode, averageRotationSizeByTeam]);

  const awayRotationSizeTarget = useMemo(() => {
    const tri = String(gameData?.away_team_tricode ?? '').trim().toUpperCase();
    const avg = tri ? averageRotationSizeByTeam?.get(tri)?.averageRotationSize : undefined;
    if (typeof avg !== 'number' || !Number.isFinite(avg) || avg <= 0) return null;
    return Math.max(5, Math.min(12, Math.round(avg)));
  }, [gameData?.away_team_tricode, averageRotationSizeByTeam]);

  const { data: outPlayersByTeamForEstimator } = useQuery({
    queryKey: [
      'game-out-players-by-team',
      gameData?.game_date,
      gameData?.away_team_tricode,
      gameData?.home_team_tricode,
    ],
    queryFn: async (): Promise<Map<string, Array<{ nbaPlayerId: number; playerName: string; teamTricode: string }>>> => {
      if (!gameData) return new Map();
      const teamTricodes = [gameData.away_team_tricode, gameData.home_team_tricode]
        .map((t) => String(t ?? '').trim().toUpperCase())
        .filter(Boolean);
      if (!teamTricodes.length) return new Map();
      return fetchTeamOutPlayersFromRecentRotations({
        teamTricodes,
        asOfDate: gameData.game_date,
        lookbackGames: 5,
      });
    },
    enabled: gameState === 'upcoming' && !!gameData,
    staleTime: 5 * 60 * 1000,
  });

  const homeForcedOutPlayerIds = useMemo(() => {
    const tri = String(gameData?.home_team_tricode ?? '').trim().toUpperCase();
    const players = tri ? outPlayersByTeamForEstimator?.get(tri) ?? [] : [];
    return players.map((p) => p.nbaPlayerId).filter((id) => Number.isFinite(id));
  }, [gameData?.home_team_tricode, outPlayersByTeamForEstimator]);

  const awayForcedOutPlayerIds = useMemo(() => {
    const tri = String(gameData?.away_team_tricode ?? '').trim().toUpperCase();
    const players = tri ? outPlayersByTeamForEstimator?.get(tri) ?? [] : [];
    return players.map((p) => p.nbaPlayerId).filter((id) => Number.isFinite(id));
  }, [gameData?.away_team_tricode, outPlayersByTeamForEstimator]);

  const { data: estimatedRotation, isLoading: estimatedRotationLoading } = useEstimatedRotation({
    enabled: gameState === 'upcoming' && !!gameData,
    gameDate: gameData?.game_date,
    homeTricode: gameData?.home_team_tricode,
    awayTricode: gameData?.away_team_tricode,
    homeRoster: filteredHomeRosterForEstimatedRotation.map((p) => ({
      nba_player_id: p.nba_player_id,
      player_id: p.player_id,
      player_name: p.player_name,
      position: p.position,
      jersey_number: p.jersey_number,
    })),
    awayRoster: filteredAwayRosterForEstimatedRotation.map((p) => ({
      nba_player_id: p.nba_player_id,
      player_id: p.player_id,
      player_name: p.player_name,
      position: p.position,
      jersey_number: p.jersey_number,
    })),
    lookbackGames: 8,
    homeRotationSizeTarget,
    awayRotationSizeTarget,
    homeForcedOutPlayerIds,
    awayForcedOutPlayerIds,
  });

  const { data: outPlayersByTeam, isLoading: outPlayersLoading } = useQuery({
    queryKey: [
      'game-out-players-by-team',
      gameData?.game_date,
      gameData?.away_team_tricode,
      gameData?.home_team_tricode,
    ],
    queryFn: async (): Promise<Map<string, Array<{ nbaPlayerId: number; playerName: string; teamTricode: string }>>> => {
      if (!gameData) return new Map();
      const teamTricodes = [gameData.away_team_tricode, gameData.home_team_tricode]
        .map((t) => String(t ?? '').trim().toUpperCase())
        .filter(Boolean);
      if (!teamTricodes.length) return new Map();
      return fetchTeamOutPlayersFromRecentRotations({
        teamTricodes,
        asOfDate: gameData.game_date,
        lookbackGames: 5,
      });
    },
    enabled: gameState === 'upcoming' && !!gameData,
    staleTime: 5 * 60 * 1000,
  });

  const selectedTeamOutPlayers = useMemo(() => {
    if (!gameData) return [];
    const tri = selectedTeam === 'away' ? gameData.away_team_tricode : gameData.home_team_tricode;
    return outPlayersByTeam?.get(String(tri ?? '').trim().toUpperCase()) ?? [];
  }, [gameData, selectedTeam, outPlayersByTeam]);

  const selectedTeamOutPlayerIds = useMemo(() => {
    return new Set<number>(
      selectedTeamOutPlayers
        .map((player) => Number(player.nbaPlayerId))
        .filter((id) => Number.isFinite(id))
    );
  }, [selectedTeamOutPlayers]);
  const selectedTeamOutPlayerNamesNormalized = useMemo(() => {
    const normalize = (name: string) =>
      String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return new Set<string>(
      selectedTeamOutPlayers
        .map((player) => normalize(String(player.playerName || '')))
        .filter(Boolean)
    );
  }, [selectedTeamOutPlayers]);
  const selectedTeamTricodeNormalized = useMemo(() => {
    if (!gameData) return '';
    return String(selectedTeam === 'away' ? gameData.away_team_tricode : gameData.home_team_tricode)
      .trim()
      .toUpperCase();
  }, [gameData, selectedTeam]);

  const { data: selectedTeamStrictOutInjuries } = useQuery({
    queryKey: ['selected-team-strict-out-injuries', selectedTeamTricodeNormalized, gameData?.game_date],
    queryFn: async () => {
      if (!selectedTeamTricodeNormalized) return [] as any[];
      const { data: teamPlayers, error: teamPlayersError } = await supabase
        .from('nba_players')
        .select('nba_player_id, name')
        .eq('team_abbreviation', selectedTeamTricodeNormalized);
      if (teamPlayersError || !teamPlayers?.length) return [] as any[];
      const nbaPlayerIds = teamPlayers
        .map((player: any) => Number(player.nba_player_id))
        .filter((id: number) => Number.isFinite(id));
      if (!nbaPlayerIds.length) return [] as any[];
      const playerNameById = new Map<number, string>();
      teamPlayers.forEach((player: any) => {
        const id = Number(player.nba_player_id);
        if (Number.isFinite(id)) {
          playerNameById.set(id, String(player.name || '').trim());
        }
      });

      const { data, error } = await supabase
        .from('nba_injuries')
        .select('nba_player_id, raw_data, injury_status, date_updated')
        .in('nba_player_id', nbaPlayerIds)
        .eq('is_current', true)
        .eq('injury_status', 'Out')
        .order('date_updated', { ascending: false })
        .limit(2000);
      if (error || !data?.length) return [] as any[];
      return data.map((injury: any) => {
        const id = Number(injury.nba_player_id);
        return {
          ...injury,
          player_name: playerNameById.get(id) || String(injury?.raw_data?.player_name || '').trim(),
        };
      });
    },
    enabled: !!selectedTeamTricodeNormalized,
    staleTime: 2 * 60 * 1000,
  });
  const selectedTeamStrictOutPlayerIds = useMemo(() => {
    return new Set<number>(
      (selectedTeamStrictOutInjuries ?? [])
        .map((injury: any) => Number(injury.nba_player_id))
        .filter((id: number) => Number.isFinite(id))
    );
  }, [selectedTeamStrictOutInjuries]);
  const selectedTeamStrictOutPlayerNamesNormalized = useMemo(() => {
    const normalize = (name: string) =>
      String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return new Set<string>(
      (selectedTeamStrictOutInjuries ?? [])
        .map((injury: any) => normalize(String(injury?.player_name ?? injury?.raw_data?.player_name ?? '')))
        .filter(Boolean)
    );
  }, [selectedTeamStrictOutInjuries]);
  const selectedTeamExcludedOutPlayerIds = useMemo(() => {
    const set = new Set<number>(selectedTeamOutPlayerIds);
    selectedTeamStrictOutPlayerIds.forEach((id) => set.add(id));
    return set;
  }, [selectedTeamOutPlayerIds, selectedTeamStrictOutPlayerIds]);
  const selectedTeamExcludedOutPlayerNamesNormalized = useMemo(() => {
    const set = new Set<string>(selectedTeamOutPlayerNamesNormalized);
    selectedTeamStrictOutPlayerNamesNormalized.forEach((name) => set.add(name));
    return set;
  }, [selectedTeamOutPlayerNamesNormalized, selectedTeamStrictOutPlayerNamesNormalized]);

  const selectedTeamInjuryNotes = useMemo(() => {
    const notes = new Map<number, { nbaPlayerId: number; playerName: string; injuryStatus: string }>();

    selectedTeamOutPlayers.forEach((player) => {
      const id = Number(player.nbaPlayerId);
      if (!Number.isFinite(id)) return;
      notes.set(id, {
        nbaPlayerId: id,
        playerName: player.playerName,
        injuryStatus: 'Out',
      });
    });

    if (playerInjuries) {
      playerInjuries.forEach((injury: any, nbaPlayerId: number) => {
        const status = String(injury?.injury_status ?? '').trim();
        if (!status) return;
        const normalized = status.toLowerCase();
        if (!(normalized.includes('probable') || normalized.includes('questionable'))) return;
        if (notes.has(nbaPlayerId)) return;
        const rosterName = (currentRoster || []).find((p: any) => p.nba_player_id === nbaPlayerId)?.player_name;
        notes.set(nbaPlayerId, {
          nbaPlayerId,
          playerName: rosterName || injury?.player_name || 'Unknown',
          injuryStatus: status,
        });
      });
    }

    return Array.from(notes.values()).sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [selectedTeamOutPlayers, playerInjuries, currentRoster]);

  const selectedTeamRotationRows = useMemo(() => {
    const rows = selectedTeam === 'away' ? (estimatedRotation?.away ?? []) : (estimatedRotation?.home ?? []);
    return rows
      .filter((row) => {
        const byUtility = row.nba_player_id != null && selectedTeamOutPlayerIds.has(row.nba_player_id);
        const bySignal = row.signals.some((signal) => signal.toLowerCase().includes('out status'));
        return !byUtility && !bySignal;
      })
      .map((row) => {
        const isRecentlyActiveOut =
          row.nba_player_id != null && selectedTeamOutPlayerIds.has(row.nba_player_id);
        if (!isRecentlyActiveOut) return row;
        const injurySignal = 'Recently active but currently OUT (rotation gap signal)';
        if (row.signals.includes(injurySignal)) return row;
        return {
          ...row,
          signals: [injurySignal, ...row.signals],
        };
      });
  }, [selectedTeam, estimatedRotation?.away, estimatedRotation?.home, selectedTeamOutPlayerIds]);

  const selectedTeamTotalEstimatedMinutes = useMemo(
    () => (selectedTeamRotationRows.length > 0 ? 240 : 0),
    [selectedTeamRotationRows]
  );

  const selectedTeamAvgRotationSize = useMemo(() => {
    if (!gameData) return null;
    const tri = String(selectedTeam === 'away' ? gameData.away_team_tricode : gameData.home_team_tricode)
      .trim()
      .toUpperCase();
    const avg = averageRotationSizeByTeam?.get(tri)?.averageRotationSize;
    return typeof avg === 'number' && Number.isFinite(avg) ? avg : null;
  }, [gameData, selectedTeam, averageRotationSizeByTeam]);

  const exploitationRows = useMemo(() => {
    return buildTeamExploitations({ predictorStats, maxPerTeam: 6 });
  }, [predictorStats]);

  const selectedTeamTricodeForStrategies = gameData
    ? (selectedTeam === 'away' ? gameData.away_team_tricode : gameData.home_team_tricode)
    : '';
  const opponentTeamTricodeForStrategies = gameData
    ? (selectedTeam === 'away' ? gameData.home_team_tricode : gameData.away_team_tricode)
    : '';

  const strategyEndpointNames = useMemo(
    () =>
      Array.from(
        new Set(
          MATCHUP_FACTORS.flatMap((factor) => [factor.playerOffenseEndpoint, factor.teamDefenseEndpoint])
        )
      ),
    []
  );

  const {
    data: strategyEndpointRows,
    isLoading: strategyEndpointRowsLoading,
    isError: strategyEndpointRowsError,
  } = useQuery({
    queryKey: ['strategy-endpoint-rows', gameData?.game_date, strategyEndpointNames.join(',')],
    queryFn: async () => {
      if (!gameData?.game_date) return {} as Record<string, Record<string, string>[]>;
      const gameDate = String(gameData.game_date).slice(0, 10);
      let targetDate = gameDate;
      const { data: latestTeamStatDate } = await supabase
        .from('nba_daily_team_stats')
        .select('date')
        .lte('date', gameDate)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestTeamStatDate?.date) {
        targetDate = String(latestTeamStatDate.date).slice(0, 10);
      }
      const { data: rows, error } = await supabase
        .from('nba_daily_team_stats')
        .select('endpoint_name, data')
        .eq('date', targetDate)
        .in('endpoint_name', strategyEndpointNames);
      if (error || !rows?.length) return {} as Record<string, Record<string, string>[]>;

      const byEndpoint: Record<string, Record<string, string>[]> = {};
      rows.forEach((row: any) => {
        try {
          const payload = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          byEndpoint[row.endpoint_name] = Array.isArray(payload?.data) ? payload.data : [];
        } catch {
          byEndpoint[row.endpoint_name] = [];
        }
      });
      return byEndpoint;
    },
    enabled: !!gameData?.game_date,
    staleTime: 2 * 60 * 1000,
  });

  const { data: strategyPlayerEndpointRows } = useQuery({
    queryKey: ['strategy-player-endpoint-rows', gameData?.game_date, strategyEndpointNames.join(',')],
    queryFn: async () => {
      if (!gameData?.game_date) return {} as Record<string, Record<string, string>[]>;
      const gameDate = String(gameData.game_date).slice(0, 10);
      let targetDate = gameDate;
      const { data: latestPlayerStatDate } = await supabase
        .from('nba_daily_player_stats')
        .select('date')
        .lte('date', gameDate)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestPlayerStatDate?.date) {
        targetDate = String(latestPlayerStatDate.date).slice(0, 10);
      }
      const { data: rows, error } = await supabase
        .from('nba_daily_player_stats')
        .select('endpoint_name, data')
        .eq('date', targetDate)
        .in('endpoint_name', strategyEndpointNames);
      if (error || !rows?.length) return {} as Record<string, Record<string, string>[]>;

      const byEndpoint: Record<string, Record<string, string>[]> = {};
      rows.forEach((row: any) => {
        try {
          const payload = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          byEndpoint[row.endpoint_name] = Array.isArray(payload?.data) ? payload.data : [];
        } catch {
          byEndpoint[row.endpoint_name] = [];
        }
      });
      return byEndpoint;
    },
    enabled: !!gameData?.game_date,
    staleTime: 2 * 60 * 1000,
  });

  const strategyCategoryCards = useMemo(() => {
    const toNumeric = (value: unknown): number | null => {
      if (value == null) return null;
      const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    };
    const firstNumericFromRow = (
      row: Record<string, string> | null | undefined,
      keys: string[],
      allowAnyNumericFallback: boolean = false
    ): number | null => {
      if (!row) return null;
      for (const key of keys) {
        const exact = toNumeric((row as any)[key]);
        if (exact != null) return exact;
        const matchKey = Object.keys(row).find((k) => k.toUpperCase() === key.toUpperCase());
        if (matchKey) {
          const matchVal = toNumeric((row as any)[matchKey]);
          if (matchVal != null) return matchVal;
        }
      }
      if (!allowAnyNumericFallback) return null;
      for (const [k, raw] of Object.entries(row)) {
        if (k.toUpperCase() === 'TEAM') continue;
        const parsed = toNumeric(raw);
        if (parsed != null) return parsed;
      }
      return null;
    };
    const average = (values: number[]): number | null => {
      if (!values.length) return null;
      return values.reduce((sum, num) => sum + num, 0) / values.length;
    };
    const percentileRank = (values: number[], value: number | null, higherIsBetter: boolean): number | null => {
      if (value == null) return null;
      const valid = values.filter((v) => Number.isFinite(v));
      if (!valid.length) return null;
      const lessOrEqual = valid.filter((v) => v <= value).length;
      const raw = (lessOrEqual / valid.length) * 100;
      return higherIsBetter ? raw : 100 - raw;
    };
    const percentileTier = (percentile: number | null): 'top10' | 'bottom10' | null => {
      if (percentile == null) return null;
      if (percentile >= 90) return 'top10';
      if (percentile <= 10) return 'bottom10';
      return null;
    };
    const leagueRank = (values: number[], value: number | null, higherIsBetter: boolean): number | null => {
      if (value == null) return null;
      const valid = values.filter((v) => Number.isFinite(v));
      if (!valid.length) return null;
      const sorted = valid.slice().sort((a, b) => (higherIsBetter ? b - a : a - b));
      const idx = sorted.findIndex((v) => v === value);
      if (idx >= 0) return idx + 1;
      const firstWorse = sorted.findIndex((v) => (higherIsBetter ? v < value : v > value));
      return firstWorse >= 0 ? firstWorse + 1 : sorted.length;
    };

    const teamTri = String(selectedTeamTricodeForStrategies || '').toUpperCase();
    const oppTri = String(opponentTeamTricodeForStrategies || '').toUpperCase();
    if (!teamTri || !oppTri) return [];

    return MATCHUP_FACTORS.map((factor, index) => {
      const offenseRowsRaw = strategyEndpointRows?.[factor.playerOffenseEndpoint] || [];
      const defenseRows = strategyEndpointRows?.[factor.teamDefenseEndpoint] || [];
      const offenseRows = offenseRowsRaw.length > 0 ? offenseRowsRaw : defenseRows;

      const offenseSlice = predictorStats?.[factor.playerOffenseEndpoint];
      const defenseSlice = predictorStats?.[factor.teamDefenseEndpoint];
      const sliceSelectedOffenseRow =
        selectedTeam === 'away'
          ? (offenseSlice?.away as Record<string, string> | null | undefined)
          : (offenseSlice?.home as Record<string, string> | null | undefined);
      const sliceSelectedDefenseRow =
        selectedTeam === 'away'
          ? (defenseSlice?.away as Record<string, string> | null | undefined)
          : (defenseSlice?.home as Record<string, string> | null | undefined);
      const sliceOpponentDefenseRow =
        selectedTeam === 'away'
          ? (defenseSlice?.home as Record<string, string> | null | undefined)
          : (defenseSlice?.away as Record<string, string> | null | undefined);

      const offenseTeamRow = offenseRows.find((row) => predictorTeamNameToTricode(row.TEAM) === teamTri) || null;
      const defenseTeamRow = defenseRows.find((row) => predictorTeamNameToTricode(row.TEAM) === teamTri) || null;
      const opponentDefenseRow = defenseRows.find((row) => predictorTeamNameToTricode(row.TEAM) === oppTri) || null;

      const offenseKeys = Array.from(
        new Set([
          factor.playerStatKey,
          ...(factor.playerDisplayColumns ?? []),
          factor.teamStatKey,
          'PPP',
          'FG%',
          'OREB CHANCE%',
          'DREB',
        ])
      );
      const usageKeys = ['FREQ%', 'POSS', 'PTS', 'FGA', 'OREB CHANCES'];
      const defenseKeys = Array.from(
        new Set([
          factor.teamStatKey,
          ...(factor.teamDisplayColumns ?? []),
          factor.playerStatKey,
          'PPP',
          'FG%',
          'DFG%',
          'DREB',
        ])
      );

      // Prioritize values sourced from league row set so ranks/percentiles are aligned
      // to the same exact stat column across all 30 teams.
      const teamOffenseValue =
        firstNumericFromRow(offenseTeamRow, offenseKeys) ??
        firstNumericFromRow(sliceSelectedOffenseRow ?? null, offenseKeys);
      const teamDefenseValue =
        firstNumericFromRow(defenseTeamRow, defenseKeys) ??
        firstNumericFromRow(sliceSelectedDefenseRow ?? null, defenseKeys);
      const opponentDefenseValue =
        firstNumericFromRow(opponentDefenseRow, defenseKeys) ??
        firstNumericFromRow(sliceOpponentDefenseRow ?? null, defenseKeys);

      const leagueOffenseAvg = average(
        offenseRows
          .map((row) => firstNumericFromRow(row, offenseKeys))
          .filter((v): v is number => v != null)
      );
      const leagueDefenseAvg = average(
        defenseRows
          .map((row) => firstNumericFromRow(row, defenseKeys))
          .filter((v): v is number => v != null)
      );

      const offenseVsLeague = teamOffenseValue != null && leagueOffenseAvg != null ? teamOffenseValue - leagueOffenseAvg : null;
      const defenseVsLeague = teamDefenseValue != null && leagueDefenseAvg != null ? teamDefenseValue - leagueDefenseAvg : null;
      const matchupVsOpponent = teamOffenseValue != null && opponentDefenseValue != null ? teamOffenseValue - opponentDefenseValue : null;
      const offenseLeagueValues = offenseRows
        .map((row) => firstNumericFromRow(row, offenseKeys))
        .filter((v): v is number => v != null);
      const defenseLeagueValues = defenseRows
        .map((row) => firstNumericFromRow(row, defenseKeys))
        .filter((v): v is number => v != null);

      const teamOffensePercentile = percentileRank(
        offenseLeagueValues,
        teamOffenseValue,
        factor.higherPlayerBetter
      );
      const teamDefenseStrengthPercentile = percentileRank(
        defenseLeagueValues,
        teamDefenseValue,
        !factor.higherTeamValueWorseDefense
      );
      const opponentDefenseStrengthPercentile = percentileRank(
        defenseLeagueValues,
        opponentDefenseValue,
        !factor.higherTeamValueWorseDefense
      );
      const categoryUsageRate = firstNumericFromRow(offenseTeamRow, usageKeys) ??
        firstNumericFromRow(sliceSelectedOffenseRow ?? null, usageKeys);
      const usageLeagueValues = offenseRows
        .map((row) => firstNumericFromRow(row, usageKeys))
        .filter((v): v is number => v != null);
      const categoryUsagePercentile = percentileRank(
        usageLeagueValues,
        categoryUsageRate,
        true
      );
      const matchupPercentileGap =
        teamOffensePercentile != null && opponentDefenseStrengthPercentile != null
          ? teamOffensePercentile - opponentDefenseStrengthPercentile
          : null;
      const usageWeight =
        categoryUsagePercentile != null
          ? (0.5 + categoryUsagePercentile / 100)
          : 1;
      const weightedMatchupScore =
        matchupPercentileGap != null
          ? matchupPercentileGap * usageWeight
          : null;
      const teamOffenseRank = leagueRank(
        offenseLeagueValues,
        teamOffenseValue,
        factor.higherPlayerBetter
      );
      const teamDefenseStrengthRank = leagueRank(
        defenseLeagueValues,
        teamDefenseValue,
        !factor.higherTeamValueWorseDefense
      );
      const opponentDefenseStrengthRank = leagueRank(
        defenseLeagueValues,
        opponentDefenseValue,
        !factor.higherTeamValueWorseDefense
      );
      const playerRows = strategyPlayerEndpointRows?.[factor.playerOffenseEndpoint] || [];
      const rowMatchesTricode = (row: Record<string, string>, tricode: string) => {
        const teamRaw = String((row as any).TEAM || '').trim().toUpperCase();
        if (!teamRaw) return false;
        if (teamRaw === tricode) return true;
        return predictorTeamNameToTricode(teamRaw) === tricode;
      };
      const toTopScorers = (tricode: string) =>
        playerRows
          .filter((row) => rowMatchesTricode(row, tricode))
          .map((row) => {
            // For "top scorers", prefer play-type PTS and fallback to primary category stat.
            const points = toNumeric((row as any).PTS);
            const primaryValue = firstNumericFromRow(row, offenseKeys);
            const ppp = toNumeric((row as any).PPP);
            const freq = toNumeric((row as any)['FREQ%']);
            const poss = toNumeric((row as any).POSS);
            const percentile = toNumeric((row as any).PERCENTILE);
            const nbaPlayerId =
              toNumeric((row as any).NBA_PLAYER_ID) ??
              toNumeric((row as any).PERSON_ID) ??
              toNumeric((row as any).PLAYER_ID);
            const playerName = String((row as any).PLAYER || '').trim();
            const normalizedPlayerName = playerName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9\s]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            return {
              name: playerName,
              points,
              value: primaryValue,
              ppp,
              freq,
              poss,
              percentile,
              nbaPlayerId,
              normalizedPlayerName,
            };
          })
          .filter((p) => {
            if (!p.name || (p.points == null && p.value == null)) return false;
            if (p.nbaPlayerId != null && selectedTeamExcludedOutPlayerIds.has(Number(p.nbaPlayerId))) return false;
            if (p.normalizedPlayerName && selectedTeamExcludedOutPlayerNamesNormalized.has(p.normalizedPlayerName)) return false;
            return true;
          })
          .sort((a, b) => {
            const scoreA = a.points ?? a.value ?? -9999;
            const scoreB = b.points ?? b.value ?? -9999;
            return scoreB - scoreA;
          })
          .slice(0, 3);
      const mappedBetType = getBetTypeForMatchupEndpoint(factor.playerOffenseEndpoint);
      const mappedBetTypeAliases = mappedBetType ? expandBetTypeAliases(mappedBetType) : new Set<string>();
      const mappedCanonicalAliases = new Set(Array.from(mappedBetTypeAliases).map((alias) => canonicalizeBetType(alias)));
      const isMappedBetType = (betTypeRaw: string) => {
        const normalizedPropType = normalizeBetType(betTypeRaw || '');
        const canonicalPropType = canonicalizeBetType(normalizedPropType);
        for (const alias of mappedBetTypeAliases) {
          const canonicalAlias = canonicalizeBetType(alias);
          if (
            normalizedPropType === alias ||
            normalizedPropType.includes(alias) ||
            alias.includes(normalizedPropType) ||
            canonicalPropType === canonicalAlias ||
            canonicalPropType.includes(canonicalAlias) ||
            mappedCanonicalAliases.has(canonicalPropType)
          ) {
            return true;
          }
        }
        return false;
      };
      const normalizePlayerNameForMatch = (value: string) =>
        String(value || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const selectedTeamTopPlayers = toTopScorers(teamTri).map((player) => {
        const matchedProp = teamProps.find((prop) => {
          if (!mappedBetType || !isMappedBetType(prop.bet_type || '')) return false;
          const byNbaId =
            player.nbaPlayerId != null &&
            prop.nba_player_id != null &&
            Number(player.nbaPlayerId) === Number(prop.nba_player_id);
          if (byNbaId) return true;
          const normalizedPropPlayerName = normalizePlayerNameForMatch(prop.player_name || '');
          return Boolean(
            player.normalizedPlayerName &&
            normalizedPropPlayerName &&
            player.normalizedPlayerName === normalizedPropPlayerName
          );
        });

        return {
          ...player,
          matchedProp: matchedProp
            ? {
                betType: matchedProp.bet_type,
                line: matchedProp.line,
                americanOdds: matchedProp.american_odds,
              }
            : null,
        };
      });

      return {
        id: `${factor.playerOffenseEndpoint}__${factor.teamDefenseEndpoint}`,
        label: factor.label,
        chartType: EXPLOIT_CHART_SEQUENCE[index] ?? 'bar',
        offenseStat: factor.playerStatKey,
        defenseStat: factor.teamStatKey,
        teamOffenseValue,
        teamDefenseValue,
        opponentDefenseValue,
        leagueOffenseAvg,
        leagueDefenseAvg,
        offenseVsLeague,
        defenseVsLeague,
        matchupVsOpponent,
        teamOffensePercentile,
        teamDefenseStrengthPercentile,
        opponentDefenseStrengthPercentile,
        matchupPercentileGap,
        teamOffenseRank,
        teamDefenseStrengthRank,
        opponentDefenseStrengthRank,
        leagueTeamCountOffense: offenseLeagueValues.length,
        leagueTeamCountDefense: defenseLeagueValues.length,
        categoryUsageRate,
        categoryUsagePercentile,
        weightedMatchupScore,
        teamOffenseTier: percentileTier(teamOffensePercentile),
        teamDefenseTier: percentileTier(teamDefenseStrengthPercentile),
        opponentDefenseTier: percentileTier(opponentDefenseStrengthPercentile),
        selectedTeamTopPlayers,
        selectedTeamTricode: teamTri,
      };
    });
  }, [strategyEndpointRows, strategyPlayerEndpointRows, predictorStats, selectedTeam, selectedTeamTricodeForStrategies, opponentTeamTricodeForStrategies, selectedTeamExcludedOutPlayerIds, selectedTeamExcludedOutPlayerNamesNormalized, teamProps]);

  const topExploitationSidebarRows = useMemo<ExploitSidebarRow[]>(() => {
    const selectedRows = exploitationRows.filter((row) => row.attackTeam === selectedTeam).slice(0, 5);
    return selectedRows.map((row, idx) => {
      const aliases = expandBetTypeAliases(row.betType);
      const canonicalAliases = new Set(Array.from(aliases).map((alias) => canonicalizeBetType(alias)));
      const targetProp = teamProps.find((prop) => {
        const normalizedPropType = normalizeBetType(prop.bet_type || '');
        const canonicalPropType = canonicalizeBetType(normalizedPropType);
        for (const alias of aliases) {
          const canonicalAlias = canonicalizeBetType(alias);
          if (
            normalizedPropType === alias ||
            normalizedPropType.includes(alias) ||
            alias.includes(normalizedPropType) ||
            canonicalPropType === canonicalAlias ||
            canonicalPropType.includes(canonicalAlias) ||
            canonicalAliases.has(canonicalPropType)
          ) {
            return true;
          }
        }
        return false;
      });

      const normalizedBetType = row.betType.toLowerCase();
      const ExploitIcon =
        normalizedBetType.includes('point') ? TrendingUp :
        normalizedBetType.includes('rebound') ? Shield :
        normalizedBetType.includes('assist') ? Analytics :
        normalizedBetType.includes('three') ? BarChart :
        EmojiEvents;

      return {
        id: `${row.metricKey}-${idx}`,
        icon: <ExploitIcon sx={{ fontSize: 16 }} />,
        title: `${row.betType.replace(/_/g, ' ').toUpperCase()} edge (${row.score.toFixed(1)})`,
        playerName: targetProp?.player_name ?? undefined,
        onAdd: targetProp
          ? () => handleAddPropToSlip(targetProp)
          : undefined,
        addDisabled: targetProp ? !canAddPlayerToSlip(targetProp.nba_player_id ?? null) : true,
      };
    });
  }, [exploitationRows, selectedTeam, teamProps, canAddPlayerToSlip, handleAddPropToSlip]);

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
  const { data: moduleVisibility } = useGameModuleVisibility();

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
            onClick={handleBack}
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
  
  const compactLayout = props.embeddedInFeed === true;
  const activeTeamTricode = selectedTeam === 'away' ? gameData.away_team_tricode : gameData.home_team_tricode;

  const GameContentView = ({ viewType }: { viewType: 'stats' | 'team_comparison' | 'props' | 'hit_rates' | 'estimated_rotation' }) => {
    const activeView = viewType === 'team_comparison' ? 'predictor' : viewType === 'hit_rates' ? 'propsVsTeams' : 'props';
    return (
      <>
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
      ) : viewType === 'stats' ? (
        <GameStatsTabbedView />
      ) : viewType === 'props' ? (
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
                  <Typography sx={{ color: '#64748b', fontSize: '0.75rem' }}>
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
              ? (gameState === 'completed' ? 132 : 132)
              : (gameState === 'completed' ? 205 : 205);
            const playerColumnMinWidth = isMobile ? 90 : 200;
            const minWidth = playerColumnMinWidth + (betTypes.length * columnWidth);

            return (
              <Table sx={{ bgcolor: '#ffffff', width: '100%', minWidth: `${minWidth}px` }}>
                <thead>
                  <tr>
                    <th style={{ color: '#334155', fontSize: isMobile ? '0.65rem' : '0.75rem', minWidth: `${playerColumnMinWidth}px`, width: `${playerColumnMinWidth}px`, maxWidth: `${playerColumnMinWidth}px`, whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#ffffff', padding: isMobile ? '8px 6px' : '12px' }}>Player</th>
                    {betTypes.map(betType => (
                      <th key={betType} style={{ color: '#334155', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 6px' : '12px 16px', minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}>
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
                          borderBottom: '1px solid #e2e8f0',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td 
                          style={{ 
                            color: '#0f172a', 
                            fontSize: isMobile ? '0.65rem' : '0.75rem', 
                            padding: isMobile ? '8px 6px' : '12px',
                            minWidth: `${playerColumnMinWidth}px`,
                            width: `${playerColumnMinWidth}px`,
                            maxWidth: `${playerColumnMinWidth}px`,
                            whiteSpace: 'nowrap',
                            position: 'sticky',
                            left: 0,
                            zIndex: 9,
                            backgroundColor: '#ffffff'
                          }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 0.25, md: 0.5 } }}>
                              <Avatar
                                src={player.nba_player_id && player.nba_player_id > 0
                                  ? `https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`
                                  : undefined
                                }
                                alt={player.name}
                                sx={{ width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 }, flexShrink: 0 }}
                              >
                                {(!player.nba_player_id || player.nba_player_id === 0) && (
                                  <Typography sx={{ fontSize: isMobile ? '0.5rem' : '0.6rem', color: '#334155' }}>
                                    {player.name?.charAt(0) || '?'}
                                  </Typography>
                                )}
                              </Avatar>
                              <Typography sx={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'center' }}>
                                {player.name}
                              </Typography>
                            </Box>
                            {(rosterPlayer?.jersey_number || rosterPlayer?.position) && (
                              <Typography sx={{ color: '#64748b', fontSize: isMobile ? '0.55rem' : '0.65rem', lineHeight: 1 }}>
                                {rosterPlayer?.jersey_number ? `#${rosterPlayer.jersey_number}` : ''}
                                {rosterPlayer?.jersey_number && rosterPlayer?.position ? ' • ' : ''}
                                {rosterPlayer?.position || ''}
                              </Typography>
                            )}
                          </Box>
                        </td>
                        {betTypes.map(betType => {
                          const prop = playerPropsMap.get(betType);
                          const propResult = prop ? getPropResult(prop) : null;
                          const canAdd = canAddPlayerToSlip(prop?.nba_player_id ?? null);
                          const enableButtons = gameState === 'upcoming' && !!prop;

                          return (
                            <td 
                              key={betType}
                              style={{ 
                                color: '#0f172a',
                                fontSize: isMobile ? '0.65rem' : '0.75rem', 
                                textAlign: 'right', 
                                padding: isMobile ? '8px 6px' : '12px 16px',
                                minWidth: `${columnWidth}px`,
                                width: `${columnWidth}px`
                              }}
                            >
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, alignItems: 'stretch' }}>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 0.35, alignItems: 'center' }}>
                                  <Button
                                    size="sm"
                                    variant="soft"
                                    color="neutral"
                                    disabled={!enableButtons || !canAdd}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (prop) handleAddPropToSlip(prop, 'under');
                                    }}
                                    sx={{
                                      minHeight: isMobile ? 20 : 22,
                                      minWidth: isMobile ? 22 : 26,
                                      px: isMobile ? 0.35 : 0.5,
                                      fontSize: isMobile ? '0.52rem' : '0.56rem',
                                      fontWeight: 700,
                                      bgcolor: '#f8fafc',
                                      color: '#334155',
                                      border: '1px solid #e2e8f0',
                                      '&:hover': { bgcolor: '#f1f5f9' },
                                    }}
                                  >
                                    U
                                  </Button>
                                  <PropPerformanceCell
                                    prop={prop || null}
                                    propResult={propResult}
                                    gameState={gameState === 'loading' ? 'upcoming' : gameState}
                                    opponentTeamTricode={opponentTeamTricode}
                                    isMobile={isMobile}
                                    american_odds={prop?.american_odds}
                                    price={prop?.price}
                                    cellButton
                                  />
                                  <Button
                                    size="sm"
                                    variant="soft"
                                    color="neutral"
                                    disabled={!enableButtons || !canAdd}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (prop) handleAddPropToSlip(prop, 'over');
                                    }}
                                    sx={{
                                      minHeight: isMobile ? 20 : 22,
                                      minWidth: isMobile ? 22 : 26,
                                      px: isMobile ? 0.35 : 0.5,
                                      fontSize: isMobile ? '0.52rem' : '0.56rem',
                                      fontWeight: 700,
                                      bgcolor: '#f8fafc',
                                      color: '#334155',
                                      border: '1px solid #e2e8f0',
                                      '&:hover': { bgcolor: '#f1f5f9' },
                                    }}
                                  >
                                    O
                                  </Button>
                                </Box>
                              </Box>
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
      ) : viewType === 'estimated_rotation' && gameData ? (
        <Box sx={{ width: '100%', px: { xs: 2, sm: 0 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 280px' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            <Box sx={{ minWidth: 0, overflowX: 'auto' }}>
              <EstimatedRotationModule
                rows={selectedTeamRotationRows}
                isLoading={estimatedRotationLoading}
                teamTricode={selectedTeam === 'away' ? gameData.away_team_tricode : gameData.home_team_tricode}
                isMobile={isMobile}
                propByPlayer={bestPropByPlayer}
                canAddPlayerToSlip={canAddPlayerToSlip}
                onAddProp={handleAddPropToSlip}
              />
            </Box>
            <Card variant="outlined" sx={{ borderColor: '#dbe1ea', bgcolor: '#ffffff' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography level="title-sm" sx={{ color: '#111827', fontWeight: 700, mb: 0.5 }}>
                  Rotation Snapshot
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                  <Typography level="body-xs" sx={{ color: '#64748b' }}>
                    Total Est Min
                  </Typography>
                  <Typography level="body-sm" sx={{ color: '#0f172a', fontWeight: 700 }}>
                    {selectedTeamTotalEstimatedMinutes.toFixed(1)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography level="body-xs" sx={{ color: '#64748b' }}>
                    Avg Rotation Size (last 10)
                  </Typography>
                  <Typography level="body-sm" sx={{ color: '#0f172a', fontWeight: 700 }}>
                    {selectedTeamAvgRotationSize != null ? selectedTeamAvgRotationSize.toFixed(1) : 'N/A'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.45, mb: 1.25 }}>
                  {selectedTeamRotationRows.map((row) => {
                    const widthPct = Math.max(0, Math.min(100, (Number(row.estimated_minutes || 0) / 40) * 100));
                    const minuteDelta = Number(row.injury_delta_minutes || 0);
                    const isBoost = minuteDelta > 0.1;
                    const isDown = minuteDelta < -0.1;
                    return (
                      <Box key={`bar-${row.nba_player_id}-${row.player_name}`} sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 0.5 }}>
                          <Typography
                            level="body-xs"
                            sx={{
                              color: '#334155',
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                              maxWidth: '75%',
                            }}
                          >
                            {row.player_name}
                          </Typography>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                            {isBoost && <ArrowUpward sx={{ fontSize: 12, color: '#16a34a' }} />}
                            {isDown && <ArrowDownward sx={{ fontSize: 12, color: '#dc2626' }} />}
                            <Typography level="body-xs" sx={{ color: '#0f172a', fontWeight: 700 }}>
                              {Number(row.estimated_minutes || 0).toFixed(1)}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ mt: 0.2, height: 5, bgcolor: '#e2e8f0', borderRadius: 999 }}>
                          <Box
                            sx={{
                              width: `${widthPct}%`,
                              height: '100%',
                              bgcolor: '#2563eb',
                              borderRadius: 999,
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                <Typography level="title-sm" sx={{ color: '#F8FAFC', fontWeight: 700, mb: 0.5 }}>
                  Injury Notes
                </Typography>
                <Typography level="body-xs" sx={{ color: '#CBD5E1', mb: 1 }}>
                  Current injury statuses impacting rotation (OUT/Questionable/Probable).
                </Typography>
                {outPlayersLoading ? (
                  <Typography level="body-sm" sx={{ color: '#CBD5E1' }}>
                    Loading injury notes...
                  </Typography>
                ) : selectedTeamInjuryNotes.length === 0 ? (
                  <Typography level="body-sm" sx={{ color: '#CBD5E1' }}>
                    No active injury notes for this team.
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {selectedTeamInjuryNotes.slice(0, 12).map((player) => (
                      <Box
                        key={`inj-${player.nbaPlayerId}-${player.injuryStatus}`}
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}
                      >
                        <Avatar
                          size="sm"
                          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nbaPlayerId}.png`}
                          alt={player.playerName}
                          sx={{ width: 22, height: 22, flexShrink: 0 }}
                        />
                        <Typography
                          level="body-sm"
                          sx={{
                            color: '#F8FAFC',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {player.playerName}
                        </Typography>
                        <Chip
                          size="sm"
                          variant="soft"
                          color={
                            String(player.injuryStatus).toLowerCase().includes('out')
                              ? 'danger'
                              : String(player.injuryStatus).toLowerCase().includes('questionable')
                                ? 'warning'
                                : 'primary'
                          }
                          sx={{
                            ml: 'auto',
                            fontWeight: 700,
                            fontSize: '0.58rem',
                            color: '#FFFFFF',
                            bgcolor: String(player.injuryStatus).toLowerCase().includes('out')
                              ? '#DC2626'
                              : String(player.injuryStatus).toLowerCase().includes('questionable')
                                ? '#EA580C'
                                : '#0284C7',
                          }}
                        >
                          {player.injuryStatus}
                        </Chip>
                      </Box>
                    ))}
                    {selectedTeamInjuryNotes.length > 12 && (
                      <Typography level="body-xs" sx={{ color: '#CBD5E1' }}>
                        +{selectedTeamInjuryNotes.length - 12} more
                      </Typography>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      ) : viewType === 'hit_rates' && gameData ? (
        // Props vs Teams: how players have fared against each team's defense (last 10 games)
        <Box sx={{ width: '100%', overflowX: 'auto', px: { xs: 2, sm: 0 } }}>
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
      ) : viewType === 'team_comparison' ? (
        <Box sx={{ width: '100%', maxWidth: '100%', m: 0, p: 0 }}>
          <ExploitsDashboard
            categories={strategyCategoryCards}
            sidebarTitle={`Top Exploitations (${selectedTeam === 'away' ? gameData?.away_team_tricode : gameData?.home_team_tricode} offense)`}
            sidebarRows={topExploitationSidebarRows}
            loading={strategyEndpointRowsLoading}
            emptyMessage={
              strategyEndpointRowsError
                ? 'Unable to load strategy category data right now.'
                : 'No strategy category data for this date. Data is stored in nba_daily_team_stats.'
            }
          />
        </Box>
      ) : null }
      </>
    );
  };

  const GameAdvancedStatsTable = () => (
    <Box sx={{ width: '100%', overflowX: 'auto', minWidth: 960 }}>
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
        <Table sx={{ bgcolor: '#ffffff', width: '100%', minWidth: isMobile ? '720px' : '960px' }}>
          <thead>
            <tr>
              <th style={{ color: '#334155', fontSize: isMobile ? '0.65rem' : '0.75rem', minWidth: isMobile ? '90px' : '150px', width: isMobile ? '90px' : '150px', maxWidth: isMobile ? '90px' : '150px', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#ffffff', padding: isMobile ? '8px 6px' : '12px' }}>Player</th>
              <SortableHeader column="mpg" label="MPG" />
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
              if (last5ActiveTeamPlayerIds && last5ActiveTeamPlayerIds.size > 0) {
                sortedStats = sortedStats.filter(
                  (stat: any) => stat.nba_player_id != null && last5ActiveTeamPlayerIds.has(stat.nba_player_id)
                );
              }
              if (sortColumn) {
                sortedStats.sort((a: any, b: any) => {
                  let aVal: number | null = null;
                  let bVal: number | null = null;
                  const getMpg = (row: any): number | null => {
                    const byId = row?.player_id ? advancedMpgByKey.get(`id:${row.player_id}`) : undefined;
                    if (typeof byId === 'number') return byId;
                    const byNba = row?.nba_player_id ? advancedMpgByKey.get(`nba:${row.nba_player_id}`) : undefined;
                    return typeof byNba === 'number' ? byNba : null;
                  };
                  if (sortColumn === 'mpg') { aVal = getMpg(a); bVal = getMpg(b); }
                  else if (sortColumn === 'off_rtg') { aVal = a.off_rtg ?? null; bVal = b.off_rtg ?? null; }
                  else if (sortColumn === 'def_rtg') { aVal = a.def_rtg ?? null; bVal = b.def_rtg ?? null; }
                  else if (sortColumn === 'net_rtg') { aVal = a.net_rtg ?? null; bVal = b.net_rtg ?? null; }
                  else if (sortColumn === 'ts_pct') { aVal = a.ts_pct ?? null; bVal = b.ts_pct ?? null; }
                  else if (sortColumn === 'usg_pct') { aVal = a.usg_pct ?? null; bVal = b.usg_pct ?? null; }
                  else if (sortColumn === 'efg_pct') { aVal = a.efg_pct ?? null; bVal = b.efg_pct ?? null; }
                  else if (sortColumn === 'ast_ratio') { aVal = a.ast_ratio ?? null; bVal = b.ast_ratio ?? null; }
                  else if (sortColumn === 'reb_pct') { aVal = a.reb_pct ?? null; bVal = b.reb_pct ?? null; }
                  else if (sortColumn === 'tov_pct') { aVal = a.tov_pct ?? null; bVal = b.tov_pct ?? null; }
                  if (aVal === null && bVal === null) return 0;
                  if (aVal === null) return 1;
                  if (bVal === null) return -1;
                  return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                });
              }
              return sortedStats.map((stat: any) => {
                const rosterPlayer = (currentRoster || []).find((p: any) => p.player_id === stat.player_id || p.nba_player_id === stat.nba_player_id);
                const injury = playerInjuries?.get(stat.nba_player_id);
                return (
                  <tr
                    key={stat.player_id}
                    onClick={() => stat.player_id && navigate(`/player/${stat.player_id}`)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #e2e8f0' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ minWidth: isMobile ? '90px' : '150px', width: isMobile ? '90px' : '150px', maxWidth: isMobile ? '90px' : '150px', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 9, backgroundColor: '#ffffff', padding: isMobile ? '8px 6px' : '12px' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 0.25, md: 0.5 } }}>
                          <Avatar src={`https://cdn.nba.com/headshots/nba/latest/260x190/${stat.nba_player_id}.png`} alt={stat.player_name} sx={{ width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 }, flexShrink: 0 }} />
                          <Typography sx={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'center' }}>{stat.player_name}</Typography>
                        </Box>
                        {(rosterPlayer?.jersey_number || rosterPlayer?.position) && (
                          <Typography sx={{ color: '#64748b', fontSize: isMobile ? '0.55rem' : '0.65rem', lineHeight: 1 }}>
                            {rosterPlayer?.jersey_number ? `#${rosterPlayer.jersey_number}` : ''}
                            {rosterPlayer?.jersey_number && rosterPlayer?.position ? ' • ' : ''}
                            {rosterPlayer?.position || ''}
                          </Typography>
                        )}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          {injury && injury.injury_status === 'Out' && <Chip size="sm" color="danger" variant="solid" sx={{ fontSize: isMobile ? '0.55rem' : '0.65rem', height: isMobile ? '14px' : '16px', fontWeight: 'bold', alignSelf: 'flex-start' }}>{injury.injury_status}</Chip>}
                          {injury && (injury.injury_status === 'Questionable' || injury.injury_status === 'Day-to-Day') && <Chip size="sm" color="warning" variant="solid" sx={{ fontSize: isMobile ? '0.55rem' : '0.65rem', height: isMobile ? '14px' : '16px', fontWeight: 'bold', alignSelf: 'flex-start' }}>{injury.injury_status}</Chip>}
                        </Box>
                      </Box>
                    </td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>
                      {(() => {
                        const byId = stat.player_id ? advancedMpgByKey.get(`id:${stat.player_id}`) : undefined;
                        const byNba = stat.nba_player_id ? advancedMpgByKey.get(`nba:${stat.nba_player_id}`) : undefined;
                        const mpg = byId ?? byNba;
                        return typeof mpg === 'number' ? mpg.toFixed(1) : 'N/A';
                      })()}
                    </td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.off_rtg != null ? stat.off_rtg.toFixed(1) : 'N/A'}</td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.def_rtg != null ? stat.def_rtg.toFixed(1) : 'N/A'}</td>
                    <td style={{ color: '#2563eb', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', fontWeight: 600, padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.net_rtg != null ? stat.net_rtg.toFixed(1) : 'N/A'}</td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.ts_pct != null ? (stat.ts_pct * 100).toFixed(1) + '%' : 'N/A'}</td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.usg_pct != null ? (stat.usg_pct * 100).toFixed(1) + '%' : 'N/A'}</td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.efg_pct != null ? (stat.efg_pct * 100).toFixed(1) + '%' : 'N/A'}</td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.ast_ratio != null ? stat.ast_ratio.toFixed(1) : 'N/A'}</td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.reb_pct != null ? (stat.reb_pct * 100).toFixed(1) + '%' : 'N/A'}</td>
                    <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px', minWidth: STAT_COLUMN_MIN }}>{stat.tov_pct != null ? (stat.tov_pct * 100).toFixed(1) + '%' : 'N/A'}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </Table>
      )}
    </Box>
  );

  const GameStatsTabbedView = () => {
    return (
      <Card variant="outlined" sx={{ position: 'relative', bgcolor: '#ffffff', borderColor: '#dbe1ea', height: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            borderBottom: '1px solid',
            borderColor: '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, width: 'max-content', pr: 1 }}>
              {gameHasStarted && (
                <Button
                  size="sm"
                  variant={statsTab === 'box_score' ? 'solid' : 'outlined'}
                  color="danger"
                  onClick={() => setStatsTab('box_score')}
                >
                  Box Score
                </Button>
              )}
              <Button size="sm" variant={statsTab === 'basic' ? 'solid' : 'outlined'} color="primary" onClick={() => setStatsTab('basic')}>Basic</Button>
              <Button
                size="sm"
                variant={statsTab === 'advanced' ? 'solid' : 'outlined'}
                color="primary"
                onClick={() => {
                  setStatsTab('advanced');
                  setSortColumn('mpg');
                  setSortDirection('desc');
                }}
              >
                Advanced
              </Button>
              <Button size="sm" variant={statsTab === 'props' ? 'solid' : 'outlined'} color="primary" onClick={() => setStatsTab('props')}>Props</Button>
              <Button size="sm" variant={statsTab === 'hit_rates' ? 'solid' : 'outlined'} color="primary" onClick={() => setStatsTab('hit_rates')}>Hit Rates</Button>
              <Button size="sm" variant={statsTab === 'exploits' ? 'solid' : 'outlined'} color="primary" onClick={() => setStatsTab('exploits')}>Exploits</Button>
              <Button size="sm" variant={statsTab === 'estimated_rotation' ? 'solid' : 'outlined'} color="primary" onClick={() => setStatsTab('estimated_rotation')}>Est Rotation</Button>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              flexShrink: 0,
              position: 'sticky',
              right: 0,
              zIndex: 2,
              bgcolor: '#ffffff',
              pl: 1,
            }}
          >
            <Button size="sm" variant={selectedTeam === 'away' ? 'solid' : 'outlined'} color="primary" onClick={() => setSelectedTeam('away')}>
              {gameData.away_team_tricode}
            </Button>
            <Button size="sm" variant={selectedTeam === 'home' ? 'solid' : 'outlined'} color="primary" onClick={() => setSelectedTeam('home')}>
              {gameData.home_team_tricode}
            </Button>
          </Box>
        </Box>
        <CardContent
          sx={{
            bgcolor: '#ffffff',
            pt: 1,
            ...(statsTab === 'exploits' ? { px: 0, pb: 1 } : {}),
          }}
        >
          {statsTab === 'box_score' && gameData && (
            <BoxScore
              gameId={gameData.game_id}
              homeTeamTricode={gameData.home_team_tricode}
              awayTeamTricode={gameData.away_team_tricode}
              homeTeamScore={gameData.home_team_score}
              awayTeamScore={gameData.away_team_score}
              players={liveStats || []}
              isGameOver={gameState === 'completed'}
              quarterScores={
                getQuarterScores(gameJsonData)
                  ? {
                      away: getQuarterScores(gameJsonData)!.map((q) => q.away),
                      home: getQuarterScores(gameJsonData)!.map((q) => q.home),
                    }
                  : undefined
              }
              selectedTeam={selectedTeam}
            />
          )}
          {statsTab === 'basic' && (
        <Box sx={{ width: '100%', overflowX: 'auto', minWidth: 720 }}>
          <Table sx={{ bgcolor: '#ffffff', width: '100%', minWidth: isMobile ? '320px' : '720px' }}>
            <thead>
              <tr>
                <th style={{ color: '#334155', fontSize: isMobile ? '0.65rem' : '0.75rem', minWidth: isMobile ? '90px' : '150px', width: isMobile ? '90px' : '150px', maxWidth: isMobile ? '90px' : '150px', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#ffffff', padding: isMobile ? '8px 6px' : '12px' }}>
                  Player ({activeTeamTricode})
                </th>
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
                      const recentOk =
                        !last5ActiveTeamPlayerIds ||
                        last5ActiveTeamPlayerIds.size === 0 ||
                        (player.nba_player_id != null && last5ActiveTeamPlayerIds.has(player.nba_player_id));
                      return teamOk && idOk && recentOk;
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
                      if (!(stat.nba_player_id != null && upcomingTeamNbaPlayerIds.has(stat.nba_player_id))) return false;
                    }
                    if (last5ActiveTeamPlayerIds && last5ActiveTeamPlayerIds.size > 0) {
                      return stat.nba_player_id != null && last5ActiveTeamPlayerIds.has(stat.nba_player_id);
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
                  if (last5ActiveTeamPlayerIds && last5ActiveTeamPlayerIds.size > 0) {
                    sortedStats = sortedStats.filter(
                      (player: any) => player.nba_player_id != null && last5ActiveTeamPlayerIds.has(player.nba_player_id)
                    );
                  }
                  
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
          {statsTab === 'advanced' && (
            <GameAdvancedStatsTable />
          )}
          {statsTab === 'props' && (
            <GameContentView viewType="props" />
          )}
          {statsTab === 'hit_rates' && (
            <GameContentView viewType="hit_rates" />
          )}
          {statsTab === 'exploits' && (
            <GameContentView viewType="team_comparison" />
          )}
          {statsTab === 'estimated_rotation' && (
            <GameContentView viewType="estimated_rotation" />
          )}
        </CardContent>
      </Card>
    );
  };

  const allGameModules = [
    { name: 'stats', label: 'Stats', content: <GameContentView viewType="stats" /> },
  ] as const;
  const effectiveGameModuleVisibility = moduleVisibility ?? DEFAULT_GAME_MODULES;
  const inlineModules = Object.entries(effectiveGameModuleVisibility)
    .filter(([, config]) => config.is_visible)
    .sort((a, b) => a[1].display_order - b[1].display_order)
    .map(([name]) => allGameModules.find((module) => module.name === name))
    .filter(Boolean) as Array<(typeof allGameModules)[number]>;

  return (
    <GamePageLayout hideHeader={compactLayout}>
    <Box sx={{ 
      bgcolor: '#ffffff',
      minHeight: compactLayout ? undefined : '100vh',
      overflowX: 'hidden',
      width: '100%',
      // Global text-size bump for this page only.
      '& .MuiTypography-root': { fontSize: `${textScale}em !important` },
      '& th, & td, & button, & label, & input, & textarea, & small': {
        fontSize: `${textScale}em !important`,
      },
      '& .MuiChip-root, & .MuiButton-root, & .MuiIconButton-root': {
        fontSize: `${textScale}em !important`,
      },
      // Visual refresh: whiter surfaces, darker text, reduced yellow accents.
      '& .MuiTypography-root, & th, & td': {
        color: '#111827 !important',
      },
      '& .MuiCard-root, & .MuiSheet-root, & .MuiTable-root': {
        backgroundColor: '#ffffff !important',
        color: '#111827 !important',
        borderColor: '#e5e7eb !important',
      },
      '& thead th': {
        backgroundColor: '#111827 !important',
        color: '#ffffff !important',
        borderColor: '#1f2937 !important',
      },
      '& .MuiModalDialog-root': {
        backgroundColor: '#ffffff !important',
        color: '#111827 !important',
        borderColor: '#e5e7eb !important',
      },
      '& .MuiChip-root': {
        color: '#111827 !important',
      },
      '& .MuiButton-root, & .MuiIconButton-root': {
        color: '#1f2937 !important',
        borderColor: '#d1d5db !important',
      },
      '& code': {
        backgroundColor: '#f3f4f6 !important',
        color: '#111827 !important',
        padding: '0 4px',
        borderRadius: 4,
      },
      '& [style*="#FFC72C"], & [style*="#ffC72C"], & [style*="#ffc72c"]': {
        color: '#1d4ed8 !important',
      },
    }}>
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        minWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto', 
        pt: compactLayout
          ? { xs: 0, sm: 0, md: 0 }
          : isLandscapeMobile 
            ? 0
            : { xs: 0, md: 0 },
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
            mb: 0.5,
            px: { xs: 1, sm: 0 },
            py: 1,
            position: 'sticky',
            top: 0,
            zIndex: 5,
            border: '2px solid transparent',
            borderRadius: 10,
            background: `linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(120deg, ${awayColors.primary}, ${awayColors.secondary}, ${homeColors.primary}, ${homeColors.secondary}) border-box`,
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}>
            <Box
              sx={{
                position: 'absolute',
                right: { sm: 8, md: 12 },
                top: 0,
                display: { xs: 'none', sm: 'flex' },
                flexDirection: 'row',
                alignItems: 'center',
                gap: { sm: 1.5, md: 2 },
                zIndex: 0,
                pointerEvents: 'none',
              }}
            >
              <Box
                component="img"
                src={getTeamLogoUrl(gameData.away_team_tricode)}
                alt={gameData.away_team_tricode}
                sx={{
                  width: { sm: 96, md: 108 },
                  height: { sm: 96, md: 108 },
                  objectFit: 'contain',
                  filter: selectedTeam === 'away' ? 'none' : 'grayscale(1) saturate(0)',
                  opacity: selectedTeam === 'away' ? 1 : 0.12,
                }}
              />
              <Box
                component="img"
                src={getTeamLogoUrl(gameData.home_team_tricode)}
                alt={gameData.home_team_tricode}
                sx={{
                  width: { sm: 96, md: 108 },
                  height: { sm: 96, md: 108 },
                  objectFit: 'contain',
                  filter: selectedTeam === 'home' ? 'none' : 'grayscale(1) saturate(0)',
                  opacity: selectedTeam === 'home' ? 1 : 0.12,
                }}
              />
            </Box>
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
                borderColor: '#333333',
                color: '#333333',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.06)',
                },
              }}
              title="Back"
            >
              <ArrowBack sx={{ fontSize: { xs: '1rem', md: '1.125rem' } }} />
            </IconButton>

            {/* Game Details Section - Right side */}
            <Box sx={{ 
              flex: 1, 
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              textAlign: 'left',
              position: 'relative',
              zIndex: 1,
              pr: { xs: 0, sm: 1, md: 1.5 },
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
                      color: '#111111',
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
                        {formatESTTime(gameData.game_date, 'time')} EST
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
                      color: '#666666', 
                      fontSize: { xs: '0.7rem', md: '0.75rem' },
                      mt: 0.5,
                    }}
                  >
                    {gameData.arena_name}
                    {gameData.arena_city && `, ${gameData.arena_city}`}
                  </Typography>
                )}
                <Box sx={{ mt: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip
                    size="sm"
                    variant="soft"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: '0.62rem', md: '0.68rem' },
                      bgcolor: `${hexToRgba(awayColors.primary, 0.14)} !important`,
                      color: '#0f172a !important',
                      border: `1px solid ${hexToRgba(awayColors.primary, 0.45)}`,
                    }}
                  >
                    {gameData.away_team_tricode} {formatSpreadWithOddsForHeader(headerTeamLines.awaySpread, headerTeamLines.awaySpreadOdds)}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="soft"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: '0.62rem', md: '0.68rem' },
                      bgcolor: `${hexToRgba(homeColors.primary, 0.14)} !important`,
                      color: '#0f172a !important',
                      border: `1px solid ${hexToRgba(homeColors.primary, 0.45)}`,
                    }}
                  >
                    {gameData.home_team_tricode} {formatSpreadWithOddsForHeader(headerTeamLines.homeSpread, headerTeamLines.homeSpreadOdds)}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="soft"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: '0.62rem', md: '0.68rem' },
                      bgcolor: '#dbeafe !important',
                      color: '#1e3a8a !important',
                      border: '1px solid #93c5fd',
                    }}
                  >
                    O/U {gameData.over_under != null ? Number(gameData.over_under).toFixed(1) : '--'}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="soft"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: '0.62rem', md: '0.68rem' },
                      bgcolor: '#dcfce7 !important',
                      color: '#166534 !important',
                      border: '1px solid #86efac',
                    }}
                  >
                    Props {playerProps?.length ?? 0}
                  </Chip>
                </Box>
                <Box
                  sx={{
                    mt: 0.9,
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' },
                    gap: 0.65,
                    width: '100%',
                  }}
                >
                  <Box sx={{ p: 0.6, border: `1px solid ${hexToRgba(awayColors.primary, 0.4)}`, borderRadius: 8, bgcolor: hexToRgba(awayColors.primary, 0.08) }}>
                    <Typography level="body-xs" sx={{ color: '#64748b', fontSize: '0.58rem' }}>Away Line</Typography>
                    <Typography level="body-sm" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.72rem' }}>
                      {gameData.away_team_tricode} {formatSpreadWithOddsForHeader(headerTeamLines.awaySpread, headerTeamLines.awaySpreadOdds)}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.6, border: `1px solid ${hexToRgba(homeColors.primary, 0.4)}`, borderRadius: 8, bgcolor: hexToRgba(homeColors.primary, 0.08) }}>
                    <Typography level="body-xs" sx={{ color: '#64748b', fontSize: '0.58rem' }}>Home Line</Typography>
                    <Typography level="body-sm" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.72rem' }}>
                      {gameData.home_team_tricode} {formatSpreadWithOddsForHeader(headerTeamLines.homeSpread, headerTeamLines.homeSpreadOdds)}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.6, border: '1px solid #e2e8f0', borderRadius: 8, bgcolor: '#f8fafc' }}>
                    <Typography level="body-xs" sx={{ color: '#64748b', fontSize: '0.58rem' }}>Total</Typography>
                    <Typography level="body-sm" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.72rem' }}>
                      {gameData.over_under != null ? Number(gameData.over_under).toFixed(1) : '--'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.6, border: '1px solid #e2e8f0', borderRadius: 8, bgcolor: '#f8fafc' }}>
                    <Typography level="body-xs" sx={{ color: '#64748b', fontSize: '0.58rem' }}>Game Props</Typography>
                    <Typography level="body-sm" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.72rem' }}>
                      {playerProps?.length ?? 0}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.6, border: '1px solid #e2e8f0', borderRadius: 8, bgcolor: '#f8fafc' }}>
                    <Typography level="body-xs" sx={{ color: '#64748b', fontSize: '0.58rem' }}>Injury Notes</Typography>
                    <Typography level="body-sm" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.72rem' }}>
                      {selectedTeamInjuryNotes.length}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 0.6, border: '1px solid #e2e8f0', borderRadius: 8, bgcolor: '#f8fafc' }}>
                    <Typography level="body-xs" sx={{ color: '#64748b', fontSize: '0.58rem' }}>Avg Rotation</Typography>
                    <Typography level="body-sm" sx={{ color: '#0f172a', fontWeight: 700, fontSize: '0.72rem' }}>
                      {selectedTeamAvgRotationSize != null ? selectedTeamAvgRotationSize.toFixed(1) : '--'}
                    </Typography>
                  </Box>
                </Box>
                {selectedTeamInjuryNotes.length > 0 && (
                  <Box sx={{ mt: 0.75 }}>
                    <Typography level="body-xs" sx={{ color: '#64748b', fontSize: '0.58rem', mb: 0.45 }}>
                      Injury Notes
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.45, flexWrap: 'wrap' }}>
                      {selectedTeamInjuryNotes.slice(0, 8).map((injury) => (
                        <Chip
                          key={`header-injury-${injury.nbaPlayerId}-${injury.injuryStatus}`}
                          size="sm"
                          variant="soft"
                          sx={{
                            fontWeight: 700,
                            fontSize: { xs: '0.56rem', md: '0.62rem' },
                            bgcolor: String(injury.injuryStatus).toLowerCase().includes('out')
                              ? '#fee2e2 !important'
                              : String(injury.injuryStatus).toLowerCase().includes('questionable')
                                ? '#fef3c7 !important'
                                : '#dbeafe !important',
                            color: String(injury.injuryStatus).toLowerCase().includes('out')
                              ? '#991b1b !important'
                              : String(injury.injuryStatus).toLowerCase().includes('questionable')
                                ? '#92400e !important'
                                : '#1e3a8a !important',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          {injury.playerName} - {injury.injuryStatus}
                        </Chip>
                      ))}
                      {selectedTeamInjuryNotes.length > 8 && (
                        <Chip
                          size="sm"
                          variant="soft"
                          sx={{
                            fontWeight: 700,
                            fontSize: { xs: '0.56rem', md: '0.62rem' },
                            bgcolor: '#f1f5f9 !important',
                            color: '#334155 !important',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          +{selectedTeamInjuryNotes.length - 8} more
                        </Chip>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{ px: { xs: 2, sm: 0 }, mb: 3 }}>
          {inlineModules.map(({ name, label, content }) => (
            <Box key={name} sx={{ mb: 3 }}>
              {name !== 'stats' && (
                <Typography level="title-md" sx={{ color: '#111111', fontWeight: 700, mb: 1.25 }}>
                  {label}
                </Typography>
              )}
              {content}
            </Box>
          ))}
          {inlineModules.length === 0 && (
            <Typography level="body-sm" sx={{ color: '#666666', py: 2 }}>
              No modules enabled.
            </Typography>
          )}
        </Box>

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

        {/* Persisted game highlights (MP4 clips) */}
        {gameData && (
          <Box sx={{ mt: 2, px: { xs: 2, sm: 0 } }}>
            {gameHighlightClipsLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress size="lg" sx={{ '--CircularProgress-trackColor': '#222', '--CircularProgress-progressColor': '#FFC72C' }} />
              </Box>
            )}
            {!gameHighlightClipsLoading && gameHighlightClips && gameHighlightClips.length > 0 && (
              <Box>
                <Typography level="h4" sx={{ color: '#FFF', fontFamily: '"Libre Baskerville", serif', mb: 1.5 }}>
                  Highlights
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: { xs: 2, md: 2.5 } }}>
                  {gameHighlightClips.map((clip) => (
                    <Card key={clip.id} variant="outlined" sx={{ bgcolor: '#111', borderColor: '#262626' }}>
                      <Box sx={{ width: '100%', aspectRatio: '16 / 9', bgcolor: '#000' }}>
                        <video
                          src={clip.mp4_url}
                          controls
                          preload="metadata"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </Box>
                      <CardContent sx={{ gap: 0.75 }}>
                        <Typography level="title-sm" sx={{ color: '#F1F1F1' }}>
                          {clip.description || `${clip.team_tricode || ''} Highlight`}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          {clip.period != null && (
                            <Chip size="sm" variant="soft" sx={{ bgcolor: 'rgba(255,199,44,0.12)', color: '#FFC72C' }}>
                              Q{clip.period}{clip.clock ? ` - ${clip.clock}` : ''}
                            </Chip>
                          )}
                          {clip.team_tricode && (
                            <Chip size="sm" variant="outlined" sx={{ borderColor: '#3A3A3A', color: '#CFCFCF' }}>
                              {clip.team_tricode}
                            </Chip>
                          )}
                          {clip.player_name && (
                            <Typography level="body-xs" sx={{ color: '#A8A8A8' }}>
                              {clip.player_name}
                            </Typography>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
        {!gameData && gameLoading && (
          <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress /></Box>
        )}
        {!gameData && !gameLoading && (
          <Box sx={{ p: 3, textAlign: 'center' }}><Alert color="warning"><Typography>Game not found</Typography></Alert></Box>
        )}

      </Box>
    </Box>
    </GamePageLayout>
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
        borderBottom: '1px solid #e2e8f0',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f8fafc';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <td style={{ minWidth: isMobile ? '90px' : '150px', width: isMobile ? '90px' : '150px', maxWidth: isMobile ? '90px' : '150px', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 9, backgroundColor: '#ffffff', padding: isMobile ? '8px 6px' : '12px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 0.25, md: 0.5 } }}>
            <Avatar
              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${nbaPlayerId}.png`}
              alt={playerName}
              sx={{ width: { xs: 16, md: 20 }, height: { xs: 16, md: 20 }, flexShrink: 0 }}
            />
            <Typography sx={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'center' }}>
              {playerName}
            </Typography>
          </Box>
          {(jerseyNumber || position) && (
            <Typography sx={{ color: '#64748b', fontSize: isMobile ? '0.55rem' : '0.65rem', lineHeight: 1 }}>
              {jerseyNumber ? `#${jerseyNumber}` : ''}
              {jerseyNumber && position ? ' • ' : ''}
              {position || ''}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
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
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'mpg' in displayStats ? (displayStats.mpg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#2563eb', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', fontWeight: 600, padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats ? (displayStats.ppg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats ? (displayStats.rpg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats ? (displayStats.apg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'spg' in displayStats ? (displayStats.spg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'bpg' in displayStats ? (displayStats.bpg?.toFixed(1) || '0.0') : 'N/A'}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'fg_pct' in displayStats && displayStats.fg_pct !== undefined 
              ? (displayStats.fg_pct * 100).toFixed(1) + '%' 
              : 'N/A'}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'fg3_pct' in displayStats && displayStats.fg3_pct !== undefined 
              ? (displayStats.fg3_pct * 100).toFixed(1) + '%' 
              : 'N/A'}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {displayStats && 'ft_pct' in displayStats && displayStats.ft_pct !== undefined 
              ? (displayStats.ft_pct * 100).toFixed(1) + '%' 
              : 'N/A'}
          </td>
        </>
      )}
      {(gameState === 'live' || gameState === 'completed') && (
        <>
          <td style={{ color: '#2563eb', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', fontWeight: 600, padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {stats?.pts || 0}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {stats?.reb || 0}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {stats?.ast || 0}
          </td>
          <td style={{ color: '#0f172a', fontSize: isMobile ? '0.65rem' : '0.75rem', textAlign: 'right', padding: isMobile ? '8px 4px' : '12px 8px' }}>
            {fantasyPoints?.toFixed(1) || '0.0'}
          </td>
        </>
      )}
    </tr>
  );
}
