import { IconAlert, IconCheck } from "./ui";

export function PrecisionDisclaimer({ disclaimer, sources }: { disclaimer?: string, sources?: {title: string, url: string}[] }) {
  if (!disclaimer && (!sources || sources.length === 0)) return null;

  return (
    <div className="mt-4 rounded border border-amber/30 bg-amber/[0.04] p-3 text-sm">
      {disclaimer && (
        <div className="flex items-start gap-2 text-amber/90">
          <IconAlert size={16} className="mt-0.5 shrink-0" />
          <p>{disclaimer}</p>
        </div>
      )}
      {sources && sources.length > 0 && (
        <div className="mt-3 border-t border-amber/10 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber/60">
            <IconCheck size={12} />
            Verified Medical Sources
          </div>
          <ul className="space-y-1.5 text-xs text-frost/70">
            {sources.map((src, i) => (
              <li key={i}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-cyanx"
                >
                  <span className="truncate">{src.title}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
