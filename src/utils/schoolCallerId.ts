import type {
  AttendanceRecord,
  FeeCallFollowUpRecord,
  SchoolPublicInquiry,
} from "../school-types";

/**
 * Smart Caller Name Announcement & Offline School Caller ID Bridge
 * - Option A: Online pre-call voice announcement + NSTA Voice/Video Call spoken caller ID
 * - Option B: Syncs School / Teacher / Staff / Accountant + Reverse Parent & Enquiry Directory to Android APK
 *             for 100% offline CallScreeningService, Truecaller-style Floating Overlay & 4-fact Caller Card.
 */

export const CALLER_VOICE_ANNOUNCE_KEY = "nst_caller_voice_announce_v1";
export const PARENT_CALLER_ID_ENABLED_KEY = "nst_parent_caller_id_enabled_v1";
export const PARENT_CALLER_DUE_VOICE_KEY = "nst_parent_caller_due_voice_v1";
export const PARENT_CALLER_SCHEDULE_VOICE_KEY = "nst_parent_caller_schedule_voice_v1";
export const PARENT_CALLER_CARD_POPUP_KEY = "nst_parent_caller_card_popup_v1";
export const PARENT_CALLER_OVERLAY_KEY = "nst_parent_caller_overlay_v1";
export const CACHED_PARENT_CALLER_DIR_KEY = "nst_cached_parent_caller_dir_v1";
export const CACHED_ENQUIRY_CALLER_DIR_KEY = "nst_cached_enquiry_caller_dir_v1";

export interface ParentCallerIdOptions {
  parentCallerEnabled: boolean;
  dueVoiceEnabled: boolean;
  scheduleVoiceEnabled: boolean;
  cardPopupEnabled: boolean;
  overlayEnabled: boolean;
}

export interface ParentCallerChildSummary {
  id: string;
  name: string;
  classLabel: string;
  dueAmount: number;
  unpaidMonthsCount: number;
}

export interface CallerDirectoryEntry {
  phone: string;
  name: string;
  role: string;
  schoolName?: string;
  kind?: "STAFF" | "PARENT" | "ENQUIRY";
  studentSummary?: string;
  relationLabel?: string;
  fatherName?: string;
  primaryStudentId?: string;
  studentIds?: string[];
  classNames?: string[];
  dueAmount?: number;
  unpaidMonthsCount?: number;
  promiseDate?: string;
  promisedAmount?: number;
  nextCallDate?: string;
  solvedToday?: boolean;
  settled?: boolean;
  settledAt?: string;
  lastCallAt?: string;
  lastCallOutcome?: string;
  lastNote?: string;
  absentToday?: boolean;
  enquiryId?: string;
  enquiryStage?: string;
  enquiryFollowUpDate?: string;
  enquiryVisitDate?: string;
  enquiryNote?: string;
  counsellorName?: string;
}

export interface CachedParentCallerInfo {
  phone: string;
  name: string;
  schoolName: string;
  kind?: "PARENT" | "ENQUIRY";
  studentSummary: string;
  relationLabel: string;
  fatherName?: string;
  primaryStudentId?: string;
  studentIds: string[];
  classNames: string[];
  dueAmount: number;
  unpaidMonthsCount: number;
  promiseDate?: string;
  promisedAmount?: number;
  nextCallDate?: string;
  solvedToday: boolean;
  resolvedTodayDate?: string;
  resolvedNote?: string;
  settled: boolean;
  settledAt?: string;
  lastCallAt?: string;
  lastCallOutcome?: string;
  lastNote?: string;
  absentToday?: boolean;
  enquiryId?: string;
  enquiryStage?: string;
  enquiryFollowUpDate?: string;
  enquiryVisitDate?: string;
  enquiryNote?: string;
  counsellorName?: string;
  postCall?: boolean;
  children: ParentCallerChildSummary[];
  isTestSample?: boolean;
}

export interface NativeCallerIdStatus {
  isNativeApp: boolean;
  supported: boolean;
  isRoleHeld: boolean;
  hasPhonePerms: boolean;
  isReady: boolean;
  cachedCount: number;
  schoolName: string;
  voiceEnabled: boolean;
  batteryUnrestricted: boolean;
  parentCallerEnabled: boolean;
  parentDueVoiceEnabled: boolean;
  parentScheduleVoiceEnabled: boolean;
  parentCardPopupEnabled: boolean;
  parentOverlayEnabled: boolean;
  canDrawOverlays: boolean;
}

interface CallerIdAndroidBridge {
  isNativeApp?: () => boolean;
  syncSchoolCallerDirectory?: (jsonStr: string) => number;
  isCallerVoiceAnnounceEnabled?: () => boolean;
  setCallerVoiceAnnounceEnabled?: (enabled: boolean) => void;
  setParentCallerIdOptions?: (jsonStr: string) => void;
  getLastIncomingParentCall?: () => string;
  clearLastIncomingParentCall?: () => void;
  getCallerIdStatus?: () => string;
  requestOfflineCallerIdPermission?: () => void;
  hasOverlayPermission?: () => boolean;
  requestOverlayPermission?: () => void;
  isIgnoringBatteryOptimizations?: () => boolean;
  openBatteryOptimizationSettings?: () => void;
  speakNativeIncomingCall?: (text: string, dedupeKey: string) => void;
  speakNativeVoice?: (text: string, dedupeKey: string) => void;
  stopNativeVoice?: () => void;
}

function getBridge(): CallerIdAndroidBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { LifeMakerAndroid?: CallerIdAndroidBridge }).LifeMakerAndroid;
}

function readBoolPref(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === "false") return false;
    if (raw === "true") return true;
  } catch {}
  return defaultValue;
}

export function getTodayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Extracts student IDs marked ABSENT (or LEAVE) today from attendance logs,
 * supporting both modern `students` map and legacy `records` array formats.
 */
export function extractTodayAbsentStudentIds(
  attendanceLogs: Array<AttendanceRecord | Record<string, any>>,
  todayYmd = getTodayLocalYmd()
): string[] {
  const absentIds = new Set<string>();
  for (const log of attendanceLogs || []) {
    if (!log || String((log as any).date || "") !== todayYmd) continue;
    const studentsMap = (log as AttendanceRecord).students;
    if (studentsMap && typeof studentsMap === "object" && !Array.isArray(studentsMap)) {
      Object.entries(studentsMap).forEach(([stuId, entry]) => {
        if (!entry) return;
        const stStr = String(entry.status || "").toLowerCase();
        if (entry.present === false || stStr === "absent" || stStr === "leave") {
          if (stuId) absentIds.add(stuId);
        }
      });
    }
    const legacyRecords = (log as any).records;
    if (Array.isArray(legacyRecords)) {
      for (const rec of legacyRecords) {
        if (!rec) continue;
        const stStr = String(rec.status || "").toUpperCase();
        const sid = String(rec.studentId || rec.id || "").trim();
        if (sid && (stStr === "ABSENT" || stStr === "LEAVE" || rec.present === false)) {
          absentIds.add(sid);
        }
      }
    }
  }
  return Array.from(absentIds);
}

export function getParentCallerIdOptions(): ParentCallerIdOptions {
  return {
    parentCallerEnabled: readBoolPref(PARENT_CALLER_ID_ENABLED_KEY, true),
    dueVoiceEnabled: readBoolPref(PARENT_CALLER_DUE_VOICE_KEY, true),
    scheduleVoiceEnabled: readBoolPref(PARENT_CALLER_SCHEDULE_VOICE_KEY, false),
    cardPopupEnabled: readBoolPref(PARENT_CALLER_CARD_POPUP_KEY, true),
    overlayEnabled: readBoolPref(PARENT_CALLER_OVERLAY_KEY, true),
  };
}

export function syncParentCallerOptionsToAndroid(opts?: ParentCallerIdOptions): void {
  if (typeof window === "undefined") return;
  const resolved = opts || getParentCallerIdOptions();
  try {
    const bridge = getBridge();
    if (bridge && typeof bridge.setParentCallerIdOptions === "function") {
      bridge.setParentCallerIdOptions(JSON.stringify(resolved));
    }
  } catch {}
}

export function setParentCallerIdOptions(
  partial: Partial<ParentCallerIdOptions>
): ParentCallerIdOptions {
  const current = getParentCallerIdOptions();
  const next: ParentCallerIdOptions = {
    parentCallerEnabled:
      typeof partial.parentCallerEnabled === "boolean"
        ? partial.parentCallerEnabled
        : current.parentCallerEnabled,
    dueVoiceEnabled:
      typeof partial.dueVoiceEnabled === "boolean"
        ? partial.dueVoiceEnabled
        : current.dueVoiceEnabled,
    scheduleVoiceEnabled:
      typeof partial.scheduleVoiceEnabled === "boolean"
        ? partial.scheduleVoiceEnabled
        : current.scheduleVoiceEnabled,
    cardPopupEnabled:
      typeof partial.cardPopupEnabled === "boolean"
        ? partial.cardPopupEnabled
        : current.cardPopupEnabled,
    overlayEnabled:
      typeof partial.overlayEnabled === "boolean"
        ? partial.overlayEnabled
        : current.overlayEnabled,
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        PARENT_CALLER_ID_ENABLED_KEY,
        next.parentCallerEnabled ? "true" : "false"
      );
      localStorage.setItem(
        PARENT_CALLER_DUE_VOICE_KEY,
        next.dueVoiceEnabled ? "true" : "false"
      );
      localStorage.setItem(
        PARENT_CALLER_SCHEDULE_VOICE_KEY,
        next.scheduleVoiceEnabled ? "true" : "false"
      );
      localStorage.setItem(
        PARENT_CALLER_CARD_POPUP_KEY,
        next.cardPopupEnabled ? "true" : "false"
      );
      localStorage.setItem(
        PARENT_CALLER_OVERLAY_KEY,
        next.overlayEnabled ? "true" : "false"
      );
    } catch {}
    syncParentCallerOptionsToAndroid(next);
    try {
      window.dispatchEvent(
        new CustomEvent("nst-parent-caller-options-changed", { detail: next })
      );
    } catch {}
  }

  return next;
}

export function isCallerVoiceAnnounceEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(CALLER_VOICE_ANNOUNCE_KEY);
    if (stored === "false") return false;
    if (stored === "true") return true;
    const bridge = getBridge();
    if (bridge && typeof bridge.isCallerVoiceAnnounceEnabled === "function") {
      return Boolean(bridge.isCallerVoiceAnnounceEnabled());
    }
  } catch {}
  return true;
}

export function setCallerVoiceAnnounceEnabled(enabled: boolean): boolean {
  if (typeof window === "undefined") return enabled;
  try {
    localStorage.setItem(CALLER_VOICE_ANNOUNCE_KEY, enabled ? "true" : "false");
  } catch {}
  try {
    const bridge = getBridge();
    if (bridge && typeof bridge.setCallerVoiceAnnounceEnabled === "function") {
      bridge.setCallerVoiceAnnounceEnabled(enabled);
    }
    if (!enabled) {
      stopIncomingVoiceCallerSpeech();
    }
  } catch {}
  try {
    window.dispatchEvent(
      new CustomEvent("nst-caller-voice-setting-changed", { detail: { enabled } })
    );
  } catch {}
  return enabled;
}

export function getNativeCallerIdStatus(): NativeCallerIdStatus {
  const bridge = getBridge();
  const isNativeApp = Boolean(bridge?.isNativeApp?.());
  const localVoiceEnabled = isCallerVoiceAnnounceEnabled();
  const localParentOpts = getParentCallerIdOptions();

  if (!bridge || typeof bridge.getCallerIdStatus !== "function") {
    return {
      isNativeApp,
      supported: false,
      isRoleHeld: false,
      hasPhonePerms: false,
      isReady: false,
      cachedCount: 0,
      schoolName: "",
      voiceEnabled: localVoiceEnabled,
      batteryUnrestricted: false,
      parentCallerEnabled: localParentOpts.parentCallerEnabled,
      parentDueVoiceEnabled: localParentOpts.dueVoiceEnabled,
      parentScheduleVoiceEnabled: localParentOpts.scheduleVoiceEnabled,
      parentCardPopupEnabled: localParentOpts.cardPopupEnabled,
      parentOverlayEnabled: localParentOpts.overlayEnabled,
      canDrawOverlays: false,
    };
  }

  try {
    const raw = bridge.getCallerIdStatus();
    const parsed = raw ? JSON.parse(raw) : {};
    const batteryFlag =
      typeof parsed?.batteryUnrestricted === "boolean"
        ? parsed.batteryUnrestricted
        : typeof bridge.isIgnoringBatteryOptimizations === "function"
          ? Boolean(bridge.isIgnoringBatteryOptimizations())
          : false;
    const overlayPerm =
      typeof parsed?.canDrawOverlays === "boolean"
        ? parsed.canDrawOverlays
        : typeof bridge.hasOverlayPermission === "function"
          ? Boolean(bridge.hasOverlayPermission())
          : false;

    return {
      isNativeApp: true,
      supported: Boolean(parsed?.supported),
      isRoleHeld: Boolean(parsed?.isRoleHeld),
      hasPhonePerms: Boolean(parsed?.hasPhonePerms),
      isReady: Boolean(parsed?.isReady),
      cachedCount: Number(parsed?.cachedCount || 0),
      schoolName: String(parsed?.schoolName || ""),
      voiceEnabled:
        typeof parsed?.voiceEnabled === "boolean" ? parsed.voiceEnabled : localVoiceEnabled,
      batteryUnrestricted: batteryFlag,
      parentCallerEnabled:
        typeof parsed?.parentCallerEnabled === "boolean"
          ? parsed.parentCallerEnabled
          : localParentOpts.parentCallerEnabled,
      parentDueVoiceEnabled:
        typeof parsed?.parentDueVoiceEnabled === "boolean"
          ? parsed.parentDueVoiceEnabled
          : localParentOpts.dueVoiceEnabled,
      parentScheduleVoiceEnabled:
        typeof parsed?.parentScheduleVoiceEnabled === "boolean"
          ? parsed.parentScheduleVoiceEnabled
          : localParentOpts.scheduleVoiceEnabled,
      parentCardPopupEnabled:
        typeof parsed?.parentCardPopupEnabled === "boolean"
          ? parsed.parentCardPopupEnabled
          : localParentOpts.cardPopupEnabled,
      parentOverlayEnabled:
        typeof parsed?.parentOverlayEnabled === "boolean"
          ? parsed.parentOverlayEnabled
          : localParentOpts.overlayEnabled,
      canDrawOverlays: overlayPerm,
    };
  } catch {
    return {
      isNativeApp,
      supported: false,
      isRoleHeld: false,
      hasPhonePerms: false,
      isReady: false,
      cachedCount: 0,
      schoolName: "",
      voiceEnabled: localVoiceEnabled,
      batteryUnrestricted: false,
      parentCallerEnabled: localParentOpts.parentCallerEnabled,
      parentDueVoiceEnabled: localParentOpts.dueVoiceEnabled,
      parentScheduleVoiceEnabled: localParentOpts.scheduleVoiceEnabled,
      parentCardPopupEnabled: localParentOpts.cardPopupEnabled,
      parentOverlayEnabled: localParentOpts.overlayEnabled,
      canDrawOverlays: false,
    };
  }
}

export function getLastNativeIncomingParentCall(): Partial<CachedParentCallerInfo> & {
  phone: string;
  receivedAtMs?: number;
} | null {
  const bridge = getBridge();
  if (!bridge || typeof bridge.getLastIncomingParentCall !== "function") return null;
  try {
    const raw = bridge.getLastIncomingParentCall();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLastNativeIncomingParentCall(): void {
  const bridge = getBridge();
  if (!bridge || typeof bridge.clearLastIncomingParentCall !== "function") return;
  try {
    bridge.clearLastIncomingParentCall();
  } catch {}
}

export function hasAndroidOverlayPermission(): boolean {
  const bridge = getBridge();
  if (!bridge) return false;
  if (typeof bridge.hasOverlayPermission === "function") {
    try {
      return Boolean(bridge.hasOverlayPermission());
    } catch {
      return false;
    }
  }
  return getNativeCallerIdStatus().canDrawOverlays;
}

export function requestAndroidOverlayPermission(): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.requestOverlayPermission !== "function") {
    return false;
  }
  try {
    bridge.requestOverlayPermission();
    return true;
  } catch {
    return false;
  }
}

export function isAndroidBatteryUnrestricted(): boolean {
  const bridge = getBridge();
  if (!bridge) return false;
  if (typeof bridge.isIgnoringBatteryOptimizations === "function") {
    try {
      return Boolean(bridge.isIgnoringBatteryOptimizations());
    } catch {
      return false;
    }
  }
  return getNativeCallerIdStatus().batteryUnrestricted;
}

export function openAndroidBatteryOptimizationSettings(): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.openBatteryOptimizationSettings !== "function") {
    return false;
  }
  try {
    bridge.openBatteryOptimizationSettings();
    return true;
  } catch {
    return false;
  }
}

export function requestNativeOfflineCallerIdPermission(): boolean {
  const bridge = getBridge();
  if (!bridge || typeof bridge.requestOfflineCallerIdPermission !== "function") {
    return false;
  }
  try {
    bridge.requestOfflineCallerIdPermission();
    return true;
  } catch {
    return false;
  }
}

const INVALID_DUMMY_PHONES = new Set([
  "1234567890",
  "9876543210",
  "0123456789",
  "9999999999",
  "8888888888",
  "7777777777",
  "6666666666",
  "0000000000",
  "1111111111",
]);

export function normalizePhoneLast10(raw?: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (INVALID_DUMMY_PHONES.has(last10) || /^(\d)\1{9}$/.test(last10)) {
      return "";
    }
    return last10;
  }
  if (digits.length >= 6 && !/^(\d)\1+$/.test(digits)) {
    return digits;
  }
  return "";
}

function formatShortSpokenDate(ymd?: string): string {
  if (!ymd) return "";
  const clean = ymd.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return clean;
  const dateObj = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(dateObj.getTime())) return clean;
  const today = getTodayLocalYmd();
  if (clean === today) return "aaj";
  return dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

let lastSyncedDirectorySignature = "";

export function syncSchoolDirectoryToAndroid(params: {
  school?: {
    id?: string;
    name?: string;
    phone?: string;
    principalName?: string;
  } | null;
  schoolName?: string;
  teachers?: Array<{ name?: string; phone?: string; designation?: string; subject?: string }>;
  accountants?: Array<{ name?: string; phone?: string; designation?: string }>;
  staffEmployees?: Array<{ name?: string; phone?: string; designation?: string; role?: string }>;
  students?: Array<{
    id?: string;
    name?: string;
    fatherName?: string;
    motherName?: string;
    classId?: string;
    className?: string;
    phone?: string;
    fatherPhone?: string;
    motherPhone?: string;
    parentPhone?: string;
    mobile?: string;
    whatsapp?: string;
  }>;
  classes?: Array<{ id?: string; name?: string; section?: string }>;
  fees?: Array<{
    studentId?: string;
    paid?: boolean;
    status?: string;
    monthlyAmount?: number;
    amount?: number;
    paidAmount?: number;
    balanceDue?: number;
    isPreAdmission?: boolean;
    isUpcoming?: boolean;
  }>;
  feeCallFollowUps?: FeeCallFollowUpRecord[];
  absentStudentIds?: string[];
  inquiries?: SchoolPublicInquiry[];
}): number {
  const resolvedSchoolName = String(
    params.school?.name || params.schoolName || "School"
  ).trim();

  const seenStaff = new Set<string>();
  const seenParentPhones = new Set<string>();
  const entries: CallerDirectoryEntry[] = [];
  const cachedParents: CachedParentCallerInfo[] = [];
  const cachedEnquiries: CachedParentCallerInfo[] = [];

  const pushStaffEntry = (
    rawPhone: string | undefined,
    rawName: string | undefined,
    rawRole: string
  ) => {
    const key = normalizePhoneLast10(rawPhone);
    const name = String(rawName || "").trim();
    if (!key || !name || seenStaff.has(key)) return;
    seenStaff.add(key);
    entries.push({
      phone: key,
      name,
      role: rawRole.trim(),
      schoolName: resolvedSchoolName,
      kind: "STAFF",
    });
  };

  if (params.school?.phone) {
    pushStaffEntry(
      params.school.phone,
      params.school.principalName?.trim() || resolvedSchoolName,
      "Principal / School Office"
    );
  }

  for (const t of params.teachers || []) {
    if (!t?.phone) continue;
    pushStaffEntry(t.phone, t.name, t.designation || "Teacher");
  }

  for (const a of params.accountants || []) {
    if (!a?.phone) continue;
    pushStaffEntry(a.phone, a.name, a.designation || "Accountant");
  }

  for (const s of params.staffEmployees || []) {
    if (!s?.phone) continue;
    pushStaffEntry(s.phone, s.name, s.designation || s.role || "School Staff");
  }

  const absentSet = new Set(params.absentStudentIds || []);

  // Reverse Parent Caller ID (ONLY when caller passes students list — never on student devices)
  if (params.students && params.students.length > 0) {
    const todayYmd = getTodayLocalYmd();
    const classLabelMap = new Map<string, string>();
    for (const cls of params.classes || []) {
      if (!cls?.id) continue;
      const lbl = `${cls.name || ""}${cls.section ? ` ${cls.section}` : ""}`.trim();
      if (lbl) classLabelMap.set(cls.id, lbl);
    }

    const dueByStudentId = new Map<string, { amount: number; months: number }>();
    for (const fee of params.fees || []) {
      if (!fee?.studentId) continue;
      if (
        fee.isPreAdmission ||
        fee.status === "pre_admission" ||
        fee.isUpcoming ||
        fee.status === "upcoming"
      ) {
        continue;
      }
      const isPaid = typeof fee.paid === "boolean" ? fee.paid : fee.status === "paid";
      if (isPaid) continue;
      const billed = Number(fee.monthlyAmount ?? fee.amount ?? 0);
      const paidAmt = Number(fee.paidAmount ?? 0);
      const rem = Number(
        fee.balanceDue !== undefined ? fee.balanceDue : Math.max(0, billed - paidAmt)
      );
      if (rem > 0) {
        const prev = dueByStudentId.get(fee.studentId) || { amount: 0, months: 0 };
        prev.amount += rem;
        prev.months += 1;
        dueByStudentId.set(fee.studentId, prev);
      }
    }

    const followUpByStudentId = new Map<string, FeeCallFollowUpRecord>();
    const followUpByPhone = new Map<string, FeeCallFollowUpRecord>();
    for (const fu of params.feeCallFollowUps || []) {
      if (!fu) continue;
      if (fu.studentId) {
        followUpByStudentId.set(fu.studentId, fu);
      }
      const fPhone = normalizePhoneLast10(fu.phone);
      if (fPhone) {
        followUpByPhone.set(fPhone, fu);
      }
    }

    const parentGroups = new Map<
      string,
      {
        fatherName: string;
        onlyMotherNumber: boolean;
        hasNonMotherNumber: boolean;
        children: ParentCallerChildSummary[];
        studentIds: string[];
        seenStudentIds: Set<string>;
      }
    >();

    for (const st of params.students) {
      if (!st) continue;
      const stName = String(st.name || "").trim();
      if (!stName) continue;

      const clsLabel =
        String(st.className || "").trim() ||
        (st.classId ? classLabelMap.get(st.classId) || "" : "");
      const dueStats = st.id
        ? dueByStudentId.get(st.id) || { amount: 0, months: 0 }
        : { amount: 0, months: 0 };
      const stId = String(st.id || `${stName}_${clsLabel}`).trim();

      const phoneCandidates: Array<{ raw?: string; isMother: boolean }> = [
        { raw: st.fatherPhone, isMother: false },
        { raw: st.phone, isMother: false },
        { raw: st.parentPhone, isMother: false },
        { raw: st.mobile, isMother: false },
        { raw: st.whatsapp, isMother: false },
        { raw: st.motherPhone, isMother: true },
      ];

      const studentKeysSeen = new Set<string>();
      for (const candidate of phoneCandidates) {
        const key = normalizePhoneLast10(candidate.raw);
        if (!key || seenStaff.has(key) || studentKeysSeen.has(key)) continue;
        studentKeysSeen.add(key);

        const existing = parentGroups.get(key) || {
          fatherName: String(st.fatherName || "").trim(),
          onlyMotherNumber: candidate.isMother,
          hasNonMotherNumber: !candidate.isMother,
          children: [],
          studentIds: [],
          seenStudentIds: new Set<string>(),
        };

        if (!candidate.isMother) {
          existing.hasNonMotherNumber = true;
          existing.onlyMotherNumber = false;
        }
        if (!existing.fatherName && st.fatherName) {
          existing.fatherName = String(st.fatherName).trim();
        }
        if (!existing.seenStudentIds.has(stId)) {
          existing.seenStudentIds.add(stId);
          existing.studentIds.push(stId);
          existing.children.push({
            id: stId,
            name: stName,
            classLabel: clsLabel,
            dueAmount: dueStats.amount,
            unpaidMonthsCount: dueStats.months,
          });
        }
        parentGroups.set(key, existing);
      }
    }

    parentGroups.forEach((grp, key) => {
      if (grp.children.length === 0) return;
      seenParentPhones.add(key);
      const firstChild = grp.children[0];
      const relationLabel =
        grp.onlyMotherNumber && !grp.hasNonMotherNumber
          ? "Mother"
          : grp.fatherName
            ? "Father"
            : "Parent";

      const displayName = grp.fatherName
        ? `${grp.fatherName} ji (${relationLabel})`
        : `${firstChild.name} ke ${relationLabel}`;

      let studentSummary = "";
      if (grp.children.length === 1) {
        studentSummary = firstChild.classLabel
          ? `${firstChild.classLabel} ke ${firstChild.name}`
          : firstChild.name;
      } else {
        const firstPart = firstChild.classLabel
          ? `${firstChild.classLabel} ke ${firstChild.name}`
          : firstChild.name;
        const secondChild = grp.children[1];
        const secondPart = secondChild.classLabel
          ? `${secondChild.name} (${secondChild.classLabel})`
          : secondChild.name;
        const extra = grp.children.length > 2 ? ` +${grp.children.length - 2}` : "";
        studentSummary = `${firstPart} aur ${secondPart}${extra}`;
      }

      const totalDue = grp.children.reduce((sum, c) => sum + c.dueAmount, 0);
      const totalUnpaidMonths = grp.children.reduce((sum, c) => sum + c.unpaidMonthsCount, 0);
      const classNames = Array.from(
        new Set(grp.children.map((c) => c.classLabel).filter(Boolean))
      );
      const absentToday = grp.studentIds.some((id) => absentSet.has(id));

      const familyFollowUps: FeeCallFollowUpRecord[] = [];
      for (const sid of grp.studentIds) {
        const fu = followUpByStudentId.get(sid);
        if (fu) familyFollowUps.push(fu);
      }
      const phoneFu = followUpByPhone.get(key);
      if (phoneFu && !familyFollowUps.includes(phoneFu)) {
        familyFollowUps.push(phoneFu);
      }

      let promiseDate = "";
      let promisedAmount = 0;
      let nextCallDate = "";
      let resolvedTodayDate = "";
      let resolvedNote = "";
      let settled = false;
      let settledAt = "";
      let lastCallAt = "";
      let lastCallOutcome = "";
      let lastNote = "";

      for (const fu of familyFollowUps) {
        if (fu.promiseDate && (!promiseDate || fu.promiseDate < promiseDate)) {
          promiseDate = fu.promiseDate;
        }
        if (fu.promisedAmount && fu.promisedAmount > promisedAmount) {
          promisedAmount = Number(fu.promisedAmount);
        }
        if (fu.nextCallDate && (!nextCallDate || fu.nextCallDate < nextCallDate)) {
          nextCallDate = fu.nextCallDate;
        }
        if (fu.resolvedTodayDate === todayYmd) {
          resolvedTodayDate = todayYmd;
          if (fu.resolvedNote) resolvedNote = fu.resolvedNote;
        }
        if (fu.settled) {
          settled = true;
          if (fu.settledAt && fu.settledAt > settledAt) settledAt = fu.settledAt;
        }
        if (fu.lastCallAt && (!lastCallAt || fu.lastCallAt > lastCallAt)) {
          lastCallAt = fu.lastCallAt;
          lastCallOutcome = fu.lastCallOutcome || "";
        }
        if (fu.lastNote && !lastNote) {
          lastNote = fu.lastNote;
        }
      }

      const solvedToday =
        resolvedTodayDate === todayYmd ||
        (settled && totalDue <= 0) ||
        (Boolean(settledAt) && settledAt.slice(0, 10) === todayYmd);

      const childCompact = grp.children
        .slice(0, 2)
        .map((c) => (c.classLabel ? `${c.name} (${c.classLabel})` : c.name))
        .join(" & ");
      const extraTag = grp.children.length > 2 ? ` +${grp.children.length - 2}` : "";
      const dueTag =
        totalDue > 0 ? `, ₹${totalDue.toLocaleString("en-IN")} fee baki` : ", Fee clear";
      const absentTag = absentToday ? "Aaj Absent · " : "";
      const roleDesc = `${absentTag}${childCompact}${extraTag}${dueTag}`.trim();

      entries.push({
        phone: key,
        name: displayName,
        role: roleDesc,
        schoolName: resolvedSchoolName,
        kind: "PARENT",
        studentSummary,
        relationLabel,
        fatherName: grp.fatherName || undefined,
        primaryStudentId: firstChild.id,
        studentIds: grp.studentIds,
        classNames,
        dueAmount: totalDue,
        unpaidMonthsCount: totalUnpaidMonths,
        promiseDate: promiseDate || undefined,
        promisedAmount: promisedAmount || undefined,
        nextCallDate: nextCallDate || undefined,
        solvedToday,
        settled,
        settledAt: settledAt || undefined,
        lastCallAt: lastCallAt || undefined,
        lastCallOutcome: lastCallOutcome || undefined,
        lastNote: lastNote || undefined,
        absentToday,
      });

      cachedParents.push({
        phone: key,
        name: displayName,
        schoolName: resolvedSchoolName,
        kind: "PARENT",
        studentSummary,
        relationLabel,
        fatherName: grp.fatherName || undefined,
        primaryStudentId: firstChild.id,
        studentIds: grp.studentIds,
        classNames,
        dueAmount: totalDue,
        unpaidMonthsCount: totalUnpaidMonths,
        promiseDate: promiseDate || undefined,
        promisedAmount: promisedAmount || undefined,
        nextCallDate: nextCallDate || undefined,
        solvedToday,
        resolvedTodayDate: resolvedTodayDate || undefined,
        resolvedNote: resolvedNote || undefined,
        settled,
        settledAt: settledAt || undefined,
        lastCallAt: lastCallAt || undefined,
        lastCallOutcome: lastCallOutcome || undefined,
        lastNote: lastNote || undefined,
        absentToday,
        children: grp.children,
      });
    });
  }

  // Open Admission Enquiries Caller ID (ONLY on Admin/Accountant/Teacher devices when inquiries passed)
  const seenEnquiryPhones = new Set<string>();
  if (params.inquiries && params.inquiries.length > 0) {
    for (const inq of params.inquiries) {
      if (!inq) continue;
      if (inq.status === "lost" || inq.status === "admitted" || inq.status === "resolved") {
        continue;
      }
      const key = normalizePhoneLast10(inq.phone);
      if (!key || seenStaff.has(key) || seenParentPhones.has(key) || seenEnquiryPhones.has(key)) {
        continue;
      }
      const callerName = String(inq.name || "").trim();
      if (!callerName) continue;
      seenEnquiryPhones.add(key);

      const childPart = String(inq.studentName || "").trim();
      const classPart = String(inq.studentClass || "").trim();
      const studentSummary =
        classPart && childPart
          ? `${classPart} (${childPart})`
          : classPart || childPart || "Admission";

      const stageLabel = inq.status || "new";
      const noteText = String(inq.remarks || inq.message || "").trim();

      entries.push({
        phone: key,
        name: callerName,
        role: `Admission Enquiry · ${studentSummary}`,
        schoolName: resolvedSchoolName,
        kind: "ENQUIRY",
        studentSummary,
        relationLabel: "Enquiry",
        dueAmount: 0,
        unpaidMonthsCount: 0,
        enquiryId: inq.id,
        enquiryStage: stageLabel,
        enquiryFollowUpDate: inq.followUpDate || undefined,
        enquiryVisitDate: inq.visitDate || undefined,
        enquiryNote: noteText || undefined,
        counsellorName: inq.counsellorName || undefined,
        nextCallDate: inq.followUpDate || inq.visitDate || undefined,
        lastNote: noteText || undefined,
      });

      cachedEnquiries.push({
        phone: key,
        name: callerName,
        schoolName: resolvedSchoolName,
        kind: "ENQUIRY",
        studentSummary,
        relationLabel: "Enquiry",
        studentIds: [],
        classNames: classPart ? [classPart] : [],
        dueAmount: 0,
        unpaidMonthsCount: 0,
        solvedToday: false,
        settled: false,
        enquiryId: inq.id,
        enquiryStage: stageLabel,
        enquiryFollowUpDate: inq.followUpDate || undefined,
        enquiryVisitDate: inq.visitDate || undefined,
        enquiryNote: noteText || undefined,
        counsellorName: inq.counsellorName || undefined,
        nextCallDate: inq.followUpDate || inq.visitDate || undefined,
        lastNote: noteText || undefined,
        children: [],
      });
    }
  }

  // Always cache normalized directory locally so Web UI & IncomingParentCallModal work seamlessly
  try {
    localStorage.setItem(
      "nst_cached_school_caller_dir_meta",
      JSON.stringify({
        schoolName: resolvedSchoolName,
        count: entries.length,
        staffCount: entries.filter((e) => e.kind === "STAFF").length,
        parentCount: cachedParents.length,
        enquiryCount: cachedEnquiries.length,
      })
    );
    if (params.students && params.students.length > 0) {
      localStorage.setItem(
        CACHED_PARENT_CALLER_DIR_KEY,
        JSON.stringify({
          schoolName: resolvedSchoolName,
          updatedAt: Date.now(),
          parents: cachedParents,
        })
      );
    }
    if (params.inquiries) {
      localStorage.setItem(
        CACHED_ENQUIRY_CALLER_DIR_KEY,
        JSON.stringify({
          schoolName: resolvedSchoolName,
          updatedAt: Date.now(),
          enquiries: cachedEnquiries,
        })
      );
    }
  } catch {}

  const bridge = getBridge();
  if (!bridge || typeof bridge.syncSchoolCallerDirectory !== "function" || entries.length === 0) {
    return entries.length;
  }

  const sig = `${resolvedSchoolName}|${entries
    .map(
      (e) =>
        `${e.phone}:${e.kind || "STAFF"}:${e.name}:${e.dueAmount ?? 0}:${e.promiseDate || ""}:${e.nextCallDate || ""}:${e.solvedToday ? 1 : 0}:${e.absentToday ? 1 : 0}:${e.enquiryStage || ""}:${e.lastNote || ""}`
    )
    .join("|")}`;
  if (sig === lastSyncedDirectorySignature) {
    return entries.length;
  }

  try {
    const savedCount = bridge.syncSchoolCallerDirectory(
      JSON.stringify({
        schoolName: resolvedSchoolName,
        entries,
      })
    );
    lastSyncedDirectorySignature = sig;
    if (typeof bridge.setCallerVoiceAnnounceEnabled === "function") {
      bridge.setCallerVoiceAnnounceEnabled(isCallerVoiceAnnounceEnabled());
    }
    syncParentCallerOptionsToAndroid();
    return savedCount || entries.length;
  } catch {
    return 0;
  }
}

export function getCachedDirectoryMeta(): {
  schoolName: string;
  count: number;
  staffCount: number;
  parentCount: number;
  enquiryCount: number;
} {
  if (typeof window === "undefined") {
    return { schoolName: "", count: 0, staffCount: 0, parentCount: 0, enquiryCount: 0 };
  }
  try {
    const raw = localStorage.getItem("nst_cached_school_caller_dir_meta");
    if (!raw) {
      return { schoolName: "", count: 0, staffCount: 0, parentCount: 0, enquiryCount: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      schoolName: String(parsed?.schoolName || ""),
      count: Number(parsed?.count || 0),
      staffCount: Number(parsed?.staffCount || 0),
      parentCount: Number(parsed?.parentCount || 0),
      enquiryCount: Number(parsed?.enquiryCount || 0),
    };
  } catch {
    return { schoolName: "", count: 0, staffCount: 0, parentCount: 0, enquiryCount: 0 };
  }
}

export function getAllCachedParentCallers(): CachedParentCallerInfo[] {
  if (typeof window === "undefined") return [];
  const results: CachedParentCallerInfo[] = [];
  try {
    const raw = localStorage.getItem(CACHED_PARENT_CALLER_DIR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.parents)) {
        results.push(...parsed.parents);
      }
    }
  } catch {}
  try {
    const rawEnq = localStorage.getItem(CACHED_ENQUIRY_CALLER_DIR_KEY);
    if (rawEnq) {
      const parsedEnq = JSON.parse(rawEnq);
      if (Array.isArray(parsedEnq?.enquiries)) {
        results.push(...parsedEnq.enquiries);
      }
    }
  } catch {}
  return results;
}

export function findCachedParentCallerByPhone(rawPhone?: string): CachedParentCallerInfo | null {
  const key = normalizePhoneLast10(rawPhone);
  if (!key) return null;
  const all = getAllCachedParentCallers();
  return (
    all.find(
      (p) =>
        p.phone === key ||
        (key.length >= 7 && (p.phone.endsWith(key) || key.endsWith(p.phone)))
    ) || null
  );
}

export function buildIncomingParentCallerSpeechText(
  info: {
    kind?: "PARENT" | "ENQUIRY";
    studentSummary?: string;
    relationLabel?: string;
    name?: string;
    dueAmount?: number;
    promiseDate?: string;
    nextCallDate?: string;
    solvedToday?: boolean;
    absentToday?: boolean;
  },
  opts?: Partial<ParentCallerIdOptions>
): string {
  const resolvedOpts = { ...getParentCallerIdOptions(), ...opts };

  if (info.kind === "ENQUIRY") {
    const summary = String(info.studentSummary || "").trim();
    const caller = String(info.name || "Parent").trim();
    return summary
      ? `New admission enquiry, ${summary} ke liye ${caller} call kar rahe hain.`
      : `New admission enquiry, ${caller} call kar rahe hain.`;
  }

  const summary = String(info.studentSummary || "").trim();
  const rel = String(info.relationLabel || "Parent").trim() || "Parent";
  const absentPrefix =
    info.absentToday && summary
      ? `Dhyan dein, aaj ${summary} school me absent hain. `
      : "";
  const callerPhrase = summary
    ? `${summary} ke ${rel} call kar rahe hain`
    : `${String(info.name || "Parent").trim()} call kar rahe hain`;

  const due = Number(info.dueAmount || 0);
  const dueClause = resolvedOpts.dueVoiceEnabled
    ? due > 0
      ? `, ₹${due.toLocaleString("en-IN")} fee baki hai`
      : ", sab fee clear hai"
    : "";

  const extraParts: string[] = [];
  if (resolvedOpts.scheduleVoiceEnabled) {
    if (info.promiseDate) {
      extraParts.push(`promise date ${formatShortSpokenDate(info.promiseDate)}`);
    }
    if (info.nextCallDate) {
      extraParts.push(`next call ${formatShortSpokenDate(info.nextCallDate)}`);
    }
    if (info.solvedToday) {
      extraParts.push("aaj ka case solve hai");
    }
  }
  const extraClause = extraParts.length > 0 ? `. ${extraParts.join(", ")}` : "";
  return `${absentPrefix}${callerPhrase}${dueClause}${extraClause}.`;
}

export function speakRawTextWithNativeOrBrowser(
  speechText: string,
  dedupeKey?: string,
  force = false
): boolean {
  if (typeof window === "undefined") return false;
  if (!force && !isCallerVoiceAnnounceEnabled()) return false;
  const cleanText = String(speechText || "").trim();
  if (!cleanText) return false;

  const dKey = dedupeKey || `caller_${Date.now()}`;
  const bridge = getBridge();
  if (bridge && typeof bridge.speakNativeIncomingCall === "function") {
    try {
      bridge.speakNativeIncomingCall(cleanText, dKey);
      return true;
    } catch {}
  }
  if (bridge && typeof bridge.speakNativeVoice === "function") {
    try {
      bridge.speakNativeVoice(cleanText, dKey);
      return true;
    } catch {}
  }

  if (!("speechSynthesis" in window)) return false;
  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.rate = 0.96;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang === "hi-IN" || v.lang.startsWith("hi")) ||
      voices.find((v) => v.lang === "en-IN") ||
      voices[0];
    if (preferred) {
      utter.voice = preferred;
      utter.lang = preferred.lang;
    } else {
      utter.lang = "hi-IN";
    }
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

export function announceIncomingParentCall(params: {
  info: CachedParentCallerInfo;
  dedupeKey?: string;
  force?: boolean;
}): boolean {
  const opts = getParentCallerIdOptions();
  if (!params.force && (!isCallerVoiceAnnounceEnabled() || !opts.parentCallerEnabled)) {
    return false;
  }
  const speechText = buildIncomingParentCallerSpeechText(params.info, opts);
  return speakRawTextWithNativeOrBrowser(
    speechText,
    params.dedupeKey || `parent_call_${params.info.phone}_${Date.now()}`,
    params.force
  );
}

export function triggerTestParentCallerPreview(
  sampleOverride?: Partial<CachedParentCallerInfo>
): CachedParentCallerInfo {
  const cachedList = getAllCachedParentCallers();
  const realCandidate =
    cachedList.find((p) => p.kind !== "ENQUIRY" && p.dueAmount > 0) || cachedList[0] || null;

  const sample: CachedParentCallerInfo = sampleOverride?.studentSummary
    ? {
        phone: sampleOverride.phone || "9876543210",
        name: sampleOverride.name || "Ramesh Sharma ji (Father)",
        schoolName: sampleOverride.schoolName || "School",
        kind: sampleOverride.kind || "PARENT",
        studentSummary: sampleOverride.studentSummary,
        relationLabel: sampleOverride.relationLabel || "Father",
        fatherName: sampleOverride.fatherName || "Ramesh Sharma",
        primaryStudentId: sampleOverride.primaryStudentId,
        studentIds: sampleOverride.studentIds || [],
        classNames: sampleOverride.classNames || ["Class 5"],
        dueAmount: sampleOverride.dueAmount ?? 2400,
        unpaidMonthsCount: sampleOverride.unpaidMonthsCount ?? 2,
        promiseDate: sampleOverride.promiseDate,
        promisedAmount: sampleOverride.promisedAmount,
        nextCallDate: sampleOverride.nextCallDate,
        solvedToday: Boolean(sampleOverride.solvedToday),
        settled: Boolean(sampleOverride.settled),
        lastCallAt: sampleOverride.lastCallAt,
        lastCallOutcome: sampleOverride.lastCallOutcome,
        lastNote: sampleOverride.lastNote,
        absentToday: Boolean(sampleOverride.absentToday),
        enquiryId: sampleOverride.enquiryId,
        enquiryStage: sampleOverride.enquiryStage,
        enquiryFollowUpDate: sampleOverride.enquiryFollowUpDate,
        enquiryVisitDate: sampleOverride.enquiryVisitDate,
        enquiryNote: sampleOverride.enquiryNote,
        counsellorName: sampleOverride.counsellorName,
        postCall: sampleOverride.postCall,
        children: sampleOverride.children || [
          {
            id: sampleOverride.primaryStudentId || "sample_student",
            name: "Aarav Sharma",
            classLabel: "Class 5",
            dueAmount: sampleOverride.dueAmount ?? 2400,
            unpaidMonthsCount: sampleOverride.unpaidMonthsCount ?? 2,
          },
        ],
        isTestSample: sampleOverride.isTestSample,
      }
    : realCandidate
      ? { ...realCandidate, isTestSample: false }
      : {
          phone: "9876500001",
          name: "Rajesh Sharma ji (Father)",
          schoolName: getCachedDirectoryMeta().schoolName || "School",
          kind: "PARENT",
          studentSummary: "Class 5 ke Aarav Sharma",
          relationLabel: "Father",
          fatherName: "Rajesh Sharma",
          studentIds: [],
          classNames: ["Class 5"],
          dueAmount: 2400,
          unpaidMonthsCount: 2,
          promiseDate: getTodayLocalYmd(),
          promisedAmount: 2400,
          nextCallDate: getTodayLocalYmd(),
          solvedToday: false,
          settled: false,
          absentToday: false,
          lastNote: "Parent ne salary aate hi fee dene ka promise kiya hai.",
          children: [
            {
              id: "demo_aarav",
              name: "Aarav Sharma",
              classLabel: "Class 5",
              dueAmount: 2400,
              unpaidMonthsCount: 2,
            },
          ],
          isTestSample: true,
        };

  announceIncomingParentCall({
    info: sample,
    dedupeKey: `test_parent_call_${Date.now()}`,
    force: true,
  });

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("nsta-test-incoming-parent-call", { detail: sample })
      );
    } catch {}
  }

  return sample;
}

export function buildIncomingCallerSpeechText(params: {
  callerName: string;
  callerRole?: string;
  schoolName?: string;
  callType?: "voice" | "video" | "sim";
}): string {
  const school = String(params.schoolName || "").trim() || "School";
  const caller = String(params.callerName || "").trim() || "School Staff";
  const roleClean = String(params.callerRole || "").trim();
  const roleSuffix =
    roleClean && !caller.toLowerCase().includes(roleClean.toLowerCase())
      ? ` (${roleClean})`
      : "";

  if (params.callType === "video") {
    return `Dhyan dein, ${school} se ${caller}${roleSuffix} aapko video call kar rahe hain.`;
  }
  if (params.callType === "sim") {
    return `Dhyan dein, ${school} se ${caller}${roleSuffix} aapko call kar rahe hain.`;
  }
  return `Dhyan dein, ${school} se ${caller}${roleSuffix} aapko voice call kar rahe hain.`;
}

export function announceIncomingVoiceCaller(params: {
  callerName: string;
  callerRole?: string;
  schoolName?: string;
  callType?: "voice" | "video" | "sim";
  dedupeKey?: string;
  force?: boolean;
}): boolean {
  const speechText = buildIncomingCallerSpeechText(params);
  return speakRawTextWithNativeOrBrowser(speechText, params.dedupeKey, params.force);
}

export function stopIncomingVoiceCallerSpeech(): void {
  if (typeof window === "undefined") return;
  try {
    const bridge = getBridge();
    if (bridge && typeof bridge.stopNativeVoice === "function") {
      bridge.stopNativeVoice();
    }
  } catch {}
  try {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {}
}
