// @ts-nocheck
import React, { useState, useRef, useEffect } from "react";
import { Briefcase } from "lucide-react";
import {
  filterOccupationSuggestions,
  rememberOccupation,
  toUpperFormText,
} from "../../utils/schoolFormUtils";

interface Props {
  value: string;
  onChange: (val: string) => void;
  schoolId?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export const OccupationAutocomplete: React.FC<Props> = ({
  value,
  onChange,
  schoolId,
  placeholder = "e.g., FARMER / TEACHER / BUSINESS",
  className = "",
  required = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const upperVal = toUpperFormText(value || "");
  const suggestions = filterOccupationSuggestions(upperVal, schoolId, 8);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const pickSuggestion = (item: string) => {
    const norm = toUpperFormText(item);
    onChange(norm);
    rememberOccupation(norm, schoolId);
    setOpen(false);
    setHighlightIdx(-1);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={upperVal}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          if (upperVal.trim().length >= 2) setOpen(true);
        }}
        onBlur={() => {
          if (upperVal.trim().length >= 2) {
            rememberOccupation(upperVal, schoolId);
          }
          setTimeout(() => setOpen(false), 150);
        }}
        onChange={(e) => {
          const next = toUpperFormText(e.target.value);
          onChange(next);
          setHighlightIdx(-1);
          setOpen(next.trim().length >= 2);
        }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIdx((prev) => (prev + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIdx((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
          } else if (e.key === "Enter" && highlightIdx >= 0 && suggestions[highlightIdx]) {
            e.preventDefault();
            pickSuggestion(suggestions[highlightIdx]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`uppercase ${className}`}
      />

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          <div className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-indigo-500" />
            <span>Occupation Suggestions</span>
          </div>
          {suggestions.map((item, idx) => (
            <button
              key={item}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pickSuggestion(item);
              }}
              className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                idx === highlightIdx
                  ? "bg-indigo-600 text-white"
                  : "text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700"
              }`}
            >
              <span>{item}</span>
              <span className={`text-[9px] font-black ${idx === highlightIdx ? "text-indigo-100" : "text-slate-400"}`}>
                SELECT
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OccupationAutocomplete;
