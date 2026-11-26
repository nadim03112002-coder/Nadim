import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Edit3,
  IndianRupee,
  MessageCircle,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  QrCode,
  Save,
  UserPlus,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FeeCallFollowUpRecord,
  FeeCallOutcome,
  SchoolPublicInquiry,
} from "../../school-types";
import {
  saveFeeCallFollowUpBatch,
  saveSchoolPublicInquiry,
  updateStudent,
} from "../../school-firebase";
import { logAdminAction } from "../../utils/adminAudit";
import {
  announceIncomingParentCall,
  clearLastNativeIncomingParentCall,
  findCachedParentCallerByPhone,
  getLastNativeIncomingParentCall,
  getParentCallerIdOptions,
  getTodayLocalYmd,
  normalizePhoneLast10,
  syncNativeSimCallLogsToSchool,
  type CachedParentCallerInfo,
} from "../../utils/schoolCallerId";
import { UpiQrShareModal } from "./UpiQrShareModal";

interface IncomingParentCallModalProps {
  schoolId: string;
  schoolName?: string;
  schoolUpiId?: string;
  callerUserId?: string;
  callerUserName?: string;
  callerUserRole?: string;
  students?: Array<{
    id?: string;
    name?: string;
    fatherName?: string;
    classId?: string;
    className?: string;
    rollNo?: string;
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
  onCollectFee?: (studentId: string, classId?: string) => void;
  onUpdateFee?: (studentId: string, classId?: string) => void;
}

function formatDateDisplay(ymd?: string): string {
  if (!ymd) return "Set nahi";
  const clean = ymd.trim();
  const today = getTodayLocalYmd();
  if (clean === today) return "Aaj";
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return clean;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(d.getTime())) return clean;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatLastCallAgo(iso?: string): string {
  if (!iso) return "Pehli call";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatEnquiryStageLabel(stage?: string): string {
  switch ((stage || "").toLowerCase()) {
    case "new":
      return "New Enquiry";
    case "contacted":
      return "Contacted";
    case "visit_scheduled":
      return "Campus Visit Scheduled";
    case "applied":
      return "Applied";
    case "admitted":
      return "Admitted";
    case "resolved":
      return "Resolved";
    case "lost":
      return "Closed";
    default:
      return stage || "Open Enquiry";
  }
}

function addDaysFromTodayYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const VALID_FEE_CALL_OUTCOMES: readonly FeeCallOutcome[] = [
  "PROMISED_DATE",
  "PAID_CLAIMED",
  "PARTIAL_PAID",
  "PAYMENT_REFUSED",
  "CALLED_TO_SCHOOL",
  "NOT_PICKED",
  "BUSY",
  "SWITCHED_OFF",
  "CALLBACK_REQUESTED",
  "WRONG_NUMBER",
  "OTHER",
];

const FOLLOWUP_REQUIRED_OUTCOMES = new Set<FeeCallOutcome>([
  "PROMISED_DATE",
  "PARTIAL_PAID",
  "NOT_PICKED",
  "BUSY",
  "SWITCHED_OFF",
  "CALLBACK_REQUESTED",
  "CALLED_TO_SCHOOL",
]);

function toFeeCallOutcome(value?: string): FeeCallOutcome {
  if (value && (VALID_FEE_CALL_OUTCOMES as readonly string[]).includes(value)) {
    return value as FeeCallOutcome;
  }
  if (value === "PROMISED") return "PROMISED_DATE";
  if (value === "PAID_ALREADY") return "PAID_CLAIMED";
  return "PROMISED_DATE";
}

export const IncomingParentCallModal: React.FC<IncomingParentCallModalProps> = ({
  schoolId,
  schoolName,
  schoolUpiId,
  callerUserId,
  callerUserName,
  callerUserRole,
  students = [],
  classes = [],
  fees = [],
  feeCallFollowUps = [],
  absentStudentIds = [],
  inquiries = [],
  onCollectFee,
  onUpdateFee,
}) => {
  const [activeCall, setActiveCall] = useState<CachedParentCallerInfo | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [outcomeInput, setOutcomeInput] = useState<FeeCallOutcome>("PROMISED_DATE");
  const [promiseDateInput, setPromiseDateInput] = useState("");
  const [promisedAmountInput, setPromisedAmountInput] = useState("");
  const [partialPaidInput, setPartialPaidInput] = useState("");
  const [nextCallDateInput, setNextCallDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [solveConfirmOpen, setSolveConfirmOpen] = useState(false);
  const [solveReasonInput, setSolveReasonInput] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [unknownEnquiryName, setUnknownEnquiryName] = useState("");
  const [unknownEnquiryClass, setUnknownEnquiryClass] = useState("");
  const [savingUnknownEnquiry, setSavingUnknownEnquiry] = useState(false);

  const absentSet = useMemo(() => new Set(absentStudentIds), [absentStudentIds]);

  const resolveCallerFromLiveOrPayload = useCallback(
    (
      rawPayload: Partial<CachedParentCallerInfo> | string | null | undefined
    ): CachedParentCallerInfo | null => {
      if (!rawPayload) return null;
      const payload: Partial<CachedParentCallerInfo> =
        typeof rawPayload === "string" ? { phone: rawPayload } : rawPayload;

      const phoneKey = normalizePhoneLast10(payload.phone);
      const todayYmd = getTodayLocalYmd();
      const incomingPostCall = Boolean(payload.postCall);

      // 1. Try resolving live Parent from in-memory props if available
      if (phoneKey && students.length > 0 && payload.kind !== "ENQUIRY") {
        const classLabelMap = new Map<string, string>();
        for (const cls of classes) {
          if (!cls?.id) continue;
          const lbl = `${cls.name || ""}${cls.section ? ` ${cls.section}` : ""}`.trim();
          if (lbl) classLabelMap.set(cls.id, lbl);
        }

        const matchedStudents = students.filter((st) => {
          const candidates = [
            st.fatherPhone,
            st.phone,
            st.parentPhone,
            st.mobile,
            st.whatsapp,
            st.motherPhone,
          ];
          return candidates.some((c) => {
            const k = normalizePhoneLast10(c);
            return Boolean(
              k && (k === phoneKey || k.endsWith(phoneKey) || phoneKey.endsWith(k))
            );
          });
        });

        if (matchedStudents.length > 0) {
          const dueMap = new Map<string, { amount: number; months: number }>();
          const paidMap = new Map<string, number>();
          for (const fee of fees) {
            if (!fee?.studentId) continue;
            if (
              fee.isPreAdmission ||
              fee.status === "pre_admission" ||
              fee.isUpcoming ||
              fee.status === "upcoming"
            ) {
              continue;
            }
            const isCancelled = String(fee.status || "").toUpperCase() === "CANCELLED" || (fee as { cancelled?: boolean }).cancelled === true;
            if (isCancelled) continue;
            const isPaid = typeof fee.paid === "boolean" ? fee.paid : fee.status === "paid";
            const billed = Number(fee.monthlyAmount ?? fee.amount ?? 0);
            const paidAmt = Number(fee.paidAmount ?? (isPaid ? billed : 0) ?? 0);
            if (paidAmt > 0) {
              paidMap.set(fee.studentId, (paidMap.get(fee.studentId) || 0) + paidAmt);
            }
            if (isPaid) continue;
            const rem = Number(
              fee.balanceDue !== undefined ? fee.balanceDue : Math.max(0, billed - paidAmt)
            );
            if (rem > 0) {
              const cur = dueMap.get(fee.studentId) || { amount: 0, months: 0 };
              cur.amount += rem;
              cur.months += 1;
              dueMap.set(fee.studentId, cur);
            }
          }

          const children = matchedStudents.map((st) => {
            const stId = String(st.id || "");
            const clsLabel =
              String(st.className || "").trim() ||
              (st.classId ? classLabelMap.get(st.classId) || "" : "");
            const d = stId
              ? dueMap.get(stId) || { amount: 0, months: 0 }
              : { amount: 0, months: 0 };
            const paidTotal = stId ? paidMap.get(stId) || 0 : 0;
            return {
              id: stId,
              name: String(st.name || "").trim(),
              classLabel: clsLabel,
              dueAmount: d.amount,
              paidAmount: paidTotal,
              unpaidMonthsCount: d.months,
            };
          });

          const studentIds = children.map((c) => c.id).filter(Boolean);
          const absentToday = studentIds.some((id) => absentSet.has(id));
          const fuMatches = feeCallFollowUps.filter(
            (fu) =>
              (fu.studentId && studentIds.includes(fu.studentId)) ||
              normalizePhoneLast10(fu.phone) === phoneKey
          );

          let promiseDate = "";
          let promisedAmount = 0;
          let nextCallDate = "";
          let resolvedTodayDate = "";
          let resolvedNote = "";
          let settled = false;
          let settledAt = "";
          let lastCallAt = "";
          let lastCallOutcome: FeeCallOutcome | undefined;
          let lastNote = "";

          for (const fu of fuMatches) {
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
              lastCallOutcome = fu.lastCallOutcome;
            }
            if (fu.lastNote && !lastNote) {
              lastNote = fu.lastNote;
            }
          }

          const first = children[0];
          const fatherName =
            matchedStudents.find((s) => s.fatherName)?.fatherName?.trim() || "";
          const onlyMother = matchedStudents.every((st) => {
            const mKey = normalizePhoneLast10(st.motherPhone);
            const nonM = [st.fatherPhone, st.phone, st.parentPhone, st.mobile, st.whatsapp].some(
              (c) => normalizePhoneLast10(c) === phoneKey
            );
            return mKey === phoneKey && !nonM;
          });
          const relationLabel = onlyMother ? "Mother" : fatherName ? "Father" : "Parent";
          const totalDue = children.reduce((sum, c) => sum + c.dueAmount, 0);
          const totalPaid = children.reduce((sum, c) => sum + Number(c.paidAmount || 0), 0);
          const totalMonths = children.reduce((sum, c) => sum + c.unpaidMonthsCount, 0);

          let studentSummary = "";
          if (children.length === 1) {
            studentSummary = first.classLabel
              ? `${first.classLabel} ke ${first.name}`
              : first.name;
          } else {
            const c1 = first.classLabel ? `${first.classLabel} ke ${first.name}` : first.name;
            const c2 = children[1].classLabel
              ? `${children[1].name} (${children[1].classLabel})`
              : children[1].name;
            const extra = children.length > 2 ? ` +${children.length - 2}` : "";
            studentSummary = `${c1} aur ${c2}${extra}`;
          }

          const solvedToday =
            resolvedTodayDate === todayYmd ||
            (settled && totalDue <= 0) ||
            (Boolean(settledAt) && settledAt.slice(0, 10) === todayYmd);

          return {
            phone: phoneKey,
            name: fatherName
              ? `${fatherName} ji (${relationLabel})`
              : `${first.name} ke ${relationLabel}`,
            schoolName: schoolName || "School",
            kind: "PARENT",
            studentSummary,
            relationLabel,
            fatherName: fatherName || undefined,
            primaryStudentId: first.id || undefined,
            studentIds,
            classNames: Array.from(new Set(children.map((c) => c.classLabel).filter(Boolean))),
            dueAmount: totalDue,
            paidAmount: totalPaid,
            unpaidMonthsCount: totalMonths,
            promiseDate: promiseDate || undefined,
            promisedAmount: promisedAmount || undefined,
            nextCallDate: nextCallDate || undefined,
            solvedToday,
            resolvedTodayDate: resolvedTodayDate || undefined,
            resolvedNote: resolvedNote || undefined,
            settled,
            settledAt: settledAt || undefined,
            lastCallAt: lastCallAt || undefined,
            lastCallOutcome,
            lastNote: lastNote || undefined,
            absentToday,
            postCall: incomingPostCall || undefined,
            direction: payload.direction,
            durationSec: payload.durationSec,
            callType: payload.callType,
            children,
            isTestSample: payload.isTestSample,
          };
        }
      }

      // 1b. Check live Admission Enquiries if not matched as an enrolled parent
      if (phoneKey && inquiries.length > 0) {
        const matchedInq = inquiries.find((inq) => {
          const k = normalizePhoneLast10(inq.phone);
          return Boolean(
            k && (k === phoneKey || k.endsWith(phoneKey) || phoneKey.endsWith(k))
          );
        });
        if (matchedInq) {
          const childPart = String(matchedInq.studentName || "").trim();
          const classPart = String(matchedInq.studentClass || "").trim();
          const studentSummary =
            classPart && childPart
              ? `${classPart} (${childPart})`
              : classPart || childPart || "Admission";
          return {
            phone: phoneKey,
            name: matchedInq.name,
            schoolName: schoolName || "School",
            kind: "ENQUIRY",
            studentSummary,
            relationLabel: "Enquiry",
            studentIds: [],
            classNames: classPart ? [classPart] : [],
            dueAmount: 0,
            unpaidMonthsCount: 0,
            solvedToday: false,
            settled: false,
            enquiryId: matchedInq.id,
            enquiryStage: matchedInq.status,
            enquiryFollowUpDate: matchedInq.followUpDate,
            enquiryVisitDate: matchedInq.visitDate,
            enquiryNote: matchedInq.remarks || matchedInq.message,
            counsellorName: matchedInq.counsellorName,
            nextCallDate: matchedInq.followUpDate || matchedInq.visitDate,
            lastNote: matchedInq.remarks || matchedInq.message,
            postCall: incomingPostCall || undefined,
            direction: payload.direction,
            durationSec: payload.durationSec,
            callType: payload.callType,
            children: [],
            isTestSample: payload.isTestSample,
          };
        }
      }

      // 2. Fallback to cached localStorage directory (works offline / before Firestore resolves)
      const cached = phoneKey ? findCachedParentCallerByPhone(phoneKey) : null;
      if (cached) {
        return {
          ...cached,
          postCall: incomingPostCall || cached.postCall,
          direction: payload.direction || cached.direction,
          durationSec: payload.durationSec ?? cached.durationSec,
          callType: payload.callType || cached.callType,
          isTestSample: payload.isTestSample ?? cached.isTestSample,
        };
      }

      // 3. Unknown number OR explicit preview sample fallback
      if (!payload.name && !payload.studentSummary && !payload.isTestSample && phoneKey) {
        return {
          phone: phoneKey,
          name: "Unknown Number",
          schoolName: payload.schoolName || schoolName || "School",
          kind: "ENQUIRY",
          studentSummary: "School Record Me Nahi Hai",
          relationLabel: "Unknown Caller",
          studentIds: [],
          classNames: [],
          dueAmount: 0,
          paidAmount: 0,
          unpaidMonthsCount: 0,
          solvedToday: false,
          settled: false,
          postCall: incomingPostCall || undefined,
          direction: payload.direction,
          durationSec: payload.durationSec,
          callType: payload.callType,
          children: [],
          isUnknownCaller: true,
        };
      }

      if (payload.name || payload.studentSummary || phoneKey) {
        return {
          phone: phoneKey || String(payload.phone || ""),
          name: payload.name || "Parent Call",
          schoolName: payload.schoolName || schoolName || "School",
          kind: payload.kind === "ENQUIRY" ? "ENQUIRY" : "PARENT",
          studentSummary: payload.studentSummary || payload.name || "Student",
          relationLabel: payload.relationLabel || "Parent",
          fatherName: payload.fatherName,
          primaryStudentId: payload.primaryStudentId,
          studentIds:
            payload.studentIds || (payload.primaryStudentId ? [payload.primaryStudentId] : []),
          classNames: payload.classNames || [],
          dueAmount: Number(payload.dueAmount || 0),
          paidAmount: payload.paidAmount !== undefined ? Number(payload.paidAmount) : undefined,
          unpaidMonthsCount: Number(payload.unpaidMonthsCount || 0),
          promiseDate: payload.promiseDate || undefined,
          promisedAmount: payload.promisedAmount ? Number(payload.promisedAmount) : undefined,
          nextCallDate: payload.nextCallDate || undefined,
          solvedToday: Boolean(payload.solvedToday),
          settled: Boolean(payload.settled),
          lastCallAt: payload.lastCallAt,
          lastCallOutcome: payload.lastCallOutcome,
          lastNote: payload.lastNote,
          absentToday: Boolean(payload.absentToday),
          enquiryId: payload.enquiryId,
          enquiryStage: payload.enquiryStage,
          enquiryFollowUpDate: payload.enquiryFollowUpDate,
          enquiryVisitDate: payload.enquiryVisitDate,
          enquiryNote: payload.enquiryNote,
          counsellorName: payload.counsellorName,
          postCall: incomingPostCall || undefined,
          direction: payload.direction,
          durationSec: payload.durationSec,
          callType: payload.callType,
          children: payload.children || [],
          isTestSample: payload.isTestSample,
          isUnknownCaller: payload.isUnknownCaller,
        };
      }

      return null;
    },
    [absentSet, classes, feeCallFollowUps, fees, inquiries, schoolName, students]
  );

  const openCallerModal = useCallback(
    (
      rawPayload: Partial<CachedParentCallerInfo> | string | null | undefined,
      isManual = false
    ) => {
      const opts = getParentCallerIdOptions();
      if (!isManual && (!opts.parentCallerEnabled || !opts.cardPopupEnabled)) {
        return;
      }
      const resolved = resolveCallerFromLiveOrPayload(rawPayload);
      if (!resolved) return;
      setActiveCall(resolved);
      setOutcomeInput(toFeeCallOutcome(resolved.lastCallOutcome));
      setPromiseDateInput(resolved.promiseDate || "");
      setPromisedAmountInput(
        resolved.promisedAmount
          ? String(resolved.promisedAmount)
          : resolved.dueAmount > 0
            ? String(resolved.dueAmount)
            : ""
      );
      setPartialPaidInput("");
      setNextCallDateInput(resolved.nextCallDate || "");
      setNoteInput(resolved.lastNote || "");
      // Auto-open post-call edit workspace when the call has disconnected
      setEditingSchedule(Boolean(resolved.postCall && !resolved.isUnknownCaller));
      setShowQrModal(false);
      setSolveConfirmOpen(false);
      setSolveReasonInput("");
      setEditingPhone(false);
      setPhoneInput(resolved.phone || "");
      setUnknownEnquiryName("");
      setUnknownEnquiryClass("");
    },
    [resolveCallerFromLiveOrPayload]
  );

  // Re-sync live data if activeCall is already open and follow-ups/fees update
  useEffect(() => {
    if (!activeCall || activeCall.isTestSample) return;
    const refreshed = resolveCallerFromLiveOrPayload(activeCall);
    if (refreshed) {
      setActiveCall(refreshed);
    }
  }, [feeCallFollowUps, fees, students, inquiries, absentStudentIds]);

  const triggerCallLogAutoSync = useCallback(() => {
    if (!schoolId) return;
    void syncNativeSimCallLogsToSchool({
      schoolId,
      recordedByUserId: callerUserId,
      recordedByName: callerUserName,
      recordedByRole: callerUserRole,
    });
  }, [schoolId, callerUserId, callerUserName, callerUserRole]);

  // Listen for native Android broadcasts, test previews, deep-link params, and pending native last call
  useEffect(() => {
    const onNativeIncoming = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const parsed =
        typeof detail === "string"
          ? (() => {
              try {
                return JSON.parse(detail);
              } catch {
                return null;
              }
            })()
          : detail;
      if (parsed) {
        clearLastNativeIncomingParentCall();
        openCallerModal(parsed, false);
        triggerCallLogAutoSync();
      }
    };

    const onTestPreview = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        openCallerModal(detail, true);
      }
    };

    const checkPendingNativeOrQuery = () => {
      triggerCallLogAutoSync();
      try {
        const params = new URLSearchParams(window.location.search);
        const qPhone = params.get("incomingParentPhone");
        const qFlag = params.get("incomingParentCall");
        const qPost = params.get("postCall") === "1";
        if (qPhone && qFlag === "1") {
          clearLastNativeIncomingParentCall();
          openCallerModal({ phone: qPhone, postCall: qPost }, true);
          params.delete("incomingParentPhone");
          params.delete("incomingParentCall");
          params.delete("postCall");
          const cleanSearch = params.toString();
          const nextUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", nextUrl);
          return;
        }
      } catch {}

      const lastNative = getLastNativeIncomingParentCall();
      if (lastNative && lastNative.phone) {
        const ageMs = lastNative.receivedAtMs ? Date.now() - lastNative.receivedAtMs : 0;
        clearLastNativeIncomingParentCall();
        if (ageMs <= 5 * 60 * 1000) {
          openCallerModal(lastNative, false);
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        checkPendingNativeOrQuery();
      }
    };

    const onOfflineCallReturn = () => {
      triggerCallLogAutoSync();
    };

    window.addEventListener("android-incoming-parent-call", onNativeIncoming);
    window.addEventListener("android-offline-call-returned", onOfflineCallReturn);
    window.addEventListener("nsta-test-incoming-parent-call", onTestPreview);
    document.addEventListener("visibilitychange", onVisibility);

    checkPendingNativeOrQuery();

    return () => {
      window.removeEventListener("android-incoming-parent-call", onNativeIncoming);
      window.removeEventListener("android-offline-call-returned", onOfflineCallReturn);
      window.removeEventListener("nsta-test-incoming-parent-call", onTestPreview);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [openCallerModal, triggerCallLogAutoSync]);

  const primaryClassId = useMemo(() => {
    if (!activeCall?.primaryStudentId) return undefined;
    return students.find((s) => s.id === activeCall.primaryStudentId)?.classId;
  }, [activeCall, students]);

  if (!activeCall) return null;

  const todayYmd = getTodayLocalYmd();
  const isEnquiry = activeCall.kind === "ENQUIRY";
  const isPromiseOverdue = Boolean(
    !isEnquiry &&
      activeCall.promiseDate &&
      activeCall.promiseDate < todayYmd &&
      activeCall.dueAmount > 0 &&
      !activeCall.solvedToday
  );
  const isNextCallDueTodayOrPast = Boolean(
    !isEnquiry &&
      activeCall.nextCallDate &&
      activeCall.nextCallDate <= todayYmd &&
      !activeCall.solvedToday
  );

  const persistFollowUpUpdates = async (
    overrides: Partial<FeeCallFollowUpRecord>,
    successMsg: string
  ) => {
    if (activeCall.isTestSample || activeCall.studentIds.length === 0) {
      setActiveCall((prev) =>
        prev
          ? {
              ...prev,
              promiseDate:
                overrides.promiseDate !== undefined ? overrides.promiseDate : prev.promiseDate,
              promisedAmount:
                overrides.promisedAmount !== undefined
                  ? overrides.promisedAmount
                  : prev.promisedAmount,
              nextCallDate:
                overrides.nextCallDate !== undefined ? overrides.nextCallDate : prev.nextCallDate,
              solvedToday:
                overrides.resolvedTodayDate !== undefined
                  ? overrides.resolvedTodayDate === todayYmd
                  : prev.solvedToday,
              resolvedTodayDate:
                overrides.resolvedTodayDate !== undefined
                  ? overrides.resolvedTodayDate
                  : prev.resolvedTodayDate,
              lastNote: overrides.lastNote !== undefined ? overrides.lastNote : prev.lastNote,
            }
          : null
      );
      toast.success(successMsg);
      return;
    }

    if (!schoolId) {
      toast.error("School ID nahi mila.");
      return;
    }

    setSaving(true);
    try {
      const existingById = new Map(feeCallFollowUps.map((f) => [f.studentId, f]));
      const nowIso = new Date().toISOString();
      const batch: FeeCallFollowUpRecord[] = [];

      for (const stuId of activeCall.studentIds) {
        const stObj = students.find((s) => s.id === stuId);
        const childSummary = activeCall.children.find((c) => c.id === stuId);
        const existing = existingById.get(stuId);
        const clsLabel =
          childSummary?.classLabel || stObj?.className || existing?.className || "";
        const nextTotalCalls =
          overrides.lastCallOutcome !== undefined
            ? (Number(existing?.totalCallsCount || 0) + 1)
            : existing?.totalCallsCount;
        batch.push({
          id: stuId,
          schoolId,
          studentId: stuId,
          studentName: stObj?.name || childSummary?.name || existing?.studentName || "Student",
          fatherName: stObj?.fatherName || activeCall.fatherName || existing?.fatherName,
          classId: stObj?.classId || existing?.classId || "",
          className: clsLabel,
          rollNo: stObj?.rollNo || existing?.rollNo,
          phone: activeCall.phone || existing?.phone || "",
          familyGroupId: existing?.familyGroupId,
          siblingStudentIds:
            activeCall.studentIds.length > 1 ? activeCall.studentIds : existing?.siblingStudentIds,
          lastCallAt: overrides.lastCallAt || existing?.lastCallAt || nowIso,
          lastCallOutcome: overrides.lastCallOutcome ?? existing?.lastCallOutcome,
          lastCallDurationSec: existing?.lastCallDurationSec,
          lastCallBy: callerUserName || existing?.lastCallBy,
          lastCallByRole: callerUserRole || existing?.lastCallByRole,
          lastNote: overrides.lastNote !== undefined ? overrides.lastNote : existing?.lastNote,
          promisedAmount:
            overrides.promisedAmount !== undefined
              ? overrides.promisedAmount
              : existing?.promisedAmount,
          promiseDate:
            overrides.promiseDate !== undefined ? overrides.promiseDate : existing?.promiseDate,
          nextCallDate:
            overrides.nextCallDate !== undefined ? overrides.nextCallDate : existing?.nextCallDate,
          totalCallsCount: nextTotalCalls,
          callHistory: existing?.callHistory,
          settled: overrides.settled !== undefined ? overrides.settled : existing?.settled,
          settledAt: overrides.settledAt !== undefined ? overrides.settledAt : existing?.settledAt,
          settledReceiptNo: existing?.settledReceiptNo,
          settledAmount: existing?.settledAmount,
          settledBy: existing?.settledBy,
          resolvedTodayDate:
            overrides.resolvedTodayDate !== undefined
              ? overrides.resolvedTodayDate
              : existing?.resolvedTodayDate,
          resolvedNote:
            overrides.resolvedNote !== undefined ? overrides.resolvedNote : existing?.resolvedNote,
          resolvedBy:
            overrides.resolvedBy !== undefined ? overrides.resolvedBy : existing?.resolvedBy,
          resolvedReason:
            overrides.resolvedReason !== undefined
              ? overrides.resolvedReason
              : existing?.resolvedReason,
          updatedAt: nowIso,
        });
      }

      await saveFeeCallFollowUpBatch(batch);
      setActiveCall((prev) =>
        prev
          ? {
              ...prev,
              lastCallOutcome: overrides.lastCallOutcome ?? prev.lastCallOutcome,
              promiseDate:
                overrides.promiseDate !== undefined ? overrides.promiseDate : prev.promiseDate,
              promisedAmount:
                overrides.promisedAmount !== undefined
                  ? overrides.promisedAmount
                  : prev.promisedAmount,
              nextCallDate:
                overrides.nextCallDate !== undefined ? overrides.nextCallDate : prev.nextCallDate,
              solvedToday:
                overrides.resolvedTodayDate !== undefined
                  ? overrides.resolvedTodayDate === todayYmd
                  : prev.solvedToday,
              resolvedTodayDate:
                overrides.resolvedTodayDate !== undefined
                  ? overrides.resolvedTodayDate
                  : prev.resolvedTodayDate,
              lastNote: overrides.lastNote !== undefined ? overrides.lastNote : prev.lastNote,
            }
          : null
      );
      toast.success(successMsg);
    } catch {
      toast.error("Update save karne me dikkat aayi.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSolvedToday = () => {
    setSolveReasonInput("");
    setSolveConfirmOpen(true);
  };

  const handleConfirmToggleSolvedToday = async () => {
    const cleanReason = solveReasonInput.trim();
    if (cleanReason.length < 3) {
      toast.error("Kripya Mark Solve / Reopen ka spasht kaaran (Reason) likhein.");
      return;
    }
    const nextSolved = !activeCall.solvedToday;
    await persistFollowUpUpdates(
      {
        resolvedTodayDate: nextSolved ? todayYmd : "",
        resolvedNote: nextSolved ? cleanReason : "",
        resolvedBy: callerUserName || "Staff",
        resolvedReason: cleanReason,
      },
      nextSolved
        ? "Marked: Aaj Sab Solve Ho Gaya ✅"
        : "Reopened: Abhi Pending Rakha Gaya"
    );
    void logAdminAction(
      nextSolved ? "FEE_TAGADA_MARK_SOLVE" : "FEE_TAGADA_REOPEN",
      `${nextSolved ? "Marked Solve" : "Reopened"} on Caller ID (${activeCall.phone}) — Reason: ${cleanReason}`,
      { id: callerUserId || callerUserName || "staff", name: `${callerUserName || "Staff"} (${callerUserRole || "STAFF"})` },
      { targetId: activeCall.primaryStudentId || activeCall.phone, targetName: activeCall.studentSummary || activeCall.name }
    );
    setSolveConfirmOpen(false);
    setSolveReasonInput("");
  };

  const handleSaveFixedPhone = async () => {
    const clean10 = normalizePhoneLast10(phoneInput);
    if (!clean10 || clean10.length < 10) {
      toast.error("Kripya sahi 10-digit mobile number darj karein.");
      return;
    }
    if (!activeCall.isTestSample && schoolId && activeCall.studentIds.length > 0) {
      setSaving(true);
      try {
        for (const sid of activeCall.studentIds) {
          await updateStudent(schoolId, sid, { phone: clean10, fatherPhone: clean10 }).catch(() => {});
        }
        await persistFollowUpUpdates(
          {
            lastNote: noteInput.trim() || `Number corrected from ${activeCall.phone} to ${clean10}`,
          },
          `Parent phone number update ho gaya: ${clean10} ✅`
        );
        void logAdminAction(
          "PARENT_PHONE_FIXED",
          `Corrected phone from ${activeCall.phone} to ${clean10}`,
          { id: callerUserId || callerUserName || "staff", name: `${callerUserName || "Staff"} (${callerUserRole || "STAFF"})` },
          { targetId: activeCall.primaryStudentId || clean10, targetName: activeCall.studentSummary || activeCall.name }
        );
      } finally {
        setSaving(false);
      }
    } else {
      toast.success(`Preview Phone Updated: ${clean10}`);
    }
    setActiveCall((prev) => (prev ? { ...prev, phone: clean10 } : null));
    setEditingPhone(false);
  };

  const handleSaveUnknownAsEnquiry = async () => {
    const cleanName = unknownEnquiryName.trim();
    if (!cleanName) {
      toast.error("Kripya Caller / Parent ka naam darj karein.");
      return;
    }
    if (!schoolId) {
      toast.error("School ID nahi mila.");
      return;
    }
    setSavingUnknownEnquiry(true);
    try {
      const nowIso = new Date().toISOString();
      await saveSchoolPublicInquiry(schoolId, {
        id: `inq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        schoolId,
        name: cleanName,
        phone: activeCall.phone,
        studentName: cleanName,
        studentClass: unknownEnquiryClass.trim() || "New Enquiry",
        message: `Caller ID se unknown incoming call (${activeCall.phone}) ko enquiry me joda gaya.`,
        remarks: `Logged by ${callerUserName || "Staff"} (${callerUserRole || "STAFF"})`,
        status: "new",
        source: "phone",
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      toast.success("Unknown caller Admission Enquiry me save ho gaya ✅");
      setActiveCall(null);
    } catch {
      toast.error("Enquiry save karne me dikkat aayi.");
    } finally {
      setSavingUnknownEnquiry(false);
    }
  };

  const handleSelectOutcomePreset = (outcome: FeeCallOutcome) => {
    setOutcomeInput(outcome);
    if (outcome === "NOT_PICKED" || outcome === "BUSY" || outcome === "SWITCHED_OFF") {
      if (!nextCallDateInput) setNextCallDateInput(addDaysFromTodayYmd(1));
    } else if (outcome === "PROMISED_DATE" || outcome === "PARTIAL_PAID" || outcome === "CALLED_TO_SCHOOL") {
      if (!promiseDateInput) setPromiseDateInput(addDaysFromTodayYmd(2));
      if (!nextCallDateInput) setNextCallDateInput(addDaysFromTodayYmd(2));
    } else if (outcome === "PAID_CLAIMED" || outcome === "PAYMENT_REFUSED") {
      setNextCallDateInput(outcome === "PAYMENT_REFUSED" ? addDaysFromTodayYmd(3) : "");
    }
  };

  const handleSaveScheduleForm = async () => {
    const cleanNote = noteInput.trim();
    if (!cleanNote) {
      toast.error("Baatcheet ka Remark / Note likhna anivarya hai!");
      return;
    }
    if (FOLLOWUP_REQUIRED_OUTCOMES.has(outcomeInput) && !nextCallDateInput.trim() && !promiseDateInput.trim()) {
      toast.error("Is call outcome ke liye Next Call Date ya Promise Date darj karna anivarya hai!");
      return;
    }
    const partialAmt = outcomeInput === "PARTIAL_PAID" ? Math.max(0, Number(partialPaidInput) || 0) : 0;
    if (outcomeInput === "PARTIAL_PAID" && partialAmt <= 0) {
      toast.error("Partial Fee Jama Ki me jama hui rashi (₹) darj karein!");
      return;
    }
    const nowIso = new Date().toISOString();
    const resolvedNextCall = nextCallDateInput.trim() || promiseDateInput.trim();
    const enrichedNote =
      outcomeInput === "PARTIAL_PAID"
        ? `[Partial ₹${partialAmt.toLocaleString("en-IN")} | Rem ₹${Math.max(0, activeCall.dueAmount - partialAmt).toLocaleString("en-IN")}] ${cleanNote}`
        : outcomeInput === "PAYMENT_REFUSED"
          ? `[Principal Alert: Payment Refused] ${cleanNote}`
          : outcomeInput === "CALLED_TO_SCHOOL"
            ? `[School Milne Bulaya] ${cleanNote}`
            : cleanNote;

    await persistFollowUpUpdates(
      {
        lastCallAt: nowIso,
        lastCallOutcome: outcomeInput,
        promiseDate: promiseDateInput.trim(),
        promisedAmount: promisedAmountInput ? Number(promisedAmountInput) : 0,
        nextCallDate: resolvedNextCall,
        lastNote: enrichedNote,
        ...(outcomeInput === "PAID_CLAIMED"
          ? { resolvedTodayDate: todayYmd, resolvedNote: cleanNote }
          : {}),
      },
      outcomeInput === "PAID_CLAIMED"
        ? "Recorded: Verification Pending (Receipt katne par ledger settle hoga) ✅"
        : "Call Update, Remark aur Schedule save ho gaya ✅"
    );
    setEditingSchedule(false);
  };

  const handleTriggerMainFeePay = () => {
    if (activeCall.isTestSample) {
      toast.info("Sample Preview: Real parent call par yeh button direct student ka Main Fee Pay page kholega.");
      return;
    }
    if (!onCollectFee || !activeCall.primaryStudentId) {
      toast.info("Fee Payment sirf Admin ya Accountant panel me uplabdh hai.");
      return;
    }
    const sid = activeCall.primaryStudentId;
    setActiveCall(null);
    onCollectFee(sid, primaryClassId);
  };

  const handleDialBack = () => {
    const clean = activeCall.phone.replace(/\D/g, "");
    if (!clean) return;
    const bridge = (window as unknown as {
      LifeMakerAndroid?: { startOfflinePhoneCall?: (phone: string, id: string) => boolean };
    }).LifeMakerAndroid;
    if (bridge?.startOfflinePhoneCall) {
      bridge.startOfflinePhoneCall(clean, `callback_${Date.now()}`);
    } else {
      window.location.href = `tel:${clean}`;
    }
  };

  const handleWhatsApp = () => {
    const digits = activeCall.phone.replace(/\D/g, "");
    if (!digits) return;
    const intl = digits.length === 10 ? `91${digits}` : digits;

    if (isEnquiry) {
      const msg = encodeURIComponent(
        `Namaste ${activeCall.name},\n*${activeCall.schoolName}* me aapki admission enquiry (${activeCall.studentSummary}) ke liye dhanyavaad. School visit ya jankari ke liye humse jude rahein.`
      );
      window.location.href = `https://wa.me/${intl}?text=${msg}`;
      return;
    }

    const dueText =
      activeCall.dueAmount > 0
        ? `₹${activeCall.dueAmount.toLocaleString("en-IN")} fee baki hai`
        : "fee record clear hai";
    const promiseText = activeCall.promiseDate
      ? ` (Promise Date: ${formatDateDisplay(activeCall.promiseDate)})`
      : "";
    const msg = encodeURIComponent(
      `Namaste ${activeCall.fatherName || ""}, ${activeCall.schoolName} se reminder hai: ${activeCall.studentSummary} ki ${dueText}${promiseText}. Dhanyavaad.`
    );
    window.location.href = `https://wa.me/${intl}?text=${msg}`;
  };

  const headerWho = isEnquiry
    ? activeCall.name
    : activeCall.studentSummary
      ? `${activeCall.studentSummary} ke ${activeCall.relationLabel}`
      : activeCall.name;

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Incoming Caller Details"
      >
        <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#0b1326] shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
          {/* Executive Post-Call / Live Call Status Bar */}
          {activeCall.postCall ? (
            <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white text-xs font-bold flex items-center justify-between gap-2">
              <span className="truncate">
                {activeCall.direction === "OUTGOING" ? "Outgoing " : ""}Call Samapt
                {activeCall.durationSec && activeCall.durationSec > 0
                  ? ` (${Math.floor(activeCall.durationSec / 60) > 0 ? `${Math.floor(activeCall.durationSec / 60)}m ` : ""}${activeCall.durationSec % 60}s)`
                  : ""}
                {" · "}Call Update / Fee Badlaw Karein
              </span>
              {!editingSchedule && !isEnquiry && (
                <button
                  type="button"
                  onClick={() => setEditingSchedule(true)}
                  className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  Edit
                </button>
              )}
            </div>
          ) : (
            <div
              className={`h-1.5 w-full ${
                isEnquiry
                  ? "bg-gradient-to-r from-sky-500 to-indigo-500"
                  : activeCall.absentToday
                    ? "bg-gradient-to-r from-rose-500 to-amber-500"
                    : "bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500"
              }`}
            />
          )}

          {/* Premium Caller Header */}
          <div className="px-4 sm:px-5 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-slate-50 to-white dark:from-[#0f1933] dark:to-[#0b1326] flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ring-1 ${
                  isEnquiry
                    ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/30"
                    : activeCall.absentToday
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30"
                      : activeCall.direction === "OUTGOING"
                        ? "bg-teal-500/15 text-teal-600 dark:text-teal-400 ring-teal-500/30"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30"
                }`}
              >
                {isEnquiry ? (
                  <UserPlus className="w-5 h-5" />
                ) : activeCall.direction === "OUTGOING" ? (
                  <PhoneOutgoing className="w-5 h-5" />
                ) : (
                  <PhoneIncoming className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                    isEnquiry
                      ? "text-sky-600 dark:text-sky-400"
                      : activeCall.direction === "OUTGOING"
                        ? "text-teal-600 dark:text-teal-400"
                        : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {activeCall.direction === "OUTGOING"
                    ? isEnquiry
                      ? "Outgoing Enquiry"
                      : "Outgoing Parent Call"
                    : isEnquiry
                      ? "Admission Enquiry"
                      : "Parent Caller ID"}{" "}
                  · {activeCall.schoolName}
                  {activeCall.isTestSample ? " · Preview" : ""}
                </p>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug mt-0.5 break-words">
                  {headerWho}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-mono tabular-nums">
                  {isEnquiry
                    ? `${activeCall.studentSummary} · ${activeCall.phone}`
                    : `${activeCall.fatherName ? `${activeCall.fatherName} · ` : ""}${activeCall.phone}${
                        activeCall.children.length > 1
                          ? ` · ${activeCall.children.length} Bacche`
                          : ""
                      }`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  announceIncomingParentCall({
                    info: activeCall,
                    dedupeKey: `replay_parent_${Date.now()}`,
                    force: true,
                  })
                }
                className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition"
                title="Voice me dubara sunein"
                aria-label="Replay Caller Voice"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveCall(null)}
                className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center cursor-pointer transition"
                aria-label="Close Caller Card"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
            {/* Absent Today Alert Strip */}
            {!isEnquiry && activeCall.absentToday && (
              <div className="rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 flex items-center gap-2.5 text-rose-800 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <p className="text-xs font-bold">
                  Aaj Absent Alert: {activeCall.studentSummary} aaj school me ABSENT hain.
                </p>
              </div>
            )}

            {activeCall.isUnknownCaller ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-4 space-y-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Unregistered / Unknown Number
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                    Yeh number kisi registered student ya parent se match nahi hua ({activeCall.phone})
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Naye admission ki jankari ke liye call ho sakti hai. Neeche se seedha Admission Enquiry me save karein ya dismiss karein.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={unknownEnquiryName}
                    onChange={(e) => setUnknownEnquiryName(e.target.value)}
                    placeholder="Caller / Parent Name *"
                    className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={unknownEnquiryClass}
                    onChange={(e) => setUnknownEnquiryClass(e.target.value)}
                    placeholder="Class (e.g. Class 5 / Nursery)"
                    className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingUnknownEnquiry}
                    onClick={() => void handleSaveUnknownAsEnquiry()}
                    className="min-h-[42px] px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{savingUnknownEnquiry ? "Saving..." : "Save as Admission Enquiry"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCall(null)}
                    className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Wrong No. / Dismiss
                  </button>
                </div>
              </div>
            ) : isEnquiry ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800">
                <div className="grid grid-cols-2 divide-x divide-slate-200/80 dark:divide-slate-800">
                  <div className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Target Class
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {activeCall.studentSummary || "New Admission"}
                    </p>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Enquiry Stage
                    </p>
                    <p className="text-sm font-bold text-sky-600 dark:text-sky-400 mt-1">
                      {formatEnquiryStageLabel(activeCall.enquiryStage)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-200/80 dark:divide-slate-800">
                  <div className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Visit / Follow-up
                    </p>
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                      {activeCall.enquiryVisitDate
                        ? `Visit: ${formatDateDisplay(activeCall.enquiryVisitDate)}`
                        : formatDateDisplay(activeCall.enquiryFollowUpDate)}
                    </p>
                  </div>
                  <div className="p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Counsellor
                    </p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {activeCall.counsellorName || "Admissions Desk"}
                    </p>
                  </div>
                </div>
                <div className="p-3.5">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Enquiry Note
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    {activeCall.enquiryNote || activeCall.lastNote || "Koi note darj nahi hai."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Unified Premium Financial & Follow-up Snapshot (Single Elevation, Clean Hairline Grid) */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111c38]/75 overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800">
                  {/* Top Row: Hero Fee Due + Paid Amount + Solved Today Status */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <IndianRupee className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Kul Baki vs Jama Fee</span>
                      </span>
                      <div className="flex flex-wrap items-baseline gap-3 mt-0.5">
                        <p
                          className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${
                            activeCall.dueAmount > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {activeCall.dueAmount > 0
                            ? `₹${activeCall.dueAmount.toLocaleString("en-IN")}`
                            : "₹0 · Clear"}
                        </p>
                        {typeof activeCall.paidAmount === "number" && (
                          <span className="text-xs font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                            Jama: ₹{activeCall.paidAmount.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {activeCall.dueAmount > 0
                          ? `${activeCall.unpaidMonthsCount || 1} unpaid fee entry`
                          : "Sabhi mahino ki fee jama hai"}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleToggleSolvedToday}
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition shrink-0 flex items-center gap-1.5 ${
                          activeCall.solvedToday
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{activeCall.solvedToday ? "Aaj Solve ✅" : "Mark Solve"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhoneInput(activeCall.phone || "");
                          setEditingPhone((v) => !v);
                        }}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        {editingPhone ? "Cancel Phone Edit" : "Wrong No. / Phone Fix"}
                      </button>
                    </div>
                  </div>

                  {editingPhone && (
                    <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 flex flex-wrap items-center gap-2">
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="Naya 10-digit parent mobile..."
                        className="flex-1 min-w-[160px] h-10 px-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleSaveFixedPhone()}
                        className="min-h-[40px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Save New Phone
                      </button>
                    </div>
                  )}

                  {solveConfirmOpen && (
                    <div className="p-3.5 bg-emerald-50/90 dark:bg-emerald-950/35 space-y-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {activeCall.solvedToday
                          ? "Case dubara Pending mark karne ka kaaran likhein:"
                          : "Mark Solve (Aaj Sab Solve Ho Gaya) confirm karne ke liye kaaran likhein:"}
                      </p>
                      <input
                        type="text"
                        value={solveReasonInput}
                        onChange={(e) => setSolveReasonInput(e.target.value)}
                        placeholder="e.g. Parent ne school office me check de diya..."
                        className="w-full h-10 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleConfirmToggleSolvedToday()}
                          className="min-h-[38px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                        >
                          Confirm &amp; Audit Log
                        </button>
                        <button
                          type="button"
                          onClick={() => setSolveConfirmOpen(false)}
                          className="min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Middle Row: 2-Column Promise Date & Next Call Schedule */}
                  <div className="grid grid-cols-2 divide-x divide-slate-200/80 dark:divide-slate-800">
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>Promise Date</span>
                        <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      </div>
                      <p
                        className={`text-sm font-bold font-mono tabular-nums mt-1 ${
                          isPromiseOverdue
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {formatDateDisplay(activeCall.promiseDate)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {activeCall.promisedAmount
                          ? `Promised ₹${activeCall.promisedAmount.toLocaleString("en-IN")}`
                          : isPromiseOverdue
                            ? "Overdue"
                            : "Amount set nahi"}
                      </p>
                    </div>

                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span>Next Call</span>
                        <CalendarClock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      </div>
                      <p
                        className={`text-sm font-bold font-mono tabular-nums mt-1 ${
                          isNextCallDueTodayOrPast
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {formatDateDisplay(activeCall.nextCallDate)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {activeCall.lastCallAt
                          ? `Last: ${formatLastCallAgo(activeCall.lastCallAt)}`
                          : "First call"}
                      </p>
                    </div>
                  </div>

                  {/* Sibling Breakdown (if multi-child family — shows Paid ₹ + Due ₹ separately per child) */}
                  {activeCall.children.length > 1 && (
                    <div className="p-3.5 space-y-1.5 bg-white/40 dark:bg-slate-950/30">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Family ke Bacche ({activeCall.children.length}) — Alag-Alag Hisab
                      </p>
                      <div className="divide-y divide-slate-200/60 dark:divide-slate-800/80">
                        {activeCall.children.map((ch) => (
                          <div
                            key={ch.id}
                            className="py-1.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
                              {ch.name}
                              {ch.classLabel ? ` · ${ch.classLabel}` : ""}
                            </span>
                            <div className="flex items-center gap-2.5 font-mono tabular-nums shrink-0">
                              {typeof ch.paidAmount === "number" && ch.paidAmount > 0 && (
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  Paid ₹{ch.paidAmount.toLocaleString("en-IN")}
                                </span>
                              )}
                              <span
                                className={`font-bold ${
                                  ch.dueAmount > 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {ch.dueAmount > 0 ? `Due ₹${ch.dueAmount.toLocaleString("en-IN")}` : "Clear"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Row: Last Note + Trigger to Open/Close Post-Call Badlaw */}
                  {!editingSchedule && (
                    <div className="p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Last Remark
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-2">
                          {activeCall.lastNote || "Call katne ke baad yahan update karein."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSchedule(true)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1.5 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Badlaw Karein</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Post-Call Update & Fee Badlaw Workspace (Auto-Opens on Call End) */}
                {editingSchedule && (
                  <div className="rounded-2xl border border-indigo-500/40 bg-indigo-50/70 dark:bg-[#131e3d] p-4 space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                          {activeCall.postCall
                            ? "Call Katne Ke Baad Update Karein"
                            : "Call Status & Promise Update"}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Promise Date, Next Call aur Fee Update ek saath save karein
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSchedule(false)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                      >
                        Band Karein
                      </button>
                    </div>

                    {/* Call Outcome Quick Chips (All 9 Outcomes) */}
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Call Outcome (Baat Kya Hui?)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {(
                          [
                            { id: "PROMISED_DATE", label: "Promise Diya" },
                            { id: "NOT_PICKED", label: "Phone Nahi Uthaya" },
                            { id: "BUSY", label: "Busy / Baad Mein" },
                            { id: "PAID_CLAIMED", label: "Fee Jama Kar Di" },
                            { id: "PARTIAL_PAID", label: "Partial Fee Jama Ki" },
                            { id: "PAYMENT_REFUSED", label: "Mana Kiya (Refused)" },
                            { id: "WRONG_NUMBER", label: "Wrong Number" },
                            { id: "SWITCHED_OFF", label: "Number Switched Off" },
                            { id: "CALLED_TO_SCHOOL", label: "School Milne Bulaya" },
                          ] as Array<{ id: FeeCallOutcome; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectOutcomePreset(opt.id)}
                            className={`min-h-[38px] px-2 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                              outcomeInput === opt.id
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {outcomeInput === "PARTIAL_PAID" && (
                      <div className="p-3 rounded-xl border border-emerald-400/50 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-emerald-800 dark:text-emerald-300">
                            Partial Fee Jama Rashi (₹) *
                          </span>
                          <span className="font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200">
                            Naya Balance: ₹
                            {Math.max(0, activeCall.dueAmount - (Number(partialPaidInput) || 0)).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={partialPaidInput}
                          onChange={(e) => setPartialPaidInput(e.target.value)}
                          placeholder="Kitni rashi jama hui (e.g. 1200)"
                          className="w-full h-10 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    {/* 1-Tap Quick Promise Date Shortcuts */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                        Quick Date:
                      </span>
                      {[
                        { label: "Aaj", days: 0 },
                        { label: "Kal", days: 1 },
                        { label: "+3 Din", days: 3 },
                        { label: "+7 Din", days: 7 },
                      ].map((preset) => {
                        const ymd = addDaysFromTodayYmd(preset.days);
                        const active = promiseDateInput === ymd;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setPromiseDateInput(ymd);
                              setNextCallDateInput(ymd);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition ${
                              active
                                ? "bg-amber-500 text-slate-950 border-amber-400"
                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Promise Date
                        </span>
                        <input
                          type="date"
                          value={promiseDateInput}
                          onChange={(e) => setPromiseDateInput(e.target.value)}
                          className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Promised ₹
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={promisedAmountInput}
                          onChange={(e) => setPromisedAmountInput(e.target.value)}
                          placeholder="e.g. 2400"
                          className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                        />
                      </label>

                      <label className="block space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Next Call Date {FOLLOWUP_REQUIRED_OUTCOMES.has(outcomeInput) ? "*" : ""}
                        </span>
                        <input
                          type="date"
                          value={nextCallDateInput}
                          onChange={(e) => setNextCallDateInput(e.target.value)}
                          className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                        />
                      </label>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Call Note / Remark *
                      </span>
                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Parent se kya baat hui (mandatory)..."
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </label>

                    <div className="pt-0.5">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveScheduleForm}
                        className="w-full min-h-[44px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5 shrink-0" />
                        <span>{saving ? "Saving..." : "Save Call Update"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Premium Bottom Action Dock: Primary Main Fee Pay CTA + Symmetric Secondary Row */}
          {!activeCall.isUnknownCaller && (
            <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#080f21] space-y-2.5">
              {!isEnquiry && (
                <button
                  type="button"
                  onClick={handleTriggerMainFeePay}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99] transition"
                >
                  <IndianRupee className="w-4 h-4 shrink-0" />
                  <span>
                    Fee Pay{activeCall.dueAmount > 0 ? ` (₹${activeCall.dueAmount.toLocaleString("en-IN")})` : " · Collect"}
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 opacity-90" />
                </button>
              )}

              <div
                className={`grid gap-2 ${
                  !isEnquiry && activeCall.dueAmount > 0
                    ? "grid-cols-3"
                    : "grid-cols-2"
                }`}
              >
                {!isEnquiry && activeCall.dueAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowQrModal(true)}
                    className="min-h-[44px] px-2.5 rounded-xl border border-indigo-500/35 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>UPI QR</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="min-h-[44px] px-2.5 rounded-xl border border-emerald-500/35 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={handleDialBack}
                  className="min-h-[44px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>Call Back</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <UpiQrShareModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        upiId={schoolUpiId}
        schoolName={activeCall.schoolName}
        amount={activeCall.dueAmount}
        studentSummary={activeCall.studentSummary || activeCall.name}
        fatherName={activeCall.fatherName}
        phone={activeCall.phone}
      />
    </>
  );
};
