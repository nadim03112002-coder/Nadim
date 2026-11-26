import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './app.css';
import { Toaster } from 'sonner';
import { logErrorToFirebase, extractFunctionName, deriveErrorReason, getErrorLoggerContextSnapshot } from './utils/errorLogger';
import { copyTextSafely } from './components/ErrorBoundary';

// Tier 1 Google Maps Platform Demo Key quota & auth failure detection
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    origConsoleError.apply(console, args);
    const msg = args.map((a) => String(a)).join(' ');
    if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  };

  // Disable tap-and-hold text selection & browser long-press selection callout outside form fields
  const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'));
  };

  document.addEventListener('selectstart', (e) => {
    if (!isEditableTarget(e.target)) {
      e.preventDefault();
    }
  });

  document.addEventListener('contextmenu', (e) => {
    if (!isEditableTarget(e.target)) {
      e.preventDefault();
    }
  });
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied?: boolean;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
    // Dismiss splash screen in case error happened during mount
    if (typeof (window as any).hidePreReactSplash === 'function') {
      (window as any).hidePreReactSplash();
    }
    const errStr = String(error?.message || error || '');
    const isChunkOrHookError =
      errStr.includes("reading 'useState'") ||
      errStr.includes("Invalid hook call") ||
      errStr.includes("Failed to fetch dynamically imported module");

    logErrorToFirebase(error, {
      type: 'react',
      severity: 'critical',
      componentStack: errorInfo?.componentStack ?? undefined,
      moduleName: 'Root Application',
      functionName: extractFunctionName(error?.stack, errorInfo?.componentStack ?? undefined),
    }).catch(() => {});

    // Auto-recover from stale chunks / dual React instance when dev server was restarted
    if (isChunkOrHookError) {
      const reloadKey = '__nsta_stale_chunk_reload';
      const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
      if (Date.now() - lastReload > 8000) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        console.warn('[RootErrorBoundary] Detected stale dev module mismatch, performing clean reload...');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDetails = () => {
    const err = this.state.error;
    const msg = err?.message || String(err || 'Unknown error');
    const ctx = getErrorLoggerContextSnapshot();
    const report = [
      `SCHOOL+ Crash Report`,
      `Module: ${ctx.activeModule || 'Root Application'}`,
      `Function: ${extractFunctionName(err?.stack) || 'Unknown'}`,
      `Reason: ${deriveErrorReason(msg, 'react')}`,
      `User: ${ctx.userName || 'Guest'} (${ctx.userRole || 'Unknown'})`,
      `Error: ${msg}`,
      `Stack: ${(err?.stack || '').slice(0, 600)}`,
    ].join('\n');
    void copyTextSafely(report).then((ok) => {
      if (ok) {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }
    });
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Application Notice</h2>
            <p className="text-sm text-slate-400 mb-6">
              A temporary issue occurred while rendering. Admin has been notified automatically. Click below to reload.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-blue-600/25"
              >
                Reload App
              </button>
              <button
                onClick={this.handleCopyDetails}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium rounded-xl text-sm transition-colors border border-slate-700"
              >
                {this.state.copied ? '✓ Copied' : 'Copy Error'}
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-sm transition-colors border border-slate-700"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
        <Toaster richColors position="top-center" />
      </RootErrorBoundary>
    </React.StrictMode>
  );

  // Trigger splash dismissal as soon as render is dispatched
  if (typeof (window as any).hidePreReactSplash === 'function') {
    (window as any).hidePreReactSplash();
  }

  // Pre-register root PWA & Web Push Service Worker so Android WebAPK binds to NSTA immediately
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {
          navigator.serviceWorker
            .register('/firebase-messaging-sw.js', { scope: '/', updateViaCache: 'none' })
            .catch(() => {});
        });
    });
  }
}


