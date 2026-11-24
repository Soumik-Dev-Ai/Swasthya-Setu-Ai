import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldCheck, Sparkles, Check, ExternalLink, Info, AlertTriangle, TrendingDown } from "lucide-react";
import { StaggerWords, SPRING_SOFT, LangFade } from "../lib/motion";
import { useT } from "../i18n";
import { STATES } from "../lib/constants";
import { analyzePolicy, matchSchemes as apiMatchSchemes, type CoverageReport, type SchemeMatch } from "../lib/api";

/* Map UI selections → backend enum vocabulary (schemas/v2.py).
 * 7A: covers every STATES entry — an unmapped state must NEVER silently
 * fall through to a wrong state's scheme (the old `?? "RJ"` fallback
 * misrouted Rajasthan's Chiranjeevi scheme at non-Rajasthan users). */
const STATE_CODES: Record<string, string> = {
  "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", "Assam": "AS", "Bihar": "BR",
  "Chhattisgarh": "CT", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR",
  "Himachal Pradesh": "HP", "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL",
  "Madhya Pradesh": "MP", "Maharashtra": "MH", "Manipur": "MN", "Meghalaya": "ML",
  "Mizoram": "MZ", "Nagaland": "NL", "Odisha": "OR", "Punjab": "PB",
  "Rajasthan": "RJ", "Sikkim": "SK", "Tamil Nadu": "TN", "Telangana": "TG",
  "Tripura": "TR", "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB",
  "Andaman and Nicobar Islands": "AN", "Chandigarh": "CH",
  "Dadra and Nagar Haveli and Daman and Diu": "DH", "Delhi": "DL",
  "Jammu and Kashmir": "JK", "Ladakh": "LA", "Lakshadweep": "LD", "Puducherry": "PY",
};
const CAT_MAP: Record<string, string> = {
  "in.cat1": "cat.gen", "in.cat2": "cat.obc", "in.cat3": "cat.sc", "in.cat4": "cat.st", "in.cat5": "cat.gen",
};
const WORK_MAP: Record<string, string> = {
  "in.emp1": "work.daily", "in.emp2": "work.pvt", "in.emp3": "work.gov", "in.emp4": "work.self",
};

function enrollmentGuide(method: string, t: (k: string) => string): string {
  switch (method) {
    case "self_service_portal": return t("in.guidePortal");
    case "csc_based": return t("in.guideCsc");
    case "facility_based": return t("in.guideFacility");
    default: return t("in.guideFallback");
  }
}

export default function Insurance() {
  const { t, lang } = useT();
  const [income, setIncome] = useState(15000);
  const [state, setState] = useState("Rajasthan");
  const [category, setCategory] = useState("in.cat1");
  const [emp, setEmp] = useState("in.emp1");
  const [matches, setMatches] = useState<SchemeMatch[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* policy gap checker (audit item 15 — the backend's /insurance/analyze-policy
   * is the Home page's promised "Policy gaps" feature) */
  const [policy, setPolicy] = useState({ coverage: "300000", type: "fam" as "ind" | "fam", network: "12" });
  const [report, setReport] = useState<CoverageReport | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyErr, setPolicyErr] = useState<string | null>(null);

  const checkPolicy = async () => {
    setPolicyBusy(true);
    setPolicyErr(null);
    try {
      const n = Math.max(0, Math.min(999, Number(policy.network) || 0));
      // The backend analyzes the network SIZE (ids are only placeholders —
      // a transparent representation of "N empanelled hospitals").
      const ids = Array.from({ length: n }, (_, i) => `net-${i + 1}`);
      setReport(await analyzePolicy(Math.max(0, Number(policy.coverage) || 0), policy.type, ids));
    } catch (e) {
      setPolicyErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPolicyBusy(false);
    }
  };

  const check = async () => {
    setChecking(true);
    setError(null);
    // 7A: every STATES entry is mapped, but if the lists ever drift the
    // failure must be VISIBLE — never a silent fallback to another state's
    // schemes.
    const stateCode = STATE_CODES[state];
    if (!stateCode) {
      setError(`No scheme code mapped for ${state} — this is a bug, please report it.`);
      setChecking(false);
      return;
    }
    try {
      const res = await apiMatchSchemes({
        state: stateCode,
        income: income <= 8000 ? 0 : income <= 20000 ? 1 : 2,
        category: CAT_MAP[category] ?? "cat.gen",
        work: WORK_MAP[emp] ?? "work.self",
        need: "need.general",
      });
      setMatches(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <LangFade lang={lang}>
      <div className="wash-sky -mx-4 min-h-dvh px-4 pt-10 sm:-mx-6 sm:px-6">
        <StaggerWords text={t("in.title")} className="font-display text-4xl font-bold tracking-tight sm:text-5xl" />
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.4 }} className="mt-3 max-w-xl text-[15px]" style={{ color: "var(--fg-muted)" }}>
          {t("in.sub")}
        </motion.p>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-5">
          {/* form */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.5 }} className="rounded-3xl border p-7 lg:col-span-2" style={{ borderColor: "var(--border)", background: "var(--bg-surface)", ["--accent" as any]: "var(--sky)" }}>
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
                <span>{t("in.income")}</span>
                <span className="font-display text-base normal-case" style={{ color: "var(--sky)" }}>₹{income.toLocaleString("en-IN")}</span>
              </div>
              <input
                type="range" min={0} max={60000} step={500} value={income}
                onChange={(e) => setIncome(+e.target.value)}
                className="mt-3 w-full"
                style={{ accentColor: "var(--sky)", ["--accent" as any]: "var(--sky)" }}
              />
              <div className="flex justify-between text-[10px] font-semibold" style={{ color: "var(--fg-subtle)" }}>
                <span>₹0</span><span>₹30,000</span><span>₹60,000</span>
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("in.state")}</label>
              <select className="input-line" value={state} onChange={(e) => setState(e.target.value)}>
                {STATES.map((s) => <option key={s} value={s} style={{ background: "var(--bg-elevated)" }}>{s}</option>)}
              </select>
            </div>

            <div className="mb-5">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("in.category")}</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {["in.cat1", "in.cat2", "in.cat3", "in.cat4", "in.cat5"].map((c) => (
                  <button key={c} onClick={() => setCategory(c)} className="rounded-full border px-4 py-1.5 text-xs font-bold transition-all" style={{ borderColor: category === c ? "var(--sky)" : "var(--border)", background: category === c ? "var(--sky)" : "transparent", color: category === c ? "#fff" : "var(--fg-muted)" }}>
                    {t(c)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("in.emp")}</label>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {["in.emp1", "in.emp2", "in.emp3", "in.emp4"].map((e) => (
                  <button key={e} onClick={() => setEmp(e)} className="rounded-xl border px-3 py-2.5 text-xs font-bold transition-all" style={{ borderColor: emp === e ? "var(--sky)" : "var(--border)", background: emp === e ? "var(--sky-soft)" : "transparent", color: emp === e ? "var(--sky)" : "var(--fg-muted)" }}>
                    {t(e)}
                  </button>
                ))}
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={check}
              disabled={checking}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white"
              style={{ background: "var(--sky)", boxShadow: "0 12px 30px -12px var(--sky)", opacity: checking ? 0.6 : 1 }}
            >
              {checking ? (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} className="flex"><Sparkles size={16} /></motion.span>
              ) : (
                <ShieldCheck size={16} />
              )}
              {t("in.check")}
            </motion.button>
          </motion.div>

          {/* results */}
          <div className="lg:col-span-3">
              {!matches ? (
                <motion.div key="empty" className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: "var(--border)" }}>
                  <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 5, repeat: Infinity }} className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "var(--sky-soft)" }}>
                    <Shield size={38} strokeWidth={1.4} style={{ color: "var(--sky)" }} />
                  </motion.div>
                  <p className="mt-5 max-w-sm text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>{t("in.sub")}</p>
                </motion.div>
              ) : (
                <motion.div key="results" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT} className="space-y-4">
                  {error && <p className="rounded-2xl border p-4 text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--emergency)" }}>{error}</p>}
                  {matches.map((s, i) => (
                    <motion.div
                      key={s.scheme.id}
                      initial={{ opacity: 0, y: 30, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ ...SPRING_SOFT, delay: i * 0.1 }}
                      whileHover={{ x: 6 }}
                      className="relative overflow-hidden rounded-3xl border p-6"
                      style={{ borderColor: "color-mix(in oklab, var(--sky) 25%, var(--border))", background: "var(--bg-surface)" }}
                    >
                      <div className="absolute inset-y-0 start-0 w-1.5" style={{ background: "var(--sky)" }} />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-xl font-bold">{s.scheme.name}</h3>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--sky-soft)", color: "var(--sky)" }}>{s.scheme.type}</span>
                            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>{t("in.coverage")}: {s.scheme.benefit.slice(0, 60)}</span>
                          </div>
                        </div>
                        <div className="text-end">
                          {s.scheme.match_basis === "general_eligibility" ? (
                            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--bg)", color: "var(--fg-muted)" }}>{t("in.general")}</span>
                          ) : (
                            <>
                              <div className="font-display text-3xl font-bold" style={{ color: "var(--sky)" }}>{s.pct}%</div>
                              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>{t("in.matched")}</div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>{t("in.docs")}</div>
                        <ul className="mt-2 space-y-1.5">
                          <li className="flex items-start gap-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                            <Check size={14} className="mt-0.5 shrink-0" style={{ color: "var(--sky)" }} /> {s.scheme.docs}
                          </li>
                        </ul>
                      </div>
                      {s.scheme.registration_portal_url && s.scheme.enrollment_method === "self_service_portal" ? (
                        <a href={s.scheme.registration_portal_url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold text-white transition-transform hover:scale-105 active:scale-95" style={{ background: "var(--sky)" }}>
                          {t("in.apply")} <ExternalLink size={13} />
                        </a>
                      ) : (
                        /* 4G — NO dead button: schemes without a verified self-service
                         * portal get an honest channel-instruction card instead. */
                        <div className="mt-5 flex items-start gap-2 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--fg) 4%, transparent)" }}>
                          <Info size={15} className="mt-0.5 shrink-0" style={{ color: "var(--sky)" }} />
                          <div>
                            <div className="text-xs font-bold" style={{ color: "var(--fg)" }}>{t("in.howToApply")}</div>
                            <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--fg-subtle)" }}>{enrollmentGuide(s.scheme.enrollment_method, t)}</p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
          </div>
        </div>

        {/* ── Policy gap checker (audit item 15: the Home page's promised
             "Policy gaps" feature — wired to POST /insurance/analyze-policy) ── */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={SPRING_SOFT} className="mt-12 rounded-3xl border p-7" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: "var(--sky)", boxShadow: "0 10px 24px -8px var(--sky)" }}>
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold">{t("in.policy")}</h2>
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{t("in.policySub")}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div style={{ ["--accent" as any]: "var(--sky)" }}>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("in.coverageAmt")}</label>
              <input type="number" className="input-line" value={policy.coverage} onChange={(e) => setPolicy({ ...policy, coverage: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("in.policyType")}</label>
              <div className="flex gap-2">
                {([["ind", "in.individual"], ["fam", "in.family"]] as const).map(([val, key]) => (
                  <button key={val} onClick={() => setPolicy({ ...policy, type: val })} className="rounded-full border px-4 py-2 text-xs font-bold"
                    style={{ borderColor: policy.type === val ? "var(--sky)" : "var(--border)", background: policy.type === val ? "var(--sky)" : "transparent", color: policy.type === val ? "#fff" : "var(--fg-muted)" }}>
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ["--accent" as any]: "var(--sky)" }}>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("in.network")}</label>
              <input type="number" className="input-line" value={policy.network} onChange={(e) => setPolicy({ ...policy, network: e.target.value })} />
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={checkPolicy} disabled={policyBusy} className="flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-white" style={{ background: "var(--sky)", boxShadow: "0 12px 30px -12px var(--sky)", opacity: policyBusy ? 0.6 : 1 }}>
              {policyBusy ? <Sparkles size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {t("in.checkPolicy")}
            </motion.button>
          </div>

          {policyErr && <p className="mt-4 rounded-2xl border p-3 text-sm font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>{policyErr}</p>}

          {report && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT} className="mt-6 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--fg) 3%, transparent)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full px-4 py-1.5 text-xs font-bold text-white" style={{ background: report.risk === "high" ? "var(--emergency)" : report.risk === "med" ? "var(--amber)" : "var(--mint)" }}>
                    {report.risk.toUpperCase()}
                  </span>
                  <span className="text-sm font-bold" style={{ color: "var(--fg-muted)" }}>risk {report.riskScore}/100</span>
                </div>
                <span className="text-xs font-bold" style={{ color: "var(--fg-muted)" }}>{t("in.network")}: {report.inNetworkCount}</span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--emergency)" }}>{t("in.gaps")}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {report.gaps.map((g, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: g.severity === "critical" ? "var(--emergency)" : g.severity === "warn" ? "var(--amber)" : "var(--sky)" }} /> {g.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sky)" }}>{t("in.claimsNotes")}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {report.claims.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                        <Info size={13} className="mt-0.5 shrink-0" style={{ color: "var(--sky)" }} /> {c.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--mint)" }}>{t("in.actions")}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {report.actions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                        <TrendingDown size={13} className="mt-0.5 shrink-0" style={{ color: "var(--mint)" }} /> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {report.disclaimer && <p className="mt-4 text-[11px]" style={{ color: "var(--fg-subtle)" }}>{report.disclaimer}</p>}
            </motion.div>
          )}
        </motion.div>
      </div>
    </LangFade>
  );
}