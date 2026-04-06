import { useMemo } from 'react';
import { Box, Typography } from '@mui/joy';
import {
  CartesianGrid,
  Line,
  RechartsLineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useProspectRankingHistory } from '../../hooks/useProspectRankingHistory';
import { useDraftUserRankingHistory } from '../../hooks/useDraftUserRankings';

function formatShortDate(date: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface DraftTrendModuleProps {
  prospectId?: string | null;
  draftYear?: number | null;
}

export default function DraftTrendModule({ prospectId, draftYear }: DraftTrendModuleProps) {
  const { data: marketHistory } = useProspectRankingHistory(prospectId ?? undefined);
  const { data: myHistory } = useDraftUserRankingHistory(prospectId ?? undefined, draftYear);

  const chartData = useMemo(() => {
    if (!prospectId) return [];
    const byDate = new Map<string, { marketAvg?: number; marketCount?: number; myRank?: number }>();
    for (const row of marketHistory ?? []) {
      const day = row.snapshot_week;
      if (!byDate.has(day)) byDate.set(day, {});
      const current = byDate.get(day)!;
      current.marketAvg = (current.marketAvg ?? 0) + row.rank;
      current.marketCount = (current.marketCount ?? 0) + 1;
    }
    for (const row of myHistory ?? []) {
      const day = row.changed_at.slice(0, 10);
      if (!byDate.has(day)) byDate.set(day, {});
      byDate.get(day)!.myRank = row.rank;
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, value]) => ({
        day: formatShortDate(day),
        marketAvg:
          value.marketAvg != null
            ? Number((value.marketAvg / Math.max(value.marketCount ?? 1, 1)).toFixed(2))
            : null,
        myRank: value.myRank ?? null,
      }));
  }, [marketHistory, myHistory, prospectId]);

  const chartConfig: ChartConfig = {
    marketAvg: { label: 'Stock Aggregate', color: 'var(--chart-2)' },
    myRank: { label: 'My Rank', color: 'var(--chart-5)' },
  };

  if (!prospectId) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography level="body-sm" sx={{ color: '#a1a1aa' }}>
          Select a prospect on the board to show trend history.
        </Typography>
      </Box>
    );
  }

  if (chartData.length === 0) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography level="body-sm" sx={{ color: '#a1a1aa' }}>
          Not enough trend history yet.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography level="title-sm" sx={{ mb: 1, fontWeight: 700, color: '#e4e4e7' }}>
        Ranking Movement
      </Typography>
      <ChartContainer config={chartConfig} className="dark min-h-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <RechartsLineChart data={chartData} margin={{ left: 2, right: 8, top: 8, bottom: 2 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#a1a1aa' }}
              domain={['auto', 'auto']}
              reversed
            />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <Line dataKey="marketAvg" type="monotone" stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls />
            <Line dataKey="myRank" type="monotone" stroke="var(--chart-5)" strokeWidth={2.5} dot={false} connectNulls />
          </RechartsLineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Box>
  );
}
