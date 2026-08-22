import React from "react";
import { Language, UserRole } from "../types";
import { TRANSLATIONS } from "../utils/translations";
import { 
  Activity, 
  ShieldCheck, 
  Wallet, 
  Building2, 
  Calculator, 
  Users, 
  Stethoscope, 
  Award, 
  Wifi, 
  WifiOff, 
  PhoneCall, 
  Languages, 
  Menu,
  X
} from "lucide-react";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  isOffline: boolean;
  setIsOffline: React.Dispatch<React.SetStateAction<boolean>>;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  language = "en",
  setLanguage,
  userRole = "citizen",
  setUserRole,
  isOffline = false,
  setIsOffline,
}) => {
  const safeLang = language && TRANSLATIONS[language] ? language : "en";
  const t = TRANSLATIONS[safeLang] || TRANSLATIONS.en;
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { id: "triage", label: t.navTriage, icon: Activity },
    { id: "financial", label: t.navFinancial, icon: Wallet },
    { id: "insurance", label: t.navInsurance, icon: ShieldCheck },
    { id: "schemes", label: t.navSchemes, icon: Building2 },
    { id: "cost", label: t.navCostCalc, icon: Calculator },
    { id: "facilities", label: t.navFacilities, icon: Building2 },
    { id: "asha", label: t.navAshaPortal, icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-md border-b border-slate-800">
      {/* Top Utility Bar: Emergency Alert & Online/Offline Mode */}
      <div className="bg-emerald-900/90 text-emerald-100 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between border-b border-emerald-800/60">
        <div className="flex items-center space-x-2 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{t.tagline}</span>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            type="button"
            onClick={() => setIsOffline(!isOffline)}
            className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition ${
              isOffline ? "bg-amber-500 text-slate-950 shadow-sm" : "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
            }`}
            title="Toggle offline/online mode"
          >
            {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isOffline ? t.offlineMode : t.onlineMode}</span>
          </button>
          
          <a
            href="tel:108"
            className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-0.5 rounded-lg text-xs shadow-sm transition"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{t.call108}</span>
          </a>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div 
            onClick={() => setActiveTab("triage")} 
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-900/40 group-hover:scale-105 transition">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">{t.appName}</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  SIH 2025
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Symptom → Urgency → Coverage → Care</p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden 2xl:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-sm font-semibold"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Side: Role Selector, Language Switcher, SIH Pitch */}
          <div className="hidden sm:flex items-center space-x-2.5">
            {/* Language Selector */}
            <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700 text-xs">
              <Languages className="w-3.5 h-3.5 text-slate-400 ml-1 mr-1" />
              {(["en", "hi", "bn"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 rounded-lg text-xs transition font-semibold ${
                    language === lang
                      ? "bg-emerald-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {lang === "en" ? "EN" : lang === "hi" ? "हिन्दी" : "বাংলা"}
                </button>
              ))}
            </div>

            {/* Portal Switcher */}
            <div className="relative">
              <select
                value={userRole}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setUserRole(newRole);
                  if (newRole === "asha_worker") {
                    setActiveTab("asha");
                  } else if (newRole === "sih_presentation") {
                    setActiveTab("sih");
                  } else if (newRole === "citizen") {
                    setActiveTab("triage");
                  }
                }}
                className="bg-slate-800 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
              >
                <option value="citizen">👤 Citizen / Patient</option>
                <option value="asha_worker">🩺 ASHA / ANM Portal</option>
                <option value="doctor">👨‍⚕️ Medical Officer</option>
                <option value="sih_presentation">🏆 SIH Evaluation Deck</option>
              </select>
            </div>

            {/* SIH Deck Quick Button */}
            <button
              type="button"
              onClick={() => setActiveTab("sih")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                activeTab === "sih"
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-900/30 font-bold"
                  : "bg-slate-800 text-amber-300 border-amber-500/40 hover:bg-slate-750"
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>SIH 2025 Hub</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="2xl:hidden flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="2xl:hidden bg-slate-900 border-t border-slate-800 px-4 pt-3 pb-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2 p-2.5 rounded-xl text-xs font-medium text-left ${
                    isActive ? "bg-emerald-600 text-white font-semibold" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setActiveTab("sih");
                setMobileMenuOpen(false);
              }}
              className={`flex items-center space-x-2 p-2.5 rounded-xl text-xs font-medium text-left col-span-2 ${
                activeTab === "sih" ? "bg-amber-500 text-slate-950 font-bold" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>SIH 2025 Evaluation Hub & Pitch Deck</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex space-x-1">
              {(["en", "hi", "bn"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    language === lang ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {lang === "en" ? "English" : lang === "hi" ? "हिन्दी" : "বাংলা"}
                </button>
              ))}
            </div>

            <select
              value={userRole}
              onChange={(e) => {
                const newRole = e.target.value as UserRole;
                setUserRole(newRole);
                if (newRole === "asha_worker") {
                  setActiveTab("asha");
                } else if (newRole === "sih_presentation") {
                  setActiveTab("sih");
                }
                setMobileMenuOpen(false);
              }}
              className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1 border border-slate-700"
            >
              <option value="citizen">👤 Citizen</option>
              <option value="asha_worker">🩺 ASHA Worker</option>
              <option value="sih_presentation">🏆 SIH Deck</option>
            </select>
          </div>
        </div>
      )}
    </header>
  );
};
