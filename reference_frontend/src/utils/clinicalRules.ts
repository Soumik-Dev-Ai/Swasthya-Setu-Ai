export interface RedFlagQuestion {
  id: string;
  category: string;
  questionEn: string;
  questionHi: string;
  questionBn: string;
  severity: "critical" | "high" | "medium";
}

export const RED_FLAG_CHECKLIST: RedFlagQuestion[] = [
  {
    id: "chestPain",
    category: "Cardiovascular",
    questionEn: "Is there sudden, crushing chest pain, pressure, or tightness radiating to left arm/jaw?",
    questionHi: "क्या सीने में अचानक तेज दबाव, दर्द या भारीपन है जो बाएं हाथ या जबड़े तक जा रहा है?",
    questionBn: "হঠাৎ বুকে তীব্র চাপ, ব্যথা বা ভারী ভাব কি বাঁ হাত বা চোয়ালের দিকে ছড়িয়ে পড়ছে?",
    severity: "critical"
  },
  {
    id: "severeBreathlessness",
    category: "Respiratory",
    questionEn: "Is the patient struggling to speak full sentences due to severe breathlessness or wheezing?",
    questionHi: "क्या सांस लेने में इतनी ज्यादा तकलीफ है कि मरीज एक पूरा वाक्य भी नहीं बोल पा रहा है?",
    questionBn: "শ্বাসকষ্টের কারণে কি রোগী পুরো এক বাক্য কথাও স্পষ্ট বলতে পারছেন না?",
    severity: "critical"
  },
  {
    id: "strokeSigns",
    category: "Neurological",
    questionEn: "FAST Stroke Signs: Sudden facial drooping, arm weakness, or slurred/inability to speak?",
    questionHi: "स्ट्रोक के लक्षण: अचानक मुंह का टेढ़ा होना, हाथ की कमजोरी या बोली का लड़खड़ाना?",
    questionBn: "স্ট্রোকের লক্ষণ: হঠাৎ মুখ বেঁকে যাওয়া, এক হাত দুর্বল হয়ে পড়া বা কথা জড়িয়ে যাওয়া?",
    severity: "critical"
  },
  {
    id: "unconsciousness",
    category: "Altered Mental",
    questionEn: "Has the patient fainted, become unresponsive, or having seizures / convulsions?",
    questionHi: "क्या मरीज बेहोश हो गया है, प्रतिक्रिया नहीं दे रहा है या मिर्गी/दौरे आ रहे हैं?",
    questionBn: "রোগী কি জ্ঞান হারিয়ে ফেলেছেন, সাড়া দিচ্ছেন না বা খিঁচুনি হচ্ছে?",
    severity: "critical"
  },
  {
    id: "heavyBleeding",
    category: "Trauma / Hemorrhage",
    questionEn: "Is there uncontrolled heavy bleeding, coughing/vomiting blood, or severe traumatic injury?",
    questionHi: "क्या अनियंत्रित भारी रक्तस्राव हो रहा है, खून की उल्टी/खांसी है या गंभीर चोट लगी है?",
    questionBn: "অতিরিক্ত রক্তক্ষরণ, কাশির সাথে বা বমিতে রক্ত পড়া, অথবা গুরুতর আঘাত লেগেছে কি?",
    severity: "critical"
  },
  {
    id: "highFeverStiffNeck",
    category: "Meningeal / Sepsis",
    questionEn: "High fever with neck stiffness, sudden purplish rash, or extreme lethargy in a child?",
    questionHi: "तेज बुखार के साथ गर्दन में अकड़न, त्वचा पर चकत्ते या बच्चे में अत्यधिक सुस्ती?",
    questionBn: "তীব্র জ্বরের সাথে ঘাড় শক্ত হয়ে যাওয়া, গায়ে লালচে দাগ বা শিশুর অতিরিক্ত নিস্তেজ ভাব?",
    severity: "high"
  }
];

export function evaluateClinicalRuleEngine(
  symptoms: string,
  answers: Record<string, boolean>,
  age: number,
  severity: string
) {
  const flagsFound: string[] = [];
  const text = (symptoms || "").toLowerCase();

  // Keyword scans
  if (text.includes("chest") && (text.includes("pain") || text.includes("pressure") || text.includes("tight"))) {
    flagsFound.push("Cardiovascular: Chest pain/tightness detected in text");
  }
  if (text.includes("breath") || text.includes("breathing") || text.includes("suffocat")) {
    flagsFound.push("Respiratory: Dyspnea / breathing distress detected in text");
  }
  if (text.includes("stroke") || text.includes("paralysis") || text.includes("face drop") || text.includes("slur")) {
    flagsFound.push("Neurological: Stroke/paralysis indicator detected in text");
  }
  if (text.includes("blood") && (text.includes("vomit") || text.includes("cough") || text.includes("stool"))) {
    flagsFound.push("Hemorrhagic: Gastrointestinal / Respiratory bleeding detected in text");
  }

  // Structured answers check
  for (const item of RED_FLAG_CHECKLIST) {
    if (answers[item.id]) {
      flagsFound.push(`${item.category}: ${item.questionEn}`);
    }
  }

  // Pediatric & Geriatric specific rules
  if (age < 2 && (text.includes("not feeding") || text.includes("lethargic") || text.includes("diarrhea"))) {
    flagsFound.push("Pediatric IMCI Alert: Infant dehydration / poor intake risk");
  }
  if (age > 70 && severity === "severe") {
    flagsFound.push("Geriatric Vulnerability Alert: High-risk presentation in elderly citizen (>70y)");
  }

  const isEmergency = flagsFound.length > 0;
  return {
    isEmergency,
    flagsFound,
    urgencyLevel: isEmergency ? "EMERGENCY" : severity === "severe" ? "URGENT" : severity === "moderate" ? "SOON" : "ROUTINE"
  };
}
