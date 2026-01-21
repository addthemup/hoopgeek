import { Box, Typography, Sheet, IconButton } from '@mui/joy';
import { usePlayerProps } from '../hooks/usePlayerProps';
import { usePlayerPreviousGameProps } from '../hooks/usePlayerPreviousGameProps';
import { useParams } from 'react-router-dom';
import { PlayerProp } from '../utils/sportsGameOdds';
import { getTeamColors } from '../utils/nbaTeamColors';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { hexToRgba } from './MarginBars';
import { getDataRowStyles, headerRowStyles } from '../utils/marginbarsStyles';
import { AnimatePresence } from 'framer-motion';
import SplitFlapRow from './SplitFlapRow';
import SplitFlapText from './SplitFlapText';
import { FANDUEL_SCORING } from '../utils/fantasyScoring';
import { MARGIN_BAR_STYLES } from './MarginBars';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { calculatePropResult } from '../utils/playerPropsCalculator';

interface MarginPlayerPropsProps {
  playerId: string;
  playerName: string;
  position: 'left' | 'right';
}

interface PropCategory {
  betType: string;
  displayName: string;
  line: number | null;
  odds: string;
  overUnder: string | null;
  actualValue?: number;
  hit?: boolean;
  result?: 'over' | 'under' | 'push';
}

export default function MarginPlayerProps({ playerId, playerName, position }: MarginPlayerPropsProps) {
  // Use usePlayerProps which directly queries player_props and works correctly
  const { data: playerPropsData, isLoading } = usePlayerProps(playerId, playerName);
  const { data: previousGameData, isLoading: previousGameLoading } = usePlayerPreviousGameProps(playerId, playerName);
  const rowHeight = 'calc((100vh - 40px) / 16)';
  // Default to props view - show props first
  const [viewMode, setViewMode] = useState<'props' | 'gameLog'>('props');
  const [selectedGameLogId, setSelectedGameLogId] = useState<string | null>(null);

  // Get team colors from playerPropsData
  const teamAbbreviation = playerPropsData?.teamTricode;
  const teamColors = teamAbbreviation 
    ? getTeamColors(teamAbbreviation)
    : { primary: '#666666', secondary: '#999999' };

  // Format bet type name (must be defined before queries that use it)
  const formatBetType = (betType: string): string => {
    const betTypeMap: Record<string, string> = {
      'points': 'PTS',
      'point': 'PTS',
      'pts': 'PTS',
      'rebounds': 'REB',
      'rebound': 'REB',
      'reb': 'REB',
      'assists': 'AST',
      'assist': 'AST',
      'ast': 'AST',
      'steals': 'STL',
      'steal': 'STL',
      'stl': 'STL',
      'blocks': 'BLK',
      'block': 'BLK',
      'blk': 'BLK',
      'threes': '3PM',
      'three': '3PM',
      '3pt': '3PM',
      '3-pointer': '3PM',
      '3pm': '3PM',
      'threepointersmade': '3PM',
      'three_pointers_made': '3PM',
      'three-pointers-made': '3PM',
      'turnovers': 'TOV',
      'turnover': 'TOV',
      'tov': 'TOV',
      'points_rebounds': 'PTS+REB',
      'points_assists': 'PTS+AST',
      'rebounds_assists': 'REB+AST',
      'points_rebounds_assists': 'PAR',
      // Handle combined props with various naming conventions (case-insensitive)
      'blocks+steals': 'STOCKS',
      'blocks_steals': 'STOCKS',
      'steals+blocks': 'STOCKS',
      'steals_blocks': 'STOCKS',
      'stocks': 'STOCKS',
      'points+assists': 'PTS+AST',
      'points+rebounds': 'PTS+REB',
      'points+rebounds+assists': 'PAR',
      'rebounds+assists': 'REB+AST',
      // Handle uppercase versions from API
      'BLOCKS+STEALS': 'STOCKS',
      'POINTS+ASSISTS': 'PTS+AST',
      'POINTS+REBOUNDS': 'PTS+REB',
      'POINTS+REBOUNDS+ASSISTS': 'PAR',
      'REBOUNDS+ASSISTS': 'REB+AST',
    };
    
    // Normalize: lowercase, remove spaces
    const normalized = betType.toLowerCase().replace(/\s+/g, '');
    // Check normalized first, then original (for uppercase), then return uppercase
    return betTypeMap[normalized] || betTypeMap[betType] || betType.toUpperCase();
  };

  // Get player's nba_player_id for stats queries (must be defined before other queries that use it)
  const { data: playerInfo } = useQuery({
    queryKey: ['player-info-for-stats', playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_players')
        .select('nba_player_id, team_abbreviation')
        .eq('id', playerId)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!playerId,
  });

  // Fetch game logs for 2025-26 season (always fetch, we'll decide what to show)
  const { data: gameLogsData, isLoading: gameLogsLoading } = useQuery({
    queryKey: ['player-game-logs-margin', playerId, '2025-26'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('*')
        .eq('player_id', playerId)
        .eq('season_year', '2025-26')
        .gt('game_date', '2025-10-20') // Exclude preseason
        .gt('min', 0) // Only games where player played
        .order('game_date', { ascending: false })
        .limit(15); // Limit to 15 most recent games
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });

  // Fetch props for selected game log
  const { data: selectedGameProps } = useQuery({
    queryKey: ['selected-game-props', selectedGameLogId, playerId, playerName],
    queryFn: async () => {
      if (!selectedGameLogId || !playerInfo?.nba_player_id) return null;
      
      // Get boxscore stats for this game first
      const { data: boxscore } = await supabase
        .from('nba_boxscores')
        .select('pts, reb, ast, stl, blk, tov, fg3m, ftm, game_date, game_id')
        .eq('game_id', selectedGameLogId)
        .eq('nba_player_id', playerInfo.nba_player_id)
        .maybeSingle();
      
      if (!boxscore || !boxscore.game_date) return null;
      
      // Find props for this game by matching game_date
      const gameDate = boxscore.game_date.split('T')[0]; // Get date part only
      const { data: propsData, error } = await supabase
        .from('player_props')
        .select(`
          *,
          player_props_games!inner (
            id,
            event_id,
            game_date,
            home_team_tricode,
            away_team_tricode
          )
        `)
        .or(`player_id.eq.${playerId},nba_player_id.eq.${playerInfo.nba_player_id},player_name.ilike.%${playerName}%`)
        .eq('game_date', gameDate)
        .order('bet_type', { ascending: true });
      
      if (error || !propsData || propsData.length === 0) return null;
      
      // Calculate hit rate - need to determine over/under from bet_type_id or raw_odd_data
      const propResults = propsData.map(prop => {
        const result = calculatePropResult(prop.bet_type, prop.line, boxscore);
        
        // Determine if this is an over or under prop
        const betTypeId = (prop as any).bet_type_id || '';
        const rawData = (prop as any).raw_odd_data || {};
        let overUnder = 'O';
        
        if (betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over')) {
          overUnder = 'O';
        } else if (betTypeId.includes('-under') || betTypeId.endsWith('under') || betTypeId.toLowerCase().includes('under')) {
          overUnder = 'U';
        } else if (rawData.overUnder) {
          overUnder = rawData.overUnder === 'over' || rawData.overUnder === 'Over' || rawData.overUnder === 'O' ? 'O' : 'U';
        }
        
        // Determine if this was a hit
        // Over = hit if actual > line, Under = hit if actual < line
        const hit = overUnder === 'O' 
          ? (result?.result === 'over')
          : (result?.result === 'under');
        
        return {
          betType: prop.bet_type,
          displayName: formatBetType(prop.bet_type),
          line: prop.line,
          overUnder,
          actualValue: result?.actualValue || 0,
          hit,
          result: result?.result || 'under',
        };
      });
      
      const hits = propResults.filter(r => r.hit).length;
      const total = propResults.length;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;
      
      return {
        propResults,
        hits,
        total,
        hitRate,
      };
    },
    enabled: !!selectedGameLogId && !!playerInfo?.nba_player_id,
  });

  // Check for game stats - first in nba_boxscores, then live_player_stats
  // Match by team tricodes from the game object
  const { data: todayGameStats } = useQuery({
    queryKey: ['game-stats-for-props', playerId, playerInfo?.nba_player_id, playerPropsData?.game],
    queryFn: async () => {
      if (!playerPropsData?.game || !playerInfo?.nba_player_id) return { stats: null, nbaGame: null };
      
      const game = playerPropsData.game;
      const homeTeamTricode = game.homeTeamTricode || game.homeTeam;
      const awayTeamTricode = game.awayTeamTricode || game.awayTeam;
      
      if (!homeTeamTricode || !awayTeamTricode) {
        console.log('⚠️ Missing team tricodes in game object');
        return { stats: null, nbaGame: null };
      }
      
      let nbaGameId = null;
      let nbaGame = null;
      
      // Get game date from startsAt or use today
      const gameDate = game.startsAt ? new Date(game.startsAt) : new Date();
      const startOfDay = new Date(gameDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      // Find matching nba_game by teams and date
      const { data: nbaGames } = await supabase
        .from('nba_games')
        .select('game_id, home_team_tricode, away_team_tricode, game_date, game_status_text')
        .gte('game_date', startOfDay.toISOString())
        .lt('game_date', endOfDay.toISOString())
        .or(`home_team_tricode.eq.${homeTeamTricode},away_team_tricode.eq.${homeTeamTricode},home_team_tricode.eq.${awayTeamTricode},away_team_tricode.eq.${awayTeamTricode}`);
      
      // Find the matching game by both teams
      if (nbaGames && nbaGames.length > 0) {
        const matchingGame = nbaGames.find(g => 
          (g.home_team_tricode === homeTeamTricode && g.away_team_tricode === awayTeamTricode) ||
          (g.home_team_tricode === awayTeamTricode && g.away_team_tricode === homeTeamTricode)
        );
        
        if (matchingGame) {
          nbaGameId = matchingGame.game_id;
          nbaGame = matchingGame;
        } else if (nbaGames.length === 1) {
          // Only one game found, use it
          nbaGameId = nbaGames[0].game_id;
          nbaGame = nbaGames[0];
        }
      }
      
      // First check nba_boxscores by game_id if we have it
      if (nbaGameId) {
        const { data: boxscore, error: boxscoreError } = await supabase
          .from('nba_boxscores')
          .select('pts, reb, ast, stl, blk, tov, fg3m, ftm, game_id, game_date')
          .eq('nba_player_id', playerInfo.nba_player_id)
          .eq('game_id', nbaGameId)
          .maybeSingle();
        
        if (!boxscoreError && boxscore) {
          return {
            stats: {
              source: 'boxscore',
              stats: {
                pts: boxscore.pts || 0,
                reb: boxscore.reb || 0,
                ast: boxscore.ast || 0,
                stl: boxscore.stl || 0,
                blk: boxscore.blk || 0,
                tov: boxscore.tov || 0,
                fg3m: boxscore.fg3m || 0,
                ftm: boxscore.ftm || 0,
              },
            },
            nbaGame,
          };
        }
      }
      
      // If not in boxscores, check live_player_stats by game_id
      if (nbaGameId) {
        console.log('🔍 Checking live_player_stats for game_id:', nbaGameId, 'nba_player_id:', playerInfo.nba_player_id);
        const { data: liveStats, error: liveStatsError } = await supabase
          .from('live_player_stats')
          .select('stats, game_id, raw_stats')
          .eq('nba_player_id', playerInfo.nba_player_id)
          .eq('game_id', nbaGameId)
          .maybeSingle();
        
        console.log('📊 Live stats query result:', { liveStats, liveStatsError, hasStats: !!liveStats?.stats });
        
        if (!liveStatsError && liveStats && liveStats.stats) {
          try {
            // Parse stats - stats is JSONB, could be string or object
            let stats = null;
            if (typeof liveStats.stats === 'string') {
              stats = JSON.parse(liveStats.stats);
            } else if (liveStats.stats) {
              stats = liveStats.stats;
            }
            
            console.log('✅ Parsed live stats:', stats);
            
            if (stats) {
              // Stats format: pts, reb, ast, stl, blk, tov, fg3m, ftm
              return {
                stats: {
                  source: 'live',
                  stats: {
                    pts: stats.pts || 0,
                    reb: stats.reb || 0,
                    ast: stats.ast || 0,
                    stl: stats.stl || 0,
                    blk: stats.blk || 0,
                    tov: stats.tov || 0,
                    fg3m: stats.fg3m || 0,
                    ftm: stats.ftm || 0,
                  },
                },
                nbaGame,
              };
            }
          } catch (e) {
            console.error('❌ Error parsing live stats:', e);
          }
        } else if (liveStatsError) {
          console.error('❌ Error fetching live stats:', liveStatsError);
        } else {
          console.log('ℹ️ No live stats found for this game');
        }
      } else {
        console.log('⚠️ No nbaGameId found, cannot check live stats');
      }
      
      return { stats: null, nbaGame };
    },
    enabled: !!playerId && !!playerInfo?.nba_player_id && !!playerPropsData?.game && playerPropsData.hasGameToday,
    refetchInterval: (data) => {
      // If we have live stats, refetch every 30 seconds
      return data?.stats?.source === 'live' ? 30000 : false;
    },
  });
  
  // Extract stats and nbaGame from the query result
  const gameStats = todayGameStats?.stats || null;
  const nbaGameData = todayGameStats?.nbaGame || null;
  
  // Helper to convert hex to rgba with opacity

  // Format odds display
  const formatOdds = (price?: string): string | null => {
    if (!price || price.trim() === '' || price.toLowerCase() === 'null' || price.toLowerCase() === 'n/a') {
      return null;
    }
    
    const trimmed = price.trim();
    if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
      return trimmed;
    }
    
    const decimal = parseFloat(price);
    if (isNaN(decimal)) return null;
    
    if (decimal >= 2.0) {
      return `+${Math.round((decimal - 1) * 100)}`;
    } else if (decimal > 1.0) {
      return `-${Math.round(100 / (decimal - 1))}`;
    } else {
      return price;
    }
  };


  // Process props into categories and calculate results if stats are available
  const processProps = (): PropCategory[] => {
    if (!playerPropsData?.game?.playerProps || !Array.isArray(playerPropsData.game.playerProps)) return [];

    // First, try to get game-level props
    const gameLevelProps: PlayerProp[] = [];
    const quarterProps: PlayerProp[] = [];
    
    playerPropsData.game.playerProps.forEach(prop => {
      const period = (prop as any).period || 'game';
      if (period === 'game' || period === 'reg') {
        gameLevelProps.push(prop);
      } else {
        quarterProps.push(prop);
      }
    });
    
    // Use game-level props if available, otherwise use quarter props
    const propsToUse = gameLevelProps.length > 0 ? gameLevelProps : quarterProps;
    
    // Group by bet type
    const propsByType: Record<string, PlayerProp[]> = {};
    
    propsToUse.forEach(prop => {
      const betType = prop.betType.toLowerCase();
      if (!propsByType[betType]) {
        propsByType[betType] = [];
      }
      propsByType[betType].push(prop);
    });

    // Convert to category array with best line/odds
    const categories: PropCategory[] = [];
    
    Object.entries(propsByType).forEach(([betType, props]) => {
      if (props.length === 0) return;

      // Extract overUnder from each prop (from bet_type_id, raw_odd_data, or overUnder field)
      const propsWithOverUnder = props.map(p => {
        const prop = p as any;
        let overUnder: 'O' | 'U' | null = null;
        
        // Check if overUnder is already set
        if (prop.overUnder === 'over' || prop.overUnder === 'Over' || prop.overUnder === 'O') {
          overUnder = 'O';
        } else if (prop.overUnder === 'under' || prop.overUnder === 'Under' || prop.overUnder === 'U') {
          overUnder = 'U';
        } else {
          // Extract from bet_type_id
          const betTypeId = prop.bet_type_id || prop.betTypeId || '';
          if (betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over')) {
            overUnder = 'O';
          } else if (betTypeId.includes('-under') || betTypeId.endsWith('under') || betTypeId.toLowerCase().includes('under')) {
            overUnder = 'U';
          } else {
            // Extract from raw_odd_data
            const rawData = prop.raw_odd_data || prop.rawData || {};
            if (rawData.overUnder || rawData.sideID || rawData.sideId) {
              const side = rawData.overUnder || rawData.sideID || rawData.sideId || '';
              if (side === 'over' || side === 'Over' || side === 'O') {
                overUnder = 'O';
              } else if (side === 'under' || side === 'Under' || side === 'U') {
                overUnder = 'U';
              }
            }
          }
        }
        
        return { ...prop, extractedOverUnder: overUnder };
      });
      
      // Find the best prop (prefer over, then highest line)
      const overProps = propsWithOverUnder.filter(p => p.extractedOverUnder === 'O');
      const underProps = propsWithOverUnder.filter(p => p.extractedOverUnder === 'U');

      // Get best over prop (highest line)
      const bestOver = overProps.length > 0 
        ? overProps.reduce((best, current) => {
            const currentLine = current.line !== undefined && current.line !== null ? current.line : -Infinity;
            const bestLine = best.line !== undefined && best.line !== null ? best.line : -Infinity;
            return currentLine > bestLine ? current : best;
          })
        : null;

      // Get best under prop (lowest line)
      const bestUnder = underProps.length > 0
        ? underProps.reduce((best, current) => {
            const currentLine = current.line !== undefined && current.line !== null ? current.line : Infinity;
            const bestLine = best.line !== undefined && best.line !== null ? best.line : Infinity;
            return currentLine < bestLine ? current : best;
          })
        : null;

      // Prefer over if available, otherwise use under
      const bestProp = bestOver || bestUnder || propsWithOverUnder[0];
      
      const line = bestProp.line !== undefined && bestProp.line !== null ? bestProp.line : null;
      const overUnder = bestProp.extractedOverUnder || (bestOver ? 'O' : bestUnder ? 'U' : null);
      const odds = formatOdds(bestProp.price || (bestProp as any).americanOdds) || '';

      const category: PropCategory = {
        betType,
        displayName: formatBetType(betType),
        line,
        odds: odds || '',
        overUnder,
      };

      // Calculate result if stats are available (from live_player_stats or nba_boxscores)
      if (gameStats && gameStats.stats && line !== null) {
        let actualValue = 0;
        let resultType: 'over' | 'under' | 'push' = 'under';
        
        // Handle combined props
        const normalizedBetType = betType.toLowerCase().replace(/\s+/g, '').replace(/_/g, '+');
        if (normalizedBetType.includes('points+rebounds+assists') || normalizedBetType.includes('par')) {
          actualValue = (gameStats.stats.pts || 0) + (gameStats.stats.reb || 0) + (gameStats.stats.ast || 0);
        } else if (normalizedBetType.includes('points+rebounds') || normalizedBetType.includes('pts+reb')) {
          actualValue = (gameStats.stats.pts || 0) + (gameStats.stats.reb || 0);
        } else if (normalizedBetType.includes('points+assists') || normalizedBetType.includes('pts+ast')) {
          actualValue = (gameStats.stats.pts || 0) + (gameStats.stats.ast || 0);
        } else if (normalizedBetType.includes('rebounds+assists') || normalizedBetType.includes('reb+ast')) {
          actualValue = (gameStats.stats.reb || 0) + (gameStats.stats.ast || 0);
        } else if (normalizedBetType.includes('blocks+steals') || normalizedBetType.includes('stocks')) {
          actualValue = (gameStats.stats.blk || 0) + (gameStats.stats.stl || 0);
        } else {
          // Single stat props - use calculatePropResult
          const result = calculatePropResult(betType, line, gameStats.stats);
          if (result) {
            actualValue = result.actualValue;
            resultType = result.result;
          } else {
            // If calculatePropResult fails, skip calculating result but still add the category
            categories.push(category);
            return; // Skip to next prop
          }
        }
        
        // Determine result type for combined props
        if (normalizedBetType.includes('points+rebounds+assists') || 
            normalizedBetType.includes('par') ||
            normalizedBetType.includes('points+rebounds') ||
            normalizedBetType.includes('pts+reb') ||
            normalizedBetType.includes('points+assists') ||
            normalizedBetType.includes('pts+ast') ||
            normalizedBetType.includes('rebounds+assists') ||
            normalizedBetType.includes('reb+ast') ||
            normalizedBetType.includes('blocks+steals') ||
            normalizedBetType.includes('stocks')) {
          resultType = actualValue > line ? 'over' : actualValue < line ? 'under' : 'push';
        }
        
        // Determine if this prop HIT based on over/under
        // Over prop: hit if actual > line
        // Under prop: hit if actual < line
        // Push: exactly on line (typically doesn't count as hit)
        const isOverProp = overUnder === 'O';
        const isUnderProp = overUnder === 'U';
        let hit = false;
        
        if (resultType === 'push') {
          hit = false; // Push doesn't count as hit
        } else if (isOverProp) {
          hit = resultType === 'over'; // Over prop hits if actual > line
        } else if (isUnderProp) {
          hit = resultType === 'under'; // Under prop hits if actual < line
        } else {
          // If we don't know if it's over/under, default to checking if actual > line
          hit = actualValue > line;
        }
        
        category.actualValue = actualValue;
        category.hit = hit;
        category.result = resultType;
      }

      categories.push(category);
    });

    // Sort by common prop order
    const propOrder = ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'TOV', 'STOCKS', 'PTS+AST', 'PTS+REB', 'PAR', 'REB+AST'];
    categories.sort((a, b) => {
      const aIndex = propOrder.indexOf(a.displayName);
      const bIndex = propOrder.indexOf(b.displayName);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return categories.slice(0, 15); // Limit to 15 rows
  };

  const propCategories = processProps();

  // Check if player has props for today - use hasGameToday from usePlayerProps
  const isGameToday = playerPropsData?.hasGameToday === true;
  
  // Determine if we can show props - allow props for today OR upcoming games
  // Props are available if we have game data and props exist (regardless of whether it's today or upcoming)
  // Check for props more leniently - if we have game data with playerProps array, we can show props
  const hasPropsData = playerPropsData?.game?.playerProps && Array.isArray(playerPropsData.game.playerProps) && playerPropsData.game.playerProps.length > 0;
  const canShowProps = playerPropsData?.game && (propCategories.length > 0 || hasPropsData);
  const canShowGameLog = gameLogsData && gameLogsData.length > 0;
  
  // Auto-set view mode based on availability (only on mount or when data changes)
  // Always default to props view if available, only switch to game log if props not available
  useEffect(() => {
    if (canShowProps) {
      // Props are available - always show props first
      if (viewMode !== 'props') {
        setViewMode('props');
      }
    } else if (!canShowProps && canShowGameLog) {
      // No props available, but game log is - show game log
      if (viewMode !== 'gameLog') {
        setViewMode('gameLog');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShowProps, canShowGameLog]); // Intentionally exclude viewMode to avoid loops

  if (isLoading) {
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
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
            LOADING...
          </Typography>
        </Sheet>
        {[...Array(5)].map((_, i) => {
          return (
            <Sheet
              key={i}
              sx={getDataRowStyles(teamColors, position, rowHeight)}
            />
          );
        })}
      </Box>
    );
  }

  // Determine if we should show props or game logs based on view mode
  const showProps = viewMode === 'props' && canShowProps;
  const showGameLogs = viewMode === 'gameLog' && canShowGameLog;
  const hasPreviousGame = previousGameData && previousGameData.propResults.length > 0;
  
  // Determine what to display - If a game log is selected and we're in game log view, show those props
  const showSelectedGameProps = selectedGameLogId && selectedGameProps && viewMode === 'gameLog';
  
  // If no game today and no game logs, show loading or no data message
  if (!showProps && !showGameLogs && !hasPreviousGame) {
    if (isLoading || gameLogsLoading || (playerPropsData === undefined && !isLoading)) {
      return (
        <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
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
              LOADING...
            </Typography>
          </Sheet>
        </Box>
      );
    }
    
    return (
      <Box sx={{ p: 0.5, pt: 0.5, height: '100%' }}>
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
            NO DATA
          </Typography>
        </Sheet>
      </Box>
    );
  }

  // Show game logs if no game today
  if (showGameLogs && gameLogsData && gameLogsData.length > 0) {
    const calculateFantasyPoints = (game: any): number => {
      return FANDUEL_SCORING.calculatePoints({
        pts: game.pts || 0,
        reb: game.reb || 0,
        ast: game.ast || 0,
        stl: game.stl || 0,
        blk: game.blk || 0,
        tov: game.tov || 0,
      } as any);
    };

    const formatDate = (dateStr: string): string => {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    };

    const formatMatchup = (game: any): string => {
      if (!game.matchup || !game.team_abbreviation) return '';
      const [awayTeam, homeTeam] = game.matchup.split(' @ ');
      if (awayTeam && homeTeam) {
        if (game.team_abbreviation === awayTeam) {
          return `@ ${homeTeam}`;
        } else if (game.team_abbreviation === homeTeam) {
          return awayTeam;
        }
      }
      return game.matchup;
    };

    return (
      <Box sx={MARGIN_BAR_STYLES.containerPadding}>
        {/* Header Row with Toggle */}
        <Sheet sx={headerRowStyles}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            {/* Left button: Switch to Props view */}
            {canShowProps && (
              <IconButton
                size="sm"
                variant="plain"
                onClick={() => setViewMode('props')}
                sx={{
                  color: viewMode === 'props' ? hexToRgba(teamColors.secondary, 0.9) : 'rgba(184, 134, 11, 0.5)',
                  '&:hover': {
                    color: hexToRgba(teamColors.secondary, 0.9),
                  },
                }}
                title="View Props"
              >
                <ChevronLeft />
              </IconButton>
            )}
            {!canShowProps && <Box sx={{ width: '24px' }} />}
          <Typography level="body-xs" sx={MARGIN_BAR_STYLES.headerTypography}>
            2025-26 GAME LOG
          </Typography>
            {/* Right button: Switch to Props view */}
            {canShowProps && (
              <IconButton
                size="sm"
                variant="plain"
                onClick={() => setViewMode('props')}
                sx={{
                  color: viewMode === 'props' ? hexToRgba(teamColors.secondary, 0.9) : 'rgba(184, 134, 11, 0.5)',
                  '&:hover': {
                    color: hexToRgba(teamColors.secondary, 0.9),
                  },
                }}
                title="View Props"
              >
                <ChevronRight />
              </IconButton>
            )}
            {!canShowProps && <Box sx={{ width: '24px' }} />}
          </Box>
        </Sheet>

        <AnimatePresence mode="popLayout">
          {/* Show selected game props if a game is selected */}
          {showSelectedGameProps && selectedGameProps && (
            <>
              {/* Header for selected game */}
              <SplitFlapRow key="selected-game-header" index={0} keyValue="selected-game-header">
                <Sheet
                  sx={{
                    ...getDataRowStyles(teamColors, position, rowHeight),
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    border: `2px solid ${hexToRgba(teamColors.secondary, 0.8)}`,
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
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: hexToRgba(teamColors.primary, 0.9),
                        fontWeight: 700,
                        fontSize: '1rem',
                        textAlign: 'center',
                        lineHeight: 1.1,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {selectedGameProps.hitRate.toFixed(0)}% ({selectedGameProps.hits}/{selectedGameProps.total})
                    </Typography>
                  </Box>
                </Sheet>
              </SplitFlapRow>
              
              {/* Props for selected game */}
              {selectedGameProps.propResults.map((result, propIndex) => {
                const lineText = result.line !== null && result.line !== undefined
                  ? `${result.overUnder} ${result.line}`
                  : '';
                
                return (
                  <SplitFlapRow
                    key={`selected-prop-${result.betType}-${propIndex}`}
                    index={propIndex + 1}
                    keyValue={`selected-prop-${result.betType}-${propIndex}`}
                  >
                    <Sheet
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
                        {/* Category Name */}
                        <Box sx={{ minWidth: '50px', fontSize: '1rem', color: '#ffffff' }}>
                          <SplitFlapText value={result.displayName} delay={propIndex * 0.05} characterDelay={0.02} duration={0.3} fontSize="1rem" color="#ffffff" />
                        </Box>
                        
                        {/* Line */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          {lineText && (
                            <SplitFlapText value={lineText} delay={propIndex * 0.05 + 0.1} characterDelay={0.02} duration={0.3} fontSize="0.9rem" color="#ffffff" />
                          )}
                          {result.actualValue !== undefined && (
                            <Box sx={{ color: result.hit ? '#4ade80' : '#f87171', fontSize: '0.8rem', mt: 0.1 }}>
                              <SplitFlapText value={`${result.actualValue} ${result.hit ? '✓' : '✗'}`} delay={propIndex * 0.05 + 0.15} characterDelay={0.02} duration={0.3} fontSize="0.8rem" color={result.hit ? '#4ade80' : '#f87171'} />
                            </Box>
                          )}
                        </Box>
                        
                        {/* Hit/Miss */}
                        <Box sx={{ minWidth: '40px', textAlign: 'right' }}>
                          <SplitFlapText value={result.hit ? 'HIT' : 'MISS'} delay={propIndex * 0.05 + 0.2} characterDelay={0.02} duration={0.3} fontSize="0.9rem" color={result.hit ? '#4ade80' : '#f87171'} />
                        </Box>
                      </Box>
                    </Sheet>
                  </SplitFlapRow>
                );
              })}
            </>
          )}
          
          {/* Game Logs - only show if no game is selected */}
          {!showSelectedGameProps && gameLogsData.slice(0, 15).map((game: any, index: number) => {
            const fantasyPoints = calculateFantasyPoints(game);
            const matchup = formatMatchup(game);
            const isSelected = selectedGameLogId === game.game_id;

            return (
              <SplitFlapRow
                key={`game-${game.id || index}`}
                index={index}
                keyValue={`game-${game.id || index}`}
              >
                <Sheet
                  onClick={() => {
                    if (isSelected) {
                      setSelectedGameLogId(null);
                    } else {
                      setSelectedGameLogId(game.game_id);
                    }
                  }}
                  sx={{
                    ...getDataRowStyles(teamColors, position, rowHeight),
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                    position: 'relative',
                    cursor: 'pointer',
                    ...(isSelected && {
                      border: `2px solid ${hexToRgba(teamColors.secondary, 0.8)}`,
                      boxShadow: `0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 0 2px ${hexToRgba(teamColors.secondary, 0.5)}, 0 0 15px ${hexToRgba(teamColors.secondary, 0.4)}`,
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
                    '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, position: 'relative', zIndex: 2, fontSize: '0.9rem' }}>
                    {/* Date */}
                    <Box sx={{ minWidth: '35px', textAlign: 'left' }}>
                      <SplitFlapText
                        value={formatDate(game.game_date)}
                        delay={index * 0.05}
                        characterDelay={0.02}
                        duration={0.3}
                        fontSize="0.9rem"
                        color="rgba(255, 255, 255, 0.7)"
                      />
                    </Box>

                    {/* Matchup */}
                    <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <SplitFlapText
                        value={matchup}
                        delay={index * 0.05 + 0.1}
                        characterDelay={0.02}
                        duration={0.3}
                        fontSize="0.9rem"
                        color="#ffffff"
                      />
                    </Box>

                    {/* Stats - PTS/REB/AST */}
                    <Box sx={{ minWidth: '60px', textAlign: 'right', display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <SplitFlapText
                        value={`${game.pts || 0}`}
                        delay={index * 0.05 + 0.15}
                        characterDelay={0.02}
                        duration={0.3}
                        fontSize="0.9rem"
                        color="#ffffff"
                      />
                      <SplitFlapText
                        value={`${game.reb || 0}`}
                        delay={index * 0.05 + 0.2}
                        characterDelay={0.02}
                        duration={0.3}
                        fontSize="0.9rem"
                        color="rgba(255, 255, 255, 0.7)"
                      />
                      <SplitFlapText
                        value={`${game.ast || 0}`}
                        delay={index * 0.05 + 0.25}
                        characterDelay={0.02}
                        duration={0.3}
                        fontSize="0.9rem"
                        color="rgba(255, 255, 255, 0.7)"
                      />
                    </Box>

                    {/* Hit Rate (if selected) or Fantasy */}
                    <Box sx={{ minWidth: '45px', textAlign: 'right' }}>
                      {isSelected && selectedGameProps ? (
                        <SplitFlapText
                          value={`${selectedGameProps.hitRate.toFixed(0)}%`}
                          delay={index * 0.05 + 0.3}
                          characterDelay={0.02}
                          duration={0.3}
                          fontSize="0.9rem"
                          color={selectedGameProps.hitRate >= 50 ? '#4ade80' : '#f87171'}
                        />
                      ) : (
                        <SplitFlapText
                          value={fantasyPoints.toFixed(1)}
                          delay={index * 0.05 + 0.3}
                          characterDelay={0.02}
                          duration={0.3}
                          fontSize="0.9rem"
                          color="rgba(184, 134, 11, 0.9)"
                        />
                      )}
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
  
  // Use previous game data if no game today and no game logs
  const usePreviousGame = !showProps && !showGameLogs && hasPreviousGame;
  const displayData = usePreviousGame ? previousGameData : null;
  const game = playerPropsData?.game;
  
  // Process previous game props into categories if using previous game
  const previousGameCategories: PropCategory[] = usePreviousGame && displayData
    ? displayData.propResults.map(result => ({
        betType: result.betType,
        displayName: result.displayName,
        line: result.line,
        odds: 'N/A', // Previous games don't show odds
        overUnder: result.overUnder,
        actualValue: result.actualValue,
        hit: result.hit,
        result: result.result,
      }))
    : [];
  
  // Sort previous game categories
  if (previousGameCategories.length > 0) {
    const propOrder = ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'TOV', 'STOCKS', 'PTS+AST', 'PTS+REB', 'PAR', 'REB+AST'];
    previousGameCategories.sort((a, b) => {
      const aIndex = propOrder.indexOf(a.displayName);
      const bIndex = propOrder.indexOf(b.displayName);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }
  
  // Determine what to display
  const displayCategories = usePreviousGame ? previousGameCategories : propCategories;
  
  // Calculate hit rate - percentage of props where player went over
  const propsWithResults = displayCategories.filter(cat => 
    cat.actualValue !== undefined && 
    cat.actualValue !== null && 
    !isNaN(cat.actualValue) &&
    typeof cat.actualValue === 'number' &&
    cat.result !== undefined
  );
  const totalProps = propsWithResults.length;
  const oversHit = propsWithResults.filter(cat => cat.result === 'over').length;
  const hitRate = totalProps > 0 ? Math.round((oversHit / totalProps) * 100) : 0;

  // Format game time
  const formatGameTime = (): string => {
    // Use player props game data
    if (game?.startsAt) {
      try {
        const date = new Date(game.startsAt);
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      } catch {
        return '';
      }
    }
    
    return '';
  };

  // Team name to abbreviation mapping (for when tricodes aren't available)
  const getTeamAbbreviationFromName = (teamName: string): string => {
    if (!teamName) return '';
    
    // If it's already a short abbreviation, return as-is
    if (teamName.length <= 4 && !teamName.includes(' ')) {
      return teamName.toUpperCase();
    }
    
    // Map common team name patterns to abbreviations
    const teamNameMap: Record<string, string> = {
      'CHARLOTTE HORNETS': 'CHA',
      'LOS ANGELES LAKERS': 'LAL',
      'BOSTON CELTICS': 'BOS',
      'NEW YORK KNICKS': 'NYK',
      'PHILADELPHIA 76ERS': 'PHI',
      'BROOKLYN NETS': 'BKN',
      'TORONTO RAPTORS': 'TOR',
      'CHICAGO BULLS': 'CHI',
      'CLEVELAND CAVALIERS': 'CLE',
      'DETROIT PISTONS': 'DET',
      'INDIANA PACERS': 'IND',
      'MILWAUKEE BUCKS': 'MIL',
      'ATLANTA HAWKS': 'ATL',
      'MIAMI HEAT': 'MIA',
      'ORLANDO MAGIC': 'ORL',
      'WASHINGTON WIZARDS': 'WAS',
      'DENVER NUGGETS': 'DEN',
      'MINNESOTA TIMBERWOLVES': 'MIN',
      'OKLAHOMA CITY THUNDER': 'OKC',
      'PORTLAND TRAIL BLAZERS': 'POR',
      'UTAH JAZZ': 'UTA',
      'GOLDEN STATE WARRIORS': 'GSW',
      'LOS ANGELES CLIPPERS': 'LAC',
      'PHOENIX SUNS': 'PHX',
      'SACRAMENTO KINGS': 'SAC',
      'DALLAS MAVERICKS': 'DAL',
      'HOUSTON ROCKETS': 'HOU',
      'MEMPHIS GRIZZLIES': 'MEM',
      'NEW ORLEANS PELICANS': 'NOP',
      'SAN ANTONIO SPURS': 'SAS',
    };
    
    const upperName = teamName.toUpperCase().trim();
    return teamNameMap[upperName] || teamName;
  };

  // Get opponent team abbreviation from game data
  const getOpponent = (): string => {
    const playerTeam = teamAbbreviation;
    
    if (!game) return '';
    
    // Get team data from game object
    const homeTeamTricode = game.homeTeamTricode;
    const awayTeamTricode = game.awayTeamTricode;
    const homeTeam = game.homeTeam;
    const awayTeam = game.awayTeam;
    
    // Use tricodes if available, otherwise use team names
    const homeDisplay = homeTeamTricode || homeTeam || '';
    const awayDisplay = awayTeamTricode || awayTeam || '';
    
    if (!homeDisplay || !awayDisplay) {
      return '';
    }
    
    if (!playerTeam) {
      // If we don't know player's team, show both teams
      return `${awayDisplay} @ ${homeDisplay}`;
    }
    
    // Determine if player is on home or away team
    const isHomeTeam = playerTeam === homeTeamTricode || 
                      (homeTeam && (homeTeam.includes(playerTeam) || playerTeam.includes(homeTeamTricode || '')));
    const isAwayTeam = playerTeam === awayTeamTricode || 
                      (awayTeam && (awayTeam.includes(playerTeam) || playerTeam.includes(awayTeamTricode || '')));
    
    if (isHomeTeam) {
      return `vs ${awayDisplay}`;
    } else if (isAwayTeam) {
      return `@ ${homeDisplay}`;
    }
    
    // Fallback: show both teams
    return `${awayDisplay} @ ${homeDisplay}`;
  };

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
      {/* Header Row with Game Metadata and Toggle */}
      <Sheet
        sx={{
          mb: 0.25,
          p: 0.5,
          borderRadius: '4px',
          height: rowHeight,
          minHeight: '32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          bgcolor: '#000000',
          position: 'relative',
        }}
      >
        {/* Toggle Buttons - Show when both views are available */}
        {canShowGameLog && canShowProps && (
          <>
            {/* Left button: Switch to Game Log view */}
            <Box sx={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
              <IconButton
                size="sm"
                variant="plain"
                onClick={() => setViewMode('gameLog')}
                sx={{
                  color: viewMode === 'gameLog' ? hexToRgba(teamColors.secondary, 0.9) : 'rgba(184, 134, 11, 0.5)',
                  '&:hover': {
                    color: hexToRgba(teamColors.secondary, 0.9),
                  },
                }}
                title="View Game Log"
              >
                <ChevronLeft />
              </IconButton>
            </Box>
            {/* Right button: Switch to Props view */}
            <Box sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
              <IconButton
                size="sm"
                variant="plain"
                onClick={() => setViewMode('props')}
                sx={{
                  color: viewMode === 'props' ? hexToRgba(teamColors.secondary, 0.9) : 'rgba(184, 134, 11, 0.5)',
                  '&:hover': {
                    color: hexToRgba(teamColors.secondary, 0.9),
                  },
                }}
                title="View Props"
              >
                <ChevronRight />
              </IconButton>
            </Box>
          </>
        )}
        {usePreviousGame && displayData ? (
          <>
            <Typography
              level="body-xs"
              sx={{
                color: hexToRgba(teamColors.primary, 0.9),
                fontWeight: 700,
                fontSize: '1.2rem',
                textAlign: 'center',
                lineHeight: 1.1,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 0.1,
              }}
            >
              LAST GAME
            </Typography>
            <Typography
              level="body-xs"
              sx={{
                color: hexToRgba(teamColors.primary, 0.7),
                fontWeight: 600,
                fontSize: '0.9rem',
                textAlign: 'center',
                lineHeight: 1,
              }}
            >
              {displayData.hitRate.toFixed(0)}% ({displayData.hits}/{displayData.totalProps})
            </Typography>
          </>
        ) : game ? (
          <>
            <Typography
              level="body-xs"
              sx={{
                color: hexToRgba(teamColors.primary, 0.9),
                fontWeight: 700,
                fontSize: '1.2rem',
                textAlign: 'center',
                lineHeight: 1.1,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: 0.1,
              }}
            >
              {getOpponent()}
            </Typography>
            {formatGameTime() && (
              <Typography
                level="body-xs"
                sx={{
                  color: hexToRgba(teamColors.primary, 0.7),
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  lineHeight: 1,
                }}
              >
                {formatGameTime()}
              </Typography>
            )}
          </>
        ) : (
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
            PROPS
          </Typography>
        )}
      </Sheet>
      
      {/* Game Metadata Rows - Show game_id, teams, time when we have today's game */}
      {showProps && game && nbaGameData && (
        <AnimatePresence mode="popLayout">
          {/* Game ID Row */}
          <SplitFlapRow key="game-id" index={0} keyValue="game-id">
            <Sheet
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
                <Box sx={{ minWidth: '50px', fontSize: '1rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <SplitFlapText value="GAME ID" delay={0} characterDelay={0.02} duration={0.3} fontSize="1rem" color="rgba(255, 255, 255, 0.6)" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <SplitFlapText value={nbaGameData.game_id || 'N/A'} delay={0.05} characterDelay={0.02} duration={0.3} fontSize="1rem" color="#ffffff" />
                </Box>
              </Box>
            </Sheet>
          </SplitFlapRow>
          
          {/* Teams Row */}
          <SplitFlapRow key="game-teams" index={1} keyValue="game-teams">
            <Sheet
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
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                  <SplitFlapText value={getOpponent()} delay={0.1} characterDelay={0.02} duration={0.3} fontSize="1rem" color="#ffffff" />
                </Box>
              </Box>
            </Sheet>
          </SplitFlapRow>
          
          {/* Game Time Row */}
          {formatGameTime() && (
            <SplitFlapRow key="game-time" index={2} keyValue="game-time">
              <Sheet
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
                  <Box sx={{ minWidth: '50px', fontSize: '1rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                    <SplitFlapText value="TIME" delay={0.15} characterDelay={0.02} duration={0.3} fontSize="1rem" color="rgba(255, 255, 255, 0.6)" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <SplitFlapText value={formatGameTime()} delay={0.2} characterDelay={0.02} duration={0.3} fontSize="1rem" color="#ffffff" />
                  </Box>
                </Box>
              </Sheet>
            </SplitFlapRow>
          )}
        </AnimatePresence>
      )}
      
      <AnimatePresence mode="popLayout">
        {/* Prop Categories - One row per category */}
        {displayCategories.map((category, index) => {
          // Adjust index to account for metadata rows
          const adjustedIndex = showProps && game && nbaGameData ? index + (formatGameTime() ? 3 : 2) : index;
          // Build line text - only include overUnder if it exists and is not null
          const lineText = category.line !== null && category.line !== undefined
            ? (category.overUnder && category.overUnder !== null && category.overUnder !== 'null' 
                ? `${category.overUnder} ${category.line}` 
                : `${category.line}`)
            : '';
          // Show result if we have actualValue (from today's game stats or previous game)
          // Only show if actualValue is a valid number (not null, not undefined, not NaN)
          const showResult = category.actualValue !== undefined && 
                           category.actualValue !== null && 
                           !isNaN(category.actualValue) &&
                           typeof category.actualValue === 'number';
          const resultText = showResult 
            ? `${category.actualValue} ${category.hit ? '✓' : '✗'}`
            : '';
          
          return (
            <SplitFlapRow
              key={`${category.betType}-${playerId}-${usePreviousGame ? 'prev' : 'today'}`}
              index={index}
              keyValue={`${category.betType}-${playerId}-${usePreviousGame ? 'prev' : 'today'}`}
            >
              <Sheet
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
                  {/* Category Name */}
                  <Box
                    sx={{
                      color: '#ffffff',
                      minWidth: '50px',
                      fontSize: '1.5rem',
                      lineHeight: 1,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <SplitFlapText
                      value={category.displayName}
                      delay={index * 0.05}
                      characterDelay={0.02}
                      duration={0.35}
                      fontSize="1.5rem"
                      color="#ffffff"
                    />
                  </Box>

                  {/* Line and Over/Under */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {category.line !== null && (
                      <Box
                        sx={{
                          color: '#ffffff',
                          fontSize: '1.2rem',
                          lineHeight: 1.1,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {lineText && (
                        <SplitFlapText
                          value={lineText}
                          delay={index * 0.05 + 0.1}
                          characterDelay={0.02}
                          duration={0.3}
                          fontSize="1.2rem"
                          color="#ffffff"
                        />
                        )}
                      </Box>
                    )}
                    {showResult && (
                      <Box
                        sx={{
                          color: category.hit ? '#4ade80' : '#f87171',
                          fontSize: '0.9rem',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          mt: 0.1,
                        }}
                      >
                        {resultText && (
                        <SplitFlapText
                          value={resultText}
                          delay={index * 0.05 + 0.15}
                          characterDelay={0.02}
                          duration={0.3}
                          fontSize="0.9rem"
                          color={category.hit ? '#4ade80' : '#f87171'}
                        />
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* Odds or Hit/Miss indicator */}
                  <Box
                    sx={{
                      color: (usePreviousGame || showResult)
                        ? (category.hit ? '#4ade80' : '#f87171')
                        : (category.odds.startsWith('+') ? '#4ade80' : '#f87171'),
                      fontSize: '1rem',
                      minWidth: '50px',
                      textAlign: 'right',
                      lineHeight: 1.1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {(usePreviousGame || showResult) ? (
                      <SplitFlapText
                        value={category.hit ? 'HIT' : 'MISS'}
                        delay={index * 0.05 + 0.2}
                        characterDelay={0.02}
                        duration={0.3}
                        fontSize="1rem"
                        color={category.hit ? '#4ade80' : '#f87171'}
                      />
                    ) : category.odds && category.odds.trim() !== '' ? (
                      <SplitFlapText
                        value={category.odds}
                        delay={index * 0.05 + 0.15}
                        characterDelay={0.02}
                        duration={0.3}
                        fontSize="1rem"
                        color={category.odds.startsWith('+') ? '#4ade80' : '#f87171'}
                      />
                    ) : (
                      <Box sx={{ minWidth: '50px' }} /> // Empty space if no odds
                    )}
                  </Box>
                </Box>
              </Sheet>
            </SplitFlapRow>
          );
        })}
        
        {/* Hit Rate Row - Show below all props if we have results */}
        {totalProps > 0 && (
          <SplitFlapRow
            key={`hit-rate-${playerId}-${usePreviousGame ? 'prev' : 'today'}`}
            index={displayCategories.length}
            keyValue={`hit-rate-${playerId}-${usePreviousGame ? 'prev' : 'today'}`}
          >
            <Sheet
              sx={{
                ...getDataRowStyles(teamColors, position, rowHeight),
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                position: 'relative',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
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
                {/* Hit Rate Label */}
                <Box
                  sx={{
                    color: '#ffffff',
                    minWidth: '50px',
                    fontSize: '1.5rem',
                    lineHeight: 1,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <SplitFlapText
                    value="HIT RATE"
                    delay={displayCategories.length * 0.05}
                    characterDelay={0.02}
                    duration={0.35}
                    fontSize="1.5rem"
                    color="#ffffff"
                  />
                </Box>

                {/* Hit Rate Value */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      color: hitRate >= 50 ? '#4ade80' : '#f87171',
                      fontSize: '1.2rem',
                      lineHeight: 1.1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <SplitFlapText
                      value={`${oversHit}/${totalProps} (${hitRate}%)`}
                      delay={displayCategories.length * 0.05 + 0.1}
                      characterDelay={0.02}
                      duration={0.3}
                      fontSize="1.2rem"
                      color={hitRate >= 50 ? '#4ade80' : '#f87171'}
                    />
                  </Box>
                </Box>

                {/* Empty space for alignment */}
                <Box sx={{ minWidth: '50px' }} />
              </Box>
            </Sheet>
          </SplitFlapRow>
        )}
      </AnimatePresence>
    </Box>
  );
}

