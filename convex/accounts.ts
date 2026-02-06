import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("accounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("accounts", {
      userId,
      name: args.name,
      accountType: args.accountType,
      taxDeferred: args.taxDeferred,
      institution: args.institution,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("accounts"),
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const account = await ctx.db.get(args.id);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found");
    }
    await ctx.db.patch(args.id, {
      name: args.name,
      accountType: args.accountType,
      taxDeferred: args.taxDeferred,
      institution: args.institution,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("accounts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const account = await ctx.db.get(args.id);
    if (!account || account.userId !== userId) {
      throw new Error("Account not found");
    }
    // Check for linked investments
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_account", (q) => q.eq("accountId", args.id))
      .collect();
    if (investments.length > 0) {
      throw new Error(
        "Cannot delete account with investments. Remove investments first."
      );
    }
    await ctx.db.delete(args.id);
  },
});
