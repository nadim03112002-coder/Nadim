import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  KeyRound,
  Loader2,
  Lock,
  Pause,
  Play,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatEntranceClassLabel,
  type EntranceClassNumber,
  type ExamCategoryType,
  type SavedSchoolQuestionPaper,
  type School,
} from "../../school-types";
import { getSavedSchoolQuestionPapers } from "../../utils/entranceTestEngine";
import {
  buildCustomPaperHtmlBundle,
  downloadCustomEntrancePaperPdf,
  resolveExamPaperMasthead,
  sanitizePaperText,
  type CustomPaperBuildInput,
  type PaperPrintTheme,
} from "../../utils/entrancePaperPdf";
import { mountAndPrintA4Sync } from "../../utils/a4PrintHelper";
import { A4PrintPreviewOverlay } from "./A4PrintPreviewOverlay";

interface Props {
  school: Partial<School> & { id: string; name?: string };
  studentClassLabel?: string;
  activeSessionLabel?: string;
  onBack?: () => void;
}

const OPTION_LETTERS = ["a", "b", "c", "d"] as const;

const EXAM_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Exams" },
  { value: "FINAL_YEAR", label: "Annual / Final" },
  { value: "HALF_YEARLY", label: "Half-Yearly" },
  { value: "UNIT_PA", label: "Unit / PA Test" },
  { value: "ENTRANCE", label: "Entrance Exam" },
  { value: "GENERAL", label: "Monthly / Test" },
];

const EXAM_CATEGORY_LABELS: Record<ExamCategoryType, string> = {
  FINAL_YEAR: "Annual Exam",
  HALF_YEARLY: "Half-Yearly",
  PA1: "PA-1 / Unit Test",
  PA2: "PA-2 / Unit Test",
  PA3: "PA-3 / Unit Test",
  PA4: "PA-4 / Unit Test",
  ENTRANCE: "Entrance Exam",
  GENERAL: "Monthly / Test",
};

function parseStudentClassToNumber(label?: string): EntranceClassNumber | null {
  const s = String(label || "").trim().toLowerCase();
  if (!s) return null;
  if (/nursery|nur\b/.test(s)) return -2;
  if (/l\.?k\.?g|kg[\s\-]?1/.test(s)) return -1;
  if (/u\.?k\.?g|kg[\s\-]?2/.test(s)) return 0;
  const m = s.match(/(\d{1,2})/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 10) return n as EntranceClassNumber;
  }
  return null;
}

function formatDurationLabel(mins: number): string {
  const m = Math.max(15, Number(mins || 60));
  if (m >= 60 && m % 60 === 0) {
    const h = m / 60;
    return `${h} ${h === 1 ? "Hour" : "Hours"}`;
  }
  if (m > 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m} Mins`;
}

function formatTimer(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export const StudentQuestionBankView: React.FC<Props> = ({
  school,
  studentClassLabel,
  activeSessionLabel,
  onBack,
}) => {
  const schoolId = school?.id || "";
  const detectedClass = useMemo(
    () => parseStudentClassToNumber(studentClassLabel),
    [studentClassLabel]
  );

  const [papers, setPapers] = useState<SavedSchoolQuestionPaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSession, setSelectedSession] = useState<string>("ALL");
  const [selectedClass, setSelectedClass] = useState<string>(
    detectedClass !== null ? String(detectedClass) : "ALL"
  );
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [viewingPaper, setViewingPaper] = useState<SavedSchoolQuestionPaper | null>(null);
  const [showKeyTab, setShowKeyTab] = useState<boolean>(false);
  const [busyDownloadId, setBusyDownloadId] = useState<string | null>(null);

  // Practice Test Runner State
  const [practicePaper, setPracticePaper] = useState<SavedSchoolQuestionPaper | null>(null);
  const [practiceObjAnswers, setPracticeObjAnswers] = useState<Record<string, number>>({});
  const [practiceSubjNotes, setPracticeSubjNotes] = useState<Record<string, string>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState<boolean>(false);
  const [practiceSecondsLeft, setPracticeSecondsLeft] = useState<number>(3600);
  const [practiceRunning, setPracticeRunning] = useState<boolean>(false);

  const [printPreviewData, setPrintPreviewData] = useState<{
    title: string;
    pagesHtml: string[];
    fullCss: string;
    docTitle: string;
    orientation: "portrait" | "landscape";
    buildInput: CustomPaperBuildInput;
  } | null>(null);

  const loadPapers = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const all = await getSavedSchoolQuestionPapers(schoolId);
      // Security: ONLY published papers, and if student's class is detected, restrict strictly to their class!
      const published = all.filter((p) => {
        if (!p.isPublished) return false;
        if (detectedClass !== null && Number(p.classLevel) !== detectedClass) return false;
        return true;
      });
      setPapers(published);
      if (activeSessionLabel && published.some((p) => p.sessionLabel === activeSessionLabel)) {
        setSelectedSession("ALL"); // Show All Previous Years + Current Session by default
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPapers();
  }, [schoolId, detectedClass]);

  // Countdown timer for Practice Test mode
  useEffect(() => {
    if (!practicePaper || !practiceRunning || practiceSubmitted) return;
    const t = window.setInterval(() => {
      setPracticeSecondsLeft((prev) => {
        if (prev <= 1) {
          setPracticeRunning(false);
          setPracticeSubmitted(true);
          toast.info("Practice Test का समय समाप्त हुआ — परिणाम तैयार है!");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [practicePaper, practiceRunning, practiceSubmitted]);

  const sessionsList = useMemo(() => {
    const s = new Set<string>();
    papers.forEach((p) => {
      if (p.sessionLabel) s.add(p.sessionLabel);
    });
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [papers]);

  const subjectsList = useMemo(() => {
    const s = new Set<string>();
    papers.forEach((p) => {
      if (p.subjectLabel) s.add(p.subjectLabel);
    });
    return Array.from(s).sort();
  }, [papers]);

  const classesList = useMemo(() => {
    const s = new Set<number>();
    papers.forEach((p) => s.add(Number(p.classLevel)));
    return Array.from(s).sort((a, b) => a - b) as EntranceClassNumber[];
  }, [papers]);

  const filteredPapers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return papers.filter((p) => {
      if (selectedSession !== "ALL" && p.sessionLabel !== selectedSession) return false;
      if (detectedClass === null && selectedClass !== "ALL" && String(p.classLevel) !== selectedClass) {
        return false;
      }
      if (selectedSubject !== "ALL" && p.subjectLabel !== selectedSubject) return false;
      if (selectedExamFilter !== "ALL") {
        if (selectedExamFilter === "UNIT_PA") {
          if (!["PA1", "PA2", "PA3", "PA4"].includes(p.examCategory)) return false;
        } else if (p.examCategory !== selectedExamFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        (p.paperIdCode || "").toLowerCase().includes(q) ||
        p.paperTitle.toLowerCase().includes(q) ||
        p.subjectLabel.toLowerCase().includes(q) ||
        p.sessionLabel.toLowerCase().includes(q) ||
        formatEntranceClassLabel(p.classLevel).toLowerCase().includes(q)
      );
    });
  }, [papers, selectedSession, detectedClass, selectedClass, selectedSubject, selectedExamFilter, searchQuery]);

  const masthead = useMemo(() => resolveExamPaperMasthead(school), [school]);

  const buildInputFromPaper = (
    paper: SavedSchoolQuestionPaper,
    includeKey = false
  ): CustomPaperBuildInput => {
    const mode = includeKey && paper.showAnswerKeyToStudents ? "full" : "questions_only";
    return {
      school: school as School,
      classLevel: paper.classLevel,
      paperTitle: paper.paperTitle,
      examName: paper.paperTitle,
      sessionLabel: paper.sessionLabel,
      subjectLabel: paper.subjectLabel,
      fullMarksOverride: paper.fullMarks > 0 ? paper.fullMarks : undefined,
      examDate: paper.examDate,
      paperCode: paper.paperCode || paper.paperIdCode,
      generalInstructions: paper.generalInstructions,
      cbseRulesMode: paper.cbseRulesMode || "auto",
      customBoardRulesHi: paper.customBoardRulesHi,
      customBoardRulesEn: paper.customBoardRulesEn,
      printOrientation: paper.printOrientation || "portrait",
      showStudentStrip: paper.showStudentStrip ?? true,
      paperTheme: (paper.paperTheme as PaperPrintTheme) || "classic_bw",
      durationMinutes: paper.durationMinutes || 60,
      objectiveQuestions: paper.objectiveQuestions || [],
      subjectiveQuestions: paper.subjectiveQuestions || [],
      fontSizePx: paper.fontSizePx || (paper.classLevel <= 0 ? 10.0 : 9.5),
      twoColObjective: Boolean(paper.twoColObjective),
      twoColSubjective: Boolean(paper.twoColSubjective),
      manualPageOverrides: paper.manualPageOverrides,
      showWritingLines: paper.classLevel <= 0,
      mode,
    };
  };

  const handlePrintPaper = (paper: SavedSchoolQuestionPaper, includeKey = false) => {
    try {
      const input = buildInputFromPaper(paper, includeKey);
      const bundle = buildCustomPaperHtmlBundle(input);
      setPrintPreviewData({
        title: `${paper.paperTitle} · ${formatEntranceClassLabel(paper.classLevel)} (${paper.sessionLabel})`,
        pagesHtml: bundle.pagesHtml,
        fullCss: bundle.fullCss,
        docTitle: bundle.docTitle,
        orientation: bundle.orientation,
        buildInput: input,
      });
      mountAndPrintA4Sync(bundle.pagesHtml, bundle.fullCss, bundle.docTitle, bundle.orientation);
    } catch (err: any) {
      toast.error("A4 प्रिंट करने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    }
  };

  const handleDownloadPdf = async (paper: SavedSchoolQuestionPaper, includeKey = false) => {
    if (includeKey && !paper.showAnswerKeyToStudents) {
      toast.info("यह Answer Key अभी स्कूल द्वारा लॉक है।");
      return;
    }
    const key = `${paper.id}_${includeKey ? "key" : "qp"}`;
    setBusyDownloadId(key);
    try {
      await downloadCustomEntrancePaperPdf(buildInputFromPaper(paper, includeKey));
      toast.success(
        includeKey
          ? "Question Paper + Answer Key PDF डाउनलोड हो गया!"
          : "Question Paper PDF डाउनलोड हो गया!"
      );
    } catch (err: any) {
      toast.error("PDF डाउनलोड त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    } finally {
      setBusyDownloadId(null);
    }
  };

  const handleStartPracticeTest = (paper: SavedSchoolQuestionPaper) => {
    setPracticePaper(paper);
    setPracticeObjAnswers({});
    setPracticeSubjNotes({});
    setPracticeSubmitted(false);
    setPracticeSecondsLeft(Math.max(5, Number(paper.durationMinutes || 60)) * 60);
    setPracticeRunning(true);
    setViewingPaper(null);
  };

  // ── VIEW 1: INTERACTIVE PREVIOUS-YEAR PRACTICE TEST MODE ────────────────────
  if (practicePaper) {
    const objQs = practicePaper.objectiveQuestions || [];
    const subjQs = practicePaper.subjectiveQuestions || [];
    const canRevealSolutions = Boolean(practicePaper.showAnswerKeyToStudents);

    const objAnsweredCount = Object.keys(practiceObjAnswers).length;
    const subjAttemptedCount = Object.values(practiceSubjNotes).filter((v) => v.trim().length > 0).length;

    let correctCount = 0;
    let wrongCount = 0;
    objQs.forEach((q) => {
      const chosen = practiceObjAnswers[q.id];
      if (chosen !== undefined) {
        if (chosen === q.correctIndex) correctCount++;
        else wrongCount++;
      }
    });
    const skippedObj = objQs.length - (correctCount + wrongCount);
    const objPct = objQs.length > 0 ? Math.round((correctCount / objQs.length) * 100) : 0;

    return (
      <div className="space-y-4 animate-in fade-in pb-24">
        {/* Practice Header & Timer Bar */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 sticky top-2 z-20 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                setPracticePaper(null);
                setPracticeRunning(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Exit Practice</span>
            </button>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black text-white truncate">
                Practice Test · {practicePaper.subjectLabel} ({practicePaper.sessionLabel})
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {formatEntranceClassLabel(practicePaper.classLevel)} · {practicePaper.paperTitle}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 font-mono text-xs font-black inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(practiceSecondsLeft)}</span>
            </div>

            {!practiceSubmitted ? (
              <>
                <button
                  type="button"
                  onClick={() => setPracticeRunning((v) => !v)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  {practiceRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{practiceRunning ? "Pause" : "Resume"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPracticeSubmitted(true);
                    setPracticeRunning(false);
                    toast.success("Practice Test सबमिट हो गया!");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Submit Test</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleStartPracticeTest(practicePaper)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Practice</span>
              </button>
            )}
          </div>
        </div>

        {/* Result Summary Banner after Submit */}
        {practiceSubmitted && (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/40 p-4 sm:p-5 text-white space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Award className="w-7 h-7 text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    Practice Test Completed!
                  </h3>
                  <p className="text-xs text-slate-300">
                    {canRevealSolutions
                      ? "नीचे सही उत्तर, व्याख्या और Subjective Model Answers मिलान के लिए खुले हैं।"
                      : "स्कूल द्वारा Answer Key अभी लॉक है — केवल आपका Attempt Summary दिखाया जा रहा है।"}
                  </p>
                </div>
              </div>
              {objQs.length > 0 && canRevealSolutions && (
                <div className="px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-center">
                  <div className="text-lg font-black text-emerald-300 tabular-nums">{objPct}%</div>
                  <div className="text-[10px] text-emerald-200 font-bold">MCQ Accuracy</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                <div className="text-slate-400 text-[10px]">MCQs Attempted</div>
                <div className="font-black text-white text-sm">
                  {objAnsweredCount} / {objQs.length}
                </div>
              </div>
              {canRevealSolutions ? (
                <>
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5">
                    <div className="text-emerald-300 text-[10px]">Correct MCQs</div>
                    <div className="font-black text-emerald-300 text-sm">{correctCount}</div>
                  </div>
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5">
                    <div className="text-rose-300 text-[10px]">Wrong / Skipped</div>
                    <div className="font-black text-rose-300 text-sm">
                      {wrongCount} Wrong · {skippedObj} Skip
                    </div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-center gap-2 text-amber-200">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-semibold">
                    Answer Key परीक्षा के बाद स्कूल द्वारा Unlock की जाएगी।
                  </span>
                </div>
              )}
              <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                <div className="text-slate-400 text-[10px]">Subjective Written</div>
                <div className="font-black text-sky-300 text-sm">
                  {subjAttemptedCount} / {subjQs.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section A: Interactive Objective MCQs */}
        {objQs.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs sm:text-sm font-black uppercase text-emerald-400">
                Section A — Objective Practice ({objQs.length} Questions)
              </h3>
              <span className="text-xs font-bold text-slate-400 tabular-nums">
                {objAnsweredCount}/{objQs.length} Answered
              </span>
            </div>

            <div className="space-y-3">
              {objQs.map((q, idx) => {
                const chosen = practiceObjAnswers[q.id];
                const isCorrect = chosen === q.correctIndex;
                return (
                  <div
                    key={q.id || idx}
                    className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 text-xs sm:text-sm">
                      <div className="font-bold text-white whitespace-pre-line">
                        <span className="text-emerald-400 mr-1.5">Q.{idx + 1}</span>
                        {q.passage && (
                          <div className="font-normal italic text-slate-400 text-xs border-l-2 border-slate-600 pl-2 my-1">
                            {sanitizePaperText(q.passage)}
                          </div>
                        )}
                        {sanitizePaperText(q.question)}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 shrink-0">
                        [{q.marks || 1}M]
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(q.options || []).map((opt, oi) => {
                        const isPicked = chosen === oi;
                        const isRightOpt = oi === q.correctIndex;
                        let styleCls =
                          "bg-slate-900 border-slate-700 text-slate-200 hover:border-indigo-500";
                        if (practiceSubmitted && canRevealSolutions) {
                          if (isRightOpt) {
                            styleCls = "bg-emerald-950/70 border-emerald-500 text-emerald-200";
                          } else if (isPicked && !isRightOpt) {
                            styleCls = "bg-rose-950/70 border-rose-500 text-rose-200";
                          } else {
                            styleCls = "bg-slate-900/50 border-slate-800 text-slate-500";
                          }
                        } else if (isPicked) {
                          styleCls = "bg-indigo-600 border-indigo-400 text-white";
                        }

                        return (
                          <button
                            key={oi}
                            type="button"
                            disabled={practiceSubmitted}
                            onClick={() =>
                              setPracticeObjAnswers((prev) => ({ ...prev, [q.id]: oi }))
                            }
                            className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold transition flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default ${styleCls}`}
                          >
                            <span>
                              <strong className="mr-1.5">({OPTION_LETTERS[oi]})</strong>
                              {sanitizePaperText(opt)}
                            </span>
                            {practiceSubmitted && canRevealSolutions && isRightOpt && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            {practiceSubmitted && canRevealSolutions && isPicked && !isRightOpt && (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {practiceSubmitted && canRevealSolutions && (
                      <div
                        className={`text-[11px] rounded-lg px-2.5 py-1.5 ${
                          chosen === undefined
                            ? "bg-slate-900 text-slate-300"
                            : isCorrect
                            ? "bg-emerald-950/50 text-emerald-300"
                            : "bg-rose-950/50 text-rose-200"
                        }`}
                      >
                        <strong>
                          Correct Answer: ({OPTION_LETTERS[q.correctIndex || 0]})
                        </strong>{" "}
                        {q.explanation ? `— ${sanitizePaperText(q.explanation)}` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section B: Subjective Self-Practice */}
        {subjQs.length > 0 && (
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs sm:text-sm font-black uppercase text-sky-400">
                Section B — Subjective Written Practice ({subjQs.length} Questions)
              </h3>
              <span className="text-xs font-bold text-slate-400 tabular-nums">
                {subjAttemptedCount}/{subjQs.length} Drafted
              </span>
            </div>

            <div className="space-y-3">
              {subjQs.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2 text-xs sm:text-sm">
                    <div className="font-bold text-white whitespace-pre-line">
                      <span className="text-sky-400 mr-1.5">Q.{objQs.length + idx + 1}</span>
                      {q.passage && (
                        <div className="font-normal italic text-slate-400 text-xs border-l-2 border-slate-600 pl-2 my-1">
                          {sanitizePaperText(q.passage)}
                        </div>
                      )}
                      {sanitizePaperText(q.question)}
                    </div>
                    <span className="text-[11px] font-bold text-amber-400 shrink-0">
                      [{q.marks || 2}M]
                    </span>
                  </div>

                  {q.orQuestion && (
                    <div className="pl-3 border-l-2 border-indigo-500/50 text-xs text-slate-300 space-y-0.5">
                      <div className="text-[10px] font-black text-indigo-400 uppercase">
                        — OR / अथवा —
                      </div>
                      <div className="whitespace-pre-line">{sanitizePaperText(q.orQuestion)}</div>
                    </div>
                  )}

                  <textarea
                    rows={3}
                    disabled={practiceSubmitted}
                    value={practiceSubjNotes[q.id] || ""}
                    onChange={(e) =>
                      setPracticeSubjNotes((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="यहाँ अपना उत्तर अभ्यास के लिए लिखें (या कॉपी में लिखकर नीचे Submit करें)..."
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 p-2.5 text-xs text-white placeholder:text-slate-500 disabled:opacity-75"
                  />

                  {practiceSubmitted && canRevealSolutions && (q.modelAnswer || q.explanation) && (
                    <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-2.5 text-xs text-emerald-200 space-y-1">
                      <div className="font-extrabold text-emerald-300">Model Answer (Self-Check):</div>
                      <div className="whitespace-pre-line">
                        {sanitizePaperText(q.modelAnswer || q.explanation || "")}
                      </div>
                      {q.orQuestion && q.orModelAnswer && (
                        <div className="pt-1 border-t border-emerald-500/20 text-teal-200">
                          <strong>[OR Ans]:</strong> {sanitizePaperText(q.orModelAnswer)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── VIEW 2: SINGLE PAPER CLEAN READABLE PREVIEW & PDF DOWNLOAD ──────────────
  if (viewingPaper) {
    const objQs = viewingPaper.objectiveQuestions || [];
    const subjQs = viewingPaper.subjectiveQuestions || [];
    const canSeeKey = Boolean(viewingPaper.showAnswerKeyToStudents);

    return (
      <div className="space-y-4 animate-in fade-in pb-24">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-3.5">
          <button
            type="button"
            onClick={() => {
              setViewingPaper(null);
              setShowKeyTab(false);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Library</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleStartPracticeTest(viewingPaper)}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Practice Test</span>
            </button>
            {canSeeKey ? (
              <button
                type="button"
                onClick={() => setShowKeyTab((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                  showKeyTab
                    ? "bg-teal-500 text-slate-950"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{showKeyTab ? "Show Question Paper" : "View Answer Key"}</span>
              </button>
            ) : (
              <span className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-bold inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Answer Key Locked
              </span>
            )}
            <button
              type="button"
              disabled={busyDownloadId === `${viewingPaper.id}_qp`}
              onClick={() => void handleDownloadPdf(viewingPaper, false)}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {busyDownloadId === `${viewingPaper.id}_qp` ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Question Paper PDF</span>
            </button>
            {canSeeKey && (
              <button
                type="button"
                disabled={busyDownloadId === `${viewingPaper.id}_key`}
                onClick={() => void handleDownloadPdf(viewingPaper, true)}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {busyDownloadId === `${viewingPaper.id}_key` ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Answer Key PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handlePrintPaper(viewingPaper, false)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4</span>
            </button>
          </div>
        </div>

        {/* Clean White Printable Question Sheet View */}
        <div className="rounded-2xl bg-white text-slate-950 border border-slate-300 shadow-lg p-4 sm:p-6 space-y-4">
          <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
            <h2 className="text-base sm:text-xl font-black uppercase tracking-wide text-slate-950">
              {masthead.schoolName}
            </h2>
            {masthead.tagline && (
              <p className="text-xs italic font-semibold text-slate-700">{masthead.tagline}</p>
            )}
            {masthead.address && (
              <p className="text-[11px] font-medium text-slate-600">{masthead.address}</p>
            )}
            <div className="inline-block mt-1 px-3 py-1 rounded border border-slate-700 bg-slate-50 text-xs font-extrabold uppercase text-slate-950">
              {viewingPaper.paperTitle} • SESSION {viewingPaper.sessionLabel}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-300 text-xs font-bold text-slate-900">
              <span>Class: {formatEntranceClassLabel(viewingPaper.classLevel)}</span>
              <span>Subject: {viewingPaper.subjectLabel}</span>
              <span>Time: {formatDurationLabel(viewingPaper.durationMinutes)}</span>
              <span>F.M.: {viewingPaper.fullMarks}</span>
            </div>
          </div>

          {!showKeyTab ? (
            <div className="space-y-5">
              {objQs.length > 0 && (
                <div className="space-y-3">
                  <div className="px-3 py-1.5 bg-slate-100 border-y border-slate-900 text-xs font-extrabold uppercase flex justify-between text-slate-950">
                    <span>Section A — Objective Type Questions</span>
                    <span>
                      [{objQs.reduce((s, q) => s + Number(q.marks || 1), 0)} Marks]
                    </span>
                  </div>
                  <div className="space-y-3">
                    {objQs.map((q, idx) => (
                      <div
                        key={q.id || idx}
                        className="pb-2.5 border-b border-slate-100 space-y-1.5 text-xs sm:text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-slate-950 whitespace-pre-line">
                            <span className="mr-1.5">{idx + 1}.</span>
                            {q.passage && (
                              <div className="font-normal italic text-slate-700 text-xs border-l-2 border-slate-400 pl-2 mb-1">
                                {sanitizePaperText(q.passage)}
                              </div>
                            )}
                            {sanitizePaperText(q.question)}
                          </div>
                          <span className="font-extrabold text-xs text-slate-800 shrink-0">
                            [{q.marks || 1}]
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-5 text-xs text-slate-800">
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi}>
                              <strong className="mr-1">({OPTION_LETTERS[oi]})</strong>
                              {sanitizePaperText(opt)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {subjQs.length > 0 && (
                <div className="space-y-3">
                  <div className="px-3 py-1.5 bg-slate-100 border-y border-slate-900 text-xs font-extrabold uppercase flex justify-between text-slate-950">
                    <span>Section B — Subjective Type Questions</span>
                    <span>
                      [{subjQs.reduce((s, q) => s + Number(q.marks || 2), 0)} Marks]
                    </span>
                  </div>
                  <div className="space-y-3">
                    {subjQs.map((q, idx) => (
                      <div
                        key={q.id || idx}
                        className="pb-2.5 border-b border-slate-100 space-y-1.5 text-xs sm:text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-slate-950 whitespace-pre-line">
                            <span className="mr-1.5">{objQs.length + idx + 1}.</span>
                            {q.passage && (
                              <div className="font-normal italic text-slate-700 text-xs border-l-2 border-slate-400 pl-2 mb-1">
                                {sanitizePaperText(q.passage)}
                              </div>
                            )}
                            {sanitizePaperText(q.question)}
                          </div>
                          <span className="font-extrabold text-xs text-slate-800 shrink-0">
                            [{q.marks || 2}]
                          </span>
                        </div>
                        {q.orQuestion && (
                          <div className="pl-5 space-y-1">
                            <div className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                              — OR / अथवा —
                            </div>
                            <div className="font-bold text-slate-900 whitespace-pre-line">
                              {sanitizePaperText(q.orQuestion)}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-extrabold text-emerald-900">
                OFFICIAL ANSWER KEY &amp; MODEL ANSWERS
              </div>
              {objQs.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-extrabold uppercase text-slate-700">
                    Objective Answers
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {objQs.map((q, idx) => (
                      <div
                        key={q.id || idx}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                      >
                        <strong className="text-slate-900">Q.{idx + 1}:</strong>{" "}
                        <span className="font-bold text-emerald-700">
                          ({OPTION_LETTERS[q.correctIndex || 0]}){" "}
                          {sanitizePaperText((q.options || [])[q.correctIndex || 0] || "")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {subjQs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase text-slate-700">
                    Subjective Model Answers
                  </h4>
                  {subjQs.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1"
                    >
                      <div className="font-bold text-slate-900">
                        Q.{objQs.length + idx + 1}: {sanitizePaperText(q.question)}
                      </div>
                      <div className="text-emerald-800 font-semibold whitespace-pre-line">
                        Ans: {sanitizePaperText(q.modelAnswer || q.explanation || "")}
                      </div>
                      {q.orQuestion && q.orModelAnswer && (
                        <div className="text-teal-800 font-semibold whitespace-pre-line pt-1 border-t border-slate-200">
                          [OR Ans]: {sanitizePaperText(q.orModelAnswer)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <A4PrintPreviewOverlay
          isOpen={Boolean(printPreviewData)}
          title={printPreviewData?.title || "Question Paper A4"}
          pagesHtml={printPreviewData?.pagesHtml || []}
          scopedCss={printPreviewData?.fullCss || ""}
          docTitle={printPreviewData?.docTitle || "Question_Paper_A4"}
          orientation={printPreviewData?.orientation || "portrait"}
          onClose={() => setPrintPreviewData(null)}
          onDownloadPdfFallback={
            printPreviewData
              ? () => downloadCustomEntrancePaperPdf(printPreviewData.buildInput)
              : undefined
          }
        />
      </div>
    );
  }

  // ── VIEW 3: MAIN STUDENT DIGITAL QUESTION PAPER LIBRARY ─────────────────────
  return (
    <div className="space-y-4 animate-in fade-in pb-24">
      {/* Top Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 border border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer shrink-0 mt-0.5"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                Previous Year Question Papers
              </span>
              {detectedClass !== null && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/25 border border-indigo-400/30 text-indigo-200 text-[10px] font-bold inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Only {formatEntranceClassLabel(detectedClass)} Allowed</span>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{masthead.schoolName} — Digital Question Paper Library</span>
            </h2>
            <p className="text-xs text-slate-400">
              पिछले वर्षों के प्रश्न-पत्र देखें, PDF डाउनलोड करें, प्रिंट करें और टाइमर के साथ Practice Test का अभ्यास करें।
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadPapers()}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
        <div className="lg:col-span-3">
          <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Academic Session (Year)
          </label>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="w-full h-9 px-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold"
          >
            <option value="ALL">All Years / Sessions ({papers.length})</option>
            {sessionsList.map((s) => (
              <option key={s} value={s}>
                Session {s}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Exam Type
          </label>
          <select
            value={selectedExamFilter}
            onChange={(e) => setSelectedExamFilter(e.target.value)}
            className="w-full h-9 px-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold"
          >
            {EXAM_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
          <label className="block text-[11px] font-bold text-slate-400 mb-1">Subject</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full h-9 px-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold"
          >
            <option value="ALL">All Subjects</option>
            {subjectsList.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {detectedClass === null ? (
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full h-9 px-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold"
            >
              <option value="ALL">All Classes</option>
              {classesList.map((c) => (
                <option key={c} value={String(c)}>
                  {formatEntranceClassLabel(c)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-400 mb-1">Search Paper</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search exam, subject..."
                className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Papers Grid */}
      {loading ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-10 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span>Previous Year Papers लोड हो रहे हैं...</span>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-bold text-white">
            {detectedClass !== null
              ? `${formatEntranceClassLabel(detectedClass)} के लिए अभी कोई Published Paper उपलब्ध नहीं है`
              : "अभी कोई Published Question Paper उपलब्ध नहीं है"}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            जैसे ही स्कूल एडमिन या शिक्षक आपकी कक्षा का पेपर Publish करेंगे, वह तुरंत यहाँ PDF डाउनलोड और Practice Test के लिए दिखने लगेगा।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredPapers.map((p) => {
            const totalQs = (p.objectiveQuestions?.length || 0) + (p.subjectiveQuestions?.length || 0);
            const keyUnlocked = Boolean(p.showAnswerKeyToStudents);
            return (
              <div
                key={p.id}
                className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 p-4 space-y-3 transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold">
                        Available
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-extrabold">
                        {p.sessionLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold">
                        {EXAM_CATEGORY_LABELS[p.examCategory] || p.examCategory}
                      </span>
                    </div>
                    {p.paperIdCode && (
                      <span className="font-mono text-[10px] font-bold text-amber-300/90">
                        {p.paperIdCode}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      {formatEntranceClassLabel(p.classLevel)} – {p.subjectLabel}
                    </h3>
                    <p className="text-xs font-semibold text-indigo-300 mt-0.5">
                      {p.paperTitle} ({p.sessionLabel})
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                      {totalQs} Qs · F.M. {p.fullMarks}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      {formatDurationLabel(p.durationMinutes)}
                    </span>
                    {keyUnlocked ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                        <KeyRound className="w-3 h-3" /> Answer Key Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Lock className="w-3 h-3" /> Answer Key Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons Grid */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busyDownloadId === `${p.id}_qp`}
                      onClick={() => void handleDownloadPdf(p, false)}
                      className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {busyDownloadId === `${p.id}_qp` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Question Paper PDF</span>
                    </button>

                    {keyUnlocked ? (
                      <button
                        type="button"
                        disabled={busyDownloadId === `${p.id}_key`}
                        onClick={() => void handleDownloadPdf(p, true)}
                        className="py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        {busyDownloadId === `${p.id}_key` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5" />
                        )}
                        <span>Answer Key PDF</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePrintPaper(p, false)}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Print A4 Paper</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setViewingPaper(p);
                        setShowKeyTab(false);
                      }}
                      className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Paper</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartPracticeTest(p)}
                      className="py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Practice Test</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <A4PrintPreviewOverlay
        isOpen={Boolean(printPreviewData)}
        title={printPreviewData?.title || "Question Paper A4"}
        pagesHtml={printPreviewData?.pagesHtml || []}
        scopedCss={printPreviewData?.fullCss || ""}
        docTitle={printPreviewData?.docTitle || "Question_Paper_A4"}
        orientation={printPreviewData?.orientation || "portrait"}
        onClose={() => setPrintPreviewData(null)}
        onDownloadPdfFallback={
          printPreviewData
            ? () => downloadCustomEntrancePaperPdf(printPreviewData.buildInput)
            : undefined
        }
      />
    </div>
  );
};
