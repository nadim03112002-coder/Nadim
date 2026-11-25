import React from "react";

interface DevelopedByCreditProps {
  tone?: "dark" | "light" | "auto";
  className?: string;
}

const CREDIT_PREFIX = "DEVELOPED BY".split("");
const CREDIT_AUTHOR = "NADIM ANWAR".split("");

export const DevelopedByCredit: React.FC<DevelopedByCreditProps> = ({
  tone = "auto",
  className = "",
}) => {
  const dividerClass =
    tone === "dark"
      ? "via-amber-400/75"
      : tone === "light"
      ? "via-amber-500/70"
      : "via-amber-500/70 dark:via-amber-400/75";

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

  return (
    <div
      className={`mt-5 flex flex-col items-center text-center select-none ${className}`}
    >
      <style>{`
        @keyframes spCreditLetterIn {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.86);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spCreditHairline {
          0% { opacity: 0; transform: scaleX(0); }
          100% { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
      <div
        className={`w-20 h-[1px] mb-2 bg-gradient-to-r from-transparent ${dividerClass} to-transparent origin-center`}
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
            className="inline-block"
            style={{
              width: ch === " " ? "0.45em" : undefined,
              opacity: 0,
              animation: `spCreditLetterIn 180ms ease-out ${100 + idx * 28}ms forwards`,
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
            className={`inline-block ${idx < 5 ? firstAuthorClass : secondAuthorClass}`}
            style={{
              width: ch === " " ? "0.45em" : undefined,
              opacity: 0,
              animation: `spCreditLetterIn 210ms cubic-bezier(0.22, 1, 0.36, 1) ${380 + idx * 45}ms forwards`,
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
