import React, { useState } from "react";
import { Language, HealthcareFacility } from "../types";
import { TRANSLATIONS } from "../utils/translations";
import { SAMPLE_FACILITIES } from "../data/mockData";
import { 
  Building2, 
  Search, 
  MapPin, 
  PhoneCall, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Activity, 
  Stethoscope, 
  Bed, 
  Filter, 
  ExternalLink,
  Sparkles,
  Zap
} from "lucide-react";

interface FacilityNavigatorProps {
  language: Language;
  initialFilter?: string;
}

export const FacilityNavigator: React.FC<FacilityNavigatorProps> = ({
  language = "en",
  initialFilter,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // State
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>(initialFilter || "All");
  const [onlyEmergency24x7, setOnlyEmergency24x7] = useState<boolean>(false);
  const [onlyDoctorOnDuty, setOnlyDoctorOnDuty] = useState<boolean>(false);
  const [onlyPmjayEmpaneled, setOnlyPmjayEmpaneled] = useState<boolean>(false);

  // Filter facilities
  const filteredFacilities = SAMPLE_FACILITIES.filter((f) => {
    const matchesType = selectedType === "All" || f.type.toLowerCase().includes(selectedType.toLowerCase());
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          f.activeDoctorSpecialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          f.diagnosticFacilities.some(d => d.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesEmergency = !onlyEmergency24x7 || f.emergencyAvailable24x7;
    const matchesDoctor = !onlyDoctorOnDuty || f.doctorOnDuty;
    const matchesPmjay = !onlyPmjayEmpaneled || f.pmjayEmpaneled;

    return matchesType && matchesSearch && matchesEmergency && matchesDoctor && matchesPmjay;
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
                {t.facilityFinderTitle}
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Real-time directory of verified Sub-Centres, PHCs, CHCs, District Hospitals, and PM-JAY empaneled centers. Check on-duty doctors, live bed/oxygen availability, and verified fresh timestamps.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Live Freshness Timestamp
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-6 flex items-center space-x-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search facility name, doctor specialty, X-Ray, CT Scan, district..."
                className="w-full text-xs text-slate-900 bg-transparent focus:outline-none"
              />
            </div>

            {/* Type Dropdown */}
            <div className="sm:col-span-6">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="All">All Care Levels (PHC, CHC, District, Private)</option>
                <option value="PHC">Primary Health Centre (PHC)</option>
                <option value="CHC">Community Health Centre (CHC)</option>
                <option value="Sub-District">Sub-District / Sub-Divisional Hospital</option>
                <option value="Medical College">Medical College & Hospital</option>
                <option value="Empaneled">PM-JAY Empaneled Private / Trust</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Checkboxes */}
          <div className="flex flex-wrap gap-2 text-xs">
            <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyEmergency24x7}
                onChange={(e) => setOnlyEmergency24x7(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-800">🚨 24x7 Emergency Dept</span>
            </label>

            <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyDoctorOnDuty}
                onChange={(e) => setOnlyDoctorOnDuty(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-800">🩺 Doctor On Duty Right Now</span>
            </label>

            <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyPmjayEmpaneled}
                onChange={(e) => setOnlyPmjayEmpaneled(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-semibold text-slate-800">🛡️ PM-JAY / Swasthya Sathi Empaneled</span>
            </label>
          </div>
        </div>
      </div>

      {/* Facilities Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFacilities.map((fac) => (
          <div
            key={fac.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              {/* Top Row: Name, Type & Freshness Badge */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {fac.type}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      • {fac.distanceKm} km away
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{fac.name}</h3>
                  <div className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{fac.address}, {fac.district}</span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="inline-block text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                    🟢 Verified {fac.verifiedMinutesAgo}m ago
                  </span>
                </div>
              </div>

              {/* Status Chips: Doctor on duty, PMJAY, 24x7 */}
              <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
                {fac.doctorOnDuty && (
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-md flex items-center space-x-1">
                    <Stethoscope className="w-3 h-3" />
                    <span>Doctor Available</span>
                  </span>
                )}
                {fac.emergencyAvailable24x7 && (
                  <span className="bg-red-50 text-red-800 border border-red-200 font-semibold px-2 py-0.5 rounded-md flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-red-600" />
                    <span>24x7 Emergency</span>
                  </span>
                )}
                {fac.pmjayEmpaneled && (
                  <span className="bg-blue-50 text-blue-800 border border-blue-200 font-semibold px-2 py-0.5 rounded-md flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    <span>PM-JAY Cashless</span>
                  </span>
                )}
              </div>

              {/* Doctor Specialties */}
              <div className="mt-3 text-xs">
                <span className="font-bold text-slate-700 block mb-1">Active Specialties:</span>
                <div className="flex flex-wrap gap-1">
                  {fac.activeDoctorSpecialties.map((s, i) => (
                    <span key={i} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Live Bed Count */}
              {fac.availableBeds.general > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">General Beds:</span>
                    <span className="font-bold text-slate-800">{fac.availableBeds.general}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">ICU Beds:</span>
                    <span className={`font-bold ${fac.availableBeds.icu > 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {fac.availableBeds.icu}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[10px] text-slate-400 block">Oxygen Beds:</span>
                    <span className="font-bold text-blue-700">{fac.availableBeds.oxygen}</span>
                  </div>
                </div>
              )}

              {/* Diagnostics & OPD Timings */}
              <div className="mt-3 text-xs text-slate-600 space-y-1">
                <div><strong>Diagnostics:</strong> {fac.diagnosticFacilities.join(", ")}</div>
                <div><strong>OPD Timings:</strong> {fac.opdTimings}</div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <a
                href={`tel:${fac.phone}`}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition shadow-sm"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call {fac.phone}</span>
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fac.name + " " + fac.district)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3 py-2 rounded-xl text-xs transition"
              >
                <span>Navigate (Maps)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
