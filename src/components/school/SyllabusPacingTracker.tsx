// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  TrendingUp,
  User,
  Calendar,
  Printer,
  Download,
  Loader2,
  X,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  PenTool,
  Plus,
} from "lucide-react";
import type { School, SchoolClass, SchoolSubject, SubjectSyllabusPacing } from "../../school-types";
import { loadSchoolSubcollection, syncSchoolSubcollection } from "../../utils/schoolCloudSync";
import {
  type SubjectLessonPlan,
  type DailyTeachingLog,
  SYLLABUS_LOG_EVENT,
  loadCurriculumLessons,
  loadDailyTeachingLogs,
  computeLessonPacingStats,
  formatShortDisplayDate,
} from "../../utils/schoolSyllabusLogEngine";
import { PeriodTeachingLogModal } from "./PeriodTeachingLogModal";
import { printElementInIframe } from "./AdmissionFormPrintModal";
import { exportElementToPdf } from "../../utils/universalPdfExport";

interface Props {
  school: School;
  classes?: SchoolClass[];
  subjects?: SchoolSubject[];
  onBack?: () => void;
}

const DEFAULT_PACING_DATA: SubjectSyllabusPacing[] = [
  {
    id: "pace_c10_sci",
    schoolId: "demo_school",
    classId: "cls_10",
    className: "Class 10",
    subject: "Science (Physics, Chemistry, Biology)",
    teacherName: "Mr. Rakesh Sharma",
    totalChapters: 16,
    targetCompletionDate: "2027-01-15",
    pacingStatus: "LAGGING",
    backlogChaptersCount: 2,
    updatedAt: "2026-11-10",
    chapters: [
      { chapterNo: 1, title: "Chemical Reactions and Equations", targetMonth: "April", status: "COMPLETED", completedDate: "2026-04-25" },
      { chapterNo: 2, title: "Acids, Bases and Salts", targetMonth: "May", status: "COMPLETED", completedDate: "2026-05-20" },
      { chapterNo: 3, title: "Metals and Non-metals", targetMonth: "July", status: "COMPLETED", completedDate: "2026-07-28" },
      { chapterNo: 4, title: "Carbon and its Compounds", targetMonth: "August", status: "COMPLETED", completedDate: "2026-08-30" },
      { chapterNo: 5, title: "Life Processes (Nutrition & Respiration)", targetMonth: "September", status: "COMPLETED", completedDate: "2026-09-24" },
      { chapterNo: 6, title: "Control and Coordination", targetMonth: "October", status: "COMPLETED", completedDate: "2026-10-22" },
      { chapterNo: 7, title: "How do Organisms Reproduce?", targetMonth: "October", status: "IN_PROGRESS" },
      { chapterNo: 8, title: "Heredity and Evolution", targetMonth: "November", status: "PENDING" },
    ],
  },
];

export const SyllabusPacingTracker: React.FC<Props> = ({
  school,
  classes = [],
  subjects = [],
  onBack,
}) => {
  const isDemo = Boolean(school?.id && (school.id === "demo_school" || school.id.startsWith("demo_")));

  // Active tab: live auto-tracked syllabus vs legacy manual checklist
  const [activeMode, setActiveMode] = useState<"live_auto" | "legacy_manual">("live_auto");

  // Live auto-synced curriculum lessons & daily teaching logs
  const [lessons, setLessons] = useState<SubjectLessonPlan[]>([]);
  const [logs, setLogs] = useState<DailyTeachingLog[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [filterClassId, setFilterClassId] = useState<string>("ALL");
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>("");
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const loadLivePacing = async () => {
    if (!school?.id) return;
    setLoadingLive(true);
    try {
      const [ls, lg] = await Promise.all([
        loadCurriculumLessons(school.id),
        loadDailyTeachingLogs(school.id),
      ]);
      setLessons(ls);
      setLogs(lg);
    } finally {
      setLoadingLive(false);
    }
  };

  useEffect(() => {
    void loadLivePacing();
    const handler = () => {
      void loadLivePacing();
    };
    window.addEventListener(SYLLABUS_LOG_EVENT, handler);
    return () => window.removeEventListener(SYLLABUS_LOG_EVENT, handler);
  }, [school?.id]);

  const { lessonStats, subjectSummaries } = useMemo(
    () => computeLessonPacingStats(lessons, logs),
    [lessons, logs]
  );

  const filteredSubjectSummaries = useMemo(() => {
    if (filterClassId === "ALL") return subjectSummaries;
    return subjectSummaries.filter((s) => s.classId === filterClassId);
  }, [subjectSummaries, filterClassId]);

  useEffect(() => {
    if (filteredSubjectSummaries.length === 0) {
      setSelectedSubjectKey("");
      return;
    }
    if (!filteredSubjectSummaries.some((s) => s.key === selectedSubjectKey)) {
      setSelectedSubjectKey(filteredSubjectSummaries[0].key);
    }
  }, [filteredSubjectSummaries, selectedSubjectKey]);

  const activeSubjectSummary = useMemo(
    () => filteredSubjectSummaries.find((s) => s.key === selectedSubjectKey) || filteredSubjectSummaries[0] || null,
    [filteredSubjectSummaries, selectedSubjectKey]
  );

  // Aggregate live KPIs
  const liveKpis = useMemo(() => {
    const totalLessons = lessonStats.length;
    const completedLessons = lessonStats.filter((l) => l.status === "COMPLETED").length;
    const runningLessons = lessonStats.filter((l) => l.status === "RUNNING").length;
    const avgPct =
      totalLessons > 0
        ? Math.round(lessonStats.reduce((a, b) => a + b.percentComplete, 0) / totalLessons)
        : 0;
    const totalPics = logs.reduce((a, l) => a + (l.noteImages?.length || 0), 0);
    const totalLogDates = new Set(logs.map((l) => l.date).filter(Boolean)).size;
    return { totalLessons, completedLessons, runningLessons, avgPct, totalPics, totalLogDates };
  }, [lessonStats, logs]);

  // ── LEGACY MANUAL PACING STATE (Preserved for backward compatibility) ──
  const [pacingList, setPacingList] = useState<SubjectSyllabusPacing[]>(() => {
    try {
      const saved = localStorage.getItem(`syllabus_pacing_${school?.id || "demo"}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return isDemo ? DEFAULT_PACING_DATA : [];
  });
  const [selectedPacingId, setSelectedPacingId] = useState<string>(pacingList[0]?.id || "");

  useEffect(() => {
    let active = true;
    const sid = school?.id;
    if (!sid) return;
    loadSchoolSubcollection<SubjectSyllabusPacing>(sid, "syllabus_pacing", `syllabus_pacing_${sid || "demo"}`).then((data) => {
      if (active && data.length > 0) {
        setPacingList(data);
        setSelectedPacingId((prev) => prev || data[0]?.id || "");
      }
    });
    return () => { active = false; };
  }, [school?.id]);

  const activePacing = pacingList.find((p) => p.id === selectedPacingId) || pacingList[0];

  const savePacingList = (updated: SubjectSyllabusPacing[]) => {
    setPacingList(updated);
    try {
      localStorage.setItem(`syllabus_pacing_${school?.id || "demo"}`, JSON.stringify(updated));
    } catch {}
    syncSchoolSubcollection(school?.id, "syllabus_pacing", updated);
  };

  const handleToggleChapterStatus = (pacingId: string, chapterNo: number) => {
    const updated = pacingList.map((p) => {
      if (p.id !== pacingId) return p;
      const newChapters = p.chapters.map((ch) => {
        if (ch.chapterNo !== chapterNo) return ch;
        const nextStatus = ch.status === "PENDING" ? "IN_PROGRESS" : ch.status === "IN_PROGRESS" ? "COMPLETED" : "PENDING";
        return {
          ...ch,
          status: nextStatus,
          completedDate: nextStatus === "COMPLETED" ? new Date().toISOString().split("T")[0] : undefined,
        };
      });
      const completedCount = newChapters.filter((c) => c.status === "COMPLETED").length;
      return {
        ...p,
        chapters: newChapters,
        pacingStatus: completedCount === p.totalChapters ? "COMPLETED" : "ON_TRACK",
        updatedAt: new Date().toISOString().split("T")[0],
      };
    });
    savePacingList(updated);
    toast.success(`Chapter #${chapterNo} status updated.`);
  };

  const trackerPrintRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handlePrintTracker = () => {
    printElementInIframe(
      trackerPrintRef.current,
      `Syllabus_Pacing_${school?.name || "School"}`,
      "",
      "portrait"
    );
  };

  const handleDownloadTrackerPdf = async () => {
    if (!trackerPrintRef.current || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await exportElementToPdf(trackerPrintRef.current, {
        filename: `Syllabus_Pacing_${school?.name || "School"}`,
        format: "a4",
        orientation: "portrait",
        pageMode: "auto_slice",
        widthPx: 900,
        scale: 1.8,
      });
    } catch (err) {
      console.warn("Syllabus pacing PDF failed, falling back to print:", err);
      handlePrintTracker();
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div ref={trackerPrintRef} className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 text-white shadow-2xl space-y-5 print:bg-white print:text-slate-900 print:border-slate-300 print:shadow-none print:rounded-none print:p-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 print:border-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 print:hidden">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-2xl font-black text-white print:text-slate-900">
                Syllabus Pacing Tracker (ऑटो-सिंक पाठ्यक्रम प्रगति)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 print:hidden">
                Auto-Tracked from Daily Teaching
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600">
              {school?.name || "School"} — Kaunsa Lesson kis date se start hua, kitne din padhai hui, kitna % complete hua &amp; daily notes pics audit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Log Teaching / Exercise</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTrackerPdf}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold transition cursor-pointer shadow"
          >
            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{downloadingPdf ? "Saving..." : "Download PDF"}</span>
          </button>
          <button
            type="button"
            onClick={handlePrintTracker}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Tabs + Class Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="inline-flex p-1 rounded-xl bg-slate-800 border border-slate-700 self-start">
          <button
            type="button"
            onClick={() => setActiveMode("live_auto")}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
              activeMode === "live_auto"
                ? "bg-teal-600 text-white shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            ⚡ Live Auto Pacing ({subjectSummaries.length} Subjects)
          </button>
          {pacingList.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveMode("legacy_manual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                activeMode === "legacy_manual"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Manual Chapters ({pacingList.length})
            </button>
          )}
        </div>

        {activeMode === "live_auto" && classes.length > 0 && (
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white"
          >
            <option value="ALL">All Classes ({classes.length})</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.section ? `(${c.section})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {activeMode === "live_auto" ? (
        <>
          {/* Live KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Overall Syllabus</p>
              <p className="text-2xl font-black text-teal-400 mt-1 tabular-nums">{liveKpis.avgPct}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {liveKpis.completedLessons} Done · {liveKpis.runningLessons} Running
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Structured Lessons</p>
              <p className="text-2xl font-black text-indigo-400 mt-1 tabular-nums">{liveKpis.totalLessons}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Across {subjectSummaries.length} Subjects
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Active Teaching Days</p>
              <p className="text-2xl font-black text-amber-400 mt-1 tabular-nums">{liveKpis.totalLogDates}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{logs.length} Period Logs</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Notes &amp; Exercise Pics</p>
              <p className="text-2xl font-black text-emerald-400 mt-1 tabular-nums">{liveKpis.totalPics}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Synced to Students</p>
            </div>
          </div>

          {loadingLive ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Loading live syllabus progress...
            </div>
          ) : filteredSubjectSummaries.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-800/50 border border-dashed border-slate-700 text-center space-y-2">
              <Layers className="w-9 h-9 text-teal-400 mx-auto" />
              <p className="text-sm font-black text-white">
                Abhi koi Lesson / Topic Plan add nahi hua hai
              </p>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                <strong>Classes &amp; Sections → Subjects</strong> me jaakar kisi bhi Subject ke andar <strong>Lessons &amp; Topics</strong> add karein — ya upar <strong>"Log Teaching / Exercise"</strong> par click karein. Har din jab teacher topics tick karenge, yahan automatic Start Date, Kitne Din Padhai Hui aur % Complete track hota rahega!
              </p>
              <button
                type="button"
                onClick={() => setShowLogModal(true)}
                className="mt-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black cursor-pointer"
              >
                + First Lesson &amp; Daily Log Add Karein
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Sidebar: Subject Cards */}
              <div className="lg:col-span-4 space-y-2.5">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">
                  Subjects ({filteredSubjectSummaries.length})
                </p>
                {filteredSubjectSummaries.map((sub) => {
                  const isActive = activeSubjectSummary?.key === sub.key;
                  return (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => {
                        setSelectedSubjectKey(sub.key);
                        setExpandedLessonId(null);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition cursor-pointer space-y-2 ${
                        isActive
                          ? "bg-indigo-600/20 border-indigo-500 shadow-lg"
                          : "bg-slate-800/60 border-slate-700/80 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-700 text-slate-200">
                            {sub.className}
                          </span>
                          <h4 className="text-sm font-black text-white mt-1 truncate">
                            {sub.subjectName}
                          </h4>
                        </div>
                        <span className="text-base font-black text-teal-400 tabular-nums shrink-0">
                          {sub.overallPercent}%
                        </span>
                      </div>

                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sub.overallPercent >= 100
                              ? "bg-emerald-400"
                              : sub.overallPercent > 0
                              ? "bg-teal-400"
                              : "bg-slate-500"
                          }`}
                          style={{ width: `${sub.overallPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-300">
                        <span>
                          {sub.completedLessons}/{sub.totalLessons} Lessons Done
                        </span>
                        <span>{sub.totalDaysTaught} Days · {sub.totalPicsCount} Pics</span>
                      </div>

                      {sub.currentRunningLessonTitle && (
                        <p className="text-[10px] text-indigo-300 font-bold truncate">
                          📖 Running: {sub.currentRunningLessonTitle}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Panel: Lesson-wise Detailed Tracking (Start Date, Days Taught, % Complete, Date-wise Logs) */}
              <div className="lg:col-span-8 space-y-3">
                {activeSubjectSummary && (
                  <>
                    <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-black text-teal-400 uppercase">
                          {activeSubjectSummary.className} · {activeSubjectSummary.subjectName}
                        </p>
                        <h3 className="text-base font-black text-white mt-0.5">
                          Lesson-Wise Pacing Breakdown ({activeSubjectSummary.overallPercent}% Complete)
                        </h3>
                        {activeSubjectSummary.teacherNames.length > 0 && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Teachers: {activeSubjectSummary.teacherNames.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-300">
                          Last Taught:{" "}
                          <strong className="text-white">
                            {formatShortDisplayDate(activeSubjectSummary.lastTaughtDate)}
                          </strong>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Total {activeSubjectSummary.totalDaysTaught} Days · {activeSubjectSummary.totalPicsCount} Notes Pics
                        </p>
                      </div>
                    </div>

                    {/* Lesson Cards */}
                    <div className="space-y-2.5">
                      {activeSubjectSummary.lessons.map((ls) => {
                        const isOpen = expandedLessonId === ls.lesson.id;
                        return (
                          <div
                            key={ls.lesson.id}
                            className="rounded-2xl bg-slate-800/60 border border-slate-700/80 overflow-hidden"
                          >
                            <div className="p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                      Lesson {ls.lesson.lessonNumber}
                                    </span>
                                    <span
                                      className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                        ls.status === "COMPLETED"
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                          : ls.status === "RUNNING"
                                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                          : "bg-slate-700 text-slate-300"
                                      }`}
                                    >
                                      {ls.status === "COMPLETED"
                                        ? "✓ Completed"
                                        : ls.status === "RUNNING"
                                        ? "● Running"
                                        : "Not Started"}
                                    </span>
                                  </div>
                                  <h4 className="text-sm sm:text-base font-black text-white mt-1">
                                    {ls.lesson.title}
                                  </h4>
                                </div>

                                <div className="text-left sm:text-right shrink-0">
                                  <p className="text-xl font-black text-teal-400 tabular-nums">
                                    {ls.percentComplete}%
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {ls.taughtTopicIds.length}/{ls.totalTopics} Topics Done
                                  </p>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    ls.percentComplete >= 100
                                      ? "bg-emerald-500"
                                      : ls.percentComplete > 0
                                      ? "bg-teal-500"
                                      : "bg-slate-600"
                                  }`}
                                  style={{ width: `${ls.percentComplete}%` }}
                                />
                              </div>

                              {/* Exact Date & Duration Stats requested by user */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-700/60">
                                  <p className="text-[10px] text-slate-400">Start Date (कब शुरू)</p>
                                  <p className="font-black text-white mt-0.5">
                                    {formatShortDisplayDate(ls.startDate)}
                                  </p>
                                </div>
                                <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-700/60">
                                  <p className="text-[10px] text-slate-400">Last Taught (आख़िरी दिन)</p>
                                  <p className="font-black text-white mt-0.5">
                                    {formatShortDisplayDate(ls.lastDate)}
                                  </p>
                                </div>
                                <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-700/60">
                                  <p className="text-[10px] text-slate-400">Kitne Din Padhai Hui</p>
                                  <p className="font-black text-amber-300 mt-0.5">
                                    {ls.totalDays} Days{" "}
                                    {ls.exerciseDays > 0 ? `(${ls.exerciseDays} Ex)` : ""}
                                  </p>
                                </div>
                                <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-700/60">
                                  <p className="text-[10px] text-slate-400">Notes / Ex Pics</p>
                                  <p className="font-black text-emerald-300 mt-0.5">
                                    {ls.totalPicsCount} Photos
                                  </p>
                                </div>
                              </div>

                              {/* Toggle Date-wise Teaching Logs & Topics */}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLessonId(isOpen ? null : ls.lesson.id)
                                }
                                className="w-full py-1.5 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-xs font-bold text-indigo-300 flex items-center justify-between cursor-pointer print:hidden"
                              >
                                <span>
                                  View Topics Checklist &amp; Date-wise Teaching Logs ({ls.logs.length})
                                </span>
                                {isOpen ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>

                            {isOpen && (
                              <div className="border-t border-slate-700 bg-slate-900/80 p-4 space-y-4">
                                {/* Topics Breakdown */}
                                {ls.lesson.topics.length > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-black uppercase text-slate-400">
                                      Topics Checklist ({ls.taughtTopicIds.length}/{ls.totalTopics}):
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {ls.lesson.topics.map((top, idx) => {
                                        const dt = ls.topicFirstTaughtDate[top.id];
                                        return (
                                          <div
                                            key={top.id}
                                            className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                              dt
                                                ? "bg-emerald-950/50 border-emerald-700/60 text-emerald-200"
                                                : "bg-slate-800/70 border-slate-700 text-slate-400"
                                            }`}
                                          >
                                            <span className="truncate font-semibold">
                                              {idx + 1}. {top.title}
                                            </span>
                                            <span className="text-[10px] font-black shrink-0">
                                              {dt ? `✓ ${formatShortDisplayDate(dt)}` : "Pending"}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Date-wise Logs & Pics */}
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase text-slate-400">
                                    Date-Wise Teaching &amp; Exercise Logs ({ls.logs.length}):
                                  </p>
                                  {ls.logs.length === 0 ? (
                                    <p className="text-xs text-slate-500">Abhi koi daily log darj nahi hai.</p>
                                  ) : (
                                    ls.logs.map((lg) => (
                                      <div
                                        key={lg.id}
                                        className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2"
                                      >
                                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                                          <div className="flex items-center gap-2">
                                            <span className="font-black text-indigo-300">
                                              📅 {formatShortDisplayDate(lg.date)}
                                            </span>
                                            <span
                                              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                lg.logMode === "exercise"
                                                  ? "bg-emerald-500/20 text-emerald-300"
                                                  : "bg-amber-500/20 text-amber-300"
                                              }`}
                                            >
                                              {lg.logMode === "exercise" ? "✍️ Exercise" : "📖 Lesson"}
                                            </span>
                                          </div>
                                          <span className="text-[11px] text-slate-400">
                                            👨‍🏫 {lg.teacherName}
                                            {lg.periodNumber ? ` · P-${lg.periodNumber}` : ""}
                                          </span>
                                        </div>

                                        {lg.selectedTopicTitles.length > 0 && (
                                          <p className="text-xs text-slate-200">
                                            <strong>Topics:</strong> {lg.selectedTopicTitles.join(", ")}
                                          </p>
                                        )}
                                        {lg.exerciseNote && (
                                          <p className="text-xs text-emerald-300">
                                            <strong>Exercise:</strong> {lg.exerciseNote}
                                          </p>
                                        )}
                                        {lg.noteImages && lg.noteImages.length > 0 && (
                                          <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                                            {lg.noteImages.map((src, i) => (
                                              <img
                                                key={i}
                                                src={src}
                                                alt={`Log Pic ${i + 1}`}
                                                onClick={() => setLightboxImg(src)}
                                                className="w-14 h-14 rounded-lg object-cover border border-slate-600 cursor-pointer shrink-0 hover:ring-2 hover:ring-teal-400"
                                              />
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Legacy Manual Chapters View */
        <div className="space-y-4">
          {activePacing ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {pacingList.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPacingId(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      activePacing.id === p.id
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {p.className} · {p.subject}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {activePacing.chapters.map((ch) => (
                  <button
                    key={ch.chapterNo}
                    type="button"
                    onClick={() => handleToggleChapterStatus(activePacing.id, ch.chapterNo)}
                    className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-left flex items-center justify-between gap-2 cursor-pointer hover:border-indigo-500"
                  >
                    <div>
                      <p className="text-xs font-black text-white">
                        Ch {ch.chapterNo}: {ch.title}
                      </p>
                      <p className="text-[10px] text-slate-400">Target: {ch.targetMonth}</p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-700 text-slate-200">
                      {ch.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">No manual records.</p>
          )}
        </div>
      )}

      {/* Quick Teaching Log Modal */}
      <PeriodTeachingLogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        schoolId={school?.id || ""}
        classes={classes}
        subjects={subjects}
        defaultTeacherName={school?.principalName || "Principal / Teacher"}
        onSaved={() => {
          void loadLivePacing();
        }}
      />

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="Note Preview"
            className="max-w-full max-h-[88vh] rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
};
