import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Stethoscope, Baby, PersonStanding, Accessibility, AlertTriangle, MapPin, Phone, RotateCcw, ChevronLeft, ChevronRight, Loader2, ImagePlus, X, CheckCircle2, BadgeCheck, ExternalLink } from "lucide-react";
import { StaggerWords, SPRING_SOFT, PulseBadge, LangFade } from "../lib/motion";
import { useT } from "../i18n";
import { analyzeTriage, analyzeTriageText, type TriageResult } from "../lib/api";

const SYMPTOM_WEIGHTS: Record<string, number> = {
  "sy.fever": 1, "sy.cough": 1, "sy.headache": 1, "sy.chest": 3, "sy.breath": 3,
  "sy.stomach": 2, "sy.diarrhea": 2, "sy.fatigue": 1, "sy.rash": 1, "sy.dizzy": 2, "sy.joint": 1, "sy.throat": 1,
};

const LEVELS = [
  { key: "tr.l1", color: "var(--safe)", soft: "color-mix(in oklab, var(--safe) 12%, transparent)" },
  { key: "tr.l2", color: "var(--caution)", soft: "color-mix(in oklab, var(--caution) 12%, transparent)" },
  { key: "tr.l3", color: "var(--urgent)", soft: "color-mix(in oklab, var(--urgent) 12%, transparent)" },
  { key: "tr.l4", color: "var(--emergency)", soft: "color-mix(in oklab, var(--emergency) 12%, transparent)" },
];

export default function Triage() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState<number | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [factors, setFactors] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* description + image upload + duration + severity */
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(f);
    setImageFile(f);
    e.target.value = "";
  };

  // doc 27 item 6 — hard guard: a level outside [1,4] must fail visibly,
  // never index LEVELS out of bounds nor silently render a wrong badge.
  const levelOutOfRange =
    result != null && !(Number.isInteger(result.level) && result.level >= 1 && result.level <= 4);
  const level = levelOutOfRange ? null : result ? result.level - 1 : null;

  // Phase 3 item 3B: the UI age is an index (0=child, 1=adult, 2=senior);
  // the backend's TriageAnalyzeRequest.age is `str | None` — map BEFORE
  // sending or FastAPI rejects the number with a 422.
  const AGE_STR = ["child", "adult", "senior"] as const;

  const analyze = async () => {
    setAnalyzing(true);
    setError(null);
    const ageStr = age !== null ? AGE_STR[age] : undefined;
    // duration/severity have no backend request fields — they ride along as
    // clinical context inside the symptom text so the form state is never
    // silently dropped (no unmodeled JSON keys are sent).
    const parts = [description, ...symptoms.map((s) => t(s))];
    if (duration) parts.push(`${t("tr.duration")}: ${t(duration)}`);
    if (severity) parts.push(`${t("tr.severity")}: ${t(severity)}`);
    const text = parts.filter(Boolean).join(". ");
    const flagValues = factors.map((f) => t(f));
    try {
      if (imageFile) {
        setResult(await analyzeTriage(text, flagValues, imageFile, ageStr));
      } else {
        setResult(await analyzeTriageText(text, flagValues, true, ageStr));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const canNext = step === 0 ? age !== null : step === 1 ? symptoms.length > 0 : true;

  return (
    <LangFade lang={lang}>
      <div className="wash-coral -mx-4 min-h-dvh px-4 pt-10 sm:-mx-6 sm:px-6">
        <StaggerWords text={t("tr.title")} className="font-display text-4xl font-bold tracking-tight sm:text-5xl" />
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.4 }} className="mt-3 max-w-xl text-[15px]" style={{ color: "var(--fg-muted)" }}>
          {t("tr.sub")}
        </motion.p>

        {/* step indicator */}
        <div className="mt-8 flex items-center gap-2">
          {[t("tr.step1"), t("tr.step2"), t("tr.step3")].map((label, i) => (
            <button key={i} onClick={() => { if (i < step) setStep(i); }} className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all"
                style={{ background: i <= step ? "var(--coral)" : "var(--bg-surface)", color: i <= step ? "#fff" : "var(--fg-subtle)", border: "1px solid var(--border)" }}
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span className="hidden text-xs font-bold sm:inline" style={{ color: i === step ? "var(--fg)" : "var(--fg-subtle)" }}>{label}</span>
              {i < 2 && <span className="mx-1 h-px w-8" style={{ background: i < step ? "var(--coral)" : "var(--border)" }} />}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
            {error && (
              <p className="mb-4 rounded-2xl border p-4 text-sm font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>
                {error}
              </p>
            )}
            {result != null ? (
              levelOutOfRange ? (
                <motion.div key="bad" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-10 text-center">
                  <AlertTriangle size={32} className="mx-auto" style={{ color: "var(--emergency)" }} />
                  <h2 className="mt-4 font-display text-xl font-bold">{t("tr.result")}</h2>
                  <p className="mt-2 text-sm font-semibold" style={{ color: "var(--emergency)" }}>
                    Unexpected severity level ({String(result.level)}). Please try again or contact support.
                  </p>
                  <motion.button whileTap={{ scale: 0.94 }} onClick={() => { setResult(null); setStep(0); setSymptoms([]); setFactors([]); setAge(null); }} className="mt-6 rounded-full border px-6 py-3 text-sm font-bold" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
                    <RotateCcw size={15} className="me-1 inline" /> {t("c.retake")}
                  </motion.button>
                </motion.div>
              ) : (
              /* ── RESULT ── full clinical card (phase 3 item 3C) */
              <motion.div key="result" initial={{ opacity: 0, y: 40, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={SPRING_SOFT} className="glass rounded-3xl p-8 sm:p-10">
                {/* 1 — level header + overall confidence */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="font-display text-2xl font-bold">{t("tr.result")}</h2>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "color-mix(in oklab, var(--fg) 6%, transparent)", color: "var(--fg-muted)" }}>
                      {t("tr.confidence")}: {result.confidence ?? 0}%
                    </span>
                    {level === 3 ? (
                      <PulseBadge color="var(--emergency)">
                        <AlertTriangle size={15} className="me-1 inline" /> {t("tr.l4")}
                      </PulseBadge>
                    ) : (
                      <span className="rounded-full px-4 py-1.5 text-sm font-bold text-white" style={{ background: LEVELS[level!].color }}>{t(LEVELS[level!].key)}</span>
                    )}
                  </div>
                </div>

                {/* 2 — matched conditions (stagger 0.15s) */}
                {(result.matched?.length ?? 0) > 0 && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.15 }}>
                    <h3 className="mt-7 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>{t("tr.matched")}</h3>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {result.matched.map((m, i) => (
                        <motion.span
                          key={m.id}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ ...SPRING_SOFT, delay: 0.2 + i * 0.05 }}
                          className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
                          style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--fg)" }}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LEVELS[Math.max(0, Math.min(3, (m.level || 1) - 1))].color }} />
                          {m.nameKey}
                          <span className="text-[10px] font-bold" style={{ color: "var(--fg-subtle)" }}>L{m.level}</span>
                        </motion.span>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 3 — clinical advice (stagger 0.3s) */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.3 }} className="mt-7 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--fg) 4%, var(--bg-surface))" }}>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--coral)" }}>{t("tr.advice")}</h3>
                  <ul className="mt-2.5 space-y-1.5">
                    {(result.advice?.length ? result.advice : [t(`tr.a${level! + 1}`)]).map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-[15px] leading-relaxed" style={{ color: "var(--fg)" }}>
                        <CheckCircle2 size={15} className="mt-1 shrink-0" style={{ color: "var(--coral)" }} /> {a}
                      </li>
                    ))}
                  </ul>
                </motion.div>

                {/* 4 — vision analysis (stagger 0.45s, conditional) */}
                {result.vision_signal && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.45 }} className="mt-7 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--lavender)" }}>{t("tr.vision")}</h3>
                    <div className="mt-3 flex flex-wrap items-start gap-4">
                      {image && (
                        <img src={image} alt="" className="h-24 w-24 shrink-0 rounded-2xl border object-cover" style={{ borderColor: "var(--border)" }} />
                      )}
                      <div className="min-w-0 flex-1 space-y-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--bg)", color: "var(--fg)" }}>{result.vision_signal.visual_symptom_category}</span>
                          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: result.vision_signal.visual_urgency_signal === "emergency" ? "var(--emergency)" : result.vision_signal.visual_urgency_signal === "non_serious" ? "var(--mint)" : "var(--amber)" }}>
                            {result.vision_signal.visual_urgency_signal}
                          </span>
                          <span className="text-xs font-bold" style={{ color: "var(--fg-subtle)" }}>{result.vision_signal.confidence}%</span>
                        </div>
                        {result.vision_signal.reason && <p className="leading-relaxed">{result.vision_signal.reason}</p>}
                        {result.vision_signal.grounding_verified && (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>
                            <BadgeCheck size={13} /> {t("tr.grounded")}{result.vision_signal.grounding_reference ? `: ${result.vision_signal.grounding_reference}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 5 — grounded reasoning finding (stagger 0.6s, conditional) */}
                {result.reasoning && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.6 }} className="mt-7 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sky)" }}>{t("tr.reasoning")}</h3>
                    <div className="mt-3 space-y-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--sky-soft)", color: "var(--sky)" }}>{result.reasoning.finding_category || "—"}</span>
                        <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: result.reasoning.severity_signal === "emergency" ? "var(--emergency)" : result.reasoning.severity_signal === "non_serious" ? "var(--mint)" : "var(--amber)" }}>
                          {result.reasoning.severity_signal}
                        </span>
                        <span className="text-xs font-bold" style={{ color: "var(--fg-subtle)" }}>{result.reasoning.confidence}%</span>
                      </div>
                      {result.reasoning.reason && <p className="leading-relaxed">{result.reasoning.reason}</p>}
                      {result.reasoning.grounding_reference && (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: result.reasoning.grounding_verified ? "var(--mint-soft)" : "var(--amber-soft)", color: result.reasoning.grounding_verified ? "var(--mint)" : "var(--amber)" }}>
                          <BadgeCheck size={13} /> {t("tr.citation")}: {result.reasoning.grounding_reference}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 6 — verified sources (stagger 0.75s, conditional) */}
                {(result.verified_sources?.length ?? 0) > 0 && (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.75 }}>
                    <h3 className="mt-7 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sky)" }}>{t("tr.sources")}</h3>
                    <ul className="mt-3 space-y-1.5">
                      {result.verified_sources!.map((s, i) => (
                        <li key={i}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold underline-offset-2 hover:underline" style={{ color: "var(--sky)" }}>
                            <ExternalLink size={13} className="shrink-0" /> {s.title || s.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}

                {/* 7 — bottom actions + mandatory static disclaimer */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-8 flex flex-wrap gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate("/app/facilities")} className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white" style={{ background: "var(--coral)", boxShadow: "0 12px 30px -12px var(--coral)" }}>
                    <MapPin size={16} /> {t("tr.find")}
                  </motion.button>
                  {level! >= 2 && (
                    <motion.a
                      whileTap={{ scale: 0.95 }}
                      href="tel:108"
                      className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold"
                      style={{ background: "var(--emergency)", color: "#fff", boxShadow: "0 12px 30px -12px var(--emergency)" }}
                    >
                      <Phone size={16} /> {t("tr.call108")}
                    </motion.a>
                  )}
                  {level! >= 2 && (
                    <motion.a
                      whileTap={{ scale: 0.95 }}
                      href="https://www.google.com/maps/search/emergency+hospital+near+me"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
                      style={{ background: "var(--mint)", boxShadow: "0 12px 30px -12px var(--mint)" }}
                    >
                      <MapPin size={16} /> Directions
                    </motion.a>
                  )}
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setResult(null); setStep(0); setSymptoms([]); setFactors([]); setAge(null); }} className="flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
                    <RotateCcw size={15} /> {t("c.retake")}
                  </motion.button>
                </motion.div>
                <p className="mt-6 text-xs font-semibold leading-relaxed" style={{ color: "var(--fg-subtle)" }}>
                  {t("tr.disclaimer")}
                </p>
              </motion.div>
              )
            ) : (
              <motion.div key={step} initial={{ opacity: 0, x: 60, filter: "blur(6px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -60, filter: "blur(6px)" }} transition={SPRING_SOFT}>
                {step === 0 && (
                  <div>
                    <h2 className="mb-6 font-display text-2xl font-bold">{t("tr.step1")}</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {[
                        { icon: Baby, key: "tr.child" },
                        { icon: PersonStanding, key: "tr.adult" },
                        { icon: Accessibility, key: "tr.senior" },
                      ].map((o, i) => (
                        <motion.button
                          key={o.key}
                          whileHover={{ y: -6 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setAge(i)}
                          className="flex flex-col items-center gap-3 rounded-3xl border p-8 transition-colors"
                          style={{ borderColor: age === i ? "var(--coral)" : "var(--border)", background: age === i ? "var(--coral-soft)" : "var(--bg-surface)" }}
                        >
                          <o.icon size={40} strokeWidth={1.5} style={{ color: age === i ? "var(--coral)" : "var(--fg-subtle)" }} />
                          <span className="font-display text-lg font-bold">{t(o.key)}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <h2 className="mb-1 font-display text-2xl font-bold">{t("tr.step2")}</h2>
                    <p className="mb-6 text-sm" style={{ color: "var(--fg-muted)" }}>{t("tr.symptoms")} — <b style={{ color: "var(--coral)" }}>{symptoms.length}</b> {t("tr.selected")}</p>
                    <div className="flex flex-wrap gap-2.5">
                      {Object.keys(SYMPTOM_WEIGHTS).map((sk, i) => {
                        const on = symptoms.includes(sk);
                        return (
                          <motion.button
                            key={sk}
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ ...SPRING_SOFT, delay: i * 0.03 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggle(symptoms, setSymptoms, sk)}
                            className="rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors"
                            style={{ borderColor: on ? "var(--coral)" : "var(--border)", background: on ? "var(--coral)" : "var(--bg-surface)", color: on ? "#fff" : "var(--fg-muted)" }}
                          >
                            {on ? "✓ " : ""}{t(sk)}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* describe + image upload */}
                    <div className="mt-8 grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto]">
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("tr.describe")}</label>
                        <textarea
                          rows={3}
                          className="input-line resize-none"
                          style={{ ["--accent" as any]: "var(--coral)" }}
                          placeholder={t("tr.describePh")}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => fileRef.current?.click()}
                          aria-label={t("tr.upload")}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed"
                          style={{ borderColor: image ? "var(--coral)" : "var(--border)", background: "var(--bg-surface)" }}
                        >
                          {image ? (
                            <>
                              <img src={image} alt="" className="h-full w-full object-cover" />
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImage(null);
                                  setImageFile(null);
                                  if (fileRef.current) fileRef.current.value = "";
                                }}
                                className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-white"
                                style={{ background: "var(--emergency)" }}
                              >
                                <X size={11} />
                              </span>
                            </>
                          ) : (
                            <ImagePlus size={22} style={{ color: "var(--coral)" }} />
                          )}
                        </motion.button>
                      </div>
                    </div>

                    {/* duration + severity */}
                    <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {[
                        { label: t("tr.duration"), val: duration, set: setDuration, opts: ["tr.dur1", "tr.dur2", "tr.dur3", "tr.dur4"] },
                        { label: t("tr.severity"), val: severity, set: setSeverity, opts: ["tr.sev1", "tr.sev2", "tr.sev3", "tr.sev4"] },
                      ].map((sec) => (
                        <div key={sec.label}>
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{sec.label}</label>
                          <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
                            {sec.opts.map((ok) => {
                              const on = sec.val === ok;
                              return (
                                <motion.button
                                  key={ok}
                                  whileTap={{ scale: 0.92 }}
                                  onClick={() => sec.set(on ? null : ok)}
                                  className="rounded-full border px-3.5 py-2 text-xs font-bold transition-colors"
                                  style={{ borderColor: on ? "var(--coral)" : "var(--border)", background: on ? "var(--coral)" : "transparent", color: on ? "#fff" : "var(--fg-muted)" }}
                                >
                                  {t(ok)}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <h2 className="mb-1 flex items-center gap-2 font-display text-2xl font-bold">
                      <AlertTriangle size={22} style={{ color: "var(--urgent)" }} /> {t("tr.step3")}
                    </h2>
                    <p className="mb-6 text-sm" style={{ color: "var(--fg-muted)" }}>{t("tr.factors")}</p>
                    <div className="flex flex-col gap-3">
                      {["tr.f1", "tr.f2", "tr.f3", "tr.f4", "tr.f5", "tr.f6"].map((fk) => {
                        const on = factors.includes(fk);
                        return (
                          <motion.button
                            key={fk}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => toggle(factors, setFactors, fk)}
                            className="flex items-center justify-between rounded-2xl border px-5 py-4 text-start transition-colors"
                            style={{ borderColor: on ? "var(--urgent)" : "var(--border)", background: on ? "color-mix(in oklab, var(--urgent) 10%, var(--bg-surface))" : "var(--bg-surface)" }}
                          >
                            <span className="text-[15px] font-semibold">{t(fk)}</span>
                            <motion.span
                              animate={{ background: on ? "var(--urgent)" : "var(--border)" }}
                              className="flex h-6 w-11 items-center rounded-full px-0.5"
                              transition={{ duration: 0.2 }}
                            >
                              <motion.span animate={{ x: on ? 20 : 0 }} transition={SPRING_SOFT} className="h-5 w-5 rounded-full bg-white shadow" />
                            </motion.span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* nav buttons */}
                <div className="mt-8 flex items-center justify-between gap-4">
                  <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold transition-opacity" style={{ color: "var(--fg-muted)", opacity: step === 0 ? 0.35 : 1 }}>
                    <ChevronLeft size={16} /> {t("c.back")}
                  </button>
                  {step === 0 ? (
                    <motion.button whileTap={{ scale: 0.94 }} disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="flex items-center gap-1.5 rounded-full px-7 py-3 text-sm font-bold text-white transition-opacity" style={{ background: "var(--coral)", boxShadow: "0 12px 30px -12px var(--coral)", opacity: canNext ? 1 : 0.4 }}>
                      {t("c.next")} <ChevronRight size={16} />
                    </motion.button>
                  ) : step === 1 ? (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      whileHover={{ scale: 1.02 }}
                      transition={SPRING_SOFT}
                      disabled={symptoms.length === 0 && !description.trim()}
                      onClick={analyze}
                      className="flex-1 rounded-full py-3.5 text-sm font-bold text-white transition-opacity sm:max-w-md"
                      style={{ background: "var(--coral)", boxShadow: "0 14px 34px -12px var(--coral)", opacity: symptoms.length === 0 && !description.trim() ? 0.4 : 1 }}
                    >
                      {analyzing ? (
                        <><Loader2 size={16} className="animate-spin inline" /> {t("tr.analyzing")}</>
                      ) : (
                        <>{t("tr.analyze")} →</>
                      )}
                    </motion.button>
                  ) : (
                    <motion.button whileTap={{ scale: 0.94 }} onClick={analyze} disabled={analyzing} className="flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-white" style={{ background: "var(--coral)", boxShadow: "0 12px 30px -12px var(--coral)" }}>
                      {analyzing ? (
                        <><Loader2 size={16} className="animate-spin" /> {t("tr.analyzing")}</>
                      ) : (
                        <><Stethoscope size={16} /> {t("tr.result")} →</>
                      )}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
        </div>
      </div>
    </LangFade>
  );
}
