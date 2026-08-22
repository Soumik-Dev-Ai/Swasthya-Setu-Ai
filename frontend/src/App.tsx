import { AnimatePresence, motion } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Cursor3D } from "./components/Cursor3D";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Aurora, Grain } from "./components/ui";
import { StoreProvider } from "./lib/store";
import { Asha } from "./pages/Asha";
import { Cost } from "./pages/Cost";
import { Facilities } from "./pages/Facilities";
import { Home } from "./pages/Home";
import { Insurance } from "./pages/Insurance";
import { Landing } from "./pages/Landing";
import { Triage } from "./pages/Triage";

function Shell() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  return (
    <div className="flex min-h-screen cursor-none flex-col">
      <Header />

      <div className="relative flex-1">
        {/* living background — aurora light field + film grain (inner routes only; landing owns its WebGL hero) */}
        {!isLanding && <Aurora />}
        {!isLanding && <Grain />}

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={isLanding ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              isLanding
                ? { opacity: 0, scale: 1.08, filter: "blur(12px)" }
                : { opacity: 0, y: -14, scale: 0.997 }
            }
            transition={
              isLanding
                ? { duration: 0.5, ease: [0.45, 0, 0.2, 1] }
                : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }
            }
            className="relative z-10"
          >
            {isLanding ? (
              <Routes location={location}>
                <Route path="/" element={<Landing />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            ) : (
              <div className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-24 md:px-8">
                <Routes location={location}>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/triage" element={<Triage />} />
                  <Route path="/cost" element={<Cost />} />
                  <Route path="/insurance" element={<Insurance />} />
                  <Route path="/facilities" element={<Facilities />} />
                  <Route path="/asha" element={<Asha />} />
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {!isLanding && <Footer />}

      {/* global physics cursor — persists across every route */}
      <Cursor3D />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </StoreProvider>
  );
}
