import { Box, Typography, Card, CardContent, Stack } from '@mui/joy';
import { SparkLineChart, SparkLineChartProps } from '@mui/x-charts/SparkLineChart';
import { areaElementClasses, lineElementClasses } from '@mui/x-charts/LineChart';
import { chartsAxisHighlightClasses } from '@mui/x-charts/ChartsAxisHighlight';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';
import { useMemo, useState } from 'react';

interface TrueShootingLineChartProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

export default function TrueShootingLineChart({ playerId, seasonYear, teamAbbreviation }: TrueShootingLineChartProps) {
  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1D428A';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#FFC72C';
  const [dataIndex, setDataIndex] = useState<null | number>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['player-trueshooting-line', playerId, seasonYear],
    queryFn: async () => {
      let statsQuery = supabase
        .from('nba_player_game_stats')
        .select('game_id, advanced_trueshootingpercentage, season_year')
        .eq('player_id', playerId)
        .not('advanced_trueshootingpercentage', 'is', null)
        .order('created_at', { ascending: true });

      if (seasonYear) {
        statsQuery = statsQuery.eq('season_year', seasonYear);
      }

      const { data: statsData, error: statsError } = await statsQuery;

      if (statsError) throw statsError;
      if (!statsData || statsData.length === 0) return [];

      // Get game dates from nba_games
      const gameIds = statsData.map(s => s.game_id);
      const { data: gamesData, error: gamesError } = await supabase
        .from('nba_games')
        .select('game_id, game_date')
        .in('game_id', gameIds)
        .order('game_date', { ascending: true });

      if (gamesError) throw gamesError;

      // Combine stats with game dates
      return statsData.map(stat => {
        const game = gamesData?.find(g => g.game_id === stat.game_id);
        return {
          ts: stat.advanced_trueshootingpercentage,
          game_date: game?.game_date || null,
        };
      }).filter(item => item.game_date !== null);
    },
    enabled: !!playerId,
  });

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { ts: [], dates: [] };

    const ts = data.map((item) => {
      const tsValue = item.ts;
      return tsValue !== null && tsValue !== undefined ? tsValue * 100 : null;
    }).filter((v): v is number => v !== null);

    const dates = data
      .filter((item) => item.ts !== null && item.ts !== undefined && item.game_date)
      .map((item) => {
        const date = new Date(item.game_date!);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      });

    return { ts, dates };
  }, [data]);

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Typography sx={{ color: '#FFFFFF' }}>Loading true shooting data...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error || !data || !chartData.ts.length) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Typography sx={{ color: '#FFFFFF' }}>No true shooting data available</Typography>
        </CardContent>
      </Card>
    );
  }

  const settings: SparkLineChartProps = {
    data: chartData.ts,
    baseline: 'min',
    margin: { bottom: 0, top: 5, left: 4, right: 0 },
    xAxis: { id: 'date-axis', data: chartData.dates },
    yAxis: {
      domainLimit: (_, maxValue: number) => ({
        min: -maxValue / 6,
        max: maxValue,
      }),
    },
    sx: {
      [`& .${areaElementClasses.root}`]: { opacity: 0.2 },
      [`& .${lineElementClasses.root}`]: { strokeWidth: 3 },
      [`& .${chartsAxisHighlightClasses.root}`]: {
        stroke: primaryColor,
        strokeDasharray: 'none',
        strokeWidth: 2,
      },
    },
    slotProps: {
      lineHighlight: { r: 4 },
    },
    clipAreaOffset: { top: 2, bottom: 2 },
    axisHighlight: { x: 'line' },
  };

  const currentValue = chartData.ts[dataIndex ?? chartData.ts.length - 1];

  return (
    <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333', height: 150 }}>
      <CardContent sx={{ height: '100%', p: 2 }}>
        <Box
          onKeyDown={(event) => {
            switch (event.key) {
              case 'ArrowLeft':
                setDataIndex((p) =>
                  p === null ? chartData.dates.length - 1 : (chartData.dates.length + p - 1) % chartData.dates.length,
                );
                break;
              case 'ArrowRight':
                setDataIndex((p) => (p === null ? 0 : (p + 1) % chartData.dates.length));
                break;
              default:
            }
          }}
          onFocus={() => {
            setDataIndex((p) => (p === null ? 0 : p));
          }}
          role="button"
          aria-label="Showing true shooting percentage"
          tabIndex={0}
          width="100%"
          height="100%"
          display="flex"
          justifyContent="center"
          alignItems="center"
        >
          <Stack direction="column" width="100%">
            <Typography
              sx={{
                color: '#CCCCCC',
                fontWeight: 500,
                fontSize: '0.9rem',
                pt: 1,
                mb: 1,
              }}
            >
              {dataIndex === null ? 'True Shooting %' : chartData.dates[dataIndex]}
            </Typography>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-end"
              sx={{ borderBottom: `solid 2px ${primaryColor}40` }}
            >
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 500, color: primaryColor }}>
                {currentValue ? `${currentValue.toFixed(1)}%` : '0.0%'}
              </Typography>
              <SparkLineChart
                height={40}
                width={195}
                area
                showHighlight
                color={primaryColor}
                onHighlightedAxisChange={(axisItems) => {
                  setDataIndex(axisItems[0]?.dataIndex ?? null);
                }}
                highlightedAxis={
                  dataIndex === null
                    ? []
                    : [{ axisId: 'date-axis', dataIndex: dataIndex }]
                }
                {...settings}
              />
            </Stack>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

