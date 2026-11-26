import React, { useMemo, useState } from "react";
import { resolveActiveSchoolBrand } from "../../utils/activeSchoolBrand";

interface DevelopedByCreditProps {
  tone?: "dark" | "light" | "auto";
  className?: string;
  schoolId?: string;
  schoolName?: string;
  schoolLogoUrl?: string;
  hideSchool?: boolean;
  compact?: boolean;
}

const CREDIT_PREFIX = "DEVELOPED BY".split("");
const CREDIT_AUTHOR = "NADIM ANWAR".split("");

export const DevelopedByCredit: React.FC<DevelopedByCreditProps> = ({
  tone = "auto",
  className = "",
  schoolId,
  schoolName,
  schoolLogoUrl,
  hideSchool = false,
  compact = false,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);

  const brand = useMemo(
    () =>
      hideSchool
        ? null
        : resolveActiveSchoolBrand({ schoolId, schoolName, schoolLogoUrl }),
    [hideSchool, schoolId, schoolName, schoolLogoUrl]
  );

  const schoolWords = useMemo(() => {
    if (!brand?.name) return [];
    return brand.name.split(/\s+/).filter(Boolean).slice(0, 8);
  }, [brand?.name]);

  const dividerClass =
    tone === "dark"
      ? "via-amber-400/75"
      : tone === "light"
      ? "via-amber-500/75"
      : "via-amber-500/75 dark:via-amber-400/75";

  const schoolNameClass =
    tone === "dark"
      ? "text-white drop-shadow-[0_2px_14px_rgba(251,191,36,0.22)]"
      : tone === "light"
      ? "text-slate-900"
      : "text-slate-900 dark:text-white dark:drop-shadow-[0_2px_14px_rgba(251,191,36,0.22)]";

  const schoolKickerClass =
    tone === "dark"
      ? "text-sky-300/85"
      : tone === "light"
      ? "text-emerald-700"
      : "text-emerald-700 dark:text-sky-300/85";

  const labelClass =
    tone === "dark"
      ? "text-slate-400"
      : tone === "light"
      ? "text-slate-500"
      : "text-slate-500 dark:text-slate-400";

  const firstAuthorClass =
    tone === "dark"
      ? "text-slate-100 drop-shadow-[0_2px_10px_rgba(255,255,255,0.22)]"
      : tone === "light"
      ? "text-slate-900"
      : "text-slate-900 dark:text-slate-100 dark:drop-shadow-[0_2px_10px_rgba(255,255,255,0.22)]";

  const secondAuthorClass =
    tone === "dark"
      ? "text-amber-300 drop-shadow-[0_2px_12px_rgba(251,191,36,0.35)]"
      : tone === "light"
      ? "text-amber-600"
      : "text-amber-600 dark:text-amber-300 dark:drop-shadow-[0_2px_12px_rgba(251,191,36,0.35)]";

  const schoolWrapClass =
    tone === "dark"
      ? "border-white/10 bg-white/[0.04]"
      : tone === "light"
      ? "border-slate-200/80 bg-white/75"
      : "border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-white/[0.04]";

  return (
    <div
      className={`${compact ? "mt-3" : "mt-5"} flex flex-col items-center text-center select-none ${className}`}
    >
      <style>{`
        @keyframes spCreditLetterIn {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.88);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spSchoolWordIn {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
            filter: blur(2px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
        }
        @keyframes spCreditHairline {
          0% { opacity: 0; transform: scaleX(0); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-credit-anim {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }
        }
      `}</style>

      {!hideSchool && brand?.name && (
        <div
          className={`mb-3 px-4 py-2 rounded-2xl border backdrop-blur-sm max-w-[min(90vw,22rem)] flex items-center justify-center gap-2.5 shadow-xs sp-credit-anim ${schoolWrapClass}`}
          style={{
            opacity: 0,
            animation: "spSchoolWordIn 320ms cubic-bezier(0.22, 1, 0.36, 1) 40ms forwards",
          }}
        >
          {brand.hasCustomLogo && !logoFailed && (
            <img
              src={brand.logoUrl}
              alt={brand.name}
              onError={() => setLogoFailed(true)}
              className="w-6 h-6 rounded-lg object-contain bg-white/95 p-0.5 border border-amber-400/35 shrink-0"
            />
          )}
          <div className="min-w-0 text-center">
            <div className={`text-[9px] font-bold tracking-[0.22em] uppercase ${schoolKickerClass}`}>
              School Campus
            </div>
            <div
              className={`text-xs sm:text-sm font-extrabold tracking-wide leading-snug ${schoolNameClass}`}
              style={{ textWrap: "balance" }}
            >
              {schoolWords.map((word, idx) => (
                <span
                  key={`sw-${idx}`}
                  className="inline-block mr-1 last:mr-0 sp-credit-anim"
                  style={{
                    opacity: 0,
                    animation: `spSchoolWordIn 280ms cubic-bezier(0.22, 1, 0.36, 1) ${90 + idx * 55}ms forwards`,
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        className={`w-24 h-[1px] mb-2 bg-gradient-to-r from-transparent ${dividerClass} to-transparent origin-center sp-credit-anim`}
        style={{
          opacity: 0,
          animation: "spCreditHairline 280ms ease-out 60ms forwards",
        }}
      />
      <div
        className={`flex items-center justify-center text-[10px] font-bold tracking-[0.34em] uppercase ${labelClass}`}
      >
        {CREDIT_PREFIX.map((ch, idx) => (
          <span
            key={`dcp-${idx}`}
            className="inline-block sp-credit-anim"
            style={{
              width: ch === " " ? "0.45em" : undefined,
              opacity: 0,
              animation: `spCreditLetterIn 180ms ease-out ${110 + idx * 26}ms forwards`,
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-center text-xs sm:text-sm font-black tracking-[0.24em] uppercase">
        {CREDIT_AUTHOR.map((ch, idx) => (
          <span
            key={`dca-${idx}`}
            className={`inline-block sp-credit-anim ${idx < 5 ? firstAuthorClass : secondAuthorClass}`}
            style={{
              width: ch === " " ? "0.45em" : undefined,
              opacity: 0,
              animation: `spCreditLetterIn 210ms cubic-bezier(0.22, 1, 0.36, 1) ${360 + idx * 42}ms forwards`,
            }}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DevelopedByCredit;
