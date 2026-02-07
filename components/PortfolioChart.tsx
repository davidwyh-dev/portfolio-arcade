"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RetroCard } from "./ui/RetroCard";
import { RetroButton } from "./ui/RetroButton";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type ChartMode = "value" | "gainLoss";

interface PortfolioChartProps {
  selectedBenchmark: "VOO" | "QQQ" | "DIA";
}

export function PortfolioChart({ selectedBenchmark }: PortfolioChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("value");
  const historicalData = useQuery(api.portfolio.getHistoricalValues, {
    benchmarkTicker: selectedBenchmark,
  });

  if (!historicalData) {
    return (
      <RetroCard glowColor="cyan" className="animate-pulse">
        <div className="h-96" />
      </RetroCard>
    );
  }

  if (historicalData.length === 0) {
    return (
      <RetroCard glowColor="cyan">
        <div className="flex h-96 items-center justify-center">
          <p className="font-terminal text-base text-foreground/50">
            No historical data available. Historical prices are needed to display
            this chart.
          </p>
        </div>
      </RetroCard>
    );
  }

  // Benchmark names for display
  const benchmarkNames = {
    VOO: "S&P 500",
    QQQ: "NASDAQ-100",
    DIA: "Dow Jones",
  };

  // Format data for chart - use short date format
  const chartData = historicalData.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    fullDate: item.date,
    portfolioValue: item.totalValue,
    gainLoss: item.gainLoss,
    timeWeightedReturn: item.timeWeightedReturn,
    benchmarkTimeWeightedReturn: item.benchmarkTimeWeightedReturn,
  }));

  // Determine color based on latest time-weighted return
  const latestReturn = historicalData[historicalData.length - 1]?.timeWeightedReturn ?? 0;
  const isPositiveReturn = latestReturn >= 0;
  
  // Determine if latest gain/loss is positive
  const latestGainLoss = historicalData[historicalData.length - 1]?.gainLoss ?? 0;
  const isPositiveGainLoss = latestGainLoss >= 0;
  
  // Color scheme matching the widget above
  const returnLineColor = isPositiveReturn
    ? "rgba(57, 255, 20, 1)" // neon-green
    : "rgba(255, 7, 58, 1)"; // neon-red
  const returnAxisColor = isPositiveReturn
    ? "rgba(57, 255, 20, 0.8)"
    : "rgba(255, 7, 58, 0.8)";
  const returnAxisTickColor = isPositiveReturn
    ? "rgba(57, 255, 20, 0.5)"
    : "rgba(255, 7, 58, 0.5)";

  // Left Y-axis colors based on mode
  const leftAxisColor = chartMode === "value"
    ? "rgba(0, 255, 255, 0.8)" // cyan for value mode
    : "rgba(255, 0, 255, 0.8)"; // magenta for G/L mode
  const leftAxisTickColor = chartMode === "value"
    ? "rgba(0, 255, 255, 0.5)"
    : "rgba(255, 0, 255, 0.5)";

  const chartTitle = chartMode === "value" 
    ? "PORTFOLIO VALUE & TIME-WEIGHTED RETURN"
    : "GAIN/LOSS & TIME-WEIGHTED RETURN";
  
  const chartSubtitle = chartMode === "value"
    ? "Historical performance over time"
    : "Unrealized gains and losses over time";

  return (
    <RetroCard glowColor="cyan">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-terminal text-lg text-foreground/50">
            {chartTitle}
          </h3>
          <p className="mt-1 font-terminal text-sm text-foreground/30">
            {chartSubtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <RetroButton
            variant="primary"
            size="sm"
            onClick={() => setChartMode("value")}
            className={chartMode !== "value" ? "opacity-40" : ""}
          >
            VALUE
          </RetroButton>
          <RetroButton
            variant="secondary"
            size="sm"
            onClick={() => setChartMode("gainLoss")}
            className={chartMode !== "gainLoss" ? "opacity-40" : ""}
          >
            G/L
          </RetroButton>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(0, 255, 255, 0.1)"
          />
          <XAxis
            dataKey="date"
            stroke="rgba(255, 255, 255, 0.5)"
            tick={{ fill: "rgba(255, 255, 255, 0.5)", fontSize: 12 }}
            tickLine={{ stroke: "rgba(255, 255, 255, 0.3)" }}
          />
          <YAxis
            yAxisId="left"
            stroke={leftAxisColor}
            tick={{ fill: leftAxisColor, fontSize: 12 }}
            tickLine={{ stroke: leftAxisTickColor }}
            tickFormatter={(value) => {
              if (value >= 1000000) {
                return `$${(value / 1000000).toFixed(1)}M`;
              } else if (value >= 1000) {
                return `$${(value / 1000).toFixed(0)}K`;
              }
              return `$${value.toFixed(0)}`;
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke={returnAxisColor}
            tick={{ fill: returnAxisColor, fontSize: 12 }}
            tickLine={{ stroke: returnAxisTickColor }}
            tickFormatter={(value) => `${value.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(0, 0, 0, 0.9)",
              border: "1px solid rgba(0, 255, 255, 0.5)",
              borderRadius: "4px",
              fontFamily: "monospace",
            }}
            labelStyle={{ color: "rgba(255, 255, 255, 0.8)" }}
            formatter={(value: any, name: string) => {
              if (name === "Portfolio Value" || name === "Gain/Loss") {
                return [formatCurrency(value), name];
              } else if (name === "Time-Weighted Return" || name.includes("Benchmark")) {
                return [`${value.toFixed(2)}%`, name];
              }
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload.length > 0) {
                return payload[0].payload.fullDate;
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{
              fontFamily: "monospace",
              fontSize: "12px",
              paddingTop: "10px",
            }}
            iconType="line"
          />
          <Bar
            yAxisId="left"
            dataKey={chartMode === "value" ? "portfolioValue" : "gainLoss"}
            name={chartMode === "value" ? "Portfolio Value" : "Gain/Loss"}
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => {
              if (chartMode === "value") {
                return <Cell key={`cell-${index}`} fill="rgba(0, 255, 255, 0.6)" />;
              } else {
                const color = entry.gainLoss >= 0 
                  ? "rgba(57, 255, 20, 0.6)" // green for gains
                  : "rgba(255, 7, 58, 0.6)"; // red for losses
                return <Cell key={`cell-${index}`} fill={color} />;
              }
            })}
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="timeWeightedReturn"
            stroke={returnLineColor}
            strokeWidth={2}
            dot={{ fill: returnLineColor, r: 3 }}
            name="Time-Weighted Return"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="benchmarkTimeWeightedReturn"
            stroke="rgba(255, 0, 255, 1)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: "rgba(255, 0, 255, 1)", r: 3 }}
            name={`${benchmarkNames[selectedBenchmark]} Benchmark`}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </RetroCard>
  );
}
