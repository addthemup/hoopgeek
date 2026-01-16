import { Box, Typography, Card, CardContent, Stack } from '@mui/joy';
import { SparkLineChart, SparkLineChartProps } from '@mui/x-charts/SparkLineChart';
import { areaElementClasses, lineElementClasses } from '@mui/x-charts/LineChart';
import { chartsAxisHighlightClasses } from '@mui/x-charts/ChartsAxisHighlight';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';
import { useMemo, useState } from 'react';

interface MinutesLineChartProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

export default function MinutesLineChart({ playerId, seasonYear, teamAbbreviation }: MinutesLineChartProps) {
  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1D428A';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#FFC72C';
  const [dataIndex, setDataIndex] = useState<null | number>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['player-minutes-line', playerId, seasonYear],
    queryFn: async () => {
      let query = supabase
        .from('nba_boxscores')
        .select('min, game_date')
        .eq('player_id', playerId)
        .order('game_date', { ascending: true });

      if (seasonYear) {
        query = query.eq('season_year', seasonYear);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!playerId,
  });

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { minutes: [], dates: [] };

    const minutes = data.map((game) => {
      if (typeof game.min === 'string' && game.min.includes(':')) {
        const [mins, secs] = game.min.split(':').map(Number);
        return mins + (secs / 60);
      }
      return parseFloat(String(game.min || 0));
    });

    const dates = data.map((game) => {
      const date = new Date(game.game_date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    return { minutes, dates };
  }, [data]);

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Typography sx={{ color: '#FFFFFF' }}>Loading minutes data...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Typography sx={{ color: '#FFFFFF' }}>No minutes data available</Typography>
        </CardContent>
      </Card>
    );
  }

  const settings: SparkLineChartProps = {
    data: chartData.minutes,
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

  const currentValue = chartData.minutes[dataIndex ?? chartData.minutes.length - 1];

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
          aria-label="Showing minutes per game"
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
              {dataIndex === null ? 'Minutes' : chartData.dates[dataIndex]}
            </Typography>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-end"
              sx={{ borderBottom: `solid 2px ${primaryColor}40` }}
            >
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 500, color: primaryColor }}>
                {currentValue?.toFixed(1) || '0.0'}
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

