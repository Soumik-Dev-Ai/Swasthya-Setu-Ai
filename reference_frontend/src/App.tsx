import { useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ExternalLink, HeartHandshake } from "lucide-react";
import { Language, UserRole } from "./types";
import { TRANSLATIONS } from "./utils/translations";
import { Navbar } from "./components/Navbar";
import { EmergencyBanner } from "./components/EmergencyBanner";
import { FinancialPlanner } from "./components/FinancialPlanner";
import { InsuranceExperience } from "./components/InsuranceExperience";
import { TriageExperience } from "./components/TriageExperience";
import { CostExperience } from "./components/CostExperience";
import { FinancialProvider } from "./context/FinancialContext";
import { PolicyProvider } from "./context/PolicyContext";
import { EmergencySyncProvider } from "./context/EmergencySyncContext";
import { FacilitiesExperience } from "./components/FacilitiesExperience";
import { SchemeDiscovery } from "./components/SchemeDiscovery";
import { AshaExperience } from "./components/AshaExperience";
import { SihEvaluationHub } from "./components/SihEvaluationHub";
import { LandingPage } from "./components/LandingPage";
import { HomeDashboard } from "./components/HomeDashboard";

const tabPaths: Record<string, string> = {
  triage: "/triage",
  financial: "/financial",
  insurance: "/insurance",
  schemes: "/schemes",
  cost: "/cost",
  facilities: "/facilities",
  asha: "/asha",
  sih: "/sih",
};

interface FeatureRouteProps {
  activeTab: string;
  language: Language;
  setLanguage: (language: Language) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  isOffline: boolean;
  setIsOffline: React.Dispatch<React.SetStateAction<boolean>>;
}

function FeatureFooter({ language }: { language: Language }) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  return (
    <footer className="bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <span className="p-1.5 bg-emerald-600 rounded-lg text-white"><HeartHandshake className="w-4 h-4" /></span>
              <span>SwasthyaSetu AI</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">Offline-first clinical triage, facility navigation, and affordability planning for India.</p>
            <div className="text-[10px] text-emerald-400 font-semibold pt-1">Built for accessible care navigation</div>
          </div>
          <div>
            <h4 className="text-white font-bold mb-2">Emergency Numbers (24/7)</h4>
            <ul className="space-y-1 text-[11px]">
              <li><a href="tel:108" className="hover:text-emerald-400">108 — National Ambulance</a></li>
              <li><a href="tel:112" className="hover:text-emerald-400">112 — Unified Emergency</a></li>
              <li><a href="tel:14555" className="hover:text-emerald-400">14555 — PM-JAY Call Centre</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-2">Trusted Portals</h4>
            <ul className="space-y-1 text-[11px]">
              <li><a href="https://pmjay.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 flex items-center gap-1"><span>Ayushman Bharat PM-JAY</span><ExternalLink className="w-3 h-3" /></a></li>
              <li><a href="https://esanjeevani.mohfw.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 flex items-center gap-1"><span>eSanjeevani Teleconsultation</span><ExternalLink className="w-3 h-3" /></a></li>
              <li><a href="https://abdm.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 flex items-center gap-1"><span>ABDM Digital Mission</span><ExternalLink className="w-3 h-3" /></a></li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-white font-bold">Clinical Safety Notice</h4>
            <p className="text-[11px] leading-relaxed text-slate-400">{t.disclaimerText}</p>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500">
          <span>© 2026 SwasthyaSetu AI • Mock data for demonstration</span>
          <span>Offline local storage • WCAG-minded interface</span>
        </div>
      </div>
    </footer>
  );
}

function FeatureRoute({ activeTab, language, setLanguage, userRole, setUserRole, isOffline, setIsOffline }: FeatureRouteProps) {
  const navigate = useNavigate();
  const [facilityFilter, setFacilityFilter] = useState("All");
  const [initialSymptoms, setInitialSymptoms] = useState("");
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  const goToTab = (tab: string) => {
    navigate(tabPaths[tab] || "/home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavigateToFacility = (careLevel?: string) => {
    if (careLevel?.includes("PHC")) setFacilityFilter("PHC");
    else if (careLevel?.includes("Hospital") || careLevel?.includes("Emergency")) setFacilityFilter("District");
    else setFacilityFilter("All");
    goToTab("facilities");
  };

  let content: ReactNode = null;
  if (activeTab === "triage") {
    content = <TriageExperience language={language} isOffline={isOffline} initialSymptoms={initialSymptoms} onNavigateToFacility={handleNavigateToFacility} onNavigateToInsurance={() => goToTab("insurance")} onNavigateToCost={() => goToTab("cost")} />;
  } else if (activeTab === "financial") {
    content = <FinancialPlanner language={language} onNavigateToSchemes={() => goToTab("schemes")} onNavigateToInsurance={() => goToTab("insurance")} onNavigateToCost={() => goToTab("cost")} />;
  } else if (activeTab === "insurance") {
    content = <InsuranceExperience language={language} onNavigateToCost={() => goToTab("cost")} />;
  } else if (activeTab === "cost") {
    content = <CostExperience language={language} onNavigateToFacilities={() => goToTab("facilities")} />;
  } else if (activeTab === "facilities") {
    content = <FacilitiesExperience language={language} initialFilter={facilityFilter} />;
  } else if (activeTab === "schemes") {
    content = <SchemeDiscovery language={language} onNavigateToFacilities={() => goToTab("facilities")} />;
  } else if (activeTab === "asha") {
    content = <AshaExperience language={language} isOffline={isOffline} />;
  } else if (activeTab === "sih") {
    content = <SihEvaluationHub language={language} onNavigateToTriageWithSymptoms={(symptoms) => { setInitialSymptoms(symptoms); goToTab("triage"); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-emerald-200 selection:text-emerald-950">
      <EmergencyBanner language={language} />
      <Navbar activeTab={activeTab} setActiveTab={goToTab} language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={(role) => { setUserRole(role); if (role === "asha_worker") goToTab("asha"); if (role === "sih_presentation") goToTab("sih"); }} isOffline={isOffline} setIsOffline={setIsOffline} />
      <main className="flex-1 pb-16">{content}</main>
      <FeatureFooter language={language} />
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [userRole, setUserRole] = useState<UserRole>("citizen");
  const [isOffline, setIsOffline] = useState(false);

  return (
    <FinancialProvider>
      <PolicyProvider>
      <EmergencySyncProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<LandingPage language={language} setLanguage={setLanguage} />} />
        <Route path="/home" element={<HomeDashboard language={language} setLanguage={setLanguage} />} />
        <Route path="/triage" element={<FeatureRoute activeTab="triage" language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={setUserRole} isOffline={isOffline} setIsOffline={setIsOffline} />} />
        <Route path="/financial" element={<FeatureRoute activeTab="financial" language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={setUserRole} isOffline={isOffline} setIsOffline={setIsOffline} />} />
        <Route path="/insurance" element={<FeatureRoute activeTab="insurance" language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={setUserRole} isOffline={isOffline} setIsOffline={setIsOffline} />} />
        <Route path="/schemes" element={<FeatureRoute activeTab="schemes" language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={setUserRole} isOffline={isOffline} setIsOffline={setIsOffline} />} />
        <Route path="/cost" element={<FeatureRoute activeTab="cost" language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={setUserRole} isOffline={isOffline} setIsOffline={setIsOffline} />} />
        <Route path="/facilities" element={<FeatureRoute activeTab="facilities" language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={setUserRole} isOffline={isOffline} setIsOffline={setIsOffline} />} />
        <Route path="/asha" element={<FeatureRoute activeTab="asha" language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={setUserRole} isOffline={isOffline} setIsOffline={setIsOffline} />} />
        <Route path="/sih" element={<FeatureRoute activeTab="sih" language={language} setLanguage={setLanguage} userRole={userRole} setUserRole={setUserRole} isOffline={isOffline} setIsOffline={setIsOffline} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </EmergencySyncProvider>
      </PolicyProvider>
    </FinancialProvider>
  );
}
