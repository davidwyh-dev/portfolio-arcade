"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { RetroInput } from "@/components/ui/RetroInput";
import { RetroButton } from "@/components/ui/RetroButton";

function AuthForm() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      formData.append("flow", mode === "signup" ? "signUp" : "signIn");
      if (mode === "signup" && name) {
        formData.append("name", name);
      }
      await signIn("password", formData);
    } catch {
      setError(
        mode === "login"
          ? "GAME OVER — Invalid credentials"
          : "GAME OVER — Could not create account"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="retro-grid flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <h1 className="glow-cyan mb-8 text-center font-retro text-lg text-neon-cyan">
          PORTFOLIO ARCADE
        </h1>

        {/* Mode Switcher */}
        <div className="mb-6 flex rounded border border-border-dim">
          <button
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 py-2 font-retro text-[10px] transition-colors ${
              mode === "login"
                ? "bg-neon-cyan/10 text-neon-cyan"
                : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            LOGIN
          </button>
          <button
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`flex-1 py-2 font-retro text-[10px] transition-colors ${
              mode === "signup"
                ? "bg-neon-magenta/10 text-neon-magenta"
                : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            SIGN UP
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <RetroInput
              label="NAME"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player One"
            />
          )}
          <RetroInput
            label="EMAIL"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="player@arcade.com"
            required
          />
          <RetroInput
            label="PASSWORD"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && (
            <div className="rounded border border-neon-red/30 bg-neon-red/5 p-3">
              <p className="font-terminal text-lg text-neon-red">{error}</p>
            </div>
          )}

          <RetroButton
            type="submit"
            variant={mode === "login" ? "primary" : "secondary"}
            size="lg"
            disabled={loading}
            className="mt-2 w-full"
          >
            {loading ? (
              <span className="animate-pulse-glow">
                {mode === "login" ? "LOADING..." : "CREATING..."}
              </span>
            ) : mode === "login" ? (
              "INSERT COIN"
            ) : (
              "NEW PLAYER"
            )}
          </RetroButton>
        </form>

        {/* Back link */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="font-terminal text-lg text-foreground/30 transition-colors hover:text-foreground/50"
          >
            &larr; BACK TO TITLE SCREEN
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="animate-pulse-glow font-retro text-xs text-neon-cyan">
            LOADING...
          </p>
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
