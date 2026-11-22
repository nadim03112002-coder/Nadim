import React, { useState, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, ClipboardPaste, X, Sparkles } from "lucide-react";
import { normalizeMcqPaste, parseMCQText } from "../../utils/mcqParser";

export interface SchoolMcqEditorItem {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  topic?: string;
  statements?: string[];
  matchColumns?: any;
  passage?: string;
  questionType?: string;
}

interface Props {
  value: SchoolMcqEditorItem[];
  onChange: (items: SchoolMcqEditorItem[]) => void;
  accent?: "emerald" | "green" | "indigo" | "blue" | "amber";
  compact?: boolean;
}

const emptyMcq = (): SchoolMcqEditorItem => ({
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
  topic: "General",
});

function normalizeItem(item: any): SchoolMcqEditorItem {
  const opts = Array.isArray(item?.options) ? [...item.options] : ["", "", "", ""];
  while (opts.length < 4) opts.push("");
  return {
    id: item?.id,
    question: String(item?.question || ""),
    options: opts.slice(0, 4).map((o) => String(o || "")),
    correctAnswer: Number.isFinite(Number(item?.correctAnswer)) ? Number(item.correctAnswer) : 0,
    explanation: item?.explanation ? String(item.explanation) : "",
    topic: item?.topic ? String(item.topic) : "General",
    statements: Array.isArray(item?.statements) && item.statements.length > 0 ? item.statements : undefined,
    matchColumns: item?.matchColumns || undefined,
    passage: item?.passage ? String(item.passage) : undefined,
    questionType: item?.questionType || undefined,
  };
}

export const SchoolMcqEditor: React.FC<Props> = ({
  value = [],
  onChange,
  accent = "green",
  compact = false,
}) => {
  const items = Array.isArray(value) ? value.map(normalizeItem) : [];
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");

  const bulkParsedPreview = useMemo(() => {
    const raw = bulkText.trim();
    if (!raw) return [];
    try {
      const normalized = normalizeMcqPaste(raw);
      const res = parseMCQText(normalized);
      return Array.isArray(res?.questions) ? res.questions : [];
    } catch {
      return [];
    }
  }, [bulkText]);

  const handleBulkImport = (replaceExisting = false) => {
    setBulkError("");
    if (bulkParsedPreview.length === 0) {
      setBulkError("Koi valid MCQ parse nahi hua. Lucent format check karein (Q1. ... A) B) C) D) ... Answer: B).");
      return;
    }
    const ts = Date.now();
    const mapped: SchoolMcqEditorItem[] = bulkParsedPreview.map((q: any, i: number) => {
      const opts = Array.isArray(q?.options) ? [...q.options] : ["", "", "", ""];
      while (opts.length < 4) opts.push("");
      return {
        id: `school_mcq_${ts}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        question: String(q.question || "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/^Q?\s*\d+[.)]\s*/i, "")
          .trim(),
        options: opts.slice(0, 4).map((o: any) => String(o || "")),
        correctAnswer: Number.isFinite(Number(q.correctAnswer)) ? Number(q.correctAnswer) : 0,
        explanation: q.explanation ? String(q.explanation).trim() : "",
        topic: q.topic ? String(q.topic).trim() : "General",
        statements: Array.isArray(q.statements) && q.statements.length > 0 ? q.statements : undefined,
        matchColumns: q.matchColumns || undefined,
        passage: q.passage ? String(q.passage).trim() : undefined,
        questionType: q.questionType || (q.matchColumns ? "MATCH_COLUMN" : undefined),
      };
    });

    onChange(replaceExisting ? mapped : [...items, ...mapped]);
    setBulkText("");
    setShowBulkPaste(false);
  };

  const updateItem = (index: number, patch: Partial<SchoolMcqEditorItem>) => {
    const next = items.map((it, idx) => (idx === index ? { ...it, ...patch } : it));
    onChange(next);
  };

  const updateOption = (itemIdx: number, optIdx: number, text: string) => {
    const target = items[itemIdx];
    if (!target) return;
    const nextOpts = [...target.options];
    nextOpts[optIdx] = text;
    updateItem(itemIdx, { options: nextOpts });
  };

  const addMcq = () => {
    onChange([...items, emptyMcq()]);
  };

  const removeMcq = (index: number) => {
    onChange(items.filter((_, idx) => idx !== index));
  };

  const btnAccent =
    accent === "indigo"
      ? "bg-indigo-600 hover:bg-indigo-700"
      : accent === "blue"
      ? "bg-blue-600 hover:bg-blue-700"
      : accent === "amber"
      ? "bg-amber-600 hover:bg-amber-700"
      : "bg-emerald-600 hover:bg-emerald-700";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-700">
          Page MCQs ({items.length})
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setShowBulkPaste((v) => !v);
              setBulkError("");
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition border ${
              showBulkPaste
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            }`}
          >
            <ClipboardPaste size={12} />
            Bulk Paste MCQ (Lucent)
          </button>
          <button
            type="button"
            onClick={addMcq}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer transition ${btnAccent}`}
          >
            <Plus size={12} />
            Add MCQ
          </button>
        </div>
      </div>

      {/* Lucent Style Bulk MCQ Importer */}
      {showBulkPaste && (
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/70 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-indigo-600" />
              <span className="text-[11px] font-black text-indigo-900">
                Lucent Bulk MCQ Paste (10, 50, 100+ MCQs ek saath daalein)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowBulkPaste(false);
                setBulkError("");
              }}
              className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-[10px] text-indigo-700 leading-relaxed">
            Format: <strong>Q1.</strong> Prashn? &nbsp; <strong>A)</strong> opt1 &nbsp; <strong>B)</strong> opt2 &nbsp; <strong>C)</strong> opt3 &nbsp; <strong>D)</strong> opt4 &nbsp; <strong>Answer: B</strong> &nbsp; <strong>Explanation: ...</strong> (Hindi/English/Match/Statement sab supported)
          </p>
          <textarea
            rows={6}
            value={bulkText}
            onChange={(e) => {
              setBulkText(e.target.value);
              setBulkError("");
            }}
            placeholder={"Q1. प्रकाश संश्लेषण में कौन सी गैस निकलती है?\nA) CO2\nB) O2\nC) N2\nD) H2\nAnswer: B\nExplanation: पौधे ऑक्सीजन (O2) बाहर निकालते हैं।"}
            className="w-full p-2.5 text-xs bg-white border border-indigo-200 rounded-lg text-slate-800 outline-none focus:border-indigo-500 font-mono"
          />
          {bulkError && (
            <p className="text-[11px] font-bold text-rose-600">{bulkError}</p>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-black text-emerald-700">
              {bulkText.trim()
                ? bulkParsedPreview.length > 0
                  ? `✅ ${bulkParsedPreview.length} MCQs parsed & ready`
                  : "⚠️ Valid MCQ format detect nahi hua"
                : "MCQs yahan paste karein..."}
            </span>
            <div className="flex items-center gap-1.5">
              {items.length > 0 && bulkParsedPreview.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleBulkImport(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Replace ({bulkParsedPreview.length})
                </button>
              )}
              <button
                type="button"
                disabled={bulkParsedPreview.length === 0}
                onClick={() => handleBulkImport(false)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-[11px] font-black cursor-pointer"
              >
                + Import {bulkParsedPreview.length > 0 ? `${bulkParsedPreview.length} MCQs` : "MCQs"}
              </button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">
          Abhi koi MCQ nahi hai. &quot;Add MCQ&quot; ya &quot;Bulk Paste MCQ (Lucent)&quot; se prashn jodein.
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-xl border border-slate-200 bg-white ${
                compact ? "p-2.5 space-y-2" : "p-3 space-y-2.5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase text-slate-500">
                  Question #{idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.topic || ""}
                    onChange={(e) => updateItem(idx, { topic: e.target.value })}
                    placeholder="Topic (optional)"
                    className="px-2 py-1 text-[10px] border border-slate-200 rounded-md w-28 text-slate-700 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeMcq(idx)}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                    title="Delete MCQ"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <textarea
                rows={2}
                value={item.question}
                onChange={(e) => updateItem(idx, { question: e.target.value })}
                placeholder="Prashn (Question) likhein..."
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-emerald-500"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {item.options.map((opt, optIdx) => {
                  const isCorrect = item.correctAnswer === optIdx;
                  return (
                    <div
                      key={optIdx}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
                        isCorrect
                          ? "border-emerald-400 bg-emerald-50/70"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => updateItem(idx, { correctAnswer: optIdx })}
                        className={`shrink-0 p-0.5 rounded-full cursor-pointer ${
                          isCorrect ? "text-emerald-600" : "text-slate-300 hover:text-slate-500"
                        }`}
                        title="Mark as Correct Option"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                        className="w-full bg-transparent text-xs text-slate-800 outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              <input
                type="text"
                value={item.explanation || ""}
                onChange={(e) => updateItem(idx, { explanation: e.target.value })}
                placeholder="Explanation / Solution (optional)"
                className="w-full px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-emerald-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SchoolMcqEditor;
