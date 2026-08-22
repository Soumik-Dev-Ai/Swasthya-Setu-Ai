import React, { useState } from "react";
import { Language, PatientRecord, TriageResult } from "../types";
import { TRANSLATIONS } from "../utils/translations";
import { INITIAL_PATIENTS_REGISTRY } from "../data/mockData";
import { evaluateClinicalRuleEngine } from "../utils/clinicalRules";
import { 
  Users, 
  UserPlus, 
  Activity, 
  HeartPulse, 
  ShieldAlert, 
  FileText, 
  Send, 
  Printer, 
  CheckCircle2, 
  WifiOff, 
  Clock, 
  Building2,
  AlertTriangle,
  QrCode
} from "lucide-react";

interface HealthWorkerDashboardProps {
  language: Language;
  isOffline: boolean;
}

export const HealthWorkerDashboard: React.FC<HealthWorkerDashboardProps> = ({
  language = "en",
  isOffline = false,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // State
  const [patients, setPatients] = useState<PatientRecord[]>(INITIAL_PATIENTS_REGISTRY);
  const [showNewPatientModal, setShowNewPatientModal] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(INITIAL_PATIENTS_REGISTRY[0]);

  // Form State
  const [name, setName] = useState<string>("");
  const [age, setAge] = useState<number>(45);
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Female");
  const [village, setVillage] = useState<string>("Agradwip Gram, Katwa Block");
  const [phone, setPhone] = useState<string>("9832112233");
  const [symptoms, setSymptoms] = useState<string>("");
  const [bpSystolic, setBpSystolic] = useState<number>(140);
  const [bpDiastolic, setBpDiastolic] = useState<number>(90);
  const [spO2, setSpO2] = useState<number>(96);
  const [pulse, setPulse] = useState<number>(84);
  const [tempF, setTempF] = useState<number>(99.2);
  const [notes, setNotes] = useState<string>("");

  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !symptoms.trim()) {
      alert("Please provide patient name and primary complaints.");
      return;
    }

    const clinical = evaluateClinicalRuleEngine(symptoms, {}, age, spO2 < 94 || bpSystolic > 160 ? "severe" : "moderate");

    const newRecord: PatientRecord = {
      id: `pat-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      patientName: name,
      age,
      gender,
      villageOrCity: village,
      phone,
      symptoms,
      vitals: {
        bpSystolic,
        bpDiastolic,
        spO2,
        pulse,
        tempF,
      },
      status: clinical.isEmergency ? "Referred" : "Triaged",
      assignedFacility: clinical.isEmergency ? "Sub-District Hospital Katwa" : "PHC Agradwip",
      healthWorkerNotes: notes || (clinical.isEmergency ? "Emergency ASHA Field Referral" : "Routine PHC referral"),
      offlineSaved: isOffline,
      triageResult: {
        urgency: clinical.isEmergency ? "EMERGENCY" : "URGENT",
        urgencyDescription: clinical.isEmergency 
          ? "Critical field red flags detected. Immediate referral accompanied by ASHA worker."
          : "Referred to Medical Officer at Primary Health Centre.",
        redFlagsDetected: clinical.flagsFound,
        isEmergency: clinical.isEmergency,
        possibleCategories: [{ name: "Field Triage Assessment", likelihood: "High", description: "Clinical exam needed" }],
        recommendedCareLevel: clinical.isEmergency ? "Sub-District Hospital / CHC" : "Primary Health Centre (PHC)",
        teleconsultationFeasible: !clinical.isEmergency,
        clinicalQuestionsToAsk: ["Timeline of symptom escalation"],
        homeCareGuidance: "Ensure hydration, keep patient calm.",
        warningSignsToWatch: ["SpO2 drop < 94%", "Confusion"],
        doctorBrief: `ASHA Referral: ${name} (${age}y/${gender}), Vitals: BP ${bpSystolic}/${bpDiastolic}, SpO2 ${spO2}%, HR ${pulse}. Symptoms: ${symptoms}`,
        disclaimer: "ASHA Field Decision Support."
      }
    };

    setPatients([newRecord, ...patients]);
    setSelectedPatient(newRecord);
    setShowNewPatientModal(false);

    // Reset Form
    setName("");
    setSymptoms("");
    setNotes("");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Users className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {t.navAshaPortal} (Field Worker Triage & Referral)
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Designed for Accredited Social Health Activists (ASHA), Auxiliary Nurse Midwives (ANM), and Community Health Officers (CHO). Register patients offline, record vitals, generate digital referral slips, and track PHC follow-ups.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <button
              onClick={() => setShowNewPatientModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-900/20 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Register New Field Patient</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Registered Patients List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Community Registry ({patients.length})
            </h2>
            {isOffline && (
              <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold flex items-center space-x-1">
                <WifiOff className="w-3 h-3" />
                <span>Offline Storage</span>
              </span>
            )}
          </div>

          <div className="space-y-3">
            {patients.map((pat) => {
              const isEmergency = pat.triageResult?.isEmergency;
              const isSelected = selectedPatient?.id === pat.id;

              return (
                <div
                  key={pat.id}
                  onClick={() => setSelectedPatient(pat)}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-md"
                      : "bg-white text-slate-900 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm">{pat.patientName}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isSelected ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
                        }`}>
                          {pat.age}y / {pat.gender}
                        </span>
                      </div>
                      <div className={`text-xs mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                        📍 {pat.villageOrCity}
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isEmergency
                        ? "bg-red-500 text-white animate-pulse"
                        : pat.status === "Referred"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-emerald-500 text-white"
                    }`}>
                      {isEmergency ? "🚨 EMERGENCY" : pat.status}
                    </span>
                  </div>

                  <p className={`text-xs mt-2 line-clamp-1 ${isSelected ? "text-slate-300" : "text-slate-600"}`}>
                    <strong>Complaints:</strong> {pat.symptoms}
                  </p>

                  {pat.vitals && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-200/20 text-[11px]">
                      <span>BP: <strong>{pat.vitals.bpSystolic}/{pat.vitals.bpDiastolic}</strong></span>
                      <span>SpO2: <strong className={pat.vitals.spO2 && pat.vitals.spO2 < 94 ? "text-red-400 font-bold" : ""}>{pat.vitals.spO2}%</strong></span>
                      <span>HR: <strong>{pat.vitals.pulse} bpm</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Patient Referral Slip & SBAR Handover (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedPatient ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
              {/* Slip Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      DIGITAL ASHA REFERRAL SLIP
                    </span>
                    <span className="text-xs font-mono text-slate-400">ID: #{selectedPatient.id}</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-1">{selectedPatient.patientName}</h3>
                  <div className="text-xs text-slate-500">
                    Age: {selectedPatient.age}y • {selectedPatient.gender} • Village: {selectedPatient.villageOrCity} • Phone: {selectedPatient.phone}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Slip</span>
                  </button>
                </div>
              </div>

              {/* Vitals Snapshot */}
              {selectedPatient.vitals && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Blood Pressure</span>
                    <span className={`text-sm font-bold ${
                      (selectedPatient.vitals.bpSystolic || 0) > 150 ? "text-red-600" : "text-slate-900"
                    }`}>
                      {selectedPatient.vitals.bpSystolic}/{selectedPatient.vitals.bpDiastolic} mmHg
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Oxygen (SpO2)</span>
                    <span className={`text-sm font-bold ${
                      (selectedPatient.vitals.spO2 || 98) < 94 ? "text-red-600" : "text-emerald-700"
                    }`}>
                      {selectedPatient.vitals.spO2}%
                    </span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Pulse Rate</span>
                    <span className="text-sm font-bold text-slate-900">{selectedPatient.vitals.pulse} bpm</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Temperature</span>
                    <span className="text-sm font-bold text-slate-900">{selectedPatient.vitals.tempF}°F</span>
                  </div>
                </div>
              )}

              {/* Clinical Handover Summary */}
              {selectedPatient.triageResult && (
                <div className="space-y-3">
                  <div className={`p-4 rounded-xl border ${
                    selectedPatient.triageResult.isEmergency
                      ? "bg-red-50 border-red-300 text-red-950"
                      : "bg-emerald-50 border-emerald-300 text-emerald-950"
                  }`}>
                    <div className="flex items-center space-x-2 font-bold text-xs mb-1">
                      {selectedPatient.triageResult.isEmergency ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      <span>Triage Recommendation: {selectedPatient.triageResult.recommendedCareLevel}</span>
                    </div>
                    <p className="text-xs leading-relaxed">{selectedPatient.triageResult.urgencyDescription}</p>
                  </div>

                  <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
                      <span>Doctor-Ready SBAR Handover Slip</span>
                      <span className="text-[10px] text-slate-400">eSanjeevani / In-Person</span>
                    </div>
                    <p className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedPatient.triageResult.doctorBrief}
                    </p>
                  </div>
                </div>
              )}

              {/* Referral Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong>Assigned Referral Target:</strong> {selectedPatient.assignedFacility}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <a
                    href="tel:108"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    Dispatch 108
                  </a>
                  <a
                    href="https://esanjeevani.mohfw.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg transition"
                  >
                    eSanjeevani Teleconsult
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
              Select a patient from the left column to view referral details and SBAR slips.
            </div>
          )}
        </div>
      </div>

      {/* Register New Patient Modal */}
      {showNewPatientModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Register Community Patient</h3>
              <button
                onClick={() => setShowNewPatientModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Basanti Roy"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Age (Years) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={110}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Village / Ward / Block</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Primary Symptoms & Complaints *</label>
                <textarea
                  required
                  rows={3}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. Fever for 3 days with chills, severe weakness and vomiting..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Vitals Input Grid */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 block">Field Vitals Recording</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600">BP Systolic</label>
                    <input
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">BP Diastolic</label>
                    <input
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">SpO2 (%)</label>
                    <input
                      type="number"
                      value={spO2}
                      onChange={(e) => setSpO2(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={pulse}
                      onChange={(e) => setPulse(Number(e.target.value))}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewPatientModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-900/20"
                >
                  Save & Generate Referral
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
