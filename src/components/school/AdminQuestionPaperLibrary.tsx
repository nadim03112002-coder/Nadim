import React, { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  Filter,
  History,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ALL_ENTRANCE_CLASSES,
  formatEntranceClassLabel,
  type EntranceClassNumber,
  type ExamCategoryType,
  type SavedSchoolQuestionPaper,
  type School,
} from "../../school-types";
import {
  deleteSavedSchoolQuestionPaper,
  duplicateSchoolQuestionPaper,
  getSavedSchoolQuestionPapers,
  restoreSchoolQuestionPaperVersion,
  togglePublishSchoolQuestionPaper,
} from "../../utils/entranceTestEngine";
import {
  buildCustomPaperHtmlBundle,
  downloadCustomEntrancePaperPdf,
  resolveExamPaperMasthead,
  type CustomPaperBuildInput,
  type PaperPrintTheme,
} from "../../utils/entrancePaperPdf";
import { mountAndPrintA4Sync } from "../../utils/a4PrintHelper";
import { A4PrintPreviewOverlay } from "./A4PrintPreviewOverlay";

interface Props {
  school: Partial<School> & { id: string; name?: string };
  refreshSignal?: number;
  onEditPaperInBuilder: (paper: SavedSchoolQuestionPaper) => void;
  onCreateNewPaper: (classLevel?: EntranceClassNumber) => void;
  onPapersCountChange?: (count: number) => void;
}

const EXAM_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Exam Types" },
  { value: "FINAL_YEAR", label: "Annual / Final Exam" },
  { value: "HALF_YEARLY", label: "Half-Yearly Exam" },
  { value: "UNIT_PA", label: "Periodic / Unit Test (PA 1–4)" },
  { value: "ENTRANCE", label: "Entrance Exam" },
  { value: "GENERAL", label: "Monthly / General Test" },
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

function formatDurationLabel(mins: number): string {
  const m = Math.max(15, Number(mins || 60));
  if (m >= 60 && m % 60 === 0) {
    const h = m / 60;
    return `${h} ${h === 1 ? "Hour" : "Hours"}`;
  }
  if (m > 60) {
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  return `${m} Mins`;
}

function getNextSessionLabel(currentSession: string): string {
  const m = String(currentSession || "").match(/(\d{4})\s*[-–]\s*(\d{2,4})/);
  if (m) {
    const y1 = Number(m[1]) + 1;
    const y2Short = String((y1 + 1) % 100).padStart(2, "0");
    return `${y1}-${y2Short}`;
  }
  return "2027-28";
}

function formatShortDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export const AdminQuestionPaperLibrary: React.FC<Props> = ({
  school,
  refreshSignal = 0,
  onEditPaperInBuilder,
  onCreateNewPaper,
  onPapersCountChange,
}) => {
  const schoolId = school?.id || "";
  const masthead = useMemo(() => resolveExamPaperMasthead(school), [school]);

  const [papers, setPapers] = useState<SavedSchoolQuestionPaper[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSession, setSelectedSession] = useState<string>("ALL");
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [busyPaperId, setBusyPaperId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [historyPaper, setHistoryPaper] = useState<SavedSchoolQuestionPaper | null>(null);
  const [cloneModalPaper, setCloneModalPaper] = useState<SavedSchoolQuestionPaper | null>(null);
  const [cloneSession, setCloneSession] = useState<string>("2027-28");
  const [cloneTitle, setCloneTitle] = useState<string>("");
  const [cloneExamCategory, setCloneExamCategory] = useState<ExamCategoryType>("FINAL_YEAR");
  const [cloning, setCloning] = useState<boolean>(false);

  const [printPreviewData, setPrintPreviewData] = useState<{
    title: string;
    pagesHtml: string[];
    fullCss: string;
    docTitle: string;
    orientation: "portrait" | "landscape";
    buildInput: CustomPaperBuildInput;
  } | null>(null);

  const loadArchive = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const all = await getSavedSchoolQuestionPapers(schoolId);
      setPapers(all);
      onPapersCountChange?.(all.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadArchive();
  }, [schoolId, refreshSignal]);

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

  // Papers filtered by session (used for Class-wise Library Grid counts)
  const sessionScopedPapers = useMemo(() => {
    if (selectedSession === "ALL") return papers;
    return papers.filter((p) => p.sessionLabel === selectedSession);
  }, [papers, selectedSession]);

  const classCounts = useMemo(() => {
    const map = new Map<EntranceClassNumber, { total: number; published: number }>();
    ALL_ENTRANCE_CLASSES.forEach((cls) => map.set(cls, { total: 0, published: 0 }));
    sessionScopedPapers.forEach((p) => {
      const key = Number(p.classLevel) as EntranceClassNumber;
      const cur = map.get(key) || { total: 0, published: 0 };
      cur.total += 1;
      if (p.isPublished) cur.published += 1;
      map.set(key, cur);
    });
    return map;
  }, [sessionScopedPapers]);

  const filteredPapers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sessionScopedPapers.filter((p) => {
      if (selectedClass !== "ALL" && String(p.classLevel) !== selectedClass) return false;
      if (selectedSubject !== "ALL" && p.subjectLabel !== selectedSubject) return false;
      if (statusFilter === "PUBLISHED" && !p.isPublished) return false;
      if (statusFilter === "DRAFT" && p.isPublished) return false;
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
  }, [
    sessionScopedPapers,
    selectedClass,
    selectedSubject,
    statusFilter,
    selectedExamFilter,
    searchQuery,
  ]);

  const kpiStats = useMemo(() => {
    const total = sessionScopedPapers.length;
    const published = sessionScopedPapers.filter((p) => p.isPublished).length;
    const drafts = total - published;
    const totalQs = sessionScopedPapers.reduce(
      (sum, p) => sum + (p.objectiveQuestions?.length || 0) + (p.subjectiveQuestions?.length || 0),
      0
    );
    const activeClasses = Array.from(classCounts.values()).filter((c) => c.total > 0).length;
    return { total, published, drafts, totalQs, activeClasses };
  }, [sessionScopedPapers, classCounts]);

  const buildInputFromSavedPaper = (
    paper: SavedSchoolQuestionPaper,
    mode: "full" | "questions_only"
  ): CustomPaperBuildInput => ({
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
    showWritingLines: paper.classLevel <= 0,
    manualPageOverrides: paper.manualPageOverrides,
    mode,
  });

  const handlePrintPaper = (paper: SavedSchoolQuestionPaper, mode: "full" | "questions_only") => {
    try {
      const input = buildInputFromSavedPaper(paper, mode);
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
      toast.error("प्रिंट करने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    }
  };

  const handleDownloadPdf = async (
    paper: SavedSchoolQuestionPaper,
    mode: "full" | "questions_only"
  ) => {
    setBusyPaperId(`${paper.id}_${mode}`);
    try {
      await downloadCustomEntrancePaperPdf(buildInputFromSavedPaper(paper, mode));
      toast.success(
        mode === "full"
          ? "Question Paper + Answer Key PDF डाउनलोड हो गया!"
          : "Question Paper PDF डाउनलोड हो गया!"
      );
    } catch (err: any) {
      toast.error("PDF डाउनलोड त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    } finally {
      setBusyPaperId(null);
    }
  };

  const handleExportJson = (paper: SavedSchoolQuestionPaper) => {
    try {
      const payload = {
        archiveMeta: {
          paperIdCode: paper.paperIdCode || paper.id,
          schoolName: masthead.schoolName,
          session: paper.sessionLabel,
          classLevel: paper.classLevel,
          classLabel: formatEntranceClassLabel(paper.classLevel),
          subject: paper.subjectLabel,
          examType: paper.examCategory,
          paperTitle: paper.paperTitle,
          totalMarks: paper.fullMarks,
          durationMinutes: paper.durationMinutes,
          version: paper.version || 1,
          exportedAt: new Date().toISOString(),
        },
        settings: {
          paperCode: paper.paperCode,
          examDate: paper.examDate,
          generalInstructions: paper.generalInstructions || [],
          cbseRulesMode: paper.cbseRulesMode || "auto",
          customBoardRulesHi: paper.customBoardRulesHi || [],
          customBoardRulesEn: paper.customBoardRulesEn || [],
          printOrientation: paper.printOrientation || "portrait",
          fontSizePx: paper.fontSizePx,
          manualPageOverrides: paper.manualPageOverrides || {},
        },
        questions: [
          ...(paper.objectiveQuestions || []).map((q) => ({
            kind: "OBJECTIVE",
            subject: q.subject,
            marks: q.marks || 1,
            passage: q.passage,
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
          })),
          ...(paper.subjectiveQuestions || []).map((q) => ({
            kind: "SUBJECTIVE",
            subject: q.subject,
            marks: q.marks || 2,
            passage: q.passage,
            question: q.question,
            modelAnswer: q.modelAnswer || q.explanation,
            orQuestion: q.orQuestion,
            orModelAnswer: q.orModelAnswer,
          })),
        ],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(paper.paperIdCode || paper.paperTitle).replace(/[^a-zA-Z0-9_-]+/g, "_")}_v${paper.version || 1}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Original JSON Archive फ़ाइल डाउनलोड हो गई!");
    } catch {
      toast.error("JSON Export करने में त्रुटि हुई।");
    }
  };

  const handleTogglePublish = async (
    paper: SavedSchoolQuestionPaper,
    nextPublished: boolean,
    nextShowKey?: boolean
  ) => {
    setBusyPaperId(`${paper.id}_pub`);
    try {
      const updated = await togglePublishSchoolQuestionPaper(
        schoolId,
        paper.id,
        nextPublished,
        nextShowKey
      );
      if (updated) {
        setPapers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        toast.success(
          nextShowKey !== undefined
            ? nextShowKey
              ? "Students के लिए Answer Key अनलॉक कर दी गई!"
              : "Students के लिए Answer Key लॉक (छुपा) दी गई!"
            : nextPublished
            ? `Published! अब ${formatEntranceClassLabel(paper.classLevel)} के Students यह पेपर देख व डाउनलोड कर सकते हैं।`
            : "Draft में भेजा गया — अब केवल Admin को दिखेगा।"
        );
      }
    } finally {
      setBusyPaperId(null);
    }
  };

  const handleOpenCloneModal = (paper: SavedSchoolQuestionPaper) => {
    setCloneModalPaper(paper);
    setCloneSession(getNextSessionLabel(paper.sessionLabel));
    setCloneTitle(paper.paperTitle);
    setCloneExamCategory(paper.examCategory || "FINAL_YEAR");
  };

  const handleConfirmCloneAndEdit = async () => {
    if (!cloneModalPaper || !schoolId) return;
    setCloning(true);
    try {
      const cloned = await duplicateSchoolQuestionPaper(schoolId, cloneModalPaper, {
        sessionLabel: cloneSession.trim() || cloneModalPaper.sessionLabel,
        paperTitle: cloneTitle.trim() || cloneModalPaper.paperTitle,
        examCategory: cloneExamCategory,
        schoolCode: school?.code,
        schoolName: masthead.schoolName,
      });
      setPapers((prev) => {
        const next = [cloned, ...prev];
        onPapersCountChange?.(next.length);
        return next;
      });
      setCloneModalPaper(null);
      toast.success(
        `नया पेपर कॉपी तैयार (${cloned.paperIdCode} · ${cloned.sessionLabel}) — अब Builder में हर चीज़ अपडेट करें!`
      );
      onEditPaperInBuilder(cloned);
    } catch (err: any) {
      toast.error("कॉपी बनाने में त्रुटि: " + (err?.message || "पुनः प्रयास करें"));
    } finally {
      setCloning(false);
    }
  };

  const handleRestoreVersion = async (paper: SavedSchoolQuestionPaper, targetVersion: number) => {
    setBusyPaperId(`${paper.id}_restore_${targetVersion}`);
    try {
      const restored = await restoreSchoolQuestionPaperVersion(schoolId, paper.id, targetVersion);
      if (restored) {
        setPapers((prev) => prev.map((p) => (p.id === restored.id ? restored : p)));
        setHistoryPaper(restored);
        toast.success(`Version v${targetVersion} को नए Version v${restored.version} के रूप में Restore कर दिया गया!`);
      }
    } finally {
      setBusyPaperId(null);
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    setBusyPaperId(`${paperId}_del`);
    try {
      await deleteSavedSchoolQuestionPaper(schoolId, paperId);
      setPapers((prev) => {
        const next = prev.filter((p) => p.id !== paperId);
        onPapersCountChange?.(next.length);
        return next;
      });
      setConfirmDeleteId(null);
      toast.success("Archived paper हटा दिया गया।");
    } finally {
      setBusyPaperId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#070D19] via-slate-900 to-indigo-950 text-white border border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
              <Archive className="w-3 h-3" />
              <span>Admin Archive · Unified School Database</span>
            </div>
            <h2 className="text-base sm:text-xl font-black tracking-tight text-white">
              {masthead.schoolName} — Digital Question Paper Library
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              साल-दर-साल सभी कक्षाओं के Question Papers, Answer Keys और Original JSON सुरक्षित रखें — कभी भी Edit करें, नया Version सेव करें या अगले Session के लिए दोबारा इस्तेमाल करें।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadArchive()}
              disabled={loading}
              className="h-9 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onCreateNewPaper(
                  selectedClass !== "ALL" ? (Number(selectedClass) as EntranceClassNumber) : undefined
                )
              }
              className="h-9 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Paper</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sky-400" />
              <span>Academic Session</span>
            </div>
            <div className="text-lg font-black text-white mt-0.5 tabular-nums">
              {selectedSession === "ALL" ? `All (${sessionsList.length || 1} Yr)` : selectedSession}
            </div>
            <div className="text-[10px] text-slate-400">पुराने सत्र कभी ऑटो-डिलीट नहीं होते</div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <FileText className="w-3 h-3 text-amber-400" />
              <span>Saved Papers</span>
            </div>
            <div className="text-lg font-black text-white mt-0.5 tabular-nums">
              {kpiStats.total}
            </div>
            <div className="text-[10px] text-emerald-300 font-semibold tabular-nums">
              {kpiStats.published} Published · {kpiStats.drafts} Draft
            </div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>Classes Covered</span>
            </div>
            <div className="text-lg font-black text-white mt-0.5 tabular-nums">
              {kpiStats.activeClasses} / {ALL_ENTRANCE_CLASSES.length}
            </div>
            <div className="text-[10px] text-slate-400">Nursery से Class 10 तक</div>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-emerald-400" />
              <span>Archived Questions</span>
            </div>
            <div className="text-lg font-black text-white mt-0.5 tabular-nums">
              {kpiStats.totalQs}
            </div>
            <div className="text-[10px] text-slate-400">Full JSON + Version Safe</div>
          </div>
        </div>
      </div>

      {/* Class-Wise Library Grid */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-950 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Class-wise Library (कक्षा के अनुसार पेपर संग्रह)</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              किसी भी कक्षा पर क्लिक करें और उसके सभी सेव किए गए पेपर तुरंत देखें।
            </p>
          </div>
          {selectedClass !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedClass("ALL")}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Show All Classes
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
          <button
            type="button"
            onClick={() => setSelectedClass("ALL")}
            className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
              selectedClass === "ALL"
                ? "bg-[#070D19] text-white border-[#070D19] shadow-xs"
                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-slate-900 dark:text-slate-100"
            }`}
          >
            <div className="text-xs font-extrabold">All Classes</div>
            <div
              className={`text-[10px] font-bold mt-1 tabular-nums ${
                selectedClass === "ALL" ? "text-amber-300" : "text-indigo-600 dark:text-indigo-400"
              }`}
            >
              {kpiStats.total} Saved Papers →
            </div>
          </button>

          {ALL_ENTRANCE_CLASSES.map((cls) => {
            const info = classCounts.get(cls) || { total: 0, published: 0 };
            const active = selectedClass === String(cls);
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedClass(String(cls))}
                className={`rounded-xl border p-2.5 text-left transition cursor-pointer ${
                  active
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                    : info.total > 0
                    ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900 hover:border-indigo-500 text-slate-900 dark:text-slate-100"
                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-400 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold">{formatEntranceClassLabel(cls)}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black tabular-nums ${
                      active
                        ? "bg-white/20 text-white"
                        : info.total > 0
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {info.total}
                  </span>
                </div>
                <div
                  className={`text-[10px] font-semibold mt-1 ${
                    active ? "text-indigo-100" : info.total > 0 ? "text-indigo-700 dark:text-indigo-300" : "text-slate-400"
                  }`}
                >
                  {info.total > 0 ? "View Papers →" : "No papers yet"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-Filter Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
            Academic Session
          </label>
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="ALL">All Sessions ({papers.length})</option>
            {sessionsList.map((s) => (
              <option key={s} value={s}>
                Session {s}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
            Exam Type
          </label>
          <select
            value={selectedExamFilter}
            onChange={(e) => setSelectedExamFilter(e.target.value)}
            className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
          >
            {EXAM_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
            Subject
          </label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="ALL">All Subjects</option>
            {subjectsList.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
            Visibility Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "PUBLISHED" | "DRAFT")}
            className="w-full h-9 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="ALL">All (Draft + Published)</option>
            <option value="PUBLISHED">Published (Students Live)</option>
            <option value="DRAFT">Draft (Admin Only)</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
            Search Paper ID / Title / Subject
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., LMPS-10-SCI-001, Science, Annual..."
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Saved Papers List */}
      {loading ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Digital Question Paper Library लोड हो रही है...</span>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2.5">
          <Archive className="w-9 h-9 text-slate-400 mx-auto" />
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">
            {papers.length === 0
              ? "अभी लाइब्रेरी में कोई Question Paper सेव नहीं है"
              : "इस फ़िल्टर के अनुसार कोई पेपर नहीं मिला"}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {papers.length === 0
              ? "Paper Builder में पेपर बनाकर 'Save Paper' या 'Publish to Students' दबाएँ — वह तुरंत यहाँ हमेशा के लिए सुरक्षित हो जाएगा।"
              : "अन्य Session, Class या Exam Type फ़िल्टर बदलकर देखें।"}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {papers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSession("ALL");
                  setSelectedClass("ALL");
                  setSelectedExamFilter("ALL");
                  setSelectedSubject("ALL");
                  setStatusFilter("ALL");
                  setSearchQuery("");
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onCreateNewPaper(
                  selectedClass !== "ALL" ? (Number(selectedClass) as EntranceClassNumber) : undefined
                )
              }
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Open Paper Builder</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPapers.map((p) => {
            const objCount = p.objectiveQuestions?.length || 0;
            const subjCount = p.subjectiveQuestions?.length || 0;
            const totalQs = objCount + subjCount;
            const historyCount = p.versionHistory?.length || 0;
            const isDeleting = confirmDeleteId === p.id;

            return (
              <div
                key={p.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400/70 p-4 space-y-3 transition"
              >
                {/* Card Top Metadata */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-800 text-amber-300 font-mono text-[10px] font-black">
                        {p.paperIdCode || p.id.slice(0, 12).toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-extrabold">
                        {formatEntranceClassLabel(p.classLevel)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-extrabold">
                        Session {p.sessionLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-bold">
                        {EXAM_CATEGORY_LABELS[p.examCategory] || p.examCategory}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 text-[10px] font-extrabold">
                        v{p.version || 1}
                      </span>
                      {p.isPublished ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Published (Students Live)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[10px] font-extrabold inline-flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Draft (Admin Only)
                        </span>
                      )}
                      {p.isPublished && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold inline-flex items-center gap-1 ${
                            p.showAnswerKeyToStudents
                              ? "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300"
                              : "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300"
                          }`}
                        >
                          {p.showAnswerKeyToStudents ? (
                            <>
                              <Unlock className="w-3 h-3" /> Key Visible
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" /> Key Hidden
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <h4 className="text-sm sm:text-base font-black text-slate-950 dark:text-white">
                        {p.paperTitle}
                      </h4>
                      <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400">
                        · {p.subjectLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        <strong>F.M.:</strong> {p.fullMarks} Marks
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDurationLabel(p.durationMinutes)}
                      </span>
                      <span>
                        <strong>{totalQs} Qs</strong> ({objCount} Obj · {subjCount} Subj)
                      </span>
                      <span>
                        Layout:{" "}
                        <strong>
                          {p.printOrientation === "landscape_booklet"
                            ? "Landscape 2-Up"
                            : "Portrait A4"}
                        </strong>
                        {p.fontSizePx ? ` (${p.fontSizePx.toFixed(1)}px)` : ""}
                      </span>
                      <span>Updated: {formatShortDateTime(p.updatedAt || p.createdAt)}</span>
                    </div>
                  </div>

                  {/* Security Visibility Toggles */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busyPaperId === `${p.id}_pub`}
                      onClick={() => void handleTogglePublish(p, !p.isPublished)}
                      className={`h-8 px-3 rounded-xl text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                        p.isPublished
                          ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {p.isPublished ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Move to Draft</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Publish to Students</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={busyPaperId === `${p.id}_pub`}
                      onClick={() =>
                        void handleTogglePublish(p, p.isPublished, !p.showAnswerKeyToStudents)
                      }
                      className={`h-8 px-2.5 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 ${
                        p.showAnswerKeyToStudents
                          ? "bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-200"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                      title="परीक्षा से पहले Answer Key को छात्रों के लिए छुपा कर रखें"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{p.showAnswerKeyToStudents ? "Hide Key" : "Unlock Key"}</span>
                    </button>
                  </div>
                </div>

                {/* Action Controls Strip */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEditPaperInBuilder(p)}
                      className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit & Update in Builder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCloneModal(p)}
                      className="h-8 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Reuse as New Copy</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrintPaper(p, "questions_only")}
                      className="h-8 px-2.5 rounded-xl bg-[#070D19] hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Print A4</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyPaperId === `${p.id}_questions_only`}
                      onClick={() => void handleDownloadPdf(p, "questions_only")}
                      className="h-8 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      {busyPaperId === `${p.id}_questions_only` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>Q-Paper PDF</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyPaperId === `${p.id}_full`}
                      onClick={() => void handleDownloadPdf(p, "full")}
                      className="h-8 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      {busyPaperId === `${p.id}_full` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>Paper + Key PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportJson(p)}
                      className="h-8 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                      title="Original JSON Backup डाउनलोड करें"
                    >
                      <FileCode2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>JSON</span>
                    </button>

                    {historyCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setHistoryPaper(p)}
                        className="h-8 px-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Versions ({historyCount + 1})</span>
                      </button>
                    )}
                  </div>

                  {/* Safe 2-step Delete */}
                  <div>
                    {isDeleting ? (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-rose-600">Delete?</span>
                        <button
                          type="button"
                          disabled={busyPaperId === `${p.id}_del`}
                          onClick={() => void handleDeletePaper(p.id)}
                          className="h-7 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black cursor-pointer"
                        >
                          Yes, Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-7 px-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="h-8 px-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        title="Archive से हटाएँ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reuse / Clone Paper for New Session Modal */}
      {cloneModalPaper && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-[#070D19] text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black flex items-center gap-1.5">
                  <Copy className="w-4 h-4 text-sky-400" />
                  <span>Reuse Paper as New Copy</span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  पुराना पेपर ({cloneModalPaper.paperIdCode || cloneModalPaper.sessionLabel}) सुरक्षित रहेगा — नई कॉपी Builder में खुलेगी।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCloneModalPaper(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  New Academic Session (नया सत्र)
                </label>
                <input
                  type="text"
                  value={cloneSession}
                  onChange={(e) => setCloneSession(e.target.value)}
                  placeholder="e.g., 2027-28"
                  className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Exam Type
                </label>
                <select
                  value={cloneExamCategory}
                  onChange={(e) => setCloneExamCategory(e.target.value as ExamCategoryType)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="FINAL_YEAR">Annual / Final Exam</option>
                  <option value="HALF_YEARLY">Half-Yearly Exam</option>
                  <option value="PA1">PA-1 / Unit Test 1</option>
                  <option value="PA2">PA-2 / Unit Test 2</option>
                  <option value="PA3">PA-3 / Unit Test 3</option>
                  <option value="PA4">PA-4 / Unit Test 4</option>
                  <option value="ENTRANCE">Entrance Exam</option>
                  <option value="GENERAL">Monthly / General Test</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  New Paper Title
                </label>
                <input
                  type="text"
                  value={cloneTitle}
                  onChange={(e) => setCloneTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloneModalPaper(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cloning}
                onClick={() => void handleConfirmCloneAndEdit()}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {cloning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Create Copy & Edit in Builder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {historyPaper && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-4 py-3 bg-[#070D19] text-white flex items-center justify-between shrink-0">
              <div>
                <h4 className="text-sm font-black flex items-center gap-1.5">
                  <History className="w-4 h-4 text-violet-400" />
                  <span>Version History · {historyPaper.paperIdCode || historyPaper.paperTitle}</span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  हर अपडेट का सुरक्षित इतिहास — किसी भी पुराने Version को 1 क्लिक में Restore करें।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryPaper(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
              {/* Current Active Version */}
              <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 flex items-center justify-between gap-2">
                <div className="space-y-0.5 text-xs">
                  <div className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <span>Version v{historyPaper.version || 1} (Current Active)</span>
                  </div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-300">
                    {historyPaper.paperTitle} · Session {historyPaper.sessionLabel} · F.M.{" "}
                    {historyPaper.fullMarks} ·{" "}
                    {(historyPaper.objectiveQuestions?.length || 0) +
                      (historyPaper.subjectiveQuestions?.length || 0)}{" "}
                    Qs
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Updated: {formatShortDateTime(historyPaper.updatedAt)}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black shrink-0">
                  ACTIVE
                </span>
              </div>

              {(historyPaper.versionHistory || []).map((snap) => {
                const qTotal =
                  (snap.objectiveQuestions?.length || 0) + (snap.subjectiveQuestions?.length || 0);
                return (
                  <div
                    key={`${snap.version}_${snap.savedAt}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5 text-xs">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        Version v{snap.version}
                        {snap.note ? (
                          <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                            ({snap.note})
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {snap.paperTitle} · Session {snap.sessionLabel} · F.M. {snap.fullMarks} ·{" "}
                        {qTotal} Qs
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Saved: {formatShortDateTime(snap.savedAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyPaperId === `${historyPaper.id}_restore_${snap.version}`}
                      onClick={() => void handleRestoreVersion(historyPaper, snap.version)}
                      className="h-8 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore v{snap.version}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
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
