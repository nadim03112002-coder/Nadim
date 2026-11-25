import { useEffect, useRef, useState } from "react";
import { onValue, ref, remove, set } from "firebase/database";
import { rtdb } from "../firebase";
import { toast } from "sonner";
import {
  getOrCreatePushDeviceId,
  sendSchoolPushNotification,
} from "./schoolPushClient";
import { speakRawTextWithNativeOrBrowser } from "./schoolCallerId";

export interface SchoolWalkieSchedule {
  enabled: boolean;
  startTime: string; // HH:mm e.g. "07:30"
  endTime: string;   // HH:mm e.g. "15:30"
  activeDays: number[]; // 0=Sun..6=Sat, default [1,2,3,4,5,6]
  updatedAt?: string;
  updatedBy?: string;
}

export interface WalkieMessage {
  id: string;
  schoolId: string;
  senderId: string;
  senderName: string;
  senderRole: "ADMIN" | "ACCOUNTANT" | "TEACHER";
  senderDeviceId: string;
  targetType: "ALL_STAFF" | "DIRECT_STAFF";
  targetIds: string[];
  targetName: string;
  mode: "VOICE" | "TTS";
  audioBase64?: string;
  mimeType?: string;
  text?: string;
  durationSec?: number;
  createdAt: string;
  createdAtMs: number;
}

export const DEFAULT_WALKIE_SCHEDULE: SchoolWalkieSchedule = {
  enabled: true,
  startTime: "07:30",
  endTime: "15:30",
  activeDays: [1, 2, 3, 4, 5, 6],
};

const WALKIE_SCHEDULE_CACHE_KEY = (schoolId: string) =>
  `nst_walkie_schedule_v1_${schoolId || "default"}`;
const WALKIE_AUTOPLAY_KEY = "nst_walkie_autoplay_v1";
const WALKIE_SEEN_IDS_SESSION = new Set<string>();

function cleanRtdbSegment(raw: string): string {
  return String(raw || "").trim().replace(/[.#$[\]/\s]/g, "_");
}

function getAndroidBridge(): any {
  if (typeof window === "undefined") return null;
  return (window as any).LifeMakerAndroid || null;
}

export function getWalkieAutoPlayPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(WALKIE_AUTOPLAY_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function setWalkieAutoPlayPref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WALKIE_AUTOPLAY_KEY, enabled ? "true" : "false");
  } catch {}
}

export function getCachedWalkieSchedule(schoolId: string): SchoolWalkieSchedule {
  if (typeof window === "undefined" || !schoolId) return DEFAULT_WALKIE_SCHEDULE;
  try {
    const raw = localStorage.getItem(WALKIE_SCHEDULE_CACHE_KEY(schoolId));
    if (!raw) return DEFAULT_WALKIE_SCHEDULE;
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled !== false,
      startTime: /^\d{2}:\d{2}$/.test(String(parsed?.startTime || ""))
        ? String(parsed.startTime)
        : DEFAULT_WALKIE_SCHEDULE.startTime,
      endTime: /^\d{2}:\d{2}$/.test(String(parsed?.endTime || ""))
        ? String(parsed.endTime)
        : DEFAULT_WALKIE_SCHEDULE.endTime,
      activeDays: Array.isArray(parsed?.activeDays)
        ? parsed.activeDays.map(Number).filter((d: number) => d >= 0 && d <= 6)
        : DEFAULT_WALKIE_SCHEDULE.activeDays,
      updatedAt: parsed?.updatedAt,
      updatedBy: parsed?.updatedBy,
    };
  } catch {
    return DEFAULT_WALKIE_SCHEDULE;
  }
}

export function syncWalkiePrefsToAndroid(
  schedule: SchoolWalkieSchedule,
  autoPlay: boolean
): void {
  try {
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.setWalkieOptions === "function") {
      bridge.setWalkieOptions(
        JSON.stringify({
          enabled: schedule.enabled !== false,
          autoPlay,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          activeDays: schedule.activeDays,
        })
      );
    }
  } catch {}
}

export function formatTime24To12(hhmm: string): string {
  const parts = String(hhmm || "").split(":");
  if (parts.length !== 2) return hhmm || "";
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function isWithinWalkieSchoolHours(
  schedule: SchoolWalkieSchedule,
  now: Date = new Date()
): { active: boolean; windowLabel: string; reason: string } {
  const windowLabel = `${formatTime24To12(schedule.startTime)} – ${formatTime24To12(schedule.endTime)}`;
  if (!schedule.enabled) {
    return {
      active: false,
      windowLabel,
      reason: "Admin ne Walkie-Talkie abhi off kar rakha hai.",
    };
  }

  const day = now.getDay(); // 0=Sun..6=Sat
  const allowedDays =
    Array.isArray(schedule.activeDays) && schedule.activeDays.length > 0
      ? schedule.activeDays
      : DEFAULT_WALKIE_SCHEDULE.activeDays;
  if (!allowedDays.includes(day)) {
    return {
      active: false,
      windowLabel,
      reason: "Aaj off-day hai. Walkie-Talkie sirf scheduled school days me active rehta hai.",
    };
  }

  const [sh, sm] = schedule.startTime.split(":").map(Number);
  const [eh, em] = schedule.endTime.split(":").map(Number);
  if (![sh, sm, eh, em].every((n) => Number.isFinite(n))) {
    return { active: true, windowLabel, reason: "School hours active" };
  }

  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const inside =
    endMin >= startMin
      ? nowMin >= startMin && nowMin <= endMin
      : nowMin >= startMin || nowMin <= endMin;

  return inside
    ? {
        active: true,
        windowLabel,
        reason: `School Hours Active (${windowLabel})`,
      }
    : {
        active: false,
        windowLabel,
        reason: `Abhi school hours bahar hai. Active timing: ${windowLabel}`,
      };
}

export async function saveWalkieSchedule(
  schoolId: string,
  schedule: SchoolWalkieSchedule
): Promise<void> {
  const cleanId = cleanRtdbSegment(schoolId);
  if (!cleanId) return;
  const nextSchedule: SchoolWalkieSchedule = {
    enabled: schedule.enabled !== false,
    startTime: schedule.startTime || DEFAULT_WALKIE_SCHEDULE.startTime,
    endTime: schedule.endTime || DEFAULT_WALKIE_SCHEDULE.endTime,
    activeDays:
      Array.isArray(schedule.activeDays) && schedule.activeDays.length > 0
        ? schedule.activeDays
        : DEFAULT_WALKIE_SCHEDULE.activeDays,
    updatedAt: new Date().toISOString(),
    updatedBy: schedule.updatedBy || "Admin",
  };
  try {
    localStorage.setItem(WALKIE_SCHEDULE_CACHE_KEY(schoolId), JSON.stringify(nextSchedule));
  } catch {}
  syncWalkiePrefsToAndroid(nextSchedule, getWalkieAutoPlayPref());
  if (rtdb) {
    await set(ref(rtdb, `school_walkie/${cleanId}/schedule`), nextSchedule);
  }
}

export function playWalkieChimeTone(kind: "start" | "over" = "start"): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    if (kind === "start") {
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.setValueAtTime(1240, now + 0.08);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    } else {
      osc.frequency.setValueAtTime(760, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {}
    }, 350);
  } catch {}
}

export async function playWalkieMessageAudio(msg: WalkieMessage): Promise<void> {
  playWalkieChimeTone("start");
  if (msg.mode === "VOICE" && msg.audioBase64) {
    try {
      const dataUrl = msg.audioBase64.startsWith("data:")
        ? msg.audioBase64
        : `data:${msg.mimeType || "audio/webm"};base64,${msg.audioBase64}`;
      const audio = new Audio(dataUrl);
      audio.onended = () => playWalkieChimeTone("over");
      await audio.play();
      return;
    } catch {
      // Autoplay or codec fallback -> speak fallback caption if present
    }
  }
  const spokenText = msg.text?.trim()
    ? `${msg.senderName} kah rahe hain: ${msg.text.trim()}`
    : `${msg.senderName} ne walkie voice message bheja hai.`;
  speakRawTextWithNativeOrBrowser(spokenText, `walkie_${msg.id}`, true);
}

export async function sendSchoolWalkieMessage(params: {
  schoolId: string;
  schoolName?: string;
  senderId: string;
  senderName: string;
  senderRole: "ADMIN" | "ACCOUNTANT" | "TEACHER";
  targetType: "ALL_STAFF" | "DIRECT_STAFF";
  targetIds: string[];
  targetName: string;
  mode: "VOICE" | "TTS";
  audioBase64?: string;
  mimeType?: string;
  text?: string;
  durationSec?: number;
  allStaffPushIds?: string[];
  schedule: SchoolWalkieSchedule;
}): Promise<WalkieMessage> {
  const status = isWithinWalkieSchoolHours(params.schedule);
  if (!status.active) {
    throw new Error(status.reason);
  }

  const cleanSchoolId = cleanRtdbSegment(params.schoolId);
  if (!cleanSchoolId || !rtdb) {
    throw new Error("School Walkie network tayyar nahi hai.");
  }

  const nowMs = Date.now();
  const id = `wk_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
  const deviceId = getOrCreatePushDeviceId();

  // Keep payload compact for RTDB & mobile playback (< ~320KB)
  const cleanB64 = params.audioBase64 ? String(params.audioBase64).trim() : "";
  if (params.mode === "VOICE" && cleanB64.length > 420_000) {
    throw new Error("Voice clip thodi lambi ho gayi (max 15s rakhein). Kripya chhota bolkar bhejein.");
  }

  const msg: WalkieMessage = {
    id,
    schoolId: params.schoolId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderRole: params.senderRole,
    senderDeviceId: deviceId,
    targetType: params.targetType,
    targetIds: Array.from(new Set(params.targetIds.map((x) => String(x).trim()).filter(Boolean))),
    targetName: params.targetName || (params.targetType === "ALL_STAFF" ? "All Staff" : "Staff"),
    mode: params.mode,
    ...(cleanB64 ? { audioBase64: cleanB64 } : {}),
    ...(params.mimeType ? { mimeType: params.mimeType } : {}),
    ...(params.text?.trim() ? { text: params.text.trim() } : {}),
    ...(params.durationSec ? { durationSec: params.durationSec } : {}),
    createdAt: new Date(nowMs).toISOString(),
    createdAtMs: nowMs,
  };

  WALKIE_SEEN_IDS_SESSION.add(id);
  await set(ref(rtdb, `school_walkie/${cleanSchoolId}/messages/${id}`), msg);

  // Fan out background push / VoiceGuardService wakeup so Android screen-off phones play immediately during school hours
  const pushTargets =
    params.targetType === "ALL_STAFF"
      ? Array.from(
          new Set([
            ...(params.allStaffPushIds || []),
            "STAFF_ADMIN",
            "school_admin",
            "accountant_admin",
          ])
        ).filter((tid) => tid && tid !== params.senderId)
      : msg.targetIds.filter((tid) => tid && tid !== params.senderId);

  if (pushTargets.length > 0) {
    const isSmallClipForPush = cleanB64.length > 0 && cleanB64.length <= 160_000;
    const notifTitle = `Walkie · ${params.senderName}`;
    const notifBody =
      msg.text ||
      (msg.durationSec ? `Live Walkie Audio (${msg.durationSec}s)` : "Live Walkie Voice Message");

    void sendSchoolPushNotification({
      schoolId: params.schoolId,
      studentIds: pushTargets,
      senderId: params.senderId,
      senderName: params.senderName,
      senderDeviceId: deviceId,
      type: msg.mode === "VOICE" ? "WALKIE_VOICE" : "WALKIE_TTS",
      title: notifTitle,
      body: notifBody,
      voiceSpeak: true,
      urgent: true,
      url: "/?openWalkie=1",
      ...(isSmallClipForPush ? { walkieAudioBase64: cleanB64, walkieMimeType: msg.mimeType || "audio/webm" } : {}),
      walkieSpeechText: msg.text
        ? `${params.senderName} walkie par bol rahe hain: ${msg.text}`
        : `${params.senderName} ne live walkie message bheja hai.`,
    }).catch(() => {});
  }

  return msg;
}

export function isWalkieMessageForUser(
  msg: WalkieMessage,
  userId: string,
  userRole: "ADMIN" | "ACCOUNTANT" | "TEACHER"
): boolean {
  if (msg.targetType === "ALL_STAFF") return true;
  if (msg.targetIds.includes(userId)) return true;
  if (msg.senderId === userId) return true;
  if (
    (userRole === "ADMIN" || userRole === "ACCOUNTANT") &&
    msg.targetIds.some((id) => ["STAFF_ADMIN", "school_admin", "accountant_admin"].includes(id))
  ) {
    return true;
  }
  return false;
}

export function useSchoolWalkieChannel(params: {
  enabled: boolean;
  schoolId?: string;
  userId?: string;
  userRole: "ADMIN" | "ACCOUNTANT" | "TEACHER";
  onOpenWalkie?: () => void;
}) {
  const { enabled, schoolId, userId, userRole, onOpenWalkie } = params;
  const [messages, setMessages] = useState<WalkieMessage[]>([]);
  const [schedule, setSchedule] = useState<SchoolWalkieSchedule>(() =>
    schoolId ? getCachedWalkieSchedule(schoolId) : DEFAULT_WALKIE_SCHEDULE
  );
  const mountedAtRef = useRef<number>(Date.now());
  const scheduleRef = useRef<SchoolWalkieSchedule>(schedule);
  scheduleRef.current = schedule;
  const onOpenRef = useRef(onOpenWalkie);
  onOpenRef.current = onOpenWalkie;

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, [schoolId]);

  useEffect(() => {
    if (!enabled || !schoolId || !rtdb) {
      setMessages([]);
      return;
    }
    const cleanSchoolId = cleanRtdbSegment(schoolId);
    if (!cleanSchoolId) return;

    const unsubSchedule = onValue(ref(rtdb, `school_walkie/${cleanSchoolId}/schedule`), (snap) => {
      const val = snap.val();
      const next: SchoolWalkieSchedule = val
        ? {
            enabled: val.enabled !== false,
            startTime: /^\d{2}:\d{2}$/.test(String(val.startTime || ""))
              ? String(val.startTime)
              : DEFAULT_WALKIE_SCHEDULE.startTime,
            endTime: /^\d{2}:\d{2}$/.test(String(val.endTime || ""))
              ? String(val.endTime)
              : DEFAULT_WALKIE_SCHEDULE.endTime,
            activeDays: Array.isArray(val.activeDays)
              ? val.activeDays.map(Number).filter((d: number) => d >= 0 && d <= 6)
              : DEFAULT_WALKIE_SCHEDULE.activeDays,
            updatedAt: val.updatedAt,
            updatedBy: val.updatedBy,
          }
        : DEFAULT_WALKIE_SCHEDULE;
      setSchedule(next);
      try {
        localStorage.setItem(WALKIE_SCHEDULE_CACHE_KEY(schoolId), JSON.stringify(next));
      } catch {}
      syncWalkiePrefsToAndroid(next, getWalkieAutoPlayPref());
    });

    const myDeviceId = getOrCreatePushDeviceId();

    const unsubMessages = onValue(ref(rtdb, `school_walkie/${cleanSchoolId}/messages`), (snap) => {
      const raw = snap.val() as Record<string, WalkieMessage> | null;
      if (!raw || typeof raw !== "object") {
        setMessages([]);
        return;
      }
      const list = Object.values(raw)
        .filter((m): m is WalkieMessage => Boolean(m && m.id))
        .filter((m) => isWalkieMessageForUser(m, userId || "", userRole))
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

      setMessages(list.slice(0, 25));

      // Trim excess old messages (>30) cleanly from Admin client
      if (userRole === "ADMIN" && Object.keys(raw).length > 35) {
        const sortedAll = Object.values(raw).sort(
          (a: any, b: any) => (b?.createdAtMs || 0) - (a?.createdAtMs || 0)
        );
        sortedAll.slice(25).forEach((oldItem: any) => {
          if (oldItem?.id) {
            remove(ref(rtdb, `school_walkie/${cleanSchoolId}/messages/${oldItem.id}`)).catch(() => {});
          }
        });
      }

      // Check newest unseen incoming message sent AFTER mount
      for (const m of list) {
        if (WALKIE_SEEN_IDS_SESSION.has(m.id)) continue;
        WALKIE_SEEN_IDS_SESSION.add(m.id);

        const isFresh = (m.createdAtMs || 0) >= mountedAtRef.current - 5_000;
        const isSelf =
          (m.senderDeviceId && m.senderDeviceId === myDeviceId) ||
          (userId && m.senderId === userId);
        if (!isFresh || isSelf) continue;

        const hourStatus = isWithinWalkieSchoolHours(scheduleRef.current);
        if (!hourStatus.active) continue;

        const autoPlayOn = getWalkieAutoPlayPref();
        if (autoPlayOn) {
          void playWalkieMessageAudio(m);
        } else {
          playWalkieChimeTone("start");
        }

        toast.message(`Walkie · ${m.senderName}`, {
          description: m.text || (autoPlayOn ? "Audio walkie play ho raha hai..." : "Class Mode: Tap to listen"),
          action: onOpenRef.current
            ? {
                label: "Reply",
                onClick: () => onOpenRef.current?.(),
              }
            : undefined,
        });
      }
    });

    return () => {
      unsubSchedule();
      unsubMessages();
    };
  }, [enabled, schoolId, userId, userRole]);

  return {
    messages,
    schedule,
  };
}
