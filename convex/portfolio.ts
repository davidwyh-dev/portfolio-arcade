import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  computeHistoricalValues,
  computeSummary,
  emptySummary,
} from "../lib/portfolio-math";
import {
  BENCHMARK_TICKERS,
  type HistoricalPricePoint,
  type Investment,
} from "../lib/types";

export const getSummary = query({
  args: {
    valuationDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return emptySummary();

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const valuationDate =
      args.valuationDate || new Date().toISOString().split("T")[0];

    if (investments.length === 0) return emptySummary(valuationDate);

    const tickers = [...new Set(investments.map((inv) => inv.ticker))];

    const priceMap = await loadHistoricalPriceMap(ctx, tickers);
    const benchmarkPriceMap = await loadHistoricalPriceMap(ctx, [
      ...BENCHMARK_TICKERS,
    ]);

    return computeSummary({
      investments: investments as unknown as Investment[],
      priceMap,
      benchmarkPriceMap,
      valuationDate,
    });
  },
});

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

    const tickers = [...new Set(investments.map((inv) => inv.ticker))];
    const priceMap = await loadHistoricalPriceMap(ctx, tickers);

    let benchmarkPrices: HistoricalPricePoint[] = [];
    if (args.benchmarkTicker) {
      const cached = await ctx.db
        .query("historicalPriceCache")
        .withIndex("by_ticker", (q) => q.eq("ticker", args.benchmarkTicker!))
        .first();
      if (cached) benchmarkPrices = cached.prices;
    }

    return computeHistoricalValues({
      investments: investments as unknown as Investment[],
      priceMap,
      benchmarkPrices,
    });
  },
});

async function loadHistoricalPriceMap(
  ctx: QueryCtx,
  tickers: string[]
): Promise<Map<string, HistoricalPricePoint[]>> {
  const map = new Map<string, HistoricalPricePoint[]>();
  await Promise.all(
    tickers.map(async (ticker) => {
      const cached = await ctx.db
        .query("historicalPriceCache")
        .withIndex("by_ticker", (q) => q.eq("ticker", ticker))
        .first();
      if (cached && cached.prices) {
        map.set(ticker, cached.prices);
      }
    })
  );
  return map;
}
