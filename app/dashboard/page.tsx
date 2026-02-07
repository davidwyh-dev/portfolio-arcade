"use client";

import { useState } from "react";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { PortfolioChart } from "@/components/PortfolioChart";
import { AccountsList } from "@/components/AccountsList";
import { InvestmentsList } from "@/components/InvestmentsList";

export default function DashboardPage() {
  const [includeRealized, setIncludeRealized] = useState(false);

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
        />
      </section>

      {/* Portfolio Chart */}
      <section className="mb-8">
        <PortfolioChart />
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
