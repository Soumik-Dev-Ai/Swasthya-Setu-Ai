import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import { useT } from "../lib/store";

function NavChip({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`relative inline-flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors duration-300 ${active ? "text-mint" : "text-cyanx"}`}
    >
      <span
        className={"absolute inset-0 rounded-[4px] border bg-gradient-to-br from-[#1a2e48] to-[#081323] transition-all duration-300 \\"}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

export const SlideTabs = ({ items }: { items: { to: string; key: string; icon: React.ReactNode }[] }) => {
  const [position, setPosition] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });
  
  const location = useLocation();
  const activeIndex = items.findIndex((i) => i.to === location.pathname);
  const [selected, setSelected] = useState(activeIndex >= 0 ? activeIndex : 0);
  const tabsRef = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const idx = items.findIndex((i) => i.to === location.pathname);
    if (idx >= 0) {
      setSelected(idx);
    }
  }, [location.pathname, items]);

  useEffect(() => {
    const selectedTab = tabsRef.current[selected];
    if (selectedTab) {
      const { width } = selectedTab.getBoundingClientRect();
      setPosition({
        left: selectedTab.offsetLeft,
        width,
        opacity: 1,
      });
    }
  }, [selected, items]);

  return (
    <ul
      onMouseLeave={() => {
        const selectedTab = tabsRef.current[selected];
        if (selectedTab) {
          const { width } = selectedTab.getBoundingClientRect();
          setPosition({
            left: selectedTab.offsetLeft,
            width,
            opacity: 1,
          });
        }
      }}
      className="relative mx-auto hidden md:flex w-fit rounded-full border border-white/10 bg-white/[0.02] p-1 backdrop-blur-md shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]"
    >
      {items.map((tab, i) => (
        <Tab
          key={tab.to}
          ref={(el) => { tabsRef.current[i] = el; }}
          setPosition={setPosition}
          onClick={() => setSelected(i)}
          to={tab.to}
          icon={tab.icon}
          labelKey={tab.key}
          isActive={selected === i}
        />
      ))}
      <Cursor position={position} />
    </ul>
  );
};

const Tab = React.forwardRef<
  HTMLLIElement,
  { to: string; setPosition: any; onClick: () => void; icon: React.ReactNode; labelKey: string; isActive: boolean }
>(({ to, setPosition, onClick, icon, labelKey, isActive }, ref) => {
  const t = useT();
  return (
    <li
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => {
        if (!ref || typeof ref === "function" || !ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({
          left: ref.current.offsetLeft,
          width,
          opacity: 1,
        });
      }}
      className={"relative z-10 block cursor-none px-3 py-1.5 text-[12.5px] font-medium tracking-wide transition-colors duration-300 md:px-4 md:py-2 \\"}
    >
      <NavLink to={to} className="flex items-center gap-2">
        <NavChip active={isActive}>{icon}</NavChip>
        {t(labelKey)}
      </NavLink>
    </li>
  );
});

const Cursor = ({ position }: { position: any }) => {
  return (
    <motion.li
      animate={{
        ...position,
      }}
      className="absolute z-0 h-[32px] md:h-[40px] rounded-full bg-white/[0.08] shadow-[0_4px_16px_rgba(52,245,177,0.15),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-mint/20"
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
    />
  );
};
