import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Parse YYYY-MM-DD as UTC midnight to avoid timezone shifts. */
function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetweenDates(a: Date, b: Date): number {
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

export const getSummary = query({
  args: {
    valuationDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const empty = {
      totalValue: 0,
      totalCost: 0,
      realizedGainLoss: 0,
      timeWeightedReturn: 0,
      holdings: 0,
      valuationDate: "",
    };

    const userId = await getAuthUserId(ctx);
    if (!userId) return empty;

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const valuationDate =
      args.valuationDate || new Date().toISOString().split("T")[0];

    // All investments acquired on or before the valuation date
    const relevant = investments.filter(
      (inv) => inv.dateAcquired <= valuationDate
    );

    if (relevant.length === 0) {
      return { ...empty, valuationDate };
    }

    // Separate active vs sold (as of valuation date)
    const active = relevant.filter(
      (inv) => !inv.dateSold || inv.dateSold > valuationDate
    );
    const sold = relevant.filter(
      (inv) => inv.dateSold && inv.dateSold <= valuationDate
    );

    // Portfolio value & cost (active holdings only)
    let totalValue = 0;
    let totalCost = 0;
    for (const inv of active) {
      totalValue += inv.currentValueUsd ?? 0;
      totalCost += inv.costBasisUsd ?? inv.costBasis;
    }

    // Realized gain/loss from sold lots
    let realizedGainLoss = 0;
    for (const inv of sold) {
      const cost = inv.costBasisUsd ?? inv.costBasis;
      const proceeds =
        inv.soldValueUsd ?? (inv.soldUnitPrice ? inv.soldUnitPrice * inv.units : 0);
      realizedGainLoss += proceeds - cost;
    }

    // ── Compute Time-Weighted Return ──────────────────────────────
    // For each lot, compute its holding-period return (HPR).
    //   Active lots: HPR = (currentValueUsd − costBasisUsd) / costBasisUsd
    //   Sold lots:   HPR = (soldValueUsd − costBasisUsd) / costBasisUsd
    // Then geometrically link all HPRs sorted by acquisition date
    // and annualise over the total portfolio duration.

    interface LotReturn {
      dateAcquired: string;
      hpr: number;
    }

    const lotReturns: LotReturn[] = [];

    for (const inv of active) {
      const cost = inv.costBasisUsd ?? inv.costBasis;
      const value = inv.currentValueUsd ?? 0;
      if (cost > 0 && value > 0) {
        lotReturns.push({
          dateAcquired: inv.dateAcquired,
          hpr: (value - cost) / cost,
        });
      }
    }

    for (const inv of sold) {
      const cost = inv.costBasisUsd ?? inv.costBasis;
      const value =
        inv.soldValueUsd ?? (inv.soldUnitPrice ? inv.soldUnitPrice * inv.units : 0);
      if (cost > 0 && value > 0) {
        lotReturns.push({
          dateAcquired: inv.dateAcquired,
          hpr: (value - cost) / cost,
        });
      }
    }

    let timeWeightedReturn = 0;

    if (lotReturns.length > 0) {
      // Sort chronologically by acquisition date
      lotReturns.sort((a, b) => a.dateAcquired.localeCompare(b.dateAcquired));

      // Geometric linking: TWR = product(1 + HPR_i) − 1
      const cumulativeTWR =
        lotReturns.reduce((acc, lr) => acc * (1 + lr.hpr), 1) - 1;

      // Annualise over the span from earliest acquisition to valuation date
      const earliest = toDate(lotReturns[0].dateAcquired);
      const end = toDate(valuationDate);
      const totalDays = daysBetweenDates(earliest, end);

      timeWeightedReturn =
        totalDays >= 365
          ? Math.pow(1 + cumulativeTWR, 365 / totalDays) - 1
          : cumulativeTWR;
    }

    return {
      totalValue,
      totalCost,
      realizedGainLoss,
      timeWeightedReturn,
      holdings: active.length,
      valuationDate,
    };
  },
});

/** Get historical portfolio values over time using cached historical prices */
export const getHistoricalValues = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (investments.length === 0) return [];

    // Get unique tickers
    const tickers = [...new Set(investments.map((inv) => inv.ticker))];

    // Fetch historical prices for all tickers
    const historicalData = await Promise.all(
      tickers.map((ticker) =>
        ctx.db
          .query("historicalPriceCache")
          .withIndex("by_ticker", (q) => q.eq("ticker", ticker))
          .first()
      )
    );

    // Build a map of ticker -> historical prices
    const priceMap = new Map<string, Array<{ date: string; adjClose: number }>>();
    for (let i = 0; i < tickers.length; i++) {
      const data = historicalData[i];
      if (data && data.prices) {
        priceMap.set(tickers[i], data.prices);
      }
    }

    // Find the earliest acquisition date
    const earliestAcquisition = investments
      .map((inv) => inv.dateAcquired)
      .sort()[0];

    if (!earliestAcquisition) return [];

    // Get all unique dates from all historical data
    const allDates = new Set<string>();
    for (const prices of priceMap.values()) {
      for (const price of prices) {
        allDates.add(price.date);
      }
    }

    // Sort dates chronologically and filter to only include dates on or after earliest acquisition
    const sortedDates = Array.from(allDates)
      .sort()
      .filter((date) => date >= earliestAcquisition);

    // For each date, calculate portfolio value and time-weighted return
    const result = sortedDates.map((date) => {
      // Filter investments that were acquired on or before this date
      const relevantInvestments = investments.filter(
        (inv) => inv.dateAcquired <= date && (!inv.dateSold || inv.dateSold > date)
      );

      let totalValue = 0;
      let totalCost = 0;

      // Calculate portfolio value for this date
      for (const inv of relevantInvestments) {
        const historicalPrices = priceMap.get(inv.ticker);
        if (!historicalPrices) continue;

        // Find the price for this date (or most recent prior)
        const priceEntry = historicalPrices
          .filter((p) => p.date <= date)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        if (priceEntry) {
          const value = priceEntry.adjClose * inv.units;
          totalValue += value;
          totalCost += inv.costBasisUsd ?? inv.costBasis;
        }
      }

      // Calculate time-weighted return as of this date
      const lotReturns: Array<{ dateAcquired: string; hpr: number }> = [];
      
      for (const inv of relevantInvestments) {
        const historicalPrices = priceMap.get(inv.ticker);
        if (!historicalPrices) continue;

        const priceEntry = historicalPrices
          .filter((p) => p.date <= date)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        if (priceEntry) {
          const cost = inv.costBasisUsd ?? inv.costBasis;
          const value = priceEntry.adjClose * inv.units;
          if (cost > 0 && value > 0) {
            lotReturns.push({
              dateAcquired: inv.dateAcquired,
              hpr: (value - cost) / cost,
            });
          }
        }
      }

      let timeWeightedReturn = 0;
      if (lotReturns.length > 0) {
        lotReturns.sort((a, b) => a.dateAcquired.localeCompare(b.dateAcquired));
        const cumulativeTWR =
          lotReturns.reduce((acc, lr) => acc * (1 + lr.hpr), 1) - 1;
        
        const earliest = toDate(lotReturns[0].dateAcquired);
        const end = toDate(date);
        const totalDays = daysBetweenDates(earliest, end);

        timeWeightedReturn =
          totalDays >= 365
            ? Math.pow(1 + cumulativeTWR, 365 / totalDays) - 1
            : cumulativeTWR;
      }

      return {
        date,
        totalValue,
        totalCost,
        gainLoss: totalValue - totalCost,
        timeWeightedReturn: timeWeightedReturn * 100, // Convert to percentage
      };
    });

    return result;
  },
});
