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
      annualizedVolatility: 0,
      sharpeRatio: 0,
      holdings: 0,
      valuationDate: "",
      benchmarks: {
        VOO: { totalValue: 0, timeWeightedReturn: 0, annualizedVolatility: 0, sharpeRatio: 0 },
        QQQ: { totalValue: 0, timeWeightedReturn: 0, annualizedVolatility: 0, sharpeRatio: 0 },
        DIA: { totalValue: 0, timeWeightedReturn: 0, annualizedVolatility: 0, sharpeRatio: 0 },
      },
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

    // ── Compute Annualized Volatility & Sharpe Ratio ──────────────
    // Calculate these metrics using historical daily returns
    let annualizedVolatility = 0;
    let sharpeRatio = 0;

    // Get historical prices to calculate volatility
    const tickers = [...new Set(relevant.map((inv) => inv.ticker))];
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

    // Get all unique dates from historical data
    const allDates = new Set<string>();
    for (const prices of priceMap.values()) {
      for (const price of prices) {
        allDates.add(price.date);
      }
    }

    // Sort dates and filter to dates between earliest acquisition and valuation date
    const sortedDates = Array.from(allDates)
      .sort()
      .filter((date) => {
        if (lotReturns.length === 0) return false;
        return date >= lotReturns[0].dateAcquired && date <= valuationDate;
      });

    // Calculate daily portfolio values
    const dailyValues: number[] = [];
    for (const date of sortedDates) {
      const relevantInvs = relevant.filter(
        (inv) => inv.dateAcquired <= date && (!inv.dateSold || inv.dateSold > date)
      );

      let dailyValue = 0;
      for (const inv of relevantInvs) {
        const historicalPrices = priceMap.get(inv.ticker);
        if (!historicalPrices) continue;

        const priceEntry = historicalPrices
          .filter((p) => p.date <= date)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        if (priceEntry) {
          dailyValue += priceEntry.adjClose * inv.units;
        }
      }

      if (dailyValue > 0) {
        dailyValues.push(dailyValue);
      }
    }

    // Calculate daily returns
    if (dailyValues.length > 1) {
      const dailyReturns: number[] = [];
      for (let i = 1; i < dailyValues.length; i++) {
        const dailyReturn = (dailyValues[i] - dailyValues[i - 1]) / dailyValues[i - 1];
        dailyReturns.push(dailyReturn);
      }

      if (dailyReturns.length > 0) {
        // Calculate average daily return
        const avgDailyReturn =
          dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

        // Calculate standard deviation of daily returns
        const variance =
          dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) /
          dailyReturns.length;
        const dailyStdDev = Math.sqrt(variance);

        // Annualized volatility (assuming 252 trading days per year)
        annualizedVolatility = dailyStdDev * Math.sqrt(252);

        // Sharpe Ratio (using 4% risk-free rate as assumption)
        const riskFreeRate = 0.04;
        const annualizedReturn = Math.pow(1 + avgDailyReturn, 252) - 1;
        sharpeRatio =
          annualizedVolatility > 0
            ? (annualizedReturn - riskFreeRate) / annualizedVolatility
            : 0;
      }
    }

    // ── Compute Benchmark Values ──────────────────────────────────────
    // Calculate what the portfolio would be worth if invested in benchmark ETFs
    const benchmarkTickers = ["VOO", "QQQ", "DIA"];
    const benchmarkPrices = new Map<string, Array<{ date: string; adjClose: number }>>();

    // Fetch historical prices for benchmark ETFs
    for (const ticker of benchmarkTickers) {
      const data = await ctx.db
        .query("historicalPriceCache")
        .withIndex("by_ticker", (q) => q.eq("ticker", ticker))
        .first();
      if (data && data.prices) {
        benchmarkPrices.set(ticker, data.prices);
      }
    }

    // Helper function to calculate benchmark metrics
    const calculateBenchmarkMetrics = (
      ticker: string
    ): {
      totalValue: number;
      timeWeightedReturn: number;
      annualizedVolatility: number;
      sharpeRatio: number;
    } => {
      const prices = benchmarkPrices.get(ticker);
      if (!prices || prices.length === 0) {
        return { totalValue: 0, timeWeightedReturn: 0, annualizedVolatility: 0, sharpeRatio: 0 };
      }

      // Calculate total value: what the portfolio would be worth in this benchmark
      let totalValue = 0;
      const benchmarkLotReturns: LotReturn[] = [];

      for (const inv of active) {
        const costBasisUsd = inv.costBasisUsd ?? inv.costBasis;

        // Find price on date acquired (or nearest prior date)
        const acquiredPrice = prices
          .filter((p) => p.date <= inv.dateAcquired)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        // Find price on valuation date (or nearest prior date)
        const valuationPrice = prices
          .filter((p) => p.date <= valuationDate)
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        if (acquiredPrice && valuationPrice) {
          // Calculate how many shares could have been bought
          const shares = costBasisUsd / acquiredPrice.adjClose;
          // Calculate what those shares are worth now
          const value = shares * valuationPrice.adjClose;
          totalValue += value;

          // Calculate HPR for this lot
          if (costBasisUsd > 0 && value > 0) {
            benchmarkLotReturns.push({
              dateAcquired: inv.dateAcquired,
              hpr: (value - costBasisUsd) / costBasisUsd,
            });
          }
        }
      }

      // Calculate time-weighted return
      let timeWeightedReturn = 0;
      if (benchmarkLotReturns.length > 0) {
        benchmarkLotReturns.sort((a, b) => a.dateAcquired.localeCompare(b.dateAcquired));
        const cumulativeTWR =
          benchmarkLotReturns.reduce((acc, lr) => acc * (1 + lr.hpr), 1) - 1;

        const earliest = toDate(benchmarkLotReturns[0].dateAcquired);
        const end = toDate(valuationDate);
        const totalDays = daysBetweenDates(earliest, end);

        timeWeightedReturn =
          totalDays >= 365
            ? Math.pow(1 + cumulativeTWR, 365 / totalDays) - 1
            : cumulativeTWR;
      }

      // Calculate volatility and Sharpe ratio
      let annualizedVolatility = 0;
      let sharpeRatio = 0;

      // Get all dates for benchmark calculations
      const benchmarkDates = sortedDates.filter(
        (date) =>
          benchmarkLotReturns.length > 0 &&
          date >= benchmarkLotReturns[0].dateAcquired &&
          date <= valuationDate
      );

      // Calculate daily portfolio values for this benchmark
      const benchmarkDailyValues: number[] = [];
      for (const date of benchmarkDates) {
        const relevantInvs = active.filter((inv) => inv.dateAcquired <= date);

        let dailyValue = 0;
        for (const inv of relevantInvs) {
          const costBasisUsd = inv.costBasisUsd ?? inv.costBasis;

          // Find price on date acquired
          const acquiredPrice = prices
            .filter((p) => p.date <= inv.dateAcquired)
            .sort((a, b) => b.date.localeCompare(a.date))[0];

          // Find price on this date
          const currentPrice = prices
            .filter((p) => p.date <= date)
            .sort((a, b) => b.date.localeCompare(a.date))[0];

          if (acquiredPrice && currentPrice) {
            const shares = costBasisUsd / acquiredPrice.adjClose;
            dailyValue += shares * currentPrice.adjClose;
          }
        }

        if (dailyValue > 0) {
          benchmarkDailyValues.push(dailyValue);
        }
      }

      // Calculate daily returns
      if (benchmarkDailyValues.length > 1) {
        const dailyReturns: number[] = [];
        for (let i = 1; i < benchmarkDailyValues.length; i++) {
          const dailyReturn =
            (benchmarkDailyValues[i] - benchmarkDailyValues[i - 1]) /
            benchmarkDailyValues[i - 1];
          dailyReturns.push(dailyReturn);
        }

        if (dailyReturns.length > 0) {
          const avgDailyReturn =
            dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

          const variance =
            dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) /
            dailyReturns.length;
          const dailyStdDev = Math.sqrt(variance);

          annualizedVolatility = dailyStdDev * Math.sqrt(252);

          const riskFreeRate = 0.04;
          const annualizedReturn = Math.pow(1 + avgDailyReturn, 252) - 1;
          sharpeRatio =
            annualizedVolatility > 0
              ? (annualizedReturn - riskFreeRate) / annualizedVolatility
              : 0;
        }
      }

      return { totalValue, timeWeightedReturn, annualizedVolatility, sharpeRatio };
    };

    const benchmarks = {
      VOO: calculateBenchmarkMetrics("VOO"),
      QQQ: calculateBenchmarkMetrics("QQQ"),
      DIA: calculateBenchmarkMetrics("DIA"),
    };

    return {
      totalValue,
      totalCost,
      realizedGainLoss,
      timeWeightedReturn,
      annualizedVolatility,
      sharpeRatio,
      holdings: active.length,
      valuationDate,
      benchmarks,
    };
  },
});

/** Get historical portfolio values over time using cached historical prices */
export const getHistoricalValues = query({
  args: {
    benchmarkTicker: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

    // Fetch benchmark prices if requested
    const benchmarkTicker = args.benchmarkTicker;
    let benchmarkPrices: Array<{ date: string; adjClose: number }> = [];
    if (benchmarkTicker) {
      const benchmarkData = await ctx.db
        .query("historicalPriceCache")
        .withIndex("by_ticker", (q) => q.eq("ticker", benchmarkTicker))
        .first();
      if (benchmarkData && benchmarkData.prices) {
        benchmarkPrices = benchmarkData.prices;
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

      // Calculate benchmark time-weighted return for this date
      let benchmarkTimeWeightedReturn = 0;
      if (benchmarkPrices.length > 0) {
        const benchmarkLotReturns: Array<{ dateAcquired: string; hpr: number }> = [];

        for (const inv of relevantInvestments) {
          const costBasisUsd = inv.costBasisUsd ?? inv.costBasis;

          // Find benchmark price on date acquired (or nearest prior date)
          const acquiredPrice = benchmarkPrices
            .filter((p) => p.date <= inv.dateAcquired)
            .sort((a, b) => b.date.localeCompare(a.date))[0];

          // Find benchmark price on this date (or nearest prior date)
          const currentPrice = benchmarkPrices
            .filter((p) => p.date <= date)
            .sort((a, b) => b.date.localeCompare(a.date))[0];

          if (acquiredPrice && currentPrice) {
            const shares = costBasisUsd / acquiredPrice.adjClose;
            const value = shares * currentPrice.adjClose;

            if (costBasisUsd > 0 && value > 0) {
              benchmarkLotReturns.push({
                dateAcquired: inv.dateAcquired,
                hpr: (value - costBasisUsd) / costBasisUsd,
              });
            }
          }
        }

        if (benchmarkLotReturns.length > 0) {
          benchmarkLotReturns.sort((a, b) => a.dateAcquired.localeCompare(b.dateAcquired));
          const cumulativeTWR =
            benchmarkLotReturns.reduce((acc, lr) => acc * (1 + lr.hpr), 1) - 1;

          const earliest = toDate(benchmarkLotReturns[0].dateAcquired);
          const end = toDate(date);
          const totalDays = daysBetweenDates(earliest, end);

          benchmarkTimeWeightedReturn =
            totalDays >= 365
              ? Math.pow(1 + cumulativeTWR, 365 / totalDays) - 1
              : cumulativeTWR;
        }
      }

      return {
        date,
        totalValue,
        totalCost,
        gainLoss: totalValue - totalCost,
        timeWeightedReturn: timeWeightedReturn * 100, // Convert to percentage
        benchmarkTimeWeightedReturn: benchmarkTimeWeightedReturn * 100, // Convert to percentage
      };
    });

    return result;
  },
});
