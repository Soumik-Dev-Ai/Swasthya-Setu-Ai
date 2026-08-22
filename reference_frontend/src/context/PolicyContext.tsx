import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface PolicyProfile {
  provider: string;
  planName: string;
  insuranceType: string;
  sumInsured: number;
  policyNumber: string;
}

export const DEFAULT_POLICY_PROFILE: PolicyProfile = {
  provider: "National Health Protect",
  planName: "Family Secure Plus",
  insuranceType: "Retail family floater",
  sumInsured: 500000,
  policyNumber: "",
};

interface PolicyContextValue {
  policy: PolicyProfile;
  setPolicy: (policy: PolicyProfile) => void;
  updatePolicy: (patch: Partial<PolicyProfile>) => void;
  hasPolicy: boolean;
}

const PolicyContext = createContext<PolicyContextValue | null>(null);

export function PolicyProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<PolicyProfile>(DEFAULT_POLICY_PROFILE);
  const value = useMemo(() => ({
    policy,
    setPolicy,
    updatePolicy: (patch: Partial<PolicyProfile>) => setPolicy((current) => ({ ...current, ...patch })),
    hasPolicy: Boolean(policy.provider && policy.planName),
  }), [policy]);
  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}

export function usePolicy() {
  const value = useContext(PolicyContext);
  if (!value) throw new Error("usePolicy must be used inside PolicyProvider");
  return value;
}
