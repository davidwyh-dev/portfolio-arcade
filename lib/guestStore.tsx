"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Account, Investment } from "./types";

export interface CreateAccountInput {
  name: string;
  accountType: string;
  taxDeferred: boolean;
  institution: string;
}

export interface CreateInvestmentInput {
  accountId: string;
  ticker: string;
  dateAcquired: string;
  dateSold?: string;
  units: number;
  unitPrice: number;
  costBasis: number;
  costBasisUsd?: number;
  currency: string;
  currentPriceUsd?: number;
  currentValueUsd?: number;
  soldUnitPrice?: number;
  soldValueUsd?: number;
}

export interface GuestActions {
  createAccount: (args: CreateAccountInput) => string;
  updateAccount: (args: Account) => void;
  removeAccount: (id: string) => void;
  createInvestment: (args: CreateInvestmentInput) => string;
  updateInvestment: (args: Investment) => void;
  removeInvestment: (id: string) => void;
  bulkCreateInvestments: (
    items: CreateInvestmentInput[]
  ) => { count: number; ids: string[] };
  reset: () => void;
}

const AccountsContext = createContext<Account[] | null>(null);
const InvestmentsContext = createContext<Investment[] | null>(null);
const ActionsContext = createContext<GuestActions | null>(null);

export function GuestStoreProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  // Refs let mutations read up-to-date state without depending on it for
  // memoisation — keeps the actions object identity stable across renders.
  const investmentsRef = useRef(investments);
  useEffect(() => {
    investmentsRef.current = investments;
  }, [investments]);

  const actions = useMemo<GuestActions>(
    () => ({
      createAccount: (args) => {
        const id = crypto.randomUUID();
        setAccounts((prev) => [...prev, { ...args, _id: id }]);
        return id;
      },
      updateAccount: (args) => {
        setAccounts((prev) =>
          prev.map((a) => (a._id === args._id ? args : a))
        );
      },
      removeAccount: (id) => {
        const linked = investmentsRef.current.filter((i) => i.accountId === id);
        if (linked.length > 0) {
          throw new Error(
            "Cannot delete account with investments. Remove investments first."
          );
        }
        setAccounts((prev) => prev.filter((a) => a._id !== id));
      },
      createInvestment: (args) => {
        const id = crypto.randomUUID();
        setInvestments((prev) => [
          ...prev,
          { ...args, _id: id, ticker: args.ticker.toUpperCase() },
        ]);
        return id;
      },
      updateInvestment: (args) => {
        setInvestments((prev) =>
          prev.map((i) => (i._id === args._id ? args : i))
        );
      },
      removeInvestment: (id) => {
        setInvestments((prev) => prev.filter((i) => i._id !== id));
      },
      bulkCreateInvestments: (items) => {
        const newInvs: Investment[] = items.map((args) => ({
          ...args,
          _id: crypto.randomUUID(),
          ticker: args.ticker.toUpperCase(),
        }));
        setInvestments((prev) => [...prev, ...newInvs]);
        return { count: newInvs.length, ids: newInvs.map((i) => i._id) };
      },
      reset: () => {
        setAccounts([]);
        setInvestments([]);
      },
    }),
    []
  );

  return (
    <ActionsContext.Provider value={actions}>
      <AccountsContext.Provider value={accounts}>
        <InvestmentsContext.Provider value={investments}>
          {children}
        </InvestmentsContext.Provider>
      </AccountsContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useGuestAccounts(): Account[] {
  const ctx = useContext(AccountsContext);
  if (ctx === null) {
    throw new Error("useGuestAccounts must be used inside GuestStoreProvider");
  }
  return ctx;
}

export function useGuestInvestments(): Investment[] {
  const ctx = useContext(InvestmentsContext);
  if (ctx === null) {
    throw new Error(
      "useGuestInvestments must be used inside GuestStoreProvider"
    );
  }
  return ctx;
}

export function useGuestActions(): GuestActions {
  const ctx = useContext(ActionsContext);
  if (ctx === null) {
    throw new Error("useGuestActions must be used inside GuestStoreProvider");
  }
  return ctx;
}
