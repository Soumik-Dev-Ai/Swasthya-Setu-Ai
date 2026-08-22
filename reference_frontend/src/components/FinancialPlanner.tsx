import React, { useState } from "react";
import { Language, FinancialProfile } from "../types";
import { TRANSLATIONS } from "../utils/translations";
import { 
  Wallet, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Users, 
  Home, 
  CreditCard, 
  HeartHandshake,
  FileCheck,
  Building
} from "lucide-react";

interface FinancialPlannerProps {
  language: Language;
  onNavigateToSchemes: () => void;
  onNavigateToInsurance: () => void;
  onNavigateToCost: () => void;
  onUpdateProfile?: (profile: FinancialProfile) => void;
}

export const FinancialPlanner: React.FC<FinancialPlannerProps> = ({
  language = "en",
  onNavigateToSchemes,
  onNavigateToInsurance,
  onNavigateToCost,
  onUpdateProfile,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // State
  const [monthlyIncome, setMonthlyIncome] = useState<number>(24000);
  const [familyMembers, setFamilyMembers] = useState<number>(4);
  const [elderlyCount, setElderlyCount] = useState<number>(1);
  const [childrenCount, setChildrenCount] = useState<number>(2);
  const [essentialExpenses, setEssentialExpenses] = useState<number>(16000);
  const [debtPayments, setDebtPayments] = useState<number>(3000);
  const [residenceType, setResidenceType] = useState<"rural" | "semi_urban" | "urban_metro">("semi_urban");
  const [hasBPLCard, setHasBPLCard] = useState<boolean>(true);
  const [hasAyushmanCard, setHasAyushmanCard] = useState<boolean>(false);
  const [hasStateCard, setHasStateCard] = useState<boolean>(true);
  const [existingInsurance, setExistingInsurance] = useState<"none" | "pmjay" | "state_scheme" | "retail_individual" | "corporate_gmc">("state_scheme");
  const [existingSumInsured, setExistingSumInsured] = useState<number>(500000);

  // Financial calculations
  const annualIncome = monthlyIncome * 12;
  const totalOutflows = essentialExpenses + debtPayments;
  const disposableMonthlyIncome = Math.max(0, monthlyIncome - totalOutflows);
  const savingsRate = monthlyIncome > 0 ? Math.round((disposableMonthlyIncome / monthlyIncome) * 100) : 0;

  // Affordability Tiers Calculation
  let tier: "very_tight" | "basic" | "moderate" | "higher" = "basic";
  let tierTitle = "Basic Protection Budget";
  let tierDescription = "Eligible for state-backed universal coverage and low-cost micro-health plans.";
  let maxAffordableAnnualPremium = 0;

  if (monthlyIncome <= 15000 || hasBPLCard) {
    tier = "very_tight";
    tierTitle = "Priority Public Health Protection (Very Tight Budget)";
    tierDescription = "Primary reliance on 100% Free Government Public System (PHC/CHC/District Hospital), PM-JAY & State Schemes with Jan Aushadhi generic medicines.";
    maxAffordableAnnualPremium = Math.round(disposableMonthlyIncome * 0.2 * 12);
  } else if (monthlyIncome <= 35000) {
    tier = "basic";
    tierTitle = "Basic Protection & Scheme Hybrid";
    tierDescription = "Optimum combination of Government Health Scheme (PM-JAY/State) plus affordable entry-level Arogya Sanjeevani / Employer GMC.";
    maxAffordableAnnualPremium = Math.round(disposableMonthlyIncome * 0.35 * 12);
  } else if (monthlyIncome <= 75000) {
    tier = "moderate";
    tierTitle = "Moderate Family Protection Capacity";
    tierDescription = "Capacity for ₹5 Lakh to ₹10 Lakh Retail Comprehensive Family Floater with zero room-rent sub-limit capping.";
    maxAffordableAnnualPremium = Math.round(disposableMonthlyIncome * 0.45 * 12);
  } else {
    tier = "higher";
    tierTitle = "High Resilience Protection Capacity";
    tierDescription = "Recommended base policy ₹10L + ₹25L Super Top-up and OPD Consumable Riders for comprehensive private network access.";
    maxAffordableAnnualPremium = Math.round(disposableMonthlyIncome * 0.6 * 12);
  }

  // Premium Burden Ratio for a standard ₹5L family plan (~₹14,000/year)
  const sampleAnnualPremium = 14000;
  const premiumBurdenRatio = annualIncome > 0 ? ((sampleAnnualPremium / annualIncome) * 100).toFixed(1) : "0";

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Wallet className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {t.navFinancial}
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Transparent, non-stigmatizing financial evaluation for Indian households. Determine your disposable healthcare budget, discover scheme eligibility, and prevent catastrophic medical debt.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start md:self-auto">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              National Health Accounts Aligned
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Household Financial Parameters (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>1. Household Demographics & Income</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Monthly Income */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.incomeLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                    className="w-full text-sm font-semibold pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Annual Household Income: ₹{(annualIncome).toLocaleString("en-IN")}</span>
              </div>

              {/* Total Family Members */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.familyMembersLabel}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={familyMembers}
                  onChange={(e) => setFamilyMembers(Number(e.target.value))}
                  className="w-full text-sm font-semibold p-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Elderly count (>70y for PM-JAY universal senior cover) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Senior Citizens (&gt;70 Years)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={elderlyCount}
                  onChange={(e) => setElderlyCount(Number(e.target.value))}
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
                {elderlyCount > 0 && (
                  <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                    ✓ Eligible for AB PM-JAY Universal ₹5L Senior Top-up
                  </span>
                )}
              </div>

              {/* Area Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Residence Location Type
                </label>
                <select
                  value={residenceType}
                  onChange={(e) => setResidenceType(e.target.value as any)}
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="rural">Rural Village (ग्राम / গ্রাম)</option>
                  <option value="semi_urban">Semi-Urban / Sub-Division / Block</option>
                  <option value="urban_metro">Urban Metro City (Tier 1 / Tier 2)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>2. Monthly Expenses & Debt Deductions</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Essential Expenses */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t.essentialExpensesLabel} (Food, Rent, Utilities, School)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={essentialExpenses}
                      onChange={(e) => setEssentialExpenses(Number(e.target.value))}
                      className="w-full text-sm pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Debt Obligations */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Loan / EMI / Debt Payments (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={debtPayments}
                      onChange={(e) => setDebtPayments(Number(e.target.value))}
                      className="w-full text-sm pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Scheme & Ration Status */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>3. Existing Government Cards & Insurance Status</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={hasBPLCard}
                    onChange={(e) => setHasBPLCard(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">NFSA / BPL / Antyodaya Card</span>
                </label>

                <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={hasStateCard}
                    onChange={(e) => setHasStateCard(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">State Card (Swasthya Sathi / Aarogyasri)</span>
                </label>

                <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100">
                  <input
                    type="checkbox"
                    checked={hasAyushmanCard}
                    onChange={(e) => setHasAyushmanCard(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Ayushman Bharat (PM-JAY) Card</span>
                </label>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Primary Health Coverage
                </label>
                <select
                  value={existingInsurance}
                  onChange={(e) => setExistingInsurance(e.target.value as any)}
                  className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="none">None / No Active Health Insurance</option>
                  <option value="pmjay">Ayushman Bharat PM-JAY (₹5 Lakh)</option>
                  <option value="state_scheme">State Scheme (Swasthya Sathi / Aarogyasri / MJPJAY)</option>
                  <option value="corporate_gmc">Corporate Group Mediclaim (Employer Policy)</option>
                  <option value="retail_individual">Private Retail Health Policy (Star / Care / HDFC / Niva)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Calculations & Affordability Guidance (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Key Metric Card: Disposable Income */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                HOUSEHOLD CASHFLOW ENGINE
              </span>
              <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                Savings: {savingsRate}%
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400">{t.disposableIncome}</div>
              <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                ₹{disposableMonthlyIncome.toLocaleString("en-IN")}
                <span className="text-xs font-normal text-slate-400 ml-1">/ month</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-800">
              <div className="bg-slate-800/80 p-2.5 rounded-xl">
                <span className="text-slate-400 block text-[11px]">Total Outflow:</span>
                <span className="font-bold text-white">₹{totalOutflows.toLocaleString("en-IN")}</span>
              </div>
              <div className="bg-slate-800/80 p-2.5 rounded-xl">
                <span className="text-slate-400 block text-[11px]">Affordable Annual Cover:</span>
                <span className="font-bold text-emerald-300">₹{maxAffordableAnnualPremium.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          {/* Affordability Tier Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">{tierTitle}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              {tierDescription}
            </p>

            {/* Premium Burden Indicator */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Estimated Premium Burden Ratio:</span>
                <span className={`font-bold ${Number(premiumBurdenRatio) > 8 ? "text-amber-600" : "text-emerald-600"}`}>
                  {premiumBurdenRatio}% of annual income
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${Number(premiumBurdenRatio) > 8 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, Number(premiumBurdenRatio) * 6)}%` }}
                ></div>
              </div>
              <span className="text-[10px] text-slate-400 block">
                *IRDAI & WHO benchmark: Health insurance premium should generally not exceed 4% to 8% of total household income.
              </span>
            </div>

            {/* Quick Strategic Actions */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block">Tailored Action Recommendations:</span>
              
              {(tier === "very_tight" || hasBPLCard) && (
                <button
                  onClick={onNavigateToSchemes}
                  className="w-full text-left p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs text-emerald-950 font-semibold flex items-center justify-between transition"
                >
                  <div className="flex items-center space-x-2">
                    <HeartHandshake className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Verify Ayushman Bharat PM-JAY & State Scheme Card</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                </button>
              )}

              <button
                onClick={onNavigateToCost}
                className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-800 font-semibold flex items-center justify-between transition"
              >
                <div className="flex items-center space-x-2">
                  <Building className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Estimate Out-of-Pocket Hospital Bill for Any Surgery</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>

              <button
                onClick={onNavigateToInsurance}
                className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs text-slate-800 font-semibold flex items-center justify-between transition"
              >
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Scan Health Insurance Policy for Hidden Sub-limits</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
