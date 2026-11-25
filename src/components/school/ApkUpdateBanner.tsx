import React, { useEffect, useState } from "react";
import { Download, Sparkles, X } from "lucide-react";
import type { School } from "../../school-types";
import { getNativeAppVersionInfo, type NativeAppVersionInfo } from "../../utils/schoolCallerId";

interface ApkUpdateBannerProps {
  school?: School | null;
}

export const ApkUpdateBanner: React.FC<ApkUpdateBannerProps> = ({ school }) => {
  const [nativeVersion, setNativeVersion] = useState<NativeAppVersionInfo>(() =>
    getNativeAppVersionInfo()
  );
  const [dismissedCode, setDismissedCode] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("nst_dismissed_apk_version_code") || 0);
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    setNativeVersion(getNativeAppVersionInfo());
  }, []);

  const latestCode = Number(school?.latestApkVersionCode || 0);
  const downloadUrl = String(school?.erpAppUrl || "").trim();

  if (
    !nativeVersion.supported ||
    !nativeVersion.versionCode ||
    !latestCode ||
    latestCode <= nativeVersion.versionCode ||
    !downloadUrl ||
    dismissedCode === latestCode
  ) {
    return null;
  }

  const versionLabel = String(school?.latestApkVersionName || "").trim() || `v${latestCode}`;
  const notes = String(school?.apkUpdateNotes || "").trim();

  const handleDismiss = () => {
    try {
      localStorage.setItem("nst_dismissed_apk_version_code", String(latestCode));
    } catch {}
    setDismissedCode(latestCode);
  };

  return (
    <div className="rounded-2xl border border-emerald-300 dark:border-emerald-500/35 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/50 dark:via-slate-900 dark:to-slate-900 p-3.5 sm:p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                Naya update aa gaya hai, yahan se download karein ({versionLabel})
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                Installed: v{nativeVersion.versionName || nativeVersion.versionCode}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
              {notes || "Naye features aur behtar call alerts ke liye latest APK download karke install karein."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download APK</span>
          </a>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
            title="Is update ka alert chhupayein"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
