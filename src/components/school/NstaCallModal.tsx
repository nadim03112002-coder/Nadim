import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  RefreshCw,
  Minimize2,
  Maximize2,
  Users,
  X,
  AlertCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { useBackHandler } from "../../utils/backNavigation";
import {
  isCallerVoiceAnnounceEnabled,
  setCallerVoiceAnnounceEnabled,
} from "../../utils/schoolCallerId";
import {
  acceptIncomingCall,
  checkAndJoinCallFromNotification,
  clearCallErrorNote,
  endCurrentCall,
  flipCallCamera,
  refreshIncomingRingtoneMode,
  registerCallIdentity,
  registerCallModalHost,
  rejectIncomingCall,
  setCallMinimized,
  toggleCallAudioMute,
  toggleCallVideo,
  useIsPrimaryCallModalHost,
  useNstaCallState,
  type CallIdentity,
  type GroupCallPeer,
} from "../../services/nstaCallService";

function formatElapsed(msStart: number | null, nowMs: number): string {
  if (!msStart) return "00:00";
  const sec = Math.max(0, Math.floor((nowMs - msStart) / 1000));
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function getInitials(name?: string): string {
  const clean = String(name || "").trim();
  if (!clean) return "U";
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

const StreamAudioSink: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (stream) {
      el.muted = false;
      el.volume = 1;
      el.srcObject = stream;
      const tryPlay = () => {
        void el.play().catch(() => {});
      };
      tryPlay();
      el.addEventListener("loadedmetadata", tryPlay);
      el.addEventListener("canplay", tryPlay);
      return () => {
        el.removeEventListener("loadedmetadata", tryPlay);
        el.removeEventListener("canplay", tryPlay);
      };
    } else {
      el.srcObject = null;
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
};

const GroupPeerTile: React.FC<{ peer: GroupCallPeer }> = ({ peer }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasLiveVideo =
    !peer.videoOff &&
    Boolean(peer.stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled));

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !peer.stream) return;
    el.srcObject = peer.stream;
    void el.play().catch(() => {});
  }, [peer.stream, hasLiveVideo]);

  return (
    <div className="relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center min-h-[160px] sm:min-h-[210px]">
      <StreamAudioSink stream={peer.stream} />
      {hasLiveVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          {peer.userPhoto ? (
            <img
              src={peer.userPhoto}
              alt={peer.userName}
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 font-extrabold text-xl flex items-center justify-center">
              {getInitials(peer.userName)}
            </div>
          )}
          <div className="min-w-0 max-w-full">
            <p className="text-sm font-bold text-white truncate">{peer.userName}</p>
            <p className="text-[11px] text-slate-400 font-medium">
              {peer.userRole === "ADMIN" ? "Principal / Admin" : peer.userRole === "TEACHER" ? "Teacher" : "Student"}
            </p>
          </div>
        </div>
      )}

      {/* Bottom Name & Mic Badge */}
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-sm border border-white/10">
        <span className="text-xs font-bold text-white truncate">{peer.userName}</span>
        <span className="shrink-0 text-slate-300">
          {peer.audioMuted ? (
            <MicOff className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
          )}
        </span>
      </div>
    </div>
  );
};

export const NstaCallModal: React.FC = () => {
  const call = useNstaCallState();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [callerVoiceOn, setCallerVoiceOn] = useState<boolean>(() => isCallerVoiceAnnounceEnabled());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localGroupVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!call.connectedAtMs || call.phase === "idle") return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [call.connectedAtMs, call.phase]);

  useEffect(() => {
    if (call.errorNote && call.phase === "idle") {
      toast.info(call.errorNote);
      clearCallErrorNote();
    }
  }, [call.errorNote, call.phase]);

  // Attach local stream preview
  useEffect(() => {
    const el = call.mode === "group" ? localGroupVideoRef.current : localVideoRef.current;
    if (!el) return;
    if (call.localStream) {
      el.srcObject = call.localStream;
      void el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [call.localStream, call.mode, call.isVideoOff, call.isMinimized, call.phase]);

  // Attach remote stream video (direct call)
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    if (call.remoteStream) {
      el.srcObject = call.remoteStream;
      void el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [call.remoteStream, call.remoteVideoOff, call.isMinimized, call.phase]);

  // Android Back Button handling during calls
  useBackHandler(call.phase === "ringing_incoming", () => {
    void rejectIncomingCall();
  }, 95);
  useBackHandler(
    call.phase !== "idle" && call.phase !== "ringing_incoming" && !call.isMinimized,
    () => setCallMinimized(true),
    94
  );

  if (call.phase === "idle") return null;

  const isVideoCall = call.callType === "video";
  const showLocalVideo =
    !call.isVideoOff &&
    Boolean(call.localStream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled));
  const showRemoteVideo =
    isVideoCall &&
    !call.remoteVideoOff &&
    Boolean(call.remoteStream?.getVideoTracks().some((t) => t.readyState === "live"));

  const renderPortal = (node: React.ReactNode) => {
    if (typeof document !== "undefined" && document.body) {
      return createPortal(node, document.body);
    }
    return <>{node}</>;
  };

  // ── 1. MINIMIZED FLOATING CALL STRIP (Never blocks chat/work) ────────────
  if (call.isMinimized && call.phase !== "ringing_incoming") {
    return renderPortal(
      <>
        {call.mode === "direct" && <StreamAudioSink stream={call.remoteStream} />}
        {call.mode === "group" &&
          call.groupPeers.map((p) => <StreamAudioSink key={p.peerId} stream={p.stream} />)}

        <div className="nst-isolated-modal fixed top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-24px)] max-w-md rounded-2xl bg-slate-900/95 border border-emerald-500/40 shadow-2xl px-3 py-2 flex items-center justify-between gap-2 backdrop-blur-md text-white">
          <button
            type="button"
            onClick={() => setCallMinimized(false)}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer min-h-[44px]"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
              {isVideoCall ? <Video className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-extrabold text-white truncate"
                style={{ color: "#ffffff" }}
              >
                {call.remoteName}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-emerald-300 truncate">
                {call.connectedAtMs ? formatElapsed(call.connectedAtMs, nowMs) : call.statusNote}
                {call.mode === "group" ? ` · ${1 + call.groupPeers.length} Live` : ""}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleCallAudioMute}
              className={`min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center cursor-pointer ${
                call.isAudioMuted
                  ? "bg-rose-600 text-white border-rose-500"
                  : "bg-slate-800 text-slate-200 border-slate-700"
              }`}
              title={call.isAudioMuted ? "Unmute" : "Mute"}
            >
              {call.isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setCallMinimized(false)}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center cursor-pointer"
              title="Expand Call"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void endCurrentCall(false)}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer"
              title="End Call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── 2. INCOMING CALL FULLSCREEN RINGER ────────────────────────────────────
  if (call.phase === "ringing_incoming") {
    return renderPortal(
      <div className="nst-isolated-modal fixed inset-0 z-[9999] bg-slate-950/98 backdrop-blur-xl flex flex-col items-center justify-between px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] text-white select-none">
        <div className="text-center space-y-1 mt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            {isVideoCall ? "NSTA Video Call" : "NSTA Voice Call"}
          </p>
          {call.remoteSchoolName && (
            <p className="text-xs font-bold text-indigo-300">{call.remoteSchoolName}</p>
          )}
          <p className="text-xs text-slate-400">{call.remoteSubtitle}</p>
        </div>

        <div className="flex flex-col items-center text-center space-y-5 my-auto">
          <div className="relative">
            {call.remoteAvatar ? (
              <img
                src={call.remoteAvatar}
                alt={call.remoteName}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-emerald-500/50 shadow-2xl"
              />
            ) : (
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-emerald-600/20 border-4 border-emerald-500/40 text-emerald-300 font-black text-3xl flex items-center justify-center shadow-2xl">
                {getInitials(call.remoteName)}
              </div>
            )}
          </div>
          <div className="space-y-1.5 max-w-xs">
            <h2 className="text-2xl font-black tracking-tight text-white break-words">
              {call.remoteName}
            </h2>
            <p className="text-sm font-medium text-slate-300">
              {isVideoCall ? "Video call par baat karna chahte hain" : "Voice call aa rahi hai"}
            </p>
            <button
              type="button"
              onClick={() => {
                const next = !callerVoiceOn;
                setCallerVoiceAnnounceEnabled(next);
                setCallerVoiceOn(next);
                refreshIncomingRingtoneMode();
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-[11px] font-bold text-slate-200 hover:bg-slate-800 cursor-pointer transition"
            >
              {callerVoiceOn ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Caller Name Voice: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ringtone Only (Voice OFF)</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="w-full max-w-xs flex items-center justify-around gap-6 mb-4">
          <button
            type="button"
            onClick={() => void rejectIncomingCall()}
            className="group flex flex-col items-center gap-2.5 p-3 rounded-2xl touch-manipulation cursor-pointer select-none focus:outline-none"
            aria-label="Decline Call"
          >
            <span className="w-16 h-16 rounded-full bg-rose-600 group-hover:bg-rose-500 group-active:scale-95 text-white flex items-center justify-center shadow-xl shadow-rose-900/40 transition">
              <PhoneOff className="w-7 h-7" />
            </span>
            <span className="text-xs font-bold text-rose-300">Decline</span>
          </button>

          <button
            type="button"
            onClick={() => void acceptIncomingCall()}
            className="group flex flex-col items-center gap-2.5 p-3 rounded-2xl touch-manipulation cursor-pointer select-none focus:outline-none"
            aria-label="Accept Call"
          >
            <span className="w-16 h-16 rounded-full bg-emerald-600 group-hover:bg-emerald-500 group-active:scale-95 text-white flex items-center justify-center shadow-xl shadow-emerald-900/40 transition animate-pulse">
              {isVideoCall ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </span>
            <span className="text-xs font-bold text-emerald-300">Accept</span>
          </button>
        </div>
      </div>
    );
  }

  // ── 3. ACTIVE / OUTGOING CALL STAGE (1-on-1 OR GROUP) ────────────────────
  const totalParticipants = 1 + call.groupPeers.length;

  return renderPortal(
    <div className="nst-isolated-modal fixed inset-0 z-[9999] bg-slate-950 flex flex-col justify-between text-white overflow-hidden select-none">
      {/* Always keep remote audio alive even when video is hidden */}
      {call.mode === "direct" && <StreamAudioSink stream={call.remoteStream} />}

      {/* Top Bar */}
      <div className="relative z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-3 bg-gradient-to-b from-slate-950/90 to-transparent">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-white truncate">{call.remoteName}</h2>
            {call.mode === "group" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 shrink-0 tabular-nums">
                <Users className="w-3.5 h-3.5" />
                {totalParticipants}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-300 font-mono tabular-nums mt-0.5">
            {call.connectedAtMs
              ? formatElapsed(call.connectedAtMs, nowMs)
              : call.statusNote || (call.mode === "group" ? "Live Class Room" : "Connecting...")}
            {call.mode === "direct" && call.remoteAudioMuted && call.phase === "connected"
              ? " · Mic Muted"
              : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCallMinimized(true)}
          className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer shrink-0"
          title="Minimize Call"
        >
          <Minimize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Warning banner if camera fallback or ICE notice */}
      {call.errorNote && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center justify-between gap-2 z-20">
          <span className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="truncate">{call.errorNote}</span>
          </span>
          <button
            type="button"
            onClick={clearCallErrorNote}
            className="p-1 rounded-lg hover:bg-amber-500/20 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Center Stage: 1-on-1 OR Group Grid */}
      {call.mode === "direct" ? (
        <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
          {showRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover bg-slate-900"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-6 space-y-4">
              {call.remoteAvatar ? (
                <img
                  src={call.remoteAvatar}
                  alt={call.remoteName}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-2 border-slate-700 shadow-2xl"
                />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-800 border-2 border-slate-700 text-emerald-300 font-black text-3xl flex items-center justify-center shadow-2xl">
                  {getInitials(call.remoteName)}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-lg font-extrabold text-white">{call.remoteName}</p>
                <p className="text-xs text-slate-400">
                  {call.phase === "ringing_outgoing"
                    ? "Ringing..."
                    : call.phase === "connecting"
                    ? "Connecting..."
                    : isVideoCall && call.remoteVideoOff
                    ? "Camera Off"
                    : "Voice Call Active"}
                </p>
              </div>
            </div>
          )}

          {/* Local Video PiP */}
          {isVideoCall && showLocalVideo && (
            <div className="absolute right-3 bottom-3 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-2xl z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${call.cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div
            className={`grid gap-2.5 h-full content-start ${
              totalParticipants <= 2
                ? "grid-cols-1 sm:grid-cols-2"
                : totalParticipants <= 4
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {/* Self Tile */}
            <div className="relative rounded-2xl bg-slate-900 border border-emerald-500/40 overflow-hidden flex items-center justify-center min-h-[160px] sm:min-h-[210px]">
              {showLocalVideo ? (
                <video
                  ref={localGroupVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${call.cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xl flex items-center justify-center">
                    You
                  </div>
                  <p className="text-xs font-bold text-slate-300">
                    {call.isHost ? "Host (Aap)" : "You"}
                  </p>
                </div>
              )}
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-sm border border-white/10">
                <span className="text-xs font-bold text-white truncate">You</span>
                {call.isAudioMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
              </div>
            </div>

            {/* Remote Peers */}
            {call.groupPeers.map((peer) => (
              <GroupPeerTile key={peer.peerId} peer={peer} />
            ))}
          </div>

          {call.groupPeers.length === 0 && (
            <div className="mt-4 text-center px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-sm mx-auto">
              <p className="text-xs font-bold text-slate-200">
                Class Room Live Hai — Doosre members ke join karne ka intezar...
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Students &amp; Teachers ko Join Live Call banner dikh raha hai.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bottom Thumb-Zone Control Bar */}
      <div className="relative z-20 px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        <div className="max-w-md mx-auto rounded-3xl bg-slate-900/95 border border-slate-800 px-3 py-3 flex items-center justify-around gap-2 shadow-2xl">
          <button
            type="button"
            onClick={toggleCallAudioMute}
            className={`min-h-[48px] min-w-[48px] rounded-2xl flex flex-col items-center justify-center gap-0.5 px-2.5 cursor-pointer transition ${
              call.isAudioMuted
                ? "bg-white text-slate-950 font-bold"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
            title={call.isAudioMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {call.isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="text-[10px] font-bold">{call.isAudioMuted ? "Unmute" : "Mute"}</span>
          </button>

          {isVideoCall && (
            <button
              type="button"
              onClick={() => void toggleCallVideo()}
              className={`min-h-[48px] min-w-[48px] rounded-2xl flex flex-col items-center justify-center gap-0.5 px-2.5 cursor-pointer transition ${
                call.isVideoOff
                  ? "bg-white text-slate-950 font-bold"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200"
              }`}
              title={call.isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              {call.isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              <span className="text-[10px] font-bold">{call.isVideoOff ? "Cam On" : "Cam Off"}</span>
            </button>
          )}

          {isVideoCall && !call.isVideoOff && (
            <button
              type="button"
              onClick={() => void flipCallCamera()}
              className="min-h-[48px] min-w-[48px] rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex flex-col items-center justify-center gap-0.5 px-2.5 cursor-pointer transition"
              title="Flip Camera"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-[10px] font-bold">Flip</span>
            </button>
          )}

          {call.mode === "group" && call.isHost ? (
            <>
              <button
                type="button"
                onClick={() => void endCurrentCall(false)}
                className="min-h-[48px] px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition"
                title="Leave Call"
              >
                <PhoneOff className="w-5 h-5 text-amber-400" />
                <span className="text-[10px] font-bold">Leave</span>
              </button>
              <button
                type="button"
                onClick={() => void endCurrentCall(true)}
                className="min-h-[48px] px-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center gap-0.5 cursor-pointer transition shadow-lg"
                title="End Group Call for Everyone"
              >
                <PhoneOff className="w-5 h-5" />
                <span className="text-[10px] font-bold">End All</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void endCurrentCall(false)}
              className="min-h-[48px] px-5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center gap-2 cursor-pointer transition shadow-lg"
              title="End Call"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="text-xs font-extrabold">End</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Portal Host: registers identity globally, checks ?callId= notifications, and renders NstaCallModal once
export const NstaCallPortalHost: React.FC<{ identity: CallIdentity | null }> = ({ identity }) => {
  const hostId = useId();
  const isPrimary = useIsPrimaryCallModalHost(hostId);
  const checkedCallIdRef = useRef<string>("");

  useEffect(() => {
    return registerCallModalHost(hostId);
  }, [hostId]);

  useEffect(() => {
    registerCallIdentity(identity);
  }, [
    identity?.schoolId,
    identity?.userId,
    identity?.userName,
    identity?.userRole,
    identity?.userPhoto,
    identity?.classId,
    identity?.className,
    identity?.studentId,
    identity?.teacherId,
  ]);

  useEffect(() => {
    if (!identity?.schoolId || !identity?.userId || typeof window === "undefined") return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const callId = sp.get("callId");
      const callAction = sp.get("callAction");
      const actionKey = `${callId || ""}:${callAction || ""}`;
      if (callId && checkedCallIdRef.current !== actionKey) {
        checkedCallIdRef.current = actionKey;
        if (callAction) {
          try {
            sp.delete("callAction");
            const cleanedQuery = sp.toString();
            const nextUrl = `${window.location.pathname}${cleanedQuery ? `?${cleanedQuery}` : ""}${window.location.hash}`;
            window.history.replaceState({}, "", nextUrl);
          } catch {}
        }
        void checkAndJoinCallFromNotification(callId, {
          autoAccept: callAction === "accept",
        });
      }
    } catch {}
  }, [identity?.schoolId, identity?.userId]);

  useEffect(() => {
    if (!identity?.schoolId || !identity?.userId || typeof window === "undefined") return;
    const onNativeCallAction = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail || {};
      const callId = String(detail.callId || "").trim();
      const callAction = String(detail.callAction || "").trim();
      if (!callId) return;
      void checkAndJoinCallFromNotification(callId, {
        autoAccept: callAction === "accept",
      });
    };
    window.addEventListener("android-incoming-call-action", onNativeCallAction);
    return () => window.removeEventListener("android-incoming-call-action", onNativeCallAction);
  }, [identity?.schoolId, identity?.userId]);

  if (!isPrimary) return null;
  return <NstaCallModal />;
};
