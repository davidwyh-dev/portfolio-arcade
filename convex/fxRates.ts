import { v } from "convex/values";
import { action, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const getRate = query({
  args: {
    baseCurrency: v.string(),
    quoteCurrency: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.baseCurrency === args.quoteCurrency) {
      return { rate: 1, updatedAt: new Date().toISOString() };
    }
    const cached = await ctx.db
      .query("fxRateCache")
      .withIndex("by_pair", (q) =>
        q
          .eq("baseCurrency", args.baseCurrency)
          .eq("quoteCurrency", args.quoteCurrency)
      )
      .first();
    return cached;
  },
});

export const upsertRate = internalMutation({
  args: {
    baseCurrency: v.string(),
    quoteCurrency: v.string(),
    rate: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("fxRateCache")
      .withIndex("by_pair", (q) =>
        q
          .eq("baseCurrency", args.baseCurrency)
          .eq("quoteCurrency", args.quoteCurrency)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rate: args.rate,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("fxRateCache", {
        baseCurrency: args.baseCurrency,
        quoteCurrency: args.quoteCurrency,
        rate: args.rate,
        updatedAt: new Date().toISOString(),
      });
    }
  },
});

export const fetchRates = action({
  args: {},
  handler: async (ctx) => {
    // Fetch all rates with USD as base from Frankfurter
    const response = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD"
    );

    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data = await response.json();
    const rates: Record<string, number> = data.rates;

    // Cache each rate pair
    for (const [currency, rate] of Object.entries(rates)) {
      // Store USD -> currency rate
      await ctx.runMutation(internal.fxRates.upsertRate, {
        baseCurrency: "USD",
        quoteCurrency: currency,
        rate,
      });
      // Also store inverse: currency -> USD
      await ctx.runMutation(internal.fxRates.upsertRate, {
        baseCurrency: currency,
        quoteCurrency: "USD",
        rate: 1 / rate,
      });
    }

    return { baseCurrency: "USD", rates, updatedAt: new Date().toISOString() };
  },
});

export const fetchSingleRate = action({
  args: {
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.from === args.to) return { rate: 1 };

    const response = await fetch(
      `https://api.frankfurter.dev/v1/latest?from=${args.from}&to=${args.to}`
    );

    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates[args.to];

    await ctx.runMutation(internal.fxRates.upsertRate, {
      baseCurrency: args.from,
      quoteCurrency: args.to,
      rate,
    });

    return { rate };
  },
});
