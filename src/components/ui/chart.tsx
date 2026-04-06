"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";

export type ChartConfig = Record<
  string,
  { label?: string; color?: string }
>;

const ChartContext = React.createContext<{ config: ChartConfig }>({
  config: {},
});

export function ChartContainer({
  config,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { config: ChartConfig }) {
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={className}
        style={{ width: "100%", minHeight: 280, ...props.style }}
        {...props}
      >
        {children}
      </div>
    </ChartContext.Provider>
  );
}

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer");
  }
  return context;
}

export function ChartTooltip({
  content,
  ...props
}: TooltipProps<number, string> & {
  content?: React.ComponentProps<typeof Tooltip>["content"];
}) {
  const { config } = useChart();
  return (
    <Tooltip
      content={content ?? <ChartTooltipContent />}
      cursor={false}
      {...props}
    />
  );
}

export function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length || !label) return null;
  return (
    <div
      className="rounded-md border bg-card px-3 py-2 shadow-md"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--card)",
        color: "var(--card-foreground)",
      }}
    >
      <p className="text-sm font-medium mb-1.5">{label}</p>
      <div className="flex flex-col gap-1">
        {payload.map((entry) => {
          const conf = config[entry.name];
          return (
            <div
              key={entry.name}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span
                className="shrink-0"
                style={{ color: entry.color }}
              >
                {conf?.label ?? entry.name}
              </span>
              <span className="font-medium tabular-nums">
                {typeof entry.value === "number" ? entry.value : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export {
  CartesianGrid,
  Line,
  RechartsLineChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
};
