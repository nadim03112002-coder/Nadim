import React, { useEffect, useMemo, useState } from "react";
import {
  BatteryCharging,
  CheckCircle2,
  CloudUpload,
  History,
  Layers,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import type { SimCallLogRecord } from "../../school-types";
import {
  getPendingFeeFollowUpSyncCount,
  subscribeSchoolSimCallLogs,
  syncPendingFeeCallFollowUps,
} from "../../school-firebase";
import {
  announceIncomingVoiceCaller,
  findCachedParentCallerByPhone,
  getAllCachedParentCallers,
  getCachedDirectoryMeta,
  getNativeCallerIdStatus,
  getParentCallerIdOptions,
  isCallerVoiceAnnounceEnabled,
  openAndroidBatteryOptimizationSettings,
  previewNativeVerifiedSchoolCallOverlay,
  requestAndroidOverlayPermission,
  requestNativeAutoCallLogPermission,
  requestNativeOfflineCallerIdPermission,
  setCallerVoiceAnnounceEnabled,
  setParentCallerIdOptions,
  syncNativeSimCallLogsToSchool,
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
  const [simCallLogs, setSimCallLogs] = useState<SimCallLogRecord[]>([]);
  const [callLogFilter, setCallLogFilter] = useState<"ALL" | "OUTGOING" | "INCOMING" | "MISSED">("ALL");
  const [syncingCallLogs, setSyncingCallLogs] = useState(false);
  const [showStudentCardPreview, setShowStudentCardPreview] = useState(false);

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
    window.addEventListener("android-call-log-permission", onStatus);
    window.addEventListener("nst-caller-voice-setting-changed", onVoiceToggle);
    window.addEventListener("nst-parent-caller-options-changed", onParentOpts);
    window.addEventListener("fee-call-followups-updated", onStatus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("android-caller-id-status", onStatus);
      window.removeEventListener("android-call-log-permission", onStatus);
      window.removeEventListener("nst-caller-voice-setting-changed", onVoiceToggle);
      window.removeEventListener("nst-parent-caller-options-changed", onParentOpts);
      window.removeEventListener("fee-call-followups-updated", onStatus);
      window.removeEventListener("focus", onFocus);
    };
  }, [schoolId]);

  useEffect(() => {
    if (mode !== "staff" || !schoolId) {
      setSimCallLogs([]);
      return;
    }
    const unsub = subscribeSchoolSimCallLogs(schoolId, (logs) => {
      setSimCallLogs(logs);
    });
    return () => unsub();
  }, [mode, schoolId]);

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

  const handleRequestCallLogPerm = () => {
    const ok = requestNativeAutoCallLogPermission();
    if (!ok) {
      toast.info("Phone Call Log permission sirf updated SCHOOL+ Android APK me available hai.");
    }
  };

  const handleSyncSimCallLogsNow = async () => {
    if (!schoolId || syncingCallLogs) return;
    setSyncingCallLogs(true);
    try {
      const synced = await syncNativeSimCallLogsToSchool({ schoolId });
      if (synced > 0) {
        toast.success(`${synced} Parent/Enquiry phone calls sync ho gaye!`);
      } else if (!nativeStatus.isNativeApp) {
        toast.info("Cloud se sabhi staff ke recent parent calls updated hain.");
      } else {
        toast.info("Naya matched Parent/Enquiry call log nahi mila (personal calls ignore rehte hain).");
      }
    } finally {
      setSyncingCallLogs(false);
    }
  };

  const filteredSimCalls = useMemo(() => {
    return simCallLogs
      .filter((c) => {
        if (callLogFilter === "ALL") return true;
        if (callLogFilter === "MISSED") {
          return c.callType === "MISSED" || c.callType === "REJECTED";
        }
        return c.direction === callLogFilter;
      })
      .slice(0, compact ? 6 : 12);
  }, [simCallLogs, callLogFilter, compact]);

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
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
              Caller ID &amp; Voice Live Preview
            </span>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              1-Tap Test
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => triggerTestParentCallerPreview({ direction: "INCOMING" })}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
            >
              <PhoneIncoming className="w-3.5 h-3.5 shrink-0" />
              <span>Test Incoming</span>
            </button>
            <button
              type="button"
              onClick={() =>
                triggerTestParentCallerPreview({
                  direction: "OUTGOING",
                  postCall: true,
                  durationSec: 74,
                })
              }
              className="min-h-[40px] px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
            >
              <PhoneOutgoing className="w-3.5 h-3.5 shrink-0" />
              <span>Test Outgoing</span>
            </button>
            <button
              type="button"
              onClick={() => {
                announceIncomingVoiceCaller({
                  callerName: "Rajesh Sir",
                  callerRole: "Class Teacher",
                  schoolName: resolvedSchool,
                  callType: "sim",
                  dedupeKey: `test_caller_${Date.now()}`,
                  force: true,
                });
              }}
              className="col-span-2 sm:col-span-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
            >
              <Play className="w-3 h-3 fill-current shrink-0" />
              <span>Test Staff Voice</span>
            </button>
          </div>
        </div>

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
      </div>
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

      {/* Prominent Quick Test Controls (Always Visible at Top) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
            Quick Live Preview &amp; Voice Test
          </span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            1-Tap Test
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {mode === "staff" && (
            <>
              <button
                type="button"
                onClick={() => triggerTestParentCallerPreview({ direction: "INCOMING" })}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
              >
                <PhoneIncoming className="w-3.5 h-3.5 shrink-0" />
                <span>Test Incoming</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerTestParentCallerPreview({
                    direction: "OUTGOING",
                    postCall: true,
                    durationSec: 74,
                  })
                }
                className="min-h-[40px] px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
              >
                <PhoneOutgoing className="w-3.5 h-3.5 shrink-0" />
                <span>Test Outgoing</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              announceIncomingVoiceCaller({
                callerName: "Rajesh Sir",
                callerRole: "Class Teacher",
                schoolName: resolvedSchool,
                callType: "sim",
                dedupeKey: `test_caller_${Date.now()}`,
                force: true,
              });
              if (mode === "student") {
                const shownNative = previewNativeVerifiedSchoolCallOverlay({
                  schoolName: resolvedSchool,
                  staffName: "Rajesh Sir",
                  staffRole: "Class Teacher",
                  phone: "9876543210",
                });
                if (!shownNative) {
                  setShowStudentCardPreview(true);
                }
              }
            }}
            className={`${
              mode === "staff" ? "col-span-2 sm:col-span-1" : "col-span-2 sm:col-span-3"
            } min-h-[40px] px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]`}
          >
            <Play className="w-3 h-3 fill-current shrink-0" />
            <span>{mode === "staff" ? "Test Staff Voice" : "Test Call Card & Voice"}</span>
          </button>
        </div>
      </div>

      {/* Parent / Student Verified School Call Floating Card Options */}
      {mode === "student" && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Verified School Call Card (Teacher / Principal SIM Call)</span>
            {dirMeta.staffCount > 0 && (
              <span className="font-mono tabular-nums">
                {dirMeta.staffCount} School Numbers Synced
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Truecaller-Style Floating School Card
              </span>
              <input
                type="checkbox"
                checked={parentOpts.overlayEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "overlayEnabled",
                    e.target.checked,
                    "Verified School Call Floating Card"
                  )
                }
                className="h-4 w-4 accent-sky-600 cursor-pointer shrink-0"
              />
            </label>
            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Outgoing Dialer Par Bhi Card
              </span>
              <input
                type="checkbox"
                disabled={!parentOpts.overlayEnabled}
                checked={parentOpts.outgoingCallEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "outgoingCallEnabled",
                    e.target.checked,
                    "Outgoing School Call ID"
                  )
                }
                className="h-4 w-4 accent-sky-600 cursor-pointer shrink-0 disabled:opacity-40"
              />
            </label>
          </div>
        </div>
      )}

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

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Outgoing Dialer Call ID (Phone dialer se call par card)
              </span>
              <input
                type="checkbox"
                disabled={!parentOpts.parentCallerEnabled}
                checked={parentOpts.outgoingCallEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "outgoingCallEnabled",
                    e.target.checked,
                    "Outgoing Dialer Call ID"
                  )
                }
                className="h-4 w-4 accent-teal-600 cursor-pointer shrink-0 disabled:opacity-40"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 cursor-pointer min-h-[44px]">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Teacher/Staff SIM Call Log Sync (Sirf Parents)
              </span>
              <input
                type="checkbox"
                disabled={!parentOpts.parentCallerEnabled}
                checked={parentOpts.autoCallLogSyncEnabled}
                onChange={(e) =>
                  handleParentOptChange(
                    "autoCallLogSyncEnabled",
                    e.target.checked,
                    "Parent SIM Call Log Sync"
                  )
                }
                className="h-4 w-4 accent-teal-600 cursor-pointer shrink-0 disabled:opacity-40"
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
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
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

        <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 shrink-0">
          {nativeStatus.isNativeApp && nativeStatus.supported && !nativeStatus.isReady && (
            <button
              type="button"
              onClick={handleEnableOffline}
              className="w-full sm:w-auto min-h-[42px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Enable Offline Caller ID</span>
            </button>
          )}
        </div>
      </div>

      {/* Web/In-App Preview of Parent Verified School Call Card */}
      {mode === "student" && showStudentCardPreview && (
        <div className="rounded-2xl border border-sky-500/60 bg-slate-900 text-white overflow-hidden shadow-lg">
          <div className="px-3.5 py-2 bg-sky-950/90 flex items-center justify-between gap-2 border-b border-sky-500/30">
            <span className="text-[11px] font-bold tracking-wide text-sky-300 truncate">
              ✓ VERIFIED SCHOOL CALL · {resolvedSchool}
            </span>
            <button
              type="button"
              onClick={() => setShowStudentCardPreview(false)}
              className="text-xs font-bold text-slate-300 hover:text-white px-1.5 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="p-3.5 space-y-2.5">
            <div>
              <p className="text-base font-extrabold text-white">Rajesh Sir</p>
              <p className="text-xs font-medium text-sky-300">Class Teacher • 9876543210</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-xl bg-slate-800/90">
                <p className="text-[10px] text-slate-400">School Directory</p>
                <p className="text-xs font-bold text-slate-100 truncate">{resolvedSchool}</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-800/90">
                <p className="text-[10px] text-slate-400">Verified Role</p>
                <p className="text-xs font-bold text-emerald-400 truncate">Class Teacher</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Preview: Android APK me Overlay allow hone par Teacher/School ka call aate hi aisa floating card phone dialer ke upar khulega aur call katte hi auto-band ho jayega.
            </p>
          </div>
        </div>
      )}

      {/* Android Floating Overlay + Battery Unrestricted Checks */}
      {nativeStatus.isNativeApp && nativeStatus.supported && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
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
                {mode === "staff"
                  ? "Isse call aate hi phone dialer ke upar parent ka Fee Baki & Promise card dikhega."
                  : "Isse School, Principal ya Teacher ka call aate/jaate hi dialer ke upar Verified School Call card dikhega (call katte hi auto-band)."}
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

          {nativeStatus.isNativeApp && nativeStatus.supported && mode === "staff" && !nativeStatus.hasCallLogPerm && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <History className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Phone Call Log Sync Permission Pending</span>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Teacher phone ke normal dialer se parent ko call karein toh duration &amp; log ERP me auto-sync ho (personal numbers ignore rahenge).
                </p>
              </div>
              <button
                type="button"
                onClick={handleRequestCallLogPerm}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shrink-0"
              >
                <History className="w-3.5 h-3.5" />
                <span>Allow Call Log</span>
              </button>
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

      {/* Live Synced Phone Dialer Calls (Strictly Matched School Parents & Enquiries Only) */}
      {mode === "staff" && schoolId && (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>Phone Dialer Call Log (Sirf Parents &amp; Enquiries)</span>
              </h5>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Teacher/Admin ke phone dialer se aaye aur kiye gaye matched calls yahan auto-sync hote hain.
              </p>
            </div>
            <button
              type="button"
              disabled={syncingCallLogs}
              onClick={handleSyncSimCallLogsNow}
              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${syncingCallLogs ? "animate-spin" : ""}`} />
              <span>Sync Calls</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "ALL", label: `All (${simCallLogs.length})` },
                { id: "OUTGOING", label: "Outgoing" },
                { id: "INCOMING", label: "Incoming" },
                { id: "MISSED", label: "Missed" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCallLogFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition ${
                  callLogFilter === tab.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredSimCalls.length === 0 ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 py-3 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              Abhi koi matched Parent/Enquiry phone call log nahi hai. Jab staff phone ke dialer se parent ko call karega ya parent ka call aayega, yahan dikh jayega.
            </p>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {filteredSimCalls.map((log) => {
                const isMissed = log.callType === "MISSED" || log.callType === "REJECTED";
                const isOutgoing = log.direction === "OUTGOING";
                const mins = Math.floor((log.durationSec || 0) / 60);
                const secs = (log.durationSec || 0) % 60;
                const durLabel =
                  log.durationSec > 0
                    ? mins > 0
                      ? `${mins}m ${secs}s`
                      : `${secs}s`
                    : isMissed
                      ? "Missed"
                      : "0s";
                const timeStr = new Date(log.callDateMs).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                });
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => {
                      const cached = findCachedParentCallerByPhone(log.phone);
                      if (cached) {
                        triggerTestParentCallerPreview({
                          ...cached,
                          direction: log.direction,
                          durationSec: log.durationSec,
                          postCall: true,
                        });
                      } else {
                        triggerTestParentCallerPreview({
                          phone: log.phone,
                          name: log.callerName,
                          kind: log.kind,
                          studentSummary: log.studentSummary,
                          relationLabel: log.relationLabel,
                          fatherName: log.fatherName,
                          primaryStudentId: log.primaryStudentId,
                          dueAmount: log.dueAmount || 0,
                          direction: log.direction,
                          durationSec: log.durationSec,
                          postCall: true,
                        });
                      }
                    }}
                    className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-2.5 cursor-pointer transition min-h-[44px]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`p-1.5 rounded-lg shrink-0 ${
                          isMissed
                            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400"
                            : isOutgoing
                              ? "bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400"
                              : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {isMissed ? (
                          <PhoneMissed className="w-3.5 h-3.5" />
                        ) : isOutgoing ? (
                          <PhoneOutgoing className="w-3.5 h-3.5" />
                        ) : (
                          <PhoneIncoming className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {log.studentSummary || log.callerName}
                          {log.relationLabel && log.kind !== "ENQUIRY" ? ` · ${log.relationLabel}` : ""}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                          {log.phone} · {timeStr}
                          {log.recordedByName ? ` · By ${log.recordedByName}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-[11px] font-bold tabular-nums ${
                          isMissed
                            ? "text-rose-600 dark:text-rose-400"
                            : isOutgoing
                              ? "text-teal-600 dark:text-teal-400"
                              : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {durLabel}
                      </p>
                      {log.dueAmount && log.dueAmount > 0 ? (
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                          ₹{log.dueAmount.toLocaleString("en-IN")} due
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">
                          {isOutgoing ? "Dialed" : isMissed ? "Missed" : "Received"}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
