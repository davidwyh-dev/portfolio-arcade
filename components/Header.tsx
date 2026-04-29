"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";
import { useAppMode } from "@/lib/appMode";
import { useGuestActions } from "@/lib/guestStore";

export function Header() {
  const { signOut } = useAuthActions();
  const { mode, exitGuestMode } = useAppMode();
  const { reset } = useGuestActions();
  const router = useRouter();

  const handleExitGuest = () => {
    reset();
    exitGuestMode();
    router.push("/");
  };

  return (
    <header className="flex items-center justify-between border-b border-border-dim px-6 py-4">
      <h1 className="font-retro text-xs text-neon-cyan sm:text-sm">
        PORTFOLIO ARCADE
      </h1>
      {mode === "guest" ? (
        <div className="flex items-center gap-4">
          <Link
            href="/auth?mode=signup"
            className="font-terminal text-lg text-neon-yellow/80 transition-colors hover:text-neon-yellow"
          >
            SIGN UP
          </Link>
          <button
            onClick={handleExitGuest}
            className="flex items-center gap-2 font-terminal text-lg text-foreground/40 transition-colors hover:text-neon-red"
          >
            <LogOut size={16} />
            EXIT GUEST
          </button>
        </div>
      ) : (
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-2 font-terminal text-lg text-foreground/40 transition-colors hover:text-neon-red"
        >
          <LogOut size={16} />
          SIGN OUT
        </button>
      )}
    </header>
  );
}
