import React from "react";
import { ArrowLeft, Crown, Lock, Sparkles } from "lucide-react";

interface EliteFeatureLockCardProps {
  title: string;
  description: string;
  highlights?: string[];
  onUpgrade?: () => void;
  onBack?: () => void;
  compact?: boolean;
}

export const EliteFeatureLockCard: React.FC<EliteFeatureLockCardProps> = ({
  title,
  description,
  highlights = [],
  onUpgrade,
  onBack,
  compact = false,
}) => {
  return (
    <div
      className={`mx-auto w-full ${
        compact ? "max-w-lg p-4 sm:p-5" : "max-w-xl my-6 p-5 sm:p-7"
      } rounded-2xl border border-amber-300/80 dark:border-amber-700/70 bg-white dark:bg-slate-900 shadow-sm space-y-4`}
    >
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300/70 dark:border-amber-700/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
            <Crown className="w-3.5 h-3.5 shrink-0" />
            <span>Elite Plan Exclusive Feature</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {highlights.length > 0 && (
        <ul className="space-y-1.5 pl-1 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-3">
          {highlights.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Wapas Jayein</span>
          </button>
        )}
        {onUpgrade && (
          <button
            type="button"
            onClick={onUpgrade}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition shadow-xs"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Elite Plan Upgrade Karein</span>
          </button>
        )}
      </div>
    </div>
  );
};
