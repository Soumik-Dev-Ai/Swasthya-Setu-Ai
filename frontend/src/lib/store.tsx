import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, interpolate, type Lang } from "./i18n";

export interface Financials {
  income: number;
  housing: number;
  food: number;
  transport: number;
  school: number;
  emi: number;
  insurancePrem: number;
  other: number;
}

export interface InsuranceRecord {
  providerId: string;
  plan: string;
  type: string;
  coverage: number;
  policyNo: string;
}

export interface CriticalCase {
  id: string;
  name: string;
  age: string;
  sex: string;
  cityId: string;
  symptoms: string;
  conditions: string[];
  level: number;
  assessedAt: number;
  status: "pending" | "accepted";
}

export interface CommunityPatient {
  id: string;
  name: string;
  age: string;
  village: string;
  phone: string;
  notes: string;
  at: number;
}

interface StoreShape {
  lang: Lang;
  setLang: (l: Lang) => void;
  online: boolean;
  setOnline: (v: boolean) => void;
  ashaMode: boolean;
  setAshaMode: (v: boolean) => void;
  ashaUser: { id: string; name: string; area: string } | null;
  setAshaUser: (u: { id: string; name: string; area: string } | null) => void;
  financials: Financials | null;
  setFinancials: (f: Financials | null) => void;
  insurance: InsuranceRecord | null;
  setInsurance: (r: InsuranceRecord | null) => void;
  criticalCases: CriticalCase[];
  addCriticalCase: (c: Omit<CriticalCase, "id" | "assessedAt" | "status">) => void;
  hydrateCriticalCases: (cases: CriticalCase[]) => void;
  setCaseStatus: (id: string, status: "pending" | "accepted") => void;
  patients: CommunityPatient[];
  addPatient: (p: Omit<CommunityPatient, "id" | "at">) => void;
  savedSchemes: string[];
  toggleScheme: (id: string) => void;
  lastTriage: { symptoms: string; level: number } | null;
  setLastTriage: (t: { symptoms: string; level: number } | null) => void;
}

const StoreContext = createContext<StoreShape | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem("ssai_" + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem("ssai_" + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — state stays in memory */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => load<Lang>("lang", "en"));
  const [online, setOnline] = useState(() => load<boolean>("online", false));
  const [ashaMode, setAshaMode] = useState(false);
  const [ashaUser, setAshaUserState] = useState<StoreShape["ashaUser"]>(() =>
    load<StoreShape["ashaUser"]>("ashauser", null)
  );
  const [financials, setFinancialsState] = useState<Financials | null>(() =>
    load<Financials | null>("financials", null)
  );
  const [insurance, setInsuranceState] = useState<InsuranceRecord | null>(() =>
    load<InsuranceRecord | null>("insurance", null)
  );
  const [criticalCases, setCriticalCases] = useState<CriticalCase[]>(() =>
    load<CriticalCase[]>("critical", [])
  );
  const [patients, setPatients] = useState<CommunityPatient[]>(() => load<CommunityPatient[]>("patients", []));
  const [savedSchemes, setSavedSchemes] = useState<string[]>(() => load<string[]>("schemes", []));
  const [lastTriage, setLastTriageState] = useState<StoreShape["lastTriage"]>(() =>
    load<StoreShape["lastTriage"]>("lasttriage", null)
  );

  useEffect(() => save("lang", lang), [lang]);
  useEffect(() => save("online", online), [online]);
  useEffect(() => save("ashauser", ashaUser), [ashaUser]);
  useEffect(() => save("financials", financials), [financials]);
  useEffect(() => save("insurance", insurance), [insurance]);
  useEffect(() => save("critical", criticalCases), [criticalCases]);
  useEffect(() => save("patients", patients), [patients]);
  useEffect(() => save("schemes", savedSchemes), [savedSchemes]);
  useEffect(() => save("lasttriage", lastTriage), [lastTriage]);

  const value: StoreShape = {
    lang,
    setLang: setLangState,
    online,
    setOnline,
    ashaMode,
    setAshaMode,
    ashaUser,
    setAshaUser: setAshaUserState,
    financials,
    setFinancials: setFinancialsState,
    insurance,
    setInsurance: setInsuranceState,
    criticalCases,
    addCriticalCase: (c) =>
      setCriticalCases((prev) => [
        { ...c, id: "c-" + Date.now().toString(36), assessedAt: Date.now(), status: "pending" as const },
        ...prev,
      ].slice(0, 6)),
    hydrateCriticalCases: (cases) =>
      setCriticalCases((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        const merged = [...prev];
        for (const c of cases) {
          if (!existing.has(c.id)) merged.push(c);
        }
        return merged.slice(0, 6);
      }),
    setCaseStatus: (id, status) =>
      setCriticalCases((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c))),
    patients,
    addPatient: (p) =>
      setPatients((prev) => [{ ...p, id: "p-" + Date.now().toString(36), at: Date.now() }, ...prev].slice(0, 12)),
    savedSchemes,
    toggleScheme: (id) =>
      setSavedSchemes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])),
    lastTriage,
    setLastTriage: setLastTriageState,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreShape {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useT() {
  const { lang } = useStore();
  return (key: string, vars?: Record<string, string | number>) => {
    const text = translate(lang, key);
    return vars ? interpolate(text, vars) : text;
  };
}
