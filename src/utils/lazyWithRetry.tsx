import React, { Component, Suspense, useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { PremiumLoadingState } from "../components/school/PremiumLoadingState";

const PRELOADED_IMPORTERS = new WeakSet<() => Promise<unknown>>();

export function preloadLazyChunk<T>(importer: () => Promise<T>): void {
  if (typeof window === "undefined" || PRELOADED_IMPORTERS.has(importer)) return;
  PRELOADED_IMPORTERS.add(importer);
  try {
    void importer().catch(() => {
      PRELOADED_IMPORTERS.delete(importer);
    });
  } catch {
    PRELOADED_IMPORTERS.delete(importer);
  }
}

export function scheduleIdlePreload(
  importers: Array<() => Promise<unknown>>,
  delayMs = 2200
): () => void {
  if (typeof window === "undefined") return () => {};
  const timer = window.setTimeout(() => {
    const run = () => {
      importers.forEach((imp, idx) => {
        window.setTimeout(() => preloadLazyChunk(imp), idx * 350);
      });
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(run, { timeout: 2000 });
    } else {
      run();
    }
  }, delayMs);
  return () => window.clearTimeout(timer);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} load timeout (${Math.round(ms / 1000)}s)`));
    }, ms);
    promise.then(
      (val) => {
        window.clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  moduleName = "Module"
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await withTimeout(importer(), 10000, moduleName);
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) {
          await new Promise((res) => window.setTimeout(res, attempt * 500));
        }
      }
    }
    const FallbackCard: React.FC = () => (
      <div className="min-h-[260px] flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 m-3 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
          <WifiOff className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-black text-slate-900 dark:text-white">
          {moduleName} load nahi ho saka
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
          Network slow ya naya app update aaya ho sakta hai. Dobara koshish karein.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reload Page
        </button>
      </div>
    );
    void lastErr;
    return { default: FallbackCard as unknown as T };
  });
}

const DelayedLoadingFallback: React.FC<{
  title?: string;
  onRetry?: () => void;
}> = ({ title = "Loading...", onRetry }) => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), 7000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <PremiumLoadingState
      title={`${title} khul raha hai...`}
      subtitle={
        slow
          ? "Internet slow lag raha hai. Agar ruka rahe toh Retry ya Reload dabayein."
          : "Synchronizing module components"
      }
      tone="auto"
      variant="section"
      accent="emerald"
      actions={
        slow ? (
          <>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer"
            >
              Reload App
            </button>
          </>
        ) : undefined
      }
    />
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
}

class LazyErrorBoundary extends Component<
  { title?: string; onReset?: () => void; children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[240px] flex flex-col items-center justify-center p-6 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 m-3">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {this.props.title || "Page"} open karne me error aaya
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Niche Retry ya Reload par tap karein.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onReset?.();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const LazyPanelBoundary: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title = "Module", children }) => {
  const [retryKey, setRetryKey] = useState(0);
  const handleRetry = () => setRetryKey((k) => k + 1);

  return (
    <LazyErrorBoundary title={title} onReset={handleRetry}>
      <Suspense fallback={<DelayedLoadingFallback title={title} onRetry={handleRetry} />}>
        <React.Fragment key={retryKey}>{children}</React.Fragment>
      </Suspense>
    </LazyErrorBoundary>
  );
};
