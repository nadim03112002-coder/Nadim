import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  Plus,
  X,
  Eye,
  Clock,
  Film,
  Image as ImageIcon,
  Type,
  Youtube,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  Upload,
  Loader2,
  Bell,
  BookmarkPlus,
  Search,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import type {
  School,
  SchoolStudent,
  NstaSchoolStatus,
  NstaStatusViewer,
} from "../../school-types";
import {
  saveNstaStatus,
  deleteNstaStatus,
  markNstaStatusViewed,
  buildEventLectureFromStatus,
  saveClassLecture,
  extractYouTubeVideoId,
  generateId,
  NSTA_STATUS_TTL_MS,
} from "../../school-firebase";
import { uploadToCloudinary } from "../../services/cloudinaryService";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";

interface NstaStatusStudioProps {
  school: School;
  statuses: NstaSchoolStatus[];
  currentUserRole: "ADMIN" | "TEACHER" | "STUDENT";
  currentUserId: string;
  currentUserName: string;
  currentUserPhoto?: string;
  student?: SchoolStudent;
  students?: SchoolStudent[];
  mode?: "strip" | "page" | "headless";
  requestedOpenStatusId?: string | null;
  onClearRequestedOpenStatus?: () => void;
}

const TEXT_STATUS_BACKGROUNDS = [
  { id: "emerald", label: "Emerald", css: "linear-gradient(135deg, #065f46 0%, #047857 50%, #0f766e 100%)" },
  { id: "royal", label: "Royal Blue", css: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #4338ca 100%)" },
  { id: "sunset", label: "Warm Amber", css: "linear-gradient(135deg, #9a3412 0%, #c2410c 50%, #b45309 100%)" },
  { id: "plum", label: "Crimson Plum", css: "linear-gradient(135deg, #831843 0%, #9d174d 50%, #6d28d9 100%)" },
  { id: "slate", label: "Charcoal", css: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%)" },
];

const formatRemainingTime = (expiresAt?: string): string => {
  if (!expiresAt) return "24h";
  const diff = Date.parse(expiresAt) - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return "Expiring";
  const hrs = Math.floor(diff / (60 * 60 * 1000));
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${Math.max(1, mins)}m left`;
};

const formatViewedTimestamp = (iso?: string): string => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `Today, ${timeStr}`;
    return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${timeStr}`;
  } catch {
    return "";
  }
};

export const NstaStatusStudio: React.FC<NstaStatusStudioProps> = ({
  school,
  statuses,
  currentUserRole,
  currentUserId,
  currentUserName,
  currentUserPhoto,
  student,
  students = [],
  mode = "strip",
  requestedOpenStatusId = null,
  onClearRequestedOpenStatus,
}) => {
  const canPostStatus = currentUserRole === "ADMIN" || currentUserRole === "TEACHER";
  const safeSchoolId = school?.id || "default";

  // Create Status Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"IMAGE" | "TEXT" | "EVENT_VIDEO">("IMAGE");
  const [eventVideoSource, setEventVideoSource] = useState<"YOUTUBE" | "UPLOAD">("YOUTUBE");
  const [statusTitle, setStatusTitle] = useState("");
  const [statusCaption, setStatusCaption] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [selectedBg, setSelectedBg] = useState(TEXT_STATUS_BACKGROUNDS[0].css);
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState<string>("");
  const [sendPushAlert, setSendPushAlert] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const imageFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  // Fullscreen Viewer State
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [showAnalyticsSheet, setShowAnalyticsSheet] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<"SEEN" | "UNSEEN">("SEEN");
  const [analyticsSearch, setAnalyticsSearch] = useState("");

  useEffect(() => {
    if (!requestedOpenStatusId) return;
    const idx = statuses.findIndex((s) => s.id === requestedOpenStatusId);
    if (idx >= 0) {
      setShowAnalyticsSheet(false);
      setViewerIndex(idx);
    }
    onClearRequestedOpenStatus?.();
  }, [requestedOpenStatusId, statuses, onClearRequestedOpenStatus]);

  const safeViewerKey = useMemo(
    () => String(currentUserId || "anon").replace(/[.#$/[\]\s]/g, "_"),
    [currentUserId]
  );

  const isStatusSeenByMe = (st: NstaSchoolStatus): boolean => {
    if (!st.viewers) return false;
    return Boolean(st.viewers[safeViewerKey] || Object.values(st.viewers).some((v) => v.viewerId === currentUserId));
  };

  const activeStatus = viewerIndex !== null && statuses[viewerIndex] ? statuses[viewerIndex] : null;

  // Record view automatically when user views a status
  useEffect(() => {
    if (!activeStatus || !currentUserId) return;
    const viewerRecord: NstaStatusViewer = {
      viewerId: currentUserId,
      viewerName: currentUserName || (currentUserRole === "ADMIN" ? "Principal Office" : "User"),
      viewerRole: currentUserRole,
      classId: student?.classId,
      className: student?.className,
      rollNo: student?.rollNo,
      photoUrl: currentUserPhoto || student?.photoUrl,
      viewedAt: new Date().toISOString(),
    };
    void markNstaStatusViewed(safeSchoolId, activeStatus.id, viewerRecord);
  }, [activeStatus?.id, safeSchoolId, currentUserId, currentUserName, currentUserRole, student?.classId, student?.className, student?.rollNo, student?.photoUrl, currentUserPhoto]);

  // Auto-advance timer for Image / Text statuses (pauses on video, hold, or analytics sheet)
  useEffect(() => {
    if (viewerIndex === null || !activeStatus) return;
    setProgressPct(0);
    if (
      isPaused ||
      showAnalyticsSheet ||
      activeStatus.mediaType === "VIDEO" ||
      activeStatus.mediaType === "YOUTUBE_EVENT"
    ) {
      return;
    }

    const DURATION_MS = 6500;
    const TICK_MS = 50;
    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += TICK_MS;
      const pct = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgressPct(pct);
      if (elapsed >= DURATION_MS) {
        window.clearInterval(timer);
        if (viewerIndex < statuses.length - 1) {
          setViewerIndex(viewerIndex + 1);
        } else {
          setViewerIndex(null);
        }
      }
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [viewerIndex, activeStatus?.id, activeStatus?.mediaType, isPaused, showAnalyticsSheet, statuses.length]);

  const resetCreateForm = () => {
    setStatusTitle("");
    setStatusCaption("");
    setYoutubeLink("");
    setSelectedMediaFile(null);
    if (selectedMediaPreview) {
      try { URL.revokeObjectURL(selectedMediaPreview); } catch {}
    }
    setSelectedMediaPreview("");
    setUploadProgress(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, expected: "IMAGE" | "VIDEO") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (expected === "IMAGE" && !file.type.startsWith("image/")) {
      toast.error("Kripya ek valid photo file chunein.");
      return;
    }
    if (expected === "VIDEO" && !file.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      toast.error("Kripya MP4 ya WebM video file chunein.");
      return;
    }
    if (expected === "VIDEO" && file.size > 19.5 * 1024 * 1024) {
      toast.error("Video size 19.5MB se kam hona chahiye (Telegram 20MB streaming limit).");
      return;
    }
    if (expected === "IMAGE" && file.size > 15 * 1024 * 1024) {
      toast.error("Photo size 15MB se kam hona chahiye.");
      return;
    }
    if (selectedMediaPreview) {
      try { URL.revokeObjectURL(selectedMediaPreview); } catch {}
    }
    setSelectedMediaFile(file);
    setSelectedMediaPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handlePublishStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPostStatus || isPublishing) return;

    if (createMode === "TEXT" && !statusCaption.trim()) {
      toast.error("Status ke liye sandesh likhein.");
      return;
    }
    if (createMode === "IMAGE" && !selectedMediaFile) {
      toast.error("Photo Status ke liye ek image chunein.");
      return;
    }
    if (createMode === "EVENT_VIDEO") {
      if (eventVideoSource === "YOUTUBE" && !extractYouTubeVideoId(youtubeLink.trim())) {
        toast.error("Sahi YouTube video link daalein (jaise youtu.be/... ya youtube.com/watch?v=...).");
        return;
      }
      if (eventVideoSource === "UPLOAD" && !selectedMediaFile) {
        toast.error("Event video upload karne ke liye video file chunein.");
        return;
      }
    }

    setIsPublishing(true);
    setUploadProgress(15);

    try {
      const nowIso = new Date().toISOString();
      const expiresIso = new Date(Date.now() + NSTA_STATUS_TTL_MS).toISOString();
      const statusId = generateId("st24");

      let mediaUrl = "";
      let ytId = "";
      let mediaType: NstaSchoolStatus["mediaType"] = "TEXT";
      let isEventVideo = false;

      if (createMode === "IMAGE" && selectedMediaFile) {
        mediaType = "IMAGE";
        try {
          const res = await uploadToCloudinary(selectedMediaFile, "image", (pct) => setUploadProgress(pct));
          mediaUrl = res?.secure_url || res?.url || "";
        } catch {
          mediaUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedMediaFile);
          });
        }
      } else if (createMode === "EVENT_VIDEO") {
        isEventVideo = true;
        if (eventVideoSource === "YOUTUBE") {
          mediaType = "YOUTUBE_EVENT";
          mediaUrl = youtubeLink.trim();
          ytId = extractYouTubeVideoId(mediaUrl);
        } else if (selectedMediaFile) {
          mediaType = "VIDEO";
          const res = await uploadToCloudinary(selectedMediaFile, "video", (pct) => setUploadProgress(pct));
          mediaUrl = res?.secure_url || res?.url || "";
          if (!mediaUrl || mediaUrl.startsWith("blob:")) {
            throw new Error("Video upload server se URL prapt nahi hui.");
          }
        }
      }

      if ((mediaType === "IMAGE" || mediaType === "VIDEO") && (!mediaUrl || mediaUrl.startsWith("blob:"))) {
        throw new Error("Media upload fail ho gaya. Kripya dubara try karein.");
      }

      const payload: NstaSchoolStatus = {
        id: statusId,
        schoolId: safeSchoolId,
        mediaType,
        mediaUrl: mediaUrl || undefined,
        youtubeVideoId: ytId || undefined,
        title: statusTitle.trim() || (isEventVideo ? "School Event Highlight" : undefined),
        caption: statusCaption.trim() || undefined,
        bgColor: createMode === "TEXT" ? selectedBg : undefined,
        isEventVideo,
        authorId: currentUserId || "STAFF_ADMIN",
        authorName: currentUserName || (currentUserRole === "ADMIN" ? "School Principal" : "Teacher"),
        authorRole: currentUserRole === "TEACHER" ? "TEACHER" : "ADMIN",
        authorPhoto: currentUserPhoto || school?.logoUrl || undefined,
        createdAt: nowIso,
        expiresAt: expiresIso,
        viewers: {},
      };

      await saveNstaStatus(payload);

      if (sendPushAlert) {
        void sendSchoolPushNotification({
          schoolId: safeSchoolId,
          schoolBroadcast: true,
          senderId: currentUserId || "STAFF_ADMIN",
          senderIds: [currentUserId, "STAFF_ADMIN", "school_admin"].filter(Boolean),
          senderName: payload.authorName,
          title: isEventVideo
            ? `🎬 ${school?.name || "School"} • New Event Video (24h)`
            : `📢 ${school?.name || "School"} • New School Status`,
          body: isEventVideo
            ? `${payload.title || "नया इवेंट वीडियो"} अब 24 घंटे के लिए NSTA Messenger होम पेज पर लाइव है!`
            : (payload.caption || "नया स्कूल अपडेट स्टेटस देखने के लिए टैप करें।").slice(0, 120),
          icon: currentUserPhoto || school?.logoUrl || undefined,
          senderPhoto: currentUserPhoto || school?.logoUrl || undefined,
          type: "SCHOOL_NOTICE",
          url: "/?schoolPortal=1&schoolTab=messenger",
          urgent: true,
        }).catch(() => {});
      }

      toast.success(
        isEventVideo
          ? "🎬 Event Video 24 घंटे के लिए Status पर लाइव हो गया (24h बाद Video Library में सेव हो जाएगा)!"
          : "✅ नया 24-Hour School Status पब्लिश हो गया!"
      );
      resetCreateForm();
      setShowCreateModal(false);
    } catch (err: any) {
      toast.error(err?.message || "Status upload karne me samasya aayi.");
    } finally {
      setIsPublishing(false);
      setUploadProgress(0);
    }
  };

  const handleSaveEventToLibraryNow = async (st: NstaSchoolStatus) => {
    try {
      const lecture = buildEventLectureFromStatus(st);
      await saveClassLecture(lecture);
      await saveNstaStatus({
        ...st,
        archivedToLibrary: true,
        archivedLectureId: lecture.id,
        archivedAt: new Date().toISOString(),
      });
      toast.success("📚 Event Video abhi Video Library me save kar diya gaya!");
    } catch {
      toast.error("Video Library me save karne me samasya aayi.");
    }
  };

  const handleDeleteCurrentStatus = async (st: NstaSchoolStatus) => {
    try {
      await deleteNstaStatus(safeSchoolId, st.id);
      toast.success("Status hata diya gaya.");
      setShowAnalyticsSheet(false);
      if (statuses.length <= 1) {
        setViewerIndex(null);
      } else if (viewerIndex !== null && viewerIndex >= statuses.length - 1) {
        setViewerIndex(Math.max(0, statuses.length - 2));
      }
    } catch {
      toast.error("Status delete nahi ho saka.");
    }
  };

  // Compute Seen vs Unseen Students for active status analytics
  const viewerAnalytics = useMemo(() => {
    if (!activeStatus) return { seenList: [] as NstaStatusViewer[], unseenStudents: [] as SchoolStudent[] };
    const viewersObj = activeStatus.viewers || {};
    const seenList = Object.values(viewersObj).sort((a, b) =>
      (b.viewedAt || "").localeCompare(a.viewedAt || "")
    );
    const seenIds = new Set(seenList.map((v) => String(v.viewerId)));
    const unseenStudents = (students || []).filter((st) => st && st.id && !seenIds.has(String(st.id)));
    return { seenList, unseenStudents };
  }, [activeStatus, students]);

  const filteredSeenList = useMemo(() => {
    const q = analyticsSearch.trim().toLowerCase();
    if (!q) return viewerAnalytics.seenList;
    return viewerAnalytics.seenList.filter(
      (v) =>
        (v.viewerName || "").toLowerCase().includes(q) ||
        (v.className || "").toLowerCase().includes(q) ||
        (v.rollNo || "").toLowerCase().includes(q)
    );
  }, [viewerAnalytics.seenList, analyticsSearch]);

  const filteredUnseenList = useMemo(() => {
    const q = analyticsSearch.trim().toLowerCase();
    if (!q) return viewerAnalytics.unseenStudents;
    return viewerAnalytics.unseenStudents.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.className || "").toLowerCase().includes(q) ||
        (s.rollNo || "").toLowerCase().includes(q)
    );
  }, [viewerAnalytics.unseenStudents, analyticsSearch]);

  // If strip mode has nothing to show for students, keep UI ultra clean
  if (
    mode === "strip" &&
    statuses.length === 0 &&
    !canPostStatus &&
    !showCreateModal &&
    viewerIndex === null
  ) {
    return null;
  }

  return (
    <>
      {mode === "page" ? (
        /* ── DEDICATED WHATSAPP-STYLE STATUS & EVENT VIDEOS PAGE ── */
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4">
          {/* My Status / Quick Publish Card (Admin & Teacher) */}
          {canPostStatus && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("IMAGE");
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                >
                  <div className="relative w-12 h-12 rounded-full p-[2px] border-2 border-dashed border-emerald-500/80 flex items-center justify-center bg-slate-950 shrink-0">
                    {currentUserPhoto ? (
                      <img
                        src={currentUserPhoto}
                        alt={currentUserName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover opacity-85"
                      />
                    ) : (
                      <Plus className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center border-2 border-slate-900 shadow">
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      Add School Status
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      24 ghante baad auto-delete · Seen report ke saath
                    </p>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("IMAGE");
                    setShowCreateModal(true);
                  }}
                  className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("TEXT");
                    setShowCreateModal(true);
                  }}
                  className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-sky-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Type className="w-3.5 h-3.5 shrink-0" />
                  <span>Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("EVENT_VIDEO");
                    setShowCreateModal(true);
                  }}
                  className="min-h-[40px] px-2.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  <span>Event Video</span>
                </button>
              </div>
            </div>
          )}

          {/* Active 24h Updates List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-300">
                Recent Updates · 24h Live ({statuses.length})
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">
                Auto-Archive Event Videos
              </span>
            </div>

            {statuses.length === 0 ? (
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 py-10 px-4 text-center space-y-2">
                <Clock className="w-8 h-8 text-emerald-400/70 mx-auto" />
                <p className="text-sm font-bold text-white">
                  Abhi koi 24h active status nahi hai
                </p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  {canPostStatus
                    ? "Upar diye buttons se Photo, Text Notice ya Event Video lagayein. Event Video 24 ghante baad apne-aap Video Library me chala jayega."
                    : "Jab school ya teachers koi 24-hour status ya Event Video daalenge, to wo yahan dikhega."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                {statuses.map((st, idx) => {
                  const seen = isStatusSeenByMe(st);
                  const isEvent = Boolean(
                    st.isEventVideo || st.mediaType === "YOUTUBE_EVENT" || st.mediaType === "VIDEO"
                  );
                  const ytThumb = st.youtubeVideoId
                    ? `https://img.youtube.com/vi/${st.youtubeVideoId}/mqdefault.jpg`
                    : "";
                  const viewCount = st.viewers ? Object.keys(st.viewers).length : 0;

                  return (
                    <div
                      key={st.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-900/90 transition"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowAnalyticsSheet(false);
                          setViewerIndex(idx);
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div
                          className={`relative w-13 h-13 rounded-full p-[2.5px] shrink-0 ${
                            seen
                              ? "bg-slate-600"
                              : isEvent
                              ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-400"
                              : "bg-gradient-to-tr from-emerald-500 to-teal-400"
                          }`}
                        >
                          <div className="w-full h-full rounded-full bg-slate-950 border-2 border-slate-950 overflow-hidden flex items-center justify-center">
                            {st.mediaType === "IMAGE" && st.mediaUrl ? (
                              <img
                                src={st.mediaUrl}
                                alt={st.caption || "Status"}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : ytThumb ? (
                              <img
                                src={ytThumb}
                                alt={st.title || "Event Video"}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : st.mediaType === "VIDEO" && st.mediaUrl ? (
                              <video
                                src={st.mediaUrl}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center p-1 text-[9px] font-bold text-white text-center leading-tight line-clamp-2"
                                style={{ background: st.bgColor || TEXT_STATUS_BACKGROUNDS[0].css }}
                              >
                                {(st.caption || "Notice").slice(0, 18)}
                              </div>
                            )}
                          </div>
                          {isEvent && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center border-2 border-slate-900 shadow">
                              <Film className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-white truncate">
                              {st.title || st.caption || st.authorName}
                            </p>
                            {isEvent && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold shrink-0">
                                Event Video
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate">
                            {st.authorName} · {formatViewedTimestamp(st.createdAt)}
                          </p>
                          <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{formatRemainingTime(st.expiresAt)}</span>
                            {isEvent && (
                              <span className="text-slate-400 font-normal">
                                · 24h baad Library me save hoga
                              </span>
                            )}
                          </p>
                        </div>
                      </button>

                      {canPostStatus && (
                        <button
                          type="button"
                          onClick={() => {
                            setAnalyticsSearch("");
                            setViewerIndex(idx);
                            setShowAnalyticsSheet(true);
                          }}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                          title="Kisne aur kab dekha dekhein"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="font-mono tabular-nums">{viewCount}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : mode === "strip" ? (
        /* ── COMPACT SINGLE-ROW HORIZONTAL STATUS & EVENT VIDEO LINE ── */
        <div className="px-3 py-2 border-b border-slate-800/90 bg-slate-900/55 shrink-0">
          <div className="flex items-start gap-2.5 overflow-x-auto pb-0.5 no-scrollbar">
            {/* Add Status Tile (Admin / Teacher) */}
            {canPostStatus && (
              <button
                type="button"
                onClick={() => {
                  setCreateMode("IMAGE");
                  setShowCreateModal(true);
                }}
                className="flex flex-col items-center gap-1 w-14 shrink-0 group cursor-pointer"
                title="Add Photo or Text Status (24h)"
              >
                <div className="relative w-12 h-12 rounded-full p-[2px] border-2 border-dashed border-emerald-500/75 group-hover:border-emerald-400 transition flex items-center justify-center bg-slate-950">
                  {currentUserPhoto ? (
                    <img
                      src={currentUserPhoto}
                      alt={currentUserName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover opacity-80"
                    />
                  ) : (
                    <Plus className="w-5 h-5 text-emerald-400" />
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center border-2 border-slate-900 shadow">
                    <Plus className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-300 truncate w-full text-center">
                  Add Status
                </span>
              </button>
            )}

            {/* + Event Video Quick Circle (Admin / Teacher) */}
            {canPostStatus && (
              <button
                type="button"
                onClick={() => {
                  setCreateMode("EVENT_VIDEO");
                  setShowCreateModal(true);
                }}
                className="flex flex-col items-center gap-1 w-14 shrink-0 group cursor-pointer"
                title="Upload Event Video (24h Status -> Video Library)"
              >
                <div className="relative w-12 h-12 rounded-full p-[2px] border-2 border-dashed border-rose-500/75 group-hover:border-rose-400 transition flex items-center justify-center bg-slate-950">
                  <Film className="w-5 h-5 text-rose-400" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-slate-900 shadow">
                    <Plus className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-rose-300 truncate w-full text-center">
                  Event Vid
                </span>
              </button>
            )}

            {/* Active 24h Status Circles (All added in ONE horizontal row) */}
            {statuses.map((st, idx) => {
              const seen = isStatusSeenByMe(st);
              const isEvent = Boolean(st.isEventVideo || st.mediaType === "YOUTUBE_EVENT" || st.mediaType === "VIDEO");
              const ytThumb = st.youtubeVideoId
                ? `https://img.youtube.com/vi/${st.youtubeVideoId}/mqdefault.jpg`
                : "";
              const viewCount = st.viewers ? Object.keys(st.viewers).length : 0;

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setViewerIndex(idx)}
                  className="flex flex-col items-center gap-1 w-14 shrink-0 group cursor-pointer"
                  title={st.title || st.caption || st.authorName}
                >
                  <div
                    className={`relative w-12 h-12 rounded-full p-[2px] transition-transform group-active:scale-95 ${
                      seen
                        ? "bg-slate-600"
                        : isEvent
                        ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-400"
                        : "bg-gradient-to-tr from-emerald-500 to-teal-400"
                    }`}
                  >
                    <div className="w-full h-full rounded-full bg-slate-950 border-2 border-slate-950 overflow-hidden flex items-center justify-center">
                      {st.mediaType === "IMAGE" && st.mediaUrl ? (
                        <img
                          src={st.mediaUrl}
                          alt={st.caption || "Status"}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : ytThumb ? (
                        <img
                          src={ytThumb}
                          alt={st.title || "Event Video"}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : st.mediaType === "VIDEO" && st.mediaUrl ? (
                        <video
                          src={st.mediaUrl}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center p-1 text-[8px] font-bold text-white text-center leading-tight line-clamp-2"
                          style={{ background: st.bgColor || TEXT_STATUS_BACKGROUNDS[0].css }}
                        >
                          {(st.caption || "Notice").slice(0, 20)}
                        </div>
                      )}
                    </div>

                    {isEvent ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-rose-600 text-white flex items-center justify-center border-2 border-slate-900 shadow">
                        <Film className="w-2.5 h-2.5" />
                      </span>
                    ) : canPostStatus ? (
                      <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-slate-800 text-emerald-300 text-[9px] font-mono font-bold flex items-center justify-center border border-slate-700">
                        {viewCount}
                      </span>
                    ) : null}
                  </div>

                  <span
                    className={`text-[10px] truncate w-full text-center ${
                      seen ? "text-slate-400 font-normal" : "text-white font-semibold"
                    }`}
                  >
                    {isEvent ? (st.title || "Event") : st.authorName.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── MODAL: CREATE 24-HOUR STATUS OR EVENT VIDEO (ADMIN / TEACHER) ── */}
      {showCreateModal && canPostStatus && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">
                  New 24-Hour School Status
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  24 घंटे बाद स्वतः हटेगा · Event Video अपने-आप Library में जाएगा
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateModal(false);
                }}
                disabled={isPublishing}
                className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishStatus} className="p-5 space-y-4 overflow-y-auto">
              {/* Segmented Mode Switcher */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setCreateMode("IMAGE");
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    createMode === "IMAGE"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setCreateMode("TEXT");
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    createMode === "TEXT"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setCreateMode("EVENT_VIDEO");
                  }}
                  className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    createMode === "EVENT_VIDEO"
                      ? "bg-rose-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Event Video</span>
                </button>
              </div>

              {/* Hidden file pickers */}
              <input
                ref={imageFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "IMAGE")}
              />
              <input
                ref={videoFileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, "VIDEO")}
              />

              {/* Mode 1: Photo Status */}
              {createMode === "IMAGE" && (
                <div className="space-y-3">
                  {selectedMediaPreview ? (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black max-h-60 flex items-center justify-center">
                      <img
                        src={selectedMediaPreview}
                        alt="Status Preview"
                        className="max-h-60 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMediaFile(null);
                          setSelectedMediaPreview("");
                        }}
                        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 text-white text-xs font-bold cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => imageFileRef.current?.click()}
                      className="w-full py-10 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 flex flex-col items-center justify-center gap-2 text-slate-300 transition cursor-pointer"
                    >
                      <Upload className="w-7 h-7 text-emerald-400" />
                      <span className="text-xs font-bold">Gallery se Photo Chunein</span>
                      <span className="text-[11px] text-slate-500">Notice poster, circular ya school photo</span>
                    </button>
                  )}
                  <input
                    type="text"
                    value={statusCaption}
                    onChange={(e) => setStatusCaption(e.target.value)}
                    placeholder="Photo ke saath caption likhein (optional)..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Mode 2: Text Notice Status */}
              {createMode === "TEXT" && (
                <div className="space-y-3">
                  <div
                    className="rounded-2xl p-6 min-h-[170px] flex items-center justify-center text-center shadow-inner border border-white/10"
                    style={{ background: selectedBg }}
                  >
                    <textarea
                      value={statusCaption}
                      onChange={(e) => setStatusCaption(e.target.value)}
                      rows={4}
                      placeholder="Yahan apna School Notice ya Today Thought likhein..."
                      className="w-full bg-transparent text-white placeholder-white/60 text-center font-bold text-base focus:outline-none resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Theme:</span>
                    {TEXT_STATUS_BACKGROUNDS.map((bg) => (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => setSelectedBg(bg.css)}
                        aria-label={bg.label}
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer transition ${
                          selectedBg === bg.css ? "border-white scale-110" : "border-transparent opacity-80"
                        }`}
                        style={{ background: bg.css }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Mode 3: 24h Event Video -> Auto-Archive to YouTube Video Library */}
              {createMode === "EVENT_VIDEO" && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    <span className="font-bold text-amber-300">Auto-Library Rule:</span> Yeh Event Video
                    24 घंटे तक Home Page Status में सभी छात्रों व पेरेंट्स को दिखेगा, और 24 घंटे पूरे
                    होते ही स्वतः <strong className="text-white">Video Library (YouTube Archive)</strong> में हमेशा के लिए सेव हो जाएगा।
                  </div>

                  {/* YouTube vs Direct Upload switch */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEventVideoSource("YOUTUBE")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        eventVideoSource === "YOUTUBE"
                          ? "bg-red-600/20 border-red-500 text-red-200"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      <Youtube className="w-4 h-4 text-red-400" />
                      <span>YouTube Video Link</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventVideoSource("UPLOAD")}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        eventVideoSource === "UPLOAD"
                          ? "bg-sky-600/20 border-sky-500 text-sky-200"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      <Upload className="w-4 h-4 text-sky-400" />
                      <span>Upload MP4 Video</span>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={statusTitle}
                    onChange={(e) => setStatusTitle(e.target.value)}
                    placeholder="Event ka naam (e.g., Annual Sports Day 2026) *"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />

                  {eventVideoSource === "YOUTUBE" ? (
                    <input
                      type="url"
                      value={youtubeLink}
                      onChange={(e) => setYoutubeLink(e.target.value)}
                      placeholder="https://youtu.be/... ya https://youtube.com/watch?v=..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                  ) : selectedMediaPreview ? (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black">
                      <video
                        src={selectedMediaPreview}
                        controls
                        playsInline
                        className="w-full max-h-48 bg-black"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMediaFile(null);
                          setSelectedMediaPreview("");
                        }}
                        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 text-white text-xs font-bold cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => videoFileRef.current?.click()}
                      className="w-full py-7 rounded-2xl border-2 border-dashed border-slate-700 hover:border-sky-500 bg-slate-950/60 flex flex-col items-center justify-center gap-1.5 text-slate-300 cursor-pointer"
                    >
                      <Film className="w-6 h-6 text-sky-400" />
                      <span className="text-xs font-bold">Phone/PC se Event Video Chunein (MP4/WebM)</span>
                    </button>
                  )}

                  <input
                    type="text"
                    value={statusCaption}
                    onChange={(e) => setStatusCaption(e.target.value)}
                    placeholder="Event details / vivran (optional)..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Push Alert Option */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendPushAlert}
                  onChange={(e) => setSendPushAlert(e.target.checked)}
                  className="rounded border-slate-600 text-emerald-500"
                />
                <div className="text-xs text-slate-200 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Sabhi Students &amp; Parents ko Mobile Push Notification bhejein</span>
                </div>
              </label>

              {isPublishing && uploadProgress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-emerald-400 font-bold">
                    <span>Uploading status...</span>
                    <span className="font-mono tabular-nums">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    resetCreateForm();
                    setShowCreateModal(false);
                  }}
                  disabled={isPublishing}
                  className="flex-1 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPublishing}
                  className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Publish for 24 Hours</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: FULLSCREEN WHATSAPP-STYLE STATUS VIEWER + VIEW ANALYTICS ── */}
      {viewerIndex !== null && activeStatus && (
        <div className="fixed inset-0 z-[80] bg-black flex flex-col justify-between select-none animate-in fade-in duration-150">
          {/* Top Progress Bars & Author Header */}
          <div className="relative z-20 p-3 sm:p-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent space-y-2.5">
            {/* Segmented Story Progress */}
            <div className="flex items-center gap-1">
              {statuses.map((st, idx) => (
                <div key={st.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-75"
                    style={{
                      width:
                        idx < viewerIndex
                          ? "100%"
                          : idx === viewerIndex
                          ? activeStatus.mediaType === "VIDEO" || activeStatus.mediaType === "YOUTUBE_EVENT"
                            ? "100%"
                            : `${progressPct}%`
                          : "0%",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Author Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/20 overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {activeStatus.authorPhoto ? (
                    <img
                      src={activeStatus.authorPhoto}
                      alt={activeStatus.authorName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    activeStatus.authorName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-white text-sm font-bold truncate">
                    <span className="truncate">{activeStatus.title || activeStatus.authorName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                    <span>{activeStatus.authorName}</span>
                    <span>·</span>
                    <span>{formatViewedTimestamp(activeStatus.createdAt)}</span>
                    <span>·</span>
                    <span className="text-emerald-300 font-medium flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatRemainingTime(activeStatus.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeStatus.mediaType !== "VIDEO" && activeStatus.mediaType !== "YOUTUBE_EVENT" && (
                  <button
                    type="button"
                    onClick={() => setIsPaused((p) => !p)}
                    className="min-h-[40px] min-w-[40px] rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                    title={isPaused ? "Resume" : "Pause"}
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                )}

                {canPostStatus && activeStatus.isEventVideo && !activeStatus.archivedToLibrary && (
                  <button
                    type="button"
                    onClick={() => handleSaveEventToLibraryNow(activeStatus)}
                    className="min-h-[40px] px-3 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Abhi YouTube/Video Library me bhi save karein"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save to Library</span>
                  </button>
                )}

                {(currentUserRole === "ADMIN" || activeStatus.authorId === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCurrentStatus(activeStatus)}
                    className="min-h-[40px] min-w-[40px] rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer"
                    title="Delete Status"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowAnalyticsSheet(false);
                    setViewerIndex(null);
                  }}
                  className="min-h-[40px] min-w-[40px] rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Center Media Canvas */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden px-3">
            {/* Previous / Next Navigation Buttons */}
            {viewerIndex > 0 && (
              <button
                type="button"
                onClick={() => setViewerIndex(viewerIndex - 1)}
                className="absolute left-2 sm:left-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer border border-white/15"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {viewerIndex < statuses.length - 1 && (
              <button
                type="button"
                onClick={() => setViewerIndex(viewerIndex + 1)}
                className="absolute right-2 sm:right-4 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer border border-white/15"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {activeStatus.mediaType === "IMAGE" && activeStatus.mediaUrl ? (
              <img
                src={activeStatus.mediaUrl}
                alt={activeStatus.caption || "School Status"}
                referrerPolicy="no-referrer"
                className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
            ) : activeStatus.mediaType === "YOUTUBE_EVENT" && activeStatus.youtubeVideoId ? (
              <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeStatus.youtubeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                  title={activeStatus.title || "Event Video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : activeStatus.mediaType === "VIDEO" && activeStatus.mediaUrl ? (
              <video
                src={activeStatus.mediaUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[72vh] max-w-full rounded-2xl bg-black shadow-2xl"
              />
            ) : (
              <div
                className="max-w-lg w-full min-h-[280px] rounded-3xl p-8 flex items-center justify-center text-center shadow-2xl border border-white/15"
                style={{ background: activeStatus.bgColor || TEXT_STATUS_BACKGROUNDS[0].css }}
              >
                <p className="text-white font-bold text-lg sm:text-2xl leading-relaxed whitespace-pre-wrap">
                  {activeStatus.caption}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Caption & Staff Viewer Analytics Bar */}
          <div className="relative z-20 p-4 bg-gradient-to-t from-black/95 via-black/75 to-transparent space-y-3 text-center">
            {activeStatus.mediaType !== "TEXT" && activeStatus.caption && (
              <p className="text-sm text-white max-w-2xl mx-auto leading-snug">
                {activeStatus.caption}
              </p>
            )}

            {activeStatus.isEventVideo && (
              <p className="text-[11px] text-amber-300 font-medium">
                🎉 Event Video · 24 घंटे पूरे होते ही Video Library में सेव हो जाएगा
                {activeStatus.archivedToLibrary ? " (Library me saved ✅)" : ""}
              </p>
            )}

            {/* Admin / Teacher Viewer Analytics Trigger */}
            {canPostStatus && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setAnalyticsSearch("");
                    setShowAnalyticsSheet(true);
                  }}
                  className="min-h-[44px] px-5 py-2 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span className="tabular-nums">
                    Seen by {viewerAnalytics.seenList.length}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-300">Kisne &amp; Kab Dekha →</span>
                </button>
              </div>
            )}
          </div>

          {/* ── SLIDE-UP VIEWER ANALYTICS SHEET (SEEN + TIMESTAMP vs NOT SEEN) ── */}
          {showAnalyticsSheet && canPostStatus && (
            <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[82vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
                <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto mt-3 sm:hidden" />

                <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        Status Viewer Report
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {viewerAnalytics.seenList.length} Viewed · {viewerAnalytics.unseenStudents.length} Pending
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAnalyticsSheet(false)}
                    className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tabs + Search */}
                <div className="p-3 border-b border-slate-800 space-y-2.5">
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAnalyticsTab("SEEN")}
                      className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                        analyticsTab === "SEEN"
                          ? "bg-emerald-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="tabular-nums">Dekha ({viewerAnalytics.seenList.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsTab("UNSEEN")}
                      className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                        analyticsTab === "UNSEEN"
                          ? "bg-amber-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span className="tabular-nums">Nahi Dekha ({viewerAnalytics.unseenStudents.length})</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={analyticsSearch}
                      onChange={(e) => setAnalyticsSearch(e.target.value)}
                      placeholder="Student ka naam, class ya roll no khojein..."
                      className="w-full min-h-[40px] pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Viewer Rows */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 px-3">
                  {analyticsTab === "SEEN" ? (
                    filteredSeenList.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        Abhi tak kisi ne yeh status nahi dekha hai.
                      </div>
                    ) : (
                      filteredSeenList.map((v, i) => (
                        <div key={`${v.viewerId}_${i}`} className="py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-xs font-bold text-emerald-300 shrink-0">
                              {v.photoUrl ? (
                                <img
                                  src={v.photoUrl}
                                  alt={v.viewerName}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (v.viewerName || "U").slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-white truncate">
                                {v.viewerName}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {v.viewerRole === "STUDENT"
                                  ? `${v.className || "Student"}${v.rollNo ? ` · Roll #${v.rollNo}` : ""}`
                                  : v.viewerRole}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] font-mono text-emerald-400 font-medium tabular-nums">
                              {formatViewedTimestamp(v.viewedAt)}
                            </span>
                          </div>
                        </div>
                      ))
                    )
                  ) : filteredUnseenList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-emerald-400 font-medium">
                      🎉 Sabhi students ne yeh status dekh liya hai!
                    </div>
                  ) : (
                    filteredUnseenList.map((s) => (
                      <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                            {s.photoUrl ? (
                              <img
                                src={s.photoUrl}
                                alt={s.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (s.name || "S").slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-200 truncate">
                              {s.name}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {s.className || "Class"}{s.rollNo ? ` · Roll #${s.rollNo}` : ""}
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] text-amber-400 shrink-0">Not Seen</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
