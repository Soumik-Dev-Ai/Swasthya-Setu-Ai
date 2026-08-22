import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Bar,
  Chip,
  Glass,
  IconArrow,
  IconCross,
  IconGauge,
  IconMap,
  IconPeople,
  IconPulse,
  IconShield,
  IconWallet,
} from "../components/ui";
import { providerById } from "../lib/data";
import { computeFinances } from "../lib/engine";
import { useStore, useT } from "../lib/store";

const cardMotion = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

function EntryCard({
  to,
  icon,
  title,
  desc,
  meta,
  span,
  delay = 0,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  meta: React.ReactNode;
  span: string;
  delay?: number;
}) {
  return (
    <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay }} className={span}>
      <Link to={to} className="group block h-full">
        <Glass className="relative flex h-full flex-col overflow-hidden rounded-[6px] p-6 transition-all duration-300 hover:-translate-y-2 hover:bg-white/[0.07] hover:border-mint/40 hover:shadow-[0_16px_40px_rgba(52,245,177,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)]">
          <span className="pointer-events-none absolute right-4 top-4 h-1.5 w-1.5 rounded-full bg-mint/40 transition-all duration-300 group-hover:bg-mint group-hover:shadow-[0_0_12px_rgba(52,245,177,0.9)]" />
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-white/[0.08] bg-white/[0.03] text-cyanx transition-colors duration-300 group-hover:text-mint">
              {icon}
            </div>
            <IconArrow size={16} className="text-mist/40 transition-all duration-300 group-hover:translate-x-1 group-hover:text-mint" />
          </div>
          <h3 className="mt-5 font-display text-[18px] font-semibold tracking-tight text-frost">{title}</h3>
          <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-mist">{desc}</p>
          <div className="mt-5 flex flex-wrap items-center gap-1.5">{meta}</div>
        </Glass>
      </Link>
    </motion.div>
  );
}

export function Home() {
  const t = useT();
  const { insurance, financials, lastTriage, savedSchemes, ashaUser } = useStore();

  const stats = financials ? computeFinances(financials) : null;
  const provider = insurance ? providerById(insurance.providerId) : null;

  return (
    <div>
      {/* greeting */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-frost md:text-[30px]">
            {t("home.greeting")}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-mist">{t("home.sub")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="mint">Complete Regional Multilingual Support</Chip>
          {lastTriage && <Chip tone="cyan">{t("nav.triage")} · L{lastTriage.level}</Chip>}
          {savedSchemes.length > 0 && <Chip tone="mint">{savedSchemes.length} schemes</Chip>}
        </div>
      </motion.div>

      {/* status strip */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5 }}
        className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <Glass className="rounded-[6px] px-5 py-4 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.05] hover:border-mint/30 hover:shadow-[0_12px_30px_rgba(52,245,177,0.15)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist/70">{t("home.ins.chip")}</div>
              <div className="mt-1 text-[13.5px] font-medium text-frost">
                {provider ? provider.name : (
                  <>No policy saved yet — <Link to="/insurance" className="text-mint hover:underline">run the policy checker.</Link></>
                )}
              </div>
            </div>
            <IconShield size={18} className={provider ? "text-mint" : "text-mist/40"} />
          </div>
        </Glass>
        <Glass className="relative rounded-[6px] px-5 py-4 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.05] hover:border-mint/30 hover:shadow-[0_12px_30px_rgba(52,245,177,0.15)]">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist/70">{t("home.fin.chip")}</div>
              <div className="mt-1 text-[13.5px] font-medium text-frost">
                {stats ? (
                  <>
                    {stats.savingsRate}% {t("cost.fin.savings").toLowerCase()} · ₹{stats.disposable.toLocaleString("en-IN")}{" "}
                    {t("cost.fin.disposable").toLowerCase()}
                  </>
                ) : (
                  t("home.fin.none")
                )}
              </div>
            </div>
            <IconWallet size={18} className={stats ? "text-mint" : "text-mist/40"} />
          </div>
          <Link to="/cost" className="absolute bottom-4 right-5 text-[11px] font-semibold text-mint hover:underline flex items-center gap-1">
            Financial Profile <IconArrow size={12} />
          </Link>
        </Glass>
        <Glass className="rounded-[6px] px-5 py-4 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.05] hover:border-mint/30 hover:shadow-[0_12px_30px_rgba(52,245,177,0.15)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist/70">{t("nav.asha")}</div>
              <div className="mt-1 text-[13.5px] font-medium text-frost">
                {ashaUser ? `${ashaUser.name} · ${ashaUser.area}` : (
                  <Link to="/asha" className="text-mint hover:underline">{t("home.q1")}</Link>
                )}
              </div>
            </div>
            <IconPeople size={18} className={ashaUser ? "text-cyanx" : "text-mist/40"} />
          </div>
        </Glass>
      </motion.div>

      {/* asymmetric entry grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-12">
        <EntryCard
          to="/triage"
          span="md:col-span-7"
          icon={<IconPulse size={20} />}
          title={t("home.triage.title")}
          desc={t("home.triage.desc")}
          meta={
            <>
              <Chip tone="mint">L1–L4</Chip>
              <Chip>Deterministic safety gate</Chip>
            </>
          }
        />
        <EntryCard
          to="/cost"
          span="md:col-span-5"
          delay={0.05}
          icon={<IconWallet size={20} />}
          title={t("home.cost.title")}
          desc={t("home.cost.desc")}
          meta={
            stats ? (
              <div className="flex w-full items-center gap-3">
                <Bar value={stats.savingsRate} className="max-w-[130px]" />
                <span className="text-[11px] text-mist">{stats.savingsRate}%</span>
              </div>
            ) : (
              <Chip tone="amber">{t("home.fin.none")}</Chip>
            )
          }
        />
        <EntryCard
          to="/insurance"
          span="md:col-span-4"
          delay={0.1}
          icon={<IconShield size={20} />}
          title={t("home.insurance.title")}
          desc={t("home.insurance.desc")}
          meta={
            provider ? (
              <Chip tone="mint">{provider.name}</Chip>
            ) : (
              <Chip>{t("common.unsaved")}</Chip>
            )
          }
        />
        <EntryCard
          to="/facilities"
          span="md:col-span-5"
          delay={0.15}
          icon={<IconMap size={20} />}
          title={t("home.facilities.title")}
          desc={t("home.facilities.desc")}
          meta={
            <>
              <Chip tone="mint" glow>
                PM-JAY
              </Chip>
              <Chip tone="red">24/7</Chip>
            </>
          }
        />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="md:col-span-3"
          >
            <Glass className="group flex h-full flex-col justify-between rounded-[6px] p-5 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white/[0.05] hover:border-mint/30 hover:shadow-[0_12px_30px_rgba(52,245,177,0.15)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 text-cyanx">
                    <IconPeople size={20} />
                    <h2 className="font-display text-[16px] font-semibold tracking-wide text-frost">
                      {t("home.asha.title")}
                    </h2>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-mist/70">
                    {t("home.asha.desc")}
                  </p>
                </div>
                <div className="shrink-0">
                  {ashaUser ? <Chip tone="cyan">{ashaUser.name}</Chip> : <Chip>{t("asha.public.title")}</Chip>}
                </div>
              </div>
              <div className="mt-5 border-t border-white/5 pt-5">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-4 w-4 text-mist/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search for Asha workers..."
                    className="w-full rounded-[4px] border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-[12px] text-frost placeholder-mist/40 outline-none transition-colors focus:border-cyanx/50 focus:bg-white/[0.05]"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <Link to="/asha" className="rounded bg-cyanx/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyanx hover:bg-cyanx/30 transition-colors">
                      Search
                    </Link>
                  </div>
                </div>
              </div>
            </Glass>
          </motion.div>
      </div>

      {/* journey strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4"
      >
        <Glass className="rounded-[6px] p-6">
          <div className="mb-5 flex items-center gap-2.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-cyanx">
            <IconCross size={14} />
            {t("home.journey.title")}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="relative flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-mint/40 bg-mint/[0.07] font-display text-[12px] font-semibold text-mint">
                    {n}
                  </span>
                  {n < 4 && <span className="mt-1 h-full w-px bg-white/[0.07] lg:hidden" />}
                </div>
                <p className="pb-1 text-[12.5px] leading-relaxed text-mist">{t(`home.journey.${n}`)}</p>
              </div>
            ))}
          </div>
        </Glass>
      </motion.div>

      {/* quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-mist/70">{t("home.quick")}</span>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/asha"
            className="rounded-[4px] border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[12px] font-medium text-mist transition-colors hover:border-cyanx/40 hover:text-cyanx"
          >
            {t("home.q1")}
          </Link>
          <Link
            to="/facilities"
            className="rounded-[4px] border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[12px] font-medium text-mist transition-colors hover:border-mint/40 hover:text-mint"
          >
            {t("home.q2")}
          </Link>
          <Link
            to="/triage"
            className="rounded-[4px] border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[12px] font-medium text-mist transition-colors hover:border-mint/40 hover:text-mint"
          >
            {t("home.q3")}
          </Link>
        </div>
      </motion.div>

      <p className="mt-8 flex items-center gap-2 text-[11px] text-mist/60">
        <IconGauge size={13} className="text-mist/50" />
        {t("home.sync")}
      </p>
    </div>
  );
}
