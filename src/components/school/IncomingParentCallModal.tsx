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
import { saveFeeCallFollowUpBatch } from "../../school-firebase";
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
  "NOT_PICKED",
  "BUSY",
  "SWITCHED_OFF",
  "CALLBACK_REQUESTED",
  "WRONG_NUMBER",
  "OTHER",
];

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
  const [nextCallDateInput, setNextCallDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

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
            const isPaid = typeof fee.paid === "boolean" ? fee.paid : fee.status === "paid";
            if (isPaid) continue;
            const billed = Number(fee.monthlyAmount ?? fee.amount ?? 0);
            const paidAmt = Number(fee.paidAmount ?? 0);
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
            return {
              id: stId,
              name: String(st.name || "").trim(),
              classLabel: clsLabel,
              dueAmount: d.amount,
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

      // 3. Fallback directly to native Android event payload / test sample
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
      setNextCallDateInput(resolved.nextCallDate || "");
      setNoteInput(resolved.lastNote || "");
      // Auto-open post-call edit workspace when the call has disconnected
      setEditingSchedule(Boolean(resolved.postCall));
      setShowQrModal(false);
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
    const nextSolved = !activeCall.solvedToday;
    persistFollowUpUpdates(
      {
        resolvedTodayDate: nextSolved ? todayYmd : "",
        resolvedNote: nextSolved
          ? noteInput.trim() || "Aaj sab solve ho gaya (Incoming Call)"
          : "",
      },
      nextSolved
        ? "Marked: Aaj Sab Solve Ho Gaya ✅"
        : "Reopened: Abhi Pending Rakha Gaya"
    );
  };

  const handleSelectOutcomePreset = (outcome: FeeCallOutcome) => {
    setOutcomeInput(outcome);
    if (outcome === "NOT_PICKED" || outcome === "BUSY" || outcome === "SWITCHED_OFF") {
      if (!nextCallDateInput) setNextCallDateInput(addDaysFromTodayYmd(1));
    } else if (outcome === "PROMISED_DATE") {
      if (!promiseDateInput) setPromiseDateInput(addDaysFromTodayYmd(2));
      if (!nextCallDateInput) setNextCallDateInput(addDaysFromTodayYmd(2));
    } else if (outcome === "PAID_CLAIMED") {
      setNextCallDateInput("");
    }
  };

  const handleSaveScheduleForm = async () => {
    const nowIso = new Date().toISOString();
    await persistFollowUpUpdates(
      {
        lastCallAt: nowIso,
        lastCallOutcome: outcomeInput,
        promiseDate: promiseDateInput.trim(),
        promisedAmount: promisedAmountInput ? Number(promisedAmountInput) : 0,
        nextCallDate: nextCallDateInput.trim(),
        lastNote: noteInput.trim(),
        ...(outcomeInput === "PAID_CLAIMED"
          ? { resolvedTodayDate: todayYmd, resolvedNote: noteInput.trim() || "Parent ne payment bataya" }
          : {}),
      },
      "Call Update, Promise Date aur Schedule save ho gaya ✅"
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

  const handleTriggerFeeUpdate = () => {
    if (activeCall.isTestSample) {
      toast.info("Sample Preview: Real call par yeh button student ka Fee Update & Ledger kholega.");
      return;
    }
    if (onUpdateFee && activeCall.primaryStudentId) {
      const sid = activeCall.primaryStudentId;
      setActiveCall(null);
      onUpdateFee(sid, primaryClassId);
      return;
    }
    if (onCollectFee && activeCall.primaryStudentId) {
      const sid = activeCall.primaryStudentId;
      setActiveCall(null);
      onCollectFee(sid, primaryClassId);
      return;
    }
    setEditingSchedule(true);
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

            {isEnquiry ? (
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
                  {/* Top Row: Hero Fee Due + Solved Today Status */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <IndianRupee className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Kul Baki Fee</span>
                      </span>
                      <p
                        className={`text-2xl sm:text-3xl font-black font-mono tabular-nums mt-0.5 ${
                          activeCall.dueAmount > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {activeCall.dueAmount > 0
                          ? `₹${activeCall.dueAmount.toLocaleString("en-IN")}`
                          : "₹0 · Clear"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {activeCall.dueAmount > 0
                          ? `${activeCall.unpaidMonthsCount || 1} unpaid fee entry`
                          : "Sabhi mahino ki fee jama hai"}
                      </p>
                    </div>

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
                  </div>

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

                  {/* Sibling Breakdown (if multi-child family) */}
                  {activeCall.children.length > 1 && (
                    <div className="p-3.5 space-y-1.5 bg-white/40 dark:bg-slate-950/30">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Family ke Bacche ({activeCall.children.length})
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
                            <span
                              className={`font-mono tabular-nums font-bold shrink-0 ${
                                ch.dueAmount > 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {ch.dueAmount > 0 ? `₹${ch.dueAmount.toLocaleString("en-IN")}` : "Clear"}
                            </span>
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

                    {/* Call Outcome Quick Chips */}
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Call Outcome (Baat Kya Hui?)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {(
                          [
                            { id: "PROMISED_DATE", label: "Promise Diya" },
                            { id: "NOT_PICKED", label: "Nahi Utha" },
                            { id: "BUSY", label: "Busy / Kal" },
                            { id: "PAID_CLAIMED", label: "Fee Jama ✅" },
                          ] as Array<{ id: FeeCallOutcome; label: string }>
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSelectOutcomePreset(opt.id)}
                            className={`min-h-[36px] px-2 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
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
                          Next Call Date
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
                        Call Note / Remark
                      </span>
                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Parent se kya baat hui..."
                        className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveScheduleForm}
                        className="min-h-[44px] px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5 shrink-0" />
                        <span>{saving ? "Saving..." : "Save Call Update"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTriggerFeeUpdate}
                        className="min-h-[44px] px-3 rounded-xl border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <Edit3 className="w-3.5 h-3.5 shrink-0" />
                        <span>Fee Update Ledger</span>
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Premium Bottom Action Dock: Primary Main Fee Pay CTA + Symmetric Secondary Row */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#080f21] space-y-2.5">
            {!isEnquiry && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleTriggerMainFeePay}
                  className="sm:col-span-2 min-h-[48px] px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99] transition"
                >
                  <IndianRupee className="w-4 h-4 shrink-0" />
                  <span>
                    Fee Pay{activeCall.dueAmount > 0 ? ` (₹${activeCall.dueAmount.toLocaleString("en-IN")})` : " · Collect"}
                  </span>
                  <ArrowUpRight className="w-4 h-4 shrink-0 opacity-90" />
                </button>

                <button
                  type="button"
                  onClick={handleTriggerFeeUpdate}
                  className="min-h-[48px] px-3 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Edit3 className="w-4 h-4 shrink-0" />
                  <span>Fee Update</span>
                </button>
              </div>
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
