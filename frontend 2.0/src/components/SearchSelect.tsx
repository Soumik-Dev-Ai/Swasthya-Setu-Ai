import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { SPRING_SOFT } from "../lib/motion";

export interface SearchOption {
  label: string;
  group?: string;
}

/**
 * Autocomplete search-dropdown:
 * — bottom-border input, pill-chip when selected (clearable with ✕)
 * — fuzzy (substring) matching, optional grouped sections
 * — keyboard navigation (↑ ↓ Enter Esc), hover highlight, outside-click close
 * — slides open with spring physics, items stagger in
 */
export function SearchSelect({
  options,
  placeholder,
  value,
  onChange,
  accent = "var(--coral)",
  className = "",
}: {
  options: SearchOption[];
  placeholder: string;
  value: string | null;
  onChange: (v: string | null) => void;
  accent?: string;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [q, options]);

  /* close on outside click */
  useEffect(() => {
    if (!open) return;
    const fn = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", fn);
    return () => document.removeEventListener("pointerdown", fn);
  }, [open]);

  const choose = (o: SearchOption) => {
    onChange(o.label);
    setOpen(false);
    setQ("");
  };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[hi]) choose(filtered[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className={`relative ${className}`} style={{ ["--accent" as any]: accent }}>
      {value ? (
        <div className="flex items-center gap-2 border-b-2 py-1.5" style={{ borderColor: accent }}>
          <span
            className="min-w-0 flex-1 truncate rounded-full px-4 py-1.5 text-sm font-bold"
            style={{ background: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent }}
          >
            {value}
          </span>
          <button
            onClick={() => {
              onChange(null);
              setQ("");
              inputRef.current?.focus();
            }}
            className="rounded-full p-1.5 transition-colors hover:bg-fg/10"
            aria-label="clear"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            className="input-line pe-8"
            placeholder={placeholder}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setHi(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded={open}
          />
          <ChevronDown
            size={15}
            className={`pointer-events-none absolute end-1 top-1/2 -translate-y-1/2 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            style={{ color: "var(--fg-subtle)" }}
          />
        </div>
      )}

      <AnimatePresence>
        {open && !value && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0, transition: { duration: 0.16 } }}
            transition={SPRING_SOFT}
            className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border shadow-xl"
            style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", boxShadow: "0 18px 50px -20px oklch(0 0 0 / 0.35)" }}
          >
            <div className="max-h-60 overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-sm" style={{ color: "var(--fg-subtle)" }}>
                  No matches
                </div>
              )}
              {filtered.map((o, i) => {
                const showHeader = !!o.group && o.group !== lastGroup;
                if (showHeader) lastGroup = o.group;
                return (
                  <div key={`${o.group ?? ""}-${o.label}`}>
                    {showHeader && (
                      <div className="px-3 pb-1.5 pt-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-subtle)" }}>
                          {o.group}
                        </span>
                        <div className="mt-1.5 h-px w-full" style={{ background: "var(--border)" }} />
                      </div>
                    )}
                    <motion.button
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING_SOFT, delay: Math.min(i * 0.022, 0.4) }}
                      onMouseEnter={() => setHi(i)}
                      onClick={() => choose(o)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm font-semibold"
                      style={{
                        background: i === hi ? `color-mix(in oklab, ${accent} 12%, transparent)` : "transparent",
                        color: "var(--fg)",
                      }}
                    >
                      <Search size={12} style={{ color: "var(--fg-subtle)" }} />
                      <span className="truncate">{o.label}</span>
                    </motion.button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
