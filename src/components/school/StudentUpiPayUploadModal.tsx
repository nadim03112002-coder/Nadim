import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ImagePlus,
  Loader2,
  Lock,
  ShieldCheck,
  Upload,
  Users,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type {
  School,
  UpiFamilyAllocationItem,
  UpiPaymentProofRecord,
} from "../../school-types";
import {
  getAuthorizedUpiPushTargetIds,
  getSchool,
  saveUpiPaymentProof,
} from "../../school-firebase";
import { compressImageToBlob } from "../../services/imgbbService";
import { uploadToCloudinary } from "../../services/cloudinaryService";
import { sendSchoolPushNotification } from "../../utils/schoolPushClient";
import { calculateFastPayFeeBreakdown } from "../../utils/razorpayCheckout";
import { pickLang, useAppLang } from "../../utils/appLang";
import { computeImageHash } from "../../utils/upiAppLauncher";
import { UpiAppPickerBox } from "./UpiAppPickerBox";

export interface FamilyPayChildOption {
  studentId: string;
  studentName: string;
  classId: string;
  className?: string;
  rollNo?: string;
  month: string;
  monthLabel: string;
  billedAmount: number;
  isFreeEducation?: boolean;
  isAlreadyPaid?: boolean;
}

interface StudentUpiPayUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  sessionId?: string;
  schoolName: string;
  school?: School | null;
  upiId?: string;
  student: {
    id: string;
    name: string;
    fatherName?: string;
    classId: string;
    className?: string;
    rollNo?: string;
    phone?: string;
  };
  month: string;
  monthLabel: string;
  exactAmount: number;
  familyMembers?: FamilyPayChildOption[];
  razorpayEnabled?: boolean;
  pendingProof?: UpiPaymentProofRecord | null;
  rejectedProof?: UpiPaymentProofRecord | null;
  initialMethod?: "choose" | "free" | "fast";
  onSwitchToRazorpay?: () => void;
  onSubmitted?: (record: UpiPaymentProofRecord) => void;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(blob);
  });
}

function getCurrentTimeHHMM(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatTime12h(hhmm: string): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [hStr, mStr] = hhmm.split(":");
  const h24 = Number(hStr);
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${mStr} ${ampm}`;
}

function speakHindiUpiReminder(): void {
  const speechText =
    "पेमेंट करने के बाद स्क्रीनशॉट ज़रूर लगेंगे, और कन्फर्मेशन में लगभग 5 मिनट लग सकते हैं।";
  try {
    const bridge = (window as any).LifeMakerAndroid;
    if (bridge && typeof bridge.speakNativeVoice === "function") {
      bridge.speakNativeVoice(speechText);
      return;
    }
  } catch {}
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(speechText);
      utter.lang = "hi-IN";
      utter.rate = 0.96;
      const voices = window.speechSynthesis.getVoices() || [];
      const hiVoice = voices.find((v) => v.lang === "hi-IN" || v.lang.startsWith("hi"));
      if (hiVoice) utter.voice = hiVoice;
      window.speechSynthesis.speak(utter);
    }
  } catch {}
}


export const StudentUpiPayUploadModal: React.FC<StudentUpiPayUploadModalProps> = ({
  isOpen,
  onClose,
  schoolId,
  sessionId,
  schoolName,
  school: propSchool,
  upiId,
  student,
  month,
  monthLabel,
  exactAmount,
  familyMembers,
  razorpayEnabled = false,
  pendingProof = null,
  rejectedProof = null,
  initialMethod,
  onSwitchToRazorpay,
  onSubmitted,
}) => {
  const [lang] = useAppLang();
  const t = (hi: string, en: string) => pickLang(lang, hi, en);

  const FREE_PAY_MAX_AMOUNT = 2000;
  const isFamilyMode = Array.isArray(familyMembers) && familyMembers.length > 1;
  const initialBillRounded = Math.max(0, Math.round(Number(exactAmount) || 0));

  const [paymentTab, setPaymentTab] = useState<"choose" | "free" | "fast">(() =>
    isFamilyMode
      ? "free"
      : initialMethod === "free" && initialBillRounded > FREE_PAY_MAX_AMOUNT
      ? "choose"
      : initialMethod || "choose"
  );
  const [fastPayDoubleAck, setFastPayDoubleAck] = useState(false);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [paidAmountStr, setPaidAmountStr] = useState("");
  const [paidTime, setPaidTime] = useState(getCurrentTimeHHMM());
  const [note, setNote] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [screenshotHash, setScreenshotHash] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [payTappedHint, setPayTappedHint] = useState(false);
  const [awaitingUpiReturn, setAwaitingUpiReturn] = useState(false);
  const [highlightScreenshotBox, setHighlightScreenshotBox] = useState(false);
  const screenshotBoxRef = useRef<HTMLDivElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const [loadedSchool, setLoadedSchool] = useState<School | null>(propSchool || null);

  useEffect(() => {
    if (propSchool) {
      setLoadedSchool(propSchool);
    } else if (isOpen && schoolId) {
      getSchool(schoolId).then((s) => { if (s) setLoadedSchool(s); }).catch(() => {});
    }
  }, [isOpen, schoolId, propSchool]);

  const selectedFamilyMembers = useMemo(() => {
    if (!isFamilyMode || !familyMembers) return [];
    const set = new Set(selectedChildIds);
    return familyMembers.filter((m) => set.has(m.studentId));
  }, [isFamilyMode, familyMembers, selectedChildIds]);

  const computedTotalBill = useMemo(() => {
    if (!isFamilyMode) {
      return Math.max(0, Math.round(Number(exactAmount) || 0));
    }
    return selectedFamilyMembers.reduce((sum, m) => {
      if (m.isFreeEducation || m.isAlreadyPaid) return sum;
      return sum + Math.max(0, Math.round(Number(m.billedAmount) || 0));
    }, 0);
  }, [isFamilyMode, exactAmount, selectedFamilyMembers]);

  useEffect(() => {
    if (isOpen) {
      if (isFamilyMode && familyMembers) {
        const defaultIds = familyMembers
          .filter((m) => !m.isAlreadyPaid && (m.isFreeEducation || Number(m.billedAmount || 0) > 0))
          .map((m) => m.studentId);
        setSelectedChildIds(
          defaultIds.length > 0 ? defaultIds : familyMembers.map((m) => m.studentId)
        );
      } else {
        setSelectedChildIds([]);
      }
      const billRounded = Math.max(0, Math.round(Number(exactAmount) || 0));
      setPaymentTab(
        isFamilyMode
          ? "free"
          : initialMethod === "free" && billRounded > FREE_PAY_MAX_AMOUNT
          ? "choose"
          : initialMethod || "choose"
      );
      setFastPayDoubleAck(false);
      setPaidTime(getCurrentTimeHHMM());
      setNote("");
      setScreenshotUrl("");
      setScreenshotHash("");
      setErrorMsg(null);
      setPayTappedHint(false);
      setAwaitingUpiReturn(false);
      setHighlightScreenshotBox(false);
      setSubmitting(false);
      setUploadingImg(false);
    }
  }, [isOpen, month, student?.id, isFamilyMode, initialMethod]);

  useEffect(() => {
    if (isOpen) {
      setPaidAmountStr(String(computedTotalBill));
    }
  }, [isOpen, computedTotalBill]);

  const handleUpiAppReturned = () => {
    setAwaitingUpiReturn(false);
    setPaidTime(getCurrentTimeHHMM());
    setHighlightScreenshotBox(true);
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightScreenshotBox(false);
    }, 6000);
    window.setTimeout(() => {
      screenshotBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
  };

  useEffect(() => {
    if (!isOpen || !awaitingUpiReturn) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        handleUpiAppReturned();
      }
    };
    const onFocus = () => handleUpiAppReturned();
    const onNativeResult = () => handleUpiAppReturned();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("native-upi-result", onNativeResult);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("native-upi-result", onNativeResult);
    };
  }, [isOpen, awaitingUpiReturn]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const cleanUpi = String(upiId || loadedSchool?.upiId || "").trim();
  const payableNow = Math.max(0, Math.round(Number(paidAmountStr) || 0));
  const isPartialIntent = computedTotalBill > 0 && payableNow > 0 && payableNow < computedTotalBill;
  const isFreePayLocked = !isFamilyMode && computedTotalBill > FREE_PAY_MAX_AMOUNT;
  const isFreePayAmountOverLimit = payableNow > FREE_PAY_MAX_AMOUNT;

  const displayTitleStudent = isFamilyMode
    ? t(
        `${selectedFamilyMembers.length} बच्चों की संयुक्त फीस`,
        `Combined Fee (${selectedFamilyMembers.length} Children)`
      )
    : student.name;

  const txnNote = `${displayTitleStudent} ${monthLabel}`.slice(0, 50);

  const toggleFamilyChild = (sid: string) => {
    setSelectedChildIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const handleSelectFreePayTab = () => {
    if (isFreePayLocked) {
      toast.error(
        t(
          "₹2,000 से ज्यादा फीस पर Free Pay लॉक है — कृपया ⚡ Fast Pay (+5%) चुनें।",
          "Free Pay is locked above ₹2,000 — please use ⚡ Fast Pay (+5%)."
        )
      );
      return;
    }
    setPaymentTab("free");
    setErrorMsg(null);
    speakHindiUpiReminder();
    toast.info(
      t(
        "पेमेंट करने के बाद स्क्रीनशॉट लगेंगे — कन्फर्मेशन में ~5 मिनट लग सकते हैं।",
        "Screenshot will be required after paying — confirmation takes ~5 minutes."
      )
    );
  };

  const handleOpenUpiAppClick = () => {
    setPayTappedHint(true);
    setAwaitingUpiReturn(true);
    speakHindiUpiReminder();
    toast.info(
      t(
        "पेमेंट के बाद स्क्रीनशॉट ज़रूर अपलोड करें — कन्फर्मेशन में ~5 मिनट लग सकते हैं।",
        "Upload the screenshot after paying — confirmation may take ~5 minutes."
      )
    );
  };

  const handleSelectScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploadingImg(true);
    try {
      const fileHash = await computeImageHash(file);
      let uploaded = "";
      try {
        const res = await uploadToCloudinary(file, "image");
        uploaded = res?.secure_url || res?.url || "";
      } catch {
        uploaded = "";
      }
      if (!uploaded) {
        const compressed = await compressImageToBlob(file, 960, 960, 0.72, false);
        uploaded = await blobToDataUrl(compressed);
      }
      setScreenshotUrl(uploaded);
      setScreenshotHash(fileHash);
    } catch {
      setErrorMsg(
        t(
          "स्क्रीनशॉट अपलोड नहीं हो सका। कृपया दूसरी फोटो चुनें।",
          "Failed to load screenshot image. Please choose another image."
        )
      );
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isFamilyMode && selectedFamilyMembers.length === 0) {
      setErrorMsg(t("कृपया कम से कम 1 बच्चा चुनें।", "Please select at least 1 child."));
      return;
    }
    if (payableNow <= 0 && computedTotalBill > 0) {
      setErrorMsg(t("कृपया जमा की गई सही राशि (₹) दर्ज करें।", "Please enter the paid amount (₹)."));
      return;
    }
    if (payableNow > FREE_PAY_MAX_AMOUNT) {
      setErrorMsg(
        t(
          "₹2,000 से अधिक राशि के लिए Free Pay लॉक है — कृपया ₹2,000 या उससे कम पे करें या ⚡ Fast Pay (+5%) चुनें।",
          "Free Pay is locked above ₹2,000 — pay ₹2,000 or less, or switch to ⚡ Fast Pay (+5%)."
        )
      );
      return;
    }
    if (!screenshotUrl) {
      setErrorMsg(
        t(
          "पेमेंट कन्फर्म करने के लिए स्क्रीनशॉट अपलोड करना अनिवार्य है।",
          "Payment screenshot upload is mandatory."
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      const formattedTime = formatTime12h(paidTime || getCurrentTimeHHMM());
      const familyAllocations: UpiFamilyAllocationItem[] | undefined = isFamilyMode
        ? selectedFamilyMembers.map((m) => ({
            studentId: m.studentId,
            studentName: m.studentName,
            classId: m.classId,
            className: m.className,
            rollNo: m.rollNo,
            month: m.month,
            monthLabel: m.monthLabel,
            billedAmount: m.isFreeEducation ? 0 : Math.max(0, Math.round(Number(m.billedAmount) || 0)),
            isFreeEducation: Boolean(m.isFreeEducation),
          }))
        : undefined;

      const proofId = `upiproof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const record: UpiPaymentProofRecord = {
        id: proofId,
        schoolId,
        sessionId: sessionId || "",
        studentId: student.id,
        studentName: isFamilyMode
          ? `${selectedFamilyMembers.map((m) => m.studentName).join(" + ")}`.slice(0, 90)
          : student.name,
        fatherName: student.fatherName || "",
        classId: student.classId,
        className: isFamilyMode ? "Family Combined" : student.className || "",
        rollNo: isFamilyMode ? "" : student.rollNo || "",
        phone: student.phone || "",
        month,
        monthLabel,
        amount: payableNow,
        billedAmount: computedTotalBill,
        paidTime: formattedTime,
        utrNumber: "",
        screenshotUrl,
        screenshotHash: screenshotHash || undefined,
        note: note.trim() || undefined,
        status: "PENDING",
        submittedAt: new Date().toISOString(),
        ...(isFamilyMode
          ? {
              isFamilyCombined: true,
              familyAllocations,
            }
          : {}),
      };

      const res = await saveUpiPaymentProof(record);
      if (!res.ok) {
        setErrorMsg(res.error || t("सबमिट नहीं हो सका", "Submission failed"));
        setSubmitting(false);
        return;
      }

      const savedRec = res.record || record;

      // Dispatch targeted push notification ONLY to Admin-selected BharatPe receivers
      const receiverIds = getAuthorizedUpiPushTargetIds(loadedSchool);
      if (receiverIds.length > 0) {
        const familyShort = isFamilyMode
          ? `Family (${selectedFamilyMembers.length} Children)`
          : "";
        sendSchoolPushNotification({
          schoolId,
          targetUserIds: receiverIds,
          senderId: student.id,
          senderName: savedRec.studentName,
          type: "UPI_PAYMENT_PROOF",
          voiceSpeak: true,
          title: `नया UPI पेमेंट स्क्रीनशॉट · ₹${payableNow.toLocaleString("en-IN")}`,
          body: `${savedRec.studentName} (${monthLabel}) से ₹${payableNow.toLocaleString("en-IN")} का पेमेंट स्क्रीनशॉट आया है · समय: ${formattedTime}। कृपया BharatPe चेक करके Confirm करें।`,
          url: `/?schoolPortal=1&openUpiProof=${encodeURIComponent(savedRec.id)}`,
          urgent: true,
          extraData: {
            proofId: savedRec.id,
            utrNumber: "",
            amount: String(payableNow),
            billedAmount: String(computedTotalBill),
            paidTime: formattedTime,
            studentName: savedRec.studentName.slice(0, 80),
            monthLabel: String(monthLabel).slice(0, 60),
            familySummary: familyShort,
            ...(savedRec.screenshotUrl && savedRec.screenshotUrl.startsWith("http")
              ? { screenshotUrl: savedRec.screenshotUrl }
              : {}),
          },
        }).catch(() => {});
      }

      toast.success(
        t(
          "भुगतान प्रमाण भेज दिया गया! चयनित स्कूल स्टाफ द्वारा BharatPe जांच के बाद तुरंत रसीद मिल जाएगी।",
          "Payment proof submitted! Receipt will arrive as soon as staff verifies BharatPe."
        )
      );
      onSubmitted?.(savedRec);
      onClose();
    } catch {
      setErrorMsg(t("सबमिट करने में त्रुटि आई।", "Failed to submit payment proof."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("UPI QR भुगतान और स्क्रीनशॉट अपलोड", "UPI QR Pay & Screenshot Upload")}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                paymentTab === "fast"
                  ? "bg-indigo-600/15 text-indigo-500"
                  : "bg-emerald-600/15 text-emerald-600 dark:text-emerald-400"
              }`}>
                {isFamilyMode ? (
                  <Users className="w-4.5 h-4.5" />
                ) : paymentTab === "fast" ? (
                  <Zap className="w-4.5 h-4.5" />
                ) : (
                  <CreditCard className="w-4.5 h-4.5" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                  <span>
                    {isFamilyMode
                      ? t("सभी बच्चों का संयुक्त UPI भुगतान", "Combined Family UPI Pay")
                      : paymentTab === "fast"
                      ? t("⚡ Fast Pay (Razorpay)", "⚡ Fast Pay (Razorpay)")
                      : paymentTab === "free"
                      ? t("🆓 Free Pay (Direct UPI)", "🆓 Free Pay (Direct UPI)")
                      : t("फीस भुगतान विकल्प चुनें (Pay Fee)", "Choose Fee Payment Option")}
                  </span>
                  {paymentTab === "free" && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black shrink-0">
                      ₹0 Charge
                    </span>
                  )}
                  {paymentTab === "fast" && (
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-black shrink-0">
                      +5% Fee
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {displayTitleStudent} · {monthLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2-Option Method Tabs (Always visible on single-student pay) */}
          {!isFamilyMode && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleSelectFreePayTab}
                className={`py-2 px-2.5 rounded-lg text-left transition flex items-center justify-between gap-1 ${
                  isFreePayLocked
                    ? "bg-slate-100/90 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80"
                    : paymentTab === "free"
                    ? "bg-emerald-600 text-white shadow-sm cursor-pointer"
                    : "text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/80 cursor-pointer"
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-black flex items-center gap-1 truncate">
                    {isFreePayLocked ? <Lock className="w-3 h-3 shrink-0" /> : <span>🆓</span>}
                    <span>{t("Free Pay", "Free Pay")}</span>
                  </span>
                  <span className={`text-[9px] font-semibold block truncate ${
                    isFreePayLocked
                      ? "text-rose-500 dark:text-rose-400"
                      : paymentTab === "free"
                      ? "text-emerald-100"
                      : "text-slate-500 dark:text-slate-400"
                  }`}>
                    {isFreePayLocked
                      ? t("₹2,000 से ऊपर लॉक", "Locked > ₹2,000")
                      : t("₹0 चार्ज · ~5 मिनट", "₹0 Fee · ~5 Min")}
                  </span>
                </div>
                <span className={`text-[10px] font-mono font-black shrink-0 ${
                  isFreePayLocked
                    ? "text-slate-400 dark:text-slate-500"
                    : paymentTab === "free"
                    ? "text-white"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  ₹{computedTotalBill.toLocaleString("en-IN")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentTab("fast");
                  setErrorMsg(null);
                }}
                className={`py-2 px-2.5 rounded-lg text-left transition cursor-pointer flex items-center justify-between gap-1 ${
                  paymentTab === "fast"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/80"
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[11px] font-black flex items-center gap-1 truncate">
                    <Zap className={`w-3 h-3 shrink-0 ${paymentTab === "fast" ? "text-amber-300" : "text-indigo-500"}`} />
                    <span>{t("Fast Pay", "Fast Pay")}</span>
                  </span>
                  <span className={`text-[9px] font-semibold block truncate ${
                    paymentTab === "fast" ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"
                  }`}>
                    {razorpayEnabled
                      ? t("+5% चार्ज · तुरंत रसीद", "+5% Fee · Instant")
                      : t("अभी बंद (Off)", "Currently Off")}
                  </span>
                </div>
                <span className={`text-[10px] font-mono font-black shrink-0 ${
                  paymentTab === "fast" ? "text-amber-200" : "text-indigo-600 dark:text-indigo-400"
                }`}>
                  ₹{calculateFastPayFeeBreakdown(computedTotalBill).totalPayable.toLocaleString("en-IN")}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* STEP 0: Clean 2-Option Chooser when user first clicks Pay Fee */}
        {!isFamilyMode && paymentTab === "choose" && (() => {
          const fastCalc = calculateFastPayFeeBreakdown(computedTotalBill);
          return (
            <div className="p-4 sm:p-5 space-y-3.5">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {t("इस माह की देय फीस", "School Fee Due")}
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {monthLabel}
                  </span>
                </div>
                <span className="text-xl font-black font-mono text-slate-900 dark:text-white tabular-nums">
                  ₹{computedTotalBill.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Option 1: Fast Pay (Razorpay +5%) */}
              <button
                type="button"
                onClick={() => {
                  setPaymentTab("fast");
                  setErrorMsg(null);
                }}
                className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer space-y-2 ${
                  razorpayEnabled
                    ? "border-indigo-500/45 bg-gradient-to-br from-indigo-50 to-blue-50/70 dark:from-indigo-950/50 dark:to-slate-900 hover:border-indigo-500 shadow-sm"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 opacity-85"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Zap className="w-5 h-5 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>⚡ Fast Pay (Razorpay)</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                          +5% Extra Charge
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {razorpayEnabled
                          ? t("तुरंत पक्की रसीद · राशि फिक्स (हर फीस के लिए उपलब्ध)", "Instant official receipt · Fixed full amount")
                          : t("स्कूल सेटिंग्स में Razorpay चालू होने पर उपलब्ध होगा", "Available when school enables Razorpay")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black font-mono text-indigo-700 dark:text-indigo-300 block tabular-nums">
                      ₹{fastCalc.totalPayable.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      +₹{fastCalc.convenienceFee} (5%)
                    </span>
                  </div>
                </div>
              </button>

              {/* Option 2: Free Pay (₹0 Extra · Available up to ₹2,000; Locked above ₹2,000) */}
              <button
                type="button"
                onClick={handleSelectFreePayTab}
                className={`w-full p-4 rounded-2xl border-2 text-left transition space-y-2 ${
                  isFreePayLocked
                    ? "border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-900/75 opacity-80 cursor-not-allowed"
                    : "border-emerald-500/60 bg-gradient-to-br from-emerald-50 to-teal-50/60 dark:from-emerald-950/45 dark:to-slate-900 hover:border-emerald-500 cursor-pointer shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      isFreePayLocked
                        ? "bg-slate-400 dark:bg-slate-700 text-white"
                        : "bg-emerald-600 text-white"
                    }`}>
                      {isFreePayLocked ? <Lock className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>{isFreePayLocked ? "🔒 Free Pay (Locked)" : "🆓 Free Pay (Direct UPI)"}</span>
                        {isFreePayLocked ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                            ₹2,000 से ऊपर लॉक
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-black">
                            ₹0 Extra · ₹2,000 तक
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {isFreePayLocked
                          ? t(
                              "₹2,000 से अधिक फीस के लिए Free Pay बंद है — कृपया ऊपर Fast Pay (+5%) चुनें",
                              "Free Pay is locked for fees above ₹2,000 — please use Fast Pay (+5%)"
                            )
                          : t(
                              "पेमेंट के बाद स्क्रीनशॉट अपलोड ज़रूरी · कन्फर्म होने में ~5 मिनट लग सकते हैं",
                              "Screenshot required after pay · Confirmation takes ~5 minutes"
                            )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-base font-black font-mono block tabular-nums ${
                      isFreePayLocked
                        ? "text-slate-400 dark:text-slate-500 line-through"
                        : "text-emerald-700 dark:text-emerald-300"
                    }`}>
                      ₹{computedTotalBill.toLocaleString("en-IN")}
                    </span>
                    <span className={`text-[10px] font-bold ${
                      isFreePayLocked
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}>
                      {isFreePayLocked ? t("लॉक (Locked)", "Locked") : t("कोई चार्ज नहीं", "No Extra Fee")}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          );
        })()}

        {/* FAST PAY TAB PANEL (Razorpay +5% Fixed Full Amount) */}
        {!isFamilyMode && paymentTab === "fast" && (() => {
          const fastCalc = calculateFastPayFeeBreakdown(computedTotalBill);
          return (
            <div className="p-4 sm:p-5 space-y-3.5">
              {pendingProof && pendingProof.status === "PENDING" && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/45 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 dark:text-amber-100 space-y-0.5">
                      <p className="font-black text-amber-800 dark:text-amber-300">
                        {t(
                          "सावधान: इस माह का Free UPI स्क्रीनशॉट पहले से पेंडिंग है!",
                          "Warning: A Free UPI Proof is Already Pending!"
                        )}
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        {pendingProof.utrNumber ? (
                          <>
                            UTR: <strong className="font-mono">{pendingProof.utrNumber}</strong> ·{" "}
                          </>
                        ) : null}
                        ₹{Number(pendingProof.amount || 0).toLocaleString("en-IN")} की जांच स्कूल द्वारा की जा रही है। अगर पिछला पेमेंट फेल हो गया था तभी Fast Pay करें।
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-[11px] font-bold text-amber-900 dark:text-amber-200">
                    <input
                      type="checkbox"
                      checked={fastPayDoubleAck}
                      onChange={(e) => setFastPayDoubleAck(e.target.checked)}
                      className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                    />
                    <span>
                      {t(
                        "हाँ, मैं समझता हूँ — फिर भी Fast Pay से पेमेंट करना है",
                        "Yes, proceed with Fast Pay anyway"
                      )}
                    </span>
                  </label>
                </div>
              )}

              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50/70 dark:bg-slate-950/80 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{t("मूल स्कूल फीस (Fixed)", "School Fee (Fixed Full)")}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{fastCalc.baseAmount.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-700 dark:text-amber-300 font-semibold">
                    {t("Fast Pay सुविधा शुल्क (5%)", "Fast Pay Extra Charge (5%)")}
                  </span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                    + ₹{fastCalc.convenienceFee.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-indigo-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      {t("कुल फिक्स भुगतान राशि", "Total Fixed Payable")}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {t(
                        "राशि बदली नहीं जा सकती · पेमेंट होते ही तुरंत रसीद",
                        "Amount cannot be edited · Instant official receipt"
                      )}
                    </span>
                  </div>
                  <span className="text-2xl font-black font-mono text-indigo-700 dark:text-indigo-300 tabular-nums">
                    ₹{fastCalc.totalPayable.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {!razorpayEnabled ? (
                <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                  <p className="font-bold">
                    {t(
                      "स्कूल के Admin द्वारा Razorpay Fast Pay अभी चालू नहीं किया गया है।",
                      "Razorpay Fast Pay is not enabled by this school yet."
                    )}
                  </p>
                  {!isFreePayLocked && (
                    <button
                      type="button"
                      onClick={handleSelectFreePayTab}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
                    >
                      🆓 {t("Free Pay (₹0 Charge) से भुगतान करें", "Switch to Free Pay (₹0 Charge)")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  {!isFreePayLocked ? (
                    <button
                      type="button"
                      onClick={handleSelectFreePayTab}
                      className="px-3.5 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                    >
                      🆓 Free Pay (₹0)
                    </button>
                  ) : (
                    <span className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 text-[11px] font-bold inline-flex items-center gap-1 shrink-0">
                      <Lock className="w-3 h-3" />
                      <span>{t("Free लॉक (>₹2k)", "Free Locked")}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={Boolean(pendingProof && pendingProof.status === "PENDING" && !fastPayDoubleAck) || !onSwitchToRazorpay}
                    onClick={() => {
                      onClose();
                      onSwitchToRazorpay?.();
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>
                      {t(
                        `⚡ Pay Fixed ₹${fastCalc.totalPayable.toLocaleString("en-IN")}`,
                        `⚡ Pay Fixed ₹${fastCalc.totalPayable.toLocaleString("en-IN")}`
                      )}
                    </span>
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* FREE PAY TAB FORM (₹0 Charge · Direct UPI App + Screenshot + Optional Collapsible QR) */}
        {(isFamilyMode || paymentTab === "free") && (
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {!isFamilyMode && pendingProof && pendingProof.status === "PENDING" && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-black">
                  {t(
                    "इस माह का UPI स्क्रीनशॉट पहले से जांच (Pending) में है",
                    "A UPI screenshot proof is already pending verification"
                  )}
                </p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {pendingProof.utrNumber ? (
                    <>
                      UTR: <strong className="font-mono">{pendingProof.utrNumber}</strong> ·{" "}
                    </>
                  ) : null}
                  ₹{Number(pendingProof.amount || 0).toLocaleString("en-IN")} — कन्फर्मेशन में ~5 मिनट लग सकते हैं।
                </p>
              </div>
            </div>
          )}

          {!isFamilyMode &&
            (!pendingProof || pendingProof.status !== "PENDING") &&
            rejectedProof &&
            rejectedProof.status === "REJECTED" && (
              <div className="rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black">
                    {t(
                      "पिछला पेमेंट स्क्रीनशॉट अस्वीकार हुआ था",
                      "Previous payment screenshot was rejected"
                    )}
                  </p>
                  {rejectedProof.rejectionReason && (
                    <p className="text-[11px] font-semibold mt-0.5">
                      {t("कारण:", "Reason:")} {rejectedProof.rejectionReason}
                    </p>
                  )}
                  <p className="text-[11px] opacity-90 mt-1">
                    {t(
                      "कृपया नीचे नया सही पेमेंट स्क्रीनशॉट अपलोड करके दोबारा भेजें।",
                      "Please upload a new correct payment screenshot below and resubmit."
                    )}
                  </p>
                </div>
              </div>
            )}

          {/* Combined Family Children Selection (Only when multiple linked students exist) */}
          {isFamilyMode && familyMembers && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/25 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{t("परिवार के बच्चे चुनें (ऑटो फ्री जाँच)", "Select Children (Auto Free Check)")}</span>
                </span>
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  {selectedFamilyMembers.length}/{familyMembers.length} {t("चुने", "Selected")}
                </span>
              </div>
              <div className="space-y-1.5">
                {familyMembers.map((m) => {
                  const checked = selectedChildIds.includes(m.studentId);
                  return (
                    <button
                      key={m.studentId}
                      type="button"
                      onClick={() => toggleFamilyChild(m.studentId)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                        checked
                          ? "bg-white dark:bg-slate-900 border-emerald-500 shadow-xs"
                          : "bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                            checked
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 dark:bg-slate-700 text-transparent"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {m.studentName}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {m.className || "Class"} {m.rollNo ? `· Roll #${m.rollNo}` : ""} · {m.monthLabel}
                          </p>
                        </div>
                      </div>
                      {m.isFreeEducation ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-black shrink-0">
                          FREE (₹0)
                        </span>
                      ) : m.isAlreadyPaid ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold shrink-0">
                          Paid (₹0)
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-black text-slate-900 dark:text-white shrink-0">
                          ₹{Math.round(Number(m.billedAmount) || 0).toLocaleString("en-IN")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Total Bill + Editable Paid Amount */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                  {t("कुल देय शुल्क (Free Pay · ₹0 एक्स्ट्रा)", "Total Bill Due (Free · ₹0 Extra Charge)")}
                </span>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                  ₹{computedTotalBill.toLocaleString("en-IN")}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black shrink-0">
                ⏱ {t("~5 मिनट कन्फर्म", "~5 Min Confirm")}
              </span>
            </div>

            <div className="pt-2 border-t border-emerald-200/80 dark:border-emerald-800/50">
              <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 block mb-1">
                {t("आप कितना पेमेंट कर रहे हैं? (कम होने पर बाकी बकाया रहेगा)", "Amount You Paid (₹) — Partial allowed")}
              </label>
              <input
                type="number"
                min={0}
                value={paidAmountStr}
                onChange={(e) => setPaidAmountStr(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-950 text-base font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {isPartialIntent && (
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mt-1">
                  ⚠ {t(
                    `आंशिक जमा: ₹${payableNow.toLocaleString("en-IN")} कट जाएगा व शेष ₹${(computedTotalBill - payableNow).toLocaleString("en-IN")} बकाया रहेगा।`,
                    `Partial: ₹${payableNow.toLocaleString("en-IN")} will be credited and ₹${(computedTotalBill - payableNow).toLocaleString("en-IN")} remains due.`
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Direct App Pay Buttons (Available up to ₹2,000; Locked above ₹2,000) */}
          {isFreePayAmountOverLimit ? (
            <div className="rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/35 p-4 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <div className="text-xs text-rose-900 dark:text-rose-200 space-y-1">
                  <p className="font-black">
                    {t(
                      "🔒 ₹2,000 से अधिक राशि के लिए Free Pay लॉक है",
                      "🔒 Free Pay is locked above ₹2,000"
                    )}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {isFamilyMode
                      ? t(
                          "Free Pay से एक बार में केवल ₹2,000 तक ही भुगतान किया जा सकता है। कृपया ऊपर कम बच्चे चुनें या प्रत्येक बच्चे की फीस अलग-अलग Fast Pay (+5%) से जमा करें।",
                          "Free Pay is limited to ₹2,000 at a time. Select fewer children or pay individually via Fast Pay (+5%)."
                        )
                      : t(
                          "Free Pay केवल ₹2,000 या उससे कम भुगतान के लिए उपलब्ध है। कृपया ₹2,000 से कम राशि दर्ज करें या ⚡ Fast Pay (+5%) का उपयोग करें।",
                          "Free Pay is available only up to ₹2,000. Enter ₹2,000 or less, or switch to ⚡ Fast Pay (+5%)."
                        )}
                  </p>
                </div>
              </div>
              {!isFamilyMode && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentTab("fast");
                    setErrorMsg(null);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>{t("⚡ Fast Pay (+5%) पर जाएँ", "Switch to ⚡ Fast Pay (+5%)")}</span>
                </button>
              )}
            </div>
          ) : cleanUpi ? (
            <UpiAppPickerBox
              upiId={cleanUpi}
              schoolName={schoolName}
              amount={payableNow}
              txnNote={txnNote}
              lang={lang}
              onPayTriggered={handleOpenUpiAppClick}
              onPayReturned={() => handleUpiAppReturned()}
              footer={
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-amber-900 dark:text-amber-200 font-semibold">
                  <div className="flex items-start gap-2 min-w-0">
                    <Volume2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>
                      {payTappedHint
                        ? t(
                            "पेमेंट के बाद स्क्रीनशॉट नीचे अपलोड करें — कन्फर्मेशन में ~5 मिनट लग सकते हैं।",
                            "Upload your screenshot below after paying — confirmation may take ~5 minutes."
                          )
                        : t(
                            "पेमेंट के बाद स्क्रीनशॉट लगेंगे और कन्फर्मेशन में ~5 मिनट लग सकते हैं।",
                            "Screenshot is required after pay; confirmation may take ~5 minutes."
                          )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakHindiUpiReminder()}
                    className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-amber-200/70 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 text-[10px] font-black shrink-0 cursor-pointer"
                    title={t("आवाज़ दोबारा सुनें", "Replay voice instruction")}
                  >
                    🔊
                  </button>
                </div>
              }
            />
          ) : (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              {t(
                "स्कूल का UPI ID अभी प्रोफ़ाइल में दर्ज नहीं है। कृपया पेमेंट का स्क्रीनशॉट नीचे अपलोड करें।",
                "School UPI ID is not configured yet. Please upload your payment screenshot below."
              )}
            </div>
          )}

          {/* Screenshot Upload Input */}
          <div
            ref={screenshotBoxRef}
            className={`space-y-1.5 rounded-2xl transition-all duration-300 ${
              highlightScreenshotBox && !screenshotUrl
                ? "p-3 bg-emerald-50/80 dark:bg-emerald-950/30 ring-2 ring-emerald-500 shadow-sm"
                : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                {t("पेमेंट स्क्रीनशॉट अपलोड करें (अनिवार्य) *", "Upload Payment Screenshot (Required) *")}
              </label>
              {highlightScreenshotBox && !screenshotUrl && (
                <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                  {t("अब यहाँ स्क्रीनशॉट अपलोड करें ↓", "Upload screenshot here ↓")}
                </span>
              )}
            </div>
            <label
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 cursor-pointer transition ${
                highlightScreenshotBox && !screenshotUrl
                  ? "border-emerald-500 bg-white dark:bg-slate-900"
                  : "border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-950/60"
              }`}
            >
              {uploadingImg ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t("फोटो तैयार हो रही है...", "Processing image...")}</span>
                </div>
              ) : screenshotUrl ? (
                <div className="w-full flex items-center gap-3">
                  <img
                    src={screenshotUrl}
                    alt="UPI Proof"
                    className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{t("स्क्रीनशॉट संलग्न हो गया", "Screenshot attached")}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {t("बदलने के लिए फिर से टैप करें", "Tap to replace screenshot")}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <ImagePlus className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t("गैलरी से पेमेंट स्क्रीनशॉट चुनें", "Choose payment screenshot from gallery")}
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleSelectScreenshot}
                className="hidden"
              />
            </label>
          </div>

          {/* Payment Time + Optional Note */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t("पेमेंट समय", "Paid Time")}</span>
              </label>
              <input
                type="time"
                value={paidTime}
                onChange={(e) => setPaidTime(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
                {t("टिप्पणी (वैकल्पिक)", "Remark (Optional)")}
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("जैसे: PhonePe द्वारा पिताजी ने भेजा", "e.g. Paid via PhonePe by father")}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {t("रद्द करें", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingImg || isFreePayAmountOverLimit}
              className="flex-1 sm:flex-initial min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>
                {submitting
                  ? t("सबमिट हो रहा है...", "Submitting...")
                  : t("सत्यापन के लिए भेजें", "Submit for Verification")}
              </span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t("चयनित स्कूल स्टाफ द्वारा BharatPe मिलान के बाद तुरंत रसीद", "Instant receipt once staff verifies BharatPe")}</span>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
