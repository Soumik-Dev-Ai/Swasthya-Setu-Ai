import React, { useState } from "react";
import { Language, GovernmentScheme } from "../types";
import { TRANSLATIONS } from "../utils/translations";
import { GOVERNMENT_SCHEMES } from "../data/mockData";
import { 
  Building2, 
  Search, 
  CheckCircle, 
  ExternalLink, 
  FileCheck, 
  Sparkles, 
  Users, 
  HeartHandshake, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface SchemeDiscoveryProps {
  language: Language;
  onNavigateToFacilities: () => void;
}

export const SchemeDiscovery: React.FC<SchemeDiscoveryProps> = ({
  language = "en",
  onNavigateToFacilities,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // State
  const [selectedState, setSelectedState] = useState<string>("All");
  const [userAge, setUserAge] = useState<number>(38);
  const [hasRationCard, setHasRationCard] = useState<boolean>(true);
  const [isPregnant, setIsPregnant] = useState<boolean>(false);
  const [isSeniorCitizen, setIsSeniorCitizen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [abhaGenerated, setAbhaGenerated] = useState<boolean>(false);
  const [abhaNumber, setAbhaNumber] = useState<string>("91-4829-1029-4821");

  // Sync senior status
  React.useEffect(() => {
    if (userAge >= 70) {
      setIsSeniorCitizen(true);
    }
  }, [userAge]);

  // Filter schemes
  const filteredSchemes = GOVERNMENT_SCHEMES.filter((s) => {
    const matchesState = selectedState === "All" || s.state.includes(selectedState) || s.state.includes("National");
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          s.beneficiaryTarget.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesState && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Building2 className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {t.navSchemes}
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Find and verify eligibility for Ayushman Bharat (PM-JAY), State Universal Health Schemes (Swasthya Sathi, Aarogyasri, MJPJAY), Maternal JSSK, and generate your digital ABHA health record.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              ABHA / ABDM Ready
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Eligibility Wizard & ABHA Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Eligibility Criteria Check (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Eligibility Screener</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Domicile State</label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="All">All India (National + All States)</option>
                  <option value="West Bengal">West Bengal (পশ্চিমবঙ্গ)</option>
                  <option value="Andhra Pradesh">Andhra Pradesh / Telangana</option>
                  <option value="Maharashtra">Maharashtra (महाराष्ट्र)</option>
                  <option value="National">National Central Schemes</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Citizen Age: {userAge} Years</label>
                <input
                  type="range"
                  min={1}
                  max={95}
                  value={userAge}
                  onChange={(e) => setUserAge(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                {userAge >= 70 && (
                  <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-bold text-[11px] flex items-center space-x-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Eligible for Universal ₹5L AB PM-JAY Senior Citizen Scheme!</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasRationCard}
                    onChange={(e) => setHasRationCard(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Has Ration Card (NFSA / BPL / Antyodaya)</span>
                </label>

                <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPregnant}
                    onChange={(e) => setIsPregnant(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Pregnant Woman / Infant (&lt;1 year)</span>
                </label>
              </div>
            </div>
          </div>

          {/* ABHA Card Integration Box */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                AYUSHMAN BHARAT DIGITAL MISSION (ABDM)
              </span>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                Official Standard
              </span>
            </div>

            <h3 className="text-sm font-bold">ABHA Health Account ID</h3>
            <p className="text-xs text-indigo-100/80 leading-relaxed">
              ABHA is your 14-digit digital health identification to link hospital records, lab reports, and scheme entitlements nationwide.
            </p>

            {abhaGenerated ? (
              <div className="bg-white/10 p-3 rounded-xl border border-white/20 space-y-1">
                <span className="text-[10px] text-indigo-200 uppercase font-semibold">Your Verified ABHA ID:</span>
                <div className="font-mono text-sm font-bold text-emerald-300 tracking-wider">{abhaNumber}</div>
                <div className="text-[10px] text-emerald-200">✓ Linked with Aadhaar & CoWIN/PM-JAY Gateway</div>
              </div>
            ) : (
              <button
                onClick={() => setAbhaGenerated(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition shadow-sm"
              >
                Simulate ABHA ID Linkage (14-Digit)
              </button>
            )}
          </div>
        </div>

        {/* Right: Schemes Listing (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center space-x-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
            <Search className="w-4 h-4 text-slate-400 ml-1" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scheme name, maternity, senior citizen, state, or surgery..."
              className="w-full text-xs text-slate-900 bg-transparent focus:outline-none"
            />
          </div>

          <div className="space-y-4">
            {filteredSchemes.map((scheme) => (
              <div
                key={scheme.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 hover:shadow-md transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-bold text-slate-900">{scheme.name}</h3>
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      📍 {scheme.state} • Coverage: <span className="font-bold text-emerald-700">{scheme.coverageAmount}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {scheme.tags.map((tag, i) => (
                      <span key={i} className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block mb-1">Target Beneficiaries & Eligibility:</span>
                    <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {scheme.beneficiaryTarget}
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-slate-800 block mb-1">Mandatory Documents Required:</span>
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                      {scheme.documentsRequired.map((doc, idx) => (
                        <li key={idx} className="font-medium">{doc}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="text-slate-600">
                    <strong>Hospital Network:</strong> {scheme.cashlessNetwork}
                  </div>

                  <div className="flex space-x-2 shrink-0">
                    <button
                      onClick={onNavigateToFacilities}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition text-xs"
                    >
                      Find Empaneled Hospitals
                    </button>
                    <a
                      href={scheme.officialPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3 py-1.5 rounded-xl transition flex items-center space-x-1"
                    >
                      <span>Official Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
