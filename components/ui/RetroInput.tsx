"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface RetroInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const RetroInput = forwardRef<HTMLInputElement, RetroInputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="font-terminal text-lg tracking-wide text-foreground/70">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`rounded border border-border-dim bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-foreground/30 focus:border-neon-cyan/60 focus:shadow-[0_0_8px_rgba(0,255,255,0.1)] ${error ? "border-neon-red/60" : ""} ${className}`}
          {...props}
        />
        {error && (
          <span className="font-terminal text-sm text-neon-red">{error}</span>
        )}
      </div>
    );
  }
);

RetroInput.displayName = "RetroInput";
