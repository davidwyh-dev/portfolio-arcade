"use client";

import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RetroModal } from "./ui/RetroModal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { RetroButton } from "./ui/RetroButton";

interface InvestmentPriceHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
}

export function InvestmentPriceHistory({
  isOpen,
  onClose,
  ticker,
}: InvestmentPriceHistoryProps) {
  const cached = useQuery(
    api.marketData.getHistoricalCache,
    isOpen && ticker ? { ticker } : "skip"
  );
  const fetchHistoricalPrices = useAction(api.marketData.fetchHistoricalPrices);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Determine if cache is stale (older than 24 hours)
  const isCacheStale = (() => {
    if (!cached) return true;
    const updatedAt = new Date(cached.updatedAt).getTime();
    const now = Date.now();
    return now - updatedAt > 24 * 60 * 60 * 1000;
  })();

  // Fetch data when dialog opens and cache is stale or missing
  useEffect(() => {
    if (!isOpen || !ticker || loading) return;
    if (!isCacheStale) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    fetchHistoricalPrices({ ticker })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch historical prices"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Only re-run when the dialog opens with a (possibly new) ticker
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ticker]);

  const handleRefresh = async () => {
    setLoading(true);
    setError("");
    try {
      await fetchHistoricalPrices({ ticker });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch historical prices"
      );
    } finally {
      setLoading(false);
    }
  };

  const prices = cached?.prices ?? [];

  return (
    <RetroModal
      isOpen={isOpen}
      onClose={onClose}
      title={`PRICE HISTORY — ${ticker}`}
    >
      <div className="flex flex-col gap-3">
        {/* Header with refresh */}
        <div className="flex items-center justify-between">
          <p className="font-terminal text-sm text-foreground/40">
            MONTHLY ADJUSTED CLOSE (5Y)
          </p>
          <RetroButton
            size="sm"
            variant="secondary"
            onClick={() => void handleRefresh()}
            disabled={loading}
          >
            <RefreshCw
              size={12}
              className={`mr-1 inline ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "LOADING..." : "REFRESH"}
          </RetroButton>
        </div>

        {error && (
          <p className="font-terminal text-sm text-neon-red">{error}</p>
        )}

        {/* Price table */}
        {loading && prices.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={20} className="animate-spin text-neon-cyan" />
            <span className="ml-2 font-terminal text-sm text-foreground/40">
              FETCHING DATA...
            </span>
          </div>
        ) : prices.length === 0 ? (
          <p className="py-4 text-center font-terminal text-sm text-foreground/30">
            NO HISTORICAL DATA AVAILABLE
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border-dim">
                  <th className="px-3 py-2 text-left font-terminal text-base text-foreground/40">
                    DATE
                  </th>
                  <th className="px-3 py-2 text-right font-terminal text-base text-foreground/40">
                    ADJ CLOSE
                  </th>
                  <th className="px-3 py-2 text-right font-terminal text-base text-foreground/40">
                    CHANGE
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...prices].reverse().map((row, idx, arr) => {
                  const prev = idx < arr.length - 1 ? arr[idx + 1] : null;
                  const change = prev
                    ? ((row.adjClose - prev.adjClose) / prev.adjClose) * 100
                    : null;

                  return (
                    <tr
                      key={row.date}
                      className="border-b border-border-dim/50 transition-colors hover:bg-surface"
                    >
                      <td className="px-3 py-1.5 font-terminal text-sm text-foreground/60">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm text-neon-cyan">
                        {formatCurrency(row.adjClose)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm">
                        {change !== null ? (
                          <span
                            className={
                              change >= 0
                                ? "text-neon-green"
                                : "text-neon-red"
                            }
                          >
                            {change >= 0 ? "+" : ""}
                            {change.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-foreground/20">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Last updated info */}
        {cached?.updatedAt && (
          <p className="font-terminal text-xs text-foreground/20">
            LAST UPDATED: {new Date(cached.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </RetroModal>
  );
}
