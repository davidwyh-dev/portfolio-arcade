"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useConvexAuth } from "convex/react";

export type AppMode = "loading" | "auth" | "guest" | "anonymous";

interface AppModeContextValue {
  mode: AppMode;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [guestFlag, setGuestFlag] = useState(false);

  const value = useMemo<AppModeContextValue>(() => {
    let mode: AppMode;
    if (isLoading) mode = "loading";
    else if (isAuthenticated) mode = "auth";
    else if (guestFlag) mode = "guest";
    else mode = "anonymous";

    return {
      mode,
      enterGuestMode: () => setGuestFlag(true),
      exitGuestMode: () => setGuestFlag(false),
    };
  }, [isLoading, isAuthenticated, guestFlag]);

  return (
    <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>
  );
}

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (ctx === null) {
    throw new Error("useAppMode must be used inside AppModeProvider");
  }
  return ctx;
}
