import { v } from "convex/values";
import { action, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Cached quote (current price) ────────────────────────────────────

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

// ── Fetch latest quote from Tiingo EOD ──────────────────────────────

export const fetchQuote = action({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.TIINGO_API_KEY;
    if (!apiKey) {
      throw new Error("TIINGO_API_KEY not configured");
    }

    const response = await fetch(
      `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(args.ticker)}/prices`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Tiingo API error: ${response.status}`);
    }

    const data = await response.json();
    // Tiingo returns an array with one element containing the latest EOD data
    if (!Array.isArray(data) || data.length === 0 || !data[0].adjClose) {
      throw new Error(`No price data for ticker: ${args.ticker}`);
    }

    const price = data[0].adjClose;

    // Cache the result
    await ctx.runMutation(internal.marketData.upsertCache, {
      ticker: args.ticker,
      price,
      currency: "USD",
    });

    return { ticker: args.ticker, price, currency: "USD" };
  },
});

// ── Ticker search via Tiingo search utility ─────────────────────────

export const searchTicker = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.TIINGO_API_KEY;
    if (!apiKey) {
      throw new Error("TIINGO_API_KEY not configured");
    }

    const response = await fetch(
      `https://api.tiingo.com/tiingo/utilities/search/${encodeURIComponent(args.query)}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Tiingo API error: ${response.status}`);
    }

    const data = await response.json();
    // Return top 10 results mapped to { symbol, description, type }
    return (data || []).slice(0, 10).map(
      (item: { ticker: string; name: string; assetType: string }) => ({
        symbol: item.ticker,
        description: item.name,
        type: item.assetType,
      })
    );
  },
});

// ── Historical price cache ──────────────────────────────────────────

export const getHistoricalCache = query({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("historicalPriceCache")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .first();
  },
});

export const upsertHistoricalCache = internalMutation({
  args: {
    ticker: v.string(),
    prices: v.array(
      v.object({
        date: v.string(),
        adjClose: v.float64(),
      })
    ),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("historicalPriceCache")
      .withIndex("by_ticker", (q) => q.eq("ticker", args.ticker))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        prices: args.prices,
        startDate: args.startDate,
        endDate: args.endDate,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("historicalPriceCache", {
        ticker: args.ticker,
        prices: args.prices,
        startDate: args.startDate,
        endDate: args.endDate,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

// ── Fetch monthly adjusted close prices from Tiingo ─────────────────

export const fetchHistoricalPrices = action({
  args: { ticker: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.TIINGO_API_KEY;
    if (!apiKey) {
      throw new Error("TIINGO_API_KEY not configured");
    }

    // 60 months (5 years) ago
    const now = new Date();
    const startDate = new Date(
      now.getFullYear() - 5,
      now.getMonth(),
      1
    );
    const startDateStr = `${startDate.getFullYear()}-${startDate.getMonth() + 1}-${startDate.getDate()}`;

    const response = await fetch(
      `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(args.ticker)}/prices?startDate=${startDateStr}&resampleFreq=monthly`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Tiingo API error: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No historical data for ticker: ${args.ticker}`);
    }

    const prices = data.map(
      (item: { date: string; adjClose: number }) => ({
        date: item.date.split("T")[0], // normalize to YYYY-MM-DD
        adjClose: item.adjClose,
      })
    );

    const endDateStr = prices[prices.length - 1].date;

    // Cache the result
    await ctx.runMutation(internal.marketData.upsertHistoricalCache, {
      ticker: args.ticker,
      prices,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    return { ticker: args.ticker, prices };
  },
});
