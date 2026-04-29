import { Crosshair, BarChart3, RefreshCw } from "lucide-react";
import { LandingActions } from "@/components/LandingActions";

export default function LandingPage() {
  return (
    <div className="retro-grid flex min-h-screen flex-col items-center justify-center px-6">
      {/* Hero */}
      <div className="flex max-w-2xl flex-col items-center text-center">
        <h1 className="glow-cyan mb-4 font-retro text-2xl leading-relaxed text-neon-cyan sm:text-3xl">
          PORTFOLIO
          <br />
          ARCADE
        </h1>
        <p className="mb-12 font-terminal text-2xl text-foreground/60 sm:text-3xl">
          Level up your investments
        </p>

        <LandingActions />
      </div>

      {/* Feature Cards */}
      <div className="mt-20 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-neon-cyan/20 bg-surface p-6 text-center transition-all duration-300 hover:border-neon-cyan/40">
          <Crosshair className="mx-auto mb-3 text-neon-cyan" size={28} />
          <h3 className="mb-2 font-retro text-[10px] text-neon-cyan">TRACK</h3>
          <p className="font-terminal text-lg text-foreground/50">
            Monitor your holdings across multiple accounts and currencies
          </p>
        </div>
        <div className="rounded-lg border border-neon-magenta/20 bg-surface p-6 text-center transition-all duration-300 hover:border-neon-magenta/40">
          <BarChart3 className="mx-auto mb-3 text-neon-magenta" size={28} />
          <h3 className="mb-2 font-retro text-[10px] text-neon-magenta">
            ANALYZE
          </h3>
          <p className="font-terminal text-lg text-foreground/50">
            See annualized returns and portfolio performance at a glance
          </p>
        </div>
        <div className="rounded-lg border border-neon-green/20 bg-surface p-6 text-center transition-all duration-300 hover:border-neon-green/40">
          <RefreshCw className="mx-auto mb-3 text-neon-green" size={28} />
          <h3 className="mb-2 font-retro text-[10px] text-neon-green">
            REBALANCE
          </h3>
          <p className="font-terminal text-lg text-foreground/50">
            Get suggestions to optimize your portfolio allocation
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 pb-8">
        <p className="font-terminal text-lg text-foreground/30">
          PORTFOLIO ARCADE &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
