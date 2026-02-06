"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";

export function Header() {
  const { signOut } = useAuthActions();

  return (
    <header className="flex items-center justify-between border-b border-border-dim px-6 py-4">
      <h1 className="font-retro text-xs text-neon-cyan sm:text-sm">
        PORTFOLIO ARCADE
      </h1>
      <button
        onClick={() => void signOut()}
        className="flex items-center gap-2 font-terminal text-lg text-foreground/40 transition-colors hover:text-neon-red"
      >
        <LogOut size={16} />
        SIGN OUT
      </button>
    </header>
  );
}
