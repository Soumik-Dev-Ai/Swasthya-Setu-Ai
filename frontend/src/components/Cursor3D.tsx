import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function Cursor3D() {
  const [enabled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches
  );

  const x = useMotionValue(typeof window !== "undefined" ? window.innerWidth / 2 : -100);
  const y = useMotionValue(typeof window !== "undefined" ? window.innerHeight / 2 : -100);

  const springX = useSpring(x, { stiffness: 800, damping: 40, mass: 0.2 });
  const springY = useSpring(y, { stiffness: 800, damping: 40, mass: 0.2 });

  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const over = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      setHover(!!el?.closest?.("a,button,[data-cursor]"));
    };
    const dn = () => setDown(true);
    const up = () => setDown(false);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", over, { passive: true });
    window.addEventListener("pointerdown", dn);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      window.removeEventListener("pointerdown", dn);
      window.removeEventListener("pointerup", up);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  return createPortal(
    <motion.div style={{ x: springX, y: springY }} className="pointer-events-none fixed left-0 top-0 z-[9999]">
      <motion.img
        src="/pointer.svg"
        alt="cursor"
        className="w-10 h-10 drop-shadow-2xl"
        style={{ transformOrigin: "top left" }}
        animate={{
          scale: hover ? 1.2 : down ? 0.9 : 1,
          rotate: hover ? -5 : down ? 5 : 0,
          filter: hover ? "drop-shadow(0px 8px 16px rgba(52,245,177,0.4))" : "drop-shadow(0px 4px 8px rgba(0,0,0,0.5))"
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
    </motion.div>,
    document.body
  );
}
