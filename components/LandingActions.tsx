"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppMode } from "@/lib/appMode";
import { useGuestActions } from "@/lib/guestStore";

export function LandingActions() {
  const router = useRouter();
  const { enterGuestMode } = useAppMode();
  const { reset } = useGuestActions();

  const handleStart = () => {
    reset();
    enterGuestMode();
    router.push("/dashboard");
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          onClick={handleStart}
          className="rounded border border-neon-cyan px-8 py-3 font-retro text-xs text-neon-cyan transition-all duration-200 hover:bg-neon-cyan/10 hover:shadow-[0_0_16px_rgba(0,255,255,0.2)]"
        >
          START GAME
        </button>
        <Link
          href="/auth?mode=login"
          className="rounded border border-neon-magenta px-8 py-3 font-retro text-xs text-neon-magenta transition-all duration-200 hover:bg-neon-magenta/10 hover:shadow-[0_0_16px_rgba(255,0,255,0.2)]"
        >
          CONTINUE
        </Link>
      </div>
      <p className="mt-4 font-terminal text-base text-foreground/30">
        START GAME = guest mode (no sign-up, no save). CONTINUE to sign in.
      </p>
    </>
  );
}
