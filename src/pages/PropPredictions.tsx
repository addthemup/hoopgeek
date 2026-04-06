import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tabs,
  TabList,
  Tab,
  Table,
  Avatar,
  CircularProgress,
  Alert,
  Button,
  IconButton,
} from '@mui/joy';
import { ArrowBack } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useGamesByDate } from '../hooks/useGamesByDate';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import { getTodayEST, isDateInEST, utcToESTDate } from '../utils/nbaDateUtils';

export default function PropPredictions() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  
  const selectedDate = date ? dayjs(date) : dayjs();
  const dateString = selectedDate.format('YYYY-MM-DD');
  const todayEST = getTodayEST();
  const isToday = dateString === todayEST;
  const isPast = selectedDate.isBefore(todayEST, 'day');
  const [activeTab, setActiveTab] = useState<'hottest' | 'coldest'>('hottest');
  
  // Fetch games
  const { data: games } = useGamesByDate(dateString);
  const { data: nbaScoreboard } = useNBAScoreboard(isToday ? dateString : undefined);
  
  const allGames = useMemo(() => {
    if (isToday && nbaScoreboard?.games) {
      const filteredScoreboardGames = nbaScoreboard.games.filter((game: any) => {
        const gameDate = game.gameDate || game.game_date;
        if (!gameDate) return false;
        
        try {
          if (gameDate.includes('T') || gameDate.includes(' ')) {
            return isDateInEST(gameDate, dateString);
          } else {
            const utcDate = new Date(gameDate + 'T00:00:00Z');
            const estDateString = utcToESTDate(utcDate);
            return estDateString === dateString;
          }
        } catch (e) {
          return false;
        }
      });
      
      return filteredScoreboardGames.length > 0 ? filteredScoreboardGames : (games || []);
    }
    return games || [];
  }, [isToday, nbaScoreboard, games, dateString]);

  // Fetch props with results for past dates
  const { data: propsWithResults, isLoading } = useQuery({
    queryKey: ['prop-predictions-page', dateString, activeTab, allGames?.map(g => g.game_id).join(',')],
    queryFn: async () => {
      // Get game IDs from the carousel
      const gameIds = (allGames || []).map(g => g.game_id).filter(Boolean);
      
      if (gameIds.length === 0) {
        return [];
      }
      
      // Find player_props_games entries
      let propsGames: any[] = [];
      const { data: propsGamesByNbaId } = await supabase
        .from('player_props_games')
        .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team')
        .in('nba_game_id', gameIds)
        .eq('game_date', dateString);
      
      if (propsGamesByNbaId && propsGamesByNbaId.length > 0) {
        propsGames = propsGamesByNbaId;
      } else {
        // Fallback: get all props games for date
        const { data: allPropsGamesForDate } = await supabase
          .from('player_props_games')
          .select('id, nba_game_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team')
          .eq('game_date', dateString);
        
        if (allPropsGamesForDate) {
          propsGames = allPropsGamesForDate;
        }
      }
      
      if (propsGames.length === 0) {
        return [];
      }
      
      const propsGameIds = propsGames.map(pg => pg.id).filter(Boolean);
      
      // Fetch props
      const { data: props, error: propsError } = await supabase
        .from('player_props')
        .select(`
          *,
          player_props_games (
            id,
            nba_game_id,
            game_date,
            home_team_tricode,
            away_team_tricode
          )
        `)
        .in('game_id', propsGameIds)
        .eq('game_date', dateString)
        .limit(5000);
      
      if (propsError || !props || props.length === 0) {
        return [];
      }
      
      // Filter props by over/under based on activeTab
      const filteredProps = props.filter((prop: any) => {
        const betTypeId = prop.bet_type_id || '';
        const isOver = betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over');
        const isUnder = betTypeId.includes('-under') || betTypeId.endsWith('under') || betTypeId.toLowerCase().includes('under');
        
        if (activeTab === 'hottest') {
          return isOver; // Only show over props for hottest
        } else {
          return isUnder; // Only show under props for coldest
        }
      });
      
      // For past dates, calculate results
      if (isPast) {
        const playerIds = [...new Set(filteredProps.map((p: any) => p.nba_player_id).filter(Boolean))];
        
        if (playerIds.length === 0) {
          return [];
        }
        
        // Fetch boxscores
        const { data: boxscores } = await supabase
          .from('nba_boxscores')
          .select('nba_player_id, game_id, pts, reb, ast, stl, blk, tov, fg3m, ftm, fg3a, fta, fgm, fga')
          .in('nba_player_id', playerIds)
          .eq('game_date', dateString);
        
        if (!boxscores || boxscores.length === 0) {
          return [];
        }
        
        const boxscoreMap = new Map<string, any>();
        boxscores.forEach((bs: any) => {
          boxscoreMap.set(`${bs.nba_player_id}-${bs.game_id}`, bs);
        });
        
        const { calculatePropResult } = await import('../utils/playerPropsCalculator');
        
        // Calculate results and filter
        const propsWithCalculatedResults = filteredProps.map((prop: any) => {
          const propsGame = Array.isArray(prop.player_props_games) 
            ? prop.player_props_games[0] 
            : prop.player_props_games;
          const nbaGameId = propsGame?.nba_game_id;
          
          let boxscore: any = null;
          if (nbaGameId) {
            const boxscoreKey = `${prop.nba_player_id}-${nbaGameId}`;
            boxscore = boxscoreMap.get(boxscoreKey);
          }
          
          if (!boxscore) {
            const playerBoxscores = boxscores.filter((bs: any) => bs.nba_player_id === prop.nba_player_id);
            if (playerBoxscores.length === 1) {
              boxscore = playerBoxscores[0];
            }
          }
          
          if (!boxscore) {
            return null;
          }
          
          const betTypeId = prop.bet_type_id || '';
          const isOver = betTypeId.includes('-over') || betTypeId.endsWith('over') || betTypeId.toLowerCase().includes('over');
          
          const result = calculatePropResult(prop.bet_type, prop.line || 0, boxscore);
          if (!result) return null;
          
          // Filter based on tab:
          // Hottest: Only over props that hit (result.result === 'over' means actual > line)
          // Coldest: Only under props that hit (result.result === 'under' means actual < line)
          if (activeTab === 'hottest') {
            if (!isOver || result.result !== 'over') {
              return null; // Only show over props that hit (exceeded the line)
            }
          } else {
            // Coldest: under props where player got lower than the under (hit the under)
            if (isOver || result.result !== 'under') {
              return null; // Only show under props that hit (got lower than the line)
            }
          }
          
          return {
            ...prop,
            result,
            actualValue: result.actualValue,
            hit: result.hit,
          };
        }).filter(Boolean);
        
        // Sort by hit rate or actual value
        return propsWithCalculatedResults.sort((a: any, b: any) => {
          if (activeTab === 'hottest') {
            return (b.actualValue || 0) - (a.actualValue || 0); // Sort by actual value descending
          } else {
            return (a.actualValue || 0) - (b.actualValue || 0); // Sort by actual value ascending
          }
        });
      }
      
      // For future dates, we can't calculate results yet
      // Return empty array since we need actual results to determine hottest/coldest
      return [];
    },
    enabled: !!dateString && allGames && allGames.length > 0,
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#FFFFFF', p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
        {/* Header with back button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton
            variant="soft"
            onClick={() => navigate('/feed')}
            sx={{ bgcolor: '#1a1a1a', color: '#FFFFFF', '&:hover': { bgcolor: '#2a2a2a' } }}
          >
            <ArrowBack />
          </IconButton>
          <Typography level="h2" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
            Prop Predictions - {selectedDate.format('MMMM D, YYYY')}
          </Typography>
        </Box>

        {/* Tabs */}
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333', mb: 3 }}>
          <CardContent>
            <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val as 'hottest' | 'coldest')}>
              <TabList>
                <Tab value="hottest">Hottest (Over Props Hit)</Tab>
                <Tab value="coldest">Coldest (Under Props Hit)</Tab>
              </TabList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Props Table */}
        <Card variant="outlined" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
          <CardContent>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : propsWithResults && propsWithResults.length > 0 ? (
              <Table hoverRow size="sm">
                <thead>
                  <tr>
                    <th style={{ color: '#FFFFFF' }}>Player</th>
                    <th style={{ color: '#FFFFFF' }}>Prop</th>
                    <th style={{ color: '#FFFFFF' }}>Line</th>
                    {isPast && <th style={{ color: '#FFFFFF' }}>Actual</th>}
                    <th style={{ color: '#FFFFFF' }}>Odds</th>
                  </tr>
                </thead>
                <tbody>
                  {propsWithResults.map((prop: any, index: number) => (
                    <tr 
                      key={prop.id || index}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (prop.player_id) {
                          navigate(`/player/${prop.player_id}`);
                        }
                      }}
                    >
                      <td>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar 
                            src={prop.nba_player_id && prop.nba_player_id > 0
                              ? `https://cdn.nba.com/headshots/nba/latest/260x190/${prop.nba_player_id}.png`
                              : undefined
                            }
                            alt={prop.player_name}
                            sx={{ width: 32, height: 32 }}
                          >
                            {(!prop.nba_player_id || prop.nba_player_id === 0) && (
                              <Typography sx={{ fontSize: '0.7rem', color: '#FFFFFF' }}>
                                {prop.player_name?.charAt(0) || '?'}
                              </Typography>
                            )}
                          </Avatar>
                          <Typography level="body-sm" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                            {prop.player_name || 'N/A'}
                          </Typography>
                        </Box>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                          {prop.bet_type} {prop.bet_type_id?.includes('over') ? 'Over' : prop.bet_type_id?.includes('under') ? 'Under' : ''}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" sx={{ color: '#FFC72C', fontWeight: 600 }}>
                          {prop.line ? prop.line.toFixed(1) : 'N/A'}
                        </Typography>
                      </td>
                      {isPast && (
                        <td>
                          <Typography 
                            level="body-sm" 
                            sx={{ 
                              color: prop.hit ? '#10B981' : '#EF4444',
                              fontWeight: 600,
                            }}
                          >
                            {prop.actualValue !== undefined ? prop.actualValue.toFixed(1) : 'N/A'}
                          </Typography>
                        </td>
                      )}
                      <td>
                        <Typography level="body-sm" sx={{ color: '#CCCCCC' }}>
                          {prop.american_odds || prop.price || 'N/A'}
                        </Typography>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Alert color="neutral" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                <Typography sx={{ color: '#FFFFFF' }}>
                  No {activeTab === 'hottest' ? 'over' : 'under'} props found for this date.
                </Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
