import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  Avatar,
  Chip,
  Stack,
  Alert,
  Grid,
  Button,
  LinearProgress,
  CircularProgress,
  Divider,
  IconButton,
  Modal,
  ModalDialog,
  ModalClose,
  Select,
  Option,
  FormControl,
  FormLabel,
  Snackbar,
  Tabs,
  TabList,
  Tab,
} from '@mui/joy';
import { 
  ArrowBack, 
  NavigateBefore, 
  NavigateNext,
  Verified,
  Favorite,
  FavoriteBorder,
  MoreVert,
  Share,
} from '@mui/icons-material';
import { FaChartBar, FaChartLine, FaStar, FaClipboardList, FaAt, FaMoon } from 'react-icons/fa';
import { usePlayerComprehensive } from '../hooks/usePlayerComprehensive';
import { usePlayerAwards } from '../hooks/usePlayerAwards';
import TeamLineupModal from '../components/TeamLineupModal';
import { useIsPlayerFavorite, usePlayerFavoriteCount, useAddToFavorites, useRemoveFromFavorites } from '../hooks/usePlayerFavorites';
import { usePlayerGameStats } from '../hooks/usePlayerGameStats';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabase';
import { getTeamPrimaryColor, getTeamSecondaryColor, getTextColorForBackground } from '../utils/nbaTeamColors';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { useQuery } from '@tanstack/react-query';
import { FANDUEL_SCORING, calculateFantasyPoints } from '../utils/fantasyScoring';
import AdvancedMetricsRadarChart from '../components/PlayerCharts/AdvancedMetricsRadarChart';
import PaceGaugeChart from '../components/PlayerCharts/PaceGaugeChart';
import FourFactorsBarChart from '../components/PlayerCharts/FourFactorsBarChart';
import UsageEfficiencyScatterChart from '../components/PlayerCharts/UsageEfficiencyScatterChart';
import { formatESTDate } from '../utils/nbaDateUtils';
import PlayerPerformanceTrends from '../components/PlayerCharts/PlayerPerformanceTrends';
import MinutesLineChart from '../components/PlayerCharts/MinutesLineChart';
import FantasyPointsLineChart from '../components/PlayerCharts/FantasyPointsLineChart';
import FantasyPointsProgressionChart from '../components/PlayerCharts/FantasyPointsProgressionChart';
import { usePlayerHighlights } from '../hooks/usePlayerHighlights';
import { LineChart } from '@mui/x-charts/LineChart';
import { calculatePropResult } from '../utils/playerPropsCalculator';
import { filterFullGameProps } from '../utils/playerPropsFilter';

interface PlayerPageProps {
  playerId: string;
  playerName: string;
  onBack: () => void;
  leagueId?: string;
  teamName?: string;
}

export default function PlayerPage({ 
  playerId, 
  playerName, 
  onBack, 
  leagueId, 
  teamName 
}: PlayerPageProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 900px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isLandscapeMobile = isMobile && isLandscape;
  
  // Fetch player highlights
  const { data: highlights, isLoading: highlightsLoading, error: highlightsError } = usePlayerHighlights(playerId);
  
  // Debug logging
  useEffect(() => {
    console.log('🎬 PlayerPage: Highlights state:', {
      playerId,
      highlights,
      highlightsLoading,
      highlightsError,
      highlightsCount: highlights?.length || 0,
    });
  }, [playerId, highlights, highlightsLoading, highlightsError]);
  
  const [gameLogsView, setGameLogsView] = useState<'traditional' | 'advanced' | 'fantasy' | 'props'>('traditional');
  const [gameLogsPage, setGameLogsPage] = useState(1);
  const gameLogsPageSize = 10; // Show 10 games per page
  const [propsPage, setPropsPage] = useState(1);
  const propsPageSize = 10; // Show 10 games per page
  const selectedSeason = '2025-26'; // Hardcoded to current season
  const [imageModal, setImageModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: Game Logs, 1: Props, 2: Stats, etc.
  const [lineupModal, setLineupModal] = useState<{
    open: boolean;
    type: 'totn' | 'totw';
    gameDate?: string;
    weekStart?: string;
    weekEnd?: string;
    weekNumber?: number;
  }>({ open: false, type: 'totn' });
  
  const { 
    data: playerData, 
    isLoading: loading, 
    error 
  } = usePlayerComprehensive(playerId, 1, 20);

  // Fetch player awards (POW, POM, TOTN, TOTW)
  const { data: awardsData, isLoading: awardsLoading } = usePlayerAwards(playerId);

  // Build fast lookup sets for game log award icons
  const awardLookups = useMemo(() => {
    const totnDates = new Set<string>();
    const totwRanges: { start: string; end: string }[] = [];
    const powWeeks: { start: string; season: string }[] = [];
    const pomMonths: { year: number; month: number }[] = [];

    if (awardsData) {
      for (const a of awardsData.totn) totnDates.add(a.game_date);
      for (const a of awardsData.totw) totwRanges.push({ start: a.week_start, end: a.week_end });
      for (const a of awardsData.pow) powWeeks.push({ start: a.week_start_date, season: a.season });
      for (const a of awardsData.pom) pomMonths.push({ year: a.award_year, month: a.award_month });
    }

    return {
      isTotn: (date: string) => totnDates.has(date),
      isTotw: (date: string) => totwRanges.some(r => date >= r.start && date <= r.end),
      isPow: (date: string) => {
        // POW week_start_date is the Monday; the award covers Mon-Sun (7 days)
        return powWeeks.some(w => {
          const end = new Date(w.start + 'T00:00:00');
          end.setDate(end.getDate() + 6);
          return date >= w.start && date <= end.toISOString().slice(0, 10);
        });
      },
      isPom: (date: string) => {
        const d = new Date(date + 'T00:00:00');
        return pomMonths.some(m => d.getFullYear() === m.year && d.getMonth() + 1 === m.month);
      },
    };
  }, [awardsData]);

  // Fetch all team games and merge with player boxscores
  // Strategy: Get all unique games from boxscores for this team, then fetch game details from nba_games
  const { data: gameLogsData, isLoading: gameLogsLoading } = useQuery({
    queryKey: ['player-game-logs-all', playerId, playerData?.player?.team_abbreviation],
    queryFn: async () => {
      const teamAbbreviation = playerData?.player?.team_abbreviation;
      const teamId = playerData?.player?.team_id;
      
      if (!teamAbbreviation) {
        console.warn('⚠️ No team abbreviation available yet');
        return { gameLogs: [] };
      }

      console.log('📅 Fetching all team games for team:', teamAbbreviation, 'team_id:', teamId);

      // First, get all unique games from boxscores where this team played
      // This ensures we get ALL games the team has played, even if nba_games is incomplete
      // Use pagination to handle large datasets
      let allTeamBoxscores: any[] = [];
      let teamFrom = 0;
      const teamPageSize = 1000;
      let teamHasMore = true;

      while (teamHasMore) {
        const { data: teamBoxscores, error: boxscoresError } = await supabase
          .from('nba_boxscores')
          .select('game_id, game_date, matchup, team_abbreviation, team_tricode')
          .eq('season_year', '2025-26')
          .gt('game_date', '2025-10-20') // Exclude preseason
          .or(`team_abbreviation.eq.${teamAbbreviation},team_tricode.eq.${teamAbbreviation}`)
          .order('game_date', { ascending: false })
          .range(teamFrom, teamFrom + teamPageSize - 1);

        if (boxscoresError) {
          console.error('❌ Error fetching team boxscores:', boxscoresError);
          throw boxscoresError;
        }

        if (teamBoxscores && teamBoxscores.length > 0) {
          allTeamBoxscores = [...allTeamBoxscores, ...teamBoxscores];
          teamFrom += teamPageSize;
          teamHasMore = teamBoxscores.length === teamPageSize;
        } else {
          teamHasMore = false;
        }
      }

      // Get unique game_ids from team boxscores
      const uniqueGameIds = [...new Set((allTeamBoxscores || []).map(b => b.game_id).filter(Boolean))];
      console.log('📊 Found unique team games from boxscores:', uniqueGameIds.length);

      // Fetch game details from nba_games for these game_ids
      let teamGamesMap = new Map();
      if (uniqueGameIds.length > 0) {
        const { data: teamGames, error: gamesError } = await supabase
          .from('nba_games')
          .select('*')
          .in('game_id', uniqueGameIds)
          .order('game_date', { ascending: false });

        if (gamesError) {
          console.warn('⚠️ Error fetching game details from nba_games:', gamesError);
          // Continue anyway - we'll use boxscore data
        } else {
          console.log('📊 Found game details from nba_games:', teamGames?.length || 0);
          (teamGames || []).forEach(game => {
            teamGamesMap.set(game.game_id, game);
          });
        }
      }

      // Also try fetching from nba_games directly as fallback
      const { data: directTeamGames, error: directGamesError } = await supabase
        .from('nba_games')
        .select('*')
        .eq('season_year', 2026)
        .gt('game_date', '2025-10-20')
        .or(`home_team_tricode.eq.${teamAbbreviation},away_team_tricode.eq.${teamAbbreviation}`)
        .order('game_date', { ascending: false });

      if (!directGamesError && directTeamGames) {
        console.log('📊 Found team games directly from nba_games:', directTeamGames.length);
        directTeamGames.forEach(game => {
          if (!teamGamesMap.has(game.game_id)) {
            teamGamesMap.set(game.game_id, game);
          }
        });
      }

      // Fetch all player boxscores for 2025-26 season (with pagination to handle large datasets)
      let allPlayerBoxscores: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: playerBoxscores, error: playerBoxscoresError } = await supabase
          .from('nba_boxscores')
          .select('*')
          .eq('player_id', playerId)
          .eq('season_year', '2025-26')
          .gt('game_date', '2025-10-20')
          .order('game_date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (playerBoxscoresError) {
          console.error('❌ Error fetching player boxscores:', playerBoxscoresError);
          throw playerBoxscoresError;
        }

        if (playerBoxscores && playerBoxscores.length > 0) {
          allPlayerBoxscores = [...allPlayerBoxscores, ...playerBoxscores];
          from += pageSize;
          hasMore = playerBoxscores.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log('📊 Found player boxscores:', allPlayerBoxscores.length);

      // Create a map of game_id to boxscore data
      const boxscoreMap = new Map();
      allPlayerBoxscores.forEach((boxscore) => {
        if (boxscore.game_id) {
          boxscoreMap.set(boxscore.game_id, boxscore);
        }
      });

      // Create a map of game_id to team boxscore (for matchup info)
      const teamBoxscoreMap = new Map();
      (allTeamBoxscores || []).forEach((boxscore) => {
        if (boxscore.game_id && !teamBoxscoreMap.has(boxscore.game_id)) {
          teamBoxscoreMap.set(boxscore.game_id, boxscore);
        }
      });

      // PRIMARY SOURCE: Use player boxscores as the definitive list of games
      // Player boxscores are the source of truth - if a player has a boxscore, they played in that game
      const playerGameIds = new Set(allPlayerBoxscores.map(b => b.game_id).filter(Boolean));
      
      // SECONDARY SOURCES: Add games from team boxscores and nba_games for matchup info
      // But player boxscores take precedence
      const allGameIds = new Set([
        ...Array.from(playerGameIds), // PRIMARY: Start with player boxscores
        ...uniqueGameIds, // Add team boxscores for matchup info
        ...Array.from(teamGamesMap.keys()) // Add nba_games for game details
      ]);

      console.log('🔗 Total unique game IDs to process:', allGameIds.size);
      console.log('🔗 PRIMARY - From player boxscores:', playerGameIds.size);
      console.log('🔗 SECONDARY - From team boxscores:', uniqueGameIds.length);
      console.log('🔗 SECONDARY - From nba_games:', teamGamesMap.size);
      console.log('🔗 Player boxscore game IDs (first 10):', Array.from(playerGameIds).slice(0, 10));
      
      // Verify all player boxscores are included (they should be since we start with them)
      const missingFromAllGameIds = Array.from(playerGameIds).filter(id => !allGameIds.has(id));
      if (missingFromAllGameIds.length > 0) {
        console.error('❌ CRITICAL: Some player boxscore game IDs are missing from allGameIds:', missingFromAllGameIds);
      } else {
        console.log('✅ All player boxscore game IDs are included in allGameIds');
      }

      const mergedGameLogs = Array.from(allGameIds).map((gameId) => {
        const game = teamGamesMap.get(gameId);
        const boxscore = boxscoreMap.get(gameId);
        const teamBoxscore = teamBoxscoreMap.get(gameId);

        // Get matchup from game, teamBoxscore, or boxscore (player's boxscore has matchup too)
        let matchup = game?.away_team_tricode && game?.home_team_tricode 
          ? `${game.away_team_tricode} @ ${game.home_team_tricode}`
          : teamBoxscore?.matchup || boxscore?.matchup || 'TBD @ TBD';

        // Determine if player played
        const played = boxscore && Number(boxscore.min || 0) > 0;
        const hasInjury = boxscore && Number(boxscore.min || 0) === 0 && boxscore.dnp_reason;

        // Get game date - ensure it's a valid date string
        let gameDate = game?.game_date || teamBoxscore?.game_date || boxscore?.game_date;
        
        // Normalize date format - ensure it's ISO string format
        if (gameDate) {
          try {
            // If it's already an ISO string, use it; otherwise parse and reformat
            const dateObj = new Date(gameDate);
            if (!isNaN(dateObj.getTime())) {
              gameDate = dateObj.toISOString();
            } else {
              console.warn('⚠️ Invalid date format for game:', gameId, 'date:', gameDate);
              gameDate = null;
            }
          } catch (e) {
            console.warn('⚠️ Error parsing date for game:', gameId, 'date:', gameDate, 'error:', e);
            gameDate = null;
          }
        }

        // Determine home/away
        const isHome = game 
          ? game.home_team_tricode === teamAbbreviation
          : teamBoxscore?.team_abbreviation === teamAbbreviation && teamBoxscore?.is_home_game;
        const opponent = game
          ? (isHome ? game.away_team_tricode : game.home_team_tricode)
          : (matchup.includes(' @ ') ? matchup.split(' @ ')[isHome ? 1 : 0] : 'TBD');

        return {
          game_id: gameId,
          game_date: gameDate,
          matchup,
          team_abbreviation: teamAbbreviation,
          opponent,
          is_home: isHome,
          played,
          dnp_reason: hasInjury ? (boxscore.dnp_reason || 'DNP') : (played ? null : 'DNP'),
          // Use boxscore stats if available, otherwise null
          min: boxscore?.min ?? null,
          pts: boxscore?.pts ?? null,
          reb: boxscore?.reb ?? null,
          ast: boxscore?.ast ?? null,
          stl: boxscore?.stl ?? null,
          blk: boxscore?.blk ?? null,
          tov: boxscore?.tov ?? null,
          fg_pct: boxscore?.fg_pct ?? null,
          fg3_pct: boxscore?.fg3_pct ?? null,
          ft_pct: boxscore?.ft_pct ?? null,
          // Spread other boxscore fields
          ...(boxscore || {}),
        };
      });

      console.log('✅ Merged game logs:', mergedGameLogs.length);
      console.log('✅ Games with boxscores:', mergedGameLogs.filter(g => g.played).length);
      console.log('✅ Games without boxscores (DNP):', mergedGameLogs.filter(g => !g.played).length);
      
      // Debug: Show date range of merged logs
      const dates = mergedGameLogs.map(g => g.game_date).filter(Boolean).sort().reverse();
      if (dates.length > 0) {
        console.log('📅 Date range:', {
          latest: dates[0],
          earliest: dates[dates.length - 1],
          gamesAfterDec7: dates.filter(d => d > '2025-12-07').length
        });
      }

      // Sort by game_date descending (most recent first)
      // Handle null/undefined dates by putting them at the end
      const sortedGameLogs = mergedGameLogs.sort((a, b) => {
        if (!a.game_date && !b.game_date) return 0;
        if (!a.game_date) return 1; // Put null dates at end
        if (!b.game_date) return -1; // Put null dates at end
        
        const dateA = new Date(a.game_date).getTime();
        const dateB = new Date(b.game_date).getTime();
        
        if (isNaN(dateA) || isNaN(dateB)) {
          console.warn('⚠️ Invalid date found:', { a: a.game_date, b: b.game_date, gameIdA: a.game_id, gameIdB: b.game_id });
          return 0;
        }
        
        return dateB - dateA; // Descending (newest first)
      });
      
      console.log('📊 Sorted game logs:', sortedGameLogs.length);
      console.log('📅 First 10 games:', sortedGameLogs.slice(0, 10).map(g => ({ 
        game_id: g.game_id, 
        date: g.game_date, 
        dateString: g.game_date ? new Date(g.game_date).toISOString().split('T')[0] : 'null',
        played: g.played,
        min: g.min,
        pts: g.pts
      })));
      
      // Check specifically for Dec 7-13
      const dec7to13 = sortedGameLogs.filter(g => {
        if (!g.game_date) return false;
        const dateStr = new Date(g.game_date).toISOString().split('T')[0];
        return '2025-12-07' <= dateStr && dateStr <= '2025-12-13';
      });
      console.log('📅 Games Dec 7-13:', dec7to13.length);
      dec7to13.forEach(g => {
        const dateStr = g.game_date ? new Date(g.game_date).toISOString().split('T')[0] : 'null';
        console.log(`  - ${dateStr}: Game ${g.game_id}, played: ${g.played}, min: ${g.min}, pts: ${g.pts}`);
      });

      return {
        gameLogs: sortedGameLogs,
      };
    },
    enabled: !!playerId && !!playerData?.player?.team_abbreviation,
  });

  // Fetch 2025-26 season stats (regular season games only: 2025-10-21 to 2026-04-12, min > 0)
  // Fetch player props history - grouped by game
  const { data: playerPropsData, isLoading: propsLoading } = useQuery({
    queryKey: ['player-props-history-grouped', playerId, playerData?.player?.nba_player_id, playerData?.player?.name],
    queryFn: async () => {
      if (!playerData?.player || !playerData.player.nba_player_id) return [];
      
      const orConditions = [];
      if (playerData.player.id) {
        orConditions.push(`player_id.eq.${playerData.player.id}`);
      }
      if (playerData.player.nba_player_id) {
        orConditions.push(`nba_player_id.eq.${playerData.player.nba_player_id}`);
      }
      if (playerData.player.name) {
        orConditions.push(`player_name.ilike.%${playerData.player.name}%`);
      }
      
      if (orConditions.length === 0) return [];
      
      // Fetch all props
      const { data: props, error: propsError } = await supabase
        .from('player_props')
        .select(`
          *,
          player_props_games!inner (
            id,
            event_id,
            game_date,
            home_team,
            away_team,
            home_team_tricode,
            away_team_tricode
          )
        `)
        .or(orConditions.join(','))
        .order('game_date', { ascending: false })
        .order('bet_type', { ascending: true })
        .limit(500); // Limit to recent 500 props
      
      if (propsError || !props || props.length === 0) {
        return [];
      }

      // Only full-game props (exclude 1q, 1h, etc.)
      const fullGameProps = filterFullGameProps(props);

      // Group props by game (using event_id and game_date)
      const gameMap = new Map<string, {
        game_date: string;
        event_id: string | null;
        matchup: string;
        props: any[];
        boxscore: any | null;
      }>();
      
      for (const prop of fullGameProps) {
        const game = prop.player_props_games;
        if (!game) continue;
        
        const gameKey = `${game.event_id || 'unknown'}-${game.game_date}`;
        
        if (!gameMap.has(gameKey)) {
          const matchup = game.away_team_tricode && game.home_team_tricode
            ? `${game.away_team_tricode} @ ${game.home_team_tricode}`
            : game.away_team && game.home_team
            ? `${game.away_team} @ ${game.home_team}`
            : 'TBD @ TBD';
          
          gameMap.set(gameKey, {
            game_date: game.game_date,
            event_id: game.event_id,
            matchup,
            props: [],
            boxscore: null,
          });
        }
        
        gameMap.get(gameKey)!.props.push(prop);
      }
      
      // Fetch boxscores for all unique games
      const gameDates = Array.from(new Set(Array.from(gameMap.values()).map(g => g.game_date)));
      const { data: boxscores, error: boxscoreError } = await supabase
        .from('nba_boxscores')
        .select('game_id, game_date, pts, reb, ast, stl, blk, tov, fg3m, fg3a, ftm, fta, fgm, fga')
        .eq('player_id', playerId)
        .in('game_date', gameDates)
        .order('game_date', { ascending: false });
      
      // Create boxscore map by game_date (for games with same date, use the most recent one)
      const boxscoreMap = new Map<string, any>();
      if (boxscores && !boxscoreError) {
        for (const boxscore of boxscores) {
          // Use game_date as key - if multiple games on same date, keep the first one encountered (most recent due to ordering)
          if (!boxscoreMap.has(boxscore.game_date)) {
            boxscoreMap.set(boxscore.game_date, boxscore);
          }
        }
      }
      
      // Process each game: deduplicate props (keep highest line for each bet_type) and calculate prop results
      const groupedGames = Array.from(gameMap.values()).map(game => {
        const boxscore = boxscoreMap.get(game.game_date);
        
        // Deduplicate props: For each bet_type, keep only the one with the HIGHEST line value
        const propsByType = new Map<string, any[]>();
        game.props.forEach((prop: any) => {
          const betType = prop.bet_type;
          if (!propsByType.has(betType)) {
            propsByType.set(betType, []);
          }
          propsByType.get(betType)!.push(prop);
        });
        
        // For each bet_type, keep only the highest line
        const deduplicatedProps: any[] = [];
        propsByType.forEach((props) => {
          // Sort by line value (descending - highest first)
          props.sort((a: any, b: any) => {
            const lineA = parseFloat(a.line?.toString() || '0');
            const lineB = parseFloat(b.line?.toString() || '0');
            return lineB - lineA; // Descending order - highest first
          });
          
          // Take the first one (highest line)
          if (props[0]) {
            deduplicatedProps.push(props[0]);
          }
        });
        
        // Calculate prop results for each deduplicated prop
        const propResults = deduplicatedProps.map(prop => {
          if (!boxscore) {
            return {
              prop,
              result: null,
              hit: false,
            };
          }
          
          const result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore);
          return {
            prop,
            result,
            hit: result?.result === 'over',
          };
        });
        
        // Calculate hit rate (percentage of props that went over)
        const hits = propResults.filter(r => r.hit).length;
        const total = propResults.length;
        const hitRate = total > 0 ? (hits / total) * 100 : 0;
        
        return {
          ...game,
          boxscore,
          propResults,
          hitRate,
          hits,
          total,
        };
      });
      
      // Sort by game_date descending
      groupedGames.sort((a, b) => {
        const dateA = new Date(a.game_date).getTime();
        const dateB = new Date(b.game_date).getTime();
        return dateB - dateA;
      });
      
      return groupedGames;
    },
    enabled: !!playerData?.player,
  });

  const { data: seasonStats } = useQuery({
    queryKey: ['player-season-stats-2025-26', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('pts, reb, ast, stl, blk, tov, min')
        .eq('player_id', playerId)
        .eq('season_year', '2025-26')
        .gte('game_date', '2025-10-21')
        .lte('game_date', '2026-04-12')
        .gt('min', 0); // Only games where player played (min > 0)

      if (error) throw error;

      if (!data || data.length === 0) {
        return { ppg: 0, rpg: 0, apg: 0, avgFantasyPoints: 0 };
      }

      // Calculate totals
      const totals = data.reduce(
        (acc, game) => {
          const min = parseFloat(game.min) || 0;
          if (min > 0) {
            acc.pts += game.pts || 0;
            acc.reb += game.reb || 0;
            acc.ast += game.ast || 0;
            acc.games += 1;
            
            // Calculate fantasy points for this game using FanDuel scoring
            const gameStats = {
              pts: Number(game.pts) || 0,
              reb: Number(game.reb) || 0,
              ast: Number(game.ast) || 0,
              stl: Number(game.stl) || 0,
              blk: Number(game.blk) || 0,
              tov: Number(game.tov) || 0,
            };
            const fp = calculateFantasyPoints(gameStats as any, FANDUEL_SCORING);
            acc.fantasyPoints += fp;
          }
          return acc;
        },
        { pts: 0, reb: 0, ast: 0, games: 0, fantasyPoints: 0 }
      );

      // Calculate averages
      const ppg = totals.games > 0 ? totals.pts / totals.games : 0;
      const rpg = totals.games > 0 ? totals.reb / totals.games : 0;
      const apg = totals.games > 0 ? totals.ast / totals.games : 0;
      const avgFantasyPoints = totals.games > 0 ? totals.fantasyPoints / totals.games : 0;

      return { ppg, rpg, apg, avgFantasyPoints };
    },
    enabled: !!playerId,
  });
  
  const { user } = useAuth();
  const { data: isFavorite } = useIsPlayerFavorite(playerId);
  const { data: favoriteCount } = usePlayerFavoriteCount(playerId);
  const addToFavoritesMutation = useAddToFavorites();
  const removeFromFavoritesMutation = useRemoveFromFavorites();

  const handleTeamClick = async () => {
    if (!playerData?.player.team_id) return;
    
    try {
      // Query for team UUID using team_id
      const { data, error } = await supabase
        .from('nba_teams')
        .select('id')
        .eq('team_id', playerData.player.team_id)
        .maybeSingle();

      // Handle error or no data - PGRST116 means 0 rows, which is fine with maybeSingle
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching team:', error);
        return;
      }

      if (!data) {
        console.error('Team not found');
        return;
      }

      navigate(`/team/${data.id}`);
    } catch (error) {
      console.error('Error navigating to team:', error);
    }
  };

  // Reset image error when player changes
  useEffect(() => {
    setImageError(false);
  }, [playerId]);

  const handleFavoriteToggle = async () => {
    if (!user) return;
    
    if (isFavorite) {
      try {
        await removeFromFavoritesMutation.mutateAsync({ playerId });
      } catch (error) {
        console.error('Failed to remove from favorites:', error);
      }
    } else {
      try {
        await addToFavoritesMutation.mutateAsync({ playerId, notes: undefined });
      } catch (error) {
        console.error('Failed to add to favorites:', error);
      }
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/player/${playerId}`;
    
    // Generate OG image for player page (non-blocking, with retry logic)
    const generateOGImageForPlayer = async (playerId: string, retries = 3): Promise<void> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`🎨 Calling OG image generation for player (attempt ${attempt}/${retries}):`, playerId);
          
          // Call Supabase Edge Function to generate OG image
          const { data, error } = await supabase.functions.invoke('generate-og-image', {
            body: {
              player_id: playerId
            }
          });
          
          if (error) {
            console.error(`❌ Failed to generate OG image (attempt ${attempt}/${retries}):`, error);
            if (attempt === retries) {
              console.error('❌ All retry attempts exhausted for OG image generation');
              return;
            }
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          if (data?.og_image_url) {
            console.log('✅ OG image generated for player:', data.og_image_url);
            return; // Success, exit retry loop
          } else {
            console.warn(`⚠️ OG image function returned no URL (attempt ${attempt}/${retries}):`, data);
            if (attempt === retries) {
              console.error('❌ OG image generation failed after all retries');
              return;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
        } catch (error) {
          console.error(`❌ Error generating OG image (attempt ${attempt}/${retries}):`, error);
          if (attempt === retries) {
            console.error('❌ All retry attempts exhausted due to errors');
            return;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    };
    
    // Generate OG image asynchronously (non-blocking)
    generateOGImageForPlayer(playerId).catch(err => {
      console.error('❌ Error in OG image generation:', err);
    });
    
    // Copy URL to clipboard
    try {
      await navigator.clipboard.writeText(url);
      // You could add a toast notification here if needed
      console.log('Copied to clipboard:', url);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Copied to clipboard (fallback):', url);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        bgcolor: '#000000',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}>
        <Box sx={{ 
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto', 
          pt: { xs: 2, md: 3 },
          pb: 2,
          px: { xs: 0, sm: 2, md: 2 },
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2, borderColor: '#333333', color: '#FFFFFF' }}>
              Back to {teamName ? `${teamName} Roster` : 'Roster'}
            </Button>
            <LinearProgress sx={{ flex: 1 }} />
          </Box>
          <Typography sx={{ color: '#FFFFFF' }}>Loading player data...</Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        bgcolor: '#000000',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}>
        <Box sx={{ 
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto', 
          pt: { xs: 2, md: 3 },
          pb: 2,
          px: { xs: 0, sm: 2, md: 2 },
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2, borderColor: '#333333', color: '#FFFFFF' }}>
              Back to {teamName ? `${teamName} Roster` : 'Roster'}
            </Button>
          </Box>
        <Alert color="danger" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <Typography sx={{ color: '#FFFFFF' }}>Error loading player data: {error.message}</Typography>
        </Alert>
        </Box>
      </Box>
    );
  }

  if (!playerData) {
    return (
      <Box sx={{ 
        bgcolor: '#000000',
        minHeight: '100vh',
        overflowX: 'hidden',
        width: '100%',
      }}>
        <Box sx={{ 
          maxWidth: { xs: '100%', sm: 805, md: 1035 },
          mx: 'auto', 
          pt: { xs: 2, md: 3 },
          pb: 2,
          px: { xs: 0, sm: 2, md: 2 },
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Button variant="outlined" startDecorator={<ArrowBack />} onClick={onBack} size="sm" sx={{ mr: 2, borderColor: '#333333', color: '#FFFFFF' }}>
              Back to {teamName ? `${teamName} Roster` : 'Roster'}
            </Button>
          </Box>
          <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
            <Typography sx={{ color: '#FFFFFF' }}>No player data found</Typography>
          </Alert>
        </Box>
      </Box>
    );
  }

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return num.toLocaleString();
  };

  const formatPercentage = (num: number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatGamePercentage = (num: string | number | undefined) => {
    if (num === undefined || num === null) return 'N/A';
    const numValue = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(numValue)) return 'N/A';
    return `${(numValue * 100).toFixed(1)}%`;
  };

  const formatSalary = (salary: number | undefined) => {
    if (salary === undefined || salary === null) return 'N/A';
    return `$${(salary / 1000000).toFixed(1)}M`;
  };

  const formatHeight = (height: string | undefined) => {
    if (!height || height === 'N/A') return 'N/A';
    
    // If height is already in feet-inches format, return as-is
    if (height.includes('-')) return height;
    
    // Convert inches to feet-inches format
    const totalInches = parseInt(height);
    if (isNaN(totalInches)) return height;
    
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    
    return `${feet}'${inches}"`;
  };

  // Handle clicking on date or opponent to navigate to game highlight
  const handleGameLogClick = async (gameId: string | null | undefined) => {
    if (!gameId) {
      setSnackbarOpen(true);
      return;
    }

    try {
      // Query for fun_score post with this game_id
      const { data: posts, error } = await supabase
        .from('feed_posts')
        .select('id')
        .eq('post_type', 'fun_score')
        .eq('game_id', gameId)
        .eq('status', 'published')
        .limit(1);

      if (error) {
        console.error('Error fetching game highlight:', error);
        setSnackbarOpen(true);
        return;
      }

      if (posts && posts.length > 0) {
        // Navigate to home page with postId
        navigate(`/?postId=${posts[0].id}`);
      } else {
        // No post found, show snackbar
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error handling game log click:', error);
      setSnackbarOpen(true);
    }
  };

  return (
    <Box sx={{ 
      bgcolor: '#000000',
      minHeight: '100vh',
      overflowX: 'hidden',
      width: '100%',
    }}>
      {/* Main Container - Consistent with Home/Dashboard width */}
      {/* No avatar bar on player page, need padding for nav bar only */}
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        minWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto', 
        pt: isLandscapeMobile 
          ? '12px' // Minimal padding in landscape mobile
          : { xs: '12px', md: '16px' }, // Tighter top padding so header isn’t too far down
        pb: 2,
        px: { xs: 0, sm: 2, md: 2 },
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}>
        {/* Player Header: Back button + Avatar left, details right (match game page) */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'row',
          alignItems: 'center', 
          gap: { xs: 1.5, md: 2 }, 
          mb: 0.5, 
          px: { xs: 2, sm: 0 },
        }}>
          {/* Back Button - same as game page header */}
          <IconButton
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={onBack}
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

          {/* Avatar Section - Left side, matching feed avatar bar size */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: 0.5, 
            position: 'relative',
            flexShrink: 0,
          }}>
            <Box sx={{ 
              position: 'relative', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
            }}>
              {/* Player Avatar Container with Logo Layer - Matching feed avatar bar size */}
              <Box
                sx={{
                  position: 'relative',
                  width: { xs: 77, md: 83 },
                  height: { xs: 77, md: 83 },
                  borderRadius: '50%',
                  border: `3px solid ${playerData.player.team_abbreviation ? getTeamSecondaryColor(playerData.player.team_abbreviation) : 'text.primary'}`,
                  bgcolor: playerData.player.team_abbreviation ? getTeamPrimaryColor(playerData.player.team_abbreviation) : 'primary.500',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  },
                }}
                onClick={() => setImageModal(true)}
              >
                {/* Team Logo - Middle Layer (between background color and face) */}
                {playerData.player.team_abbreviation && (
                  <Box
                    component="img"
                    src={getTeamLogoUrl(playerData.player.team_abbreviation)}
                    alt={playerData.player.team_name || 'Team'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (playerData.player.team_id) handleTeamClick();
                    }}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: { xs: 120, md: 130 },
                      height: { xs: 120, md: 130 },
                      opacity: 0.15,
                      zIndex: 1,
                      pointerEvents: playerData.player.team_id ? 'auto' : 'none',
                      cursor: playerData.player.team_id ? 'pointer' : 'default',
                      transition: 'opacity 0.2s',
                      '&:hover': playerData.player.team_id ? {
                        opacity: 0.25,
                      } : {},
                    }}
                  />
                )}
                
                {/* Player Face Image - Top Layer (above logo) */}
                <Box
                  component="img"
                  src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${playerData.player.nba_player_id}.png`}
                  alt={playerData.player.name}
                  onError={(e) => {
                    // Show initials if image fails
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '50%',
                    zIndex: 2,
                  }}
                />
                
                {/* Fallback Initials - Only show if image fails */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: '#FFFFFF',
                    fontSize: { xs: '1.5rem', md: '1.75rem' },
                    fontWeight: 'bold',
                    zIndex: 3,
                    display: 'none', // Hidden by default, shown via JS if image fails
                  }}
                >
                  {playerData.player.name.split(' ').map((n: string) => n[0]).join('')}
                </Box>
              </Box>
              
              {/* Heart Button - Top Left */}
              <IconButton
                variant={isFavorite ? "solid" : "outlined"}
                color={isFavorite ? "danger" : "neutral"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFavoriteToggle();
                }}
                disabled={!user || addToFavoritesMutation.isPending || removeFromFavoritesMutation.isPending}
                loading={addToFavoritesMutation.isPending || removeFromFavoritesMutation.isPending}
                sx={{
                  position: 'absolute',
                  top: { xs: 4, md: 4 },
                  left: { xs: 4, md: 4 },
                  bgcolor: isFavorite ? 'danger.500' : 'background.body',
                  border: `2px solid ${isFavorite ? 'danger.500' : 'divider'}`,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                  zIndex: 2,
                  width: { xs: 20, md: 22 },
                  height: { xs: 20, md: 22 },
                  minWidth: { xs: 20, md: 22 },
                  minHeight: { xs: 20, md: 22 },
                  '&:hover': {
                    transform: 'scale(1.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                  },
                  '& svg': {
                    fontSize: { xs: '0.875rem', md: '1rem' },
                  },
                }}
                title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                {isFavorite ? (
                  <Favorite />
                ) : (
                  <FavoriteBorder />
                )}
              </IconButton>

              {/* Share Button - Top Right */}
              <IconButton
                variant="outlined"
                color="neutral"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
                sx={{
                  position: 'absolute',
                  top: { xs: 4, md: 4 },
                  right: { xs: 4, md: 4 },
                  bgcolor: 'background.body',
                  border: '2px solid',
                  borderColor: 'divider',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                  zIndex: 2,
                  width: { xs: 20, md: 22 },
                  height: { xs: 20, md: 22 },
                  minWidth: { xs: 20, md: 22 },
                  minHeight: { xs: 20, md: 22 },
                  '&:hover': {
                    transform: 'scale(1.1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                    borderColor: 'primary.500',
                  },
                  '& svg': {
                    fontSize: { xs: '0.875rem', md: '1rem' },
                  },
                }}
                title="Share player link"
              >
                <Share />
              </IconButton>
            </Box>
          </Box>

          {/* Player Details Section - Right side */}
          <Box sx={{ 
            flex: 1, 
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            textAlign: 'left',
          }}>
            {/* Name with Position */}
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
                  }}
                >
                  {playerData.player.name}
                </Typography>
                {playerData.player.position && (
                  <Chip
                    variant="soft"
                    size="sm"
                    sx={{ 
                      fontWeight: 'bold',
                      fontSize: { xs: '0.75rem', md: '0.875rem' },
                    }}
                  >
                    {playerData.player.position}
                  </Chip>
                )}
              </Box>
            </Box>

            {/* Stats: PPG, RPG, APG, Fantasy Pts */}
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: { xs: 1.25, md: 1.5 }, 
              flexWrap: 'wrap',
              width: '100%',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography level="h4" sx={{ fontWeight: 'bold', color: 'primary.500', fontSize: { xs: '1rem', md: '1.25rem' } }}>
                  {seasonStats ? seasonStats.ppg.toFixed(1) : 'N/A'}
                </Typography>
                <Typography level="body-xs" sx={{ color: '#CCCCCC', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>PPG</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography level="h4" sx={{ fontWeight: 'bold', color: 'success.500', fontSize: { xs: '1rem', md: '1.25rem' } }}>
                  {seasonStats ? seasonStats.rpg.toFixed(1) : 'N/A'}
                </Typography>
                <Typography level="body-xs" sx={{ color: '#CCCCCC', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>RPG</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography level="h4" sx={{ fontWeight: 'bold', color: 'warning.500', fontSize: { xs: '1rem', md: '1.25rem' } }}>
                  {seasonStats ? seasonStats.apg.toFixed(1) : 'N/A'}
                </Typography>
                <Typography level="body-xs" sx={{ color: '#CCCCCC', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>APG</Typography>
              </Box>
              {/* Fantasy Points */}
              {seasonStats && seasonStats.avgFantasyPoints > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFD700', fontSize: { xs: '1rem', md: '1.25rem' } }}>
                    {seasonStats.avgFantasyPoints.toFixed(1)}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: '#CCCCCC', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>FP</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Dashboard Section - Full Width Below with Tabs */}
        <Box sx={{ mt: 0, px: { xs: 2, sm: 0 } }}>
          <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as number)} sx={{ width: '100%' }}>
            <TabList
              sx={{
                mb: 2,
                overflowX: 'auto',
                bgcolor: '#000000',
                borderRadius: '8px',
                border: '1px solid #333333',
                p: '4px',
                gap: '4px',
                '& .MuiTab-root': {
                  color: '#999999',
                  fontWeight: 600,
                  fontSize: '13px',
                  letterSpacing: '0.02em',
                  borderRadius: '6px',
                  py: 1,
                  px: 2,
                  minHeight: '36px',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: '#FFFFFF',
                    bgcolor: 'rgba(255,255,255,0.06)',
                  },
                  '&.Mui-selected': {
                    color: '#FFFFFF',
                    bgcolor: '#1a1a1a',
                    border: '1px solid #333333',
                  },
                  '&::after': {
                    display: 'none',
                  },
                },
              }}
            >
              <Tab>Game Logs</Tab>
              <Tab>Props</Tab>
              <Tab>Stats</Tab>
              <Tab>Info</Tab>
              <Tab>Injuries</Tab>
              <Tab>Awards</Tab>
            </TabList>
            
            {/* Game Logs Tab */}
            {activeTab === 0 && (
              <Box>
                <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
                  <CardContent sx={{ bgcolor: '#000000' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                        Game Logs
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <IconButton
                        size="sm"
                        variant={gameLogsView === 'traditional' ? 'solid' : 'plain'}
                        color={gameLogsView === 'traditional' ? 'primary' : 'neutral'}
                        onClick={() => setGameLogsView('traditional')}
                        sx={{
                          minWidth: 'auto',
                          width: '28px',
                          height: '28px',
                          p: 0.5,
                          '& svg': { fontSize: '14px' },
                        }}
                        title="Traditional Stats"
                      >
                        <FaChartBar />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant={gameLogsView === 'advanced' ? 'solid' : 'plain'}
                        color={gameLogsView === 'advanced' ? 'primary' : 'neutral'}
                        onClick={() => setGameLogsView('advanced')}
                        disabled
                        sx={{
                          minWidth: 'auto',
                          width: '28px',
                          height: '28px',
                          p: 0.5,
                          opacity: 0.5,
                          '& svg': { fontSize: '14px' },
                        }}
                        title="Advanced Stats"
                      >
                        <FaChartLine />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant={gameLogsView === 'fantasy' ? 'solid' : 'plain'}
                        color={gameLogsView === 'fantasy' ? 'primary' : 'neutral'}
                        onClick={() => setGameLogsView('fantasy')}
                        disabled
                        sx={{
                          minWidth: 'auto',
                          width: '28px',
                          height: '28px',
                          p: 0.5,
                          opacity: 0.5,
                          '& svg': { fontSize: '14px' },
                        }}
                        title="Fantasy Stats"
                      >
                        <FaStar />
                      </IconButton>
                      <IconButton
                        size="sm"
                        variant={gameLogsView === 'props' ? 'solid' : 'plain'}
                        color={gameLogsView === 'props' ? 'primary' : 'neutral'}
                        onClick={() => setGameLogsView('props')}
                        disabled
                        sx={{
                          minWidth: 'auto',
                          width: '28px',
                          height: '28px',
                          p: 0.5,
                          opacity: 0.5,
                          '& svg': { fontSize: '14px' },
                        }}
                        title="Props Stats"
                      >
                        <FaClipboardList />
                      </IconButton>
                    </Stack>
                  </Box>
                  
                  {gameLogsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <LinearProgress sx={{ width: '100%' }} />
                    </Box>
                  ) : gameLogsData && gameLogsData.gameLogs.length > 0 ? (
                    <>
                      <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                        <Table hoverRow size="sm" sx={{ minWidth: 600, bgcolor: '#000000' }}>
                          <thead>
                            <tr>
                              <th style={{ color: '#FFFFFF', width: 28, minWidth: 28, padding: '6px 2px', textAlign: 'center' }} title="Awards"></th>
                              <th style={{ color: '#FFFFFF' }}>Date</th>
                              <th style={{ color: '#FFFFFF', width: 56, minWidth: 56 }}>Opponent</th>
                              <th style={{ color: '#FFFFFF' }}>Min</th>
                              <th style={{ color: '#FFFFFF' }}>Fantasy</th>
                              <th style={{ color: '#FFFFFF' }}>PTS</th>
                              <th style={{ color: '#FFFFFF' }}>REB</th>
                              <th style={{ color: '#FFFFFF' }}>AST</th>
                              <th style={{ color: '#FFFFFF' }}>STL</th>
                              <th style={{ color: '#FFFFFF' }}>BLK</th>
                              <th style={{ color: '#FFFFFF' }}>FG%</th>
                              <th style={{ color: '#FFFFFF' }}>3P%</th>
                              <th style={{ color: '#FFFFFF' }}>FT%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gameLogsData.gameLogs
                              .slice((gameLogsPage - 1) * gameLogsPageSize, gameLogsPage * gameLogsPageSize)
                              .map((game: any, index: number) => {
                              // Format date in EST (e.g., "11/2")
                              const formattedDate = formatESTDate(game.game_date, 'date');
                              
                              // Opponent tricode (team the player is playing against) — from game.opponent
                              const opponentTricode = game.opponent || '';

                              // Check if player didn't play
                              const didNotPlay = !game.played;
                              const dnpReason = game.dnp_reason || (didNotPlay ? 'DNP' : null);

                              const gameDate = game.game_date || '';
                            const hasTotn = awardLookups.isTotn(gameDate);

                            return (
                              <tr key={game.game_id || index}>
                                <td style={{ padding: '6px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                                  {hasTotn && <FaMoon style={{ fontSize: 11, color: '#C0C0C0' }} title="Team of the Night" />}
                                </td>
                                <td>
                                  <Typography 
                                    level="body-sm" 
                                    sx={{ 
                                      color: didNotPlay ? '#666666' : '#CCCCCC',
                                      cursor: 'pointer',
                                      '&:hover': {
                                        color: didNotPlay ? '#888888' : '#FFFFFF',
                                        textDecoration: 'underline',
                                      },
                                    }}
                                    onClick={() => handleGameLogClick(game.game_id)}
                                  >
                                    {formattedDate}
                                  </Typography>
                                </td>
                                <td style={{ width: 56, minWidth: 56, verticalAlign: 'middle' }}>
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    {!game.is_home && (
                                      <FaAt style={{ fontSize: 14, color: '#888888', flexShrink: 0 }} title="Away" />
                                    )}
                                    {opponentTricode ? (
                                      <Box
                                        component="img"
                                        src={getTeamLogoUrl(opponentTricode)}
                                        alt={opponentTricode}
                                        title={game.is_home ? `vs ${opponentTricode}` : `@ ${opponentTricode}`}
                                        onClick={() => handleGameLogClick(game.game_id)}
                                        sx={{
                                          height: 40,
                                          width: 'auto',
                                          maxWidth: 40,
                                          objectFit: 'contain',
                                          cursor: 'pointer',
                                          '&:hover': { opacity: 0.9 },
                                        }}
                                      />
                                    ) : (
                                      <Typography level="body-sm" sx={{ color: '#666666' }}>—</Typography>
                                    )}
                                    {dnpReason && (
                                      <Chip 
                                        size="sm" 
                                        variant="soft" 
                                        color="neutral"
                                        sx={{ 
                                          fontSize: '0.7rem',
                                          height: '18px',
                                          bgcolor: '#333333',
                                          color: '#CCCCCC',
                                        }}
                                      >
                                        {dnpReason}
                                      </Chip>
                                    )}
                                  </Stack>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ color: didNotPlay ? '#666666' : '#CCCCCC' }}>
                                    {game.min !== null && game.min !== undefined ? game.min : (didNotPlay ? '—' : 'N/A')}
                                  </Typography>
                                </td>
                                <td>
                                  {didNotPlay ? (
                                    <Typography level="body-sm" sx={{ color: '#666666' }}>—</Typography>
                                  ) : (
                                    <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'danger.500' }}>
                                      {(() => {
                                        // Calculate FanDuel fantasy points
                                        const fantasyPoints = calculateFantasyPoints({
                                          pts: game.pts || 0,
                                          reb: game.reb || 0,
                                          ast: game.ast || 0,
                                          stl: game.stl || 0,
                                          blk: game.blk || 0,
                                          tov: game.tov || 0,
                                        } as any, FANDUEL_SCORING);
                                        return fantasyPoints.toFixed(1);
                                      })()}
                                    </Typography>
                                  )}
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: didNotPlay ? 'normal' : 'bold', color: didNotPlay ? '#666666' : 'primary.500' }}>
                                    {game.pts !== null && game.pts !== undefined ? game.pts : (didNotPlay ? '—' : '0')}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: didNotPlay ? 'normal' : 'bold', color: didNotPlay ? '#666666' : 'success.500' }}>
                                    {game.reb !== null && game.reb !== undefined ? game.reb : (didNotPlay ? '—' : '0')}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ fontWeight: didNotPlay ? 'normal' : 'bold', color: didNotPlay ? '#666666' : 'warning.500' }}>
                                    {game.ast !== null && game.ast !== undefined ? game.ast : (didNotPlay ? '—' : '0')}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ color: didNotPlay ? '#666666' : '#CCCCCC' }}>
                                    {game.stl !== null && game.stl !== undefined ? game.stl : (didNotPlay ? '—' : '0')}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ color: didNotPlay ? '#666666' : '#CCCCCC' }}>
                                    {game.blk !== null && game.blk !== undefined ? game.blk : (didNotPlay ? '—' : '0')}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ color: didNotPlay ? '#666666' : '#CCCCCC' }}>
                                    {game.fg_pct !== null && game.fg_pct !== undefined ? formatGamePercentage(game.fg_pct) : (didNotPlay ? '—' : 'N/A')}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ color: didNotPlay ? '#666666' : '#CCCCCC' }}>
                                    {game.fg3_pct !== null && game.fg3_pct !== undefined ? formatGamePercentage(game.fg3_pct) : (didNotPlay ? '—' : 'N/A')}
                                  </Typography>
                                </td>
                                <td>
                                  <Typography level="body-sm" sx={{ color: didNotPlay ? '#666666' : '#CCCCCC' }}>
                                    {game.ft_pct !== null && game.ft_pct !== undefined ? formatGamePercentage(game.ft_pct) : (didNotPlay ? '—' : 'N/A')}
                                  </Typography>
                                </td>
                              </tr>
                            );
                            })}
                          </tbody>
                        </Table>
                      </Box>

                      {/* Pagination */}
                      {gameLogsData && gameLogsData.gameLogs.length > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                          <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                            Showing {((gameLogsPage - 1) * gameLogsPageSize) + 1} to {Math.min(gameLogsPage * gameLogsPageSize, gameLogsData.total || gameLogsData.gameLogs.length)} of {gameLogsData.total || gameLogsData.gameLogs.length} games
                          </Typography>
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              size="sm"
                              startDecorator={<NavigateBefore />}
                              onClick={() => setGameLogsPage(prev => Math.max(1, prev - 1))}
                              disabled={gameLogsPage === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outlined"
                              size="sm"
                              endDecorator={<NavigateNext />}
                              onClick={() => setGameLogsPage(prev => prev + 1)}
                              disabled={gameLogsPage * gameLogsPageSize >= (gameLogsData.total || gameLogsData.gameLogs.length)}
                            >
                              Next
                            </Button>
                          </Stack>
                        </Box>
                      )}
                    </>
                  ) : (
                    <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                      <Typography sx={{ color: '#FFFFFF' }}>No 2025-26 game logs available</Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
              </Box>
            )}
            
            {/* Props Tab - Grouped by Game */}
            {activeTab === 1 && (
              <Box>
                <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
                  <CardContent sx={{ bgcolor: '#000000' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                      <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                        Player Props
                      </Typography>
                    </Box>
                    
                    {propsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <LinearProgress sx={{ width: '100%' }} />
                      </Box>
                    ) : playerPropsData && playerPropsData.length > 0 ? (
                      <>
                        <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                          <Table hoverRow size="sm" sx={{ minWidth: 800, bgcolor: '#000000', tableLayout: 'fixed' }}>
                            <thead>
                              <tr>
                                <th style={{ color: '#FFFFFF', width: 56, minWidth: 56, textAlign: 'left' }}>Date</th>
                                <th style={{ color: '#FFFFFF', width: 56, minWidth: 56 }}>Opponent</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>PTS</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>REB</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>AST</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>STL</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>BLK</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>3PM</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>PRA</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>PR</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>PA</th>
                                <th style={{ color: '#FFFFFF', width: 52, minWidth: 52, textAlign: 'center' }}>RA</th>
                                <th style={{ color: '#FFFFFF', width: 68, minWidth: 68, textAlign: 'center' }}>Hit %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {playerPropsData
                                .slice((propsPage - 1) * propsPageSize, propsPage * propsPageSize)
                                .map((game: any, index: number) => {
                                  // Format date in EST (e.g., "11/2")
                                  const formattedDate = formatESTDate(game.game_date, 'date');

                                  // Opponent tricode (team the player is playing against) from matchup
                                  const matchupParts = game.matchup?.split(' @ ') || [];
                                  const awayTricode = matchupParts[0]?.trim();
                                  const homeTricode = matchupParts[1]?.trim();
                                  const opponentTricode = (playerData?.player?.team_abbreviation === awayTricode ? homeTricode : awayTricode) || '';
                                  const isAwayGame = playerData?.player?.team_abbreviation === awayTricode;

                                  // Helper: find prop by bet type. exactOnly = true for single-stat columns so
                                  // "points" doesn't match "points+rebounds" and "rebounds" doesn't match "points+rebounds".
                                  const findProp = (patterns: string[], exactOnly = false) => {
                                    for (const pattern of patterns) {
                                      const normalizedPattern = pattern.toLowerCase().trim().replace(/[\s_+]/g, '');
                                      const propResult = game.propResults.find((pr: any) => {
                                        let normalized = pr.prop.bet_type?.toLowerCase().trim().replace(/[\s_+]/g, '') || '';
                                        normalized = normalized.replace(/(over|under)$/i, '').trim();
                                        if (exactOnly) {
                                          return normalized === normalizedPattern;
                                        }
                                        return normalized === normalizedPattern ||
                                               normalized.includes(normalizedPattern) ||
                                               normalizedPattern.includes(normalized);
                                      });
                                      if (propResult) return propResult;
                                    }
                                    return null;
                                  };

                                  // Single-stat columns: exact match only so REB shows rebounds line, not PRA/PR
                                  const ptsProp = findProp(['points', 'pts'], true);
                                  const rebProp = findProp(['rebounds', 'reb'], true);
                                  const astProp = findProp(['assists', 'ast'], true);
                                  const stlProp = findProp(['steals', 'stl'], true);
                                  const blkProp = findProp(['blocks', 'blk'], true);
                                  const fg3mProp = findProp(['threepointersmade', 'three-pointers', '3pm', '3pt'], true);
                                  // Composite columns: allow partial match for combined bet types
                                  const praProp = findProp(['points+rebounds+assists', 'pointsreboundsassists']);
                                  const prProp = findProp(['points+rebounds', 'pointsrebounds']);
                                  const paProp = findProp(['points+assists', 'pointsassists']);
                                  const raProp = findProp(['rebounds+assists', 'reboundsassists']);
                                  
                                  // Helper to render prop cell (line + actual, centered)
                                  const renderPropCell = (propResult: any) => {
                                    if (!propResult || !propResult.prop) return (
                                      <Typography level="body-sm" sx={{ color: '#666666', textAlign: 'center' }}>—</Typography>
                                    );
                                    const { prop, result, hit } = propResult;
                                    const hasResult = result !== null && game.boxscore;
                                    return (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                                        <Typography
                                          level="body-sm"
                                          sx={{
                                            fontWeight: hasResult ? 'bold' : 'normal',
                                            color: hasResult ? (hit ? '#10B981' : '#EF4444') : '#CCCCCC',
                                            fontSize: '0.875rem',
                                            textAlign: 'center',
                                          }}
                                        >
                                          {prop.line != null ? Number(prop.line).toFixed(1) : '—'}
                                        </Typography>
                                        {hasResult && (
                                          <Typography level="body-xs" sx={{ color: '#888888', fontSize: '0.7rem', textAlign: 'center' }}>
                                            {result.actualValue.toFixed(1)}
                                          </Typography>
                                        )}
                                      </Box>
                                    );
                                  };
                                  
                                  const statCellSx = { textAlign: 'center' as const, verticalAlign: 'middle' };
                                  return (
                                    <tr key={`${game.event_id}-${game.game_date}-${index}`}>
                                      <td style={{ width: 56, minWidth: 56, textAlign: 'left', verticalAlign: 'middle' }}>
                                        <Typography 
                                          level="body-sm" 
                                          sx={{ 
                                            color: game.boxscore ? '#CCCCCC' : '#666666',
                                            cursor: game.boxscore ? 'pointer' : 'default',
                                            '&:hover': game.boxscore ? {
                                              color: '#FFFFFF',
                                              textDecoration: 'underline',
                                            } : {},
                                          }}
                                          onClick={() => game.boxscore && handleGameLogClick(game.boxscore.game_id)}
                                        >
                                          {formattedDate}
                                        </Typography>
                                      </td>
                                      <td style={{ width: 56, minWidth: 56, verticalAlign: 'middle' }}>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                          {isAwayGame && (
                                            <FaAt style={{ fontSize: 14, color: '#888888', flexShrink: 0 }} title="Away" />
                                          )}
                                          {opponentTricode ? (
                                            <Box
                                              component="img"
                                              src={getTeamLogoUrl(opponentTricode)}
                                              alt={opponentTricode}
                                              title={isAwayGame ? `@ ${opponentTricode}` : `vs ${opponentTricode}`}
                                              onClick={() => game.boxscore && handleGameLogClick(game.boxscore.game_id)}
                                              sx={{
                                                height: 40,
                                                width: 'auto',
                                                maxWidth: 40,
                                                objectFit: 'contain',
                                                cursor: game.boxscore ? 'pointer' : 'default',
                                                opacity: game.boxscore ? 1 : 0.6,
                                                '&:hover': game.boxscore ? { opacity: 0.9 } : {},
                                              }}
                                            />
                                          ) : (
                                            <Typography level="body-sm" sx={{ color: '#666666' }}>—</Typography>
                                          )}
                                        </Stack>
                                      </td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(ptsProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(rebProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(astProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(stlProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(blkProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(fg3mProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(praProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(prProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(paProp)}</td>
                                      <td style={{ width: 52, minWidth: 52, ...statCellSx }}>{renderPropCell(raProp)}</td>
                                      <td style={{ width: 68, minWidth: 68, ...statCellSx }}>
                                        {game.boxscore ? (
                                          <Typography 
                                            level="body-sm" 
                                            sx={{ 
                                              fontWeight: 'bold',
                                              color: game.hitRate >= 70 ? '#10B981' : game.hitRate >= 50 ? '#FFD700' : '#EF4444',
                                            }}
                                          >
                                            {game.hitRate.toFixed(0)}%
                                          </Typography>
                                        ) : (
                                          <Typography level="body-sm" sx={{ color: '#666666' }}>—</Typography>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </Table>
                        </Box>

                        {/* Pagination */}
                        {playerPropsData && playerPropsData.length > 0 && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                            <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                              Showing {((propsPage - 1) * propsPageSize) + 1} to {Math.min(propsPage * propsPageSize, playerPropsData.length)} of {playerPropsData.length} games
                            </Typography>
                            <Stack direction="row" spacing={1}>
                              <Button
                                variant="outlined"
                                size="sm"
                                startDecorator={<NavigateBefore />}
                                onClick={() => setPropsPage(prev => Math.max(1, prev - 1))}
                                disabled={propsPage === 1}
                              >
                                Previous
                              </Button>
                              <Button
                                variant="outlined"
                                size="sm"
                                endDecorator={<NavigateNext />}
                                onClick={() => setPropsPage(prev => prev + 1)}
                                disabled={propsPage * propsPageSize >= playerPropsData.length}
                              >
                                Next
                              </Button>
                            </Stack>
                          </Box>
                        )}
                      </>
                    ) : (
                      <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                        <Typography sx={{ color: '#FFFFFF' }}>
                          No props data available for this player.
                        </Typography>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Box>
            )}
            
            {/* Info Tab - General Information */}
            {activeTab === 3 && (
              <Box>
                <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
                  <CardContent sx={{ bgcolor: '#000000' }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 3 }}>
                      General Information
                    </Typography>
                    <Stack spacing={2}>
                      {playerData.player.height && (
                        <Box>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 0.5 }}>Height</Typography>
                          <Typography level="body-md" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                            {formatHeight(playerData.player.height)}
                            {playerData.player.weight && ` • ${playerData.player.weight} lbs`}
                          </Typography>
                        </Box>
                      )}
                      {playerData.player.college && (
                        <Box>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 0.5 }}>College</Typography>
                          <Typography level="body-md" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                            {playerData.player.college}
                          </Typography>
                        </Box>
                      )}
                      {playerData.player.draft_year && (
                        <Box>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 0.5 }}>Drafted</Typography>
                          <Typography level="body-md" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                            {playerData.player.draft_year} • Round {playerData.player.draft_round} • Pick {playerData.player.draft_number}
                          </Typography>
                        </Box>
                      )}
                      {playerData.player?.nba_hoopshype_salaries?.[0] && (
                        <Box>
                          <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 0.5 }}>Contract</Typography>
                          <Typography level="body-md" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                            {playerData.player.nba_hoopshype_salaries[0].contract_years_remaining || 0} years remaining
                            {playerData.player.nba_hoopshype_salaries[0].salary_2025_26 && (
                              <> • ${(playerData.player.nba_hoopshype_salaries[0].salary_2025_26 / 1000000).toFixed(1)}M this season</>
                            )}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            )}
            
            {/* Injuries Tab - Injury History */}
            {activeTab === 4 && (
              <Box>
                <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
                  <CardContent sx={{ bgcolor: '#000000' }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 3 }}>
                      Injury History
                    </Typography>
                    
                    {/* Current Injury */}
                    {playerData.latestInjury && playerData.latestInjury.is_current && (
                      <Box sx={{ mb: 3 }}>
                        <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 2, fontWeight: 'bold' }}>
                          Current Status
                        </Typography>
                        <Box sx={{ p: 2, bgcolor: '#1a1a1a', borderRadius: '8px', border: '1px solid #333333' }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <Chip
                              size="md"
                              variant="solid"
                              color={
                                playerData.latestInjury.injury_status === 'Out' ? 'danger' :
                                playerData.latestInjury.injury_status === 'Questionable' ? 'warning' :
                                playerData.latestInjury.injury_status === 'Day-to-Day' ? 'warning' :
                                'neutral'
                              }
                              sx={{
                                fontWeight: 'bold',
                              }}
                            >
                              {playerData.latestInjury.injury_status}
                            </Chip>
                            <Chip size="sm" variant="soft" color="primary">
                              Current
                            </Chip>
                          </Stack>
                          {playerData.latestInjury.injury_type && (
                            <Typography level="body-md" sx={{ color: '#FFFFFF', mb: 1 }}>
                              {playerData.latestInjury.injury_type.replace(/^Injury\/Illness\s*-\s*/i, '')}
                            </Typography>
                          )}
                          {playerData.latestInjury.injury_description && (
                            <Typography level="body-sm" sx={{ color: '#CCCCCC', mb: 1 }}>
                              {playerData.latestInjury.injury_description}
                            </Typography>
                          )}
                          {playerData.latestInjury.date_updated && (
                            <Typography level="body-xs" sx={{ color: '#999999', mt: 1 }}>
                              Updated: {new Date(playerData.latestInjury.date_updated).toLocaleDateString()}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    )}
                    
                    {/* Full Injury History - Linear Progress Timeline */}
                    {playerData.injuryHistory && playerData.injuryHistory.length > 0 ? (
                      <Box>
                        <Typography level="title-md" sx={{ color: '#FFFFFF', mb: 2, fontWeight: 'bold' }}>
                          History
                        </Typography>
                        {(() => {
                          // Sort by date (oldest first)
                          const sorted = [...playerData.injuryHistory].sort((a, b) => 
                            new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime()
                          );
                          
                          if (sorted.length === 0) return null;
                          
                          // Get date range - Fixed start: October 21, 2025, Dynamic end: Today
                          const firstDate = new Date('2025-10-21');
                          firstDate.setHours(0, 0, 0, 0);
                          const lastDate = new Date(); // Today's date
                          lastDate.setHours(23, 59, 59, 999);
                          const totalDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          
                          // Group consecutive injuries by status
                          const injurySegments: Array<{
                            status: string;
                            startDate: Date;
                            endDate: Date;
                            startPercent: number;
                            widthPercent: number;
                            injuryType?: string;
                            description?: string;
                          }> = [];
                          
                          let currentSegment: any = null;
                          
                          sorted.forEach((injury, index) => {
                            const injuryDate = new Date(injury.date_updated);
                            injuryDate.setHours(0, 0, 0, 0);
                            const status = injury.injury_status || 'Healthy';
                            
                            // Normalize status names
                            const normalizedStatus = 
                              status === 'Day-to-Day' ? 'Questionable' :
                              status === 'Out' ? 'Out' :
                              status === 'Questionable' ? 'Questionable' :
                              status === 'Probable' ? 'Probable' :
                              'Healthy';
                            
                            if (!currentSegment || currentSegment.status !== normalizedStatus) {
                              // Start new segment
                              if (currentSegment) {
                                injurySegments.push(currentSegment);
                              }
                              currentSegment = {
                                status: normalizedStatus,
                                startDate: injuryDate,
                                endDate: injuryDate,
                                injuryType: injury.injury_type,
                                description: injury.injury_description,
                              };
                            } else {
                              // Extend current segment
                              currentSegment.endDate = injuryDate;
                            }
                          });
                          
                          // Add last segment
                          if (currentSegment) {
                            injurySegments.push(currentSegment);
                          }
                          
                          // Fill gaps with "Healthy" segments to create complete timeline
                          const allSegments: Array<{
                            status: string;
                            startDate: Date;
                            endDate: Date;
                            startPercent: number;
                            widthPercent: number;
                            injuryType?: string;
                            description?: string;
                          }> = [];
                          
                          // Sort injury segments by date
                          injurySegments.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
                          
                          let currentDate = new Date(firstDate);
                          
                          // Process each injury segment and fill gaps
                          injurySegments.forEach((injurySegment, idx) => {
                            const segmentStart = new Date(injurySegment.startDate);
                            segmentStart.setHours(0, 0, 0, 0);
                            
                            // If there's a gap before this injury, fill with Healthy
                            if (currentDate.getTime() < segmentStart.getTime()) {
                              const gapStart = new Date(currentDate);
                              const gapEnd = new Date(segmentStart);
                              gapEnd.setDate(gapEnd.getDate() - 1);
                              
                              if (gapStart.getTime() <= gapEnd.getTime()) {
                                const gapDays = Math.ceil((gapEnd.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                const gapStartDays = Math.ceil((gapStart.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
                                const gapEndDays = Math.ceil((gapEnd.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
                                
                                allSegments.push({
                                  status: 'Healthy',
                                  startDate: gapStart,
                                  endDate: gapEnd,
                                  startPercent: (gapStartDays / totalDays) * 100,
                                  widthPercent: (gapDays / totalDays) * 100,
                                });
                              }
                            }
                            
                            // Add the injury segment
                            const segmentStartDays = Math.ceil((segmentStart.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
                            const segmentEnd = new Date(injurySegment.endDate);
                            segmentEnd.setHours(23, 59, 59, 999);
                            const segmentEndDays = Math.ceil((segmentEnd.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
                            const segmentDays = segmentEndDays - segmentStartDays + 1;
                            
                            allSegments.push({
                              ...injurySegment,
                              startPercent: (segmentStartDays / totalDays) * 100,
                              widthPercent: (segmentDays / totalDays) * 100,
                            });
                            
                            // Update currentDate to after this segment
                            currentDate = new Date(segmentEnd);
                            currentDate.setDate(currentDate.getDate() + 1);
                            currentDate.setHours(0, 0, 0, 0);
                          });
                          
                          // Fill gap from last injury to today (if any)
                          if (currentDate.getTime() <= lastDate.getTime()) {
                            const finalGapStart = new Date(currentDate);
                            const finalGapEnd = new Date(lastDate);
                            
                            const gapDays = Math.ceil((finalGapEnd.getTime() - finalGapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            const gapStartDays = Math.ceil((finalGapStart.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
                            
                            allSegments.push({
                              status: 'Healthy',
                              startDate: finalGapStart,
                              endDate: finalGapEnd,
                              startPercent: (gapStartDays / totalDays) * 100,
                              widthPercent: (gapDays / totalDays) * 100,
                            });
                          }
                          
                          // If no injuries at all, fill entire timeline with Healthy
                          if (allSegments.length === 0) {
                            allSegments.push({
                              status: 'Healthy',
                              startDate: firstDate,
                              endDate: lastDate,
                              startPercent: 0,
                              widthPercent: 100,
                            });
                          }
                          
                          // Sort all segments by start date
                          allSegments.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
                          
                          // Get color for status
                          const getStatusColor = (status: string): string => {
                            switch (status) {
                              case 'Healthy': return '#10B981'; // Green
                              case 'Out': return '#EF4444'; // Red
                              case 'Probable': return '#FFC72C'; // Yellow
                              case 'Questionable': return '#FF6B35'; // Orange
                              default: return '#666666'; // Gray
                            }
                          };
                          
                          // Generate date markers (every ~30 days or at segment boundaries)
                          const dateMarkers: Array<{ date: Date; percent: number }> = [];
                          
                          // Add markers at segment boundaries
                          allSegments.forEach((segment, idx) => {
                            // Add marker at start of segment
                            dateMarkers.push({
                              date: new Date(segment.startDate),
                              percent: segment.startPercent,
                            });
                            
                            // Add marker at end of segment (if it's the last one)
                            if (idx === allSegments.length - 1) {
                              dateMarkers.push({
                                date: new Date(segment.endDate),
                                percent: segment.startPercent + segment.widthPercent,
                              });
                            }
                          });
                          
                          // Add markers every ~30 days for better visibility
                          const markerInterval = 30; // days
                          let markerDate = new Date(firstDate);
                          while (markerDate.getTime() <= lastDate.getTime()) {
                            const daysFromStart = Math.ceil((markerDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
                            const percent = (daysFromStart / totalDays) * 100;
                            
                            // Only add if not too close to existing markers (within 2%)
                            const tooClose = dateMarkers.some(m => Math.abs(m.percent - percent) < 2);
                            if (!tooClose && percent >= 0 && percent <= 100) {
                              dateMarkers.push({
                                date: new Date(markerDate),
                                percent,
                              });
                            }
                            
                            markerDate.setDate(markerDate.getDate() + markerInterval);
                          }
                          
                          // Sort markers by percent and remove duplicates
                          dateMarkers.sort((a, b) => a.percent - b.percent);
                          const uniqueMarkers = dateMarkers.filter((marker, idx, arr) => {
                            if (idx === 0) return true;
                            return Math.abs(marker.percent - arr[idx - 1].percent) >= 2;
                          });
                          
                          return (
                            <Box>
                              {/* Timeline Progress Bar */}
                              <Box sx={{ position: 'relative', width: '100%', height: 32, mb: 2 }}>
                                {/* Segments */}
                                {allSegments.map((segment, idx) => (
                                  <Box
                                    key={`segment-${idx}`}
                                    sx={{
                                      position: 'absolute',
                                      left: `${segment.startPercent}%`,
                                      width: `${segment.widthPercent}%`,
                                      height: '100%',
                                      bgcolor: getStatusColor(segment.status),
                                      borderRadius: idx === 0 ? '4px 0 0 4px' : idx === allSegments.length - 1 ? '0 4px 4px 0' : '0',
                                    }}
                                    title={`${segment.status}: ${segment.startDate.toLocaleDateString()} - ${segment.endDate.toLocaleDateString()}`}
                                  />
                                ))}
                                
                                {/* Date Markers */}
                                {uniqueMarkers.map((marker, idx) => {
                                  const month = marker.date.getMonth() + 1;
                                  const day = marker.date.getDate();
                                  const dateText = `${month}/${day}`;
                                  
                                  return (
                                    <Box
                                      key={`marker-${idx}`}
                                      sx={{
                                        position: 'absolute',
                                        left: `${marker.percent}%`,
                                        bottom: '100%',
                                        transform: 'translateX(-50%)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        zIndex: 10,
                                        mb: 0.5,
                                      }}
                                    >
                                      {/* Date text - positioned above the bar */}
                                      <Typography
                                        sx={{
                                          color: '#FFFFFF',
                                          fontSize: '0.65rem',
                                          fontWeight: 600,
                                          whiteSpace: 'nowrap',
                                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
                                          mb: 0.25,
                                        }}
                                      >
                                        {dateText}
                                      </Typography>
                                      {/* Vertical line extending down into the bar */}
                                      <Box
                                        sx={{
                                          width: '1px',
                                          height: '8px',
                                          bgcolor: 'rgba(255, 255, 255, 0.3)',
                                        }}
                                      />
                                    </Box>
                                  );
                                })}
                              </Box>
                              
                              {/* Legend */}
                              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mb: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ width: 16, height: 16, bgcolor: '#10B981', borderRadius: '2px' }} />
                                  <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>Healthy</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ width: 16, height: 16, bgcolor: '#FFC72C', borderRadius: '2px' }} />
                                  <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>Probable</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ width: 16, height: 16, bgcolor: '#FF6B35', borderRadius: '2px' }} />
                                  <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>Questionable</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ width: 16, height: 16, bgcolor: '#EF4444', borderRadius: '2px' }} />
                                  <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>Out</Typography>
                                </Box>
                              </Stack>
                              
                              {/* Date Range - Fixed start, dynamic end (today) */}
                              <Typography level="body-xs" sx={{ color: '#666666' }}>
                                October 21, 2025 - {lastDate.toLocaleDateString()}
                              </Typography>
                            </Box>
                          );
                        })()}
                      </Box>
                    ) : !playerData.latestInjury ? (
                      <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                        <Typography sx={{ color: '#FFFFFF' }}>
                          No injury information available.
                        </Typography>
                      </Alert>
                    ) : null}
                  </CardContent>
                </Card>
              </Box>
            )}
            
            {/* Stats Tab - Advanced Stats */}
            {activeTab === 2 && (
              <Box>
          {/* Advanced Stats Section */}
          <Box sx={{ mb: 4 }}>
              <Box sx={{ bgcolor: '#000000' }}>
                {/* Performance Trends Chart */}
                <Box sx={{ mb: 3 }}>
                  <PlayerPerformanceTrends
                    playerId={playerId}
                    seasonYear={selectedSeason}
                    teamAbbreviation={playerData.player.team_abbreviation}
                  />
                </Box>

                {/* Main Charts Grid - Radial Chart on Left, Column Charts on Right */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {/* Radar Chart - Left Side */}
                  <Grid xs={12} md={8}>
                    <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', height: 512 }}>
                      <CardContent sx={{ height: '100%', p: 0 }}>
                        <AdvancedMetricsRadarChart 
                          playerId={playerId} 
                          seasonYear={selectedSeason}
                          teamAbbreviation={playerData.player.team_abbreviation}
                          playerPosition={playerData.player.position}
                        />
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* Column Charts - Right Side: Pace, Minutes, Fantasy Points */}
                  <Grid xs={12} md={4}>
                    <Stack spacing={2} sx={{ height: 512 }}>
                      {/* Pace Chart */}
                      <Box sx={{ height: 160, width: '100%', overflow: 'hidden' }}>
                        <PaceGaugeChart 
                          playerId={playerId} 
                          seasonYear={selectedSeason}
                          teamAbbreviation={playerData.player.team_abbreviation}
                        />
                      </Box>

                      {/* Minutes Chart */}
                      <Box sx={{ height: 160, width: '100%', overflow: 'hidden' }}>
                        <MinutesLineChart 
                          playerId={playerId} 
                          seasonYear={selectedSeason}
                          teamAbbreviation={playerData.player.team_abbreviation}
                        />
                      </Box>

                      {/* Fantasy Points Chart */}
                      <Box sx={{ height: 160, width: '100%', overflow: 'hidden' }}>
                        <FantasyPointsLineChart 
                          playerId={playerId} 
                          seasonYear={selectedSeason}
                          teamAbbreviation={playerData.player.team_abbreviation}
                        />
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>

                {/* Four Factors Bar Chart - Full Width Below */}
                <Box sx={{ mb: 3 }}>
                  <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                          <CardContent>
                            <FourFactorsBarChart 
                              playerId={playerId} 
                              seasonYear={selectedSeason}
                              teamAbbreviation={playerData.player.team_abbreviation}
                            />
                          </CardContent>
                        </Card>
                </Box>

                {/* Usage & Efficiency Scatter Plot - Full Width Below */}
                <Box sx={{ mb: 3 }}>
                <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                  <CardContent>
                      <UsageEfficiencyScatterChart 
                      playerId={playerId} 
                      seasonYear={selectedSeason}
                      teamAbbreviation={playerData.player.team_abbreviation}
                    />
                  </CardContent>
                </Card>
              </Box>

            </Box>
          </Box>
              </Box>
            )}

            {/* Awards Tab */}
            {activeTab === 5 && (
              <Box>
                <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
                  <CardContent sx={{ bgcolor: '#000000' }}>
                    <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF', mb: 3 }}>
                      Awards &amp; Accolades
                    </Typography>

                    {awardsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <LinearProgress sx={{ width: '100%' }} />
                      </Box>
                    ) : !awardsData || (awardsData.pow.length === 0 && awardsData.pom.length === 0 && awardsData.totn.length === 0 && awardsData.totw.length === 0) ? (
                      <Typography level="body-sm" sx={{ color: '#999999', textAlign: 'center', py: 4 }}>
                        No awards or accolades recorded yet.
                      </Typography>
                    ) : (
                      <Stack spacing={3}>
                        {/* Player of the Month */}
                        {awardsData.pom.length > 0 && (
                          <Box>
                            <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 1.5 }}>
                              Player of the Month
                            </Typography>
                            <Box sx={{ overflowX: 'auto' }}>
                              <Table size="sm" sx={{ minWidth: 400, bgcolor: '#000000' }}>
                                <thead>
                                  <tr>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Season</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Month</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Conference</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Tie</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {awardsData.pom.map((a) => (
                                    <tr key={a.id}>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>{a.season}</td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>
                                        {new Date(a.award_year, a.award_month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                      </td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>{a.conference === 'E' ? 'Eastern' : a.conference === 'W' ? 'Western' : '—'}</td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>{a.is_tie ? 'Yes' : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </Box>
                          </Box>
                        )}

                        {/* Player of the Week */}
                        {awardsData.pow.length > 0 && (
                          <Box>
                            <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 1.5 }}>
                              Player of the Week
                            </Typography>
                            <Box sx={{ overflowX: 'auto' }}>
                              <Table size="sm" sx={{ minWidth: 400, bgcolor: '#000000' }}>
                                <thead>
                                  <tr>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Season</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Week Of</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Conference</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Tie</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {awardsData.pow.map((a) => (
                                    <tr key={a.id}>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>{a.season}</td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>
                                        {new Date(a.week_start_date + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>{a.conference === 'E' ? 'Eastern' : a.conference === 'W' ? 'Western' : '—'}</td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>{a.is_tie ? 'Yes' : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </Box>
                          </Box>
                        )}

                        {/* Team of the Night appearances */}
                        {awardsData.totn.length > 0 && (
                          <Box>
                            <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 1.5 }}>
                              Team of the Night ({awardsData.totn.length})
                            </Typography>
                            <Box sx={{ overflowX: 'auto' }}>
                              <Table size="sm" sx={{ minWidth: 500, bgcolor: '#000000' }}>
                                <thead>
                                  <tr>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Date</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Role</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333', textAlign: 'right' }}>FP</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333', textAlign: 'right' }}>Salary</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {awardsData.totn.map((a) => (
                                    <tr
                                      key={a.game_date + a.slot}
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => setLineupModal({ open: true, type: 'totn', gameDate: a.game_date })}
                                    >
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>
                                        {new Date(a.game_date + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>
                                        {a.slot.startsWith('s') ? 'Starter' : 'Bench'}
                                      </td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a', textAlign: 'right' }}>{a.fantasy_points.toFixed(1)}</td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a', textAlign: 'right' }}>${a.salary.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </Box>
                          </Box>
                        )}

                        {/* Team of the Week appearances */}
                        {awardsData.totw.length > 0 && (
                          <Box>
                            <Typography level="title-md" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 1.5 }}>
                              Team of the Week ({awardsData.totw.length})
                            </Typography>
                            <Box sx={{ overflowX: 'auto' }}>
                              <Table size="sm" sx={{ minWidth: 600, bgcolor: '#000000' }}>
                                <thead>
                                  <tr>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Week</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Dates</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333' }}>Role</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333', textAlign: 'right' }}>Avg FP</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333', textAlign: 'right' }}>GP</th>
                                    <th style={{ color: '#FFFFFF', borderBottom: '1px solid #333333', textAlign: 'right' }}>Salary</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {awardsData.totw.map((a) => (
                                    <tr
                                      key={a.week_start + a.slot}
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => setLineupModal({ open: true, type: 'totw', weekStart: a.week_start, weekEnd: a.week_end, weekNumber: a.week_number })}
                                    >
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>Wk {a.week_number}</td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>
                                        {new Date(a.week_start + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' })} – {new Date(a.week_end + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                                      </td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a' }}>
                                        {a.slot.startsWith('s') ? 'Starter' : 'Bench'}
                                      </td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a', textAlign: 'right' }}>{a.avg_fantasy_points.toFixed(1)}</td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a', textAlign: 'right' }}>{a.games_played}</td>
                                      <td style={{ color: '#CCCCCC', borderBottom: '1px solid #1a1a1a', textAlign: 'right' }}>${a.salary.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </Box>
                          </Box>
                        )}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Box>
            )}
          </Tabs>
        </Box>

        {/* Team Lineup Modal (TOTN / TOTW) */}
        <TeamLineupModal
          open={lineupModal.open}
          onClose={() => setLineupModal(prev => ({ ...prev, open: false }))}
          type={lineupModal.type}
          gameDate={lineupModal.gameDate}
          weekStart={lineupModal.weekStart}
          weekEnd={lineupModal.weekEnd}
          weekNumber={lineupModal.weekNumber}
          highlightPlayerId={playerId}
        />

        {/* Image Modal */}
        <Modal open={imageModal} onClose={() => setImageModal(false)}>
          <ModalDialog
            sx={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              p: 0,
              bgcolor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ModalClose sx={{ color: 'white', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }} />
            {!imageError ? (
              <Box
                component="img"
                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerData.player.nba_player_id}.png`}
                alt={playerData.player.name}
                onError={() => setImageError(true)}
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  borderRadius: 'md',
                }}
              />
            ) : (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Avatar
                  size="lg"
                  sx={{ 
                    width: 300, 
                    height: 300,
                    fontSize: '4rem',
                    bgcolor: 'primary.500',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  {playerData.player.name.split(' ').map((n: string) => n[0]).join('')}
                </Avatar>
                <Typography level="h4" sx={{ color: 'white' }}>
                  {playerData.player.name}
                </Typography>
              </Box>
            )}
          </ModalDialog>
        </Modal>
      </Box>

      {/* Snackbar for game highlight not found */}
      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        color="warning"
        variant="soft"
        sx={{
          bgcolor: '#1a1a1a',
          border: '1px solid #333333',
        }}
      >
        Game highlight not found
      </Snackbar>
    </Box>
  );
}

// Key Metrics Cards Component
function KeyMetricsCards({ playerId, seasonYear, teamAbbreviation }: { playerId: string; seasonYear?: string; teamAbbreviation?: string }) {
  const { data: statsData, isLoading: statsLoading } = usePlayerGameStats(playerId, seasonYear);
  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#4CAF50';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#FFC72C';

  // Fetch boxscore data for minutes and fantasy points calculation
  const { data: boxscoreData, isLoading: boxscoreLoading } = useQuery({
    queryKey: ['player-boxscore-avg', playerId, seasonYear],
    queryFn: async () => {
      let query = supabase
        .from('nba_boxscores')
        .select('pts, reb, ast, stl, blk, tov, min')
        .eq('player_id', playerId);
      
      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }

      const { data, error } = await query.order('game_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });

  const isLoading = statsLoading || boxscoreLoading;

  // Get pace and true shooting from advanced stats
  const pace = statsData?.seasonAverages?.advanced_pace || null;
  const ts = statsData?.seasonAverages?.advanced_trueshootingpercentage || null;
  const LEAGUE_PACE_AVG = 100;

  // Calculate average minutes and fantasy points from boxscores
  const avgMinutes = boxscoreData && boxscoreData.length > 0
    ? boxscoreData.reduce((sum, game) => {
        // Handle minutes format: could be "36:00" string or number
        let min = 0;
        if (typeof game.min === 'string' && game.min.includes(':')) {
          const [mins, secs] = game.min.split(':').map(Number);
          min = mins + (secs / 60);
        } else {
          min = parseFloat(String(game.min || 0));
        }
        return sum + min;
      }, 0) / boxscoreData.length
    : null;

  const avgFantasyPoints = boxscoreData && boxscoreData.length > 0
    ? boxscoreData.reduce((sum, game) => {
        const fp = calculateFantasyPoints({
          pts: Number(game.pts) || 0,
          reb: Number(game.reb) || 0,
          ast: Number(game.ast) || 0,
          stl: Number(game.stl) || 0,
          blk: Number(game.blk) || 0,
          tov: Number(game.tov) || 0,
        }, FANDUEL_SCORING);
        return sum + fp;
      }, 0) / boxscoreData.length
    : null;

  return (
    <Grid container spacing={2}>
      {/* Pace */}
      <Grid xs={6} md={3}>
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 1 }}>
              Pace
            </Typography>
            <Typography level="body-xs" sx={{ color: secondaryColor, mb: 0.5, fontSize: '0.7rem' }}>
              Lg: {LEAGUE_PACE_AVG.toFixed(1)}
            </Typography>
            <Typography level="h2" sx={{ fontWeight: 'bold', color: primaryColor }}>
              {isLoading ? '...' : pace !== null ? pace.toFixed(1) : 'N/A'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Minutes */}
      <Grid xs={6} md={3}>
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 1 }}>
              Minutes
            </Typography>
            <Typography level="h2" sx={{ fontWeight: 'bold', color: primaryColor }}>
              {isLoading ? '...' : avgMinutes !== null ? avgMinutes.toFixed(1) : 'N/A'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Fantasy Points */}
      <Grid xs={6} md={3}>
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 1 }}>
              Fantasy Pts
            </Typography>
            <Typography level="h2" sx={{ fontWeight: 'bold', color: primaryColor }}>
              {isLoading ? '...' : avgFantasyPoints !== null ? avgFantasyPoints.toFixed(1) : 'N/A'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* True Shooting %} */}
      <Grid xs={6} md={3}>
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 1 }}>
              True Shooting %
            </Typography>
            <Typography level="h2" sx={{ fontWeight: 'bold', color: primaryColor }}>
              {isLoading ? '...' : ts !== null ? `${(ts * 100).toFixed(1)}%` : 'N/A'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

