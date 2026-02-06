"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface RetroComboboxProps {
  label?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}

export function RetroCombobox({
  label,
  error,
  value,
  onChange,
  options,
  placeholder,
  required,
}: RetroComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal input value when the external value changes (form reset, edit mode, selection)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // When typing, filter options by what the user has entered; otherwise show all
  const filtered =
    isTyping && inputValue
      ? options.filter((opt) =>
          opt.toLowerCase().includes(inputValue.toLowerCase())
        )
      : options;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node)
    ) {
      setIsOpen(false);
      setIsTyping(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsTyping(true);
    onChange(val);
    setIsOpen(true);
  };

  const handleSelect = (opt: string) => {
    setInputValue(opt);
    setIsTyping(false);
    onChange(opt);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleFocus = () => {
    setIsOpen(true);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setIsTyping(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <label className="font-terminal text-lg tracking-wide text-foreground/70">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className={`w-full rounded border border-border-dim bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-foreground/30 focus:border-neon-cyan/60 focus:shadow-[0_0_8px_rgba(0,255,255,0.1)] ${error ? "border-neon-red/60" : ""}`}
        />
        {isOpen && filtered.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded border border-border-dim bg-background shadow-lg shadow-black/40">
            {filtered.map((opt) => (
              <li
                key={opt}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
                className={`cursor-pointer px-3 py-1.5 font-mono text-sm transition-colors hover:bg-neon-cyan/10 hover:text-neon-cyan ${opt === value ? "text-neon-cyan" : "text-foreground"}`}
              >
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <span className="font-terminal text-sm text-neon-red">{error}</span>
      )}
    </div>
  );
}
