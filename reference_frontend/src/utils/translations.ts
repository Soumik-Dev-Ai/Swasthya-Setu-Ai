import { Language } from "../types";

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  navTriage: string;
  navFinancial: string;
  navInsurance: string;
  navSchemes: string;
  navCostCalc: string;
  navFacilities: string;
  navAshaPortal: string;
  navDoctorPortal: string;
  navSihPitch: string;
  emergencyAlert: string;
  call108: string;
  call102: string;
  offlineMode: string;
  onlineMode: string;
  symptomTitle: string;
  symptomSubtitle: string;
  symptomPlaceholder: string;
  voiceInput: string;
  listening: string;
  ageLabel: string;
  genderLabel: string;
  durationLabel: string;
  severityLabel: string;
  analyzeBtn: string;
  analyzing: string;
  urgencyEmergency: string;
  urgencyUrgent: string;
  urgencySoon: string;
  urgencyRoutine: string;
  redFlagsDetected: string;
  recommendedCare: string;
  homeCareAdvice: string;
  doctorSummaryTitle: string;
  incomeLabel: string;
  familyMembersLabel: string;
  essentialExpensesLabel: string;
  disposableIncome: string;
  affordabilityTier: string;
  policyAnalyzerTitle: string;
  policyUploadPrompt: string;
  sumInsuredLabel: string;
  roomRentCapLabel: string;
  waitingPeriodLabel: string;
  coPayLabel: string;
  outOfPocketLabel: string;
  facilityFinderTitle: string;
  verifiedAgo: string;
  doctorOnDuty: string;
  bedsAvailable: string;
  findNearestBtn: string;
  disclaimerText: string;
}

export const TRANSLATIONS: Record<Language, TranslationDictionary> = {
  en: {
    appName: "SwasthyaSetu AI",
    tagline: "Offline-First Multilingual Healthcare Navigation & Affordability Platform",
    navTriage: "AI Symptom Triage",
    navFinancial: "Financial Status & Affordability",
    navInsurance: "Insurance Policy Analyzer",
    navSchemes: "Government Scheme Finder",
    navCostCalc: "Treatment Cost Calculator",
    navFacilities: "Verified Facility Navigator",
    navAshaPortal: "ASHA / Health Worker",
    navDoctorPortal: "Doctor Triage Desk",
    navSihPitch: "SIH 2026 Evaluation Deck",
    emergencyAlert: "Medical Emergency? Call National Ambulance 108 immediately",
    call108: "Call 108 (Emergency)",
    call102: "Call 102 (Maternal / Infant)",
    offlineMode: "Offline Mode Active (Cached Clinical Engine)",
    onlineMode: "Cloud AI Connected (Gemini 3.7 Flash)",
    symptomTitle: "Clinical Symptom Check & Danger Sign Triage",
    symptomSubtitle: "Enter symptoms in plain language or voice. Our deterministic red-flag engine evaluates immediate risk before medical AI assessment.",
    symptomPlaceholder: "e.g., Having chest tightness with sweating for 1 hour, or high fever with throat pain...",
    voiceInput: "Speak Symptoms (Voice)",
    listening: "Listening... speak now in English, Hindi, or Bengali",
    ageLabel: "Age (Years)",
    genderLabel: "Gender",
    durationLabel: "Duration of Symptoms",
    severityLabel: "Severity Level",
    analyzeBtn: "Evaluate Triage & Affordability",
    analyzing: "Running Clinical Safety Rules & AI Analysis...",
    urgencyEmergency: "EMERGENCY (Immediate Action)",
    urgencyUrgent: "URGENT (Same-Day Physician Consult)",
    urgencySoon: "SOON (Consult within 24-48 Hours)",
    urgencyRoutine: "ROUTINE (General Clinic / Safe Self-Care)",
    redFlagsDetected: "Critical Clinical Red Flags Detected",
    recommendedCare: "Recommended Level of Care",
    homeCareAdvice: "Safe Home Supportive Guidance",
    doctorSummaryTitle: "Doctor-Ready SBAR Clinical Handover Brief",
    incomeLabel: "Monthly Household Income (₹)",
    familyMembersLabel: "Total Family Members",
    essentialExpensesLabel: "Essential Monthly Expenses (₹)",
    disposableIncome: "Disposable Monthly Income",
    affordabilityTier: "Financial Protection Tier",
    policyAnalyzerTitle: "Health Insurance Policy & Coverage Gap Scanner",
    policyUploadPrompt: "Upload Insurance Policy PDF / Schedule or select a verified standard plan",
    sumInsuredLabel: "Sum Insured (Coverage Limit)",
    roomRentCapLabel: "Room Rent Limit / Sub-limit",
    waitingPeriodLabel: "Pre-existing Disease Waiting Period",
    coPayLabel: "Co-Payment / Deductible Clause",
    outOfPocketLabel: "Estimated Out-of-Pocket Expense",
    facilityFinderTitle: "Verified Nearby Healthcare Facilities",
    verifiedAgo: "Status verified",
    doctorOnDuty: "Medical Officer on Duty",
    bedsAvailable: "Available Beds",
    findNearestBtn: "Match Verified Facilities",
    disclaimerText: "SwasthyaSetu AI is an assistive healthcare navigation and literacy tool built for public health decision support. It does not replace clinical judgment by registered medical practitioners."
  },
  hi: {
    appName: "स्वास्थ्यसेतु AI",
    tagline: "ऑफ़लाइन-सक्षम बहुभाषी स्वास्थ्य नेविगेशन एवं उपचार सामर्थ्य मंच",
    navTriage: "लक्षण व आपातकालीन जांच",
    navFinancial: "आर्थिक स्थिति व सामर्थ्य",
    navInsurance: "बीमा पॉलिसी विश्लेषक",
    navSchemes: "सरकारी स्वास्थ्य योजनाएं",
    navCostCalc: "उपचार खर्च कैलकुलेटर",
    navFacilities: "सत्यापित अस्पताल खोजें",
    navAshaPortal: "आशा / स्वास्थ्य कार्यकर्ता",
    navDoctorPortal: "चिकित्सक डेस्क",
    navSihPitch: "SIH 2026 मूल्यांकन डेक",
    emergencyAlert: "आपातकालीन स्थिति में तुरंत राष्ट्रीय एम्बुलेंस 108 पर कॉल करें",
    call108: "कॉल 108 (आपातकालीन)",
    call102: "कॉल 102 (मातृ एवं शिशु)",
    offlineMode: "ऑफ़लाइन मोड सक्रिय (लोकल क्लिनिकल इंजन)",
    onlineMode: "क्लाउड AI कनेक्टेड (Gemini 3.7 Flash)",
    symptomTitle: "लक्षण जांच एवं आपातकालीन खतरे के संकेत",
    symptomSubtitle: "अपनी भाषा या आवाज में लक्षण बताएं। हमारा सुरक्षा इंजन तुरंत जोखिम की पहचान करता है।",
    symptomPlaceholder: "जैसे: 1 घंटे से सीने में भारीपन और पसीना आ रहा है, या तेज बुखार और गले में दर्द है...",
    voiceInput: "बोलकर लक्षण बताएं (वॉयस)",
    listening: "सुन रहे हैं... कृपया हिंदी, बंगाली या अंग्रेजी में बोलें",
    ageLabel: "आयु (वर्ष)",
    genderLabel: "लिंग",
    durationLabel: "लक्षणों की अवधि",
    severityLabel: "गंभीरता का स्तर",
    analyzeBtn: "जोखिम व खर्च की जांच करें",
    analyzing: "सुरक्षा नियमों एवं AI द्वारा विश्लेषण जारी...",
    urgencyEmergency: "आपातकालीन (तत्काल अस्पताल जाएं)",
    urgencyUrgent: "अति-आवश्यक (आज ही डॉक्टर को दिखाएं)",
    urgencySoon: "शीघ्र (24-48 घंटों में परामर्श लें)",
    urgencyRoutine: "सामान्य (प्राथमिक स्वास्थ्य केंद्र / घरेलू देखभाल)",
    redFlagsDetected: "गंभीर खतरे के संकेत मिले",
    recommendedCare: "अनुशंसित स्वास्थ्य केंद्र स्तर",
    homeCareAdvice: "सुरक्षित प्राथमिक / घरेलू देखभाल सलाह",
    doctorSummaryTitle: "डॉक्टर के लिए तैयार SBAR संक्षिप्त पर्ची",
    incomeLabel: "मासिक पारिवारिक आय (₹)",
    familyMembersLabel: "परिवार के कुल सदस्य",
    essentialExpensesLabel: "अनिवार्य मासिक खर्च (₹)",
    disposableIncome: "मासिक बचत / खर्च योग्य आय",
    affordabilityTier: "वित्तीय सुरक्षा श्रेणी",
    policyAnalyzerTitle: "स्वास्थ्य बीमा पॉलिसी एवं कवरेज विश्लेषक",
    policyUploadPrompt: "बीमा पॉलिसी दस्तावेज अपलोड करें या मानक योजना चुनें",
    sumInsuredLabel: "बीमा राशि (कवरेज सीमा)",
    roomRentCapLabel: "कमरा किराया सीमा (Room Rent Capping)",
    waitingPeriodLabel: "पुरानी बीमारी प्रतीक्षा अवधि (Waiting Period)",
    coPayLabel: "सह-भुगतान (Co-Payment / Deductible)",
    outOfPocketLabel: "मरीज द्वारा अनुमानित जेब खर्च",
    facilityFinderTitle: "सत्यापित नजदीकी स्वास्थ्य केंद्र एवं अस्पताल",
    verifiedAgo: "सत्यापित किया गया",
    doctorOnDuty: "ड्यूटी पर डॉक्टर उपलब्ध",
    bedsAvailable: "उपलब्ध बेड",
    findNearestBtn: "निकटतम अस्पताल देखें",
    disclaimerText: "स्वास्थ्यसेतु AI केवल स्वास्थ्य मार्गदर्शन और निर्णय सहायता के लिए है, यह डॉक्टर के प्रत्यक्ष परीक्षण का विकल्प नहीं है।"
  },
  bn: {
    appName: "স্বাস্থ্যসেতু AI",
    tagline: "অফলাইন-সক্ষম বহুভাষিক স্বাস্থ্য নেভিগেশন ও চিকিৎসা ব্যয় সাশ্রয় প্ল্যাটফর্ম",
    navTriage: "লক্ষণ ও জরুরি ট্রায়াজ",
    navFinancial: "আর্থিক সক্ষমতা ও পরিকল্পনা",
    navInsurance: "স্বাস্থ্য বীমা বিশ্লেষক",
    navSchemes: "সরকারি স্বাস্থ্য প্রকল্প (স্বাস্থ্যসাথী / PM-JAY)",
    navCostCalc: "চিকিৎসা ব্যয় ক্যালকুলেটর",
    navFacilities: "যাচাইকৃত হাসপাতাল ও PHC",
    navAshaPortal: "আশা / স্বাস্থ্যকর্মী পোর্টাল",
    navDoctorPortal: "চিকিৎসক ট্রায়াজ ডেস্ক",
    navSihPitch: "SIH 2026 উপস্থাপনা ও ডেমো",
    emergencyAlert: "জরুরি চিকিৎসার প্রয়োজনে অবিলম্বে 108 নম্বরে অ্যাম্বুলেন্স কল করুন",
    call108: "কল 108 (জরুরি অ্যাম্বুলেন্স)",
    call102: "কল 102 (প্রসূতি ও শিশু)",
    offlineMode: "অফলাইন মোড সক্রিয় (লোকাল ক্লিনিক্যাল ইঞ্জিন)",
    onlineMode: "ক্লাউড AI সংযুক্ত (Gemini 3.7 Flash)",
    symptomTitle: "লক্ষণ পরীক্ষা ও জরুরি বিপদের সংকেত নির্ধারণ",
    symptomSubtitle: "নিজের ভাষায় বা মুখে বলে লক্ষণ লিখুন। আমাদের ক্লিনিক্যাল সেফটি ইঞ্জিন সবার আগে বিপজ্জনক লক্ষণ শনাক্ত করে।",
    symptomPlaceholder: "যেমন: ১ ঘণ্টা ধরে বুকে তীব্র চাপ ও ঘাম হচ্ছে, অথবা ৩ দিন ধরে কাঁপুনি দিয়ে জ্বর ও পেটে ব্যথা...",
    voiceInput: "মুখে বলে লক্ষণ দিন (ভয়েস ইনপুট)",
    listening: "শুনছি... অনুগ্রহ করে পরিষ্কারভাবে বলুন",
    ageLabel: "বয়স (বছর)",
    genderLabel: "লিঙ্গ",
    durationLabel: "লক্ষণের সময়কাল",
    severityLabel: "তীব্রতার মাত্রা",
    analyzeBtn: "ঝুঁকি ও চিকিৎসার বিকল্প দেখুন",
    analyzing: "ক্লিনিক্যাল নিয়ম ও AI দ্বারা বিশ্লেষণ করা হচ্ছে...",
    urgencyEmergency: "জরুরি সংকটজনক (অবিলম্বে হাসপাতালে যান)",
    urgencyUrgent: "অত্যাবশ্যকীয় (আজই ডাক্তার দেখান)",
    urgencySoon: "শীঘ্রই (২৪-৪৮ ঘণ্টার মধ্যে পরামর্শ নিন)",
    urgencyRoutine: "সাধারণ (PHC বা প্রাথমিক যত্ন)",
    redFlagsDetected: "বিপজ্জনক জরুরি লক্ষণ ধরা পড়েছে",
    recommendedCare: "চিকিৎসার সঠিক স্বাস্থ্য কেন্দ্র স্তর",
    homeCareAdvice: "নিরাপদ প্রাথমিক যত্ন ও সতর্কতা",
    doctorSummaryTitle: "চিকিৎসকের জন্য প্রস্তুত SBAR ক্লিনিক্যাল স্লিপ",
    incomeLabel: "মাসিক পারিবারিক আয় (₹)",
    familyMembersLabel: "পরিবারের মোট সদস্য সংখ্যা",
    essentialExpensesLabel: "নিত্যপ্রয়োজনীয় মাসিক খরচ (₹)",
    disposableIncome: "মাসিক অবশিষ্ট আয়",
    affordabilityTier: "আর্থিক সুরক্ষা স্তর",
    policyAnalyzerTitle: "স্বাস্থ্য বীমা ও স্বাস্থ্যসাথী কভারেজ বিশ্লেষক",
    policyUploadPrompt: "বীমা পলিসি আপলোড করুন অথবা স্ট্যান্ডার্ড প্ল্যান বেছে নিন",
    sumInsuredLabel: "মোট বীমা কভারেজ (Sum Insured)",
    roomRentCapLabel: "রুম ভাড়ার সীমা (Room Rent Limit)",
    waitingPeriodLabel: "পূর্ববর্তী রোগের ওয়েটিং পিরিয়ড",
    coPayLabel: "কো-পেমেন্ট বা রোগীর নিজস্ব দেয় অংশ",
    outOfPocketLabel: "রোগীর আনুমানিক নিজস্ব খরচ (Out-of-Pocket)",
    facilityFinderTitle: "যাচাইকৃত নিকটবর্তী হাসপাতাল ও স্বাস্থ্যকেন্দ্র",
    verifiedAgo: "স্ট্যাটাস যাচাই করা হয়েছে",
    doctorOnDuty: "অন-ডিউটি চিকিৎসক উপস্থিত",
    bedsAvailable: "খালি শয্যা",
    findNearestBtn: "কাছের হাসপাতাল খুঁজুন",
    disclaimerText: "স্বাস্থ্যসেতু AI হলো একটি সহায়ক স্বাস্থ্য পরামর্শ ও পথপ্রদর্শক টুল। এটি কোনো রেজিস্টার্ড চিকিৎসকের বিকল্প নয়।"
  }
};
