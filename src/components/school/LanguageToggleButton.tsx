import React, { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { useAppLang, type AppLang } from "../../utils/appLang";

interface LanguageToggleButtonProps {
  tone?: "white" | "black" | "current" | "auto";
  compact?: boolean;
  className?: string;
}

export const LanguageToggleButton: React.FC<LanguageToggleButtonProps> = ({
  tone = "auto",
  compact = false,
  className = "",
}) => {
  const [lang, setLang] = useAppLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const btnStyle =
    tone === "white"
      ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
      : tone === "black"
      ? "bg-neutral-900 hover:bg-neutral-800 text-slate-100 border-neutral-700"
      : tone === "current"
      ? "bg-white/10 hover:bg-white/15 text-white border-white/15"
      : "bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-white/15";

  const choose = (next: AppLang) => {
    setLang(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex items-center justify-center gap-1.5 min-h-[36px] ${
          compact ? "px-2" : "px-2.5"
        } py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-95 whitespace-nowrap shrink-0 ${btnStyle}`}
        title={lang === "HI" ? "भाषा बदलें (हिंदी / English)" : "Switch Language (Hindi / English)"}
        aria-label={lang === "HI" ? "भाषा बदलें" : "Switch Language"}
        aria-expanded={open}
      >
        <Globe className="w-4 h-4 shrink-0 text-indigo-500 dark:text-sky-400" />
        <span className="tabular-nums">{lang === "HI" ? "हिंदी" : "EN"}</span>
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-2 w-52 rounded-2xl border shadow-xl z-[140] p-1.5 space-y-1 ${
            tone === "white"
              ? "bg-white border-slate-200 text-slate-900"
              : tone === "black"
              ? "bg-neutral-950 border-neutral-800 text-white"
              : "bg-white dark:bg-[#0b1326] border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          }`}
          role="menu"
          aria-label="Language options"
        >
          <div className="px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {lang === "HI" ? "ऐप की भाषा चुनें" : "Select App Language"}
          </div>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={lang === "HI"}
            onClick={() => choose("HI")}
            className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 text-xs font-bold transition cursor-pointer ${
              lang === "HI"
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-100 dark:hover:bg-slate-800/80"
            }`}
          >
            <div>
              <div className="leading-tight">हिंदी (Hindi)</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  lang === "HI" ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                सभी मेनू और गाइड हिंदी में
              </div>
            </div>
            {lang === "HI" && <Check className="w-4 h-4 shrink-0" />}
          </button>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={lang === "EN"}
            onClick={() => choose("EN")}
            className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 text-xs font-bold transition cursor-pointer ${
              lang === "EN"
                ? "bg-indigo-600 text-white"
                : "hover:bg-slate-100 dark:hover:bg-slate-800/80"
            }`}
          >
            <div>
              <div className="leading-tight">English Only</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  lang === "EN" ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                All menus &amp; guides in English
              </div>
            </div>
            {lang === "EN" && <Check className="w-4 h-4 shrink-0" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default LanguageToggleButton;
