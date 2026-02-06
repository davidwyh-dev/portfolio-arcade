"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RetroCard } from "./ui/RetroCard";
import { formatCurrency, formatPercent } from "@/lib/utils";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function PortfolioSummary() {
  const [valuationDate, setValuationDate] = useState(todayISO);

  // Only pass date to the query when it has a value
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
        <ValuationDateBar
          valuationDate={valuationDate}
          onValuationDateChange={setValuationDate}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <RetroCard glowColor="cyan" className="animate-pulse">
            <div className="h-20" />
          </RetroCard>
          <RetroCard glowColor="green" className="animate-pulse">
            <div className="h-20" />
          </RetroCard>
        </div>
      </div>
    );
  }

  const isPositiveReturn = summary.annualizedReturn >= 0;

  return (
    <div>
      <ValuationDateBar
        valuationDate={valuationDate}
        onValuationDateChange={setValuationDate}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RetroCard glowColor="cyan">
          <p className="mb-1 font-terminal text-lg text-foreground/50">
            PORTFOLIO VALUE
          </p>
          <p className="glow-cyan font-retro text-lg text-neon-cyan sm:text-xl">
            {formatCurrency(summary.totalValue)}
          </p>
          <p className="mt-2 font-terminal text-base text-foreground/30">
            {summary.holdings} active holding
            {summary.holdings !== 1 ? "s" : ""} as of{" "}
            {summary.valuationDate}
          </p>
        </RetroCard>
        <RetroCard glowColor={isPositiveReturn ? "green" : "magenta"}>
          <p className="mb-1 font-terminal text-lg text-foreground/50">
            ANNUALIZED RETURN
          </p>
          <p
            className={`font-retro text-lg sm:text-xl ${
              isPositiveReturn
                ? "glow-green text-neon-green"
                : "glow-red text-neon-red"
            }`}
          >
            {formatPercent(summary.annualizedReturn)}
          </p>
          <p className="mt-2 font-terminal text-base text-foreground/30">
            Cost basis: {formatCurrency(summary.totalCost)}
          </p>
        </RetroCard>
      </div>
    </div>
  );
}

/* ── Valuation date selector bar ─────────────────────────────────── */

interface ValuationDateBarProps {
  valuationDate: string;
  onValuationDateChange: (v: string) => void;
}

function ValuationDateBar({
  valuationDate,
  onValuationDateChange,
}: ValuationDateBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start gap-4">
      <div className="flex flex-col gap-1">
        <label className="font-terminal text-sm tracking-wide text-foreground/50">
          VALUATION DATE
        </label>
        <input
          type="date"
          value={valuationDate}
          onChange={(e) => onValuationDateChange(e.target.value)}
          className="rounded border border-border-dim bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-foreground/30 focus:border-neon-cyan/60 focus:shadow-[0_0_8px_rgba(0,255,255,0.1)]"
        />
      </div>
      {valuationDate !== todayISO() && (
        <button
          onClick={() => onValuationDateChange(todayISO())}
          className="mt-6 font-terminal text-sm text-foreground/40 transition-colors hover:text-neon-cyan"
        >
          RESET
        </button>
      )}
    </div>
  );
}
