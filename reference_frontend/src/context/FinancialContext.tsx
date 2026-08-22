import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { FinancialProfile } from "../types";

export const DEFAULT_FINANCIAL_PROFILE: FinancialProfile = {
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

interface FinancialContextValue {
  profile: FinancialProfile;
  setProfile: (profile: FinancialProfile) => void;
  updateProfile: (patch: Partial<FinancialProfile>) => void;
  hasFinancials: boolean;
  disposableIncome: number;
  savingsRate: number;
}

const FinancialContext = createContext<FinancialContextValue | null>(null);

export function FinancialProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<FinancialProfile>(DEFAULT_FINANCIAL_PROFILE);
  const value = useMemo<FinancialContextValue>(() => {
    const disposableIncome = Math.max(0, profile.monthlyIncome - profile.essentialMonthlyExpenses - profile.monthlyDebtObligations);
    const savingsRate = profile.monthlyIncome > 0 ? Math.min(100, Math.round((disposableIncome / profile.monthlyIncome) * 100)) : 0;
    return {
      profile,
      setProfile,
      updateProfile: (patch) => setProfile((current) => ({ ...current, ...patch })),
      hasFinancials: profile.monthlyIncome > 0 && profile.essentialMonthlyExpenses > 0,
      disposableIncome,
      savingsRate,
    };
  }, [profile]);

  return <FinancialContext.Provider value={value}>{children}</FinancialContext.Provider>;
}

export function useFinancial() {
  const value = useContext(FinancialContext);
  if (!value) throw new Error("useFinancial must be used inside FinancialProvider");
  return value;
}
