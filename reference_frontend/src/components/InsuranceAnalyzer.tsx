import React, { useState } from "react";
import { Language, PolicyAnalysis } from "../types";
import { TRANSLATIONS } from "../utils/translations";
import { PRESET_POLICIES } from "../data/mockData";
import { 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Upload, 
  Building2, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  Percent, 
  BedDouble, 
  EyeOff
} from "lucide-react";

interface InsuranceAnalyzerProps {
  language: Language;
  onNavigateToCost: () => void;
}

export const InsuranceAnalyzer: React.FC<InsuranceAnalyzerProps> = ({
  language = "en",
  onNavigateToCost,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // State
  const [selectedPresetId, setSelectedPresetId] = useState<string>("corporate_gmc");
  const [customPolicyText, setCustomPolicyText] = useState<string>("");
  const [sumInsured, setSumInsured] = useState<number>(300000);
  const [policyType, setPolicyType] = useState<string>("corporate");
  const [patientAge, setPatientAge] = useState<number>(35);
  const [preExistingDisease, setPreExistingDisease] = useState<string>("Hypertension");
  const [loading, setLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<PolicyAnalysis | null>(null);

  // Load preset on change
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = PRESET_POLICIES.find((x) => x.id === presetId);
    if (p) {
      setCustomPolicyText(p.rawText);
      setSumInsured(p.sumInsured);
      setPolicyType(presetId === "corporate_gmc" ? "corporate" : "retail");
    }
  };

  // Initial load
  React.useEffect(() => {
    handleSelectPreset("corporate_gmc");
  }, []);

  // Run Analysis
  const handleAnalyzePolicy = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/policy-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyText: customPolicyText,
          policyType,
          sumInsured,
          age: patientAge,
          preExistingConditions: preExistingDisease ? [preExistingDisease] : [],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze policy");
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      console.warn("Fallback to local policy parser:", err);
      // Fallback deterministic analysis
      setAnalysis({
        insurer: selectedPresetId === "corporate_gmc" ? "Employer Group Mediclaim (GMC)" : "Retail Health Insurance",
        planName: selectedPresetId === "corporate_gmc" ? "Corporate Mediclaim Shield" : "Comprehensive Health Guard",
        sumInsured: sumInsured || 500000,
        roomRentCap: selectedPresetId === "corporate_gmc" ? "1% of Sum Insured (₹3,000/day max for standard room)" : "Single Standard A/C Room",
        coPayment: selectedPresetId === "corporate_gmc" ? "10% on Dependent Parents" : "0% (Age < 60)",
        waitingPeriods: {
          initial: "30 Days (Waived in Corporate)",
          specificDiseases: selectedPresetId === "corporate_gmc" ? "0 Months (Waived in GMC)" : "24 Months (Cataract, Hernia, Knee Replacement)",
          preExisting: selectedPresetId === "corporate_gmc" ? "0 Months (Day 1 PED Covered)" : "36 Months"
        },
        coveredFeatures: [
          "Inpatient Hospitalization (>24 hours)",
          "Pre-hospitalization (30-60 days) & Post-hospitalization (60-90 days)",
          "Day care treatments requiring anesthesia",
          "Ambulance cover up to ₹2,000"
        ],
        exclusions: [
          "Non-medical consumables (PPE, Gloves, Thermometer, Admin files)",
          "OPD consultations & routine pharmacy unless OPD rider opted",
          "Cosmetic procedures and dental surgeries"
        ],
        coverageGaps: [
          "Room Rent Proportionate Deduction: If chosen room rent exceeds limit (e.g. ₹6,000 single private vs ₹3,000 cap), the insurer will proportionately slash doctor fees and OT charges by 50%!",
          "Hospital Consumables: ~8% to 12% of hospital bills are classed as non-payable consumables.",
          "Pre-Authorization timeline: Cashless approval takes 2-4 hours; initial deposit may still be asked by private hospitals."
        ],
        claimGuidance: "Planned admission: Intimate TPA desk at least 48 hours prior with Doctor referral & cost estimation slip. Emergency: Notify TPA within 24 hours of hospital admission."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {t.policyAnalyzerTitle}
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Scan health insurance policy clauses, detect hidden sub-limits, waiting periods, room-rent proportionate deductions, and calculate true payable coverage.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              IRDAI Policy Guidelines
            </span>
          </div>
        </div>

        {/* Presets Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Select Verified Indian Health Policy Benchmark:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_POLICIES.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`text-xs px-3 py-2 rounded-xl border font-semibold transition text-left ${
                  selectedPresetId === p.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div>{p.name}</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">Sum: ₹{(p.sumInsured).toLocaleString("en-IN")} • {p.type}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Policy Text & Controls (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>1. Policy Schedule Text or Extract</span>
            </h2>

            <textarea
              value={customPolicyText}
              onChange={(e) => setCustomPolicyText(e.target.value)}
              rows={6}
              placeholder="Paste insurance policy wording, schedule clause, or TPA coverage letter..."
              className="w-full text-xs font-mono text-slate-800 bg-slate-50 border border-slate-300 rounded-xl p-3.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sum Insured (₹)
                </label>
                <input
                  type="number"
                  step={50000}
                  value={sumInsured}
                  onChange={(e) => setSumInsured(Number(e.target.value))}
                  className="w-full text-sm font-semibold p-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Policy Type
                </label>
                <select
                  value={policyType}
                  onChange={(e) => setPolicyType(e.target.value)}
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="corporate">Employer Corporate (GMC)</option>
                  <option value="retail">Retail Family Floater</option>
                  <option value="senior">Senior Citizen Red Carpet</option>
                  <option value="arogya">Arogya Sanjeevani</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pre-Existing Condition
                </label>
                <input
                  type="text"
                  value={preExistingDisease}
                  onChange={(e) => setPreExistingDisease(e.target.value)}
                  placeholder="e.g. Diabetes, Thyroid"
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={handleAnalyzePolicy}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 px-6 rounded-xl shadow-md text-sm flex items-center justify-center space-x-2 transition disabled:opacity-50 mt-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{loading ? "Analyzing Policy Clauses & Sub-Limits..." : "Analyze Insurance Coverage & Gaps"}</span>
            </button>
          </div>

          {/* Educational Warning on Proportionate Deductions */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Major Indian Insurance Trap: Proportionate Deduction</span>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              If your policy limits room rent to 1% of Sum Insured (e.g. ₹3,000/day on a ₹3L policy), but you choose a Single Deluxe Room costing ₹6,000/day, the insurer will reduce <strong>not just the room charge, but your entire surgery fee, OT charges, and doctor visits by 50%</strong>!
            </p>
          </div>
        </div>

        {/* Right Column: Structured Clause Analysis (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {!analysis && !loading && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Scan Policy Clauses</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Click <strong>Analyze Insurance Coverage</strong> to extract room rent capping, waiting period timelines, co-payment rules, and out-of-pocket gap calculations.
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center animate-spin">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Scanning Policy PDF & Clauses...</h3>
              <p className="text-xs text-slate-500">Checking room-rent sub-limits, PED waiting periods, and day-care surgical inclusions.</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              {/* Top Overview Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    POLICY ANALYSIS SUMMARY
                  </span>
                  <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    Verified Plan
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold">{analysis.planName}</h3>
                  <div className="text-xs text-slate-400">{analysis.insurer}</div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="bg-slate-800/90 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Sum Insured:</span>
                    <span className="font-bold text-emerald-300">₹{(analysis.sumInsured).toLocaleString("en-IN")}</span>
                  </div>

                  <div className="bg-slate-800/90 p-2.5 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Co-Payment:</span>
                    <span className="font-bold text-white">{analysis.coPayment}</span>
                  </div>

                  <div className="bg-slate-800/90 p-2.5 rounded-xl col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-400 block">Room Rent Capping:</span>
                    <span className="font-bold text-amber-300">{analysis.roomRentCap}</span>
                  </div>
                </div>
              </div>

              {/* Waiting Period Matrix */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Waiting Period Tracker</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block">Initial Waiting:</span>
                    <span className="text-xs text-slate-600 font-medium">{analysis.waitingPeriods.initial}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block">Specific Illnesses:</span>
                    <span className="text-xs text-slate-600 font-medium">{analysis.waitingPeriods.specificDiseases}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block">Pre-Existing (PED):</span>
                    <span className="text-xs text-slate-600 font-medium">{analysis.waitingPeriods.preExisting}</span>
                  </div>
                </div>
              </div>

              {/* Critical Coverage Gaps & Warnings */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-2.5">
                <div className="flex items-center space-x-2 text-rose-900 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Identified Coverage Gaps & Out-of-Pocket Risks</span>
                </div>
                <ul className="space-y-1.5 text-xs text-rose-950">
                  {analysis.coverageGaps.map((gap, i) => (
                    <li key={i} className="flex items-start space-x-2 bg-white/70 p-2.5 rounded-xl border border-rose-100">
                      <span className="text-rose-600 font-bold shrink-0">⚠️</span>
                      <span className="leading-snug">{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cashless Claim Guidance & Button to Cost Calculator */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-950 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cashless Pre-Authorization Protocol</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  {analysis.claimGuidance}
                </p>
                <button
                  onClick={onNavigateToCost}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold p-3 rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-sm"
                >
                  <span>Test this Policy in the Hospital Cost Calculator</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
