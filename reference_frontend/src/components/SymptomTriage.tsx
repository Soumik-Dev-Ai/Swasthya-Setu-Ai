import React, { useState } from "react";
import { Language, TriageResult, FinancialProfile } from "../types";
import { TRANSLATIONS } from "../utils/translations";
import { RED_FLAG_CHECKLIST, evaluateClinicalRuleEngine } from "../utils/clinicalRules";
import { 
  Activity, 
  Mic, 
  MicOff, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  Copy, 
  Printer, 
  FileText, 
  Building2, 
  Sparkles, 
  ShieldAlert, 
  Stethoscope,
  Info
} from "lucide-react";

interface SymptomTriageProps {
  language: Language;
  isOffline: boolean;
  onNavigateToFacility: (careLevel?: string) => void;
  onNavigateToInsurance: () => void;
  onNavigateToCost: () => void;
  financialProfile?: FinancialProfile;
  initialSymptoms?: string;
}

export const SymptomTriage: React.FC<SymptomTriageProps> = ({
  language = "en",
  isOffline = false,
  onNavigateToFacility,
  onNavigateToInsurance,
  onNavigateToCost,
  financialProfile,
  initialSymptoms = "",
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // State
  const [symptoms, setSymptoms] = useState(initialSymptoms);
  const [duration, setDuration] = useState("1-2 days");
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe">("moderate");
  const [age, setAge] = useState<number>(38);
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [pregnancy, setPregnancy] = useState<boolean>(false);
  const [comorbidities, setComorbidities] = useState<string[]>([]);
  const [redFlagAnswers, setRedFlagAnswers] = useState<Record<string, boolean>>({});
  const [isListening, setIsListening] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Common Comorbidity tags
  const COMORBIDITY_OPTIONS = [
    { id: "Diabetes", labelEn: "Type 2 Diabetes", labelHi: "मधुमेह (शुगर)", labelBn: "ডায়াবেটিস" },
    { id: "Hypertension", labelEn: "High Blood Pressure", labelHi: "उच्च रक्तचाप (बीपी)", labelBn: "উচ্চ রক্তচাপ (BP)" },
    { id: "Asthma_COPD", labelEn: "Asthma / Breathing Issue", labelHi: "दमा / सांस की बीमारी", labelBn: "হাঁপানি / শ্বাসকষ্ট" },
    { id: "Heart_Disease", labelEn: "Heart Condition / Prior MI", labelHi: "हृदय रोग", labelBn: "হৃদরোগ" },
    { id: "Kidney_Disease", labelEn: "Kidney Disease / Dialysis", labelHi: "गुर्दे की बीमारी", labelBn: "কিডনির সমস্যা" },
  ];

  // Quick Preset Scenarios for demonstration & clinical testing
  const QUICK_PRESETS = [
    {
      id: "cardiac",
      title: "🚨 Chest Pain & Sweating (Emergency)",
      symptomsEn: "Crushing chest tightness radiating to left shoulder with heavy cold sweating and breathlessness for 45 minutes",
      symptomsHi: "45 मिनट से सीने में तेज दबाव जो बाएं कंधे तक जा रहा है, अत्यधिक ठंडा पसीना और सांस फूल रही है",
      symptomsBn: "৪৫ মিনিট ধরে বুকে তীব্র চাপ যা বাঁ কাঁধের দিকে যাচ্ছে, প্রচুর ঘাম ও শ্বাসকষ্ট হচ্ছে",
      age: 62,
      gender: "Male" as const,
      severity: "severe" as const,
      duration: "45 minutes",
      comorbidities: ["Hypertension", "Diabetes"],
      redFlags: { chestPain: true, severeBreathlessness: true }
    },
    {
      id: "fever_malaria",
      title: "🌡️ High Fever & Shivering (Urgent PHC)",
      symptomsEn: "High grade fever with severe chills and shivering for 3 days, body aches, loss of appetite, vomiting twice",
      symptomsHi: "3 दिन से तेज बुखार, तेज कंपकंपी, पूरे शरीर में दर्द, भूख न लगना और 2 बार उल्टी",
      symptomsBn: "৩ দিন ধরে কাঁপুনি দিয়ে তীব্র জ্বর, শরীরে প্রচণ্ড ব্যথা ও ২ বার বমি",
      age: 28,
      gender: "Female" as const,
      severity: "moderate" as const,
      duration: "3 days",
      comorbidities: [],
      redFlags: {}
    },
    {
      id: "acute_abdomen",
      title: "🩹 Right Lower Abdominal Pain",
      symptomsEn: "Severe sharp pain in right lower stomach for 18 hours, nauseous, low fever, pain worsening when walking",
      symptomsHi: "18 घंटे से पेट के निचले दाहिने हिस्से में तेज चुभन वाला दर्द, जी मिचलाना और हल्का बुखार",
      symptomsBn: "১৮ ঘণ্টা ধরে তলপেটের ডানদিকে তীব্র ধারালো ব্যথা, বমি বমি ভাব ও সামান্য জ্বর",
      age: 24,
      gender: "Male" as const,
      severity: "severe" as const,
      duration: "18 hours",
      comorbidities: [],
      redFlags: {}
    },
    {
      id: "pediatric",
      title: "👶 Pediatric Diarrhea & Lethargy",
      symptomsEn: "18 month old child having frequent watery loose stools 6 times, sunken eyes, dry tongue and crying with few tears",
      symptomsHi: "18 महीने का बच्चा, 6 बार पतले दस्त, धंसी हुई आंखें, सूखा मुंह और रोते समय कम आंसू",
      symptomsBn: "১৮ মাসের শিশু, ঘন ঘন পাতলা পায়খানা, চোখ বসে যাওয়া ও কান্নার সময় কম জল আসা",
      age: 1.5,
      gender: "Female" as const,
      severity: "severe" as const,
      duration: "1 day",
      comorbidities: [],
      redFlags: {}
    }
  ];

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setActivePreset(preset.id);
    const text = language === "hi" ? preset.symptomsHi : language === "bn" ? preset.symptomsBn : preset.symptomsEn;
    setSymptoms(text);
    setAge(preset.age);
    setGender(preset.gender);
    setSeverity(preset.severity);
    setDuration(preset.duration);
    setComorbidities(preset.comorbidities);
    setRedFlagAnswers(preset.redFlags);
  };

  // Voice speech-to-text handler
  const handleVoiceToggle = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not natively supported in this browser. You can type or click the quick clinical presets below.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === "hi" ? "hi-IN" : language === "bn" ? "bn-IN" : "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSymptoms((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Speech recognition error:", err);
      setIsListening(false);
    }
  };

  // Execute Triage Analysis
  const handleRunTriage = async () => {
    if (!symptoms.trim()) {
      alert("Please describe your symptoms or select a test scenario.");
      return;
    }

    setLoading(true);

    // 1. Run local deterministic safety check
    const localClinical = evaluateClinicalRuleEngine(symptoms, redFlagAnswers, age, severity);

    if (isOffline) {
      // Immediate local clinical protocol
      setTimeout(() => {
        const offlineResult: TriageResult = {
          urgency: localClinical.isEmergency ? "EMERGENCY" : severity === "severe" ? "URGENT" : "SOON",
          urgencyDescription: localClinical.isEmergency
            ? (language === "hi" ? "तत्काल आपातकालीन खतरे के संकेत मिले हैं! बिना देरी के अस्पताल जाएं।" : language === "bn" ? "জরুরি বিপদের লক্ষণ পাওয়া গেছে! অবিলম্বে নিকটস্থ হাসপাতালে যান।" : "Critical red flags detected by on-device safety engine. Immediate medical evaluation needed.")
            : (language === "hi" ? "निकटतम प्राथमिक स्वास्थ्य केंद्र (PHC) में डॉक्टर से परामर्श लें।" : language === "bn" ? "নিকটবর্তী স্বাস্থ্যকেন্দ্রে (PHC) চিকিৎসকের পরামর্শ নিন।" : "Consult a qualified medical officer at your nearest Primary Health Centre."),
          redFlagsDetected: localClinical.flagsFound,
          isEmergency: localClinical.isEmergency,
          possibleCategories: [
            {
              name: localClinical.isEmergency ? "Acute Cardiorespiratory / Trauma Emergency" : "Acute Medical Symptom Presentation",
              likelihood: "High",
              description: "Requires in-person physical assessment, blood pressure, and pulse oximetry."
            }
          ],
          recommendedCareLevel: localClinical.isEmergency ? "District Hospital Emergency / 108 Ambulance" : "Primary Health Centre (PHC) / CHC",
          teleconsultationFeasible: !localClinical.isEmergency,
          clinicalQuestionsToAsk: [
            "How long has the main discomfort been present?",
            "Any difficulty swallowing liquids or breathing?",
            "Any prior history of high blood pressure or heart problems?"
          ],
          homeCareGuidance: localClinical.isEmergency 
            ? "Keep the patient seated with open airway. Call 108. Do NOT administer unprescribed solid foods."
            : "Stay well hydrated with ORS or boiled water. Rest in a well-ventilated room and monitor temperature.",
          warningSignsToWatch: [
            "Sudden loss of consciousness or speech difficulty",
            "Bluish discoloration of lips or fingers",
            "Oxygen saturation falling below 94%"
          ],
          doctorBrief: `[OFFLINE TRIAGE] Age: ${age}y ${gender}, Symptoms: "${symptoms}", Duration: ${duration}, Severity: ${severity}, Red Flags: ${localClinical.flagsFound.join("; ") || "None"}.`,
          disclaimer: t.disclaimerText
        };
        setResult(offlineResult);
        setLoading(false);
      }, 350);
      return;
    }

    // 2. Call server-side API backed by Gemini 3.7 Flash
    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms,
          duration,
          severity,
          age,
          gender,
          pregnancy,
          comorbidities,
          language,
          redFlagAnswers,
        }),
      });

      if (!response.ok) {
        throw new Error("Server triage response failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.warn("Falling back to local clinical rules engine:", err);
      // Seamless fallback
      const fallback: TriageResult = {
        urgency: localClinical.isEmergency ? "EMERGENCY" : severity === "severe" ? "URGENT" : "SOON",
        urgencyDescription: localClinical.isEmergency
          ? "Immediate emergency care required based on safety rules."
          : "Consult nearest public healthcare facility (PHC/CHC).",
        redFlagsDetected: localClinical.flagsFound,
        isEmergency: localClinical.isEmergency,
        possibleCategories: [
          {
            name: "Clinical Presentation",
            likelihood: "High",
            description: "Physical clinical assessment and vital checks advised."
          }
        ],
        recommendedCareLevel: localClinical.isEmergency ? "District Hospital Emergency / 108" : "Primary Health Centre (PHC)",
        teleconsultationFeasible: !localClinical.isEmergency,
        clinicalQuestionsToAsk: ["Any worsening on exertion?", "Are you able to swallow?"],
        homeCareGuidance: "Rest comfortably and stay hydrated.",
        warningSignsToWatch: ["Confusion", "Cyanosis", "SpO2 < 94%"],
        doctorBrief: `Patient ${age}y ${gender}, Symptoms: ${symptoms}, Severity: ${severity}.`,
        disclaimer: t.disclaimerText
      };
      setResult(fallback);
    } finally {
      setLoading(false);
    }
  };

  const copySbarBrief = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.doctorBrief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Hero Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Activity className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{t.symptomTitle}</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              {t.symptomSubtitle}
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Safety-First Layered Architecture
            </span>
          </div>
        </div>

        {/* Quick Test Presets Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Clinical Personas:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition flex items-center space-x-1 ${
                  activePreset === p.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>{p.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Symptom Input & Clinical Parameters (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Symptom Description Box */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                <span>1. Describe Primary Symptoms & Complaints</span>
              </label>
              
              <button
                type="button"
                onClick={handleVoiceToggle}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  isListening
                    ? "bg-red-600 text-white animate-pulse"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300"
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isListening ? t.listening : t.voiceInput}</span>
              </button>
            </div>

            <div className="relative">
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder={t.symptomPlaceholder}
                rows={4}
                className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-xl p-3.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition leading-relaxed"
              />
            </div>

            {/* Severity, Duration, Age & Gender Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.ageLabel}</label>
                <input
                  type="number"
                  min={0}
                  max={110}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.genderLabel}</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Male">Male (पुरुष / পুরুষ)</option>
                  <option value="Female">Female (महिला / মহিলা)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.durationLabel}</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full text-sm bg-slate-50 border border-slate-300 rounded-lg p-2 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="< 2 hours">&lt; 2 hours (Sudden)</option>
                  <option value="12-24 hours">12–24 hours</option>
                  <option value="1-2 days">1–2 days</option>
                  <option value="3-7 days">3–7 days</option>
                  <option value="> 1 week">&gt; 1 week (Subacute)</option>
                  <option value="> 1 month">&gt; 1 month (Chronic)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.severityLabel}</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className={`w-full text-sm font-semibold border rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 ${
                    severity === "severe" ? "bg-red-50 text-red-800 border-red-300" : severity === "moderate" ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-slate-50 text-slate-800 border-slate-300"
                  }`}
                >
                  <option value="mild">Mild (हल्का / মৃদু)</option>
                  <option value="moderate">Moderate (मध्यम / মাঝারি)</option>
                  <option value="severe">Severe (गंभीर / তীব্র)</option>
                </select>
              </div>
            </div>

            {/* Pregnancy Checkbox if Female */}
            {gender === "Female" && age >= 14 && age <= 50 && (
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 flex items-center justify-between">
                <div className="text-xs text-pink-900 font-medium">
                  🤰 Is the patient currently pregnant or postpartum (&lt;6 weeks)?
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pregnancy}
                    onChange={(e) => setPregnancy(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
                </label>
              </div>
            )}

            {/* Comorbidities Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Existing Chronic Medical Conditions (Comorbidities)
              </label>
              <div className="flex flex-wrap gap-2">
                {COMORBIDITY_OPTIONS.map((c) => {
                  const isSelected = comorbidities.includes(c.id);
                  const label = language === "hi" ? c.labelHi : language === "bn" ? c.labelBn : c.labelEn;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setComorbidities(comorbidities.filter((x) => x !== c.id));
                        } else {
                          setComorbidities([...comorbidities, c.id]);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hard-Coded Red Flag Safety Checklist */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center space-x-2 text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h3 className="text-sm font-bold">2. Critical Red-Flag Safety Screener (Mandatory Check)</h3>
                <p className="text-xs text-amber-800">
                  Select <strong className="text-red-700">YES</strong> if any of these life-threatening warning signs are present right now:
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {RED_FLAG_CHECKLIST.map((q) => {
                const questionText = language === "hi" ? q.questionHi : language === "bn" ? q.questionBn : q.questionEn;
                const isChecked = !!redFlagAnswers[q.id];

                return (
                  <div
                    key={q.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${
                      isChecked
                        ? "bg-red-100/90 border-red-300 text-red-950 font-semibold"
                        : "bg-white border-amber-200/80 text-slate-800 hover:bg-amber-100/40"
                    }`}
                  >
                    <span className="pr-2 leading-tight">{questionText}</span>
                    <div className="flex space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setRedFlagAnswers({ ...redFlagAnswers, [q.id]: false })}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          !isChecked ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setRedFlagAnswers({ ...redFlagAnswers, [q.id]: true })}
                        className={`px-2.5 py-1 rounded text-xs font-bold ${
                          isChecked ? "bg-red-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700"
                        }`}
                      >
                        YES ⚠️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleRunTriage}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-900/20 text-sm flex items-center justify-center space-x-2 transition disabled:opacity-50"
          >
            <Activity className="w-5 h-5" />
            <span>{loading ? t.analyzing : t.analyzeBtn}</span>
          </button>
        </div>

        {/* Right Column: Triage Result & Next Steps (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {!result && !loading && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <Stethoscope className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Assessment Run Yet</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Type your symptoms, select patient parameters, or click one of our <strong>Quick Clinical Personas</strong> above to test emergency and PHC triage outcomes.
              </p>
              <div className="pt-2 text-xs text-slate-400">
                🔒 Privacy Protected: No personal identifying data is transmitted or stored externally.
              </div>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center space-y-4 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center animate-spin">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Evaluating Safety & Urgency...</h3>
              <p className="text-xs text-slate-500">
                Running rule-based emergency triage layer → differential probability assessment → care level matching.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Urgency Classification Card */}
              <div
                className={`rounded-2xl p-5 shadow-md border-2 ${
                  result.urgency === "EMERGENCY"
                    ? "bg-red-50 border-red-500 text-red-950"
                    : result.urgency === "URGENT"
                    ? "bg-amber-50 border-amber-500 text-amber-950"
                    : result.urgency === "SOON"
                    ? "bg-blue-50 border-blue-400 text-blue-950"
                    : "bg-emerald-50 border-emerald-500 text-emerald-950"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/80 border shadow-xs">
                    TRIAGE CLASSIFICATION
                  </span>
                  <span className="text-xs font-semibold">
                    {result.isEmergency ? "🚨 RED LEVEL 1" : result.urgency === "URGENT" ? "⚠️ YELLOW LEVEL 2" : "🟢 GREEN LEVEL 3"}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-extrabold flex items-center space-x-2">
                  {result.urgency === "EMERGENCY" && <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />}
                  {result.urgency === "URGENT" && <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />}
                  {result.urgency === "SOON" && <Clock className="w-6 h-6 text-blue-600 shrink-0" />}
                  {result.urgency === "ROUTINE" && <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />}
                  <span>
                    {result.urgency === "EMERGENCY"
                      ? t.urgencyEmergency
                      : result.urgency === "URGENT"
                      ? t.urgencyUrgent
                      : result.urgency === "SOON"
                      ? t.urgencySoon
                      : t.urgencyRoutine}
                  </span>
                </h2>

                <p className="text-xs mt-2 font-medium leading-relaxed">
                  {result.urgencyDescription}
                </p>

                {/* Detected Red Flags */}
                {result.redFlagsDetected && result.redFlagsDetected.length > 0 && (
                  <div className="mt-3 p-3 bg-red-100/90 rounded-xl border border-red-200">
                    <div className="text-xs font-bold text-red-900 mb-1 flex items-center space-x-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-700" />
                      <span>{t.redFlagsDetected}:</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-red-900 space-y-0.5">
                      {result.redFlagsDetected.map((flag, idx) => (
                        <li key={idx} className="font-semibold">{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Recommended Healthcare Facility Level */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t.recommendedCare}
                  </span>
                  <span className="text-xs text-emerald-700 bg-emerald-50 font-semibold px-2 py-0.5 rounded">
                    Public / Empaneled Path
                  </span>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Building2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-slate-900">{result.recommendedCareLevel}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {result.teleconsultationFeasible 
                        ? "✅ Telemedicine via eSanjeevani or in-person consultation feasible" 
                        : "⛔ In-Person Emergency Department review required immediately"}
                    </div>
                  </div>
                </div>

                {/* Differential broad categories */}
                {result.possibleCategories && result.possibleCategories.length > 0 && (
                  <div className="pt-2">
                    <span className="text-xs font-bold text-slate-700 block mb-1.5">Differential Clinical Possibilities:</span>
                    <div className="space-y-1.5">
                      {result.possibleCategories.map((cat, i) => (
                        <div key={i} className="p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{cat.name}</span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                              {cat.likelihood} Match
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">{cat.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Safe Home Guidance & Warning Signs */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>{t.homeCareAdvice}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                  {result.homeCareGuidance}
                </p>

                {result.warningSignsToWatch && result.warningSignsToWatch.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-1">Escalation Triggers to Watch:</span>
                    <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
                      {result.warningSignsToWatch.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Doctor Brief / SBAR Handover Slip */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
                    <FileText className="w-4 h-4" />
                    <span>{t.doctorSummaryTitle}</span>
                  </div>
                  <button
                    onClick={copySbarBrief}
                    className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 transition"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copied ? "Copied! ✓" : "Copy Slip"}</span>
                  </button>
                </div>
                
                <p className="text-xs text-slate-300 font-mono bg-slate-950/80 p-3 rounded-xl border border-slate-800 leading-relaxed whitespace-pre-wrap">
                  {result.doctorBrief}
                </p>
                <p className="text-[10px] text-slate-400 italic">
                  Hand this clinical brief to your PHC doctor, ASHA worker, or upload to eSanjeevani.
                </p>
              </div>

              {/* Navigation Action Hub */}
              <div className="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-2xl p-5 text-white shadow-lg space-y-3">
                <h4 className="text-sm font-bold">Next Steps for Affordable Care:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => onNavigateToFacility(result.recommendedCareLevel)}
                    className="bg-white text-slate-900 hover:bg-slate-100 font-bold p-2.5 rounded-xl flex items-center justify-between transition shadow-sm"
                  >
                    <span>1. Find Verified Facilities</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                  </button>
                  <button
                    onClick={onNavigateToInsurance}
                    className="bg-emerald-900/60 hover:bg-emerald-900 text-white font-bold p-2.5 rounded-xl flex items-center justify-between transition border border-emerald-400/40"
                  >
                    <span>2. Check PM-JAY / Insurance</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
                  </button>
                </div>
                <button
                  onClick={onNavigateToCost}
                  className="w-full text-center text-xs text-emerald-100 hover:underline pt-1"
                >
                  Or estimate out-of-pocket surgery/treatment cost →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
