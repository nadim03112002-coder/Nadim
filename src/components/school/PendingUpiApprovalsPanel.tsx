import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  ReceiptText,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { MonthlyFee, UpiPaymentProofRecord } from "../../school-types";
import {
  approveUpiPaymentProof,
  rejectUpiPaymentProof,
} from "../../school-firebase";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { pickLang, useAppLang } from "../../utils/appLang";

interface PendingUpiApprovalsPanelProps {
  schoolId: string;
  proofs: UpiPaymentProofRecord[];
  approverName: string;
  approverRole: "accountant" | "manager";
  onApprovedReceipt?: (fee: MonthlyFee, proof: UpiPaymentProofRecord) => void;
  onClose?: () => void;
}

export const PendingUpiApprovalsPanel: React.FC<PendingUpiApprovalsPanelProps> = ({
  schoolId,
  proofs,
  approverName,
  approverRole,
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

  const handleApprove = async (proof: UpiPaymentProofRecord) => {
    if (!schoolId || busyId) return;
    setBusyId(proof.id);
    try {
      const res = await approveUpiPaymentProof({
        schoolId,
        proof,
        approverName,
        approverRole,
      });
      sendSchoolPushNotification({
        schoolId,
        classId: proof.classId,
        className: proof.className,
        studentIds: [proof.studentId],
        senderName: approverName,
        type: "FEE_RECEIPT",
        title: t(
          `UPI भुगतान स्वीकृत · रसीद ${res.receiptNo}`,
          `UPI Fee Approved · Receipt ${res.receiptNo}`
        ),
        body: t(
          `${proof.studentName} (${proof.monthLabel || proof.month}) का ₹${Number(proof.amount || 0).toLocaleString("en-IN")} भुगतान सत्यापित हो गया है।`,
          `Payment of Rs. ${Number(proof.amount || 0).toLocaleString("en-IN")} for ${proof.studentName} (${proof.monthLabel || proof.month}) is verified.`
        ),
        url: "/?schoolPortal=1",
        urgent: true,
      }).catch(() => {});
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
        rejectReason.trim() || t("UTR या राशि मिलान नहीं हुई", "UTR or amount mismatch");
      await rejectUpiPaymentProof({
        schoolId,
        proofId: proof.id,
        reason: reasonStr,
        reviewerName: approverName,
      });
      sendSchoolPushNotification({
        schoolId,
        classId: proof.classId,
        className: proof.className,
        studentIds: [proof.studentId],
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
            <span>{t("UPI स्क्रीनशॉट सत्यापन डेस्क", "UPI Screenshot Verification Desk")}</span>
            {counts.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black tabular-nums">
                {counts.pending}
              </span>
            )}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {t(
              "1-क्लिक में अभिभावक का UPI स्क्रीनशॉट व UTR जाँचकर पक्की रसीद जारी करें",
              "Verify parent UPI screenshots and UTR numbers with 1-click receipt generation"
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
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
                          alt={`UTR ${proof.utrNumber}`}
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
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                          ₹{Number(proof.amount || 0).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold">
                          UTR: {proof.utrNumber}
                        </span>
                        <span className="text-slate-400">{submittedLabel}</span>
                      </div>

                      {proof.note && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          {proof.note}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status / Action Row */}
                  {proof.status === "PENDING" ? (
                    isRejecting ? (
                      <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t("अस्वीकार करने का कारण लिखें...", "Reason for rejection...")}
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
                            onClick={() => handleConfirmReject(proof)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            {t("अस्वीकार पुष्टि", "Confirm Reject")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApprove(proof)}
                          className="flex-1 min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
                        >
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>
                            {t("1-क्लिक Approve व रसीद बनाएँ", "1-Click Approve & Receipt")}
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
                  UTR: {previewProof.utrNumber}
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
                alt={`UTR ${previewProof.utrNumber}`}
                className="w-full max-h-[70vh] object-contain rounded-xl bg-black"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
