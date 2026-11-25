import React, { useCallback, useEffect, useState } from "react";
import { BatteryCharging, CheckCircle2, Layers, PhoneCall, ShieldCheck, X } from "lucide-react";
import {
  getNativeCallerIdStatus,
  openAndroidBatteryOptimizationSettings,
  requestAndroidOverlayPermission,
  requestNativeOfflineCallerIdPermission,
  type NativeCallerIdStatus,
} from "../../utils/schoolCallerId";

interface CallSetupChecklistBannerProps {
  mode: "student" | "staff";
  schoolName?: string;
}

const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000;

export const CallSetupChecklistBanner: React.FC<CallSetupChecklistBannerProps> = ({
  mode,
  schoolName,
}) => {
  const storageKey = `nst_call_setup_snooze_until_${mode}`;
  const [status, setStatus] = useState<NativeCallerIdStatus>(() => getNativeCallerIdStatus());
  const [snoozed, setSnoozed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return Boolean(raw && Number(raw) > Date.now());
    } catch {
      return false;
    }
  });

  const refreshStatus = useCallback(() => {
    setStatus(getNativeCallerIdStatus());
  }, []);

  useEffect(() => {
    refreshStatus();
    const onFocus = () => refreshStatus();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshStatus();
    };
    const onStatusEvent = () => refreshStatus();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("android-caller-id-status", onStatusEvent as EventListener);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("android-caller-id-status", onStatusEvent as EventListener);
    };
  }, [refreshStatus]);

  if (!status.isNativeApp || !status.supported || snoozed) {
    return null;
  }

  const step1Done = Boolean(status.isReady);
  const step2Done = Boolean(status.canDrawOverlays);
  const step3Done = Boolean(status.batteryUnrestricted);
  const doneCount = [step1Done, step2Done, step3Done].filter(Boolean).length;

  if (doneCount === 3) {
    return null;
  }

  const handleSnooze = () => {
    try {
      localStorage.setItem(storageKey, String(Date.now() + SNOOZE_DURATION_MS));
    } catch {}
    setSnoozed(true);
  };

  const steps = [
    {
      id: "caller-id",
      done: step1Done,
      title: "Offline Caller ID",
      desc:
        mode === "student"
          ? `${schoolName || "School"} staff ki call par naam dikhe`
          : "Parent & staff calls screen par pehchanne ke liye",
      actionLabel: "Allow",
      icon: PhoneCall,
      onFix: () => {
        requestNativeOfflineCallerIdPermission();
        setTimeout(refreshStatus, 650);
      },
    },
    {
      id: "overlay",
      done: step2Done,
      title: "Floating Call Card",
      desc: "Call aane par Truecaller jaisa popup card",
      actionLabel: "Allow Overlay",
      icon: Layers,
      onFix: () => {
        requestAndroidOverlayPermission();
        setTimeout(refreshStatus, 800);
      },
    },
    {
      id: "battery",
      done: step3Done,
      title: "Battery Unrestricted",
      desc: "Background me call alert band na ho",
      actionLabel: "Allow Battery",
      icon: BatteryCharging,
      onFix: () => {
        openAndroidBatteryOptimizationSettings();
        setTimeout(refreshStatus, 800);
      },
    },
  ];

  const nextStep = steps.find((s) => !s.done) || steps[0];
  const primaryButtonLabel = !step1Done
    ? "Turant Caller ID Chalu Karein"
    : !step2Done
    ? "Floating Call Card Chalu Karein"
    : "Background Alert Chalu Karein";

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50 via-white to-sky-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 p-3.5 sm:p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                Call Alerts Aasaan Setup
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 tabular-nums">
                {doneCount}/3 Done
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              {mode === "student"
                ? "Phone setting dhundhne ki zarurat nahi — neeche button dabakar turant Caller ID aur Missed Call alert chalu karein."
                : "Phone setting dhundhne ki zarurat nahi — button dabakar turant Parent & Staff Caller ID chalu karein."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSnooze}
          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center gap-1 shrink-0 cursor-pointer"
          title="24 ghante ke liye chhupayein"
        >
          <span>Baad me</span>
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Single Primary 1-Tap Easy Setup Button */}
      <div className="mt-3">
        <button
          type="button"
          onClick={nextStep.onFix}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs font-black shadow-sm transition cursor-pointer"
        >
          <PhoneCall className="w-4 h-4 shrink-0" />
          <span>{primaryButtonLabel}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 ${
                step.done
                  ? "bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
                  : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-slate-900 dark:text-white truncate">
                    {step.title}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {step.done ? "Chalu hai" : step.desc}
                  </p>
                </div>
              </div>
              {!step.done && (
                <button
                  type="button"
                  onClick={step.onFix}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-bold shrink-0 cursor-pointer"
                >
                  {step.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
