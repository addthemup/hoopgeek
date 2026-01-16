import { useRef, useEffect, useState } from 'react';
import { Box, Typography, Alert, Card, CardContent } from '@mui/joy';
import { LineChart } from '@mui/x-charts/LineChart';
import { usePlayerGameStats } from '../../hooks/usePlayerGameStats';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';

interface PlayerPerformanceTrendsProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

export default function PlayerPerformanceTrends({ playerId, seasonYear, teamAbbreviation }: PlayerPerformanceTrendsProps) {
  const { data: statsData, isLoading: statsLoading, error: statsError } = usePlayerGameStats(playerId, seasonYear);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1976d2';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#4CAF50';

  // Fetch game dates for the stats - MUST be called before any early returns (React hooks rule)
  const gameIds = statsData?.stats?.slice(0, 20).map(stat => stat.game_id) || [];
  const { data: gameDatesData } = useQuery({
    queryKey: ['player-game-dates', gameIds],
    queryFn: async () => {
      if (gameIds.length === 0) return new Map();
      const { data, error } = await supabase
        .from('nba_games')
        .select('game_id, game_date')
        .in('game_id', gameIds);
      
      if (error) {
        console.error('Error fetching game dates:', error);
        return new Map();
      }
      
      const dateMap = new Map();
      (data || []).forEach(game => {
        dateMap.set(game.game_id, game.game_date);
      });
      return dateMap;
    },
    enabled: gameIds.length > 0 && !!statsData,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Update chart dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setChartWidth(Math.max(400, containerWidth - 64)); // Account for padding
      }
    };

    const timeoutId = setTimeout(updateDimensions, 0);
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [statsData]);

  if (statsLoading) {
    return (
      <Box sx={{ p: 2, bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Loading performance trends...</Typography>
      </Box>
    );
  }

  if (statsError || !statsData) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Unable to load performance trends</Typography>
      </Alert>
    );
  }

  // Prepare data for main line chart (advanced metrics over time)
  // Sort by game_date to ensure chronological order (oldest to newest, so newest appears on right)
  const sortedStats = [...statsData.stats]
    .slice(0, 20)
    .sort((a, b) => {
      const dateA = gameDatesData?.get(a.game_id) || a.created_at;
      const dateB = gameDatesData?.get(b.game_id) || b.created_at;
      if (!dateA || !dateB) return 0;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

  const mainChartData = sortedStats
    .map((stat, index) => {
      // Get game date from fetched data or use created_at as fallback
      let dateLabel = '';
      const gameDate = gameDatesData?.get(stat.game_id);
      if (gameDate) {
        const date = new Date(gameDate);
        if (!isNaN(date.getTime())) {
          dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
        }
      } else if (stat.created_at) {
        // Fallback to created_at if game_date not available
        const date = new Date(stat.created_at);
        if (!isNaN(date.getTime())) {
          dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
        }
      }
      
      return {
        index: index + 1, // Numeric index for x-axis positioning
        date: dateLabel,
        PER: stat.advanced_playerefficiencyrating > 0 ? stat.advanced_playerefficiencyrating : null,
        ORtg: stat.advanced_offensiverating > 0 ? stat.advanced_offensiverating : null,
        DRtg: stat.advanced_defensiverating > 0 ? stat.advanced_defensiverating : null,
        TS: stat.advanced_trueshootingpercentage > 0 ? (stat.advanced_trueshootingpercentage * 100) : null,
        Usage: stat.advanced_usagepercentage > 0 ? (stat.advanced_usagepercentage * 100) : null,
      };
    });

  if (mainChartData.length === 0) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>No game data available</Typography>
      </Alert>
    );
  }

  return (
    <Box ref={containerRef} sx={{ width: '100%', bgcolor: '#000000', position: 'relative' }}>
      {/* Main Line Chart Container */}
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          {/* Main Line Chart - Advanced Metrics Over Time */}
          <Box sx={{ width: '100%', overflow: 'hidden' }}>
            <LineChart
              width={chartWidth}
              height={400}
              series={[
                {
                  data: mainChartData.map((d) => d.PER),
                  label: 'PER',
                  id: 'per',
                  color: primaryColor,
                  showMarkers: false,
                },
                {
                  data: mainChartData.map((d) => d.ORtg),
                  label: 'ORtg',
                  id: 'ortg',
                  color: secondaryColor,
                  showMarkers: false,
                },
                {
                  data: mainChartData.map((d) => d.DRtg),
                  label: 'DRtg',
                  id: 'drtg',
                  color: '#FF6B6B',
                  showMarkers: false,
                },
                {
                  data: mainChartData.map((d) => d.TS),
                  label: 'TS%',
                  id: 'ts',
                  color: '#4ECDC4',
                  showMarkers: false,
                },
                {
                  data: mainChartData.map((d) => d.Usage),
                  label: 'Usage%',
                  id: 'usage',
                  color: '#FFE66D',
                  showMarkers: false,
                },
              ]}
              xAxis={[{
                data: mainChartData.map((d) => d.index), // Use numeric indices for positioning
                label: 'Date',
                labelStyle: { fill: '#FFFFFF' },
                tickLabelStyle: { fill: '#FFFFFF', fontSize: 12 },
                valueFormatter: (value) => {
                  // Map numeric index to date string
                  const num = Number(value);
                  const dataPoint = mainChartData.find(d => d.index === num);
                  if (dataPoint && dataPoint.date) {
                    return dataPoint.date;
                  }
                  return String(value); // Fallback to number if date is empty
                },
                tickMinStep: 1,
              }]}
              yAxis={[{
                labelStyle: { fill: '#FFFFFF' },
                tickLabelStyle: { fill: '#FFFFFF', fontSize: 12 },
              }]}
              grid={{ vertical: true, horizontal: true }}
              sx={{
                width: '100%',
                maxWidth: '100%',
                bgcolor: '#000000',
                '& .MuiChartsGrid-line': {
                  stroke: '#333333',
                  strokeWidth: 1,
                },
                '& .MuiChartsLegend-root': {
                  color: '#FFFFFF',
                },
                '& .MuiLineElement-root': {
                  strokeWidth: 2,
                },
                '& .MuiMarkElement-root': {
                  display: 'none !important',
                },
                '& circle': {
                  display: 'none !important',
                },
                '& .MuiChartsMark': {
                  display: 'none !important',
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

