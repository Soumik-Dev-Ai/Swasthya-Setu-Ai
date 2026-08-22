import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeroScene } from "../components/three/HeroScene";
import { warp } from "../components/three/warp";
import { IconArrow } from "../components/ui";
import { useT } from "../lib/store";

const reveal = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay: 0.2 + i * 0.14, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function Landing() {
  const t = useT();
  const navigate = useNavigate();
  const [warping, setWarping] = useState(false);

  // always start calm — the warp flag is module-global
  useEffect(() => {
    warp.active = false;
  }, []);

  const handleContinue = () => {
    if (warping) return;
    setWarping(true);
    warp.active = true; // cross accelerates, scales up and flies into the camera
    window.setTimeout(() => navigate("/home"), 820); // route push after the 3D zoom
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* WebGL layer */}
      <div className="absolute inset-0">
        <HeroScene />
      </div>
      <div className="pointer-events-none absolute inset-0 vignette" aria-hidden />

      {/* hero copy — decluttered, vertically centred */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 items-center px-4 pt-20 md:px-8">
        <div className="max-w-[600px]">
          <motion.div
            variants={reveal}
            initial="hidden"
            animate="show"
            custom={0}
            className="mb-6 flex items-center gap-2.5 text-[10.5px] font-semibold uppercase tracking-[0.26em] text-cyanx"
          >
            <span className="h-px w-8 bg-cyanx/60" />
            {t("landing.kicker")}
          </motion.div>

          <h1 className="font-display text-[44px] font-semibold leading-[1.06] tracking-tight text-frost md:text-[66px]">
            <motion.span variants={reveal} custom={1} className="block">
              {t("landing.h1a")}
            </motion.span>
            <motion.span
              variants={reveal}
              custom={2}
              className="block"
              style={{ filter: "drop-shadow(0 0 24px rgba(52,245,177,0.4))" }}
            >
              <span className="bg-gradient-to-r from-mint via-mint to-cyanx bg-clip-text text-transparent">
                {t("landing.h1b")}
              </span>
            </motion.span>
          </h1>

          <motion.p
            variants={reveal}
            custom={3}
            className="mt-7 max-w-[520px] text-[14.5px] leading-relaxed text-mist"
          >
            {t("landing.sub")}
          </motion.p>

          <motion.div variants={reveal} custom={4} className="mt-10 flex flex-wrap items-center gap-5">
            <motion.button
              onClick={handleContinue}
              whileHover={warping ? undefined : { y: -2 }}
              whileTap={warping ? undefined : { scale: 0.97 }}
              animate={warping ? { scale: 0.92, opacity: 0.45 } : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="group flex items-center gap-3 rounded-[4px] border border-mint/50 bg-mint/90 px-8 py-4 text-[15px] font-bold tracking-wide text-[#032018] shadow-[0_0_44px_rgba(52,245,177,0.3)] transition-shadow hover:shadow-[0_0_64px_rgba(52,245,177,0.45)]"
            >
              {t("landing.cta")}
              <IconArrow size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
            </motion.button>
            <span className="text-[11px] uppercase tracking-[0.18em] text-mist/60">{t("landing.hint")}</span>
          </motion.div>
        </div>
      </div>

      {/* cinematic warp — dims the world as the cross passes through */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: warping ? 0.62 : 0 }}
        transition={{ duration: 0.55, delay: warping ? 0.12 : 0 }}
        className="pointer-events-none fixed inset-0 z-20 bg-[#02040a]"
        aria-hidden
      />

      {/* portal bloom, anchored to the cross's screen position */}
      {warping && (
        <div className="pointer-events-none fixed inset-0 z-30" aria-hidden>
          <div className="absolute left-[63%] top-[50%] -translate-x-1/2 -translate-y-1/2">
            <motion.div
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 3.4, opacity: [0, 0.7, 0.2] }}
              transition={{ duration: 0.95, ease: [0.3, 0, 0.2, 1] }}
              className="h-[56vmin] w-[56vmin] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(52,245,177,0.42) 0%, rgba(78,230,240,0.2) 38%, transparent 72%)",
                filter: "blur(4px)",
              }}
            />
          </div>
          <div className="absolute left-[63%] top-[50%] -translate-x-1/2 -translate-y-1/2">
            <motion.div
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 5, opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="h-40 w-40 rounded-full border border-cyanx/60"
              style={{ boxShadow: "0 0 46px rgba(78,230,240,0.4)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
