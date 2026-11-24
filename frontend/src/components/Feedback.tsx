import { motion } from "framer-motion";
import { IconAlert, IconRotateCw, IconShield } from "./ui";

interface ErrorToastProps {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
  critical?: boolean;
}

export function ErrorToast({ message, onRetry, onDismiss, critical = false }: ErrorToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.22 }}
      className={`rounded-[6px] border p-4 flex items-start gap-3 ${
        critical
          ? "border-danger/50 bg-danger/[0.08] text-danger"
          : "border-amber/40 bg-amber/[0.06] text-amber"
      }`}
      role="alert"
      aria-live="assertive"
    >
      <IconAlert size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] leading-relaxed">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold underline underline-offset-2 hover:no-underline transition-colors"
            aria-label="Retry"
          >
            <IconRotateCw size={12} />
            Retry
         </button>
        )}
     </div>
      <button
        onClick={onDismiss}
        className="shrink-0 ml-2 text-mist/50 hover:text-frost transition-colors"
        aria-label="Dismiss error"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
       </svg>
     </button>
   </motion.div>
  );
}

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`rounded-[4px] bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03] bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyanx/25 bg-cyanx/[0.05] text-cyanx mb-4">
        {icon}
     </div>
      <h3 className="font-display text-[16px] font-semibold text-frost mb-1">{title}</h3>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-mist mb-4">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-cyanx underline underline-offset-2 hover:no-underline"
        >
          {action.label}
       </button>
      )}
   </div>
  );
}

interface ConsentNoticeProps {
  dataLabel: string;
  destination: string;
  storagePromise?: string;
  consented: boolean;
  onConsent: () => void;
  onRevoke?: () => void;
  className?: string;
}

export function ConsentNotice({
  dataLabel,
  destination,
  storagePromise = "not stored beyond this session",
  consented,
  onConsent,
  onRevoke,
  className = "",
}: ConsentNoticeProps) {
  if (consented) {
    return (
      <div
        className={`flex items-center gap-2 rounded-[4px] border border-cyanx/30 bg-cyanx/[0.04] px-3 py-2 text-[11.5px] text-cyanx ${className}`}
        role="status"
        aria-live="polite"
      >
        <IconShield size={13} />
        <span className="flex-1">
          Consent recorded — {dataLabel} will be sent to {destination}.
       </span>
        {onRevoke && (
          <button
            type="button"
            onClick={onRevoke}
            className="shrink-0 underline underline-offset-2 hover:no-underline"
          >
            Change
         </button>
        )}
     </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`rounded-[5px] border border-amber/35 bg-amber/[0.05] p-3.5 text-[11.5px] leading-relaxed text-amber ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <IconAlert size={13} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Before you continue</p>
          <p className="mt-1">
            The {dataLabel} you attached will be sent to {destination} for
            analysis. It is {storagePromise}.
         </p>
       </div>
     </div>
      <button
        type="button"
        onClick={onConsent}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-[4px] border border-amber/40 bg-amber/[0.08] px-3 py-1.5 text-[11px] font-semibold text-amber hover:bg-amber/[0.15] transition-colors"
      >
        <IconShield size={12} />
        I consent — continue with analysis
     </button>
   </motion.div>
  );
}

export function PriceBadge({
  source,
  amount,
  className = "",
}: {
  source: "verified_official_data" | "community_estimate_unverified" | "no_estimate_available" | string;
  amount?: number | null;
  className?: string;
}) {
  const isNone = source === "no_estimate_available" || !source;
  const isVerified = source === "verified_official_data";

  if (isNone) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-[4px] border border-mist/15 bg-white/[0.02] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em] text-mist/70 ${className}`}
        title="No price estimate available"
      >
        Price on request
     </span>
    );
  }

  if (isVerified) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-[4px] border border-cyanx/40 bg-cyanx/[0.08] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cyanx ${className}`}
        title={`Verified against official curated dataset. ${amount ? `₹${amount.toLocaleString("en-IN")}` : ""}`}
      >
        <IconShield size={10} />
        Verified price
        {amount != null ? ` · ₹${amount.toLocaleString("en-IN")}` : ""}
     </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border border-amber/30 bg-amber/[0.06] px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em] text-amber ${className}`}
      title="Community-sourced estimate — not verified against official pricing"
    >
      Community estimate — not officially verified
      {amount != null ? ` · ~₹${amount.toLocaleString("en-IN")}` : ""}
   </span>
  );
}
