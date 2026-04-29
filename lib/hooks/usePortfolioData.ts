"use client";

import { useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAppMode } from "@/lib/appMode";
import {
  useGuestAccounts,
  useGuestActions,
  useGuestInvestments,
} from "@/lib/guestStore";
import {
  computeHistoricalValues,
  computeSummary,
  emptySummary,
} from "@/lib/portfolio-math";
import {
  BENCHMARK_TICKERS,
  type Account,
  type Benchmark,
  type HistoricalPricePoint,
  type HistoricalValuePoint,
  type Investment,
  type InvestmentWithAccount,
  type SummaryResult,
} from "@/lib/types";

/* ── Reads ──────────────────────────────────────────────────────────── */

export function useAccountsData(): Account[] | undefined {
  const { mode } = useAppMode();
  const convexAccounts = useQuery(
    api.accounts.list,
    mode === "auth" ? {} : "skip"
  );
  const guestAccounts = useGuestAccounts();
  if (mode === "guest") return guestAccounts;
  if (mode === "auth") return convexAccounts as Account[] | undefined;
  return undefined;
}

export function useInvestmentsData(): InvestmentWithAccount[] | undefined {
  const { mode } = useAppMode();
  const convexInvestments = useQuery(
    api.investments.list,
    mode === "auth" ? {} : "skip"
  );
  const guestInvestments = useGuestInvestments();
  const guestAccounts = useGuestAccounts();

  // Pull historical prices for guest holdings — used to seed currentPriceUsd
  // from the latest cached entry (cache-only policy means we never hit Tiingo
  // live, but the cache typically has data from prior authed sessions).
  const guestTickers = useMemo(
    () =>
      mode === "guest"
        ? [...new Set(guestInvestments.map((inv) => inv.ticker))]
        : [],
    [mode, guestInvestments]
  );
  const guestHistorical = useQuery(
    api.prices.getHistoricalForTickers,
    mode === "guest" && guestTickers.length > 0
      ? { tickers: guestTickers }
      : "skip"
  );

  if (mode === "guest") {
    const accountById = new Map(guestAccounts.map((a) => [a._id, a.name]));
    return guestInvestments.map((inv) => {
      const enriched: InvestmentWithAccount = {
        ...inv,
        accountName: accountById.get(inv.accountId) ?? "Unknown",
      };
      // Hydrate value fields from the latest cached historical price.
      if (guestHistorical && enriched.currentPriceUsd === undefined) {
        const prices = guestHistorical[inv.ticker];
        if (prices && prices.length > 0) {
          const latest = [...prices].sort((a, b) =>
            a.date.localeCompare(b.date)
          )[prices.length - 1];
          enriched.currentPriceUsd = latest.adjClose;
          enriched.currentValueUsd = latest.adjClose * inv.units;
          enriched.costBasisUsd = enriched.costBasisUsd ?? inv.costBasis;
        }
      }
      return enriched;
    });
  }
  if (mode === "auth") {
    return convexInvestments as InvestmentWithAccount[] | undefined;
  }
  return undefined;
}

/* ── Account mutations ──────────────────────────────────────────────── */

export interface CreateAccountArgs {
  name: string;
  accountType: string;
  taxDeferred: boolean;
  institution: string;
}

export function useCreateAccount(): (args: CreateAccountArgs) => Promise<void> {
  const { mode } = useAppMode();
  const create = useMutation(api.accounts.create);
  const guest = useGuestActions();
  return async (args) => {
    if (mode === "auth") {
      await create(args);
      return;
    }
    if (mode === "guest") {
      guest.createAccount(args);
      return;
    }
    throw new Error("Cannot create account before sign-in / guest entry");
  };
}

export interface UpdateAccountArgs extends CreateAccountArgs {
  id: string;
}

export function useUpdateAccount(): (args: UpdateAccountArgs) => Promise<void> {
  const { mode } = useAppMode();
  const update = useMutation(api.accounts.update);
  const guest = useGuestActions();
  return async ({ id, ...rest }) => {
    if (mode === "auth") {
      await update({ id: id as Id<"accounts">, ...rest });
      return;
    }
    if (mode === "guest") {
      guest.updateAccount({ _id: id, ...rest });
      return;
    }
    throw new Error("Cannot update account before sign-in / guest entry");
  };
}

export function useRemoveAccount(): (args: { id: string }) => Promise<void> {
  const { mode } = useAppMode();
  const remove = useMutation(api.accounts.remove);
  const guest = useGuestActions();
  return async ({ id }) => {
    if (mode === "auth") {
      await remove({ id: id as Id<"accounts"> });
      return;
    }
    if (mode === "guest") {
      guest.removeAccount(id);
      return;
    }
    throw new Error("Cannot remove account before sign-in / guest entry");
  };
}

/* ── Investment mutations ───────────────────────────────────────────── */

export interface CreateInvestmentArgs {
  accountId: string;
  ticker: string;
  dateAcquired: string;
  dateSold?: string;
  units: number;
  unitPrice: number;
  soldUnitPrice?: number;
  currency: string;
}

function deriveCostFields(args: CreateInvestmentArgs) {
  const costBasis = args.unitPrice * args.units;
  // Guest mode skips FX; treat costBasis as USD when USD-denominated.
  const costBasisUsd = args.currency === "USD" ? costBasis : undefined;
  return { costBasis, costBasisUsd };
}

export function useCreateInvestment(): (
  args: CreateInvestmentArgs
) => Promise<string> {
  const { mode } = useAppMode();
  const create = useMutation(api.investments.create);
  const guest = useGuestActions();
  return async (args) => {
    if (mode === "auth") {
      const id = await create({
        ...args,
        accountId: args.accountId as Id<"accounts">,
      });
      return id as string;
    }
    if (mode === "guest") {
      const { costBasis, costBasisUsd } = deriveCostFields(args);
      return guest.createInvestment({ ...args, costBasis, costBasisUsd });
    }
    throw new Error("Cannot create investment before sign-in / guest entry");
  };
}

export interface UpdateInvestmentArgs extends CreateInvestmentArgs {
  id: string;
}

export function useUpdateInvestment(): (
  args: UpdateInvestmentArgs
) => Promise<void> {
  const { mode } = useAppMode();
  const update = useMutation(api.investments.update);
  const guest = useGuestActions();
  const guestInvestments = useGuestInvestments();
  return async ({ id, accountId, ...rest }) => {
    if (mode === "auth") {
      await update({
        id: id as Id<"investments">,
        accountId: accountId as Id<"accounts">,
        ...rest,
      });
      return;
    }
    if (mode === "guest") {
      const existing = guestInvestments.find((inv) => inv._id === id);
      const { costBasis, costBasisUsd } = deriveCostFields({
        accountId,
        ...rest,
      });
      guest.updateInvestment({
        ...(existing ?? ({} as Investment)),
        _id: id,
        accountId,
        ...rest,
        costBasis,
        costBasisUsd: costBasisUsd ?? existing?.costBasisUsd,
      });
      return;
    }
    throw new Error("Cannot update investment before sign-in / guest entry");
  };
}

export function useRemoveInvestment(): (args: {
  id: string;
}) => Promise<void> {
  const { mode } = useAppMode();
  const remove = useMutation(api.investments.remove);
  const guest = useGuestActions();
  return async ({ id }) => {
    if (mode === "auth") {
      await remove({ id: id as Id<"investments"> });
      return;
    }
    if (mode === "guest") {
      guest.removeInvestment(id);
      return;
    }
    throw new Error("Cannot remove investment before sign-in / guest entry");
  };
}

export interface BulkCreateInvestmentsArgs {
  investments: CreateInvestmentArgs[];
}

export function useBulkCreateInvestments(): (
  args: BulkCreateInvestmentsArgs
) => Promise<{ count: number; ids: string[] }> {
  const { mode } = useAppMode();
  const bulk = useMutation(api.investments.bulkCreate);
  const guest = useGuestActions();
  return async ({ investments }) => {
    if (mode === "auth") {
      const result = await bulk({
        investments: investments.map((inv) => ({
          ...inv,
          accountId: inv.accountId as Id<"accounts">,
        })),
      });
      return { count: result.count, ids: result.ids as string[] };
    }
    if (mode === "guest") {
      return guest.bulkCreateInvestments(
        investments.map((inv) => {
          const { costBasis, costBasisUsd } = deriveCostFields(inv);
          return { ...inv, costBasis, costBasisUsd };
        })
      );
    }
    throw new Error("Cannot bulk create before sign-in / guest entry");
  };
}

/* ── Computed: summary & historical values ──────────────────────────── */

export function useSummary(args: {
  valuationDate?: string;
}): SummaryResult | undefined {
  const { mode } = useAppMode();
  const valuationDate =
    args.valuationDate ?? new Date().toISOString().split("T")[0];

  // Auth mode: server computes everything
  const authQueryArgs = useMemo(
    () => (args.valuationDate ? { valuationDate: args.valuationDate } : {}),
    [args.valuationDate]
  );
  const authSummary = useQuery(
    api.portfolio.getSummary,
    mode === "auth" ? authQueryArgs : "skip"
  );

  // Guest mode: pull cached prices for holdings + benchmarks, compute client-side
  const guestInvestments = useInvestmentsData();
  const tickers = useMemo(() => {
    if (mode !== "guest" || !guestInvestments) return [];
    return [
      ...new Set([
        ...guestInvestments.map((inv) => inv.ticker),
        ...BENCHMARK_TICKERS,
      ]),
    ];
  }, [mode, guestInvestments]);
  const guestPrices = useQuery(
    api.prices.getHistoricalForTickers,
    mode === "guest" && tickers.length > 0 ? { tickers } : "skip"
  );

  if (mode === "auth") return authSummary as SummaryResult | undefined;

  if (mode === "guest") {
    if (!guestInvestments) return undefined;
    if (guestInvestments.length === 0) return emptySummary(valuationDate);
    if (!guestPrices) return undefined;

    // The user-portfolio priceMap must include every holding ticker —
    // including benchmark ETFs, if the user happens to own one.
    const userTickers = new Set(guestInvestments.map((inv) => inv.ticker));
    const priceMap = recordToMap(guestPrices, (t) => userTickers.has(t));
    const benchmarkPriceMap = recordToMap(guestPrices, isBenchmark);

    return computeSummary({
      investments: guestInvestments as Investment[],
      priceMap,
      benchmarkPriceMap,
      valuationDate,
    });
  }

  return undefined;
}

export function useHistoricalValues(args: {
  benchmarkTicker?: Benchmark;
}): HistoricalValuePoint[] | undefined {
  const { mode } = useAppMode();

  const authData = useQuery(
    api.portfolio.getHistoricalValues,
    mode === "auth" ? { benchmarkTicker: args.benchmarkTicker } : "skip"
  );

  const guestInvestments = useInvestmentsData();
  const tickers = useMemo(() => {
    if (mode !== "guest" || !guestInvestments) return [];
    const set = new Set(guestInvestments.map((inv) => inv.ticker));
    if (args.benchmarkTicker) set.add(args.benchmarkTicker);
    return [...set];
  }, [mode, guestInvestments, args.benchmarkTicker]);
  const guestPrices = useQuery(
    api.prices.getHistoricalForTickers,
    mode === "guest" && tickers.length > 0 ? { tickers } : "skip"
  );

  if (mode === "auth") return authData as HistoricalValuePoint[] | undefined;

  if (mode === "guest") {
    if (!guestInvestments) return undefined;
    if (guestInvestments.length === 0) return [];
    if (!guestPrices) return undefined;

    const priceMap = new Map<string, HistoricalPricePoint[]>();
    for (const ticker of guestInvestments.map((inv) => inv.ticker)) {
      const prices = guestPrices[ticker];
      if (prices) priceMap.set(ticker, prices);
    }
    const benchmarkPrices = args.benchmarkTicker
      ? guestPrices[args.benchmarkTicker] ?? []
      : [];

    return computeHistoricalValues({
      investments: guestInvestments as Investment[],
      priceMap,
      benchmarkPrices,
    });
  }

  return undefined;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function isBenchmark(ticker: string): boolean {
  return (BENCHMARK_TICKERS as readonly string[]).includes(ticker);
}

function recordToMap(
  record: Record<string, HistoricalPricePoint[]>,
  predicate: (ticker: string) => boolean
): Map<string, HistoricalPricePoint[]> {
  const map = new Map<string, HistoricalPricePoint[]>();
  for (const [ticker, prices] of Object.entries(record)) {
    if (predicate(ticker)) map.set(ticker, prices);
  }
  return map;
}
