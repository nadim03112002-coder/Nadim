import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { sbDeleteDocument, sbGetDocument, sbSetDocument } from "./supabaseDbAdapter";
import { saveNstaMessage, generateId, isStudentInClass } from "../school-firebase";
import { sendSchoolPushNotification } from "../utils/schoolPushClient";
import {
  announceIncomingVoiceCaller,
  isCallerVoiceAnnounceEnabled,
  stopIncomingVoiceCallerSpeech,
} from "../utils/schoolCallerId";
import type { NstaMessage, NstaThreadType } from "../school-types";

export type CallType = "voice" | "video";
export type CallMode = "direct" | "group";
export type CallPhase =
  | "idle"
  | "ringing_outgoing"
  | "ringing_incoming"
  | "connecting"
  | "connected"
  | "ended";

export interface CallIdentity {
  schoolId: string;
  schoolName?: string;
  userId: string;
  userName: string;
  userRole: "ADMIN" | "TEACHER" | "STUDENT";
  userPhoto?: string;
  classId?: string;
  className?: string;
  studentId?: string;
  teacherId?: string;
}

export interface CallThreadContext {
  threadType: NstaThreadType;
  classId?: string;
  className?: string;
  studentId?: string;
  studentName?: string;
  peerStudentId?: string;
  peerStudentName?: string;
  teacherId?: string;
  teacherName?: string;
}

export interface GroupCallPeer {
  peerId: string;
  userId: string;
  userName: string;
  userRole: "ADMIN" | "TEACHER" | "STUDENT";
  userPhoto?: string;
  stream: MediaStream | null;
  audioMuted: boolean;
  videoOff: boolean;
  connectionState: string;
}

export interface ActiveGroupCallInfo {
  roomKey: string;
  callId: string;
  schoolId: string;
  callType: CallType;
  roomTitle: string;
  classId?: string;
  className?: string;
  hostId: string;
  hostName: string;
  participantCount: number;
  startedAt: string;
  updatedAt: string;
}

export interface NstaCallState {
  phase: CallPhase;
  mode: CallMode;
  callType: CallType;
  callId: string;
  roomKey: string;
  isCaller: boolean;
  isHost: boolean;
  isMinimized: boolean;
  remoteName: string;
  remoteSubtitle: string;
  remoteSchoolName?: string;
  remoteRoleLabel?: string;
  remoteAvatar?: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  groupPeers: GroupCallPeer[];
  isAudioMuted: boolean;
  isVideoOff: boolean;
  remoteAudioMuted: boolean;
  remoteVideoOff: boolean;
  cameraFacing: "user" | "environment";
  connectedAtMs: number | null;
  statusNote: string;
  errorNote: string | null;
  activeGroupCalls: Record<string, ActiveGroupCallInfo>;
  threadContext: CallThreadContext | null;
  lastCallBanner?: {
    id: string;
    title: string;
    subtitle: string;
    kind: "missed" | "cancelled" | "declined" | "ended";
  } | null;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

let cachedIceServers: { servers: RTCIceServer[]; fetchedAt: number } | null = null;

async function fetchIceServers(timeoutMs = 2500): Promise<RTCIceServer[]> {
  if (cachedIceServers && Date.now() - cachedIceServers.fetchedAt < 4 * 60 * 1000) {
    return cachedIceServers.servers;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch("/api/webrtc/ice-servers", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.iceServers) && json.iceServers.length > 0) {
        cachedIceServers = { servers: json.iceServers, fetchedAt: Date.now() };
        return json.iceServers;
      }
    }
  } catch {}
  return cachedIceServers?.servers || DEFAULT_ICE_SERVERS;
}

export function primeCallAudioOnGesture() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!toneCtx || toneCtx.state === "closed") {
      toneCtx = new AudioCtx();
    }
    if (toneCtx.state === "suspended") {
      void toneCtx.resume().catch(() => {});
    }
  } catch {}
}

// ── Web Audio API Synthesized Ringtone & Dialtone (No external MP3 needed) ───
let toneCtx: AudioContext | null = null;
let toneInterval: ReturnType<typeof setInterval> | null = null;

function playTonePulse(freq1: number, freq2: number, durationMs: number, volume: number) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!toneCtx || toneCtx.state === "closed") {
      toneCtx = new AudioCtx();
    }
    if (toneCtx.state === "suspended") {
      void toneCtx.resume().catch(() => {});
    }
    const now = toneCtx.currentTime;
    const gain = toneCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    gain.connect(toneCtx.destination);

    const osc1 = toneCtx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq1, now);
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + durationMs / 1000 + 0.02);

    if (freq2 > 0) {
      const osc2 = toneCtx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(freq2, now);
      osc2.connect(gain);
      osc2.start(now);
      osc2.stop(now + durationMs / 1000 + 0.02);
    }
  } catch {}
}

let activeRingAnnouncement: {
  callId: string;
  callerName: string;
  callerRole?: string;
  schoolName?: string;
  callType: CallType;
} | null = null;

function formatCallerRoleLabel(role?: string): string {
  const up = String(role || "").trim().toUpperCase();
  if (up === "ADMIN") return "Principal / Admin";
  if (up === "TEACHER") return "Teacher";
  if (up === "STUDENT") return "Student";
  return "";
}

function startRingtoneLoop(announcement?: {
  callId: string;
  callerName: string;
  callerRole?: string;
  schoolName?: string;
  callType: CallType;
}) {
  stopCallTones();
  activeRingAnnouncement = announcement || activeRingAnnouncement;
  let tick = 0;

  const ringCycle = () => {
    tick += 1;
    const useCallerVoice = Boolean(activeRingAnnouncement && isCallerVoiceAnnounceEnabled());
    if (useCallerVoice && activeRingAnnouncement) {
      playTonePulse(523.25, 659.25, 220, 0.08);
      announceIncomingVoiceCaller({
        callerName: activeRingAnnouncement.callerName,
        callerRole: formatCallerRoleLabel(activeRingAnnouncement.callerRole),
        schoolName: activeRingAnnouncement.schoolName,
        callType: activeRingAnnouncement.callType,
        dedupeKey: `nsta_ring_${activeRingAnnouncement.callId}_${tick}`,
      });
    } else {
      playTonePulse(523.25, 659.25, 320, 0.11);
      setTimeout(() => playTonePulse(659.25, 783.99, 420, 0.11), 360);
    }
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([260, 120, 260]);
      }
    } catch {}
  };

  ringCycle();
  const intervalMs = activeRingAnnouncement && isCallerVoiceAnnounceEnabled() ? 4500 : 2400;
  toneInterval = setInterval(ringCycle, intervalMs);
}

export function refreshIncomingRingtoneMode() {
  if (state.phase === "ringing_incoming" && activeRingAnnouncement) {
    startRingtoneLoop(activeRingAnnouncement);
  }
}

function startDialtoneLoop() {
  stopCallTones();
  const ringback = () => {
    playTonePulse(440, 480, 900, 0.06);
  };
  ringback();
  toneInterval = setInterval(ringback, 3200);
}

export function stopCallTones() {
  if (toneInterval) {
    clearInterval(toneInterval);
    toneInterval = null;
  }
  activeRingAnnouncement = null;
  stopIncomingVoiceCallerSpeech();
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(0);
    }
  } catch {}
}

// ── Singleton Call State Store ───────────────────────────────────────────────
const INITIAL_STATE: NstaCallState = {
  phase: "idle",
  mode: "direct",
  callType: "voice",
  callId: "",
  roomKey: "",
  isCaller: false,
  isHost: false,
  isMinimized: false,
  remoteName: "",
  remoteSubtitle: "",
  remoteSchoolName: "",
  remoteRoleLabel: "",
  remoteAvatar: "",
  localStream: null,
  remoteStream: null,
  groupPeers: [],
  isAudioMuted: false,
  isVideoOff: false,
  remoteAudioMuted: false,
  remoteVideoOff: false,
  cameraFacing: "user",
  connectedAtMs: null,
  statusNote: "",
  errorNote: null,
  activeGroupCalls: {},
  threadContext: null,
  lastCallBanner: null,
};

let state: NstaCallState = { ...INITIAL_STATE };
const listeners = new Set<() => void>();
let lastCallBannerTimer: ReturnType<typeof setTimeout> | null = null;

function buildCallDeepLink(callId: string, ctx?: CallThreadContext | null): string {
  const schoolId = currentIdentity?.schoolId || "";
  const subTab =
    ctx?.threadType === "TEACHER_CHAT"
      ? "teacher"
      : ctx?.threadType === "STUDENT_CHAT"
      ? "friend"
      : ctx?.threadType === "SCHOOL_DESK"
      ? "school"
      : "class";
  return `/?schoolPortal=1&schoolId=${encodeURIComponent(schoolId)}&schoolTab=messenger&subTab=${subTab}${
    callId ? `&callId=${encodeURIComponent(callId)}` : ""
  }`;
}

function syncNativeNstaOverlay(override?: {
  phase?: string;
  callId?: string;
  callerName?: string;
  callerRole?: string;
  schoolName?: string;
  callType?: CallType;
  statusText?: string;
  showOverlay?: boolean;
  showOverlayOnEnd?: boolean;
}) {
  if (typeof window === "undefined") return;
  try {
    const bridge = (window as any).LifeMakerAndroid;
    if (!bridge || typeof bridge.syncNativeNstaCallState !== "function") return;
    const resolvedCallId = override?.callId ?? state.callId;
    const resolvedPhase = override?.phase ?? state.phase;
    const resolvedName = override?.callerName ?? state.remoteName;
    const resolvedRole = override?.callerRole ?? state.remoteRoleLabel ?? "";
    const resolvedSchool =
      override?.schoolName ?? state.remoteSchoolName ?? currentIdentity?.schoolName ?? "School";
    const resolvedType = override?.callType ?? state.callType;
    const resolvedStatus = override?.statusText ?? state.statusNote;
    bridge.syncNativeNstaCallState(
      JSON.stringify({
        callId: resolvedCallId,
        phase: resolvedPhase,
        callerName: resolvedName,
        callerRole: resolvedRole,
        schoolName: resolvedSchool,
        callType: resolvedType,
        statusText: resolvedStatus,
        isMinimized: Boolean(state.isMinimized),
        showOverlay: Boolean(override?.showOverlay ?? state.isMinimized),
        showOverlayOnEnd: Boolean(override?.showOverlayOnEnd),
        url: buildCallDeepLink(resolvedCallId, state.threadContext),
      })
    );
  } catch {}
}

export function dismissIncomingCallAlerts(callId?: string) {
  stopIncomingVoiceCallerSpeech();
  if (typeof window === "undefined") return;
  const cleanId = String(callId || "").trim();
  try {
    const bridge = (window as any).LifeMakerAndroid;
    if (bridge && typeof bridge.dismissNativeNstaCallAlert === "function") {
      bridge.dismissNativeNstaCallAlert(cleanId);
    }
  } catch {}
  try {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          void reg.getNotifications().then((list) => {
            list.forEach((n) => {
              const nd = (n.data || {}) as Record<string, string>;
              const urlStr = String(nd.url || "");
              const matchesId =
                (cleanId &&
                  (n.tag === `nsta-call-${cleanId}` ||
                    nd.callId === cleanId ||
                    urlStr.includes(`callId=${cleanId}`))) ||
                (!cleanId && String(nd.type || "").toUpperCase() === "CALL_INCOMING");
              if (matchesId) {
                n.close();
              }
            });
          });
        });
      });
    }
  } catch {}
}

function showTransientCallStatusBanner(banner: {
  title: string;
  subtitle: string;
  kind: "missed" | "cancelled" | "declined" | "ended";
}) {
  if (lastCallBannerTimer) {
    clearTimeout(lastCallBannerTimer);
    lastCallBannerTimer = null;
  }
  const id = `banner_${Date.now()}`;
  emitState({ lastCallBanner: { id, ...banner } });
  lastCallBannerTimer = setTimeout(() => {
    lastCallBannerTimer = null;
    if (state.lastCallBanner?.id === id) {
      emitState({ lastCallBanner: null });
    }
  }, 4500);
}

export function clearLastCallStatusBanner() {
  if (lastCallBannerTimer) {
    clearTimeout(lastCallBannerTimer);
    lastCallBannerTimer = null;
  }
  if (state.lastCallBanner) {
    emitState({ lastCallBanner: null });
  }
}

function sendDirectCallControlPush(
  controlType: "CALL_CANCELLED" | "CALL_ENDED" | "CALL_ACCEPTED",
  callId: string,
  reason: string,
  ctxSnapshot: CallThreadContext | null,
  metaSnapshot: {
    targetIds: string[];
    callerId?: string;
    callerName?: string;
    callerRole?: string;
    targetName?: string;
  } | null,
  callTypeSnapshot: CallType
) {
  if (!currentIdentity || !callId || !metaSnapshot?.targetIds?.length) return;
  const subTab =
    ctxSnapshot?.threadType === "TEACHER_CHAT"
      ? "teacher"
      : ctxSnapshot?.threadType === "STUDENT_CHAT"
      ? "friend"
      : ctxSnapshot?.threadType === "SCHOOL_DESK"
      ? "school"
      : "class";
  const targets = metaSnapshot.targetIds;
  const isStudentTarget =
    targets[0] !== "STAFF_ADMIN" &&
    (ctxSnapshot?.threadType === "STUDENT_CHAT" ||
      ((ctxSnapshot?.threadType === "TEACHER_CHAT" ||
        ctxSnapshot?.threadType === "SCHOOL_DESK") &&
        currentIdentity.userRole !== "STUDENT"));
  const schoolLabel = String(currentIdentity.schoolName || "School").trim();
  const statusLabel =
    controlType === "CALL_ACCEPTED"
      ? "Call accepted"
      : reason === "missed"
      ? "Missed Call"
      : controlType === "CALL_CANCELLED"
      ? "Call cancelled"
      : "Call ended";

  void sendSchoolPushNotification({
    schoolId: currentIdentity.schoolId,
    ...(isStudentTarget ? { studentIds: targets } : { userId: targets[0] }),
    senderId: currentIdentity.userId,
    senderName: currentIdentity.userName,
    title: statusLabel,
    body: `${currentIdentity.userName} • ${statusLabel}`,
    type: controlType,
    threadType: ctxSnapshot?.threadType,
    voiceSpeak: false,
    url: `/?schoolPortal=1&schoolId=${encodeURIComponent(currentIdentity.schoolId)}&schoolTab=messenger&subTab=${subTab}&callId=${encodeURIComponent(callId)}`,
    urgent: false,
    extraData: {
      callId,
      reason,
      callType: callTypeSnapshot,
      callerName: currentIdentity.userName,
      callerRole: formatCallerRoleLabel(currentIdentity.userRole),
      schoolName: schoolLabel,
    },
  }).catch(() => {});
}

function emitState(patch: Partial<NstaCallState>) {
  const prevPhase = state.phase;
  const prevMinimized = state.isMinimized;
  state = { ...state, ...patch };
  if (
    state.phase !== "idle" &&
    (state.phase !== prevPhase || state.isMinimized !== prevMinimized)
  ) {
    syncNativeNstaOverlay();
  }
  listeners.forEach((l) => {
    try {
      l();
    } catch {}
  });
}

export function getNstaCallStateSnapshot(): NstaCallState {
  return state;
}

export function subscribeNstaCallState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNstaCallState(): NstaCallState {
  return useSyncExternalStore(
    subscribeNstaCallState,
    getNstaCallStateSnapshot,
    getNstaCallStateSnapshot
  );
}

// Singleton Modal Host Lock so multiple portals never double-render NstaCallModal
let activeHostOwnerId: string | null = null;
const hostOwnerListeners = new Set<() => void>();

export function registerCallModalHost(hostId: string): () => void {
  if (!activeHostOwnerId) {
    activeHostOwnerId = hostId;
    hostOwnerListeners.forEach((fn) => fn());
  }
  return () => {
    if (activeHostOwnerId === hostId) {
      activeHostOwnerId = null;
      hostOwnerListeners.forEach((fn) => fn());
    }
  };
}

export function useIsPrimaryCallModalHost(hostId: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      hostOwnerListeners.add(cb);
      return () => hostOwnerListeners.delete(cb);
    },
    () => activeHostOwnerId === hostId,
    () => false
  );
}

// ── Internal Runtime Refs ────────────────────────────────────────────────────
let currentIdentity: CallIdentity | null = null;
let mySelfIds = new Set<string>();
let inboxChannel: RealtimeChannel | null = null;
let inboxSchoolId = "";

let directPc: RTCPeerConnection | null = null;
let directChannel: RealtimeChannel | null = null;
let directPendingIce: RTCIceCandidateInit[] = [];
let directInviteLoop: ReturnType<typeof setInterval> | null = null;
let directCalleeReadyLoop: ReturnType<typeof setInterval> | null = null;
let directAnswerRetryLoop: ReturnType<typeof setInterval> | null = null;
let directRingTimeout: ReturnType<typeof setTimeout> | null = null;
let acceptInFlightCallId: string | null = null;
let incomingOfferSnapshot: { sdp: RTCSessionDescriptionInit; callerPeerId?: string } | null = null;
let currentDirectMeta: {
  targetIds: string[];
  targetName?: string;
  targetAvatar?: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  callerAvatar?: string;
} | null = null;

// Group Call Refs
const myGroupPeerId = `peer_${Math.random().toString(36).slice(2, 10)}`;
let groupChannel: RealtimeChannel | null = null;
const groupPcs = new Map<string, RTCPeerConnection>();
const groupPendingIce = new Map<string, RTCIceCandidateInit[]>();
let groupHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let groupMaxParticipants = 1;
let groupInfoRef: ActiveGroupCallInfo | null = null;

function buildSelfIdSet(id: CallIdentity): Set<string> {
  const out = new Set<string>();
  const add = (val?: string) => {
    const clean = String(val || "").trim();
    if (clean) out.add(clean);
  };
  add(id.userId);
  add(id.studentId);
  add(id.teacherId);
  if (id.userRole === "ADMIN") {
    add("STAFF_ADMIN");
    add("school_admin");
    add("accountant_admin");
  }
  return out;
}

function stopMediaStream(stream: MediaStream | null | undefined) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
  } catch {}
}

async function acquireUserMedia(
  callType: CallType,
  facing: "user" | "environment" = "user"
): Promise<{ stream: MediaStream; videoFallback: boolean }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Aapka browser/device live voice/video call support nahi karta.");
  }

  if (callType === "voice") {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    return { stream, videoFallback: false };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
      },
    });
    return { stream, videoFallback: false };
  } catch {
    try {
      const basicVideo = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      return { stream: basicVideo, videoFallback: false };
    } catch {
      // Fallback to audio-only so call still succeeds if camera hardware is busy/unavailable
      const audioOnly = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      return { stream: audioOnly, videoFallback: true };
    }
  }
}

function formatCallDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

async function logCallHistoryMessage(params: {
  status: "completed" | "missed" | "rejected" | "ended";
  durationSec?: number;
  participants?: number;
  callType: CallType;
  mode: CallMode;
  callId: string;
  threadContext: CallThreadContext | null;
  targetId?: string;
  targetName?: string;
  targetAvatar?: string;
}) {
  if (!currentIdentity || !params.threadContext) return;
  const ctx = params.threadContext;
  const labelType = params.mode === "group" ? "Class Group Call" : params.callType === "video" ? "Video Call" : "Voice Call";
  const statusText =
    params.status === "completed" && (params.durationSec || 0) > 0
      ? `${labelType} • ${formatCallDuration(params.durationSec || 0)}`
      : params.status === "rejected"
      ? `${labelType} • Declined`
      : params.status === "missed"
      ? `${labelType} • Missed Call`
      : `${labelType} • Ended`;

  const resolvedTargetName =
    params.targetName ||
    (ctx.threadType === "CLASS_GROUP"
      ? ctx.className || "Class Group"
      : ctx.threadType === "STUDENT_CHAT"
      ? ctx.peerStudentName || ctx.studentName || "Classmate"
      : ctx.threadType === "TEACHER_CHAT"
      ? currentIdentity.userRole === "TEACHER"
        ? ctx.studentName || "Student"
        : ctx.teacherName || "Teacher"
      : currentIdentity.userRole === "ADMIN"
      ? ctx.studentName || "Student"
      : currentIdentity.schoolName || "School Official Desk");

  const msg: NstaMessage = {
    id: generateId("msg"),
    schoolId: currentIdentity.schoolId || "default",
    threadType: ctx.threadType,
    classId: ctx.threadType === "CLASS_GROUP" || ctx.threadType === "STUDENT_CHAT" ? ctx.classId : undefined,
    className: ctx.threadType === "CLASS_GROUP" || ctx.threadType === "STUDENT_CHAT" ? ctx.className : undefined,
    studentId: ctx.threadType !== "CLASS_GROUP" ? ctx.studentId : undefined,
    studentName: ctx.threadType !== "CLASS_GROUP" ? ctx.studentName : undefined,
    peerStudentId: ctx.threadType === "STUDENT_CHAT" ? (params.targetId || ctx.peerStudentId) : undefined,
    peerStudentName: ctx.threadType === "STUDENT_CHAT" ? (params.targetName || ctx.peerStudentName) : undefined,
    teacherId: ctx.threadType === "TEACHER_CHAT" ? ctx.teacherId : undefined,
    teacherName: ctx.threadType === "TEACHER_CHAT" ? ctx.teacherName : undefined,
    senderId: currentIdentity.userId,
    senderName: currentIdentity.userName,
    senderRole: currentIdentity.userRole,
    senderPhoto: currentIdentity.userPhoto || undefined,
    text: statusText,
    attachmentType: "CALL",
    callData: {
      callId: params.callId,
      callType: params.callType,
      mode: params.mode,
      status: params.status,
      durationSec: params.durationSec || 0,
      participants: params.participants,
      startedByName: currentIdentity.userName,
      targetId:
        params.targetId ||
        (ctx.threadType === "STUDENT_CHAT"
          ? ctx.peerStudentId
          : ctx.threadType === "TEACHER_CHAT"
          ? currentIdentity.userRole === "TEACHER"
            ? ctx.studentId
            : ctx.teacherId
          : ctx.studentId || ctx.classId),
      targetName: resolvedTargetName,
      targetAvatar: params.targetAvatar || undefined,
    },
    createdAt: new Date().toISOString(),
    status: "sent",
  };

  try {
    await saveNstaMessage(msg);
  } catch {}
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nsta-call-history-updated"));
    }
  } catch {}
}

export interface StoredCallSessionRecord {
  callId: string;
  mode: CallMode;
  callType: CallType;
  status: string;
  schoolId: string;
  callerId: string;
  callerName: string;
  callerRole?: string;
  callerAvatar?: string;
  targetIds?: string[];
  targetName?: string;
  targetAvatar?: string;
  roomTitle?: string;
  classId?: string;
  className?: string;
  durationSec?: number;
  participants?: number;
  threadContext?: CallThreadContext | null;
  createdAt?: string;
  endedAt?: string;
}

export async function fetchRecentCallSessions(schoolId: string): Promise<StoredCallSessionRecord[]> {
  if (!supabase || !schoolId) return [];
  try {
    const { data, error } = await supabase
      .from("kv_documents")
      .select("doc_id, data, updated_at")
      .eq("collection_path", "call_sessions")
      .eq("school_id", schoolId)
      .order("updated_at", { ascending: false })
      .limit(120);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((row: any) => row?.data as StoredCallSessionRecord | undefined)
      .filter((item): item is StoredCallSessionRecord => Boolean(item && item.callId));
  } catch {
    return [];
  }
}

// ── Active Group Call Discovery Sync ─────────────────────────────────────────
async function refreshActiveGroupCallsFromDb(schoolId: string) {
  if (!supabase || !schoolId) return;
  try {
    const { data, error } = await supabase
      .from("kv_documents")
      .select("doc_id, data")
      .eq("collection_path", "nsta_active_group_calls")
      .eq("school_id", schoolId);
    if (error || !Array.isArray(data)) return;
    const now = Date.now();
    const nextMap: Record<string, ActiveGroupCallInfo> = {};
    for (const row of data) {
      const info = row?.data as ActiveGroupCallInfo | undefined;
      if (!info?.roomKey) continue;
      const updatedMs = Date.parse(info.updatedAt || info.startedAt || "");
      if (!Number.isNaN(updatedMs) && now - updatedMs < 75_000) {
        nextMap[info.roomKey] = info;
      }
    }
    emitState({ activeGroupCalls: nextMap });
  } catch {}
}

function doesGroupCallApplyToMe(info: ActiveGroupCallInfo, id: CallIdentity | null): boolean {
  if (!id) return false;
  if (id.userRole === "ADMIN" || id.userRole === "TEACHER") return true;
  if (!info.classId && !info.className) return true;
  return isStudentInClass(
    { classId: id.classId, className: id.className } as any,
    info.classId,
    info.className
  );
}

// ── Identity Registration & Global Incoming Call Inbox ──────────────────────
export function registerCallIdentity(identity: CallIdentity | null) {
  if (!identity || !identity.schoolId || !identity.userId) {
    currentIdentity = null;
    mySelfIds = new Set();
    return;
  }

  currentIdentity = identity;
  mySelfIds = buildSelfIdSet(identity);

  if (!supabase) return;
  if (inboxSchoolId === identity.schoolId && inboxChannel) {
    return;
  }

  if (inboxChannel) {
    try {
      void supabase.removeChannel(inboxChannel);
    } catch {}
    inboxChannel = null;
  }

  inboxSchoolId = identity.schoolId;
  void refreshActiveGroupCallsFromDb(identity.schoolId);

  const ch = supabase.channel(`nsta_call_inbox_${identity.schoolId}`, {
    config: { broadcast: { self: false } },
  });

  ch.on("broadcast", { event: "direct_invite" }, ({ payload }) => {
    if (!payload?.callId || !Array.isArray(payload.targetIds)) return;
    if (mySelfIds.has(String(payload.callerId || ""))) return;

    const isForMe = payload.targetIds.some((tid: string) => mySelfIds.has(String(tid).trim()));
    if (!isForMe) return;

    // Duplicate invite ping for the exact same ringing call -> ignore
    if (state.callId === payload.callId) return;

    // Already busy in another call
    if (state.phase !== "idle") {
      const busyCh = supabase?.channel(`nsta_webrtc_call_${payload.callId}`, {
        config: { broadcast: { self: false } },
      });
      busyCh?.subscribe((st) => {
        if (st === "SUBSCRIBED") {
          void busyCh.send({
            type: "broadcast",
            event: "call_busy",
            payload: { callId: payload.callId, byUserId: currentIdentity?.userId },
          });
          setTimeout(() => {
            try {
              void supabase?.removeChannel(busyCh);
            } catch {}
          }, 800);
        }
      });
      return;
    }

    currentDirectMeta = {
      targetIds: payload.targetIds,
      callerId: payload.callerId,
      callerName: payload.callerName || "Caller",
      callerRole: payload.callerRole || "STAFF",
      callerAvatar: payload.callerAvatar || "",
    };
    incomingOfferSnapshot = payload.offer ? { sdp: payload.offer } : null;

    const resolvedSchoolName = String(
      payload.schoolName || currentIdentity?.schoolName || "School"
    ).trim();
    const resolvedCallType: CallType = payload.callType === "video" ? "video" : "voice";
    const resolvedRoleLabel = formatCallerRoleLabel(payload.callerRole);

    emitState({
      phase: "ringing_incoming",
      mode: "direct",
      callType: resolvedCallType,
      callId: payload.callId,
      roomKey: "",
      isCaller: false,
      isHost: false,
      isMinimized: false,
      remoteName: payload.callerName || "Incoming Call",
      remoteSubtitle:
        payload.subtitle ||
        (resolvedCallType === "video" ? "Incoming Video Call" : "Incoming Voice Call"),
      remoteSchoolName: resolvedSchoolName,
      remoteRoleLabel: resolvedRoleLabel,
      remoteAvatar: payload.callerAvatar || "",
      statusNote: resolvedCallType === "video" ? "Incoming Video Call..." : "Incoming Voice Call...",
      errorNote: null,
      threadContext: payload.threadContext || null,
    });
    startRingtoneLoop({
      callId: payload.callId,
      callerName: payload.callerName || "School Staff",
      callerRole: payload.callerRole,
      schoolName: resolvedSchoolName,
      callType: resolvedCallType,
    });
    // Pre-warm TURN/STUN config while ringing so 1-tap Accept has zero ICE delay
    void fetchIceServers(1500).catch(() => {});
  });

  ch.on("broadcast", { event: "direct_cancel" }, ({ payload }) => {
    if (!payload?.callId) return;
    if (state.callId === payload.callId && state.phase === "ringing_incoming") {
      const cName = state.remoteName || "Caller";
      const cSchool = state.remoteSchoolName || "School";
      const cId = state.callId;
      const cType = state.callType;
      stopCallTones();
      dismissIncomingCallAlerts(cId);
      syncNativeNstaOverlay({
        callId: cId,
        phase: "cancelled",
        callerName: cName,
        schoolName: cSchool,
        callType: cType,
        statusText: `${cName} ne call cancel kar di`,
      });
      cleanupDirectCallResources();
      emitState({ ...INITIAL_STATE, activeGroupCalls: state.activeGroupCalls });
      showTransientCallStatusBanner({
        kind: "cancelled",
        title: `${cName} (${cSchool})`,
        subtitle: "Caller ne call cancel kar di",
      });
    }
  });

  ch.on("broadcast", { event: "group_call_update" }, ({ payload }) => {
    const info = payload?.info as ActiveGroupCallInfo | undefined;
    if (!info?.roomKey) return;
    if (payload.ended) {
      const next = { ...state.activeGroupCalls };
      delete next[info.roomKey];
      emitState({ activeGroupCalls: next });
    } else if (doesGroupCallApplyToMe(info, currentIdentity)) {
      emitState({
        activeGroupCalls: {
          ...state.activeGroupCalls,
          [info.roomKey]: info,
        },
      });
    }
  });

  ch.subscribe();
  inboxChannel = ch;
}

// Check URL deep link or session doc if opened via Push Notification (?callId=...&callAction=accept)
export async function checkAndJoinCallFromNotification(
  callId: string,
  options?: { autoAccept?: boolean }
) {
  if (!callId || !currentIdentity) return;
  if (state.phase === "ringing_incoming" && state.callId === callId) {
    if (options?.autoAccept) {
      void acceptIncomingCall();
    }
    return;
  }
  if (state.phase !== "idle" && state.callId === callId) return;

  const doc = await sbGetDocument<any>(`call_sessions/${callId}`);
  if (!doc) return;

  if (doc.mode === "group" && doc.status === "active" && doc.groupInfo) {
    const info = doc.groupInfo as ActiveGroupCallInfo;
    emitState({
      activeGroupCalls: {
        ...state.activeGroupCalls,
        [info.roomKey]: info,
      },
    });
    return;
  }

  if (doc.mode === "direct" && doc.status === "ringing") {
    const ageMs = Date.now() - Date.parse(doc.createdAt || "");
    if (!Number.isNaN(ageMs) && ageMs > 55_000) return;

    currentDirectMeta = {
      targetIds: doc.targetIds || [],
      callerId: doc.callerId,
      callerName: doc.callerName || "Caller",
      callerRole: doc.callerRole || "",
      callerAvatar: doc.callerAvatar || "",
    };

    const resolvedSchoolName = String(
      doc.schoolName || currentIdentity?.schoolName || "School"
    ).trim();
    const resolvedCallType: CallType = doc.callType === "video" ? "video" : "voice";

    emitState({
      phase: "ringing_incoming",
      mode: "direct",
      callType: resolvedCallType,
      callId,
      roomKey: "",
      isCaller: false,
      isHost: false,
      isMinimized: false,
      remoteName: doc.callerName || "Incoming Call",
      remoteSubtitle: doc.subtitle || "NSTA Messenger Call",
      remoteSchoolName: resolvedSchoolName,
      remoteRoleLabel: formatCallerRoleLabel(doc.callerRole),
      remoteAvatar: doc.callerAvatar || "",
      statusNote: resolvedCallType === "video" ? "Incoming Video Call..." : "Incoming Voice Call...",
      errorNote: null,
      threadContext: doc.threadContext || null,
    });
    startRingtoneLoop({
      callId,
      callerName: doc.callerName || "School Staff",
      callerRole: doc.callerRole,
      schoolName: resolvedSchoolName,
      callType: resolvedCallType,
    });

    if (options?.autoAccept) {
      void acceptIncomingCall();
    }
  }
}

// ── 1-on-1 Direct Call Cleanup ───────────────────────────────────────────────
function cleanupDirectCallResources() {
  stopCallTones();
  if (directInviteLoop) {
    clearInterval(directInviteLoop);
    directInviteLoop = null;
  }
  if (directCalleeReadyLoop) {
    clearInterval(directCalleeReadyLoop);
    directCalleeReadyLoop = null;
  }
  if (directAnswerRetryLoop) {
    clearInterval(directAnswerRetryLoop);
    directAnswerRetryLoop = null;
  }
  if (directRingTimeout) {
    clearTimeout(directRingTimeout);
    directRingTimeout = null;
  }
  acceptInFlightCallId = null;
  if (directPc) {
    try {
      directPc.ontrack = null;
      directPc.onicecandidate = null;
      directPc.onconnectionstatechange = null;
      directPc.oniceconnectionstatechange = null;
      directPc.close();
    } catch {}
    directPc = null;
  }
  if (directChannel && supabase) {
    try {
      void supabase.removeChannel(directChannel);
    } catch {}
    directChannel = null;
  }
  directPendingIce = [];
  incomingOfferSnapshot = null;
  stopMediaStream(state.localStream);
  stopMediaStream(state.remoteStream);
}

function attachDirectSignalingHandlers(
  ch: RealtimeChannel,
  pc: RTCPeerConnection,
  callId: string,
  isCaller: boolean
) {
  ch.on("broadcast", { event: "callee_ready" }, async () => {
    if (!isCaller || !directPc) return;
    if (directInviteLoop) {
      clearInterval(directInviteLoop);
      directInviteLoop = null;
    }
    if (directRingTimeout) {
      clearTimeout(directRingTimeout);
      directRingTimeout = null;
    }
    stopCallTones();
    if (directPc.signalingState === "have-local-offer" && directPc.localDescription) {
      void ch.send({
        type: "broadcast",
        event: "offer",
        payload: { callId, sdp: directPc.localDescription },
      });
      return;
    }
    if (directPc.remoteDescription) {
      return;
    }
    try {
      emitState({ phase: "connecting", statusNote: "Connecting media..." });
      const offer = await directPc.createOffer();
      await directPc.setLocalDescription(offer);
      void ch.send({
        type: "broadcast",
        event: "offer",
        payload: { callId, sdp: offer },
      });
    } catch (err: any) {
      emitState({ errorNote: err?.message || "Connection setup fail hua." });
    }
  });

  ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
    if (isCaller || !directPc || !payload?.sdp) return;
    if (directCalleeReadyLoop) {
      clearInterval(directCalleeReadyLoop);
      directCalleeReadyLoop = null;
    }
    try {
      // If we already created an answer for this call, re-broadcast the answer
      if (directPc.remoteDescription && directPc.localDescription?.type === "answer") {
        void ch.send({
          type: "broadcast",
          event: "answer",
          payload: { callId, sdp: directPc.localDescription },
        });
        return;
      }
      if (directPc.signalingState !== "stable") {
        return;
      }
      await directPc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      for (const ice of directPendingIce) {
        await directPc.addIceCandidate(new RTCIceCandidate(ice)).catch(() => {});
      }
      directPendingIce = [];
      const answer = await directPc.createAnswer();
      await directPc.setLocalDescription(answer);
      const sendAnswer = () => {
        if (state.callId !== callId || !directChannel) return;
        void ch.send({
          type: "broadcast",
          event: "answer",
          payload: { callId, sdp: answer },
        });
      };
      sendAnswer();
      if (directAnswerRetryLoop) clearInterval(directAnswerRetryLoop);
      let retries = 0;
      directAnswerRetryLoop = setInterval(() => {
        retries++;
        if (retries > 4 || state.phase === "connected" || state.callId !== callId) {
          if (directAnswerRetryLoop) {
            clearInterval(directAnswerRetryLoop);
            directAnswerRetryLoop = null;
          }
          return;
        }
        sendAnswer();
      }, 1100);
      emitState({ phase: "connecting", statusNote: "Connecting..." });
    } catch (err: any) {
      emitState({ errorNote: err?.message || "Offer accept karne me samasya aayi." });
    }
  });

  ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
    if (!isCaller || !directPc || !payload?.sdp) return;
    try {
      if (directPc.signalingState === "have-local-offer") {
        await directPc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        for (const ice of directPendingIce) {
          await directPc.addIceCandidate(new RTCIceCandidate(ice)).catch(() => {});
        }
        directPendingIce = [];
      }
    } catch {}
  });

  ch.on("broadcast", { event: "ice_candidate" }, async ({ payload }) => {
    if (!directPc || !payload?.candidate) return;
    try {
      if (directPc.remoteDescription) {
        await directPc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        directPendingIce.push(payload.candidate);
      }
    } catch {}
  });

  ch.on("broadcast", { event: "media_state" }, ({ payload }) => {
    if (!payload) return;
    emitState({
      ...(typeof payload.audioMuted === "boolean" ? { remoteAudioMuted: payload.audioMuted } : {}),
      ...(typeof payload.videoOff === "boolean" ? { remoteVideoOff: payload.videoOff } : {}),
    });
  });

  ch.on("broadcast", { event: "call_reject" }, () => {
    if (state.callId !== callId) return;
    const ctx = state.threadContext;
    const cType = state.callType;
    const shouldLog = state.isCaller;
    const cName = state.remoteName || "Receiver";
    const cSchool = state.remoteSchoolName || "School";
    const metaSnap = currentDirectMeta;
    dismissIncomingCallAlerts(callId);
    syncNativeNstaOverlay({
      callId,
      phase: "rejected",
      callerName: cName,
      schoolName: cSchool,
      callType: cType,
      statusText: `${cName} ne call decline ki`,
    });
    cleanupDirectCallResources();
    void sbSetDocument(`call_sessions/${callId}`, { status: "rejected", endedAt: new Date().toISOString() }, true);
    if (shouldLog) {
      void logCallHistoryMessage({
        status: "rejected",
        callType: cType,
        mode: "direct",
        callId,
        threadContext: ctx,
        targetId: metaSnap?.targetIds?.[0],
        targetName: metaSnap?.targetName,
        targetAvatar: metaSnap?.targetAvatar,
      });
    }
    emitState({
      ...INITIAL_STATE,
      activeGroupCalls: state.activeGroupCalls,
      statusNote: "Call declined",
    });
    showTransientCallStatusBanner({
      kind: "declined",
      title: `${cName} (${cSchool})`,
      subtitle: "Call decline ki gayi",
    });
  });

  ch.on("broadcast", { event: "call_busy" }, () => {
    if (state.callId !== callId) return;
    const ctx = state.threadContext;
    const cType = state.callType;
    const shouldLog = state.isCaller;
    const cName = state.remoteName || "Receiver";
    const cSchool = state.remoteSchoolName || "School";
    const metaSnap = currentDirectMeta;
    dismissIncomingCallAlerts(callId);
    syncNativeNstaOverlay({
      callId,
      phase: "rejected",
      callerName: cName,
      schoolName: cSchool,
      callType: cType,
      statusText: "User doosri call par vyast hain",
    });
    cleanupDirectCallResources();
    void sbSetDocument(`call_sessions/${callId}`, { status: "missed", endedAt: new Date().toISOString() }, true);
    if (shouldLog) {
      void logCallHistoryMessage({
        status: "missed",
        callType: cType,
        mode: "direct",
        callId,
        threadContext: ctx,
        targetId: metaSnap?.targetIds?.[0],
        targetName: metaSnap?.targetName,
        targetAvatar: metaSnap?.targetAvatar,
      });
    }
    emitState({
      ...INITIAL_STATE,
      activeGroupCalls: state.activeGroupCalls,
      errorNote: "User doosri call par vyast hain (User busy).",
    });
    showTransientCallStatusBanner({
      kind: "missed",
      title: `${cName} (${cSchool})`,
      subtitle: "User doosri call par vyast hain (Busy)",
    });
  });

  ch.on("broadcast", { event: "call_hangup" }, () => {
    if (state.callId !== callId) return;
    const dur = state.connectedAtMs ? Math.max(1, Math.round((Date.now() - state.connectedAtMs) / 1000)) : 0;
    const wasConnected = state.phase === "connected" || dur > 0;
    const shouldLog = state.isCaller && wasConnected;
    const ctx = state.threadContext;
    const cType = state.callType;
    const cName = state.remoteName || "Caller";
    const cSchool = state.remoteSchoolName || "School";
    const metaSnap = currentDirectMeta;
    dismissIncomingCallAlerts(callId);
    syncNativeNstaOverlay({
      callId,
      phase: wasConnected ? "ended" : "cancelled",
      callerName: cName,
      schoolName: cSchool,
      callType: cType,
      statusText: wasConnected ? `Call Ended (${dur}s)` : "Call Cancelled",
    });
    cleanupDirectCallResources();
    void sbSetDocument(`call_sessions/${callId}`, { status: "ended", durationSec: dur, endedAt: new Date().toISOString() }, true);
    if (shouldLog) {
      void logCallHistoryMessage({
        status: "completed",
        durationSec: dur,
        callType: cType,
        mode: "direct",
        callId,
        threadContext: ctx,
        targetId: metaSnap?.targetIds?.[0],
        targetName: metaSnap?.targetName,
        targetAvatar: metaSnap?.targetAvatar,
      });
    }
    emitState({ ...INITIAL_STATE, activeGroupCalls: state.activeGroupCalls });
    showTransientCallStatusBanner({
      kind: wasConnected ? "ended" : "cancelled",
      title: `${cName} (${cSchool})`,
      subtitle: wasConnected ? `NSTA Call samapt (${dur}s)` : "Call cancel ki gayi",
    });
  });

  // WebRTC PeerConnection lifecycle hooks
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      void ch.send({
        type: "broadcast",
        event: "ice_candidate",
        payload: { callId, candidate: e.candidate.toJSON() },
      });
    }
  };

  const remoteMedia = new MediaStream();
  emitState({ remoteStream: remoteMedia });

  pc.ontrack = (ev) => {
    if (ev.streams && ev.streams[0]) {
      ev.streams[0].getTracks().forEach((t) => {
        if (!remoteMedia.getTracks().some((rt) => rt.id === t.id)) {
          remoteMedia.addTrack(t);
        }
      });
    } else if (ev.track) {
      if (!remoteMedia.getTracks().some((rt) => rt.id === ev.track.id)) {
        remoteMedia.addTrack(ev.track);
      }
    }
    emitState({
      remoteStream: remoteMedia,
      phase: "connected",
      connectedAtMs: state.connectedAtMs || Date.now(),
      statusNote: "Connected",
      errorNote: null,
    });
  };

  pc.onconnectionstatechange = () => {
    const cs = pc.connectionState;
    if (cs === "connected") {
      if (directAnswerRetryLoop) {
        clearInterval(directAnswerRetryLoop);
        directAnswerRetryLoop = null;
      }
      if (directCalleeReadyLoop) {
        clearInterval(directCalleeReadyLoop);
        directCalleeReadyLoop = null;
      }
      emitState({
        phase: "connected",
        connectedAtMs: state.connectedAtMs || Date.now(),
        statusNote: "Connected",
        errorNote: null,
      });
    } else if (cs === "failed") {
      emitState({
        errorNote: "Network connection weak hai (ICE Failed). Wi-Fi ya TURN server check karein.",
      });
    } else if (cs === "disconnected") {
      emitState({ statusNote: "Reconnecting..." });
    }
  };

  pc.oniceconnectionstatechange = () => {
    const ics = pc.iceConnectionState;
    if ((ics === "connected" || ics === "completed") && state.phase !== "connected") {
      emitState({
        phase: "connected",
        connectedAtMs: state.connectedAtMs || Date.now(),
        statusNote: "Connected",
        errorNote: null,
      });
    }
  };
}

// ── Start 1-on-1 Direct Call ─────────────────────────────────────────────────
export async function startDirectCall(params: {
  callType: CallType;
  targetIds: string[];
  targetName: string;
  targetSubtitle?: string;
  targetAvatar?: string;
  threadContext: CallThreadContext;
}) {
  if (!currentIdentity) {
    throw new Error("Call karne ke liye user login active hona chahiye.");
  }
  if (!supabase) {
    throw new Error("Realtime signaling server uplabdh nahi hai.");
  }
  if (state.phase !== "idle") {
    throw new Error("Pehle chal rahi call ko end karein.");
  }

  const callId = `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const { stream, videoFallback } = await acquireUserMedia(params.callType, "user");
  const effectiveCallType: CallType = videoFallback ? "voice" : params.callType;

  const iceServers = await fetchIceServers();
  const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 });
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  directPc = pc;

  const ch = supabase.channel(`nsta_webrtc_call_${callId}`, {
    config: { broadcast: { self: false } },
  });
  directChannel = ch;
  attachDirectSignalingHandlers(ch, pc, callId, true);

  currentDirectMeta = {
    targetIds: params.targetIds.filter(Boolean),
    targetName: params.targetName,
    targetAvatar: params.targetAvatar || "",
    callerId: currentIdentity.userId,
    callerName: currentIdentity.userName,
    callerRole: currentIdentity.userRole,
    callerAvatar: currentIdentity.userPhoto,
  };

  emitState({
    phase: "ringing_outgoing",
    mode: "direct",
    callType: effectiveCallType,
    callId,
    roomKey: "",
    isCaller: true,
    isHost: true,
    isMinimized: false,
    remoteName: params.targetName,
    remoteSubtitle: params.targetSubtitle || (effectiveCallType === "video" ? "Video Call" : "Voice Call"),
    remoteAvatar: params.targetAvatar || "",
    localStream: stream,
    remoteStream: null,
    isAudioMuted: false,
    isVideoOff: effectiveCallType === "voice",
    remoteAudioMuted: false,
    remoteVideoOff: effectiveCallType === "voice",
    cameraFacing: "user",
    connectedAtMs: null,
    statusNote: "Ringing...",
    errorNote: videoFallback ? "Camera access nahi mila, Voice Call par switch kiya gaya." : null,
    threadContext: params.threadContext,
  });

  startDialtoneLoop();
  await ch.subscribe();

  const subtitle = `${currentIdentity.userName} (${
    currentIdentity.userRole === "ADMIN" ? "Principal/Admin" : currentIdentity.userRole === "TEACHER" ? "Teacher" : "Student"
  })`;

  await sbSetDocument(
    `call_sessions/${callId}`,
    {
      callId,
      mode: "direct",
      callType: effectiveCallType,
      status: "ringing",
      schoolId: currentIdentity.schoolId,
      schoolName: currentIdentity.schoolName || "",
      callerId: currentIdentity.userId,
      callerName: currentIdentity.userName,
      callerRole: currentIdentity.userRole,
      callerAvatar: currentIdentity.userPhoto || "",
      subtitle,
      targetIds: currentDirectMeta.targetIds,
      targetName: params.targetName,
      targetAvatar: params.targetAvatar || "",
      threadContext: params.threadContext,
      createdAt: new Date().toISOString(),
    },
    false
  );

  const sendInvitePing = () => {
    if (!inboxChannel || state.callId !== callId || state.phase !== "ringing_outgoing") return;
    void inboxChannel.send({
      type: "broadcast",
      event: "direct_invite",
      payload: {
        callId,
        callType: effectiveCallType,
        schoolName: currentIdentity?.schoolName || "",
        callerId: currentIdentity?.userId,
        callerName: currentIdentity?.userName,
        callerRole: currentIdentity?.userRole,
        callerAvatar: currentIdentity?.userPhoto || "",
        subtitle,
        targetIds: currentDirectMeta?.targetIds || [],
        threadContext: params.threadContext,
      },
    });
  };

  sendInvitePing();
  directInviteLoop = setInterval(sendInvitePing, 2800);

  // Also wake background/mobile devices via FCM + Web Push
  const subTab =
    params.threadContext.threadType === "TEACHER_CHAT"
      ? "teacher"
      : params.threadContext.threadType === "STUDENT_CHAT"
      ? "friend"
      : params.threadContext.threadType === "SCHOOL_DESK"
      ? "school"
      : "class";

  const pushTargets = currentDirectMeta.targetIds;
  const isStudentTarget =
    pushTargets[0] !== "STAFF_ADMIN" &&
    (params.threadContext.threadType === "STUDENT_CHAT" ||
      ((params.threadContext.threadType === "TEACHER_CHAT" ||
        params.threadContext.threadType === "SCHOOL_DESK") &&
        currentIdentity.userRole !== "STUDENT"));

  const callerSchoolLabel = String(currentIdentity.schoolName || "School").trim();
  const callerRoleLabel = formatCallerRoleLabel(currentIdentity.userRole);
  void sendSchoolPushNotification({
    schoolId: currentIdentity.schoolId,
    ...(isStudentTarget ? { studentIds: pushTargets } : { userId: pushTargets[0] }),
    senderId: currentIdentity.userId,
    senderName: currentIdentity.userName,
    title: `${effectiveCallType === "video" ? "📹 Video Call" : "📞 Voice Call"} • ${callerSchoolLabel}`,
    body: `${callerSchoolLabel} se ${currentIdentity.userName}${callerRoleLabel ? ` (${callerRoleLabel})` : ""} aapko ${effectiveCallType === "video" ? "Video" : "Voice"} Call kar rahe hain — uthane ke liye tap karein.`,
    type: "CALL_INCOMING",
    threadType: params.threadContext.threadType,
    voiceSpeak: true,
    icon: currentIdentity.userPhoto || undefined,
    senderPhoto: currentIdentity.userPhoto || undefined,
    url: `/?schoolPortal=1&schoolId=${encodeURIComponent(currentIdentity.schoolId)}&schoolTab=messenger&subTab=${subTab}&callId=${encodeURIComponent(callId)}`,
    urgent: true,
    extraData: {
      callId,
      callType: effectiveCallType,
      callerName: currentIdentity.userName,
      callerRole: callerRoleLabel,
      schoolName: callerSchoolLabel,
    },
  }).catch(() => {});

  // 45-second unanswered timeout
  directRingTimeout = setTimeout(() => {
    if (state.callId === callId && state.phase === "ringing_outgoing") {
      if (inboxChannel) {
        void inboxChannel.send({
          type: "broadcast",
          event: "direct_cancel",
          payload: { callId },
        });
      }
      const ctx = state.threadContext;
      const cType = state.callType;
      const metaSnap = currentDirectMeta;
      const cName = state.remoteName || params.targetName;
      sendDirectCallControlPush("CALL_CANCELLED", callId, "missed", ctx, metaSnap, cType);
      dismissIncomingCallAlerts(callId);
      syncNativeNstaOverlay({
        callId,
        phase: "missed",
        callerName: cName,
        schoolName: callerSchoolLabel,
        callType: cType,
        statusText: "Call uthayi nahi gayi (No Answer)",
      });
      cleanupDirectCallResources();
      void sbSetDocument(`call_sessions/${callId}`, { status: "missed", endedAt: new Date().toISOString() }, true);
      void logCallHistoryMessage({
        status: "missed",
        callType: cType,
        mode: "direct",
        callId,
        threadContext: ctx,
        targetId: metaSnap?.targetIds?.[0],
        targetName: metaSnap?.targetName,
        targetAvatar: metaSnap?.targetAvatar,
      });
      emitState({
        ...INITIAL_STATE,
        activeGroupCalls: state.activeGroupCalls,
        errorNote: "Call uthayi nahi gayi (No Answer).",
      });
      showTransientCallStatusBanner({
        kind: "missed",
        title: `${cName} (${callerSchoolLabel})`,
        subtitle: "Call uthayi nahi gayi (No Answer)",
      });
    }
  }, 45_000);
}

// ── Accept Incoming 1-on-1 Call ──────────────────────────────────────────────
export async function acceptIncomingCall() {
  if (!state.callId || !supabase) return;
  if (state.phase !== "ringing_incoming" || acceptInFlightCallId === state.callId) return;

  const callId = state.callId;
  const requestedCallType = state.callType;
  acceptInFlightCallId = callId;
  primeCallAudioOnGesture();
  stopCallTones();
  dismissIncomingCallAlerts(callId);

  // Transition immediately on 1st tap so UI responds right away and double-taps can't collide
  emitState({
    phase: "connecting",
    statusNote: "Accepting call...",
    errorNote: null,
  });

  try {
    // Subscribe signaling channel immediately in parallel with media & ICE fetch
    const ch = supabase.channel(`nsta_webrtc_call_${callId}`, {
      config: { broadcast: { self: false } },
    });
    directChannel = ch;

    const subscribedPromise = new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, 3200);
      ch.subscribe((st) => {
        if (st === "SUBSCRIBED" && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        } else if ((st === "CHANNEL_ERROR" || st === "TIMED_OUT") && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve(false);
        }
      });
    });

    const [{ stream, videoFallback }, iceServers] = await Promise.all([
      acquireUserMedia(requestedCallType, "user"),
      fetchIceServers(900),
    ]);

    if (state.callId !== callId) {
      stopMediaStream(stream);
      try {
        void supabase.removeChannel(ch);
      } catch {}
      return;
    }

    const effectiveCallType: CallType = videoFallback ? "voice" : requestedCallType;
    const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 });
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    directPc = pc;
    attachDirectSignalingHandlers(ch, pc, callId, false);

    emitState({
      phase: "connecting",
      callType: effectiveCallType,
      localStream: stream,
      isAudioMuted: false,
      isVideoOff: effectiveCallType === "voice",
      statusNote: "Connecting...",
      errorNote: videoFallback ? "Camera access nahi mila, audio se connect ho rahe hain." : null,
    });

    void sbSetDocument(
      `call_sessions/${callId}`,
      { status: "accepted", acceptedAt: new Date().toISOString() },
      true
    ).catch(() => {});

    await subscribedPromise;
    if (state.callId !== callId || !directChannel) return;

    const announceReady = () => {
      if (state.callId !== callId || !directChannel || directPc?.remoteDescription) return;
      void ch.send({
        type: "broadcast",
        event: "callee_ready",
        payload: { callId, userId: currentIdentity?.userId },
      });
    };
    announceReady();
    if (directCalleeReadyLoop) clearInterval(directCalleeReadyLoop);
    directCalleeReadyLoop = setInterval(announceReady, 1200);

    if (incomingOfferSnapshot?.sdp && !pc.remoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferSnapshot.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const sendAns = () => {
        if (state.callId !== callId || !directChannel) return;
        void ch.send({
          type: "broadcast",
          event: "answer",
          payload: { callId, sdp: answer },
        });
      };
      sendAns();
      if (directAnswerRetryLoop) clearInterval(directAnswerRetryLoop);
      let retries = 0;
      directAnswerRetryLoop = setInterval(() => {
        retries++;
        if (retries > 4 || state.phase === "connected" || state.callId !== callId) {
          if (directAnswerRetryLoop) {
            clearInterval(directAnswerRetryLoop);
            directAnswerRetryLoop = null;
          }
          return;
        }
        sendAns();
      }, 1100);
    }
  } catch (err: any) {
    cleanupDirectCallResources();
    emitState({
      ...INITIAL_STATE,
      activeGroupCalls: state.activeGroupCalls,
      errorNote: err?.message || "Mic/Camera permission allow karein.",
    });
  } finally {
    if (acceptInFlightCallId === callId) {
      acceptInFlightCallId = null;
    }
  }
}

// ── Reject Incoming 1-on-1 Call ──────────────────────────────────────────────
export async function rejectIncomingCall() {
  if (!state.callId) return;
  const callId = state.callId;
  const cName = state.remoteName || "Caller";
  const cSchool = state.remoteSchoolName || "School";
  const cType = state.callType;
  stopCallTones();
  dismissIncomingCallAlerts(callId);
  syncNativeNstaOverlay({
    callId,
    phase: "rejected",
    callerName: cName,
    schoolName: cSchool,
    callType: cType,
    statusText: "Call decline ki gayi",
  });

  if (supabase) {
    const tmp = supabase.channel(`nsta_webrtc_call_${callId}`, {
      config: { broadcast: { self: false } },
    });
    tmp.subscribe((st) => {
      if (st === "SUBSCRIBED") {
        void tmp.send({
          type: "broadcast",
          event: "call_reject",
          payload: { callId, userId: currentIdentity?.userId },
        });
        setTimeout(() => {
          try {
            void supabase?.removeChannel(tmp);
          } catch {}
        }, 700);
      }
    });
  }

  void sbSetDocument(`call_sessions/${callId}`, { status: "rejected", endedAt: new Date().toISOString() }, true);
  cleanupDirectCallResources();
  emitState({ ...INITIAL_STATE, activeGroupCalls: state.activeGroupCalls });
  showTransientCallStatusBanner({
    kind: "declined",
    title: `${cName} (${cSchool})`,
    subtitle: "Call decline ki gayi",
  });
}

// ── Handle remote cancellation/end from push or native overlay ───────────────
export function handleRemoteCallControlAction(callId: string, action: "remote_cancelled" | "remote_ended" | "remote_accepted") {
  dismissIncomingCallAlerts(callId);
  if (state.callId !== callId || state.phase === "idle") return;
  const cName = state.remoteName || "Caller";
  const cSchool = state.remoteSchoolName || "School";
  stopCallTones();
  cleanupDirectCallResources();
  emitState({ ...INITIAL_STATE, activeGroupCalls: state.activeGroupCalls });
  if (action !== "remote_accepted") {
    showTransientCallStatusBanner({
      kind: action === "remote_cancelled" ? "cancelled" : "ended",
      title: `${cName} (${cSchool})`,
      subtitle: action === "remote_cancelled" ? "Call cancel ho gayi" : "NSTA Call samapt hui",
    });
  }
}

// ── Multi-Peer Class Group Voice / Video Call Room ───────────────────────────
function cleanupGroupCallResources() {
  stopCallTones();
  if (groupHeartbeatTimer) {
    clearInterval(groupHeartbeatTimer);
    groupHeartbeatTimer = null;
  }
  groupPcs.forEach((pc) => {
    try {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.close();
    } catch {}
  });
  groupPcs.clear();
  groupPendingIce.clear();
  if (groupChannel && supabase) {
    try {
      void supabase.removeChannel(groupChannel);
    } catch {}
    groupChannel = null;
  }
  groupInfoRef = null;
  stopMediaStream(state.localStream);
}

async function createGroupPeerConnection(params: {
  otherPeerId: string;
  otherMeta: { userId: string; userName: string; userRole: "ADMIN" | "TEACHER" | "STUDENT"; userPhoto?: string };
  localStream: MediaStream;
  iceServers: RTCIceServer[];
  ch: RealtimeChannel;
  createOfferImmediately: boolean;
}) {
  const { otherPeerId, otherMeta, localStream, iceServers, ch, createOfferImmediately } = params;
  if (groupPcs.has(otherPeerId)) {
    return groupPcs.get(otherPeerId)!;
  }

  const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 });
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  groupPcs.set(otherPeerId, pc);

  const remoteStream = new MediaStream();
  const upsertPeer = (patch: Partial<GroupCallPeer>) => {
    const existing = state.groupPeers.find((p) => p.peerId === otherPeerId);
    const updated: GroupCallPeer = existing
      ? { ...existing, ...patch }
      : {
          peerId: otherPeerId,
          userId: otherMeta.userId,
          userName: otherMeta.userName,
          userRole: otherMeta.userRole,
          userPhoto: otherMeta.userPhoto,
          stream: remoteStream,
          audioMuted: false,
          videoOff: false,
          connectionState: pc.connectionState || "connecting",
          ...patch,
        };
    const nextPeers = existing
      ? state.groupPeers.map((p) => (p.peerId === otherPeerId ? updated : p))
      : [...state.groupPeers, updated];
    groupMaxParticipants = Math.max(groupMaxParticipants, nextPeers.length + 1);
    emitState({
      groupPeers: nextPeers,
      phase: nextPeers.length > 0 ? "connected" : state.phase,
      connectedAtMs: state.connectedAtMs || (nextPeers.length > 0 ? Date.now() : null),
    });
  };

  upsertPeer({ stream: remoteStream, connectionState: "connecting" });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      void ch.send({
        type: "broadcast",
        event: "group_ice",
        payload: {
          fromPeerId: myGroupPeerId,
          toPeerId: otherPeerId,
          candidate: e.candidate.toJSON(),
        },
      });
    }
  };

  pc.ontrack = (ev) => {
    if (ev.streams && ev.streams[0]) {
      ev.streams[0].getTracks().forEach((t) => {
        if (!remoteStream.getTracks().some((rt) => rt.id === t.id)) {
          remoteStream.addTrack(t);
        }
      });
    } else if (ev.track) {
      if (!remoteStream.getTracks().some((rt) => rt.id === ev.track.id)) {
        remoteStream.addTrack(ev.track);
      }
    }
    upsertPeer({ stream: remoteStream, connectionState: "connected" });
  };

  pc.onconnectionstatechange = () => {
    upsertPeer({ connectionState: pc.connectionState });
  };

  if (createOfferImmediately) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      void ch.send({
        type: "broadcast",
        event: "group_offer",
        payload: {
          fromPeerId: myGroupPeerId,
          toPeerId: otherPeerId,
          sdp: offer,
          fromMeta: {
            userId: currentIdentity?.userId || "",
            userName: currentIdentity?.userName || "User",
            userRole: currentIdentity?.userRole || "STUDENT",
            userPhoto: currentIdentity?.userPhoto || "",
          },
        },
      });
    } catch {}
  }

  return pc;
}

export async function startOrJoinGroupCall(params: {
  roomKey: string;
  roomTitle: string;
  callType: CallType;
  asHost: boolean;
  classId?: string;
  className?: string;
  targetStudentIds?: string[];
  threadContext: CallThreadContext;
}) {
  if (!currentIdentity) {
    throw new Error("Call join karne ke liye login active hona chahiye.");
  }
  if (!supabase) {
    throw new Error("Realtime signaling server uplabdh nahi hai.");
  }
  if (state.phase !== "idle") {
    throw new Error("Pehle chal rahi call ko end karein.");
  }

  const existingActive = state.activeGroupCalls[params.roomKey];
  const callId = existingActive?.callId || `gcall_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const { stream, videoFallback } = await acquireUserMedia(params.callType, "user");
  const effectiveCallType: CallType = videoFallback ? "voice" : params.callType;
  const iceServers = await fetchIceServers();

  groupMaxParticipants = 1;
  const nowIso = new Date().toISOString();
  const roomInfo: ActiveGroupCallInfo = {
    roomKey: params.roomKey,
    callId,
    schoolId: currentIdentity.schoolId,
    callType: effectiveCallType,
    roomTitle: params.roomTitle,
    classId: params.classId,
    className: params.className,
    hostId: existingActive?.hostId || currentIdentity.userId,
    hostName: existingActive?.hostName || currentIdentity.userName,
    participantCount: Math.max(1, (existingActive?.participantCount || 0) + (existingActive ? 1 : 0)),
    startedAt: existingActive?.startedAt || nowIso,
    updatedAt: nowIso,
  };
  groupInfoRef = roomInfo;

  emitState({
    phase: "connected",
    mode: "group",
    callType: effectiveCallType,
    callId,
    roomKey: params.roomKey,
    isCaller: params.asHost,
    isHost: params.asHost,
    isMinimized: false,
    remoteName: params.roomTitle,
    remoteSubtitle: effectiveCallType === "video" ? "Class Live Video Call" : "Class Live Audio Call",
    remoteAvatar: "",
    localStream: stream,
    remoteStream: null,
    groupPeers: [],
    isAudioMuted: false,
    isVideoOff: effectiveCallType === "voice",
    remoteAudioMuted: false,
    remoteVideoOff: false,
    cameraFacing: "user",
    connectedAtMs: Date.now(),
    statusNote: "Live Room Active",
    errorNote: videoFallback ? "Camera access nahi mila, audio se join hue hain." : null,
    threadContext: params.threadContext,
    activeGroupCalls: {
      ...state.activeGroupCalls,
      [params.roomKey]: roomInfo,
    },
  });

  const ch = supabase.channel(`nsta_webrtc_group_${currentIdentity.schoolId}_${params.roomKey}`, {
    config: {
      presence: { key: myGroupPeerId },
      broadcast: { self: false },
    },
  });
  groupChannel = ch;

  ch.on("presence", { event: "sync" }, () => {
    const presenceState = ch.presenceState<any>();
    const activePeerIds = new Set<string>();

    Object.entries(presenceState).forEach(([peerId, metas]) => {
      if (peerId === myGroupPeerId) return;
      activePeerIds.add(peerId);
      const meta = Array.isArray(metas) && metas[0] ? metas[0] : {};
      // Deterministic offerer rule prevents WebRTC SDP glare on simultaneous joins
      const shouldOffer = myGroupPeerId < peerId;
      void createGroupPeerConnection({
        otherPeerId: peerId,
        otherMeta: {
          userId: meta.userId || peerId,
          userName: meta.userName || "Participant",
          userRole: meta.userRole || "STUDENT",
          userPhoto: meta.userPhoto || "",
        },
        localStream: stream,
        iceServers,
        ch,
        createOfferImmediately: shouldOffer,
      });
    });

    // Remove peers who left Presence
    let changed = false;
    groupPcs.forEach((pc, peerId) => {
      if (!activePeerIds.has(peerId)) {
        try {
          pc.close();
        } catch {}
        groupPcs.delete(peerId);
        groupPendingIce.delete(peerId);
        changed = true;
      }
    });
    if (changed) {
      emitState({
        groupPeers: state.groupPeers.filter((p) => activePeerIds.has(p.peerId)),
      });
    }
  });

  ch.on("broadcast", { event: "group_offer" }, async ({ payload }) => {
    if (!payload || payload.toPeerId !== myGroupPeerId || !payload.fromPeerId || !payload.sdp) return;
    const fromPeerId = String(payload.fromPeerId);
    const pc = await createGroupPeerConnection({
      otherPeerId: fromPeerId,
      otherMeta: payload.fromMeta || { userId: fromPeerId, userName: "Participant", userRole: "STUDENT" },
      localStream: stream,
      iceServers,
      ch,
      createOfferImmediately: false,
    });
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const queued = groupPendingIce.get(fromPeerId) || [];
      for (const ice of queued) {
        await pc.addIceCandidate(new RTCIceCandidate(ice)).catch(() => {});
      }
      groupPendingIce.delete(fromPeerId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      void ch.send({
        type: "broadcast",
        event: "group_answer",
        payload: { fromPeerId: myGroupPeerId, toPeerId: fromPeerId, sdp: answer },
      });
    } catch {}
  });

  ch.on("broadcast", { event: "group_answer" }, async ({ payload }) => {
    if (!payload || payload.toPeerId !== myGroupPeerId || !payload.fromPeerId || !payload.sdp) return;
    const pc = groupPcs.get(String(payload.fromPeerId));
    if (!pc) return;
    try {
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const queued = groupPendingIce.get(String(payload.fromPeerId)) || [];
        for (const ice of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(ice)).catch(() => {});
        }
        groupPendingIce.delete(String(payload.fromPeerId));
      }
    } catch {}
  });

  ch.on("broadcast", { event: "group_ice" }, async ({ payload }) => {
    if (!payload || payload.toPeerId !== myGroupPeerId || !payload.fromPeerId || !payload.candidate) return;
    const fromId = String(payload.fromPeerId);
    const pc = groupPcs.get(fromId);
    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
    } else {
      const list = groupPendingIce.get(fromId) || [];
      list.push(payload.candidate);
      groupPendingIce.set(fromId, list);
    }
  });

  ch.on("broadcast", { event: "group_media_state" }, ({ payload }) => {
    if (!payload?.fromPeerId) return;
    emitState({
      groupPeers: state.groupPeers.map((p) =>
        p.peerId === payload.fromPeerId
          ? {
              ...p,
              ...(typeof payload.audioMuted === "boolean" ? { audioMuted: payload.audioMuted } : {}),
              ...(typeof payload.videoOff === "boolean" ? { videoOff: payload.videoOff } : {}),
            }
          : p
      ),
    });
  });

  ch.on("broadcast", { event: "group_room_ended" }, () => {
    const rk = state.roomKey;
    cleanupGroupCallResources();
    const nextMap = { ...state.activeGroupCalls };
    if (rk) delete nextMap[rk];
    emitState({
      ...INITIAL_STATE,
      activeGroupCalls: nextMap,
      statusNote: "Host ne Group Call samapt kar di.",
    });
  });

  ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await ch.track({
        userId: currentIdentity?.userId,
        userName: currentIdentity?.userName,
        userRole: currentIdentity?.userRole,
        userPhoto: currentIdentity?.userPhoto || "",
        joinedAt: new Date().toISOString(),
      });
    }
  });

  const publishRoomPresence = () => {
    if (!groupInfoRef || !currentIdentity) return;
    const updatedInfo: ActiveGroupCallInfo = {
      ...groupInfoRef,
      participantCount: 1 + state.groupPeers.length,
      updatedAt: new Date().toISOString(),
    };
    groupInfoRef = updatedInfo;
    void sbSetDocument(
      `nsta_active_group_calls/${currentIdentity.schoolId}__${params.roomKey}`,
      { ...updatedInfo, schoolId: currentIdentity.schoolId },
      false
    );
    if (inboxChannel) {
      void inboxChannel.send({
        type: "broadcast",
        event: "group_call_update",
        payload: { info: updatedInfo, ended: false },
      });
    }
  };

  publishRoomPresence();
  groupHeartbeatTimer = setInterval(publishRoomPresence, 18_000);

  // Send Class Group push notification when host starts a new room
  if (params.asHost && !existingActive) {
    void sbSetDocument(
      `call_sessions/${callId}`,
      {
        callId,
        mode: "group",
        callType: effectiveCallType,
        status: "active",
        schoolId: currentIdentity.schoolId,
        callerId: currentIdentity.userId,
        callerName: currentIdentity.userName,
        callerRole: currentIdentity.userRole,
        callerAvatar: currentIdentity.userPhoto || "",
        roomTitle: params.roomTitle,
        targetName: params.roomTitle,
        classId: params.classId,
        className: params.className,
        threadContext: params.threadContext,
        createdAt: nowIso,
      },
      false
    );
    void sendSchoolPushNotification({
      schoolId: currentIdentity.schoolId,
      classId: params.classId,
      className: params.className,
      classBroadcast: true,
      studentIds: params.targetStudentIds && params.targetStudentIds.length > 0 ? params.targetStudentIds : undefined,
      senderId: currentIdentity.userId,
      senderName: currentIdentity.userName,
      title: `${effectiveCallType === "video" ? "📹 Class Video Call Shuru!" : "📞 Class Audio Call Shuru!"} • ${params.roomTitle}`,
      body: `${currentIdentity.userName} ne live class call shuru ki hai. Abhi join karne ke liye tap karein!`,
      type: "CALL_INCOMING",
      threadType: params.threadContext.threadType,
      voiceSpeak: false,
      icon: currentIdentity.userPhoto || undefined,
      senderPhoto: currentIdentity.userPhoto || undefined,
      url: `/?schoolPortal=1&schoolId=${encodeURIComponent(currentIdentity.schoolId)}&schoolTab=messenger&subTab=class`,
      urgent: true,
    }).catch(() => {});
  }
}

// ── End / Leave Active Call ──────────────────────────────────────────────────
export async function endCurrentCall(endRoomForAll = false) {
  if (state.phase === "idle") return;
  const { mode, callId, roomKey, callType, connectedAtMs, threadContext, isCaller, isHost } = state;

  if (mode === "direct") {
    const wasOutgoingRinging = state.phase === "ringing_outgoing";
    const cName = state.remoteName || "Caller";
    const cSchool = state.remoteSchoolName || "School";
    stopCallTones();
    dismissIncomingCallAlerts(callId);
    if (directChannel) {
      void directChannel.send({
        type: "broadcast",
        event: "call_hangup",
        payload: { callId },
      });
    }
    if (wasOutgoingRinging && inboxChannel) {
      void inboxChannel.send({
        type: "broadcast",
        event: "direct_cancel",
        payload: { callId },
      });
    }
    const dur = connectedAtMs ? Math.max(1, Math.round((Date.now() - connectedAtMs) / 1000)) : 0;
    const status: "completed" | "missed" | "ended" = dur > 0 ? "completed" : wasOutgoingRinging ? "missed" : "ended";
    const metaSnap = currentDirectMeta;
    sendDirectCallControlPush(
      wasOutgoingRinging ? "CALL_CANCELLED" : "CALL_ENDED",
      callId,
      wasOutgoingRinging ? "cancelled" : "ended",
      threadContext,
      metaSnap,
      callType
    );
    syncNativeNstaOverlay({
      callId,
      phase: wasOutgoingRinging ? "cancelled" : "ended",
      callerName: cName,
      schoolName: cSchool,
      callType,
      statusText: dur > 0 ? `Call Ended (${dur}s)` : wasOutgoingRinging ? "Call Cancelled" : "Call Ended",
    });
    if (isCaller) {
      void logCallHistoryMessage({
        status,
        durationSec: dur,
        callType,
        mode: "direct",
        callId,
        threadContext,
        targetId: metaSnap?.targetIds?.[0],
        targetName: metaSnap?.targetName,
        targetAvatar: metaSnap?.targetAvatar,
      });
    }
    void sbSetDocument(`call_sessions/${callId}`, { status, durationSec: dur, endedAt: new Date().toISOString() }, true);
    cleanupDirectCallResources();
    emitState({ ...INITIAL_STATE, activeGroupCalls: state.activeGroupCalls });
    showTransientCallStatusBanner({
      kind: wasOutgoingRinging ? "cancelled" : "ended",
      title: `${cName} (${cSchool})`,
      subtitle: dur > 0 ? `NSTA Call samapt (${dur}s)` : wasOutgoingRinging ? "Call cancel ki gayi" : "NSTA Call samapt",
    });
    return;
  }

  // Group Call Leave or End for All
  const dur = connectedAtMs ? Math.max(1, Math.round((Date.now() - connectedAtMs) / 1000)) : 0;
  const shouldCloseRoom = endRoomForAll || (isHost && state.groupPeers.length === 0);

  if (shouldCloseRoom) {
    if (groupChannel) {
      void groupChannel.send({
        type: "broadcast",
        event: "group_room_ended",
        payload: { roomKey, callId },
      });
    }
    if (currentIdentity?.schoolId && roomKey) {
      void sbDeleteDocument(`nsta_active_group_calls/${currentIdentity.schoolId}__${roomKey}`);
      if (inboxChannel && groupInfoRef) {
        void inboxChannel.send({
          type: "broadcast",
          event: "group_call_update",
          payload: { info: groupInfoRef, ended: true },
        });
      }
    }
    void sbSetDocument(`call_sessions/${callId}`, { status: "completed", durationSec: dur, participants: groupMaxParticipants, endedAt: new Date().toISOString() }, true);
    if (isHost) {
      void logCallHistoryMessage({
        status: "completed",
        durationSec: dur,
        participants: groupMaxParticipants,
        callType,
        mode: "group",
        callId,
        threadContext,
        targetId: threadContext?.classId,
        targetName: threadContext?.className || state.remoteName,
      });
    }
  }

  const nextActiveMap = { ...state.activeGroupCalls };
  if (shouldCloseRoom && roomKey) {
    delete nextActiveMap[roomKey];
  }
  cleanupGroupCallResources();
  emitState({ ...INITIAL_STATE, activeGroupCalls: nextActiveMap });
}

// ── In-Call Controls (Mute, Camera Toggle, Flip Camera, Minimize) ────────────
export function toggleCallAudioMute() {
  if (!state.localStream) return;
  const nextMuted = !state.isAudioMuted;
  state.localStream.getAudioTracks().forEach((t) => {
    t.enabled = !nextMuted;
  });
  emitState({ isAudioMuted: nextMuted });

  if (state.mode === "direct" && directChannel) {
    void directChannel.send({
      type: "broadcast",
      event: "media_state",
      payload: { audioMuted: nextMuted },
    });
  } else if (state.mode === "group" && groupChannel) {
    void groupChannel.send({
      type: "broadcast",
      event: "group_media_state",
      payload: { fromPeerId: myGroupPeerId, audioMuted: nextMuted },
    });
  }
}

export async function toggleCallVideo() {
  if (!state.localStream) return;
  const nextOff = !state.isVideoOff;
  const videoTracks = state.localStream.getVideoTracks();

  if (videoTracks.length > 0) {
    videoTracks.forEach((t) => {
      t.enabled = !nextOff;
    });
    emitState({ isVideoOff: nextOff });
  } else if (!nextOff) {
    // Upgrade audio-only call to video mid-call!
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: state.cameraFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const newTrack = camStream.getVideoTracks()[0];
      if (newTrack) {
        state.localStream.addTrack(newTrack);
        const pcs = state.mode === "direct" ? (directPc ? [directPc] : []) : Array.from(groupPcs.values());
        for (const pc of pcs) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(newTrack);
          } else {
            pc.addTrack(newTrack, state.localStream);
          }
        }
        emitState({ isVideoOff: false, callType: "video" });
      }
    } catch {
      emitState({ errorNote: "Camera start nahi ho saka." });
      return;
    }
  }

  if (state.mode === "direct" && directChannel) {
    void directChannel.send({
      type: "broadcast",
      event: "media_state",
      payload: { videoOff: nextOff },
    });
  } else if (state.mode === "group" && groupChannel) {
    void groupChannel.send({
      type: "broadcast",
      event: "group_media_state",
      payload: { fromPeerId: myGroupPeerId, videoOff: nextOff },
    });
  }
}

export async function flipCallCamera() {
  if (!state.localStream || state.isVideoOff) return;
  const nextFacing: "user" | "environment" = state.cameraFacing === "user" ? "environment" : "user";
  try {
    const camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    const newTrack = camStream.getVideoTracks()[0];
    if (!newTrack) return;

    const oldTracks = state.localStream.getVideoTracks();
    const pcs = state.mode === "direct" ? (directPc ? [directPc] : []) : Array.from(groupPcs.values());
    for (const pc of pcs) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }
    oldTracks.forEach((t) => {
      state.localStream?.removeTrack(t);
      try {
        t.stop();
      } catch {}
    });
    state.localStream.addTrack(newTrack);
    emitState({ cameraFacing: nextFacing });
  } catch {
    emitState({ errorNote: "Back/Front camera switch nahi ho saka." });
  }
}

export function setCallMinimized(minimized: boolean) {
  emitState({ isMinimized: minimized });
}

export function clearCallErrorNote() {
  emitState({ errorNote: null });
}
