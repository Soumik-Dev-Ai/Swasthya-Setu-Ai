/* ------------------------------------------------------------------ */
/* Single source of truth for all backend communication.               */
/* Shapes mirror backend/app/schemas/* exactly (not the old mock).     */
/* ------------------------------------------------------------------ */

const _env = (import.meta as unknown as { env?: Record<string, string> }).env;
const BASE = (_env && _env.VITE_API_URL) || "http://127.0.0.1:8000/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/* Optional auto-refresh hook (registered by the auth store).           */
/* On a 401, request() calls this once; if it returns a fresh token,    */
/* the original call is retried.                                        */
let refreshHandler: (() => Promise<string | null>) | null = null;
export function setRefreshHandler(fn: (() => Promise<string | null>) | null) {
  refreshHandler = fn;
}

/* doc 27 item 5 — deduplicate concurrent refreshes: a burst of 401s that
 * all fire at the same moment share ONE in-flight refresh promise, so the
 * token endpoint is only hit once (refresh tokens rotate — parallel calls
 * would race each other's token invalidation).                          */
let _refreshInflight: Promise<string | null> | null = null;
function refreshOnce(): Promise<string | null> {
  if (!_refreshInflight) {
    _refreshInflight = (refreshHandler ? refreshHandler() : Promise.resolve(null)).finally(
      () => { _refreshInflight = null; },
    );
  }
  return _refreshInflight;
}

type HeaderMap = Record<string, string>;

async function parseError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const detail =
    (body && (body.detail || body.error?.message)) || res.statusText || "Request failed";
  return new ApiError(res.status, typeof detail === "string" ? detail : "Request failed");
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
  auth?: string | null,
  _retried = false,
): Promise<T> {
  const headers: HeaderMap = {
    ...(opts.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
  };
  if (opts.headers) {
    new Headers(opts.headers).forEach((v, k) => {
      headers[k] = v;
    });
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });

  // Auto-refresh on 401 for authenticated calls (docs/25 §1 refresh flow).
  if (res.status === 401 && auth && refreshHandler && !_retried) {
    const fresh = await refreshOnce();
    if (fresh) {
      return request<T>(path, opts, fresh, true);
    }
  }
  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function get<T>(path: string, auth?: string | null): Promise<T> {
  return request<T>(path, { method: "GET" }, auth);
}
function post<T>(path: string, body: unknown, auth?: string | null): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) }, auth);
}
function patch<T>(path: string, body: unknown, auth?: string | null): Promise<T> {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, auth);
}
function upload<T>(path: string, formData: FormData, auth?: string | null): Promise<T> {
  return request<T>(path, { method: "POST", body: formData }, auth);
}

/* ==================================================================== */
/* Types                                                                */
/* ==================================================================== */

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
  refresh_token?: string | null;
}

export interface TriageCondition {
  id: string;
  nameKey: string;
  level: number;
  keywords: string[];
  adviceKey: string;
}
export interface ReasoningResult {
  severity_signal: string;
  finding_category: string;
  confidence: number;
  reason: string;
  grounding_reference: string | null;
  grounding_verified: boolean;
  model_version: string;
  source: string;
}
export interface VisionSignal {
  visual_symptom_category: string;
  visual_urgency_signal: string;
  confidence: number;
  model_version: string;
  source: string;
  grounding_reference?: string | null;
  grounding_verified?: boolean;
  reason?: string;
}
export interface TriageResult {
  level: number;
  emergency: boolean;
  matched: TriageCondition[];
  coverage: number;
  confidence: number;
  advice: string[];
  flags: string[];
  model_version?: string;
  source?: string;
  vision_signal?: VisionSignal | null;
  safety_audit?: { vision_escalated: boolean; vision_downgrade_blocked: boolean; triggered_keywords: string[] };
  reasoning?: ReasoningResult | null;
  verified_sources?: { title?: string; url?: string }[];
  disclaimer?: string;
}

export interface CostEstimate {
  hospital: Record<string, unknown>;
  total: number;
  affordablePct?: number | null;
  monthly: number;
  as_of?: string | null;
  verified_sources?: unknown[];
  disclaimer?: string;
}

export interface Financials {
  income?: number;
  housing?: number;
  food?: number;
  transport?: number;
  school?: number;
  emi?: number;
  insurancePrem?: number;
  other?: number;
}

export interface GapItem { severity: "critical" | "warn" | "info"; text: string }
export interface CoverageReport {
  risk: "high" | "med" | "low";
  riskScore: number;
  gaps: GapItem[];
  claims: GapItem[];
  actions: string[];
  inNetworkCount: number;
  verified_sources?: unknown[];
  disclaimer?: string;
}

export interface SchemePublic {
  id: string;
  name: string;
  short: string;
  type: string;
  benefit: string;
  docs: string;
  enrollment_method: "self_service_portal" | "facility_based" | "csc_based" | "unknown";
  registration_portal_url?: string | null;
  /* Phase-2 2C marker: SQL-only schemes carry general eligibility info,
   * NOT a computed match — the UI must render them without a "% matched" badge. */
  match_basis?: string;
}
export interface SchemeMatch { scheme: SchemePublic; pct: number }
export interface SchemeProfile {
  state: string;
  income: number;
  category: string;
  work: string;
  need: string;
}

export interface FacilityHit {
  hospital: {
    id: string; name: string; cityId: string; lat: number; lon: number;
    tier?: string; beds?: number; er24?: boolean; icu?: boolean;
    bloodBank?: boolean; nabh?: boolean; pmjay?: boolean;
    priceIndex?: number; score?: number;
  };
  km: number;
  last_verified_date?: string | null;
  directions_url?: string | null;
}

export interface AshaWorkerPublic {
  id: number;
  full_name: string;
  village_ward: string;
  block_tehsil: string;
  district: string;
  state: string;
  specialities: string[];
  phone_masked: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AshaRegistration {
  username: string;
  password: string;
  full_name: string;
  date_of_birth: string;
  phone: string;
  aadhaar_last4: string;
  village_ward: string;
  block_tehsil?: string;
  district: string;
  state: string;
  nearest_facility_id?: number | null;
  specialities?: string[];
}

export interface PatientOut {
  id: string;
  demographic_hash: string;
  display_name?: string | null;
  age_band?: string | null;
  risk_flags: Record<string, unknown>;
  created_at: string;
}
export interface PatientCreate {
  demographic_hash: string;
  display_name?: string | null;
  age_band?: string | null;
  risk_flags?: Record<string, unknown>;
}
export interface PatientTimeline {
  patient: PatientOut;
  events: unknown[];
}

export interface ReferralCreate {
  patient_id: string;
  from_facility_id: number;
  to_facility_id: number;
  urgency_tier: "L1" | "L2" | "L3" | "L4";
  client_created_at?: string | null;
}
export interface ReferralOut {
  id: string;
  patient_id: string;
  from_facility_id?: number | null;
  to_facility_id?: number | null;
  urgency_tier: string;
  status: string;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUpOut { id: string; patient_id: string; reason: string; due_date: string; resolved: boolean }

export interface AshaRecordCreate {
  record_type: string;
  structured_fields: Record<string, unknown>;
  device_local_id: string;
  created_at?: string | null;
}
export interface AshaRecordOut {
  id: number;
  worker_id: number;
  record_type: string;
  structured_fields: Record<string, unknown>;
  created_at: string;
  synced_at: string;
  device_local_id: string;
}
export interface OcrResponse {
  record_type: string;
  extracted_fields: Record<string, unknown>;
  confidence: number;
}
export interface SyncResponse {
  received_records: number;
  upserted_records: number;
  received_triage: number;
  upserted_triage: number;
  duplicates_ignored: number;
}

export interface CapacityCreate {
  facility_id: number;
  diagnostic_capacity?: Record<string, unknown>;
  medicine_stock?: Record<string, unknown>;
  source?: string | null;
}
export interface CapacityOut {
  id: string;
  facility_id: number;
  diagnostic_capacity: Record<string, unknown>;
  medicine_stock: Record<string, unknown>;
  snapshot_taken_at: string;
  source?: string | null;
}

export interface UserPublic { id: number; username: string; role: string }

export interface AdminAnalytics {
  triage_total: number;
  triage_by_tier: Record<string, number>;
  asha_records_total: number;
  asha_records_by_type: Record<string, number>;
}
export interface DistrictDashboard {
  district_id?: string | null;
  triage_volume_by_tier: Record<string, number>;
  referral_completion_rate: number;
  follow_up_backlog: number;
  facility_load: Record<string, number>;
  generated_at: string;
}

export interface EmergencyCaseOut {
  id: string; name: string; age: string; sex: string; cityId: string;
  symptoms: string; conditions: string[]; level: 4; assessedAt: number;
  status: "pending" | "accepted"; synthetic: boolean;
}

export interface RoutingRecommendation {
  facility_id: number; name: string; type: string; pm_jay_empaneled: boolean;
  lat: number; lng: number; district: string; state: string;
  distance_km: number; recommended_scheme_ids: number[];
  cost: { base_cost: number; subsidized_cost: number; estimated_oop_expenditure: number };
}
export interface RoutingResponse { recommendations: RoutingRecommendation[]; nearest_center_km?: number | null }

/* ==================================================================== */
/* Auth                                                                 */
/* ==================================================================== */

export const login = (username: string, password: string) =>
  post<TokenResponse>("/auth/login", { username, password });

export const refreshToken = (refresh_token: string) =>
  post<TokenResponse>("/auth/refresh", { refresh_token });

export const registerAsha = (data: AshaRegistration) =>
  post<{ status: string; message: string; username: string }>("/auth/register-asha", data);

/* ==================================================================== */
/* Triage                                                               */
/* ==================================================================== */

export const analyzeTriage = (symptoms: string, flags: string[], image?: File, age?: string) => {
  const fd = new FormData();
  fd.append("symptoms", symptoms);
  fd.append("flags", JSON.stringify(flags));
  // Phase 3 item 3B: the UI's 0/1/2 age index is mapped to a string before
  // this point — the backend's TriageAnalyzeRequest.age is `str | None`.
  if (age) fd.append("age", age);
  if (image) fd.append("image", image);
  return upload<TriageResult>("/triage/analyze", fd);
};

/* doc 27 item 2 — text-only triage uses the JSON body so it can request the
 * grounded Reasoning Engine (opt-in `reasoning: true`) alongside the
 * deterministic result, in one call.                                    */
export const analyzeTriageText = (symptoms: string, flags: string[], reasoning = true, age?: string) =>
  post<TriageResult>("/triage/analyze", { symptoms, flags, reasoning, age: age || undefined });

export const getEmergencyRoute = (cityId: string, count = 4) =>
  post<{ hospital: Record<string, unknown>; km: number }[]>("/triage/emergency-route", { cityId, count });

export const getEmergencySync = () => get<EmergencyCaseOut[]>("/asha/emergency-sync");

/* ==================================================================== */
/* Reference metadata (doc 27 item 4) — served, not hardcoded            */
/* ==================================================================== */

export interface DiseaseRef { id: string; name: string; pmjay: boolean }
export interface CityRef { id: string; name: string; lat: number; lon: number }

export const getDiseases = () => get<DiseaseRef[]>("/meta/diseases");
export const getCities = () => get<CityRef[]>("/meta/cities");

/* ==================================================================== */
/* Cost                                                                 */
/* ==================================================================== */

export const estimateCost = (hospitalId: string, diseaseId: string, severity: string, financials?: Financials | null) =>
  post<CostEstimate>("/cost/estimate", { hospitalId, diseaseId, severity, financials: financials ?? null });

export const costAlternatives = (cityId: string, diseaseId: string, severity: string, financials?: Financials | null, pmjayOnly = false) =>
  post<CostEstimate[]>("/cost/alternatives", { cityId, diseaseId, severity, financials: financials ?? null, pmjayOnly });

/* ==================================================================== */
/* Insurance                                                            */
/* ==================================================================== */

export const analyzePolicy = (coverage: number, type: "ind" | "fam", networkIds: string[]) =>
  post<CoverageReport>("/insurance/analyze-policy", { coverage, type, networkIds });

export const matchSchemes = (profile: SchemeProfile) =>
  post<SchemeMatch[]>("/schemes/match", profile);

/* ==================================================================== */
/* Facilities / routing                                                 */
/* ==================================================================== */

export interface FacilityFilters {
  pmjay: boolean; er24: boolean; icu: boolean; blood: boolean; nabh: boolean; beds: boolean;
}
export const searchFacilities = (cityId: string, filters: FacilityFilters, query: string, sort: "near" | "cost" | "quality") =>
  post<FacilityHit[]>("/facilities/search", { cityId, filters, query, sort });

export const advancedSearch = (
  cityId: string, filters: FacilityFilters, query: string,
  opts: { diseaseId?: string; severity?: string; includePricing?: boolean; locationLabel?: string } = {},
) => {
  const params = new URLSearchParams();
  if (opts.diseaseId) params.set("disease_id", opts.diseaseId);
  if (opts.severity) params.set("severity", opts.severity);
  if (opts.includePricing !== undefined) params.set("include_pricing", String(opts.includePricing));
  if (opts.locationLabel) params.set("location_label", opts.locationLabel);
  const qs = params.toString();
  return post<FacilityAdvanced[]>(`/facilities/advanced-search${qs ? `?${qs}` : ""}`, { cityId, filters, query });
};

export interface FacilityAdvanced {
  hospital: FacilityHit["hospital"];
  km: number;
  price: { source: "verified_official_data" | "community_estimate_unverified" | "no_estimate_available"; amount_inr: number | null; confidence: number; notes: string; model_version: string } | null;
  source: string;
  last_verified_date?: string | null;
  directions_url?: string | null;
}

export const recommendRoute = (lat: number, lng: number, urgencyTier: string) =>
  post<RoutingResponse>("/routing/recommend", { urgency_tier: urgencyTier, location: { lat, lng } });

/* ==================================================================== */
/* ASHA discovery / care                                               */
/* ==================================================================== */

export const getAshaWorkers = (district?: string, state?: string, limit = 20) => {
  const params = new URLSearchParams();
  if (district) params.set("district", district);
  if (state) params.set("state", state);
  params.set("limit", String(limit));
  return get<AshaWorkerPublic[]>(`/v2/asha-workers/nearby?${params}`);
};

export const createPatient = (data: PatientCreate, token: string) =>
  post<PatientOut>("/v3/patients", data, token);
export const getPatientTimeline = (patientId: string, token: string) =>
  get<PatientTimeline>(`/v3/patients/${patientId}/timeline`, token);

export const createReferral = (data: ReferralCreate, token: string, idempotencyKey?: string) =>
  request<ReferralOut>(
    "/v3/referrals",
    { method: "POST", body: JSON.stringify(data), headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {} },
    token,
  );
export const updateReferral = (id: string, status: string, token: string) =>
  patch<ReferralOut>(`/v3/referrals/${id}`, { status }, token);

export const getFollowups = (token: string) => get<FollowUpOut[]>("/v3/followups", token);
export const completeFollowup = (id: string, token: string) =>
  patch<FollowUpOut>(`/v3/followups/${id}`, {}, token);
export const runFollowupScheduler = (token: string) =>
  post<{ created: number }>("/v3/followups/run", {}, token);

export const uploadForm = (file: File, token: string) => {
  const fd = new FormData();
  fd.append("file", file);
  return upload<OcrResponse>("/asha/upload-form", fd, token);
};
export const saveRecord = (data: AshaRecordCreate, token: string) =>
  post<AshaRecordOut>("/asha/records", data, token);
export const listRecords = (token: string) =>
  get<AshaRecordOut[]>("/asha/records", token);

export const syncBatch = (workerId: number, ashRecords: AshaRecordCreate[], triageSessions: unknown[], token: string) =>
  post<SyncResponse>("/sync/batch", { worker_id: workerId, ash_records: ashRecords, triage_sessions: triageSessions }, token);

export const reportCapacity = (data: CapacityCreate, token: string) =>
  post<CapacityOut>("/v3/facilities/capacity", data, token);
export const getCapacity = (facilityId?: number, token?: string | null) => {
  const q = facilityId ? `?facility_id=${facilityId}` : "";
  return get<CapacityOut[]>(`/v3/facilities/capacity${q}`, token);
};

/* ==================================================================== */
/* Admin                                                                */
/* ==================================================================== */

export const getAdminAnalytics = (token: string) => get<AdminAnalytics>("/admin/analytics", token);
export const getDistrictDashboard = (token: string, districtId?: string) => {
  const q = districtId ? `?district_id=${districtId}` : "";
  return get<DistrictDashboard>(`/v3/dashboard/district${q}`, token);
};
export const getPendingAshaUsers = (token: string) => get<UserPublic[]>("/admin/users/pending", token);
export const activateAshaUser = (userId: number, token: string) =>
  patch<UserPublic>(`/admin/users/${userId}/activate`, {}, token);