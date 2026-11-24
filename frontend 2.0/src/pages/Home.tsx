import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Stethoscope, IndianRupee, Shield, MapPin, Users, ArrowRight, Check } from "lucide-react";
import { TiltCard, StaggerWords, useMedia } from "../lib/motion";
import { useT } from "../i18n";
import { MapView, type FacilityPin, type FacType } from "../lib/MapView";
import { USER_LOCATION } from "../lib/constants";
import { getAshaWorkers, searchFacilities, type AshaWorkerPublic } from "../lib/api";

/* ---------- animated heartbeat waveform (accelerates on hover) ---------- */
function Heartbeat({ hovered, color }: { hovered: boolean; color: string }) {
  return (
    <svg viewBox="0 0 400 90" className="h-20 w-full" fill="none" aria-hidden>
      <path
        d="M0 45 L70 45 L88 45 L100 20 L114 68 L126 45 L400 45"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <motion.path
        d="M0 45 L70 45 L88 45 L100 20 L114 68 L126 45 L400 45"
        stroke="var(--bg-surface)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="0 560"
        animate={{ strokeDasharray: ["0 560", "560 0"] }}
        transition={{ duration: hovered ? 0.9 : 2.8, repeat: Infinity, ease: "linear" }}
        style={{ mixBlendMode: "screen" }}
        opacity="0.85"
      />
      <motion.circle
        r="4"
        fill={color}
        animate={{ cx: [0, 400], opacity: [0, 1, 1, 0] }}
        transition={{ duration: hovered ? 0.9 : 2.8, repeat: Infinity, ease: "linear", times: [0, 0.08, 0.92, 1] }}
        style={{ cy: 45 }}
      />
    </svg>
  );
}

/* ---------- animated coin / bar stacks (amber) ---------- */
function CoinBars() {
  return (
    <div className="flex h-28 items-end justify-center gap-2.5" aria-hidden>
      {[0.35, 0.55, 0.8, 0.5, 0.68].map((h, i) => (
        <div key={i} className="relative flex flex-col-reverse items-center">
          <motion.div
            className="w-7 rounded-t-full border-2"
            style={{ borderColor: "color-mix(in oklab, var(--amber) 55%, transparent)", background: "color-mix(in oklab, var(--amber) 14%, transparent)" }}
            initial={{ height: 0 }}
            whileInView={{ height: 90 * h }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 120, damping: 14, delay: i * 0.12 }}
          />
          <motion.div
            className="absolute -top-2 h-3 w-3 rounded-full"
            style={{ background: "var(--amber)", boxShadow: "0 0 12px var(--amber)" }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2 + i * 0.35, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------- shield morphing to check on hover (sky) ---------- */
function MorphShield({ hovered }: { hovered: boolean }) {
  return (
    <div className="relative flex h-28 items-center justify-center">
      <motion.div
        animate={{ rotate: hovered ? [0, -14, 0] : 0, scale: hovered ? 0.4 : 1, opacity: hovered ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 15 }}
        className="absolute"
      >
        <Shield size={74} strokeWidth={1.4} style={{ color: "var(--sky)" }} />
      </motion.div>
      <motion.div
        initial={false}
        animate={{ scale: hovered ? 1 : 0.3, opacity: hovered ? 1 : 0, rotate: hovered ? 0 : -30 }}
        transition={{ type: "spring", stiffness: 300, damping: 16 }}
        className="absolute flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "var(--sky-soft)" }}
      >
        <Check size={44} strokeWidth={3} style={{ color: "var(--sky)" }} />
      </motion.div>
    </div>
  );
}

function Cta({ label, hovered }: { label: string; hovered: boolean }) {
  return (
    <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--fg)" }}>
      {label}
      <motion.span animate={{ x: hovered ? 5 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}>
        <ArrowRight size={15} />
      </motion.span>
    </span>
  );
}

export default function Home() {
  const { t } = useT();
  const navigate = useNavigate();
  const [h1, setH1] = useState(false);
  const [h2, setH2] = useState(false);
  const [h3, setH3] = useState(false);
  const [h4, setH4] = useState(false);
  /* live Leaflet preview only on larger screens — mobile gets a light CSS field */
  const showMap = useMedia("(min-width: 640px)");

  /* doc 27 item 3 — the map preview and ASHA marquee now come from the live
   * backend, never the deleted mock arrays.                    */
  const [nearby, setNearby] = useState<FacilityPin[]>([]);
  const [workers, setWorkers] = useState<AshaWorkerPublic[]>([]);

  useEffect(() => {
    searchFacilities("jaipur", { pmjay: false, er24: false, icu: false, blood: false, nabh: false, beds: false }, "", "near")
      .then((hits) => setNearby(hits.slice(0, 12).map((h) => ({ id: h.hospital.id, type: (!String(h.hospital.tier).startsWith("Private") ? "district" : "private") as FacType, lat: h.hospital.lat, lng: h.hospital.lon }))))
      .catch(() => setNearby([]));
    getAshaWorkers(undefined, undefined, 12)
      .then(setWorkers)
      .catch(() => setWorkers([]));
  }, []);

  const PIN_STYLE: Record<string, string> = { phc: "var(--mint)", chc: "var(--lavender)", district: "var(--coral)", private: "var(--amber)" };

  return (
    <div className="pt-10">
      {/* header line — speaks through design, no corporate greeting */}
      <div className="mb-10">
        <StaggerWords
          text={t("nav.home")}
          className="font-display text-4xl font-bold tracking-tight sm:text-5xl"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 96 }}
          transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 h-1 rounded-full"
          style={{ background: "var(--coral)" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* 1 — AI Symptom Detector: 2×2 coral */}
        <TiltCard
          onClick={() => navigate("/app/triage")}
          className="group relative flex min-h-[380px] flex-col overflow-hidden rounded-3xl p-8 sm:col-span-2 sm:row-span-2"
          style={{ background: "linear-gradient(150deg, var(--coral-soft) 0%, var(--bg-surface) 55%)", border: "1px solid var(--border)" }}
        >
          <div className="absolute -end-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl transition-opacity duration-500 group-hover:opacity-70" style={{ background: "var(--coral)" }} />
          <div className="relative z-10 flex flex-col" onMouseEnter={() => setH1(true)} onMouseLeave={() => setH1(false)}>
            <div className="flex items-center justify-between">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: "var(--coral)", boxShadow: "0 10px 24px -8px var(--coral)" }}>
                <Stethoscope size={22} />
              </span>
              <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: "color-mix(in oklab, var(--coral) 14%, transparent)", color: "var(--coral)" }}>AI</span>
            </div>
            <h2 className="mt-8 font-display text-3xl font-bold leading-tight sm:text-4xl">{t("h.t1")}</h2>
            <p className="mt-2 max-w-md text-[15px]" style={{ color: "var(--fg-muted)" }}>{t("h.t1d")}</p>
            <div className="mt-6"><Heartbeat hovered={h1} color="var(--coral)" /></div>
            <Cta label={t("h.cta1")} hovered={h1} />
          </div>
        </TiltCard>

        {/* 2 — Cost & Finance: 1×2 tall amber */}
        <TiltCard
          onClick={() => navigate("/app/cost")}
          className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-3xl p-7 sm:row-span-2"
          style={{ background: "linear-gradient(200deg, var(--amber-soft) 0%, var(--bg-surface) 60%)", border: "1px solid var(--border)" }}
        >
          <div className="flex flex-1 flex-col" onMouseEnter={() => setH2(true)} onMouseLeave={() => setH2(false)}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: "var(--amber)", boxShadow: "0 10px 24px -8px var(--amber)" }}>
              <IndianRupee size={20} />
            </span>
            <h2 className="mt-6 font-display text-2xl font-bold leading-tight">{t("h.t2")}</h2>
            <p className="mt-1.5 text-sm" style={{ color: "var(--fg-muted)" }}>{t("h.t2d")}</p>
            <div className="mt-auto pt-6"><CoinBars /></div>
            <Cta label={t("h.cta2")} hovered={h2} />
          </div>
        </TiltCard>

        {/* 3 — Insurance: 1×1 sky */}
        <TiltCard
          onClick={() => navigate("/app/insurance")}
          className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-3xl p-7"
          style={{ background: "linear-gradient(160deg, var(--sky-soft) 0%, var(--bg-surface) 70%)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between" onMouseEnter={() => setH3(true)} onMouseLeave={() => setH3(false)}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: "var(--sky)", boxShadow: "0 10px 24px -8px var(--sky)" }}>
              <Shield size={20} />
            </span>
            <MorphShield hovered={h3} />
          </div>
          <h2 className="mt-auto font-display text-2xl font-bold leading-tight">{t("h.t3")}</h2>
          <p className="mt-1.5 text-sm" style={{ color: "var(--fg-muted)" }}>{t("h.t3d")}</p>
          <Cta label={t("h.cta3")} hovered={h3} />
        </TiltCard>

        {/* 4 — Facility Navigator: 2×1 mint with LIVE mini map */}
        <TiltCard
          onClick={() => navigate("/app/facilities")}
          className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-3xl p-0 sm:col-span-2"
          style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}
        >
          <div className="absolute inset-0 z-0 opacity-90">
            {showMap ? (
              <MapView facilities={nearby} interactive={false} className="h-full w-full" />
            ) : (
              <div className="relative h-full w-full" style={{ background: "radial-gradient(circle at 28% 38%, var(--mint-soft), var(--bg-surface) 75%)" }}>
                {nearby.map((f, i) => (
                  <span
                    key={f.id}
                    className="absolute h-3 w-3 rounded-full border-2 border-white"
                    style={{ left: `${14 + ((i * 29) % 72)}%`, top: `${22 + ((i * 19) % 52)}%`, background: PIN_STYLE[f.type], boxShadow: "0 2px 8px oklch(0 0 0 / 0.35)", animation: `soft-pulse ${2 + i * 0.4}s ease-in-out infinite` }}
                  />
                ))}
              </div>
            )}
            <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--bg-surface) 88%, transparent) 40%, transparent 75%)" }} />
          </div>
          <div className="relative z-10 flex h-full flex-col justify-between p-7" onMouseEnter={() => setH4(true)} onMouseLeave={() => setH4(false)}>
            <div className="flex items-center justify-between">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: "var(--mint)", boxShadow: "0 10px 24px -8px var(--mint)" }}>
                <MapPin size={20} />
              </span>
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: "var(--bg-surface)", color: "var(--mint)", border: "1px solid color-mix(in oklab, var(--mint) 35%, transparent)" }}>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--mint)" }} />
                LIVE
              </span>
            </div>
            <div className="mt-10">
              <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("h.t4")}</h2>
              <p className="mt-1.5 text-sm" style={{ color: "var(--fg-muted)" }}>{t("h.t4d")}</p>
              <Cta label={t("h.cta4")} hovered={h4} />
            </div>
          </div>
        </TiltCard>

        {/* 5 — ASHA Workers: full-width lavender marquee */}
        <TiltCard
          onClick={() => navigate("/app/asha")}
          className="group relative flex min-h-[190px] flex-col overflow-hidden rounded-3xl p-7 sm:col-span-3"
          style={{ background: "linear-gradient(120deg, var(--lavender-soft) 0%, var(--bg-surface) 65%)", border: "1px solid var(--border)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: "var(--lavender)", boxShadow: "0 10px 24px -8px var(--lavender)" }}>
                  <Users size={20} />
                </span>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">{t("h.t5")}</h2>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>{t("h.t5d")}</p>
            </div>
            <div className="relative w-full overflow-hidden sm:w-[46%]" style={{ maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}>
              <div className="marquee-track flex w-max gap-3 py-2">
                {(() => {
                  const hues = ["var(--lavender)", "var(--coral)", "var(--mint)", "var(--amber)", "var(--sky)"];
                  const rows = workers.length ? [...workers, ...workers] : [];
                  return rows.map((w, i) => {
                    const initials = w.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("");
                    return (
                      <div key={i} className="flex shrink-0 items-center gap-2.5 rounded-full border px-4 py-2" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-bold text-white" style={{ background: hues[i % hues.length] }}>
                          {initials}
                        </span>
                        <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "var(--fg-muted)" }}>{w.full_name} · {w.village_ward}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </TiltCard>
      </div>

      {/* small footer note */}
      <p className="mt-8 text-center text-xs" style={{ color: "var(--fg-subtle)" }}>
        SwasthyaSetu AI · {USER_LOCATION.lat.toFixed(2)}°N, {USER_LOCATION.lng.toFixed(2)}°E · {t("c.online")}
      </p>
    </div>
  );
}
