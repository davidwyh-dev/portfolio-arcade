import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Join with account names
    const result = await Promise.all(
      investments.map(async (inv) => {
        const account = await ctx.db.get(inv.accountId);
        return {
          ...inv,
          accountName: account?.name ?? "Unknown",
        };
      })
    );
    return result;
  },
});

export const create = mutation({
  args: {
    accountId: v.id("accounts"),
    ticker: v.string(),
    dateAcquired: v.string(),
    dateSold: v.optional(v.string()),
    units: v.float64(),
    unitPrice: v.float64(),
    soldUnitPrice: v.optional(v.float64()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify account ownership
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found");
    }

    const costBasis = args.unitPrice * args.units;

    return await ctx.db.insert("investments", {
      userId,
      accountId: args.accountId,
      ticker: args.ticker.toUpperCase(),
      dateAcquired: args.dateAcquired,
      dateSold: args.dateSold,
      units: args.units,
      unitPrice: args.unitPrice,
      costBasis,
      soldUnitPrice: args.soldUnitPrice,
      currency: args.currency,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("investments"),
    accountId: v.id("accounts"),
    ticker: v.string(),
    dateAcquired: v.string(),
    dateSold: v.optional(v.string()),
    units: v.float64(),
    unitPrice: v.float64(),
    soldUnitPrice: v.optional(v.float64()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const investment = await ctx.db.get(args.id);
    if (!investment || investment.userId !== userId) {
      throw new Error("Investment not found");
    }

    const costBasis = args.unitPrice * args.units;

    await ctx.db.patch(args.id, {
      accountId: args.accountId,
      ticker: args.ticker.toUpperCase(),
      dateAcquired: args.dateAcquired,
      dateSold: args.dateSold,
      units: args.units,
      unitPrice: args.unitPrice,
      costBasis,
      soldUnitPrice: args.soldUnitPrice,
      currency: args.currency,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("investments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const investment = await ctx.db.get(args.id);
    if (!investment || investment.userId !== userId) {
      throw new Error("Investment not found");
    }
    await ctx.db.delete(args.id);
  },
});

export const updatePrice = mutation({
  args: {
    id: v.id("investments"),
    currentPriceUsd: v.float64(),
    currentValueUsd: v.float64(),
    costBasisUsd: v.float64(),
    soldValueUsd: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {
      currentPriceUsd: args.currentPriceUsd,
      currentValueUsd: args.currentValueUsd,
      costBasisUsd: args.costBasisUsd,
      lastPriceUpdate: new Date().toISOString(),
    };
    if (args.soldValueUsd !== undefined) {
      patch.soldValueUsd = args.soldValueUsd;
    }
    await ctx.db.patch(args.id, patch);
  },
});
