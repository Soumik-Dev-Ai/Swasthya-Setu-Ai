import React from "react";
import { Language } from "../types";
import { TRANSLATIONS } from "../utils/translations";
import { PhoneCall, AlertTriangle, HeartPulse, Brain, Zap, ShieldAlert, ChevronDown, ChevronUp, X } from "lucide-react";

interface EmergencyBannerProps {
  language: Language;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ language = "en" }) => {
  const [showFirstAid, setShowFirstAid] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  if (dismissed) {
    return (
      <div className="bg-red-500 text-white text-xs px-4 py-1 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="font-semibold">Emergency Helpline Hub</span>
        </div>
        <button 
          onClick={() => setDismissed(false)} 
          className="underline text-[11px] hover:text-red-100"
        >
          Expand Emergency Numbers & First Aid
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-700 text-white border-b-2 border-red-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2.5">
          {/* Left: Emergency Alert Notice */}
          <div className="flex items-center space-x-3 text-center md:text-left">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2 justify-center md:justify-start">
                <span className="text-xs font-bold uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">
                  CRITICAL CARE RED-FLAG PROTOCOL
                </span>
                <span className="text-[11px] text-red-100 hidden sm:inline">• Free 24/7 Government Services</span>
              </div>
              <p className="text-xs font-medium text-white/95 mt-0.5">
                {language === "hi" 
                  ? "सीने में तेज दर्द, सांस फूलना, बेहोशी या स्ट्रोक के लक्षण में तुरंत 108 डायल करें!" 
                  : language === "bn" 
                  ? "বুকে তীব্র চাপ, শ্বাসকষ্ট, অসাড়তা বা স্ট্রোকের লক্ষণ দেখা দিলে সাথে সাথে 108 কল করুন!" 
                  : "Suspected Heart Attack, Severe Breathlessness, Trauma, or Stroke? Immediate action saves lives."}
              </p>
            </div>
          </div>

          {/* Center & Right: Direct Helplines */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href="tel:108"
              className="flex items-center space-x-1.5 bg-white text-red-700 hover:bg-red-50 font-bold px-3 py-1 rounded-lg text-xs shadow-sm transition transform hover:scale-105"
            >
              <PhoneCall className="w-3.5 h-3.5 text-red-600" />
              <span>108 (Ambulance / ICU)</span>
            </a>

            <a
              href="tel:102"
              className="flex items-center space-x-1.5 bg-red-900/60 hover:bg-red-900 text-white font-semibold px-2.5 py-1 rounded-lg text-xs border border-white/30 transition"
            >
              <HeartPulse className="w-3.5 h-3.5 text-pink-300" />
              <span>102 (Janani Delivery)</span>
            </a>

            <a
              href="tel:112"
              className="flex items-center space-x-1.5 bg-red-900/60 hover:bg-red-900 text-white font-semibold px-2.5 py-1 rounded-lg text-xs border border-white/30 transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>112 (National Emergency)</span>
            </a>

            <button
              onClick={() => setShowFirstAid(!showFirstAid)}
              className="flex items-center space-x-1 bg-black/30 hover:bg-black/40 text-white font-medium px-2.5 py-1 rounded-lg text-xs transition"
            >
              <span>First Aid Guide</span>
              {showFirstAid ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="text-white/70 hover:text-white p-1"
              title="Minimize"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable First Aid Flashcards */}
        {showFirstAid && (
          <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-white/10 rounded-lg p-2.5 border border-white/15">
              <div className="flex items-center space-x-1.5 font-bold text-amber-200 mb-1">
                <HeartPulse className="w-4 h-4" />
                <span>Heart Attack First Aid</span>
              </div>
              <p className="text-white/90 text-[11px] leading-relaxed">
                Sit patient comfortably with back supported. Loosen tight clothes. If conscious & not allergic, 300mg Soluble Aspirin to chew. Call 108.
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-2.5 border border-white/15">
              <div className="flex items-center space-x-1.5 font-bold text-amber-200 mb-1">
                <Brain className="w-4 h-4" />
                <span>FAST Stroke Check</span>
              </div>
              <p className="text-white/90 text-[11px] leading-relaxed">
                <strong>F</strong>ace drooping? <strong>A</strong>rm weakness? <strong>S</strong>peech slurred? <strong>T</strong>ime to call 108! Note exact time symptoms began.
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-2.5 border border-white/15">
              <div className="flex items-center space-x-1.5 font-bold text-amber-200 mb-1">
                <Zap className="w-4 h-4" />
                <span>Severe Bleeding</span>
              </div>
              <p className="text-white/90 text-[11px] leading-relaxed">
                Apply direct continuous pressure with clean cloth. Elevate injured limb if no fracture. Do NOT apply tourniquet unless trained.
              </p>
            </div>

            <div className="bg-white/10 rounded-lg p-2.5 border border-white/15">
              <div className="flex items-center space-x-1.5 font-bold text-amber-200 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span>Unconsciousness / Fainting</span>
              </div>
              <p className="text-white/90 text-[11px] leading-relaxed">
                Lay flat, elevate legs 12 inches. Check breathing. If breathing normally, turn to recovery side. Never pour water into mouth.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
