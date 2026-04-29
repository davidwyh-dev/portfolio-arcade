import {
  BENCHMARK_TICKERS,
  type Benchmark,
  type BenchmarkSummary,
  type HistoricalPricePoint,
  type HistoricalValuePoint,
  type Investment,
  type SummaryResult,
} from "./types";

const RISK_FREE_RATE = 0.04;
const TRADING_DAYS_PER_YEAR = 252;

/** Parse YYYY-MM-DD as UTC midnight to avoid timezone shifts. */
export function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function daysBetweenDates(a: Date, b: Date): number {
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}

const EMPTY_BENCHMARK: BenchmarkSummary = {
  totalValue: 0,
  timeWeightedReturn: 0,
  annualizedVolatility: 0,
  sharpeRatio: 0,
};

export function emptySummary(valuationDate = ""): SummaryResult {
  return {
    totalValue: 0,
    totalCost: 0,
    realizedGainLoss: 0,
    timeWeightedReturn: 0,
    annualizedVolatility: 0,
    sharpeRatio: 0,
    holdings: 0,
    valuationDate,
    benchmarks: {
      VOO: { ...EMPTY_BENCHMARK },
      QQQ: { ...EMPTY_BENCHMARK },
      DIA: { ...EMPTY_BENCHMARK },
    },
  };
}

interface LotReturn {
  dateAcquired: string;
  hpr: number;
}

function annualisedTWR(lotReturns: LotReturn[], valuationDate: string): number {
  if (lotReturns.length === 0) return 0;
  const sorted = [...lotReturns].sort((a, b) =>
    a.dateAcquired.localeCompare(b.dateAcquired)
  );
  const cumulativeTWR = sorted.reduce((acc, lr) => acc * (1 + lr.hpr), 1) - 1;
  const earliest = toDate(sorted[0].dateAcquired);
  const end = toDate(valuationDate);
  const totalDays = daysBetweenDates(earliest, end);
  return totalDays >= 365
    ? Math.pow(1 + cumulativeTWR, 365 / totalDays) - 1
    : cumulativeTWR;
}

/** Sort a price series ascending by date once, so lookups can scan in order. */
function sortAsc(prices: HistoricalPricePoint[]): HistoricalPricePoint[] {
  return [...prices].sort((a, b) => a.date.localeCompare(b.date));
}

/** Find the latest entry with date <= the target date. Assumes input sorted asc. */
function priceOnOrBefore(
  pricesAsc: HistoricalPricePoint[],
  date: string
): HistoricalPricePoint | undefined {
  let candidate: HistoricalPricePoint | undefined;
  for (const p of pricesAsc) {
    if (p.date <= date) candidate = p;
    else break;
  }
  return candidate;
}

function volatilityAndSharpe(dailyValues: number[]): {
  annualizedVolatility: number;
  sharpeRatio: number;
} {
  if (dailyValues.length <= 1) {
    return { annualizedVolatility: 0, sharpeRatio: 0 };
  }
  const dailyReturns: number[] = [];
  for (let i = 1; i < dailyValues.length; i++) {
    dailyReturns.push(
      (dailyValues[i] - dailyValues[i - 1]) / dailyValues[i - 1]
    );
  }
  if (dailyReturns.length === 0) {
    return { annualizedVolatility: 0, sharpeRatio: 0 };
  }
  const avgDailyReturn =
    dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((s, r) => s + Math.pow(r - avgDailyReturn, 2), 0) /
    dailyReturns.length;
  const annualizedVolatility = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const annualizedReturn =
    Math.pow(1 + avgDailyReturn, TRADING_DAYS_PER_YEAR) - 1;
  const sharpeRatio =
    annualizedVolatility > 0
      ? (annualizedReturn - RISK_FREE_RATE) / annualizedVolatility
      : 0;
  return { annualizedVolatility, sharpeRatio };
}

interface ComputeSummaryInput {
  investments: Investment[];
  /** Map of ticker → historical prices (any order; will be sorted internally). */
  priceMap: Map<string, HistoricalPricePoint[]>;
  /** Map of benchmark ticker (VOO/QQQ/DIA) → historical prices. */
  benchmarkPriceMap: Map<string, HistoricalPricePoint[]>;
  valuationDate: string;
}

export function computeSummary(input: ComputeSummaryInput): SummaryResult {
  const { investments, priceMap, benchmarkPriceMap, valuationDate } = input;

  const relevant = investments.filter(
    (inv) => inv.dateAcquired <= valuationDate
  );
  if (relevant.length === 0) {
    return emptySummary(valuationDate);
  }

  const active = relevant.filter(
    (inv) => !inv.dateSold || inv.dateSold > valuationDate
  );
  const sold = relevant.filter(
    (inv) => inv.dateSold && inv.dateSold <= valuationDate
  );

  let totalValue = 0;
  let totalCost = 0;
  for (const inv of active) {
    totalValue += inv.currentValueUsd ?? 0;
    totalCost += inv.costBasisUsd ?? inv.costBasis;
  }

  let realizedGainLoss = 0;
  for (const inv of sold) {
    const cost = inv.costBasisUsd ?? inv.costBasis;
    const proceeds =
      inv.soldValueUsd ??
      (inv.soldUnitPrice ? inv.soldUnitPrice * inv.units : 0);
    realizedGainLoss += proceeds - cost;
  }

  // ── Time-Weighted Return (geometrically link per-lot HPRs) ──────────
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
      inv.soldValueUsd ??
      (inv.soldUnitPrice ? inv.soldUnitPrice * inv.units : 0);
    if (cost > 0 && value > 0) {
      lotReturns.push({
        dateAcquired: inv.dateAcquired,
        hpr: (value - cost) / cost,
      });
    }
  }
  const timeWeightedReturn = annualisedTWR(lotReturns, valuationDate);

  // ── Volatility & Sharpe from historical daily portfolio values ──────
  const tickers = [...new Set(relevant.map((inv) => inv.ticker))];
  const sortedPriceMap = new Map<string, HistoricalPricePoint[]>();
  for (const ticker of tickers) {
    const prices = priceMap.get(ticker);
    if (prices && prices.length > 0) {
      sortedPriceMap.set(ticker, sortAsc(prices));
    }
  }

  const allDates = new Set<string>();
  for (const prices of sortedPriceMap.values()) {
    for (const price of prices) {
      allDates.add(price.date);
    }
  }

  const earliestLotDate =
    lotReturns.length > 0
      ? [...lotReturns].sort((a, b) =>
          a.dateAcquired.localeCompare(b.dateAcquired)
        )[0].dateAcquired
      : null;

  const sortedDates = Array.from(allDates)
    .sort()
    .filter((date) => {
      if (!earliestLotDate) return false;
      return date >= earliestLotDate && date <= valuationDate;
    });

  const dailyValues: number[] = [];
  for (const date of sortedDates) {
    const relevantInvs = relevant.filter(
      (inv) =>
        inv.dateAcquired <= date && (!inv.dateSold || inv.dateSold > date)
    );
    let dailyValue = 0;
    for (const inv of relevantInvs) {
      const prices = sortedPriceMap.get(inv.ticker);
      if (!prices) continue;
      const priceEntry = priceOnOrBefore(prices, date);
      if (priceEntry) {
        dailyValue += priceEntry.adjClose * inv.units;
      }
    }
    if (dailyValue > 0) dailyValues.push(dailyValue);
  }

  const { annualizedVolatility, sharpeRatio } = volatilityAndSharpe(dailyValues);

  // ── Benchmark scenarios: what the portfolio would be worth in each ETF ──
  const benchmarks: Record<Benchmark, BenchmarkSummary> = {
    VOO: { ...EMPTY_BENCHMARK },
    QQQ: { ...EMPTY_BENCHMARK },
    DIA: { ...EMPTY_BENCHMARK },
  };

  for (const benchTicker of BENCHMARK_TICKERS) {
    const rawPrices = benchmarkPriceMap.get(benchTicker);
    if (!rawPrices || rawPrices.length === 0) continue;
    const prices = sortAsc(rawPrices);

    let bTotalValue = 0;
    const bLotReturns: LotReturn[] = [];

    for (const inv of active) {
      const costBasisUsd = inv.costBasisUsd ?? inv.costBasis;
      const acquiredPrice = priceOnOrBefore(prices, inv.dateAcquired);
      const valuationPrice = priceOnOrBefore(prices, valuationDate);
      if (acquiredPrice && valuationPrice) {
        const shares = costBasisUsd / acquiredPrice.adjClose;
        const value = shares * valuationPrice.adjClose;
        bTotalValue += value;
        if (costBasisUsd > 0 && value > 0) {
          bLotReturns.push({
            dateAcquired: inv.dateAcquired,
            hpr: (value - costBasisUsd) / costBasisUsd,
          });
        }
      }
    }

    const bTimeWeightedReturn = annualisedTWR(bLotReturns, valuationDate);

    // Daily benchmark portfolio values, restricted to the active-lot window
    const earliestBenchLot =
      bLotReturns.length > 0
        ? [...bLotReturns].sort((a, b) =>
            a.dateAcquired.localeCompare(b.dateAcquired)
          )[0].dateAcquired
        : null;
    const benchmarkDates = sortedDates.filter(
      (date) =>
        earliestBenchLot !== null &&
        date >= earliestBenchLot &&
        date <= valuationDate
    );
    const bDailyValues: number[] = [];
    for (const date of benchmarkDates) {
      const relevantInvs = active.filter((inv) => inv.dateAcquired <= date);
      let dailyValue = 0;
      for (const inv of relevantInvs) {
        const costBasisUsd = inv.costBasisUsd ?? inv.costBasis;
        const acquiredPrice = priceOnOrBefore(prices, inv.dateAcquired);
        const currentPrice = priceOnOrBefore(prices, date);
        if (acquiredPrice && currentPrice) {
          const shares = costBasisUsd / acquiredPrice.adjClose;
          dailyValue += shares * currentPrice.adjClose;
        }
      }
      if (dailyValue > 0) bDailyValues.push(dailyValue);
    }
    const { annualizedVolatility: bVol, sharpeRatio: bSharpe } =
      volatilityAndSharpe(bDailyValues);

    benchmarks[benchTicker] = {
      totalValue: bTotalValue,
      timeWeightedReturn: bTimeWeightedReturn,
      annualizedVolatility: bVol,
      sharpeRatio: bSharpe,
    };
  }

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
}

interface ComputeHistoricalInput {
  investments: Investment[];
  /** Map of holding ticker → historical prices (any order). */
  priceMap: Map<string, HistoricalPricePoint[]>;
  /** Optional benchmark series; pass [] to skip benchmark column. */
  benchmarkPrices: HistoricalPricePoint[];
}

export function computeHistoricalValues(
  input: ComputeHistoricalInput
): HistoricalValuePoint[] {
  const { investments, priceMap, benchmarkPrices } = input;
  if (investments.length === 0) return [];

  const tickers = [...new Set(investments.map((inv) => inv.ticker))];
  const sortedPriceMap = new Map<string, HistoricalPricePoint[]>();
  for (const ticker of tickers) {
    const prices = priceMap.get(ticker);
    if (prices && prices.length > 0) {
      sortedPriceMap.set(ticker, sortAsc(prices));
    }
  }

  const sortedBenchmarkPrices =
    benchmarkPrices.length > 0 ? sortAsc(benchmarkPrices) : [];

  const earliestAcquisition = investments
    .map((inv) => inv.dateAcquired)
    .sort()[0];
  if (!earliestAcquisition) return [];

  const allDates = new Set<string>();
  for (const prices of sortedPriceMap.values()) {
    for (const price of prices) {
      allDates.add(price.date);
    }
  }
  const sortedDates = Array.from(allDates)
    .sort()
    .filter((date) => date >= earliestAcquisition);

  return sortedDates.map((date) => {
    const relevantInvestments = investments.filter(
      (inv) =>
        inv.dateAcquired <= date && (!inv.dateSold || inv.dateSold > date)
    );

    let totalValue = 0;
    let totalCost = 0;
    for (const inv of relevantInvestments) {
      const prices = sortedPriceMap.get(inv.ticker);
      if (!prices) continue;
      const priceEntry = priceOnOrBefore(prices, date);
      if (priceEntry) {
        totalValue += priceEntry.adjClose * inv.units;
        totalCost += inv.costBasisUsd ?? inv.costBasis;
      }
    }

    const lotReturns: LotReturn[] = [];
    for (const inv of relevantInvestments) {
      const prices = sortedPriceMap.get(inv.ticker);
      if (!prices) continue;
      const priceEntry = priceOnOrBefore(prices, date);
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
    const timeWeightedReturn = annualisedTWR(lotReturns, date);

    let benchmarkTimeWeightedReturn = 0;
    if (sortedBenchmarkPrices.length > 0) {
      const benchmarkLotReturns: LotReturn[] = [];
      for (const inv of relevantInvestments) {
        const costBasisUsd = inv.costBasisUsd ?? inv.costBasis;
        const acquiredPrice = priceOnOrBefore(
          sortedBenchmarkPrices,
          inv.dateAcquired
        );
        const currentPrice = priceOnOrBefore(sortedBenchmarkPrices, date);
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
      benchmarkTimeWeightedReturn = annualisedTWR(benchmarkLotReturns, date);
    }

    return {
      date,
      totalValue,
      totalCost,
      gainLoss: totalValue - totalCost,
      timeWeightedReturn: timeWeightedReturn * 100,
      benchmarkTimeWeightedReturn: benchmarkTimeWeightedReturn * 100,
    };
  });
}
