"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RetroCard } from "./ui/RetroCard";
import { RetroCheckbox } from "./ui/RetroCheckbox";
import { formatCurrency, formatPercent, formatPercentAbsolute } from "@/lib/utils";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

interface PortfolioSummaryProps {
  includeRealized: boolean;
  onToggleRealized: (value: boolean) => void;
  selectedBenchmark: "VOO" | "QQQ" | "DIA";
  onBenchmarkChange: (value: "VOO" | "QQQ" | "DIA") => void;
}

export function PortfolioSummary({
  includeRealized,
  onToggleRealized,
  selectedBenchmark,
  onBenchmarkChange,
}: PortfolioSummaryProps) {
  const valuationDate = todayISO();

  const queryArgs = useMemo(
    () => ({
      ...(valuationDate ? { valuationDate } : {}),
    }),
    [valuationDate]
  );

  const summary = useQuery(api.portfolio.getSummary, queryArgs);
  const fetchHistoricalPrices = useAction(api.marketData.fetchHistoricalPrices);

  // Check and fetch benchmark historical data
  const vooCached = useQuery(api.marketData.getHistoricalCache, { ticker: "VOO" });
  const qqqCached = useQuery(api.marketData.getHistoricalCache, { ticker: "QQQ" });
  const diaCached = useQuery(api.marketData.getHistoricalCache, { ticker: "DIA" });

  useEffect(() => {
    const fetchBenchmarkData = async (ticker: string) => {
      try {
        await fetchHistoricalPrices({ ticker });
      } catch (err) {
        console.error(`Failed to fetch historical data for ${ticker}:`, err);
      }
    };

    // Check if benchmark data needs to be fetched
    if (vooCached === undefined || qqqCached === undefined || diaCached === undefined) {
      return; // Still loading
    }

    const isCacheStale = (cached: typeof vooCached): boolean => {
      if (!cached) return true;
      const updatedAt = new Date(cached.updatedAt).getTime();
      const now = Date.now();
      return now - updatedAt > 24 * 60 * 60 * 1000; // 24 hours
    };

    if (!vooCached || isCacheStale(vooCached)) {
      void fetchBenchmarkData("VOO");
    }
    if (!qqqCached || isCacheStale(qqqCached)) {
      void fetchBenchmarkData("QQQ");
    }
    if (!diaCached || isCacheStale(diaCached)) {
      void fetchBenchmarkData("DIA");
    }
  }, [vooCached, qqqCached, diaCached, fetchHistoricalPrices]);

  if (!summary) {
    return (
      <div>
        <TopBar
          valuationDate={valuationDate}
          includeRealized={includeRealized}
          onToggleRealized={onToggleRealized}
          selectedBenchmark={selectedBenchmark}
          onBenchmarkChange={onBenchmarkChange}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RetroCard glowColor="cyan" className="animate-pulse">
            <div className="h-20" />
          </RetroCard>
          <RetroCard glowColor="green" className="animate-pulse">
            <div className="h-20" />
          </RetroCard>
          <RetroCard glowColor="yellow" className="animate-pulse">
            <div className="h-20" />
          </RetroCard>
          <RetroCard glowColor="magenta" className="animate-pulse">
            <div className="h-20" />
          </RetroCard>
        </div>
      </div>
    );
  }

  const displayValue = includeRealized
    ? summary.totalValue + summary.realizedGainLoss
    : summary.totalValue;

  const unrealizedGainLoss = summary.totalValue - summary.totalCost;
  const isPositiveGainLoss = unrealizedGainLoss >= 0;
  const isPositiveReturn = summary.timeWeightedReturn >= 0;
  const isPositiveSharpe = (summary.sharpeRatio ?? 0) >= 0;

  // Get selected benchmark metrics
  const benchmark = summary.benchmarks[selectedBenchmark];
  const benchmarkNames = {
    VOO: "S&P 500",
    QQQ: "NASDAQ-100",
    DIA: "Dow Jones",
  };

  return (
    <div>
      <TopBar
        valuationDate={valuationDate}
        includeRealized={includeRealized}
        onToggleRealized={onToggleRealized}
        selectedBenchmark={selectedBenchmark}
        onBenchmarkChange={onBenchmarkChange}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RetroCard glowColor="cyan">
          <p className="mb-1 font-terminal text-lg text-foreground/50">
            PORTFOLIO VALUE
          </p>
          <p className="glow-cyan font-retro text-lg text-neon-cyan sm:text-xl">
            {formatCurrency(displayValue)}
          </p>
          <div className="mt-2 space-y-0.5">
            <p className="font-terminal text-base text-foreground/30">
              Unrealized G/L:{" "}
              <span
                className={
                  isPositiveGainLoss
                    ? "text-neon-green/60"
                    : "text-neon-red/60"
                }
              >
                {isPositiveGainLoss ? "+" : ""}
                {formatCurrency(unrealizedGainLoss)}
              </span>
            </p>
            {includeRealized && summary.realizedGainLoss !== 0 && (
              <p className="font-terminal text-base text-foreground/30">
                Realized G/L:{" "}
                <span
                  className={
                    summary.realizedGainLoss >= 0
                      ? "text-neon-green/60"
                      : "text-neon-red/60"
                  }
                >
                  {summary.realizedGainLoss >= 0 ? "+" : ""}
                  {formatCurrency(summary.realizedGainLoss)}
                </span>
              </p>
            )}
            {benchmark.totalValue > 0 && (
              <p className="font-terminal text-base text-foreground/20">
                {benchmarkNames[selectedBenchmark]}: {formatCurrency(benchmark.totalValue)}
              </p>
            )}
          </div>
        </RetroCard>
        <RetroCard glowColor={isPositiveReturn ? "green" : "magenta"}>
          <p className="mb-1 font-terminal text-lg text-foreground/50">
            TIME-WEIGHTED RETURN
          </p>
          <p
            className={`font-retro text-lg sm:text-xl ${
              isPositiveReturn
                ? "glow-green text-neon-green"
                : "glow-red text-neon-red"
            }`}
          >
            {formatPercent(summary.timeWeightedReturn)}
          </p>
          <div className="mt-2 space-y-0.5">
            <p className="font-terminal text-base text-foreground/30">
              Cost basis: {formatCurrency(summary.totalCost)}
            </p>
            {benchmark.totalValue > 0 && (
              <p className="font-terminal text-base text-foreground/20">
                {benchmarkNames[selectedBenchmark]}: {formatPercent(benchmark.timeWeightedReturn)}
              </p>
            )}
          </div>
        </RetroCard>
        <RetroCard glowColor="yellow">
          <p className="mb-1 font-terminal text-lg text-foreground/50">
            VOLATILITY
          </p>
          <p className="glow-yellow font-retro text-lg text-neon-yellow sm:text-xl">
            {formatPercentAbsolute(summary.annualizedVolatility ?? 0)}
          </p>
          <div className="mt-2 space-y-0.5">
            <p className="font-terminal text-base text-foreground/30">
              Annualized standard deviation
            </p>
            {benchmark.totalValue > 0 && (
              <p className="font-terminal text-base text-foreground/20">
                {benchmarkNames[selectedBenchmark]}: {formatPercentAbsolute(benchmark.annualizedVolatility)}
              </p>
            )}
          </div>
        </RetroCard>
        <RetroCard glowColor="magenta">
          <p className="mb-1 font-terminal text-lg text-foreground/50">
            RISK-ADJUSTED RETURN
          </p>
          <p
            className={`font-retro text-lg sm:text-xl ${
              isPositiveSharpe
                ? "glow-green text-neon-green"
                : "glow-red text-neon-red"
            }`}
          >
            {(summary.sharpeRatio ?? 0).toFixed(2)}
          </p>
          <div className="mt-2 space-y-0.5">
            <p className="font-terminal text-base text-foreground/30">
              Sharpe Ratio (4% risk-free rate)
            </p>
            {benchmark.totalValue > 0 && (
              <p className="font-terminal text-base text-foreground/20">
                {benchmarkNames[selectedBenchmark]}: {benchmark.sharpeRatio.toFixed(2)}
              </p>
            )}
          </div>
        </RetroCard>
      </div>
    </div>
  );
}

/* ── Top bar with valuation date, benchmark selector & realized toggle ── */

interface TopBarProps {
  valuationDate: string;
  includeRealized: boolean;
  onToggleRealized: (value: boolean) => void;
  selectedBenchmark: "VOO" | "QQQ" | "DIA";
  onBenchmarkChange: (value: "VOO" | "QQQ" | "DIA") => void;
}

function TopBar({
  valuationDate,
  includeRealized,
  onToggleRealized,
  selectedBenchmark,
  onBenchmarkChange,
}: TopBarProps) {
  const benchmarkOptions = [
    { value: "VOO", label: "S&P 500 (VOO)" },
    { value: "QQQ", label: "NASDAQ-100 (QQQ)" },
    { value: "DIA", label: "Dow Jones (DIA)" },
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-6">
      <div className="flex flex-col gap-1">
        <label className="font-terminal text-sm tracking-wide text-foreground/50">
          VALUATION DATE
        </label>
        <span className="rounded border border-border-dim bg-background px-3 py-1.5 font-mono text-sm text-foreground/70">
          {valuationDate}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-terminal text-sm tracking-wide text-foreground/50">
          BENCHMARK
        </label>
        <select
          value={selectedBenchmark}
          onChange={(e) => onBenchmarkChange(e.target.value as "VOO" | "QQQ" | "DIA")}
          className="rounded border border-border-dim bg-background px-3 py-1.5 font-mono text-sm text-foreground/70 outline-none transition-colors duration-200 focus:border-neon-cyan/60 focus:shadow-[0_0_8px_rgba(0,255,255,0.1)]"
        >
          {benchmarkOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4">
        <RetroCheckbox
          label="INCLUDE REALIZED G/L"
          checked={includeRealized}
          onChange={(e) => onToggleRealized(e.target.checked)}
        />
      </div>
    </div>
  );
}
