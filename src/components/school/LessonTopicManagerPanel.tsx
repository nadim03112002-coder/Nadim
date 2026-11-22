import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ListChecks,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  FilePlus2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { SchoolClass, SchoolSubject } from "../../school-types";
import {
  type SubjectLessonPlan,
  type DailyTeachingLog,
  SYLLABUS_LOG_EVENT,
  loadCurriculumLessons,
  saveCurriculumLessons,
  loadDailyTeachingLogs,
  computeLessonPacingStats,
  formatShortDisplayDate,
  normalizeKeyText,
} from "../../utils/schoolSyllabusLogEngine";

interface Props {
  schoolId: string;
  selectedClass: SchoolClass;
  subject: SchoolSubject;
  onDeleteSubject?: () => void;
}

export const LessonTopicManagerPanel: React.FC<Props> = ({
  schoolId,
  selectedClass,
  subject,
  onDeleteSubject,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [allLessons, setAllLessons] = useState<SubjectLessonPlan[]>([]);
  const [allLogs, setAllLogs] = useState<DailyTeachingLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Lesson state
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonBulkTopics, setNewLessonBulkTopics] = useState("");

  // Add Topics into existing Lesson state
  const [addingTopicLessonId, setAddingTopicLessonId] = useState<string | null>(null);
  const [topicInputText, setTopicInputText] = useState("");

  // Inline confirm delete lesson
  const [confirmDeleteLessonId, setConfirmDeleteLessonId] = useState<string | null>(null);

  const refreshData = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [ls, lg] = await Promise.all([
        loadCurriculumLessons(schoolId),
        loadDailyTeachingLogs(schoolId),
      ]);
      setAllLessons(ls);
      setAllLogs(lg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
    const handler = () => {
      void refreshData();
    };
    window.addEventListener(SYLLABUS_LOG_EVENT, handler);
    return () => window.removeEventListener(SYLLABUS_LOG_EVENT, handler);
  }, [schoolId]);

  const subjectLessons = useMemo(() => {
    return allLessons
      .filter(
        (l) =>
          (l.classId === selectedClass.id ||
            normalizeKeyText(l.className) === normalizeKeyText(selectedClass.name)) &&
          (l.subjectId === subject.id ||
            normalizeKeyText(l.subjectName) === normalizeKeyText(subject.name))
      )
      .sort((a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0));
  }, [allLessons, selectedClass.id, selectedClass.name, subject.id, subject.name]);

  const pacingMap = useMemo(() => {
    const { lessonStats } = computeLessonPacingStats(subjectLessons, allLogs);
    const map = new Map<string, (typeof lessonStats)[number]>();
    lessonStats.forEach((st) => map.set(st.lesson.id, st));
    return map;
  }, [subjectLessons, allLogs]);

  const subjectOverallPct = useMemo(() => {
    if (subjectLessons.length === 0) return 0;
    const sum = subjectLessons.reduce(
      (acc, l) => acc + (pacingMap.get(l.id)?.percentComplete || 0),
      0
    );
    return Math.round(sum / subjectLessons.length);
  }, [subjectLessons, pacingMap]);

  const totalTopicsCount = useMemo(
    () => subjectLessons.reduce((acc, l) => acc + l.topics.length, 0),
    [subjectLessons]
  );

  const handleAddLesson = async () => {
    const title = newLessonTitle.trim();
    if (!title) {
      toast.error("Lesson ka naam likhein (e.g. Chapter 1: Chemical Reactions)");
      return;
    }

    const parsedTopics = newLessonBulkTopics
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
      subjectLessons.length > 0
        ? Math.max(...subjectLessons.map((l) => l.lessonNumber || 0)) + 1
        : 1;

    const newLesson: SubjectLessonPlan = {
      id: `les_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      schoolId,
      classId: selectedClass.id,
      className: selectedClass.name,
      subjectId: subject.id,
      subjectName: subject.name,
      lessonNumber: nextNum,
      title,
      topics: parsedTopics,
      createdAt: now,
      updatedAt: now,
    };

    const nextAll = [...allLessons, newLesson];
    setAllLessons(nextAll);
    await saveCurriculumLessons(schoolId, nextAll);
    setNewLessonTitle("");
    setNewLessonBulkTopics("");
    setShowAddLesson(false);
    setExpanded(true);
    toast.success(
      `Lesson "${title}" (${parsedTopics.length} topics) save ho gaya!`
    );
  };

  const handleAddTopicsToLesson = async (lessonId: string) => {
    const lines = topicInputText
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error("Kam se kam 1 topic likhein (har line me 1 topic)");
      return;
    }

    const now = new Date().toISOString();
    const nextAll = allLessons.map((les) => {
      if (les.id !== lessonId) return les;
      const startOrder = les.topics.length;
      const additions = lines.map((title, idx) => ({
        id: `top_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        order: startOrder + idx + 1,
      }));
      return {
        ...les,
        topics: [...les.topics, ...additions],
        updatedAt: now,
      };
    });

    setAllLessons(nextAll);
    await saveCurriculumLessons(schoolId, nextAll);
    setTopicInputText("");
    setAddingTopicLessonId(null);
    toast.success(`${lines.length} topic(s) lesson me jode gaye!`);
  };

  const handleDeleteTopic = async (lessonId: string, topicId: string) => {
    const now = new Date().toISOString();
    const nextAll = allLessons.map((les) => {
      if (les.id !== lessonId) return les;
      return {
        ...les,
        topics: les.topics
          .filter((t) => t.id !== topicId)
          .map((t, idx) => ({ ...t, order: idx + 1 })),
        updatedAt: now,
      };
    });
    setAllLessons(nextAll);
    await saveCurriculumLessons(schoolId, nextAll);
    toast.success("Topic hata diya gaya");
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const nextAll = allLessons.filter((l) => l.id !== lessonId);
    setAllLessons(nextAll);
    await saveCurriculumLessons(schoolId, nextAll);
    setConfirmDeleteLessonId(null);
    toast.success("Lesson delete ho gaya");
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
      {/* Subject Header Row */}
      <div className="p-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-black text-sm flex items-center justify-center shrink-0">
            {subject.name ? subject.name.charAt(0).toUpperCase() : "S"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-slate-900 dark:text-white text-sm sm:text-base truncate">
                {subject.name}
              </p>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                {subjectLessons.length} Lessons · {totalTopicsCount} Topics
              </span>
              {subjectLessons.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                  {subjectOverallPct}% Done
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Click to manage Lessons (पाठ) &amp; Topics list for Daily Teaching &amp; Syllabus Pacing
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              setShowAddLesson((p) => !p);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Lesson</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 transition cursor-pointer"
            title={expanded ? "Collapse Lessons" : "Expand Lessons & Topics"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {onDeleteSubject && (
            <button
              type="button"
              onClick={onDeleteSubject}
              className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
              title="Delete Subject"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Lesson & Topics Section */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-3">
          {/* Add New Lesson Form */}
          {showAddLesson && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-3.5 border-2 border-indigo-500/30 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <FilePlus2 className="w-4 h-4" />
                  <span>Add New Lesson &amp; Topics ({subject.name})</span>
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddLesson(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="Lesson Name (e.g. Chapter 1: Real Numbers / पाठ 1: रासायनिक अभिक्रियाएँ)"
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Topics List (हर लाइन में 1 टॉपिक लिखें — Bulk Paste भी कर सकते हैं):
                </label>
                <textarea
                  rows={4}
                  value={newLessonBulkTopics}
                  onChange={(e) => setNewLessonBulkTopics(e.target.value)}
                  placeholder={"1. Euclid's Division Lemma\n2. Fundamental Theorem of Arithmetic\n3. Irrational Numbers Proof\n4. Decimal Expansions"}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white resize-y"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddLesson}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer"
                >
                  Save Lesson &amp; Topics
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLesson(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Existing Lessons List */}
          {loading && subjectLessons.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Loading lessons...</p>
          ) : subjectLessons.length === 0 ? (
            <div className="text-center py-5 bg-white dark:bg-slate-800/70 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <Layers className="w-6 h-6 text-indigo-400 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Is subject me abhi koi Lesson add nahi hua hai
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Lesson aur uske Topics yahan add karein — daily padhai me teacher yahi se select karenge.
              </p>
              <button
                type="button"
                onClick={() => setShowAddLesson(true)}
                className="mt-2.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ First Lesson Add Karein</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {subjectLessons.map((les) => {
                const stat = pacingMap.get(les.id);
                const pct = stat?.percentComplete || 0;
                const taughtSet = new Set(stat?.taughtTopicIds || []);

                return (
                  <div
                    key={les.id}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-2.5"
                  >
                    {/* Lesson Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            L-{les.lessonNumber}
                          </span>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            {les.title}
                          </h4>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded ${
                              stat?.status === "COMPLETED"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                : stat?.status === "RUNNING"
                                ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
                            }`}
                          >
                            {pct}% ({taughtSet.size}/{les.topics.length} Topics)
                          </span>
                        </div>
                        {stat && (stat.startDate || stat.totalDays > 0) && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                            <span>
                              Start: <strong>{formatShortDisplayDate(stat.startDate)}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Days Taught: <strong>{stat.totalDays}</strong>
                            </span>
                            {stat.exerciseDays > 0 && (
                              <>
                                <span>•</span>
                                <span>
                                  Exercise Days: <strong>{stat.exerciseDays}</strong>
                                </span>
                              </>
                            )}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingTopicLessonId(
                              addingTopicLessonId === les.id ? null : les.id
                            );
                            setTopicInputText("");
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black flex items-center gap-1 cursor-pointer hover:bg-emerald-100"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Topics</span>
                        </button>

                        {confirmDeleteLessonId === les.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteLesson(les.id)}
                              className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteLessonId(null)}
                              className="px-1.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteLessonId(les.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete Lesson"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct >= 100
                            ? "bg-emerald-500"
                            : pct > 0
                            ? "bg-indigo-500"
                            : "bg-slate-300 dark:bg-slate-600"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Inline Add Topics Box */}
                    {addingTopicLessonId === les.id && (
                      <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                        <textarea
                          rows={3}
                          value={topicInputText}
                          onChange={(e) => setTopicInputText(e.target.value)}
                          placeholder="Har line me 1 Topic likhein (Bulk Paste supported)..."
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddTopicsToLesson(les.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer"
                          >
                            Add Topics
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingTopicLessonId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Topics Chips / List */}
                    {les.topics.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {les.topics.map((top, tIdx) => {
                          const isTaught = taughtSet.has(top.id);
                          const firstDate = stat?.topicFirstTaughtDate?.[top.id];
                          return (
                            <div
                              key={top.id}
                              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                                isTaught
                                  ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                                  : "bg-slate-50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isTaught ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                <span className="truncate font-semibold">
                                  {tIdx + 1}. {top.title}
                                </span>
                                {firstDate && (
                                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    ({formatShortDisplayDate(firstDate)})
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteTopic(les.id, top.id)}
                                className="text-slate-400 hover:text-rose-500 shrink-0 cursor-pointer"
                                title="Remove topic"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        Koi topic list add nahi hai — "+ Topics" click karke topic list add karein.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
