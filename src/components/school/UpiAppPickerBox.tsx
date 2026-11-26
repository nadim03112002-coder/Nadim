import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Clock, ExternalLink, Smartphone } from "lucide-react";
import {
  buildUpiQueryAndUri,
  getSavedWebDedicatedUpiApp,
  launchNativeUpiApp,
  NATIVE_DEDICATED_UPI_KEY,
  readInstalledNativeUpiApps,
  WEB_DEDICATED_UPI_KEY,
  WEB_UPI_APP_OPTIONS,
  type DetectedNativeUpiApp,
  type WebUpiAppId,
} from "../../utils/upiAppLauncher";
import { pickLang, type AppLang } from "../../utils/appLang";

export interface NativeUpiResultDetail {
  status: "SUCCESS" | "SUBMITTED" | "FAILED" | "RETURNED";
  txnRef?: string;
  approvalRefNo?: string;
  rawResponse?: string;
  returnedAt?: string;
}

interface UpiAppPickerBoxProps {
  upiId: string;
  schoolName?: string;
  amount: number;
  txnNote?: string;
  lang?: AppLang;
  onPayTriggered?: () => void;
  onPayReturned?: (detail: NativeUpiResultDetail) => void;
  footer?: React.ReactNode;
}

export const UpiAppPickerBox: React.FC<UpiAppPickerBoxProps> = ({
  upiId,
  schoolName,
  amount,
  txnNote,
  lang = "HI",
  onPayTriggered,
  onPayReturned,
  footer,
}) => {
  const t = (hi: string, en: string) => pickLang(lang, hi, en);
  const payableNow = Math.max(0, Math.round(Number(amount) || 0));

  const [hasNativeBridge, setHasNativeBridge] = useState(false);
  const [nativeUpiApps, setNativeUpiApps] = useState<DetectedNativeUpiApp[]>([]);
  const [dedicatedNativePkg, setDedicatedNativePkg] = useState("");
  const [dedicatedWebApp, setDedicatedWebApp] = useState<WebUpiAppId>(() =>
    getSavedWebDedicatedUpiApp()
  );
  const [nativeUpiResult, setNativeUpiResult] = useState<NativeUpiResultDetail | null>(null);
  const onPayReturnedRef = useRef(onPayReturned);
  onPayReturnedRef.current = onPayReturned;

  useEffect(() => {
    const info = readInstalledNativeUpiApps();
    setHasNativeBridge(info.hasBridge);
    setNativeUpiApps(info.apps);
    setDedicatedNativePkg(info.initialDedicatedPkg);
  }, [upiId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleNativeResult = (ev: Event) => {
      const detail = (ev as CustomEvent<NativeUpiResultDetail>)?.detail;
      if (!detail || !detail.status) return;
      setNativeUpiResult(detail);
      onPayReturnedRef.current?.(detail);
    };
    window.addEventListener("native-upi-result", handleNativeResult);
    return () => window.removeEventListener("native-upi-result", handleNativeResult);
  }, []);

  const { upiQuery, upiUri } = buildUpiQueryAndUri({
    upiId,
    schoolName,
    amount: payableNow,
    txnNote,
  });

  if (!upiQuery || !upiUri) {
    return null;
  }

  const activeNativeApp =
    nativeUpiApps.find((a) => a.packageName === dedicatedNativePkg) || nativeUpiApps[0] || null;

  const activeWebOption =
    dedicatedWebApp !== "auto"
      ? WEB_UPI_APP_OPTIONS.find((o) => o.id === dedicatedWebApp) || null
      : null;

  const primaryWebPayUri = activeWebOption
    ? `${activeWebOption.schemePrefix}${upiQuery}`
    : upiUri;

  const handleLaunchNative = (pkgName?: string) => {
    if (pkgName) {
      setDedicatedNativePkg(pkgName);
      try {
        localStorage.setItem(NATIVE_DEDICATED_UPI_KEY, pkgName);
      } catch {}
    }
    setNativeUpiResult(null);
    onPayTriggered?.();
    launchNativeUpiApp(upiUri, pkgName);
  };

  const handleSelectWebApp = (appId: WebUpiAppId) => {
    setDedicatedWebApp(appId);
    try {
      localStorage.setItem(WEB_DEDICATED_UPI_KEY, appId);
    } catch {}
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-3">
      {hasNativeBridge && nativeUpiApps.length > 0 ? (
        <>
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {t(
                  `${nativeUpiApps.length} पेमेंट ऐप फ़ोन में मिले`,
                  `${nativeUpiApps.length} payment app${nativeUpiApps.length > 1 ? "s" : ""} detected`
                )}
              </span>
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              {t("ऑटो-डिटेक्टेड", "Auto-detected")}
            </span>
          </div>

          {activeNativeApp && (
            <button
              type="button"
              onClick={() => handleLaunchNative(activeNativeApp.packageName)}
              className="w-full min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition shadow-sm cursor-pointer tabular-nums"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {t(
                  `Pay ₹${payableNow.toLocaleString("en-IN")} · ${activeNativeApp.appName} से पे करें`,
                  `Pay ₹${payableNow.toLocaleString("en-IN")} via ${activeNativeApp.appName}`
                )}
              </span>
            </button>
          )}

          {nativeUpiApps.length > 1 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                {t("फ़ोन में मौजूद अन्य ऐप चुनें (डेडिकेट करें):", "Switch detected app on this phone:")}
              </span>
              <div className="flex flex-wrap gap-2">
                {nativeUpiApps.map((app) => {
                  const isDedicated = activeNativeApp?.packageName === app.packageName;
                  return (
                    <button
                      key={app.packageName}
                      type="button"
                      onClick={() => handleLaunchNative(app.packageName)}
                      className={`min-h-[44px] px-3 rounded-xl border text-[11px] font-black inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        isDedicated
                          ? "border-emerald-600 bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 dark:border-emerald-500"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-emerald-400"
                      }`}
                    >
                      {isDedicated && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span>{app.appName}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleLaunchNative("")}
                  className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[11px] font-bold inline-flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  {t("अन्य UPI ऐप", "Other UPI App")}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {activeWebOption
                  ? t(`डेडिकेटेड ऐप: ${activeWebOption.label}`, `Dedicated App: ${activeWebOption.label}`)
                  : t("फ़ोन के UPI ऐप से ऑटो पेमेंट", "Auto-detect Phone UPI App")}
              </span>
            </span>
            {activeWebOption && (
              <button
                type="button"
                onClick={() => handleSelectWebApp("auto")}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                {t("ऑटो UPI रखें", "Reset to Auto")}
              </button>
            )}
          </div>

          <a
            href={primaryWebPayUri}
            onClick={() => {
              setNativeUpiResult(null);
              onPayTriggered?.();
            }}
            className="w-full min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition shadow-sm tabular-nums"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {activeWebOption
                ? t(
                    `Pay ₹${payableNow.toLocaleString("en-IN")} · ${activeWebOption.label} खोलें`,
                    `Pay ₹${payableNow.toLocaleString("en-IN")} via ${activeWebOption.label}`
                  )
                : t(
                    `Pay ₹${payableNow.toLocaleString("en-IN")} (फ़ोन UPI ऐप खोलें)`,
                    `Pay ₹${payableNow.toLocaleString("en-IN")} via Phone UPI App`
                  )}
            </span>
          </a>

          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
              {t("पसंदीदा पेमेंट ऐप डेडिकेट करें:", "Dedicate a preferred payment app:")}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEB_UPI_APP_OPTIONS.map((opt) => {
                const isDedicated = dedicatedWebApp === opt.id;
                return (
                  <a
                    key={opt.id}
                    href={`${opt.schemePrefix}${upiQuery}`}
                    onClick={() => {
                      handleSelectWebApp(opt.id);
                      setNativeUpiResult(null);
                      onPayTriggered?.();
                    }}
                    className={`min-h-[44px] px-2.5 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1 transition text-center whitespace-nowrap ${
                      isDedicated ? opt.activeClass : opt.idleClass
                    }`}
                  >
                    {isDedicated && <Check className="w-3 h-3 shrink-0" />}
                    <span>{opt.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </>
      )}

      {nativeUpiResult && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-[11px] font-bold flex items-start gap-2 ${
            nativeUpiResult.status === "SUCCESS" || nativeUpiResult.status === "SUBMITTED"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
              : nativeUpiResult.status === "FAILED"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200"
              : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
          }`}
        >
          {nativeUpiResult.status === "SUCCESS" || nativeUpiResult.status === "SUBMITTED" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : nativeUpiResult.status === "FAILED" ? (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="leading-snug">
              {nativeUpiResult.status === "SUCCESS"
                ? t(
                    "UPI पेमेंट सफल दिख रहा है! अब नीचे स्क्रीनशॉट अपलोड करके सबमिट करें।",
                    "UPI payment looks successful! Upload the screenshot below to submit."
                  )
                : nativeUpiResult.status === "SUBMITTED"
                ? t(
                    "UPI पेमेंट प्रोसेस में है — नीचे स्क्रीनशॉट अपलोड करके सबमिट करें।",
                    "UPI payment submitted — upload your screenshot below."
                  )
                : nativeUpiResult.status === "FAILED"
                ? t(
                    "UPI ऐप में पेमेंट असफल/रद्द दिख रहा है। यदि पैसा कटा हो तभी स्क्रीनशॉट अपलोड करें।",
                    "UPI payment reported as failed/cancelled. Only upload a screenshot if money was debited."
                  )
                : t(
                    "आप UPI ऐप से वापस आ गए हैं — पेमेंट हो गया हो तो नीचे स्क्रीनशॉट अपलोड करें।",
                    "Returned from UPI app — upload your payment screenshot below."
                  )}
            </p>
            {(nativeUpiResult.txnRef || nativeUpiResult.approvalRefNo) && (
              <p className="text-[10px] font-mono opacity-85 truncate">
                Ref: {nativeUpiResult.approvalRefNo || nativeUpiResult.txnRef}
              </p>
            )}
          </div>
        </div>
      )}

      {footer}
    </div>
  );
};
