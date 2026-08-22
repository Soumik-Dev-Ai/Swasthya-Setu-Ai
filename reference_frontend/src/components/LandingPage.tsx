import { motion } from "framer-motion";
import { Activity, ArrowRight, ChevronDown, Languages, Mic, ShieldCheck, Sparkles, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Language } from "../types";
import { InteractiveScene } from "./InteractiveScene";

interface LandingPageProps {
  language: Language;
  setLanguage: (language: Language) => void;
}

export function LandingPage({ language, setLanguage }: LandingPageProps) {
  const navigate = useNavigate();
  return (
    <div className="landing-shell min-h-screen overflow-hidden bg-[#07111f] text-white">
      <InteractiveScene />
      <div className="landing-noise" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 pb-6 pt-5 sm:px-8 lg:px-12">
        <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="glass-nav flex items-center justify-between rounded-2xl px-4 py-3 sm:px-5">
          <button type="button" onClick={() => navigate("/")} className="brand-lockup group flex items-center gap-3 text-left" aria-label="SwasthyaSetu AI home">
            <span className="brand-mark grid h-10 w-10 place-items-center rounded-xl"><Activity className="h-5 w-5" /></span>
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold tracking-tight sm:text-base">SwasthyaSetu <span className="text-cyan-200">AI</span><span className="status-dot" aria-hidden="true" /></span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:block">System active · offline ready</span>
            </span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="language-control hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs font-medium text-slate-200 sm:flex" aria-label="Language">
              <Languages className="h-3.5 w-3.5 text-cyan-200" />
              <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="bg-transparent outline-none" aria-label="Choose language">
                <option value="en" className="bg-slate-900">EN</option>
                <option value="hi" className="bg-slate-900">HI</option>
                <option value="bn" className="bg-slate-900">BN</option>
              </select>
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </label>
            <button type="button" onClick={() => navigate("/asha")} className="outline-button hidden sm:flex">ASHA Worker Portal <ArrowRight className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => navigate("/home")} className="mobile-enter rounded-lg border border-cyan-300/25 px-3 py-2 text-xs font-semibold text-cyan-100 sm:hidden">Enter</button>
          </div>
        </motion.header>

        <main className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[minmax(0,0.98fr)_minmax(420px,0.9fr)] lg:gap-5 lg:py-10">
          <motion.section initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.15 }} className="max-w-2xl">
            <div className="eyebrow-pill mb-7 inline-flex items-center gap-2"><span className="eyebrow-icon"><Wifi className="h-3.5 w-3.5" /></span> Offline-first Edge AI <span className="text-cyan-300/60">/</span> Care navigation</div>
            <h1 className="max-w-3xl text-[clamp(3.1rem,7vw,6.85rem)] font-semibold leading-[0.94] tracking-[-0.075em] text-white">From symptoms to <span className="headline-gradient">affordable</span> care.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">India&apos;s intelligent healthcare navigator. Assess symptoms offline, discover PM-JAY support, and understand true out-of-pocket costs before you travel.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" onClick={() => navigate("/home")} className="primary-cta group"><span className="cta-icon"><Mic className="h-4 w-4" /></span>Start symptom triage<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></button>
              <button type="button" onClick={() => navigate("/cost")} className="secondary-cta">Treatment cost analyzer <span className="text-cyan-200">↗</span></button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-slate-400">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> No diagnosis. Better next steps.</span>
              <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-cyan-200" /> Mock data, transparent decisions.</span>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.28 }} className="relative hidden min-h-[480px] lg:block" aria-label="Interactive medical shield visualization">
            <div className="hero-orbit-label hero-orbit-label--top"><span className="mini-pulse" /> Offline signal mesh</div>
            <div className="hero-orbit-label hero-orbit-label--bottom"><span className="text-emerald-200">₹</span> Affordability-aware</div>
            <div className="hero-center-glow" />
          </motion.section>
        </main>

        <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.7 }} className="flex flex-col gap-3 border-t border-white/10 pt-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Built for the moments before care becomes urgent.</span>
          <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> System status: ready <span className="text-slate-700">|</span> Last sync: local cache</span>
        </motion.footer>
      </div>
    </div>
  );
}
