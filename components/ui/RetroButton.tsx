"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface RetroButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantStyles = {
  primary:
    "border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-[0_0_12px_rgba(0,255,255,0.2)]",
  secondary:
    "border-neon-magenta text-neon-magenta hover:bg-neon-magenta/10 hover:shadow-[0_0_12px_rgba(255,0,255,0.2)]",
  danger:
    "border-neon-red text-neon-red hover:bg-neon-red/10 hover:shadow-[0_0_12px_rgba(255,7,58,0.2)]",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function RetroButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}: RetroButtonProps) {
  return (
    <button
      className={`rounded border bg-transparent font-mono font-medium tracking-wide transition-all duration-200 ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
