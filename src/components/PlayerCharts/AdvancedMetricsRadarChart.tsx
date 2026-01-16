import { useState, useRef, useEffect } from 'react';
import { Box, Typography, Alert, IconButton, Card } from '@mui/joy';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { InfoOutlined } from '@mui/icons-material';
import { usePlayerGameStats } from '../../hooks/usePlayerGameStats';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';

interface AdvancedMetricsRadarChartProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
  playerPosition?: string;
}

// Mock overall league averages - in production, fetch from nba_league_averages table
const OVERALL_LEAGUE_AVERAGES = {
  advanced_offensiverating: 110,
  advanced_defensiverating: 110,
  advanced_assistratio: 20,
  advanced_reboundpercentage: 0.1,
  advanced_usagepercentage: 0.2,
  advanced_trueshootingpercentage: 0.56,
  advanced_playerEfficiencyRating: 15,
};

// Positional ranges for percentile calculation
// These represent typical min/max values for each position
const POSITIONAL_RANGES: Record<string, {
  advanced_offensiverating: { min: number; max: number };
  advanced_defensiverating: { min: number; max: number };
  advanced_assistratio: { min: number; max: number };
  advanced_reboundpercentage: { min: number; max: number };
  advanced_usagepercentage: { min: number; max: number };
  advanced_trueshootingpercentage: { min: number; max: number };
}> = {
  'PG': {
    advanced_offensiverating: { min: 95, max: 125 },
    advanced_defensiverating: { min: 100, max: 120 },
    advanced_assistratio: { min: 10, max: 45 },
    advanced_reboundpercentage: { min: 0.03, max: 0.15 },
    advanced_usagepercentage: { min: 0.12, max: 0.35 },
    advanced_trueshootingpercentage: { min: 0.45, max: 0.65 },
  },
  'SG': {
    advanced_offensiverating: { min: 95, max: 125 },
    advanced_defensiverating: { min: 100, max: 120 },
    advanced_assistratio: { min: 5, max: 30 },
    advanced_reboundpercentage: { min: 0.04, max: 0.16 },
    advanced_usagepercentage: { min: 0.12, max: 0.35 },
    advanced_trueshootingpercentage: { min: 0.45, max: 0.65 },
  },
  'SF': {
    advanced_offensiverating: { min: 95, max: 125 },
    advanced_defensiverating: { min: 100, max: 120 },
    advanced_assistratio: { min: 5, max: 25 },
    advanced_reboundpercentage: { min: 0.05, max: 0.18 },
    advanced_usagepercentage: { min: 0.12, max: 0.35 },
    advanced_trueshootingpercentage: { min: 0.45, max: 0.65 },
  },
  'PF': {
    advanced_offensiverating: { min: 95, max: 125 },
    advanced_defensiverating: { min: 100, max: 120 },
    advanced_assistratio: { min: 3, max: 20 },
    advanced_reboundpercentage: { min: 0.06, max: 0.20 },
    advanced_usagepercentage: { min: 0.12, max: 0.35 },
    advanced_trueshootingpercentage: { min: 0.45, max: 0.65 },
  },
  'C': {
    advanced_offensiverating: { min: 95, max: 125 },
    advanced_defensiverating: { min: 100, max: 120 },
    advanced_assistratio: { min: 2, max: 18 },
    advanced_reboundpercentage: { min: 0.08, max: 0.25 },
    advanced_usagepercentage: { min: 0.12, max: 0.35 },
    advanced_trueshootingpercentage: { min: 0.45, max: 0.65 },
  },
};

// Helper function to calculate percentile (0-100)
const calculatePercentile = (value: number, min: number, max: number): number => {
  if (max === min) return 50; // If no range, return median
  const percentile = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, percentile)); // Clamp between 0 and 100
};


export default function AdvancedMetricsRadarChart({ playerId, seasonYear, teamAbbreviation, playerPosition }: AdvancedMetricsRadarChartProps) {
  const { data, isLoading, error } = usePlayerGameStats(playerId, seasonYear);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const playerColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#4CAF50';

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        const tooltipElement = document.getElementById('radar-chart-tooltip');
        if (tooltipElement && !tooltipElement.contains(event.target as Node)) {
          setTooltipOpen(false);
        }
      }
    };

    if (tooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tooltipOpen]);

  // Get positional ranges for percentile calculation
  const getPositionalRanges = () => {
    if (playerPosition && POSITIONAL_RANGES[playerPosition]) {
      return POSITIONAL_RANGES[playerPosition];
    }
    // Default ranges if position not found
    return {
      advanced_offensiverating: { min: 95, max: 125 },
      advanced_defensiverating: { min: 100, max: 120 },
      advanced_assistratio: { min: 2, max: 45 },
      advanced_reboundpercentage: { min: 0.03, max: 0.25 },
      advanced_usagepercentage: { min: 0.12, max: 0.35 },
      advanced_trueshootingpercentage: { min: 0.45, max: 0.65 },
    };
  };

  const positionalRanges = getPositionalRanges();

  // Query all players at this position to get actual min/max for more accurate percentiles
  const { data: positionStats } = useQuery({
    queryKey: ['position-stats', playerPosition, seasonYear],
    queryFn: async () => {
      if (!playerPosition || !seasonYear) return null;

      // Get all players at this position
      const { data: players, error: playersError } = await supabase
        .from('nba_players')
        .select('id')
        .eq('position', playerPosition)
        .limit(200);

      if (playersError || !players) return null;

      const playerIds = players.map(p => p.id);

      // Get season averages for all players at this position
      const { data: stats, error: statsError } = await supabase
        .from('nba_player_game_stats')
        .select('advanced_offensiverating, advanced_defensiverating, advanced_assistratio, advanced_reboundpercentage, advanced_usagepercentage, advanced_trueshootingpercentage')
        .in('player_id', playerIds)
        .eq('season_year', seasonYear)
        .not('advanced_offensiverating', 'is', null);

      if (statsError || !stats) return null;

      // Calculate min/max for each metric
      const metrics = {
        advanced_offensiverating: stats.map(s => s.advanced_offensiverating).filter(v => v !== null) as number[],
        advanced_defensiverating: stats.map(s => s.advanced_defensiverating).filter(v => v !== null) as number[],
        advanced_assistratio: stats.map(s => s.advanced_assistratio).filter(v => v !== null) as number[],
        advanced_reboundpercentage: stats.map(s => s.advanced_reboundpercentage).filter(v => v !== null) as number[],
        advanced_usagepercentage: stats.map(s => s.advanced_usagepercentage).filter(v => v !== null) as number[],
        advanced_trueshootingpercentage: stats.map(s => s.advanced_trueshootingpercentage).filter(v => v !== null) as number[],
      };

      return {
        advanced_offensiverating: { min: Math.min(...metrics.advanced_offensiverating), max: Math.max(...metrics.advanced_offensiverating) },
        advanced_defensiverating: { min: Math.min(...metrics.advanced_defensiverating), max: Math.max(...metrics.advanced_defensiverating) },
        advanced_assistratio: { min: Math.min(...metrics.advanced_assistratio), max: Math.max(...metrics.advanced_assistratio) },
        advanced_reboundpercentage: { min: Math.min(...metrics.advanced_reboundpercentage), max: Math.max(...metrics.advanced_reboundpercentage) },
        advanced_usagepercentage: { min: Math.min(...metrics.advanced_usagepercentage), max: Math.max(...metrics.advanced_usagepercentage) },
        advanced_trueshootingpercentage: { min: Math.min(...metrics.advanced_trueshootingpercentage), max: Math.max(...metrics.advanced_trueshootingpercentage) },
      };
    },
    enabled: !!playerPosition && !!seasonYear,
  });

  // Use actual position stats if available, otherwise use estimated ranges
  const ranges = positionStats || positionalRanges;

  if (isLoading) {
    return (
      <Box sx={{ p: 2, bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Loading advanced metrics...</Typography>
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Unable to load advanced metrics data</Typography>
      </Alert>
    );
  }

  const { seasonAverages } = data;

  // Calculate percentiles for each metric
  const chartData = [
    {
      metric: 'ORtg',
      value: calculatePercentile(
        seasonAverages.advanced_offensiverating || 0,
        ranges.advanced_offensiverating.min,
        ranges.advanced_offensiverating.max
      ),
    },
    {
      metric: 'DRtg',
      value: calculatePercentile(
        seasonAverages.advanced_defensiverating || 0,
        ranges.advanced_defensiverating.min,
        ranges.advanced_defensiverating.max
      ),
    },
    {
      metric: 'AST%',
      value: calculatePercentile(
        seasonAverages.advanced_assistratio || 0,
        ranges.advanced_assistratio.min,
        ranges.advanced_assistratio.max
      ),
    },
    {
      metric: 'REB%',
      value: calculatePercentile(
        (seasonAverages.advanced_reboundpercentage || 0) * 100,
        ranges.advanced_reboundpercentage.min * 100,
        ranges.advanced_reboundpercentage.max * 100
      ),
    },
    {
      metric: 'USG%',
      value: calculatePercentile(
        (seasonAverages.advanced_usagepercentage || 0) * 100,
        ranges.advanced_usagepercentage.min * 100,
        ranges.advanced_usagepercentage.max * 100
      ),
    },
    {
      metric: 'TS%',
      value: calculatePercentile(
        (seasonAverages.advanced_trueshootingpercentage || 0) * 100,
        ranges.advanced_trueshootingpercentage.min * 100,
        ranges.advanced_trueshootingpercentage.max * 100
      ),
    },
  ];

  const handleToggleTooltip = () => {
    setTooltipOpen(!tooltipOpen);
  };

  return (
    <Box sx={{ width: '100%', height: '100%', bgcolor: '#000000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconButton
        ref={buttonRef}
        size="sm"
        variant="plain"
        onClick={handleToggleTooltip}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          color: 'rgba(255, 255, 255, 0.6)',
          '&:hover': {
            color: '#FFFFFF',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <InfoOutlined sx={{ fontSize: 18 }} />
      </IconButton>
      {tooltipOpen && (
        <Card
          id="radar-chart-tooltip"
          variant="soft"
          sx={{
            position: 'absolute',
            top: 40,
            right: 8,
            zIndex: 20,
            maxWidth: 280,
            bgcolor: '#1a1a1a',
            borderColor: '#333333',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography level="body-sm" sx={{ mb: 1, fontWeight: 600, color: '#FFFFFF' }}>
              Percentile Rankings
            </Typography>
            <Typography level="body-xs" sx={{ mb: 0.5, color: 'rgba(255, 255, 255, 0.8)' }}>
              Players are graded on their percentile rank compared to all players in the league at their position.
            </Typography>
            <Typography level="body-xs" sx={{ color: '#ff6b6b', fontWeight: 500 }}>
              Note: A HIGH defensive rating (DRtg) percentile indicates poor defense—lower is better for defensive rating.
            </Typography>
          </Box>
        </Card>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData}>
          <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: '#FFFFFF', fontSize: 13, fontWeight: 600 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={false}
            axisLine={false}
          />
          <Radar
            dataKey="value"
            stroke={playerColor}
            fill={playerColor}
            fillOpacity={0.4}
            strokeWidth={3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </Box>
  );
}

