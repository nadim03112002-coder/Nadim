import React, { useEffect, useState } from "react";
import { Globe, Info, Sparkles, X } from "lucide-react";
import { getScreenFeatureGuide } from "../../utils/screenInfoCatalog";
import { useAppLang } from "../../utils/appLang";

interface ScreenInfoGuideButtonProps {
  portal: "admin" | "teacher" | "accountant" | "student" | "super_admin" | "driver";
  screenKey: string;
  tone?: "white" | "black" | "current" | "auto";
  className?: string;
}

export const ScreenInfoGuideButton: React.FC<ScreenInfoGuideButtonProps> = ({
  portal,
  screenKey,
  tone = "auto",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useAppLang();

  useEffect(() => {
    setOpen(false);
  }, [portal, screenKey]);

  useEffect(() => {
    const onOpenGuide = () => setOpen(true);
    window.addEventListener("nst-open-screen-guide", onOpenGuide);
    return () => window.removeEventListener("nst-open-screen-guide", onOpenGuide);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const guide = getScreenFeatureGuide(portal, screenKey, lang);
  const isHi = lang === "HI";

  const btnStyle =
    tone === "white"
      ? "bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200"
      : tone === "black"
      ? "bg-white/10 hover:bg-white/15 text-sky-300 border-white/15"
      : tone === "current"
      ? "bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-400/35"
      : "bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-400/35";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-[36px] sm:min-h-[36px] p-1.5 rounded-xl border transition cursor-pointer active:scale-95 shrink-0 ${btnStyle} ${className}`}
        title={isHi ? "इस पेज की जानकारी देखें (i)" : "View guide for this page (i)"}
        aria-label={`${guide.title} ${isHi ? "जानकारी गाइड" : "info guide"}`}
      >
        <Info className="w-4 h-4 shrink-0" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[130] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={guide.title}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#0b1326] text-slate-900 dark:text-white shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-sky-50 via-indigo-50/70 to-white dark:from-[#0f1d3d] dark:via-[#111c3a] dark:to-[#0b1326] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold tracking-[0.14em] text-sky-600 dark:text-sky-400">
                    {isHi ? "पेज गाइड · इस स्क्रीन पर क्या है" : "Page Guide · What is on this screen"}
                  </p>
                  <h3 className="text-base sm:text-lg font-extrabold leading-snug mt-0.5 text-slate-900 dark:text-white">
                    {guide.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {guide.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Inline Hindi / English Switch inside Screen Guide */}
                <div
                  className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5"
                  role="group"
                  aria-label="Guide Language"
                >
                  <button
                    type="button"
                    onClick={() => setLang("HI")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                      lang === "HI"
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    हिंदी
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("EN")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                      lang === "EN"
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    EN
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
                  aria-label={isHi ? "पेज गाइड बंद करें" : "Close Page Guide"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body: All Items on This Screen */}
            <div className="p-4 sm:p-5 space-y-2.5 overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold tracking-wide text-slate-500 dark:text-slate-400">
                  {isHi
                    ? `इस पेज पर उपलब्ध सुविधाएँ और बटन (${guide.items.length})`
                    : `Features & Buttons on This Page (${guide.items.length})`}
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                  <Globe className="w-3 h-3" />
                  <span>{isHi ? "हिंदी" : "English"}</span>
                </span>
              </div>

              <div className="divide-y divide-slate-200/80 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#101a34]/70 overflow-hidden">
                {guide.items.map((item, idx) => (
                  <div key={`${item.name}-${idx}`} className="p-3.5 flex items-start gap-3">
                    <span className="w-6 h-6 rounded-lg bg-sky-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {guide.tip && (
                <div className="rounded-xl border border-amber-300/70 dark:border-amber-500/35 bg-amber-50/80 dark:bg-amber-950/35 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong className="font-bold">{isHi ? "उपयोगी सुझाव:" : "Quick Tip:"}</strong>{" "}
                    {guide.tip}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080f21]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-extrabold cursor-pointer transition"
              >
                {isHi ? "समझ आ गया ✓" : "Got It ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScreenInfoGuideButton;
