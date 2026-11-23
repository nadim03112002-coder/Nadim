import { useEffect, useState } from 'react';

export interface AndroidBatteryState {
  isAndroid: boolean;
  isSupported: boolean;
  level: number | null;
  isCharging: boolean;
}

interface BatterySnapshot {
  isAndroid: boolean;
  isSupported: boolean;
  level: number | null;
  isCharging: boolean;
}

interface NativeBatteryPayload {
  supported?: boolean;
  level?: number;
  charging?: boolean;
}

interface BatteryManagerLike extends EventTarget {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

declare global {
  interface Window {
    LifeMakerAndroid?: {
      isNativeApp?: () => boolean;
      getBatteryStatus?: () => string;
      [key: string]: unknown;
    };
    __androidBatteryState?: NativeBatteryPayload;
    __onAndroidBatteryUpdate?: (level: number, charging: boolean) => void;
  }
}

const detectAndroidDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (window.LifeMakerAndroid) return true;
  return /Android/i.test(navigator.userAgent || '');
};

const clampBatteryLevel = (raw: unknown): number | null => {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
};

const subscribers = new Set<(state: BatterySnapshot) => void>();
let initialized = false;
let currentSnapshot: BatterySnapshot = {
  isAndroid: false,
  isSupported: false,
  level: null,
  isCharging: false,
};

const notifySubscribers = () => {
  subscribers.forEach((cb) => cb(currentSnapshot));
};

const updateSnapshot = (level: number | null, isCharging: boolean) => {
  const isAndroid = detectAndroidDevice();
  if (!isAndroid || level === null) return;
  if (
    currentSnapshot.isAndroid === isAndroid &&
    currentSnapshot.isSupported === true &&
    currentSnapshot.level === level &&
    currentSnapshot.isCharging === isCharging
  ) {
    return;
  }
  currentSnapshot = {
    isAndroid,
    isSupported: true,
    level,
    isCharging,
  };
  notifySubscribers();
};

const readNativeBridgeBattery = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const cached = window.__androidBatteryState;
    if (cached && cached.supported !== false) {
      const lvl = clampBatteryLevel(cached.level);
      if (lvl !== null) {
        updateSnapshot(lvl, Boolean(cached.charging));
        return true;
      }
    }
    const rawJson = window.LifeMakerAndroid?.getBatteryStatus?.();
    if (typeof rawJson === 'string' && rawJson.trim()) {
      const parsed = JSON.parse(rawJson) as NativeBatteryPayload;
      if (parsed && parsed.supported !== false) {
        const lvl = clampBatteryLevel(parsed.level);
        if (lvl !== null) {
          updateSnapshot(lvl, Boolean(parsed.charging));
          return true;
        }
      }
    }
  } catch {
    // Ignore bridge parse errors and fall back to Web Battery API
  }
  return false;
};

const ensureInitialized = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const isAndroid = detectAndroidDevice();
  currentSnapshot = {
    ...currentSnapshot,
    isAndroid,
  };
  if (!isAndroid) return;

  // 1. Register native Android WebView push callback (preserve any existing listener)
  const prevHandler = window.__onAndroidBatteryUpdate;
  window.__onAndroidBatteryUpdate = (level: number, charging: boolean) => {
    const lvl = clampBatteryLevel(level);
    if (lvl !== null) {
      updateSnapshot(lvl, Boolean(charging));
    }
    if (typeof prevHandler === 'function' && prevHandler !== window.__onAndroidBatteryUpdate) {
      try {
        prevHandler(level, charging);
      } catch {}
    }
  };

  window.addEventListener('android-battery-update', ((ev: Event) => {
    const detail = (ev as CustomEvent<{ level?: number; charging?: boolean }>).detail;
    if (!detail) return;
    const lvl = clampBatteryLevel(detail.level);
    if (lvl !== null) {
      updateSnapshot(lvl, Boolean(detail.charging));
    }
  }) as EventListener);

  // Pull initial native battery reading synchronously if available
  const hasNative = readNativeBridgeBattery();

  // 2. Also attach Web Battery Status API (works on Android Chrome/PWA and older APK builds)
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<BatteryManagerLike>;
  };
  if (typeof nav.getBattery === 'function') {
    nav
      .getBattery()
      .then((battery) => {
        if (!battery) return;
        const syncWebBattery = () => {
          const lvl = clampBatteryLevel(Math.round((battery.level ?? -1) * 100));
          if (lvl !== null) {
            updateSnapshot(lvl, Boolean(battery.charging));
          }
        };
        if (!hasNative || currentSnapshot.level === null) {
          syncWebBattery();
        }
        battery.addEventListener('levelchange', syncWebBattery);
        battery.addEventListener('chargingchange', syncWebBattery);
      })
      .catch(() => {
        // Battery API unavailable or blocked
      });
  }

  // Re-poll native bridge on app resume / visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      readNativeBridgeBattery();
    }
  });
};

export function useAndroidBattery(): AndroidBatteryState {
  const [state, setState] = useState<AndroidBatteryState>(() => {
    ensureInitialized();
    return currentSnapshot;
  });

  useEffect(() => {
    ensureInitialized();
    setState(currentSnapshot);
    const handler = (next: BatterySnapshot) => setState(next);
    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }, []);

  return state;
}
