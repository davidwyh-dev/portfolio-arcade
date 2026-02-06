import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getSummary = query({
  args: {
    valuationDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalValue: 0,
        totalCost: 0,
        annualizedReturn: 0,
        holdings: 0,
        valuationDate: "",
      };
    }

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const valuationDate =
      args.valuationDate || new Date().toISOString().split("T")[0];

    // Filter to investments active as of the valuation date:
    // - acquired on or before valuationDate
    // - not yet sold, or sold after valuationDate
    const active = investments.filter((inv) => {
      if (inv.dateAcquired > valuationDate) return false;
      if (inv.dateSold && inv.dateSold <= valuationDate) return false;
      return true;
    });

    if (active.length === 0) {
      return {
        totalValue: 0,
        totalCost: 0,
        annualizedReturn: 0,
        holdings: 0,
        valuationDate,
      };
    }

    let totalValue = 0;
    let totalCost = 0;
    let weightedAnnReturn = 0;

    for (const inv of active) {
      const value = inv.currentValueUsd ?? 0;
      const cost = inv.costBasisUsd ?? inv.costBasis;
      totalValue += value;
      totalCost += cost;

      if (cost > 0 && value > 0) {
        const acquired = new Date(inv.dateAcquired);
        const end = new Date(valuationDate);

        const daysHeld = Math.max(
          1,
          Math.floor(
            (end.getTime() - acquired.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        const holdingReturn = (value - cost) / cost;
        const annReturn = Math.pow(1 + holdingReturn, 365 / daysHeld) - 1;
        // Weight by current value
        weightedAnnReturn += annReturn * value;
      }
    }

    const annualizedReturn =
      totalValue > 0 ? weightedAnnReturn / totalValue : 0;

    return {
      totalValue,
      totalCost,
      annualizedReturn,
      holdings: active.length,
      valuationDate,
    };
  },
});
