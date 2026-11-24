import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChevronDown, Stethoscope, IndianRupee, MapPin, Users, Sparkles } from "lucide-react";
import { getCities } from "../lib/api";
import { HeroCanvas, BlobFallback } from "../lib/three";
import { Magnetic, StaggerWords, useMedia, SPRING_SOFT } from "../lib/motion";
import { useT, LANGS } from "../i18n";

gsap.registerPlugin(ScrollTrigger);

function EnterButton({ big = false }: { big?: boolean }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  return (
    <Magnetic strength={0.35}>
      <motion.button
        onClick={() => navigate("/app/home")}
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        transition={SPRING_SOFT}
        className={`relative rounded-full font-display font-bold text-white ${big ? "px-10 py-5 text-lg" : "px-8 py-4 text-base"}`}
        style={{
          background: "var(--coral)",
          boxShadow: hover
            ? "0 0 0 4px color-mix(in oklab, var(--coral) 25%, transparent), 0 18px 48px -12px var(--coral)"
            : "0 12px 36px -14px var(--coral)",
        }}
      >
        {t("l.cta")} →
        {hover && big && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.7, 0], scale: [0.9, 1.25, 1.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ border: "2px solid var(--coral)" }}
          />
        )}
      </motion.button>
    </Magnetic>
  );
}

/**
 * Mounts the R3F canvas only while near the viewport — the GPU never renders
 * off-screen geometry, and low-end devices skip it entirely.
 */
function LazyCanvas({ close = false }: { close?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setInView(entries[0].isIntersecting), { rootMargin: "250px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="absolute inset-0">{inView ? <HeroCanvas close={close} /> : null}</div>;
}

function Stat({ value, suffix, label, id }: { value: number; suffix: string; label: string; id: string }) {
  const numRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: value,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: `#${id}`, start: "top 75%" },
        onUpdate: () => {
          if (numRef.current) numRef.current.textContent = Math.round(obj.v) + suffix;
        },
      });
    });
    return () => ctx.revert();
  }, [value, suffix, id]);
  return (
    <div id={id} className="stat-wipe">
      <span ref={numRef} className="font-display text-[clamp(5rem,13vw,11rem)] font-bold leading-none" style={{ color: "var(--coral)" }}>
        0{suffix}
      </span>
      <p className="mt-4 max-w-xs text-lg leading-relaxed" style={{ color: "var(--fg-muted)" }}>{label}</p>
    </div>
  );
}

const PILLARS = [
  { key: "p1", icon: Stethoscope, c: "var(--coral)", cSoft: "var(--coral-soft)", rot: -3 },
  { key: "p2", icon: IndianRupee, c: "var(--amber)", cSoft: "var(--amber-soft)", rot: 2 },
  { key: "p3", icon: MapPin, c: "var(--mint)", cSoft: "var(--mint-soft)", rot: -2 },
  { key: "p4", icon: Users, c: "var(--lavender)", cSoft: "var(--lavender-soft)", rot: 3 },
];

function LanguageBar() {
  const { t, setLang } = useT();
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="sticky bottom-0 z-30 border-t backdrop-blur-xl" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--bg-surface) 80%, transparent)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 overflow-x-auto px-4 py-3 no-scrollbar sm:gap-3">
        <span className="me-2 hidden shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-widest sm:flex" style={{ color: "var(--fg-subtle)" }}>
          <Sparkles size={13} style={{ color: "var(--coral)" }} />
          {t("l.langBar")}
        </span>
        {LANGS.map((l, i) => (
          <motion.button
            key={l.code}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setLang(l.code)}
            whileTap={{ scale: 0.9 }}
            animate={{ width: active === i ? "auto" : undefined }}
            className="flex h-10 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full border px-3 font-bold transition-all duration-300"
            style={{
              borderColor: "var(--border)",
              background: active === i ? "var(--coral-soft)" : "var(--bg-surface)",
              color: active === i ? "var(--coral)" : "var(--fg-muted)",
              animation: "lang-glow 3.5s ease-in-out infinite",
              animationDelay: `${i * 0.25}s`,
            }}
            dir={l.rtl ? "rtl" : "ltr"}
          >
            <span className="font-display">{l.script}</span>
            <AnimatePresence>
              {active === i && (
                <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="whitespace-nowrap text-xs font-semibold">
                  {l.name}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const { t } = useT();
  const desktop = useMedia("(min-width: 640px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCities().catch(() => {});
  }, []);

  /* refresh triggers after fonts settle (avoid mis-measured positions) */
  useLayoutEffect(() => {
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", onLoad);
    const t = setTimeout(onLoad, 900);
    return () => {
      window.removeEventListener("load", onLoad);
      clearTimeout(t);
    };
  }, []);

  /* GSAP scroll-driven reveals: wipes, stat cards, pillar fly-ins */
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".stat-wipe").forEach((el) => {
        gsap.fromTo(el, { clipPath: "inset(0 100% 0 0)", opacity: 0 }, {
          clipPath: "inset(0 0% 0 0)", opacity: 1, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 78%" },
        });
      });
      gsap.fromTo(".pillar-card", { y: 120, opacity: 0, rotate: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.13,
        scrollTrigger: { trigger: ".pillar-grid", start: "top 80%" },
      });
      gsap.utils.toArray<HTMLElement>(".section-kicker").forEach((el) => {
        gsap.fromTo(el, { clipPath: "inset(0 100% 0 0)" }, {
          clipPath: "inset(0 0% 0 0)", duration: 0.7, ease: "power2.inOut",
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });
      gsap.utils.toArray<HTMLElement>(".divider-line").forEach((el) => {
        gsap.fromTo(el, { width: "0%" }, {
          width: "100%", duration: 0.8, ease: "power2.inOut",
          scrollTrigger: { trigger: el, start: "top 90%" },
        });
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
      <motion.div
        key="landing"
        ref={sectionRef}
        exit={{ scale: 1.1, opacity: 0, filter: "blur(12px)", transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] } }}
      style={{ background: "var(--bg)", color: "var(--fg)" }}
    >
      {/* ── SECTION A — HERO ── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden py-16">
        {desktop && !reduced ? <LazyCanvas /> : <BlobFallback />}
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 35%, color-mix(in oklab, var(--bg) 72%, transparent) 100%)" }} />

        <div className="pointer-events-none relative z-10 flex flex-col items-center px-6 text-center">
          <StaggerWords
            text={t("l.kicker")}
            className="mb-7 text-[11px] font-bold uppercase tracking-[0.3em] sm:text-xs"
            wordClassName="text-muted"
            delay={0.15}
          />
          <h1 className="font-display text-[clamp(2.6rem,7.5vw,6rem)] font-bold leading-[1.02] tracking-tight">
            <StaggerWords text={t("l.h1a")} delay={0.3} />
            <br />
            <StaggerWords text={t("l.h1b")} delay={0.55} wordClassName="text-coral" />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ ...SPRING_SOFT, delay: 1.0 }}
            className="mt-8 max-w-xl text-balance text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--fg-muted)" }}
          >
            {t("l.sub")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_SOFT, delay: 1.25 }}
            className="pointer-events-auto mt-10"
          >
            <EnterButton />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="scroll-ind absolute bottom-7 z-10 flex flex-col items-center gap-1.5"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: "var(--fg-subtle)" }}>{t("l.scroll")}</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
            <ChevronDown size={18} style={{ color: "var(--coral)" }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ── SECTION B — THE PROBLEM ── */}
      <section className="relative flex min-h-dvh items-center overflow-hidden" style={{ background: "linear-gradient(180deg, var(--coral-soft) 0%, var(--bg) 65%)" }}>
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-16 px-6 py-24 md:grid-cols-2 md:gap-10">
          <div className="flex flex-col justify-center">
            <Stat id="stat-1" value={5} suffix=" lakh ₹" label={t("l.stat1d")} />
            <div className="divider-line mt-10 h-px max-w-xs" style={{ background: "var(--coral)" }} />
          </div>
          <div className="flex flex-col justify-center md:items-end md:text-end">
            <Stat id="stat-2" value={384} suffix="" label={t("l.stat2d")} />
            <div className="divider-line mt-10 h-px max-w-xs" style={{ background: "var(--coral)" }} />
          </div>
        </div>
      </section>

      {/* ── SECTION C — FOUR PILLARS ── */}
      <section className="relative pb-10 pt-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="section-kicker text-sm font-bold uppercase tracking-[0.25em]" style={{ color: "var(--fg-muted)" }}>
            {t("l.pillarKicker")}
          </h2>
          <div className="pillar-grid mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <motion.div
                key={p.key}
                className="pillar-card group relative overflow-hidden rounded-3xl p-7"
                style={{ background: `linear-gradient(165deg, ${p.cSoft} 0%, var(--bg-surface) 90%)`, border: "1px solid var(--border)", rotate: p.rot }}
                whileHover={{ y: -8, rotate: 0, transition: SPRING_SOFT }}
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut" }}
                  className="mb-16"
                >
                  <p.icon size={52} strokeWidth={1.4} style={{ color: p.c }} />
                </motion.div>
                <h3 className="font-display text-2xl font-bold">{t(`l.${p.key}t`)}</h3>
                <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>{t(`l.${p.key}d`)}</p>
                <div className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" style={{ background: p.c }} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION D — LANGUAGE BAR (sticky) ── */}
      <LanguageBar />

      {/* ── SECTION E — FINAL CTA ── */}
      <section className="relative flex min-h-dvh items-center justify-center overflow-hidden py-16">
        {desktop && !reduced ? <LazyCanvas close /> : <BlobFallback close />}
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, color-mix(in oklab, var(--bg) 78%, transparent) 100%)" }} />
        <div className="relative z-10 flex flex-col items-center px-6 text-center">
          <h2 className="max-w-3xl font-display text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-[1.05] tracking-tight text-balance">
            <StaggerWords text={t("l.final")} />
          </h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-5 text-lg"
            style={{ color: "var(--fg-muted)" }}
          >
            {t("l.finalSub")}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ...SPRING_SOFT, delay: 0.4 }}
            className="pointer-events-auto mt-10"
          >
            <EnterButton big />
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
}
