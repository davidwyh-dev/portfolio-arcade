import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getSummary = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalValue: 0,
        totalCost: 0,
        annualizedReturn: 0,
        holdings: 0,
        effectiveStartDate: "",
        effectiveEndDate: "",
      };
    }

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const endDate =
      args.endDate || new Date().toISOString().split("T")[0];

    // Filter to investments active as of the end date:
    // - acquired on or before endDate
    // - not yet sold, or sold after endDate
    const active = investments.filter((inv) => {
      if (inv.dateAcquired > endDate) return false;
      if (inv.dateSold && inv.dateSold <= endDate) return false;
      return true;
    });

    if (active.length === 0) {
      return {
        totalValue: 0,
        totalCost: 0,
        annualizedReturn: 0,
        holdings: 0,
        effectiveStartDate: args.startDate ?? endDate,
        effectiveEndDate: endDate,
      };
    }

    // Default startDate to earliest dateAcquired among active investments
    const startDate =
      args.startDate ||
      active.reduce(
        (earliest, inv) =>
          inv.dateAcquired < earliest ? inv.dateAcquired : earliest,
        active[0].dateAcquired
      );

    let totalValue = 0;
    let totalStartValue = 0;
    let weightedAnnReturn = 0;

    for (const inv of active) {
      const value = inv.currentValueUsd ?? 0;
      const cost = inv.costBasisUsd ?? inv.costBasis;
      totalValue += value;

      if (cost > 0 && value > 0) {
        const effectiveStart =
          inv.dateAcquired > startDate ? inv.dateAcquired : startDate;
        const acquired = new Date(inv.dateAcquired);
        const start = new Date(effectiveStart);
        const end = new Date(endDate);

        const totalDays = Math.max(
          1,
          Math.floor(
            (end.getTime() - acquired.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        const daysHeld = Math.max(
          1,
          Math.floor(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        // When startDate is after dateAcquired, interpolate the value at
        // startDate assuming constant growth (CAGR) from cost to current value.
        let effectiveCost = cost;
        if (effectiveStart > inv.dateAcquired && totalDays > 0) {
          const daysToStart = Math.floor(
            (start.getTime() - acquired.getTime()) / (1000 * 60 * 60 * 24)
          );
          const growthFactor = value / cost;
          effectiveCost =
            cost * Math.pow(growthFactor, daysToStart / totalDays);
        }

        totalStartValue += effectiveCost;

        const holdingReturn = (value - effectiveCost) / effectiveCost;
        const annReturn = Math.pow(1 + holdingReturn, 365 / daysHeld) - 1;
        // Weight by current value
        weightedAnnReturn += annReturn * value;
      } else {
        totalStartValue += cost;
      }
    }

    const annualizedReturn =
      totalValue > 0 ? weightedAnnReturn / totalValue : 0;

    return {
      totalValue,
      totalCost: totalStartValue,
      annualizedReturn,
      holdings: active.length,
      effectiveStartDate: startDate,
      effectiveEndDate: endDate,
    };
  },
});
