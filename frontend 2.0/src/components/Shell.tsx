import { useState } from "react";
import { NavLink, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home as HomeIcon, Stethoscope, IndianRupee, Shield, MapPin, Users, Moon, Sun, Globe,
} from "lucide-react";
import { useStore } from "../store";
import { useT, LANGS } from "../i18n";
import { SPRING_SOFT } from "../lib/motion";
import ErrorBoundary from "./ErrorBoundary";
import HomePage from "../pages/Home";
import Triage from "../pages/Triage";
import Cost from "../pages/Cost";
import Insurance from "../pages/Insurance";
import Facilities from "../pages/Facilities";
import { AshaDiscovery, AshaRegister, AshaPortal } from "../pages/Asha";
import Admin from "../pages/Admin";

const NAV = [
  { to: "/app/home", key: "nav.home", icon: HomeIcon },
  { to: "/app/triage", key: "nav.triage", icon: Stethoscope },
  { to: "/app/cost", key: "nav.cost", icon: IndianRupee },
  { to: "/app/insurance", key: "nav.insurance", icon: Shield },
  { to: "/app/facilities", key: "nav.facilities", icon: MapPin },
  { to: "/app/asha", key: "nav.asha", icon: Users },
];

const TABS = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[5]];

function StatusDot() {
  const online = useStore((s) => s.online);
  const { t } = useT();
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--fg-muted)" }}>
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${online ? "animate-ping" : ""}`}
          style={{ background: online ? "var(--safe)" : "var(--emergency)", opacity: online ? 0.6 : 1 }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: online ? "var(--safe)" : "var(--emergency)" }} />
      </span>
      <span className="hidden sm:inline">{t(online ? "c.online" : "c.offline")}</span>
    </div>
  );
}

function LangMenu() {
  const { t, lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang)!;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-11 items-center justify-center rounded-full border text-sm font-bold transition-transform hover:scale-105 active:scale-95"
        style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--fg)" }}
        aria-label={t("c.selectLang")}
      >
        {current.script}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15 } }}
            transition={SPRING_SOFT}
            className="absolute end-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl p-1.5 shadow-xl"
            style={{ background: "color-mix(in oklab, var(--bg-elevated) 92%, transparent)", backdropFilter: "blur(16px)", border: "1px solid var(--border)" }}
          >
            <div className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-subtle)" }}>
              <Globe className="me-1 inline h-3 w-3" /> {t("c.selectLang")}
            </div>
            <div className="grid max-h-[60dvh] grid-cols-2 gap-0.5 overflow-y-auto">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-start text-sm transition-colors hover:bg-coral/10"
                  style={{ color: l.code === lang ? "var(--coral)" : "var(--fg)" }}
                  dir={l.rtl ? "rtl" : "ltr"}
                >
                  <span className="inline-flex h-6 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold" style={{ background: l.code === lang ? "var(--coral-soft)" : "var(--bg)", color: l.code === lang ? "var(--coral)" : "var(--fg-muted)" }}>
                    {l.script}
                  </span>
                  <span className="truncate font-medium">{l.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeToggle() {
  const theme = useStore((s) => s.theme);
  const toggle = useStore((s) => s.toggleTheme);
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-full border transition-transform hover:scale-105 active:scale-90"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--fg)" }}
      aria-label="theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -120, opacity: 0, scale: 0.4 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 120, opacity: 0, scale: 0.4, transition: { duration: 0.18 } }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex"
        >
          {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/**
 * App shell: header + bottom tabs + routed content.
 * Page transitions are ENTER-ONLY (keyed remount): navigation can never be
 * blocked by a pending exit animation, and the header always stays alive.
 */
export default function Shell() {
  const { t } = useT();
  const location = useLocation();

  return (
    <div className="min-h-dvh" style={{ background: "var(--bg)" }}>
      {/* header */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--bg) 82%, transparent)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <NavLink to="/app/home" className="shrink-0 font-display text-lg font-bold tracking-tight" style={{ color: "var(--fg)" }}>
            Swasthya<span style={{ color: "var(--coral)" }}>Setu</span>
            <span className="ms-1.5 hidden align-super text-[10px] font-medium uppercase tracking-widest md:inline" style={{ color: "var(--fg-subtle)" }}>AI</span>
          </NavLink>

          <nav className="hidden items-center gap-1 rounded-full border p-1 lg:flex" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
            {NAV.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <NavLink key={item.to} to={item.to} className="relative rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors" style={{ color: active ? "#fff" : "var(--fg-muted)" }}>
                  {active && (
                    <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--coral)" }} transition={SPRING_SOFT} />
                  )}
                  <span className="relative z-10">{t(item.key)}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <StatusDot />
            <LangMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* routed content — keyed remount = deterministic enter animation, zero blocking */}
      <main className="mx-auto max-w-7xl px-4 pb-28 sm:px-6 lg:pb-12">
        <ErrorBoundary key={location.pathname}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 22, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes>
              <Route path="/app/home" element={<HomePage />} />
              <Route path="/app/triage" element={<Triage />} />
              <Route path="/app/cost" element={<Cost />} />
              <Route path="/app/insurance" element={<Insurance />} />
              <Route path="/app/facilities" element={<Facilities />} />
              <Route path="/app/asha" element={<AshaDiscovery />} />
              <Route path="/app/asha/register" element={<AshaRegister />} />
              <Route path="/app/asha/portal" element={<AshaPortal />} />
              <Route path="/app/admin" element={<Admin />} />
              <Route path="*" element={<Navigate to="/app/home" replace />} />
            </Routes>
          </motion.div>
        </ErrorBoundary>
      </main>

      {/* bottom tab bar — thumb reachable on mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--bg-surface) 90%, transparent)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 px-2 py-1.5">
          {TABS.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <NavLink key={item.to} to={item.to} className="group flex flex-col items-center gap-0.5 py-1.5">
                <motion.span whileTap={{ scale: 0.82 }} transition={{ type: "spring", stiffness: 500, damping: 20 }} className="flex h-7 w-12 items-center justify-center rounded-full" style={{ background: active ? "var(--coral-soft)" : "transparent", color: active ? "var(--coral)" : "var(--fg-subtle)" }}>
                  <item.icon size={19} strokeWidth={active ? 2.4 : 2} />
                </motion.span>
                <span className="text-[10px] font-bold" style={{ color: active ? "var(--coral)" : "var(--fg-subtle)" }}>{t(item.key)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
