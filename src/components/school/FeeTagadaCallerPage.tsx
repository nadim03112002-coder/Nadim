import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardEdit,
  Clock,
  History,
  IndianRupee,
  MessageCircle,
  Phone,
  PhoneCall,
  PhoneMissed,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FeeCallFollowUpRecord,
  FeeCallLogEntry,
  FeeCallOutcome,
  MonthlyFee,
  SchoolClass,
  SchoolStudent,
} from "../../school-types";
import {
  getLocalSchools,
  getPendingFeeFollowUpSyncCount,
  saveFeeCallFollowUp,
  saveFeeCallFollowUpBatch,
  subscribeToFeeCallFollowUps,
  syncPendingFeeCallFollowUps,
} from "../../school-firebase";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { CallerIdSettingsCard } from "./CallerIdSettingsCard";
import { UpiQrShareModal } from "./UpiQrShareModal";
import { ScreenInfoGuideButton } from "./ScreenInfoGuideButton";
import { LanguageToggleButton } from "./LanguageToggleButton";
import {
  announceIncomingVoiceCaller,
  triggerTestParentCallerPreview,
} from "../../utils/schoolCallerId";

export const ACTIVE_TAGADA_CALL_STORAGE_KEY = "nsta_active_tagada_call_v1";
const ACTIVE_CALL_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours safety window

export interface PendingTagadaCallSession {
  schoolId: string;
  trackingId: string;
  familyKey: string;
  primaryStudentId: string;
  memberIds: string[];
  phone: string;
  startedAtMs: number;
  callMode: "NATIVE_SIM" | "WEB_DIALER";
}

export function getPendingActiveTagadaCall(schoolId?: string): PendingTagadaCallSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_TAGADA_CALL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingTagadaCallSession;
    if (!parsed || !parsed.primaryStudentId || !parsed.startedAtMs) {
      localStorage.removeItem(ACTIVE_TAGADA_CALL_STORAGE_KEY);
      return null;
    }
    if (Date.now() - Number(parsed.startedAtMs) > ACTIVE_CALL_MAX_AGE_MS) {
      localStorage.removeItem(ACTIVE_TAGADA_CALL_STORAGE_KEY);
      return null;
    }
    if (schoolId && parsed.schoolId && parsed.schoolId !== schoolId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setPendingActiveTagadaCall(session: PendingTagadaCallSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_TAGADA_CALL_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

export function clearPendingActiveTagadaCall(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_TAGADA_CALL_STORAGE_KEY);
  } catch {}
}

interface OfflineCallerBridge {
  isNativeApp?: () => boolean;
  startOfflinePhoneCall?: (phone: string, trackingId: string) => boolean;
  hasOfflineCallPermission?: () => boolean;
  hasAutoCallLogPermission?: () => boolean;
  requestAutoCallLogPermission?: () => void;
  getLatestCallLogInfo?: (phone: string, sinceMs: number) => string;
  triggerHaptic?: (kind: string) => void;
}

function getOfflineCallerBridge(): OfflineCallerBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { LifeMakerAndroid?: OfflineCallerBridge }).LifeMakerAndroid;
}

export interface TagadaStudentFeeRow {
  student: SchoolStudent;
  fee: MonthlyFee | null;
  className: string;
  phone: string;
  dueAmount: number;
  unpaidMonthsCount: number;
}

export interface TagadaFamilyGroup {
  familyKey: string;
  members: TagadaStudentFeeRow[];
  unpaidMembers: TagadaStudentFeeRow[];
  primaryRow: TagadaStudentFeeRow;
  combinedDue: number;
  maxUnpaidMonths: number;
  phone: string;
  fatherName: string;
  displayTitle: string;
  record: FeeCallFollowUpRecord | null;
  bucket: TagadaQueueBucket;
}

export type TagadaQueueBucket =
  | "BROKEN_PROMISE"
  | "CALL_TODAY"
  | "NEVER_CALLED"
  | "SCHEDULED_WAIT"
  | "PAID_SETTLED";

export function getLocalTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return getLocalTodayYmd();
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function getNextOccurrenceOfDayOfMonth(dayOfMonth: number, fromYmd = getLocalTodayYmd()): string {
  const [y, m, d] = fromYmd.split("-").map(Number);
  const targetMonth = d >= dayOfMonth ? m + 1 : m;
  const targetYear = targetMonth > 12 ? y + 1 : y;
  const normMonth = targetMonth > 12 ? 1 : targetMonth;
  const maxDaysInMonth = new Date(targetYear, normMonth, 0).getDate();
  const safeDay = Math.min(dayOfMonth, maxDaysInMonth);
  return `${targetYear}-${String(normMonth).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

export function formatShortDate(ymdOrIso?: string): string {
  if (!ymdOrIso) return "—";
  try {
    const dt = /^\d{4}-\d{2}-\d{2}$/.test(ymdOrIso)
      ? new Date(`${ymdOrIso}T00:00:00`)
      : new Date(ymdOrIso);
    if (Number.isNaN(dt.getTime())) return ymdOrIso;
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return ymdOrIso;
  }
}

export function formatDateTimeShort(iso?: string): string {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return iso;
    const today = getLocalTodayYmd();
    const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const t = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    if (ymd === today) return `Today, ${t}`;
    return `${dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${t}`;
  } catch {
    return iso;
  }
}

export function diffDaysYmd(laterYmd: string, earlierYmd: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(laterYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(earlierYmd)) return 0;
  const a = new Date(`${laterYmd}T00:00:00`).getTime();
  const b = new Date(`${earlierYmd}T00:00:00`).getTime();
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

function normalizePhone10(raw?: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  const last10 = digits.slice(-10);
  // Ignore dummy/placeholder numbers so unrelated students never merge
  if (/^(\d)\1{9}$/.test(last10) || last10 === "1234567890" || last10 === "9876543210") {
    return "";
  }
  return last10;
}

function normalizeFatherName(raw?: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\b(mr|shri|sri|late|md|mohd|mohammad)\.?\s+/g, "")
    .replace(/\s+/g, " ");
}

export function classifyFeeTagadaStatus(
  dueAmount: number,
  record?: FeeCallFollowUpRecord | null,
  todayYmd = getLocalTodayYmd()
): TagadaQueueBucket {
  if (dueAmount <= 0) {
    return "PAID_SETTLED";
  }
  if (!record || (!record.lastCallAt && !record.promiseDate && !record.nextCallDate)) {
    return "NEVER_CALLED";
  }
  if (record.nextCallDate) {
    if (todayYmd >= record.nextCallDate) {
      if (record.promiseDate && todayYmd > record.promiseDate) {
        return "BROKEN_PROMISE";
      }
      return "CALL_TODAY";
    }
    return "SCHEDULED_WAIT";
  }
  if (record.promiseDate) {
    if (todayYmd > record.promiseDate) return "BROKEN_PROMISE";
    return "SCHEDULED_WAIT";
  }
  return "CALL_TODAY";
}

/**
 * Union-Find grouping of students into Family Cards:
 * 1) Explicit familyGroupId
 * 2) Explicit siblingStudentIds links
 * 3) Same valid 10-digit parent mobile + matching non-empty fatherName
 */
export function buildFamilyTagadaGroups(
  rows: TagadaStudentFeeRow[],
  followUpMap: Map<string, FeeCallFollowUpRecord>,
  todayYmd = getLocalTodayYmd()
): TagadaFamilyGroup[] {
  const n = rows.length;
  if (n === 0) return [];

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    let cur = x;
    while (cur !== root) {
      const nxt = parent[cur];
      parent[cur] = root;
      cur = nxt;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const indexByStudentId = new Map<string, number>();
  const indexByFamilyGroupId = new Map<string, number>();
  const indexByPhoneFather = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const row = rows[i];
    indexByStudentId.set(row.student.id, i);

    const famId = String(row.student.familyGroupId || "").trim();
    if (famId) {
      const prev = indexByFamilyGroupId.get(famId);
      if (prev !== undefined) union(prev, i);
      else indexByFamilyGroupId.set(famId, i);
    }

    const p10 = normalizePhone10(row.phone || row.student.phone || row.student.whatsappNo);
    const fName = normalizeFatherName(row.student.fatherName);
    if (p10 && fName.length >= 2) {
      const key = `${p10}__${fName}`;
      const prev = indexByPhoneFather.get(key);
      if (prev !== undefined) union(prev, i);
      else indexByPhoneFather.set(key, i);
    }
  }

  // Sibling IDs graph links
  for (let i = 0; i < n; i++) {
    const sibIds = Array.isArray(rows[i].student.siblingStudentIds)
      ? rows[i].student.siblingStudentIds!
      : [];
    for (const sibId of sibIds) {
      const j = indexByStudentId.get(sibId);
      if (j !== undefined) union(i, j);
    }
  }

  const buckets = new Map<number, TagadaStudentFeeRow[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = buckets.get(root) || [];
    list.push(rows[i]);
    buckets.set(root, list);
  }

  const groups: TagadaFamilyGroup[] = [];
  for (const members of buckets.values()) {
    // Sort members: unpaid highest due first, then by name
    const sortedMembers = [...members].sort((a, b) => {
      if (b.dueAmount !== a.dueAmount) return b.dueAmount - a.dueAmount;
      return (a.student.name || "").localeCompare(b.student.name || "");
    });
    const unpaidMembers = sortedMembers.filter((m) => m.dueAmount > 0);
    const primaryRow = unpaidMembers[0] || sortedMembers[0];
    const combinedDue = sortedMembers.reduce((sum, m) => sum + Math.max(0, m.dueAmount), 0);
    const maxUnpaidMonths = sortedMembers.reduce((mx, m) => Math.max(mx, m.unpaidMonthsCount || 0), 0);

    // Pick best phone & father name across members
    const phone =
      sortedMembers.map((m) => followUpMap.get(m.student.id)?.phone || m.phone).find((p) => p && p.trim().length >= 5) ||
      "";
    const fatherName =
      sortedMembers.map((m) => m.student.fatherName).find((f) => Boolean(f && f.trim())) || "";

    // Merge latest active follow-up record across siblings (prefer active call records with promiseDate/nextCallDate)
    const memberRecords = sortedMembers
      .map((m) => followUpMap.get(m.student.id))
      .filter((r): r is FeeCallFollowUpRecord => Boolean(r));
    memberRecords.sort((a, b) => (b.lastCallAt || b.updatedAt || "").localeCompare(a.lastCallAt || a.updatedAt || ""));
    const latestRecord = memberRecords[0] || null;

    const explicitFamId = sortedMembers.find((m) => m.student.familyGroupId)?.student.familyGroupId;
    const familyKey = explicitFamId
      ? `fam_${explicitFamId}`
      : sortedMembers.length > 1
        ? `fam_${sortedMembers.map((m) => m.student.id).sort().join("_")}`
        : `stu_${primaryRow.student.id}`;

    const displayTitle = sortedMembers
      .map((m) => `${m.student.name} (${m.className})`)
      .join(" + ");

    const bucket = classifyFeeTagadaStatus(combinedDue, latestRecord, todayYmd);

    groups.push({
      familyKey,
      members: sortedMembers,
      unpaidMembers,
      primaryRow,
      combinedDue,
      maxUnpaidMonths,
      phone,
      fatherName,
      displayTitle,
      record: latestRecord,
      bucket,
    });
  }

  return groups;
}

const OUTCOME_META: Record<
  FeeCallOutcome,
  { label: string; shortLabel: string; colorCls: string }
> = {
  PROMISED_DATE: {
    label: "Date Diya (Promise Date)",
    shortLabel: "Promised Date",
    colorCls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700",
  },
  NOT_PICKED: {
    label: "Call Nahi Utha (Not Picked)",
    shortLabel: "Not Picked",
    colorCls: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-700",
  },
  BUSY: {
    label: "Busy / Baad Me Call Karein",
    shortLabel: "Busy / Callback",
    colorCls: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-700",
  },
  SWITCHED_OFF: {
    label: "Phone Band / Not Reachable",
    shortLabel: "Switched Off",
    colorCls: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  },
  CALLBACK_REQUESTED: {
    label: "Parent Callback Maanga",
    shortLabel: "Callback",
    colorCls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
  },
  PAID_CLAIMED: {
    label: "Bole Fee Jama Kar Diya",
    shortLabel: "Paid Claimed",
    colorCls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
  },
  WRONG_NUMBER: {
    label: "Wrong / Invalid Number",
    shortLabel: "Wrong No.",
    colorCls: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-700",
  },
  OTHER: {
    label: "Other Note",
    shortLabel: "Note",
    colorCls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  },
};

const QUICK_REMARKS = [
  "बोले तय तारीख को पक्का जमा कर देंगे",
  "सैलरी आने पर फीस देंगे",
  "स्कूल आकर खुद जमा करेंगे",
  "फ़ोन नहीं उठाया, कल फिर कॉल करना है",
  "मोबाइल स्विच ऑफ आ रहा था",
  "आधी फीस जमा की, बाकी तय तारीख को देंगे",
];

interface Props {
  schoolId: string;
  schoolName?: string;
  schoolUpiId?: string;
  actorName?: string;
  classes: SchoolClass[];
  rows: TagadaStudentFeeRow[];
  onBack?: () => void;
  onCollectFee?: (row: TagadaStudentFeeRow) => void;
  onCollectFamily?: (selectedRows: TagadaStudentFeeRow[]) => void;
  onOpenWhatsApp?: (row: TagadaStudentFeeRow) => void;
  asPage?: boolean;
}

type ActiveTabType = "CALL_TODAY" | "NEVER_CALLED" | "SCHEDULED" | "PAID_SETTLED" | "HISTORY";

export const FeeTagadaCallerPage: React.FC<Props> = ({
  schoolId,
  schoolName = "School",
  schoolUpiId,
  actorName = "Admin / Accounts",
  classes,
  rows,
  onBack,
  onCollectFee,
  onCollectFamily,
  onOpenWhatsApp,
  asPage = true,
}) => {
  const [followUps, setFollowUps] = useState<FeeCallFollowUpRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTabType>("CALL_TODAY");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [historyRange, setHistoryRange] = useState<"TODAY" | "ALL">("TODAY");
  const [paidFilterMode, setPaidFilterMode] = useState<"SETTLED_TAGADA" | "ALL_PAID">("SETTLED_TAGADA");
  const [powerQueueEnabled, setPowerQueueEnabled] = useState<boolean>(false);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine !== false : true
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    getPendingFeeFollowUpSyncCount(schoolId)
  );
  const [isSyncingNow, setIsSyncingNow] = useState(false);

  // Native Android Auto Call Log permission state
  const [isNativeApk] = useState<boolean>(() => Boolean(getOfflineCallerBridge()?.startOfflinePhoneCall));
  const [hasCallLogPerm, setHasCallLogPerm] = useState<boolean>(() =>
    Boolean(getOfflineCallerBridge()?.hasAutoCallLogPermission?.())
  );

  // Active post-call outcome modal state (supports single student or merged family)
  const [modalGroup, setModalGroup] = useState<TagadaFamilyGroup | null>(null);
  const [outcome, setOutcome] = useState<FeeCallOutcome>("PROMISED_DATE");
  const [promiseDate, setPromiseDate] = useState<string>(() => addDaysYmd(getLocalTodayYmd(), 3));
  const [callNextDayAfterPromise, setCallNextDayAfterPromise] = useState<boolean>(true);
  const [directNextCallDate, setDirectNextCallDate] = useState<string>(() => addDaysYmd(getLocalTodayYmd(), 1));
  const [promisedAmount, setPromisedAmount] = useState<string>("");
  const [durationSec, setDurationSec] = useState<string>("0");
  const [callModeUsed, setCallModeUsed] = useState<"NATIVE_SIM" | "WEB_DIALER" | "MANUAL_LOG">("MANUAL_LOG");
  const [autoLogInfo, setAutoLogInfo] = useState<{ verified: boolean; picked: boolean; callType?: string } | null>(null);
  const [editablePhone, setEditablePhone] = useState<string>("");
  const [noteText, setNoteText] = useState<string>("");
  const [resolvedTodayInModal, setResolvedTodayInModal] = useState<boolean>(false);
  const [isSavingCall, setIsSavingCall] = useState(false);
  const [showCallerIdSettings, setShowCallerIdSettings] = useState(false);
  const [qrGroup, setQrGroup] = useState<TagadaFamilyGroup | null>(null);
  const resolvedUpiId = useMemo(() => {
    if (schoolUpiId?.trim()) return schoolUpiId.trim();
    const matched = getLocalSchools().find(
      (s) => s.id === schoolId || s.code === schoolId
    );
    return String(matched?.upiId || "").trim();
  }, [schoolId, schoolUpiId]);
  const [sendMissedCallReminder, setSendMissedCallReminder] = useState<boolean>(true);
  const [announceDueAmount, setAnnounceDueAmount] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("nst_tagada_announce_due_amount_v1") === "true";
    } catch {
      return false;
    }
  });

  const handleToggleAnnounceDueAmount = () => {
    setAnnounceDueAmount((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nst_tagada_announce_due_amount_v1", next ? "true" : "false");
      } catch {}
      toast.success(
        next
          ? "Due Voice ON — Parent ko call alert me exact baki ₹ amount bhi bolega."
          : "Due Voice OFF — Privacy ke liye sirf school & caller ka naam bolega."
      );
      return next;
    });
  };

  // Child Picker modals for Multi-Sibling Family Cards
  const [collectPickerGroup, setCollectPickerGroup] = useState<TagadaFamilyGroup | null>(null);
  const [collectPickerSelectedIds, setCollectPickerSelectedIds] = useState<string[]>([]);
  const [whatsappPickerGroup, setWhatsappPickerGroup] = useState<TagadaFamilyGroup | null>(null);

  const pendingDialRef = useRef<PendingTagadaCallSession | null>(getPendingActiveTagadaCall(schoolId));
  const restoredFromStorageRef = useRef<boolean>(false);

  useEffect(() => {
    const unsub = subscribeToFeeCallFollowUps(schoolId, (list) => {
      setFollowUps(list);
      setPendingSyncCount(getPendingFeeFollowUpSyncCount(schoolId));
    });
    return unsub;
  }, [schoolId]);

  useEffect(() => {
    const onNetChange = () => {
      const onlineNow = typeof navigator !== "undefined" ? navigator.onLine !== false : true;
      setIsOnline(onlineNow);
      if (onlineNow) {
        void syncPendingFeeCallFollowUps(schoolId).then(() => {
          setPendingSyncCount(getPendingFeeFollowUpSyncCount(schoolId));
        });
      }
    };
    const onPermEvent = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (typeof detail?.granted === "boolean") {
        setHasCallLogPerm(detail.granted);
        if (detail.granted) {
          toast.success("Auto Call Log (Talk-Time Verification) ON ho gaya!");
        } else {
          toast.info("Call Log permission deny hui — Manual/Timer mode chalu rahega.");
        }
      }
    };
    window.addEventListener("online", onNetChange);
    window.addEventListener("offline", onNetChange);
    window.addEventListener("android-call-log-permission", onPermEvent);
    return () => {
      window.removeEventListener("online", onNetChange);
      window.removeEventListener("offline", onNetChange);
      window.removeEventListener("android-call-log-permission", onPermEvent);
    };
  }, [schoolId]);

  const followUpMap = useMemo(() => {
    const m = new Map<string, FeeCallFollowUpRecord>();
    for (const r of followUps) {
      if (r?.studentId) m.set(r.studentId, r);
    }
    return m;
  }, [followUps]);

  const todayYmd = getLocalTodayYmd();

  // Group ALL student rows into Family Cards (without filtering yet so sibling links stay intact)
  const allFamilyGroups = useMemo(() => {
    return buildFamilyTagadaGroups(rows, followUpMap, todayYmd);
  }, [rows, followUpMap, todayYmd]);

  const familyGroupsRef = useRef<TagadaFamilyGroup[]>(allFamilyGroups);
  useEffect(() => {
    familyGroupsRef.current = allFamilyGroups;
  }, [allFamilyGroups]);

  const openOutcomeModalForGroup = (
    group: TagadaFamilyGroup,
    mode: "NATIVE_SIM" | "WEB_DIALER" | "MANUAL_LOG",
    measuredDurationSec = 0,
    dialedPhone?: string,
    callLogMeta?: { verified: boolean; picked: boolean; callType?: string } | null
  ) => {
    setModalGroup(group);
    setCallModeUsed(mode);
    setDurationSec(String(Math.max(0, Math.round(measuredDurationSec))));
    setAutoLogInfo(callLogMeta || null);
    setEditablePhone(dialedPhone || group.phone || "");

    // Auto-select NOT_PICKED when READ_CALL_LOG confirms 0s call duration
    if (callLogMeta?.verified && !callLogMeta.picked) {
      setOutcome("NOT_PICKED");
    } else {
      setOutcome("PROMISED_DATE");
    }

    setPromiseDate(addDaysYmd(todayYmd, 3));
    setCallNextDayAfterPromise(true);
    setDirectNextCallDate(addDaysYmd(todayYmd, 1));
    setPromisedAmount(String(group.combinedDue || group.record?.promisedAmount || ""));
    setNoteText("");
    setResolvedTodayInModal(group.record?.resolvedTodayDate === todayYmd);
    setSendMissedCallReminder(true);
  };

  const handleToggleSolvedTodayForGroup = async (group: TagadaFamilyGroup) => {
    const currentlySolved = group.record?.resolvedTodayDate === todayYmd;
    const nextResolvedDate = currentlySolved ? "" : todayYmd;
    const nowIso = new Date().toISOString();
    const targetMembers = group.unpaidMembers.length > 0 ? group.unpaidMembers : [group.primaryRow];

    const recordsToSave: FeeCallFollowUpRecord[] = targetMembers.map((member) => {
      const existing = followUpMap.get(member.student.id);
      return {
        id: member.student.id,
        schoolId,
        studentId: member.student.id,
        studentName: member.student.name,
        fatherName: member.student.fatherName || existing?.fatherName || "",
        classId: member.student.classId,
        className: member.className,
        rollNo: member.student.rollNo || "",
        phone: group.phone || existing?.phone || "",
        familyGroupId: group.familyKey,
        siblingStudentIds: group.members.map((m) => m.student.id).filter((id) => id !== member.student.id),
        lastCallAt: existing?.lastCallAt,
        lastCallOutcome: existing?.lastCallOutcome,
        lastCallDurationSec: existing?.lastCallDurationSec,
        lastCallBy: existing?.lastCallBy || actorName,
        lastNote: existing?.lastNote,
        promisedAmount: existing?.promisedAmount,
        promiseDate: existing?.promiseDate,
        nextCallDate: existing?.nextCallDate,
        totalCallsCount: existing?.totalCallsCount,
        callHistory: existing?.callHistory,
        settled: existing?.settled,
        settledAt: existing?.settledAt,
        settledReceiptNo: existing?.settledReceiptNo,
        settledAmount: existing?.settledAmount,
        settledBy: existing?.settledBy,
        resolvedTodayDate: nextResolvedDate,
        resolvedNote: nextResolvedDate ? "Aaj sab solve ho gaya" : "",
        updatedAt: nowIso,
      };
    });

    await saveFeeCallFollowUpBatch(recordsToSave);
    toast.success(
      nextResolvedDate
        ? `Marked: ${group.primaryRow.student.name} — Aaj Sab Solve Ho Gaya ✅`
        : `Reopened: ${group.primaryRow.student.name} — Abhi Pending`
    );
  };

  // Query native READ_CALL_LOG safely if WebView reloaded during a SIM call
  const resolveNativeCallLogFallback = (phone: string, startedAtMs: number): {
    durationSec: number;
    meta: { verified: boolean; picked: boolean; callType?: string } | null;
  } => {
    const elapsed = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));
    const bridge = getOfflineCallerBridge();
    if (bridge?.getLatestCallLogInfo && bridge?.hasAutoCallLogPermission?.()) {
      try {
        const rawJson = bridge.getLatestCallLogInfo(phone, startedAtMs);
        const parsed = JSON.parse(rawJson || "{}");
        if (parsed?.found) {
          const dur = Math.max(0, Number(parsed.durationSec || 0));
          const picked = Boolean(parsed.callPicked ?? dur > 0);
          return {
            durationSec: dur,
            meta: { verified: true, picked, callType: parsed.callType },
          };
        }
      } catch {}
    }
    return { durationSec: elapsed, meta: null };
  };

  // Restore pending call from localStorage if low-RAM Android WebView reloaded while dialing!
  useEffect(() => {
    if (restoredFromStorageRef.current || allFamilyGroups.length === 0) return;
    const saved = getPendingActiveTagadaCall(schoolId);
    if (!saved) return;
    restoredFromStorageRef.current = true;
    pendingDialRef.current = saved;

    const matchedGroup =
      allFamilyGroups.find((g) => g.familyKey === saved.familyKey) ||
      allFamilyGroups.find((g) => g.members.some((m) => m.student.id === saved.primaryStudentId));
    if (matchedGroup) {
      const elapsedSinceStart = Date.now() - saved.startedAtMs;
      // Only auto-open immediately if at least 2 seconds passed (meaning user likely returned from dialer)
      if (elapsedSinceStart >= 2000) {
        const { durationSec: resolvedDur, meta } = resolveNativeCallLogFallback(saved.phone, saved.startedAtMs);
        pendingDialRef.current = null;
        openOutcomeModalForGroup(matchedGroup, saved.callMode, resolvedDur, saved.phone, meta);
      }
    }
  }, [allFamilyGroups, schoolId]);

  // Listen for return from Android Native Dialer OR browser tel: dialer
  useEffect(() => {
    const findGroupForPending = (pending: PendingTagadaCallSession): TagadaFamilyGroup | undefined => {
      const list = familyGroupsRef.current;
      return (
        list.find((g) => g.familyKey === pending.familyKey) ||
        list.find((g) => g.members.some((m) => m.student.id === pending.primaryStudentId))
      );
    };

    const handleNativeReturn = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail || {};
      const pending = pendingDialRef.current || getPendingActiveTagadaCall(schoolId);
      if (!pending) return;
      if (detail.trackingId && detail.trackingId !== pending.trackingId) return;

      pendingDialRef.current = null;
      const autoVerified = Boolean(detail.autoLogVerified);
      const dur =
        typeof detail.durationSec === "number"
          ? detail.durationSec
          : typeof detail.elapsedSeconds === "number"
            ? detail.elapsedSeconds
            : Math.max(0, Math.round((Date.now() - pending.startedAtMs) / 1000));
      const meta = autoVerified
        ? {
            verified: true,
            picked: Boolean(detail.callPicked ?? dur > 0),
            callType: typeof detail.callType === "string" ? detail.callType : undefined,
          }
        : null;

      const matchedGroup = findGroupForPending(pending);
      if (matchedGroup) {
        openOutcomeModalForGroup(matchedGroup, pending.callMode, dur, pending.phone, meta);
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const pending = pendingDialRef.current || getPendingActiveTagadaCall(schoolId);
      if (!pending) return;
      const isNative = Boolean(getOfflineCallerBridge()?.startOfflinePhoneCall);
      window.setTimeout(() => {
        const stillPending = pendingDialRef.current || getPendingActiveTagadaCall(schoolId);
        if (!stillPending || stillPending.trackingId !== pending.trackingId) return;
        const elapsed = Math.max(0, Math.round((Date.now() - stillPending.startedAtMs) / 1000));
        if (isNative && elapsed < 2) return;
        pendingDialRef.current = null;
        const { durationSec: resolvedDur, meta } = resolveNativeCallLogFallback(
          stillPending.phone,
          stillPending.startedAtMs
        );
        const matchedGroup = findGroupForPending(stillPending);
        if (matchedGroup) {
          openOutcomeModalForGroup(matchedGroup, stillPending.callMode, resolvedDur, stillPending.phone, meta);
        }
      }, isNative ? 750 : 280);
    };

    window.addEventListener("android-offline-call-returned", handleNativeReturn);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("android-offline-call-returned", handleNativeReturn);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [schoolId]);

  const handlePlaceOfflineCall = (group: TagadaFamilyGroup) => {
    const rawPhone = (group.phone || "").trim();
    const cleaned = rawPhone.replace(/[^+0-9]/g, "");
    const digitCount = cleaned.replace(/\D/g, "").length;

    if (digitCount < 5) {
      toast.error(`${group.primaryRow.student.name} ka sahi mobile number darj nahi hai — pehle number edit karke log karein.`);
      openOutcomeModalForGroup(group, "MANUAL_LOG", 0, rawPhone, null);
      return;
    }

    const trackingId = `tagada_${group.primaryRow.student.id}_${Date.now()}`;
    const bridge = getOfflineCallerBridge();
    const hasNativeCaller = Boolean(bridge?.startOfflinePhoneCall);

    const session: PendingTagadaCallSession = {
      schoolId,
      trackingId,
      familyKey: group.familyKey,
      primaryStudentId: group.primaryRow.student.id,
      memberIds: group.members.map((m) => m.student.id),
      phone: cleaned,
      startedAtMs: Date.now(),
      callMode: hasNativeCaller ? "NATIVE_SIM" : "WEB_DIALER",
    };

    pendingDialRef.current = session;
    setPendingActiveTagadaCall(session);

    try {
      bridge?.triggerHaptic?.("light");
    } catch {}

    // Option A: Instant pre-call voice & notification alert to parent's SCHOOL+ app (non-blocking)
    try {
      const targetStudentIds = Array.from(
        new Set(group.members.map((m) => String(m.student.id || "").trim()).filter(Boolean))
      );
      if (targetStudentIds.length > 0 && navigator.onLine !== false) {
        const cleanSchool = (schoolName || "School").trim();
        const cleanActor = (actorName || "School Office").trim();
        const callBody =
          announceDueAmount && group.combinedDue > 0
            ? `${cleanSchool} se ${cleanActor} aapko ₹${group.combinedDue.toLocaleString("en-IN")} baki school fee ke liye call kar rahe hain.`
            : `${cleanSchool} se ${cleanActor} aapko Fee Tagada ke liye call kar rahe hain.`;
        void sendSchoolPushNotification({
          schoolId,
          studentIds: targetStudentIds,
          senderName: cleanActor,
          title: `📞 ${cleanSchool} se Call aa raha hai`,
          body: callBody,
          type: "CALL_INCOMING",
          voiceSpeak: true,
          urgent: true,
          url: `/?schoolPortal=1&schoolId=${encodeURIComponent(schoolId)}`,
        }).catch(() => {});
      }
    } catch {}

    if (hasNativeCaller && bridge?.startOfflinePhoneCall) {
      const ok = bridge.startOfflinePhoneCall(cleaned, trackingId);
      if (!ok) {
        pendingDialRef.current = null;
        clearPendingActiveTagadaCall();
        openOutcomeModalForGroup(group, "MANUAL_LOG", 0, cleaned, null);
      }
      return;
    }

    try {
      window.location.href = `tel:${cleaned}`;
    } catch {
      pendingDialRef.current = null;
      clearPendingActiveTagadaCall();
      openOutcomeModalForGroup(group, "WEB_DIALER", 0, cleaned, null);
    }
  };

  // Filtered family groups for search & class dropdown
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allFamilyGroups.filter((g) => {
      if (selectedClassId !== "ALL") {
        const hasClass = g.members.some((m) => m.student.classId === selectedClassId);
        if (!hasClass) return false;
      }
      if (!q) return true;
      return g.members.some(
        (m) =>
          (m.student.name || "").toLowerCase().includes(q) ||
          (m.student.fatherName || "").toLowerCase().includes(q) ||
          (m.student.rollNo || "").toLowerCase().includes(q) ||
          (m.phone || "").toLowerCase().includes(q) ||
          (m.className || "").toLowerCase().includes(q)
      ) || (g.phone || "").toLowerCase().includes(q);
    });
  }, [allFamilyGroups, searchQuery, selectedClassId]);

  const callTodayList = useMemo(() => {
    return filteredGroups
      .filter((g) => g.bucket === "BROKEN_PROMISE" || g.bucket === "CALL_TODAY")
      .sort((a, b) => {
        if (a.bucket !== b.bucket) return a.bucket === "BROKEN_PROMISE" ? -1 : 1;
        const pa = a.record?.nextCallDate || "9999-99-99";
        const pb = b.record?.nextCallDate || "9999-99-99";
        if (pa !== pb) return pa.localeCompare(pb);
        return b.combinedDue - a.combinedDue;
      });
  }, [filteredGroups]);

  const neverCalledList = useMemo(() => {
    return filteredGroups
      .filter((g) => g.bucket === "NEVER_CALLED")
      .sort((a, b) => b.combinedDue - a.combinedDue);
  }, [filteredGroups]);

  const scheduledWaitList = useMemo(() => {
    return filteredGroups
      .filter((g) => g.bucket === "SCHEDULED_WAIT")
      .sort((a, b) =>
        (a.record?.promiseDate || a.record?.nextCallDate || "9999-99-99").localeCompare(
          b.record?.promiseDate || b.record?.nextCallDate || "9999-99-99"
        )
      );
  }, [filteredGroups]);

  const paidSettledList = useMemo(() => {
    return filteredGroups
      .filter((g) => {
        if (g.bucket !== "PAID_SETTLED") return false;
        if (paidFilterMode === "ALL_PAID") return true;
        return g.members.some((m) => {
          const rec = followUpMap.get(m.student.id);
          return Boolean(rec && (rec.settled || (rec.totalCallsCount || 0) > 0 || (rec.callHistory && rec.callHistory.length > 0)));
        });
      })
      .sort((a, b) => {
        const ta = a.record?.settledAt || a.record?.updatedAt || "";
        const tb = b.record?.settledAt || b.record?.updatedAt || "";
        return tb.localeCompare(ta);
      });
  }, [filteredGroups, paidFilterMode, followUpMap]);

  // Deduplicated Call History (so family calls to 2 siblings appear as 1 phone call with both names)
  const flatCallHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groupByStuId = new Map<string, TagadaFamilyGroup>();
    for (const g of allFamilyGroups) {
      for (const m of g.members) groupByStuId.set(m.student.id, g);
    }

    const seenKeys = new Set<string>();
    const items: Array<{
      entry: FeeCallLogEntry;
      record: FeeCallFollowUpRecord;
      group?: TagadaFamilyGroup;
      currentDue: number;
    }> = [];

    for (const rec of followUps) {
      if (selectedClassId !== "ALL" && rec.classId !== selectedClassId) continue;
      const famGroup = groupByStuId.get(rec.studentId);
      if (q) {
        const hit =
          (rec.studentName || "").toLowerCase().includes(q) ||
          (rec.fatherName || "").toLowerCase().includes(q) ||
          (rec.phone || "").toLowerCase().includes(q) ||
          (rec.className || "").toLowerCase().includes(q) ||
          (famGroup?.displayTitle || "").toLowerCase().includes(q);
        if (!hit) continue;
      }

      const currentDue = famGroup ? famGroup.combinedDue : 0;
      const entries = Array.isArray(rec.callHistory) ? rec.callHistory : [];
      for (const entry of entries) {
        if (historyRange === "TODAY") {
          const dt = new Date(entry.calledAt);
          const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
          if (ymd !== todayYmd) continue;
        }
        const dedupeKey = `${entry.calledAt || ""}_${entry.phone || ""}_${famGroup?.familyKey || rec.studentId}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);
        items.push({ entry, record: rec, group: famGroup, currentDue });
      }
    }
    return items.sort((a, b) => (b.entry.calledAt || "").localeCompare(a.entry.calledAt || ""));
  }, [followUps, allFamilyGroups, searchQuery, selectedClassId, historyRange, todayYmd]);

  // Daily Caller Report for Admin / Accountant
  const dailyCallerStats = useMemo(() => {
    const todayEntries = flatCallHistory.filter((item) => {
      const dt = new Date(item.entry.calledAt);
      const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      return ymd === todayYmd;
    });

    let totalCalls = todayEntries.length;
    let connectedCalls = 0;
    let notPickedCalls = 0;
    let promisedTotalAmount = 0;
    const byStaff = new Map<
      string,
      { staffName: string; calls: number; connected: number; notPicked: number; promisedAmount: number }
    >();

    for (const { entry } of todayEntries) {
      const isNotPicked =
        entry.outcome === "NOT_PICKED" ||
        entry.outcome === "SWITCHED_OFF" ||
        entry.outcome === "WRONG_NUMBER" ||
        (entry.callPicked === false);
      if (isNotPicked) notPickedCalls++;
      else connectedCalls++;

      const promAmt = entry.outcome === "PROMISED_DATE" ? Number(entry.promisedAmount || 0) : 0;
      promisedTotalAmount += promAmt;

      const staffKey = (entry.calledBy || "Staff").trim();
      const cur = byStaff.get(staffKey) || {
        staffName: staffKey,
        calls: 0,
        connected: 0,
        notPicked: 0,
        promisedAmount: 0,
      };
      cur.calls += 1;
      if (isNotPicked) cur.notPicked += 1;
      else cur.connected += 1;
      cur.promisedAmount += promAmt;
      byStaff.set(staffKey, cur);
    }

    return {
      totalCalls,
      connectedCalls,
      notPickedCalls,
      promisedTotalAmount,
      staffBreakdown: Array.from(byStaff.values()).sort((a, b) => b.calls - a.calls),
    };
  }, [flatCallHistory, todayYmd]);

  const totalDueInCallToday = useMemo(
    () => callTodayList.reduce((s, g) => s + g.combinedDue, 0),
    [callTodayList]
  );

  // Pick next family card in active queue for Power / Auto-Next Queue Mode
  const nextQueueGroup = useMemo(() => {
    if (!modalGroup) return null;
    const pool = activeTab === "NEVER_CALLED" ? neverCalledList : callTodayList.length > 0 ? callTodayList : neverCalledList;
    return pool.find((g) => g.familyKey !== modalGroup.familyKey && g.combinedDue > 0) || null;
  }, [modalGroup, activeTab, callTodayList, neverCalledList]);

  const handleSaveCallOutcome = async (e?: React.FormEvent, callNextAfterSave = false) => {
    if (e) e.preventDefault();
    if (!modalGroup || isSavingCall) return;

    const cleanPhone = editablePhone.replace(/[^+0-9]/g, "") || modalGroup.phone || "";
    const nowIso = new Date().toISOString();

    let finalPromiseDate: string | undefined = undefined;
    let finalNextCallDate: string | undefined = undefined;

    if (outcome === "PROMISED_DATE") {
      finalPromiseDate = promiseDate || addDaysYmd(todayYmd, 3);
      finalNextCallDate = callNextDayAfterPromise
        ? addDaysYmd(finalPromiseDate, 1)
        : finalPromiseDate;
    } else if (outcome === "PAID_CLAIMED") {
      finalNextCallDate = addDaysYmd(todayYmd, 1);
    } else if (outcome === "WRONG_NUMBER") {
      finalNextCallDate = addDaysYmd(todayYmd, 7);
    } else {
      finalNextCallDate = directNextCallDate || addDaysYmd(todayYmd, 1);
    }

    const parsedDur = Math.max(0, Number(durationSec) || 0);
    const parsedPromAmt =
      outcome === "PROMISED_DATE" && promisedAmount.trim() !== ""
        ? Math.max(0, Number(promisedAmount) || 0)
        : modalGroup.record?.promisedAmount;

    const targetMembers =
      modalGroup.unpaidMembers.length > 0 ? modalGroup.unpaidMembers : [modalGroup.primaryRow];

    const recordsToSave: FeeCallFollowUpRecord[] = targetMembers.map((member) => {
      const existing = followUpMap.get(member.student.id);
      const entry: FeeCallLogEntry = {
        id: `clog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        calledAt: nowIso,
        phone: cleanPhone,
        outcome,
        durationSec: parsedDur,
        promisedAmount: parsedPromAmt,
        promiseDate: finalPromiseDate,
        nextCallDate: finalNextCallDate,
        dueAtCallTime: modalGroup.combinedDue,
        note: noteText.trim() || OUTCOME_META[outcome].label,
        calledBy: actorName,
        callMode: callModeUsed,
        offlineSaved: !isOnline,
        autoLogVerified: Boolean(autoLogInfo?.verified),
        callPicked: autoLogInfo ? autoLogInfo.picked : outcome !== "NOT_PICKED" && outcome !== "SWITCHED_OFF",
        callType: autoLogInfo?.callType,
      };
      const nextHistory = [entry, ...(existing?.callHistory || [])].slice(0, 25);
      return {
        id: member.student.id,
        schoolId,
        studentId: member.student.id,
        studentName: member.student.name,
        fatherName: member.student.fatherName || existing?.fatherName || "",
        classId: member.student.classId,
        className: member.className,
        rollNo: member.student.rollNo || "",
        phone: cleanPhone,
        familyGroupId: modalGroup.familyKey,
        siblingStudentIds: modalGroup.members.map((m) => m.student.id).filter((id) => id !== member.student.id),
        lastCallAt: nowIso,
        lastCallOutcome: outcome,
        lastCallDurationSec: parsedDur,
        lastCallBy: actorName,
        lastNote: entry.note,
        promisedAmount: parsedPromAmt,
        promiseDate: finalPromiseDate,
        nextCallDate: finalNextCallDate,
        totalCallsCount: (existing?.totalCallsCount || 0) + 1,
        callHistory: nextHistory,
        settled: false,
        resolvedTodayDate: resolvedTodayInModal ? todayYmd : "",
        resolvedNote: resolvedTodayInModal ? noteText.trim() || "Aaj sab solve ho gaya" : "",
        updatedAt: nowIso,
      };
    });

    const nextToCall = callNextAfterSave ? nextQueueGroup : null;

    setIsSavingCall(true);
    try {
      const res =
        recordsToSave.length === 1
          ? await saveFeeCallFollowUp(recordsToSave[0]).then((r) => ({
              syncedCount: r.synced ? 1 : 0,
              total: 1,
            }))
          : await saveFeeCallFollowUpBatch(recordsToSave);

      clearPendingActiveTagadaCall();
      pendingDialRef.current = null;
      setPendingSyncCount(getPendingFeeFollowUpSyncCount(schoolId));
      const savedGroupSnapshot = modalGroup;
      setModalGroup(null);

      // Feature 3: Auto-send Fee Reminder push on NOT_PICKED / SWITCHED_OFF if enabled
      if (
        (outcome === "NOT_PICKED" || outcome === "SWITCHED_OFF") &&
        sendMissedCallReminder &&
        isOnline &&
        savedGroupSnapshot
      ) {
        const pushStudentIds = Array.from(
          new Set(savedGroupSnapshot.members.map((m) => String(m.student.id || "").trim()).filter(Boolean))
        );
        if (pushStudentIds.length > 0) {
          const cleanSchool = (schoolName || "School").trim();
          const dueLabel =
            savedGroupSnapshot.combinedDue > 0
              ? `₹${savedGroupSnapshot.combinedDue.toLocaleString("en-IN")} fee baki hai`
              : "school fee reminder";
          void sendSchoolPushNotification({
            schoolId,
            studentIds: pushStudentIds,
            senderName: actorName,
            title: `📞 Missed Call Fee Reminder • ${cleanSchool}`,
            body: `${cleanSchool} se aapko Fee Tagada call kiya gaya tha (${dueLabel}). App me jaakar Quick Promise Date bhej sakte hain.`,
            type: "MONTHLY_FEE",
            voiceSpeak: true,
            url: `/?schoolPortal=1&schoolId=${encodeURIComponent(schoolId)}&openFeeReminder=1`,
          }).catch(() => {});
        }
      }

      const allSynced = res.syncedCount === res.total;
      if (outcome === "PROMISED_DATE" && finalPromiseDate && finalNextCallDate) {
        toast.success(
          allSynced
            ? `Saved! Promise: ${formatShortDate(finalPromiseDate)} (Unpaid raha to ${formatShortDate(finalNextCallDate)} ko Call List me aa jayega)`
            : `Offline Saved! Net aane par sync hoga. ${formatShortDate(finalNextCallDate)} ko reminder list me aa jayega.`
        );
      } else {
        toast.success(
          allSynced
            ? `Call record saved! Next Call: ${formatShortDate(finalNextCallDate)}`
            : `Offline Call record saved! Net aane par sync hoga.`
        );
      }

      if (nextToCall) {
        window.setTimeout(() => handlePlaceOfflineCall(nextToCall), 280);
      }
    } finally {
      setIsSavingCall(false);
    }
  };

  const handleCancelOutcomeModal = () => {
    clearPendingActiveTagadaCall();
    pendingDialRef.current = null;
    setModalGroup(null);
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.info("Abhi internet band hai — net aate hi apne-aap sync ho jayega.");
      return;
    }
    setIsSyncingNow(true);
    try {
      const count = await syncPendingFeeCallFollowUps(schoolId);
      setPendingSyncCount(getPendingFeeFollowUpSyncCount(schoolId));
      toast.success(count > 0 ? `${count} offline call records sync ho gaye!` : "Sabhi call records synced hain.");
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleOpenCollectFee = (group: TagadaFamilyGroup) => {
    if (!onCollectFee && !onCollectFamily) return;
    if (group.unpaidMembers.length <= 1) {
      const target = group.unpaidMembers[0] || group.primaryRow;
      if (target.fee && onCollectFee) onCollectFee(target);
      else if (onCollectFamily) onCollectFamily([target]);
      else toast.info("Iss student ka current month fee card open karein.");
      return;
    }
    setCollectPickerSelectedIds(group.unpaidMembers.map((m) => m.student.id));
    setCollectPickerGroup(group);
  };

  const handleSendFamilyWhatsAppText = (group: TagadaFamilyGroup) => {
    const digits = (group.phone || "").replace(/\D/g, "");
    const phone10 = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!phone10 || phone10.length < 10) {
      toast.error("Parent ka valid 10-digit WhatsApp mobile number missing hai.");
      return;
    }
    const childLines = (group.unpaidMembers.length > 0 ? group.unpaidMembers : group.members)
      .map((m, idx) => `${idx + 1}. *${m.student.name}* (${m.className}) — बकाया: *₹${m.dueAmount.toLocaleString("en-IN")}*`)
      .join("\n");
    const promiseInfo = group.record?.promiseDate
      ? `\nपिछली वादा तारीख: ${formatShortDate(group.record.promiseDate)}`
      : "";
    const message =
      `नमस्ते ${group.fatherName ? `${group.fatherName} जी` : "अभिभावक जी"},\n` +
      `*${schoolName}* की ओर से शुल्क अनुस्मारक:\n\n` +
      `${childLines}\n\n` +
      `कुल बकाया राशि: *₹${group.combinedDue.toLocaleString("en-IN")}*${promiseInfo}\n\n` +
      `कृपया शीघ्र स्कूल काउंटर या ऑनलाइन माध्यम से शुल्क जमा करें। धन्यवाद!`;

    const url = `https://wa.me/91${phone10}?text=${encodeURIComponent(message)}`;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleOpenWhatsApp = (group: TagadaFamilyGroup) => {
    const unpaidWithFee = group.unpaidMembers.filter((m) => Boolean(m.fee));
    if (group.members.length === 1 && unpaidWithFee.length === 1 && onOpenWhatsApp) {
      onOpenWhatsApp(unpaidWithFee[0]);
      return;
    }
    if (group.members.length > 1 || unpaidWithFee.length > 1) {
      setWhatsappPickerGroup(group);
      return;
    }
    handleSendFamilyWhatsAppText(group);
  };

  const renderFamilyCard = (group: TagadaFamilyGroup) => {
    const rec = group.record;
    const isBroken = group.bucket === "BROKEN_PROMISE";
    const isPaidGroup = group.bucket === "PAID_SETTLED";
    const isMultiSibling = group.members.length > 1;
    const overdueDays =
      rec?.promiseDate && todayYmd > rec.promiseDate ? diffDaysYmd(todayYmd, rec.promiseDate) : 0;
    const outcomeMeta = rec?.lastCallOutcome ? OUTCOME_META[rec.lastCallOutcome] : null;

    return (
      <div
        key={group.familyKey}
        className={`rounded-2xl border p-4 space-y-3 transition ${
          isBroken
            ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/80"
            : isPaidGroup
              ? "bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-900/60"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        }`}
      >
        {/* Header Row: Names + Combined Due */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                {group.displayTitle}
              </h3>
              {isMultiSibling && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Family ({group.members.length} Children)</span>
                </span>
              )}
              {isBroken && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Promise Broken ({overdueDays}d overdue)</span>
                </span>
              )}
              {isPaidGroup && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Paid &amp; Settled</span>
                </span>
              )}
            </div>

            {/* Clean unboxed metadata row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400">
              {group.fatherName && (
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3 shrink-0" />
                  <span>C/O {group.fatherName}</span>
                </span>
              )}
              {group.fatherName && <span aria-hidden="true">·</span>}
              <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                <Phone className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {group.phone || "Number Missing"}
              </span>
              {!isMultiSibling && group.primaryRow.student.rollNo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">Roll {group.primaryRow.student.rollNo}</span>
                </>
              )}
            </div>

            {/* Sibling-wise due & advance breakdown when 2+ children share a family card */}
            {isMultiSibling && (
              <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {group.members.map((m) => (
                  <span key={m.student.id} className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">{m.student.name}</span>
                    <span className="text-slate-400">({m.className}):</span>
                    {m.dueAmount > 0 ? (
                      <span className="font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                        {m.fee && !m.fee.paid && Number(m.fee.paidAmount || 0) > 0 ? "आंशिक " : ""}₹{m.dueAmount.toLocaleString("en-IN")}
                      </span>
                    ) : m.fee?.advanceCoveredMonths?.length ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Adv ({m.fee.advanceCoveredMonths.length}M)
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Paid</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {isMultiSibling ? "Family Total Due" : "Due Fee"}
            </span>
            <span
              className={`text-base sm:text-lg font-extrabold font-mono tabular-nums ${
                group.combinedDue > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              ₹{group.combinedDue.toLocaleString("en-IN")}
            </span>
            {group.combinedDue > 0 && group.maxUnpaidMonths > 1 && (
              <span className="block text-[11px] font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                {group.maxUnpaidMonths} months due
              </span>
            )}
          </div>
        </div>

        {/* Last Call / Promise / Settled Info Strip (hairline divider, no nested bordered card) */}
        {rec && (rec.lastCallAt || rec.promiseDate || rec.nextCallDate || rec.settledAt) && (
          <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {rec.lastCallAt && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Last Call: <strong className="text-slate-900 dark:text-white">{formatDateTimeShort(rec.lastCallAt)}</strong>
                  </span>
                )}
                {outcomeMeta && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {outcomeMeta.shortLabel}
                    </span>
                  </>
                )}
                {rec.lastCallDurationSec ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-500">{rec.lastCallDurationSec}s</span>
                  </>
                ) : null}
              </div>
              {rec.totalCallsCount ? (
                <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                  {rec.totalCallsCount} call{rec.totalCallsCount > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {rec.promiseDate && (
                <span className={isBroken ? "text-rose-700 dark:text-rose-300 font-bold" : "text-amber-700 dark:text-amber-300 font-bold"}>
                  Promised Date: {formatShortDate(rec.promiseDate)}
                  {rec.promisedAmount ? ` (₹${Number(rec.promisedAmount).toLocaleString("en-IN")})` : ""}
                </span>
              )}
              {!isPaidGroup && rec.nextCallDate && (
                <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
                  {todayYmd >= rec.nextCallDate
                    ? `Call Scheduled: ${rec.nextCallDate === todayYmd ? "Today" : formatShortDate(rec.nextCallDate)}`
                    : `Next Call: ${formatShortDate(rec.nextCallDate)}`}
                </span>
              )}
                  {isPaidGroup && rec.settledAt && (
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                  Settled: {formatDateTimeShort(rec.settledAt)}
                  {rec.settledReceiptNo ? ` · Receipt: ${rec.settledReceiptNo}` : ""}
                </span>
              )}
              {rec.resolvedTodayDate === todayYmd && (
                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                  Aaj Solve Ho Gaya ✅
                </span>
              )}
            </div>

            {rec.lastNote && (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                “{rec.lastNote}”
              </p>
            )}
          </div>
        )}

        {/* Action Row */}
        {!isPaidGroup && (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1.5">
            <button
              type="button"
              onClick={() => handlePlaceOfflineCall(group)}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap shadow-xs"
            >
              <PhoneCall className="w-4 h-4 shrink-0" />
              <span>Offline Call</span>
            </button>

            <button
              type="button"
              onClick={() => openOutcomeModalForGroup(group, "MANUAL_LOG", 0, undefined, null)}
              className="min-h-[46px] px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap shadow-xs"
            >
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span>Log / Set Date</span>
            </button>

            {onCollectFee && group.unpaidMembers.some((m) => Boolean(m.fee)) && (
              <button
                type="button"
                onClick={() => handleOpenCollectFee(group)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap shadow-xs"
              >
                <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                <span>Collect Fee</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenWhatsApp(group)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>WhatsApp</span>
            </button>

            {group.combinedDue > 0 && (
              <button
                type="button"
                onClick={() => setQrGroup(group)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                title="Exact ₹ UPI QR & Pay Link"
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span>UPI QR</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleToggleSolvedTodayForGroup(group)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition whitespace-nowrap ${
                rec?.resolvedTodayDate === todayYmd
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-500"
              }`}
              title="Aaj ka follow-up solve hua ya pending hai mark karein"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{rec?.resolvedTodayDate === todayYmd ? "Aaj Solve ✅" : "Mark Solve"}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={asPage ? "min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24" : "space-y-4"}>
      {/* Clean 2-Row Executive Header Card (Never Clips Right Edge on Mobile) */}
      <div className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-3.5">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Row 1: Identity + Connection Status */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-[42px] min-w-[42px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer shrink-0 transition"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">Fee Tagada Caller</span>
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {schoolName} · Family Grouping · Auto-Settle
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {pendingSyncCount > 0 && (
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncingNow}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title="Sync pending offline call records to cloud"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingNow ? "animate-spin" : ""}`} />
                  <span className="tabular-nums">Sync ({pendingSyncCount})</span>
                </button>
              )}
              <span
                className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-semibold inline-flex items-center gap-1 border whitespace-nowrap ${
                  isOnline
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700"
                }`}
              >
                {isOnline ? <Wifi className="w-3 h-3 shrink-0" /> : <WifiOff className="w-3 h-3 shrink-0" />}
                <span>{isOnline ? "Online" : "Offline"}</span>
              </span>
              <LanguageToggleButton tone="auto" compact />
              <ScreenInfoGuideButton portal="admin" screenKey="fee_tagada" tone="auto" />
            </div>
          </div>

          {/* Row 2: Symmetric Wrap-Safe Control Grid (Zero Horizontal Overflow) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full">
            <button
              type="button"
              onClick={handleToggleAnnounceDueAmount}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 border cursor-pointer whitespace-nowrap transition ${
                announceDueAmount
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-xs"
                  : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-amber-400"
              }`}
              title="Privacy Toggle: Parent ko call pre-alert me exact ₹ due amount bolna ON/OFF karein"
            >
              {announceDueAmount ? <Volume2 className="w-4 h-4 shrink-0" /> : <VolumeX className="w-4 h-4 shrink-0" />}
              <span className="truncate">Due Voice: {announceDueAmount ? "ON" : "OFF"}</span>
            </button>

            <button
              type="button"
              onClick={() => setPowerQueueEnabled((v) => !v)}
              className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 border cursor-pointer whitespace-nowrap transition ${
                powerQueueEnabled
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
              }`}
              title="Power Mode: Save karte hi agle parent ko call lagane ka button active rakhein"
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span className="truncate">Power Mode: {powerQueueEnabled ? "ON" : "OFF"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCallerIdSettings((v) => !v)}
              className={`${
                isNativeApk ? "" : "col-span-2 sm:col-span-1"
              } min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 border cursor-pointer whitespace-nowrap transition ${
                showCallerIdSettings
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-50/70 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:border-emerald-500"
              }`}
              title="Parent Caller ID (Ulta Directory) Settings & Test Preview"
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span className="truncate">Parent Caller ID</span>
            </button>

            {isNativeApk && (
              <button
                type="button"
                onClick={() => {
                  const bridge = getOfflineCallerBridge();
                  if (hasCallLogPerm) {
                    toast.success("Auto Call Log ON hai — SIM call ke baad exact Talk-Time apne-aap record hoga.");
                  } else {
                    bridge?.requestAutoCallLogPermission?.();
                  }
                }}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 border cursor-pointer whitespace-nowrap transition ${
                  hasCallLogPerm
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 hover:bg-amber-100"
                }`}
                title="SIM Call Log (READ_CALL_LOG) se exact talk-time verification"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="truncate">{hasCallLogPerm ? "Auto Log: ON" : "Enable Call Log"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-5 pt-4 space-y-4">
        {/* Always-Visible Caller ID & Voice Quick Test Bar */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              Caller ID &amp; Voice Quick Test
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Incoming/Outgoing popup aur Staff Voice bina settings khole yahin se test karein.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => triggerTestParentCallerPreview({ direction: "INCOMING" })}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <PhoneCall className="w-3.5 h-3.5 shrink-0" />
              <span>Test Incoming</span>
            </button>
            <button
              type="button"
              onClick={() =>
                triggerTestParentCallerPreview({
                  direction: "OUTGOING",
                  postCall: true,
                  durationSec: 74,
                })
              }
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>Test Outgoing</span>
            </button>
            <button
              type="button"
              onClick={() =>
                announceIncomingVoiceCaller({
                  callerName: "Rajesh Sir",
                  callerRole: "Class Teacher",
                  schoolName: schoolName || "School",
                  callType: "sim",
                  dedupeKey: `test_staff_voice_${Date.now()}`,
                  force: true,
                })
              }
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span>Test Staff Voice</span>
            </button>
          </div>
        </div>

        {showCallerIdSettings && (
          <CallerIdSettingsCard mode="staff" schoolId={schoolId} schoolName={schoolName} compact />
        )}

        {/* Highlight Banner for Broken Promises / Today's Queue */}
        {callTodayList.length > 0 && (
          <div className="rounded-2xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/80 dark:bg-rose-950/30 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs sm:text-sm font-bold text-rose-900 dark:text-rose-200">
                Aaj {callTodayList.length} Families ko Call Karna Hai (₹
                <span className="font-mono tabular-nums">{totalDueInCallToday.toLocaleString("en-IN")}</span> Due)
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                Jinki Promise Date beet gayi hai aur fee abhi tak jama nahi hui, wo sabse upar hain.
              </p>
            </div>
            {activeTab !== "CALL_TODAY" && (
              <button
                type="button"
                onClick={() => setActiveTab("CALL_TODAY")}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shrink-0 whitespace-nowrap"
              >
                Open Today List →
              </button>
            )}
          </div>
        )}

        {/* Search & Class Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Student, Father Name, Roll No ya Mobile se khojein..."
              className="w-full min-h-[42px] pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="ALL">
              All Classes ({allFamilyGroups.filter((g) => g.combinedDue > 0).length} Due Families)
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* 5 Queue Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("CALL_TODAY")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeTab === "CALL_TODAY"
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-rose-400"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold opacity-90 whitespace-nowrap">Aaj Call Karein</span>
              <PhoneCall className="w-3.5 h-3.5 shrink-0" />
            </div>
            <p className="mt-1 text-xl font-black font-mono tabular-nums">{callTodayList.length}</p>
            <p className="text-[10px] opacity-80 truncate">Broken + Today</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("NEVER_CALLED")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeTab === "NEVER_CALLED"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-400"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold opacity-90 whitespace-nowrap">Never Called</span>
              <PhoneMissed className="w-3.5 h-3.5 shrink-0" />
            </div>
            <p className="mt-1 text-xl font-black font-mono tabular-nums">{neverCalledList.length}</p>
            <p className="text-[10px] opacity-80 truncate">Pending Uncalled</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SCHEDULED")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeTab === "SCHEDULED"
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-amber-400"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold opacity-90 whitespace-nowrap">Promised / Wait</span>
              <Calendar className="w-3.5 h-3.5 shrink-0" />
            </div>
            <p className="mt-1 text-xl font-black font-mono tabular-nums">{scheduledWaitList.length}</p>
            <p className="text-[10px] opacity-80 truncate">Date Set · Wait</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("PAID_SETTLED")}
            className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeTab === "PAID_SETTLED"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-400"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold opacity-90 whitespace-nowrap">Paid / Settled</span>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            </div>
            <p className="mt-1 text-xl font-black font-mono tabular-nums">{paidSettledList.length}</p>
            <p className="text-[10px] opacity-80 truncate">Fee Cleared</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HISTORY")}
            className={`col-span-2 sm:col-span-1 p-3 rounded-2xl border text-left transition cursor-pointer ${
              activeTab === "HISTORY"
                ? "bg-slate-900 dark:bg-sky-600 text-white border-slate-900 dark:border-sky-600"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-sky-400"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold opacity-90 whitespace-nowrap">Call History</span>
              <History className="w-3.5 h-3.5 shrink-0" />
            </div>
            <p className="mt-1 text-xl font-black font-mono tabular-nums">{flatCallHistory.length}</p>
            <p className="text-[10px] opacity-80 truncate">Daily Report + Log</p>
          </button>
        </div>

        {/* Active Tab Lists */}
        {activeTab === "CALL_TODAY" && (
          <div className="space-y-3">
            {callTodayList.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Aaj ke liye koi Broken Promise ya Scheduled Call baki nahi hai!
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {neverCalledList.length > 0
                      ? `Abhi ${neverCalledList.length} due families ko ek bhi baar call nahi hua hai.`
                      : "Sabhi due families ya to scheduled hain ya fee jama kar chuke hain."}
                  </p>
                </div>
                {neverCalledList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("NEVER_CALLED")}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Never Called List Kholein ({neverCalledList.length}) →
                  </button>
                )}
              </div>
            ) : (
              callTodayList.map(renderFamilyCard)
            )}
          </div>
        )}

        {activeTab === "NEVER_CALLED" && (
          <div className="space-y-3">
            {neverCalledList.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Sabhi baki due families ko kam se kam ek baar call ya schedule kiya ja chuka hai!
              </div>
            ) : (
              neverCalledList.map(renderFamilyCard)
            )}
          </div>
        )}

        {activeTab === "SCHEDULED" && (
          <div className="space-y-3">
            {scheduledWaitList.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Abhi koi future Promise Date scheduled nahi hai. Call karke Promise Date set karein.
              </div>
            ) : (
              scheduledWaitList.map(renderFamilyCard)
            )}
          </div>
        )}

        {activeTab === "PAID_SETTLED" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Completed / Settled Families ({paidSettledList.length})
              </span>
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPaidFilterMode("SETTLED_TAGADA")}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer whitespace-nowrap ${
                    paidFilterMode === "SETTLED_TAGADA"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Tagada Settled
                </button>
                <button
                  type="button"
                  onClick={() => setPaidFilterMode("ALL_PAID")}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer whitespace-nowrap ${
                    paidFilterMode === "ALL_PAID"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  All ₹0 Due
                </button>
              </div>
            </div>

            {paidSettledList.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Abhi tak koi Tagada-settled family nahi hai. Jaise hi kisi student ki fee receipt kategi, wo yahan auto-move ho jayegi.
              </div>
            ) : (
              paidSettledList.map(renderFamilyCard)
            )}
          </div>
        )}

        {activeTab === "HISTORY" && (
          <div className="space-y-4">
            {/* Daily Caller Report Summary (Admin / Accountant) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Today’s Caller Report ({formatShortDate(todayYmd)})
                </h2>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Admin &amp; Accountant Summary
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Today Calls</span>
                  <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                    {dailyCallerStats.totalCalls}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Connected / Picked</span>
                  <span className="text-lg font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {dailyCallerStats.connectedCalls}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Not Picked / Off</span>
                  <span className="text-lg font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                    {dailyCallerStats.notPickedCalls}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">Total Promised (₹)</span>
                  <span className="text-lg font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    ₹{dailyCallerStats.promisedTotalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {dailyCallerStats.staffBreakdown.length > 0 && (
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                  <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Staff-wise Today Calls
                  </span>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {dailyCallerStats.staffBreakdown.map((st) => (
                      <div key={st.staffName} className="py-1.5 flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {st.staffName}
                        </span>
                        <div className="flex items-center gap-3 font-mono tabular-nums shrink-0 text-[11px]">
                          <span className="text-slate-700 dark:text-slate-300">{st.calls} calls</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{st.connected} picked</span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                            ₹{st.promisedAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Call Record Log ({flatCallHistory.length})
              </span>
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setHistoryRange("TODAY")}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    historyRange === "TODAY" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryRange("ALL")}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    historyRange === "ALL" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            {flatCallHistory.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {historyRange === "TODAY"
                  ? "Aaj abhi tak koi call log record nahi hua hai."
                  : "Abhi tak koi call log record nahi hua hai."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {flatCallHistory.map(({ entry, record, group, currentDue }) => {
                  const meta = OUTCOME_META[entry.outcome] || OUTCOME_META.OTHER;
                  const isPaidNow = currentDue <= 0;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {group ? group.displayTitle : `${record.studentName} (${record.className || "Class"})`}
                            </span>
                            <span aria-hidden="true" className="text-slate-400">·</span>
                            {isPaidNow ? (
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                Fee Paid
                              </span>
                            ) : (
                              <span className="text-xs font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                                Due: ₹{currentDue.toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                            {formatDateTimeShort(entry.calledAt)} · {entry.phone || "—"}
                            {typeof entry.durationSec === "number" ? ` · ${entry.durationSec}s` : ""}
                            {entry.autoLogVerified ? " (SIM Verified)" : ""}
                            {entry.calledBy ? ` · By ${entry.calledBy}` : ""}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${meta.colorCls}`}>
                          {meta.shortLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                        {entry.promiseDate && (
                          <span className="font-bold text-amber-700 dark:text-amber-300">
                            Promise Date: {formatShortDate(entry.promiseDate)}
                            {entry.promisedAmount ? ` (₹${Number(entry.promisedAmount).toLocaleString("en-IN")})` : ""}
                          </span>
                        )}
                        {entry.nextCallDate && (
                          <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                            Next Call: {formatShortDate(entry.nextCallDate)}
                          </span>
                        )}
                      </div>

                      {entry.note && (
                        <p className="text-xs text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                          {entry.note}
                        </p>
                      )}

                      {group && !isPaidNow && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handlePlaceOfflineCall(group)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>Call Again</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openOutcomeModalForGroup(group, "MANUAL_LOG", 0, undefined, null)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ClipboardEdit className="w-3 h-3" />
                            <span>Update Schedule</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CHILD SELECTOR MODAL FOR MULTI-SIBLING COLLECT FEE ── */}
      {collectPickerGroup && (onCollectFee || onCollectFamily) && (
        <div className="nst-isolated-modal fixed inset-0 z-[9995] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  Kis Bacche ki Fee Katni Hai?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Combined Family Due: ₹{collectPickerGroup.combinedDue.toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollectPickerGroup(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 max-h-[65vh] overflow-y-auto">
              {onCollectFamily && (() => {
                const chosenRows = collectPickerGroup.unpaidMembers.filter((m) =>
                  collectPickerSelectedIds.includes(m.student.id)
                );
                const chosenTotal = chosenRows.reduce((s, r) => s + r.dueAmount, 0);
                return (
                  <button
                    type="button"
                    disabled={chosenRows.length === 0}
                    onClick={() => {
                      const list = chosenRows.length > 0 ? chosenRows : collectPickerGroup.unpaidMembers;
                      setCollectPickerGroup(null);
                      onCollectFamily(list);
                    }}
                    className="w-full p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-left cursor-pointer transition shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black">
                        👨‍👩‍👧‍👦 Collect Selected Family Fee ({chosenRows.length})
                      </span>
                      <span className="font-mono font-black text-amber-300 text-sm">
                        ₹{chosenTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-100 mt-0.5">
                      Chune hue sabhi bhai-bahano ki 1 combined receipt &amp; smart settlement kholein
                    </p>
                  </button>
                );
              })()}

              {collectPickerGroup.unpaidMembers.map((member) => {
                const isChecked = collectPickerSelectedIds.includes(member.student.id);
                return (
                  <div
                    key={member.student.id}
                    className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-2.5"
                  >
                    <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setCollectPickerSelectedIds((prev) => {
                            const next = prev.includes(member.student.id)
                              ? prev.filter((id) => id !== member.student.id)
                              : [...prev, member.student.id];
                            return next.length > 0 ? next : prev;
                          });
                        }}
                        className="h-4 w-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {member.student.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {member.className}
                          {member.student.rollNo ? ` · Roll ${member.student.rollNo}` : ""}
                        </p>
                      </div>
                    </label>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        ₹{member.dueAmount.toLocaleString("en-IN")}
                      </span>
                      {onCollectFee && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = member;
                            setCollectPickerGroup(null);
                            if (target.fee) onCollectFee(target);
                            else toast.info(`${target.student.name} ka current month fee card open karein.`);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Single →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP OPTIONS MODAL FOR FAMILY CARDS ── */}
      {whatsappPickerGroup && (
        <div className="nst-isolated-modal fixed inset-0 z-[9995] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  WhatsApp Fee Reminder
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  Combined Due: ₹{whatsappPickerGroup.combinedDue.toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappPickerGroup(null)}
                className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2.5 max-h-[65vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  const g = whatsappPickerGroup;
                  setWhatsappPickerGroup(null);
                  handleSendFamilyWhatsAppText(g);
                }}
                className="w-full p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-left cursor-pointer transition"
              >
                <p className="text-sm font-bold">1-Tap Combined Family Reminder</p>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Sabhi bhai-bahano ka naam + total ₹{whatsappPickerGroup.combinedDue.toLocaleString("en-IN")} ek message me bhejein
                </p>
              </button>

              {onOpenWhatsApp &&
                whatsappPickerGroup.unpaidMembers
                  .filter((m) => Boolean(m.fee))
                  .map((member) => (
                    <button
                      key={member.student.id}
                      type="button"
                      onClick={() => {
                        setWhatsappPickerGroup(null);
                        onOpenWhatsApp(member);
                      }}
                      className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3 text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {member.student.name} ({member.className}) — Official Fee Slip
                        </p>
                      </div>
                      <span className="text-xs font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400 shrink-0">
                        ₹{member.dueAmount.toLocaleString("en-IN")}
                      </span>
                    </button>
                  ))}
            </div>
          </div>
        </div>
      )}

      {/* ── POST-CALL OUTCOME & PROMISE DATE SCHEDULER MODAL ── */}
      {modalGroup && (
        <div className="nst-isolated-modal fixed inset-0 z-[9990] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-white truncate">
                  Call Record &amp; Promise Date Set Karein
                </h3>
                <p className="text-xs text-slate-300 truncate mt-0.5">
                  {modalGroup.displayTitle} · Due: ₹{modalGroup.combinedDue.toLocaleString("en-IN")}
                </p>
                {autoLogInfo?.verified && (
                  <p className="text-[11px] font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      SIM Call Log Verified ·{" "}
                      {autoLogInfo.picked
                        ? `${durationSec}s Talk-Time`
                        : "0s (Call Not Picked)"}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCancelOutcomeModal}
                className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveCallOutcome(e, false)} className="p-5 space-y-4 overflow-y-auto">
              {/* Phone + Auto Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Parent Mobile
                  </label>
                  <input
                    type="tel"
                    value={editablePhone}
                    onChange={(e) => setEditablePhone(e.target.value)}
                    placeholder="10-digit number"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Call Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={durationSec}
                    onChange={(e) => setDurationSec(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm font-mono tabular-nums text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Outcome Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                  Call par kya baat hui?
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      "PROMISED_DATE",
                      "NOT_PICKED",
                      "BUSY",
                      "SWITCHED_OFF",
                      "PAID_CLAIMED",
                      "WRONG_NUMBER",
                    ] as FeeCallOutcome[]
                  ).map((key) => {
                    const active = outcome === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setOutcome(key)}
                        className={`px-2.5 py-2 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                          active
                            ? "bg-emerald-600 border-emerald-500 text-white"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {OUTCOME_META[key].shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Promise Date Picker & Auto Next-Day Call Rule */}
              {outcome === "PROMISED_DATE" ? (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-3">
                  <span className="block text-xs font-extrabold text-amber-300">
                    Kis Tarikh Ko Paisa Dene Ko Bole? (Promise Date)
                  </span>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Kal (Tomorrow)", date: addDaysYmd(todayYmd, 1) },
                      { label: "2 Din Baad", date: addDaysYmd(todayYmd, 2) },
                      { label: "5 Din Baad", date: addDaysYmd(todayYmd, 5) },
                      { label: "Next 10 Tarikh", date: getNextOccurrenceOfDayOfMonth(10, todayYmd) },
                      { label: "Next 20 Tarikh", date: getNextOccurrenceOfDayOfMonth(20, todayYmd) },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setPromiseDate(preset.date)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition ${
                          promiseDate === preset.date
                            ? "bg-amber-600 border-amber-500 text-white"
                            : "bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-500/50"
                        }`}
                      >
                        {preset.label} ({formatShortDate(preset.date)})
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        Promise Date *
                      </label>
                      <input
                        type="date"
                        value={promiseDate}
                        onChange={(e) => setPromiseDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        Promised Amount (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={promisedAmount}
                        onChange={(e) => setPromisedAmount(e.target.value)}
                        placeholder={String(modalGroup.combinedDue)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2 text-[11px] text-emerald-300 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={callNextDayAfterPromise}
                      onChange={(e) => setCallNextDayAfterPromise(e.target.checked)}
                      className="mt-0.5 rounded border-slate-600 text-emerald-500"
                    />
                    <span>
                      Agar <strong>{formatShortDate(promiseDate)}</strong> tak fee jama nahi hui, to{" "}
                      <strong>{formatShortDate(addDaysYmd(promiseDate, 1))}</strong> ko Due Fee aur Promise Date ke saath{" "}
                      <strong>Aaj Call Karein</strong> list me aa jaye.
                    </span>
                  </label>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <span className="block text-xs font-bold text-sky-300">
                    Agla Call Kab Karna Hai? (Next Call Date)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Kal (Tomorrow)", date: addDaysYmd(todayYmd, 1) },
                      { label: "2 Din Baad", date: addDaysYmd(todayYmd, 2) },
                      { label: "Aaj Sham (Today)", date: todayYmd },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setDirectNextCallDate(preset.date)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          directNextCallDate === preset.date
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-slate-900 border-slate-700 text-slate-300"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="date"
                    value={directNextCallDate}
                    onChange={(e) => setDirectNextCallDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                  />

                  {(outcome === "NOT_PICKED" || outcome === "SWITCHED_OFF") && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <label className="flex items-start gap-2 text-[11px] text-emerald-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendMissedCallReminder}
                          onChange={(e) => setSendMissedCallReminder(e.target.checked)}
                          className="mt-0.5 rounded border-slate-600 text-emerald-500"
                        />
                        <span>
                          Missed call par Parent ko <strong>Auto Fee Reminder Push</strong> bhejein (taaki wo Quick Promise Date reply kar sakein).
                        </span>
                      </label>
                      {modalGroup && (
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp(modalGroup)}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>WhatsApp Fee Reminder Bhejein</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Notes */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400">
                  Baatcheet ka Note / Remark
                </label>
                <div className="flex flex-wrap gap-1">
                  {QUICK_REMARKS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNoteText(r)}
                      className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 cursor-pointer"
                    >
                      + {r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Parent ne kya kaha (e.g. 20 tarikh ko shaam 5 baje denge)..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resolvedTodayInModal}
                  onChange={(e) => setResolvedTodayInModal(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500 rounded cursor-pointer shrink-0"
                />
                <span>
                  <strong>Aaj Sab Solve Ho Gaya</strong> — Aaj ke incoming call card par Solved ✅ dikhaye
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelOutcomeModal}
                  className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCall}
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{isSavingCall ? "Saving..." : "Save Record"}</span>
                </button>
                {(powerQueueEnabled || nextQueueGroup) && nextQueueGroup && (
                  <button
                    type="button"
                    disabled={isSavingCall}
                    onClick={() => void handleSaveCallOutcome(undefined, true)}
                    className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>Save &amp; Call Next</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {qrGroup && (
        <UpiQrShareModal
          isOpen={Boolean(qrGroup)}
          onClose={() => setQrGroup(null)}
          upiId={resolvedUpiId}
          schoolName={schoolName}
          amount={qrGroup.combinedDue}
          studentSummary={qrGroup.displayTitle}
          fatherName={qrGroup.fatherName}
          phone={qrGroup.phone}
        />
      )}
    </div>
  );
};
