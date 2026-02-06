"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface RetroModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function RetroModal({
  isOpen,
  onClose,
  title,
  children,
}: RetroModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative mx-4 w-full max-w-lg rounded-lg border border-neon-cyan/30 bg-surface p-6 shadow-[0_0_20px_rgba(0,255,255,0.1)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-retro text-xs text-neon-cyan">{title}</h2>
          <button
            onClick={onClose}
            className="text-foreground/50 transition-colors hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
