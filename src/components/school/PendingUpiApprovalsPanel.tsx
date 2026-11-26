import React, { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Loader2,
  ReceiptText,
  ScanText,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  MonthlyFee,
  School,
  SchoolAccountant,
  SchoolTeacher,
  UpiPaymentProofRecord,
} from "../../school-types";
import {
  approveUpiPaymentProof,
  getAuthorizedUpiPushTargetIds,
  rejectUpiPaymentProof,
  resolveAuthorizedUpiReceivers,
} from "../../school-firebase";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { pickLang, useAppLang } from "../../utils/appLang";
import { scanUpiScreenshot, type UpiScreenshotOcrResult } from "../../utils/upiScreenshotOcr";
import { UpiAlertReceiverSelector } from "./UpiAlertReceiverSelector";

interface PendingUpiApprovalsPanelProps {
  schoolId: string;
  proofs: UpiPaymentProofRecord[];
  approverName: string;
  approverRole: "accountant" | "manager" | "admin" | "teacher";
  approverId?: string;
  isAdmin?: boolean;
  school?: School | null;
  teachers?: SchoolTeacher[];
  accountants?: SchoolAccountant[];
  onSchoolUpdated?: (updated: School) => void;
  onApprovedReceipt?: (fee: MonthlyFee, proof: UpiPaymentProofRecord) => void;
  onClose?: () => void;
}

export const PendingUpiApprovalsPanel: React.FC<PendingUpiApprovalsPanelProps> = ({
  schoolId,
  proofs,
  approverName,
  approverRole,
  approverId,
  isAdmin = false,
  school,
  teachers,
  accountants,
  onSchoolUpdated,
  onApprovedReceipt,
  onClose,
}) => {
  const [lang] = useAppLang();
  const t = (hi: string, en: string) => pickLang(lang, hi, en);

  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewProof, setPreviewProof] = useState<UpiPaymentProofRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editedAmounts, setEditedAmounts] = useState<Record<string, string>>({});
  const [showReceiverConfig, setShowReceiverConfig] = useState(false);
  const [ocrByProofId, setOcrByProofId] = useState<
    Record<string, { loading?: boolean; data?: UpiScreenshotOcrResult }>
  >({});

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const p of proofs) {
      if (p.status === "PENDING") pending++;
      else if (p.status === "APPROVED") approved++;
      else if (p.status === "REJECTED") rejected++;
    }
    return { pending, approved, rejected, all: proofs.length };
  }, [proofs]);

  const filteredProofs = useMemo(() => {
    if (filter === "ALL") return proofs;
    return proofs.filter((p) => p.status === filter);
  }, [proofs, filter]);

  const activeReceivers = useMemo(() => resolveAuthorizedUpiReceivers(school), [school]);

  const handleCopyUtrText = async (proofId: string, utrText: string) => {
    const clean = String(utrText || "").trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
      setCopiedId(proofId);
      toast.success(
        t(`UTR कॉपी हो गया (${clean})`, `UTR copied (${clean})`)
      );
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error(t("UTR कॉपी नहीं हो सका", "Could not copy UTR"));
    }
  };

  const handleCopyUtr = (proof: UpiPaymentProofRecord) =>
    handleCopyUtrText(proof.id, proof.utrNumber);

  const handleRunOcr = async (proof: UpiPaymentProofRecord) => {
    if (!proof.screenshotUrl) return;
    setOcrByProofId((prev) => ({
      ...prev,
      [proof.id]: { ...prev[proof.id], loading: true },
    }));
    try {
      const res = await scanUpiScreenshot(proof.screenshotUrl);
      setOcrByProofId((prev) => ({
        ...prev,
        [proof.id]: { loading: false, data: res },
      }));
    } catch {
      setOcrByProofId((prev) => ({
        ...prev,
        [proof.id]: { ...prev[proof.id], loading: false },
      }));
    }
  };

  useEffect(() => {
    if (!previewProof?.id || !previewProof.screenshotUrl) return;
    const existing = ocrByProofId[previewProof.id];
    if (!existing || (!existing.loading && !existing.data)) {
      void handleRunOcr(previewProof);
    }
  }, [previewProof?.id]);

  const handleApprove = async (proof: UpiPaymentProofRecord) => {
    if (!schoolId || busyId) return;
    const rawEdit = editedAmounts[proof.id];
    const finalAmt =
      rawEdit !== undefined && rawEdit !== ""
        ? Math.max(0, Math.round(Number(rawEdit) || 0))
        : Math.max(0, Math.round(Number(proof.amount) || 0));
    setBusyId(proof.id);
    try {
      const res = await approveUpiPaymentProof({
        schoolId,
        proof,
        approverName,
        approverRole,
        approverId,
        confirmedAmount: finalAmt,
      });

      const targetStudentIds =
        proof.isFamilyCombined && Array.isArray(proof.familyAllocations)
          ? Array.from(new Set(proof.familyAllocations.map((m) => m.studentId).filter(Boolean)))
          : [proof.studentId];

      sendSchoolPushNotification({
        schoolId,
        classId: proof.classId,
        className: proof.className,
        studentIds: targetStudentIds,
        senderName: approverName,
        type: "FEE_RECEIPT",
        title: t(
          `UPI भुगतान स्वीकृत · रसीद ${res.receiptNo}`,
          `UPI Fee Approved · Receipt ${res.receiptNo}`
        ),
        body: t(
          `${proof.studentName} (${proof.monthLabel || proof.month}) का ₹${finalAmt.toLocaleString("en-IN")} भुगतान सत्यापित हो गया है।`,
          `Payment of Rs. ${finalAmt.toLocaleString("en-IN")} for ${proof.studentName} (${proof.monthLabel || proof.month}) is verified.`
        ),
        url: "/?schoolPortal=1",
        urgent: true,
      }).catch(() => {});

      const receiverTargets = getAuthorizedUpiPushTargetIds(school);
      if (receiverTargets.length > 0) {
        sendSchoolPushNotification({
          schoolId,
          targetUserIds: receiverTargets,
          senderName: approverName,
          type: "UPI_PROOF_RESOLVED",
          title: "UPI Proof Resolved",
          body: `${proof.studentName} (${res.receiptNo})`,
          voiceSpeak: false,
          extraData: { proofId: proof.id },
        }).catch(() => {});
      }
      toast.success(
        t(
          `स्वीकृत! ${proof.studentName} की रसीद (${res.receiptNo}) जारी हो गई।`,
          `Approved! Receipt ${res.receiptNo} generated for ${proof.studentName}.`
        )
      );
      onApprovedReceipt?.(res.fee, res.proof);
    } catch {
      toast.error(t("स्वीकृत करने में समस्या आई।", "Failed to approve payment proof."));
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmReject = async (proof: UpiPaymentProofRecord) => {
    if (!schoolId || busyId) return;
    setBusyId(proof.id);
    try {
      const reasonStr =
        rejectReason.trim() ||
        t("BharatPe में पेमेंट या राशि मिलान नहीं हुई", "Payment or amount mismatch in BharatPe");
      await rejectUpiPaymentProof({
        schoolId,
        proofId: proof.id,
        reason: reasonStr,
        reviewerName: approverName,
        reviewerRole: approverRole,
        reviewerId: approverId,
      });

      const targetStudentIds =
        proof.isFamilyCombined && Array.isArray(proof.familyAllocations)
          ? Array.from(new Set(proof.familyAllocations.map((m) => m.studentId).filter(Boolean)))
          : [proof.studentId];

      sendSchoolPushNotification({
        schoolId,
        classId: proof.classId,
        className: proof.className,
        studentIds: targetStudentIds,
        senderName: approverName,
        type: "MONTHLY_FEE",
        title: t("UPI स्क्रीनशॉट अस्वीकृत", "UPI Payment Proof Rejected"),
        body: t(
          `${proof.studentName} (${proof.monthLabel || proof.month}) का UPI प्रमाण अस्वीकार हुआ: ${reasonStr}. कृपया सही स्क्रीनशॉट पुनः भेजें।`,
          `UPI proof for ${proof.studentName} (${proof.monthLabel || proof.month}) was rejected: ${reasonStr}. Please re-submit.`
        ),
        url: "/?schoolPortal=1",
        urgent: true,
      }).catch(() => {});

      const receiverTargets = getAuthorizedUpiPushTargetIds(school);
      if (receiverTargets.length > 0) {
        sendSchoolPushNotification({
          schoolId,
          targetUserIds: receiverTargets,
          senderName: approverName,
          type: "UPI_PROOF_RESOLVED",
          title: "UPI Proof Resolved",
          body: `${proof.studentName} rejected`,
          voiceSpeak: false,
          extraData: { proofId: proof.id },
        }).catch(() => {});
      }
      toast.info(t("भुगतान प्रमाण अस्वीकार कर दिया गया।", "Payment proof rejected."));
      setRejectingId(null);
      setRejectReason("");
    } catch {
      toast.error(t("अस्वीकार करने में त्रुटि आई।", "Failed to reject payment proof."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t("BharatPe / UPI स्क्रीनशॉट सत्यापन डेस्क", "BharatPe / UPI Screenshot Verification Desk")}</span>
            {counts.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black tabular-nums">
                {counts.pending}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {t(
              "स्क्रीनशॉट, समय व राशि को BharatPe हिस्ट्री से मिलाएं व 1-क्लिक में Confirm करके पक्की रसीद बनाएं",
              "Match screenshot, time & amount with BharatPe history, and confirm with 1-click receipt"
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {isAdmin && schoolId && (
            <button
              type="button"
              onClick={() => setShowReceiverConfig((p) => !p)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1 border ${
                showReceiverConfig
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100"
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>
                {t(`अलर्ट मोबाइल (${activeReceivers.length})`, `Alert Receivers (${activeReceivers.length})`)}
              </span>
            </button>
          )}
          {(
            [
              { id: "PENDING", label: t(`लंबित (${counts.pending})`, `Pending (${counts.pending})`) },
              { id: "APPROVED", label: t(`स्वीकृत (${counts.approved})`, `Approved (${counts.approved})`) },
              { id: "REJECTED", label: t(`अस्वीकृत (${counts.rejected})`, `Rejected (${counts.rejected})`) },
              { id: "ALL", label: t(`सभी (${counts.all})`, `All (${counts.all})`) },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                filter === tab.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Admin Receiver Delegation Drawer */}
      {isAdmin && showReceiverConfig && schoolId && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <UpiAlertReceiverSelector
            school={school}
            schoolId={schoolId}
            teachers={teachers}
            accountants={accountants}
            onSchoolUpdated={onSchoolUpdated}
            compact
          />
        </div>
      )}

      {/* List */}
      <div className="p-4">
        {filteredProofs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            {filter === "PENDING"
              ? t("अभी कोई लंबित UPI भुगतान सत्यापन नहीं है।", "No pending UPI payment verifications.")
              : t("इस श्रेणी में कोई रिकॉर्ड नहीं मिला।", "No records found in this filter.")}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProofs.map((proof) => {
              const isBusy = busyId === proof.id;
              const isRejecting = rejectingId === proof.id;
              const submittedLabel = proof.submittedAt
                ? new Date(proof.submittedAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "";
              const confirmVal =
                editedAmounts[proof.id] !== undefined
                  ? editedAmounts[proof.id]
                  : String(Math.round(Number(proof.confirmedAmount ?? proof.amount) || 0));
              const billedTotal = Number(proof.billedAmount ?? proof.amount ?? 0);

              return (
                <div
                  key={proof.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    {/* Clickable Screenshot Thumb */}
                    <button
                      type="button"
                      onClick={() => setPreviewProof(proof)}
                      className="relative w-16 h-20 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900 shrink-0 group cursor-pointer"
                      title={t("स्क्रीनशॉट बड़ा देखें", "View full screenshot")}
                    >
                      {proof.screenshotUrl ? (
                        <img
                          src={proof.screenshotUrl}
                          alt={proof.utrNumber ? `UTR ${proof.utrNumber}` : `Payment Screenshot ${proof.studentName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                          No Img
                        </div>
                      )}
                      <span className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </span>
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {proof.studentName}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {proof.className || "Class"} {proof.rollNo ? `· Roll #${proof.rollNo}` : ""} ·{" "}
                            {proof.monthLabel || proof.month}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums block">
                            ₹{Number(proof.confirmedAmount ?? proof.amount ?? 0).toLocaleString("en-IN")}
                          </span>
                          {billedTotal > 0 && billedTotal !== Number(proof.amount || 0) && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                              {t("बिल:", "Bill:")} ₹{billedTotal.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {proof.utrNumber ? (
                          <>
                            <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold">
                              UTR: {proof.utrNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleCopyUtr(proof)}
                              className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                              title={t("UTR नंबर कॉपी करें", "Copy UTR")}
                            >
                              {copiedId === proof.id ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>{t("कॉपी", "Copied")}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>{t("Copy", "Copy")}</span>
                                </>
                              )}
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            {t("स्क्रीनशॉट प्रमाण", "Screenshot Proof")}
                          </span>
                        )}
                        {proof.paidTime && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px]">
                            🕒 {proof.paidTime}
                          </span>
                        )}
                        <span className="text-slate-400 text-[10px]">{submittedLabel}</span>
                      </div>

                      {proof.note && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          {proof.note}
                        </p>
                      )}

                      {proof.status === "PENDING" && Boolean(proof.screenshotUrl) && (() => {
                        const ocrState = ocrByProofId[proof.id];
                        const ocrData = ocrState?.data;
                        return (
                          <div className="pt-1 flex flex-wrap items-center gap-1.5">
                            {!ocrData && !ocrState?.loading && (
                              <button
                                type="button"
                                onClick={() => void handleRunOcr(proof)}
                                className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer hover:bg-indigo-100"
                              >
                                <ScanText className="w-3 h-3" />
                                <span>{t("OCR से राशि/UTR पढ़ें", "Auto-Read OCR")}</span>
                              </button>
                            )}
                            {ocrState?.loading && (
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 inline-flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{t("पढ़ा जा रहा है...", "Scanning...")}</span>
                              </span>
                            )}
                            {ocrData && (
                              <>
                                {ocrData.amount !== null && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-700 text-[10px] font-bold text-indigo-900 dark:text-indigo-200">
                                    <span>OCR ₹{ocrData.amount.toLocaleString("en-IN")}</span>
                                    {ocrData.amount !== Number(confirmVal) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditedAmounts((prev) => ({
                                            ...prev,
                                            [proof.id]: String(ocrData.amount),
                                          }))
                                        }
                                        className="ml-1 px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black cursor-pointer"
                                      >
                                        {t("भरें", "Apply")}
                                      </button>
                                    )}
                                  </span>
                                )}
                                {ocrData.utr && (
                                  <button
                                    type="button"
                                    onClick={() => void handleCopyUtrText(proof.id, ocrData.utr!)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-mono font-bold cursor-pointer hover:bg-indigo-100"
                                    title={t("OCR से मिला UTR कॉपी करें", "Copy OCR UTR")}
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    <span>UTR: {ocrData.utr}</span>
                                  </button>
                                )}
                                {ocrData.amount === null && !ocrData.utr && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {t("OCR स्पष्ट नहीं — फोटो बड़ा देखें", "OCR unclear — open photo")}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Family Allocation Breakdown */}
                  {proof.isFamilyCombined &&
                    Array.isArray(proof.familyAllocations) &&
                    proof.familyAllocations.length > 0 && (
                      <div className="rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/20 p-2 space-y-1">
                        <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>
                            {t("परिवार के बच्चे:", "Family Children:")} ({proof.familyAllocations.length})
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {proof.familyAllocations.map((m, i) => (
                            <span
                              key={`${m.studentId}_${i}`}
                              className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-700 text-[10px] font-semibold text-slate-800 dark:text-slate-200"
                            >
                              {m.studentName}:{" "}
                              {m.isFreeEducation ? (
                                <strong className="text-emerald-600 dark:text-emerald-400">FREE ₹0</strong>
                              ) : (
                                <strong className="font-mono">
                                  ₹{Number(m.allocatedAmount ?? m.billedAmount ?? 0).toLocaleString("en-IN")}
                                </strong>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Status / Action Row */}
                  {proof.status === "PENDING" ? (
                    isRejecting ? (
                      <div className="space-y-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            t("राशि कम है / मेल नहीं खाई", "Amount mismatch / short paid"),
                            t("स्क्रीनशॉट धुंधला / अधूरा है", "Screenshot unclear / cropped"),
                            t("BharatPe में पेमेंट नहीं मिला", "Payment not found in BharatPe"),
                            t("फ़र्ज़ी / पुराना स्क्रीनशॉट", "Fake or duplicate screenshot"),
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setRejectReason(chip)}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition ${
                                rejectReason.trim() === chip
                                  ? "bg-rose-600 text-white border-rose-600"
                                  : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 hover:bg-rose-100"
                              }`}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t("अस्वीकार का कारण लिखें या ऊपर से चुनें...", "Reason for rejection...")}
                          className="w-full h-9 px-3 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason("");
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            {t("रद्द", "Cancel")}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleConfirmReject(proof)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            {t("अस्वीकार पुष्टि", "Confirm Reject")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            {t("प्राप्त राशि (₹):", "Confirmed ₹:")}
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={confirmVal}
                            onChange={(e) =>
                              setEditedAmounts((prev) => ({ ...prev, [proof.id]: e.target.value }))
                            }
                            className="w-28 h-8 px-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
                          />
                          {billedTotal > 0 && Number(confirmVal) < billedTotal && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              {t("बकाया:", "Due:")} ₹{Math.max(0, billedTotal - Number(confirmVal)).toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleApprove(proof)}
                            className="flex-1 min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            <span>
                              {t("Confirm व रसीद बनाएँ", "Confirm & Receipt")}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingId(proof.id);
                              setRejectReason("");
                            }}
                            className="min-h-[40px] px-3 rounded-xl border border-rose-300 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{t("अस्वीकार", "Reject")}</span>
                          </button>
                        </div>
                      </div>
                    )
                  ) : proof.status === "APPROVED" ? (
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {t("स्वीकृत", "Approved")} · {proof.receiptNo || ""}
                        </span>
                      </span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        {proof.reviewedBy}
                      </span>
                    </div>
                  ) : (
                    <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      <span className="flex items-center gap-1.5 truncate">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {t("अस्वीकृत:", "Rejected:")} {proof.rejectionReason}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screenshot Lightbox */}
      {previewProof && (
        <div
          className="fixed inset-0 z-[160] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewProof(null)}
        >
          <div
            className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 text-white">
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">
                  {previewProof.studentName} · ₹{Number(previewProof.amount).toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                  {previewProof.utrNumber ? `UTR: ${previewProof.utrNumber}` : t("पेमेंट स्क्रीनशॉट", "Payment Screenshot")}{" "}
                  {previewProof.paidTime ? `· ${previewProof.paidTime}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProof(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewProof.screenshotUrl && (
              <img
                src={previewProof.screenshotUrl}
                alt={previewProof.utrNumber ? `UTR ${previewProof.utrNumber}` : `Payment Screenshot ${previewProof.studentName}`}
                className="w-full max-h-[65vh] object-contain rounded-xl bg-black"
              />
            )}
            {(() => {
              const boxOcr = ocrByProofId[previewProof.id];
              if (!boxOcr && !previewProof.screenshotUrl) return null;
              return (
                <div className="rounded-xl bg-slate-800/90 border border-slate-700 px-3 py-2 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2">
                  {boxOcr?.loading ? (
                    <span className="inline-flex items-center gap-1.5 text-indigo-300 font-semibold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t("OCR से राशि व UTR पढ़ा जा रहा है...", "Reading amount & UTR...")}</span>
                    </span>
                  ) : boxOcr?.data ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <ScanText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      {boxOcr.data.amount !== null && (
                        <span className="font-mono font-bold text-emerald-300">
                          {t("राशि:", "Amt:")} ₹{boxOcr.data.amount.toLocaleString("en-IN")}
                        </span>
                      )}
                      {boxOcr.data.utr && (
                        <button
                          type="button"
                          onClick={() => void handleCopyUtrText(previewProof.id, boxOcr.data!.utr!)}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>UTR: {boxOcr.data.utr}</span>
                        </button>
                      )}
                      {boxOcr.data.amount === null && !boxOcr.data.utr && (
                        <span className="text-[11px] text-slate-400">
                          {t("स्क्रीनशॉट से ऑटो-रीड स्पष्ट नहीं हो पाया", "Could not clearly auto-read screenshot")}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
