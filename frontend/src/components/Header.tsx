import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LANGS } from "../lib/i18n";
import { useStore, useT } from "../lib/store";
import { IconChevron, IconGauge, IconMap, IconPeople, IconPulse, IconShield, IconWallet } from "./ui";
import { SlideTabs } from "./SlideTabs";

const NAV = [
  { to: "/home", key: "nav.dashboard", icon: <IconGauge size={13} /> },
  { to: "/triage", key: "nav.triage", icon: <IconPulse size={13} /> },
  { to: "/cost", key: "nav.cost", icon: <IconWallet size={13} /> },
  { to: "/insurance", key: "nav.insurance", icon: <IconShield size={13} /> },
  { to: "/facilities", key: "nav.facilities", icon: <IconMap size={13} /> },
  { to: "/asha", key: "nav.asha", icon: <IconPeople size={13} /> },
];

function Brand({ large = false }: { large?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-4 no-tap-highlight">
      <motion.img
        src="/logo.jpg"
        alt="Swasthya Setu AI"
        className={`${large ? "h-14 w-14 rounded-full" : "h-11 w-11 rounded-full"} border border-white/10 object-cover`}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.18 }}
      />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display font-bold tracking-tight text-frost ${
            large ? "text-[21px] md:text-[24px]" : "text-[16px] font-semibold"
          }`}
        >
          Swasthya Setu AI
        </span>
        {!large && (
          <span className="mt-0.5 text-[9.5px] uppercase tracking-[0.24em] text-mist/70">
            Complete Regional Multilingual Support
          </span>
        )}
      </span>
    </Link>
  );
}

function LangSwitcher() {
  const { lang, setLang } = useStore();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={langRef}>
      <button
        onClick={() => setLangOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-[4px] border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] font-semibold text-frost transition-colors hover:bg-white/[0.06]"
        aria-haspopup="listbox"
        aria-expanded={langOpen}
      >
        {LANGS.find((l) => l.code === lang)?.script}
        <IconChevron size={12} className={`text-mist transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {langOpen && (
          <motion.ul
            role="listbox"
            className="absolute right-0 top-[calc(100%+8px)] w-44 overflow-hidden rounded-[5px] border border-white/[0.08] backdrop-blur-2xl bg-[#0a121e]/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            {LANGS.map((l) => (
              <li key={l.code}>
                <button
                  role="option"
                  aria-selected={lang === l.code}
                  onClick={() => {
                    setLang(l.code);
                    setLangOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[12.5px] transition-colors hover:bg-white/[0.05]"
                >
                  <span className={lang === l.code ? "text-mint" : "text-frost"}>{l.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-mist/60">{l.script}</span>
                </button>
              </li>
            ))}
            <li className="border-t border-white/[0.06] px-3.5 py-2.5 text-[10.5px] leading-snug text-mist/70">
              {t("nav.lang.native")}
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header() {
  const t = useT();
  const { ashaMode, setAshaMode } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const isLanding = location.pathname === "/";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const first = menuRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] backdrop-blur-3xl bg-[#04070d]/60">
      <div
        className={`mx-auto flex w-full max-w-[1440px] items-center gap-3 px-6 md:px-12 ${
          isLanding ? "h-20" : "h-16"
        }`}
      >
        {isLanding ? (
          /* immersive landing header — brand + language only */
          <>
            <Brand large />
            <div className="ml-auto">
              <LangSwitcher />
            </div>
          </>
        ) : (
          <>
            <Brand />

            {/* desktop nav — 3D slide tabs */}
            <nav className="ml-8 hidden flex-1 items-center gap-7 lg:flex" aria-label="Primary">
              <SlideTabs items={NAV} />
            </nav>

            <div className="ml-auto flex items-center gap-4 pr-2">
              <LangSwitcher />

              {/* mobile menu button */}
              <button
                ref={menuButtonRef}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-[4px] border border-white/10 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx/80"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="mobile-primary-nav"
              >
                <motion.span animate={{ rotate: menuOpen ? 45 : 0, y: menuOpen ? 4 : 0 }} className="block h-px w-4 bg-frost" />
                <motion.span animate={{ opacity: menuOpen ? 0 : 1 }} className="block h-px w-4 bg-frost" />
                <motion.span animate={{ rotate: menuOpen ? -45 : 0, y: menuOpen ? -4 : 0 }} className="block h-px w-4 bg-frost" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* mobile nav (never on landing) */}
      {!isLanding && (
        <AnimatePresence>
          {menuOpen && (
            <>
              <button type="button" aria-label="Close menu backdrop" onClick={() => setMenuOpen(false)} className="fixed inset-0 top-16 bg-[#02040a]/60 lg:hidden" />
              <motion.nav
                id="mobile-primary-nav"
                ref={menuRef}
                className="relative z-10 border-t border-white/[0.06] backdrop-blur-2xl bg-[#060b13]/90 lg:hidden"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-1 px-4 py-3 md:px-8">
                {NAV.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    onClick={() => setMenuOpen(false)}
                    className={`min-h-11 rounded-[4px] border px-3.5 py-2.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx/80 ${
                      location.pathname === n.to
                        ? "border-mint/30 bg-mint/[0.06] text-mint"
                        : "border-transparent text-mist hover:bg-white/[0.04]"
                    }`}
                  >
                    {t(n.key)}
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => { setAshaMode(!ashaMode); setMenuOpen(false); }}
                  className={`flex min-h-11 items-center gap-2 rounded-[4px] border px-3.5 py-2.5 text-left text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx/80 ${
                    ashaMode ? "border-cyanx/40 bg-cyanx/[0.07] text-cyanx" : "border-transparent text-mist"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${ashaMode ? "bg-cyanx" : "bg-mist/50"}`} />
                  {t(ashaMode ? "nav.mode.asha" : "nav.mode.citizen")}
                </button>
              </div>
              </motion.nav>
            </>
          )}
        </AnimatePresence>
      )}
    </header>
  );
}
