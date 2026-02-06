import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  accounts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    accountType: v.union(
      v.literal("Traditional 401k"),
      v.literal("Roth 401k"),
      v.literal("Traditional IRA"),
      v.literal("Roth IRA"),
      v.literal("Investment")
    ),
    taxDeferred: v.boolean(),
    institution: v.string(),
  }).index("by_user", ["userId"]),

  investments: defineTable({
    userId: v.id("users"),
    accountId: v.id("accounts"),
    ticker: v.string(),
    dateAcquired: v.string(),
    dateSold: v.optional(v.string()),
    units: v.float64(),
    unitPrice: v.optional(v.float64()),
    costBasis: v.float64(),
    currency: v.string(),
    currentPriceUsd: v.optional(v.float64()),
    currentValueUsd: v.optional(v.float64()),
    costBasisUsd: v.optional(v.float64()),
    soldUnitPrice: v.optional(v.float64()),
    soldValueUsd: v.optional(v.float64()),
    lastPriceUpdate: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_account", ["accountId"]),

  marketDataCache: defineTable({
    ticker: v.string(),
    price: v.float64(),
    currency: v.string(),
    updatedAt: v.string(),
  }).index("by_ticker", ["ticker"]),

  fxRateCache: defineTable({
    baseCurrency: v.string(),
    quoteCurrency: v.string(),
    rate: v.float64(),
    updatedAt: v.string(),
  }).index("by_pair", ["baseCurrency", "quoteCurrency"]),
});
