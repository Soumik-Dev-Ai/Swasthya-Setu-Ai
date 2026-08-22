import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface EmergencySync {
  patientName: string;
  symptoms: string;
  urgency: "EMERGENCY" | "URGENT";
  assessment: string;
  location: string;
  syncedAt: string;
  source: "AI triage" | "ASHA mock queue";
}

const DEFAULT_EMERGENCY: EmergencySync = {
  patientName: "Mitali Das",
  symptoms: "Crushing chest tightness radiating to the left arm with cold sweating for 45 minutes",
  urgency: "EMERGENCY",
  assessment: "RED · LEVEL 1 — Immediate medical attention",
  location: "Agradwip Gram, Katwa Block",
  syncedAt: "Just now",
  source: "ASHA mock queue",
};

interface EmergencySyncValue {
  emergency: EmergencySync | null;
  syncEmergency: (payload: Omit<EmergencySync, "syncedAt">) => void;
  clearEmergency: () => void;
}

const EmergencySyncContext = createContext<EmergencySyncValue | null>(null);

export function EmergencySyncProvider({ children }: { children: ReactNode }) {
  const [emergency, setEmergency] = useState<EmergencySync | null>(DEFAULT_EMERGENCY);
  const value = useMemo(() => ({
    emergency,
    syncEmergency: (payload: Omit<EmergencySync, "syncedAt">) => setEmergency({ ...payload, syncedAt: "Just now" }),
    clearEmergency: () => setEmergency(null),
  }), [emergency]);
  return <EmergencySyncContext.Provider value={value}>{children}</EmergencySyncContext.Provider>;
}

export function useEmergencySync() {
  const value = useContext(EmergencySyncContext);
  if (!value) throw new Error("useEmergencySync must be used inside EmergencySyncProvider");
  return value;
}
