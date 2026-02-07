"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
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
}

export function PortfolioSummary({
  includeRealized,
  onToggleRealized,
}: PortfolioSummaryProps) {
  const valuationDate = todayISO();

  const queryArgs = useMemo(
    () => ({
      ...(valuationDate ? { valuationDate } : {}),
    }),
    [valuationDate]
  );

  const summary = useQuery(api.portfolio.getSummary, queryArgs);

  if (!summary) {
    return (
      <div>
        <TopBar
          valuationDate={valuationDate}
          includeRealized={includeRealized}
          onToggleRealized={onToggleRealized}
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

  return (
    <div>
      <TopBar
        valuationDate={valuationDate}
        includeRealized={includeRealized}
        onToggleRealized={onToggleRealized}
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
          <p className="mt-2 font-terminal text-base text-foreground/30">
            Cost basis: {formatCurrency(summary.totalCost)}
          </p>
        </RetroCard>
        <RetroCard glowColor="yellow">
          <p className="mb-1 font-terminal text-lg text-foreground/50">
            VOLATILITY
          </p>
          <p className="glow-yellow font-retro text-lg text-neon-yellow sm:text-xl">
            {formatPercentAbsolute(summary.annualizedVolatility ?? 0)}
          </p>
          <p className="mt-2 font-terminal text-base text-foreground/30">
            Annualized standard deviation
          </p>
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
          <p className="mt-2 font-terminal text-base text-foreground/30">
            Sharpe Ratio (4% risk-free rate)
          </p>
        </RetroCard>
      </div>
    </div>
  );
}

/* ── Top bar with valuation date (display-only) & realized toggle ── */

interface TopBarProps {
  valuationDate: string;
  includeRealized: boolean;
  onToggleRealized: (value: boolean) => void;
}

function TopBar({
  valuationDate,
  includeRealized,
  onToggleRealized,
}: TopBarProps) {
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
