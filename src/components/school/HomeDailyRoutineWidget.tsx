import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  BookOpen,
  PenTool,
  Calendar,
  Users,
  CheckCircle2,
  Image as ImageIcon,
  Plus,
  ChevronRight,
  Sparkles,
  Filter,
} from "lucide-react";
import type { SchoolClass, SchoolSubject, SchoolTeacher } from "../../school-types";
import {
  DAYS_OF_WEEK_LIST,
  SYLLABUS_LOG_EVENT,
  type DailyRoutineSlotItem,
  type SubjectLessonPlan,
  type DailyTeachingLog,
  getTodayIsoDate,
  getDayNameFromIso,
  loadDailyRoutineForDay,
  loadCurriculumLessons,
  loadDailyTeachingLogs,
  computeLessonPacingStats,
  normalizeKeyText,
} from "../../utils/schoolSyllabusLogEngine";
import {
  PeriodTeachingLogModal,
  type PeriodTeachingLogPrefill,
} from "./PeriodTeachingLogModal";

interface Props {
  schoolId: string;
  role: "ADMIN" | "TEACHER";
  classes: SchoolClass[];
  subjects?: SchoolSubject[];
  teachers?: SchoolTeacher[];
  currentTeacherId?: string;
  currentTeacherName?: string;
  onOpenFullTimetable?: () => void;
  onOpenSyllabusTracker?: () => void;
}

export const HomeDailyRoutineWidget: React.FC<Props> = ({
  schoolId,
  role,
  classes,
  subjects = [],
  teachers = [],
  currentTeacherId,
  currentTeacherName,
  onOpenFullTimetable,
  onOpenSyllabusTracker,
}) => {
  const [selectedDay, setSelectedDay] = useState<string>(() => getDayNameFromIso());
  const [selectedDate] = useState<string>(() => getTodayIsoDate());
  const [routineItems, setRoutineItems] = useState<DailyRoutineSlotItem[]>([]);
  const [lessons, setLessons] = useState<SubjectLessonPlan[]>([]);
  const [logs, setLogs] = useState<DailyTeachingLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin filters
  const [filterTeacher, setFilterTeacher] = useState<string>("ALL");
  const [filterClassId, setFilterClassId] = useState<string>("ALL");

  // Modal state
  const [logModalPrefill, setLogModalPrefill] =
    useState<PeriodTeachingLogPrefill | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  const loadAll = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [slots, ls, lg] = await Promise.all([
        loadDailyRoutineForDay(
          schoolId,
          classes,
          selectedDay,
          role === "TEACHER"
            ? { teacherId: currentTeacherId, teacherName: currentTeacherName }
            : null
        ),
        loadCurriculumLessons(schoolId),
        loadDailyTeachingLogs(schoolId),
      ]);
      setRoutineItems(slots);
      setLessons(ls);
      setLogs(lg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [schoolId, selectedDay, classes.length, role, currentTeacherId, currentTeacherName]);

  useEffect(() => {
    const handler = () => {
      void loadAll();
    };
    window.addEventListener(SYLLABUS_LOG_EVENT, handler);
    return () => window.removeEventListener(SYLLABUS_LOG_EVENT, handler);
  }, [schoolId, selectedDay]);

  const { subjectSummaries } = useMemo(
    () => computeLessonPacingStats(lessons, logs),
    [lessons, logs]
  );

  // Lookup running lesson & % for a given (classId/className, subjectName)
  const getRunningLessonInfo = (classId: string, className: string, subjectName: string) => {
    const matched = subjectSummaries.find(
      (s) =>
        (s.classId === classId ||
          normalizeKeyText(s.className) === normalizeKeyText(className)) &&
        normalizeKeyText(s.subjectName) === normalizeKeyText(subjectName)
    );
    return matched || null;
  };

  // Lookup today's logs for a specific period slot
  const getTodayLogsForSlot = (slot: DailyRoutineSlotItem) => {
    return logs.filter(
      (l) =>
        l.date === selectedDate &&
        (l.classId === slot.classId ||
          normalizeKeyText(l.className) === normalizeKeyText(slot.className)) &&
        normalizeKeyText(l.subjectName) === normalizeKeyText(slot.subjectName)
    );
  };

  const uniqueTeachersInRoutine = useMemo(() => {
    const set = new Set<string>();
    routineItems.forEach((r) => {
      if (r.teacherName && r.teacherName !== "Unassigned") set.add(r.teacherName);
    });
    teachers.forEach((t) => {
      if (t.name) set.add(t.name);
    });
    return Array.from(set).sort();
  }, [routineItems, teachers]);

  const filteredRoutine = useMemo(() => {
    return routineItems.filter((item) => {
      if (role === "ADMIN" && filterTeacher !== "ALL") {
        if (normalizeKeyText(item.teacherName) !== normalizeKeyText(filterTeacher)) {
          return false;
        }
      }
      if (role === "ADMIN" && filterClassId !== "ALL") {
        if (item.classId !== filterClassId) return false;
      }
      return true;
    });
  }, [routineItems, role, filterTeacher, filterClassId]);

  const todayLogsCount = useMemo(() => {
    return logs.filter((l) => {
      if (l.date !== selectedDate) return false;
      if (role === "TEACHER" && currentTeacherName) {
        return (
          normalizeKeyText(l.teacherName).includes(normalizeKeyText(currentTeacherName)) ||
          (currentTeacherId && l.teacherId === currentTeacherId)
        );
      }
      return true;
    }).length;
  }, [logs, selectedDate, role, currentTeacherId, currentTeacherName]);

  const openModalForSlot = (
    slot: DailyRoutineSlotItem | null,
    initialMode: "lesson_teaching" | "exercise"
  ) => {
    if (slot) {
      setLogModalPrefill({
        classId: slot.classId,
        className: slot.className,
        section: slot.section,
        subjectName: slot.subjectName,
        periodNumber: slot.periodNumber,
        periodLabel: slot.periodLabel,
        periodTime:
          slot.startTime && slot.endTime
            ? `${slot.startTime}–${slot.endTime}`
            : "",
        teacherId: slot.teacherId || currentTeacherId,
        teacherName:
          role === "TEACHER"
            ? currentTeacherName || slot.teacherName
            : slot.teacherName,
        date: selectedDate,
        initialMode,
      });
    } else {
      setLogModalPrefill({
        classId: classes[0]?.id,
        className: classes[0]?.name,
        teacherId: currentTeacherId,
        teacherName: currentTeacherName || "Admin / Teacher",
        date: selectedDate,
        initialMode,
      });
    }
    setIsLogModalOpen(true);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 py-3.5 bg-slate-50/80 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
              <Clock className="w-3 h-3" />
              <span>Daily Period Routine</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {selectedDay} · {todayLogsCount} Notes Logged Today
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1">
            {role === "TEACHER"
              ? `Aaj Ka Mera Timetable & Teaching Diary (${currentTeacherName || "Teacher"})`
              : "Aaj Ka Live Period-Wise School Routine"}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => openModalForSlot(null, "lesson_teaching")}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Teach / Notes</span>
          </button>
          <button
            type="button"
            onClick={() => openModalForSlot(null, "exercise")}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Exercise</span>
          </button>
          {onOpenFullTimetable && (
            <button
              type="button"
              onClick={onOpenFullTimetable}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <span>Edit Routine</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Day Switcher + Admin Filters */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {DAYS_OF_WEEK_LIST.map((day) => {
            const active = selectedDay === day;
            const isToday = day === getDayNameFromIso();
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                }`}
              >
                {day.slice(0, 3)}
                {isToday ? " (Today)" : ""}
              </button>
            );
          })}
        </div>

        {role === "ADMIN" && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Teachers</option>
              {uniqueTeachersInRoutine.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.section ? `(${c.section})` : ""}
                </option>
              ))}
            </select>

            {onOpenSyllabusTracker && (
              <button
                type="button"
                onClick={onOpenSyllabusTracker}
                className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-bold cursor-pointer hover:bg-teal-100 inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Syllabus Pacing</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Period Cards Grid */}
      <div className="p-3.5 sm:p-4">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Loading period-wise routine...
          </p>
        ) : filteredRoutine.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
            <Calendar className="w-7 h-7 text-indigo-400 mx-auto" />
            <p className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200">
              {role === "TEACHER"
                ? `${selectedDay} ke liye aapka koi period assign nahi dikh raha hai`
                : `${selectedDay} ke liye abhi Timetable set nahi kiya gaya hai`}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Top bar ke <strong>Routine</strong> button se period set karein, ya upar <strong>+ Teach / Notes</strong> / <strong>+ Exercise</strong> se seedha daily notes &amp; pics upload karein.
            </p>
            {onOpenFullTimetable && (
              <button
                type="button"
                onClick={onOpenFullTimetable}
                className="mt-1 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer"
              >
                Open Routine &amp; Timetable
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredRoutine.map((slot) => {
              const pacing = getRunningLessonInfo(
                slot.classId,
                slot.className,
                slot.subjectName
              );
              const todaySlotLogs = getTodayLogsForSlot(slot);
              const totalPicsToday = todaySlotLogs.reduce(
                (acc, lg) => acc + (lg.noteImages?.length || 0),
                0
              );

              return (
                <div
                  key={slot.id}
                  className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition ${
                    slot.isLiveNow
                      ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-400/40"
                      : "bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 hover:border-indigo-400"
                  }`}
                >
                  <div className="space-y-1.5">
                    {/* Period Number + Timing + Live tag */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black">
                          P-{slot.periodNumber}
                        </span>
                        {(slot.startTime || slot.endTime) && (
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                            {slot.startTime}–{slot.endTime}
                          </span>
                        )}
                      </div>
                      {slot.isLiveNow ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold uppercase inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          <span>Live Now</span>
                        </span>
                      ) : todaySlotLogs.length > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Done ({totalPicsToday} Pics)</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Class + Subject + Teacher */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {slot.className}
                          {slot.section ? ` (${slot.section})` : ""} · {slot.subjectName}
                        </p>
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-0.5">
                        <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">{slot.teacherName}</span>
                        {slot.room && (
                          <span className="text-[10px] text-slate-400">· Rm {slot.room}</span>
                        )}
                      </p>
                    </div>

                    {/* Current Running Lesson Badge */}
                    <div className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700 text-[11px]">
                      {pacing?.currentRunningLessonTitle ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-indigo-700 dark:text-indigo-300 truncate flex items-center gap-1">
                            <BookOpen className="w-3 h-3 shrink-0" />
                            <span className="truncate">{pacing.currentRunningLessonTitle}</span>
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0 tabular-nums">
                            {pacing.overallPercent}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          Lesson plan select karein padhane ke liye
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons: Teach Lesson & Notes vs Exercise / Q&A */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => openModalForSlot(slot, "lesson_teaching")}
                      className="py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Topics &amp; Pics</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openModalForSlot(slot, "exercise")}
                      className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Exercise Pics</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2-Step Teaching & Multi-Pic Modal */}
      <PeriodTeachingLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        schoolId={schoolId}
        classes={classes}
        subjects={subjects}
        prefill={logModalPrefill}
        defaultTeacherId={currentTeacherId}
        defaultTeacherName={currentTeacherName}
        onSaved={() => {
          void loadAll();
        }}
      />
    </div>
  );
};
