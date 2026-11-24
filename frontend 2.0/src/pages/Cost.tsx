import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IndianRupee, Search, Clock, BadgeCheck, TrendingDown, Loader2, X } from "lucide-react";
import { StaggerWords, SPRING_SOFT, LangFade } from "../lib/motion";
import { useT } from "../i18n";
import { fmtINR } from "../lib/format";
import { SearchSelect } from "../components/SearchSelect";
import { costAlternatives, estimateCost, getCities, getDiseases, type CityRef, type CostEstimate, type DiseaseRef } from "../lib/api";

const SEVERITY_OPTIONS: [string, string][] = [
  ["mild", "co.sev1"], ["moderate", "co.sev2"], ["severe", "co.sev3"], ["critical", "co.sev4"],
];

export default function Cost() {
  const { t, lang } = useT();
  const [q, setQ] = useState("");
  const [disease, setDisease] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [severity, setSeverity] = useState("moderate");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CostEstimate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // doc 27 item 4 — supported diseases/cities load from the backend, not a
  // hardcoded array that would silently drift from autonomous expansions.
  const [diseases, setDiseases] = useState<DiseaseRef[]>([]);
  const [cities, setCities] = useState<CityRef[]>([]);

  useEffect(() => {
    getDiseases().then((d) => {
      setDiseases(d);
      if (d.length) setDisease((prev) => prev || d[0].name);
    }).catch(() => setDiseases([]));
    getCities().then((c) => {
      setCities(c);
      if (c.length) setCity((prev) => prev || c[0].name);
    }).catch(() => setCities([]));
  }, []);

  const diseaseOptions = useMemo(
    () => diseases.filter((d) => d.name.toLowerCase().includes(q.toLowerCase())).map((d) => ({ label: d.name, id: d.id })),
    [diseases, q]
  );

  const cityOptions = useMemo(() => cities.map((c) => ({ label: c.name, id: c.id })), [cities]);
  const diseaseId = diseases.find((d) => d.name === disease)?.id ?? null; // `disease` holds a name
  const cityId = cities.find((c) => c.name === city)?.id ?? null;

  const doSearch = async () => {
    if (!diseaseId || !cityId) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await costAlternatives(cityId, diseaseId, severity));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };

  /* 4H — single-facility price detail breakdown (estimateCost) */
  const [detail, setDetail] = useState<CostEstimate | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  const openDetail = async (hospitalId: string) => {
    if (!diseaseId) return;
    setDetail(null);
    setDetailErr(null);
    setDetailBusy(true);
    try {
      setDetail(await estimateCost(hospitalId, diseaseId, severity));
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailBusy(false);
    }
  };

  return (
    <LangFade lang={lang}>
      <div className="wash-amber -mx-4 min-h-dvh px-4 pt-10 sm:-mx-6 sm:px-6">
        <StaggerWords text={t("co.title")} className="font-display text-4xl font-bold tracking-tight sm:text-5xl" />
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.4 }} className="mt-3 max-w-xl text-[15px]" style={{ color: "var(--fg-muted)" }}>
          {t("co.sub")}
        </motion.p>

        <motion.div variants={{ hidden: {}, show: {} }} initial="hidden" animate="show" transition={{ delay: 0.5 }} className="mt-8 max-w-3xl space-y-4">
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("co.searchPh")}</label>
              <div className="flex items-center gap-2" style={{ ["--accent" as any]: "var(--amber)" }}>
                <Search size={18} style={{ color: "var(--fg-subtle)" }} />
                <input className="input-line" placeholder={t("co.searchPh")} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <select
              aria-label={t("co.treatment")}
              className="sr-only"
              tabIndex={-1}
              value={disease || ""}
              onChange={(e) => setDisease(e.target.value)}
            >
              {diseases.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            <SearchSelect
              options={diseaseOptions.map((o) => ({ label: o.label }))}
              placeholder={t("co.treatment")}
              value={disease}
              onChange={setDisease}
              accent="var(--amber)"
            />
            <select
              aria-label={t("co.cityState")}
              className="sr-only"
              tabIndex={-1}
              value={city || ""}
              onChange={(e) => setCity(e.target.value)}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <SearchSelect
              options={cityOptions.map((o) => ({ label: o.label }))}
              placeholder={t("co.cityState")}
              value={city}
              onChange={setCity}
              accent="var(--amber)"
            />
            <select className="input-line" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITY_OPTIONS.map(([v, k]) => (
                <option key={v} value={v} style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}>{t(k)}</option>
              ))}
            </select>
            <div className="grid grid-cols-1 gap-2 sm:col-span-4 sm:grid-cols-[1fr_auto]">
              <span />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={doSearch}
                aria-label="Estimate cost"
                disabled={searching || !diseaseId || !cityId}
                className="flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-white"
                style={{ background: "var(--amber)", boxShadow: "0 12px 30px -12px var(--amber)", opacity: searching || !diseaseId || !cityId ? 0.6 : 1 }}
              >
                {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                {t("co.searchBtn")} · Estimate
              </motion.button>
            </div>
          </div>
        </motion.div>

        {error && (
          <p className="mt-4 rounded-2xl border p-4 text-sm font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>{error}</p>
        )}

        {results && (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {results.map((r, i) => {
                const h = r.hospital as Record<string, unknown>;
                const empanelled = !!h.pmjay;
                return (
                  <motion.div
                    key={String(h.id)}
                    layout
                    initial={{ opacity: 0, y: 40, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ ...SPRING_SOFT, delay: i * 0.04 }}
                    whileHover={{ y: -6 }}
                    className="relative flex flex-col rounded-3xl border p-6"
                    style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-bold leading-snug">{String(h.name)}</h3>
                      {empanelled && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: "var(--amber-soft)", color: "var(--amber)" }}>
                          <BadgeCheck size={12} /> PM-JAY
                        </span>
                      )}
                    </div>
                    <span className="mt-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>{String(h.tier ?? "")}</span>

                    <div className="mt-5">
                      <div className="rounded-2xl p-4" style={{ background: "var(--amber-soft)" }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--amber)" }}>{t("co.total")}</div>
                        <div className="mt-1 font-display text-2xl font-bold" style={{ color: "var(--fg)" }}>{fmtINR(r.total)}</div>
                      </div>
                    </div>

                    {r.affordablePct != null && (
                      <div className="mt-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--mint)" }}>
                        <TrendingDown size={15} /> {t("co.affordable")}: {r.affordablePct}%
                      </div>
                    )}

                    <button
                      onClick={() => openDetail(String(h.id))}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-xs font-bold transition-transform hover:scale-[1.02] active:scale-95"
                      style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
                    >
                      <Clock size={13} /> {t("co.breakdown")}
                    </button>

                    <div className="mt-4 flex items-center justify-end gap-1 text-[11px]" style={{ color: "var(--fg-subtle)" }}>
                      <Clock size={11} /> {t("c.dataAsOf")} {r.as_of ?? "curated dataset"}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <p className="mt-8 flex flex-wrap items-center gap-2 text-sm font-bold" style={{ color: "var(--amber)" }}>
          <IndianRupee size={16} /> {diseases.length} · {t("co.treatments")}
        </p>
      </div>

      {/* 4H — single-facility price detail (estimateCost) */}
      {(detail || detailBusy || detailErr) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[85] flex items-center justify-center p-4" style={{ background: "oklch(0.1 0.01 60 / 0.55)", backdropFilter: "blur(20px)" }} onClick={() => { setDetail(null); setDetailErr(null); }}>
          <motion.div initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} transition={SPRING_SOFT} className="w-full max-w-md rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">{t("co.breakdown")}</h3>
              <button onClick={() => { setDetail(null); setDetailErr(null); }} className="rounded-full p-1.5" aria-label={t("c.close")}><X size={18} /></button>
            </div>
            {detailBusy && <p className="mt-6 text-sm" style={{ color: "var(--fg-muted)" }}>Estimating…</p>}
            {detailErr && <p className="mt-6 text-sm font-semibold" style={{ color: "var(--emergency)" }}>{detailErr}</p>}
            {detail && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{String((detail.hospital as Record<string, unknown>).name ?? "")}</p>
                {[
                  { label: t("co.total"), value: fmtINR(detail.total), strong: true },
                  { label: t("co.monthly"), value: fmtINR(detail.monthly), strong: false },
                  ...(detail.affordablePct != null ? [{ label: t("co.affordable"), value: `${detail.affordablePct}%`, strong: false }] : []),
                  { label: t("c.dataAsOf"), value: detail.as_of ?? "curated static dataset (v2_data)", strong: false },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: row.strong ? "var(--amber-soft)" : "color-mix(in oklab, var(--fg) 4%, transparent)" }}>
                    <span className="text-sm font-medium" style={{ color: "var(--fg-muted)" }}>{row.label}</span>
                    <span className="font-display text-lg font-bold" style={{ color: row.strong ? "var(--amber)" : "var(--fg)" }}>{row.value}</span>
                  </div>
                ))}
                {(detail.verified_sources?.length ?? 0) > 0 && (
                  <div className="rounded-xl p-4" style={{ background: "color-mix(in oklab, var(--fg) 4%, transparent)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>{t("tr.sources")}</div>
                    <ul className="mt-1.5 space-y-1">
                      {detail.verified_sources!.slice(0, 4).map((s, i) => (
                        <li key={i} className="truncate text-xs" style={{ color: "var(--fg-muted)" }}>· {String((s as Record<string, unknown>).title ?? (s as Record<string, unknown>).url ?? "")}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.disclaimer && <p className="text-[11px] leading-relaxed" style={{ color: "var(--fg-subtle)" }}>{detail.disclaimer}</p>}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </LangFade>
  );
}