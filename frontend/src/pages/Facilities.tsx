import { AnimatePresence, motion } from "framer-motion";
import { SearchSelect } from "../components/SearchSelect";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Btn,
  Chip,
  ErrorToast,
  Glass,
  IconMap,
  IconSearch,
  IconShield,
  SectionTitle,
  Toggle,
} from "../components/ui";
import { CITIES, HOSPITALS, cityById, project, providerById, type Hospital } from "../lib/data";
import { advancedSearchFacilities, etaMinutes, searchFacilities, type FacilityAdvancedHit } from "../lib/engine";
import { PriceBadge } from "../components/Feedback";
import { MapView } from "../components/MapView";
import { useStore, useT } from "../lib/store";

interface Filters {
  pmjay: boolean;
  er24: boolean;
  icu: boolean;
  blood: boolean;
  nabh: boolean;
  beds: boolean;
}

const EMPTY_FILTERS: Filters = { pmjay: false, er24: false, icu: false, blood: false, nabh: false, beds: false };

export function Facilities() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const { insurance } = useStore();

  const focusId = (location.state as { facilityId?: string } | null)?.facilityId ?? null;

  const [cityId, setCityId] = useState(
    focusId ? HOSPITALS.find((h) => h.id === focusId)?.cityId ?? CITIES[0].id : CITIES[0].id
  );
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<"near" | "cost" | "quality">("near");
  const [selected, setSelected] = useState<string | null>(focusId);
  const [results, setResults] = useState<{ h: Hospital; km: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState<FacilityAdvancedHit[]>([]);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");

  useEffect(() => {
    if (focusId) {
      const h = HOSPITALS.find((x) => x.id === focusId);
      if (h) setCityId(h.cityId);
    }
  }, [focusId]);

  const city = cityById(cityId);
  const provider = insurance ? providerById(insurance.providerId) : null;

  // Fetch filtered facilities from the backend when filters/city/query/sort change.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setAdvancedLoading(true);
    setError("");
    (async () => {
      try {
        const hits = await searchFacilities(cityId, filters, query, sort, controller.signal);
        if (!controller.signal.aborted) setResults(hits.map((hit) => ({ h: hit.hospital, km: hit.km })));
      } catch (cause) {
        if (!controller.signal.aborted) {
          console.error("Facility search failed", cause);
          setResults([]);
          setError("Facility search failed. Check the connection and try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
      // Also fetch the V3 advanced-search (curated-first pricing) in parallel.
      try {
        const adv = await advancedSearchFacilities(
          cityId, filters, query, { disease_id: null, severity: null, include_pricing: true },
          controller.signal,
        );
        if (!controller.signal.aborted) setAdvanced(adv);
      } catch (cause) {
        if (!controller.signal.aborted) {
          console.warn("Advanced facility search failed (non-fatal)", cause);
          setAdvanced([]);
        }
      } finally {
        if (!controller.signal.aborted) setAdvancedLoading(false);
      }
    })();
    return () => controller.abort();
  }, [cityId, filters, query, sort]);

  const filterRow = (label: string, key: keyof Filters, tone?: "mint" | "red") => (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={`text-[12.5px] ${tone === "mint" ? "text-mint" : tone === "red" ? "text-danger/90" : "text-mist"}`}>
        {label}
     </span>
      <Toggle checked={filters[key]} onChange={(v) => setFilters((f) => ({ ...f, [key]: v }))} danger={tone === "red"} />
   </div>
  );

  /* map geometry */
  const cityNodes = CITIES.map((c) => ({ c, ...project(c.lat, c.lon) }));
  const selectedHospital = selected ? HOSPITALS.find((h) => h.id === selected) : null;
  const cityHospitals = HOSPITALS.filter((h) => h.cityId === cityId);

  const useGoogle = true;

  return (
    <div>
      <SectionTitle kicker="Navigation · PM-JAY networks" title={t("fac.title")} sub={t("fac.sub")} />

      <div className="mt-6 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        {/* ------------- sidebar ------------- */}
        <Glass className="rounded-[6px] p-5 lg:col-span-4">
          <div className="relative">
            <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mist/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("fac.search")}
              className="field pl-10"
            />
         </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="label">{t("fac.city")}</span>
              <SearchSelect value={cityId} onChange={setCityId} options={CITIES.map(c => ({ value: c.id, label: c.nameKey }))} />
           </div>
            <div>
              <span className="label">{t("fac.sort")}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="field">
                <option value="near">{t("fac.sort.near")}</option>
                <option value="cost">{t("fac.sort.cost")}</option>
                <option value="quality">{t("fac.sort.quality")}</option>
             </select>
           </div>
         </div>

          <div className="mt-5">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-cyanx">
              <IconShield size={12} /> {t("fac.filters")}
           </div>
            <div className="divide-y divide-white/[0.04] rounded-[4px] border border-white/[0.06] px-4">
              {filterRow(t("fac.pmjay"), "pmjay", "mint")}
              {filterRow(t("fac.er24"), "er24", "red")}
              {filterRow(t("fac.icu"), "icu")}
              {filterRow(t("fac.blood"), "blood")}
              {filterRow(t("fac.nabh"), "nabh")}
              {filterRow(t("fac.beds"), "beds")}
           </div>
         </div>

          {/* result list */}
          <div className="mt-5">
            {loading && <p className="mb-2 text-[11px] text-cyanx" role="status" aria-live="polite">Searching facilities…</p>}
            {advancedLoading && !loading && <p className="mb-2 text-[11px] text-cyanx/70" role="status" aria-live="polite">Checking official pricing…</p>}
            {error && <ErrorToast message={error} onRetry={() => { /* trigger re-fetch */ }} onDismiss={() => setError("")} />}
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-mist/70">
              {results.length} {t("fac.results")} · {city.nameKey}
           </div>
            <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {results.map(({ h, km }, i) => {
                  const accepted = provider ? provider.network.includes(h.id) : false;
                  const isSel = selected === h.id;
                  return (
                    <motion.button
                      type="button"
                      key={h.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelected(h.id)}
                      className={`block w-full rounded-[4px] border px-4 py-3 text-left transition-all ${
                        isSel
                          ? "border-cyanx/60 bg-cyanx/[0.08] shadow-[0_0_24px_rgba(78,230,240,0.18)]"
                          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.14]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`text-[13px] font-semibold ${isSel ? "text-cyanx" : "text-frost"}`}>
                            {h.name}
                         </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Chip tone="cyan">{t("common.score")} {h.score}</Chip>
                            <Chip>{km} {t("common.km")} · {etaMinutes(km, h.cityId)} {t("common.mins")}</Chip>
                            {h.pmjay && <Chip tone="mint" glow>{t("common.pmjay")}</Chip>}
                            {h.er24 && <Chip tone="red">{t("common.er24")}</Chip>}
                            {h.icu && <Chip tone="cyan">{t("common.icu")}</Chip>}
                            {h.bloodBank && <Chip tone="amber">{t("common.blood")}</Chip>}
                            {h.nabh && <Chip tone="mint">{t("common.nabh")}</Chip>}
                         </div>
                       </div>
                        <IconMap size={14} className={isSel ? "text-cyanx" : "text-mist/40"} />
                     </div>
                      {accepted && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-mint">
                          <IconShield size={12} />
                          <span className="text-glow-mint">{provider!.name} {t("fac.accepted")}</span>
                       </div>
                      )}
                      {provider && !accepted && (
                        <div className="mt-2 text-[10.5px] font-medium text-amber/70">{t("fac.accepted.miss")}</div>
                      )}
                      {/* V3: verified price badge + Get Directions link */}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <PriceBadge
                          source={(advanced.find((a) => a.hospital.id === h.id)?.source) ?? "no_estimate_available"}
                          amount={advanced.find((a) => a.hospital.id === h.id)?.price?.amount_inr ?? null}
                        />
                        <a
                          href={"https://www.google.com/maps/dir/?api=1&destination=" + h.lat + "," + h.lon}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-[3px] border border-cyanx/30 bg-cyanx/[0.06] px-2 py-1 text-[10.5px] font-semibold text-cyanx hover:bg-cyanx/[0.12]"
                        >
                          Get directions
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
                       </a>
                     </div>
                   </motion.button>
                  );
                })}
             </AnimatePresence>
              {results.length === 0 && (
                <p className="rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-4 py-5 text-[12px] text-mist">
                  {t("fac.empty")}
               </p>
              )}
           </div>
         </div>
       </Glass>

        {/* ------------- map ------------- */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          {useGoogle ? (
            <div className="flex items-center gap-2 self-end rounded-[4px] border border-white/[0.06] bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => setMapType("roadmap")}
                className={"rounded-[3px] px-3 py-1 text-[11px] font-semibold transition-colors " + (mapType === "roadmap" ? "bg-cyanx/85 text-abyss" : "text-mist hover:text-frost")}
              >
                Street
             </button>
              <button
                type="button"
                onClick={() => setMapType("satellite")}
                className={"rounded-[3px] px-3 py-1 text-[11px] font-semibold transition-colors " + (mapType === "satellite" ? "bg-cyanx/85 text-abyss" : "text-mist hover:text-frost")}
              >
                Satellite
             </button>
           </div>
          ) : null}
          <Glass className="relative overflow-hidden rounded-[6px]">
            {useGoogle ? (
              <MapView
                cityLat={city.lat}
                cityLon={city.lon}
                facilities={cityHospitals.map((h) => ({ id: h.id, name: h.name, lat: h.lat, lon: h.lon }))}
                selectedId={selected}
                onSelect={(id) => setSelected(id)}
                mapTypeId={mapType === "satellite" ? "hybrid" : "roadmap"}
                
              />
            ) : (
              <svg viewBox="0 0 1000 620" className="block w-full" role="img" aria-label="Facility map">
                <defs>
                  <radialGradient id="mapGlowC" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stopColor="rgba(78,230,240,0.07)" />
                    <stop offset="100%" stopColor="rgba(78,230,240,0)" />
                 </radialGradient>
                  <radialGradient id="mapGlowM" cx="50%" cy="55%" r="55%">
                    <stop offset="0%" stopColor="rgba(52,245,177,0.08)" />
                    <stop offset="100%" stopColor="rgba(52,245,177,0)" />
                 </radialGradient>
                  <filter id="nodeGlow" x="-120%" y="-120%" width="340%" height="340%">
                    <feGaussianBlur stdDeviation="7" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                   </feMerge>
                 </filter>
               </defs>

                <rect width="1000" height="620" fill="url(#mapGlowC)" />
                <rect width="1000" height="620" fill="url(#mapGlowM)" />

                {/* hairline grid */}
                {Array.from({ length: 11 }).map((_, i) => (
                  <g key={i} stroke="rgba(255,255,255,0.028)">
                    <line x1={i * 100} y1={0} x2={i * 100} y2={620} />
                    <line x1={0} y1={i * 62} x2={1000} y2={i * 62} />
                 </g>
                ))}

                {/* inter-city edges */}
                {CITIES.map((c, i) => {
                  const next = CITIES[(i + 1) % CITIES.length];
                  const a = project(c.lat, c.lon);
                  const b = project(next.lat, next.lon);
                  return (
                    <line
                      key={"edge-" + i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                      strokeDasharray="3 6"
                    />
                  );
                })}

                {/* route to selected hospital */}
                {selectedHospital && selectedHospital.cityId === cityId && (
                  <g>
                    <line
                      x1={cityNodes.find((n) => n.c.id === cityId)!.x}
                      y1={cityNodes.find((n) => n.c.id === cityId)!.y}
                      x2={project(selectedHospital.lat, selectedHospital.lon).x}
                      y2={project(selectedHospital.lat, selectedHospital.lon).y}
                      stroke="rgba(52,245,177,0.8)"
                      strokeWidth="2"
                      strokeDasharray="10 8"
                      className="dash-flow"
                      filter="url(#nodeGlow)"
                    />
                 </g>
                )}

                {/* hospital markers */}
                {cityHospitals.map((h) => {
                  const pos = project(h.lat, h.lon);
                  const isSel = selected === h.id;
                  return (
                    <g
                      key={h.id}
                      onClick={() => setSelected(h.id)}
                      style={{ cursor: "pointer" }}
                      transform={"translate(" + pos.x + "," + pos.y + ")"}
                    >
                      {isSel && (
                        <circle r="14" fill="rgba(78,230,240,0.18)" filter="url(#nodeGlow)" />
                      )}
                      <rect
                        x={isSel ? -8 : -7}
                        y={isSel ? -8 : -7}
                        width={isSel ? 16 : 14}
                        height={isSel ? 16 : 14}
                        transform={"rotate(45 " + 0 + " " + 0 + ")"}
                        fill={isSel ? "#34f5b1" : "#4ee6f0"}
                        stroke="#04070d"
                        strokeWidth={isSel ? 2 : 1.5}
                        opacity={isSel ? 1 : 0.7}
                      />
                      {isSel && (
                        <text x="0" y="26" textAnchor="middle" fill="#cfd6e0" fontSize="11" fontWeight="600">
                          {h.name}
                       </text>
                      )}
                   </g>
                  );
                })}

                {/* city node */}
                {(() => {
                  const cn = cityNodes.find((n) => n.c.id === cityId);
                  if (!cn) return null;
                  return (
                    <g transform={"translate(" + cn.x + "," + cn.y + ")"}>
                      <circle r="10" fill="rgba(78,230,240,0.85)" filter="url(#nodeGlow)" />
                      <circle r="5" fill="#04070d" />
                      <text x="0" y="-14" textAnchor="middle" fill="#4ee6f0" fontSize="11" fontWeight="600">
                        {cn.c.nameKey}
                     </text>
                   </g>
                  );
                })()}
             </svg>
            )}

            {/* overlay chips - shown above both map types */}
            <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
              <div className="rounded-[3px] border border-cyanx/30 bg-abyss/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyanx backdrop-blur">
                {t("fac.live")} · {cityHospitals.length} {t("fac.results").toLowerCase()}
             </div>
              {useGoogle ? null : (
                <div className="rounded-[3px] border border-mist/15 bg-abyss/70 px-2.5 py-1 text-[9.5px] uppercase tracking-[0.14em] text-mist/70 backdrop-blur">
                  Schematic map · add VITE_GOOGLE_MAPS_API_KEY for satellite
               </div>
              )}
           </div>
         </Glass>

          {/* selected hospital details */}
          {selectedHospital && (
            <Glass className="rounded-[6px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-frost">{selectedHospital.name}</div>
                  <div className="mt-1 text-[11px] text-mist">
                    {cityById(selectedHospital.cityId)?.nameKey} · {t("common.score")} {selectedHospital.score}
                 </div>
               </div>
                <Btn variant="ghost" onClick={() => navigate("/")}>
                  {t("fac.back")}
               </Btn>
             </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="text-[9.5px] uppercase tracking-[0.16em] text-mist/60">{t("common.er24")}</div>
                  <div className="mt-0.5 text-[12px] font-semibold text-frost">{selectedHospital.er24 ? t("common.yes") : t("common.no")}</div>
               </div>
                <div className="rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="text-[9.5px] uppercase tracking-[0.16em] text-mist/60">{t("common.icu")}</div>
                  <div className="mt-0.5 text-[12px] font-semibold text-frost">{selectedHospital.icu ? t("common.yes") : t("common.no")}</div>
               </div>
                <div className="rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="text-[9.5px] uppercase tracking-[0.16em] text-mist/60">{t("common.beds")}</div>
                  <div className="mt-0.5 text-[12px] font-semibold text-frost">{selectedHospital.beds}</div>
               </div>
                <div className="rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="text-[9.5px] uppercase tracking-[0.16em] text-mist/60">{t("common.pmjay")}</div>
                  <div className="mt-0.5 text-[12px] font-semibold text-frost">{selectedHospital.pmjay ? t("common.yes") : t("common.no")}</div>
               </div>
             </div>
              <div className="mt-5">
                <Link
                  to="/cost"
                  state={{ tab: "treat", city: selectedHospital.cityId, hospital: selectedHospital.id }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-gradient-to-r from-mint to-cyanx px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-abyss shadow-[0_4px_16px_rgba(52,245,177,0.3)] transition-transform hover:scale-[1.02]"
                >
                  net_expected_treatment_cost &rarr;
                </Link>
              </div>
           </Glass>
          )}
       </div>
     </div>
   </div>
  );
}

