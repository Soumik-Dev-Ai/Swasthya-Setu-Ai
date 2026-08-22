import { motion } from "framer-motion";
import { Activity, ArrowUpRight, Calculator, ChevronDown, ClipboardList, Languages, MapPin, ShieldCheck, Users, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Language } from "../types";

interface HomeDashboardProps {
  language: Language;
  setLanguage: (language: Language) => void;
}

const features = [
  { title: "AI symptom detector", subtitle: "Voice-enabled offline triage.", action: "Check symptoms now", path: "/triage", icon: Activity, tone: "emerald", className: "md:col-span-7 md:row-span-2" },
  { title: "Treatment cost analyzer", subtitle: "Calculate out-of-pocket expenses.", action: "Estimate cost", path: "/cost", icon: Calculator, tone: "cyan", className: "md:col-span-5" },
  { title: "Insurance & schemes", subtitle: "PM-JAY and policy checker.", action: "Check eligibility", path: "/insurance", icon: ShieldCheck, tone: "violet", className: "md:col-span-5" },
  { title: "Facility navigator", subtitle: "Find 24/7 PM-JAY hospitals.", action: "Find care", path: "/facilities", icon: MapPin, tone: "blue", className: "md:col-span-4" },
  { title: "ASHA worker portal", subtitle: "Community health digitization.", action: "Login to portal", path: "/asha", icon: Users, tone: "amber", className: "md:col-span-4" },
];

const toneMap: Record<string, string> = {
  emerald: "from-emerald-300/20 via-emerald-300/5 to-transparent text-emerald-200 border-emerald-300/20",
  cyan: "from-cyan-300/20 via-cyan-300/5 to-transparent text-cyan-200 border-cyan-300/20",
  violet: "from-violet-300/20 via-violet-300/5 to-transparent text-violet-200 border-violet-300/20",
  blue: "from-blue-300/20 via-blue-300/5 to-transparent text-blue-200 border-blue-300/20",
  amber: "from-amber-300/20 via-amber-300/5 to-transparent text-amber-200 border-amber-300/20",
};

export function HomeDashboard({ language, setLanguage }: HomeDashboardProps) {
  const navigate = useNavigate();
  return (
    <div className="dashboard-shell min-h-screen bg-[#07111f] text-white">
      <div className="dashboard-gridline" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-[1380px] px-5 pb-12 pt-5 sm:px-8 lg:px-12">
        <header className="glass-nav flex items-center justify-between rounded-2xl px-4 py-3 sm:px-5">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3 text-left" aria-label="Return to SwasthyaSetu AI landing page">
            <span className="brand-mark grid h-10 w-10 place-items-center rounded-xl"><Activity className="h-5 w-5" /></span>
            <span><span className="block text-sm font-semibold tracking-tight sm:text-base">SwasthyaSetu <span className="text-cyan-200">AI</span></span><span className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:block">Care navigation hub</span></span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 text-xs text-emerald-200/80 md:flex"><Wifi className="h-3.5 w-3.5" /> Offline ready</span>
            <label className="language-control flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-xs font-medium text-slate-200" aria-label="Language">
              <Languages className="h-3.5 w-3.5 text-cyan-200" />
              <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="bg-transparent outline-none" aria-label="Choose language">
                <option value="en" className="bg-slate-900">EN</option><option value="hi" className="bg-slate-900">HI</option><option value="bn" className="bg-slate-900">BN</option>
              </select><ChevronDown className="h-3 w-3 text-slate-500" />
            </label>
            <button type="button" onClick={() => navigate("/asha")} className="outline-button hidden sm:flex">ASHA portal <ArrowUpRight className="h-3.5 w-3.5" /></button>
          </div>
        </header>

        <main className="pt-14 sm:pt-16">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }} className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Your care navigation hub</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">Start with the question you have.</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">Move from symptoms to support with an offline-first set of tools for triage, costs, coverage, and nearby care.</p>
            </div>
            <div className="dashboard-status"><span className="status-dot" /> Local session active <span className="text-slate-600">·</span> Mock data</div>
          </motion.div>

          <div className="grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-12">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.button type="button" key={feature.path} onClick={() => navigate(feature.path)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: index * 0.08 }} whileHover={{ y: -4, scale: 1.008 }} whileTap={{ scale: 0.99 }} className={`feature-card group ${feature.className} ${toneMap[feature.tone]}`}>
                  <span className="feature-card__wash" aria-hidden="true" />
                  <span className="relative z-10 flex h-full flex-col items-start justify-between gap-8 text-left">
                    <span className="flex w-full items-start justify-between"><span className="icon-tile"><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" /></span>
                    <span><span className="mb-2 block max-w-md text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">{feature.title}</span><span className="block text-sm leading-6 text-slate-400">{feature.subtitle}</span><span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-200 transition group-hover:text-white">{feature.action} <span className="text-cyan-200">→</span></span></span>
                  </span>
                </motion.button>
              );
            })}
          </div>

          <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <motion.button type="button" onClick={() => navigate("/schemes")} whileHover={{ y: -3 }} className="support-strip group flex items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-left"><span className="flex items-center gap-4"><span className="icon-tile icon-tile--small text-cyan-200"><ClipboardList className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-white">Discover government support</span><span className="mt-1 block text-xs text-slate-500">Compare active schemes before you plan a visit.</span></span></span><ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:text-white" /></motion.button>
            <div className="support-strip flex items-center justify-between gap-5 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.035] p-5"><span className="flex items-center gap-4"><span className="icon-tile icon-tile--small text-emerald-200"><ShieldCheck className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-white">A clearer next step, not a diagnosis</span><span className="mt-1 block text-xs text-slate-500">Use the tools as a guide and contact a clinician when needed.</span></span></span><span className="hidden text-[10px] uppercase tracking-[0.18em] text-emerald-200/60 sm:block">Care, connected</span></div>
          </section>
        </main>
      </div>
    </div>
  );
}
