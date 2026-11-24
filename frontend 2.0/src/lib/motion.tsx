import React, { useRef, useState } from "react";
import { motion, AnimatePresence, useSpring, type Variants } from "framer-motion";

/* ---------- spring presets (NEVER linear) ---------- */
export const SPRING = { type: "spring", stiffness: 350, damping: 30 } as const;
export const SPRING_SOFT = { type: "spring", stiffness: 200, damping: 25 } as const;
export const SPRING_BOUNCY = { type: "spring", stiffness: 400, damping: 15 } as const;

/* ---------- page transition (blur + shift + spring) ---------- */
export const pageVariants = {
  initial: { opacity: 0, y: 30, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -20, filter: "blur(4px)" },
};
export const PAGE_TRANSITION = { ...SPRING_SOFT, duration: 0.55 } as const;

export function PageWrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={PAGE_TRANSITION}>
      {children}
    </motion.div>
  );
}

/* ---------- language switch cross-fade (no layout shift) ---------- */
export function LangFade({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <motion.div
      key={lang}
      initial={{ opacity: 0, filter: "blur(2px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- staggered word reveal ---------- */
export function StaggerWords({
  text,
  className = "",
  wordClassName = "",
  delay = 0,
  as = "span",
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "span" | "p";
}) {
  const words = text.split(" ");
  const Comp = as as any;
  return (
    <Comp className={className} style={{ perspective: 500 }} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em] align-bottom">
          <motion.span
            className={`inline-block will-change-transform ${wordClassName}`}
            initial={{ opacity: 0, y: 26, rotateX: 45, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)" }}
            transition={{ ...SPRING_SOFT, delay: delay + i * 0.075 }}
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </Comp>
  );
}

/* ---------- fade-up chunk reveal ---------- */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: SPRING_SOFT },
};
export function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={fadeUp} initial="hidden" animate="show" transition={{ ...SPRING_SOFT, delay }}>
      {children}
    </motion.div>
  );
}

/* ---------- magnetic pull (cursor-reactive) ---------- */
export function Magnetic({
  children,
  strength = 0.3,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, SPRING_SOFT);
  const y = useSpring(0, SPRING_SOFT);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

/* ---------- 3D tilt card (perspective + rotateX/Y toward cursor) ---------- */
export function TiltCard({
  children,
  className = "",
  onClick,
  intensity = 7,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  intensity?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(0, SPRING_SOFT);
  const ry = useSpring(0, SPRING_SOFT);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * intensity);
    rx.set(-py * intensity);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        ref={ref}
        className={className}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", ...style }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ---------- animated modal — radial-blur backdrop from click origin ---------- */
export function AnimatedModal({
  open,
  onClose,
  origin,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  origin?: { x: number; y: number };
  children: React.ReactNode;
  className?: string;
}) {
  const o = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          style={{
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            background: `radial-gradient(circle at ${o.x}px ${o.y}px, oklch(0.1 0.01 60 / 0.35) 0%, oklch(0.1 0.01 60 / 0.65) 100%)`,
          }}
          onClick={onClose}
        >
          <motion.div
            className={`w-full max-w-lg ${className}`}
            style={{ transformPerspective: 1200 }}
            initial={{ scale: 0.85, rotateX: 6, y: 40, opacity: 0 }}
            animate={{ scale: 1, rotateX: 0, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, rotateX: 4, opacity: 0, transition: { duration: 0.16 } }}
            transition={{ ...SPRING_BOUNCY, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- glowing pulsing badge (L4 emergency) ---------- */
export function PulseBadge({ color, children, glow = true }: { color: string; children: React.ReactNode; glow?: boolean }) {
  return (
    <motion.span
      className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white"
      style={{
        background: color,
        boxShadow: glow ? `0 0 0 0 ${color}` : undefined,
      }}
      animate={glow ? { scale: [1, 1.06, 1], boxShadow: [`0 0 0 0 ${color}`, `0 0 0 14px transparent`, `0 0 0 0 ${color}`] } : undefined}
      transition={glow ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      {children}
    </motion.span>
  );
}

/* ---------- clip-path section wipe (used with ScrollTrigger) ---------- */
export const wipeClass = "will-change-[clip-path]";

/* ---------- hook: media query ---------- */
export function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  React.useEffect(() => {
    const m = window.matchMedia(query);
    const fn = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(m.matches);
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }, [query]);
  return matches;
}
