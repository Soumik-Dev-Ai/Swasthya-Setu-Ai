import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 4000;

app.use(express.json({ limit: "10mb" }));

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Deterministic Emergency Red Flag Detection
const RED_FLAG_KEYWORDS = [
  "chest pain", "crushing pain", "radiating to left arm", "shortness of breath",
  "difficulty breathing", "cannot breathe", "stridor", "wheezing severe",
  "slurred speech", "facial droop", "arm weakness", "hemiplegia", "stroke",
  "unconscious", "fainted", "unresponsive", "altered mental status",
  "severe bleeding", "coughing blood", "vomiting blood", "melena",
  "anaphylaxis", "swelling of lips", "severe allergic reaction",
  "seizure", "convulsion", "high fever with stiff neck",
  "suicidal", "severe abdominal rigidity", "newborn not feeding", "lethargic infant"
];

function checkDeterministicRedFlags(symptomText: string, structuredAnswers?: Record<string, boolean>) {
  const lower = (symptomText || "").toLowerCase();
  const matchedFlags: string[] = [];

  for (const keyword of RED_FLAG_KEYWORDS) {
    if (lower.includes(keyword)) {
      matchedFlags.push(keyword);
    }
  }

  if (structuredAnswers) {
    if (structuredAnswers.chestPain) matchedFlags.push("Chest pain / Pressure");
    if (structuredAnswers.severeBreathlessness) matchedFlags.push("Severe breathlessness");
    if (structuredAnswers.strokeSigns) matchedFlags.push("Sudden facial droop / arm weakness / speech change");
    if (structuredAnswers.unconsciousness) matchedFlags.push("Loss of consciousness / fainting");
    if (structuredAnswers.heavyBleeding) matchedFlags.push("Heavy uncontrolled bleeding");
    if (structuredAnswers.highFeverStiffNeck) matchedFlags.push("High fever with neck stiffness");
  }

  return matchedFlags;
}

// 1. API: Symptom Clinical Triage
app.post("/api/triage", async (req: Request, res: Response) => {
  try {
    const {
      symptoms,
      duration,
      severity,
      age,
      gender,
      comorbidities = [],
      medications = [],
      allergies = [],
      pregnancy = false,
      language = "en",
      redFlagAnswers = {},
    } = req.body;

    const deterministicFlags = checkDeterministicRedFlags(symptoms, redFlagAnswers);
    const isHardEmergency = deterministicFlags.length > 0;

    const ai = getAI();

    if (!ai) {
      // Deterministic Clinical Fallback Response
      const fallbackResult = {
        urgency: isHardEmergency ? "EMERGENCY" : severity === "severe" ? "URGENT" : "SOON",
        urgencyDescription: isHardEmergency
          ? "Critical emergency red flags detected. Immediate medical intervention required."
          : "Consult a qualified medical officer at your nearest Primary Health Centre or Community Health Centre.",
        redFlagsDetected: deterministicFlags,
        isEmergency: isHardEmergency,
        possibleCategories: [
          {
            name: isHardEmergency ? "Acute Cardiorespiratory / Neurological Alert" : "Acute Symptom Presentation",
            likelihood: "High",
            description: "Symptoms require in-person clinical examination, vitals check, and physical assessment."
          }
        ],
        recommendedCareLevel: isHardEmergency ? "Tertiary Emergency / District Hospital ICU" : "Primary Health Centre (PHC) / General Practitioner",
        teleconsultationFeasible: !isHardEmergency,
        clinicalQuestionsToAsk: [
          "Is the pain or discomfort worsening over time?",
          "Are you able to swallow liquids or keep food down?",
          "Are there any associated sweats, dizziness, or palpitations?"
        ],
        homeCareGuidance: isHardEmergency
          ? "Do NOT delay. Call 108 immediately. Keep the patient in a comfortable seated position with open airways."
          : "Stay hydrated with clean fluids or ORS. Rest in a well-ventilated room. Monitor temperature and pulse.",
        warningSignsToWatch: [
          "Sudden drop in oxygen saturation (<94%)",
          "Confusion or lethargy",
          "Persistent high fever >103°F"
        ],
        doctorBrief: `Patient: ${age}y ${gender}, Symptoms: "${symptoms}", Duration: ${duration}, Comorbidities: ${comorbidities.join(", ") || "None"}, Hard Red Flags: ${deterministicFlags.join(", ") || "None"}.`,
        disclaimer: "SwasthyaSetu AI is a clinical triage decision support tool for navigation only, not a formal diagnostic device. Always seek registered medical evaluation."
      };
      return res.json(fallbackResult);
    }

    const systemPrompt = `You are SwasthyaSetu AI's Clinical Safety and Triage Engine for the Indian public healthcare system.
You MUST prioritize patient safety above all else.
Follow validated clinical triage standards (e.g. Indian Emergency Triage Protocols / WHO IMCI / Manchester Triage System).
Language requested: ${language} (Provide text output in ${language === "hi" ? "Hindi (Devanagari)" : language === "bn" ? "Bengali" : "English"}, but keep JSON keys strictly in English).

Input data:
- Primary Symptoms: ${symptoms}
- Duration: ${duration}
- Severity: ${severity}
- Age: ${age}
- Gender: ${gender}
- Comorbidities: ${comorbidities.join(", ") || "None"}
- Current Medications: ${medications.join(", ") || "None"}
- Known Allergies: ${allergies.join(", ") || "None"}
- Pregnancy Status: ${pregnancy ? "Pregnant" : "No / Not Applicable"}
- Pre-screened Red Flags: ${deterministicFlags.join(", ") || "None"}

Your output MUST be a valid JSON object matching this schema:
{
  "urgency": "EMERGENCY" | "URGENT" | "SOON" | "ROUTINE" | "INSUFFICIENT_INFO",
  "urgencyDescription": "Clear, reassuring or urgent explanation of the risk level in ${language}",
  "redFlagsDetected": ["list of detected clinical warning signs"],
  "isEmergency": boolean,
  "possibleCategories": [
    {
      "name": "Clinical broad category (e.g. Acute Upper Respiratory Infection, Gastrointestinal Distress, Angina Pectoris Alert)",
      "likelihood": "High" | "Medium" | "Low",
      "description": "Brief explanation in ${language}"
    }
  ],
  "recommendedCareLevel": "Sub-Centre / ASHA" | "Primary Health Centre (PHC)" | "Community Health Centre (CHC)" | "District Hospital" | "Tertiary / Medical College" | "Emergency Department",
  "teleconsultationFeasible": boolean,
  "clinicalQuestionsToAsk": ["2-3 focused clarifying questions doctor will likely ask"],
  "homeCareGuidance": "Safe, non-pharmacological supportive advice or immediate first aid steps in ${language}",
  "warningSignsToWatch": ["2-3 specific escalation criteria to watch out for"],
  "doctorBrief": "Structured SBAR handover summary (Situation, Background, Assessment, Recommendation) for clinician",
  "disclaimer": "SwasthyaSetu AI is an educational healthcare navigation aid and does not substitute licensed medical consultation."
}

CRITICAL RULES:
1. If chest pain, stroke signs, difficulty breathing, severe hemorrhage, or shock are indicated, urgency MUST be EMERGENCY and isEmergency MUST be true.
2. Never prescribe specific allopathic prescription dosages.
3. Keep care-level recommendations mapped to Indian tiers (PHC, CHC, District Hospital, Medical College).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");

    // Overwrite emergency flag if deterministic rule caught a life-threat
    if (isHardEmergency) {
      parsed.urgency = "EMERGENCY";
      parsed.isEmergency = true;
      parsed.redFlagsDetected = Array.from(new Set([...(parsed.redFlagsDetected || []), ...deterministicFlags]));
    }

    return res.json(parsed);
  } catch (error: any) {
    console.error("Triage error:", error);
    res.status(500).json({ error: "Failed to evaluate symptoms", details: error.message });
  }
});

// 2. API: Insurance Policy & Government Scheme Analyzer
app.post("/api/policy-analyze", async (req: Request, res: Response) => {
  try {
    const { policyText, policyType, sumInsured, age, familyMembers, preExistingConditions = [] } = req.body;
    const ai = getAI();

    if (!ai) {
      // Deterministic policy analysis
      const sum = Number(sumInsured) || 500000;
      const roomRentLimit = policyType === "corporate" ? "1% of Sum Insured (₹" + (sum * 0.01) + "/day)" : "No sub-limit or ₹5,000/day";
      return res.json({
        insurer: "Analyzed Health Policy",
        planName: policyType === "corporate" ? "Corporate Group Mediclaim (GMC)" : "Retail Comprehensive Health Shield",
        sumInsured: sum,
        roomRentCap: roomRentLimit,
        coPayment: policyType === "senior" ? "20% on all claims" : "0% (Standard) / 10% on Tier 1 private metro",
        waitingPeriods: {
          initial: "30 Days (Except accidental emergencies)",
          specificDiseases: "24 Months (Cataract, Hernia, Joint Replacement, Stones)",
          preExisting: policyType === "corporate" ? "0 Months (Waived under GMC)" : "24–36 Months",
        },
        coveredFeatures: [
          "In-patient hospitalization (>24 hours)",
          "Pre-hospitalization (30-60 days)",
          "Post-hospitalization (60-90 days)",
          "Day-care procedures (500+ listed surgeries)",
          "Ambulance cover up to ₹2,000"
        ],
        exclusions: [
          "Cosmetic / Aesthetic treatments",
          "OPD consultations & routine medicines (unless explicit OPD rider)",
          "Non-medical items & consumables (Gloves, PPE, admin charges ~8-12% of bill)",
          "Self-inflicted injuries / Substance abuse"
        ],
        coverageGaps: [
          "Room Rent Proportionate Deduction: If room exceeds limit, all associated medical bills will be deducted proportionately.",
          "Consumables Deduction: Approximately 10-15% of hospital bill usually falls under non-payable consumables.",
          preExistingConditions.length > 0
            ? `Pre-existing conditions (${preExistingConditions.join(", ")}) may have an active waiting period if policy age is < 3 years.`
            : "Ensure annual continuity to preserve pre-existing disease waiting period credits."
        ],
        claimGuidance: "For planned admission: Notify TPA 48 hours prior for Cashless Pre-Auth. For emergency: Inform within 24 hours of hospital admission."
      });
    }

    const prompt = `Analyze this Indian Health Insurance Policy context and extract structured, clinically accurate financial coverage details.
Policy Text / Context:
${policyText || "Standard Indian Retail Health Insurance Policy"}
Policy Type: ${policyType}
Sum Insured: ₹${sumInsured || 500000}
Patient Age: ${age || 35}
Declared Pre-existing conditions: ${preExistingConditions.join(", ") || "None"}

Generate a valid JSON object matching:
{
  "insurer": "Company Name",
  "planName": "Product Name",
  "sumInsured": number,
  "roomRentCap": "Explanation of daily room rent limit (e.g. 1% of Sum Insured / Single Private Room / No Capping)",
  "coPayment": "Co-pay clause details",
  "waitingPeriods": {
    "initial": "Initial waiting duration",
    "specificDiseases": "Specific illnesses duration (e.g. 24 months)",
    "preExisting": "PED waiting period (e.g. 24 or 36 or 48 months, or 0 if corporate waived)"
  },
  "coveredFeatures": ["List of 4-5 clearly covered features"],
  "exclusions": ["List of 4 common exclusions"],
  "coverageGaps": ["List of 3 potential hidden out-of-pocket risks, such as proportionate deductions, consumables, sub-limits"],
  "claimGuidance": "Step-by-step guidance on Cashless Pre-Authorisation and Reimbursement"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    return res.json(parsed);
  } catch (error: any) {
    console.error("Policy analyze error:", error);
    res.status(500).json({ error: "Failed to analyze policy", details: error.message });
  }
});

// 3. API: Interactive Healthcare Out-of-Pocket Cost Calculator
app.post("/api/cost-estimate", async (req: Request, res: Response) => {
  try {
    const { procedureId, cityTier = "tier2", hospitalType = "private_empaneled", hasPMJAY = false, insuranceType = "none", sumInsured = 0, roomCategory = "standard_twin" } = req.body;

    // Standard baseline benchmarks in India (INR)
    const PROCEDURE_BENCHMARKS: Record<string, { name: string; baseCost: { public: number; empaneled: number; private_corporate: number }; avgStayDays: number; category: string }> = {
      "appendectomy": { name: "Laparoscopic Appendectomy", baseCost: { public: 2500, empaneled: 35000, private_corporate: 85000 }, avgStayDays: 2, category: "General Surgery" },
      "cesarean_delivery": { name: "Lower Segment Cesarean Section (LSCS)", baseCost: { public: 1500, empaneled: 28000, private_corporate: 75000 }, avgStayDays: 3, category: "Obstetrics" },
      "normal_delivery": { name: "Normal Vaginal Delivery (Institutional)", baseCost: { public: 0, empaneled: 12000, private_corporate: 45000 }, avgStayDays: 2, category: "Obstetrics" },
      "cataract_phaco": { name: "Phacoemulsification Cataract with Monofocal IOL", baseCost: { public: 500, empaneled: 15000, private_corporate: 38000 }, avgStayDays: 0, category: "Ophthalmology" },
      "cholecystectomy": { name: "Laparoscopic Gallbladder Removal", baseCost: { public: 3000, empaneled: 42000, private_corporate: 110000 }, avgStayDays: 2, category: "General Surgery" },
      "dengue_treatment": { name: "Dengue Inpatient Management (Platelet Monitoring)", baseCost: { public: 1000, empaneled: 18000, private_corporate: 52000 }, avgStayDays: 4, category: "Internal Medicine" },
      "viral_pneumonia": { name: "Acute Severe Viral Pneumonia (Oxygen Support)", baseCost: { public: 2000, empaneled: 32000, private_corporate: 90000 }, avgStayDays: 5, category: "Pulmonology" },
      "cardiac_stent": { name: "Single Drug-Eluting Coronary Stent (Angioplasty)", baseCost: { public: 15000, empaneled: 85000, private_corporate: 240000 }, avgStayDays: 3, category: "Cardiology" },
      "knee_replacement": { name: "Unilateral Total Knee Arthroplasty (TKR)", baseCost: { public: 25000, empaneled: 115000, private_corporate: 280000 }, avgStayDays: 4, category: "Orthopedics" },
      "hemodialysis_month": { name: "Maintenance Hemodialysis (8 sessions/month)", baseCost: { public: 0, empaneled: 12000, private_corporate: 28000 }, avgStayDays: 0, category: "Nephrology" }
    };

    const benchmark = PROCEDURE_BENCHMARKS[procedureId] || PROCEDURE_BENCHMARKS["appendectomy"];
    
    // Tier Multipliers: Tier 1 (Metro): 1.25x, Tier 2: 1.0x, Tier 3 / Rural: 0.8x
    const tierMultiplier = cityTier === "tier1" ? 1.25 : cityTier === "tier3" ? 0.8 : 1.0;

    let baseGross = benchmark.baseCost[hospitalType as keyof typeof benchmark.baseCost] || benchmark.baseCost.empaneled;
    let estimatedGrossCost = Math.round(baseGross * tierMultiplier);

    // Itemized Breakdown
    const bedCharges = Math.round(estimatedGrossCost * 0.22);
    const surgeonFee = Math.round(estimatedGrossCost * 0.28);
    const otAndAnesthesia = Math.round(estimatedGrossCost * 0.20);
    const medicinesAndConsumables = Math.round(estimatedGrossCost * 0.20);
    const labDiagnostics = Math.round(estimatedGrossCost * 0.10);

    let pmjayCovered = 0;
    let insuranceCovered = 0;
    let roomRentDeduction = 0;
    let nonPayableConsumables = Math.round(medicinesAndConsumables * 0.45); // ~9% of total bill
    let coPayDeduction = 0;

    if (hospitalType === "public") {
      // In Government PHC/CHC/District Hospital: Mostly free or nominal user fee
      estimatedGrossCost = Math.min(estimatedGrossCost, 5000);
      pmjayCovered = hasPMJAY ? estimatedGrossCost : estimatedGrossCost * 0.85;
      nonPayableConsumables = 0;
    } else if (hasPMJAY && (hospitalType === "empaneled" || hospitalType === "public")) {
      // PM-JAY covers package price 100% cashless in empaneled hospitals
      pmjayCovered = estimatedGrossCost;
      nonPayableConsumables = 0; // PM-JAY is strictly cashless with no extra consumable charges
    } else if (insuranceType !== "none" && sumInsured > 0) {
      // Private / Corporate Insurance
      const allowedAmount = Math.min(estimatedGrossCost, sumInsured);
      
      // Check room rent capping
      const roomLimit = Math.max(sumInsured * 0.01, 4000);
      const actualDailyRoom = roomCategory === "deluxe_suite" ? 9000 : roomCategory === "single_private" ? 6000 : 3500;
      
      if (actualDailyRoom > roomLimit) {
        const proportion = roomLimit / actualDailyRoom;
        roomRentDeduction = Math.round((estimatedGrossCost - nonPayableConsumables) * (1 - proportion));
      }

      const payableBase = allowedAmount - nonPayableConsumables - roomRentDeduction;
      const coPayPercent = insuranceType === "senior" ? 0.20 : 0.05;
      coPayDeduction = Math.round(payableBase * coPayPercent);

      insuranceCovered = Math.max(0, payableBase - coPayDeduction);
    }

    const patientResponsibility = Math.max(0, estimatedGrossCost - pmjayCovered - insuranceCovered);

    return res.json({
      procedureName: benchmark.name,
      category: benchmark.category,
      avgStayDays: benchmark.avgStayDays,
      estimatedGrossCost,
      breakdown: {
        bedCharges,
        surgeonFee,
        otAndAnesthesia,
        medicinesAndConsumables,
        labDiagnostics,
      },
      deductions: {
        pmjayCoverage: pmjayCovered,
        insuranceClaimPayout: insuranceCovered,
        nonPayableConsumables,
        roomRentProportionateDeduction: roomRentDeduction,
        coPayAmount: coPayDeduction,
      },
      patientResponsibility,
      savingsAmount: estimatedGrossCost - patientResponsibility,
      financialAdvice: hasPMJAY && hospitalType === "empaneled"
        ? "100% Cashless under PM-JAY package rates. Ensure hospital has an active Ayushman Mitra desk and do not pay out-of-pocket charges."
        : patientResponsibility > 30000
        ? "Consider seeking care at an empaneled trust hospital or District Hospital to reduce out-of-pocket burden by up to 70%."
        : "Estimated patient payment is within standard manageable outpatient/inpatient limits."
    });
  } catch (error: any) {
    console.error("Cost estimate error:", error);
    res.status(500).json({ error: "Failed to estimate cost", details: error.message });
  }
});

// 4. API: Telehealth & Doctor Brief SBAR Generator
app.post("/api/doctor-summary", async (req: Request, res: Response) => {
  try {
    const { patientInfo, triageData, financialContext } = req.body;
    const ai = getAI();

    if (!ai) {
      return res.json({
        sbarSummary: {
          situation: `Patient ${patientInfo.name || "Anonymous"} (${patientInfo.age}y, ${patientInfo.gender}) presents with: ${triageData.symptoms || "acute complaints"}.`,
          background: `Comorbidities: ${patientInfo.comorbidities?.join(", ") || "None reported"}. Duration: ${triageData.duration || "Recent"}. Allergies: ${patientInfo.allergies?.join(", ") || "NKDA"}.`,
          assessment: `Triage Classification: ${triageData.urgency || "SOON"}. Detected Red Flags: ${triageData.redFlagsDetected?.join(", ") || "None"}.`,
          recommendation: `Recommended Level: ${triageData.recommendedCareLevel || "Primary Health Centre"}. Scheme Eligibility: ${financialContext?.eligibleScheme || "Standard Consultation"}.`
        },
        formattedMarkdown: `### Clinical Handover Slip (SwasthyaSetu AI)\n- **Patient**: ${patientInfo.name || "Patient"}, ${patientInfo.age}y / ${patientInfo.gender}\n- **Triage Level**: **${triageData.urgency || "ROUTINE"}**\n- **Symptoms**: ${triageData.symptoms}\n- **Action**: Immediate physician review recommended.`
      });
    }

    const prompt = `You are a clinical handover assistant for an Indian medical officer. Generate a concise, professional SBAR (Situation, Background, Assessment, Recommendation) clinical handover note.
Patient Data:
${JSON.stringify({ patientInfo, triageData, financialContext }, null, 2)}

Return valid JSON:
{
  "sbarSummary": {
    "situation": "Concise situation statement",
    "background": "Relevant medical history and timeline",
    "assessment": "Clinical triage impression and danger sign evaluation",
    "recommendation": "Suggested diagnostic tests, priority, and referral action"
  },
  "formattedMarkdown": "Formatted clean slip ready to print or send to eSanjeevani doctor"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });

    return res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (error: any) {
    console.error("Doctor summary error:", error);
    res.status(500).json({ error: "Failed to generate summary", details: error.message });
  }
});

// Vite middleware or static serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SwasthyaSetu AI Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
