import React, { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Loader2,
  Maximize2,
  Minimize2,
  ReceiptText,
  ScanText,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { MonthlyFee, School, UpiPaymentProofRecord } from "../../school-types";
import {
  approveUpiPaymentProof,
  getAuthorizedUpiPushTargetIds,
  rejectUpiPaymentProof,
} from "../../school-firebase";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { pickLang, useAppLang } from "../../utils/appLang";
import { scanUpiScreenshot, type UpiScreenshotOcrResult } from "../../utils/upiScreenshotOcr";

interface UpiProofVerificationPopupProps {
  schoolId: string;
  school?: School | null;
  proofs: UpiPaymentProofRecord[];
  authorized: boolean;
  approverName: string;
  approverRole: "admin" | "accountant" | "teacher" | "manager";
  approverId?: string;
  onApprovedReceipt?: (fee: MonthlyFee, proof: UpiPaymentProofRecord) => void;
}

export const UpiProofVerificationPopup: React.FC<UpiProofVerificationPopupProps> = ({
  schoolId,
  school,
  proofs,
  authorized,
  approverName,
  approverRole,
  approverId,
  onApprovedReceipt,
}) => {
  const [lang] = useAppLang();
  const t = (hi: string, en: string) => pickLang(lang, hi, en);

  const pendingProofs = useMemo(
    () => proofs.filter((p) => p.status === "PENDING"),
    [proofs]
  );

  const [minimized, setMinimized] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmedAmountStr, setConfirmedAmountStr] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedUtrId, setCopiedUtrId] = useState<string | null>(null);
  const [showFullImg, setShowFullImg] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<UpiScreenshotOcrResult | null>(null);
  const [ocrScanSeq, setOcrScanSeq] = useState(0);

  const currentProof = pendingProofs[Math.min(activeIndex, Math.max(0, pendingProofs.length - 1))] || null;

  useEffect(() => {
    if (activeIndex >= pendingProofs.length && pendingProofs.length > 0) {
      setActiveIndex(0);
    }
  }, [pendingProofs.length, activeIndex]);

  useEffect(() => {
    if (currentProof) {
      setConfirmedAmountStr(String(Math.round(Number(currentProof.amount) || 0)));
      setRejectMode(false);
      setRejectReason("");
    }
  }, [currentProof?.id, currentProof?.amount]);

  useEffect(() => {
    const imgUrl = currentProof?.screenshotUrl;
    if (!authorized || minimized || !currentProof?.id || !imgUrl) {
      setOcrLoading(false);
      setOcrResult(null);
      return;
    }
    let cancelled = false;
    setOcrLoading(true);
    setOcrResult(null);
    scanUpiScreenshot(imgUrl)
      .then((res) => {
        if (!cancelled) {
          setOcrResult(res);
          setOcrLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOcrLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authorized, minimized, currentProof?.id, currentProof?.screenshotUrl, ocrScanSeq]);

  // Listen to native Android/deep-link event to jump straight to a specific proof
  useEffect(() => {
    if (!authorized) return;
    const handleOpenProof = (ev: Event) => {
      const targetId = String((ev as CustomEvent)?.detail?.proofId || "").trim();
      setMinimized(false);
      if (targetId && pendingProofs.length > 0) {
        const idx = pendingProofs.findIndex((p) => p.id === targetId);
        if (idx >= 0) setActiveIndex(idx);
      }
    };
    window.addEventListener("open-upi-proof", handleOpenProof);
    try {
      const sp = new URLSearchParams(window.location.search);
      const qProofId = sp.get("openUpiProof");
      if (qProofId && pendingProofs.length > 0) {
        setMinimized(false);
        const idx = pendingProofs.findIndex((p) => p.id === qProofId);
        if (idx >= 0) setActiveIndex(idx);
      }
    } catch {}
    return () => window.removeEventListener("open-upi-proof", handleOpenProof);
  }, [authorized, pendingProofs]);

  const [bridgeSyncReady, setBridgeSyncReady] = useState(false);

  useEffect(() => {
    if (proofs.length > 0) {
      setBridgeSyncReady(true);
      return;
    }
    const timer = window.setTimeout(() => setBridgeSyncReady(true), 2500);
    return () => window.clearTimeout(timer);
  }, [proofs.length]);

  // Sync pending proofs queue with native Android APK overlay bridge
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!school) return; // Wait until school record & receiver config finish loading
    const bridge = (window as any).LifeMakerAndroid;
    if (!bridge || typeof bridge.syncPendingUpiProofs !== "function") return;
    if (!authorized) {
      if (!bridgeSyncReady) return;
      try {
        bridge.syncPendingUpiProofs("[]");
      } catch {}
      return;
    }
    if (pendingProofs.length === 0 && !bridgeSyncReady) {
      return;
    }
    try {
      const payload = pendingProofs.slice(0, 25).map((p) => ({
        proofId: p.id,
        schoolId: p.schoolId,
        studentName: p.studentName,
        monthLabel: p.monthLabel || p.month,
        amount: String(Math.round(Number(p.amount) || 0)),
        billedAmount: String(Math.round(Number(p.billedAmount ?? p.amount) || 0)),
        utrNumber: p.utrNumber,
        paidTime:
          p.paidTime ||
          (p.submittedAt
            ? new Date(p.submittedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""),
        familySummary: p.isFamilyCombined
          ? `Family (${p.familyAllocations?.length || 0} Children)`
          : "",
        screenshotUrl:
          p.screenshotUrl && p.screenshotUrl.startsWith("http")
            ? p.screenshotUrl
            : "",
      }));
      bridge.syncPendingUpiProofs(JSON.stringify(payload));
    } catch {}
  }, [authorized, pendingProofs, school, bridgeSyncReady]);

  if (!authorized || pendingProofs.length === 0 || !currentProof) {
    return null;
  }

  const totalPendingAmount = pendingProofs.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  );
  const billedAmt = Number(currentProof.billedAmount ?? currentProof.amount ?? 0);
  const parsedConfirmedAmt = Math.max(0, Math.round(Number(confirmedAmountStr) || 0));
  const isPartialVerify = billedAmt > 0 && parsedConfirmedAmt < billedAmt;
  const displayPaidTime =
    currentProof.paidTime ||
    (currentProof.submittedAt
      ? new Date(currentProof.submittedAt).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "");
  const submittedDateStr = currentProof.submittedAt
    ? new Date(currentProof.submittedAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const handleCopyUtrValue = async (utrText: string) => {
    const clean = String(utrText || "").trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
      setCopiedUtrId(currentProof.id);
      toast.success(
        t(
          `UTR कॉपी हो गया (${clean}) — अब BharatPe हिस्ट्री में पेस्ट करें`,
          `UTR copied (${clean}) — paste in BharatPe history to match`
        )
      );
      setTimeout(() => setCopiedUtrId(null), 2200);
    } catch {
      toast.error(t("UTR कॉपी नहीं हो सका", "Failed to copy UTR"));
    }
  };

  const handleCopyUtr = () => handleCopyUtrValue(currentProof.utrNumber);

  const handleConfirm = async () => {
    if (busy || !schoolId) return;
    if (parsedConfirmedAmt <= 0 && !currentProof.familyAllocations?.every((m) => m.isFreeEducation)) {
      toast.error(t("कृपया सही प्राप्त राशि (₹) दर्ज करें।", "Please enter a valid confirmed amount."));
      return;
    }
    setBusy(true);
    try {
      const res = await approveUpiPaymentProof({
        schoolId,
        proof: currentProof,
        approverName,
        approverRole,
        approverId,
        confirmedAmount: parsedConfirmedAmt,
      });

      const targetStudentIds =
        currentProof.isFamilyCombined && Array.isArray(currentProof.familyAllocations)
          ? Array.from(new Set(currentProof.familyAllocations.map((m) => m.studentId).filter(Boolean)))
          : [currentProof.studentId];

      sendSchoolPushNotification({
        schoolId,
        classId: currentProof.classId,
        className: currentProof.className,
        studentIds: targetStudentIds,
        senderName: approverName,
        type: "FEE_RECEIPT",
        title: t(
          `UPI भुगतान स्वीकृत · रसीद ${res.receiptNo}`,
          `UPI Fee Approved · Receipt ${res.receiptNo}`
        ),
        body: t(
          `${currentProof.studentName} (${currentProof.monthLabel || currentProof.month}) का ₹${parsedConfirmedAmt.toLocaleString("en-IN")} भुगतान सत्यापित हो गया है।`,
          `Payment of Rs. ${parsedConfirmedAmt.toLocaleString("en-IN")} for ${currentProof.studentName} is verified.`
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
          body: `${currentProof.studentName} (${res.receiptNo})`,
          voiceSpeak: false,
          extraData: { proofId: currentProof.id },
        }).catch(() => {});
      }

      toast.success(
        t(
          `कन्फर्म! ${currentProof.studentName} की रसीद ${res.receiptNo} जारी हो गई।`,
          `Confirmed! Receipt ${res.receiptNo} issued for ${currentProof.studentName}.`
        )
      );
      onApprovedReceipt?.(res.fee, res.proof);
    } catch {
      toast.error(t("कन्फर्म करने में त्रुटि आई।", "Failed to confirm payment."));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (busy || !schoolId) return;
    setBusy(true);
    try {
      const reasonStr =
        rejectReason.trim() ||
        t("BharatPe में पेमेंट नहीं मिला", "Payment not matched in BharatPe history");
      await rejectUpiPaymentProof({
        schoolId,
        proofId: currentProof.id,
        reason: reasonStr,
        reviewerName: approverName,
        reviewerRole: approverRole,
        reviewerId: approverId,
      });

      const targetStudentIds =
        currentProof.isFamilyCombined && Array.isArray(currentProof.familyAllocations)
          ? Array.from(new Set(currentProof.familyAllocations.map((m) => m.studentId).filter(Boolean)))
          : [currentProof.studentId];

      sendSchoolPushNotification({
        schoolId,
        classId: currentProof.classId,
        className: currentProof.className,
        studentIds: targetStudentIds,
        senderName: approverName,
        type: "MONTHLY_FEE",
        title: t("UPI पेमेंट अस्वीकृत", "UPI Payment Rejected"),
        body: t(
          `${currentProof.studentName} का UPI प्रमाण अस्वीकार हुआ: ${reasonStr}. कृपया सही स्क्रीनशॉट भेजें।`,
          `UPI proof for ${currentProof.studentName} rejected: ${reasonStr}. Please re-submit.`
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
          body: `${currentProof.studentName} rejected`,
          voiceSpeak: false,
          extraData: { proofId: currentProof.id },
        }).catch(() => {});
      }

      toast.info(t("भुगतान अस्वीकार किया गया।", "Payment proof rejected."));
      setRejectMode(false);
      setRejectReason("");
    } catch {
      toast.error(t("अस्वीकार करने में समस्या आई।", "Failed to reject proof."));
    } finally {
      setBusy(false);
    }
  };

  // MINIMIZED FLOATING STICKY BAR (NO CLOSE BUTTON — ONLY EXPAND)
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[150] max-w-[92vw]">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-slate-950 shadow-2xl border-2 border-white/80 dark:border-slate-900 cursor-pointer hover:brightness-105 active:scale-95 transition"
          title={t("खोलें व BharatPe पेमेंट कन्फर्म करें", "Expand to verify UPI payment")}
        >
          <span className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 animate-pulse">
            <BellRing className="w-4 h-4" />
          </span>
          <div className="text-left min-w-0">
            <p className="text-xs font-black leading-tight truncate">
              {pendingProofs.length} UPI {t("सत्यापन बाकी", "Pending Check")} · ₹{totalPendingAmount.toLocaleString("en-IN")}
            </p>
            <p className="text-[10px] font-bold opacity-90 truncate">
              {currentProof.studentName}
              {currentProof.utrNumber ? ` · UTR ${currentProof.utrNumber}` : currentProof.paidTime ? ` · ${currentProof.paidTime}` : ""}
            </p>
          </div>
          <span className="w-7 h-7 rounded-lg bg-slate-950/15 flex items-center justify-center shrink-0">
            <Maximize2 className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
    );
  }

  // EXPANDED NON-DISMISSIBLE POPUP MODAL (ONLY MINIMIZE / CONFIRM / REJECT)
  return (
    <>
      <div
        className="fixed inset-0 z-[150] bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label={t("UPI पेमेंट सत्यापन पॉप-अप", "UPI Payment Verification Popup")}
      >
        <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border-2 border-amber-500/70 bg-white dark:bg-slate-900 shadow-2xl">
          {/* Header — No Close button, Only Minimize + Queue switcher */}
          <div className="sticky top-0 z-10 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0">
                <ReceiptText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black truncate">
                  {t(
                    "पेमेंट स्क्रीनशॉट आया — BharatPe चेक करें",
                    "UPI Screenshot Received — Match BharatPe"
                  )}
                </h3>
                <p className="text-[10px] font-bold opacity-85 truncate">
                  {t(
                    "बिना कन्फर्म या अस्वीकार किए यह कार्ड नहीं हटेगा (मिनिमाइज़ कर सकते हैं)",
                    "Stays active until Confirmed or Rejected (you can Minimize)"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {pendingProofs.length > 1 && (
                <div className="flex items-center gap-1 bg-slate-950/15 rounded-lg px-1.5 py-0.5 text-[11px] font-black">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) => (prev - 1 + pendingProofs.length) % pendingProofs.length)
                    }
                    className="p-1 hover:bg-slate-950/15 rounded cursor-pointer"
                    title="Previous"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="tabular-nums">
                    {activeIndex + 1}/{pendingProofs.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIndex((prev) => (prev + 1) % pendingProofs.length)
                    }
                    className="p-1 hover:bg-slate-950/15 rounded cursor-pointer"
                    title="Next"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer hover:bg-slate-800"
                title={t("मिनिमाइज़ करें ताकि BharatPe देख सकें", "Minimize while checking BharatPe")}
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{t("Minimize", "Minimize")}</span>
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Top Proof Card Summary */}
            <div className="flex items-start gap-3.5">
              <button
                type="button"
                onClick={() => setShowFullImg(true)}
                className="relative w-20 h-24 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-950 shrink-0 group cursor-pointer"
                title={t("बड़ा स्क्रीनशॉट देखें", "Zoom screenshot")}
              >
                {currentProof.screenshotUrl ? (
                  <img
                    src={currentProof.screenshotUrl}
                    alt={currentProof.utrNumber ? `UTR ${currentProof.utrNumber}` : `Payment Screenshot ${currentProof.studentName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                    No Img
                  </div>
                )}
                <span className="absolute inset-0 bg-slate-950/45 flex items-center justify-center text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition">
                  <Eye className="w-4 h-4" />
                </span>
              </button>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                      {currentProof.studentName}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {currentProof.className || "Class"}{" "}
                      {currentProof.rollNo ? `· Roll #${currentProof.rollNo}` : ""} ·{" "}
                      {currentProof.monthLabel || currentProof.month}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums block">
                      ₹{Number(currentProof.amount || 0).toLocaleString("en-IN")}
                    </span>
                    {billedAmt > 0 && billedAmt !== Number(currentProof.amount || 0) && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                        {t("कुल बिल:", "Bill:")} ₹{billedAmt.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Time Match Pill */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {displayPaidTime && (
                    <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 font-bold inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {t("पेमेंट समय:", "Paid Time:")} {displayPaidTime}
                      </span>
                    </span>
                  )}
                  {submittedDateStr && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {submittedDateStr}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Prominent Copy UTR Box (only when UTR was provided) */}
            {Boolean(currentProof.utrNumber?.trim()) && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    {t("UTR / Transaction Ref No.", "UTR / Transaction Ref No.")}
                  </span>
                  <span className="text-sm sm:text-base font-mono font-black text-slate-900 dark:text-white tracking-wide break-all">
                    {currentProof.utrNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyUtr()}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                >
                  {copiedUtrId === currentProof.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{t("कॉपी हुआ", "Copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t("Copy UTR", "Copy UTR")}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Combined Family Allocation Breakdown */}
            {currentProof.isFamilyCombined &&
              Array.isArray(currentProof.familyAllocations) &&
              currentProof.familyAllocations.length > 0 && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/25 p-3 space-y-2">
                  <p className="text-[11px] font-black text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {t(
                        `परिवार के ${currentProof.familyAllocations.length} बच्चों का संयुक्त भुगतान`,
                        `Combined Family Payment (${currentProof.familyAllocations.length} Children)`
                      )}
                    </span>
                  </p>
                  <div className="space-y-1">
                    {currentProof.familyAllocations.map((m, idx) => (
                      <div
                        key={`${m.studentId}_${idx}`}
                        className="flex items-center justify-between text-xs bg-white/80 dark:bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-indigo-100 dark:border-slate-800"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {m.studentName}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5">
                            {m.className || ""} · {m.monthLabel || m.month}
                          </span>
                        </div>
                        {m.isFreeEducation ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black shrink-0">
                            FREE (₹0)
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 shrink-0">
                            ₹{Number(m.billedAmount || 0).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Smart Screenshot OCR Helper Strip */}
            {Boolean(currentProof.screenshotUrl) && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50/75 dark:bg-indigo-950/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 inline-flex items-center gap-1.5">
                    <ScanText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t("स्क्रीनशॉट ऑटो-रीड (OCR)", "Screenshot Auto-Read (OCR)")}</span>
                  </span>
                  {!ocrLoading && (
                    <button
                      type="button"
                      onClick={() => setOcrScanSeq((n) => n + 1)}
                      className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                    >
                      {t("दोबारा पढ़ें", "Re-scan")}
                    </button>
                  )}
                </div>

                {ocrLoading ? (
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>{t("स्क्रीनशॉट से राशि व UTR पढ़ा जा रहा है...", "Reading amount & UTR from screenshot...")}</span>
                  </div>
                ) : ocrResult && (ocrResult.amount !== null || ocrResult.utr) ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {ocrResult.amount !== null && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-700">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                          {t("राशि:", "Amount:")}
                        </span>
                        <strong className="font-mono font-black text-slate-900 dark:text-white tabular-nums">
                          ₹{ocrResult.amount.toLocaleString("en-IN")}
                        </strong>
                        {ocrResult.amount === parsedConfirmedAmt ? (
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                            {t("मिलान ✓", "Match ✓")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmedAmountStr(String(ocrResult.amount))}
                            className="ml-1 px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black cursor-pointer whitespace-nowrap"
                          >
                            {t(`₹${ocrResult.amount.toLocaleString("en-IN")} भरें`, `Use ₹${ocrResult.amount.toLocaleString("en-IN")}`)}
                          </button>
                        )}
                      </div>
                    )}

                    {ocrResult.utr && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-700">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">UTR:</span>
                        <strong className="font-mono text-[11px] font-black text-slate-900 dark:text-white">
                          {ocrResult.utr}
                        </strong>
                        <button
                          type="button"
                          onClick={() => void handleCopyUtrValue(ocrResult.utr!)}
                          className="ml-0.5 px-1.5 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>{t("Copy", "Copy")}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {t(
                      "स्क्रीनशॉट से राशि/UTR स्पष्ट नहीं दिखा — ऊपर फोटो ज़ूम करके BharatPe से मिलान करें।",
                      "Could not clearly auto-read amount/UTR — tap screenshot thumbnail to verify manually."
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Editable Confirmed Amount (supports partial payment verification) */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/25 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  {t(
                    "BharatPe में प्राप्त सही राशि दर्ज करें (₹):",
                    "Confirmed Amount Received in BharatPe (₹):"
                  )}
                </label>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
                  {t("कम होने पर बाकी बकाया रहेगा", "Partial auto-keeps due")}
                </span>
              </div>
              <input
                type="number"
                min={0}
                value={confirmedAmountStr}
                onChange={(e) => setConfirmedAmountStr(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-950 text-base font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {isPartialVerify && (
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  ⚠ {t(
                    `आंशिक भुगतान: ₹${parsedConfirmedAmt.toLocaleString("en-IN")} जमा होगा और शेष ₹${(billedAmt - parsedConfirmedAmt).toLocaleString("en-IN")} बकाया रहेगा।`,
                    `Partial payment: ₹${parsedConfirmedAmt.toLocaleString("en-IN")} clears, remaining ₹${(billedAmt - parsedConfirmedAmt).toLocaleString("en-IN")} stays due.`
                  )}
                </p>
              )}
            </div>

            {currentProof.note && (
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/70 px-3 py-2 rounded-xl">
                {t("नोट:", "Note:")} {currentProof.note}
              </p>
            )}

            {/* Confirm or Reject Controls */}
            {rejectMode ? (
              <div className="space-y-2.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    {t("1-टैप अस्वीकार कारण चुनें:", "1-Tap Reject Reason:")}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      t("राशि कम है / मेल नहीं खाई", "Amount mismatch / short paid"),
                      t("स्क्रीनशॉट धुंधला / अधूरा है", "Screenshot unclear / cropped"),
                      t("BharatPe में पेमेंट नहीं मिला", "Payment not found in BharatPe"),
                      t("फ़र्ज़ी / पुराना स्क्रीनशॉट", "Fake or duplicate screenshot"),
                    ].map((reasonOpt) => {
                      const activeChip = rejectReason.trim() === reasonOpt;
                      return (
                        <button
                          key={reasonOpt}
                          type="button"
                          onClick={() => setRejectReason(reasonOpt)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition ${
                            activeChip
                              ? "bg-rose-600 text-white border-rose-600"
                              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:bg-rose-100"
                          }`}
                        >
                          {reasonOpt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t(
                    "अस्वीकार का कारण लिखें या ऊपर से चुनें...",
                    "Enter rejection reason or tap above..."
                  )}
                  className="w-full h-10 px-3 rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectMode(false)}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    {t("वापस", "Back")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleReject()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
                  >
                    {busy ? t("प्रतीक्षा...", "Wait...") : t("अस्वीकार कन्फर्म करें", "Confirm Reject")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleConfirm()}
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md transition"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {t("Confirm Payment व रसीद भेजें", "Confirm & Issue Receipt")}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejectMode(true)}
                  className="min-h-[44px] px-3.5 rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{t("Reject", "Reject")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Screenshot Lightbox */}
      {showFullImg && (
        <div
          className="fixed inset-0 z-[170] bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowFullImg(false)}
        >
          <div
            className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-3 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 text-white">
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">
                  {currentProof.studentName} · ₹{Number(currentProof.amount || 0).toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                  {currentProof.utrNumber ? `UTR: ${currentProof.utrNumber}` : t("पेमेंट स्क्रीनशॉट", "Payment Screenshot")}{" "}
                  {displayPaidTime ? `· ${displayPaidTime}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullImg(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {currentProof.screenshotUrl && (
              <img
                src={currentProof.screenshotUrl}
                alt={currentProof.utrNumber ? `UTR ${currentProof.utrNumber}` : `Payment Screenshot ${currentProof.studentName}`}
                className="w-full max-h-[75vh] object-contain rounded-xl bg-black"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
};
