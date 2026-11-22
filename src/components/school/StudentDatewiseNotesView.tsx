import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  BookOpen,
  PenTool,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  type DailyTeachingLog,
  SYLLABUS_LOG_EVENT,
  getTodayIsoDate,
  formatShortDisplayDate,
  getTelegramFallbackUrl,
  resolveTeachingImageSrc,
  loadDailyTeachingLogs,
  normalizeKeyText,
} from "../../utils/schoolSyllabusLogEngine";

interface Props {
  schoolId: string;
  classId?: string;
  className?: string;
  darkSurface?: boolean;
  title?: string;
  sessionLabel?: string;
  initialDateFilter?: string;
  initialSubjectFilter?: string;
}

export const StudentDatewiseNotesView: React.FC<Props> = ({
  schoolId,
  classId,
  className,
  darkSurface = false,
  title = "Class Work — Daily Notes, Topics & Pics (Date-wise)",
  sessionLabel,
  initialDateFilter,
  initialSubjectFilter,
}) => {
  const [logs, setLogs] = useState<DailyTeachingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(initialDateFilter || "ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubjectFilter || "ALL");
  const [lightboxState, setLightboxState] = useState<{
    images: string[];
    fileIds?: string[];
    index: number;
    caption: string;
  } | null>(null);

  useEffect(() => {
    if (initialDateFilter) setSelectedDate(initialDateFilter);
  }, [initialDateFilter]);

  useEffect(() => {
    if (initialSubjectFilter) setSelectedSubject(initialSubjectFilter);
  }, [initialSubjectFilter]);

  const refresh = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const all = await loadDailyTeachingLogs(schoolId);
      setLogs(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const handler = () => {
      void refresh();
    };
    window.addEventListener(SYLLABUS_LOG_EVENT, handler);
    return () => window.removeEventListener(SYLLABUS_LOG_EVENT, handler);
  }, [schoolId]);

  const classLogs = useMemo(() => {
    return logs
      .filter((l) => {
        if (!classId && !className) return true;
        const idMatch = Boolean(classId && l.classId === classId);
        const nameMatch = Boolean(
          className &&
            (normalizeKeyText(l.className) === normalizeKeyText(className) ||
              normalizeKeyText(l.className).includes(normalizeKeyText(className)) ||
              normalizeKeyText(className).includes(normalizeKeyText(l.className)))
        );
        return idMatch || nameMatch;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [logs, classId, className]);

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    classLogs.forEach((l) => {
      if (l.subjectName) set.add(l.subjectName);
    });
    return Array.from(set).sort();
  }, [classLogs]);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    classLogs.forEach((l) => {
      if (l.date) set.add(l.date);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [classLogs]);

  const filteredLogs = useMemo(() => {
    return classLogs.filter((l) => {
      if (selectedDate !== "ALL" && l.date !== selectedDate) return false;
      if (
        selectedSubject !== "ALL" &&
        normalizeKeyText(l.subjectName) !== normalizeKeyText(selectedSubject)
      ) {
        return false;
      }
      return true;
    });
  }, [classLogs, selectedDate, selectedSubject]);

  // Group filtered logs by date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, DailyTeachingLog[]>();
    filteredLogs.forEach((lg) => {
      const d = lg.date || "Unknown";
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(lg);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLogs]);

  const todayIso = getTodayIsoDate();
  const yesterdayIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const cardBg = darkSurface
    ? "bg-slate-900 border-slate-800 text-white"
    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white";

  const subText = darkSurface
    ? "text-slate-400"
    : "text-slate-500 dark:text-slate-400";

  return (
    <div className="space-y-4">
      {/* Header & Date-wise Filter Bar */}
      <div className={`p-4 rounded-2xl border ${cardBg} space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>{title}</span>
            </h3>
            <p className={`text-xs mt-0.5 ${subText}`}>
              Pure session me kis date ko kya padhaya gaya, kaunse topics hue aur board/copy notes pics date-wise dekhein.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-center">
            {sessionLabel && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 dark:text-emerald-300 border border-emerald-500/30">
                Session {sessionLabel}
              </span>
            )}
            <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 border border-indigo-500/30">
              {filteredLogs.length} Daily Updates
            </span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate("ALL")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
              selectedDate === "ALL"
                ? "bg-indigo-600 text-white"
                : darkSurface
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            }`}
          >
            All Dates ({availableDates.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(todayIso)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
              selectedDate === todayIso
                ? "bg-indigo-600 text-white"
                : darkSurface
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(yesterdayIso)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-black cursor-pointer transition ${
              selectedDate === yesterdayIso
                ? "bg-indigo-600 text-white"
                : darkSurface
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            }`}
          >
            Yesterday
          </button>

          <input
            type="date"
            value={selectedDate === "ALL" ? "" : selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || "ALL")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
              darkSurface
                ? "bg-slate-800 border-slate-700 text-white"
                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
            }`}
          />

          {availableSubjects.length > 0 && (
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                darkSurface
                  ? "bg-slate-800 border-slate-700 text-white"
                  : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
              }`}
            >
              <option value="ALL">All Subjects</option>
              {availableSubjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Date-Wise Groups */}
      {loading ? (
        <div className={`p-8 rounded-2xl border text-center text-xs ${cardBg} ${subText}`}>
          Loading daily class notes...
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className={`p-8 rounded-2xl border text-center ${cardBg}`}>
          <ImageIcon className="w-8 h-8 text-indigo-400/60 mx-auto mb-2" />
          <p className="text-sm font-bold">
            Is date ke liye abhi koi Daily Class Notes ya Exercise Pics upload nahi hui hain
          </p>
          <p className={`text-xs mt-1 ${subText}`}>
            Jaise hi Teacher apne period me Topics aur Notes/Exercise Pics upload karenge, yahan date-wise dikhne lagenge.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([dateKey, items]) => (
            <div key={dateKey} className="space-y-2.5">
              {/* Date Divider */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black shadow-xs">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatShortDisplayDate(dateKey)}</span>
                </span>
                <span className={`text-[11px] font-bold ${subText}`}>
                  {items.length} {items.length === 1 ? "Period Update" : "Period Updates"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((lg) => {
                  const isExercise = lg.logMode === "exercise";
                  return (
                    <div
                      key={lg.id}
                      className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}
                    >
                      {/* Subject + Mode Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 border border-indigo-500/30 text-[11px] font-black">
                            {lg.subjectName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 ${
                              isExercise
                                ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-500 dark:text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {isExercise ? (
                              <>
                                <PenTool className="w-3 h-3" />
                                <span>Exercise / Q&amp;A</span>
                              </>
                            ) : (
                              <>
                                <BookOpen className="w-3 h-3" />
                                <span>Lesson Notes</span>
                              </>
                            )}
                          </span>
                        </div>
                        {lg.periodNumber && (
                          <span className={`text-[10px] font-bold ${subText}`}>
                            P-{lg.periodNumber} {lg.periodTime ? `(${lg.periodTime})` : ""}
                          </span>
                        )}
                      </div>

                      {/* Lesson Title */}
                      <div>
                        <h4 className="text-sm font-black">{lg.lessonTitle}</h4>
                        <p className={`text-[11px] flex items-center gap-1.5 mt-0.5 ${subText}`}>
                          <User className="w-3 h-3" />
                          <span>{lg.teacherName}</span>
                          {lg.className && !classId && (
                            <span>· {lg.className}</span>
                          )}
                        </p>
                      </div>

                      {/* Taught Topics */}
                      {lg.selectedTopicTitles && lg.selectedTopicTitles.length > 0 && (
                        <div className="space-y-1">
                          <p className={`text-[10px] font-black uppercase tracking-wide ${subText}`}>
                            Topics Taught:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {lg.selectedTopicTitles.map((t, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25 text-[11px] font-bold"
                              >
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span>{t}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Exercise Note */}
                      {lg.exerciseNote && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs">
                          <span className="font-black text-emerald-600 dark:text-emerald-300">
                            ✍️ Solved Questions:{" "}
                          </span>
                          <span>{lg.exerciseNote}</span>
                        </div>
                      )}

                      {/* Homework Text */}
                      {lg.homeworkText && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
                          <span className="font-black text-amber-600 dark:text-amber-300">
                            📝 Homework:{" "}
                          </span>
                          <span>{lg.homeworkText}</span>
                        </div>
                      )}

                      {/* Multi-Pic Notes / Exercise Gallery (1–15 Pics) */}
                      {lg.noteImages && lg.noteImages.length > 0 && (
                        <div className="space-y-1.5">
                          <p className={`text-[10px] font-black uppercase tracking-wide flex items-center gap-1 ${subText}`}>
                            <ImageIcon className="w-3 h-3 text-indigo-500" />
                            <span>
                              Class Notes / Board Pics ({lg.noteImages.length} Photos — Tap to Zoom)
                            </span>
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                            {lg.noteImages.map((rawSrc, pIdx) => {
                              const fileId = lg.noteImageFileIds?.[pIdx];
                              const resolvedSrc = resolveTeachingImageSrc(rawSrc, fileId);
                              return (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() =>
                                    setLightboxState({
                                      images: lg.noteImages.map((u, idx2) =>
                                        resolveTeachingImageSrc(u, lg.noteImageFileIds?.[idx2])
                                      ),
                                      fileIds: lg.noteImageFileIds,
                                      index: pIdx,
                                      caption: `${lg.subjectName} · ${lg.lessonTitle} (${formatShortDisplayDate(lg.date)})`,
                                    })
                                  }
                                  className="relative rounded-xl overflow-hidden aspect-square border border-slate-300/40 dark:border-slate-700 hover:ring-2 hover:ring-indigo-500 transition cursor-pointer bg-slate-800"
                                >
                                  <img
                                    src={resolvedSrc}
                                    alt={`Note ${pIdx + 1}`}
                                    onError={(e) => {
                                      const img = e.currentTarget;
                                      if (img.dataset.tgFallbackApplied) return;
                                      const fb = getTelegramFallbackUrl(fileId);
                                      if (fb && img.src !== fb) {
                                        img.dataset.tgFallbackApplied = "1";
                                        img.src = fb;
                                      }
                                    }}
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-black">
                                    {pIdx + 1}/{lg.noteImages.length}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Multi-Image Lightbox with Prev / Next & Download */}
      {lightboxState && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex flex-col items-center justify-center p-3 sm:p-6"
          onClick={() => setLightboxState(null)}
        >
          <div
            className="w-full max-w-4xl flex items-center justify-between text-white mb-3 gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs sm:text-sm font-bold truncate">
              {lightboxState.caption} — Photo {lightboxState.index + 1} of{" "}
              {lightboxState.images.length}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={lightboxState.images[lightboxState.index]}
                download={`class-note-${lightboxState.index + 1}.jpg`}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save</span>
              </a>
              <button
                type="button"
                onClick={() => setLightboxState(null)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex items-center justify-center w-full max-w-4xl flex-1 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxState.images.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxState((prev) =>
                    prev
                      ? {
                          ...prev,
                          index:
                            (prev.index - 1 + prev.images.length) %
                            prev.images.length,
                        }
                      : null
                  )
                }
                className="absolute left-2 p-2.5 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer z-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <img
              src={lightboxState.images[lightboxState.index]}
              alt="Class Note Full"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.dataset.tgFallbackApplied) return;
                const fb = getTelegramFallbackUrl(lightboxState.fileIds?.[lightboxState.index]);
                if (fb && img.src !== fb) {
                  img.dataset.tgFallbackApplied = "1";
                  img.src = fb;
                }
              }}
              className="max-w-full max-h-[80vh] rounded-xl object-contain"
            />

            {lightboxState.images.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxState((prev) =>
                    prev
                      ? {
                          ...prev,
                          index: (prev.index + 1) % prev.images.length,
                        }
                      : null
                  )
                }
                className="absolute right-2 p-2.5 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer z-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
