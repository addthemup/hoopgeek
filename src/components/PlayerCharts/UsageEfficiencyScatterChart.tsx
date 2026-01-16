import { useState, useRef, useEffect } from 'react';
import { Box, Typography, Alert, IconButton, Card } from '@mui/joy';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { InfoOutlined } from '@mui/icons-material';
import { usePlayerGameStats } from '../../hooks/usePlayerGameStats';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';
import { useMediaQuery } from '@mui/material';

interface UsageEfficiencyScatterChartProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

export default function UsageEfficiencyScatterChart({ playerId, seasonYear, teamAbbreviation }: UsageEfficiencyScatterChartProps) {
  const { data: statsData, isLoading: statsLoading, error: statsError } = usePlayerGameStats(playerId, seasonYear);
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const playerColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#4CAF50';

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        const tooltipElement = document.getElementById('scatter-chart-tooltip');
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

  // Fetch boxscore data for points per game
  const { data: boxscoreData, isLoading: boxscoreLoading } = useQuery({
    queryKey: ['player-boxscores-for-scatter', playerId, seasonYear],
    queryFn: async () => {
      let query = supabase
        .from('nba_boxscores')
        .select('game_id, pts')
        .eq('player_id', playerId);

      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }

      const { data, error } = await query.order('game_date', { ascending: false }).limit(15);

      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });

  // Fetch all other players' game stats for comparison
  const { data: allPlayersStatsData, isLoading: allPlayersStatsLoading } = useQuery({
    queryKey: ['all-players-stats-for-scatter', playerId, seasonYear],
    queryFn: async () => {
      let query = supabase
        .from('nba_player_game_stats')
        .select('player_id, game_id, advanced_usagepercentage, advanced_trueshootingpercentage')
        .neq('player_id', playerId)
        .not('advanced_usagepercentage', 'is', null)
        .not('advanced_trueshootingpercentage', 'is', null);

      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }

      const { data, error } = await query.limit(1000); // Limit to avoid too much data

      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });

  // Fetch boxscore data for all other players
  const { data: allPlayersBoxscoreData, isLoading: allPlayersBoxscoreLoading } = useQuery({
    queryKey: ['all-players-boxscores-for-scatter', playerId, seasonYear],
    queryFn: async () => {
      if (!allPlayersStatsData || allPlayersStatsData.length === 0) return [];

      const gameIds = [...new Set(allPlayersStatsData.map((stat: any) => stat.game_id))];
      
      let query = supabase
        .from('nba_boxscores')
        .select('player_id, game_id, pts')
        .neq('player_id', playerId)
        .in('game_id', gameIds.slice(0, 500)); // Limit to avoid query size issues

      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId && !!allPlayersStatsData && allPlayersStatsData.length > 0,
  });

  if (statsLoading || boxscoreLoading || allPlayersStatsLoading || allPlayersBoxscoreLoading) {
    return (
      <Box sx={{ p: 2, bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Loading usage & efficiency data...</Typography>
      </Box>
    );
  }

  if (statsError || !statsData || !boxscoreData) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>Unable to load usage & efficiency data</Typography>
      </Alert>
    );
  }

  // Combine stats with boxscore data for focused player
  const scatterData = statsData.stats
    .slice(0, 15) // Last 15 games
    .map((stat) => {
      const boxscore = boxscoreData.find((b: any) => b.game_id === stat.game_id);
      return {
        id: stat.game_id,
        x: (stat.advanced_usagepercentage || 0) * 100,
        y: (stat.advanced_trueshootingpercentage || 0) * 100,
        points: boxscore?.pts || 0,
      };
    })
    .filter((d) => d.x > 0 && d.y > 0);

  // Combine stats with boxscore data for all other players
  const allPlayersScatterData = (allPlayersStatsData || [])
    .map((stat: any) => {
      const boxscore = allPlayersBoxscoreData?.find((b: any) => 
        b.game_id === stat.game_id && b.player_id === stat.player_id
      );
      return {
        id: `${stat.player_id}-${stat.game_id}`,
        x: (stat.advanced_usagepercentage || 0) * 100,
        y: (stat.advanced_trueshootingpercentage || 0) * 100,
        points: boxscore?.pts || 0,
      };
    })
    .filter((d) => d.x > 0 && d.y > 0);

  if (scatterData.length === 0) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#000000' }}>
        <Typography sx={{ color: '#FFFFFF' }}>No data available for usage & efficiency scatter plot</Typography>
      </Alert>
    );
  }

  const handleToggleTooltip = () => {
    setTooltipOpen(!tooltipOpen);
  };

  return (
    <Box sx={{ width: '100%', p: 2, bgcolor: '#000000', position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography level="h4" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
            Usage & Efficiency Scatter Plot
          </Typography>
          <Typography level="body-sm" sx={{ mt: 1, color: '#CCCCCC' }}>
            Usage % vs True Shooting % (Last 15 Games)
          </Typography>
        </Box>
        <IconButton
          ref={buttonRef}
          size="sm"
          variant="plain"
          onClick={handleToggleTooltip}
          sx={{
            color: 'rgba(255, 255, 255, 0.6)',
            '&:hover': {
              color: '#FFFFFF',
              bgcolor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <InfoOutlined sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      {tooltipOpen && (
        <Card
          id="scatter-chart-tooltip"
          variant="soft"
          sx={{
            position: 'absolute',
            top: 60,
            right: 8,
            zIndex: 20,
            maxWidth: 300,
            bgcolor: '#1a1a1a',
            borderColor: '#333333',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography level="body-sm" sx={{ mb: 1, fontWeight: 600, color: '#FFFFFF' }}>
              Usage vs Efficiency
            </Typography>
            <Typography level="body-xs" sx={{ mb: 0.5, color: 'rgba(255, 255, 255, 0.8)' }}>
              This chart shows the relationship between Usage % (how often a player uses possessions) and True Shooting % (shooting efficiency).
            </Typography>
            <Typography level="body-xs" sx={{ mb: 0.5, color: 'rgba(255, 255, 255, 0.8)' }}>
              Each point represents one game from the player's last 15 games. Points in the top-right quadrant indicate high usage with high efficiency—ideal for star players.
            </Typography>
            <Typography level="body-xs" sx={{ color: '#4CAF50', fontWeight: 500 }}>
              Tip: Larger bubbles indicate more points scored in that game.
            </Typography>
          </Box>
        </Card>
      )}
      <Box sx={{ mb: 3 }}>
        <ScatterChart
          width={600}
          height={400}
        series={[
          {
            data: allPlayersScatterData,
            label: 'Other Players',
            id: 'other-players',
            color: 'rgba(204, 204, 204, 0.05)', // Light grey with 0.05 opacity
            valueFormatter: isMobile ? undefined : (value) => `Usage: ${value.x.toFixed(1)}%, TS%: ${value.y.toFixed(1)}%`,
          },
          {
            data: scatterData,
            label: 'Games',
            id: 'games',
            color: playerColor,
            valueFormatter: (value) => `Usage: ${value.x.toFixed(1)}%, TS%: ${value.y.toFixed(1)}%`,
          },
        ]}
        xAxis={[
          {
            label: 'Usage Percentage (%)',
            min: 0,
            max: 40,
            labelStyle: { fill: '#FFFFFF' },
            tickLabelStyle: { fill: '#CCCCCC' },
          },
        ]}
        yAxis={[
          {
            label: 'True Shooting %',
            min: 0,
            max: 100,
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
          Each point represents a game. Bubble size indicates points scored.
        </Typography>
      </Box>
    </Box>
  );
}

