import { Box, Typography, Alert } from '@mui/joy';
import { BarChart } from '@mui/x-charts/BarChart';
import { usePlayerGameStats } from '../../hooks/usePlayerGameStats';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';
import { useRef, useEffect, useState } from 'react';

interface FourFactorsBarChartProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

// Mock league averages - in production, fetch from nba_league_averages table
const LEAGUE_AVERAGES = {
  fourfactors_effectivefieldgoalpercentage: 0.54,
  fourfactors_freethrowattemptrate: 0.25,
  fourfactors_offensivereboundpercentage: 0.25,
  fourfactors_turnoverpercentage: 0.13,
};

export default function FourFactorsBarChart({ playerId, seasonYear, teamAbbreviation }: FourFactorsBarChartProps) {
  const { data, isLoading, error } = usePlayerGameStats(playerId, seasonYear);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(400);
  const [chartHeight, setChartHeight] = useState(250);

  const playerColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#4CAF50';
  const leagueColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#FF9800';

  // Update chart dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        setChartWidth(Math.max(300, containerWidth - 32)); // Account for padding
        setChartHeight(Math.max(200, Math.min(300, (containerWidth - 32) * 0.5))); // Responsive height
      }
    };

    // Use a small delay to ensure container is rendered
    const timeoutId = setTimeout(updateDimensions, 0);
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [data]); // Recalculate when data loads

  if (isLoading) {
    return (
      <Box sx={{ p: 2, bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Loading four factors data...</Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Unable to load four factors data</Typography>
      </Alert>
    );
  }

  const { seasonAverages } = data;

  const chartData = [
    {
      factor: 'eFG%',
      player: (seasonAverages.fourfactors_effectivefieldgoalpercentage || 0) * 100,
      league: LEAGUE_AVERAGES.fourfactors_effectivefieldgoalpercentage * 100,
    },
    {
      factor: 'FTA Rate',
      player: (seasonAverages.fourfactors_freethrowattemptrate || 0) * 100,
      league: LEAGUE_AVERAGES.fourfactors_freethrowattemptrate * 100,
    },
    {
      factor: 'OREB%',
      player: (seasonAverages.fourfactors_offensivereboundpercentage || 0) * 100,
      league: LEAGUE_AVERAGES.fourfactors_offensivereboundpercentage * 100,
    },
    {
      factor: 'TOV%',
      player: (seasonAverages.fourfactors_turnoverpercentage || 0) * 100,
      league: LEAGUE_AVERAGES.fourfactors_turnoverpercentage * 100,
    },
  ];

  return (
    <Box ref={containerRef} sx={{ width: '100%', p: 2, bgcolor: '#000000' }}>
      <Typography level="h4" sx={{ mb: 2, fontWeight: 'bold', color: '#FFFFFF' }}>
        Four Factors Comparison
      </Typography>
      <Typography level="body-sm" sx={{ mb: 3, color: '#CCCCCC' }}>
        Player vs League Average
      </Typography>
      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        <BarChart
          width={chartWidth}
          height={chartHeight}
        series={[
          {
            data: chartData.map((d) => d.player),
            label: 'Player',
            id: 'player',
            color: playerColor,
          },
          {
            data: chartData.map((d) => d.league),
            label: 'League Avg',
            id: 'league',
            color: leagueColor,
          },
        ]}
        xAxis={[
          {
            data: chartData.map((d) => d.factor),
            scaleType: 'band',
            labelStyle: { fill: '#FFFFFF' },
            tickLabelStyle: { fill: '#FFFFFF' },
          },
        ]}
        yAxis={[
          {
            labelStyle: { fill: '#FFFFFF' },
            tickLabelStyle: { fill: '#CCCCCC' },
          },
        ]}
        sx={{
          width: '100%',
          maxWidth: '100%',
          bgcolor: '#000000',
          '& .MuiChartsLegend-root': {
            color: '#FFFFFF',
          },
        }}
        />
      </Box>
      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
        <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>
          eFG% = Effective Field Goal % | FTA Rate = Free Throw Attempt Rate | OREB% = Offensive Rebound % | TOV% = Turnover % (lower is better)
        </Typography>
      </Box>
    </Box>
  );
}

