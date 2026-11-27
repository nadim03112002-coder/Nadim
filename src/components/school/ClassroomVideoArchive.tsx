// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Youtube, Calendar, BookOpen, Clock, User, Plus, Trash2, Edit3,
  Search, Play, ChevronLeft, ChevronRight, Video, Sparkles, Filter,
  Layers, CheckCircle2, AlertCircle, Save, X, ExternalLink, Crown,
  Radio, Globe, Bell, StopCircle, Share2
} from "lucide-react";
import {
  type School, type SchoolClass, type SchoolSession, type SchoolTeacher, type SchoolSubject,
  type DailyClassLecture, isSchoolEliteCurriculum
} from "../../school-types";
import {
  getClassLectures, saveClassLecture, deleteClassLecture,
  extractYouTubeVideoId, generateId, archiveExpiredEventStatusesToLibrary
} from "../../school-firebase";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { CustomPlayer } from "../CustomPlayer";
import { rotateScreen } from "../../utils/displayPrefs";
import { ADMIN_WHATSAPP_NUMBER } from "../../constants";

interface Props {
  school: School;
  classes: SchoolClass[];
  teachers?: SchoolTeacher[];
  subjects?: SchoolSubject[];
  activeSession?: SchoolSession | null;
  currentUserRole?: "ADMIN" | "TEACHER" | "STUDENT";
  currentTeacherName?: string;
  currentTeacherId?: string;
  studentClassId?: string;
  studentClassName?: string;
  onBack?: () => void;
}

const MONTH_NAMES = [
  { key: "04", name: "April" },
  { key: "05", name: "May" },
  { key: "06", name: "June" },
  { key: "07", name: "July" },
  { key: "08", name: "August" },
  { key: "09", name: "September" },
  { key: "10", name: "October" },
  { key: "11", name: "November" },
  { key: "12", name: "December" },
  { key: "01", name: "January" },
  { key: "02", name: "February" },
  { key: "03", name: "March" },
];

export const ClassroomVideoArchive: React.FC<Props> = ({
  school,
  classes = [],
  teachers = [],
  subjects = [],
  activeSession,
  currentUserRole = "ADMIN",
  currentTeacherName = "Teacher",
  currentTeacherId = "",
  studentClassId = "",
  studentClassName = "",
  onBack,
}) => {
  const isAdmin = currentUserRole === "ADMIN";
  const isTeacher = currentUserRole === "TEACHER";
  const canEdit = isAdmin || isTeacher;
  const isStudentLocked = currentUserRole === "STUDENT" && Boolean(studentClassId || studentClassName);

  const normalizeClassKey = (val?: string): string => {
    const raw = String(val || "")
      .toLowerCase()
      .replace(/^(cls_|class_|c_|demo_class_)/i, "")
      .replace(/\b(class|std|standard|grade)\b/gi, "")
      .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
      .replace(/\(.*?\)/g, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!raw) return "";
    if (raw === "nur" || raw === "nursery") return "nursery";
    if (raw === "kg 1" || raw === "kg1" || raw === "lkg") return "lkg";
    if (raw === "kg 2" || raw === "kg2" || raw === "ukg") return "ukg";
    return raw;
  };

  // Deduplicate class buttons (merge duplicate class names across sections cleanly)
  const deduplicatedClasses = useMemo(() => {
    const byKey = new Map<
      string,
      { id: string; name: string; normKey: string; matchingIds: Set<string>; matchingNames: Set<string> }
    >();
    (Array.isArray(classes) ? classes : []).forEach((cls) => {
      if (!cls || !cls.name) return;
      const cleanName = cls.name.trim();
      const normKey = normalizeClassKey(cleanName) || cleanName.toLowerCase();
      const existing = byKey.get(normKey);
      if (existing) {
        if (cls.id) existing.matchingIds.add(cls.id);
        existing.matchingNames.add(cleanName.toLowerCase());
      } else {
        const ids = new Set<string>();
        if (cls.id) ids.add(cls.id);
        byKey.set(normKey, {
          id: cls.id || cleanName,
          name: cleanName,
          normKey,
          matchingIds: ids,
          matchingNames: new Set<string>([cleanName.toLowerCase()]),
        });
      }
    });
    return Array.from(byKey.values());
  }, [classes]);

  const lockedStudentClassGroup = useMemo(() => {
    if (!isStudentLocked) return null;
    const targetNorm = normalizeClassKey(studentClassName) || normalizeClassKey(studentClassId);
    const byId = studentClassId
      ? deduplicatedClasses.find(
          (g) => g.id === studentClassId || g.matchingIds.has(studentClassId)
        )
      : undefined;
    if (byId) return byId;
    if (targetNorm) {
      const byNorm = deduplicatedClasses.find((g) => g.normKey === targetNorm);
      if (byNorm) return byNorm;
    }
    return {
      id: studentClassId || targetNorm || "student_class",
      name: studentClassName || "My Class",
      normKey: targetNorm,
      matchingIds: new Set<string>(studentClassId ? [studentClassId] : []),
      matchingNames: new Set<string>(
        studentClassName ? [studentClassName.trim().toLowerCase()] : []
      ),
    };
  }, [isStudentLocked, deduplicatedClasses, studentClassId, studentClassName]);

  // View Tabs: LIVE vs RECORDED vs UNIVERSAL
  const [activeTab, setActiveTab] = useState<"LIVE" | "RECORDED" | "UNIVERSAL">("RECORDED");

  // Hierarchical Class State (Strictly locked for students, deduplicated for staff)
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (isStudentLocked) {
      return lockedStudentClassGroup?.id || studentClassId || "";
    }
    return deduplicatedClasses[0]?.id || classes[0]?.id || "";
  });

  useEffect(() => {
    if (isStudentLocked) {
      const lockedId = lockedStudentClassGroup?.id || studentClassId || "";
      if (lockedId && selectedClassId !== lockedId) {
        setSelectedClassId(lockedId);
      }
    } else if (!selectedClassId && deduplicatedClasses.length > 0) {
      setSelectedClassId(deduplicatedClasses[0].id);
    }
  }, [isStudentLocked, lockedStudentClassGroup?.id, studentClassId, deduplicatedClasses, selectedClassId]);

  const selectedClass = useMemo(() => {
    if (isStudentLocked && lockedStudentClassGroup) {
      return { id: lockedStudentClassGroup.id, name: lockedStudentClassGroup.name };
    }
    return (
      deduplicatedClasses.find((c) => c.id === selectedClassId || c.matchingIds.has(selectedClassId)) ||
      deduplicatedClasses[0] ||
      classes[0]
    );
  }, [isStudentLocked, lockedStudentClassGroup, deduplicatedClasses, selectedClassId, classes]);

  const selectedClassGroup = useMemo(() => {
    if (isStudentLocked && lockedStudentClassGroup) return lockedStudentClassGroup;
    return (
      deduplicatedClasses.find((g) => g.id === selectedClassId || g.matchingIds.has(selectedClassId)) ||
      deduplicatedClasses[0] ||
      null
    );
  }, [isStudentLocked, lockedStudentClassGroup, deduplicatedClasses, selectedClassId]);

  const doesLectureMatchTargetClass = (lec: DailyClassLecture): boolean => {
    const group = isStudentLocked ? lockedStudentClassGroup : selectedClassGroup;
    if (!group) {
      return Boolean(selectedClassId && lec.classId === selectedClassId);
    }
    if (lec.classId && group.matchingIds.has(lec.classId)) return true;
    const lecNorm = normalizeClassKey(lec.className) || normalizeClassKey(lec.classId);
    if (group.normKey && lecNorm && group.normKey === lecNorm) return true;
    if (lec.className && group.matchingNames.has(lec.className.trim().toLowerCase())) return true;
    return false;
  };

  // Current year & month defaults
  const todayIso = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const currentMonthKey = todayIso.slice(5, 7); // MM
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [searchQuery, setSearchQuery] = useState("");

  // Lectures from DB
  const [lectures, setLectures] = useState<DailyClassLecture[]>([]);
  const [loading, setLoading] = useState(false);

  // Active video player modal
  const [playingLecture, setPlayingLecture] = useState<DailyClassLecture | null>(null);

  // Add / Edit Lecture Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLecture, setEditingLecture] = useState<DailyClassLecture | null>(null);

  // Form State
  const [formIsLive, setFormIsLive] = useState(false);
  const [formIsUniversal, setFormIsUniversal] = useState(false);
  const [formTargetClassId, setFormTargetClassId] = useState(selectedClassId || "");
  const [formPeriod, setFormPeriod] = useState<number>(1);
  const [formSubject, setFormSubject] = useState("");
  const [formTeacher, setFormTeacher] = useState(isTeacher ? currentTeacherName : "");
  const [formTopic, setFormTopic] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSendPush, setFormSendPush] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [confirmEndLiveId, setConfirmEndLiveId] = useState<string | null>(null);
  const [confirmDeleteLectureId, setConfirmDeleteLectureId] = useState<string | null>(null);

  // Load lectures
  const loadLectures = async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      // Ensure any expired 24h Event Videos from NSTA Messenger Status are archived before loading
      await archiveExpiredEventStatusesToLibrary(school.id);
      // Fetch all lectures for school so Live & Universal can be parsed
      const data = await getClassLectures(school.id);
      setLectures(data);

      // Auto switch to LIVE tab if there are active live streams
      const hasLive = data.some(l => l.isLive === true);
      if (hasLive && activeTab !== "LIVE" && !studentClassId) {
        // keep user's current tab or default to live if just mounted
      }
    } catch (e) {
      console.warn("Failed to load lectures:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLectures();
  }, [school?.id]);

  // Listen for external updates
  useEffect(() => {
    const handler = () => loadLectures();
    window.addEventListener("lectures-updated", handler);
    return () => window.removeEventListener("lectures-updated", handler);
  }, [school?.id]);

  // Filter Active Live Streams
  const liveLectures = useMemo(() => {
    return lectures.filter(l => {
      if (l.isLive !== true) return false;
      // If student is logged in, show ONLY their locked class live stream + universal live streams
      if (isStudentLocked) {
        if (l.isUniversal === true || l.classId === "all" || l.classId === "universal") return true;
        return doesLectureMatchTargetClass(l);
      }
      return true;
    });
  }, [lectures, isStudentLocked, lockedStudentClassGroup, selectedClassGroup]);

  // Filter Universal School Archive
  const universalLectures = useMemo(() => {
    return lectures.filter(l => {
      if (l.isLive === true) return false; // Show in live tab when active
      return l.isUniversal === true || l.classId === "all" || l.classId === "universal";
    });
  }, [lectures]);

  // All Recorded Lectures strictly for the active/locked class (used for accurate Apr-Mar Month counts)
  const classRecordedBaseLectures = useMemo(() => {
    return lectures.filter(l => {
      if (l.isLive === true) return false;
      if (l.isUniversal === true || l.classId === "all" || l.classId === "universal") return false;
      return doesLectureMatchTargetClass(l);
    });
  }, [lectures, isStudentLocked, lockedStudentClassGroup, selectedClassGroup, selectedClassId]);

  // Filter Recorded Class Lectures (+ optional search query)
  const classRecordedLectures = useMemo(() => {
    if (!searchQuery.trim()) return classRecordedBaseLectures;
    const q = searchQuery.toLowerCase();
    return classRecordedBaseLectures.filter(l => {
      const matchesTopic = (l.topic || "").toLowerCase().includes(q);
      const matchesSub = (l.subjectName || "").toLowerCase().includes(q);
      const matchesTeacher = (l.teacherName || "").toLowerCase().includes(q);
      return matchesTopic || matchesSub || matchesTeacher;
    });
  }, [classRecordedBaseLectures, searchQuery]);

  // Filter recorded for selected month and date
  const monthLectures = useMemo(() => {
    return classRecordedLectures.filter(l => {
      if (!l.date) return false;
      const m = l.date.slice(5, 7);
      return m === selectedMonth;
    });
  }, [classRecordedLectures, selectedMonth]);

  // Filter lectures for selected date
  const dateLectures = useMemo(() => {
    const direct = monthLectures.filter(l => l.date === selectedDate);
    if (direct.length > 0) return direct;
    if (monthLectures.length > 0) return monthLectures;
    if (classRecordedLectures.length > 0) return classRecordedLectures.slice(0, 10);
    return [];
  }, [classRecordedLectures, selectedDate, monthLectures]);

  // Open add modal for live stream or recorded lecture
  const handleOpenAdd = (isLiveMode = false, periodNumber = 1, defaultSub = "") => {
    setEditingLecture(null);
    setFormIsLive(isLiveMode);
    setFormIsUniversal(false);
    setFormTargetClassId(selectedClassId || classes[0]?.id || "");
    setFormPeriod(periodNumber);
    setFormSubject(defaultSub || (subjects[0]?.name || "Mathematics"));
    setFormTeacher(isTeacher ? currentTeacherName : (teachers[0]?.name || school?.principalName || "Teacher"));
    setFormTopic("");
    setFormUrl("");
    setFormNotes("");
    setFormSendPush(true);
    setFormNotice(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (lec: DailyClassLecture) => {
    setEditingLecture(lec);
    setFormIsLive(lec.isLive === true);
    setFormIsUniversal(lec.isUniversal === true || lec.classId === "all" || lec.classId === "universal");
    setFormTargetClassId(lec.classId || selectedClassId || "");
    setFormPeriod(lec.periodNumber || 1);
    setFormSubject(lec.subjectName || "");
    setFormTeacher(lec.teacherName || "");
    setFormTopic(lec.topic || "");
    setFormUrl(lec.youtubeUrl || "");
    setFormNotes(lec.notes || "");
    setFormSendPush(false);
    setFormNotice(null);
    setShowAddModal(true);
  };

  // End live stream and move to recorded archive
  const handleEndLiveStream = async (lec: DailyClassLecture) => {
    if (confirmEndLiveId !== lec.id) {
      setConfirmEndLiveId(lec.id);
      return;
    }
    setConfirmEndLiveId(null);

    try {
      const updated: DailyClassLecture = {
        ...lec,
        isLive: false,
        endedAt: new Date().toISOString(),
      };
      await saveClassLecture(updated);
      await loadLectures();
      toast.success("✅ लाइव सेशन समाप्त हुआ! यह वीडियो अब रिकॉर्डेड लेक्चर्स में सुरक्षित हो गया है।");
    } catch (e: any) {
      toast.error("Error: " + (e?.message || "Failed to end live stream"));
    }
  };

  // Save / Publish Lecture
  const handleSaveLecture = async () => {
    if (!formUrl.trim()) {
      setFormNotice("कृपया YouTube वीडियो या लाइव स्ट्रीम का लिंक डालें!");
      return;
    }

    const videoId = extractYouTubeVideoId(formUrl);
    if (!videoId) {
      setFormNotice("अमान्य लिंक! कृपया सही YouTube लिंक डालें (उदा. youtube.com/live/..., youtu.be/... या watch?v=...)");
      return;
    }

    if (!formIsUniversal && !formSubject.trim()) {
      setFormNotice("कृपया विषय (Subject) का नाम चुनें या दर्ज करें!");
      return;
    }

    setSaving(true);
    try {
      const targetClass = classes.find(c => c.id === formTargetClassId) || selectedClass;
      const finalClassId = formIsUniversal ? "universal" : (targetClass?.id || "class_1");
      const finalClassName = formIsUniversal ? "Universal / All School" : (targetClass?.name || "Class");
      const finalSubject = formIsUniversal ? (formSubject.trim() || "General School Broadcast") : formSubject.trim();
      const finalTopic = formTopic.trim() || (formIsLive ? `Live ${finalSubject} Session` : `${finalSubject} Lecture`);

      const lecturePayload: DailyClassLecture = {
        id: editingLecture?.id || generateId("lec"),
        schoolId: school.id,
        sessionId: activeSession?.name || "2026-27",
        classId: finalClassId,
        className: finalClassName,
        date: selectedDate || todayIso,
        month: (selectedDate || todayIso).slice(0, 7),
        periodNumber: Number(formPeriod) || 1,
        periodTime: formIsLive ? "🔴 Live Stream" : `Period ${formPeriod}`,
        subjectName: finalSubject,
        topic: finalTopic,
        teacherName: formTeacher.trim() || currentTeacherName,
        teacherId: currentTeacherId || undefined,
        youtubeUrl: formUrl.trim(),
        youtubeVideoId: videoId,
        isLive: formIsLive,
        isUniversal: formIsUniversal,
        streamStartedAt: formIsLive ? (editingLecture?.streamStartedAt || new Date().toISOString()) : undefined,
        notes: formNotes.trim(),
        addedAt: editingLecture?.addedAt || new Date().toISOString(),
        addedBy: isAdmin ? "ADMIN" : "TEACHER",
      };

      await saveClassLecture(lecturePayload);

      // Dispatch Mobile Push Notification if enabled
      if (formSendPush) {
        try {
          if (formIsUniversal) {
            // Broadcast to all students & staff
            await sendSchoolPushNotification({
              schoolId: school.id,
              schoolBroadcast: true,
              senderId: isAdmin ? "STAFF_ADMIN" : "teacher",
              senderIds: ["STAFF_ADMIN", "school_admin"],
              senderName: school.name || "School Video Desk",
              title: formIsLive ? `🔴 स्कूल लाइव प्रसारण: ${finalTopic}` : `📼 नया स्कूल वीडियो: ${finalTopic}`,
              body: formIsLive
                ? `स्कूल का लाइव प्रसारण शुरू हो चुका है! सभी छात्र व शिक्षक तुरंत जुड़ें।`
                : `स्कूल का नया वीडियो उपलब्ध है: ${finalTopic}`,
              type: "SCHOOL_NOTICE",
              url: `/?schoolPortal=1&schoolTab=classroom_videos`,
              urgent: true,
            });
          } else {
            // Targeted to this class
            await sendSchoolPushNotification({
              schoolId: school.id,
              classId: targetClass?.id,
              className: finalClassName,
              classBroadcast: Boolean(targetClass?.id || finalClassName),
              senderId: isAdmin ? "STAFF_ADMIN" : "teacher",
              senderIds: ["STAFF_ADMIN", "school_admin"],
              senderName: school.name || "School Video Desk",
              title: formIsLive ? `🔴 ${finalSubject} Live Class: ${finalTopic}` : `📼 ${finalSubject} Video: ${finalTopic}`,
              body: formIsLive
                ? `${finalClassName} • ${finalSubject} की लाइव क्लास शुरू हो गई है! जुड़ने के लिए टैप करें।`
                : `${finalClassName} के लिए ${finalSubject} का नया वीडियो लेक्चर उपलब्ध है।`,
              type: "SCHOOL_NOTICE",
              url: `/?schoolPortal=1&schoolTab=classroom_videos`,
              urgent: true,
            });
          }
        } catch (pushErr) {
          console.warn("[Video Push Notification Error]", pushErr);
        }
      }

      setShowAddModal(false);
      await loadLectures();

      if (formIsLive) {
        setActiveTab("LIVE");
      } else if (formIsUniversal) {
        setActiveTab("UNIVERSAL");
      }
    } catch (e: any) {
      setFormNotice(e?.message || "Failed to save lecture video");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lecId: string) => {
    if (confirmDeleteLectureId !== lecId) {
      setConfirmDeleteLectureId(lecId);
      return;
    }
    setConfirmDeleteLectureId(null);
    try {
      await deleteClassLecture(school.id, lecId);
      await loadLectures();
      toast.success("वीडियो हटा दिया गया।");
    } catch (e) {
      console.warn("Delete error:", e);
      toast.error("वीडियो हटाने में समस्या आई।");
    }
  };

  // DIRECT CUSTOM PLAYER VIEW (NO POPUP MODAL)
  if (playingLecture) {
    const lectureUrl =
      playingLecture.directVideoUrl ||
      playingLecture.youtubeUrl ||
      (playingLecture.youtubeVideoId ? `https://youtu.be/${playingLecture.youtubeVideoId}` : "");
    const videoTitle = `${playingLecture.isLive ? "🔴 LIVE: " : playingLecture.isEventVideo ? "🎉 EVENT: " : ""}${playingLecture.topic || "Class Lecture"} • ${playingLecture.subjectName || ""}`;
    const sortedLectures = [...dateLectures].sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0));
    const currentIndex = sortedLectures.findIndex(l => l.id === playingLecture.id);
    const nextLec = currentIndex >= 0 && currentIndex < sortedLectures.length - 1 ? sortedLectures[currentIndex + 1] : null;

    return (
      <div className="fixed inset-0 bg-black flex flex-col z-[500] animate-in fade-in duration-150">
        <div className="flex-1 relative">
          <div style={{ position: "absolute", inset: 0 }}>
            <CustomPlayer
              videoUrl={lectureUrl}
              videoTitle={videoTitle}
              brandingText={school?.name || "NSTA School"}
              brandingLogo={school?.logoUrl}
              onBack={() => setPlayingLecture(null)}
              onNext={nextLec ? () => setPlayingLecture(nextLec) : undefined}
              nextTitle={nextLec ? `${nextLec.topic || nextLec.subjectName}` : undefined}
              onRotate={async () => {
                await rotateScreen();
              }}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>
    );
  }

  const isElite = isSchoolEliteCurriculum(school);
  if (!isElite) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto animate-in slide-in-from-right">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          {onBack && (
            <button type="button" onClick={onBack} className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full hover:bg-slate-200 cursor-pointer">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Crown className="text-amber-500 shrink-0" size={22} />
              <span className="truncate">Classroom YouTube Live &amp; Video Lectures</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">{school?.name || "School"} Video Archive Desk</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 dark:via-amber-950/20 to-orange-500/10 border border-amber-300 dark:border-amber-600/60 rounded-2xl p-5 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
            <Crown size={32} />
          </div>
          <div className="space-y-1">
            <span className="px-3 py-1 bg-amber-200/80 text-amber-900 rounded-full text-[11px] font-black uppercase tracking-wider">
              👑 Elite School Plan Required
            </span>
            <h4 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-2">
              YouTube Live Streaming &amp; Video Lectures
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
              अपने स्कूल के छात्रों के लिए लाइव क्लासेस, ऑटो-रिकॉर्डेड लेक्चर्स और यूनिवर्सल स्कूल वीडियो हब एक्टिवेट करने के लिए <strong>School Elite Subscription (2× Price)</strong> अनलॉक करें।
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello Super Admin, I want to upgrade school "${school?.name || 'My School'}" (ID: ${school?.id}) to the Elite Plan to unlock YouTube Live & Video Lectures.`)}`}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-sm shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
            >
              👑 Contact Super Admin for Elite Upgrade
            </a>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm cursor-pointer"
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* ── TOP BANNER & ACTION HEADER ── */}
      <div className="bg-gradient-to-r from-red-900 via-rose-900 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-xl border border-red-700/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-red-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer mr-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center shrink-0 shadow-lg">
                <Youtube className="w-4 h-4 fill-white text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                स्कूल लाइव स्टूडियो व वीडियो हब
              </h2>
              {liveLectures.length > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500 text-white font-black text-[10px] uppercase tracking-wider animate-pulse shadow-md">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span>{liveLectures.length} Live Now</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-rose-100/90 max-w-2xl leading-relaxed">
              YouTube Live का लिंक डालें, क्लास में लाइव चलेगा। लाइव खत्म होने पर YouTube अपने आप इसे क्लास आर्काइव या यूनिवर्सल वीडियो में सेव कर देगा!
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenAdd(true)}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-red-600/30 active:scale-95 transition cursor-pointer"
              >
                <Radio className="w-4 h-4 text-white animate-pulse" />
                <span>+ Go Live (लाइव शुरू करें)</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAdd(false)}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ रिकॉर्डेड वीडियो</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 3 CORE WORKFLOW TABS (LIVE NOW / RECORDED ARCHIVE / UNIVERSAL) ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("LIVE")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shrink-0 border ${
            activeTab === "LIVE"
              ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-red-50"
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${liveLectures.length > 0 ? "bg-red-400 animate-ping" : "bg-slate-400"}`} />
          <span>🔴 लाइव क्लासेज (Live Now)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/20 text-white font-bold">
            {liveLectures.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RECORDED")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shrink-0 border ${
            activeTab === "RECORDED"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
          }`}
        >
          <Video className="w-4 h-4" />
          <span>📼 रिकॉर्डेड लेक्चर्स (Class Archive)</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === "RECORDED"
              ? "bg-white/20 text-white"
              : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
          }`}>
            {classRecordedLectures.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("UNIVERSAL")}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shrink-0 border ${
            activeTab === "UNIVERSAL"
              ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-purple-50"
          }`}
        >
          <Globe className="w-4 h-4 text-purple-400" />
          <span>🌐 यूनिवर्सल स्कूल वीडियो (All School)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold">
            {universalLectures.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: LIVE NOW VIEW ── */}
      {activeTab === "LIVE" && (
        <div className="space-y-4">
          {liveLectures.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-10 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-500 flex items-center justify-center mx-auto text-2xl">
                📡
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                अभी कोई लाइव क्लास नहीं चल रही है
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                जब शिक्षक या स्कूल एडमिन YouTube Live का लिंक डालेंगे, तब लाइव वीडियो यहाँ तुरंत दिखाई देगा और छात्रों को मोबाइल पर नोटिफिकेशन मिल जाएगा।
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleOpenAdd(true)}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl shadow-lg shadow-red-600/30 cursor-pointer"
                >
                  + अभी लाइव शुरू करें (Go Live)
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveLectures.map(lec => {
                const thumb = `https://img.youtube.com/vi/${lec.youtubeVideoId}/hqdefault.jpg`;
                return (
                  <div
                    key={lec.id}
                    className="bg-slate-900 border-2 border-red-500/80 rounded-3xl overflow-hidden shadow-2xl relative text-white flex flex-col justify-between"
                  >
                    {/* Top Live Badge Bar */}
                    <div className="relative aspect-video bg-black overflow-hidden group">
                      <img
                        src={thumb}
                        alt={lec.topic}
                        className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 pointer-events-none" />

                      {/* Pulsing Live Pill */}
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-red-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-red-600/50">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span>LIVE NOW</span>
                        </span>
                        {lec.isUniversal ? (
                          <span className="px-2.5 py-1 rounded-full bg-purple-600 text-white font-bold text-[10px] uppercase">
                            🌐 Universal
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-800/90 text-amber-300 font-bold text-[10px]">
                            {lec.className}
                          </span>
                        )}
                      </div>

                      {/* Big Center Play Icon */}
                      <button
                        type="button"
                        onClick={() => setPlayingLecture(lec)}
                        className="absolute inset-0 flex items-center justify-center cursor-pointer group-hover:scale-110 transition-transform"
                      >
                        <div className="w-16 h-16 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-2xl ring-4 ring-white/30">
                          <Play className="w-7 h-7 fill-white ml-1" />
                        </div>
                      </button>
                    </div>

                    {/* Live Details Content */}
                    <div className="p-4 sm:p-5 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs text-rose-300 font-bold mb-1">
                          <span>{lec.subjectName}</span>
                          <span>{lec.periodTime || "Live Stream"}</span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-white leading-snug">
                          {lec.topic}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-purple-400" />
                          <span>शिक्षक / होस्ट: <strong className="text-slate-200">{lec.teacherName}</strong></span>
                        </p>
                      </div>

                      {lec.notes && (
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                          {lec.notes}
                        </div>
                      )}

                      {/* Bottom Action Buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setPlayingLecture(lec)}
                          className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/40 cursor-pointer transition active:scale-[0.99]"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>लाइव कक्षा देखें (Watch Live)</span>
                        </button>

                        {canEdit && (
                          confirmEndLiveId === lec.id ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEndLiveStream(lec)}
                                className="px-3 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer"
                              >
                                Confirm समाप्त
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmEndLiveId(null)}
                                className="px-2.5 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs cursor-pointer"
                              >
                                रद्द
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEndLiveStream(lec)}
                              title="लाइव समाप्त करें और रिकॉर्डेड वीडियो में सहेजें"
                              className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 font-bold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <StopCircle className="w-4 h-4 text-amber-400" />
                              <span className="hidden sm:inline">लाइव समाप्त करें</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: RECORDED CLASS LECTURES VIEW ── */}
      {activeTab === "RECORDED" && (
        <div className="space-y-4">
          {/* Class & Month Selector Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Class Selector Pills (Hidden in Student View — Locked strictly to Student's Class) */}
              {!isStudentLocked ? (
                <div className="space-y-1.5 flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <span>कक्षा चुनें (Select Class):</span>
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {deduplicatedClasses.map(cls => (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setSelectedClassId(cls.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                          selectedClassGroup?.id === cls.id
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {cls.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500 shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                      {selectedClass?.name || studentClassName || "My Class"} · Recorded Class Archive
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      केवल आपकी कक्षा के वीडियो लेक्चर्स (Class Locked)
                    </p>
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="विषय या टॉपिक खोजें..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Month-wise Tabs */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-red-500" />
                <span>महीना चुनें (Month-wise Archive):</span>
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                {MONTH_NAMES.map(m => {
                  const isSelected = selectedMonth === m.key;
                  const countInMonth = classRecordedBaseLectures.filter(l => l.date && l.date.slice(5, 7) === m.key).length;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMonth(m.key)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border cursor-pointer ${
                        isSelected
                          ? "bg-red-600 text-white border-red-600 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-red-50"
                      }`}
                    >
                      <span>{m.name.slice(0, 3)}</span>
                      <span className={`text-[9px] font-mono mt-0.5 ${isSelected ? "text-red-100" : "text-slate-400"}`}>
                        {countInMonth} vid
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recorded Lectures Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-red-500" />
                <span>{selectedClass?.name || "Class"} - रिकॉर्डेड वीडियो लेक्चर्स ({dateLectures.length})</span>
              </h3>
            </div>

            {dateLectures.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                <p>इस महीने या क्लास में अभी कोई रिकॉर्डेड लेक्चर नहीं है।</p>
                {canEdit && (
                  <button
                    onClick={() => handleOpenAdd(false)}
                    className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow"
                  >
                    + रिकॉर्डेड वीडियो जोड़ें
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dateLectures.map(lec => {
                  const thumb = `https://img.youtube.com/vi/${lec.youtubeVideoId}/hqdefault.jpg`;
                  return (
                    <div
                      key={lec.id}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div className="relative aspect-video bg-black overflow-hidden group">
                        <img
                          src={thumb}
                          alt={lec.topic}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setPlayingLecture(lec)}
                          className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-white ml-0.5" />
                          </div>
                        </button>
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-bold">
                          {lec.date}
                        </div>
                      </div>

                      <div className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                          <span className="text-red-600 dark:text-red-400">{lec.subjectName}</span>
                          <span>Period {lec.periodNumber || 1}</span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                          {lec.topic}
                        </h4>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{lec.teacherName}</span>
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setPlayingLecture(lec)}
                            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>Play Video</span>
                          </button>

                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(lec)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {confirmDeleteLectureId === lec.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(lec.id)}
                                    className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteLectureId(null)}
                                    className="px-1.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold cursor-pointer"
                                  >
                                    रद्द
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(lec.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: UNIVERSAL SCHOOL VIDEO ARCHIVE ── */}
      {activeTab === "UNIVERSAL" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-5 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-300" />
                <h3 className="text-lg font-black text-white">यूनिवर्सल स्कूल वीडियो लाइब्रेरी</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Visible to All Students &amp; Staff
                </span>
              </div>
              <p className="text-xs text-purple-100/80 mt-1 max-w-xl">
                स्कूल असेंबली, वार्षिकोत्सव (Annual Function), विशेष घोषणाएं और मार्गदर्शन वीडियो जो सभी कक्षाओं के बच्चों और शिक्षकों के लिए उपलब्ध हैं।
              </p>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  handleOpenAdd(false);
                  setFormIsUniversal(true);
                }}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer shrink-0"
              >
                + यूनिवर्सल वीडियो जोड़ें
              </button>
            )}
          </div>

          {universalLectures.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-700">
              अभी कोई यूनिवर्सल वीडियो नहीं है। ऊपर दिए गए बटन से कॉमन स्कूल वीडियो जोड़ें।
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {universalLectures.map(lec => {
                const thumb = lec.youtubeVideoId
                  ? `https://img.youtube.com/vi/${lec.youtubeVideoId}/hqdefault.jpg`
                  : "";
                return (
                  <div
                    key={lec.id}
                    className="bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="relative aspect-video bg-black overflow-hidden group">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={lec.topic}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : lec.directVideoUrl ? (
                        <video
                          src={lec.directVideoUrl}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPlayingLecture(lec)}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </button>
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-purple-700 text-white text-[10px] font-black uppercase">
                        {lec.isEventVideo ? "🎉 Event Archive" : "🌐 All School"}
                      </div>
                    </div>

                    <div className="p-3.5 space-y-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                        {lec.topic}
                      </h4>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3 text-purple-400" />
                        <span>{lec.teacherName} • {lec.date}</span>
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => setPlayingLecture(lec)}
                          className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Watch Video</span>
                        </button>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(lec)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteLectureId === lec.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDelete(lec.id)}
                                  className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteLectureId(null)}
                                  className="px-1.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold cursor-pointer"
                                >
                                  रद्द
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDelete(lec.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ADD / EDIT LECTURE & LIVE STREAM MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  formIsLive ? "bg-red-500/20 text-red-500" : "bg-purple-500/20 text-purple-500"
                }`}>
                  {formIsLive ? <Radio className="w-4 h-4 animate-pulse" /> : <Youtube className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    {editingLecture
                      ? "वीडियो सम्पादित करें (Edit Video)"
                      : formIsLive
                      ? "🔴 YouTube Live क्लास शुरू करें"
                      : "+ YouTube वीडियो लेक्चर जोड़ें"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formIsUniversal ? "🌐 Universal School Video" : `${classes.find(c => c.id === formTargetClassId)?.name || "Class"}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formNotice && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formNotice}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              {/* Stream Mode Toggle: Live vs Recorded */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFormIsLive(false)}
                  className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    !formIsLive
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>📼 रिकॉर्डेड वीडियो</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormIsLive(true)}
                  className={`py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    formIsLive
                      ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                      : "text-red-600 hover:bg-red-50"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>🔴 LIVE NOW (लाइव)</span>
                </button>
              </div>

              {/* Scope Selector: Class Specific vs Universal */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  टारगेट दर्शक / क्लास (Audience Scope):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                    !formIsUniversal
                      ? "bg-white dark:bg-slate-900 border-indigo-500 font-bold text-slate-900 dark:text-white"
                      : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-500"
                  }`}>
                    <input
                      type="radio"
                      name="scope"
                      checked={!formIsUniversal}
                      onChange={() => setFormIsUniversal(false)}
                      className="text-indigo-600"
                    />
                    <span>🏫 कक्षा अनुसार (Class)</span>
                  </label>

                  <label className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                    formIsUniversal
                      ? "bg-white dark:bg-slate-900 border-purple-500 font-bold text-slate-900 dark:text-white"
                      : "bg-transparent border-slate-200 dark:border-slate-700 text-slate-500"
                  }`}>
                    <input
                      type="radio"
                      name="scope"
                      checked={formIsUniversal}
                      onChange={() => setFormIsUniversal(true)}
                      className="text-purple-600"
                    />
                    <span>🌐 यूनिवर्सल (All School)</span>
                  </label>
                </div>
              </div>

              {/* Class & Subject (If NOT universal) */}
              {!formIsUniversal ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 mb-1 block">कक्षा (Class) *</label>
                    <select
                      value={formTargetClassId}
                      onChange={e => setFormTargetClassId(e.target.value)}
                      className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-transparent font-bold text-slate-800 dark:text-white"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-300 mb-1 block">विषय (Subject) *</label>
                    <input
                      value={formSubject}
                      onChange={e => setFormSubject(e.target.value)}
                      placeholder="उदा. Science, Maths"
                      className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-transparent font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 mb-1 block">कैटेगरी / विषय (Category / Event)</label>
                  <input
                    value={formSubject}
                    onChange={e => setFormSubject(e.target.value)}
                    placeholder="उदा. Morning Assembly, Exam Tips, Annual Function"
                    className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-transparent font-bold text-slate-800 dark:text-white"
                  />
                </div>
              )}

              {/* YouTube Video URL */}
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 mb-1 block flex items-center justify-between">
                  <span>YouTube लिंक (Live / Video URL) *</span>
                  <span className="text-[10px] text-red-500 font-mono">youtube.com/live/... ya youtu.be/...</span>
                </label>
                <input
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  placeholder="https://youtube.com/live/xxxxxx ya https://youtu.be/xxxxxx"
                  className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-transparent text-slate-800 dark:text-white font-mono"
                />
              </div>

              {/* Topic / Chapter */}
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 mb-1 block">टॉपिक / चैप्टर का नाम (Topic Title) *</label>
                <input
                  value={formTopic}
                  onChange={e => setFormTopic(e.target.value)}
                  placeholder="उदा. प्रकाश का परावर्तन - भाग 1"
                  className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-transparent text-slate-800 dark:text-white font-bold"
                />
              </div>

              {/* Teacher / Host Name */}
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 mb-1 block">शिक्षक / होस्ट का नाम (Teacher / Host)</label>
                <input
                  value={formTeacher}
                  onChange={e => setFormTeacher(e.target.value)}
                  placeholder="Subject Teacher Name"
                  className="w-full px-3 py-2 border dark:border-slate-700 rounded-xl bg-transparent text-slate-800 dark:text-white"
                />
              </div>

              {/* Mobile Push Notification Checkbox */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="send_push_toggle"
                  checked={formSendPush}
                  onChange={e => setFormSendPush(e.target.checked)}
                  className="mt-0.5 rounded border-amber-500 text-amber-600"
                />
                <label htmlFor="send_push_toggle" className="text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
                  <span className="font-black flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    छात्रों व अभिभावकों को मोबाइल पर पुश नोटिफिकेशन भेजें
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    {formIsUniversal
                      ? "स्कूल के सभी छात्रों व शिक्षकों के मोबाइल पर अलर्ट जाएगा।"
                      : "सिर्फ चुनी गई कक्षा के छात्रों व अभिभावकों को अलर्ट जाएगा।"}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleSaveLecture}
                disabled={saving}
                className={`flex-1 py-2.5 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60 ${
                  formIsLive ? "bg-red-600 hover:bg-red-500 shadow-red-600/30" : "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30"
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "सहेज रहे हैं..." : formIsLive ? "🔴 लाइव शुरू करें" : "वीडियो सहेजें"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
