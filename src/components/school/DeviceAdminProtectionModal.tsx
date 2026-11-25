import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Lock,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Terminal,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  deactivateAndroidDeviceAdmin,
  getAndroidDeviceAdminStatus,
  hasCustomDeviceAdminPin,
  lockAndroidDeviceScreen,
  openAndroidAccessibilityGuardSettings,
  openAndroidDeviceAdminSettings,
  requestAndroidDeviceAdmin,
  saveCustomDeviceAdminPin,
  setAndroidAccessibilityGuardLocked,
  setAndroidUninstallBlocked,
  unlockAndroidProtectionTemporarily,
  verifyCustomDeviceAdminPin,
  type AndroidDeviceAdminStatus,
} from "../../utils/androidDeviceAdmin";

interface DeviceAdminProtectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolLockCode?: string;
}

export const DeviceAdminProtectionModal: React.FC<DeviceAdminProtectionModalProps> = ({
  isOpen,
  onClose,
  schoolLockCode,
}) => {
  const [status, setStatus] = useState<AndroidDeviceAdminStatus>(() =>
    getAndroidDeviceAdminStatus()
  );
  const [hasPin, setHasPin] = useState<boolean>(() => hasCustomDeviceAdminPin());
  const [newPin, setNewPin] = useState("");
  const [verifyPinInput, setVerifyPinInput] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState<
    null | "temp_unlock" | "deactivate_admin" | "disable_accessibility_lock"
  >(null);

  const refreshStatus = () => {
    setStatus(getAndroidDeviceAdminStatus());
    setHasPin(hasCustomDeviceAdminPin());
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshStatus();

    const handleNativeChange = () => {
      refreshStatus();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshStatus();
      }
    };

    window.addEventListener("android-device-admin-changed", handleNativeChange);
    document.addEventListener("visibilitychange", handleVisibility);

    const timer = window.setInterval(() => {
      setStatus((prev) => {
        if (prev.tempUnlockRemainingSec > 1) {
          return { ...prev, tempUnlockRemainingSec: prev.tempUnlockRemainingSec - 1 };
        }
        if (prev.tempUnlockRemainingSec === 1) {
          return getAndroidDeviceAdminStatus();
        }
        return prev;
      });
    }, 1000);

    return () => {
      window.removeEventListener("android-device-admin-changed", handleNativeChange);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(timer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const requiresPinOrSchoolCode =
    hasPin || Boolean(schoolLockCode && schoolLockCode.trim().length > 0);

  const checkAdminPin = async (entered: string): Promise<boolean> => {
    const clean = entered.trim();
    if (hasPin) {
      const ok = await verifyCustomDeviceAdminPin(clean);
      if (!ok) {
        toast.error("Galat Security PIN!");
        return false;
      }
      return true;
    }
    if (schoolLockCode && schoolLockCode.trim().length > 0) {
      if (clean !== schoolLockCode.trim()) {
        toast.error("Galat School Lock Code!");
        return false;
      }
      return true;
    }
    return true;
  };

  const handleActivateAdmin = () => {
    if (!status.isNativeApp) {
      toast.info("Device Admin sirf Android APK (SCHOOL+ App) ke andar kaam karta hai.");
      return;
    }
    if (!status.supported) {
      toast.warning("Is feature ke liye naya updated SCHOOL+ APK install karein.");
      return;
    }
    const launched = requestAndroidDeviceAdmin();
    if (!launched) {
      toast.error("Device Admin prompt open nahi ho saka. Settings se enable karein.");
    }
  };

  const handleEnableAccessibilityGuard = () => {
    if (!status.isNativeApp) {
      toast.info("Accessibility Uninstall Guard sirf Android APK ke andar kaam karta hai.");
      return;
    }
    if (!status.supported) {
      toast.warning("Naya updated SCHOOL+ APK install karein.");
      return;
    }
    if (!status.isAccessibilityGuardLocked) {
      setAndroidAccessibilityGuardLocked(true);
    }
    openAndroidAccessibilityGuardSettings();
    toast.info("Settings me 'SCHOOL+ Uninstall Guard' ko dhoondhkar ON karein.");
  };

  const handleSavePin = async () => {
    const clean = newPin.trim();
    if (clean.length < 4) {
      toast.error("Kam se kam 4 digit ka Admin PIN daalein.");
      return;
    }
    await saveCustomDeviceAdminPin(clean);
    setHasPin(true);
    setNewPin("");
    setShowPinSetup(false);
    toast.success("Admin Security PIN save ho gaya!");
  };

  const handleClearPin = async () => {
    if (hasPin) {
      const ok = await verifyCustomDeviceAdminPin(verifyPinInput);
      if (!ok) {
        toast.error("Pehle sahi purana PIN daalein.");
        return;
      }
    }
    await saveCustomDeviceAdminPin("");
    setHasPin(false);
    setVerifyPinInput("");
    toast.success("Custom PIN hata diya gaya.");
  };

  const executeProtectedAction = async () => {
    if (!pendingAdminAction) return;
    const ok = await checkAdminPin(verifyPinInput);
    if (!ok) return;

    if (pendingAdminAction === "temp_unlock") {
      unlockAndroidProtectionTemporarily(120);
      toast.success("2 minute ke liye Settings/Uninstall Lock pause ho gaya!");
    } else if (pendingAdminAction === "disable_accessibility_lock") {
      setAndroidAccessibilityGuardLocked(false);
      toast.success("Accessibility Guard Lock band kar diya gaya.");
    } else if (pendingAdminAction === "deactivate_admin") {
      const res = deactivateAndroidDeviceAdmin();
      if (res) {
        toast.success("Device Admin band kar diya gaya.");
      } else {
        toast.error("Settings → Device Admin Apps se deactivate karein.");
      }
    }

    setPendingAdminAction(null);
    setVerifyPinInput("");
    refreshStatus();
  };

  const handleToggleHardUninstallBlock = () => {
    if (!status.isDeviceOwner) {
      toast.info("100% Hardware Lock ke liye niche diya gaya Device Owner setup zaroori hai.");
      return;
    }
    const nextState = !status.isUninstallBlocked;
    const ok = setAndroidUninstallBlocked(nextState);
    if (ok) {
      toast.success(
        nextState
          ? "100% Uninstall Lock ON! Ab Settings se bhi app uninstall nahi hoga."
          : "Uninstall Lock OFF kar diya gaya."
      );
      refreshStatus();
    } else {
      toast.error("Uninstall block change nahi ho paya.");
    }
  };

  const handleCopyAdb = async () => {
    try {
      await navigator.clipboard.writeText(status.adbDeviceOwnerCommand);
      toast.success("ADB command copy ho gaya!");
    } catch {
      toast.info(status.adbDeviceOwnerCommand);
    }
  };

  const isTempUnlocked = status.tempUnlockRemainingSec > 0;
  const isFullNoPcProtected =
    status.isAdminActive &&
    status.isAccessibilityGuardEnabled &&
    status.isAccessibilityGuardLocked &&
    !isTempUnlocked;

  const protectionBadge = status.isUninstallBlocked
    ? {
        bg: "bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
        icon: <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
        title: "100% OS Uninstall Locked (Device Owner Active)",
        desc: "Ye app OS-level par permanently locked hai — bina Admin ke Settings se bhi Uninstall nahi ho sakta.",
      }
    : isTempUnlocked
    ? {
        bg: "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300",
        icon: <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
        title: `Admin Unlock Active (${status.tempUnlockRemainingSec}s baaki)`,
        desc: "Abhi 2-minute ke liye Settings aur Uninstall Guard paused hai taaki Admin kaam kar sake.",
      }
    : isFullNoPcProtected
    ? {
        bg: "bg-emerald-600/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
        icon: <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
        title: "Full Uninstall Protection ON (Device Admin + Accessibility Guard)",
        desc: "Bina computer ke Regain app jaisi double suraksha! Uninstall, Force Stop, Device Admin & Accessibility hatana sab blocked hai.",
      }
    : status.isAccessibilityGuardEnabled && status.isAccessibilityGuardLocked
    ? {
        bg: "bg-blue-600/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
        icon: <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: "Accessibility Uninstall Guard Active (Regain Mode)",
        desc: "Uninstall dialog, App Info aur Accessibility off karne ki koshish turant block hogi. Aur mazboot karne ke liye Device Admin bhi ON karein.",
      }
    : status.isAdminActive
    ? {
        bg: "bg-blue-600/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
        icon: <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
        title: "Device Admin Active — Direct Uninstall Blocked",
        desc: "Direct Uninstall band hai. Regain app ki tarah Settings/Admin page bhi lock karne ke liye Accessibility Guard ON karein.",
      }
    : {
        bg: "bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300",
        icon: <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
        title: status.isNativeApp
          ? "Uninstall Protection Band Hai (Inactive)"
          : "Browser Preview Mode (Android APK Required)",
        desc: status.isNativeApp
          ? "Bina computer ke Regain app jaisi suraksha ke liye niche 'Accessibility Guard' aur 'Device Admin' dono ON karein."
          : "Device Admin aur Accessibility Uninstall Guard SCHOOL+ Android APK ke andar kaam karte hain.",
      };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-5 py-4 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base truncate">
                App Uninstall Lock (Device Admin + Accessibility)
              </h3>
              <p className="text-[11px] text-blue-200 truncate">
                Regain App jaisi Double Security — Bina PC ke Uninstall Rokein
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={refreshStatus}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Status Refresh karein"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Live Status Banner */}
          <div className={`rounded-2xl border p-4 flex items-start gap-3 ${protectionBadge.bg}`}>
            <div className="mt-0.5 shrink-0">{protectionBadge.icon}</div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs sm:text-sm font-black">{protectionBadge.title}</p>
              <p className="text-[11px] sm:text-xs leading-relaxed opacity-90">
                {protectionBadge.desc}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded-full bg-white/60 dark:bg-slate-900/60">
                  APK: {status.isNativeApp ? "Yes" : "Browser"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/60 dark:bg-slate-900/60">
                  Accessibility Guard:{" "}
                  {status.isAccessibilityGuardEnabled
                    ? status.isAccessibilityGuardLocked
                      ? "ON + Locked ✓"
                      : "ON (Paused)"
                    : "OFF"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/60 dark:bg-slate-900/60">
                  Device Admin: {status.isAdminActive ? "ON ✓" : "OFF"}
                </span>
                {status.isDeviceOwner && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    Device Owner ✓
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Step-by-Step No-PC Double Shield Buttons */}
          <div className="space-y-2.5">
            {/* Layer 1: Accessibility Guard (Like Regain App) */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🛡️ Step 1: Accessibility Uninstall Guard (Regain Jaisa)</span>
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Bina computer ke Uninstall, Force Stop, App Info aur Device Admin band karne wali screen ko turant Back kar deta hai.
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${
                    status.isAccessibilityGuardEnabled
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {status.isAccessibilityGuardEnabled ? "ACTIVE ✓" : "OFF"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {!status.isAccessibilityGuardEnabled ? (
                  <button
                    type="button"
                    onClick={handleEnableAccessibilityGuard}
                    className="sm:col-span-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Accessibility Settings खोलें → SCHOOL+ ON करें</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (isTempUnlocked) {
                          unlockAndroidProtectionTemporarily(0);
                          toast.success("Lock turant wapas chalu ho gaya!");
                          refreshStatus();
                        } else if (!status.isAccessibilityGuardLocked) {
                          setAndroidAccessibilityGuardLocked(true);
                          toast.success("Accessibility Guard Lock wapas ON ho gaya!");
                          refreshStatus();
                        } else {
                          setPendingAdminAction("temp_unlock");
                        }
                      }}
                      className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition ${
                        !status.isAccessibilityGuardLocked || isTempUnlocked
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                          : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                      }`}
                    >
                      {isTempUnlocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lock Wapas ON ({status.tempUnlockRemainingSec}s)</span>
                        </>
                      ) : !status.isAccessibilityGuardLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Guard Lock Re-Enable करें</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>2-Min Admin Unlock (PIN)</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={openAndroidAccessibilityGuardSettings}
                      className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Accessibility Settings</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Layer 2: Device Admin Protection */}
            <div className="rounded-2xl border border-blue-200 dark:border-blue-800/70 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">
                    🔒 Step 2: Android Device Admin (Direct Uninstall Block)
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Home Screen, Play Store aur Launcher se drag-uninstall ko OS level par rokta hai.
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${
                    status.isAdminActive
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {status.isAdminActive ? "ACTIVE ✓" : "OFF"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {!status.isAdminActive ? (
                  <button
                    type="button"
                    onClick={handleActivateAdmin}
                    className="sm:col-span-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>1-Click Device Admin चालू करें</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setPendingAdminAction("deactivate_admin")}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Device Admin बंद करें</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!lockAndroidDeviceScreen()) {
                          toast.info("Device Admin APK me active hone par screen turant lock hogi.");
                        }
                      }}
                      className="py-2 px-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Screen Lock Test</span>
                    </button>
                  </>
                )}

                {status.isDeviceOwner && (
                  <button
                    type="button"
                    onClick={handleToggleHardUninstallBlock}
                    className={`sm:col-span-2 py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer ${
                      status.isUninstallBlocked
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {status.isUninstallBlocked
                        ? "100% OS Uninstall Lock ON है (Tap to Unlock)"
                        : "100% OS Uninstall Lock ON करें (Device Owner)"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Admin Security PIN & Settings Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowPinSetup((p) => !p)}
                className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{hasPin ? "Admin PIN बदलें (Set ✓)" : "Admin Security PIN सेट करें"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!openAndroidDeviceAdminSettings()) {
                    toast.info("Phone Settings → Security → Device Admin Apps me manage karein.");
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Device Admin Settings</span>
              </button>
            </div>
          </div>

          {/* PIN Verification Box for Unlock / Deactivate */}
          {pendingAdminAction && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2.5">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
                {requiresPinOrSchoolCode
                  ? hasPin
                    ? "Confirm karne ke liye Admin Security PIN daalein:"
                    : "Confirm karne ke liye School Security Lock Code daalein:"
                  : pendingAdminAction === "temp_unlock"
                  ? "Kya aap 2 minute ke liye Accessibility Uninstall Guard pause karna chahte hain?"
                  : "Kya aap Device Admin band karna chahte hain?"}
              </p>
              <div className="flex items-center gap-2">
                {requiresPinOrSchoolCode && (
                  <input
                    type="password"
                    inputMode="numeric"
                    value={verifyPinInput}
                    onChange={(e) => setVerifyPinInput(e.target.value)}
                    placeholder="Enter PIN / Code"
                    className="flex-1 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                )}
                <button
                  type="button"
                  onClick={executeProtectedAction}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingAdminAction(null);
                    setVerifyPinInput("");
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Security PIN Setup Box */}
          {showPinSetup && (
            <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2.5">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Guard Unlock ya Device Admin band karne ke liye apna PIN set karein (Recommend: zaroor set karein):
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Naya 4-6 digit PIN"
                  className="flex-1 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleSavePin}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Save PIN
                </button>
                {hasPin && (
                  <button
                    type="button"
                    onClick={handleClearPin}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Optional Level 3: ADB Device Owner Info */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>Kaise Kaam Karta Hai?</span>
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>Bina Computer (Regain Style):</strong> Upar <strong>Step 1 (Accessibility Guard)</strong> aur <strong>Step 2 (Device Admin)</strong> dono ON kar dein aur apna <strong>Admin PIN</strong> set kar lein. Ab koi bhi Uninstall, App Info, Device Admin ya Accessibility off karne jayega to screen turant Back ho jayegi!
            </p>
            <details className="text-[11px] text-slate-600 dark:text-slate-300 pt-1">
              <summary className="font-black text-indigo-700 dark:text-indigo-300 cursor-pointer flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                <span>Optional Step 3: School Kiosk ADB Device Owner Command</span>
              </summary>
              <div className="mt-2 space-y-2">
                <p>
                  Dedicated school kiosk devices par OS-level hard lock ke liye (reset phone / bina Gmail ke) PC se chalayein:
                </p>
                <div className="flex items-center gap-2 bg-slate-950 text-emerald-300 px-3 py-2 rounded-xl font-mono text-[10px] overflow-x-auto">
                  <code className="flex-1 whitespace-nowrap">
                    {status.adbDeviceOwnerCommand}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyAdb}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer"
                    title="Copy command"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};
