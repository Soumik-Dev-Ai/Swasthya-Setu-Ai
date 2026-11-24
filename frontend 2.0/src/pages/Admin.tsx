import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Users, HeartHandshake, Check, LogOut, Wifi, Activity, MapPin, CalendarClock } from "lucide-react";
import { StaggerWords, SPRING_SOFT, LangFade } from "../lib/motion";
import { useT } from "../i18n";
import { useStore } from "../store";
import { LoginModal } from "../components/LoginModal";
import {
  getAdminAnalytics, getPendingAshaUsers, activateAshaUser, getDistrictDashboard,
  runFollowupScheduler, getCities,
  type AdminAnalytics, type UserPublic, type DistrictDashboard, type CityRef,
} from "../lib/api";

type AdminTab = "overview" | "district";

export default function Admin() {
  const { t, lang } = useT();
  const token = useStore((s) => s.token);
  const role = useStore((s) => s.role);
  const username = useStore((s) => s.username);
  const logout = useStore((s) => s.logout);
  const online = useStore((s) => s.online);
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [pending, setPending] = useState<UserPublic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [schedulerMsg, setSchedulerMsg] = useState<string | null>(null);

  /* district view state (4F) */
  const [cities, setCities] = useState<CityRef[]>([]);
  const [districtId, setDistrictId] = useState<string>("");
  const [dashboard, setDashboard] = useState<DistrictDashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    if (!token || role !== "ADMIN") return;
    getAdminAnalytics(token).then(setAnalytics).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    loadPending();
    getCities().then(setCities).catch(() => setCities([]));
  }, [token, role]);

  useEffect(() => {
    if (!token || role !== "ADMIN" || tab !== "district") return;
    let cancelled = false;
    setDashLoading(true);
    getDistrictDashboard(token, districtId || undefined)
      .then((d) => { if (!cancelled) setDashboard(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setDashLoading(false); });
    return () => { cancelled = true; };
  }, [token, role, tab, districtId]);

  const loadPending = async () => {
    if (!token) return;
    try { setPending(await getPendingAshaUsers(token)); } catch { /* non-fatal */ }
  };

  const approve = async (id: number) => {
    if (!token) return;
    try {
      await activateAshaUser(id, token);
      setPending((p) => p.filter((u) => u.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runScheduler = async () => {
    if (!token) return;
    setSchedulerMsg(null);
    try {
      const res = await runFollowupScheduler(token);
      setSchedulerMsg(`Follow-up scheduler ran — ${res.created} new worklist row(s) created.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!token || role !== "ADMIN") {
    return (
      <LangFade lang={lang}>
        <div className="flex min-h-dvh -mx-4 flex-col items-center justify-center px-4 text-center sm:-mx-6">
          <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 5, repeat: Infinity }} className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: "var(--coral-soft)" }}>
            <ShieldCheck size={44} style={{ color: "var(--coral)" }} />
          </motion.div>
          <h1 className="mt-7 font-display text-3xl font-bold">{t("ad.title")}</h1>
          <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--fg-muted)" }}>
            {role && role !== "ADMIN" ? t("m.authGate") : t("as.loginHint")}
          </p>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setLoginOpen(true)} className="mt-8 rounded-full px-8 py-3.5 text-sm font-bold text-white" style={{ background: "var(--coral)", boxShadow: "0 14px 34px -12px var(--coral)" }}>
            {t("c.login")} →
          </motion.button>
          <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        </div>
      </LangFade>
    );
  }

  const triageTotal = analytics?.triage_total ?? 0;
  const tierBreakdown = analytics ? Object.entries(analytics.triage_by_tier).map(([k, v]) => `${k}: ${v}`).join(" · ") : "";
  const ashaRecords = analytics?.asha_records_total ?? 0;

  const stats = [
    { n: String(triageTotal), l: t("ad.users"), icon: Users, c: "var(--sky)" },
    { n: String(pending.length), l: t("ad.approvals"), icon: HeartHandshake, c: "var(--lavender)" },
    { n: String(ashaRecords), l: t("ad.ashas"), icon: ShieldCheck, c: "var(--mint)" },
  ];

  return (
    <LangFade lang={lang}>
      <div className="pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <StaggerWords text={t("ad.title")} className="font-display text-4xl font-bold tracking-tight sm:text-5xl" />
            <p className="mt-3 text-[15px]" style={{ color: "var(--fg-muted)" }}>{t("ad.sub")} · {username}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: "var(--border)", color: online ? "var(--mint)" : "var(--emergency)" }}>
              <Wifi size={13} /> {t(online ? "c.online" : "c.offline")}
            </span>
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => { logout(); navigate("/app/home"); }} className="flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}>
              <LogOut size={14} /> {t("c.logout")}
            </motion.button>
          </div>
        </div>

        {/* tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {([["overview", Activity, "Overview"], ["district", MapPin, "District View"]] as const).map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key)} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95"
              style={{ borderColor: tab === key ? "var(--coral)" : "var(--border)", background: tab === key ? "var(--coral)" : "var(--bg-surface)", color: tab === key ? "#fff" : "var(--fg-muted)" }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--emergency)" }}>{error}</p>}

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {stats.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: i * 0.08 }} className="relative overflow-hidden rounded-3xl border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                  <div className="absolute -end-8 -top-8 h-28 w-28 rounded-full opacity-25 blur-2xl" style={{ background: s.c }} />
                  <s.icon size={20} style={{ color: s.c }} />
                  <div className="mt-3 font-display text-3xl font-bold">{s.n}</div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>{s.l}</div>
                </motion.div>
              ))}
            </div>

            {tierBreakdown && (
              <p className="mt-4 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}><Activity size={12} className="me-1 inline" /> {tierBreakdown}</p>
            )}

            {/* 4H: run the follow-up scheduler (admin-only, idempotent) */}
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <CalendarClock size={18} style={{ color: "var(--coral)" }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">Follow-up scheduler</div>
                <div className="text-xs" style={{ color: "var(--fg-muted)" }}>{schedulerMsg ?? "Flag overdue high-risk patients into the ASHA worklist (idempotent)."}</div>
              </div>
              <motion.button whileTap={{ scale: 0.94 }} onClick={runScheduler} className="rounded-full px-5 py-2.5 text-xs font-bold text-white" style={{ background: "var(--coral)" }}>
                Run scheduler
              </motion.button>
            </div>

            <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 rounded-3xl border p-6 sm:p-8" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">{t("ad.approvals")}</h2>
                <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--coral)" }}><Activity size={13} /> {pending.length}</span>
              </div>
              <div className="mt-5 space-y-3">
                <AnimatePresence initial={false}>
                  {pending.map((u) => (
                    <motion.div key={u.id} layout exit={{ opacity: 0, x: 80, height: 0, marginTop: 0 }} transition={SPRING_SOFT} className="flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4" style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--fg) 3%, var(--bg-surface))" }}>
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--lavender-soft)" }}>
                        <Users size={19} style={{ color: "var(--lavender)" }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-base font-bold">{u.username}</div>
                        <div className="text-xs" style={{ color: "var(--fg-muted)" }}>{u.role}</div>
                      </div>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => approve(u.id)} className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: "var(--mint)" }}>
                        <Check size={13} /> {t("ad.approve")}
                      </motion.button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {pending.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: "var(--border)" }}>
                    <Check size={28} className="mx-auto" style={{ color: "var(--mint)" }} />
                    <p className="mt-2 text-sm font-semibold" style={{ color: "var(--fg-muted)" }}>No pending ASHA registrations</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ── DISTRICT VIEW (4F) ── */}
        {tab === "district" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SOFT}>
            <div className="mt-6 max-w-sm" style={{ ["--accent" as any]: "var(--coral)" }}>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>District / city</label>
              <select className="input-line" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
                <option value="" style={{ background: "var(--bg-elevated)" }}>All districts</option>
                {cities.map((c) => <option key={c.id} value={c.id} style={{ background: "var(--bg-elevated)" }}>{c.name}</option>)}
              </select>
            </div>

            {dashLoading && <p className="mt-6 text-sm" style={{ color: "var(--fg-muted)" }}>Loading district aggregates…</p>}

            {dashboard && !dashLoading && (
              <>
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.05 }} className="rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                    <Activity size={16} style={{ color: "var(--coral)" }} />
                    <div className="mt-3 font-display text-2xl font-bold">{Object.values(dashboard.triage_volume_by_tier).reduce((a, b) => a + b, 0)}</div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Triage volume</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(dashboard.triage_volume_by_tier).map(([k, v]) => (
                        <span key={k} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: k === "L4" ? "color-mix(in oklab, var(--emergency) 12%, transparent)" : "color-mix(in oklab, var(--fg) 5%, transparent)", color: k === "L4" ? "var(--emergency)" : "var(--fg-muted)" }}>{k}: {v}</span>
                      ))}
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.12 }} className="rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                    <Check size={16} style={{ color: "var(--mint)" }} />
                    <div className="mt-3 font-display text-2xl font-bold">{Math.round((dashboard.referral_completion_rate || 0) * 100)}%</div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Referral completion rate</div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.19 }} className="rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                    <CalendarClock size={16} style={{ color: "var(--amber)" }} />
                    <div className="mt-3 font-display text-2xl font-bold">{dashboard.follow_up_backlog}</div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Follow-up backlog</div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SOFT, delay: 0.26 }} className="rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                    <MapPin size={16} style={{ color: "var(--sky)" }} />
                    <div className="mt-3 font-display text-2xl font-bold">{Object.keys(dashboard.facility_load).length}</div>
                    <div className="mt-1 text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>Facilities reporting</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(dashboard.facility_load).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "color-mix(in oklab, var(--fg) 5%, transparent)", color: "var(--fg-muted)" }}>{k}: {v}</span>
                      ))}
                    </div>
                  </motion.div>
                </div>
                <p className="mt-4 text-xs font-semibold" style={{ color: "var(--fg-subtle)" }}>Generated {new Date(dashboard.generated_at).toLocaleString()}{dashboard.district_id ? ` · ${dashboard.district_id}` : ""} · cache-served (15 min)</p>
              </>
            )}
          </motion.div>
        )}
      </div>
    </LangFade>
  );
}