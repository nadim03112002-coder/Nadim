import React from 'react';
import { useAndroidBattery } from '../hooks/useAndroidBattery';

export interface AndroidBatteryIndicatorProps {
  tone?: 'auto' | 'light' | 'dark';
  className?: string;
}

const isRunningInAppShell = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)')?.matches) return true;
    if ((window.navigator as any)?.standalone === true) return true;
    if (document.referrer?.startsWith('android-app://')) return true;
    if ((window as any).LifeMakerAndroid?.isNativeApp?.() || (window as any).LifeMakerAndroid) return true;
  } catch {}
  return false;
};

export const AndroidBatteryIndicator: React.FC<AndroidBatteryIndicatorProps> = ({
  tone = 'auto',
  className = '',
}) => {
  const { isAndroid, isSupported, level, isCharging } = useAndroidBattery();

  if (isRunningInAppShell() || !isAndroid || !isSupported || level === null) {
    return null;
  }

  const clampedLevel = Math.max(0, Math.min(100, level));
  const isCritical = !isCharging && clampedLevel <= 15;
  const isLow = !isCharging && clampedLevel > 15 && clampedLevel <= 30;

  // Fill width inside a 15-unit inner track
  const fillWidth = clampedLevel === 0 ? 0 : Math.max(1.8, (clampedLevel / 100) * 15);

  const fillColorClass = isCharging
    ? 'fill-emerald-500 dark:fill-emerald-400'
    : isCritical
    ? 'fill-rose-500'
    : isLow
    ? 'fill-amber-500'
    : tone === 'light'
    ? 'fill-emerald-600'
    : tone === 'dark'
    ? 'fill-emerald-400'
    : 'fill-emerald-600 dark:fill-emerald-400';

  const containerToneClass = (() => {
    if (isCritical) {
      if (tone === 'light') return 'bg-rose-50 border-rose-200 text-rose-700';
      if (tone === 'dark') return 'bg-rose-500/15 border-rose-500/35 text-rose-300';
      return 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300';
    }
    if (isCharging) {
      if (tone === 'light') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      if (tone === 'dark') return 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300';
      return 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300';
    }
    if (isLow) {
      if (tone === 'light') return 'bg-amber-50 border-amber-200 text-amber-800';
      if (tone === 'dark') return 'bg-amber-500/15 border-amber-500/35 text-amber-300';
      return 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300';
    }
    if (tone === 'light') return 'bg-slate-100 border-slate-200 text-slate-700';
    if (tone === 'dark') return 'bg-slate-800/80 border-slate-700 text-slate-200';
    return 'bg-slate-100 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200';
  })();

  const statusLabel = `Android Battery: ${clampedLevel}%${isCharging ? ' (Charging)' : isCritical ? ' (Low)' : ''}`;

  return (
    <div
      role="status"
      aria-label={statusLabel}
      title={statusLabel}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold tabular-nums leading-none whitespace-nowrap shrink-0 select-none transition-colors ${containerToneClass} ${className}`}
    >
      <svg
        width="20"
        height="11"
        viewBox="0 0 24 13"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 overflow-visible"
        aria-hidden="true"
      >
        {/* Outer battery body */}
        <rect
          x="1"
          y="1.5"
          width="19"
          height="10"
          rx="2.4"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.5"
        />
        {/* Positive terminal cap */}
        <rect
          x="21"
          y="4.2"
          width="2"
          height="4.6"
          rx="0.9"
          fill="currentColor"
          fillOpacity="0.55"
        />
        {/* Dynamic battery charge fill */}
        {fillWidth > 0 && (
          <rect
            x="3"
            y="3.5"
            width={fillWidth}
            height="6"
            rx="1.2"
            className={`${fillColorClass} transition-all duration-300`}
          />
        )}
        {/* Charging bolt overlay */}
        {isCharging && (
          <path
            d="M11.6 2.2L8.4 6.9H10.7L9.7 10.8L13.1 6H10.8L11.6 2.2Z"
            className="fill-white stroke-emerald-700 dark:stroke-emerald-950 animate-pulse"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span>{clampedLevel}%</span>
    </div>
  );
};

export default AndroidBatteryIndicator;
