import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, User as UserIcon, Lock } from "lucide-react";
import { signIn } from "../store";
import { useT } from "../i18n";
import { SPRING_SOFT } from "../lib/motion";
import { ApiError } from "../lib/api";

/**
 * Glassmorphism sign-in modal (ASHA / Admin).
 * Real JWT auth against POST /api/auth/login — the account's role (from the
 * signed token) decides the landing page. A PENDING_ASHA account is refused
 * here with its pending-approval message (docs/25 §1).
 */
export function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await signIn(username.trim(), password);
      onClose();
      navigate(res.role === "ADMIN" ? "/app/admin" : "/app/asha/portal");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          style={{ backdropFilter: "blur(24px) saturate(1.1)", WebkitBackdropFilter: "blur(24px) saturate(1.1)", background: "oklch(0.1 0.01 60 / 0.5)" }}
          onClick={onClose}
        >
          <motion.form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.88, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 16, opacity: 0, transition: { duration: 0.18 } }}
            transition={SPRING_SOFT}
            className="glass w-full max-w-md rounded-3xl p-6 sm:p-8"
            style={{ background: "color-mix(in oklab, var(--bg-elevated) 70%, transparent)", maxHeight: "85dvh", overflowY: "auto" }}
          >
            <div className="mb-6 flex items-start justify-between">
              <h2 className="font-display text-2xl font-bold">{t("as.loginTitle")}</h2>
              <button type="button" onClick={onClose} className="rounded-full p-1.5 transition-colors hover:bg-fg/10" aria-label={t("c.close")}>
                <X size={18} />
              </button>
            </div>
            <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING_SOFT, delay: 0.08 }} className="mb-4">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("as.username")}</label>
              <div className="flex items-center gap-2">
                <UserIcon size={16} style={{ color: "var(--fg-subtle)" }} />
                <input className="input-line" style={{ ["--accent" as any]: "var(--lavender)" }} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="asha1" />
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING_SOFT, delay: 0.16 }} className="mb-6">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{t("as.password")}</label>
              <div className="flex items-center gap-2">
                <Lock size={16} style={{ color: "var(--fg-subtle)" }} />
                <input className="input-line" type="password" style={{ ["--accent" as any]: "var(--lavender)" }} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {err && <p className="mt-1.5 text-xs font-medium" style={{ color: "var(--emergency)" }}>{err}</p>}
            </motion.div>
            <motion.button
              type="submit"
              disabled={busy}
              whileTap={{ scale: 0.96 }}
              className="w-full rounded-full py-3.5 font-display text-sm font-bold text-white transition-shadow"
              style={{ background: "var(--lavender)", boxShadow: "0 8px 24px -8px var(--lavender)", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "…" : t("c.login") + " →"}
            </motion.button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}