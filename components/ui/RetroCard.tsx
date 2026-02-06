"use client";

import { ReactNode } from "react";

interface RetroCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "cyan" | "magenta" | "green";
}

const glowStyles = {
  cyan: "border-neon-cyan/30 hover:border-neon-cyan/60 border-glow-cyan",
  magenta:
    "border-neon-magenta/30 hover:border-neon-magenta/60 border-glow-magenta",
  green: "border-neon-green/30 hover:border-neon-green/60 border-glow-green",
};

export function RetroCard({
  children,
  className = "",
  glowColor = "cyan",
}: RetroCardProps) {
  return (
    <div
      className={`rounded-lg border bg-surface p-4 transition-all duration-300 ${glowStyles[glowColor]} ${className}`}
    >
      {children}
    </div>
  );
}
