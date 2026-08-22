import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { IconX } from "./ui";
import { useT } from "../lib/store";

export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.button type="button" aria-label={t("common.close")} className="absolute inset-0 cursor-default bg-[#02040a]/80 backdrop-blur-xl" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-modal-title"
            tabIndex={-1}
            onKeyDown={onDialogKeyDown}
            style={{ transformPerspective: 1100 }}
            className={`glass-liquid-dark relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[88vh] overflow-y-auto rounded-[6px] shadow-[0_30px_90px_rgba(0,0,0,0.6)]`}
            initial={{ opacity: 0, y: 70, scale: 0.86, rotateX: -26 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 44, scale: 0.9, rotateX: -16 }}
            transition={{ type: "spring", stiffness: 340, damping: 26, mass: 0.9 }}
          >
            <div className="flex items-start justify-between gap-6 border-b border-white/[0.06] px-6 py-4">
              <div>
                <h3 id="shared-modal-title" className="font-display text-[17px] font-semibold text-frost">{title}</h3>
                {sub && <p className="mt-1 text-[12px] leading-relaxed text-mist">{sub}</p>}
              </div>
              <button ref={closeRef} type="button" onClick={onClose} aria-label={t("common.close")} className="mt-0.5 min-h-11 min-w-11 rounded-[4px] border border-white/10 p-1.5 text-mist transition-colors hover:bg-white/[0.06] hover:text-frost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyanx/80">
                <IconX size={14} />
              </button>
            </div>
            <div className="px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
