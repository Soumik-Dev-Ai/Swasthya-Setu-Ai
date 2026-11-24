import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Bed, Navigation, BadgeCheck, Phone, X, SlidersHorizontal, Crosshair, Siren } from "lucide-react";
import { StaggerWords, SPRING_SOFT, LangFade } from "../lib/motion";
import { useT } from "../i18n";
import { MapView, type FacilityPin } from "../lib/MapView";
import { SearchSelect } from "../components/SearchSelect";
import { fmtINR } from "../lib/format";
import {
  advancedSearch, getCities, getDiseases, getEmergencyRoute, recommendRoute, searchFacilities,
  type CityRef, type DiseaseRef, type FacilityAdvanced, type FacilityHit, type RoutingResponse,
} from "../lib/api";

const FILTERS: [string, string][] = [
  ["pmjay", "PM-JAY"], ["er24", "24×7 ER"], ["icu", "ICU"],
  ["blood", "Blood bank"], ["nabh", "NABH"],
];

const SEVERITY: [string, string][] = [
  ["mild", "co.sev1"], ["moderate", "co.sev2"], ["severe", "co.sev3"], ["critical", "co.sev4"],
];

/** A plain hit, optionally carrying the advanced-search price block (4H). */
type HitRow = FacilityHit & { price?: FacilityAdvanced["price"] };

function typeOf(tier: string): "private" | "district" | "phc" | "chc" {
  if (tier.startsWith("Private")) return "private";
  return "district";
}

export default function Facilities() {
  const { t, lang } = useT();
  const [cities, setCities] = useState<CityRef[]>([]);
  const [city, setCity] = useState<string | null>("jaipur"); // city id
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const [hits, setHits] = useState<HitRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* 4H — advanced pricing search, GPS routing, nearest-ER */
  const [diseases, setDiseases] = useState<DiseaseRef[]>([]);
  const [advOpen, setAdvOpen] = useState(false);
  const [advDisease, setAdvDisease] = useState<string | null>(null); // disease NAME
  const [advSeverity, setAdvSeverity] = useState("moderate");
  const [includePricing, setIncludePricing] = useState(true);
  const advDiseaseId = diseases.find((d) => d.name === advDisease)?.id ?? null;
  const [routeTier, setRouteTier] = useState("L2");
  const [route, setRoute] = useState<RoutingResponse | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [erList, setErList] = useState<{ hospital: Record<string, unknown>; km: number }[] | null>(null);
  const [erBusy, setErBusy] = useState(false);

  // doc 27 item 4 — cities load from the backend, not a hardcoded array.
  useEffect(() => {
    getCities().then((c) => {
      setCities(c);
      if (c.length && !c.some((x) => x.id === city)) setCity(c[0].id);
    }).catch(() => setCities([]));
    getDiseases().then(setDiseases).catch(() => setDiseases([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cityOptions = useMemo(() => cities.map((c) => ({ label: c.name })), [cities]);

  // Debounced hybrid search — the advanced (pricing) endpoint only when a
  // disease is picked; the debounce also protects its 10/min rate limit.
  useEffect(() => {
    if (!city) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      const payload = { pmjay: !!filters.pmjay, er24: !!filters.er24, icu: !!filters.icu, blood: !!filters.blood, nabh: !!filters.nabh, beds: false };
      const req = advDiseaseId
        ? advancedSearch(city, payload, query, { diseaseId: advDiseaseId, severity: advSeverity, includePricing })
        : searchFacilities(city, payload, query, "near");
      req
        .then((r) => { if (!cancelled) setHits(r as HitRow[]); })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [city, query, filters, advDiseaseId, advSeverity, includePricing]);

  const routeNearMe = () => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not available on this device.");
      return;
    }
    setRouteBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          setRoute(await recommendRoute(p.coords.latitude, p.coords.longitude, routeTier));
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setRouteBusy(false);
        }
      },
      () => { setError("Location permission denied — cannot route."); setRouteBusy(false); },
      { timeout: 8000, maximumAge: 600000 },
    );
  };

  const nearestEr = async () => {
    if (!city) return;
    setErBusy(true);
    try {
      setErList(await getEmergencyRoute(city, 5));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setErBusy(false);
    }
  };

  const pins: FacilityPin[] = useMemo(
    () => (hits ?? []).map((h) => ({ id: h.hospital.id, type: typeOf(String(h.hospital.tier ?? "")), lat: h.hospital.lat, lng: h.hospital.lon })),
    [hits]
  );

  const expanded = (hits ?? []).find((h) => h.hospital.id === expandedId);

  return (
    <LangFade lang={lang}>
      <div className="wash-mint -mx-4 min-h-dvh px-4 pt-10 sm:-mx-6 sm:px-6">
        <StaggerWords text={t("fa.title")} className="font-display text-4xl font-bold tracking-tight sm:text-5xl" />
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.4 }} className="mt-3 max-w-xl text-[15px]" style={{ color: "var(--fg-muted)" }}>
          {t("fa.sub")}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-7 flex flex-wrap gap-2">
          {FILTERS.map(([key, label]) => {
            const on = !!filters[key];
            return (
              <button
                key={key}
                onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                className="rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95"
                style={{
                  borderColor: on ? "var(--mint)" : "var(--border)",
                  background: on ? "var(--mint)" : "var(--bg-surface)",
                  color: on ? "#fff" : "var(--fg-muted)",
                }}
              >
                {on ? "✓ " : ""}{label}
              </button>
            );
          })}
          <button
            onClick={() => setAdvOpen(!advOpen)}
            className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95"
            style={{ borderColor: advOpen ? "var(--mint)" : "var(--border)", background: advOpen ? "var(--mint)" : "var(--bg-surface)", color: advOpen ? "#fff" : "var(--fg-muted)" }}
          >
            <SlidersHorizontal size={13} /> {t("fa.advanced")}
          </button>
          <button
            onClick={routeNearMe}
            disabled={routeBusy}
            className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--mint)", opacity: routeBusy ? 0.6 : 1 }}
          >
            <Crosshair size={13} /> {routeBusy ? "…" : t("fa.routeNearMe")}
          </button>
          <button
            onClick={nearestEr}
            disabled={erBusy}
            className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--emergency)", opacity: erBusy ? 0.6 : 1 }}
          >
            <Siren size={13} /> {erBusy ? "…" : t("fa.nearestEr")}
          </button>
          <span className="ms-auto flex items-center gap-1.5 text-xs" style={{ color: "var(--fg-subtle)" }}>
            <Navigation size={12} style={{ color: "var(--mint)" }} /> {t("fa.nearest")}
          </span>
        </motion.div>

        {/* 4H — advanced pricing search accordion */}
        {advOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 overflow-hidden">
            <div className="grid grid-cols-1 items-end gap-3 rounded-3xl border p-5 sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <SearchSelect options={diseases.map((d) => ({ label: d.name }))} placeholder={t("fa.disease")} value={advDisease} onChange={setAdvDisease} accent="var(--mint)" />
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Severity</label>
                <select className="input-line" value={advSeverity} onChange={(e) => setAdvSeverity(e.target.value)} style={{ ["--accent" as any]: "var(--mint)" }}>
                  {SEVERITY.map(([v, k]) => <option key={v} value={v} style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}>{t(k)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Routing urgency</label>
                <select className="input-line" value={routeTier} onChange={(e) => setRouteTier(e.target.value)} style={{ ["--accent" as any]: "var(--mint)" }}>
                  {["L1", "L2", "L3", "L4"].map((x) => <option key={x} style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}>{x}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIncludePricing(!includePricing)} className="flex-1 rounded-full border px-4 py-2.5 text-xs font-bold transition-all active:scale-95"
                  style={{ borderColor: includePricing ? "var(--mint)" : "var(--border)", background: includePricing ? "var(--mint)" : "transparent", color: includePricing ? "#fff" : "var(--fg-muted)" }}>
                  {includePricing ? "✓ " : ""}{t("fa.includePricing")}
                </button>
                <button onClick={() => { setAdvDisease(null); setRoute(null); setErList(null); }} className="rounded-full border px-4 py-2.5 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
                  {t("c.clear")}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <select aria-label="Select city" value={city ?? ""} onChange={(e) => setCity(e.target.value || null)} className="sr-only" tabIndex={-1}>
            <option value="">Select city</option>
            {cities.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <SearchSelect options={cityOptions} placeholder={t("fa.cityVillage")} value={cities.find((c) => c.id === city)?.name ?? null} onChange={(label) => setCity(cities.find((c) => c.name === label)?.id ?? null)} accent="var(--mint)" />
          <div className="lg:col-span-2" style={{ ["--accent" as any]: "var(--mint)" }}>
            <input className="input-line" placeholder="Search by name…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </motion.div>

        {error && (
          <p className="mt-4 rounded-2xl border p-4 text-sm font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>{error}</p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING_SOFT} className="relative h-[380px] overflow-hidden rounded-3xl border lg:h-[560px] lg:sticky lg:top-24" style={{ borderColor: "var(--border)" }}>
            <MapView facilities={pins} selectedId={selectedId} onSelect={(id) => { setSelectedId(String(id)); setExpandedId(String(id)); }} className="h-full w-full" />
            <div className="absolute bottom-3 start-3 rounded-full border px-3 py-1.5 text-[11px] font-bold" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--bg-surface) 88%, transparent)", backdropFilter: "blur(8px)" }}>
              <span className="me-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "var(--mint)", animation: "soft-pulse 1.8s infinite" }} />
              LIVE · OpenStreetMap
            </div>
          </motion.div>

          <div className="space-y-4">
            {/* 4H — GPS routing recommendations (recommendRoute) */}
            {route && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border p-5" style={{ borderColor: "color-mix(in oklab, var(--mint) 35%, var(--border))", background: "var(--bg-surface)" }}>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-base font-bold"><Crosshair size={16} style={{ color: "var(--mint)" }} /> {t("fa.routeResults")}</h3>
                  <button onClick={() => setRoute(null)} className="rounded-full p-1.5" aria-label={t("c.close")}><X size={14} /></button>
                </div>
                {route.recommendations.length === 0 && <p className="mt-3 text-sm" style={{ color: "var(--fg-muted)" }}>No facilities found for this location.</p>}
                <div className="mt-3 space-y-2">
                  {route.recommendations.slice(0, 5).map((r) => (
                    <div key={r.facility_id} className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "color-mix(in oklab, var(--fg) 4%, transparent)" }}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{r.name}</div>
                        <div className="truncate text-xs" style={{ color: "var(--fg-muted)" }}>{r.type} · {r.district}, {r.state} · OOP est. {fmtINR(Math.round(r.cost.estimated_oop_expenditure))}</div>
                      </div>
                      {r.pm_jay_empaneled && <BadgeCheck size={15} style={{ color: "var(--mint)" }} />}
                      <span className="font-display text-sm font-bold" style={{ color: "var(--mint)" }}>{Math.round(r.distance_km)} {t("c.km")}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 4H — nearest 24×7 ER (getEmergencyRoute) */}
            {erList && erList.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border p-5" style={{ borderColor: "color-mix(in oklab, var(--emergency) 35%, var(--border))", background: "var(--bg-surface)" }}>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-base font-bold"><Siren size={16} style={{ color: "var(--emergency)" }} /> {t("fa.erResults")}</h3>
                  <button onClick={() => setErList(null)} className="rounded-full p-1.5" aria-label={t("c.close")}><X size={14} /></button>
                </div>
                <div className="mt-3 space-y-2">
                  {erList.map((e, i) => {
                    const h = e.hospital;
                    const lat = Number(h.lat ?? 0), lon = Number(h.lon ?? 0);
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "color-mix(in oklab, var(--emergency) 5%, transparent)" }}>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">{String(h.name ?? "Emergency centre")}</div>
                          <div className="truncate text-xs" style={{ color: "var(--fg-muted)" }}>{String(h.tier ?? "")}</div>
                        </div>
                        <span className="font-display text-sm font-bold" style={{ color: "var(--emergency)" }}>{e.km} {t("c.km")}</span>
                        {lat && lon ? (
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-white" style={{ background: "var(--mint)" }}>
                            <Navigation size={12} /> {t("c.directions")}
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {loading && <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{t("tr.analyzing")}…</p>}
            {(hits ?? []).map((f, i) => {
              const h = f.hospital;
              return (
                <motion.div
                  key={h.id}
                  layout
                  initial={{ opacity: 0, y: 34 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING_SOFT, delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setExpandedId(h.id)}
                  className="relative cursor-pointer overflow-hidden rounded-3xl border p-6 transition-shadow"
                  style={{ borderColor: selectedId === h.id ? "color-mix(in oklab, var(--mint) 45%, var(--border))" : "var(--border)", background: "var(--bg-surface)" }}
                >
                  <div className="absolute inset-y-0 start-0 w-1" style={{ background: typeOf(String(h.tier)).startsWith("Private") ? "var(--amber)" : "var(--coral)" }} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-bold leading-snug">{h.name}</h3>
                      <span className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>
                        {String(h.tier)}
                      </span>
                      {f.price && (
                        <span className="ms-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{
                          background: f.price.source === "verified_official_data" ? "var(--mint-soft)" : f.price.source === "community_estimate_unverified" ? "var(--amber-soft)" : "color-mix(in oklab, var(--fg) 5%, transparent)",
                          color: f.price.source === "verified_official_data" ? "var(--mint)" : f.price.source === "community_estimate_unverified" ? "var(--amber)" : "var(--fg-subtle)",
                        }}>
                          {f.price.amount_inr == null || f.price.source === "no_estimate_available"
                            ? t("fa.priceNone")
                            : `${fmtINR(f.price.amount_inr)} · ${f.price.source === "verified_official_data" ? t("fa.priceVerified") : t("fa.priceCommunity")}`}
                        </span>
                      )}
                    </div>
                    <div className="text-end">
                      <div className="font-display text-lg font-bold" style={{ color: "var(--mint)" }}>{f.km} {t("c.km")}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>
                    <span className="flex items-center gap-1"><Clock size={12} /> {h.er24 ? t("fa.open24") : t("fa.openDay")}</span>
                    <span className="flex items-center gap-1"><Bed size={12} /> {h.beds} {t("fa.beds")} <span className="text-[10px] opacity-75 font-normal">({t("c.dataAsOf")} 2026-03)</span></span>
                    {h.pmjay && (<span className="flex items-center gap-1" style={{ color: "var(--mint)" }}><BadgeCheck size={12} /> PM-JAY</span>)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {h.icu && <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "color-mix(in oklab, var(--fg) 5%, transparent)", color: "var(--fg-muted)" }}>ICU</span>}
                    {h.bloodBank && <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "color-mix(in oklab, var(--fg) 5%, transparent)", color: "var(--fg-muted)" }}>Blood bank</span>}
                    {h.nabh && <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "color-mix(in oklab, var(--fg) 5%, transparent)", color: "var(--fg-muted)" }}>NABH</span>}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    {f.directions_url && (
                      <a href={f.directions_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: "var(--mint)", boxShadow: "0 10px 24px -12px var(--mint)" }}
                        onClick={(e) => e.stopPropagation()}>
                        <Navigation size={13} /> {t("c.directions")}
                      </a>
                    )}
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--fg-subtle)" }}>
                      <Clock size={11} /> {f.last_verified_date ? `${t("c.dataAsOf")} ${String(f.last_verified_date).slice(0, 10)}` : `${t("c.dataAsOf")} 2026-03-01`}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* detail popup */}
      {expanded && (
        <motion.div className="fixed inset-0 z-[80] overflow-y-auto p-4 sm:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExpandedId(null)}>
          <motion.div
            initial={{ scale: 0.9, y: 34, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={SPRING_SOFT}
            className="relative mx-auto max-w-2xl rounded-3xl border p-6 sm:p-10"
            style={{ borderColor: "var(--border)", background: "var(--bg-elevated)", boxShadow: "0 30px 80px -20px oklch(0 0 0 / 0.4)", maxHeight: "88dvh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setExpandedId(null)} className="absolute end-5 top-5 rounded-full p-2 transition-colors hover:bg-fg/10" aria-label={t("c.close")}><X size={18} /></button>
            <h2 className="mt-5 font-display text-3xl font-bold">{expanded.hospital.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>{String(expanded.hospital.tier)}</span>
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--bg)", color: "var(--fg-muted)" }}><Bed size={11} className="me-1 inline" /> {expanded.hospital.beds} {t("fa.beds")} ({t("c.dataAsOf")} 2026-03)</span>
              {expanded.hospital.pmjay && <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "var(--mint-soft)", color: "var(--mint)" }}>PM-JAY</span>}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {["er24", "icu", "bloodBank", "nabh"].map((k) => {
                const label = k === "er24" ? "24×7 ER" : k === "bloodBank" ? "Blood bank" : k.toUpperCase();
                return (expanded.hospital as Record<string, unknown>)[k] ? (
                  <span key={k} className="rounded-full border px-3.5 py-1.5 text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--fg)" }}>{label}</span>
                ) : null;
              })}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {expanded.directions_url && (
                <a href={expanded.directions_url} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white" style={{ background: "var(--mint)", boxShadow: "0 12px 30px -12px var(--mint)" }}>
                  <Navigation size={15} /> {t("c.directions")}
                </a>
              )}
              <a href="tel:108" className="flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white" style={{ background: "var(--coral)" }}>
                <Phone size={15} /> {t("c.call")} 108
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </LangFade>
  );
}