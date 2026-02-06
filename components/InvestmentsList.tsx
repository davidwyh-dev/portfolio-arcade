"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { RetroCard } from "./ui/RetroCard";
import { RetroButton } from "./ui/RetroButton";
import { InvestmentForm } from "./InvestmentForm";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export function InvestmentsList() {
  const investments = useQuery(api.investments.list);
  const removeInvestment = useMutation(api.investments.remove);
  const updatePrice = useMutation(api.investments.updatePrice);
  const fetchQuote = useAction(api.marketData.fetchQuote);
  const fetchSingleRate = useAction(api.fxRates.fetchSingleRate);

  const [formOpen, setFormOpen] = useState(false);
  const [editInvestment, setEditInvestment] = useState<
    | {
        _id: Id<"investments">;
        accountId: Id<"accounts">;
        ticker: string;
        dateAcquired: string;
        dateSold?: string;
        units: number;
        unitPrice: number;
        soldUnitPrice?: number;
        currency: string;
      }
    | undefined
  >(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const handleEdit = (inv: NonNullable<typeof investments>[number]) => {
    setEditInvestment({
      _id: inv._id,
      accountId: inv.accountId,
      ticker: inv.ticker,
      dateAcquired: inv.dateAcquired,
      dateSold: inv.dateSold ?? undefined,
      units: inv.units,
      unitPrice: inv.unitPrice ?? (inv.units > 0 ? inv.costBasis / inv.units : 0),
      soldUnitPrice: inv.soldUnitPrice ?? undefined,
      currency: inv.currency,
    });
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditInvestment(undefined);
  };

  const refreshPrices = useCallback(async () => {
    if (!investments || refreshing) return;
    setRefreshing(true);

    try {
      // Get unique tickers
      const tickers = [...new Set(investments.map((inv) => inv.ticker))];

      for (const ticker of tickers) {
        try {
          const quote = await fetchQuote({ ticker });

          // Update each investment with this ticker
          for (const inv of investments.filter((i) => i.ticker === ticker)) {
            let priceUsd = quote.price;
            let fxRate = 1;

            // If investment currency is not USD, the stock price from
            // Finnhub may be in the local currency — apply FX rate
            if (inv.currency !== "USD") {
              try {
                const { rate } = await fetchSingleRate({
                  from: inv.currency,
                  to: "USD",
                });
                fxRate = rate;
                priceUsd = quote.price * rate;
              } catch {
                // If FX fails, use raw price as-is (assumes USD)
              }
            }

            const currentValueUsd = priceUsd * inv.units;
            const costBasisUsd = inv.costBasis * fxRate;
            await updatePrice({
              id: inv._id,
              currentPriceUsd: priceUsd,
              currentValueUsd,
              costBasisUsd,
            });
          }
        } catch {
          // Skip tickers that fail
        }
      }
    } finally {
      setRefreshing(false);
    }
  }, [investments, refreshing, fetchQuote, fetchSingleRate, updatePrice]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-retro text-xs text-neon-green">INVESTMENTS</h2>
        <div className="flex gap-2">
          <RetroButton
            size="sm"
            variant="primary"
            onClick={() => void refreshPrices()}
            disabled={refreshing}
          >
            <RefreshCw
              size={14}
              className={`mr-1 inline ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "UPDATING..." : "REFRESH"}
          </RetroButton>
          <RetroButton
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditInvestment(undefined);
              setFormOpen(true);
            }}
          >
            <Plus size={14} className="mr-1 inline" />
            ADD
          </RetroButton>
        </div>
      </div>

      {!investments ? (
        <RetroCard glowColor="green" className="animate-pulse">
          <div className="h-24" />
        </RetroCard>
      ) : investments.length === 0 ? (
        <RetroCard glowColor="green">
          <p className="text-center font-terminal text-lg text-foreground/30">
            NO INVESTMENTS YET — ADD YOUR FIRST HOLDING
          </p>
        </RetroCard>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-dim">
                <th className="px-3 py-2 text-left font-terminal text-base text-foreground/40">
                  TICKER
                </th>
                <th className="px-3 py-2 text-left font-terminal text-base text-foreground/40">
                  ACCOUNT
                </th>
                <th className="px-3 py-2 text-left font-terminal text-base text-foreground/40">
                  ACQUIRED
                </th>
                <th className="px-3 py-2 text-right font-terminal text-base text-foreground/40">
                  UNITS
                </th>
                <th className="px-3 py-2 text-right font-terminal text-base text-foreground/40">
                  UNIT PRICE
                </th>
                <th className="px-3 py-2 text-right font-terminal text-base text-foreground/40">
                  COST BASIS
                </th>
                <th className="px-3 py-2 text-right font-terminal text-base text-foreground/40">
                  VALUE (USD)
                </th>
                <th className="px-3 py-2 text-right font-terminal text-base text-foreground/40">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {investments.map((inv) => {
                const costUsd = inv.costBasisUsd ?? inv.costBasis;
                const isSold = !!inv.dateSold && !!inv.soldUnitPrice;
                const displayValue = isSold
                  ? inv.soldValueUsd ?? inv.soldUnitPrice! * inv.units
                  : inv.currentValueUsd;
                const gain =
                  displayValue !== undefined
                    ? displayValue - costUsd
                    : undefined;
                const isPositive = gain !== undefined && gain >= 0;

                return (
                  <tr
                    key={inv._id}
                    className="border-b border-border-dim/50 transition-colors hover:bg-surface"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-sm font-medium text-neon-cyan">
                        {inv.ticker}
                      </span>
                      {inv.dateSold && (
                        <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 font-terminal text-xs text-foreground/30">
                          SOLD
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-terminal text-base text-foreground/60">
                      {inv.accountName}
                    </td>
                    <td className="px-3 py-2.5 font-terminal text-base text-foreground/50">
                      {formatDate(inv.dateAcquired)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm text-foreground/60">
                      {inv.units.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm text-foreground/60">
                      {formatCurrency(
                        inv.unitPrice ?? (inv.units > 0 ? inv.costBasis / inv.units : 0),
                        inv.currency
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm text-foreground/60">
                      {formatCurrency(inv.costBasis, inv.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {displayValue !== undefined ? (
                        <div>
                          <span className={`font-mono text-sm font-medium text-foreground ${!isSold ? "italic" : ""}`}>
                            {formatCurrency(displayValue)}
                          </span>
                          {gain !== undefined && (
                            <span
                              className={`ml-1 font-terminal text-xs ${!isSold ? "italic" : ""} ${isPositive ? "text-neon-green" : "text-neon-red"}`}
                            >
                              {isPositive ? "+" : ""}
                              {formatCurrency(gain)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="font-terminal text-sm text-foreground/20">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleEdit(inv)}
                          className="p-1 text-foreground/30 transition-colors hover:text-neon-cyan"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() =>
                            void removeInvestment({ id: inv._id })
                          }
                          className="p-1 text-foreground/30 transition-colors hover:text-neon-red"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InvestmentForm
        isOpen={formOpen}
        onClose={handleClose}
        editInvestment={editInvestment}
      />
    </div>
  );
}
