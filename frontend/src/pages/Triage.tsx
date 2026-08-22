import { AnimatePresence, motion } from "framer-motion";
import { SearchSelect } from "../components/SearchSelect";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Bar, Btn, Chip, Field, Glass, IconAlert, IconArrow, IconImage, IconPulse, IconShield, RingGauge, SectionTitle, Toggle } from "../components/ui";
import { ConsentNotice, ErrorToast } from "../components/Feedback";
import { PrecisionDisclaimer } from "../components/PrecisionDisclaimer";
import {
  CITIES,
  PROVIDERS,
  RED_FLAGS,
  diseaseForCondition,
  type Hospital,
} from "../lib/data";
import { affordabilityPercent, computeFinances, etaMinutes, nearestEmergency, runTriage, runTriageWithImage, type TriageResult } from "../lib/engine";
import { NATIVE_INPUT_FONT } from "../lib/i18n";
import { useStore, useT } from "../lib/store";

interface FacilityRow {
  h: Hospital;
  km: number;
  cost: number;
  affordablePct: number | null;
}

const LEVEL_META: Record<number, { label: string; color: string; tone: "mint" | "cyan" | "amber" | "red" }> = {
  1: { label: "Level 1 · Routine", color: "#34f5b1", tone: "mint" },
  2: { label: "Level 2 · Prompt", color: "#4ee6f0", tone: "cyan" },
  3: { label: "Level 3 · Urgent", color: "#ffb347", tone: "amber" },
  4: { label: "Level 4 · Emergency", color: "#ff4d5e", tone: "red" },
};

export function Triage() {
  const t = useT();
  const navigate = useNavigate();
  const { lang, addCriticalCase, setLastTriage, setInsurance, insurance } = useStore();

  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [onset, setOnset] = useState("");
  const [userCity, setUserCity] = useState(CITIES[0].id);
  const [symptoms, setSymptoms] = useState("");
  const [image, setImage] = useState<{ name: string; data: string } | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  
  const [affordOpen, setAffordOpen] = useState(false);
  const [affIncome, setAffIncome] = useState("");
  const [affExpense, setAffExpense] = useState("");
  const [affProvider, setAffProvider] = useState("");
  const [affCity, setAffCity] = useState(CITIES[0].id);
  const [facilityList, setFacilityList] = useState<FacilityRow[] | null>(null);
  const [error, setError] = useState<{ message: string; retry?: () => void } | null>(null);
  const [visionConsented, setVisionConsented] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [affordLoading, setAffordLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const triageAbortRef = useRef<AbortController | null>(null);
  const affordAbortRef = useRef<AbortController | null>(null);

  const meta = result ? LEVEL_META[result.level] : null;
  const emergency = result?.emergency ?? false;

  useEffect(() => () => {
    triageAbortRef.current?.abort();
    affordAbortRef.current?.abort();
  }, []);

  

  /* ---------- image attachment (on-device) ---------- */
  const onFile = (f: File | undefined | null) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > 8 * 1024 * 1024) {
      setError({ message: "Image is too large (max 8 MB). Please choose a smaller photo." });
      return;
    }
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = () => setImage({ name: f.name, data: String(reader.result) });
    reader.readAsDataURL(f);
  };
  const clearImage = () => {
    setImageFile(null);
    setImage(null);
    setVisionConsented(false);
  };

  /* ---------- triage run ---------- */
  const submit = async () => {
    if (!symptoms.trim() || symptoms.trim().length < 8 || !age) return;
    triageAbortRef.current?.abort();
    const controller = new AbortController();
    triageAbortRef.current = controller;
    setAnalyzing(true);
    setError(null);
    setFacilityList(null);
    try {
      const active = RED_FLAGS.filter((f) => flags[f.id]).map((f) => f.id);
      // If an image is attached but no consent recorded yet, block submission.
      if (imageFile && !visionConsented) {
        setError({ message: "Please consent to image analysis (external AI service) before submitting." });
        setAnalyzing(false);
        return;
      }
      const res = imageFile
        ? await runTriageWithImage(symptoms, active, imageFile, controller.signal)
        : await runTriage(symptoms, active, controller.signal);
      if (controller.signal.aborted) return;
      setResult(res);
      setLastTriage({ symptoms, level: res.level });
      if (res.emergency) {
        addCriticalCase({
          name: "Guest patient",
          age,
          sex: sex || "—",
          cityId: userCity,
          symptoms: symptoms.trim(),
          conditions: res.matched.map((c) => c.id),
          level: res.level,
        });
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      console.error("Triage request failed", cause);
      setError({
        message: "Triage could not be completed. Check the connection and try again.",
        retry: submit,
      });
    } finally {
      if (triageAbortRef.current === controller) {
        triageAbortRef.current = null;
        setAnalyzing(false);
      }
    }
  };

  /* ---------- affordability popup ---------- */
  const openAfford = () => setAffordOpen(true);

  const submitAfford = async () => {
    const income = Number(affIncome) || 0;
    const expense = Number(affExpense) || 0;
    affordAbortRef.current?.abort();
    const controller = new AbortController();
    affordAbortRef.current = controller;
    setAffordLoading(true);
    setError(null);
    const stats = computeFinances({
      income,
      housing: expense,
      food: 0,
      transport: 0,
      school: 0,
      emi: 0,
      insurancePrem: 0,
      other: 0,
    });
    if (affProvider) {
      const p = PROVIDERS.find((x) => x.id === affProvider)!;
      setInsurance({
        providerId: p.id,
        plan: p.plans[0].name,
        type: "fam",
        coverage: 500000,
        policyNo: "",
      });
    }
    const diseaseId = result?.matched[0] ? diseaseForCondition(result.matched[0].id) : "pneumonia";
    try {
      const hits = await nearestEmergency(affCity, 4, controller.signal);
      if (controller.signal.aborted) return;
      const list: FacilityRow[] = hits.map((f) => {
        const city = CITIES.find((c) => c.id === f.hospital.cityId)!;
        const cost = estimateEmergencyCost(f.hospital, diseaseId, city.priceIndex);
        return { h: f.hospital, km: f.km, cost, affordablePct: null };
      });
      setFacilityList(list.map((f) => ({ ...f, affordablePct: affordabilityPercent(f.cost, stats) })));
      setAffordOpen(false);
    } catch (cause) {
      if (controller.signal.aborted) return;
      console.error("Affordability facility request failed", cause);
      setError({
        message: "Nearby facility matching failed. Please check the connection and try again.",
        retry: submitAfford,
      });
    } finally {
      if (affordAbortRef.current === controller) {
        affordAbortRef.current = null;
        setAffordLoading(false);
      }
    }
  };

  const font = { fontFamily: NATIVE_INPUT_FONT[lang] };
  const canSubmit = symptoms.trim().length >= 8 && age.trim() !== "" && !analyzing;

  return (
    <div>
      <SectionTitle kicker="AI · Deterministic safety gate" title={t("triage.title")} sub={t("triage.sub")} />

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* ---------------- LEFT: input ---------------- */}
        <Glass className="rounded-[6px] p-5 md:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("triage.age")}>
              <input
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="34"
                className="field"
                style={font}
              />
            </Field>
            <Field label={t("triage.sex")}>
              <select value={sex} onChange={(e) => setSex(e.target.value)} className="field" style={font}>
                <option value="">—</option>
                <option value="m">{t("triage.male")}</option>
                <option value="f">{t("triage.female")}</option>
                <option value="o">{t("triage.other")}</option>
              </select>
            </Field>
            <Field label={t("triage.duration")}>
              <select value={onset} onChange={(e) => setOnset(e.target.value)} className="field" style={font}>
                <option value="">—</option>
                <option value="d1">{t("triage.duration.1")}</option>
                <option value="d2">{t("triage.duration.2")}</option>
                <option value="d3">{t("triage.duration.3")}</option>
                <option value="d4">{t("triage.duration.4")}</option>
              </select>
            </Field>
          </div>

          <Field label={t("fac.city")} className="mt-4">
            <SearchSelect value={userCity} onChange={setUserCity} options={CITIES.map(c => ({ value: c.id, label: c.nameKey }))} />
          </Field>

          <Field label={t("triage.symptoms")} className="mt-4">
            <div className="relative">
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder={t("triage.symptoms.ph")}
                rows={6}
                className="field resize-none pb-14 leading-relaxed"
                style={font}
              />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div></div>
                  <span className="text-[10px] tracking-wider text-mist/50">{symptoms.length}</span>
                </div>
            </div>
          </Field>

          {/* image zone */}
          <Field label={t("triage.image")} className="mt-4">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {image ? (
              <div className="flex items-center gap-3 rounded-[4px] border border-mint/25 bg-mint/[0.04] p-3">
                <img src={image.data} alt={image.name} className="h-14 w-14 rounded-[3px] border border-white/10 object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-frost">{image.name}</div>
                  <div className="mt-0.5 text-[10.5px] text-mint/70">{t("triage.image.ph").split("—")[0]}</div>
                </div>
                <button onClick={clearImage} className="rounded-[3px] border border-white/10 px-2 py-1 text-[10.5px] text-mist hover:text-frost">
                  {t("triage.image.clear")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files?.[0]);
                }}
                className="flex w-full flex-col items-center gap-2 rounded-[4px] border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center transition-colors hover:border-cyanx/40 hover:bg-cyanx/[0.03]"
              >
                <IconImage size={22} className="text-cyanx" />
                <span className="text-[11.5px] leading-snug text-mist">{t("triage.image.ph")}</span>
              </button>
            )}
          </Field>

          {/* V3 consent notice — only when image is attached */}
          {imageFile && (
            <ConsentNotice
              className="mt-3"
              dataLabel="photo"
              destination="an external AI service for image-assisted triage"
              consented={visionConsented}
              onConsent={() => setVisionConsented(true)}
              onRevoke={() => setVisionConsented(false)}
            />
          )}

          {/* deterministic safety checklist */}
          <div className="mt-6">
            <div className="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-danger">
              <IconShield size={13} />
              {t("triage.checklist")}
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-mist/70">{t("triage.checklist.sub")}</p>
            <div className="divide-y divide-white/[0.05] rounded-[4px] border border-white/[0.06]">
              {RED_FLAGS.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className={`text-[12.5px] font-medium ${flags[f.id] ? "text-danger" : "text-frost"}`}>
                      {t(f.labelKey)}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-mist/60">{t(f.hintKey)}</div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${flags[f.id] ? "text-danger" : "text-mist/50"}`}>
                      {t(flags[f.id] ? "triage.yes" : "triage.no")}
                    </span>
                    <Toggle danger checked={!!flags[f.id]} onChange={(v) => setFlags((s) => ({ ...s, [f.id]: v }))} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Btn onClick={submit} disabled={!canSubmit} className="mt-5 w-full py-3 text-[14px]">
            {analyzing ? t("triage.running") : t("triage.submit")}
          </Btn>
          {error && <ErrorToast message={error.message} onRetry={error.retry} onDismiss={() => setError(null)} />}
        </Glass>

        {/* ---------------- RIGHT: results ---------------- */}
        <Glass className="min-h-[560px] rounded-[6px] p-5 md:p-6">
          <AnimatePresence mode="wait">
            {analyzing ? (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full min-h-[480px] flex-col items-center justify-center gap-5"
              >
                <div className="relative h-16 w-16">
                  <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
                    <motion.circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="#4ee6f0"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="176"
                      animate={{ rotate: [0, 360] }}
                      transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                      style={{ transformOrigin: "center" }}
                    />
                  </svg>
                </div>
                <motion.p
                  className="text-[13px] font-medium text-mist"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                >
                  {t("triage.running")}…
                </motion.p>
              </motion.div>
            ) : result ? (
              <motion.div key="result" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                {/* emergency alert */}
                {emergency && (
                  <motion.div
                    className="mb-5 rounded-[6px] border border-danger/50 bg-danger/[0.08] p-5 backdrop-blur-2xl"
                    animate={{ boxShadow: ["0 0 0px rgba(255,77,94,0)", "0 0 44px rgba(255,77,94,0.4)", "0 0 0px rgba(255,77,94,0)"] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <div className="flex items-center gap-3">
                      <IconAlert size={26} className="emergency-pulse text-danger" />
                      <h3 className="font-display text-[19px] font-bold tracking-tight text-danger text-glow-red">
                        {t("triage.emergency.title")}
                      </h3>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-frost/90">{t("triage.emergency.body")}</p>
                    <div className="mt-4">
                      <Btn variant="danger" onClick={openAfford}>
                        {t("triage.emergency.nearby")}
                      </Btn>
                    </div>
                    <p className="mt-3 text-[10.5px] text-danger/70">{t("triage.alert.recorded")}</p>
                  </motion.div>
                )}

                {/* level */}
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
                  <RingGauge value={result.level * 25} color={meta!.color} danger={emergency} size={128} stroke={10} />
                  <div className="text-center sm:text-left">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mist/70">
                      {t("triage.level")}
                    </div>
                    <div className={`mt-1 font-display text-[20px] font-bold ${emergency ? "text-danger text-glow-red" : "text-frost"}`}>
                      {meta!.label}
                    </div>
                    <Chip tone={meta!.tone} className="mt-2">
                      {t("triage.conf")} {result.confidence}%
                    </Chip>
                  </div>
                </div>

                {!emergency && (
                  <motion.p
                    className="mt-5 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12.5px] leading-relaxed text-mist"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <span className="mr-1.5 font-semibold text-mint">{t("triage.normal.title")}</span>
                    {t("triage.normal.body")}
                  </motion.p>
                )}

                {/* conditions */}
                <div className="mt-5">
                  <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-mist/70">
                    {t("triage.possible")}
                  </div>
                  <div className="space-y-2">
                    {result.matched.length ? (
                      result.matched.map((c, i) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.15 + i * 0.08 }}
                          className="flex items-center justify-between gap-3 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
                        >
                          <span className="text-[13px] font-medium text-frost">{t(c.nameKey)}</span>
                          <Chip tone={LEVEL_META[c.level].tone}>{LEVEL_META[c.level].label.split(" · ")[0]}</Chip>
                        </motion.div>
                      ))
                    ) : (
                      <p className="text-[12.5px] text-mist/60">
                        {t("triage.idle.body").split(".")[0]} — describe more symptoms for scoring.
                      </p>
                    )}
                  </div>
                </div>

                {/* coverage / confidence */}
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <div className="mb-1.5 flex justify-between text-[11px]">
                      <span className="text-mist">{t("triage.coverage")}</span>
                      <span className="font-semibold text-frost">{result.coverage}%</span>
                    </div>
                    <Bar value={result.coverage} tone="cyan" />
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between text-[11px]">
                      <span className="text-mist">{t("triage.conf")}</span>
                      <span className="font-semibold text-frost">{result.confidence}%</span>
                    </div>
                    <Bar value={result.confidence} tone="mint" />
                  </div>
                </div>

                {/* advice */}
                {result.advice.length > 0 && (
                  <div className="mt-5">
                    {result.advice.map((a, i) => (
                      <motion.p
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        className="mb-2 flex gap-2.5 rounded-[4px] border-l-2 border-cyanx/50 bg-cyanx/[0.04] px-4 py-2.5 text-[12px] leading-relaxed text-frost/85"
                      >
                        <IconPulse size={14} className="mt-0.5 shrink-0 text-cyanx" />
                        {a}
                      </motion.p>
                    ))}
                  </div>
                )}

                {/* V3: surface vision_escalated transparently */}
                {result.safety_audit?.vision_escalated && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mt-5 rounded-[4px] border border-amber/30 bg-amber/[0.05] px-4 py-3 text-[12px] leading-relaxed text-amber"
                    role="status"
                  >
                    <span className="font-semibold">Note</span> Based on the photo, we have raised the urgency of this assessment. The text-only pathway did not flag this case as emergency on its own.
                 </motion.div>
                )}

                {/* checklist report */}
                <div className="mt-5 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-mist/70">
                    {t("triage.report")}
                  </div>
                  <p className={`mt-1.5 text-[12px] ${emergency ? "text-danger" : "text-mint"}`}>
                    {emergency
                      ? t("triage.report.unsafe") + " · " + result.flags.join(", ")
                      : t("triage.report.safe")}
                  </p>
                </div>
                
                {/* V3 Global Precision Disclaimer */}
                {(result.disclaimer || result.verified_sources) && (
                  <PrecisionDisclaimer disclaimer={result.disclaimer || ""} sources={result.verified_sources || []} />
                )}

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Btn variant="ghost" onClick={() => navigate("/asha")}>
                    {t("triage.book")}
                  </Btn>
                  <Btn variant="ghost" onClick={() => setResult(null)}>
                    {t("triage.clear")}
                  </Btn>
                </div>

                {/* facility list after affordability */}
                {facilityList && (
                  <motion.div
                    className="mt-6 border-t border-white/[0.06] pt-5"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mint">
                      {t("triage.afford.est", { city: CITIES.find((c) => c.id === affCity)?.nameKey ?? "" })}
                    </div>
                    <div className="space-y-3">
                      {facilityList.map((f, i) => {
                        const accepted = insurance ? providerNetworkCheck(insurance.providerId, f.h.id) : null;
                        const pct = f.affordablePct ?? 0;
                        return (
                          <motion.div
                            key={f.h.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="rounded-[5px] border border-white/[0.07] bg-white/[0.02] p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[13.5px] font-semibold text-frost">{f.h.name}</div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <Chip tone="cyan">{t("common.score")} {f.h.score}</Chip>
                                  <Chip>{f.km} {t("common.km")} · {etaMinutes(f.km, f.h.cityId)} {t("common.mins")}</Chip>
                                  {f.h.pmjay && <Chip tone="mint" glow>{t("common.pmjay")}</Chip>}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-display text-[15px] font-semibold text-frost">
                                  ₹{Math.round(f.cost).toLocaleString("en-IN")}
                                </div>
                                <div className="text-[10px] text-mist/60">{t("triage.afford.month", { amt: "₹" + Math.round(f.cost / 12).toLocaleString("en-IN") })}</div>
                              </div>
                            </div>
                            {accepted && (
                              <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-mint">
                                <IconShield size={12} />
                                {accepted} {t("fac.accepted")}
                              </div>
                            )}
                            <div className="mt-2.5">
                              <div className="mb-1 flex justify-between text-[10.5px]">
                                <span className="text-mist">{t("triage.afford.pct")}</span>
                                <span className={pct >= 60 ? "text-mint" : pct >= 35 ? "text-amber" : "text-danger"}>{pct}%</span>
                              </div>
                              <Bar value={pct} tone={pct >= 60 ? "mint" : pct >= 35 ? "amber" : "red"} />
                            </div>
                            <button
                              onClick={() => navigate("/facilities", { state: { facilityId: f.h.id } })}
                              className="mt-3 flex items-center gap-1.5 text-[11.5px] font-semibold text-cyanx transition-colors hover:text-frost"
                            >
                              {t("triage.viewmap")}
                              <IconArrow size={12} />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full min-h-[480px] flex-col items-center justify-center text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyanx/25 bg-cyanx/[0.05] text-cyanx">
                  <IconPulse size={24} />
                </div>
                <h3 className="mt-4 font-display text-[16px] font-semibold text-frost">{t("triage.idle.title")}</h3>
                <p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-mist">{t("triage.idle.body")}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </Glass>
      </div>

      {/* affordability modal */}
      <Modal
        open={affordOpen}
        onClose={() => setAffordOpen(false)}
        title={t("triage.afford.title")}
        sub={t("triage.afford.sub")}
      >
        <div className="space-y-4">
          <Field label={t("triage.afford.household")}>
            <input
              inputMode="numeric"
              value={affIncome}
              onChange={(e) => setAffIncome(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="18000"
              className="field"
              style={font}
            />
          </Field>
          <Field label={t("triage.afford.expenses")}>
            <input
              inputMode="numeric"
              value={affExpense}
              onChange={(e) => setAffExpense(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="12500"
              className="field"
              style={font}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("triage.afford.insurance")}>
              <select value={affProvider} onChange={(e) => setAffProvider(e.target.value)} className="field" style={font}>
                <option value="">{t("common.none")}</option>
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("fac.city")}>
              <SearchSelect value={affCity} onChange={setAffCity} options={CITIES.map(c => ({ value: c.id, label: c.nameKey }))} />
            </Field>
          </div>
          <Btn onClick={submitAfford} disabled={affordLoading} className="w-full">
            {affordLoading ? "Matching facilities…" : t("triage.afford.submit")}
          </Btn>
          {error && <ErrorToast message={error.message} onRetry={error.retry} onDismiss={() => setError(null)} />}
        </div>
      </Modal>
    </div>
  );
}

import { diseaseById, providerById } from "../lib/data";

function providerNetworkCheck(providerId: string, hospitalId: string): string | null {
  const p = providerById(providerId);
  return p.network.includes(hospitalId) ? p.name : null;
}

/** critical-episode cost at a specific hospital, using the best disease benchmark */
function estimateEmergencyCost(h: Hospital, diseaseId: string, cityIndex: number): number {
  const d = diseaseById(diseaseId);
  return Math.round(d.base[3] * h.priceIndex * cityIndex);
}
