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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(todayISO);

  // Only pass dates to the query when they have values
  const queryArgs = useMemo(
    () => ({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    }),
    [startDate, endDate]
  );

  const summary = useQuery(api.portfolio.getSummary, queryArgs);

  if (!summary) {
    return (
      <div>
        <DateRangeBar
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
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
      <DateRangeBar
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        effectiveStartDate={summary.effectiveStartDate}
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
            {summary.effectiveEndDate}
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
            Value at start: {formatCurrency(summary.totalCost)}
          </p>
        </RetroCard>
      </div>
    </div>
  );
}

/* ── Date range selector bar ───────────────────────────────────── */

interface DateRangeBarProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  effectiveStartDate?: string;
}

function DateRangeBar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  effectiveStartDate,
}: DateRangeBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-start gap-4">
      <div className="flex flex-col gap-1">
        <label className="font-terminal text-sm tracking-wide text-foreground/50">
          START DATE
        </label>
        <input
          type="date"
          value={startDate}
          placeholder={effectiveStartDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="rounded border border-border-dim bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-foreground/30 focus:border-neon-cyan/60 focus:shadow-[0_0_8px_rgba(0,255,255,0.1)]"
        />
        {!startDate && effectiveStartDate && (
          <span className="font-terminal text-xs text-foreground/30">
            Earliest: {effectiveStartDate}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-terminal text-sm tracking-wide text-foreground/50">
          END DATE
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="rounded border border-border-dim bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-foreground/30 focus:border-neon-cyan/60 focus:shadow-[0_0_8px_rgba(0,255,255,0.1)]"
        />
      </div>
      {startDate && (
        <button
          onClick={() => {
            onStartDateChange("");
            onEndDateChange(todayISO());
          }}
          className="mt-6 font-terminal text-sm text-foreground/40 transition-colors hover:text-neon-cyan"
        >
          RESET
        </button>
      )}
    </div>
  );
}
