import { useEffect, useRef, useState } from "react";
import { onValue, ref, remove, set } from "firebase/database";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db, ensureFirebaseAuthSession, rtdb } from "../firebase";
import { supabase } from "../services/supabaseClient";
import {
  sbRtdbRemove,
  sbRtdbSet,
  sbRtdbSubscribe,
} from "../services/supabaseDbAdapter";
import { toast } from "sonner";
import {
  getOrCreatePushDeviceId,
  sendSchoolPushNotification,
} from "./schoolPushClient";
import { speakRawTextWithNativeOrBrowser } from "./schoolCallerId";

export interface SchoolWalkieSchedule {
  enabled: boolean;
  alwaysActive?: boolean;
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
  alwaysActive: false,
  startTime: "07:30",
  endTime: "15:30",
  activeDays: [1, 2, 3, 4, 5, 6],
};

const WALKIE_SCHEDULE_CACHE_KEY = (schoolId: string) =>
  `nst_walkie_schedule_v1_${schoolId || "default"}`;
const WALKIE_AUTOPLAY_KEY = "nst_walkie_autoplay_v1";
const WALKIE_SEEN_IDS_SESSION = new Set<string>();
const WALKIE_HISTORY_CACHE_KEY = (schoolId: string) =>
  `nst_walkie_history_v1_${schoolId || "default"}`;

let sharedWalkieAudioCtx: AudioContext | null = null;
let sharedWalkieAudioElement: HTMLAudioElement | null = null;
let activeBroadcastChannel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
let activeBroadcastSchoolId = "";

function cleanRtdbSegment(raw: string): string {
  return String(raw || "").trim().replace(/[.#$[\]/\s]/g, "_");
}

function getAndroidBridge(): any {
  if (typeof window === "undefined") return null;
  return (window as any).LifeMakerAndroid || null;
}

function stripUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  Object.keys(obj).forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out as T;
}

function isPermissionDeniedError(err: any): boolean {
  const msg = String(err?.code || err?.message || err || "").toLowerCase();
  return msg.includes("permission_denied") || msg.includes("permission-denied") || msg.includes("permission denied");
}

function normalizeSchedulePayload(val: any): SchoolWalkieSchedule {
  if (!val || typeof val !== "object") return DEFAULT_WALKIE_SCHEDULE;
  return {
    enabled: val.enabled !== false,
    alwaysActive: Boolean(val.alwaysActive),
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
  };
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
    return normalizeSchedulePayload(JSON.parse(raw));
  } catch {
    return DEFAULT_WALKIE_SCHEDULE;
  }
}

function getCachedWalkieMessages(schoolId: string): WalkieMessage[] {
  if (typeof window === "undefined" || !schoolId) return [];
  try {
    const raw = localStorage.getItem(WALKIE_HISTORY_CACHE_KEY(schoolId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((m: any) => m && m.id) : [];
  } catch {
    return [];
  }
}

function cacheWalkieMessages(schoolId: string, list: WalkieMessage[]): void {
  if (typeof window === "undefined" || !schoolId) return;
  try {
    // Store metadata & compact clips (skip oversized clips in localStorage if >50KB)
    const compact = list.slice(0, 20).map((m) => ({
      ...m,
      audioBase64: m.audioBase64 && m.audioBase64.length <= 80_000 ? m.audioBase64 : undefined,
    }));
    localStorage.setItem(WALKIE_HISTORY_CACHE_KEY(schoolId), JSON.stringify(compact));
  } catch {}
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
          startTime: schedule.alwaysActive ? "00:00" : schedule.startTime,
          endTime: schedule.alwaysActive ? "23:59" : schedule.endTime,
          activeDays: schedule.alwaysActive ? [0, 1, 2, 3, 4, 5, 6] : schedule.activeDays,
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
  const windowLabel = schedule.alwaysActive
    ? "24 Hours (Always ON)"
    : `${formatTime24To12(schedule.startTime)} – ${formatTime24To12(schedule.endTime)}`;

  if (!schedule.enabled) {
    return {
      active: false,
      windowLabel,
      reason: "Admin ne Walkie-Talkie abhi off kar rakha hai.",
    };
  }

  if (schedule.alwaysActive) {
    return {
      active: true,
      windowLabel,
      reason: "24 Hours Walkie Intercom Active",
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

export function unlockWalkieAudioPlayback(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!sharedWalkieAudioCtx || sharedWalkieAudioCtx.state === "closed") {
        sharedWalkieAudioCtx = new AudioCtx();
      }
      if (sharedWalkieAudioCtx.state === "suspended") {
        void sharedWalkieAudioCtx.resume().catch(() => {});
      }
    }
    if (!sharedWalkieAudioElement) {
      sharedWalkieAudioElement = new Audio();
      sharedWalkieAudioElement.preload = "auto";
    }
  } catch {}
}

export async function saveWalkieSchedule(
  schoolId: string,
  schedule: SchoolWalkieSchedule
): Promise<void> {
  const cleanId = cleanRtdbSegment(schoolId);
  if (!cleanId) return;

  await ensureFirebaseAuthSession().catch(() => null);

  const nextSchedule: SchoolWalkieSchedule = stripUndefinedFields({
    enabled: schedule.enabled !== false,
    alwaysActive: Boolean(schedule.alwaysActive),
    startTime: schedule.startTime || DEFAULT_WALKIE_SCHEDULE.startTime,
    endTime: schedule.endTime || DEFAULT_WALKIE_SCHEDULE.endTime,
    activeDays:
      Array.isArray(schedule.activeDays) && schedule.activeDays.length > 0
        ? schedule.activeDays
        : DEFAULT_WALKIE_SCHEDULE.activeDays,
    updatedAt: new Date().toISOString(),
    updatedBy: schedule.updatedBy || "Admin",
  });

  try {
    localStorage.setItem(WALKIE_SCHEDULE_CACHE_KEY(schoolId), JSON.stringify(nextSchedule));
  } catch {}
  syncWalkiePrefsToAndroid(nextSchedule, getWalkieAutoPlayPref());

  const results = await Promise.allSettled([
    sbRtdbSet(`school_walkie/${cleanId}/schedule`, nextSchedule),
    db
      ? setDoc(doc(db, "schools", cleanId, "walkie_config", "schedule"), nextSchedule, {
          merge: true,
        })
      : Promise.reject(new Error("Firestore unavailable")),
    rtdb
      ? set(ref(rtdb, `school_walkie/${cleanId}/schedule`), nextSchedule).catch((e) => {
          if (isPermissionDeniedError(e)) return false;
          throw e;
        })
      : Promise.resolve(false),
  ]);

  if (activeBroadcastChannel && activeBroadcastSchoolId === cleanId) {
    void activeBroadcastChannel
      .send({
        type: "broadcast",
        event: "walkie_schedule",
        payload: nextSchedule,
      })
      .catch(() => {});
  }

  const anySuccess = results.some(
    (r) => r.status === "fulfilled" && r.value !== false
  );
  if (!anySuccess) {
    throw new Error("Walkie schedule cloud par save nahi ho saka. Internet check karein.");
  }
}

export function playWalkieChimeTone(kind: "start" | "over" = "start"): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedWalkieAudioCtx || sharedWalkieAudioCtx.state === "closed") {
      sharedWalkieAudioCtx = new AudioCtx();
    }
    const ctx = sharedWalkieAudioCtx;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
    }
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
  } catch {}
}

function base64ToAudioObjectUrl(rawB64: string, mimeType: string): string | null {
  try {
    const pureB64 = rawB64.includes(",") ? rawB64.split(",")[1] : rawB64;
    const byteChars = atob(pureB64);
    const len = byteChars.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function playWalkieMessageAudio(
  msg: WalkieMessage,
  options?: { allowAutoplayPrompt?: boolean }
): Promise<boolean> {
  const spokenText = msg.text?.trim()
    ? `${msg.senderName} kah rahe hain: ${msg.text.trim()}`
    : `${msg.senderName} ne walkie voice message bheja hai.`;

  // 1. Android Native Hardware MediaPlayer (bypasses WebView autoplay block and plays on speaker cleanly)
  const bridge = getAndroidBridge();
  if (
    msg.mode === "VOICE" &&
    msg.audioBase64 &&
    bridge &&
    typeof bridge.playNativeWalkieAudio === "function"
  ) {
    try {
      bridge.playNativeWalkieAudio(
        msg.audioBase64,
        msg.mimeType || "audio/webm",
        spokenText,
        `walkie_${msg.id}`
      );
      return true;
    } catch {}
  }

  playWalkieChimeTone("start");

  if (msg.mode === "VOICE" && msg.audioBase64) {
    const mime = msg.mimeType || "audio/webm";
    const objectUrl = base64ToAudioObjectUrl(msg.audioBase64, mime);
    const srcUrl =
      objectUrl ||
      (msg.audioBase64.startsWith("data:")
        ? msg.audioBase64
        : `data:${mime};base64,${msg.audioBase64}`);

    try {
      const audio = sharedWalkieAudioElement || new Audio();
      sharedWalkieAudioElement = audio;
      audio.pause();
      audio.src = srcUrl;
      audio.volume = 1.0;
      audio.onended = () => {
        playWalkieChimeTone("over");
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      audio.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      await audio.play();
      return true;
    } catch (err: any) {
      if (objectUrl) {
        try { URL.revokeObjectURL(objectUrl); } catch {}
      }
      const errName = String(err?.name || err?.message || "");
      const blockedByAutoplay =
        errName.includes("NotAllowedError") || errName.toLowerCase().includes("gesture");
      if (blockedByAutoplay && options?.allowAutoplayPrompt) {
        toast.message(`Walkie Audio · ${msg.senderName}`, {
          description: "Browser ne auto-play roka hai — sunne ke liye Play dabayein.",
          duration: 12000,
          action: {
            label: "Play Voice",
            onClick: () => {
              unlockWalkieAudioPlayback();
              void playWalkieMessageAudio(msg, { allowAutoplayPrompt: false });
            },
          },
        });
      }
      // Fallback to native/TTS caption if audio couldn't play automatically
      speakRawTextWithNativeOrBrowser(spokenText, `walkie_${msg.id}`, true);
      return false;
    }
  }

  return speakRawTextWithNativeOrBrowser(spokenText, `walkie_${msg.id}`, true);
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
  if (!cleanSchoolId) {
    throw new Error("School Walkie network tayyar nahi hai.");
  }

  await ensureFirebaseAuthSession().catch(() => null);

  const nowMs = Date.now();
  const id = `wk_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;
  const deviceId = getOrCreatePushDeviceId();

  // Keep payload compact for cloud & mobile playback
  const cleanB64 = params.audioBase64 ? String(params.audioBase64).trim() : "";
  if (params.mode === "VOICE" && cleanB64.length > 700_000) {
    throw new Error("Voice clip bahut lambi ho gayi (max 30s rakhein). Kripya chhota bolkar bhejein.");
  }

  const msg: WalkieMessage = stripUndefinedFields({
    id,
    schoolId: params.schoolId,
    senderId: params.senderId || deviceId || "staff_user",
    senderName: params.senderName || "Staff",
    senderRole: params.senderRole,
    senderDeviceId: deviceId,
    targetType: params.targetType,
    targetIds: Array.from(new Set(params.targetIds.map((x) => String(x).trim()).filter(Boolean))),
    targetName: params.targetName || (params.targetType === "ALL_STAFF" ? "All Staff" : "Staff"),
    mode: params.mode,
    audioBase64: cleanB64 || undefined,
    mimeType: params.mimeType || undefined,
    text: params.text?.trim() || undefined,
    durationSec: params.durationSec || undefined,
    createdAt: new Date(nowMs).toISOString(),
    createdAtMs: nowMs,
  });

  WALKIE_SEEN_IDS_SESSION.add(id);

  // 1. Instant real-time Supabase Broadcast (sub-200ms delivery to open phones)
  try {
    if (activeBroadcastChannel && activeBroadcastSchoolId === cleanSchoolId) {
      void activeBroadcastChannel
        .send({
          type: "broadcast",
          event: "walkie_msg",
          payload: msg,
        })
        .catch(() => {});
    } else if (supabase) {
      const tempCh = supabase.channel(`walkie_live_${cleanSchoolId}`);
      tempCh.subscribe((st) => {
        if (st === "SUBSCRIBED") {
          void tempCh
            .send({ type: "broadcast", event: "walkie_msg", payload: msg })
            .finally(() => {
              setTimeout(() => {
                try { void supabase.removeChannel(tempCh); } catch {}
              }, 1200);
            });
        }
      });
    }
  } catch {}

  // 2. Multi-store persistent write (Firestore + Supabase + RTDB best-effort)
  const writeResults = await Promise.allSettled([
    db
      ? setDoc(doc(db, "schools", cleanSchoolId, "walkie_messages", id), msg)
      : Promise.reject(new Error("Firestore unavailable")),
    sbRtdbSet(`school_walkie/${cleanSchoolId}/messages/${id}`, msg).then((ok) => {
      if (!ok) throw new Error("Supabase write failed");
      return true;
    }),
    rtdb
      ? set(ref(rtdb, `school_walkie/${cleanSchoolId}/messages/${id}`), msg).catch((err) => {
          if (isPermissionDeniedError(err)) return false;
          throw err;
        })
      : Promise.resolve(false),
  ]);

  const anyPersisted = writeResults.some(
    (r) => r.status === "fulfilled" && r.value !== false
  );
  if (!anyPersisted) {
    const firstErr = writeResults.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    throw new Error(
      firstErr?.reason?.message ||
        "Walkie message save nahi ho saka. Internet connection check karein."
    );
  }

  // 3. Fan out background push / VoiceGuardService wakeup so screen-off Android phones play immediately
  const pushTargets =
    params.targetType === "ALL_STAFF"
      ? Array.from(
          new Set([
            ...(params.allStaffPushIds || []),
            "STAFF_ADMIN",
            "school_admin",
            "accountant_admin",
          ])
        ).filter(Boolean)
      : msg.targetIds.filter(Boolean);

  if (pushTargets.length > 0 || params.targetType === "ALL_STAFF") {
    const isSmallClipForPush = cleanB64.length > 0 && cleanB64.length <= 160_000;
    const notifTitle = `Walkie · ${params.senderName}`;
    const notifBody =
      msg.text ||
      (msg.durationSec ? `Live Walkie Audio (${msg.durationSec}s)` : "Live Walkie Voice Message");

    void sendSchoolPushNotification({
      schoolId: params.schoolId,
      ...(params.targetType === "ALL_STAFF" ? { schoolBroadcast: true } : {}),
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
      ...(isSmallClipForPush
        ? { walkieAudioBase64: cleanB64, walkieMimeType: msg.mimeType || "audio/webm" }
        : {}),
      walkieSpeechText: msg.text
        ? `${params.senderName} walkie par bol rahe hain: ${msg.text}`
        : `${params.senderName} ne live walkie voice message bheja hai.`,
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
  const cleanUid = String(userId || "").trim();
  const myDeviceId = getOrCreatePushDeviceId();
  if (msg.senderDeviceId && myDeviceId && msg.senderDeviceId === myDeviceId) return true;
  if (cleanUid && msg.senderId === cleanUid) return true;
  if (cleanUid && Array.isArray(msg.targetIds) && msg.targetIds.includes(cleanUid)) return true;
  if (
    userRole === "ADMIN" &&
    Array.isArray(msg.targetIds) &&
    msg.targetIds.some((id) => ["STAFF_ADMIN", "school_admin"].includes(id))
  ) {
    return true;
  }
  if (
    userRole === "ACCOUNTANT" &&
    Array.isArray(msg.targetIds) &&
    msg.targetIds.some((id) => ["accountant_admin", "STAFF_ADMIN"].includes(id))
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
  const [messages, setMessages] = useState<WalkieMessage[]>(() =>
    schoolId ? getCachedWalkieMessages(schoolId) : []
  );
  const [schedule, setSchedule] = useState<SchoolWalkieSchedule>(() =>
    schoolId ? getCachedWalkieSchedule(schoolId) : DEFAULT_WALKIE_SCHEDULE
  );
  const [liveConnected, setLiveConnected] = useState(false);

  const mountedAtRef = useRef<number>(Date.now());
  const scheduleRef = useRef<SchoolWalkieSchedule>(schedule);
  scheduleRef.current = schedule;
  const onOpenRef = useRef(onOpenWalkie);
  onOpenRef.current = onOpenWalkie;
  const messageMapRef = useRef<Map<string, WalkieMessage>>(new Map());

  useEffect(() => {
    mountedAtRef.current = Date.now();
    messageMapRef.current.clear();
    if (schoolId) {
      const cached = getCachedWalkieMessages(schoolId);
      cached.forEach((m) => messageMapRef.current.set(m.id, m));
      setMessages(cached);
    } else {
      setMessages([]);
    }
  }, [schoolId]);

  useEffect(() => {
    if (!enabled || !schoolId) {
      setMessages([]);
      setLiveConnected(false);
      return;
    }
    const cleanSchoolId = cleanRtdbSegment(schoolId);
    if (!cleanSchoolId) return;

    void ensureFirebaseAuthSession().catch(() => null);
    const myDeviceId = getOrCreatePushDeviceId();

    const applySchedule = (val: any) => {
      if (!val || typeof val !== "object") return;
      const next = normalizeSchedulePayload(val);
      setSchedule(next);
      try {
        localStorage.setItem(WALKIE_SCHEDULE_CACHE_KEY(schoolId), JSON.stringify(next));
      } catch {}
      syncWalkiePrefsToAndroid(next, getWalkieAutoPlayPref());
    };

    const mergeAndDispatch = (incomingList: WalkieMessage[]) => {
      let changed = false;
      for (const m of incomingList) {
        if (!m || !m.id) continue;
        const existing = messageMapRef.current.get(m.id);
        if (!existing || (!existing.audioBase64 && m.audioBase64)) {
          messageMapRef.current.set(m.id, m);
          changed = true;
        }
      }

      const list = Array.from(messageMapRef.current.values())
        .filter((m) => isWalkieMessageForUser(m, userId || "", userRole))
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
        .slice(0, 25);

      if (changed) {
        setMessages(list);
        cacheWalkieMessages(schoolId, list);
      }

      for (const m of list) {
        if (WALKIE_SEEN_IDS_SESSION.has(m.id)) continue;
        WALKIE_SEEN_IDS_SESSION.add(m.id);

        const isFresh = (m.createdAtMs || 0) >= mountedAtRef.current - 8_000;
        const isSelf = m.senderDeviceId
          ? m.senderDeviceId === myDeviceId
          : Boolean(userId && m.senderId === userId);
        if (!isFresh || isSelf) continue;

        const hourStatus = isWithinWalkieSchoolHours(scheduleRef.current);
        if (!hourStatus.active) continue;

        const autoPlayOn = getWalkieAutoPlayPref();
        if (autoPlayOn) {
          void playWalkieMessageAudio(m, { allowAutoplayPrompt: true });
        } else {
          playWalkieChimeTone("start");
        }

        toast.message(`Walkie · ${m.senderName}`, {
          description:
            m.text ||
            (autoPlayOn
              ? "Audio walkie play ho raha hai..."
              : "Class Mode: Sunne ke liye Reply/Open dabayein"),
          action: onOpenRef.current
            ? {
                label: "Reply",
                onClick: () => onOpenRef.current?.(),
              }
            : undefined,
        });
      }
    };

    // A. Supabase Realtime Broadcast Channel (instant <200ms audio/text walkie)
    let broadcastCh: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    if (supabase) {
      try {
        broadcastCh = supabase.channel(`walkie_live_${cleanSchoolId}`, {
          config: { broadcast: { self: false } },
        });
        broadcastCh
          .on("broadcast", { event: "walkie_msg" }, ({ payload }) => {
            if (payload && (payload as WalkieMessage).id) {
              mergeAndDispatch([payload as WalkieMessage]);
            }
          })
          .on("broadcast", { event: "walkie_schedule" }, ({ payload }) => {
            if (payload) applySchedule(payload);
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              setLiveConnected(true);
              activeBroadcastChannel = broadcastCh;
              activeBroadcastSchoolId = cleanSchoolId;
            }
          });
      } catch {}
    }

    // B. Supabase kv_documents Persistent Subscriptions
    const unsubSbSchedule = sbRtdbSubscribe(`school_walkie/${cleanSchoolId}/schedule`, (val) => {
      if (val) applySchedule(val);
    });
    const unsubSbMessages = sbRtdbSubscribe(`school_walkie/${cleanSchoolId}/messages`, (raw) => {
      if (!raw || typeof raw !== "object") return;
      const arr = Object.values(raw).filter((m): m is WalkieMessage => Boolean(m && (m as any).id));
      mergeAndDispatch(arr);
    });

    // C. Firestore Persistent Subscriptions (uses schools/{schoolId}/{subCol}/{docId})
    let unsubFsSchedule: () => void = () => {};
    let unsubFsMessages: () => void = () => {};
    if (db) {
      try {
        unsubFsSchedule = onSnapshot(
          doc(db, "schools", cleanSchoolId, "walkie_config", "schedule"),
          (snap) => {
            if (snap.exists()) applySchedule(snap.data());
          },
          () => {}
        );
        const fsQ = query(
          collection(db, "schools", cleanSchoolId, "walkie_messages"),
          orderBy("createdAtMs", "desc"),
          limit(25)
        );
        unsubFsMessages = onSnapshot(
          fsQ,
          (snap) => {
            setLiveConnected(true);
            const arr = snap.docs
              .map((d) => d.data() as WalkieMessage)
              .filter((m) => Boolean(m && m.id));
            mergeAndDispatch(arr);

            // Admin cleanup for old messages (>35)
            if (userRole === "ADMIN" && snap.docs.length > 35) {
              snap.docs.slice(25).forEach((oldDoc) => {
                deleteDoc(oldDoc.ref).catch(() => {});
                void sbRtdbRemove(`school_walkie/${cleanSchoolId}/messages/${oldDoc.id}`).catch(() => {});
              });
            }
          },
          () => {}
        );
      } catch {}
    }

    // D. RTDB Best-Effort Listeners (gracefully ignores PERMISSION_DENIED if RTDB rules not deployed)
    let unsubRtdbSchedule: () => void = () => {};
    let unsubRtdbMessages: () => void = () => {};
    if (rtdb) {
      try {
        unsubRtdbSchedule = onValue(
          ref(rtdb, `school_walkie/${cleanSchoolId}/schedule`),
          (snap) => {
            if (snap.exists()) applySchedule(snap.val());
          },
          () => {}
        );
        unsubRtdbMessages = onValue(
          ref(rtdb, `school_walkie/${cleanSchoolId}/messages`),
          (snap) => {
            const raw = snap.val() as Record<string, WalkieMessage> | null;
            if (!raw || typeof raw !== "object") return;
            setLiveConnected(true);
            const arr = Object.values(raw).filter((m): m is WalkieMessage => Boolean(m && m.id));
            mergeAndDispatch(arr);
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
          },
          () => {}
        );
      } catch {}
    }

    return () => {
      if (activeBroadcastChannel === broadcastCh) {
        activeBroadcastChannel = null;
        activeBroadcastSchoolId = "";
      }
      if (broadcastCh && supabase) {
        try { void supabase.removeChannel(broadcastCh); } catch {}
      }
      unsubSbSchedule();
      unsubSbMessages();
      unsubFsSchedule();
      unsubFsMessages();
      unsubRtdbSchedule();
      unsubRtdbMessages();
    };
  }, [enabled, schoolId, userId, userRole]);

  const isWithinHours = isWithinWalkieSchoolHours(schedule).active;

  return {
    messages,
    schedule,
    isWithinHours,
    liveConnected,
  };
}
