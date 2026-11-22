import type {
  SchoolClass,
  TimetablePeriod,
  DailyHomework,
} from "../school-types";
import {
  loadSchoolSubcollection,
  syncSchoolSubcollection,
  loadSchoolSettingBlob,
} from "./schoolCloudSync";
import { saveHomework } from "../school-firebase";

export interface CurriculumTopic {
  id: string;
  title: string;
  order: number;
}

export interface SubjectLessonPlan {
  id: string;
  schoolId: string;
  classId: string;
  className: string;
  subjectId?: string;
  subjectName: string;
  lessonNumber: number;
  title: string;
  topics: CurriculumTopic[];
  createdAt: string;
  updatedAt: string;
}

export type TeachingLogMode = "lesson_teaching" | "exercise";

export interface DailyTeachingLog {
  id: string;
  schoolId: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // Monday..Saturday
  periodNumber?: number;
  periodLabel?: string;
  periodTime?: string;
  classId: string;
  className: string;
  section?: string;
  subjectName: string;
  teacherId?: string;
  teacherName: string;
  lessonId?: string;
  lessonTitle: string;
  logMode: TeachingLogMode;
  selectedTopicIds: string[];
  selectedTopicTitles: string[];
  exerciseNote?: string;
  homeworkText?: string;
  noteImages: string[]; // Supports 1 to 15 Telegram CDN / proxy URLs (or offline compressed DataURL fallback)
  noteImageFileIds?: string[]; // Permanent Telegram file_id per uploaded photo for auto-recovery
  sessionId?: string;
  sessionName?: string;
  createdAt: string;
  updatedAt: string;
}

export const getTelegramFallbackUrl = (fileId?: string | null): string => {
  const clean = String(fileId || "").trim();
  return clean ? `/api/telegram/file?fileId=${encodeURIComponent(clean)}` : "";
};

export const resolveTeachingImageSrc = (url?: string | null, fileId?: string | null): string => {
  const cleanUrl = String(url || "").trim();
  if (cleanUrl) return cleanUrl;
  return getTelegramFallbackUrl(fileId);
};

export interface LessonPacingStat {
  lesson: SubjectLessonPlan;
  startDate: string | null;
  lastDate: string | null;
  daysTaught: number;
  exerciseDays: number;
  totalDays: number;
  taughtTopicIds: string[];
  topicFirstTaughtDate: Record<string, string>;
  totalTopics: number;
  percentComplete: number;
  status: "NOT_STARTED" | "RUNNING" | "COMPLETED";
  totalPicsCount: number;
  logs: DailyTeachingLog[];
}

export interface SubjectPacingSummary {
  key: string;
  classId: string;
  className: string;
  subjectName: string;
  lessons: LessonPacingStat[];
  totalLessons: number;
  completedLessons: number;
  runningLessons: number;
  currentRunningLessonTitle: string | null;
  overallPercent: number;
  totalDaysTaught: number;
  totalPicsCount: number;
  lastTaughtDate: string | null;
  teacherNames: string[];
}

export interface DailyRoutineSlotItem {
  id: string;
  day: string;
  periodNumber: number;
  periodLabel: string;
  startTime: string;
  endTime: string;
  classId: string;
  className: string;
  section: string;
  subjectName: string;
  teacherId?: string;
  teacherName: string;
  room?: string;
  isLiveNow: boolean;
}

export const SYLLABUS_LOG_EVENT = "school-syllabus-logs-updated";

export const DAYS_OF_WEEK_LIST = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const getTodayIsoDate = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getDayNameFromIso = (isoDate?: string): string => {
  const d = isoDate ? new Date(`${isoDate}T10:00:00`) : new Date();
  const idx = d.getDay(); // 0=Sun..6=Sat
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const name = names[idx] || "Monday";
  return name === "Sunday" ? "Monday" : name;
};

export const formatShortDisplayDate = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export const normalizeKeyText = (v?: string | null): string =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

export const lessonsLocalKey = (schoolId: string) =>
  `nst_school_curriculum_lessons_${schoolId || "default"}`;

export const logsLocalKey = (schoolId: string) =>
  `nst_school_daily_teaching_logs_${schoolId || "default"}`;

export const getLocalCurriculumLessons = (
  schoolId: string
): SubjectLessonPlan[] => {
  if (!schoolId) return [];
  try {
    const raw = localStorage.getItem(lessonsLocalKey(schoolId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[SyllabusEngine] Failed reading local lessons:", err);
  }
  return [];
};

export const loadCurriculumLessons = async (
  schoolId: string
): Promise<SubjectLessonPlan[]> => {
  if (!schoolId) return [];
  try {
    const cloud = await loadSchoolSubcollection<SubjectLessonPlan>(
      schoolId,
      "curriculum_lessons",
      lessonsLocalKey(schoolId)
    );
    if (Array.isArray(cloud) && cloud.length > 0) {
      return cloud;
    }
  } catch (err) {
    console.warn("[SyllabusEngine] Cloud lessons load error:", err);
  }
  return getLocalCurriculumLessons(schoolId);
};

export const saveCurriculumLessons = async (
  schoolId: string,
  lessons: SubjectLessonPlan[]
): Promise<void> => {
  if (!schoolId) return;
  try {
    localStorage.setItem(lessonsLocalKey(schoolId), JSON.stringify(lessons));
  } catch (err) {
    console.warn("[SyllabusEngine] Local lessons save error:", err);
  }
  try {
    window.dispatchEvent(
      new CustomEvent(SYLLABUS_LOG_EVENT, { detail: { schoolId, type: "lessons" } })
    );
  } catch {}
  await syncSchoolSubcollection(schoolId, "curriculum_lessons", lessons);
};

export const getLocalDailyTeachingLogs = (
  schoolId: string
): DailyTeachingLog[] => {
  if (!schoolId) return [];
  try {
    const raw = localStorage.getItem(logsLocalKey(schoolId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[SyllabusEngine] Failed reading local logs:", err);
  }
  return [];
};

export const loadDailyTeachingLogs = async (
  schoolId: string
): Promise<DailyTeachingLog[]> => {
  if (!schoolId) return [];
  try {
    const cloud = await loadSchoolSubcollection<DailyTeachingLog>(
      schoolId,
      "daily_teaching_logs",
      logsLocalKey(schoolId)
    );
    if (Array.isArray(cloud) && cloud.length > 0) {
      return cloud;
    }
  } catch (err) {
    console.warn("[SyllabusEngine] Cloud logs load error:", err);
  }
  return getLocalDailyTeachingLogs(schoolId);
};

export const saveDailyTeachingLogs = async (
  schoolId: string,
  logs: DailyTeachingLog[]
): Promise<void> => {
  if (!schoolId) return;
  try {
    localStorage.setItem(logsLocalKey(schoolId), JSON.stringify(logs));
  } catch (err) {
    console.warn("[SyllabusEngine] Local logs save error:", err);
  }
  try {
    window.dispatchEvent(
      new CustomEvent(SYLLABUS_LOG_EVENT, { detail: { schoolId, type: "logs" } })
    );
  } catch {}
  await syncSchoolSubcollection(schoolId, "daily_teaching_logs", logs);
};

/**
 * Mirrors a DailyTeachingLog (when it has Homework text or Notes/Exercise) into
 * `daily_homework` so Student Homework Diary stays automatically synchronized.
 */
export const syncTeachingLogToDailyHomework = async (
  schoolId: string,
  log: DailyTeachingLog
): Promise<void> => {
  if (!schoolId) return;
  const hwStorageKey = `nst_school_homework_${schoolId}`;
  try {
    const existingRaw = localStorage.getItem(hwStorageKey);
    const existing: DailyHomework[] = existingRaw ? JSON.parse(existingRaw) : [];
    const safeList = Array.isArray(existing) ? existing : [];

    const hwId = `hw_from_log_${log.id}`;
    const isExercise = log.logMode === "exercise";
    const topicsSummary =
      log.selectedTopicTitles.length > 0
        ? `Topics Taught: ${log.selectedTopicTitles.join(", ")}`
        : "";
    const exerciseSummary = log.exerciseNote
      ? `Exercise Solved: ${log.exerciseNote}`
      : "";
    const picsTag =
      log.noteImages.length > 0
        ? ` (${log.noteImages.length} Class Notes ${log.noteImages.length === 1 ? "Pic" : "Pics"} uploaded)`
        : "";

    const title = isExercise
      ? `✍️ Exercise: ${log.lessonTitle}${log.exerciseNote ? ` — ${log.exerciseNote}` : ""}`
      : `📖 ${log.lessonTitle}${log.selectedTopicTitles.length > 0 ? ` (${log.selectedTopicTitles.length} Topics)` : ""}`;

    const descParts = [
      topicsSummary,
      exerciseSummary,
      log.homeworkText ? `Homework: ${log.homeworkText}` : "",
      picsTag ? `Notes: ${picsTag.trim()}` : "",
    ].filter(Boolean);

    const dueDateObj = new Date(`${log.date}T10:00:00`);
    dueDateObj.setDate(dueDateObj.getDate() + 1);
    const dueIso = dueDateObj.toISOString().slice(0, 10);

    const firstPicUrl =
      (log.noteImages?.[0] && !log.noteImages[0].startsWith("data:")
        ? log.noteImages[0]
        : "") ||
      getTelegramFallbackUrl(log.noteImageFileIds?.[0]) ||
      log.noteImages?.[0] ||
      undefined;

    const hwRecord: DailyHomework = {
      id: hwId,
      schoolId,
      classId: log.classId,
      className: log.className,
      section: log.section || "A",
      subjectName: log.subjectName,
      teacherId: log.teacherId || "",
      teacherName: log.teacherName || "Teacher",
      title,
      description: descParts.join("\n"),
      assignedDate: log.date,
      dueDate: dueIso,
      attachmentUrl: firstPicUrl,
      status: "active",
      createdAt: log.createdAt,
    };

    const nextList = [
      hwRecord,
      ...safeList.filter((item) => item.id !== hwId),
    ];
    localStorage.setItem(hwStorageKey, JSON.stringify(nextList));
    await Promise.allSettled([
      syncSchoolSubcollection(schoolId, "daily_homework", nextList),
      saveHomework(hwRecord as any),
    ]);
  } catch (err) {
    console.warn("[SyllabusEngine] Failed mirroring log to daily_homework:", err);
  }
};

/**
 * Computes live per-lesson and per-subject Syllabus Pacing stats directly from
 * structured Lesson Plans + Daily Teaching Logs (Zero double-entry!).
 */
export const computeLessonPacingStats = (
  lessons: SubjectLessonPlan[],
  logs: DailyTeachingLog[]
): {
  lessonStats: LessonPacingStat[];
  subjectSummaries: SubjectPacingSummary[];
} => {
  const lessonStats: LessonPacingStat[] = lessons.map((lesson) => {
    const matchedLogs = logs
      .filter((log) => {
        if (log.lessonId && log.lessonId === lesson.id) return true;
        const sameClass =
          log.classId === lesson.classId ||
          normalizeKeyText(log.className) === normalizeKeyText(lesson.className);
        const sameSub =
          normalizeKeyText(log.subjectName) ===
          normalizeKeyText(lesson.subjectName);
        const sameLesson =
          normalizeKeyText(log.lessonTitle) === normalizeKeyText(lesson.title);
        return sameClass && sameSub && sameLesson;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const lessonTeachingDates = new Set<string>();
    const exerciseDates = new Set<string>();
    const allDates = new Set<string>();
    const taughtTopicSet = new Set<string>();
    const topicFirstTaughtDate: Record<string, string> = {};
    let totalPicsCount = 0;

    // Sort ascending to capture exact first taught date for each topic & lesson
    const ascLogs = [...matchedLogs].sort((a, b) =>
      (a.date || "").localeCompare(b.date || "")
    );

    ascLogs.forEach((lg) => {
      if (lg.date) {
        allDates.add(lg.date);
        if (lg.logMode === "exercise") exerciseDates.add(lg.date);
        else lessonTeachingDates.add(lg.date);
      }
      totalPicsCount += Array.isArray(lg.noteImages) ? lg.noteImages.length : 0;
      (lg.selectedTopicIds || []).forEach((tid) => {
        taughtTopicSet.add(tid);
        if (!topicFirstTaughtDate[tid] && lg.date) {
          topicFirstTaughtDate[tid] = lg.date;
        }
      });
    });

    const sortedDates = Array.from(allDates).sort();
    const startDate = sortedDates.length > 0 ? sortedDates[0] : null;
    const lastDate =
      sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

    const totalTopics = lesson.topics.length;
    const validTaughtCount =
      totalTopics > 0
        ? lesson.topics.filter((t) => taughtTopicSet.has(t.id)).length
        : taughtTopicSet.size;

    let percentComplete = 0;
    if (totalTopics > 0) {
      percentComplete = Math.min(
        100,
        Math.round((validTaughtCount / totalTopics) * 100)
      );
    } else if (matchedLogs.length > 0) {
      percentComplete = exerciseDates.size > 0 ? 100 : 50;
    }

    let status: "NOT_STARTED" | "RUNNING" | "COMPLETED" = "NOT_STARTED";
    if (percentComplete >= 100 && (totalTopics > 0 || matchedLogs.length > 0)) {
      status = "COMPLETED";
    } else if (matchedLogs.length > 0 || validTaughtCount > 0) {
      status = "RUNNING";
    }

    return {
      lesson,
      startDate,
      lastDate,
      daysTaught: lessonTeachingDates.size,
      exerciseDays: exerciseDates.size,
      totalDays: allDates.size,
      taughtTopicIds: Array.from(taughtTopicSet),
      topicFirstTaughtDate,
      totalTopics,
      percentComplete,
      status,
      totalPicsCount,
      logs: matchedLogs,
    };
  });

  // Group into SubjectPacingSummary
  const groupMap = new Map<string, SubjectPacingSummary>();
  lessonStats.forEach((ls) => {
    const key = `${ls.lesson.classId}__${normalizeKeyText(ls.lesson.subjectName)}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        classId: ls.lesson.classId,
        className: ls.lesson.className,
        subjectName: ls.lesson.subjectName,
        lessons: [],
        totalLessons: 0,
        completedLessons: 0,
        runningLessons: 0,
        currentRunningLessonTitle: null,
        overallPercent: 0,
        totalDaysTaught: 0,
        totalPicsCount: 0,
        lastTaughtDate: null,
        teacherNames: [],
      });
    }
    groupMap.get(key)!.lessons.push(ls);
  });

  const subjectSummaries: SubjectPacingSummary[] = Array.from(
    groupMap.values()
  ).map((group) => {
    group.lessons.sort(
      (a, b) => (a.lesson.lessonNumber || 0) - (b.lesson.lessonNumber || 0)
    );
    const totalLessons = group.lessons.length;
    const completedLessons = group.lessons.filter(
      (l) => l.status === "COMPLETED"
    ).length;
    const runningLessons = group.lessons.filter(
      (l) => l.status === "RUNNING"
    ).length;

    const latestRunning = group.lessons
      .filter((l) => l.status === "RUNNING")
      .sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""))[0];

    const nextPending = group.lessons.find((l) => l.status === "NOT_STARTED");

    const sumPct = group.lessons.reduce((acc, l) => acc + l.percentComplete, 0);
    const overallPercent =
      totalLessons > 0 ? Math.round(sumPct / totalLessons) : 0;

    const dateSet = new Set<string>();
    const teacherSet = new Set<string>();
    let totalPicsCount = 0;
    let lastTaughtDate: string | null = null;

    group.lessons.forEach((l) => {
      totalPicsCount += l.totalPicsCount;
      if (l.lastDate && (!lastTaughtDate || l.lastDate > lastTaughtDate)) {
        lastTaughtDate = l.lastDate;
      }
      l.logs.forEach((lg) => {
        if (lg.date) dateSet.add(lg.date);
        if (lg.teacherName) teacherSet.add(lg.teacherName);
      });
    });

    return {
      ...group,
      totalLessons,
      completedLessons,
      runningLessons,
      currentRunningLessonTitle:
        latestRunning?.lesson.title ||
        nextPending?.lesson.title ||
        group.lessons[group.lessons.length - 1]?.lesson.title ||
        null,
      overallPercent,
      totalDaysTaught: dateSet.size,
      totalPicsCount,
      lastTaughtDate,
      teacherNames: Array.from(teacherSet),
    };
  });

  return { lessonStats, subjectSummaries };
};

const parseMinutesOfDay = (timeStr?: string): number | null => {
  if (!timeStr) return null;
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  // School periods 01:00–05:59 are afternoon PM
  if (hh >= 1 && hh <= 5) hh += 12;
  return hh * 60 + mm;
};

const isTimeCurrentlyActive = (startTime?: string, endTime?: string): boolean => {
  const s = parseMinutesOfDay(startTime);
  const e = parseMinutesOfDay(endTime);
  if (s === null || e === null) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= s && cur <= e;
};

/**
 * Loads the school's saved Timetable & Routine and builds the period-wise list
 * for a given weekday (Mon–Sat), optionally filtered to a specific teacher.
 */
export const loadDailyRoutineForDay = async (
  schoolId: string,
  classes: SchoolClass[],
  dayName: string,
  teacherFilter?: { teacherId?: string; teacherName?: string } | null
): Promise<DailyRoutineSlotItem[]> => {
  if (!schoolId) return [];
  const storageKey = `nst_school_timetable_${schoolId}`;
  const periodSlotsKey = `nst_school_period_slots_${schoolId}`;

  const [schedules, slots] = await Promise.all([
    loadSchoolSettingBlob<Record<string, Record<string, TimetablePeriod[]>>>(
      schoolId,
      "timetable_schedules",
      storageKey,
      {}
    ),
    loadSchoolSettingBlob<
      Array<{ periodNumber: number; label?: string; startTime: string; endTime: string; isBreak?: boolean }>
    >(schoolId, "timetable_period_slots", periodSlotsKey, []),
  ]);

  const slotMap = new Map<
    number,
    { label?: string; startTime: string; endTime: string; isBreak?: boolean }
  >();
  if (Array.isArray(slots)) {
    slots.forEach((sl) => slotMap.set(Number(sl.periodNumber), sl));
  }

  const todayName = getDayNameFromIso();
  const checkLive = dayName === todayName;

  const items: DailyRoutineSlotItem[] = [];
  const seenKey = new Set<string>();

  const resolveClassMeta = (rawKey: string) => {
    const [baseKey, secPart] = rawKey.split("__sec_");
    const matchedClass = classes.find(
      (c) =>
        c.id === baseKey ||
        normalizeKeyText(c.name) === normalizeKeyText(baseKey)
    );
    return {
      classId: matchedClass?.id || baseKey,
      className: matchedClass?.name || baseKey,
      section: secPart || matchedClass?.section || "A",
    };
  };

  Object.entries(schedules || {}).forEach(([scheduleKey, dayDict]) => {
    if (!dayDict || typeof dayDict !== "object") return;
    const dayPeriods = dayDict[dayName];
    if (!Array.isArray(dayPeriods) || dayPeriods.length === 0) return;

    const meta = resolveClassMeta(scheduleKey);

    dayPeriods.forEach((p: any) => {
      if (!p || p.isBreak) return;
      const subjectName = String(p.subjectName || p.subject || "").trim();
      const teacherName = String(p.teacherName || "").trim();
      if (!subjectName && !teacherName) return;

      const pNum = Number(p.periodNumber || 0);
      const slotCfg = slotMap.get(pNum);
      const startTime = p.startTime || slotCfg?.startTime || "";
      const endTime = p.endTime || slotCfg?.endTime || "";
      const periodLabel = slotCfg?.label || `Period ${pNum}`;

      if (teacherFilter && (teacherFilter.teacherId || teacherFilter.teacherName)) {
        const targetId = normalizeKeyText(teacherFilter.teacherId);
        const targetName = normalizeKeyText(teacherFilter.teacherName);
        const pTeacherId = normalizeKeyText(p.teacherId);
        const pTeacherName = normalizeKeyText(teacherName);

        const idMatch = Boolean(targetId && pTeacherId && targetId === pTeacherId);
        const nameMatch = Boolean(
          targetName &&
            pTeacherName &&
            (pTeacherName === targetName ||
              pTeacherName.includes(targetName) ||
              targetName.includes(pTeacherName))
        );
        if (!idMatch && !nameMatch) return;
      }

      const dedup = `${meta.classId}_${meta.section}_${pNum}_${normalizeKeyText(subjectName)}`;
      if (seenKey.has(dedup)) return;
      seenKey.add(dedup);

      items.push({
        id: `${scheduleKey}_${dayName}_${pNum}`,
        day: dayName,
        periodNumber: pNum,
        periodLabel,
        startTime,
        endTime,
        classId: meta.classId,
        className: meta.className,
        section: meta.section,
        subjectName: subjectName || "General Class",
        teacherId: p.teacherId,
        teacherName: teacherName || "Unassigned",
        room: p.room,
        isLiveNow: checkLive && isTimeCurrentlyActive(startTime, endTime),
      });
    });
  });

  items.sort((a, b) => {
    if (a.periodNumber !== b.periodNumber) return a.periodNumber - b.periodNumber;
    return a.className.localeCompare(b.className);
  });

  return items;
};
