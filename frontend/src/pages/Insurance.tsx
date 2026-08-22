import { AnimatePresence, motion } from "framer-motion";
import { SearchSelect } from "../components/SearchSelect";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  Btn,
  Chip,
  ErrorToast,
  Field,
  Glass,
  IconAlert,
  IconArrow,
  IconShield,
  RingGauge,
  SectionTitle,
  Tabs,
} from "../components/ui";
import { INDIAN_STATES, PROVIDERS, providerById } from "../lib/data";
import { analysePolicy, matchSchemes, type CoverageReport, type SchemeMatch } from "../lib/engine";
import { NATIVE_INPUT_FONT } from "../lib/i18n";
import { useStore, useT } from "../lib/store";

/* ---------------- Sub-tab A: Policy Checker ---------------- */

function PolicyTab() {
  const t = useT();
  const { lang, insurance, setInsurance } = useStore();

  const [providerId, setProviderId] = useState(insurance?.providerId ?? PROVIDERS[1].id);
  const [plan, setPlan] = useState(insurance?.plan ?? providerById(insurance?.providerId ?? PROVIDERS[1].id).plans[0].name);
  const [type, setType] = useState(insurance?.type ?? "ind");
  const [coverage, setCoverage] = useState(String(insurance?.coverage ?? 500000));
  const [policyNo, setPolicyNo] = useState(insurance?.policyNo ?? "");
  const [report, setReport] = useState<CoverageReport | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const font = { fontFamily: NATIVE_INPUT_FONT[lang] };
  const provider = providerById(providerId);

  useEffect(() => () => requestRef.current?.abort(), []);

  const analyse = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const cov = Number(coverage) || 0;
    setAnalysing(true);
    setError("");
    try {
      const rep = await analysePolicy(cov, type, provider.network, controller.signal);
      if (controller.signal.aborted) return;
      setReport(rep);
      setInsurance({ providerId, plan, type, coverage: cov, policyNo });
      setSavedNote(true);
      window.setTimeout(() => setSavedNote(false), 2200);
    } catch (cause) {
      if (controller.signal.aborted) return;
      console.error("Policy analysis failed", cause);
      setError("Policy analysis failed. Check the connection and try again.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setAnalysing(false);
      }
    }
  };

  const riskColor = report?.risk === "high" ? "#ff4d5e" : report?.risk === "med" ? "#ffb347" : "#34f5b1";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5"
    >
      <Glass className="rounded-[6px] p-5 lg:col-span-2 md:p-6">
        <Field label={t("ins.provider")}>
          <SearchSelect value={providerId} onChange={(val) => { setProviderId(val); setPlan(providerById(val).plans[0].name); }} options={PROVIDERS.map(p => ({ value: p.id, label: p.name }))} />
        </Field>
        <Field label={t("ins.plan")} className="mt-4">
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="field" style={font}>
            {provider.plans.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("ins.type")}>
            <select value={type} onChange={(e) => setType(e.target.value)} className="field" style={font}>
              <option value="ind">{t("ins.type.ind")}</option>
              <option value="fam">{t("ins.type.fam")}</option>
            </select>
          </Field>
          <Field label={t("ins.coverage")}>
            <input
              inputMode="numeric"
              value={coverage}
              onChange={(e) => setCoverage(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="500000"
              className="field"
              style={font}
            />
          </Field>
        </div>
        <Field label={t("ins.policy.no")} className="mt-4">
          <input
            value={policyNo}
            onChange={(e) => setPolicyNo(e.target.value)}
            placeholder={t("ins.policy.ph")}
            className="field"
            style={font}
          />
        </Field>
        <Btn onClick={analyse} disabled={analysing} className="mt-5 w-full">
          {analysing ? "Checking policy…" : t("ins.analyze")}
        </Btn>
        {error && <ErrorToast message={error} onRetry={analyse} onDismiss={() => setError("")} />}
        <AnimatePresence>
          {savedNote && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-1.5 text-[11px] text-mint"
            >
              <IconShield size={12} />
              {t("ins.report.verified")} · {t("home.sync")}
            </motion.p>
          )}
        </AnimatePresence>
      </Glass>

      <div className="space-y-4 lg:col-span-3">
        <AnimatePresence mode="wait">
          {!report ? (
            <motion.div key="noreport" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Glass className="flex min-h-[320px] flex-col items-center justify-center rounded-[6px] p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyanx/25 bg-cyanx/[0.05] text-cyanx">
                  <IconShield size={22} />
                </div>
                <p className="mt-4 max-w-sm text-[12.5px] leading-relaxed text-mist">{t("ins.report.none")}</p>
              </Glass>
            </motion.div>
          ) : (
            <motion.div key="report" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <Glass className="rounded-[6px] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-[16px] font-semibold text-frost">{t("ins.gap.title")}</h3>
                    <p className="mt-1 text-[12px] text-mist">
                      {t("ins.gap.sub", {
                        provider: provider.name,
                        plan,
                        type: t(type === "ind" ? "ins.type.ind" : "ins.type.fam"),
                        coverage: Number(coverage).toLocaleString("en-IN"),
                      })}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Chip tone="mint">{t("ins.report.verified")}</Chip>
                      <Chip tone="cyan">{report.inNetworkCount} hospitals in network</Chip>
                      <Chip tone="cyan">{t("ins.gap.risk")}: {t(`ins.gap.risk.${report.risk}`)}</Chip>
                    </div>
                  </div>
                  <RingGauge value={report.riskScore} size={96} stroke={8} color={riskColor} label={t("ins.gap.risk")} />
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-danger">{t("ins.gap.critical")}</div>
                  <div className="space-y-2">
                    {report.gaps.map((g, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.06 }}
                        className={`flex gap-2.5 rounded-[4px] border-l-2 px-4 py-2.5 text-[12px] leading-relaxed ${
                          g.severity === "critical"
                            ? "border-danger/70 bg-danger/[0.05] text-frost/90"
                            : g.severity === "warn"
                              ? "border-amber/60 bg-amber/[0.04] text-frost/85"
                              : "border-mint/50 bg-mint/[0.03] text-frost/80"
                        }`}
                      >
                        <IconAlert size={13} className={`mt-0.5 shrink-0 ${g.severity === "critical" ? "text-danger" : g.severity === "warn" ? "text-amber" : "text-mint"}`} />
                        {g.text}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-amber">{t("ins.gap.claims")}</div>
                  <div className="space-y-2">
                    {report.claims.map((c, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        className={`flex gap-2.5 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-[12px] leading-relaxed ${
                          c.severity === "critical" ? "text-danger/90" : c.severity === "warn" ? "text-frost/80" : "text-mist"
                        }`}
                      >
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.severity === "critical" ? "bg-danger" : c.severity === "warn" ? "bg-amber" : "bg-mint"}`} />
                        {c.text}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {report.actions.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-mint">{t("ins.gap.action")}</div>
                    {report.actions.map((a, i) => (
                      <p key={i} className="mb-2 flex gap-2.5 text-[12.5px] leading-relaxed text-frost/85">
                        <span className="font-bold text-mint">→</span>
                        {a}
                      </p>
                    ))}
                  </div>
                )}
              </Glass>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ---------------- Sub-tab B: Scheme Finder wizard ---------------- */

interface WizardState {
  state: string;
  income: string;
  category: string;
  work: string;
  need: string;
}

const WIZ_STEPS = ["state", "income", "category", "work", "need"] as const;

const OPTIONS: Record<(typeof WIZ_STEPS)[number], { id: string; labelKey: string }[]> = {
  state: INDIAN_STATES.map((s) => ({ id: s, labelKey: "STATE:" + s })),
  income: [
    { id: "0", labelKey: "ins.income.1" },
    { id: "1", labelKey: "ins.income.2" },
    { id: "2", labelKey: "ins.income.3" },
    { id: "3", labelKey: "ins.income.4" },
  ],
  category: [
    { id: "cat.gen", labelKey: "ins.cat.gen" },
    { id: "cat.obc", labelKey: "ins.cat.obc" },
    { id: "cat.sc", labelKey: "ins.cat.sc" },
    { id: "cat.st", labelKey: "ins.cat.st" },
    { id: "cat.rural", labelKey: "ins.cat.rural" },
  ],
  work: [
    { id: "work.gov", labelKey: "ins.work.gov" },
    { id: "work.pvt", labelKey: "ins.work.pvt" },
    { id: "work.self", labelKey: "ins.work.self" },
    { id: "work.daily", labelKey: "ins.work.daily" },
    { id: "work.unemp", labelKey: "ins.work.unemp" },
    { id: "work.home", labelKey: "ins.work.home" },
    { id: "work.pension", labelKey: "ins.work.pension" },
  ],
  need: [
    { id: "need.preg", labelKey: "ins.need.preg" },
    { id: "need.dialysis", labelKey: "ins.need.dialysis" },
    { id: "need.critical", labelKey: "ins.need.critical" },
    { id: "need.senior", labelKey: "ins.need.senior" },
    { id: "need.general", labelKey: "ins.need.general" },
  ],
};

function optionLabel(t: (k: string) => string, id: string, labelKey: string) {
  if (labelKey.startsWith("STATE:")) return id;
  return t(labelKey);
}

function SchemeTab() {
  const t = useT();
  const { lang, financials, savedSchemes, toggleScheme } = useStore();

  const [stepIdx, setStepIdx] = useState(0);
  const [wiz, setWiz] = useState<WizardState>({
    state: financials ? "DL" : "",
    income: financials
      ? String(financials.income < 12000 ? 0 : financials.income < 25000 ? 1 : financials.income < 50000 ? 2 : 3)
      : "",
    category: "",
    work: "",
    need: "",
  });
  const [done, setDone] = useState(false);
  const [direction, setDirection] = useState(1);
  const [results, setResults] = useState<SchemeMatch[]>([]);
  const [schemeLoading, setSchemeLoading] = useState(false);
  const [schemeError, setSchemeError] = useState("");

  const font = { fontFamily: NATIVE_INPUT_FONT[lang] };
  const step = WIZ_STEPS[stepIdx];

  // Fetch scheme matches from the backend when the wizard finishes.
  useEffect(() => {
    const controller = new AbortController();
    if (!done) {
      setResults([]);
      setSchemeError("");
      setSchemeLoading(false);
      return () => controller.abort();
    }
    (async () => {
      setSchemeLoading(true);
      setSchemeError("");
      try {
        const rs = await matchSchemes({ ...wiz, income: Number(wiz.income) || 0 }, controller.signal);
        if (!controller.signal.aborted) setResults(rs);
      } catch (cause) {
        if (!controller.signal.aborted) {
          console.error("Scheme matching failed", cause);
          setResults([]);
          setSchemeError("Scheme matching failed. Check the connection and try again.");
        }
      } finally {
        if (!controller.signal.aborted) setSchemeLoading(false);
      }
    })();
    return () => controller.abort();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (val: string) => {
    setWiz((w) => ({ ...w, [step]: val }));
  };

  const next = () => {
    if (stepIdx < WIZ_STEPS.length - 1) {
      setDirection(1);
      setStepIdx((i) => i + 1);
    } else {
      setDone(true);
    }
  };

  const back = () => {
    setDirection(-1);
    if (done) setDone(false);
    else setStepIdx((i) => Math.max(0, i - 1));
  };

  const chosen = wiz[step];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
    >
      <Glass className="rounded-[6px] p-6 md:p-8">
        {!done ? (
          <>
            {/* step indicator */}
            <div className="mb-8 flex items-center gap-2">
              {WIZ_STEPS.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <motion.div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                      i < stepIdx
                        ? "border-mint/60 bg-mint/15 text-mint"
                        : i === stepIdx
                          ? "border-cyanx/60 bg-cyanx/10 text-cyanx shadow-[0_0_14px_rgba(78,230,240,0.3)]"
                          : "border-white/10 text-mist/50"
                    }`}
                    animate={{ scale: i === stepIdx ? 1.08 : 1 }}
                  >
                    {i < stepIdx ? "✓" : i + 1}
                  </motion.div>
                  {i < WIZ_STEPS.length - 1 && (
                    <div className="relative h-px flex-1 bg-white/[0.07]">
                      <motion.span
                        className="absolute inset-y-0 left-0 bg-mint/60"
                        animate={{ width: i < stepIdx ? "100%" : "0%" }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={stepIdx}
                custom={direction}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -40 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-cyanx">
                  {t("ins.step." + step)}
                </div>
                <h3 className="mt-1.5 font-display text-[18px] font-semibold text-frost">{t(`ins.step.${step}.q`)}</h3>
                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {OPTIONS[step].map((o) => (
                    <button
                      key={o.id}
                      onClick={() => select(o.id)}
                      className={`min-h-11 rounded-[4px] border px-4 py-3 text-left text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx/80 ${
                        chosen === o.id
                          ? "border-mint/50 bg-mint/[0.08] text-mint shadow-[0_0_18px_rgba(52,245,177,0.12)]"
                          : "border-white/[0.08] bg-white/[0.02] text-mist hover:border-white/20 hover:text-frost"
                      }`}
                      style={font}
                    >
                      {optionLabel(t, o.id, o.labelKey)}
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex items-center justify-between">
              <Btn variant="ghost" onClick={back} disabled={stepIdx === 0}>
                ← {t("ins.wiz.back")}
              </Btn>
              <Btn onClick={next} disabled={chosen === ""}>
                {stepIdx === WIZ_STEPS.length - 1 ? t("ins.wiz.finish") : t("ins.wiz.next")} <IconArrow size={14} className="inline" />
              </Btn>
            </div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-[17px] font-semibold text-frost">
                  {results.length} {t("ins.scheme.title").toLowerCase()} · {t("ins.match")} {results[0]?.pct ?? 0}%
                </h3>
                <p className="mt-1 text-[12px] text-mist">{t("ins.scheme.sub").split(".")[0]}.</p>
              </div>
              <Btn variant="ghost" onClick={() => { setDone(false); setStepIdx(0); setWiz({ state: "", income: "", category: "", work: "", need: "" }); }}>
                {t("ins.wiz.restart")}
              </Btn>
            </div>

            {schemeLoading ? (
              <p className="rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-[12.5px] text-mist">Finding eligible schemes…</p>
            ) : schemeError ? (
              <ErrorToast message={schemeError} onRetry={() => { setDone(true); }} onDismiss={() => setSchemeError("")} />
            ) : results.length === 0 ? (
              <p className="rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-[12.5px] text-mist">
                {t("ins.nores")}
              </p>
            ) : (
              <div className="space-y-3">
                {results.map((r, i) => {
                  const saved = savedSchemes.includes(r.scheme.id);
                  return (
                    <motion.div
                      key={r.scheme.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="rounded-[5px] border border-white/[0.07] bg-white/[0.02] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-mint/30 bg-mint/[0.07] font-display text-[11px] font-bold text-mint">
                            {r.scheme.short}
                          </div>
                          <div>
                            <div className="text-[14px] font-semibold text-frost">{r.scheme.name}</div>
                            <div className="mt-0.5 flex gap-1.5">
                              <Chip tone={r.scheme.type === "National" ? "cyan" : "mint"}>{r.scheme.type}</Chip>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-[20px] font-bold text-mint text-glow-mint">{r.pct}%</div>
                          <div className="text-[9.5px] uppercase tracking-wider text-mist/60">{t("ins.match")}</div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Bar value={r.pct} tone={r.pct >= 70 ? "mint" : r.pct >= 45 ? "cyan" : "amber"} />
                      </div>
                      <p className="mt-3 text-[12px] leading-relaxed text-mist">{r.scheme.benefit}</p>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-mist/60">
                        <span className="text-mist/80">Documents:</span> {r.scheme.docs}
                      </p>
                      <div className="mt-3">
                        <Btn variant={saved ? "ghost" : "primary"} onClick={() => toggleScheme(r.scheme.id)} className="text-[12px]">
                          {saved ? "✓ " + t("ins.saved") : t("ins.save")}
                        </Btn>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </Glass>
    </motion.div>
  );
}

/* ---------------- page ---------------- */

export function Insurance() {
  const t = useT();
  const [tab, setTab] = useState<"policy" | "scheme">("policy");

  return (
    <div>
      <SectionTitle
        kicker="Insurance · Government schemes"
        title={t("ins.policy.title") + " / " + t("ins.scheme.title")}
        sub={tab === "policy" ? t("ins.policy.sub") : t("ins.scheme.sub")}
      />
      <div className="mt-6 mb-5">
        <Tabs
          items={[
            { id: "policy", label: t("ins.tab.policy") },
            { id: "scheme", label: t("ins.tab.scheme") },
          ]}
          active={tab}
          onChange={(id) => setTab(id as "policy" | "scheme")}
        />
      </div>
      <AnimatePresence mode="wait">
        {tab === "policy" ? <PolicyTab key="policy" /> : <SchemeTab key="scheme" />}
      </AnimatePresence>
    </div>
  );
}
