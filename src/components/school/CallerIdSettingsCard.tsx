import React, { useEffect, useMemo, useState } from "react";
import {
  BatteryCharging,
  CheckCircle2,
  CloudUpload,
  Layers,
  PhoneCall,
  PhoneIncoming,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPendingFeeFollowUpSyncCount,
  syncPendingFeeCallFollowUps,
} from "../../school-firebase";
import {
  announceIncomingVoiceCaller,
  getAllCachedParentCallers,
  getCachedDirectoryMeta,
  getNativeCallerIdStatus,
  getParentCallerIdOptions,
  isCallerVoiceAnnounceEnabled,
  openAndroidBatteryOptimizationSettings,
  requestAndroidOverlayPermission,
  requestNativeOfflineCallerIdPermission,
  setCallerVoiceAnnounceEnabled,
  setParentCallerIdOptions,
  triggerTestParentCallerPreview,
  type CachedParentCallerInfo,
  type NativeCallerIdStatus,
  type ParentCallerIdOptions,
} from "../../utils/schoolCallerId";

import { EliteFeatureLockCard } from "./EliteFeatureLockCard";

interface Props {
  schoolId?: string;
  schoolName?: string;
  compact?: boolean;
  mode?: "student" | "staff";
  isEliteLocked?: boolean;
  onUpgradeToElite?: () => void;
}

export const CallerIdSettingsCard: React.FC<Props> = ({
  schoolId,
  schoolName,
  compact = false,
  mode = "student",
  isEliteLocked = false,
  onUpgradeToElite,
}) => {
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => isCallerVoiceAnnounceEnabled());
  const [parentOpts, setParentOpts] = useState<ParentCallerIdOptions>(() =>
    getParentCallerIdOptions()
  );
  const [nativeStatus, setNativeStatus] = useState<NativeCallerIdStatus>(() =>
    getNativeCallerIdStatus()
  );
  const [dirMeta, setDirMeta] = useState(() => getCachedDirectoryMeta());
  const [lookupQuery, setLookupQuery] = useState("");
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    schoolId ? getPendingFeeFollowUpSyncCount(schoolId) : 0
  );
  const [syncingPending, setSyncingPending] = useState(false);

  const refresh = () => {
    setVoiceEnabled(isCallerVoiceAnnounceEnabled());
    setParentOpts(getParentCallerIdOptions());
    setNativeStatus(getNativeCallerIdStatus());
    setDirMeta(getCachedDirectoryMeta());
    if (schoolId) {
      setPendingSyncCount(getPendingFeeFollowUpSyncCount(schoolId));
    }
  };

  useEffect(() => {
    refresh();
    const onStatus = () => refresh();
    const onVoiceToggle = () => setVoiceEnabled(isCallerVoiceAnnounceEnabled());
    const onParentOpts = () => setParentOpts(getParentCallerIdOptions());
    const onFocus = () => refresh();
    window.addEventListener("android-caller-id-status", onStatus);
    window.addEventListener("nst-caller-voice-setting-changed", onVoiceToggle);
    window.addEventListener("nst-parent-caller-options-changed", onParentOpts);
    window.addEventListener("fee-call-followups-updated", onStatus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("android-caller-id-status", onStatus);
      window.removeEventListener("nst-caller-voice-setting-changed", onVoiceToggle);
      window.removeEventListener("nst-parent-caller-options-changed", onParentOpts);
      window.removeEventListener("fee-call-followups-updated", onStatus);
      window.removeEventListener("focus", onFocus);
    };
  }, [schoolId]);

  const handleToggleVoice = (next: boolean) => {
    setCallerVoiceAnnounceEnabled(next);
    setVoiceEnabled(next);
    toast.success(
      next
        ? "Caller Voice Announcement ON — call aane par caller ka naam aur jankari bolega."
        : "Caller Voice Announcement OFF — sirf normal ringtone bajegi."
    );
  };

  const handleParentOptChange = (
    key: keyof ParentCallerIdOptions,
    value: boolean,
    label: string
  ) => {
    const updated = setParentCallerIdOptions({ [key]: value });
    setParentOpts(updated);
    toast.success(`${label} ${value ? "ON" : "OFF"}`);
  };

  const handleEnableOffline = () => {
    const ok = requestNativeOfflineCallerIdPermission();
    if (!ok) {
      toast.info("Offline SIM Caller ID ke liye updated SCHOOL+ Android APK install karein.");
    }
  };

  const handleRequestOverlay = () => {
    const ok = requestAndroidOverlayPermission();
    if (!ok) {
      toast.info("Floating Overlay permission sirf updated SCHOOL+ Android APK me available hai.");
    }
  };

  const handleOpenBatterySettings = () => {
    const ok = openAndroidBatteryOptimizationSettings();
    if (!ok) {
      toast.info("Battery Unrestricted setting sirf updated SCHOOL+ Android APK me available hai.");
    }
  };

  const handleSyncPendingNow = async () => {
    if (!schoolId || syncingPending) return;
    setSyncingPending(true);
    try {
      const count = await syncPendingFeeCallFollowUps(schoolId);
      setPendingSyncCount(getPendingFeeFollowUpSyncCount(schoolId));
      if (count > 0) {
        toast.success(`${count} queued follow-up update cloud me sync ho gaye.`);
      } else {
        toast.info("Abhi sabhi offline records synced hain ya network pending hai.");
      }
    } finally {
      setSyncingPending(false);
    }
  };

  const lookupResults = useMemo<CachedParentCallerInfo[]>(() => {
    if (mode !== "staff") return [];
    const q = lookupQuery.trim().toLowerCase();
    if (!q) return [];
    const all = getAllCachedParentCallers();
    return all
      .filter(
        (p) =>
          p.phone.includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.studentSummary.toLowerCase().includes(q) ||
          (p.fatherName && p.fatherName.toLowerCase().includes(q)) ||
          p.children.some((c) => c.name.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [lookupQuery, mode, dirMeta.count]);

  const resolvedSchool = nativeStatus.schoolName || dirMeta.schoolName || schoolName || "School";

  if (mode === "staff" && isEliteLocked) {
    return (
      <EliteFeatureLockCard
        compact={compact}
        title="Parent & Enquiry Caller ID (Ulta Directory)"
        description="Parent ya Admission Enquiry call aane par offline bol de — bacche ka naam, class, absent alert, kitna ₹ fee baki hai, promise date aur next call."
        highlights={[
          "Offline SIM Caller ID Banner + Voice Alert",
          "₹ Fee Baki, Promise Date & Absent Status",
          "1-Tap UPI QR & Call Follow-Up Sync",
        ]}
        onUpgrade={onUpgradeToElite}
      />
    );
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      } space-y-3.5`}
    >
      {/* Header + Master Toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 shrink-0">
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              {mode === "staff"
                ? "Parent & Enquiry Caller ID (Ulta Directory) & Smart Voice"
                : "Smart Caller Name Voice"}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
              {mode === "staff"
                ? "Parent ya Admission Enquiry call aane par offline bol de — bacche ka naam, class, absent alert, kitna ₹ fee baki hai, promise date aur next call."
                : "Fee Tagada / NSTA Voice Call ya Offline SIM call aane par school ka naam aur kaun Sir/Teacher call kar rahe hain, bolkar sunayega."}
            </p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={voiceEnabled}
          onChange={(e) => handleToggleVoice(e.target.checked)}
          className="h-5 w-5 accent-indigo-600 cursor-pointer shrink-0 mt-1"
          aria-label="Toggle Caller Name Voice Announcement"
        />
      </div>

      {/* Staff / Principal / Accountant / Teacher Reverse Parent Options */}
      {mode === "staff" && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Parent &amp; Enquiry Caller Options</span>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span>
                {dirMeta.parentCount} Parent · {dirMeta.enquiryCount} Enquiry · {dirMeta.staffCount} Staff
              </span>
              {schoolId && pendingSyncCount > 0 && (
                <button
                  type="button"
                  disabled={syncingPending}
                  onClick={handleSyncPendingNow}
                  className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 inline-flex items-center gap-1 cursor-pointer hover:bg-amber-200 transition"
                >
                  {syncingPending ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <CloudUpload className="w-3 h-3" />
                  )}
                  <span>{pendingSyncCount} Pending</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Parent &amp; Enquiry Caller ID
              </span>
              <input
                type="checkbox"
                checked={parentOpts.parentCallerEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "parentCallerEnabled",
                    e.target.checked,
                    "Parent & Enquiry Caller ID"
                  )
                }
                className="h-4 w-4 accent-emerald-600 cursor-pointer shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Voice me Baki Fee (₹) Bole
              </span>
              <input
                type="checkbox"
                disabled={!parentOpts.parentCallerEnabled}
                checked={parentOpts.dueVoiceEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "dueVoiceEnabled",
                    e.target.checked,
                    "Baki Fee Voice"
                  )
                }
                className="h-4 w-4 accent-emerald-600 cursor-pointer shrink-0 disabled:opacity-40"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Voice me Promise &amp; Next Call Bole
              </span>
              <input
                type="checkbox"
                disabled={!parentOpts.parentCallerEnabled}
                checked={parentOpts.scheduleVoiceEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "scheduleVoiceEnabled",
                    e.target.checked,
                    "Promise & Next Call Voice"
                  )
                }
                className="h-4 w-4 accent-emerald-600 cursor-pointer shrink-0 disabled:opacity-40"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Incoming &amp; Post-Call Card Popup
              </span>
              <input
                type="checkbox"
                disabled={!parentOpts.parentCallerEnabled}
                checked={parentOpts.cardPopupEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "cardPopupEnabled",
                    e.target.checked,
                    "Incoming Parent Call Card"
                  )
                }
                className="h-4 w-4 accent-emerald-600 cursor-pointer shrink-0 disabled:opacity-40"
              />
            </label>

            <label className="sm:col-span-2 flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Truecaller-Style Floating Call Overlay (Screen ke upar card)
              </span>
              <input
                type="checkbox"
                disabled={!parentOpts.parentCallerEnabled}
                checked={parentOpts.overlayEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "overlayEnabled",
                    e.target.checked,
                    "Floating Call Overlay"
                  )
                }
                className="h-4 w-4 accent-emerald-600 cursor-pointer shrink-0 disabled:opacity-40"
              />
            </label>
          </div>

          {/* Live Parent / Enquiry Caller Card Lookup */}
          <div className="pt-1 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Parent phone, student ya admission enquiry naam se check karein..."
                className="w-full h-10 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            {lookupResults.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
                {lookupResults.map((item) => (
                  <button
                    key={`${item.kind || "PARENT"}_${item.phone}`}
                    type="button"
                    onClick={() => {
                      triggerTestParentCallerPreview(item);
                      setLookupQuery("");
                    }}
                    className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 flex items-center justify-between gap-2 cursor-pointer transition min-h-[44px]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.kind === "ENQUIRY"
                          ? `Enquiry: ${item.name} (${item.studentSummary})`
                          : `${item.studentSummary} ke ${item.relationLabel}`}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
                        {item.phone}
                        {item.absentToday ? " · Absent Today" : ""}
                        {item.promiseDate ? ` · Promise: ${item.promiseDate}` : ""}
                        {item.nextCallDate ? ` · Next: ${item.nextCallDate}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.kind === "ENQUIRY" ? (
                        <p className="text-xs font-bold text-sky-600 dark:text-sky-400">
                          {item.enquiryStage || "Enquiry"}
                        </p>
                      ) : (
                        <>
                          <p
                            className={`text-xs font-bold font-mono tabular-nums ${
                              item.dueAmount > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {item.dueAmount > 0
                              ? `₹${item.dueAmount.toLocaleString("en-IN")}`
                              : "Clear"}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {item.solvedToday ? "Aaj Solve ✅" : "Pending"}
                          </p>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offline Android SIM Caller ID Status + Test Actions */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          {nativeStatus.isNativeApp ? (
            nativeStatus.supported ? (
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  {nativeStatus.isReady ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-emerald-700 dark:text-emerald-300">
                        Offline SIM Caller ID Active
                      </span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-amber-700 dark:text-amber-300">
                        Offline SIM Caller ID Permission Pending
                      </span>
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {nativeStatus.cachedCount > 0
                    ? `${resolvedSchool} ke ${nativeStatus.cachedCount} numbers offline phone me saved hain.`
                    : `${resolvedSchool} ke numbers load hote hi offline save ho jayenge.`}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Offline SIM Caller ID ke liye naya updated SCHOOL+ APK install karein.</span>
              </p>
            )
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                Web/PWA Caller Card &amp; Voice preview ready hai · Offline SIM &amp; Floating Overlay Android APK me chalti hai.
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {nativeStatus.isNativeApp && nativeStatus.supported && !nativeStatus.isReady && (
            <button
              type="button"
              onClick={handleEnableOffline}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Enable Offline Caller ID</span>
            </button>
          )}
          {mode === "staff" && (
            <button
              type="button"
              onClick={() => triggerTestParentCallerPreview()}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <PhoneIncoming className="w-3.5 h-3.5" />
              <span>Test Parent Call</span>
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              announceIncomingVoiceCaller({
                callerName: "Rajesh Sir",
                callerRole: "Teacher",
                schoolName: resolvedSchool,
                callType: "sim",
                dedupeKey: `test_caller_${Date.now()}`,
                force: true,
              })
            }
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{mode === "staff" ? "Test Staff Voice" : "Test Voice"}</span>
          </button>
        </div>
      </div>

      {/* Android Floating Overlay + Battery Unrestricted Checks */}
      {nativeStatus.isNativeApp && nativeStatus.supported && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          {mode === "staff" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-bold flex items-center gap-1.5">
                  {nativeStatus.canDrawOverlays ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-emerald-700 dark:text-emerald-300">
                        Floating Call Overlay Ready (Truecaller-Style)
                      </span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="text-amber-700 dark:text-amber-300">
                        Floating Call Overlay Permission Pending
                      </span>
                    </>
                  )}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Isse call aate hi phone dialer ke upar parent ka Fee Baki &amp; Promise card dikhega.
                </p>
              </div>
              {!nativeStatus.canDrawOverlays && (
                <button
                  type="button"
                  onClick={handleRequestOverlay}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Allow Overlay</span>
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs font-bold flex items-center gap-1.5">
                {nativeStatus.batteryUnrestricted ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-300">
                      24×7 Call &amp; Voice Ready (Battery Unrestricted)
                    </span>
                  </>
                ) : (
                  <>
                    <BatteryCharging className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-300">
                      Battery Saver se Call Alert ruk sakti hai
                    </span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Redmi/Vivo/Oppo/Realme me App Info → Battery Unrestricted &amp; Autostart ON rakhein.
              </p>
            </div>
            {!nativeStatus.batteryUnrestricted && (
              <button
                type="button"
                onClick={handleOpenBatterySettings}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shrink-0"
              >
                <BatteryCharging className="w-3.5 h-3.5" />
                <span>Allow Unrestricted</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
