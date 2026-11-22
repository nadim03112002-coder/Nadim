import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Printer,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import type { School } from "../../school-types";
import {
  TOTAL_PRE_PRIMARY_SETS,
  evaluatePrePrimaryScore,
  formatPrePrimarySetId,
  generatePrePrimaryPaperSet,
  renderPrePrimaryIconSvg,
  type PrePrimaryIconKey,
  type PrePrimaryQuestion,
} from "../../data/entrance/prePrimaryScreening20Sets";
import {
  buildPrePrimaryScreeningHtmlBundle,
  downloadPrePrimaryScreeningPdf,
  resolveExamPaperMasthead,
} from "../../utils/entrancePaperPdf";
import { mountAndPrintA4Sync } from "../../utils/a4PrintHelper";
import { A4PrintPreviewOverlay } from "./A4PrintPreviewOverlay";

interface Props {
  school: School;
}

const SvgIconPreview: React.FC<{
  icon: PrePrimaryIconKey;
  size?: number;
  color?: string;
  bw?: boolean;
  hollow?: boolean;
}> = ({ icon, size = 24, color, bw = false, hollow = false }) => {
  const markup = useMemo(
    () => renderPrePrimaryIconSvg(icon, { size, color, bw, hollow }),
    [icon, size, color, bw, hollow]
  );
  return (
    <span
      className="inline-flex items-center justify-center shrink-0"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};

export const PrePrimaryScreeningPanel: React.FC<Props> = ({ school }) => {
  const [setNumber, setSetNumber] = useState<number>(1);
  const [bwPrint, setBwPrint] = useState<boolean>(false);
  const [fontSizePx, setFontSizePx] = useState<number>(10.5);
  const [showAnswers, setShowAnswers] = useState<boolean>(false);
  const [sheetView, setSheetView] = useState<"all" | "p1" | "p2" | "p3">("all");
  const [printPreviewData, setPrintPreviewData] = useState<{
    title: string;
    pagesHtml: string[];
    fullCss: string;
    docTitle: string;
    mode: "full" | "questions_only";
  } | null>(null);

  // Placement rule thresholds & interactive marks tester
  const [lkgThreshold, setLkgThreshold] = useState<number>(40);
  const [ukgThreshold, setUkgThreshold] = useState<number>(70);
  const [sampleMarks, setSampleMarks] = useState<number>(24);

  const masthead = useMemo(() => resolveExamPaperMasthead(school), [school]);
  const paper = useMemo(() => generatePrePrimaryPaperSet(setNumber), [setNumber]);

  const placementPreview = useMemo(
    () => evaluatePrePrimaryScore(sampleMarks, paper.totalMarks, lkgThreshold, ukgThreshold),
    [sampleMarks, paper.totalMarks, lkgThreshold, ukgThreshold]
  );

  const handlePrintA4 = (mode: "full" | "questions_only") => {
    try {
      const bundle = buildPrePrimaryScreeningHtmlBundle({
        school,
        paper,
        mode,
        bwPrint,
        fontSizePx,
        lkgThresholdPct: lkgThreshold,
        ukgThresholdPct: ukgThreshold,
      });
      setPrintPreviewData({
        title: `Nursery / LKG / UKG Entrance Screening (${paper.setId})`,
        pagesHtml: bundle.pagesHtml,
        fullCss: bundle.fullCss,
        docTitle: bundle.docTitle,
        mode,
      });
      mountAndPrintA4Sync(bundle.pagesHtml, bundle.fullCss, bundle.docTitle);
    } catch (err: any) {
      toast.error("A4 Print में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    }
  };

  const p1Questions = paper.questions.slice(0, 6);
  const p2Questions = paper.questions.slice(6);

  const renderQuestionPreview = (q: PrePrimaryQuestion) => {
    return (
      <div
        key={q.id}
        className="rounded-lg border border-slate-300 bg-white p-2.5 space-y-2 break-inside-avoid"
      >
        <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-200">
          <div>
            <div className="font-bold text-slate-950" style={{ fontSize: `${fontSizePx}px` }}>
              Q.{q.qNo}. {q.instruction}
            </div>
            {q.instructionHi && (
              <div
                className="text-slate-600 font-medium mt-0.5"
                style={{ fontSize: `${Math.max(8.5, fontSizePx - 1)}px` }}
              >
                {q.instructionHi}
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 tabular-nums">
            {q.levelLabel} · {q.marks}M
          </span>
        </div>

        {/* Visual Question Widget Body */}
        {q.type === "count_write" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex flex-wrap items-center gap-1.5 border-2 border-slate-900 rounded-md px-2.5 py-1.5 bg-slate-50">
              {Array.from({ length: q.countValue || 4 }).map((_, i) => (
                <SvgIconPreview
                  key={i}
                  icon={q.countIcon || "apple"}
                  size={24}
                  color={q.countColorHex}
                  bw={bwPrint}
                />
              ))}
            </div>
            <span className="text-lg font-black text-slate-900">=</span>
            <div className="w-12 h-10 border-2 border-slate-900 rounded-md bg-white flex items-center justify-center font-black text-base text-emerald-700">
              {showAnswers ? q.countValue : ""}
            </div>
          </div>
        )}

        {q.type === "box_addition" && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex flex-wrap items-center gap-1 border-2 border-slate-900 rounded-md px-2 py-1.5 bg-slate-50">
              {Array.from({ length: q.addLeft || 2 }).map((_, i) => (
                <SvgIconPreview
                  key={i}
                  icon={q.addIcon || "apple"}
                  size={22}
                  color={q.addColorHex}
                  bw={bwPrint}
                />
              ))}
            </div>
            <span className="text-lg font-black text-slate-900">+</span>
            <div className="inline-flex flex-wrap items-center gap-1 border-2 border-slate-900 rounded-md px-2 py-1.5 bg-slate-50">
              {Array.from({ length: q.addRight || 2 }).map((_, i) => (
                <SvgIconPreview
                  key={i}
                  icon={q.addIcon || "apple"}
                  size={22}
                  color={q.addColorHex}
                  bw={bwPrint}
                />
              ))}
            </div>
            <span className="text-lg font-black text-slate-900">=</span>
            <div className="w-12 h-10 border-2 border-slate-900 rounded-md bg-white flex items-center justify-center font-black text-base text-emerald-700">
              {showAnswers ? (q.addLeft || 0) + (q.addRight || 0) : ""}
            </div>
          </div>
        )}

        {q.type === "color_match" && (
          <div className="grid grid-cols-2 gap-5 px-2">
            <div className="space-y-1.5">
              {(q.matchColors || []).map((c) => (
                <div
                  key={c.colorName}
                  className="flex items-center justify-between border border-slate-300 rounded px-2 py-1 bg-slate-50 text-[10px] font-bold"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-900 inline-block shrink-0"
                      style={{ backgroundColor: bwPrint ? "#ffffff" : c.hex }}
                    />
                    <span>
                      {c.colorName} ({c.hindiName})
                    </span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-slate-900 inline-block" />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {(q.matchRightOrder || []).map((idx) => {
                const c = (q.matchColors || [])[idx];
                if (!c) return null;
                return (
                  <div
                    key={c.objectLabel}
                    className="flex items-center justify-between border border-slate-300 rounded px-2 py-1 bg-slate-50 text-[10px] font-bold"
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-900 inline-block" />
                    <span className="inline-flex items-center gap-1.5">
                      <SvgIconPreview icon={c.icon} size={20} color={c.hex} bw={bwPrint} />
                      <span>{c.objectLabel}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {q.type === "color_fill" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-2.5 border-2 border-slate-900 rounded-md px-3 py-1.5 bg-slate-50">
              {Array.from({ length: q.fillTotalShapes || 6 }).map((_, i) => (
                <SvgIconPreview
                  key={i}
                  icon={q.fillIcon || "star"}
                  size={28}
                  hollow
                  bw
                />
              ))}
            </div>
            <div className="text-[11px] font-bold text-slate-700">
              Fill <strong>{q.fillTargetCount}</strong> with {q.fillTargetColorName}
            </div>
          </div>
        )}

        {q.type === "circle_correct" && (
          <div className="flex flex-wrap items-center gap-2.5">
            {q.circlePictureHint && (
              <div className="inline-flex items-center gap-1.5 border-2 border-slate-900 rounded-md px-2.5 py-1 bg-slate-50">
                <SvgIconPreview
                  icon={q.circlePictureHint.icon}
                  size={28}
                  color={q.circlePictureHint.colorHex}
                  bw={bwPrint}
                />
                {q.circlePictureHint.label && (
                  <span className="text-[10px] font-bold">{q.circlePictureHint.label}</span>
                )}
              </div>
            )}
            {(q.circleChoices || []).map((ch, ci) => {
              const isAns = showAnswers && ci === q.circleCorrectIndex;
              return (
                <div
                  key={ci}
                  className={`min-w-[60px] px-3 py-1.5 rounded-full border-2 inline-flex items-center justify-center gap-1.5 font-extrabold text-sm ${
                    isAns
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400"
                      : "border-dashed border-slate-400 bg-white text-slate-900"
                  }`}
                >
                  {ch.icon && (
                    <SvgIconPreview icon={ch.icon} size={22} color={ch.colorHex} bw={bwPrint} />
                  )}
                  <span>{ch.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {q.type === "missing_box" && (
          <div className="flex flex-wrap items-center gap-2">
            {(q.missingSequence || []).map((val, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-400 font-bold">→</span>}
                <div
                  className={`w-10 h-9 rounded-md border-2 flex items-center justify-center font-black text-sm ${
                    val === null
                      ? "border-dashed border-slate-900 bg-white text-emerald-700"
                      : "border-slate-900 bg-slate-50 text-slate-900"
                  }`}
                >
                  {val !== null
                    ? val
                    : showAnswers
                    ? (q.missingAnswers || [])[idx === 1 ? 0 : 1] || ""
                    : ""}
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        {q.type === "compare_tick" && (
          <div className="grid grid-cols-2 gap-3">
            {(["LEFT", "RIGHT"] as const).map((side) => {
              const payload = side === "LEFT" ? q.compareLeft : q.compareRight;
              if (!payload) return null;
              const isCorrect = showAnswers && q.compareAnswerSide === side;
              return (
                <div
                  key={side}
                  className={`border-2 rounded-md px-3 py-2 flex items-center justify-between gap-2 ${
                    isCorrect ? "border-emerald-600 bg-emerald-50" : "border-slate-900 bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1">
                    {Array.from({ length: payload.count }).map((_, i) => (
                      <SvgIconPreview
                        key={i}
                        icon={payload.icon}
                        size={payload.size === "big" ? 34 : 18}
                        color={payload.colorHex}
                        bw={bwPrint}
                      />
                    ))}
                  </div>
                  <div className="w-6 h-6 border-2 border-slate-900 rounded bg-white flex items-center justify-center font-black text-emerald-700 shrink-0">
                    {isCorrect ? "✓" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {q.type === "word_join" && (
          <div className="flex flex-wrap items-center gap-2">
            {q.wordPromptIcon && (
              <div className="border-2 border-slate-900 rounded-md p-1.5 bg-slate-50">
                <SvgIconPreview
                  icon={q.wordPromptIcon}
                  size={24}
                  color={q.wordPromptColor}
                  bw={bwPrint}
                />
              </div>
            )}
            {(q.wordParts || []).map((p, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="font-black text-slate-900">+</span>}
                <span className="px-2.5 py-1 border-2 border-slate-900 rounded bg-slate-50 font-black text-sm">
                  {p}
                </span>
              </React.Fragment>
            ))}
            <span className="font-black text-slate-900">=</span>
            <div className="min-w-[100px] h-9 border-2 border-slate-900 rounded-md bg-white flex items-center justify-center font-black text-sm text-emerald-700 px-2">
              {showAnswers ? (q.answerSummary.split("=")[1] || "").trim() : ""}
            </div>
          </div>
        )}

        {showAnswers && (
          <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 font-semibold">
            Key Answer: {q.answerSummary}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white">
              Pre-Primary Visual Screening Paper (Nursery / LKG / UKG · 20 Sets)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              Box Counting · Box Addition (+) · Colour Match · Colour Shapes · Circle Correct Answer · Missing Boxes · 50 Marks Total
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setBwPrint((p) => !p)}
              className={`px-3 py-2 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                bwPrint
                  ? "bg-[#070D19] text-white border-[#070D19]"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{bwPrint ? "Print: B/W Ink-Saver" : "Print: Full Colour"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAnswers((p) => !p)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {showAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showAnswers ? "Hide Answers" : "Preview Answers"}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Set Selector, Text Size, Export Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              Select Visual Set (PP-Set-01 to PP-Set-20)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSetNumber((n) => (n <= 1 ? TOTAL_PRE_PRIMARY_SETS : n - 1))}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Previous Set"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={setNumber}
                onChange={(e) => setSetNumber(Number(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-bold font-mono tabular-nums"
              >
                {Array.from({ length: TOTAL_PRE_PRIMARY_SETS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {formatPrePrimarySetId(n)} (12 Visual Activities · 50 Marks)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSetNumber((n) => (n >= TOTAL_PRE_PRIMARY_SETS ? 1 : n + 1))}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Next Set"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
              <span className="inline-flex items-center gap-1">
                <Type className="w-3.5 h-3.5" /> Paper Text Size
              </span>
              <span className="font-mono tabular-nums text-sky-700 dark:text-sky-400">
                {fontSizePx.toFixed(1)}px
              </span>
            </label>
            <input
              type="range"
              min={9}
              max={12.5}
              step={0.5}
              value={fontSizePx}
              onChange={(e) => setFontSizePx(Number(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer"
            />
          </div>

          <div className="md:col-span-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePrintA4("full")}
              className="flex-1 py-2.5 px-3 rounded-lg bg-[#070D19] hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print 2P Paper + P3 Key (A4)</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintA4("questions_only")}
              className="py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              <span>Print Sheet (2P A4)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Marks -> Nursery / LKG (KG-1) / UKG (KG-2) Placement Checker */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-5 space-y-1">
          <div className="text-xs font-bold text-slate-950 dark:text-white">
            Level Placement Rule &amp; Marks-to-Class Check (Out of {paper.totalMarks})
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <span>0–{lkgThreshold - 1}%: Nursery</span>
            <span aria-hidden="true">·</span>
            <span>
              {lkgThreshold}–{ukgThreshold - 1}%: LKG (KG-1)
            </span>
            <span aria-hidden="true">·</span>
            <span>{ukgThreshold}–100%: UKG (KG-2)</span>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-wrap items-center gap-2 text-xs">
          <div>
            <label className="block text-[11px] text-slate-500 font-semibold">LKG Cutoff %</label>
            <input
              type="number"
              min={20}
              max={65}
              value={lkgThreshold}
              onChange={(e) => {
                const v = Math.max(20, Math.min(ukgThreshold - 5, Number(e.target.value || 40)));
                setLkgThreshold(v);
              }}
              className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 font-semibold">UKG Cutoff %</label>
            <input
              type="number"
              min={45}
              max={95}
              value={ukgThreshold}
              onChange={(e) => {
                const v = Math.max(lkgThreshold + 5, Math.min(95, Number(e.target.value || 70)));
                setUkgThreshold(v);
              }}
              className="w-20 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 font-semibold">
              Check Child Marks (/ {paper.totalMarks})
            </label>
            <input
              type="number"
              min={0}
              max={paper.totalMarks}
              value={sampleMarks}
              onChange={(e) =>
                setSampleMarks(Math.max(0, Math.min(paper.totalMarks, Number(e.target.value || 0))))
              }
              className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono font-bold tabular-nums"
            />
          </div>
        </div>

        <div className="lg:col-span-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
          <div className="text-[11px] text-slate-500 font-semibold">Suggested Admission Class</div>
          <div
            className={`text-sm font-black tabular-nums ${
              placementPreview.level === "UKG"
                ? "text-emerald-700 dark:text-emerald-400"
                : placementPreview.level === "LKG"
                ? "text-sky-700 dark:text-sky-400"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            {placementPreview.classLabel} · {placementPreview.percentage}%
          </div>
        </div>
      </div>

      {/* Live A4 Sheet View Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
          Live Print Preview — {paper.setId} · Nursery ({paper.levelMarks.NURSERY}M) + LKG ({paper.levelMarks.LKG}M) + UKG ({paper.levelMarks.UKG}M) = {paper.totalMarks}M
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
          {(
            [
              { id: "all", label: "All 3 Pages" },
              { id: "p1", label: "Page 1 (Q.1–6)" },
              { id: "p2", label: "Page 2 (Q.7–12)" },
              { id: "p3", label: "Page 3 (Key)" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSheetView(t.id)}
              className={`px-2.5 py-1 rounded-md font-bold cursor-pointer whitespace-nowrap ${
                sheetView === t.id
                  ? "bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sheet Containers */}
      <div className="space-y-4">
        {(sheetView === "all" || sheetView === "p1") && (
          <div className="rounded-xl bg-white text-slate-950 border border-slate-300 p-4 space-y-3 max-w-4xl mx-auto">
            <div className="border-2 border-slate-900 rounded-lg p-3 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between gap-2.5">
                {masthead.logoUrl ? (
                  <img
                    src={masthead.logoUrl}
                    alt=""
                    className={`w-11 h-11 object-contain shrink-0 ${
                      bwPrint ? "grayscale contrast-125 brightness-95" : ""
                    }`}
                  />
                ) : (
                  <div className="w-11 shrink-0" />
                )}
                <div className="text-center flex-1 min-w-0">
                  <div className="font-black uppercase text-sm sm:text-base tracking-wide leading-tight text-slate-950">
                    {masthead.schoolName}
                  </div>
                  {masthead.tagline && (
                    <div className="text-[10.5px] font-bold italic text-slate-800 mt-0.5">
                      {masthead.tagline}
                    </div>
                  )}
                  {masthead.address && (
                    <div className="text-[10px] text-slate-700 mt-0.5">
                      {masthead.address}
                    </div>
                  )}
                  {masthead.contactLine && (
                    <div className="text-[9.5px] font-bold text-slate-900 mt-0.5">
                      {masthead.contactLine}
                    </div>
                  )}
                </div>
                <div className="w-11 shrink-0" />
              </div>
              <div className="flex flex-wrap justify-between gap-2 pt-1.5 border-t border-dashed border-slate-400 text-[11px] font-bold">
                <span>PRE-PRIMARY LEVEL SCREENING TEST (NURSERY / LKG / UKG)</span>
                <span className="font-mono">{paper.setId} · {paper.durationMinutes} Min · {paper.totalMarks} Marks</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1.5 border-t border-slate-300 text-[11px]">
                <div className="border-b border-dotted border-slate-500 pb-0.5"><strong>Child Name:</strong></div>
                <div className="border-b border-dotted border-slate-500 pb-0.5"><strong>Father:</strong></div>
                <div className="border-b border-dotted border-slate-500 pb-0.5"><strong>Age:</strong></div>
                <div className="border-b border-dotted border-slate-500 pb-0.5"><strong>Date:</strong></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 border border-dashed border-slate-600 rounded bg-white text-[11px] font-bold">
                <span>MARKS: _____ / {paper.totalMarks}</span>
                <div className="flex flex-wrap items-center gap-3">
                  <span>[ ] Nursery (&lt;{lkgThreshold}%)</span>
                  <span>[ ] LKG / KG-1 ({lkgThreshold}–{ukgThreshold - 1}%)</span>
                  <span>[ ] UKG / KG-2 ({ukgThreshold}%+)</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">{p1Questions.map(renderQuestionPreview)}</div>
          </div>
        )}

        {(sheetView === "all" || sheetView === "p2") && (
          <div className="rounded-xl bg-white text-slate-950 border border-slate-300 p-4 space-y-3 max-w-4xl mx-auto">
            <div className="flex items-center justify-between border border-slate-900 rounded px-3 py-1.5 bg-slate-50 text-xs font-bold">
              <span className="uppercase">{school?.name || "LIFE MAKER PUBLIC SCHOOL"}</span>
              <span>{paper.setId} · Activity Sheet (Q.7–Q.12)</span>
              <span>Page 2 of 2</span>
            </div>

            <div className="space-y-2.5">{p2Questions.map(renderQuestionPreview)}</div>

            <div className="border-2 border-slate-900 rounded-lg p-3 bg-slate-50 space-y-2">
              <div className="text-xs font-extrabold">
                TEACHER OBSERVATION &amp; ORAL ASSESSMENT CHECKLIST
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-700">
                {paper.oralChecklist.map((c) => (
                  <div key={c.item}>
                    [ ] <strong>{c.item}</strong> — {c.note}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {(sheetView === "all" || sheetView === "p3") && (
          <div className="rounded-xl bg-white text-slate-950 border border-slate-300 p-4 space-y-3 max-w-4xl mx-auto">
            <div className="rounded-lg bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase text-amber-300">
                  {school?.name || "LIFE MAKER PUBLIC SCHOOL"}
                </div>
                <div className="text-xs sm:text-sm font-black">
                  PAGE 3: EXAMINER ANSWER KEY &amp; PLACEMENT GUIDE · {paper.setId}
                </div>
              </div>
              <div className="text-right text-[11px] font-mono tabular-nums">
                {paper.totalMarks} Marks Total
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                <div className="font-black text-rose-800">0% – {lkgThreshold - 1}% → Nursery</div>
                <div className="text-[11px] text-slate-700 mt-0.5">
                  Up to {Math.floor(((lkgThreshold - 0.1) * paper.totalMarks) / 100)} / {paper.totalMarks} Marks
                </div>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-2.5">
                <div className="font-black text-sky-800">
                  {lkgThreshold}% – {ukgThreshold - 1}% → LKG (KG-1)
                </div>
                <div className="text-[11px] text-slate-700 mt-0.5">
                  {Math.ceil((lkgThreshold * paper.totalMarks) / 100)} – {Math.floor(((ukgThreshold - 0.1) * paper.totalMarks) / 100)} / {paper.totalMarks} Marks
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                <div className="font-black text-emerald-800">
                  {ukgThreshold}% – 100% → UKG (KG-2)
                </div>
                <div className="text-[11px] text-slate-700 mt-0.5">
                  {Math.ceil((ukgThreshold * paper.totalMarks) / 100)} – {paper.totalMarks} / {paper.totalMarks} Marks
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-300 px-2.5 py-1.5">Q.No</th>
                    <th className="border border-slate-300 px-2.5 py-1.5">Level</th>
                    <th className="border border-slate-300 px-2.5 py-1.5">Subject</th>
                    <th className="border border-slate-300 px-2.5 py-1.5 text-center">Marks</th>
                    <th className="border border-slate-300 px-2.5 py-1.5">Official Answer</th>
                  </tr>
                </thead>
                <tbody>
                  {paper.questions.map((q) => (
                    <tr key={q.id}>
                      <td className="border border-slate-200 px-2.5 py-1.5 font-bold tabular-nums">
                        Q.{q.qNo}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1.5 font-semibold">
                        {q.levelLabel}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1.5">{q.subject}</td>
                      <td className="border border-slate-200 px-2.5 py-1.5 text-center font-bold tabular-nums">
                        {q.marks}
                      </td>
                      <td className="border border-slate-200 px-2.5 py-1.5 font-bold text-emerald-800">
                        {q.answerSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <A4PrintPreviewOverlay
        isOpen={Boolean(printPreviewData)}
        title={printPreviewData?.title || "Pre-Primary A4 Print Sheet"}
        pagesHtml={printPreviewData?.pagesHtml || []}
        scopedCss={printPreviewData?.fullCss || ""}
        docTitle={printPreviewData?.docTitle || "PrePrimary_Screening_A4"}
        onClose={() => setPrintPreviewData(null)}
        onDownloadPdfFallback={
          printPreviewData
            ? () =>
                downloadPrePrimaryScreeningPdf({
                  school,
                  paper,
                  mode: printPreviewData.mode,
                  bwPrint,
                  fontSizePx,
                  lkgThresholdPct: lkgThreshold,
                  ukgThresholdPct: ukgThreshold,
                })
            : undefined
        }
      />
    </div>
  );
};
