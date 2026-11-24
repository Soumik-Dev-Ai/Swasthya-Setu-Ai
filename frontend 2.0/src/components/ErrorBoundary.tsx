import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** Catches render/runtime errors inside a screen so the app chrome (header/nav) always survives. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[SwasthyaSetu] screen crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex min-h-[55vh] flex-col items-center justify-center rounded-3xl border border-dashed p-10 text-center"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--coral-soft)" }}>
            <AlertTriangle size={30} style={{ color: "var(--coral)" }} />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold">This screen hit a snag</h2>
          <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--fg-muted)" }}>
            Nothing else is affected — reload this screen or head back home.
          </p>
          <code className="mt-4 max-w-md break-all rounded-xl px-3 py-2 text-[11px]" style={{ background: "var(--bg)", color: "var(--fg-subtle)" }}>
            {String(this.state.error?.message ?? this.state.error ?? "Unknown error")}
          </code>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => this.setState({ error: null })}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
              style={{ background: "var(--coral)", boxShadow: "0 10px 26px -12px var(--coral)" }}
            >
              <RotateCcw size={15} /> Try again
            </button>
            <a
              href="#/app/home"
              className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold"
              style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
            >
              Back to Home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
