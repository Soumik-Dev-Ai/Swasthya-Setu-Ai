import { useEffect } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { bindDocumentEffects } from "./store";
import Landing from "./pages/Landing";
import Shell from "./components/Shell";

const TITLES: [RegExp, string][] = [
  [/^\/app\/home/, "Home · SwasthyaSetu"],
  [/^\/app\/triage/, "Symptom Triage · SwasthyaSetu"],
  [/^\/app\/cost/, "Cost & Finance · SwasthyaSetu"],
  [/^\/app\/insurance/, "Insurance & Schemes · SwasthyaSetu"],
  [/^\/app\/facilities/, "Facility Navigator · SwasthyaSetu"],
  [/^\/app\/asha\/register/, "ASHA Registration · SwasthyaSetu"],
  [/^\/app\/asha\/portal/, "ASHA Portal · SwasthyaSetu"],
  [/^\/app\/asha/, "ASHA Workers · SwasthyaSetu"],
  [/^\/app\/admin/, "Admin · SwasthyaSetu"],
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "SwasthyaSetu — India's Healthcare Navigation Layer";
    document.title = title;
  }, [pathname]);
  return null;
}

/**
 * HashRouter: works on ANY static host, iframe sandbox or file:// preview —
 * deep links survive reloads with no server configuration.
 */
export default function App() {
  useEffect(() => {
    bindDocumentEffects();
  }, []);

  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="*" element={<Root />} />
      </Routes>
    </HashRouter>
  );
}

/**
 * Only TWO app states: the immersive landing, or the shell.
 * The AnimatePresence here only ever fires when crossing that boundary
 * (enter/exit use deterministic duration-based tweens), so in-app
 * navigation is handled entirely inside the Shell and can never stall.
 */
function Root() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isLanding ? (
        <Landing key="landing" />
      ) : (
        <motion.div
          key="shell"
          initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 1.03, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Shell />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
