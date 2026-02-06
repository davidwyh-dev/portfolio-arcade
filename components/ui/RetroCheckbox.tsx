"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface RetroCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export const RetroCheckbox = forwardRef<HTMLInputElement, RetroCheckboxProps>(
  ({ label, className = "", ...props }, ref) => {
    return (
      <label className={`flex cursor-pointer items-center gap-3 ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          className="h-4 w-4 rounded border-border-dim bg-background accent-neon-cyan"
          {...props}
        />
        <span className="font-terminal text-lg tracking-wide text-foreground/70">
          {label}
        </span>
      </label>
    );
  }
);

RetroCheckbox.displayName = "RetroCheckbox";
