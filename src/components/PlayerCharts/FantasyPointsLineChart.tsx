import { Box, Typography, Card, CardContent, Stack } from '@mui/joy';
import { SparkLineChart, SparkLineChartProps } from '@mui/x-charts/SparkLineChart';
import { areaElementClasses, lineElementClasses } from '@mui/x-charts/LineChart';
import { chartsAxisHighlightClasses } from '@mui/x-charts/ChartsAxisHighlight';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { getTeamPrimaryColor, getTeamSecondaryColor } from '../../utils/nbaTeamColors';
import { FANDUEL_SCORING, calculateFantasyPoints } from '../../utils/fantasyScoring';
import { useMemo, useState } from 'react';

interface FantasyPointsLineChartProps {
  playerId: string;
  seasonYear?: string;
  teamAbbreviation?: string;
}

export default function FantasyPointsLineChart({ playerId, seasonYear, teamAbbreviation }: FantasyPointsLineChartProps) {
  const primaryColor = teamAbbreviation ? getTeamPrimaryColor(teamAbbreviation) : '#1D428A';
  const secondaryColor = teamAbbreviation ? getTeamSecondaryColor(teamAbbreviation) : '#FFC72C';
  const [dataIndex, setDataIndex] = useState<null | number>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['player-fantasy-line', playerId, seasonYear],
    queryFn: async () => {
      let query = supabase
        .from('nba_boxscores')
        .select('pts, reb, ast, stl, blk, tov, game_date')
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
    if (!data || data.length === 0) return { fantasyPoints: [], dates: [] };

    const fantasyPoints = data.map((game) => {
      const fp = calculateFantasyPoints({
        pts: Number(game.pts) || 0,
        reb: Number(game.reb) || 0,
        ast: Number(game.ast) || 0,
        stl: Number(game.stl) || 0,
        blk: Number(game.blk) || 0,
        tov: Number(game.tov) || 0,
      } as any, FANDUEL_SCORING);
      return fp;
    });

    const dates = data.map((game) => {
      const date = new Date(game.game_date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    return { fantasyPoints, dates };
  }, [data]);

  if (isLoading) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Typography sx={{ color: '#FFFFFF' }}>Loading fantasy points data...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
        <CardContent>
          <Typography sx={{ color: '#FFFFFF' }}>No fantasy points data available</Typography>
        </CardContent>
      </Card>
    );
  }

  const settings: SparkLineChartProps = {
    data: chartData.fantasyPoints,
    baseline: 'min',
    margin: { bottom: 0, top: 5, left: 0, right: 0 },
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

  const currentValue = chartData.fantasyPoints[dataIndex ?? chartData.fantasyPoints.length - 1];

  return (
    <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333', height: 150 }}>
      <CardContent sx={{ height: '100%', p: { top: 2, right: 2, bottom: 2, left: 0 } }}>
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
          aria-label="Showing fantasy points per game"
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
              {dataIndex === null ? 'Fantasy Pts' : chartData.dates[dataIndex]}
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

