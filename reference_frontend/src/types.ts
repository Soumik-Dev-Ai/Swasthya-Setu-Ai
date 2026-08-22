export type Language = "en" | "hi" | "bn";

export type UrgencyLevel = "EMERGENCY" | "URGENT" | "SOON" | "ROUTINE" | "INSUFFICIENT_INFO";

export type Role = "patient" | "asha_worker" | "doctor" | "sih_presentation";
export type UserRole = "citizen" | "asha_worker" | "doctor" | "sih_presentation";

export interface TriageResult {
  urgency: UrgencyLevel;
  urgencyDescription: string;
  redFlagsDetected: string[];
  isEmergency: boolean;
  possibleCategories: {
    name: string;
    likelihood: "High" | "Medium" | "Low";
    description: string;
  }[];
  recommendedCareLevel: string;
  teleconsultationFeasible: boolean;
  clinicalQuestionsToAsk: string[];
  homeCareGuidance: string;
  warningSignsToWatch: string[];
  doctorBrief: string;
  disclaimer: string;
}

export interface FinancialProfile {
  monthlyIncome: number;
  familyMembers: number;
  elderlyCount: number;
  childrenCount: number;
  essentialMonthlyExpenses: number;
  monthlyDebtObligations: number;
  hasBPLCard: boolean;
  hasAyushmanCard: boolean;
  hasStateCard: boolean;
  stateCardName?: string;
  residenceType: "rural" | "semi_urban" | "urban_metro";
  existingInsuranceType: "none" | "pmjay" | "state_scheme" | "retail_individual" | "corporate_gmc";
  existingSumInsured: number;
}

export interface PolicyAnalysis {
  insurer: string;
  planName: string;
  sumInsured: number;
  roomRentCap: string;
  coPayment: string;
  waitingPeriods: {
    initial: string;
    specificDiseases: string;
    preExisting: string;
  };
  coveredFeatures: string[];
  exclusions: string[];
  coverageGaps: string[];
  claimGuidance: string;
}

export interface GovernmentScheme {
  id: string;
  name: string;
  state: string;
  coverageAmount: string;
  beneficiaryTarget: string;
  eligibilityCriteria: string[];
  documentsRequired: string[];
  cashlessNetwork: string;
  officialPortal: string;
  abhaIntegration: boolean;
  tags: string[];
}

export interface HealthcareFacility {
  id: string;
  name: string;
  type: "Sub-Centre" | "PHC" | "CHC" | "Sub-District Hospital" | "District Hospital" | "Empaneled Private" | "Charitable Trust" | "Medical College";
  district: string;
  state: string;
  distanceKm: number;
  address: string;
  phone: string;
  verifiedMinutesAgo: number;
  emergencyAvailable24x7: boolean;
  doctorOnDuty: boolean;
  activeDoctorSpecialties: string[];
  pmjayEmpaneled: boolean;
  stateSchemeEmpaneled: boolean;
  availableBeds: {
    general: number;
    icu: number;
    oxygen: number;
  };
  diagnosticFacilities: string[];
  medicineStockStatus: "Adequate" | "Moderate" | "Limited";
  opdTimings: string;
  rating: number;
  latitude: number;
  longitude: number;
}

export interface CostCalculationResult {
  procedureName: string;
  category: string;
  avgStayDays: number;
  estimatedGrossCost: number;
  breakdown: {
    bedCharges: number;
    surgeonFee: number;
    otAndAnesthesia: number;
    medicinesAndConsumables: number;
    labDiagnostics: number;
  };
  deductions: {
    pmjayCoverage: number;
    insuranceClaimPayout: number;
    nonPayableConsumables: number;
    roomRentProportionateDeduction: number;
    coPayAmount: number;
  };
  patientResponsibility: number;
  savingsAmount: number;
  financialAdvice: string;
}

export interface PatientRecord {
  id: string;
  createdAt: string;
  patientName: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  villageOrCity: string;
  phone?: string;
  symptoms: string;
  vitals?: {
    bpSystolic?: number;
    bpDiastolic?: number;
    spO2?: number;
    pulse?: number;
    tempF?: number;
    bloodSugar?: number;
  };
  triageResult?: TriageResult;
  assignedFacility?: string;
  status: "Registered" | "Triaged" | "Referred" | "Attended" | "FollowUpRequired";
  healthWorkerNotes?: string;
  offlineSaved?: boolean;
}
