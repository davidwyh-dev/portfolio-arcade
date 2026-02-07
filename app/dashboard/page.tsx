"use client";

import { useState } from "react";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { PortfolioChart } from "@/components/PortfolioChart";
import { AccountsList } from "@/components/AccountsList";
import { InvestmentsList } from "@/components/InvestmentsList";

export default function DashboardPage() {
  const [includeRealized, setIncludeRealized] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState<"VOO" | "QQQ" | "DIA">("VOO");

  return (
    <div className="retro-grid mx-auto max-w-5xl px-6 py-8">
      {/* Portfolio Summary */}
      <section className="mb-8">
        <h2 className="mb-4 font-retro text-xs text-foreground/50">
          DASHBOARD
        </h2>
        <PortfolioSummary
          includeRealized={includeRealized}
          onToggleRealized={setIncludeRealized}
          selectedBenchmark={selectedBenchmark}
          onBenchmarkChange={setSelectedBenchmark}
        />
      </section>

      {/* Portfolio Chart */}
      <section className="mb-8">
        <PortfolioChart selectedBenchmark={selectedBenchmark} />
      </section>

      {/* Accounts Section */}
      <section className="mb-8">
        <AccountsList />
      </section>

      {/* Investments Section */}
      <section className="mb-8">
        <InvestmentsList showSold={includeRealized} />
      </section>
    </div>
  );
}
