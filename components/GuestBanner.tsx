"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function GuestBanner() {
  return (
    <div className="border-b border-neon-yellow/40 bg-neon-yellow/10 px-6 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-neon-yellow" />
          <p className="font-terminal text-base text-neon-yellow">
            GUEST MODE — DATA WILL BE LOST ON REFRESH. NOTHING IS SAVED.
          </p>
        </div>
        <Link
          href="/auth?mode=signup"
          className="rounded border border-neon-yellow/60 px-3 py-1 font-retro text-[10px] text-neon-yellow transition-all duration-200 hover:bg-neon-yellow/10"
        >
          SIGN UP TO SAVE
        </Link>
      </div>
    </div>
  );
}
