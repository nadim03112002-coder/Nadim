// @ts-nocheck
/**
 * NSTA Voice Notification Engine
 * Provides smart, human-grade text-to-speech for all incoming school & student notifications
 * (Fee alerts, Attendance in/out, Homework, Messenger chats, Store bookings, Driver updates).
 */
import {
  announceIncomingVoiceCaller,
  isCallerVoiceAnnounceEnabled,
} from "./schoolCallerId";

export interface VoiceNotifyConfig {
  enabled: boolean;
  rate: number; // 0.8 to 1.5 (default 1.0)
  pitch: number; // 0.8 to 1.2 (default 1.0)
  volume: number; // 0 to 1 (default 1.0)
  preferredLang: "hi-IN" | "en-IN" | "en-US";
}

const STORAGE_KEY = "nst_voice_notification_config";

export const getVoiceNotifyConfig = (): VoiceNotifyConfig => {
  if (typeof window === "undefined") {
    return { enabled: true, rate: 1.0, pitch: 1.0, volume: 1.0, preferredLang: "hi-IN" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: true, rate: 1.0, pitch: 1.0, volume: 1.0, preferredLang: "hi-IN" };
};

export const saveVoiceNotifyConfig = (cfg: Partial<VoiceNotifyConfig>): VoiceNotifyConfig => {
  const current = getVoiceNotifyConfig();
  const next = { ...current, ...cfg };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
};

// Text cleaner specifically optimized for Indian school announcements
export const cleanTextForSpeech = (text: string): string => {
  if (!text) return "";

  let clean = text;

  // Replace Rupees symbol with "रुपये"
  clean = clean.replace(/₹\s*([0-9,]+)/g, "$1 रुपये");
  clean = clean.replace(/Rs\.?\s*([0-9,]+)/gi, "$1 रुपये");

  // Clean common abbreviations
  clean = clean.replace(/\bAdm\.?\s*No\.?:?\s*([a-zA-Z0-9_-]+)/gi, "एडमिशन नंबर $1");
  clean = clean.replace(/\bRoll\s*No\.?:?\s*([0-9]+)/gi, "रोल नंबर $1");
  clean = clean.replace(/\bStd\.?\b/gi, "कक्षा");
  clean = clean.replace(/\bSec\.?\b/gi, "सेक्शन");

  // Clean emojis and special symbols
  clean = clean.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F0F5}\u{1F200}-\u{1F270}]/gu, " ");

  // Strip Markdown characters (*, _, #, ~, `, [, ])
  clean = clean.replace(/[*_#~`[\]()]/g, " ");

  // Collapse consecutive whitespaces
  clean = clean.replace(/\s+/g, " ").trim();

  return clean;
};

// Find the best matching Hindi or Indian voice available on device
export const pickBestVoice = (voices: SpeechSynthesisVoice[], preferredLang: string = "hi-IN"): SpeechSynthesisVoice | null => {
  if (!voices || voices.length === 0) return null;

  // Priority 1: Exact language match for Hindi
  const hiVoice = voices.find(v => v.lang === "hi-IN" || v.lang.startsWith("hi"));
  if (preferredLang.startsWith("hi") && hiVoice) return hiVoice;

  // Priority 2: Indian English
  const inEnVoice = voices.find(v => v.lang === "en-IN" || v.name.toLowerCase().includes("india"));
  if (inEnVoice) return inEnVoice;

  // Priority 3: Google Hindi / Google Indian English if installed
  const googleVoice = voices.find(v => v.name.toLowerCase().includes("google") && (v.lang.includes("hi") || v.lang.includes("in")));
  if (googleVoice) return googleVoice;

  // Priority 4: Default language voice
  const langMatch = voices.find(v => v.lang.startsWith(preferredLang.slice(0, 2)));
  if (langMatch) return langMatch;

  return voices[0] || null;
};

let isSpeakingActive = false;
const recentSpokenCache = new Map<string, number>();

const normalizeDedupeKey = (title: string, body?: string, explicitKey?: string): string => {
  if (explicitKey && explicitKey.trim()) return `id:${explicitKey.trim()}`;
  const combined = `${title || ""}|${body || ""}`.replace(/\s+/g, " ").trim().toLowerCase();
  return `txt:${combined.slice(0, 180)}`;
};

const shouldSkipDuplicateSpeech = (key: string, windowMs = 12000): boolean => {
  if (!key) return false;
  const now = Date.now();
  const prev = recentSpokenCache.get(key);
  if (prev && now - prev < windowMs) {
    return true;
  }
  recentSpokenCache.set(key, now);
  if (recentSpokenCache.size > 100) {
    for (const [k, ts] of recentSpokenCache.entries()) {
      if (now - ts > 60000) recentSpokenCache.delete(k);
    }
  }
  return false;
};

// Pleasant two-tone chime (880Hz -> 1320Hz) alerting user before speech
export const playNotificationTone = () => {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    // Two-tone bell chime
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12); // E6

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {}
};

/**
 * Main speech trigger for any notification title & body
 */
export const speakNotification = (
  title: string,
  body?: string,
  options?: { force?: boolean; rate?: number; playTone?: boolean; dedupeKey?: string }
): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const config = getVoiceNotifyConfig();
  if (!config.enabled && !options?.force) {
    return false;
  }

  const dKey = normalizeDedupeKey(title, body, options?.dedupeKey);
  if (shouldSkipDuplicateSpeech(dKey)) {
    return false;
  }

  const rawContent = body ? `${title}. ${body}` : title;
  const cleanSpeech = cleanTextForSpeech(rawContent);
  if (!cleanSpeech) return false;

  // Prefer native Android TextToSpeech when running inside the LIFE MAKER APK
  const androidBridge = (window as any).LifeMakerAndroid;
  if (androidBridge && typeof androidBridge.speakNativeVoice === "function") {
    try {
      if (options?.playTone !== false) {
        playNotificationTone();
      }
      androidBridge.speakNativeVoice(cleanSpeech, dKey);
      return true;
    } catch {}
  }

  if (!("speechSynthesis" in window)) {
    return false;
  }

  try {
    if (options?.playTone !== false) {
      playNotificationTone();
    }

    // Cancel any previous speech so notifications don't overlap awkwardly
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      try { window.speechSynthesis.resume(); } catch {}
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = options?.rate || config.rate || 1.0;
    utterance.pitch = config.pitch || 1.0;
    utterance.volume = config.volume || 1.0;

    const voices = window.speechSynthesis.getVoices();
    const voice = pickBestVoice(voices, config.preferredLang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = config.preferredLang || "hi-IN";
    }

    utterance.onstart = () => {
      isSpeakingActive = true;
      window.dispatchEvent(new CustomEvent("nst_voice_speaking_state", { detail: { speaking: true, text: cleanSpeech } }));
    };

    utterance.onend = () => {
      isSpeakingActive = false;
      window.dispatchEvent(new CustomEvent("nst_voice_speaking_state", { detail: { speaking: false } }));
    };

    utterance.onerror = (e) => {
      isSpeakingActive = false;
      console.warn("[VoiceNotifyEngine] Speech error:", e);
      window.dispatchEvent(new CustomEvent("nst_voice_speaking_state", { detail: { speaking: false } }));
    };

    // Small delay if chime is playing so bell sounds first, then speech
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch {}
    }, 120);

    return true;
  } catch (err) {
    console.warn("[VoiceNotifyEngine] Failed to speak notification:", err);
    return false;
  }
};

/**
 * Stop currently playing voice
 */
export const stopVoiceNotification = () => {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      isSpeakingActive = false;
      window.dispatchEvent(new CustomEvent("nst_voice_speaking_state", { detail: { speaking: false } }));
    } catch {}
  }
};

/**
 * Play a test voice sample
 */
export const testVoiceNotificationSample = () => {
  return speakNotification(
    "नमस्ते!",
    "स्कूल नोटिफिकेशन आवाज़ सक्रिय है। अब सभी ज़रूरी संदेश बोलकर सुनाए जाएंगे।",
    { force: true, dedupeKey: `test_${Date.now()}` }
  );
};

// Global Listener initialization - connects to foreground notifications & tap-to-speak
if (typeof window !== "undefined") {
  // 1. Listen for foreground push/in-app notifications
  window.addEventListener("nst_foreground_notification", (event: any) => {
    const detail = event?.detail;
    if (detail?.alreadySpoken || detail?.suppressVoice) return;
    const rawVoice =
      detail?.voiceSpeak ??
      detail?.payload?.voiceSpeak ??
      detail?.payload?.data?.voiceSpeak;
    const notifType = String(
      detail?.type ||
        detail?.payload?.type ||
        detail?.payload?.data?.type ||
        ""
    )
      .trim()
      .toUpperCase();
    const voiceExplicitlyOff =
      rawVoice === false ||
      rawVoice === 0 ||
      String(rawVoice).trim() === "0" ||
      String(rawVoice).trim().toLowerCase() === "false";

    if (notifType === "CALL_INCOMING") {
      if (voiceExplicitlyOff || !isCallerVoiceAnnounceEnabled()) return;
      if (detail && (detail.title || detail.body)) {
        const spokenText = [detail.title, detail.body].filter(Boolean).join(". ");
        announceIncomingVoiceCaller({
          callerName: detail.senderName || detail.title || "School Staff",
          schoolName: detail.schoolName || "",
          callType: String(detail.title || "").toLowerCase().includes("video") ? "video" : "sim",
          dedupeKey: detail.id || detail.payload?.id || detail.payload?.data?.id,
          force: Boolean(detail.force),
        });
        if (!spokenText) return;
      }
      return;
    }

    const threadType = String(
      detail?.threadType ||
        detail?.payload?.threadType ||
        detail?.payload?.data?.threadType ||
        ""
    )
      .trim()
      .toUpperCase();
    const targetUrl = String(
      detail?.url || detail?.payload?.url || detail?.payload?.data?.url || ""
    );
    if (
      voiceExplicitlyOff ||
      threadType === "TEACHER_CHAT" ||
      threadType === "STUDENT_CHAT" ||
      targetUrl.includes("subTab=teacher") ||
      targetUrl.includes("subTab=friend")
    ) {
      return;
    }
    if (detail && (detail.title || detail.body)) {
      speakNotification(detail.title || "नया नोटिफिकेशन", detail.body, {
        dedupeKey: detail.id || detail.payload?.id || detail.payload?.data?.id,
        force: Boolean(detail.force),
      });
    }
  });

  // 2. Listen for explicit voice notice events
  window.addEventListener("nst_voice_speak_notice", (event: any) => {
    const detail = event?.detail;
    if (detail && (detail.title || detail.text)) {
      speakNotification(detail.title || detail.text, detail.body, {
        dedupeKey: detail.id,
        force: Boolean(detail.force),
      });
    }
  });

  // 3. User Gesture Audio & Speech Unlocker (pre-warm on first tap/interaction)
  let hasUnlockedAudio = false;
  const unlockAudioContext = () => {
    if (hasUnlockedAudio) return;
    hasUnlockedAudio = true;
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          void ctx.resume();
        }
      }
    } catch {}
    window.removeEventListener("click", unlockAudioContext);
    window.removeEventListener("touchstart", unlockAudioContext);
  };
  window.addEventListener("click", unlockAudioContext, { once: true, passive: true });
  window.addEventListener("touchstart", unlockAudioContext, { once: true, passive: true });
}

