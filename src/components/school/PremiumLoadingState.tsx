import React, { useEffect, useMemo, useState } from "react";
import { resolveActiveSchoolBrand } from "../../utils/activeSchoolBrand";

interface TypewriterSchoolTitleProps {
  text: string;
  className?: string;
  caretClassName?: string;
  loop?: boolean;
  onTypingComplete?: () => void;
}

export const TypewriterSchoolTitle: React.FC<TypewriterSchoolTitleProps> = ({
  text,
  className = "",
  caretClassName = "bg-amber-400",
  loop = false,
  onTypingComplete,
}) => {
  const cleanText = useMemo(() => text.trim(), [text]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const onCompleteRef = React.useRef(onTypingComplete);
  onCompleteRef.current = onTypingComplete;

  useEffect(() => {
    if (!cleanText) {
      onCompleteRef.current?.();
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) {
      setVisibleCount(cleanText.length);
      setIsFadingOut(false);
      setIsDone(true);
      onCompleteRef.current?.();
      return;
    }

    let cancelled = false;
    let timerId: number | undefined;
    // Target ~550-650ms total typing so full school name finishes well before fade-out
    const charStepMs = Math.max(15, Math.min(28, Math.floor(600 / Math.max(cleanText.length, 8))));

    const runCycle = (index: number) => {
      if (cancelled) return;
      if (index <= cleanText.length) {
        setIsFadingOut(false);
        setVisibleCount(index);
        if (index < cleanText.length) {
          timerId = window.setTimeout(() => runCycle(index + 1), charStepMs);
        } else if (loop) {
          onCompleteRef.current?.();
          timerId = window.setTimeout(() => {
            if (cancelled) return;
            setIsFadingOut(true);
            timerId = window.setTimeout(() => {
              if (cancelled) return;
              setVisibleCount(0);
              setIsFadingOut(false);
              timerId = window.setTimeout(() => runCycle(1), 160);
            }, 320);
          }, 1100);
        } else {
          timerId = window.setTimeout(() => {
            if (!cancelled) {
              setIsDone(true);
              onCompleteRef.current?.();
            }
          }, 220);
        }
      }
    };

    setVisibleCount(0);
    setIsFadingOut(false);
    setIsDone(false);
    timerId = window.setTimeout(() => runCycle(1), 40);

    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [cleanText, loop]);

  if (!cleanText) return null;

  const typed = cleanText.slice(0, visibleCount);

  return (
    <span
      className={`inline-flex items-center justify-center flex-wrap transition-all duration-300 ease-out ${
        isFadingOut ? "opacity-0 -translate-y-1" : "opacity-100 translate-y-0"
      } ${className}`}
      style={{ textWrap: "balance" }}
      aria-label={cleanText}
    >
      <span>{typed || "\u00A0"}</span>
      {!isDone && (
        <span
          aria-hidden="true"
          className={`inline-block w-[2px] h-[0.95em] ml-1 rounded-full animate-pulse align-middle ${caretClassName}`}
        />
      )}
    </span>
  );
};

interface PremiumLoadingStateProps {
  title?: string;
  subtitle?: string;
  tone?: "dark" | "light" | "auto";
  variant?: "fullscreen" | "section" | "card";
  accent?: "amber" | "emerald" | "sky";
  schoolId?: string;
  schoolName?: string;
  schoolLogoUrl?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PremiumLoadingState: React.FC<PremiumLoadingStateProps> = ({
  title = "Loading...",
  subtitle: _subtitle,
  tone = "auto",
  variant = "section",
  accent = "amber",
  schoolId,
  schoolName,
  schoolLogoUrl,
  icon,
  actions,
  className = "",
}) => {
  const [logoFailed, setLogoFailed] = useState(false);

  const brand = useMemo(
    () => resolveActiveSchoolBrand({ schoolId, schoolName, schoolLogoUrl }),
    [schoolId, schoolName, schoolLogoUrl]
  );

  const isCard = variant === "card";
  const isFullscreen = variant === "fullscreen";

  const hasCustomBg = /\bbg-/.test(className);
  const surfaceClass =
    tone === "dark"
      ? `nst-isolated-modal ${hasCustomBg ? "" : "bg-[#070B14]"} text-slate-100`
      : tone === "light"
      ? `${hasCustomBg ? "" : "bg-[#eef2f7]"} text-slate-900`
      : "bg-transparent text-slate-900 dark:text-slate-100";

  const accentGradient =
    accent === "emerald"
      ? "from-emerald-400 via-teal-300 to-emerald-500"
      : accent === "sky"
      ? "from-sky-400 via-cyan-300 to-sky-500"
      : "from-amber-300 via-amber-400 to-amber-500";

  const schoolHeadingClass =
    tone === "dark"
      ? "text-white"
      : tone === "light"
      ? "text-slate-900"
      : "text-slate-900 dark:text-white";

  const caretClass =
    accent === "emerald"
      ? "bg-emerald-400"
      : accent === "sky"
      ? "bg-sky-400"
      : tone === "light"
      ? "bg-amber-600"
      : "bg-amber-400";

  const statusClass =
    tone === "dark"
      ? "text-slate-400"
      : tone === "light"
      ? "text-slate-500"
      : "text-slate-500 dark:text-slate-400";

  const auraBg =
    tone === "light"
      ? "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 68%)"
      : "radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 68%)";

  const showCustomCrest = brand.hasCustomLogo && !logoFailed;

  const containerSizeClass = isFullscreen
    ? "min-h-screen min-h-[100dvh] w-full flex-1 px-6 py-10"
    : isCard
    ? "w-full py-8 px-4"
    : "min-h-[calc(100dvh-4.5rem)] w-full flex-1 px-6 py-10";

  const displaySchoolName = brand.name || (isFullscreen ? "SCHOOL+" : "");

  return (
    <div
      className={`relative flex flex-col items-center justify-center text-center overflow-hidden select-none ${containerSizeClass} ${surfaceClass} ${className}`}
    >
      <style>{`
        @keyframes spSweepBar {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(260%); }
        }
        @keyframes spCrestBreath {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.015); }
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-prem-sweep,
          .sp-crest-float {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* Soft centered logo halo — uniform full-screen background */}
      {!isCard && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full pointer-events-none opacity-60"
          style={{ background: auraBg, filter: "blur(48px)" }}
        />
      )}

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Clean Flagship Crest / Logo — Zero Spinning Circles */}
        <div
          className={`relative flex items-center justify-center sp-crest-float ${
            isCard ? "mb-4" : isFullscreen ? "mb-6" : "mb-5"
          }`}
          style={{ animation: "spCrestBreath 4s ease-in-out infinite" }}
        >
          {icon ? (
            <div
              className={`relative flex items-center justify-center ${
                isCard ? "w-14 h-14 rounded-2xl" : "w-20 h-20 rounded-3xl"
              } bg-slate-900/95 dark:bg-white/[0.06] border border-slate-200/20 dark:border-white/15 shadow-xl`}
            >
              {icon}
            </div>
          ) : showCustomCrest ? (
            <div
              className={`relative flex items-center justify-center bg-white border border-slate-200/80 dark:border-white/15 ${
                isCard
                  ? "w-16 h-16 rounded-2xl p-1.5 shadow-md"
                  : isFullscreen
                  ? "w-36 h-36 sm:w-44 sm:h-44 rounded-[28px] p-3 shadow-[0_24px_56px_rgba(0,0,0,0.35)]"
                  : "w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
              }`}
            >
              <img
                src={brand.logoUrl}
                alt={brand.name || "School Crest"}
                onError={() => setLogoFailed(true)}
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>
          ) : (
            <img
              src="/branding/schoolplus-splash-logo.png?v=7"
              alt="SCHOOL+"
              width={512}
              height={512}
              className={`relative object-contain rounded-[22%] ${
                isCard
                  ? "w-16 h-16 drop-shadow-[0_10px_22px_rgba(15,23,42,0.25)]"
                  : isFullscreen
                  ? "w-40 h-40 sm:w-48 sm:h-48 drop-shadow-[0_28px_56px_rgba(0,0,0,0.5)]"
                  : "w-28 h-28 sm:w-36 sm:h-36 drop-shadow-[0_20px_42px_rgba(15,23,42,0.35)]"
              }`}
            />
          )}
        </div>

        {/* Looping Letter-by-Letter School Name */}
        {displaySchoolName && (
          <div
            className={`px-3 max-w-sm flex items-center justify-center ${
              isCard ? "min-h-[2.25rem] mb-2" : "min-h-[3.25rem] sm:min-h-[3.75rem] mb-3"
            }`}
          >
            <h3
              className={`${
                isCard
                  ? "text-sm sm:text-base"
                  : isFullscreen
                  ? "text-xl sm:text-2xl"
                  : "text-lg sm:text-xl"
              } font-extrabold tracking-wide leading-snug ${schoolHeadingClass}`}
            >
              <TypewriterSchoolTitle text={displaySchoolName} caretClassName={caretClass} />
            </h3>
          </div>
        )}

        {/* Minimal Sleek Progress Track */}
        <div
          className={`${
            isCard ? "w-36" : "w-52 sm:w-60"
          } h-[2.5px] rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden`}
        >
          <div
            className={`w-2/5 h-full rounded-full bg-gradient-to-r ${accentGradient} sp-prem-sweep`}
            style={{ animation: "spSweepBar 1.15s cubic-bezier(0.4, 0, 0.2, 1) infinite" }}
          />
        </div>

        {/* Single Quiet Action Caption */}
        {title && (
          <p className={`mt-3 text-xs font-medium tracking-wide ${statusClass}`}>
            {title}
          </p>
        )}

        {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};

export default PremiumLoadingState;
