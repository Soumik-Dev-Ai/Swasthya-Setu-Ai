import { AnimatePresence, motion } from "framer-motion";
import { SearchSelect } from "../components/SearchSelect";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bar,
  Btn,
  Chip,
  ErrorToast,
  Field,
  Glass,
  IconChevron,
  RingGauge,
  SectionTitle,
  Tabs,
} from "../components/ui";
import {
  CITIES,
  DISEASES,
  HOSPITALS,
  SEVERITIES,
  type Severity,
} from "../lib/data";
import {
  bestMatches,
  computeFinances,
  costBenchmark,
  estimateCost,
  type CostEstimate,
  type FinanceStats,
} from "../lib/engine";
import { NATIVE_INPUT_FONT } from "../lib/i18n";
import { useStore, useT, type Financials } from "../lib/store";

const EMPTY_FIN: Financials = {
  income: 0,
  housing: 0,
  food: 0,
  transport: 0,
  school: 0,
  emi: 0,
  insurancePrem: 0,
  other: 0,
};

/* ---------------- Sub-tab A: Financial Availability ---------------- */

function FinancialTab() {
  const t = useT();
  const { financials, setFinancials, lang } = useStore();
  const [f, setF] = useState<Financials>(financials ?? EMPTY_FIN);
  const font = { fontFamily: NATIVE_INPUT_FONT[lang] };

  const set = (k: keyof Financials, v: string) => {
    const next = { ...f, [k]: Number(v.replace(/[^0-9]/g, "")) || 0 };
    setF(next);
    setFinancials(next);
  };

  const stats: FinanceStats = computeFinances(f);
  const disposablePct = f.income > 0 ? Math.round((stats.disposable / f.income) * 100) : 0;

  const rows: { k: keyof Financials; label: string; icon?: string }[] = [
    { k: "income", label: t("cost.fin.income") },
    { k: "housing", label: t("cost.fin.housing") },
    { k: "food", label: t("cost.fin.food") },
    { k: "transport", label: t("cost.fin.transport") },
    { k: "school", label: t("cost.fin.school") },
    { k: "emi", label: t("cost.fin.emi") },
    { k: "insurancePrem", label: t("cost.fin.insurance") },
    { k: "other", label: t("cost.fin.other") },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="grid grid-cols-1 gap-4 lg:grid-cols-5"
    >
      {/* inputs */}
      <Glass className="rounded-[6px] p-5 lg:col-span-3 md:p-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {rows.map((r) => (
            <Field key={r.k} label={r.label}>
              <input
                inputMode="numeric"
                value={f[r.k] ? String(f[r.k]) : ""}
                onChange={(e) => set(r.k, e.target.value)}
                placeholder="0"
                className={r.k === "income" ? "field text-mint font-semibold" : "field"}
                style={font}
              />
            </Field>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-[11px] text-mist/60">
          <span className="h-1.5 w-1.5 rounded-full bg-mint/60" />
          {t("cost.fin.note")}
        </p>
      </Glass>

      {/* gauges */}
      <Glass className="rounded-[6px] p-5 lg:col-span-2 md:p-6">
        <div className="flex flex-col items-center justify-around gap-6">
          <RingGauge
            value={stats.savingsRate}
            color={stats.savingsRate >= 20 ? "#34f5b1" : "#ffb347"}
            label={t("cost.fin.savings")}
            sub={`${t("cost.fin.monthly", { amt: "₹" + stats.savings.toLocaleString("en-IN") })}`}
            danger={stats.savingsRate < 10}
          />
          <RingGauge
            value={disposablePct}
            color="#4ee6f0"
            label={t("cost.fin.disposable")}
            sub={`₹${stats.disposable.toLocaleString("en-IN")} / ₹${(f.income || 0).toLocaleString("en-IN")}`}
          />
        </div>
        {stats.savingsRate < 20 && (
          <div className="mt-5 rounded-[4px] border border-amber/30 bg-amber/[0.05] px-4 py-3 text-[11.5px] leading-relaxed text-amber">
            {t("cost.fin.warn")}
          </div>
        )}
      </Glass>
    </motion.div>
  );
}

/* ---------------- Sub-tab B: Treatment Cost ---------------- */

interface BenchResult {
  min: number;
  max: number;
  median: number;
}

function TreatmentTab() {
  const t = useT();
  const navigate = useNavigate();
  const { financials, lang } = useStore();

  const location = useLocation();
  const initCity = (location.state as any)?.city || CITIES[0].id;
  const initHospital = (location.state as any)?.hospital || "";
  
  const [disease, setDisease] = useState(DISEASES[0].id);
  const [city, setCity] = useState(initCity);
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [hospital, setHospital] = useState(initHospital);

  const [bench, setBench] = useState<BenchResult | null>(null);
  const [matches, setMatches] = useState<CostEstimate[] | null>(null);
  const [exact, setExact] = useState<CostEstimate | null>(null);
  const [showRec, setShowRec] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  const font = { fontFamily: NATIVE_INPUT_FONT[lang] };
  const stats = financials ? computeFinances(financials) : null;
  const diseaseObj = DISEASES.find((d) => d.id === disease)!;
  const cityHospitals = HOSPITALS.filter((h) => h.cityId === city);

  useEffect(() => () => requestRef.current?.abort(), []);

  const calculate = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setShowRec(false);
    setCalculating(true);
    setError("");
    try {
      if (hospital) {
        const est = await estimateCost(hospital, disease, severity, financials ?? undefined, controller.signal);
        if (controller.signal.aborted) return;
        setExact(est);
        setMatches(null);
        setBench(null);
      } else if (stats) {
        const ms = await bestMatches(city, disease, severity, stats, false, controller.signal);
        if (controller.signal.aborted) return;
        setMatches(ms);
        setBench(null);
        setExact(null);
      } else {
        const b = await costBenchmark(city, disease, severity, controller.signal);
        if (controller.signal.aborted) return;
        setBench({ min: b.min, max: b.max, median: b.median });
        setMatches(null);
        setExact(null);
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      console.error("Cost calculation failed", cause);
      setError("Cost calculation failed. Check the connection and try again.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setCalculating(false);
      }
    }
  };

  const recStages = [
    { key: "opd", share: 0.08, label: t("cost.treat.stage.opd") },
    { key: "ipd", share: 0.35, label: t("cost.treat.stage.ipd") },
    { key: "proc", share: 0.45, label: t("cost.treat.stage.proc") },
    { key: "rehab", share: 0.12, label: t("cost.treat.stage.rehab") },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5"
    >
      {/* search panel */}
      <Glass className="rounded-[6px] p-5 lg:col-span-2 md:p-6">
        <Field label={t("cost.treat.disease")}>
          <SearchSelect value={disease} onChange={setDisease} options={DISEASES.map(d => ({ value: d.id, label: t(d.nameKey) }))} />
        </Field>
        <Field label={t("cost.treat.city")} className="mt-4">
          <select value={city} onChange={(e) => setCity(e.target.value)} className="field" style={font}>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameKey}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("cost.treat.severity")} className="mt-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SEVERITIES.map((s, i) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`rounded-[4px] border px-3 py-2 text-left text-[11.5px] font-medium transition-colors ${
                  severity === s
                    ? "border-mint/40 bg-mint/[0.07] text-mint"
                    : "border-white/[0.08] bg-white/[0.02] text-mist hover:text-frost"
                } ${i < 2 ? "" : ""}`}
              >
                {t(`cost.treat.${s}`)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("cost.treat.hospital")} optionalLabel={t("common.optional")} className="mt-4">
          <select value={hospital} onChange={(e) => setHospital(e.target.value)} className="field" style={font}>
            <option value="">{t("cost.treat.hospital.ph")}</option>
            {cityHospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} · {h.tier}
              </option>
            ))}
          </select>
        </Field>
        <Btn onClick={calculate} disabled={calculating} className="mt-5 w-full">
          {calculating ? "Calculating…" : t("cost.treat.cta")}
        </Btn>
        {error && <ErrorToast message={error} onRetry={calculate} onDismiss={() => setError("")} />}

        <p className="mt-4 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-[10.5px] leading-relaxed text-mist/70">
          {t("cost.treat.disclaimer")}
        </p>
      </Glass>

      {/* results */}
      <div className="space-y-4 lg:col-span-3">
        <AnimatePresence mode="wait">
          {!bench && !matches && !exact && (
            <motion.div
              key="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Glass className="flex min-h-[320px] flex-col items-center justify-center rounded-[6px] p-8 text-center">
                <div className="text-[12.5px] text-mist/70">{t("cost.treat.nores")}</div>
              </Glass>
            </motion.div>
          )}

          {bench && !matches && !exact && (
            <motion.div key="bench" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <Glass className="rounded-[6px] p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-[16px] font-semibold text-frost">
                    {t("cost.treat.area", { city: CITIES.find((c) => c.id === city)?.nameKey ?? "" })}
                  </h3>
                  <Chip tone="cyan">{t(`cost.treat.${severity}`)}</Chip>
                </div>
                <div className="mt-5">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mist/70">
                    {t("cost.treat.median")}
                  </div>
                  <div className="mt-1 font-display text-[34px] font-semibold text-mint text-glow-mint">
                    ₹{bench.median.toLocaleString("en-IN")}
                  </div>
                  <div className="mt-1 text-[11px] text-mist/70">
                    {t(`cost.treat.${severity}`)} · {t(diseaseObj.nameKey)}
                  </div>
                </div>
                <div className="mt-5">
                  <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mist/70">
                    {t("cost.treat.range")}
                  </div>
                  <div className="relative h-2.5 rounded-full bg-white/[0.05]">
                    <motion.span
                      className="absolute inset-y-0 rounded-full bg-cyanx/25 border-x border-cyanx/40"
                      initial={{ left: "0%", right: "100%" }}
                      animate={{
                        left: `${Math.max(0, Math.round((bench.min / (bench.max * 1.4)) * 100))}%`,
                        right: `${Math.max(0, 100 - Math.round((bench.max / (bench.max * 1.4)) * 100))}%`,
                      }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <motion.span
                      className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-mint shadow-[0_0_10px_rgba(52,245,177,0.8)]"
                      initial={{ left: "0%" }}
                      animate={{ left: `${Math.round((bench.median / (bench.max * 1.4)) * 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[10.5px] text-mist">
                    <span>₹{bench.min.toLocaleString("en-IN")}</span>
                    <span>₹{bench.max.toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <p className="mt-5 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[12px] leading-relaxed text-mist">
                  {t("cost.treat.generic")}
                </p>
                <Btn variant="ghost" className="mt-3" onClick={() => navigate("/cost", { state: { tab: "fin" } })}>
                  {t("cost.treat.linkfin")} →
                </Btn>
              </Glass>
            </motion.div>
          )}

          {matches && (
            <motion.div key="matches" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <div className="mb-2">
                <h3 className="font-display text-[16px] font-semibold text-frost">{t("cost.treat.best")}</h3>
                <p className="mt-1 text-[12px] text-mist">{t("cost.treat.best.sub")}</p>
              </div>
              <div className="space-y-3">
                {matches.map((m, i) => {
                  const pct = m.affordablePct ?? 0;
                  return (
                    <motion.div
                      key={m.hospital.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <Glass className="rounded-[6px] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-[14px] font-semibold text-frost">{m.hospital.name}</div>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <Chip tone="cyan">{t("common.score")} {m.hospital.score}</Chip>
                              <Chip>{m.hospital.tier}</Chip>
                              {m.hospital.pmjay && <Chip tone="mint">{t("common.pmjay")}</Chip>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-display text-[20px] font-semibold text-mint">
                              ₹{m.total.toLocaleString("en-IN")}
                            </div>
                            <div className="text-[10.5px] text-mist/60">
                              {t("cost.treat.mo", { amt: "₹" + m.monthly.toLocaleString("en-IN"), m: 12 })}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="mb-1.5 flex justify-between text-[11px]">
                            <span className="text-mist">{t("triage.afford.pct")}</span>
                            <span className={pct >= 60 ? "font-semibold text-mint" : pct >= 35 ? "font-semibold text-amber" : "font-semibold text-danger"}>
                              {pct}%
                            </span>
                          </div>
                          <Bar value={pct} tone={pct >= 60 ? "mint" : pct >= 35 ? "amber" : "red"} />
                        </div>
                      </Glass>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {exact && (
            <motion.div key="exact" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <Glass className="rounded-[6px] p-6">
                <h3 className="font-display text-[16px] font-semibold text-frost">
                  {t("cost.treat.exact", { hospital: exact.hospital.name })}
                </h3>
                <p className="mt-1 text-[12px] text-mist">{t("cost.treat.exact.sub")}</p>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mist/70">
                      {t("cost.treat.median")}
                    </div>
                    <div className="mt-1 font-display text-[34px] font-semibold text-cyanx text-glow-cyan">
                      ₹{exact.total.toLocaleString("en-IN")}
                    </div>
                  </div>
                  {exact.affordablePct !== null && (
                    <div className="w-[180px]">
                      <div className="mb-1.5 flex justify-between text-[11px]">
                        <span className="text-mist">{t("triage.afford.pct")}</span>
                        <span className={exact.affordablePct >= 60 ? "text-mint" : exact.affordablePct >= 35 ? "text-amber" : "text-danger"}>
                          {exact.affordablePct}%
                        </span>
                      </div>
                      <Bar value={exact.affordablePct} tone={exact.affordablePct >= 60 ? "mint" : exact.affordablePct >= 35 ? "amber" : "red"} />
                    </div>
                  )}
                </div>

                {/* expandable recommendations */}
                <div className="mt-5 border-t border-white/[0.06] pt-4">
                  <button
                    onClick={() => setShowRec((v) => !v)}
                    className="flex w-full items-center justify-between text-[12.5px] font-semibold text-frost"
                  >
                    <span>
                      {t("cost.treat.recommend")}
                      <span className="ml-2 font-normal text-mist/60">— {t("cost.treat.recommend.sub")}</span>
                    </span>
                    <motion.span animate={{ rotate: showRec ? 180 : 0 }} transition={{ duration: 0.25 }}>
                      <IconChevron size={15} className="text-mint" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {showRec && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 pt-4">
                          {recStages.map((s, i) => {
                            const d = diseaseObj.stages[s.key];
                            if (d === 0 && s.key !== "opd") return null;
                            return (
                              <div
                                key={s.key}
                                className="flex items-center justify-between gap-3 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
                              >
                                <span className="flex items-center gap-2.5 text-[12.5px] text-frost">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-cyanx/40 text-[9.5px] font-bold text-cyanx">
                                    {i + 1}
                                  </span>
                                  {s.label}
                                  {s.key === "ipd" && <Chip>~{d} d</Chip>}
                                  {s.key === "proc" && <Chip>{d}×</Chip>}
                                  {s.key === "rehab" && <Chip>{d} d</Chip>}
                                </span>
                                <span className="text-[12px] font-semibold text-mist">
                                  ₹{Math.round(exact.total * s.share).toLocaleString("en-IN")}
                                </span>
                              </div>
                            );
                          })}
                          <p className="pt-1 text-[10.5px] text-mist/60">{t("cost.treat.disclaimer")}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Glass>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ---------------- page ---------------- */

export function Cost() {
  const t = useT();
  const location = useLocation();
  const [tab, setTab] = useState<"fin" | "treat">(
    (location.state as { tab?: string } | null)?.tab === "treat" ? "treat" : "fin"
  );

  useEffect(() => {
    const wanted = (location.state as { tab?: string } | null)?.tab;
    if (wanted === "fin" || wanted === "treat") setTab(wanted);
  }, [location.state]);

  return (
    <div>
      <SectionTitle
        kicker="Finance · Benchmark costing"
        title={t("cost.fin.title") + " / " + t("cost.treat.title")}
        sub={tab === "fin" ? t("cost.fin.sub") : t("cost.treat.sub")}
      />
      <div className="mt-6 mb-5">
        <Tabs
          items={[
            { id: "fin", label: t("cost.tab.fin") },
            { id: "treat", label: t("cost.tab.treat") },
          ]}
          active={tab}
          onChange={(id) => setTab(id as "fin" | "treat")}
        />
      </div>
      <AnimatePresence mode="wait">
        {tab === "fin" ? <FinancialTab key="fin" /> : <TreatmentTab key="treat" />}
      </AnimatePresence>
    </div>
  );
}
