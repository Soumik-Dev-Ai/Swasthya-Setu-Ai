// Phase-6 audit helper: list `en` keys missing from each Indic dictionary.
import { readFileSync } from "fs";

const src = readFileSync("src/i18n.ts", "utf8");
function keys(name) {
  const m = src.match(new RegExp(`const ${name}: Dict = \\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error("dict not found: " + name);
  return new Set([...m[1].matchAll(/"([a-zA-Z0-9._]+)":/g)].map((x) => x[1]));
}
const en = keys("en");
console.log("en total keys:", en.size);
let worst = 0;
for (const loc of ["hi", "bn", "te", "ur", "mr", "ta", "kn", "gu"]) {
  const missing = [...en].filter((k) => !keys(loc).has(k));
  worst = Math.max(worst, missing.length);
  console.log(`${loc}: ${missing.length} missing${missing.length ? " -> " + missing.join(" ") : ""}`);
}
console.log(worst === 0 ? "ALL LOCALES COMPLETE" : "GAPS REMAIN");
