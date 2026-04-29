"use client";

import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";
import { Header } from "@/components/Header";
import { GuestBanner } from "@/components/GuestBanner";
import { useAppMode } from "@/lib/appMode";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { mode } = useAppMode();
  const router = useRouter();

  useEffect(() => {
    // Send users back to landing whenever we know they aren't authed and
    // haven't entered guest mode (which on refresh is always the case —
    // guest state lives only in React memory).
    if (mode === "loading") return;
    if (mode === "auth" || mode === "guest") return;
    router.push("/");
  }, [mode, router]);

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse-glow font-retro text-xs text-neon-cyan">
          LOADING...
        </p>
      </div>
    );
  }

  if (mode !== "auth" && mode !== "guest") return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {mode === "guest" && <GuestBanner />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
