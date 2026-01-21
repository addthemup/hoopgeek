import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton } from '@mui/joy';
import { ArrowBack } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useNBAScoreboard } from '../hooks/useNBAScoreboard';
import { PlayersOfNightSection } from './Today';

export default function TeamOfNightPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  
  // Parse date from query param, default to yesterday if not provided
  const selectedDate: Dayjs = dateParam 
    ? dayjs(dateParam, 'YYYY-MM-DD')
    : dayjs().subtract(1, 'day');
  
  const dateString = selectedDate.format('YYYY-MM-DD');
  const isToday = selectedDate.isSame(dayjs(), 'day');
  
  // For today's date, check if there are live games and fetch live data
  const { data: nbaScoreboard } = useNBAScoreboard(isToday ? dateString : undefined);
  
  // Get all game IDs for today if live
  const gameIds = useMemo(() => {
    if (!isToday || !nbaScoreboard?.games) return [];
    return nbaScoreboard.games.map((g: any) => g.gameId).filter(Boolean);
  }, [isToday, nbaScoreboard]);
  
  // Fetch live stats if today
  const { data: liveStatsData } = useQuery({
    queryKey: ['live-team-of-night', dateString, gameIds.join(',')],
    queryFn: async () => {
      if (!isToday || !gameIds || gameIds.length === 0) return null;
      
      const { data: liveStats, error } = await supabase
        .from('live_player_stats')
        .select('nba_player_id, player_id, player_name, team_tricode, stats, game_id')
        .in('game_id', gameIds);
      
      if (error || !liveStats || liveStats.length === 0) return null;
      return liveStats;
    },
    enabled: isToday && gameIds.length > 0,
    refetchInterval: isToday ? 30000 : false,
    staleTime: 15000,
  });
  
  // Calculate live team of the night if we have live stats
  const { data: liveTeamOfNight } = useQuery({
    queryKey: ['live-team-of-night-lineup', liveStatsData],
    queryFn: async () => {
      if (!liveStatsData || liveStatsData.length === 0) return null;
      
      const playerIds = [...new Set(liveStatsData.map((s: any) => s.nba_player_id).filter(Boolean))];
      
      const { data: players } = await supabase
        .from('nba_players')
        .select('id, nba_player_id, name, team_abbreviation, position, jersey_number')
        .in('nba_player_id', playerIds)
        .eq('is_active', true);
      
      if (!players) return null;
      
      const playerDbIds = players.map(p => p.id);
      const { data: salaries } = await supabase
        .from('nba_hoopshype_salaries')
        .select('player_id, salary_2025_26')
        .in('player_id', playerDbIds);
      
      const salaryMap = new Map(salaries?.map(s => [s.player_id, s.salary_2025_26]) || []);
      const defaultSalary = 1157153;
      
      const playerPerformance = liveStatsData.map((liveStat: any) => {
        const player = players.find(p => p.nba_player_id === liveStat.nba_player_id);
        if (!player) return null;
        
        const stats = liveStat.stats || {};
        const salary = salaryMap.get(player.id) || defaultSalary;
        if (salary <= 0) return null;
        
        const fantasyPoints = 
          (stats.pts || 0) + 
          ((stats.reb || 0) * 1.2) + 
          ((stats.ast || 0) * 1.5) + 
          ((stats.stl || 0) * 3) + 
          ((stats.blk || 0) * 3) - 
          (stats.tov || 0);
        
        const pointsPerDollar = salary > 0 ? fantasyPoints / salary : 0;
        
        return {
          player_id: player.id,
          nba_player_id: player.nba_player_id,
          player_name: player.name,
          team: player.team_abbreviation,
          player_position: player.position,
          jersey_number: player.jersey_number?.toString() || '0',
          salary: salary,
          fantasy_points: fantasyPoints,
          games_played: 1,
          points_per_dollar: pointsPerDollar,
          selection_score: (fantasyPoints * 0.8) + (pointsPerDollar * 1000000 * 0.2),
        };
      }).filter(Boolean) as any[];
      
      const salaryCap = 208000000;
      const maxPlayers = 12;
      
      playerPerformance.sort((a, b) => b.selection_score - a.selection_score);
      
      const lineup: any[] = [];
      let usedSalary = 0;
      let lineupOrder = 1;
      
      for (const player of playerPerformance) {
        if (lineup.length >= maxPlayers) break;
        if (usedSalary + player.salary <= salaryCap) {
          lineup.push({
            ...player,
            lineup_order: lineupOrder++,
            lineup_unit: lineupOrder <= 5 ? 'starters' : lineupOrder <= 10 ? 'rotation' : 'bench',
            unit_position: lineupOrder <= 5 ? lineupOrder : lineupOrder <= 10 ? lineupOrder - 5 : lineupOrder - 10,
            weighted_points: player.fantasy_points * (lineupOrder <= 5 ? 1.0 : lineupOrder <= 10 ? 0.75 : 0.5),
          });
          usedSalary += player.salary;
        }
      }
      
      const remainingSlots = maxPlayers - lineup.length;
      const remainingCap = salaryCap - usedSalary;
      const usedPlayerIds = new Set(lineup.map(p => p.player_id));
      
      if (remainingSlots > 0 && remainingCap > 0) {
        const availablePlayers = playerPerformance
          .filter(p => !usedPlayerIds.has(p.player_id) && p.salary <= remainingCap)
          .sort((a, b) => b.points_per_dollar - a.points_per_dollar);
        
        for (const player of availablePlayers) {
          if (lineup.length >= maxPlayers) break;
          if (usedSalary + player.salary <= salaryCap) {
            lineup.push({
              ...player,
              lineup_order: lineupOrder++,
              lineup_unit: lineupOrder <= 5 ? 'starters' : lineupOrder <= 10 ? 'rotation' : 'bench',
              unit_position: lineupOrder <= 5 ? lineupOrder : lineupOrder <= 10 ? lineupOrder - 5 : lineupOrder - 10,
              weighted_points: player.fantasy_points * (lineupOrder <= 5 ? 1.0 : lineupOrder <= 10 ? 0.75 : 0.5),
            });
            usedSalary += player.salary;
          }
        }
      }
      
      return lineup.sort((a, b) => (a.lineup_order || 0) - (b.lineup_order || 0));
    },
    enabled: !!liveStatsData && liveStatsData.length > 0,
  });

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        mx: 'auto',
        px: { xs: 2, md: 4 },
        pt: { xs: 'calc(49px + 24px)', md: 'calc((100vh - 40px) / 16 + 24px)' },
        pb: 4,
        bgcolor: '#000000',
        minHeight: '100vh',
      }}
    >
      {/* Header with back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          variant="soft"
          onClick={() => navigate(-1)}
          sx={{ bgcolor: '#1a1a1a', color: '#FFFFFF', '&:hover': { bgcolor: '#2a2a2a' } }}
        >
          <ArrowBack />
        </IconButton>
        <Typography level="h2" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
          {isToday && liveTeamOfNight ? 'Live ' : ''}Team of the Night - {selectedDate.format('MMMM D, YYYY')}
        </Typography>
      </Box>

      {/* Full width player section */}
      <Box sx={{ width: '100%' }}>
        <PlayersOfNightSection 
          navigate={navigate} 
          selectedDate={selectedDate} 
          hideHeader={true} 
          compact={false}
          customPlayers={isToday && liveTeamOfNight ? liveTeamOfNight : undefined}
        />
      </Box>
    </Box>
  );
}
