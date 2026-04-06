import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Alert,
  CircularProgress,
  IconButton,
  LinearProgress,
  Tabs,
  TabList,
  Tab,
  Grid,
} from '@mui/joy';
import { ArrowBack, CalendarToday, EmojiEvents, BarChart, Analytics, NavigateBefore, NavigateNext } from '@mui/icons-material';
import { FaFire, FaSnowflake } from 'react-icons/fa';
import dayjs, { Dayjs } from 'dayjs';
import { supabase } from '../utils/supabase';
import { getTeamColors } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { FANDUEL_SCORING } from '../utils/fantasyScoring';
import { calculatePropResult } from '../utils/playerPropsCalculator';
import BoxScore from '../components/BoxScore';
import { FeedPost } from '../utils/feedAlgorithm';

interface GameData {
  game_id: string;
  game_status: number;
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
  stats: any;
  fantasy_points?: number;
  position?: string;
}

interface RosterPlayer {
  id: string;
  nba_player_id: number;
  player_name: string;
  position: string;
  jersey_number: string;
  player_id?: string;
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

interface GameDetailViewProps {
  gameId: string;
  onBack?: () => void;
  returnPath?: string;
  returnDate?: string;
  selectedDate?: Dayjs;
  onDateChange?: (date: Dayjs) => void;
}

export default function GameDetailView({
  gameId,
  onBack,
  returnPath = '/feed',
  returnDate,
  selectedDate: propSelectedDate,
  onDateChange,
}: GameDetailViewProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isLandscapeMobile = isLandscape && isMobile;

  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => {
    if (propSelectedDate) return propSelectedDate;
    if (returnDate) return dayjs(returnDate);
    return dayjs();
  });

  const [selectedTeam, setSelectedTeam] = useState<'away' | 'home'>('away');
  const [activeView, setActiveView] = useState<'stats' | 'props' | 'advanced'>('stats');
  const [advancedSortColumn, setAdvancedSortColumn] = useState<string | null>(null);
  const [advancedSortDirection, setAdvancedSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Sorting state for basic stats table (default to MPG descending to match original behavior)
  const [basicSortColumn, setBasicSortColumn] = useState<string | null>('mpg');
  const [basicSortDirection, setBasicSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch game data
  const { data: gameData, isLoading: gameLoading } = useQuery<GameData | null>({
    queryKey: ['game-data-full', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      const cleanGameId = String(gameId).trim();
      
      const { data, error } = await supabase
        .from('nba_games')
        .select('game_id, game_status, game_status_text, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_date, arena_name, arena_city')
        .eq('game_id', cleanGameId)
        .maybeSingle();
      
      if (!data && !error && cleanGameId.startsWith('00')) {
        const withoutLeadingZeros = cleanGameId.replace(/^0+/, '');
        const { data: altData } = await supabase
          .from('nba_games')
          .select('game_id, game_status, game_status_text, home_team_tricode, away_team_tricode, home_team_score, away_team_score, game_date, arena_name, arena_city')
          .eq('game_id', withoutLeadingZeros)
          .maybeSingle();
        if (altData) return { ...altData, home_team_id: undefined, away_team_id: undefined };
      }
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching game data:', error);
        return null;
      }
      
      if (!data) return null;
      
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

  // Fetch live stats - returns object with stats array and isLive flag
  const { data: liveStatsData, isLoading: liveStatsLoading } = useQuery<{ stats: PlayerStat[]; isLive: boolean }>({
    queryKey: ['live-player-stats-game', gameId],
    queryFn: async () => {
      const { data: liveData, error: liveError } = await supabase
        .from('live_player_stats')
        .select('nba_player_id, player_id, player_name, team_tricode, team_id, stats')
        .eq('game_id', gameId)
        .order('team_tricode')
        .order('stats->min', { ascending: false, nullsFirst: false });
      
      if (liveError) {
        console.error('Error fetching live stats:', liveError);
      }
      
      if (liveData && liveData.length > 0) {
        const playerIds = liveData.map(p => p.nba_player_id);
        const teamIds = [...new Set(liveData.map(p => p.team_id).filter(Boolean))];
        let playerPositions: Map<number, string> = new Map();
        let playerTeams: Map<number, string> = new Map();
        let teamIdToTricode: Map<number, string> = new Map();
        
        if (teamIds.length > 0) {
          const { data: teamsData } = await supabase
            .from('nba_teams')
            .select('team_id, abbreviation')
            .in('team_id', teamIds);
          if (teamsData) {
            teamsData.forEach(t => {
              if (t.abbreviation) teamIdToTricode.set(t.team_id, t.abbreviation);
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
              if (p.position) playerPositions.set(p.nba_player_id, p.position);
              if (p.team_abbreviation) playerTeams.set(p.nba_player_id, p.team_abbreviation);
            });
          }
        }
        
        // Return with isLive flag set to true since we got data from live_player_stats
        return { stats: liveData.map((player) => {
          const teamTricode = player.team_tricode 
            || (player.team_id ? teamIdToTricode.get(player.team_id) : null)
            || playerTeams.get(player.nba_player_id) 
            || null;
          let stats = player.stats || {};
          if (typeof stats === 'string') {
            try {
              stats = JSON.parse(stats);
            } catch (e) {
              stats = {};
            }
          }
          
          if (!stats || typeof stats !== 'object') {
            stats = {};
          }
          
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
          
          // Only use roster (nba_players) for current team — do not fall back to game team_tricode.
          const currentTeam = playerTeams.get(player.nba_player_id) ?? undefined;
          return {
            ...player,
            team_tricode: teamTricode,
            current_team_tricode: currentTeam,
            stats: stats,
            position: playerPositions.get(player.nba_player_id),
            fantasy_points: fantasyPoints,
          };
        }), isLive: true };
      }
      
      // Fallback to nba_boxscores (game is completed, not live)
      const { data: boxScoreData, error: boxScoreError } = await supabase
        .from('nba_boxscores')
        .select('*')
        .eq('game_id', gameId)
        .order('team_tricode')
        .order('min', { ascending: false, nullsFirst: false });
      
      if (boxScoreError) {
        console.error('Error fetching box scores:', boxScoreError);
        return { stats: [], isLive: false };
      }
      
      if (!boxScoreData || boxScoreData.length === 0) {
        return { stats: [], isLive: false };
      }
      
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
      
      return { 
        stats: boxScoreData.map((player) => {
        const min = typeof player.min === 'string' ? parseFloat(player.min) : (player.min || 0);
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
        }), 
        isLive: false 
      };
    },
    enabled: !!gameId && !!gameData,
    refetchInterval: (data) => data?.isLive ? 30000 : false, // Only refetch if game is live
  });
  
  // Extract stats and isLive flag
  const liveStats = liveStatsData?.stats || [];
  const isGameLive = liveStatsData?.isLive || false;

  // Determine game state - must be after liveStats is defined
  const gameState = useMemo(() => {
    if (!gameData) return 'loading';
    
    // Check if game is final - either by status, status text, or having both scores
    const hasFinalScores = gameData.home_team_score !== null && 
                           gameData.away_team_score !== null &&
                           gameData.home_team_score > 0 && 
                           gameData.away_team_score > 0;
    const isFinalStatus = gameData.game_status === 3;
    const isFinalText = gameData.game_status_text?.toLowerCase().includes('final');
    const isFinal = isFinalStatus || isFinalText || hasFinalScores;
    
    // Check if we have live stats from live_player_stats table (not box scores)
    // This is the most reliable way to determine if a game is currently live
    const hasLiveStats = isGameLive && liveStats && liveStats.length > 0;
    
    console.log('🎮 Game State Detection:', {
      game_status: gameData.game_status,
      game_status_text: gameData.game_status_text,
      home_score: gameData.home_team_score,
      away_score: gameData.away_team_score,
      hasFinalScores,
      isFinalStatus,
      isFinalText,
      isFinal,
      hasLiveStats,
      isGameLive,
      liveStatsCount: liveStats?.length || 0
    });
    
    // If we have final scores, it's definitely completed
    if (hasFinalScores) return 'completed';
    if (isFinal) return 'completed';
    
    // If we have live stats from live_player_stats, game is definitely live (even if game_status says upcoming)
    if (hasLiveStats) return 'live';
    
    // Check game_status from database
    if (gameData.game_status === 1) return 'upcoming';
    if (gameData.game_status === 2) return 'live';
    
    return 'completed';
  }, [gameData, liveStats, isGameLive]);

  // Fetch feed posts
  const { data: feedPosts } = useQuery<FeedPost[]>({
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
      
      const sortedPosts = [...data].sort((a, b) => {
        if (a.post_type === 'fun_score' && b.post_type !== 'fun_score') return -1;
        if (a.post_type !== 'fun_score' && b.post_type === 'fun_score') return 1;
        if (a.post_type === 'fun_score' && b.post_type === 'fun_score') {
          const funScoreA = typeof a.metadata === 'object' ? (a.metadata?.fun_score || 0) : 0;
          const funScoreB = typeof b.metadata === 'object' ? (b.metadata?.fun_score || 0) : 0;
          return funScoreB - funScoreA;
        }
        if (a.post_type === 'player_spotlight' && b.post_type === 'player_spotlight') {
          const metaA = typeof a.metadata === 'object' ? a.metadata : (typeof a.metadata === 'string' ? JSON.parse(a.metadata) : {});
          const metaB = typeof b.metadata === 'object' ? b.metadata : (typeof b.metadata === 'string' ? JSON.parse(b.metadata) : {});
          const fpA = metaA?.fantasyPoints || 0;
          const fpB = metaB?.fantasyPoints || 0;
          return fpB - fpA;
        }
        return 0;
      });
      
      return sortedPosts as FeedPost[];
    },
    enabled: !!gameId,
  });

  // Fetch player props
  const { data: playerProps } = useQuery<PlayerProp[]>({
    queryKey: ['player-props-game', gameId, gameData?.game_date, gameData?.home_team_tricode, gameData?.away_team_tricode, selectedTeam],
    queryFn: async () => {
      if (!gameData?.game_date) {
        console.log('❌ No game_date, returning empty array');
        return [];
      }
      
      const gameDate = gameData.game_date.split('T')[0];
      const homeTeam = gameData.home_team_tricode;
      const awayTeam = gameData.away_team_tricode;
      
      console.log('🔍 Fetching player props for game:', {
        gameId,
        gameDate,
        homeTeam,
        awayTeam
      });
      
      // Strategy 1: Try to find matching player_props_games entry
      let propsGameId: string | null = null;
      let matchedPropsGame: any = null;
      let eventId: string | null = null;
      
      // First, try matching by nba_game_id (most reliable)
      if (gameId) {
        const { data: propsGameByNbaId, error: nbaIdError } = await supabase
          .from('player_props_games')
          .select('id, game_date, home_team_tricode, away_team_tricode, event_id, nba_game_id')
          .eq('nba_game_id', gameId)
          .limit(1)
          .maybeSingle();
        
        if (!nbaIdError && propsGameByNbaId) {
          propsGameId = propsGameByNbaId.id;
          eventId = propsGameByNbaId.event_id;
          matchedPropsGame = propsGameByNbaId;
          console.log('✅ Found props game by nba_game_id:', propsGameByNbaId.id, 'event_id:', eventId);
        } else {
          console.log('⚠️ No props_game found by nba_game_id:', gameId, 'error:', nbaIdError);
        }
      }
      
      // If no match by nba_game_id, try to find event_id by analyzing props
      // Use player_id (which matches nba_players.id) to join and get team info directly
      if (!propsGameId && gameDate && homeTeam && awayTeam) {
        console.log('🔍 Trying to find event_id by analyzing props and matching teams...');
        const gameDateObj = new Date(gameDate);
        const prevDay = new Date(gameDateObj);
        prevDay.setDate(prevDay.getDate() - 1);
        const nextDay = new Date(gameDateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        const prevDayStr = prevDay.toISOString().split('T')[0];
        const nextDayStr = nextDay.toISOString().split('T')[0];
        
        // Get props with player team info using join (player_id = nba_players.id)
        const { data: sampleProps, error: sampleError } = await supabase
          .from('player_props')
          .select(`
            event_id,
            game_id,
            game_date,
            player_id,
            nba_players!inner(id, team_abbreviation)
          `)
          .in('game_date', [gameDate, prevDayStr, nextDayStr])
          .limit(2000); // Get a larger sample
        
        if (!sampleError && sampleProps && sampleProps.length > 0) {
          // Get unique event_ids
          const uniqueEventIds = [...new Set(sampleProps.map((p: any) => p.event_id).filter(Boolean))];
          
          console.log('🔍 Found', uniqueEventIds.length, 'unique event_ids in sample props');
          
          // Group props by event_id and count how many match our teams
          // player_id matches nba_players.id, so we can access team_abbreviation directly
          const eventTeamCounts = new Map<string, { home: number; away: number; total: number }>();
          sampleProps.forEach((prop: any) => {
            if (!prop.event_id) return;
            const playerTeam = prop.nba_players?.team_abbreviation;
            if (!playerTeam) return;
            
            if (!eventTeamCounts.has(prop.event_id)) {
              eventTeamCounts.set(prop.event_id, { home: 0, away: 0, total: 0 });
            }
            const counts = eventTeamCounts.get(prop.event_id)!;
            counts.total++;
            if (playerTeam === homeTeam) counts.home++;
            if (playerTeam === awayTeam) counts.away++;
          });
          
          // Find the event_id with the most props matching our teams
          let bestEventId: string | null = null;
          let bestScore = 0;
          eventTeamCounts.forEach((counts, evtId) => {
            // Score based on how many props match our teams (both teams must have props)
            const score = counts.home + counts.away;
            if (score > bestScore && counts.home > 0 && counts.away > 0) {
              bestScore = score;
              bestEventId = evtId;
            }
          });
          
          if (bestEventId) {
            console.log('✅ Found best event_id by team matching:', bestEventId, 'score:', bestScore, 'home:', eventTeamCounts.get(bestEventId)?.home, 'away:', eventTeamCounts.get(bestEventId)?.away);
            eventId = bestEventId;
            
            // Try to get the props_game for this event_id
            const { data: propsGameByEvent } = await supabase
              .from('player_props_games')
              .select('id, game_date, home_team_tricode, away_team_tricode, event_id, nba_game_id')
              .eq('event_id', bestEventId)
              .limit(1)
              .maybeSingle();
            
            if (propsGameByEvent) {
              propsGameId = propsGameByEvent.id;
              matchedPropsGame = propsGameByEvent;
              console.log('✅ Found props_game for event_id:', propsGameId);
            }
          } else {
            console.log('⚠️ Could not find event_id by team matching');
          }
        }
      }
      
      
      // If no match by nba_game_id or event_id, try by teams and date
      if (!propsGameId && homeTeam && awayTeam) {
        // Try exact date match first
        const { data: propsGameExact, error: exactError } = await supabase
          .from('player_props_games')
          .select('id, game_date, home_team_tricode, away_team_tricode, event_id')
        .eq('game_date', gameDate)
          .or(`home_team_tricode.eq.${homeTeam},away_team_tricode.eq.${homeTeam},home_team_tricode.eq.${awayTeam},away_team_tricode.eq.${awayTeam}`)
          .limit(10); // Get multiple to find best match
        
        if (!exactError && propsGameExact && propsGameExact.length > 0) {
          // Find the one where both teams match
          const matched = propsGameExact.find((pg: any) => {
            const teamsMatch = 
              (pg.home_team_tricode === homeTeam && pg.away_team_tricode === awayTeam) ||
              (pg.home_team_tricode === awayTeam && pg.away_team_tricode === homeTeam);
            return teamsMatch;
          });
          
          if (matched) {
            propsGameId = matched.id;
            eventId = matched.event_id;
            matchedPropsGame = matched;
            console.log('✅ Found props game by exact date match:', matched.id, 'event_id:', eventId);
          } else {
            console.log('⚠️ Found props games but teams don\'t match:', propsGameExact.map((pg: any) => ({
              id: pg.id,
              date: pg.game_date,
              home: pg.home_team_tricode,
              away: pg.away_team_tricode,
              event_id: pg.event_id
            })));
          }
        }
        
        // If no exact match, try date +/- 1 day (handles timezone/date offset issues)
        if (!propsGameId) {
          const gameDateObj = new Date(gameDate);
          const prevDay = new Date(gameDateObj);
          prevDay.setDate(prevDay.getDate() - 1);
          const nextDay = new Date(gameDateObj);
          nextDay.setDate(nextDay.getDate() + 1);
          
          const prevDayStr = prevDay.toISOString().split('T')[0];
          const nextDayStr = nextDay.toISOString().split('T')[0];
          
          const { data: propsGameNearby, error: nearbyError } = await supabase
            .from('player_props_games')
            .select('id, game_date, home_team_tricode, away_team_tricode, event_id')
            .in('game_date', [prevDayStr, nextDayStr])
            .or(`home_team_tricode.eq.${homeTeam},away_team_tricode.eq.${homeTeam},home_team_tricode.eq.${awayTeam},away_team_tricode.eq.${awayTeam}`)
            .limit(10);
          
          if (!nearbyError && propsGameNearby && propsGameNearby.length > 0) {
            // Find the one where both teams match
            const matched = propsGameNearby.find((pg: any) => {
              const teamsMatch = 
                (pg.home_team_tricode === homeTeam && pg.away_team_tricode === awayTeam) ||
                (pg.home_team_tricode === awayTeam && pg.away_team_tricode === homeTeam);
              return teamsMatch;
            });
            
            if (matched) {
              propsGameId = matched.id;
              eventId = matched.event_id;
              matchedPropsGame = matched;
              console.log('✅ Found props game by nearby date match:', matched.id, 'date:', matched.game_date, 'event_id:', eventId);
            } else {
              console.log('⚠️ Found nearby props games but teams don\'t match:', propsGameNearby.map((pg: any) => ({
                id: pg.id,
                date: pg.game_date,
                home: pg.home_team_tricode,
                away: pg.away_team_tricode,
                event_id: pg.event_id
              })));
            }
          }
        }
      }
      
      // Strategy 2: Fetch props - try by game_id first if we found a match, then fall back to game_date
      const gameDateObj = new Date(gameDate);
      const prevDay = new Date(gameDateObj);
      prevDay.setDate(prevDay.getDate() - 1);
      const nextDay = new Date(gameDateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const prevDayStr = prevDay.toISOString().split('T')[0];
      const nextDayStr = nextDay.toISOString().split('T')[0];
      
      let propsQuery = supabase
        .from('player_props')
        .select('id, bet_type, line, price, american_odds, bookmaker, player_name, nba_player_id, player_id, bet_type_id, game_id, game_date, event_id');
      
      if (propsGameId) {
        // Use game_id from player_props_games (most reliable)
        propsQuery = propsQuery.eq('game_id', propsGameId);
        console.log('📊 Fetching props by game_id:', propsGameId);
      } else if (eventId) {
        // Fall back to event_id if we found one (this gets props for the specific game)
        propsQuery = propsQuery.eq('event_id', eventId);
        console.log('📊 Fetching props by event_id:', eventId);
      } else {
        // Fall back to game_date matching (try exact date and +/- 1 day)
        // WARNING: This will get props from ALL games on this date, limited to 1000 rows
        propsQuery = propsQuery.in('game_date', [gameDate, prevDayStr, nextDayStr]);
        console.log('⚠️ Fetching props by game_date (no props_game match) - may include props from other games:', [gameDate, prevDayStr, nextDayStr]);
      }
      
      const { data: allProps, error: propsError } = await propsQuery
        .order('player_name')
        .order('bet_type')
        .limit(10000); // Increase limit to get all props (Supabase default is 1000)
      
      if (propsError) {
        console.error('❌ Error fetching player props:', propsError);
        return [];
      }
      
      console.log('📊 Total props fetched:', allProps?.length || 0);
      
      if (!allProps || allProps.length === 0) {
        return [];
      }
      
      // Filter props by matching players' teams from nba_players table
      // Use player_id (which matches nba_players.id) to filter by team
      // This is more efficient than looking up by nba_player_id
      if (!homeTeam || !awayTeam) {
        console.log('⚠️ No team tricodes available - returning all props');
        return allProps;
      }
      
      // Determine which team we're showing
      const targetTeam = selectedTeam === 'home' ? homeTeam : awayTeam;
      
      // Get unique player_ids from props
      const uniquePlayerIds = [...new Set(allProps.map((p: any) => p.player_id).filter(Boolean))];
      
      if (uniquePlayerIds.length === 0) {
        console.log('⚠️ No player_id in props - cannot filter by team');
        return [];
      }
      
      // Look up players' teams from nba_players using player_id = id
      const { data: playersData, error: playersError } = await supabase
        .from('nba_players')
        .select('id, team_abbreviation')
        .in('id', uniquePlayerIds);
      
      if (playersError) {
        console.error('❌ Error fetching player teams:', playersError);
        return allProps; // Return all props if we can't filter
      }
      
      // Create a map of player_id to team_abbreviation
      const playerTeamMap = new Map<string, string>();
      (playersData || []).forEach((p: any) => {
        if (p.id && p.team_abbreviation) {
          playerTeamMap.set(p.id, p.team_abbreviation);
        }
      });
      
      console.log('📊 Player team map size:', playerTeamMap.size);
      console.log('📊 Looking for players from:', targetTeam);
      console.log('📊 Sample player teams:', Array.from(playerTeamMap.entries()).slice(0, 10).map(([id, team]) => ({ id, team })));
      
      // Debug: Check what teams the props have
      const propsByTeam = new Map<string, number>();
      allProps.forEach((prop: any) => {
        if (prop.player_id) {
          const playerTeam = playerTeamMap.get(prop.player_id);
          const teamKey = playerTeam || 'UNKNOWN';
          propsByTeam.set(teamKey, (propsByTeam.get(teamKey) || 0) + 1);
        }
      });
      console.log('📊 Props by team:', Object.fromEntries(propsByTeam));
      
      // Filter props to only include players from the selected team
      const filteredProps = allProps.filter((prop: any) => {
        if (!prop.player_id) {
          console.log('⚠️ Prop missing player_id:', prop.player_name);
          return false;
        }
        const playerTeam = playerTeamMap.get(prop.player_id);
        if (!playerTeam) {
          console.log('⚠️ Player team not found for:', prop.player_name, prop.player_id);
          return false;
        }
        const matches = playerTeam === targetTeam;
        if (!matches) {
          console.log('⚠️ Team mismatch:', prop.player_name, 'team:', playerTeam, 'target:', targetTeam);
        }
        return matches;
      });
      
      console.log('✅ Filtered props by player teams:', filteredProps.length, 'out of', allProps.length);
      console.log('📊 Unique players in filtered props:', [...new Set(filteredProps.map((p: any) => p.player_name))]);
      console.log('📊 Sample filtered props:', filteredProps.slice(0, 5).map((p: any) => ({
        player: p.player_name,
        player_id: p.player_id,
        team: playerTeamMap.get(p.player_id)
      })));
      
      return filteredProps;
    },
    enabled: !!gameId && !!gameData && !!gameData?.game_date,
  });

  // Fetch rosters
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
      
      return data || [];
    },
    enabled: !!gameData && !!gameData?.home_team_id && !!currentSeason && gameData?.game_status === 1,
  });

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
      
      return data || [];
    },
    enabled: !!gameData && !!gameData?.away_team_id && !!currentSeason && gameData?.game_status === 1,
  });

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
            fg3a: stats.fg3a || 0,
            ftm: stats.ftm || 0,
            fta: stats.fta || 0,
            fgm: stats.fgm || 0,
            fga: stats.fga || 0,
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

  // Calculate these values before early returns (needed for hooks)
  const currentTeamTricode = gameData && (selectedTeam === 'away' 
    ? gameData.away_team_tricode 
    : gameData.home_team_tricode);
  const currentRoster = selectedTeam === 'away' ? awayRoster : homeRoster;
  // Only show players who are currently on this team (exclude traded players)
  const normalizeTricode = (s: string | null | undefined) => (s ?? '').toString().trim().toUpperCase();
  const currentTeamStats = (liveStats || []).filter(player => {
    const effectiveTeam = (player as any).current_team_tricode ?? player.team_tricode;
    return normalizeTricode(effectiveTeam) === normalizeTricode(currentTeamTricode);
  });

  // Fetch player stats for upcoming games - sorted by minutes played (descending)
  // MUST be called before any early returns to follow Rules of Hooks
  const { data: upcomingPlayerStats, isLoading: upcomingStatsLoading } = useQuery({
    queryKey: ['upcoming-player-stats', currentTeamTricode, currentSeason, selectedTeam],
    queryFn: async () => {
      if (!currentTeamTricode || !currentSeason || gameState !== 'upcoming') return [];
      
      const roster = currentRoster || [];
      const playerIds = roster
        .map((p: any) => p.player_id || (p.nba_player_id ? String(p.nba_player_id) : null))
        .filter(Boolean) as string[];
      
      if (playerIds.length === 0) return [];
      
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
        .sort((a, b) => b.min - a.min);
    },
    enabled: gameState === 'upcoming' && !!currentTeamTricode && !!currentSeason && !!currentRoster && !!gameData,
  });

  // Fetch recent player stats (last 15 days) for trend indicators
  const { data: recentPlayerStats } = useQuery({
    queryKey: ['recent-player-stats', currentTeamTricode, currentSeason, selectedTeam],
    queryFn: async () => {
      if (!currentTeamTricode || !currentSeason || gameState !== 'upcoming') return new Map();
      
      const roster = currentRoster || [];
      const playerIds = roster
        .map((p: any) => p.player_id || (p.nba_player_id ? String(p.nba_player_id) : null))
        .filter(Boolean) as string[];
      
      if (playerIds.length === 0) return new Map();
      
      // Calculate date 15 days ago
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      const dateString = fifteenDaysAgo.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('player_id, nba_player_id, player_name, team_tricode, min, pts, reb, ast, stl, blk, fgm, fga, fg3m, fg3a, ftm, fta, game_date')
        .in('player_id', playerIds)
        .eq('season_year', currentSeason)
        .gte('game_date', dateString)
        .gt('min', 0);
      
      if (error) {
        console.error('Error fetching recent player stats:', error);
        return new Map();
      }
      
      const statsMap = new Map<string, { 
        player_id: string; 
        nba_player_id: number; 
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
      
      // Calculate averages and return as map
      const recentAveragesMap = new Map<string, {
        mpg: number;
        ppg: number;
        rpg: number;
        apg: number;
        spg: number;
        bpg: number;
        fg_pct: number;
        fg3_pct: number;
        ft_pct: number;
      }>();
      
      statsMap.forEach((player, key) => {
        if (player.games > 0) {
          recentAveragesMap.set(key, {
            mpg: player.min / player.games,
            ppg: player.pts / player.games,
            rpg: player.reb / player.games,
            apg: player.ast / player.games,
            spg: player.stl / player.games,
            bpg: player.blk / player.games,
            fg_pct: player.fga > 0 ? player.fgm / player.fga : 0,
            fg3_pct: player.fg3a > 0 ? player.fg3m / player.fg3a : 0,
            ft_pct: player.fta > 0 ? player.ftm / player.fta : 0,
          });
        }
      });
      
      return recentAveragesMap;
    },
    enabled: gameState === 'upcoming' && !!currentTeamTricode && !!currentSeason && !!currentRoster && !!gameData,
  });

  // Fetch advanced stats for upcoming games (averages) or live/completed games (actual)
  const { data: advancedStats, isLoading: advancedStatsLoading } = useQuery({
    queryKey: ['advanced-stats', gameId, currentTeamTricode, currentSeason, selectedTeam, gameState],
    queryFn: async () => {
      if (!currentTeamTricode || !currentSeason) return [];
      
      // For upcoming games, use roster. For live/completed games, use liveStats
      let playerIds: string[] = [];
      if (gameState === 'upcoming') {
        const roster = currentRoster || [];
        playerIds = roster
          .map((p: any) => p.player_id || (p.nba_player_id ? String(p.nba_player_id) : null))
          .filter(Boolean) as string[];
      } else {
        // For live/completed games, get player IDs from liveStats (only players currently on this team)
        const norm = (s: string | null | undefined) => (s ?? '').toString().trim().toUpperCase();
        const teamStats = (liveStats || []).filter((p: any) => {
          const effectiveTeam = p.current_team_tricode ?? p.team_tricode;
          return norm(effectiveTeam) === norm(currentTeamTricode);
        });
        
        // First, try to use player_id directly from liveStats (available in nba_boxscores for completed games)
        const directPlayerIds = teamStats
          .map((p: any) => p.player_id)
          .filter(Boolean) as string[];
        
        if (directPlayerIds.length > 0) {
          // Use player_id directly if available (completed games from nba_boxscores)
          playerIds = [...new Set(directPlayerIds)];
        } else {
          // Fallback: For live games, map nba_player_id to player_id
          const nbaPlayerIds = [...new Set(teamStats.map((p: any) => p.nba_player_id).filter(Boolean))];
          
          if (nbaPlayerIds.length > 0) {
            // Look up player_id (nba_players.id) from nba_player_id
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
      
      console.log('🔍 Advanced Stats Query:', {
        gameState,
        currentTeamTricode,
        playerIdsCount: playerIds.length,
        playerIds: playerIds.slice(0, 5),
        hasLiveStats: !!liveStats,
        liveStatsCount: liveStats?.length || 0
      });
      
      if (playerIds.length === 0) {
        console.warn('⚠️ No player IDs found for advanced stats query');
        return [];
      }
      
      // Use the same logic for all game states: calculate season averages from nba_player_game_stats
      console.log('🔍 Fetching advanced stats season averages, playerIds:', playerIds.length, 'season:', currentSeason);
      const { data, error } = await supabase
        .from('nba_player_game_stats')
        .select('player_id, game_id, advanced_offensiverating, advanced_defensiverating, advanced_netrating, advanced_trueshootingpercentage, advanced_usagepercentage, advanced_assistratio, advanced_reboundpercentage, fourfactors_effectivefieldgoalpercentage, fourfactors_turnoverpercentage, hustle_contestedshots, hustle_deflections, playertrack_touches, playertrack_passes, misc_pointspaint')
        .in('player_id', playerIds)
        .eq('season_year', currentSeason);
      
      if (error) {
        console.error('❌ Error fetching advanced stats:', error);
        return [];
      }
      
      console.log('📊 Advanced stats fetched:', data?.length || 0, 'rows');
      
      // Calculate averages
      const statsMap = new Map<string, any>();
      
      (data || []).forEach((game: any) => {
        const key = game.player_id;
        const existing = statsMap.get(key);
        
        if (existing) {
          existing.games += 1;
          existing.off_rtg += parseFloat(game.advanced_offensiverating || '0');
          existing.def_rtg += parseFloat(game.advanced_defensiverating || '0');
          existing.net_rtg += parseFloat(game.advanced_netrating || '0');
          existing.ts_pct += parseFloat(game.advanced_trueshootingpercentage || '0');
          existing.usg_pct += parseFloat(game.advanced_usagepercentage || '0');
          existing.ast_ratio += parseFloat(game.advanced_assistratio || '0');
          existing.reb_pct += parseFloat(game.advanced_reboundpercentage || '0');
          existing.efg_pct += parseFloat(game.fourfactors_effectivefieldgoalpercentage || '0');
          existing.tov_pct += parseFloat(game.fourfactors_turnoverpercentage || '0');
          existing.contested_shots += game.hustle_contestedshots || 0;
          existing.deflections += game.hustle_deflections || 0;
          existing.touches += game.playertrack_touches || 0;
          existing.passes += game.playertrack_passes || 0;
          existing.paint_pts += game.misc_pointspaint || 0;
        } else {
          statsMap.set(key, {
            player_id: game.player_id,
            games: 1,
            off_rtg: parseFloat(game.advanced_offensiverating || '0'),
            def_rtg: parseFloat(game.advanced_defensiverating || '0'),
            net_rtg: parseFloat(game.advanced_netrating || '0'),
            ts_pct: parseFloat(game.advanced_trueshootingpercentage || '0'),
            usg_pct: parseFloat(game.advanced_usagepercentage || '0'),
            ast_ratio: parseFloat(game.advanced_assistratio || '0'),
            reb_pct: parseFloat(game.advanced_reboundpercentage || '0'),
            efg_pct: parseFloat(game.fourfactors_effectivefieldgoalpercentage || '0'),
            tov_pct: parseFloat(game.fourfactors_turnoverpercentage || '0'),
            contested_shots: game.hustle_contestedshots || 0,
            deflections: game.hustle_deflections || 0,
            touches: game.playertrack_touches || 0,
            passes: game.playertrack_passes || 0,
            paint_pts: game.misc_pointspaint || 0,
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
          
          return {
            player_id: playerId,
            nba_player_id: playerInfo.nba_player_id,
            player_name: playerInfo.player_name,
            team_tricode: playerInfo.team_tricode,
            off_rtg: stats.games > 0 ? stats.off_rtg / stats.games : 0,
            def_rtg: stats.games > 0 ? stats.def_rtg / stats.games : 0,
            net_rtg: stats.games > 0 ? stats.net_rtg / stats.games : 0,
            ts_pct: stats.games > 0 ? stats.ts_pct / stats.games : 0,
            usg_pct: stats.games > 0 ? stats.usg_pct / stats.games : 0,
            ast_ratio: stats.games > 0 ? stats.ast_ratio / stats.games : 0,
            reb_pct: stats.games > 0 ? stats.reb_pct / stats.games : 0,
            efg_pct: stats.games > 0 ? stats.efg_pct / stats.games : 0,
            tov_pct: stats.games > 0 ? stats.tov_pct / stats.games : 0,
            contested_shots: stats.games > 0 ? stats.contested_shots / stats.games : 0,
            deflections: stats.games > 0 ? stats.deflections / stats.games : 0,
            touches: stats.games > 0 ? stats.touches / stats.games : 0,
            passes: stats.games > 0 ? stats.passes / stats.games : 0,
            paint_pts: stats.games > 0 ? stats.paint_pts / stats.games : 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b?.touches || 0) - (a?.touches || 0));
    },
    enabled: !!currentTeamTricode && !!currentSeason && !!gameData && (gameState === 'upcoming' ? !!currentRoster : !!liveStats), // For all game states, need roster or liveStats to get player IDs
  });

  // Early returns - must come AFTER all hooks
  if (gameLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', bgcolor: '#000000' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!gameData) {
    return (
      <Card variant="outlined" sx={{ bgcolor: 'background.level1', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <CardContent sx={{ p: 2, bgcolor: '#000000' }}>
          <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>
              Game not found. The game may not exist in the database or the game ID may be incorrect.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const gameDate = gameData?.game_date ? dayjs(gameData.game_date) : selectedDate;
  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(returnPath, {
        state: returnDate ? { selectedDate: returnDate } : undefined
      });
    }
  };

  // Render upcoming game view - Single full-width table
  const renderUpcomingView = () => {
    if (homeRosterLoading || awayRosterLoading || upcomingStatsLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    // Calculate the longest player name to set appropriate minWidth
    const calculateMaxNameWidth = () => {
      const allNames: string[] = [];
      
      // Get names from upcomingPlayerStats
      if (upcomingPlayerStats && upcomingPlayerStats.length > 0) {
        upcomingPlayerStats.forEach((stat: any) => {
          if (stat.player_name) allNames.push(stat.player_name);
        });
      }
      
      // Get names from currentRoster if no stats available
      if (allNames.length === 0 && currentRoster) {
        currentRoster.forEach((player: any) => {
          if (player.player_name) allNames.push(player.player_name);
        });
      }
      
      if (allNames.length === 0) return 200; // Default fallback
      
      // Find longest name and calculate width (approximately 8px per character + padding)
      const longestName = allNames.reduce((a, b) => a.length > b.length ? a : b, '');
      // Add extra space for jersey number, avatar, and padding (about 80px)
      const nameWidth = Math.max(longestName.length * 8 + 80, 200);
      // On mobile, ensure minimum of 220px to prevent overlap
      return isMobile ? Math.max(nameWidth, 220) : nameWidth;
    };

    const nameColumnMinWidth = calculateMaxNameWidth();

    // Helper function to handle column header click for basic stats
    const handleBasicSort = (column: string) => {
      if (basicSortColumn === column) {
        // Toggle direction if same column
        setBasicSortDirection(basicSortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        // New column, default to desc
        setBasicSortColumn(column);
        setBasicSortDirection('desc');
      }
    };

    // Helper function to render sortable header for basic stats
    const renderBasicSortableHeader = (label: string, column: string, minWidth?: string) => {
      const isActive = basicSortColumn === column;
      const sortIndicator = isActive 
        ? (basicSortDirection === 'asc' ? ' ↑' : ' ↓')
        : '';
      
      // Calculate minWidth based on label length - very generous calculation
      // Use 16px per character (much wider for full readability) + padding + sort indicator space
      const labelWithIndicator = label + (isActive ? ' ↑' : '');
      const calculatedMinWidth = minWidth || `${Math.max(labelWithIndicator.length * 16 + 60, 120)}px`;
      
      return (
        <th 
          onClick={() => handleBasicSort(column)}
          style={{ 
            color: '#FFFFFF', 
            fontSize: '0.875rem', 
            textAlign: 'right',
            cursor: 'pointer',
            userSelect: 'none',
            backgroundColor: isActive ? 'rgba(255, 199, 44, 0.2)' : 'transparent',
            padding: '12px',
            transition: 'background-color 0.2s',
            minWidth: calculatedMinWidth,
            width: calculatedMinWidth,
            whiteSpace: 'nowrap',
            overflow: 'visible',
            textOverflow: 'clip',
          }}
          onMouseEnter={(e) => {
            if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {label}{sortIndicator}
        </th>
      );
    };

    return (
      <Box sx={{ 
        maxHeight: { xs: 'calc(100vh - 200px)', sm: '500px' }, 
        overflowY: 'auto',
        overflowX: 'auto',
        width: '100%',
        WebkitOverflowScrolling: 'touch',
        mx: { xs: -1, sm: 0 },
        px: { xs: 1, sm: 0 }
      }}>
        <Table sx={{ bgcolor: '#000000', width: 'auto', minWidth: '100%', tableLayout: 'auto' }}>
                <thead>
                  <tr>
              <th 
                onClick={() => handleBasicSort('player_name')}
                style={{ 
                  color: '#FFFFFF', 
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundColor: basicSortColumn === 'player_name' ? 'rgba(255, 199, 44, 0.2)' : 'transparent',
                  padding: '12px',
                  transition: 'background-color 0.2s',
                  minWidth: `${nameColumnMinWidth}px`,
                  width: `${nameColumnMinWidth}px`,
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                  textOverflow: 'clip',
                }}
                onMouseEnter={(e) => {
                  if (basicSortColumn !== 'player_name') e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  if (basicSortColumn !== 'player_name') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Player{basicSortColumn === 'player_name' ? (basicSortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
              {renderBasicSortableHeader('MPG', 'mpg')}
              {renderBasicSortableHeader('PPG', 'ppg')}
              {renderBasicSortableHeader('RPG', 'rpg')}
              {renderBasicSortableHeader('APG', 'apg')}
              {renderBasicSortableHeader('SPG', 'spg')}
              {renderBasicSortableHeader('BPG', 'bpg')}
              {renderBasicSortableHeader('FG%', 'fg_pct')}
              {renderBasicSortableHeader('3P%', 'fg3_pct')}
              {renderBasicSortableHeader('FT%', 'ft_pct')}
                  </tr>
                </thead>
                <tbody>
            {(() => {
              if (!upcomingPlayerStats || upcomingPlayerStats.length === 0) {
                const filteredRoster = (currentRoster || []).filter((player: any) => 
                  !currentTeamTricode || player.team_abbreviation === currentTeamTricode
                );
                return filteredRoster.map((player: any) => (
                  <GamePlayerRow
                      key={player.id}
                    player={player}
                    teamTricode={currentTeamTricode || ''}
                    gameState={gameState}
                    navigate={navigate}
                    playerProps={playerProps}
                    nameColumnMinWidth={nameColumnMinWidth}
                  />
                ));
              }
              
              const rosterMap = new Map();
              (currentRoster || []).forEach((p: any) => {
                const key = p.player_id || String(p.nba_player_id);
                rosterMap.set(key, p);
              });
              
              const filteredStats = upcomingPlayerStats.filter(stat => 
                !currentTeamTricode || stat.team_tricode === currentTeamTricode
              );
              
              // Sort the filtered stats
              const sortedStats = [...filteredStats].sort((a, b) => {
                if (!basicSortColumn) return 0;
                
                let aValue: any = a[basicSortColumn];
                let bValue: any = b[basicSortColumn];
                
                // Handle null/undefined values
                if (aValue === null || aValue === undefined) aValue = 0;
                if (bValue === null || bValue === undefined) bValue = 0;
                
                // Handle player_name (string comparison)
                if (basicSortColumn === 'player_name') {
                  const comparison = (a.player_name || '').localeCompare(b.player_name || '');
                  return basicSortDirection === 'asc' ? comparison : -comparison;
                }
                
                // For numeric values
                const diff = aValue - bValue;
                return basicSortDirection === 'asc' ? diff : -diff;
              });
              
              return sortedStats.map((stat) => {
                const rosterPlayer = rosterMap.get(stat.player_id || String(stat.nba_player_id));
                const playerKey = stat.player_id || String(stat.nba_player_id);
                const recentStats = recentPlayerStats?.get(playerKey);
                
                // Calculate trends: compare recent 15 days vs season average
                const trends: Record<string, 'up' | 'down' | null> = {};
                if (recentStats) {
                  const threshold = 0.15; // 15% change threshold
                  
                  // MPG
                  if (stat.mpg > 0 && recentStats.mpg > 0) {
                    const change = (recentStats.mpg - stat.mpg) / stat.mpg;
                    trends.mpg = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                  
                  // PPG
                  if (stat.ppg > 0 && recentStats.ppg > 0) {
                    const change = (recentStats.ppg - stat.ppg) / stat.ppg;
                    trends.ppg = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                  
                  // RPG
                  if (stat.rpg > 0 && recentStats.rpg > 0) {
                    const change = (recentStats.rpg - stat.rpg) / stat.rpg;
                    trends.rpg = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                  
                  // APG
                  if (stat.apg > 0 && recentStats.apg > 0) {
                    const change = (recentStats.apg - stat.apg) / stat.apg;
                    trends.apg = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                  
                  // SPG
                  if (stat.spg > 0 && recentStats.spg > 0) {
                    const change = (recentStats.spg - stat.spg) / stat.spg;
                    trends.spg = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                  
                  // BPG
                  if (stat.bpg > 0 && recentStats.bpg > 0) {
                    const change = (recentStats.bpg - stat.bpg) / stat.bpg;
                    trends.bpg = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                  
                  // FG%
                  if (stat.fg_pct > 0 && recentStats.fg_pct > 0) {
                    const change = (recentStats.fg_pct - stat.fg_pct) / stat.fg_pct;
                    trends.fg_pct = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                  
                  // 3P%
                  if (stat.fg3_pct > 0 && recentStats.fg3_pct > 0) {
                    const change = (recentStats.fg3_pct - stat.fg3_pct) / stat.fg3_pct;
                    trends.fg3_pct = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                  
                  // FT%
                  if (stat.ft_pct > 0 && recentStats.ft_pct > 0) {
                    const change = (recentStats.ft_pct - stat.ft_pct) / stat.ft_pct;
                    trends.ft_pct = change > threshold ? 'up' : change < -threshold ? 'down' : null;
                  }
                }
                
                return (
                  <GamePlayerRow
                    key={stat.player_id || stat.nba_player_id}
                    player={{
                      ...stat,
                      position: rosterPlayer?.position,
                      jersey_number: rosterPlayer?.jersey_number,
                      player_id: stat.player_id,
                      nba_player_id: stat.nba_player_id,
                      player_name: stat.player_name,
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
                    trends={trends}
                    nameColumnMinWidth={nameColumnMinWidth}
                  />
                );
              });
            })()}
                </tbody>
              </Table>
      </Box>
    );
  };

  // Render live/completed game view with BoxScore
  const renderLiveOrCompletedView = () => {
    if (liveStatsLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (!liveStats || liveStats.length === 0) {
      return (
        <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <Typography sx={{ color: '#FFFFFF' }}>
            No player statistics available for this game.
          </Typography>
        </Alert>
      );
    }

    const gameDate = gameData?.game_date ? new Date(gameData.game_date) : null;
    const isGameInPast = gameDate && gameDate < new Date();
    // Check if game is final - either by status, status text, or having final scores
    const isFinal = gameData?.game_status === 3 || 
                    gameData?.game_status_text?.toLowerCase().includes('final') ||
                    (gameData?.home_team_score !== null && 
                     gameData?.away_team_score !== null && 
                     gameData?.game_status !== 1 && 
                     gameData?.game_status !== 2);
    const isGameOver = isGameInPast || isFinal;

    const boxScorePlayers = (liveStats || []).map(player => {
      let stats = player.stats || {};
      if (typeof stats === 'string') {
        try {
          stats = JSON.parse(stats);
        } catch (e) {
          stats = {};
        }
      }
      // Keep current_team_tricode from stats (roster-only); do not fall back to game team_tricode.
      const currentTeam = (player as any).current_team_tricode ?? undefined;
      return {
        nba_player_id: player.nba_player_id,
        player_id: player.player_id,
        player_name: player.player_name,
        team_tricode: player.team_tricode || null,
        current_team_tricode: currentTeam,
        stats: stats,
        position: (player as any).position,
        fantasy_points: player.fantasy_points || 0,
      };
    });

    return (
      <Stack spacing={3}>
        <BoxScore
          gameId={gameId}
          homeTeamTricode={gameData.home_team_tricode}
          awayTeamTricode={gameData.away_team_tricode}
          homeTeamScore={gameData.home_team_score}
          awayTeamScore={gameData.away_team_score}
          players={boxScorePlayers}
          isGameOver={isGameOver}
          feedPosts={isGameOver ? (feedPosts || []) : []}
          selectedTeam={selectedTeam}
        />
      </Stack>
    );
  };

  return (
    <Box sx={{ bgcolor: '#000000', minHeight: '100vh', width: '100%' }}>
      {/* Beautiful Header with Team Matchup */}
      <Box sx={{ 
        bgcolor: '#0a0a0a',
        borderBottom: '2px solid #FFC72C',
        py: { xs: 2, sm: 3 },
        px: { xs: 1, sm: 2 },
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        {/* Top Navigation Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              size="sm"
              variant="plain"
              onClick={handleBackClick}
              sx={{ color: '#FFFFFF', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
            >
              <ArrowBack />
            </IconButton>
            <IconButton
              size="sm"
              variant="plain"
              onClick={() => {
                const newDate = gameDate.subtract(1, 'day');
                if (onDateChange) onDateChange(newDate);
              }}
              sx={{ color: '#FFFFFF', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
            >
              <NavigateBefore />
            </IconButton>
            <Chip
              variant="soft"
              startDecorator={<CalendarToday sx={{ fontSize: '0.875rem' }} />}
              sx={{ bgcolor: 'rgba(255, 199, 44, 0.1)', color: '#FFC72C', fontWeight: 600 }}
            >
              {gameDate.format('MMM D, YYYY')}
            </Chip>
            <IconButton
              size="sm"
              variant="plain"
              onClick={() => {
                const newDate = gameDate.add(1, 'day');
                if (onDateChange) onDateChange(newDate);
              }}
              sx={{ color: '#FFFFFF', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}
            >
              <NavigateNext />
            </IconButton>
          </Box>
        </Box>

        {/* Team Matchup Display */}
        {gameData && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: { xs: 1, sm: 3 },
            flexWrap: { xs: 'wrap', sm: 'nowrap' }
          }}>
            {/* Away Team */}
            <Card
              variant="outlined"
              onClick={() => setSelectedTeam('away')}
              sx={{
                flex: 1,
                minWidth: { xs: '100%', sm: 'auto' },
                bgcolor: selectedTeam === 'away' ? 'rgba(255, 199, 44, 0.15)' : '#1a1a1a',
                borderColor: selectedTeam === 'away' ? '#FFC72C' : '#333333',
                borderWidth: selectedTeam === 'away' ? 2 : 1,
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                  borderColor: '#FFC72C',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                <Avatar
                  src={getTeamLogoUrl(gameData.away_team_tricode)}
                  alt={gameData.away_team_tricode}
                  sx={{ 
                    width: { xs: 48, sm: 64 }, 
                    height: { xs: 48, sm: 64 },
                    mx: 'auto',
                    mb: 1,
                    border: `3px solid ${getTeamColors(gameData.away_team_tricode).primary}`,
                    boxShadow: `0 0 20px ${getTeamColors(gameData.away_team_tricode).primary}40`,
                  }}
                />
                <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 0.5 }}>
                  {gameData.away_team_tricode}
                </Typography>
                {gameState === 'live' || gameState === 'completed' ? (
                  <Typography level="h2" sx={{ color: '#FFC72C', fontWeight: 800, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                    {(() => {
                      if (gameState === 'live' && liveStats) {
                        let points = 0;
                        (liveStats || []).forEach((p: any) => {
                          if (p.team_tricode === gameData.away_team_tricode) {
                            points += (p.stats?.pts || 0);
                          }
                        });
                        return points;
                      }
                      return gameData.away_team_score || 0;
                    })()}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>

            {/* VS Divider */}
            <Box sx={{ 
              display: { xs: 'none', sm: 'flex' },
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              px: 2,
            }}>
              <Chip
                size="lg"
                color={gameState === 'live' ? 'danger' : gameState === 'completed' ? 'success' : 'neutral'}
                variant="solid"
                sx={{ 
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                {gameState === 'live' ? 'LIVE' : gameState === 'completed' ? 'FINAL' : gameData.game_status_text || 'UPCOMING'}
              </Chip>
              <Typography level="body-sm" sx={{ color: '#666666', fontWeight: 600 }}>
                VS
              </Typography>
              {gameData.arena_name && (
                <Typography level="body-xs" sx={{ color: '#999999', textAlign: 'center', maxWidth: '120px' }}>
                  {gameData.arena_name}
                </Typography>
              )}
            </Box>

            {/* Home Team */}
            <Card
              variant="outlined"
              onClick={() => setSelectedTeam('home')}
              sx={{
                flex: 1,
                minWidth: { xs: '100%', sm: 'auto' },
                bgcolor: selectedTeam === 'home' ? 'rgba(255, 199, 44, 0.15)' : '#1a1a1a',
                borderColor: selectedTeam === 'home' ? '#FFC72C' : '#333333',
                borderWidth: selectedTeam === 'home' ? 2 : 1,
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  bgcolor: 'rgba(255, 199, 44, 0.1)',
                  borderColor: '#FFC72C',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
                <Avatar
                  src={getTeamLogoUrl(gameData.home_team_tricode)}
                  alt={gameData.home_team_tricode}
                  sx={{ 
                    width: { xs: 48, sm: 64 }, 
                    height: { xs: 48, sm: 64 },
                    mx: 'auto',
                    mb: 1,
                    border: `3px solid ${getTeamColors(gameData.home_team_tricode).primary}`,
                    boxShadow: `0 0 20px ${getTeamColors(gameData.home_team_tricode).primary}40`,
                  }}
                />
                <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 0.5 }}>
                  {gameData.home_team_tricode}
                </Typography>
                {gameState === 'live' || gameState === 'completed' ? (
                  <Typography level="h2" sx={{ color: '#FFC72C', fontWeight: 800, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                    {(() => {
                      if (gameState === 'live' && liveStats) {
                        let points = 0;
                        (liveStats || []).forEach((p: any) => {
                          if (p.team_tricode === gameData.home_team_tricode) {
                            points += (p.stats?.pts || 0);
                          }
                        });
                        return points;
                      }
                      return gameData.home_team_score || 0;
                    })()}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          </Box>
        )}
      </Box>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: '1px solid #333333', bgcolor: '#0a0a0a' }}>
        <Tabs
          value={activeView}
          onChange={(_, value) => setActiveView(value as 'stats' | 'props' | 'advanced')}
          sx={{
            '& .MuiTabs-indicator': {
              bgcolor: '#FFC72C',
              height: 3,
            },
          }}
        >
          <TabList sx={{ width: '100%', justifyContent: 'center' }}>
            <Tab value="stats" sx={{ color: '#FFFFFF', '&.Mui-selected': { color: '#FFC72C' } }}>
              <BarChart sx={{ mr: 1, fontSize: '1rem' }} />
              Stats
            </Tab>
            <Tab value="props" sx={{ color: '#FFFFFF', '&.Mui-selected': { color: '#FFC72C' } }}>
              <EmojiEvents sx={{ mr: 1, fontSize: '1rem' }} />
              Props
            </Tab>
            <Tab value="advanced" sx={{ color: '#FFFFFF', '&.Mui-selected': { color: '#FFC72C' } }}>
              <Analytics sx={{ mr: 1, fontSize: '1rem' }} />
              Advanced
            </Tab>
          </TabList>
        </Tabs>
      </Box>

      {/* Content Area */}
      <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, maxWidth: '1400px', mx: 'auto' }}>
        {activeView === 'props' ? (
          // Player Props View - different format for upcoming vs live/completed
          gameState === 'upcoming' ? (
            // Upcoming games: Table format - one row per player, one column per prop type
            (() => {
              if (!playerProps || playerProps.length === 0) {
                return (
                  <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                    <Typography sx={{ color: '#FFFFFF' }}>
                      No player props available for this game.
                    </Typography>
                  </Alert>
                );
              }

              // Helper function to round to nearest 0.5 or whole number
              const roundToHalfOrWhole = (num: number): number => {
                const rounded = Math.round(num * 2) / 2;
                // If it's very close to a whole number, return whole number
                if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
                  return Math.round(rounded);
                }
                return rounded;
              };

              // Helper to normalize names for matching
              const normalizeName = (name: string): string => {
                return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              };

              // Debug: Log props data
              console.log('🔍 Props Debug - Total props:', playerProps?.length || 0);
              console.log('🔍 Props Debug - Sample props:', playerProps?.slice(0, 5));
              console.log('🔍 Roster Debug - Home roster size:', homeRoster?.length || 0);
              console.log('🔍 Roster Debug - Away roster size:', awayRoster?.length || 0);
              console.log('🔍 Roster Debug - Selected team:', selectedTeam);

              // Get all unique players from props - use nba_player_id as primary key for better matching
              const playersMap = new Map<number, {
                player_name: string;
                nba_player_id: number;
                player_id?: string;
                propsByType: Map<string, number[]>; // Map of bet_type to array of line values
              }>();

              let underPropsSkipped = 0;
              let missingNbaIdSkipped = 0;
              
              (playerProps || []).forEach(prop => {
                // Include both 'over' and 'under' props - we'll pick the highest line value for each bet_type
                
                // Use nba_player_id as the key since it's more reliable
                const key = prop.nba_player_id;
                if (!key) {
                  missingNbaIdSkipped++;
                  console.warn('⚠️ Prop missing nba_player_id:', prop.player_name, prop.bet_type);
                  return; // Skip props without nba_player_id
                }
                
                if (!playersMap.has(key)) {
                  playersMap.set(key, {
                    player_name: prop.player_name,
                    nba_player_id: prop.nba_player_id,
                    player_id: prop.player_id,
                    propsByType: new Map(), // Map of bet_type -> array of line values
                  });
                }
                const player = playersMap.get(key)!;
                const betType = prop.bet_type;
                if (!player.propsByType.has(betType)) {
                  player.propsByType.set(betType, []);
                }
                // Add line value to array (parse as number)
                // Include both over and under props - we'll find the max later
                const lineValue = typeof prop.line === 'number' ? prop.line : parseFloat(prop.line || '0');
                if (!isNaN(lineValue)) {
                  player.propsByType.get(betType)!.push(lineValue);
                }
              });
              
              console.log('📊 Props processing stats:', {
                total: playerProps?.length || 0,
                underSkipped: underPropsSkipped,
                missingNbaIdSkipped: missingNbaIdSkipped,
                playersInMap: playersMap.size
              });

              console.log('🔍 Players Map size:', playersMap.size);
              console.log('🔍 Players in map:', Array.from(playersMap.values()).map(p => p.player_name));

              // Build maps for BOTH rosters to determine team membership
              const homeRosterMap = new Map<number | string, any>();
              const awayRosterMap = new Map<number | string, any>();
              
              (homeRoster || []).forEach((p: any) => {
                if (p.nba_player_id) {
                  homeRosterMap.set(p.nba_player_id, p);
                }
                if (p.player_name) {
                  const normalized = normalizeName(p.player_name);
                  homeRosterMap.set(normalized, p);
                  // Also store with original case for exact match
                  homeRosterMap.set(p.player_name.toLowerCase(), p);
                }
              });

              (awayRoster || []).forEach((p: any) => {
                if (p.nba_player_id) {
                  awayRosterMap.set(p.nba_player_id, p);
                }
                if (p.player_name) {
                  const normalized = normalizeName(p.player_name);
                  awayRosterMap.set(normalized, p);
                  // Also store with original case for exact match
                  awayRosterMap.set(p.player_name.toLowerCase(), p);
                }
              });

              // Determine which roster to use based on selected team
              const selectedRosterMap = selectedTeam === 'home' ? homeRosterMap : awayRosterMap;
              const otherRosterMap = selectedTeam === 'home' ? awayRosterMap : homeRosterMap;

              console.log('🔍 Home roster players:', (homeRoster || []).map((p: any) => p.player_name));
              console.log('🔍 Away roster players:', (awayRoster || []).map((p: any) => p.player_name));

              // Get all players with props - match to rosters to filter by team
              const teamPlayersWithProps: Array<{
                player_name: string;
                nba_player_id: number;
                player_id?: string;
                rosterPlayer?: any;
                averagedProps: Map<string, number>; // Map of bet_type to averaged line
              }> = [];

              playersMap.forEach((playerData) => {
                // Since props are already filtered by team using player_id -> nba_players.team_abbreviation,
                // ALL players in playersMap should be for the selected team.
                // We just need to match to roster for jersey/position info (optional).
                
                // Try to match to selected team's roster for jersey/position info (not required)
                let rosterPlayer = selectedRosterMap.get(playerData.nba_player_id);
                
                // If no match by nba_player_id, try name matching (case-insensitive and normalized)
                if (!rosterPlayer && playerData.player_name) {
                  rosterPlayer = selectedRosterMap.get(playerData.player_name.toLowerCase()) ||
                                selectedRosterMap.get(normalizeName(playerData.player_name));
                }

                // Calculate props for this player - use the HIGHEST line value for each bet_type
                // This includes both 'over' and 'under' props, and we pick the highest
                const averagedProps = new Map<string, number>();
                playerData.propsByType.forEach((lines, betType) => {
                  if (lines.length > 0) {
                    // Find the maximum line value (highest of all props for this bet_type)
                    const maxLine = Math.max(...lines);
                    // Round to nearest 0.5 or whole number
                    averagedProps.set(betType, roundToHalfOrWhole(maxLine));
                  }
                });

                // Include ALL players with props (they're already filtered by team)
                if (averagedProps.size > 0) {
                  teamPlayersWithProps.push({
                    player_name: playerData.player_name,
                    nba_player_id: playerData.nba_player_id,
                    player_id: playerData.player_id,
                    rosterPlayer, // May be undefined - that's okay, we'll just show name
                    averagedProps,
                  });
                }
              });

              console.log('🔍 Team players with props:', teamPlayersWithProps.length);
              console.log('🔍 Team players:', teamPlayersWithProps.map(p => p.player_name));

              if (teamPlayersWithProps.length === 0) {
                return (
                  <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                    <Typography sx={{ color: '#FFFFFF' }}>
                      No player props found for {selectedTeam === 'away' ? gameData?.away_team_tricode : gameData?.home_team_tricode} players.
                    </Typography>
                  </Alert>
                );
              }

              // Get all unique prop types across all players
              const allPropTypes = new Set<string>();
              teamPlayersWithProps.forEach(player => {
                player.averagedProps.forEach((_, betType) => {
                  allPropTypes.add(betType);
                });
              });

              // Sort prop types in a logical order
              const propTypeOrder = ['points', 'pts', 'rebounds', 'reb', 'assists', 'ast', 'steals', 'stl', 'blocks', 'blk', 'threePointersMade', 'fg3m', 'freeThrowsMade', 'ftm'];
              const sortedPropTypes = Array.from(allPropTypes).sort((a, b) => {
                const aIndex = propTypeOrder.findIndex(p => p === a.toLowerCase());
                const bIndex = propTypeOrder.findIndex(p => p === b.toLowerCase());
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
              });

              // Format prop type for display
              const formatPropType = (betType: string): string => {
                const formatted = betType.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                return formatted.split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
              };

              return (
          <Box sx={{ 
            maxHeight: { xs: 'calc(100vh - 200px)', sm: '500px' }, 
            overflowY: 'auto',
            overflowX: 'auto',
            width: '100%',
            WebkitOverflowScrolling: 'touch',
            mx: { xs: -1, sm: 0 },
            px: { xs: 1, sm: 0 }
          }}>
                  <Table sx={{ bgcolor: '#000000', width: 'auto', minWidth: '100%', tableLayout: 'auto' }}>
              <thead>
                <tr>
                        <th style={{ color: '#FFFFFF', fontSize: '0.875rem', minWidth: '180px', width: '180px', padding: '12px' }}>Player</th>
                        {sortedPropTypes.map(betType => {
                          const formattedLabel = formatPropType(betType);
                          // Calculate minWidth based on label length - very generous calculation
                          // Use 16px per character (much wider for full readability) + padding
                          const minWidth = `${Math.max(formattedLabel.length * 16 + 60, 130)}px`;
                          return (
                            <th key={betType} style={{ 
                              color: '#FFFFFF', 
                              fontSize: '0.875rem', 
                              textAlign: 'right', 
                              padding: '12px',
                              minWidth: minWidth,
                              width: minWidth,
                              whiteSpace: 'nowrap',
                              overflow: 'visible',
                              textOverflow: 'clip',
                            }}>
                              {formattedLabel}
                            </th>
                          );
                        })}
                </tr>
              </thead>
              <tbody>
                      {teamPlayersWithProps.map((playerData) => (
                        <tr
                          key={playerData.nba_player_id}
                          onClick={() => playerData.player_id && navigate(`/player/${playerData.player_id}`)}
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
                          <td style={{ minWidth: '180px', width: '180px', maxWidth: '180px', padding: '12px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 1 }}>
                              <Avatar
                                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerData.nba_player_id}.png`}
                                alt={playerData.player_name}
                                sx={{ width: 32, height: 32, flexShrink: 0 }}
                              />
                              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, alignItems: 'center' }}>
                                {playerData.rosterPlayer?.jersey_number && (
                                  <Typography sx={{ color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 'bold', lineHeight: 1.2, textAlign: 'center' }}>
                                    #{playerData.rosterPlayer.jersey_number}
                                  </Typography>
                                )}
                                {playerData.rosterPlayer?.position && (
                                  <Typography sx={{ color: '#CCCCCC', fontSize: '0.75rem', lineHeight: 1.2, textAlign: 'center' }}>
                                    {playerData.rosterPlayer.position}
                                  </Typography>
                                )}
                                <Typography sx={{ 
                                  color: '#FFFFFF', 
                                  fontSize: '0.875rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'visible',
                                  textOverflow: 'clip',
                                  lineHeight: 1.2,
                                  mt: playerData.rosterPlayer?.jersey_number || playerData.rosterPlayer?.position ? 0.25 : 0,
                                  textAlign: 'center',
                                }}>
                                  {playerData.player_name}
                                </Typography>
                              </Box>
                            </Box>
                          </td>
                          {sortedPropTypes.map(betType => {
                            const avgLine = playerData.averagedProps.get(betType);
                            const formattedLabel = formatPropType(betType);
                            // Match header width calculation
                            const minWidth = `${Math.max(formattedLabel.length * 16 + 60, 130)}px`;
                            return (
                              <td 
                                key={betType}
                                style={{ 
                                  color: avgLine !== undefined ? '#FFC72C' : '#666666', 
                                  fontSize: '0.875rem', 
                                  textAlign: 'right',
                                  fontWeight: avgLine !== undefined ? 600 : 400,
                                  padding: '12px',
                                  minWidth: minWidth,
                                  width: minWidth,
                                  overflow: 'visible',
                                  textOverflow: 'clip',
                                }}
                              >
                                {avgLine !== undefined ? avgLine.toFixed(avgLine % 1 === 0 ? 0 : 1) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Box>
              );
            })()
          ) : (
            // Live/Completed games: Same table format as upcoming, but with color coding (green for over, red for under)
            (() => {
              if (!playerProps || playerProps.length === 0) {
                return (
                  <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                    <Typography sx={{ color: '#FFFFFF' }}>
                      No player props available for this game.
                    </Typography>
                  </Alert>
                );
              }

              // Helper function to round to nearest 0.5 or whole number
              const roundToHalfOrWhole = (num: number): number => {
                const rounded = Math.round(num * 2) / 2;
                // If it's very close to a whole number, return whole number
                if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
                  return Math.round(rounded);
                }
                return rounded;
              };

              // Helper to normalize names for matching
              const normalizeName = (name: string): string => {
                return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
              };

              // Get players with stats for the current team
              const playersWithStats = currentTeamStats || [];

              // Get all unique players from props - use nba_player_id as primary key
              const playersMap = new Map<number, {
                player_name: string;
                nba_player_id: number;
                player_id?: string;
                propsByType: Map<string, { line: number; result: any }>; // Map of bet_type to { line, result }
              }>();

              (playerProps || []).forEach(prop => {
                // Include both 'over' and 'under' props - we'll pick the highest line value for each bet_type
                const key = prop.nba_player_id;
                if (!key) return;
                
                if (!playersMap.has(key)) {
                  playersMap.set(key, {
                    player_name: prop.player_name,
                    nba_player_id: prop.nba_player_id,
                    player_id: prop.player_id,
                    propsByType: new Map(),
                  });
                }
                const player = playersMap.get(key)!;
                const betType = prop.bet_type;
                
                // Get the highest line value for this bet_type (from all props)
                const existing = player.propsByType.get(betType);
                const lineValue = typeof prop.line === 'number' ? prop.line : parseFloat(prop.line || '0');
                
                if (!existing || lineValue > existing.line) {
                  // Calculate result for this prop if we have stats
                  let result = null;
                  const playerStats = playersWithStats.find((p: any) => 
                    (p.player_id && p.player_id === prop.player_id) ||
                    (p.nba_player_id === prop.nba_player_id) ||
                    (p.player_name === prop.player_name)
                  );
                  
                  if (playerStats) {
                    let parsedStats = playerStats.stats || {};
                    if (typeof parsedStats === 'string') {
                      try {
                        parsedStats = JSON.parse(parsedStats);
                      } catch (e) {
                        parsedStats = {};
                      }
                    }
                    
                    result = calculatePropResult(prop.bet_type, lineValue, {
                      pts: parsedStats.pts || 0,
                      reb: parsedStats.reb || 0,
                      ast: parsedStats.ast || 0,
                      stl: parsedStats.stl || 0,
                      blk: parsedStats.blk || 0,
                      tov: parsedStats.tov || 0,
                      fg3m: parsedStats.fg3m || 0,
                      fg3a: parsedStats.fg3a || 0,
                      ftm: parsedStats.ftm || 0,
                      fta: parsedStats.fta || 0,
                      fgm: parsedStats.fgm || 0,
                      fga: parsedStats.fga || 0,
                    });
                  }
                  
                  player.propsByType.set(betType, { line: lineValue, result });
                }
              });

              // Build maps for rosters to get jersey/position info
              const homeRosterMap = new Map<number | string, any>();
              const awayRosterMap = new Map<number | string, any>();
              
              (homeRoster || []).forEach((p: any) => {
                if (p.nba_player_id) {
                  homeRosterMap.set(p.nba_player_id, p);
                }
                if (p.player_name) {
                  const normalized = normalizeName(p.player_name);
                  homeRosterMap.set(normalized, p);
                  homeRosterMap.set(p.player_name.toLowerCase(), p);
                }
              });

              (awayRoster || []).forEach((p: any) => {
                if (p.nba_player_id) {
                  awayRosterMap.set(p.nba_player_id, p);
                }
                if (p.player_name) {
                  const normalized = normalizeName(p.player_name);
                  awayRosterMap.set(normalized, p);
                  awayRosterMap.set(p.player_name.toLowerCase(), p);
                }
              });

              const selectedRosterMap = selectedTeam === 'home' ? homeRosterMap : awayRosterMap;

              // Get all players with props - match to rosters for jersey/position info
              const teamPlayersWithProps: Array<{
                player_name: string;
                nba_player_id: number;
                player_id?: string;
                rosterPlayer?: any;
                propsByType: Map<string, { line: number; result: any }>;
              }> = [];

              playersMap.forEach((playerData) => {
                // Try to match to selected team's roster for jersey/position info
                let rosterPlayer = selectedRosterMap.get(playerData.nba_player_id);
                
                if (!rosterPlayer && playerData.player_name) {
                  rosterPlayer = selectedRosterMap.get(playerData.player_name.toLowerCase()) ||
                                selectedRosterMap.get(normalizeName(playerData.player_name));
                }

                // Only include players that have props
                if (playerData.propsByType.size > 0) {
                  teamPlayersWithProps.push({
                    player_name: playerData.player_name,
                    nba_player_id: playerData.nba_player_id,
                    player_id: playerData.player_id,
                    rosterPlayer,
                    propsByType: playerData.propsByType,
                  });
                }
              });

              if (teamPlayersWithProps.length === 0) {
                return (
                  <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                    <Typography sx={{ color: '#FFFFFF' }}>
                      No player props found for {selectedTeam === 'away' ? gameData?.away_team_tricode : gameData?.home_team_tricode} players.
                    </Typography>
                  </Alert>
                );
              }

              // Get all unique prop types across all players
              const allPropTypes = new Set<string>();
              teamPlayersWithProps.forEach(player => {
                player.propsByType.forEach((_, betType) => {
                  allPropTypes.add(betType);
                });
              });

              // Sort prop types in a logical order
              const propTypeOrder = ['points', 'pts', 'rebounds', 'reb', 'assists', 'ast', 'steals', 'stl', 'blocks', 'blk', 'threePointersMade', 'fg3m', 'freeThrowsMade', 'ftm'];
              const sortedPropTypes = Array.from(allPropTypes).sort((a, b) => {
                const aIndex = propTypeOrder.findIndex(p => p === a.toLowerCase());
                const bIndex = propTypeOrder.findIndex(p => p === b.toLowerCase());
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
              });

              // Format prop type for display
              const formatPropType = (betType: string): string => {
                const formatted = betType.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
                return formatted.split(' ').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
              };

              return (
                <Box sx={{ 
                  maxHeight: '500px', 
                  overflowY: 'auto',
                  overflowX: 'auto',
                  width: '100%',
                  WebkitOverflowScrolling: 'touch',
                }}>
                  <Table sx={{ bgcolor: '#000000', width: 'auto', minWidth: '100%', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        <th style={{ color: '#FFFFFF', fontSize: '0.875rem', minWidth: '180px', width: '180px', padding: '12px' }}>Player</th>
                        {sortedPropTypes.map(betType => {
                          const formattedLabel = formatPropType(betType);
                          // Calculate minWidth based on label length - very generous calculation
                          // Use 16px per character (much wider for full readability) + padding
                          const minWidth = `${Math.max(formattedLabel.length * 16 + 60, 130)}px`;
                          return (
                            <th key={betType} style={{ 
                              color: '#FFFFFF', 
                              fontSize: '0.875rem', 
                              textAlign: 'right', 
                              padding: '12px',
                              minWidth: minWidth,
                              width: minWidth,
                              whiteSpace: 'nowrap',
                              overflow: 'visible',
                              textOverflow: 'clip',
                            }}>
                              {formattedLabel}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {teamPlayersWithProps.map((playerData) => (
                        <tr
                          key={playerData.nba_player_id}
                          onClick={() => playerData.player_id && navigate(`/player/${playerData.player_id}`)}
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
                          <td style={{ minWidth: '180px', width: '180px', maxWidth: '180px', padding: '12px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 1 }}>
                              <Avatar
                                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerData.nba_player_id}.png`}
                                alt={playerData.player_name}
                                sx={{ width: 32, height: 32, flexShrink: 0 }}
                              />
                              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, alignItems: 'center' }}>
                                {playerData.rosterPlayer?.jersey_number && (
                                  <Typography sx={{ color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 'bold', lineHeight: 1.2, textAlign: 'center' }}>
                                    #{playerData.rosterPlayer.jersey_number}
                                  </Typography>
                                )}
                                {playerData.rosterPlayer?.position && (
                                  <Typography sx={{ color: '#CCCCCC', fontSize: '0.75rem', lineHeight: 1.2, textAlign: 'center' }}>
                                    {playerData.rosterPlayer.position}
                                  </Typography>
                                )}
                                <Typography sx={{ 
                                  color: '#FFFFFF', 
                                  fontSize: '0.875rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'visible',
                                  textOverflow: 'clip',
                                  lineHeight: 1.2,
                                  mt: playerData.rosterPlayer?.jersey_number || playerData.rosterPlayer?.position ? 0.25 : 0,
                                  textAlign: 'center',
                                }}>
                                  {playerData.player_name}
                                </Typography>
                              </Box>
                            </Box>
                          </td>
                          {sortedPropTypes.map(betType => {
                            const propData = playerData.propsByType.get(betType);
                            const line = propData ? roundToHalfOrWhole(propData.line) : undefined;
                            const result = propData?.result;
                            const formattedLabel = formatPropType(betType);
                            // Match header width calculation
                            const minWidth = `${Math.max(formattedLabel.length * 16 + 60, 130)}px`;
                            
                            // Determine color: green if over (hit), red if under (miss), default if no result
                            let cellColor = '#FFC72C'; // Default yellow
                            if (result) {
                              if (result.hit) {
                                cellColor = '#4CAF50'; // Green for over/hit
                              } else {
                                cellColor = '#F44336'; // Red for under/miss
                              }
                            } else if (line === undefined) {
                              cellColor = '#666666'; // Gray if no prop
                            }
                            
                            return (
                              <td 
                                key={betType}
                                style={{ 
                                  color: cellColor, 
                                  fontSize: '0.875rem', 
                                  textAlign: 'right',
                                  fontWeight: line !== undefined ? 600 : 400,
                                  padding: '12px',
                                  minWidth: minWidth,
                                }}
                              >
                                {line !== undefined ? line.toFixed(line % 1 === 0 ? 0 : 1) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Box>
              );
            })()
          )
        ) : activeView === 'advanced' ? (
          // Advanced Stats View - show advanced stats heat map table
          (() => {
            if (advancedStatsLoading || homeRosterLoading || awayRosterLoading) {
              return (
                <Box sx={{ p: 3 }}>
                  <Typography sx={{ color: '#FFFFFF', mb: 2, fontSize: '0.875rem' }}>
                    Loading advanced statistics...
                  </Typography>
                  <LinearProgress 
                    sx={{ 
                      bgcolor: '#1a1a1a',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: '#FFC72C',
                      }
                    }} 
                  />
                </Box>
              );
            }

            if (!advancedStats || advancedStats.length === 0) {
              return (
                <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                  <Typography sx={{ color: '#FFFFFF' }}>
                    No advanced statistics available for this game.
                  </Typography>
                </Alert>
              );
            }

            const rosterMap = new Map();
            (currentRoster || []).forEach((p: any) => {
              const key = p.player_id || String(p.nba_player_id);
              rosterMap.set(key, p);
            });

            // Calculate percentiles for each stat
            // Helper function to calculate percentile (0-100) based on rank
            // Percentile means: X% of players have values that make this player look good
            const calculatePercentile = (value: number, allValues: number[], invert: boolean = false): number => {
              if (allValues.length === 0 || isNaN(value)) return 50; // Average if no data
              
              // Sort values
              const sorted = [...allValues].sort((a, b) => a - b);
              
              let percentile = 0;
              if (invert) {
                // For inverted stats (def_rtg, tov_pct), lower is better
                // Count how many players have HIGHER values (worse) - these make our player look good
                const worseCount = sorted.filter(v => v > value).length;
                percentile = (worseCount / sorted.length) * 100;
              } else {
                // For normal stats, higher is better
                // Count how many players have LOWER values (worse) - these make our player look good
                const worseCount = sorted.filter(v => v < value).length;
                percentile = (worseCount / sorted.length) * 100;
              }
              
              return percentile;
            };

            // Helper function to get background color based on percentile
            const getBackgroundColor = (percentile: number): string => {
              // Average is around 50th percentile - no background for values close to average
              if (Math.abs(percentile - 50) < 5) return 'transparent';
              
              if (percentile > 50) {
                // Green (good) - higher percentile = more opacity
                // Scale from 50-100 percentile to 0-0.4 opacity
                const opacity = Math.min(0.4, ((percentile - 50) / 50) * 0.4);
                return `rgba(76, 175, 80, ${opacity})`; // Green
              } else {
                // Red (bad) - lower percentile = more opacity
                // Scale from 0-50 percentile to 0.4-0 opacity (inverted)
                const opacity = Math.min(0.4, ((50 - percentile) / 50) * 0.4);
                return `rgba(244, 67, 54, ${opacity})`; // Red
              }
            };

            // Extract all values for each stat to calculate percentiles
            const statKeys = ['off_rtg', 'def_rtg', 'net_rtg', 'ts_pct', 'usg_pct', 'ast_ratio', 'reb_pct', 'efg_pct', 'tov_pct', 'touches', 'passes', 'deflections', 'paint_pts'];
            const statValues: Record<string, number[]> = {};
            
            statKeys.forEach(key => {
              statValues[key] = advancedStats
                .map((s: any) => s[key])
                .filter((v: any) => v !== null && v !== undefined && !isNaN(v))
                .map((v: any) => typeof v === 'number' ? v : parseFloat(v));
            });

            // Sort advanced stats based on selected column
            const sortedAdvancedStats = [...advancedStats].sort((a: any, b: any) => {
              if (!advancedSortColumn) return 0;
              
              let aValue: any = a[advancedSortColumn];
              let bValue: any = b[advancedSortColumn];
              
              // Handle null/undefined values
              if (aValue === null || aValue === undefined) aValue = 0;
              if (bValue === null || bValue === undefined) bValue = 0;
              
              // Convert to numbers if needed
              if (typeof aValue !== 'number') aValue = parseFloat(aValue) || 0;
              if (typeof bValue !== 'number') bValue = parseFloat(bValue) || 0;
              
              // For player name, sort alphabetically
              if (advancedSortColumn === 'player_name') {
                const comparison = (a.player_name || '').localeCompare(b.player_name || '');
                return advancedSortDirection === 'asc' ? comparison : -comparison;
              }
              
              // For numeric values
              const diff = aValue - bValue;
              return advancedSortDirection === 'asc' ? diff : -diff;
            });

            // Helper function to handle column header click
            const handleSort = (column: string) => {
              if (advancedSortColumn === column) {
                // Toggle direction if same column
                setAdvancedSortDirection(advancedSortDirection === 'asc' ? 'desc' : 'asc');
              } else {
                // New column, default to desc
                setAdvancedSortColumn(column);
                setAdvancedSortDirection('desc');
              }
            };

            // Helper function to render sortable header
            const renderSortableHeader = (label: string, column: string, minWidth?: string) => {
              const isActive = advancedSortColumn === column;
              const sortIndicator = isActive 
                ? (advancedSortDirection === 'asc' ? ' ↑' : ' ↓')
                : '';
              
              // Calculate minWidth based on label length - very generous calculation
              // Use 16px per character (much wider for full readability) + padding + sort indicator space
              const labelWithIndicator = label + (isActive ? ' ↑' : '');
              const calculatedMinWidth = minWidth || `${Math.max(labelWithIndicator.length * 16 + 60, 130)}px`;
              
              return (
                <th 
                  onClick={() => handleSort(column)}
                  style={{ 
                    color: '#FFFFFF', 
                    fontSize: '0.875rem', 
                    textAlign: 'right',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: isActive ? 'rgba(255, 199, 44, 0.2)' : 'transparent',
                    padding: '12px',
                    minWidth: calculatedMinWidth,
                    width: calculatedMinWidth,
                    whiteSpace: 'nowrap',
                    overflow: 'visible',
                    textOverflow: 'clip',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {label}{sortIndicator}
                </th>
              );
            };

            return (
              <Box sx={{ 
                maxHeight: { xs: 'calc(100vh - 200px)', sm: '500px' }, 
                overflowY: 'auto',
                overflowX: 'auto',
                width: '100%',
                WebkitOverflowScrolling: 'touch',
                mx: { xs: -1, sm: 0 },
                px: { xs: 1, sm: 0 }
              }}>
                  <Table sx={{ bgcolor: '#000000', width: 'auto', minWidth: '100%', tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th 
                        onClick={() => handleSort('player_name')}
                        style={{ 
                          color: '#FFFFFF', 
                          fontSize: '0.875rem', 
                          minWidth: '180px', 
                          width: '180px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          backgroundColor: advancedSortColumn === 'player_name' ? 'rgba(255, 199, 44, 0.2)' : 'transparent',
                          padding: '12px',
                          whiteSpace: 'nowrap',
                          overflow: 'visible',
                          textOverflow: 'clip',
                        }}
                        onMouseEnter={(e) => {
                          if (advancedSortColumn !== 'player_name') e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          if (advancedSortColumn !== 'player_name') e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        Player{advancedSortColumn === 'player_name' ? (advancedSortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                      {renderSortableHeader('OFF RTG', 'off_rtg')}
                      {renderSortableHeader('DEF RTG', 'def_rtg')}
                      {renderSortableHeader('NET RTG', 'net_rtg')}
                      {renderSortableHeader('TS%', 'ts_pct')}
                      {renderSortableHeader('USG%', 'usg_pct')}
                      {renderSortableHeader('AST RATIO', 'ast_ratio')}
                      {renderSortableHeader('REB%', 'reb_pct')}
                      {renderSortableHeader('EFG%', 'efg_pct')}
                      {renderSortableHeader('TOV%', 'tov_pct')}
                      {renderSortableHeader('TOUCHES', 'touches')}
                      {renderSortableHeader('PASSES', 'passes')}
                      {renderSortableHeader('DEFL', 'deflections')}
                      {renderSortableHeader('PAINT PTS', 'paint_pts')}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAdvancedStats.map((stat: any) => {
                      const rosterPlayer = rosterMap.get(stat.player_id || String(stat.nba_player_id));
                      
                      // Calculate percentiles for each stat
                      const getPercentile = (key: string, value: number, invert: boolean = false) => {
                        return calculatePercentile(value, statValues[key] || [], invert);
                      };
                      
                      const getCellStyle = (key: string, value: number, invert: boolean = false) => {
                        const percentile = getPercentile(key, value, invert);
                        return {
                          color: '#FFFFFF',
                          fontSize: '0.875rem',
                          textAlign: 'right' as const,
                          backgroundColor: getBackgroundColor(percentile),
                        };
                      };

                      return (
                        <tr
                          key={stat.player_id || stat.nba_player_id}
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
                          <td style={{ minWidth: '180px', width: '180px', maxWidth: '180px', padding: '12px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 1 }}>
                              <Avatar
                                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${stat.nba_player_id}.png`}
                                alt={stat.player_name}
                                sx={{ width: 32, height: 32, flexShrink: 0 }}
                              />
                              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, alignItems: 'center' }}>
                                {rosterPlayer?.jersey_number && (
                                  <Typography sx={{ color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 'bold', lineHeight: 1.2, textAlign: 'center' }}>
                                    #{rosterPlayer.jersey_number}
                                  </Typography>
                                )}
                                {rosterPlayer?.position && (
                                  <Typography sx={{ color: '#CCCCCC', fontSize: '0.75rem', lineHeight: 1.2, textAlign: 'center' }}>
                                    {rosterPlayer.position}
                                  </Typography>
                                )}
                                <Typography sx={{ 
                                  color: '#FFFFFF', 
                                  fontSize: '0.875rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  lineHeight: 1.2,
                                  mt: rosterPlayer?.jersey_number || rosterPlayer?.position ? 0.25 : 0,
                                  textAlign: 'center',
                                }}>
                                  {stat.player_name}
                                </Typography>
                              </Box>
                            </Box>
                          </td>
                          {(() => {
                            const width = `${Math.max('OFF RTG'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('off_rtg', stat.off_rtg || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.off_rtg ? stat.off_rtg.toFixed(1) : '0.0'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('DEF RTG'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('def_rtg', stat.def_rtg || 0, true), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.def_rtg ? stat.def_rtg.toFixed(1) : '0.0'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('NET RTG'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('net_rtg', stat.net_rtg || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.net_rtg ? stat.net_rtg.toFixed(1) : '0.0'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('TS%'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('ts_pct', stat.ts_pct || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.ts_pct ? (stat.ts_pct * 100).toFixed(1) + '%' : '0.0%'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('USG%'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('usg_pct', stat.usg_pct || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.usg_pct ? (stat.usg_pct * 100).toFixed(1) + '%' : '0.0%'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('AST RATIO'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('ast_ratio', stat.ast_ratio || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.ast_ratio ? stat.ast_ratio.toFixed(1) : '0.0'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('REB%'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('reb_pct', stat.reb_pct || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.reb_pct ? (stat.reb_pct * 100).toFixed(1) + '%' : '0.0%'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('EFG%'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('efg_pct', stat.efg_pct || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.efg_pct ? (stat.efg_pct * 100).toFixed(1) + '%' : '0.0%'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('TOV%'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('tov_pct', stat.tov_pct || 0, true), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.tov_pct ? (stat.tov_pct * 100).toFixed(1) + '%' : '0.0%'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('TOUCHES'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('touches', stat.touches || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.touches ? stat.touches.toFixed(1) : '0.0'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('PASSES'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('passes', stat.passes || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.passes ? stat.passes.toFixed(1) : '0.0'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('DEFL'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('deflections', stat.deflections || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.deflections ? stat.deflections.toFixed(1) : '0.0'}
                            </td>;
                          })()}
                          {(() => {
                            const width = `${Math.max('PAINT PTS'.length * 16 + 60, 130)}px`;
                            return <td style={{...getCellStyle('paint_pts', stat.paint_pts || 0), padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip'}}>
                              {stat.paint_pts ? stat.paint_pts.toFixed(1) : '0.0'}
                            </td>;
                          })()}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Box>
            );
          })()
        ) : (
          // Stats View (default) - show player table for live/completed, roster for upcoming
          gameState === 'upcoming' ? (
            renderUpcomingView()
          ) : gameState === 'completed' ? (
            // For completed games, show BoxScore with highlights link
            renderLiveOrCompletedView()
          ) : (
            // For live games, show player table with full stats
            (() => {
              // Calculate the longest player name for live games
              const calculateLiveNameWidth = () => {
                if (!currentTeamStats || currentTeamStats.length === 0) return 200;
                const allNames = currentTeamStats
                  .map((p: any) => p.player_name)
                  .filter(Boolean);
                if (allNames.length === 0) return 200;
                const longestName = allNames.reduce((a, b) => a.length > b.length ? a : b, '');
                const nameWidth = Math.max(longestName.length * 8 + 80, 200);
                return isMobile ? Math.max(nameWidth, 220) : nameWidth;
              };
              const liveNameColumnMinWidth = calculateLiveNameWidth();

              return (
                <Box sx={{ 
                  maxHeight: { xs: 'calc(100vh - 200px)', sm: '500px' }, 
                  overflowY: 'auto',
                  overflowX: 'auto',
                  width: '100%',
                  WebkitOverflowScrolling: 'touch',
                  mx: { xs: -1, sm: 0 },
                  px: { xs: 1, sm: 0 }
                }}>
                  <Table sx={{ bgcolor: '#000000', width: 'auto', minWidth: '100%', tableLayout: 'auto' }}>
                    <thead>
                      <tr>
                        <th style={{ 
                          color: '#FFFFFF', 
                          fontSize: '0.875rem', 
                          minWidth: `${liveNameColumnMinWidth}px`, 
                          width: `${liveNameColumnMinWidth}px`,
                          padding: '12px',
                          whiteSpace: 'nowrap',
                          overflow: 'visible',
                          textOverflow: 'clip',
                        }}>Player</th>
                        {(() => {
                          const minWidth = `${Math.max('MIN'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>MIN</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('PTS'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>PTS</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('REB'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>REB</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('AST'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>AST</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('STL'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>STL</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('BLK'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>BLK</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('TOV'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>TOV</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('FG'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'center', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>FG</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('3PT'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'center', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>3PT</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('FT'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'center', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>FT</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('OREB'.length * 16 + 60, 130)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>OREB</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('DREB'.length * 16 + 60, 130)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>DREB</th>;
                        })()}
                        {(() => {
                          const minWidth = `${Math.max('FP'.length * 16 + 60, 120)}px`;
                          return <th style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: minWidth, width: minWidth, whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>FP</th>;
                        })()}
                      </tr>
                    </thead>
                    <tbody>
                      {currentTeamStats
                        .sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0))
                        .map((player) => {
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
                              nameColumnMinWidth={liveNameColumnMinWidth}
                            />
                          );
                        })}
                    </tbody>
                  </Table>
                </Box>
              );
            })()
          )
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
  trends,
  nameColumnMinWidth = 200
}: {
  player: any;
  teamTricode: string;
  gameState: string;
  navigate: (path: string) => void;
  playerProps?: PlayerProp[];
  stats?: any;
  fantasyPoints?: number;
  trends?: Record<string, 'up' | 'down' | null>;
  nameColumnMinWidth?: number;
}) {
  const playerId = player.player_id || (player.nba_player_id ? String(player.nba_player_id) : player.id);
  const safeTrends = trends || {};
  const nbaPlayerId = player.nba_player_id;
  const playerName = player.player_name;
  const position = player.position || (player as any).position;
  const jerseyNumber = player.jersey_number;
  
  const { data: seasonStats } = useQuery({
    queryKey: ['player-season-stats-2025-26', playerId],
    queryFn: async () => {
      if (!playerId) return null;
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('pts, reb, ast')
        .eq('player_id', playerId)
        .eq('season_year', '2025-26')
        .gte('game_date', '2025-10-21')
        .lte('game_date', '2026-04-12')
        .gt('min', 0);

      if (error) throw error;
      if (!data || data.length === 0) return { ppg: 0, rpg: 0, apg: 0 };

      const totals = data.reduce(
        (acc: { pts: number; reb: number; ast: number; games: number }, game) => {
          acc.pts += game.pts || 0;
          acc.reb += game.reb || 0;
          acc.ast += game.ast || 0;
          acc.games += 1;
          return acc;
        },
        { pts: 0, reb: 0, ast: 0, games: 0 }
      );

      return {
        ppg: totals.games > 0 ? totals.pts / totals.games : 0,
        rpg: totals.games > 0 ? totals.reb / totals.games : 0,
        apg: totals.games > 0 ? totals.ast / totals.games : 0,
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
        minWidth: `${nameColumnMinWidth}px`, 
        width: `${nameColumnMinWidth}px`,
        padding: '12px',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 1 }}>
          <Avatar
            src={`https://cdn.nba.com/headshots/nba/latest/260x190/${nbaPlayerId}.png`}
            alt={playerName}
            sx={{ width: 32, height: 32, flexShrink: 0 }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, alignItems: 'center' }}>
            {jerseyNumber && (
              <Typography sx={{ color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 'bold', lineHeight: 1.2, textAlign: 'center' }}>
                #{jerseyNumber}
              </Typography>
            )}
            {position && (
              <Typography sx={{ color: '#CCCCCC', fontSize: '0.75rem', lineHeight: 1.2, textAlign: 'center' }}>
                {position}
              </Typography>
            )}
            <Typography sx={{ 
              color: '#FFFFFF', 
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
              mt: jerseyNumber || position ? 0.25 : 0,
              textAlign: 'center',
            }}>
              {playerName}
            </Typography>
          </Box>
        </Box>
      </td>
      {gameState === 'upcoming' && (
        <>
          {(() => {
            const width = `${Math.max('MPG'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats && 'mpg' in displayStats ? (displayStats.mpg?.toFixed(1) || '0.0') : 'N/A'}
                {safeTrends.mpg === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.mpg === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('PPG'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFC72C', fontSize: '0.875rem', textAlign: 'right', fontWeight: 600, padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats ? (displayStats.ppg?.toFixed(1) || '0.0') : 'N/A'}
                {safeTrends.ppg === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.ppg === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('RPG'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats ? (displayStats.rpg?.toFixed(1) || '0.0') : 'N/A'}
                {safeTrends.rpg === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.rpg === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('APG'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats ? (displayStats.apg?.toFixed(1) || '0.0') : 'N/A'}
                {safeTrends.apg === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.apg === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('SPG'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats && 'spg' in displayStats ? (displayStats.spg?.toFixed(1) || '0.0') : 'N/A'}
                {safeTrends.spg === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.spg === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('BPG'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats && 'bpg' in displayStats ? (displayStats.bpg?.toFixed(1) || '0.0') : 'N/A'}
                {safeTrends.bpg === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.bpg === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('FG%'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats && 'fg_pct' in displayStats && displayStats.fg_pct !== undefined 
                  ? (displayStats.fg_pct * 100).toFixed(1) + '%' 
                  : 'N/A'}
                {safeTrends.fg_pct === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.fg_pct === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('3P%'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats && 'fg3_pct' in displayStats && displayStats.fg3_pct !== undefined 
                  ? (displayStats.fg3_pct * 100).toFixed(1) + '%' 
                  : 'N/A'}
                {safeTrends.fg3_pct === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.fg3_pct === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('FT%'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                {displayStats && 'ft_pct' in displayStats && displayStats.ft_pct !== undefined 
                  ? (displayStats.ft_pct * 100).toFixed(1) + '%' 
                  : 'N/A'}
                {safeTrends.ft_pct === 'up' && <FaFire style={{ fontSize: '0.875rem', color: '#FF6B35', opacity: 0.8 }} />}
                {safeTrends.ft_pct === 'down' && <FaSnowflake style={{ fontSize: '0.875rem', color: '#87CEEB', opacity: 0.8 }} />}
              </Box>
            </td>;
          })()}
        </>
      )}
      {(gameState === 'live' || gameState === 'completed') && (
        <>
          {(() => {
            const width = `${Math.max('MIN'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.min ? Math.round(stats.min).toString() : '0'}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('PTS'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFC72C', fontSize: '0.875rem', textAlign: 'right', fontWeight: 600, padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.pts || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('REB'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.reb || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('AST'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.ast || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('STL'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.stl || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('BLK'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.blk || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('TOV'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.tov || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('FG'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'center', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.fgm || 0}-{stats?.fga || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('3PT'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'center', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.fg3m || 0}-{stats?.fg3a || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('FT'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'center', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.ftm || 0}-{stats?.fta || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('OREB'.length * 16 + 60, 130)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.oreb || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('DREB'.length * 16 + 60, 130)}px`;
            return <td style={{ color: '#FFFFFF', fontSize: '0.875rem', textAlign: 'right', padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {stats?.dreb || 0}
            </td>;
          })()}
          {(() => {
            const width = `${Math.max('FP'.length * 16 + 60, 120)}px`;
            return <td style={{ color: '#FFC72C', fontSize: '0.875rem', textAlign: 'right', fontWeight: 600, padding: '12px', minWidth: width, width: width, overflow: 'visible', textOverflow: 'clip' }}>
              {fantasyPoints?.toFixed(1) || '0.0'}
            </td>;
          })()}
        </>
      )}
    </tr>
  );
}

