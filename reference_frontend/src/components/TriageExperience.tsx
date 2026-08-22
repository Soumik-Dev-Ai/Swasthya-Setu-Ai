import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowRight, AudioLines, BadgeCheck, Building2, Check, ChevronDown, CircleDollarSign, CloudUpload, FileImage, HeartPulse, MapPin, Mic, Search, ShieldAlert, ShieldCheck, Sparkles, Stethoscope, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Language, FinancialProfile } from "../types";
import { RED_FLAG_CHECKLIST } from "../utils/clinicalRules";
import { useFinancial } from "../context/FinancialContext";
import { useEmergencySync } from "../context/EmergencySyncContext";

interface TriageExperienceProps {
  language: Language;
  isOffline: boolean;
  onNavigateToFacility: (careLevel?: string) => void;
  onNavigateToInsurance: () => void;
  onNavigateToCost: () => void;
  initialSymptoms?: string;
}

interface MockResult {
  urgency: "EMERGENCY" | "URGENT" | "SOON";
  isEmergency: boolean;
  careLevel: string;
  description: string;
  flags: string[];
}

interface Hospital {
  name: string;
  district: string;
  rating: number;
  cost: number;
  affordability: number;
  distance: string;
  pmjay: boolean;
}

const HOSPITALS: Hospital[] = [
  { name: "Burdwan Medical College & Hospital", district: "Purba Bardhaman · Public", rating: 4.6, cost: 1800, affordability: 97, distance: "6.4 km", pmjay: true },
  { name: "Durgapur Seva Trust Hospital", district: "Durgapur · Empaneled", rating: 4.4, cost: 12500, affordability: 91, distance: "11.8 km", pmjay: true },
  { name: "Rural Health Centre, Kalna", district: "Kalna · PHC Network", rating: 4.1, cost: 850, affordability: 99, distance: "18.2 km", pmjay: true },
];

const DEFAULT_DRAFT: FinancialProfile = {
  monthlyIncome: 42000,
  familyMembers: 4,
  elderlyCount: 0,
  childrenCount: 1,
  essentialMonthlyExpenses: 26000,
  monthlyDebtObligations: 4500,
  hasBPLCard: false,
  hasAyushmanCard: true,
  hasStateCard: false,
  stateCardName: "",
  residenceType: "semi_urban",
  existingInsuranceType: "pmjay",
  existingSumInsured: 500000,
};

function CustomSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="field-wrap">
      <span className="field-label">{label}</span>
      <div className="relative">
        <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="custom-select-button"><span className="truncate">{value}</span><ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`} /></button>
        <AnimatePresence>
          {open && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="custom-select-menu" role="listbox">
            {options.map((option) => <button type="button" role="option" aria-selected={option === value} key={option} onClick={() => { onChange(option); setOpen(false); }} className={`custom-select-option ${option === value ? "is-selected" : ""}`}>{option}{option === value && <Check className="h-3.5 w-3.5" />}</button>)}
          </motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", prefix }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; prefix?: string }) {
  return <label className="field-wrap"><span className="field-label">{label}</span><span className="input-with-prefix">{prefix && <span>{prefix}</span>}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></span></label>;
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className={`check-row ${checked ? "is-checked" : ""}`}><span>{label}</span><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`premium-switch ${checked ? "is-on" : ""}`}><span className="switch-thumb" /><span className="sr-only">{checked ? "Yes" : "No"}</span></button></div>;
}

function HospitalCard({ hospital, index }: { hospital: Hospital; index: number }) {
  return <motion.article layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} className="hospital-card"><div className="hospital-card__top"><span className="hospital-icon"><Building2 className="h-4 w-4" /></span><span className="hospital-distance"><MapPin className="h-3 w-3" /> {hospital.distance}</span></div><h3>{hospital.name}</h3><p>{hospital.district}</p><div className="hospital-meta"><span><span className="star">★</span> {hospital.rating}</span><span className="pmjay-chip">{hospital.pmjay ? "PM-JAY empaneled" : "Network facility"}</span></div><div className="hospital-card__bottom"><span><small>Expected cost</small><strong>₹{hospital.cost.toLocaleString("en-IN")}</strong></span><span className="affordability"><small>Affordability</small><strong>{hospital.affordability}% <em>affordable</em></strong></span></div></motion.article>;
}

export function TriageExperience({ language, isOffline, onNavigateToFacility, onNavigateToInsurance, onNavigateToCost, initialSymptoms = "" }: TriageExperienceProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const { profile, setProfile } = useFinancial();
  const { syncEmergency } = useEmergencySync();
  const [symptoms, setSymptoms] = useState(initialSymptoms);
  const [age, setAge] = useState("38");
  const [gender, setGender] = useState("Male");
  const [duration, setDuration] = useState("1–2 days");
  const [severity, setSeverity] = useState("Moderate");
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MockResult | null>(null);
  const [validation, setValidation] = useState("");
  const [imageName, setImageName] = useState("");
  const [redFlags, setRedFlags] = useState<Record<string, boolean>>({});
  const [affordabilityOpen, setAffordabilityOpen] = useState(false);
  const [hospitalResults, setHospitalResults] = useState(false);
  const [draft, setDraft] = useState<FinancialProfile>(profile || DEFAULT_DRAFT);

  const hasEmergencyFlag = Object.values(redFlags).some(Boolean);
  const flagCount = Object.values(redFlags).filter(Boolean).length;
  const presets = [
    { label: "Chest pain + sweating", text: "Crushing chest tightness radiating to the left arm with cold sweating for 45 minutes", severe: true },
    { label: "High fever + chills", text: "High fever with severe chills, body aches and vomiting for 3 days", severe: false },
    { label: "Right lower abdominal pain", text: "Sharp right lower abdominal pain with nausea and low fever for 18 hours", severe: true },
  ];

  const preview = useMemo(() => {
    const income = draft.monthlyIncome || 0;
    const expenses = (draft.essentialMonthlyExpenses || 0) + (draft.monthlyDebtObligations || 0);
    return Math.max(0, income - expenses);
  }, [draft]);

  const setDraftValue = <K extends keyof FinancialProfile>(key: K, value: FinancialProfile[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const toggleVoice = () => {
    if (isListening) { setIsListening(false); return; }
    setIsListening(true);
    window.setTimeout(() => { setSymptoms((current) => current || "Mild breathlessness and fatigue for two days"); setIsListening(false); }, 850);
  };

  const analyze = () => {
    if (!symptoms.trim()) { setValidation("Describe the main symptom before analysis."); return; }
    setValidation(""); setLoading(true); setResult(null); setHospitalResults(false);
    window.setTimeout(() => {
      const symptomEmergency = /chest pain|crushing|breathlessness|cannot breathe|severe bleeding|stroke|unconscious|fainted|seizure/i.test(symptoms);
      const emergency = hasEmergencyFlag || symptomEmergency || severity === "Severe";
      const detectedFlags = hasEmergencyFlag ? ["Critical checklist signal selected"] : symptomEmergency ? ["Potential emergency language detected"] : [];
      const nextResult: MockResult = {
        urgency: emergency ? "EMERGENCY" : severity === "Moderate" ? "URGENT" : "SOON",
        isEmergency: emergency,
        careLevel: emergency ? "District Hospital Emergency / 108 Ambulance" : "Primary Health Centre (PHC) / CHC",
        description: emergency ? "Safety signals suggest immediate in-person evaluation. This is a navigation alert, not a diagnosis." : "A clinician should review the symptoms soon. Use the affordability flow to compare the next practical care options.",
        flags: detectedFlags,
      };
      setResult(nextResult);
      if (emergency) syncEmergency({ patientName: "Mitali Das", symptoms, urgency: "EMERGENCY", assessment: "RED · LEVEL 1 — Immediate medical attention", location: "Agradwip Gram, Katwa Block", source: "AI triage" });
      setLoading(false);
    }, reduceMotion ? 80 : 720);
  };

  const submitAffordability = () => { setProfile(draft); setAffordabilityOpen(false); setHospitalResults(true); };
  const handleFile = (file?: File) => { if (file) setImageName(file.name); };

  return <div className="engine-page">
    <div className="engine-container">
      <motion.header initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }} animate={{ opacity: 1, y: 0 }} className="engine-hero">
        <div><div className="route-kicker"><span className="status-dot" /> Triage engine <span>/</span> Offline-first safety layer</div><h1>AI Symptom <span className="cyan-gradient">Detector</span></h1><p>Describe what is happening in plain language. The safety layer checks red flags first, then routes you toward the next affordable step.</p></div><div className="engine-hero__side"><span className="trust-chip"><ShieldCheck className="h-4 w-4" /> No diagnosis. Better next steps.</span><span className="offline-chip"><span className="mini-pulse" /> {isOffline ? "Running locally" : "Cloud + local fallback"}</span></div>
      </motion.header>

      <div className="preset-row"><span className="preset-label">Try a mock scenario</span>{presets.map((preset) => <button type="button" key={preset.label} onClick={() => { setSymptoms(preset.text); setSeverity(preset.severe ? "Severe" : "Moderate"); }} className="preset-button">{preset.label}<ArrowRight className="h-3.5 w-3.5" /></button>)}</div>

      <div className="engine-grid">
        <motion.section layout className="engine-panel input-panel" initial={{ opacity: 0, x: reduceMotion ? 0 : -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}>
          <div className="panel-heading"><div><span className="section-index">01</span><h2>Tell us what you&apos;re feeling</h2></div><span className="panel-status"><AudioLines className="h-3.5 w-3.5" /> Voice enabled</span></div>
          <button type="button" onClick={toggleVoice} className={`voice-orb ${isListening ? "is-listening" : ""}`} aria-label={isListening ? "Stop mock voice input" : "Start mock voice input"}><span className="voice-orb__rings" /><span className="voice-orb__core">{isListening ? <AudioLines className="h-7 w-7" /> : <Mic className="h-7 w-7" />}</span><span className="voice-orb__label">{isListening ? "Listening…" : "Tap to speak"}</span></button>
          <label className="textarea-field"><span className="field-label">Primary symptoms</span><textarea value={symptoms} onChange={(event) => setSymptoms(event.target.value)} placeholder="For example: chest tightness after walking, fever since yesterday, or a child with loose stools…" rows={5} /></label>
          <div className="form-grid form-grid--four"><Field label="Age" type="number" value={age} onChange={setAge} /><CustomSelect label="Gender" value={gender} options={["Male", "Female", "Other"]} onChange={setGender} /><CustomSelect label="Duration" value={duration} options={["< 2 hours", "12–24 hours", "1–2 days", "3–7 days", "> 1 week"]} onChange={setDuration} /><CustomSelect label="Severity" value={severity} options={["Mild", "Moderate", "Severe"]} onChange={setSeverity} /></div>
          <label className="upload-zone" htmlFor="triage-image"><input id="triage-image" type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} /><span className="upload-icon"><CloudUpload className="h-5 w-5" /></span><span><strong>{imageName || "Drop a photo or browse"}</strong><small>{imageName ? "Image attached for mock review" : "Optional · skin, report, or prescription image"}</small></span><FileImage className="ml-auto h-4 w-4 text-slate-500" /></label>
          <div className="checklist-block"><div className="checklist-heading"><span className="section-index section-index--amber">02</span><div><h2>Critical emergency checklist</h2><p>Answer yes only if it is happening right now.</p></div><span className="flag-counter">{flagCount} flagged</span></div><div className="checklist-list">{RED_FLAG_CHECKLIST.slice(0, 5).map((item) => <Switch key={item.id} label={item.questionEn} checked={Boolean(redFlags[item.id])} onChange={(value) => setRedFlags((current) => ({ ...current, [item.id]: value }))} />)}</div></div>
          {validation && <div className="inline-error" role="alert"><AlertTriangle className="h-4 w-4" /> {validation}</div>}
          <button type="button" onClick={analyze} disabled={loading} className="engine-primary-button">{loading ? <span className="spinner" /> : <HeartPulse className="h-4 w-4" />}{loading ? "Analyzing safety signals…" : "Analyze symptoms"}<ArrowRight className="ml-auto h-4 w-4" /></button>
        </motion.section>

        <motion.section layout className="engine-panel result-panel" initial={{ opacity: 0, x: reduceMotion ? 0 : 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.16 }}>
          <div className="panel-heading"><div><span className="section-index">03</span><h2>Assessment & next step</h2></div>{result && <span className="live-badge"><span className="status-dot" /> Updated just now</span>}</div>
          {!result && !loading && <div className="empty-assessment"><div className="empty-radar"><Stethoscope className="h-7 w-7" /><span /></div><h3>Your assessment will appear here</h3><p>Run the safety-first engine to see urgency, care level, and practical routing guidance.</p><div className="empty-notes"><span><ShieldCheck className="h-3.5 w-3.5" /> Private by design</span><span><Sparkles className="h-3.5 w-3.5" /> Mock data ready</span></div></div>}
          {loading && <div className="loading-assessment"><div className="loading-orbit"><span /><span /><span /></div><h3>Reading the safety layer</h3><p>Checking deterministic red flags, urgency, and care-level routing.</p></div>}
          {result && <motion.div layout className="result-stack"><motion.div layout className={`urgency-card ${result.isEmergency ? "is-emergency" : "is-urgent"}`}><div className="urgency-card__top"><span className="result-label">Safety classification</span><span className="result-level">{result.isEmergency ? "RED · LEVEL 1" : "AMBER · LEVEL 2"}</span></div><div className="urgency-card__main"><span className="urgency-icon">{result.isEmergency ? <AlertTriangle className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}</span><div><h3>{result.isEmergency ? "Immediate medical attention" : "Clinical review recommended"}</h3><p>{result.description}</p></div></div>{result.flags.length > 0 && <div className="flag-list">{result.flags.map((flag) => <span key={flag}><span className="h-1.5 w-1.5 rounded-full bg-current" />{flag}</span>)}</div>}</motion.div><div className="care-route-card"><span className="result-label">Recommended care route</span><div className="care-route-main"><Building2 className="h-5 w-5 text-emerald-300" /><strong>{result.careLevel}</strong></div><p>Compare practical, PM-JAY-aware facilities after sharing optional household context.</p></div><div className="result-action-card"><div><span className="result-label">Next step</span><h3>Find nearby care you can afford</h3><p>Your financial details stay optional and can be updated later.</p></div><button type="button" onClick={() => setAffordabilityOpen(true)} className="engine-secondary-button">Open affordability match <ArrowRight className="h-4 w-4" /></button></div><div className="result-links"><button type="button" onClick={onNavigateToInsurance}><ShieldCheck className="h-4 w-4" /> Check PM-JAY coverage</button><button type="button" onClick={onNavigateToCost}><CircleDollarSign className="h-4 w-4" /> Estimate treatment cost</button><button type="button" onClick={() => onNavigateToFacility(result.careLevel)}><MapPin className="h-4 w-4" /> Browse facilities</button></div></motion.div>}
          {hospitalResults && <motion.div layout className="hospital-results"><div className="hospital-results__header"><div><span className="result-label">Matched to your household</span><h3>Nearby facilities with room in the budget</h3></div><button type="button" onClick={() => setHospitalResults(false)} aria-label="Hide matched hospitals"><X className="h-4 w-4" /></button></div>{HOSPITALS.map((hospital, index) => <HospitalCard key={hospital.name} hospital={hospital} index={index} />)}</motion.div>}
        </motion.section>
      </div>
    </div>

    <AnimatePresence>{affordabilityOpen && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div role="dialog" aria-modal="true" aria-labelledby="affordability-title" initial={{ opacity: 0, y: reduceMotion ? 0 : 22, scale: reduceMotion ? 1 : .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduceMotion ? 0 : 16 }} className="affordability-modal"><div className="modal-header"><div><span className="route-kicker"><CircleDollarSign className="h-3.5 w-3.5" /> Optional financial context</span><h2 id="affordability-title">Unlock an affordability match</h2><p>Share a few household details so the hospital list can prioritize realistic options. No cashflow math is shown here.</p></div><button type="button" onClick={() => setAffordabilityOpen(false)} className="icon-button" aria-label="Close affordability modal"><X className="h-4 w-4" /></button></div><div className="modal-form"><div className="form-grid form-grid--two"><Field label="Monthly household income" prefix="₹" type="number" value={draft.monthlyIncome} onChange={(value) => setDraftValue("monthlyIncome", Number(value))} /><Field label="Monthly essential expenses" prefix="₹" type="number" value={draft.essentialMonthlyExpenses} onChange={(value) => setDraftValue("essentialMonthlyExpenses", Number(value))} /><Field label="Household members" type="number" value={draft.familyMembers} onChange={(value) => setDraftValue("familyMembers", Number(value))} /><Field label="Monthly debt obligations" prefix="₹" type="number" value={draft.monthlyDebtObligations} onChange={(value) => setDraftValue("monthlyDebtObligations", Number(value))} /></div><div className="modal-toggle-grid"><Switch label="Existing Ayushman / PM-JAY card" checked={draft.hasAyushmanCard} onChange={(value) => setDraftValue("hasAyushmanCard", value)} /><Switch label="State health card" checked={draft.hasStateCard} onChange={(value) => setDraftValue("hasStateCard", value)} /></div><div className="modal-preview"><span>Estimated monthly room</span><strong>₹{preview.toLocaleString("en-IN")}</strong><small>Used only to rank mock facility options.</small></div></div><div className="modal-footer"><button type="button" onClick={() => setAffordabilityOpen(false)} className="ghost-button">Not now</button><button type="button" onClick={submitAffordability} className="engine-primary-button">Show affordable facilities <ArrowRight className="h-4 w-4" /></button></div></motion.div></motion.div>}</AnimatePresence>
  </div>;
}
