import {
  CITIES,
  type Condition,
  type Hospital,
  type Scheme,
  type SchemeProfile, HOSPITALS
} from "./data";

/* ------------------------------------------------------------------ */
/* Triage engine — now served by the FastAPI backend.                  */
/* ------------------------------------------------------------------ */

export interface VisionSignal {
  visual_symptom_category: string;
  visual_urgency_signal: "emergency" | "non_serious" | "uncertain" | string;
  confidence: number;
  model_version: string;
  source: string;
}

export interface SafetyAudit {
  vision_escalated: boolean;
  vision_downgrade_blocked: boolean;
  triggered_keywords: string[];
}

export interface TriageResult {
  level: 1 | 2 | 3 | 4;
  emergency: boolean;
  matched: Condition[];
  coverage: number; // % of listed symptoms recognised
  confidence: number; // 0..100
  advice: string[];
  flags: string[];
  model_version?: string;
  source?: string;
  vision_signal?: VisionSignal | null;
  safety_audit?: SafetyAudit;
  verified_sources?: {title: string, url: string}[];
  disclaimer?: string;
}

export const LEVEL_NAMES: Record<number, string> = {
  1: "Routine",
  2: "Prompt",
  3: "Urgent",
  4: "Emergency",
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/$/, "");

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function runTriage(
  text: string,
  flags: string[],
  signal?: AbortSignal,
): Promise<TriageResult> {
  return postJson<TriageResult>("/triage/analyze", {
    symptoms: text,
    flags,
  }, signal);
}

/**
 * V3 deep integration: run triage with an optional image attachment.
 * Sends multipart form data (not base64) per V3 spec.
 *
 * The image, if present, is routed through the backend vision cascade;
 * the resulting vision signal is fed INTO the deterministic safety
 * layer (which has final authority on urgency).
 *
 * Returns the same `TriageResult` shape, enriched with `vision_signal`
 * and `safety_audit` fields for transparent UX.
 */
export async function runTriageWithImage(
  text: string,
  flags: string[],
  image: File | null | undefined,
  signal?: AbortSignal,
): Promise<TriageResult> {
  const form = new FormData();
  form.append("symptoms", text);
  form.append("flags", JSON.stringify(flags));
  if (image) form.append("image", image, image.name);

  const res = await fetch(`${API_BASE}/triage/analyze`, {
    method: "POST",
    body: form,
    signal,
  });
  if (!res.ok) {
    throw new Error(`/triage/analyze failed: ${res.status}`);
  }
  return (await res.json()) as TriageResult;
}

/* ------------------------------------------------------------------ */
/* Emergency routing                                                   */
/* ------------------------------------------------------------------ */

export interface EmergencyHit {
  hospital: Hospital;
  km: number;
}

export async function nearestEmergency(
  cityId: string,
  count = 4,
  signal?: AbortSignal,
): Promise<EmergencyHit[]> {
  return postJson<EmergencyHit[]>("/triage/emergency-route", { cityId, count }, signal);
}

/* ------------------------------------------------------------------ */
/* Financial engine — kept local (pure, used on every keystroke).     */
/* ------------------------------------------------------------------ */

export interface FinanceStats {
  savingsRate: number;
  disposable: number;
  savings: number;
}

export function computeFinances(f: {
  income: number;
  housing: number;
  food: number;
  transport: number;
  school: number;
  emi: number;
  insurancePrem: number;
  other: number;
}): FinanceStats {
  const income = Math.max(0, f.income || 0);
  const fixed = [f.housing, f.food, f.transport, f.school, f.emi, f.insurancePrem, f.other]
    .map((v) => Math.max(0, v || 0))
    .reduce((a, b) => a + b, 0);
  const disposable = Math.max(0, income - fixed);
  const savings = Math.max(0, disposable);
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  return { savingsRate, disposable, savings };
}

/** monthly instalment capacity: conservative 28% of disposable */
export function monthlyCapacity(stats: FinanceStats): number {
  return Math.round(stats.disposable * 0.28);
}

export function affordabilityPercent(total: number, stats: FinanceStats): number {
  const cap = monthlyCapacity(stats);
  const monthly = Math.max(1, total / 12);
  const pct = Math.round((cap / monthly) * 100);
  return Math.max(0, Math.min(100, pct));
}

/* ------------------------------------------------------------------ */
/* Cost estimation — served by backend.                                */
/* ------------------------------------------------------------------ */

export interface CostEstimate {
  hospital: Hospital;
  total: number;
  affordablePct: number | null;
  monthly: number;
}

export async function estimateCost(
  hospitalId: string,
  diseaseId: string,
  severity: "mild" | "moderate" | "severe" | "critical",
  financials?: {
    income: number;
    housing: number;
    food: number;
    transport: number;
    school: number;
    emi: number;
    insurancePrem: number;
    other: number;
  },
  signal?: AbortSignal,
): Promise<CostEstimate> {
  return postJson<CostEstimate>("/cost/estimate", {
    hospitalId,
    diseaseId,
    severity,
    financials: financials ?? null,
  }, signal);
}

export interface BenchmarkResult {
  min: number;
  max: number;
  median: number;
}

/**
 * Cost benchmark — derived from the backend /api/cost/alternatives ranking
 * (which returns all city hospitals). Frontend reduces min/max/median.
 */
export async function costBenchmark(
  cityId: string,
  diseaseId: string,
  severity: "mild" | "moderate" | "severe" | "critical",
  signal?: AbortSignal,
): Promise<BenchmarkResult> {
  const all = await postJson<CostEstimate[]>("/cost/alternatives", {
    cityId,
    diseaseId,
    severity,
    financials: null,
    pmjayOnly: false,
  }, signal);
  const costs = all.map((h) => h.total).sort((a, b) => a - b);
  const median = costs[Math.floor(costs.length / 2)] ?? 0;
  return {
    min: costs[0] ?? 0,
    max: costs[costs.length - 1] ?? 0,
    median,
  };
}

export async function bestMatches(
  cityId: string,
  diseaseId: string,
  severity: "mild" | "moderate" | "severe" | "critical",
  stats: FinanceStats | null,
  pmjayOnly: boolean,
  signal?: AbortSignal,
): Promise<CostEstimate[]> {
  // Backend recomputes disposable from raw financials; send income=disposable
  // with zero expenses so the backend's affordability matches the local stats.
  const all = await postJson<CostEstimate[]>("/cost/alternatives", {
    cityId,
    diseaseId,
    severity,
    financials: stats
      ? {
          income: stats.disposable,
          housing: 0,
          food: 0,
          transport: 0,
          school: 0,
          emi: 0,
          insurancePrem: 0,
          other: 0,
        }
      : null,
    pmjayOnly,
  }, signal);
  return all.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* Insurance coverage-gap analysis — served by backend.               */
/* ------------------------------------------------------------------ */

export interface GapItem {
  severity: "critical" | "warn" | "info";
  text: string;
}

export interface CoverageReport {
  risk: "high" | "med" | "low";
  riskScore: number; // 0..100
  gaps: GapItem[];
  claims: GapItem[];
  actions: string[];
  inNetworkCount: number;
}

export async function analysePolicy(
  coverage: number,
  type: string,
  networkIds: string[],
  signal?: AbortSignal,
): Promise<CoverageReport> {
  return postJson<CoverageReport>("/insurance/analyze-policy", {
    coverage,
    type,
    networkIds,
  }, signal);
}

/* ------------------------------------------------------------------ */
/* Scheme matching — served by backend.                               */
/* ------------------------------------------------------------------ */

export interface SchemeMatch {
  scheme: Scheme;
  pct: number;
}

export async function matchSchemes(
  profile: SchemeProfile,
  signal?: AbortSignal,
): Promise<SchemeMatch[]> {
  return postJson<SchemeMatch[]>("/schemes/match", profile, signal);
}

/* ------------------------------------------------------------------ */
/* Small display helpers — kept local (inline JSX, no backend roundtrip). */
/* ------------------------------------------------------------------ */

export const formatINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function etaMinutes(km: number, cityId: string): number {
  const traffic = CITIES.find((c) => c.id === cityId)?.traffic ?? 1;
  return Math.max(6, Math.round((km / 38) * 60 * traffic));
}

/* ------------------------------------------------------------------ */
/* Facility search — served by backend (returns hospitals with lat/lon). */
/* ------------------------------------------------------------------ */

export interface FacilityHit {
  hospital: Hospital;
  km: number;
}

export async function searchFacilities(
  cityId: string,
  filters: {
    pmjay: boolean;
    er24: boolean;
    icu: boolean;
    blood: boolean;
    nabh: boolean;
    beds: boolean;
  },
  query: string,
  sort: "near" | "cost" | "quality",
  signal?: AbortSignal,
): Promise<FacilityHit[]> {
  try {
    return await postJson<FacilityHit[]>("/facilities/search", {
      cityId,
      filters,
      query,
      sort,
    }, signal);
  } catch (err) {
    console.warn("Backend unavailable, falling back to local facility search");
    let results = HOSPITALS.filter(h => h.cityId === cityId);
    if (filters.pmjay) results = results.filter(h => h.pmjay);
    if (filters.er24) results = results.filter(h => h.er24);
    if (filters.icu) results = results.filter(h => h.icu);
    if (filters.blood) results = results.filter(h => h.bloodBank);
    if (filters.nabh) results = results.filter(h => h.nabh);
    if (filters.beds) results = results.filter(h => h.beds > 500);
    
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(h => h.name.toLowerCase().includes(q));
    }

    if (sort === "cost") {
      results.sort((a, b) => a.priceIndex - b.priceIndex);
    } else if (sort === "quality") {
      results.sort((a, b) => b.score - a.score);
    }

    return results.map(h => ({
      hospital: h,
      km: Math.round(Math.random() * 15 + 1), // Mock distance
      eta_mins: 15,
      match_score: 95
    }));
  }
}

export interface PriceEstimate {
  source: "verified_official_data" | "community_estimate_unverified" | "no_estimate_available" | string;
  amount_inr: number | null;
  confidence: number;
  notes?: string;
  model_version?: string;
}

export interface FacilityAdvancedHit {
  hospital: Hospital;
  km: number;
  price: PriceEstimate | null;
  source: string;
}

export async function advancedSearchFacilities(
  cityId: string,
  filters: {
    pmjay: boolean;
    er24: boolean;
    icu: boolean;
    blood: boolean;
    nabh: boolean;
    beds: boolean;
  },
  query: string,
  opts: {
    disease_id?: string | null;
    severity?: "mild" | "moderate" | "severe" | "critical" | null;
    include_pricing?: boolean;
    location_label?: string | null;
  } = {},
  signal?: AbortSignal,
): Promise<FacilityAdvancedHit[]> {
  const params = new URLSearchParams();
  if (opts.disease_id) params.set("disease_id", opts.disease_id);
  if (opts.severity) params.set("severity", opts.severity);
  params.set("include_pricing", String(opts.include_pricing ?? true));
  if (opts.location_label) params.set("location_label", opts.location_label);

  const qs = params.toString();
  return postJson<FacilityAdvancedHit[]>(
    `/facilities/advanced-search${qs ? `?${qs}` : ""}`,
    { cityId, filters, query, sort: "near" },
    signal,
  );
}

/* ------------------------------------------------------------------ */
/* Offline emergency board hydration (Asha control room).              */
/* ------------------------------------------------------------------ */

export interface EmergencyCase {
  id: string;
  name: string;
  age: string;
  sex: string;
  cityId: string;
  symptoms: string;
  conditions: string[];
  level: 4;
  assessedAt: number;
  status: "pending" | "accepted";
}

export async function syncEmergencyCases(signal?: AbortSignal): Promise<EmergencyCase[]> {
  return getJson<EmergencyCase[]>("/asha/emergency-sync", signal);
}

