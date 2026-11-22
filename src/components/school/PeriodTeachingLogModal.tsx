import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  BookOpen,
  PenTool,
  CheckCircle2,
  Circle,
  Plus,
  Camera,
  Image as ImageIcon,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Sparkles,
  Calendar,
  Clock,
  Save,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { SchoolClass, SchoolSubject } from "../../school-types";
import { compressImageFileToDataUrl } from "../../utils/imageCompression";
import { uploadToTelegramStorage, dataUrlToBlob } from "../../services/telegramStorageService";
import { DEFAULT_SUBJECTS_BY_CLASS } from "./ClassCurriculumNotesManager";
import {
  type SubjectLessonPlan,
  type DailyTeachingLog,
  type TeachingLogMode,
  getTodayIsoDate,
  getDayNameFromIso,
  formatShortDisplayDate,
  getTelegramFallbackUrl,
  loadCurriculumLessons,
  saveCurriculumLessons,
  loadDailyTeachingLogs,
  saveDailyTeachingLogs,
  syncTeachingLogToDailyHomework,
  computeLessonPacingStats,
  normalizeKeyText,
} from "../../utils/schoolSyllabusLogEngine";

export interface PeriodTeachingLogPrefill {
  classId?: string;
  className?: string;
  section?: string;
  subjectName?: string;
  periodNumber?: number;
  periodLabel?: string;
  periodTime?: string;
  teacherId?: string;
  teacherName?: string;
  date?: string;
  initialMode?: TeachingLogMode;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  classes: SchoolClass[];
  subjects?: SchoolSubject[];
  prefill?: PeriodTeachingLogPrefill | null;
  defaultTeacherId?: string;
  defaultTeacherName?: string;
  onSaved?: (log: DailyTeachingLog) => void;
}

const MAX_PICS_PER_LOG = 15;

export const PeriodTeachingLogModal: React.FC<Props> = ({
  isOpen,
  onClose,
  schoolId,
  classes,
  subjects = [],
  prefill,
  defaultTeacherId,
  defaultTeacherName = "Teacher",
  onSaved,
}) => {
  // 2-step flow: Step 1 = Select Lesson & Topics (or Exercise Qs), Step 2 = Upload Multiple Pics (1 to 10+) & Homework
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<TeachingLogMode>("lesson_teaching");

  // Context fields
  const [date, setDate] = useState<string>(getTodayIsoDate());
  const [classId, setClassId] = useState<string>("");
  const [section, setSection] = useState<string>("A");
  const [subjectName, setSubjectName] = useState<string>("");
  const [teacherName, setTeacherName] = useState<string>(defaultTeacherName);
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [periodTime, setPeriodTime] = useState<string>("");

  // Loaded data
  const [allLessons, setAllLessons] = useState<SubjectLessonPlan[]>([]);
  const [allLogs, setAllLogs] = useState<DailyTeachingLog[]>([]);

  // Step 1 selection
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [exerciseNote, setExerciseNote] = useState<string>("");

  // Quick inline add Lesson / Topic so teacher is never stuck
  const [showQuickAddLesson, setShowQuickAddLesson] = useState(false);
  const [quickLessonTitle, setQuickLessonTitle] = useState("");
  const [quickLessonTopicsText, setQuickLessonTopicsText] = useState("");
  const [showQuickAddTopic, setShowQuickAddTopic] = useState(false);
  const [quickTopicText, setQuickTopicText] = useState("");

  // Step 2: Multiple Pics (1 to 15 photos on Telegram Cloud) & Optional Homework
  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [noteImageFileIds, setNoteImageFileIds] = useState<string[]>([]);
  const [homeworkText, setHomeworkText] = useState<string>("");
  const [uploadingPics, setUploadingPics] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Track created/saved draft log ID between Step 1 & Step 2
  const [savedLogId, setSavedLogId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize from prefill on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSavedLogId(null);
    setSelectedTopicIds([]);
    setExerciseNote("");
    setNoteImages([]);
    setNoteImageFileIds([]);
    setHomeworkText("");
    setShowQuickAddLesson(false);
    setShowQuickAddTopic(false);
    setMode(prefill?.initialMode || "lesson_teaching");
    setDate(prefill?.date || getTodayIsoDate());

    const resolvedCls =
      classes.find(
        (c) =>
          (prefill?.classId && c.id === prefill.classId) ||
          (prefill?.className &&
            normalizeKeyText(c.name) === normalizeKeyText(prefill.className))
      ) || classes[0];

    setClassId(resolvedCls?.id || prefill?.classId || "");
    setSection(prefill?.section || resolvedCls?.section || "A");
    setSubjectName(prefill?.subjectName || "");
    setTeacherName(prefill?.teacherName || defaultTeacherName || "Teacher");
    setPeriodNumber(prefill?.periodNumber || 1);
    setPeriodTime(prefill?.periodTime || "");

    if (schoolId) {
      Promise.all([
        loadCurriculumLessons(schoolId),
        loadDailyTeachingLogs(schoolId),
      ]).then(([ls, lg]) => {
        setAllLessons(ls);
        setAllLogs(lg);
      });
    }
  }, [isOpen, prefill, schoolId, classes, defaultTeacherName]);

  const currentClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId]
  );

  // Available subjects for selected class (includes Nursery/LKG/UKG + 1-12 defaults)
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    subjects
      .filter((s) => !classId || s.classId === classId)
      .forEach((s) => {
        if (s.name) set.add(s.name);
      });
    allLessons
      .filter(
        (l) =>
          !classId ||
          l.classId === classId ||
          (currentClass &&
            normalizeKeyText(l.className) === normalizeKeyText(currentClass.name))
      )
      .forEach((l) => {
        if (l.subjectName) set.add(l.subjectName);
      });
    // Include curriculum default subjects for the selected class (Nursery, LKG, UKG, 1-12)
    const rawClass = String(currentClass?.name || prefill?.className || "").trim();
    const clsKey = /nursery/i.test(rawClass)
      ? "Nursery"
      : /l\.?k\.?g|kg[\s-]?1/i.test(rawClass)
      ? "LKG"
      : /u\.?k\.?g|kg[\s-]?2/i.test(rawClass)
      ? "UKG"
      : (rawClass.match(/\d+/)?.[0] || "");
    if (clsKey && DEFAULT_SUBJECTS_BY_CLASS[clsKey]) {
      DEFAULT_SUBJECTS_BY_CLASS[clsKey].forEach((s) => {
        if (s.name) set.add(s.name);
      });
    }
    if (prefill?.subjectName) set.add(prefill.subjectName);
    if (subjectName) set.add(subjectName);
    return Array.from(set);
  }, [subjects, allLessons, classId, currentClass, prefill?.subjectName, prefill?.className, subjectName]);

  // Auto-pick first subject if empty
  useEffect(() => {
    if (!subjectName && availableSubjects.length > 0) {
      setSubjectName(availableSubjects[0]);
    }
  }, [availableSubjects, subjectName]);

  // Matching Lessons for Class + Subject
  const matchingLessons = useMemo(() => {
    return allLessons
      .filter((l) => {
        const clsMatch =
          l.classId === classId ||
          (currentClass &&
            normalizeKeyText(l.className) === normalizeKeyText(currentClass.name));
        const subMatch =
          !subjectName ||
          normalizeKeyText(l.subjectName) === normalizeKeyText(subjectName);
        return clsMatch && subMatch;
      })
      .sort((a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0));
  }, [allLessons, classId, currentClass, subjectName]);

  // Compute pacing stats for matching lessons (to show already-taught topic badges!)
  const lessonPacingMap = useMemo(() => {
    const { lessonStats } = computeLessonPacingStats(matchingLessons, allLogs);
    const map = new Map<string, (typeof lessonStats)[number]>();
    lessonStats.forEach((st) => map.set(st.lesson.id, st));
    return map;
  }, [matchingLessons, allLogs]);

  // Auto-select currently running lesson (or first non-completed lesson)
  useEffect(() => {
    if (matchingLessons.length === 0) {
      setSelectedLessonId("");
      return;
    }
    if (matchingLessons.some((l) => l.id === selectedLessonId)) return;
    const running = matchingLessons.find(
      (l) => lessonPacingMap.get(l.id)?.status === "RUNNING"
    );
    const pending = matchingLessons.find(
      (l) => lessonPacingMap.get(l.id)?.status === "NOT_STARTED"
    );
    setSelectedLessonId((running || pending || matchingLessons[0]).id);
  }, [matchingLessons, selectedLessonId, lessonPacingMap]);

  const activeLesson = useMemo(
    () => matchingLessons.find((l) => l.id === selectedLessonId) || null,
    [matchingLessons, selectedLessonId]
  );

  const activeLessonStat = activeLesson
    ? lessonPacingMap.get(activeLesson.id)
    : undefined;

  if (!isOpen) return null;

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId]
    );
  };

  const handleQuickAddLesson = async () => {
    const title = quickLessonTitle.trim();
    if (!title) {
      toast.error("Lesson ka naam likhein");
      return;
    }
    if (!subjectName.trim()) {
      toast.error("Subject ka naam select ya type karein");
      return;
    }

    const parsedTopics = quickLessonTopicsText
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .map((t, idx) => ({
        id: `top_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        title: t,
        order: idx + 1,
      }));

    const now = new Date().toISOString();
    const nextNum =
      matchingLessons.length > 0
        ? Math.max(...matchingLessons.map((l) => l.lessonNumber || 0)) + 1
        : 1;

    const created: SubjectLessonPlan = {
      id: `les_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      schoolId,
      classId: classId || "general",
      className: currentClass?.name || prefill?.className || "Class",
      subjectName: subjectName.trim(),
      lessonNumber: nextNum,
      title,
      topics: parsedTopics,
      createdAt: now,
      updatedAt: now,
    };

    const nextAll = [...allLessons, created];
    setAllLessons(nextAll);
    await saveCurriculumLessons(schoolId, nextAll);
    setSelectedLessonId(created.id);
    setQuickLessonTitle("");
    setQuickLessonTopicsText("");
    setShowQuickAddLesson(false);
    toast.success(`Lesson "${title}" add ho gaya!`);
  };

  const handleQuickAddTopic = async () => {
    if (!activeLesson) return;
    const lines = quickTopicText
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error("Topic likhein");
      return;
    }
    const now = new Date().toISOString();
    const newTopics = lines.map((title, idx) => ({
      id: `top_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      order: activeLesson.topics.length + idx + 1,
    }));

    const nextAll = allLessons.map((les) =>
      les.id === activeLesson.id
        ? { ...les, topics: [...les.topics, ...newTopics], updatedAt: now }
        : les
    );
    setAllLessons(nextAll);
    await saveCurriculumLessons(schoolId, nextAll);
    // Auto-select newly added topics
    setSelectedTopicIds((prev) => [...prev, ...newTopics.map((t) => t.id)]);
    setQuickTopicText("");
    setShowQuickAddTopic(false);
    toast.success(`${newTopics.length} topic(s) add & select ho gaye!`);
  };

  // Build DailyTeachingLog record & persist (used both when completing Step 1 AND when finalizing Step 2 with Pics)
  const persistCurrentLog = async (
    imagesToSave: string[],
    imageFileIdsToSave: string[],
    hwText: string
  ): Promise<DailyTeachingLog | null> => {
    if (!subjectName.trim()) {
      toast.error("Subject chunein");
      return null;
    }

    const lessonTitle = activeLesson?.title || quickLessonTitle.trim() || `${subjectName} Daily Class`;
    const selectedTitles = activeLesson
      ? activeLesson.topics
          .filter((t) => selectedTopicIds.includes(t.id))
          .map((t) => t.title)
      : [];

    if (mode === "lesson_teaching" && activeLesson && activeLesson.topics.length > 0 && selectedTopicIds.length === 0) {
      toast.error("Jo topic aaj padhaya gaya, us par kam se kam 1 tick lagayein!");
      return null;
    }

    if (mode === "exercise" && !exerciseNote.trim() && imagesToSave.length === 0 && step === 1) {
      toast.error("Aaj Exercise ke kaun se questions solve karwaye gaye, wo likhein (e.g. Ex 2.1 Q1-Q5)");
      return null;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const logId = savedLogId || `tlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const record: DailyTeachingLog = {
        id: logId,
        schoolId,
        date,
        dayOfWeek: getDayNameFromIso(date),
        periodNumber,
        periodLabel: prefill?.periodLabel || `Period ${periodNumber}`,
        periodTime,
        classId: classId || currentClass?.id || "general",
        className: currentClass?.name || prefill?.className || "Class",
        section,
        subjectName: subjectName.trim(),
        teacherId: prefill?.teacherId || defaultTeacherId,
        teacherName: teacherName.trim() || defaultTeacherName || "Teacher",
        lessonId: activeLesson?.id,
        lessonTitle,
        logMode: mode,
        selectedTopicIds: mode === "lesson_teaching" ? selectedTopicIds : [],
        selectedTopicTitles: mode === "lesson_teaching" ? selectedTitles : [],
        exerciseNote: mode === "exercise" ? exerciseNote.trim() : undefined,
        homeworkText: hwText.trim() || undefined,
        noteImages: imagesToSave,
        noteImageFileIds: imageFileIdsToSave,
        createdAt: now,
        updatedAt: now,
      };

      const nextLogs = [record, ...allLogs.filter((l) => l.id !== logId)];
      setAllLogs(nextLogs);
      setSavedLogId(logId);
      await saveDailyTeachingLogs(schoolId, nextLogs);
      await syncTeachingLogToDailyHomework(schoolId, record);
      return record;
    } catch (err) {
      console.error("[PeriodTeachingLogModal] Save failed:", err);
      toast.error("Save karne me samasya aayi, dubara try karein");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Step 1 -> Save Topics/Exercise & Move to Step 2 (Upload 1 to 15 Pics via Telegram Cloud)
  const handleStep1SaveAndNext = async () => {
    const saved = await persistCurrentLog(noteImages, noteImageFileIds, homeworkText);
    if (!saved) return;
    toast.success(
      mode === "exercise"
        ? "Exercise details save! Ab solved questions ki pics Telegram Cloud par add karein."
        : `${saved.selectedTopicTitles.length} topic(s) save! Ab notes ki pics Telegram Cloud par add karein.`
    );
    setStep(2);
  };

  // Multi-image upload handler (compresses & uploads to Telegram Cloud Storage, storing URL + fileId)
  const handleMultiPicSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = MAX_PICS_PER_LOG - noteImages.length;
    if (remainingSlots <= 0) {
      toast.error(`Ek session me maximum ${MAX_PICS_PER_LOG} pics add kar sakte hain.`);
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.info(`Pehle ${remainingSlots} photos upload ki ja rahi hain (max ${MAX_PICS_PER_LOG} pics).`);
    }

    setUploadingPics(true);
    try {
      const uploadedUrls: string[] = [];
      const uploadedFileIds: string[] = [];
      let telegramSuccessCount = 0;

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        try {
          const { dataUrl } = await compressImageFileToDataUrl(file, {
            maxWidth: 1400,
            maxHeight: 1400,
            maxSizeBytes: 220 * 1024,
            initialQuality: 0.82,
            minQuality: 0.45,
          });
          try {
            const blob = dataUrlToBlob(dataUrl, "image/jpeg");
            const safeClass = (currentClass?.name || prefill?.className || "Class").replace(/\s+/g, "_");
            const safeSub = (subjectName || "Notes").replace(/\s+/g, "_");
            const tgRes = await uploadToTelegramStorage(blob, {
              fileName: `classwork_${safeClass}_${safeSub}_${date}_${Date.now()}_${i + 1}.jpg`,
              type: "image",
              caption: `📚 ${currentClass?.name || prefill?.className || "Class"} · ${subjectName} (${date}) — ${activeLesson?.title || "Class Notes"}`,
            });
            const finalUrl = tgRes?.url || getTelegramFallbackUrl(tgRes?.fileId) || dataUrl;
            uploadedUrls.push(finalUrl);
            uploadedFileIds.push(tgRes?.fileId || "");
            if (tgRes?.fileId || (tgRes?.url && !tgRes.url.startsWith("data:"))) {
              telegramSuccessCount++;
            }
          } catch (tgErr) {
            console.warn("[PeriodTeachingLogModal] Telegram upload fallback to compressed local pic:", tgErr);
            uploadedUrls.push(dataUrl);
            uploadedFileIds.push("");
          }
        } catch (err) {
          console.warn("[PeriodTeachingLogModal] Image compression error:", err);
        }
      }
      if (uploadedUrls.length > 0) {
        setNoteImages((prev) => [...prev, ...uploadedUrls]);
        setNoteImageFileIds((prev) => [...prev, ...uploadedFileIds]);
        toast.success(
          telegramSuccessCount > 0
            ? `☁️ ${telegramSuccessCount} photo(s) Telegram Cloud par save ho gayi!`
            : `${uploadedUrls.length} photo(s) add ho gayi!`
        );
      }
    } finally {
      setUploadingPics(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Step 2 -> Final Save & Publish to Students + Syllabus Pacing
  const handleFinalPublish = async () => {
    const saved = await persistCurrentLog(noteImages, noteImageFileIds, homeworkText);
    if (!saved) return;
    toast.success(
      `✅ Daily Notes (${saved.noteImages.length} Pics) save & Students ke Class Work me sync ho gaye!`
    );
    onSaved?.(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-blue-700 to-teal-700 px-4 py-3.5 text-white flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-white/20 text-[10px] font-black uppercase tracking-wide">
                Step {step} of 2
              </span>
              <span className="text-[11px] font-bold text-indigo-100">
                {step === 1
                  ? mode === "exercise"
                    ? "Exercise / Q&A Entry"
                    : "Lesson & Topics Selection"
                  : "Upload Notes / Exercise Pics (1–15 Photos)"}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black truncate mt-0.5">
              {currentClass?.name || prefill?.className || "Class"} ·{" "}
              {subjectName || "Subject"} {periodNumber ? `(Period ${periodNumber})` : ""}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/70 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 text-[11px] font-black shrink-0">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-1.5 cursor-pointer ${
              step === 1 ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 1
                  ? "bg-indigo-600 text-white"
                  : "bg-emerald-600 text-white"
              }`}
            >
              {step === 2 ? "✓" : "1"}
            </span>
            <span>Lesson &amp; Topics / Exercise</span>
          </button>
          <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-700" />
          <div
            className={`flex items-center gap-1.5 ${
              step === 2 ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 2
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-500"
              }`}
            >
              2
            </span>
            <span>Add Multiple Pics ({noteImages.length})</span>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {step === 1 ? (
            <>
              {/* Mode Switcher: Lesson Teaching vs Exercise / Q&A */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("lesson_teaching")}
                  className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-2.5 ${
                    mode === "lesson_teaching"
                      ? "border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white">
                      Lesson &amp; Topics
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Topic tick + Notes Pics
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("exercise")}
                  className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-2.5 ${
                    mode === "exercise"
                      ? "border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <PenTool className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white">
                      Exercise / Q&amp;A
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      Day-wise Solved Qs + Pics
                    </p>
                  </div>
                </button>
              </div>

              {/* Class / Subject / Date / Period Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Class
                  </label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.section ? `(${c.section})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Subject
                  </label>
                  {availableSubjects.length > 0 ? (
                    <select
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      {availableSubjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                      placeholder="e.g. Science"
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Teacher
                  </label>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Lesson Selector + Quick Add Lesson */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-100">
                    Lesson (पाठ) चुनें:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddLesson((p) => !p)}
                    className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Naya Lesson Jodein</span>
                  </button>
                </div>

                {showQuickAddLesson && (
                  <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2">
                    <input
                      type="text"
                      value={quickLessonTitle}
                      onChange={(e) => setQuickLessonTitle(e.target.value)}
                      placeholder="Lesson Title (e.g. Chapter 2: Acids, Bases and Salts)"
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <textarea
                      rows={3}
                      value={quickLessonTopicsText}
                      onChange={(e) => setQuickLessonTopicsText(e.target.value)}
                      placeholder={"Topics (1 line = 1 topic):\nProperties of Acids\npH Scale\nNeutralization Reaction"}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleQuickAddLesson}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black cursor-pointer"
                      >
                        Save Lesson
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddLesson(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {matchingLessons.length > 0 ? (
                  <select
                    value={selectedLessonId}
                    onChange={(e) => {
                      setSelectedLessonId(e.target.value);
                      setSelectedTopicIds([]);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-xs sm:text-sm font-black text-slate-900 dark:text-white"
                  >
                    {matchingLessons.map((les) => {
                      const st = lessonPacingMap.get(les.id);
                      const pct = st?.percentComplete || 0;
                      return (
                        <option key={les.id} value={les.id}>
                          L-{les.lessonNumber}: {les.title} ({pct}% Done · {les.topics.length} Topics)
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                    Is subject me abhi koi Lesson saved nahi hai. Upar <strong>"+ Naya Lesson Jodein"</strong> par click karke lesson &amp; topics add karein (ya seedha Exercise / Notes save karein).
                  </div>
                )}
              </div>

              {/* Mode-Specific Step 1 Body */}
              {mode === "lesson_teaching" ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                      Aaj jo Topic padhaya gaya un par tick karein ({selectedTopicIds.length} Selected):
                    </p>
                    {activeLesson && (
                      <button
                        type="button"
                        onClick={() => setShowQuickAddTopic((p) => !p)}
                        className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Topic Add</span>
                      </button>
                    )}
                  </div>

                  {showQuickAddTopic && activeLesson && (
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                      <textarea
                        rows={2}
                        value={quickTopicText}
                        onChange={(e) => setQuickTopicText(e.target.value)}
                        placeholder="Har line me naya topic likhein..."
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleQuickAddTopic}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black cursor-pointer"
                        >
                          Add &amp; Select
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowQuickAddTopic(false)}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {activeLesson && activeLesson.topics.length > 0 ? (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {activeLesson.topics.map((top, idx) => {
                        const checked = selectedTopicIds.includes(top.id);
                        const prevDate = activeLessonStat?.topicFirstTaughtDate?.[top.id];
                        return (
                          <button
                            key={top.id}
                            type="button"
                            onClick={() => toggleTopic(top.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                              checked
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : prevDate
                                ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100 hover:border-indigo-400"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-indigo-400"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {checked ? (
                                <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span className="text-xs font-bold truncate">
                                {idx + 1}. {top.title}
                              </span>
                            </div>
                            {prevDate && (
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded shrink-0 ${
                                  checked
                                    ? "bg-white/20 text-white"
                                    : "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                                }`}
                              >
                                ✓ {formatShortDisplayDate(prevDate)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      Is lesson me koi topic list nahi hai. Upar "+ Topic Add" se topic jodein ya seedha Next click karke Notes pics upload karein.
                    </p>
                  )}
                </div>
              ) : (
                /* Exercise / Q&A Mode */
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                    Aaj Exercise ke kaun-kaun se Questions banwaye gaye (Day-wise detail):
                  </label>
                  <textarea
                    rows={3}
                    value={exerciseNote}
                    onChange={(e) => setExerciseNote(e.target.value)}
                    placeholder="e.g. Exercise 4.2 — Q1, Q2, Q3, Q4 & Q5 board par solve karwaya gaya"
                    className="w-full px-3 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-900 dark:text-white"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Next step me aap aaj solve kiye gaye sabhi questions ki 1 se 10+ pics ek saath upload kar sakenge.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* STEP 2: Upload Multiple Pics (1 to 10+ photos) + Homework */
            <div className="space-y-4">
              {/* Saved Step 1 Summary Banner */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-black text-emerald-900 dark:text-emerald-200">
                    {mode === "exercise"
                      ? `Exercise Saved: ${activeLesson?.title || subjectName}`
                      : `Topics Saved (${selectedTopicIds.length}): ${activeLesson?.title || subjectName}`}
                  </p>
                  {mode === "lesson_teaching" && activeLesson && selectedTopicIds.length > 0 && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {activeLesson.topics
                        .filter((t) => selectedTopicIds.includes(t.id))
                        .map((t) => t.title)
                        .join(" • ")}
                    </p>
                  )}
                  {mode === "exercise" && exerciseNote && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {exerciseNote}
                    </p>
                  )}
                </div>
              </div>

              {/* Multi-Pic Upload Box (1 to 15 photos) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    <span>
                      {mode === "exercise"
                        ? "Solved Exercise Questions ki Photos Add Karein (1–15 Pics)"
                        : "Padhaye Gaye Topics ke Notes / Board Pics Add Karein (1–15 Pics)"}
                    </span>
                  </label>
                  <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">
                    {noteImages.length}/{MAX_PICS_PER_LOG} Pics
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleMultiPicSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={uploadingPics || noteImages.length >= MAX_PICS_PER_LOG}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-5 px-4 rounded-2xl border-2 border-dashed border-indigo-400 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploadingPics ? (
                    <>
                      <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                      <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                        Telegram Cloud par photos upload ho rahi hain...
                      </span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs sm:text-sm font-black text-indigo-800 dark:text-indigo-200">
                        + Select 1, 5, ya 10+ Photos (Telegram Cloud Upload)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Board notes, copy pages ya solved questions ki pics direct Telegram link se students ko dikhengi
                      </span>
                    </>
                  )}
                </button>

                {/* Uploaded Pics Thumbnail Grid */}
                {noteImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {noteImages.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square bg-slate-100 dark:bg-slate-800"
                      >
                        <img
                          src={src}
                          alt={`Note Pic ${idx + 1}`}
                          onClick={() => setPreviewImage(src)}
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (img.dataset.tgFallbackApplied) return;
                            const fallback = getTelegramFallbackUrl(noteImageFileIds[idx]);
                            if (fallback && img.src !== fallback) {
                              img.dataset.tgFallbackApplied = "1";
                              img.src = fallback;
                            }
                          }}
                          className="w-full h-full object-cover cursor-pointer"
                        />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[9px] font-black">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNoteImages((prev) => prev.filter((_, i) => i !== idx));
                            setNoteImageFileIds((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute top-1 right-1 p-1 rounded-lg bg-rose-600 text-white shadow hover:bg-rose-500 cursor-pointer"
                          title="Remove Pic"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Optional Daily Homework Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                  Homework Note (गृहकार्य — Optional, zaroorat ho tabhi bharein):
                </label>
                <textarea
                  rows={2}
                  value={homeworkText}
                  onChange={(e) => setHomeworkText(e.target.value)}
                  placeholder="Optional: Agar aaj koi special homework dena hai toh likhein, warna khali chhod dein (padhaye gaye topics automatically diary me dikhenge)."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleStep1SaveAndNext}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <span>
                  {saving
                    ? "Saving..."
                    : mode === "exercise"
                    ? "Save Exercise & Next: Add Pics"
                    : "Save Topics & Next: Add Pics"}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Topics</span>
              </button>
              <button
                type="button"
                disabled={saving || uploadingPics}
                onClick={handleFinalPublish}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {saving
                    ? "Publishing..."
                    : `Publish Notes (${noteImages.length} Pics)`}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lightbox Image Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white hover:bg-white/30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewImage}
            alt="Full Preview"
            className="max-w-full max-h-[88vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
