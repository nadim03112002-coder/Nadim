import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface BackHandlerEntry {
  id: string;
  priority: number;
  seq: number;
  onBack: () => void;
}

const backStack: BackHandlerEntry[] = [];
let seqCounter = 0;
let initialized = false;
let isExiting = false;
let lastRootBackAt = 0;
let lastKnownHref = typeof window !== 'undefined' ? window.location.href : '/';
let routePopHandler: (() => void) | null = null;

function isOnRootPath(): boolean {
  try {
    const p = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
    const sp = new URLSearchParams(window.location.search);
    const hasSpecialVerify = Boolean(
      sp.get('verify') || sp.get('verify-certificate') || sp.get('cNo') || sp.get('certNo') || sp.get('dispatchNo') || sp.get('v') === 'id'
    );
    return p === '/' && !hasSpecialVerify;
  } catch {
    return true;
  }
}

export function syncCurrentUrlForBackNavigation(): void {
  if (typeof window === 'undefined') return;
  lastKnownHref = window.location.href;
  lastRootBackAt = 0;
}

export function ensureBackTrapArmed(targetHref?: string): void {
  if (typeof window === 'undefined' || isExiting) return;
  try {
    const state = window.history.state;
    if (state && state.__nstBackTrap === true) {
      return;
    }
    const hrefToKeep = targetHref || window.location.href;
    window.history.pushState(
      { ...(state && typeof state === 'object' ? state : {}), __nstBackTrap: true },
      '',
      hrefToKeep
    );
    lastKnownHref = window.location.href;
  } catch {
    // Ignore history restrictions in sandboxed frames
  }
}

function removeBackHandlerById(id: string): void {
  const idx = backStack.findIndex((item) => item.id === id);
  if (idx !== -1) {
    backStack.splice(idx, 1);
  }
}

function popHighestPriorityHandler(): BackHandlerEntry | null {
  if (backStack.length === 0) return null;
  let bestIdx = 0;
  for (let i = 1; i < backStack.length; i++) {
    const cur = backStack[i];
    const best = backStack[bestIdx];
    if (cur.priority > best.priority || (cur.priority === best.priority && cur.seq > best.seq)) {
      bestIdx = i;
    }
  }
  const [picked] = backStack.splice(bestIdx, 1);
  return picked || null;
}

export function initGlobalBackNavigation(onRoutePop?: () => void): () => void {
  routePopHandler = onRoutePop || null;
  if (typeof window === 'undefined') return () => {};
  if (initialized) {
    return () => {
      routePopHandler = null;
    };
  }
  initialized = true;
  lastKnownHref = window.location.href;

  // Arm root back guard on first user interaction when at root URL or when sub-views are active
  const onUserGesture = () => {
    if (isExiting) return;
    if (backStack.length > 0 || isOnRootPath()) {
      ensureBackTrapArmed();
    }
  };

  const onPopState = () => {
    if (isExiting) return;

    const prevHref = lastKnownHref;
    const nextHref = window.location.href;
    const urlChanged = prevHref !== nextHref;
    lastKnownHref = nextHref;

    // Priority 1: Always close the topmost active modal / sub-view / function tab first
    if (backStack.length > 0) {
      const top = popHighestPriorityHandler();
      // Keep user on the current screen URL and re-arm trap for subsequent Back presses
      ensureBackTrapArmed(urlChanged ? prevHref : nextHref);
      lastRootBackAt = 0;
      if (top) {
        try {
          top.onBack();
        } catch (err) {
          console.warn('[BackNav] Handler error:', err);
        }
      }
      return;
    }

    // Priority 2: If URL actually changed (e.g., /login -> / or /admission -> /), let App router transition
    if (urlChanged) {
      lastRootBackAt = 0;
      try {
        routePopHandler?.();
      } catch {}
      if (isOnRootPath()) {
        ensureBackTrapArmed();
      }
      return;
    }

    // Priority 3: On non-root routes (/login, /admission), let App navigate back cleanly if needed
    if (!isOnRootPath()) {
      try {
        routePopHandler?.();
      } catch {}
      return;
    }

    // Priority 4: At root Dashboard / Home -> Double-Back-to-Exit safety
    const now = Date.now();
    if (now - lastRootBackAt < 2200) {
      isExiting = true;
      try {
        toast.dismiss('nst-back-exit-toast');
      } catch {}
      setTimeout(() => {
        try {
          window.history.back();
        } catch {}
        // Reset exit flag in case browser stayed open (e.g., desktop preview iframe)
        setTimeout(() => {
          isExiting = false;
          lastRootBackAt = 0;
        }, 600);
      }, 0);
      return;
    }

    lastRootBackAt = now;
    ensureBackTrapArmed();
    try {
      toast.info('App se bahar jaane ke liye dubara Back dabayein', {
        id: 'nst-back-exit-toast',
        duration: 2000,
      });
    } catch {}
  };

  window.addEventListener('pointerdown', onUserGesture, { passive: true, capture: true });
  window.addEventListener('keydown', onUserGesture, { passive: true, capture: true });
  window.addEventListener('popstate', onPopState);

  return () => {
    routePopHandler = null;
  };
}

/**
 * Registers an active modal, drawer, sub-view, or feature tab into the global Back stack.
 * When the user presses Android/browser Back, the highest-priority (and most recently opened)
 * layer closes first instead of exiting the app.
 */
export function useBackHandler(
  isActive: boolean,
  onBack: () => void,
  priority: number = 0
): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;
    const id = `nst_back_${++seqCounter}`;
    backStack.push({
      id,
      priority,
      seq: seqCounter,
      onBack: () => onBackRef.current(),
    });
    ensureBackTrapArmed();
    return () => {
      removeBackHandlerById(id);
    };
  }, [isActive, priority]);
}
