/**
 * Prospect drawer module: rank over time by source (draft_rankings).
 * Renders a Kibo line chart: one line per source (Tankathon, NBADraft.net, The Athletic, ESPN), optional avg.
 */

import { useMemo } from "react";
import { Box, Typography } from "@mui/joy";
import {
  CartesianGrid,
  Line,
  ResponsiveContainer,
  RechartsLineChart,
  XAxis,
  YAxis,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useProspectRankingHistory } from "../../hooks/useProspectRankingHistory";

const SOURCE_LABELS: Record<string, string> = {
  tankathon: "Tankathon",
  nbadraft_net: "NBADraft.net",
  the_athletic: "The Athletic",
  espn: "ESPN",
};

const SOURCE_ORDER = ["tankathon", "nbadraft_net", "the_athletic", "espn"];

function formatWeekShort(snapshot_week: string): string {
  try {
    const d = new Date(snapshot_week + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return snapshot_week;
  }
}

interface ProspectRankingOverTimeModuleProps {
  prospectId: string;
}

export default function ProspectRankingOverTimeModule({
  prospectId,
}: ProspectRankingOverTimeModuleProps) {
  const { data: rows, isLoading, error } = useProspectRankingHistory(prospectId);

  const { chartData, chartConfig, dataKeys } = useMemo(() => {
    if (!rows || rows.length === 0) {
      return {
        chartData: [] as Array<Record<string, string | number | null>>,
        chartConfig: {} as ChartConfig,
        dataKeys: [] as string[],
      };
    }
    const weekSet = new Set<string>();
    const gridMap = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const w = r.snapshot_week;
      weekSet.add(w);
      if (!gridMap.has(w)) gridMap.set(w, new Map());
      gridMap.get(w)!.set(r.source, r.rank);
    }
    const weeks = Array.from(weekSet).sort();
    const config: ChartConfig = {};
    const keys: string[] = [];
    SOURCE_ORDER.forEach((src, i) => {
      config[src] = {
        label: SOURCE_LABELS[src] ?? src,
        color: `var(--chart-${(i % 5) + 1})`,
      };
      keys.push(src);
    });
    config.avg = { label: "Avg", color: "var(--chart-5)" };
    keys.push("avg");

    const chartData = weeks.map((week) => {
      const bySource = gridMap.get(week)!;
      const point: Record<string, string | number | null> = {
        week: formatWeekShort(week),
      };
      let sum = 0;
      let count = 0;
      SOURCE_ORDER.forEach((src) => {
        const v = bySource.get(src);
        point[src] = v ?? null;
        if (v != null) {
          sum += v;
          count++;
        }
      });
      point.avg = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
      return point;
    });

    return { chartData, chartConfig: config, dataKeys: keys };
  }, [rows]);

  if (isLoading) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Loading ranking history…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography level="body-sm" sx={{ color: "danger.500" }}>
          Could not load ranking history.
        </Typography>
      </Box>
    );
  }

  if (chartData.length === 0) {
    return (
      <Box sx={{ py: 2 }}>
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          No ranking history yet. Rankings are updated weekly from Tankathon,
          NBADraft.net, The Athletic, and ESPN.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        minHeight: 280,
        bgcolor: "#1a1a1a",
        borderRadius: "md",
        border: "1px solid",
        borderColor: "#333333",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          px: 1.5,
          py: 0.5,
          borderLeft: "1px solid",
          borderBottom: "1px solid",
          borderColor: "#333333",
          borderTopRightRadius: 6,
          bgcolor: "#252525",
          zIndex: 10,
        }}
      >
        <Typography
          level="body-xs"
          sx={{
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "0.06em",
            color: "#CCCCCC",
            textTransform: "uppercase",
          }}
        >
          Draft Stock
        </Typography>
      </Box>
      <ChartContainer config={chartConfig}>
        <ResponsiveContainer width="100%" height={280}>
          <RechartsLineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 0, right: 56, top: 28, bottom: 8 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              axisLine={false}
              dataKey="week"
              tickLine={false}
              tickMargin={8}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              domain={["auto", "auto"]}
            />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            {dataKeys.map((key, i) => (
              <Line
                key={key}
                dataKey={key}
                dot={false}
                stroke={
                  key === "avg"
                    ? "var(--chart-5)"
                    : `var(--chart-${(i % 4) + 1})`
                }
                strokeWidth={key === "avg" ? 2.5 : 2}
                type="monotone"
                connectNulls
                name={chartConfig[key]?.label ?? key}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </Box>
  );
}
