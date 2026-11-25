import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock,
  Mic,
  Play,
  Radio,
  Search,
  Send,
  Settings,
  Square,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  hasEliteWalkieAccess,
  type School,
  type SchoolAccountant,
  type SchoolTeacher,
} from "../../school-types";
import {
  formatTime24To12,
  getWalkieAutoPlayPref,
  isWithinWalkieSchoolHours,
  playWalkieChimeTone,
  playWalkieMessageAudio,
  saveWalkieSchedule,
  sendSchoolWalkieMessage,
  setWalkieAutoPlayPref,
  syncWalkiePrefsToAndroid,
  unlockWalkieAudioPlayback,
  type SchoolWalkieSchedule,
  type WalkieMessage,
} from "../../utils/schoolWalkieService";
import { EliteFeatureLockCard } from "./EliteFeatureLockCard";

interface WalkieTalkieModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: School | null | undefined;
  schoolId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: "ADMIN" | "ACCOUNTANT" | "TEACHER";
  schoolAdminUid?: string;
  teachers?: SchoolTeacher[];
  accountants?: SchoolAccountant[];
  messages: WalkieMessage[];
  schedule: SchoolWalkieSchedule;
  onUpgradeToElite?: () => void;
}

const WEEKDAY_LABELS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
  { day: 0, label: "Sun" },
];

const QUICK_PROMPTS = [
  "Kripya office me aayein.",
  "Gate par parent aaye hain.",
  "Sabhi staff assembly me pahuchein.",
  "Urgent fee desk check karein.",
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || "");
      const idx = res.indexOf(",");
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = () => reject(new Error("Audio read error"));
    reader.readAsDataURL(blob);
  });
}

function createSafeMediaRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  chosenMime: string;
} {
  const mimeCandidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  const chosenMime =
    typeof MediaRecorder !== "undefined"
      ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || ""
      : "";

  if (chosenMime) {
    try {
      return {
        recorder: new MediaRecorder(stream, {
          mimeType: chosenMime,
          audioBitsPerSecond: 24000,
        }),
        chosenMime,
      };
    } catch {
      try {
        return {
          recorder: new MediaRecorder(stream, { mimeType: chosenMime }),
          chosenMime,
        };
      } catch {
        // Fallback below
      }
    }
  }

  return {
    recorder: new MediaRecorder(stream),
    chosenMime: "",
  };
}

export const WalkieTalkieModal: React.FC<WalkieTalkieModalProps> = ({
  isOpen,
  onClose,
  school,
  schoolId,
  currentUserId,
  currentUserName,
  currentUserRole,
  schoolAdminUid,
  teachers = [],
  accountants = [],
  messages,
  schedule,
  onUpgradeToElite,
}) => {
  const isElite = hasEliteWalkieAccess(school);

  const [autoPlay, setAutoPlay] = useState<boolean>(() => getWalkieAutoPlayPref());
  const [targetType, setTargetType] = useState<"ALL_STAFF" | "DIRECT_STAFF">(
    currentUserRole === "TEACHER" ? "DIRECT_STAFF" : "ALL_STAFF"
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    currentUserRole === "TEACHER" ? "STAFF_ADMIN" : ""
  );
  const [staffSearch, setStaffSearch] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [sending, setSending] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const cancelNextStopRef = useRef(false);
  const isStartingMicRef = useRef(false);
  const pointerDownAtRef = useRef<number>(0);
  const ignoreNextClickRef = useRef(false);

  // Admin School Hours Editor
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [draftSchedule, setDraftSchedule] = useState<SchoolWalkieSchedule>(schedule);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    setDraftSchedule(schedule);
  }, [schedule]);

  useEffect(() => {
    if (!isOpen) {
      // Safely cancel active recording if modal closes
      cancelNextStopRef.current = true;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (meterRafRef.current) {
        cancelAnimationFrame(meterRafRef.current);
        meterRafRef.current = null;
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {}
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        void meterCtxRef.current?.close();
      } catch {}
      meterCtxRef.current = null;
      setIsRecording(false);
      setMicLevel(0);
      return;
    }

    unlockWalkieAudioPlayback();
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          cancelNextStopRef.current = true;
          mediaRecorderRef.current.stop();
        }
      } catch {}
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        void meterCtxRef.current?.close();
      } catch {}
    };
  }, []);

  const hourStatus = useMemo(
    () => isWithinWalkieSchoolHours(schedule, new Date(nowTick)),
    [schedule, nowTick]
  );

  const staffRecipients = useMemo(() => {
    const list: Array<{ id: string; pushIds: string[]; name: string; roleLabel: string }> = [];

    if (currentUserRole !== "ADMIN") {
      const adminPushIds = ["STAFF_ADMIN", "school_admin"];
      if (schoolAdminUid && schoolAdminUid.trim()) {
        adminPushIds.push(schoolAdminUid.trim());
      }
      list.push({
        id: "STAFF_ADMIN",
        pushIds: Array.from(new Set(adminPushIds)),
        name: school?.principalName || "Principal / Admin Office",
        roleLabel: "Admin Office",
      });
    }

    if (accountants.length > 0) {
      accountants.forEach((acc) => {
        if (!acc?.id || acc.id === currentUserId) return;
        list.push({
          id: acc.id,
          pushIds: [acc.id, "accountant_admin"],
          name: acc.name || "Accountant",
          roleLabel: acc.designation || "Accountant",
        });
      });
    } else if (currentUserRole !== "ACCOUNTANT") {
      list.push({
        id: "accountant_admin",
        pushIds: ["accountant_admin"],
        name: "Accountant Office",
        roleLabel: "Fee & Accounts",
      });
    }

    teachers.forEach((t) => {
      if (!t?.id || t.id === currentUserId) return;
      list.push({
        id: t.id,
        pushIds: [t.id],
        name: t.name || "Teacher",
        roleLabel:
          t.designation ||
          (Array.isArray(t.subjects) && t.subjects.length > 0
            ? t.subjects.slice(0, 2).join(", ")
            : "Teacher"),
      });
    });

    return list;
  }, [
    accountants,
    teachers,
    currentUserId,
    currentUserRole,
    school?.principalName,
    schoolAdminUid,
  ]);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    if (!q) return staffRecipients;
    return staffRecipients.filter(
      (s) => s.name.toLowerCase().includes(q) || s.roleLabel.toLowerCase().includes(q)
    );
  }, [staffRecipients, staffSearch]);

  const allStaffPushIds = useMemo(
    () => Array.from(new Set(staffRecipients.flatMap((s) => s.pushIds))),
    [staffRecipients]
  );

  const activeTarget = useMemo(() => {
    if (targetType === "ALL_STAFF") {
      return {
        targetType: "ALL_STAFF" as const,
        targetIds: ["ALL_STAFF"],
        targetName: "Sabhi Staff (All Staff Channel)",
      };
    }
    const found =
      staffRecipients.find((s) => s.id === selectedStaffId) || staffRecipients[0];
    if (!found) {
      return {
        targetType: "ALL_STAFF" as const,
        targetIds: ["ALL_STAFF"],
        targetName: "Sabhi Staff (All Staff Channel)",
      };
    }
    return {
      targetType: "DIRECT_STAFF" as const,
      targetIds: found.pushIds,
      targetName: found.name,
    };
  }, [targetType, selectedStaffId, staffRecipients]);

  if (!isOpen) return null;

  const stopMeterLoop = () => {
    if (meterRafRef.current) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    try {
      void meterCtxRef.current?.close();
    } catch {}
    meterCtxRef.current = null;
    setMicLevel(0);
  };

  const startMeterLoop = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      meterCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!meterCtxRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 90) * 100)));
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch {}
  };

  const handleToggleAutoPlay = () => {
    unlockWalkieAudioPlayback();
    const next = !autoPlay;
    setAutoPlay(next);
    setWalkieAutoPlayPref(next);
    syncWalkiePrefsToAndroid(schedule, next);
    toast.success(
      next
        ? "Direct Speaker Auto-Play ON (Walkie sunai dega)"
        : "Class Mode ON (Silent · Sirf Notification aayega)"
    );
  };

  const stopRecordingInternal = (shouldCancel = false) => {
    cancelNextStopRef.current = shouldCancel;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopMeterLoop();
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      } else {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    } catch {
      try {
        mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    if (shouldCancel) {
      toast.info("Voice recording cancel kar di gayi.");
    }
  };

  const startRecording = async () => {
    if (!isElite || isRecording || sending || isStartingMicRef.current) return;
    if (!hourStatus.active) {
      toast.error(hourStatus.reason);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error(
        "Is device par microphone recording supported nahi hai. Neeche Text Walkie bhejein."
      );
      return;
    }

    isStartingMicRef.current = true;
    unlockWalkieAudioPlayback();

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      mediaStreamRef.current = stream;
      chunksRef.current = [];
      cancelNextStopRef.current = false;

      const { recorder, chosenMime } = createSafeMediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onerror = () => {
        stopMeterLoop();
        setIsRecording(false);
        toast.error("Mic recording me dikkat aayi. Dubara try karein ya Text Walkie bhejein.");
      };

      recorder.onstop = async () => {
        stopMeterLoop();
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
        mediaStreamRef.current = null;
        if (cancelNextStopRef.current) {
          chunksRef.current = [];
          return;
        }
        const elapsedSec = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        );
        const blob = new Blob(chunksRef.current, {
          type: chosenMime || recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size < 350) {
          toast.info("Kam se kam 1 second bolkar button chhodein.");
          return;
        }
        setSending(true);
        try {
          const b64 = await blobToBase64(blob);
          await sendSchoolWalkieMessage({
            schoolId,
            schoolName: school?.name,
            senderId: currentUserId,
            senderName: currentUserName,
            senderRole: currentUserRole,
            targetType: activeTarget.targetType,
            targetIds: activeTarget.targetIds,
            targetName: activeTarget.targetName,
            mode: "VOICE",
            audioBase64: b64,
            mimeType: blob.type || "audio/webm",
            durationSec: elapsedSec,
            allStaffPushIds,
            schedule,
          });
          playWalkieChimeTone("over");
          toast.success(`${activeTarget.targetName} ko walkie voice bhej di gayi.`);
        } catch (err: any) {
          toast.error(err?.message || "Walkie message nahi bheja ja saka.");
        } finally {
          setSending(false);
        }
      };

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecordSeconds(0);
      setIsRecording(true);
      playWalkieChimeTone("start");
      startMeterLoop(stream);
      recorder.start(250);

      timerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setRecordSeconds(sec);
        if (sec >= 30) {
          stopRecordingInternal(false);
        }
      }, 250);
    } catch {
      toast.error("Microphone permission allow karein ya neeche Text Walkie bhejein.");
    } finally {
      isStartingMicRef.current = false;
    }
  };

  const handleMicPointerDown = () => {
    if (sending || !hourStatus.active || !isElite) return;
    unlockWalkieAudioPlayback();
    pointerDownAtRef.current = Date.now();
    if (!isRecording) {
      ignoreNextClickRef.current = true;
      void startRecording();
    } else {
      ignoreNextClickRef.current = false;
    }
  };

  const handleMicPointerUp = () => {
    if (!isRecording) return;
    const heldMs = Date.now() - pointerDownAtRef.current;
    // Hold-to-talk: if held >= 650ms, releasing sends immediately; quick tap keeps recording open until tapped again
    if (heldMs >= 650) {
      ignoreNextClickRef.current = true;
      stopRecordingInternal(false);
    }
  };

  const handleMicClick = () => {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false;
      return;
    }
    if (isRecording) {
      stopRecordingInternal(false);
    } else {
      void startRecording();
    }
  };

  const handleSendTextWalkie = async (customText?: string) => {
    unlockWalkieAudioPlayback();
    const clean = (customText ?? announcementText).trim();
    if (!clean || sending) return;
    if (!hourStatus.active) {
      toast.error(hourStatus.reason);
      return;
    }
    setSending(true);
    try {
      await sendSchoolWalkieMessage({
        schoolId,
        schoolName: school?.name,
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentUserRole,
        targetType: activeTarget.targetType,
        targetIds: activeTarget.targetIds,
        targetName: activeTarget.targetName,
        mode: "TTS",
        text: clean,
        allStaffPushIds,
        schedule,
      });
      playWalkieChimeTone("over");
      if (!customText) setAnnouncementText("");
      toast.success(`${activeTarget.targetName} ke phone par voice announcement bheja gaya.`);
    } catch (err: any) {
      toast.error(err?.message || "Text walkie bhejne me dikkat aayi.");
    } finally {
      setSending(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (currentUserRole !== "ADMIN" || savingSchedule) return;
    setSavingSchedule(true);
    try {
      await saveWalkieSchedule(schoolId, {
        ...draftSchedule,
        updatedBy: currentUserName,
      });
      setShowScheduleEditor(false);
      toast.success("School Hours Walkie timing save ho gayi.");
    } catch (err: any) {
      toast.error(err?.message || "Timing save nahi ho saki.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const toggleDraftDay = (day: number) => {
    setDraftSchedule((prev) => {
      const exists = prev.activeDays.includes(day);
      const nextDays = exists
        ? prev.activeDays.filter((d) => d !== day)
        : [...prev.activeDays, day];
      return {
        ...prev,
        activeDays: nextDays.length > 0 ? nextDays : [day],
      };
    });
  };

  return (
    <div
      className="fixed inset-0 z-[95] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Radio className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                School Walkie-Talkie Intercom
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {schedule.alwaysActive ? "24 Hours Live" : "School Hours"} ·{" "}
                {hourStatus.windowLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isElite && currentUserRole === "ADMIN" && (
              <button
                type="button"
                onClick={() => setShowScheduleEditor((v) => !v)}
                className={`min-h-[36px] px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition ${
                  showScheduleEditor
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="School Hours Timing Badlein"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timing</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition"
              aria-label="Close Walkie-Talkie"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!isElite ? (
            <EliteFeatureLockCard
              compact
              title="School-Hour Live Walkie-Talkie (Staff Intercom)"
              description="Principal, Accountant aur Teachers ke beech school timing me direct push-to-talk walkie-talkie aur voice announcement sirf Elite Plan schools ke liye uplabdh hai."
              highlights={[
                "1-Tap Push-to-Talk & Text-to-Voice broadcast (Single Staff ya All Staff)",
                "Sirf School Hours window (jaise 07:30 AM – 03:30 PM) ya 24h mode",
                "Audio/Video Calls aur Fee Tagada Caller bhi Elite Plan me shamil",
              ]}
              onUpgrade={() => {
                onClose();
                onUpgradeToElite?.();
              }}
              onBack={onClose}
            />
          ) : (
            <>
              {/* Status Strip + Speaker Class-Mode Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs min-w-0">
                  <Clock
                    className={`w-4 h-4 shrink-0 ${
                      hourStatus.active ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                    }`}
                  />
                  <span
                    className={`font-semibold ${
                      hourStatus.active
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {hourStatus.active
                      ? schedule.alwaysActive
                        ? "24 Hours Live Active"
                        : "School Hours Active"
                      : "Closed Outside School Hours"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleAutoPlay}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition ${
                    autoPlay
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                  }`}
                >
                  {autoPlay ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Speaker Auto-Play ON</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Class Mode (Silent)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Admin School Hours Config */}
              {showScheduleEditor && currentUserRole === "ADMIN" && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      School Hours Walkie Schedule
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(draftSchedule.alwaysActive)}
                          onChange={(e) =>
                            setDraftSchedule((p) => ({
                              ...p,
                              alwaysActive: e.target.checked,
                            }))
                          }
                          className="rounded accent-indigo-600"
                        />
                        <span>24 Hours Always ON</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draftSchedule.enabled}
                          onChange={(e) =>
                            setDraftSchedule((p) => ({ ...p, enabled: e.target.checked }))
                          }
                          className="rounded accent-emerald-600"
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                  </div>

                  {!draftSchedule.alwaysActive && (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={draftSchedule.startTime}
                            onChange={(e) =>
                              setDraftSchedule((p) => ({ ...p, startTime: e.target.value }))
                            }
                            className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={draftSchedule.endTime}
                            onChange={(e) =>
                              setDraftSchedule((p) => ({ ...p, endTime: e.target.value }))
                            }
                            className="w-full min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_LABELS.map((w) => {
                          const active = draftSchedule.activeDays.includes(w.day);
                          return (
                            <button
                              key={w.day}
                              type="button"
                              onClick={() => toggleDraftDay(w.day)}
                              className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition ${
                                active
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {w.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {draftSchedule.alwaysActive
                        ? "Preview: 24 Hours Always Active (Testing & Emergency Ready)"
                        : `Preview: ${formatTime24To12(draftSchedule.startTime)} – ${formatTime24To12(draftSchedule.endTime)}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={savingSchedule}
                      className="min-h-[36px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{savingSchedule ? "Saving..." : "Save Timing"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Target Recipient Picker */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setTargetType("ALL_STAFF")}
                    className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      targetType === "ALL_STAFF"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>All Staff Channel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("DIRECT_STAFF");
                      if (!selectedStaffId && staffRecipients[0]) {
                        setSelectedStaffId(staffRecipients[0].id);
                      }
                    }}
                    className={`flex-1 min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition ${
                      targetType === "DIRECT_STAFF"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>1-to-1 Staff ({staffRecipients.length})</span>
                  </button>
                </div>

                {targetType === "DIRECT_STAFF" && (
                  <div className="space-y-2">
                    {staffRecipients.length > 5 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          placeholder="Teacher ya staff ka naam khojein..."
                          className="w-full min-h-[38px] pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    )}
                    <div className="max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {filteredStaff.map((st) => {
                        const selected =
                          (selectedStaffId || staffRecipients[0]?.id) === st.id;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setSelectedStaffId(st.id)}
                            className={`min-h-[42px] px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                              selected
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-emerald-400"
                            }`}
                          >
                            <p className="text-xs font-bold truncate">{st.name}</p>
                            <p
                              className={`text-[10px] truncate ${
                                selected ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {st.roleLabel}
                            </p>
                          </button>
                        );
                      })}
                      {filteredStaff.length === 0 && (
                        <p className="col-span-full text-xs text-slate-500 dark:text-slate-400 py-2 text-center">
                          Koi staff match nahi mila.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Push-to-Talk Anchor */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center gap-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target:{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {activeTarget.targetName}
                  </span>
                </p>

                {!hourStatus.active ? (
                  <div className="w-full py-3 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 text-xs font-semibold text-rose-700 dark:text-rose-300">
                    {hourStatus.reason}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5 w-full">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onPointerDown={handleMicPointerDown}
                        onPointerUp={handleMicPointerUp}
                        onPointerCancel={handleMicPointerUp}
                        onClick={handleMicClick}
                        disabled={sending}
                        className={`w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 font-bold text-xs shadow-md transition active:scale-95 select-none touch-none cursor-pointer ${
                          isRecording
                            ? "bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-500/30"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                        title={
                          isRecording
                            ? "Tap to Stop & Send"
                            : "Hold karke ya Tap karke bolein"
                        }
                      >
                        {isRecording ? (
                          <>
                            <Square className="w-6 h-6 fill-current" />
                            <span className="font-mono tabular-nums text-[11px]">
                              0:{String(recordSeconds).padStart(2, "0")}
                            </span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-7 h-7" />
                            <span className="text-[10px]">
                              {sending ? "Sending" : "Speak"}
                            </span>
                          </>
                        )}
                      </button>

                      {isRecording && (
                        <button
                          type="button"
                          onClick={() => stopRecordingInternal(true)}
                          className="min-h-[40px] px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>

                    {isRecording && (
                      <div className="w-44 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-[width] duration-75"
                          style={{ width: `${Math.max(12, micLevel)}%` }}
                        />
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isRecording
                        ? "Bolne ke baad Stop dabayein (max 30s)"
                        : "Dabakar rakhein ya Tap karein — dusre mobile par seedha bajega"}
                    </p>
                  </div>
                )}

                {/* Quick Text-to-Voice Input + Preset Prompts */}
                {hourStatus.active && (
                  <div className="w-full space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-left">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSendTextWalkie();
                          }
                        }}
                        placeholder="Ya message likhkar bolwayein (Text-to-Walkie)..."
                        className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSendTextWalkie()}
                        disabled={sending || !announcementText.trim()}
                        className="min-h-[40px] px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_PROMPTS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => void handleSendTextWalkie(q)}
                          disabled={sending}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer transition"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Walkie History */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Recent Walkie Log ({messages.length})
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Miss hone par dubara sunein
                  </span>
                </div>

                {messages.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    Aaj abhi tak koi walkie message nahi aaya hai.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {messages.slice(0, 12).map((m) => {
                      const isMine = m.senderId === currentUserId;
                      const timeLabel = m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";
                      return (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {isMine ? "Aap" : m.senderName}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="text-slate-600 dark:text-slate-300 truncate font-medium">
                                {m.targetName}
                              </span>
                              <span className="font-mono tabular-nums text-[10px] text-slate-400 shrink-0 ml-auto">
                                {timeLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                              {m.text ||
                                (m.durationSec
                                  ? `Voice Walkie (${m.durationSec}s)`
                                  : "Voice Walkie")}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                unlockWalkieAudioPlayback();
                                void playWalkieMessageAudio(m);
                              }}
                              className="min-h-[34px] min-w-[34px] rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center justify-center cursor-pointer"
                              title="Play Walkie Message"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            {!isMine && (
                              <button
                                type="button"
                                onClick={() => {
                                  const senderExists = staffRecipients.some(
                                    (s) => s.id === m.senderId || s.pushIds.includes(m.senderId)
                                  );
                                  if (senderExists) {
                                    const match = staffRecipients.find(
                                      (s) => s.id === m.senderId || s.pushIds.includes(m.senderId)
                                    );
                                    if (match) {
                                      setTargetType("DIRECT_STAFF");
                                      setSelectedStaffId(match.id);
                                      toast.info(`Reply target set: ${match.name}`);
                                    }
                                  } else {
                                    setTargetType("ALL_STAFF");
                                  }
                                }}
                                className="min-h-[34px] px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold cursor-pointer"
                              >
                                Reply
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
