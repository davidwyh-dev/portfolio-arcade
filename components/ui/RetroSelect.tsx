"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

interface RetroSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const RetroSelect = forwardRef<HTMLSelectElement, RetroSelectProps>(
  ({ label, error, options, placeholder, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="font-terminal text-lg tracking-wide text-foreground/70">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`rounded border border-border-dim bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors duration-200 focus:border-neon-cyan/60 focus:shadow-[0_0_8px_rgba(0,255,255,0.1)] ${error ? "border-neon-red/60" : ""} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="font-terminal text-sm text-neon-red">{error}</span>
        )}
      </div>
    );
  }
);

RetroSelect.displayName = "RetroSelect";
