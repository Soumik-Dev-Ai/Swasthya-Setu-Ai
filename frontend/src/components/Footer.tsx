import { useState } from "react";
import { useT } from "../lib/store";
import { Modal } from "./Modal";

export function Footer() {
  const t = useT();
  const [about, setAbout] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  return (
    <footer className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-8 md:px-8">
      <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5 md:flex-row md:items-center md:justify-between">
        <p className="text-[11.5px] leading-relaxed text-mist/70">{t("footer.line")}</p>
        <div className="flex items-center gap-5">
          <button
            onClick={() => setAbout(true)}
            className="text-[11.5px] font-medium text-mist transition-colors hover:text-cyanx"
          >
            {t("footer.about")}
          </button>
          <button
            onClick={() => setPrivacy(true)}
            className="text-[11.5px] font-medium text-mist transition-colors hover:text-cyanx"
          >
            {t("footer.data")}
          </button>
          <span className="text-[11px] text-mist/50">Swasthya Setu Ai Â© v2.0</span>
        </div>
      </div>

      <Modal open={about} onClose={() => setAbout(false)} title={t("footer.about")} sub="Swasthya Setu Ai">
        <div className="space-y-4 text-[13px] leading-relaxed text-mist">
          <p>
            Swasthya Setu Ai is a national healthcare navigation layer for India. It connects four
            workflows â€” symptom triage, treatment costing, insurance and scheme matching, and facility
            navigation â€” into one complete regional multilingual support that works from a village gateway.
          </p>
          <p>
            The architecture is deliberately deterministic: a red-flag safety checklist runs before any
            model scoring, and every estimate is a research-based benchmark, not a hospital bill. ASHA
            workers use the same code path in worker mode to register patients and coordinate emergency
            dispatch.
          </p>
          <p className="text-mist/70">Build v2.0.0 Â· Concept: Version 2 Â· Offline-first PWA core.</p>
        </div>
      </Modal>

      <Modal open={privacy} onClose={() => setPrivacy(false)} title={t("footer.data")} sub="On-device by design">
        <div className="space-y-3 text-[13px] leading-relaxed text-mist">
          <p>
            Everything you enter â€” symptoms, financials, policy numbers, scheme answers â€” is processed
            and stored on this device only. No account, no cloud database, no third-party trackers.
          </p>
          <p>
            When connectivity returns, only the anonymised village gateway cache (triage counts, scheme
            matches, facility queries) syncs with the network. Personal records never leave the device
            unless an ASHA worker explicitly queues a referral with your consent.
          </p>
          <p className="text-mist/70">Clearing this browser's local storage erases all local data.</p>
        </div>
      </Modal>
    </footer>
  );
}


