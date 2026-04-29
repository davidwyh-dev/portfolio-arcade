import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Public (no-auth) bulk fetch of cached historical prices.
 * Used by guest-mode dashboards to compute portfolio metrics client-side
 * from a list of tickers in a single round-trip. Returns only data already
 * in `historicalPriceCache` — never triggers a remote fetch.
 */
export const getHistoricalForTickers = query({
  args: { tickers: v.array(v.string()) },
  handler: async (ctx, args) => {
    const result: Record<string, Array<{ date: string; adjClose: number }>> = {};
    await Promise.all(
      args.tickers.map(async (ticker) => {
        const cached = await ctx.db
          .query("historicalPriceCache")
          .withIndex("by_ticker", (q) => q.eq("ticker", ticker))
          .first();
        if (cached && cached.prices) {
          result[ticker] = cached.prices;
        }
      })
    );
    return result;
  },
});

