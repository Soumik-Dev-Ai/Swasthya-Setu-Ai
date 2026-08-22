import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface SearchSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}

export function SearchSelect({ value, onChange, options, placeholder = "Search...", disabled }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const selectedIndex = filtered.findIndex((o) => o.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, value]);

  const choose = (option: Option | undefined) => {
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (filtered.length ? (index + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (filtered.length ? (index - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={ref} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        className="field flex min-h-11 w-full items-center justify-between cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-60"
        role="combobox"
        aria-label={placeholder}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
      >
        <span className={selected ? "text-frost" : "text-mist/50"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-mist transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, type: "spring", stiffness: 400, damping: 30 }}
            className="absolute z-[100] mt-2 w-full overflow-hidden rounded-[6px] border border-cyanx/20 bg-abyss shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(78,230,240,0.15)] backdrop-blur-md"
          >
            <div className="border-b border-white/5 p-2">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Type to search..."
                className="w-full bg-transparent px-2 py-1.5 text-[13px] text-frost outline-none placeholder:text-mist/40"
                role="searchbox"
                aria-label={`Filter ${placeholder}`}
              />
            </div>
            <div id={listboxId} className="max-h-60 overflow-y-auto p-1" role="listbox" aria-label={placeholder}>
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-center text-[12px] text-mist/50">No results found.</div>
              ) : (
                filtered.map((opt, index) => (
                  <div
                    key={opt.value}
                    id={`${listboxId}-${opt.value}`}
                    role="option"
                    aria-selected={opt.value === value}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(opt)}
                    className={`cursor-pointer rounded-[4px] px-3 py-2 text-[13px] transition-colors ${index === activeIndex ? "bg-white/[0.08] text-frost" : "text-mist hover:bg-white/[0.06]"}`}
                  >
                    {opt.label}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
