import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, HeartHandshake, MapPin, CheckCircle2, LogOut, Languages, AlertCircle, ArrowLeft, Phone, Plus, RefreshCw, Siren, Camera, X, ClipboardList, Activity } from "lucide-react";
import { StaggerWords, SPRING_SOFT, LangFade, TiltCard, Magnetic } from "../lib/motion";
import { useT } from "../i18n";
import { useStore } from "../store";
import { STATES } from "../lib/constants";
import { LoginModal } from "../components/LoginModal";
import {
  getAshaWorkers, registerAsha, getFollowups, completeFollowup, getEmergencySync,
  createPatient, getPatientTimeline, createReferral, updateReferral,
  uploadForm, saveRecord, listRecords, syncBatch, getCapacity, reportCapacity,
  type AshaWorkerPublic, type FollowUpOut, type EmergencyCaseOut, type PatientOut,
  type ReferralOut, type CapacityOut, type AshaRecordCreate, type AshaRecordOut,
} from "../lib/api";

/* ---------- offline-sync helpers (phase 4 item 4D) ---------- */

const getWorkerIdFromToken = (token: string): number => {
  try { return Number(JSON.parse(atob(token.split(".")[1])).sub) || 1; } catch { return 1; }
};

/** SHA-256 hex of phone|DOB for the backend's one-way demographic_hash. */
async function demographicHash(phone: string, dob: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${phone}|${dob}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const uuid = () => crypto.randomUUID();

function readStorage<T>(k: string): T[] {
  try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; }
}
function writeStorage<T>(k: string, v: T[]) {
  localStorage.setItem(k, JSON.stringify(v));
}

/** Referral state machine (care_service.py `_ALLOWED_TRANSITIONS`) — the UI
 * only ever offers the NEXT VALID status. */
const NEXT_STATUS: Record<string, string[]> = {
  pending: ["in_transit", "lost"],
  in_transit: ["arrived", "lost"],
  arrived: ["admitted", "completed", "lost"],
  admitted: ["discharged", "completed", "lost"],
  discharged: ["completed", "lost"],
  completed: [],
  lost: [],
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", in_transit: "In transit", arrived: "Arrived",
  admitted: "Admit", discharged: "Discharge", completed: "Completed", lost: "Lost",
};

interface PatientRow { id: string; display_name: string | null; age_band: string | null; created_at: string }
interface ReferralRow { id: string; patient_id: string; from_facility_id: number; to_facility_id: number; urgency_tier: string; status: string; created_at: string }

/* ═══════════════ DISCOVERY ═══════════════ */
export function AshaDiscovery() {
  const { t, lang } = useT();
  const [loginOpen, setLoginOpen] = useState(false);
  const [workers, setWorkers] = useState<AshaWorkerPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getAshaWorkers(undefined, undefined, 20)
      .then(setWorkers)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <LangFade lang={lang}>
      <div className="wash-lavender -mx-4 min-h-dvh px-4 pt-10 sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <StaggerWords text={t("as.title")} className="font-display text-4xl font-bold tracking-tight sm:text-5xl" />
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.4 }} className="mt-3 max-w-xl text-[15px]" style={{ color: "var(--fg-muted)" }}>
              {t("as.sub")}
            </motion.p>
          </div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.45 }} className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row lg:pt-1">
            <Magnetic strength={0.25}>
              <button onClick={() => setLoginOpen(true)} className="h-11 w-full rounded-full px-8 text-sm font-bold text-white sm:w-auto" style={{ background: "var(--lavender)", boxShadow: "0 12px 28px -12px var(--lavender)" }}>
                {t("as.login")}
              </button>
            </Magnetic>
            <Link to="/app/asha/register" className="block">
              <button className="h-11 w-full rounded-full border-2 px-8 text-sm font-bold transition-colors hover:bg-lavender/10 sm:w-auto" style={{ borderColor: "var(--lavender)", color: "var(--lavender)" }}>
                {t("as.register")}
              </button>
            </Link>
          </motion.div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {error && <p className="text-sm font-semibold" style={{ color: "var(--emergency)" }}>{error}</p>}
          {!workers && !error && <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{t("tr.analyzing")}…</p>}
          {(workers ?? []).map((w, i) => (
            <TiltCard key={w.id} onClick={() => navigate("/app/asha/register")} className="group relative overflow-hidden rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <div className="relative">
                <div className="flex items-center gap-4">
                  <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING_SOFT, delay: i * 0.05 }} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold text-white" style={{ background: "linear-gradient(140deg, var(--lavender), color-mix(in oklab, var(--lavender) 60%, var(--bg-surface)))" }}>
                    {w.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </motion.div>
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-bold leading-tight">{w.full_name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
                      <MapPin size={11} /> {w.village_ward}, {w.district}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-2 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>
                  <div className="flex items-center gap-2"><Phone size={13} style={{ color: "var(--lavender)" }} /> {w.phone_masked}</div>
                  <div className="flex items-center gap-2"><Languages size={13} style={{ color: "var(--lavender)" }} /> {w.specialities.join(", ") || "—"}</div>
                </div>
              </div>
            </TiltCard>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={SPRING_SOFT} className="relative mt-12 overflow-hidden rounded-3xl p-8 sm:p-12" style={{ background: "linear-gradient(130deg, var(--lavender-soft) 0%, var(--bg-surface) 70%)", border: "1px solid var(--border)" }}>
          <motion.div animate={{ y: [0, -14, 0], rotate: [0, 4, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute end-10 top-8 hidden sm:block">
            <HeartHandshake size={90} strokeWidth={1} style={{ color: "var(--lavender)", opacity: 0.5 }} />
          </motion.div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{t("as.regTitle")}</h2>
          <p className="mt-2 max-w-lg text-[15px]" style={{ color: "var(--fg-muted)" }}>{t("as.regSub")}</p>
          <Link to="/app/asha/register"><motion.span whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.04 }} className="mt-7 inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold text-white" style={{ background: "var(--lavender)", boxShadow: "0 14px 34px -12px var(--lavender)" }}>{t("as.register")} →</motion.span></Link>
        </motion.div>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </LangFade>
  );
}

/* ═══════════════ REGISTRATION ═══════════════ */
export function AshaRegister() {
  const { t, lang } = useT();
  const [form, setForm] = useState({ username: "", password: "", full_name: "", date_of_birth: "1990-01-01", phone: "", aadhaar_last4: "", village_ward: "", district: "", state: "Rajasthan" });
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await registerAsha({ ...form, specialities: [], block_tehsil: "" });
      setDone(res.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const FIELDS: [keyof typeof form, string, string][] = [
    ["username", t("as.username"), "asha_worker"],
    ["password", t("as.password"), "••••••••"],
    ["full_name", t("as.name"), "Sunita Devi"],
    ["phone", t("as.phone"), "98765 43210"],
    ["aadhaar_last4", "Aadhaar (last 4)", "7890"],
    ["village_ward", t("as.village"), "Khoribari"],
    ["district", t("as.district"), "Jaipur"],
  ];

  return (
    <LangFade lang={lang}>
      <div className="wash-lavender -mx-4 min-h-dvh px-4 pt-10 sm:-mx-6 sm:px-6">
        <Link to="/app/asha" className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--fg-muted)" }}>
          <ArrowLeft size={15} /> {t("nav.asha")}
        </Link>

        {done ? (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={SPRING_SOFT} className="mx-auto mt-16 max-w-md rounded-3xl border p-10 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING_SOFT, delay: 0.2 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "var(--lavender-soft)" }}>
              <CheckCircle2 size={42} style={{ color: "var(--lavender)" }} />
            </motion.div>
            <h2 className="mt-6 font-display text-2xl font-bold">{t("as.success")}</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>{done}</p>
            <Link to="/app/asha" className="mt-8 inline-flex rounded-full px-7 py-3 text-sm font-bold text-white" style={{ background: "var(--lavender)" }}>
              {t("nav.asha")} →
            </Link>
          </motion.div>
        ) : (
          <div className="mx-auto max-w-lg">
            <StaggerWords text={t("as.regTitle")} className="font-display text-4xl font-bold tracking-tight sm:text-5xl" />
            <p className="mt-3 text-[15px]" style={{ color: "var(--fg-muted)" }}>{t("as.regSub")}</p>
            <motion.form onSubmit={submit} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.4 }} className="mt-10 space-y-6 rounded-3xl border p-8" style={{ borderColor: "var(--border)", background: "var(--bg-surface)", ["--accent" as any]: "var(--lavender)" }}>
              {FIELDS.map(([key, label, ph], i) => (
                <motion.div key={key} initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING_SOFT, delay: 0.5 + i * 0.08 }}>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{label}</label>
                  <input className="input-line" type={key === "password" ? "password" : "text"} placeholder={ph} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </motion.div>
              ))}
              <motion.div initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING_SOFT, delay: 0.82 }}>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("as.state")}</label>
                <select className="input-line" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                  {STATES.map((s) => (<option key={s} style={{ background: "var(--bg-elevated)" }}>{s}</option>))}
                </select>
              </motion.div>
              {err && <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--emergency)" }}><AlertCircle size={15} /> {err}</p>}
              <motion.button whileTap={{ scale: 0.96 }} type="submit" disabled={busy} className="w-full rounded-full py-4 text-sm font-bold text-white" style={{ background: "var(--lavender)", boxShadow: "0 14px 34px -12px var(--lavender)", opacity: busy ? 0.6 : 1 }}>
                {busy ? "…" : t("as.submit")}
              </motion.button>
            </motion.form>
          </div>
        )}
      </div>
    </LangFade>
  );
}

/* ═══════════════ PORTAL (auth required, 5 tabs) ═══════════════ */
type PortalTab = "worklist" | "patients" | "referrals" | "capture" | "capacity";
const TABS: [PortalTab, typeof Users, string][] = [
  ["worklist", ClipboardList, "Worklist"],
  ["patients", Users, "Patients"],
  ["referrals", RefreshCw, "Referrals"],
  ["capture", Camera, "Capture"],
  ["capacity", Activity, "Capacity"],
];

export function AshaPortal() {
  const { t, lang } = useT();
  const token = useStore((s) => s.token);
  const role = useStore((s) => s.role);
  const username = useStore((s) => s.username);
  const online = useStore((s) => s.online);
  const logout = useStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<PortalTab>("worklist");
  const [loginOpen, setLoginOpen] = useState(false);

  /* worklist */
  const [followups, setFollowups] = useState<FollowUpOut[] | null>(null);
  const [emergencies, setEmergencies] = useState<EmergencyCaseOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  /* offline sync (4D) */
  const [queue, setQueue] = useState<AshaRecordCreate[]>(() => readStorage("ss-sync-queue"));
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    const qTab = new URLSearchParams(location.search).get("tab") as PortalTab | null;
    if (qTab && ["worklist", "patients", "referrals", "capture", "capacity"].includes(qTab)) {
      setTab(qTab);
    } else if (!location.search) {
      setTab("worklist");
    }
  }, [location.search]);

  useEffect(() => {
    if (!token || role !== "ASHA") return;
    getFollowups(token).then(setFollowups).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getEmergencySync().then(setEmergencies).catch(() => setEmergencies([]));
  }, [token, role, tab, location.pathname, location.search]);

  /* 4D: when connectivity returns, flush the queued records exactly once. */
  useEffect(() => {
    if (!online || !token || queue.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await syncBatch(getWorkerIdFromToken(token), queue, [], token);
        if (cancelled) return;
        writeStorage("ss-sync-queue", []);
        setQueue([]);
        setSyncMsg(`Synced ${res.upserted_records} record(s), ${res.duplicates_ignored} duplicate(s) ignored`);
      } catch {
        /* keep the queue; the next online transition retries */
      }
    })();
    return () => { cancelled = true; };
  }, [online, token, queue]);

  const enqueue = (rec: AshaRecordCreate) => {
    const q = [...readStorage<AshaRecordCreate>("ss-sync-queue"), rec];
    writeStorage("ss-sync-queue", q);
    setQueue(q);
  };

  const markVisited = async (id: string) => {
    if (!token) return;
    try {
      await completeFollowup(id, token);
      setFollowups((fs) => (fs ?? []).map((f) => (f.id === id ? { ...f, resolved: true } : f)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!token || role !== "ASHA") {
    return (
      <LangFade lang={lang}>
        <div className="wash-lavender -mx-4 flex min-h-dvh flex-col items-center justify-center px-4 text-center sm:-mx-6">
          <h1 className="mt-7 font-display text-3xl font-bold">{t("po.title")}</h1>
          <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--fg-muted)" }}>{t("as.loginHint")}</p>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setLoginOpen(true)} className="mt-8 rounded-full px-8 py-3.5 text-sm font-bold text-white" style={{ background: "var(--lavender)", boxShadow: "0 14px 34px -12px var(--lavender)" }}>
            {t("c.login")} →
          </motion.button>
          <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        </div>
      </LangFade>
    );
  }

  const pending = (followups ?? []).filter((f) => !f.resolved).length;
  const syncPill = !online
    ? { label: "Offline mode", color: "var(--emergency)", soft: "color-mix(in oklab, var(--emergency) 12%, transparent)" }
    : queue.length > 0
      ? { label: `${queue.length} pending`, color: "var(--amber)", soft: "var(--amber-soft)" }
      : { label: "Synced", color: "var(--mint)", soft: "var(--mint-soft)" };

  return (
    <LangFade lang={lang}>
      <div className="wash-lavender -mx-4 min-h-dvh px-4 pt-10 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <StaggerWords text={`${t("as.welcome")} ${username ?? ""}`} className="font-display text-3xl font-bold tracking-tight sm:text-4xl" />
            <p className="mt-2 text-sm font-semibold" style={{ color: "var(--lavender)" }}>{t("po.title")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: "var(--border)", background: syncPill.soft, color: syncPill.color }}>
              <RefreshCw size={13} className={!online && queue.length > 0 ? "animate-spin" : ""} /> {syncPill.label}
            </span>
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => { logout(); navigate("/app/asha"); }} className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
              <LogOut size={14} /> {t("c.logout")}
            </motion.button>
          </div>
        </div>

        {syncMsg && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--mint)", background: "var(--mint-soft)" }}>{syncMsg}</p>}
        {error && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>{error}</p>}

        {/* tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key)} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95"
              style={{ borderColor: tab === key ? "var(--lavender)" : "var(--border)", background: tab === key ? "var(--lavender)" : "var(--bg-surface)", color: tab === key ? "#fff" : "var(--fg-muted)" }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── WORKLIST ── */}
        {tab === "worklist" && (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT} className="mt-6 space-y-6">
            {emergencies.length > 0 && (
              <div className="rounded-3xl border p-6" style={{ borderColor: "color-mix(in oklab, var(--emergency) 35%, var(--border))", background: "var(--bg-surface)" }}>
                <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Siren size={18} style={{ color: "var(--emergency)" }} /> Emergency board <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>(demo sync)</span></h2>
                <div className="mt-4 space-y-2.5">
                  {emergencies.map((em) => (
                    <div key={em.id} className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "color-mix(in oklab, var(--emergency) 6%, transparent)" }}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-bold text-white" style={{ background: "var(--emergency)" }}>{em.name.split(" ").map((n) => n[0]).slice(-2).join("")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{em.name} · {em.cityId}</div>
                        <div className="truncate text-xs" style={{ color: "var(--fg-muted)" }}>{em.symptoms}</div>
                      </div>
                      <span className="rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ background: em.status === "accepted" ? "var(--mint)" : "var(--emergency)" }}>{em.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">{t("po.taskTitle")}</h2>
                <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--amber)" }}><AlertCircle size={13} /> {pending} open</span>
              </div>
              <div className="mt-4 space-y-2.5">
                {(followups ?? []).length === 0 && <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No open follow-ups.</p>}
                {(followups ?? []).map((f) => (
                  <div key={f.id} data-testid="followup-row" className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "color-mix(in oklab, var(--fg) 4%, transparent)" }}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${f.resolved ? "" : "animate-pulse"}`} style={{ background: f.resolved ? "var(--mint)" : "var(--amber)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{f.reason}</div>
                      <div className="truncate text-xs" style={{ color: "var(--fg-muted)" }}>{t("po.task")}: {f.due_date}</div>
                    </div>
                    {!f.resolved && (
                      <button onClick={() => markVisited(f.id)} className="rounded-full px-3.5 py-1.5 text-[11px] font-bold text-white transition-transform hover:scale-105 active:scale-90" style={{ background: "var(--lavender)" }}>
                        {t("po.mark")}
                      </button>
                    )}
                    {f.resolved && <CheckCircle2 size={18} style={{ color: "var(--mint)" }} />}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── PATIENTS (4A) ── */}
        {tab === "patients" && <AshaPatients token={token} />}

        {/* ── REFERRALS (4B) ── */}
        {tab === "referrals" && <AshaReferrals token={token} />}

        {/* ── CAPTURE (4C) ── */}
        {tab === "capture" && <AshaCapture token={token} online={online} enqueue={enqueue} />}

        {/* ── CAPACITY (4E) ── */}
        {tab === "capacity" && <AshaCapacity token={token} />}
      </div>
    </LangFade>
  );
}

/* ── 4A: Patients ── */
function AshaPatients({ token }: { token: string }) {
  const { t } = useT();
  const [rows, setRows] = useState<PatientRow[]>(() => readStorage<PatientRow>("ss-patients"));
  const [openId, setOpenId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ patient: PatientOut; events: unknown[] } | null>(null);
  const [form, setForm] = useState({ display_name: "", age_band: "19-40", phone: "", dob: "" });
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null);

  useEffect(() => {
    const flushQueue = async () => {
      const q = readStorage<any>("ss-patients-queue");
      if (!q.length || !token) return;
      try {
        for (const p of q) {
          await createPatient(p, token);
        }
        writeStorage("ss-patients-queue", []);
        setOfflineMsg(null);
      } catch {
        // Retry next time
      }
    };
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, [token]);

  const create = async () => {
    if (!form.display_name.trim() || form.phone.replace(/\D/g, "").length < 10 || !form.dob) {
      setErr("Name, a 10-digit phone and a date of birth are required.");
      return;
    }
    setBusy(true); setErr(null); setOfflineMsg(null);
    const hash = await demographicHash(form.phone.trim(), form.dob);
    const payload = { demographic_hash: hash, display_name: form.display_name.trim(), age_band: form.age_band, risk_flags: {} };

    if (!navigator.onLine) {
      const offlineId = uuid();
      const offlineRow: PatientRow = { id: offlineId, display_name: payload.display_name, age_band: payload.age_band, created_at: new Date().toISOString() };
      const q = readStorage<any>("ss-patients-queue");
      writeStorage("ss-patients-queue", [...q, payload]);
      const next = [offlineRow, ...rows];
      writeStorage("ss-patients", next);
      setRows(next);
      setModal(false);
      setOfflineMsg("Saved offline — queued for sync when reconnected.");
      setForm({ display_name: "", age_band: "19-40", phone: "", dob: "" });
      setBusy(false);
      return;
    }

    try {
      const p = await createPatient(payload, token);
      const next = [{ id: String(p.id), display_name: p.display_name ?? null, age_band: p.age_band ?? null, created_at: p.created_at }, ...rows];
      writeStorage("ss-patients", next);
      setRows(next);
      setModal(false);
      setForm({ display_name: "", age_band: "19-40", phone: "", dob: "" });
    } catch (e) {
      const offlineId = uuid();
      const offlineRow: PatientRow = { id: offlineId, display_name: payload.display_name, age_band: payload.age_band, created_at: new Date().toISOString() };
      const q = readStorage<any>("ss-patients-queue");
      writeStorage("ss-patients-queue", [...q, payload]);
      const next = [offlineRow, ...rows];
      writeStorage("ss-patients", next);
      setRows(next);
      setModal(false);
      setOfflineMsg("Saved offline — queued for sync when reconnected.");
      setForm({ display_name: "", age_band: "19-40", phone: "", dob: "" });
    } finally { setBusy(false); }
  };

  const openTimeline = async (id: string) => {
    if (openId === id) { setOpenId(null); setTimeline(null); return; }
    setOpenId(id); setTimeline(null);
    try { setTimeline(await getPatientTimeline(id, token)); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT} className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Patients</h2>
        <button onClick={() => setModal(true)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: "var(--lavender)", boxShadow: "0 10px 24px -10px var(--lavender)" }}>
          <Plus size={14} /> New patient
        </button>
      </div>
      {err && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>{err}</p>}
      {offlineMsg && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "var(--lavender)", color: "var(--lavender)", background: "var(--lavender-soft)" }}>{offlineMsg}</p>}
      {rows.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed p-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
          No patients registered from this device yet. The backend has no patient-list endpoint (by privacy design) — patients created here are kept in this device's local registry.
        </p>
      )}
      <div className="mt-4 space-y-2.5">
        {rows.map((p) => (
          <div key={p.id} className="rounded-2xl border" style={{ borderColor: openId === p.id ? "var(--lavender)" : "var(--border)", background: "var(--bg-surface)" }}>
            <button onClick={() => openTimeline(p.id)} className="flex w-full items-center gap-3 px-4 py-3 text-start">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white" style={{ background: "var(--lavender)" }}>{(p.display_name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{p.display_name || "Unnamed"}</div>
                <div className="truncate text-xs" style={{ color: "var(--fg-muted)" }}>{p.age_band || "—"} · id {p.id.slice(0, 8)}…</div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: "var(--fg-subtle)" }}>{openId === p.id ? "Hide" : "Timeline"}</span>
            </button>
            {openId === p.id && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
                {!timeline && <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Loading…</p>}
                {timeline && timeline.events.length === 0 && <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No care events yet.</p>}
                {timeline && timeline.events.map((raw, i) => {
                  const e = raw as { event_type?: string; created_at?: string; payload?: Record<string, unknown> };
                  return (
                    <div key={i} className="flex items-start gap-2.5 py-1.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--lavender)" }} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{e.event_type || "event"}</div>
                        <div className="text-[11px]" style={{ color: "var(--fg-subtle)" }}>{e.created_at ? new Date(e.created_at).toLocaleString() : ""}</div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "oklch(0.1 0.01 60 / 0.55)", backdropFilter: "blur(20px)" }} onClick={() => setModal(false)}>
          <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} transition={SPRING_SOFT} className="w-full max-w-md rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">New patient</h3>
              <button onClick={() => setModal(false)} className="rounded-full p-1.5" aria-label={t("c.close")}><X size={18} /></button>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--fg-subtle)" }}>The phone + DOB are hashed (SHA-256) into a one-way demographic hash — never stored raw.</p>
            <div className="mt-5 space-y-4" style={{ ["--accent" as any]: "var(--lavender)" }}>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("as.name")}</label>
                <input className="input-line" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Patient name" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Age band</label>
                <select className="input-line" value={form.age_band} onChange={(e) => setForm({ ...form, age_band: e.target.value })}>
                  {["0-5", "6-12", "13-18", "19-40", "41-60", "60+"].map((b) => <option key={b} style={{ background: "var(--bg-elevated)" }}>{b}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("as.phone")}</label>
                  <input className="input-line" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98765 43210" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Date of birth</label>
                  <input type="date" className="input-line" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                </div>
              </div>
            </div>
            <button onClick={create} disabled={busy} className="mt-6 w-full rounded-full py-3.5 text-sm font-bold text-white" style={{ background: "var(--lavender)", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Saving…" : "Register patient"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── 4B: Referrals ── */
function AshaReferrals({ token }: { token: string }) {
  const [rows, setRows] = useState<ReferralRow[]>(() => readStorage<ReferralRow>("ss-referrals"));
  const [patients] = useState<PatientRow[]>(() => readStorage<PatientRow>("ss-patients"));
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ patient_id: "", from_facility_id: "", to_facility_id: "", urgency_tier: "L2" });

  const create = async () => {
    if (!form.patient_id || !form.from_facility_id || !form.to_facility_id) {
      setErr("Patient, and both facility IDs are required."); return;
    }
    setBusy(true); setErr(null);
    try {
      const r: ReferralOut = await createReferral({
        patient_id: form.patient_id,
        from_facility_id: Number(form.from_facility_id),
        to_facility_id: Number(form.to_facility_id),
        urgency_tier: form.urgency_tier as "L1" | "L2" | "L3" | "L4",
        client_created_at: new Date().toISOString(),
      }, token, uuid()); // Idempotency-Key: a network retry never duplicates
      const next = [{ id: String(r.id), patient_id: String(r.patient_id), from_facility_id: r.from_facility_id ?? 0, to_facility_id: r.to_facility_id ?? 0, urgency_tier: r.urgency_tier, status: r.status, created_at: r.created_at }, ...rows];
      writeStorage("ss-referrals", next);
      setRows(next);
      setModal(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const advance = async (id: string, next: string) => {
    try {
      const r = await updateReferral(id, next, token);
      setRows((rs) => rs.map((x) => (x.id === id ? { ...x, status: r.status } : x)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const tierColor = (tier: string) =>
    tier === "L4" ? "var(--emergency)" : tier === "L3" ? "var(--urgent)" : tier === "L2" ? "var(--caution)" : "var(--safe)";

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT} className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Referrals</h2>
        <button onClick={() => setModal(true)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: "var(--lavender)", boxShadow: "0 10px 24px -10px var(--lavender)" }}>
          <Plus size={14} /> Create referral
        </button>
      </div>
      {err && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>{err}</p>}
      {rows.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed p-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
          No referrals created from this device yet (the backend exposes create + status-update, no list endpoint — rows created here are kept locally).
        </p>
      )}
      <div className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: tierColor(r.urgency_tier) }}>{r.urgency_tier}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">Patient {String(r.patient_id).slice(0, 8)}… · facility {r.to_facility_id}</div>
                <div className="text-xs" style={{ color: "var(--fg-muted)" }}>{r.from_facility_id} → {r.to_facility_id}</div>
              </div>
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: r.status === "completed" ? "var(--mint-soft)" : r.status === "lost" ? "color-mix(in oklab, var(--emergency) 12%, transparent)" : "var(--amber-soft)", color: r.status === "completed" ? "var(--mint)" : r.status === "lost" ? "var(--emergency)" : "var(--amber)" }}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
            {(NEXT_STATUS[r.status] ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(NEXT_STATUS[r.status] ?? []).map((next) => (
                  <button key={next} onClick={() => advance(r.id, next)} className="rounded-full border px-3 py-1.5 text-[11px] font-bold transition-transform hover:scale-105 active:scale-95" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
                    → {STATUS_LABEL[next] ?? next}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "oklch(0.1 0.01 60 / 0.55)", backdropFilter: "blur(20px)" }} onClick={() => setModal(false)}>
          <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} transition={SPRING_SOFT} className="w-full max-w-md rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Create referral</h3>
              <button onClick={() => setModal(false)} className="rounded-full p-1.5" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="mt-5 space-y-4" style={{ ["--accent" as any]: "var(--lavender)" }}>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Patient</label>
                {patients.length > 0 ? (
                  <select className="input-line" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                    <option value="" style={{ background: "var(--bg-elevated)" }}>Select patient…</option>
                    <option value="11111111-1111-1111-1111-111111111111" style={{ background: "var(--bg-elevated)" }}>Patient 11111111 (Demo)</option>
                    {patients.map((p) => <option key={p.id} value={p.id} style={{ background: "var(--bg-elevated)" }}>{p.display_name || p.id.slice(0, 8)}</option>)}
                  </select>
                ) : (
                  <input className="input-line" value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} placeholder="Patient UUID" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>From facility ID</label>
                  <input type="number" className="input-line" value={form.from_facility_id} onChange={(e) => setForm({ ...form, from_facility_id: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>To facility ID</label>
                  <input type="number" className="input-line" value={form.to_facility_id} onChange={(e) => setForm({ ...form, to_facility_id: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Urgency tier</label>
                <select className="input-line" value={form.urgency_tier} onChange={(e) => setForm({ ...form, urgency_tier: e.target.value })}>
                  {["L1", "L2", "L3", "L4"].map((x) => <option key={x} style={{ background: "var(--bg-elevated)" }}>{x}</option>)}
                </select>
              </div>
            </div>
            <button onClick={create} disabled={busy} className="mt-6 w-full rounded-full py-3.5 text-sm font-bold text-white" style={{ background: "var(--lavender)", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Creating…" : "Create (idempotent)"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── 4C: OCR form capture ── */
function AshaCapture({ token, online, enqueue }: { token: string; online: boolean; enqueue: (rec: AshaRecordCreate) => void }) {
  const [extracted, setExtracted] = useState<{ record_type: string; fields: Record<string, unknown>; confidence: number } | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [records, setRecords] = useState<AshaRecordOut[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => listRecords(token).then(setRecords).catch(() => setRecords(null));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const ocr = await uploadForm(f, token);
      setExtracted({ record_type: ocr.record_type, fields: ocr.extracted_fields, confidence: ocr.confidence });
      const d: Record<string, string> = {};
      for (const [k, v] of Object.entries(ocr.extracted_fields)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") d[k] = String(v);
      }
      setDraft(d);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!extracted) return;
    const structured: Record<string, unknown> = { ...extracted.fields, ...draft };
    const rec: AshaRecordCreate = {
      record_type: extracted.record_type,
      structured_fields: structured,
      device_local_id: uuid(),
      created_at: new Date().toISOString(),
    };
    if (!online) {
      enqueue(rec);
      setMsg("Offline — queued for sync.");
      setExtracted(null);
      return;
    }
    setBusy(true);
    try {
      await saveRecord(rec, token);
      setMsg("Record saved.");
      setExtracted(null);
      await load();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT} className="mt-6 space-y-6">
      <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <h2 className="font-display text-xl font-bold">Capture a paper form</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--fg-muted)" }}>Photograph a household survey / health form — the OCR service extracts the fields for review before anything is saved.</p>
        <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-6 text-sm font-bold" style={{ borderColor: "var(--lavender)", color: "var(--lavender)", background: "var(--bg)" }}>
          <Camera size={18} /> {busy ? "Processing…" : "Choose / take a photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} disabled={busy} />
        </label>
        {err && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>{err}</p>}
        {msg && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--mint)", background: "var(--mint-soft)" }}>{msg}</p>}

        {extracted && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Review extraction</h3>
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "var(--lavender-soft)", color: "var(--lavender)" }}>{extracted.record_type} · {(extracted.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-3 space-y-2.5" style={{ ["--accent" as any]: "var(--lavender)" }}>
              {Object.entries(extracted.fields).map(([k, v]) => (
                <div key={k}>
                  <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-subtle)" }}>{k}</label>
                  {typeof v === "object" && v !== null ? (
                    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "color-mix(in oklab, var(--fg) 5%, transparent)", color: "var(--fg-muted)" }}>{JSON.stringify(v)}</div>
                  ) : (
                    <input className="input-line" value={draft[k] ?? String(v ?? "")} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <button onClick={save} disabled={busy} className="mt-5 w-full rounded-full py-3 text-sm font-bold text-white" style={{ background: "var(--lavender)", opacity: busy ? 0.6 : 1 }}>
              Save record {online ? "" : "(queues offline)"}
            </button>
          </motion.div>
        )}
      </div>

      <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <h2 className="font-display text-xl font-bold">Digitized records</h2>
        <div className="mt-4 space-y-2.5">
          {records === null && <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Loading…</p>}
          {records !== null && records.length === 0 && <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No records yet.</p>}
          {(records ?? []).slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "color-mix(in oklab, var(--fg) 4%, transparent)" }}>
              <ClipboardList size={15} style={{ color: "var(--lavender)" }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{r.record_type}</div>
                <div className="truncate text-xs" style={{ color: "var(--fg-muted)" }}>{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <CheckCircle2 size={15} style={{ color: "var(--mint)" }} />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── 4E: Facility capacity ── */
function AshaCapacity({ token }: { token: string }) {
  const [snaps, setSnaps] = useState<CapacityOut[] | null>(null);
  const [facilityId, setFacilityId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => getCapacity(undefined, token).then(setSnaps).catch(() => setSnaps(null));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  const report = async (level: "adequate" | "critical") => {
    if (!facilityId || Number.isNaN(Number(facilityId))) {
      setErr("A numeric facility ID is required."); return;
    }
    setBusy(true); setErr(null); setMsg(null);
    try {
      const snap = await reportCapacity({
        facility_id: Number(facilityId),
        diagnostic_capacity: level === "adequate" ? { xray: "operational", oxygen: "available" } : { xray: "operational", oxygen: "critical" },
        medicine_stock: level === "adequate" ? { essential_drugs: "adequate", iv_fluids: "adequate" } : { essential_drugs: "critical", iv_fluids: "low" },
        source: "asha_portal",
      }, token);
      setMsg(`Snapshot recorded (as of ${new Date(snap.snapshot_taken_at).toLocaleString()}).`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT} className="mt-6 space-y-6">
      <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <h2 className="font-display text-xl font-bold">Report capacity</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--fg-muted)" }}>Snapshots are timestamped server-side and always shown "as of" — never as live data (doc 02 FR-12).</p>
        <div className="mt-4 max-w-xs" style={{ ["--accent" as any]: "var(--lavender)" }}>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Facility ID</label>
          <input type="number" className="input-line" value={facilityId} onChange={(e) => setFacilityId(e.target.value)} placeholder="e.g. 3" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button onClick={() => report("adequate")} disabled={busy} className="rounded-full px-5 py-2.5 text-xs font-bold text-white" style={{ background: "var(--mint)", opacity: busy ? 0.6 : 1 }}>Report: stock adequate</button>
          <button onClick={() => report("critical")} disabled={busy} className="rounded-full px-5 py-2.5 text-xs font-bold text-white" style={{ background: "var(--emergency)", opacity: busy ? 0.6 : 1 }}>Report: stock critical</button>
        </div>
        {err && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "color-mix(in oklab, var(--emergency) 40%, var(--border))", color: "var(--emergency)" }}>{err}</p>}
        {msg && <p className="mt-3 rounded-2xl border p-3 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--mint)", background: "var(--mint-soft)" }}>{msg}</p>}
      </div>

      <div className="rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
        <h2 className="font-display text-xl font-bold">Latest snapshots</h2>
        <div className="mt-4 space-y-2.5">
          {snaps === null && <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Loading…</p>}
          {snaps !== null && snaps.length === 0 && <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No snapshots recorded yet.</p>}
          {(snaps ?? []).map((s) => (
            <div key={String(s.id)} className="rounded-2xl px-4 py-3" style={{ background: "color-mix(in oklab, var(--fg) 4%, transparent)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold">Facility #{s.facility_id}</div>
                <div className="text-[11px] font-semibold" style={{ color: "var(--fg-subtle)" }}>as of {new Date(s.snapshot_taken_at).toLocaleString()}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries({ ...(s.diagnostic_capacity || {}), ...(s.medicine_stock || {}) }).slice(0, 6).map(([k, v]) => (
                  <span key={k} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: String(v).match(/critical|low/i) ? "color-mix(in oklab, var(--emergency) 12%, transparent)" : "color-mix(in oklab, var(--fg) 5%, transparent)", color: String(v).match(/critical|low/i) ? "var(--emergency)" : "var(--fg-muted)" }}>
                    {k}: {String(v)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}