import { motion, useMotionValue, useSpring } from "framer-motion";
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/* ---------------- inline SVG icon set (no emoji, no icon fonts) ---------------- */

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconCross = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4z" />
  </svg>
);

export const IconShield = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3l7 3v5c0 4.6-2.9 8.4-7 10-4.1-1.6-7-5.4-7-10V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconPulse = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M2 12h4l2.5-7 4 14 2.5-7H22" />
  </svg>
);

export const IconWallet = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <path d="M16 14.5h2" />
  </svg>
);

export const IconMap = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7l-6-3z" />
    <path d="M9 4v13" />
    <path d="M15 7v13" />
  </svg>
);

export const IconPeople = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19c.6-3.2 2.7-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15.5 5.6a3.2 3.2 0 010 4.8" />
    <path d="M17.6 14.4c1.6.9 2.6 2.5 2.9 4.6" />
  </svg>
);

export const IconArrow = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12h15" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

export const IconChevron = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconMic = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0" />
    <path d="M12 17.5V21" />
    <path d="M8.5 21h7" />
  </svg>
);

export const IconImage = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="9.5" r="1.8" />
    <path d="M4 18l5.5-5.5 3.5 3.5 3-3L20 16.5" />
  </svg>
);

export const IconCheck = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
);

export const IconX = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </svg>
);

export const IconAlert = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5l9.5 16.5H2.5L12 3.5z" />
    <path d="M12 9.5v4.5" />
    <path d="M12 16.8v.2" />
  </svg>
);

export function ErrorNotice({ message, critical = false }: { message: string; critical?: boolean }) {
  return (
    <div role="alert" aria-live={critical ? "assertive" : "polite"} className="mt-4 flex items-start gap-2.5 rounded-[4px] border border-danger/35 bg-danger/[0.06] px-4 py-3 text-[12px] leading-relaxed text-frost/90">
      <IconAlert size={14} className="mt-0.5 shrink-0 text-danger" />
      <span>{message}</span>
    </div>
  );
}

export const IconPhone = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 4h4l1.5 4-2 1.5a12 12 0 006 6L16 14l4 1.5v4c0 .8-.7 1.5-1.5 1.5C10 21 3 14 3 5.5 3 4.7 3.7 4 4.5 4H5z" />
  </svg>
);

export const IconSearch = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </svg>
);

export const IconLock = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 018 0v3.5" />
  </svg>
);

export const IconGauge = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 18a9 9 0 1116 0" />
    <path d="M12 18l4.5-5.5" />
    <circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconRefresh = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const IconRotateCw = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const IconUser = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20c.7-3.6 3.6-5.5 7.5-5.5s6.8 1.9 7.5 5.5" />
  </svg>
);

/* ---------------- shared primitives ---------------- */

export function Glass({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-liquid ${className}`}>{children}</div>;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Liquid Metal Button — flowing metallic gradient, cursor-following
 * specular shine, and spring-based magnetic pull toward the pointer.
 */
export function Btn({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "cyan";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 320, damping: 22 });
  const y = useSpring(my, { stiffness: 320, damping: 22 });

  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // magnetic pull — button leans toward the cursor
    mx.set(clamp((e.clientX - (r.left + r.width / 2)) * 0.22, -7, 7));
    my.set(clamp((e.clientY - (r.top + r.height / 2)) * 0.22, -5, 5));
    // specular shine origin
    ref.current.style.setProperty("--sx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  const reset = () => {
    mx.set(0);
    my.set(0);
  };

  const metal =
    variant === "primary" ? "btn-metal" : variant === "cyan" ? "btn-metal btn-metal-cyan" : "";
  const solid =
    variant === "danger"
      ? "bg-danger/90 text-white hover:bg-danger border border-danger/60 shadow-[0_0_28px_rgba(255,77,94,0.25)]"
      : variant === "ghost"
        ? "bg-white/[0.03] text-frost hover:bg-white/[0.07] border border-white/10"
        : "";

  return (
    <motion.button
      ref={ref}
      type={type}
      style={{ x, y }}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.15 }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onClick={onClick}
      disabled={disabled}
      className={`relative min-h-11 rounded-[4px] px-4 py-2.5 text-[13px] font-semibold tracking-wide transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx/80 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss ${metal} ${solid} ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function Chip({
  children,
  tone = "default",
  glow = false,
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "mint" | "cyan" | "red" | "amber";
  glow?: boolean;
  className?: string;
}) {
  const tones = {
    default: "text-mist border-white/10 bg-white/[0.04]",
    mint: "text-mint border-mint/30 bg-mint/[0.06]",
    cyan: "text-cyanx border-cyanx/30 bg-cyanx/[0.06]",
    red: "text-danger border-danger/35 bg-danger/[0.07]",
    amber: "text-amber border-amber/30 bg-amber/[0.06]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${tones} ${
        glow ? (tone === "mint" ? "shadow-[0_0_18px_rgba(52,245,177,0.28)]" : tone === "red" ? "shadow-[0_0_18px_rgba(255,77,94,0.3)]" : "") : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  danger = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`relative h-11 w-[54px] shrink-0 rounded-full border transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx/80 ${
        checked
          ? danger
            ? "bg-danger/70 border-danger/60 shadow-[0_0_16px_rgba(255,77,94,0.4)]"
            : "bg-mint/70 border-mint/50 shadow-[0_0_16px_rgba(52,245,177,0.35)]"
          : "bg-white/[0.06] border-white/10"
      }`}
    >
      <motion.span
        className="absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white"
            animate={{ x: checked ? 30 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      />
    </button>
  );
}

export function RingGauge({
  value,
  size = 148,
  stroke = 9,
  color = "#34f5b1",
  label,
  sub,
  danger = false,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sub?: string;
  danger?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * clamped) / 100 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-display text-[26px] font-semibold leading-none ${danger ? "text-danger" : "text-frost"}`}
        >
          {clamped}%
        </span>
      </div>
      {label && (
        <div className="mt-3 text-center">
          <div className="text-[12px] font-semibold text-frost">{label}</div>
          {sub && <div className="mt-0.5 text-[11px] text-mist">{sub}</div>}
        </div>
      )}
    </div>
  );
}

export function Bar({
  value,
  tone = "mint",
  className = "",
  height = 6,
}: {
  value: number;
  tone?: "mint" | "cyan" | "red" | "amber";
  className?: string;
  height?: number;
}) {
  const tones = {
    mint: "bg-mint shadow-[0_0_10px_rgba(52,245,177,0.5)]",
    cyan: "bg-cyanx shadow-[0_0_10px_rgba(78,230,240,0.5)]",
    red: "bg-danger shadow-[0_0_10px_rgba(255,77,94,0.5)]",
    amber: "bg-amber shadow-[0_0_10px_rgba(255,179,71,0.5)]",
  }[tone];
  return (
    <div className={`w-full rounded-full bg-white/[0.06] ${className}`} style={{ height }}>
      <motion.div
        className={`h-full rounded-full ${tones}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function Field({
  label,
  optionalLabel,
  children,
  className = "",
}: {
  label?: string;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <span className="label">
          {label}
          {optionalLabel && (
            <span className="ml-2 normal-case tracking-normal text-mist/60">— {optionalLabel}</span>
          )}
        </span>
      )}
      {children}
    </div>
  );
}

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 border-b border-white/[0.06] w-full">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={`relative min-h-11 px-4 py-2.5 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx/80 ${
            active === it.id ? "text-frost" : "text-mist hover:text-frost"
          }`}
        >
          {it.label}
          {active === it.id && (
            <motion.span
              layoutId={"tab-underline-" + items.map((i) => i.id).join("-")}
              className="absolute inset-x-2 -bottom-px h-[2px] bg-mint shadow-[0_0_10px_rgba(52,245,177,0.7)]"
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({
  kicker,
  title,
  sub,
}: {
  kicker?: string;
  title: string;
  sub?: string;
}) {
  return (
    <div>
      {kicker && (
        <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-cyanx">
          <span className="h-px w-6 bg-cyanx/50" />
          {kicker}
        </div>
      )}
      <h1 className="font-display text-[22px] md:text-[26px] font-semibold tracking-tight text-frost">{title}</h1>
      {sub && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-mist">{sub}</p>}
    </div>
  );
}

/**
 * Aurora — global breathing light field behind the dashboard routes.
 * Three slow-drifting radial meshes (cyan / emerald / deep blue) animated
 * on transform only; no blur filters, zero layout cost, GPU-composited.
 */
export function Aurora() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-[12%] -top-[18%] h-[62vmax] w-[62vmax]"
        style={{ background: "radial-gradient(circle at 35% 35%, rgba(78,230,240,0.075), transparent 62%)" }}
        animate={{ x: [0, 110, 30, 0], y: [0, 60, -20, 0], scale: [1, 1.08, 0.98, 1] }}
        transition={{ duration: 46, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-[22%] -right-[10%] h-[58vmax] w-[58vmax]"
        style={{ background: "radial-gradient(circle at 60% 40%, rgba(52,245,177,0.06), transparent 62%)" }}
        animate={{ x: [0, -90, -30, 0], y: [0, -50, 25, 0], scale: [1.05, 1, 1.1, 1.05] }}
        transition={{ duration: 54, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />
      <motion.div
        className="absolute left-[28%] top-[30%] h-[46vmax] w-[46vmax]"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(43,105,196,0.05), transparent 60%)" }}
        animate={{ x: [0, 60, -60, 0], y: [0, 40, 30, 0], scale: [1, 1.06, 0.96, 1] }}
        transition={{ duration: 62, repeat: Infinity, ease: "easeInOut", delay: 8 }}
      />
    </div>
  );
}

/** Static film-grain overlay — adds material depth without animation cost */
export function Grain() {
  return <div className="grain" aria-hidden />;
}

export { ErrorToast, LoadingSkeleton, EmptyState } from "./Feedback";


