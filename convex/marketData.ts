import { v } from "convex/values";
import { action, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const getCachedQuote = query({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("marketDataCache")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .first();
    return cached;
  },
});

export const upsertCache = internalMutation({
  args: {
    ticker: v.string(),
    price: v.float64(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("marketDataCache")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        price: args.price,
        currency: args.currency,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("marketDataCache", {
        ticker: args.ticker,
        price: args.price,
        currency: args.currency,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

export const fetchQuote = action({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      throw new Error("FINNHUB_API_KEY not configured");
    }

    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(args.ticker)}&token=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    // Finnhub quote response: c = current price, h = high, l = low, o = open, pc = prev close
    if (!data.c || data.c === 0) {
      throw new Error(`No price data for ticker: ${args.ticker}`);
    }

    const price = data.c;

    // Cache the result
    await ctx.runMutation(internal.marketData.upsertCache, {
      ticker: args.ticker,
      price,
      currency: "USD",
    });

    return { ticker: args.ticker, price, currency: "USD" };
  },
});

export const searchTicker = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      throw new Error("FINNHUB_API_KEY not configured");
    }

    const response = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(args.query)}&token=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();
    // Return top 10 results with symbol and description
    return (data.result || []).slice(0, 10).map(
      (item: { symbol: string; description: string; type: string }) => ({
        symbol: item.symbol,
        description: item.description,
        type: item.type,
      })
    );
  },
});
