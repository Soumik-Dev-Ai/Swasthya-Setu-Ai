import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Modal } from "../components/Modal";
import {
  Bar,
  Btn,
  Chip,
  Field,
  Glass,
  IconAlert,
  IconCheck,
  IconChevron,
  ErrorToast,
  IconPeople,
  IconPhone,
  IconPulse,
  IconUser,
  SectionTitle,
} from "../components/ui";
import { ASHA_WORKERS, CONDITION_NAMES, HOSPITALS, cityById, haversine, project, type AshaWorker } from "../lib/data";
import { etaMinutes, LEVEL_NAMES, syncEmergencyCases } from "../lib/engine";
import { NATIVE_INPUT_FONT } from "../lib/i18n";
import { useStore, useT } from "../lib/store";

function MiniRoute({ fromCityId, toHospitalId }: { fromCityId: string; toHospitalId: string }) {
  const city = cityById(fromCityId);
  const hosp = HOSPITALS.find((h) => h.id === toHospitalId) ?? HOSPITALS.find((h) => h.cityId === fromCityId && h.er24)!;
  const a = project(city.lat, city.lon, 300, 150);
  const b = project(hosp.lat, hosp.lon, 300, 150);
  const km = haversine(city.lat, city.lon, hosp.lat, hosp.lon);
  return (
    <div className="relative">
      <svg viewBox="0 0 300 150" className="block w-full">
        <defs>
          <filter id={"miniGlow" + toHospitalId} x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="300" height="150" fill="rgba(255,255,255,0.015)" />
        {[0, 1, 2].map((i) => (
          <g key={i} stroke="rgba(255,255,255,0.04)">
            <line x1={i * 100} y1={0} x2={i * 100} y2={150} />
            <line x1={0} y1={i * 50} x2={300} y2={i * 50} />
          </g>
        ))}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ff4d5e" strokeWidth="2" strokeDasharray="8 7" className="dash-flow" filter={"url(#miniGlow" + toHospitalId + ")"} />
        <circle cx={a.x} cy={a.y} r="6" fill="#0a121e" stroke="#4ee6f0" strokeWidth="2" />
        <rect x={b.x - 5} y={b.y - 5} width="10" height="10" transform={`rotate(45 ${b.x} ${b.y})`} fill="#ff4d5e" className="emergency-pulse" />
      </svg>
      <div className="absolute right-2 top-2 flex items-center gap-1.5 text-[10px] font-semibold text-danger">
        <IconPulse size={11} />
        {km} km · ETA {etaMinutes(km, fromCityId)} min
      </div>
    </div>
  );
}

/* ---------------- public directory ---------------- */

function PublicState() {
  const t = useT();
  const { lang, setAshaUser } = useStore();
  const [loginOpen, setLoginOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [requested, setRequested] = useState<string | null>(null);
  const [loginId, setLoginId] = useState("");
  const [loginArea, setLoginArea] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [regName, setRegName] = useState("");
  const [regArea, setRegArea] = useState("");
  const [regVillage, setRegVillage] = useState("");
  const font = { fontFamily: NATIVE_INPUT_FONT[lang] };

  const signIn = () => {
    if (!loginId.trim() || !loginPin.trim()) return;
    setAshaUser({ id: loginId.trim(), name: "ASHA " + loginId.trim(), area: loginArea.trim() || loginId.trim() });
    setLoginOpen(false);
  };

  const register = () => {
    if (!regName.trim()) return;
    setAshaUser({ id: "ASHA-" + regName.slice(0, 4).toUpperCase() + Math.floor(Math.random() * 900 + 100), name: regName.trim(), area: regArea.trim() || regVillage.trim() });
    setRegOpen(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[17px] font-semibold text-frost">{t("asha.public.title")}</h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-mist">{t("asha.public.desc")}</p>
        </div>
        <div className="flex gap-2.5">
          <Btn variant="ghost" onClick={() => setLoginOpen(true)}>{t("asha.login")}</Btn>
          <Btn variant="cyan" onClick={() => setRegOpen(true)}>{t("asha.register")}</Btn>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ASHA_WORKERS.map((w: AshaWorker, i: number) => (
          <motion.div
            key={w.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.45 }}
          >
            <Glass className="flex h-full flex-col rounded-[6px] p-5 transition-colors duration-300 hover:bg-white/[0.05]">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-mint/30 bg-mint/[0.08] font-display text-[15px] font-bold text-mint">
                    {w.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a121e] bg-mint shadow-[0_0_8px_rgba(52,245,177,0.8)]" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-frost">{w.name}</div>
                  <div className="text-[11px] text-mist/70">{w.village} · {w.district}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Chip tone="cyan">{w.years} {t("asha.exp")}</Chip>
                <Chip>{t("asha.lang")}: {w.languages.join(", ")}</Chip>
              </div>
              <div className="mt-4 flex-1" />
              <AnimatePresence mode="wait">
                {requested === w.id ? (
                  <motion.p
                    key="sent"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 rounded-[4px] border border-mint/30 bg-mint/[0.06] px-3 py-2.5 text-[11.5px] font-medium text-mint"
                  >
                    <IconCheck size={12} />
                    {t("asha.request.sent", { name: w.name })}
                  </motion.p>
                ) : (
                  <Btn key="req" variant="ghost" onClick={() => setRequested(w.id)} className="w-full text-[12px]">
                    <span className="flex items-center justify-center gap-2">
                      <IconPhone size={13} />
                      {t("asha.request")}
                    </span>
                  </Btn>
                )}
              </AnimatePresence>
            </Glass>
          </motion.div>
        ))}
      </div>

      {/* login modal */}
      <Modal open={loginOpen} onClose={() => setLoginOpen(false)} title={t("asha.login")} sub={t("asha.sub")}>
        <div className="space-y-4">
          <Field label={t("asha.id")}>
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="ASHA-1042" className="field" style={font} />
          </Field>
          <Field label={t("asha.area")}>
            <input value={loginArea} onChange={(e) => setLoginArea(e.target.value)} placeholder="Rampur Village" className="field" style={font} />
          </Field>
          <Field label={t("asha.pin")}>
            <input type="password" value={loginPin} onChange={(e) => setLoginPin(e.target.value)} placeholder="••••" className="field" style={font} />
          </Field>
          <Btn onClick={signIn} className="w-full">{t("asha.signin")}</Btn>
        </div>
      </Modal>

      {/* register modal */}
      <Modal open={regOpen} onClose={() => setRegOpen(false)} title={t("asha.reg.title")} sub={t("asha.sub")}>
        <div className="space-y-4">
          <Field label={t("asha.reg.name")}>
            <input value={regName} onChange={(e) => setRegName(e.target.value)} className="field" style={font} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("asha.area")}>
              <input value={regArea} onChange={(e) => setRegArea(e.target.value)} className="field" style={font} />
            </Field>
            <Field label={t("asha.patient.village")}>
              <input value={regVillage} onChange={(e) => setRegVillage(e.target.value)} className="field" style={font} />
            </Field>
          </div>
          <Btn onClick={register} className="w-full">{t("asha.reg.submit")}</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- logged-in control room ---------------- */

function ControlRoom() {
  const t = useT();
  const { lang, ashaUser, setAshaUser, patients, addPatient, criticalCases, setCaseStatus, hydrateCriticalCases } = useStore();
  const font = { fontFamily: NATIVE_INPUT_FONT[lang] };

  const [pName, setPName] = useState("");
  const [pAge, setPAge] = useState("");
  const [pVillage, setPVillage] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [registered, setRegistered] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  // Hydrate the emergency board with recently triaged level-4 cases from the
  // backend (opportunistic sync for the ASHA control room).
  useEffect(() => {
    const controller = new AbortController();
    setSyncing(true);
    setSyncError("");
    (async () => {
      try {
        const cases = await syncEmergencyCases(controller.signal);
        if (!controller.signal.aborted && cases.length) hydrateCriticalCases(cases);
      } catch (cause) {
        if (!controller.signal.aborted) {
          console.error("ASHA emergency sync failed", cause);
          setSyncError("Emergency sync is unavailable. Showing the last saved local board.");
        }
      } finally {
        if (!controller.signal.aborted) setSyncing(false);
      }
    })();
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const registerPatient = () => {
    if (!pName.trim() || !pAge.trim()) return;
    addPatient({ name: pName.trim(), age: pAge.trim(), village: pVillage.trim(), phone: pPhone.trim(), notes: pNotes.trim() });
    setPName("");
    setPAge("");
    setPVillage("");
    setPPhone("");
    setPNotes("");
    setRegistered(true);
    window.setTimeout(() => setRegistered(false), 2500);
  };

  const followUps = patients.length > 0 ? Math.min(3, patients.filter((p) => /bp|साँस|শ্বাস|fever|बुखार|জ্বর/i.test(p.notes)).length || 1) : 0;
  const pending = criticalCases.filter((c) => c.status === "pending").length;

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-cyanx/40 bg-cyanx/[0.08] text-cyanx">
            <IconUser size={20} />
          </div>
          <div>
            <h2 className="font-display text-[17px] font-semibold text-frost">{ashaUser?.name}</h2>
            <p className="text-[11.5px] text-mist">{ashaUser?.id} · {ashaUser?.area}</p>
          </div>
        </div>
        <Btn variant="ghost" onClick={() => setAshaUser(null)} className="text-[12px]">
          {t("asha.signout")}
        </Btn>
      </div>

      {syncing && <p className="mt-4 text-[11px] text-cyanx" role="status" aria-live="polite">Syncing emergency board…</p>}
      {syncError && <ErrorToast message={syncError} critical={true} onRetry={() => { /* re-sync */ }} onDismiss={() => setSyncError("")} />}

      {/* stats */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { v: patients.length, l: t("asha.stat.patients"), tone: "text-frost" },
          { v: pending, l: t("asha.stat.critical"), tone: "text-danger text-glow-red" },
          { v: followUps, l: t("asha.stat.follow"), tone: "text-cyanx" },
        ].map((s, i) => (
          <Glass key={i} className="rounded-[6px] px-4 py-4 text-center">
            <div className={`font-display text-[26px] font-bold ${s.tone}`}>{s.v}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-mist/70">{s.l}</div>
          </Glass>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* register patient */}
        <Glass className="rounded-[6px] p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-cyanx">
            <IconPeople size={13} />
            {t("asha.patient.title")}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("asha.patient.name")}>
              <input value={pName} onChange={(e) => setPName(e.target.value)} className="field" style={font} />
            </Field>
            <Field label={t("asha.patient.age")}>
              <input inputMode="numeric" value={pAge} onChange={(e) => setPAge(e.target.value.replace(/[^0-9]/g, ""))} className="field" style={font} />
            </Field>
            <Field label={t("asha.patient.village")}>
              <input value={pVillage} onChange={(e) => setPVillage(e.target.value)} className="field" style={font} />
            </Field>
            <Field label={t("asha.patient.phone")}>
              <input inputMode="tel" value={pPhone} onChange={(e) => setPPhone(e.target.value)} className="field" style={font} />
            </Field>
          </div>
          <Field label={t("asha.patient.notes")} className="mt-3">
            <textarea value={pNotes} onChange={(e) => setPNotes(e.target.value)} placeholder={t("asha.patient.notes.ph")} rows={3} className="field resize-none" style={font} />
          </Field>
          <div className="mt-3 flex items-center gap-3">
            <Btn onClick={registerPatient} className="text-[12px]">{t("asha.patient.cta")}</Btn>
            <AnimatePresence>
              {registered && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[11.5px] text-mint"
                >
                  {t("asha.patient.registered")}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* history */}
          <div className="mt-6 border-t border-white/[0.06] pt-4">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-mist/70">
              {t("asha.history")} · {patients.length}
            </div>
            <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
              {patients.length === 0 ? (
                <p className="text-[12px] text-mist/60">{t("asha.history.empty")}</p>
              ) : (
                patients.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-[4px] border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                    <div className="min-w-0">
                      <span className="text-[12.5px] font-medium text-frost">{p.name}</span>
                      <span className="ml-2 text-[11px] text-mist/60">{p.age}y · {p.village || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.notes && <span className="max-w-[160px] truncate text-[10.5px] text-mist/60">{p.notes}</span>}
                      <span className="text-[10px] text-mist/50">
                        {new Date(p.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Glass>

        {/* emergency action board */}
        <Glass className="relative overflow-hidden rounded-[6px] p-5 md:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px]">
            <motion.div
              className="h-full w-full bg-danger/70"
              animate={{ opacity: [0.3, 1, 0.3], boxShadow: ["0 0 8px rgba(255,77,94,0.4)", "0 0 26px rgba(255,77,94,0.8)", "0 0 8px rgba(255,77,94,0.4)"] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-danger">
              <IconAlert size={13} className="emergency-pulse" />
              {t("asha.board")}
            </div>
            <Chip tone="red" glow>
              <span className="h-1.5 w-1.5 rounded-full bg-danger emergency-pulse" />
              {t("asha.board.live")}
            </Chip>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-mist/70">{t("asha.board.sub")}</p>

          <div className="mt-4 space-y-2.5">
            {criticalCases.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <IconPulse size={22} className="text-mist/40" />
                <p className="text-[12.5px] text-mist/60">{t("asha.board.empty")}</p>
              </div>
            ) : (
              criticalCases.map((c, i) => {
                const isOpen = expanded === c.id;
                const hosp = HOSPITALS.find((h) => h.cityId === c.cityId && h.er24)!;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`rounded-[5px] border transition-colors duration-200 ${
                      c.status === "accepted" ? "border-cyanx/40 bg-cyanx/[0.04]" : "border-danger/35 bg-danger/[0.05]"
                    }`}
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-display text-[11px] font-bold ${
                          c.status === "accepted" ? "border-cyanx/50 text-cyanx" : "border-danger/50 text-danger"
                        }`}>
                          L{c.level}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-frost">
                            {c.name} · {c.age}y {c.sex}
                            <span className="text-[10.5px] font-normal text-mist/60">{cityById(c.cityId).nameKey}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-mist/70">{c.symptoms}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {c.status === "accepted" ? (
                          <Chip tone="cyan">{t("asha.enroute")}</Chip>
                        ) : (
                          <Chip tone="red" glow>{t("asha.critical")}</Chip>
                        )}
                        <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
                          <IconChevron size={14} className="text-mist/50" />
                        </motion.span>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-white/[0.06] px-4 py-3.5">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-mist/70">
                                  {t("triage.possible")}
                                </div>
                                <div className="space-y-1.5">
                                  {c.conditions.length ? (
                                    c.conditions.map((cid) => (
                                      <div key={cid} className="flex items-center justify-between rounded-[3px] border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
                                        <span className="text-[11.5px] text-frost">{CONDITION_NAMES[cid]?.[lang as "en" | "hi" | "bn"] ?? CONDITION_NAMES[cid]?.en ?? cid}</span>
                                        <span className="text-[10px] uppercase text-danger">{LEVEL_NAMES[c.level]}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[11.5px] text-mist/60">—</p>
                                  )}
                                </div>
                                <div className="mt-3">
                                  <div className="mb-1 flex justify-between text-[10.5px]">
                                    <span className="text-mist">{t("triage.conf")}</span>
                                    <span className="text-danger">98%</span>
                                  </div>
                                  <Bar value={98} tone="red" height={4} />
                                </div>
                              </div>
                              <div>
                                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-mist/70">
                                  {t("asha.mini.map")}
                                </div>
                                <MiniRoute fromCityId={c.cityId} toHospitalId={hosp.id} />
                                <div className="mt-1.5 text-[11px] text-mist/70">{hosp.name}</div>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="text-[10px] text-mist/50">
                                {t("common.today")} · {new Date(c.assessedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {c.status === "pending" ? (
                                <Btn variant="danger" className="text-[11.5px] py-2" onClick={() => setCaseStatus(c.id, "accepted")}>
                                  {t("asha.accept")}
                                </Btn>
                              ) : (
                                <Chip tone="cyan">{t("asha.enroute")} · {t("asha.eta", { n: 18 })}</Chip>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })
            )}
          </div>
        </Glass>
      </div>
    </div>
  );
}

export function Asha() {
  const t = useT();
  const { ashaUser } = useStore();
  return (
    <div>
      <SectionTitle kicker="Community · First mile" title={t("asha.title")} sub={t("asha.sub")} />
      <div className="mt-6">
        {ashaUser ? <ControlRoom /> : <PublicState />}
      </div>
    </div>
  );
}
