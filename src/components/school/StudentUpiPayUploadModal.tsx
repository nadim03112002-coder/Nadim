import React, { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { UpiPaymentProofRecord } from "../../school-types";
import { saveUpiPaymentProof } from "../../school-firebase";
import { compressImageToBlob } from "../../services/imgbbService";
import { uploadToCloudinary } from "../../services/cloudinaryService";
import { pickLang, useAppLang } from "../../utils/appLang";

interface StudentUpiPayUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  sessionId?: string;
  schoolName: string;
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
  razorpayEnabled?: boolean;
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

export const StudentUpiPayUploadModal: React.FC<StudentUpiPayUploadModalProps> = ({
  isOpen,
  onClose,
  schoolId,
  sessionId,
  schoolName,
  upiId,
  student,
  month,
  monthLabel,
  exactAmount,
  razorpayEnabled = false,
  onSwitchToRazorpay,
  onSubmitted,
}) => {
  const [lang] = useAppLang();
  const t = (hi: string, en: string) => pickLang(lang, hi, en);

  const [utrNumber, setUtrNumber] = useState("");
  const [note, setNote] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUtrNumber("");
      setNote("");
      setScreenshotUrl("");
      setErrorMsg(null);
      setCopiedUpi(false);
      setSubmitting(false);
      setUploadingImg(false);
    }
  }, [isOpen, month, student?.id]);

  if (!isOpen) return null;

  const cleanUpi = String(upiId || "").trim();
  const lockedAmount = Math.max(0, Math.round(Number(exactAmount) || 0));
  const txnNote = `${student.name} ${monthLabel} Fee`.slice(0, 50);
  const upiUri = cleanUpi
    ? `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(
        (schoolName || "School").slice(0, 40)
      )}${lockedAmount > 0 ? `&am=${lockedAmount}` : ""}&cu=INR&tn=${encodeURIComponent(txnNote)}`
    : "";

  const handleCopyUpi = async () => {
    if (!cleanUpi) return;
    try {
      await navigator.clipboard.writeText(cleanUpi);
      setCopiedUpi(true);
      toast.success(t(`UPI ID कॉपी हो गई: ${cleanUpi}`, `UPI ID copied: ${cleanUpi}`));
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      toast.error(t("कॉपी नहीं हो सका, कृपया मैन्युअल लिखें", "Could not copy UPI ID"));
    }
  };

  const handleSelectScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploadingImg(true);
    try {
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
    const cleanUtr = utrNumber.trim().toUpperCase().replace(/\s+/g, "");
    if (cleanUtr.length < 6) {
      setErrorMsg(
        t(
          "कृपया कम से कम 6 अंकों का सही UTR / Transaction Ref No. दर्ज करें।",
          "Please enter a valid UTR / Transaction Reference Number (at least 6 characters)."
        )
      );
      return;
    }
    if (!screenshotUrl) {
      setErrorMsg(
        t(
          "कृपया भुगतान स्क्रीनशॉट अपलोड करें।",
          "Please upload the payment screenshot first."
        )
      );
      return;
    }
    setSubmitting(true);
    try {
      const record: UpiPaymentProofRecord = {
        id: `upiproof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        schoolId,
        sessionId: sessionId || "",
        studentId: student.id,
        studentName: student.name,
        fatherName: student.fatherName || "",
        classId: student.classId,
        className: student.className || "",
        rollNo: student.rollNo || "",
        phone: student.phone || "",
        month,
        monthLabel,
        amount: lockedAmount,
        utrNumber: cleanUtr,
        screenshotUrl,
        note: note.trim() || undefined,
        status: "PENDING",
        submittedAt: new Date().toISOString(),
      };
      const res = await saveUpiPaymentProof(record);
      if (!res.ok) {
        setErrorMsg(res.error || t("सबमिट नहीं हो सका", "Submission failed"));
        setSubmitting(false);
        return;
      }
      toast.success(
        t(
          "भुगतान प्रमाण भेज दिया गया है। स्कूल सत्यापन के बाद रसीद मिल जाएगी।",
          "Payment proof submitted! Receipt will be generated after school verification."
        )
      );
      onSubmitted?.(res.record || record);
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
        <div className="sticky top-0 z-10 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {t("UPI QR भुगतान व स्क्रीनशॉट", "UPI QR Pay & Screenshot")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {student.name} · {monthLabel}
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

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* App-Locked Amount Box */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {t("निर्धारित शुल्क राशि (App-Locked)", "Exact Payable Fee (App-Locked)")}
              </span>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5">
                ₹{lockedAmount.toLocaleString("en-IN")}
              </p>
            </div>
            {razorpayEnabled && onSwitchToRazorpay && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToRazorpay();
                }}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>{t("Instant Auto-Receipt", "Instant Razorpay")}</span>
              </button>
            )}
          </div>

          {/* QR Code & UPI ID Section */}
          {cleanUpi ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <QRCode value={upiUri} size={156} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                    {cleanUpi}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer hover:bg-slate-100"
                  >
                    {copiedUpi ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>{t("कॉपी हुआ", "Copied")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{t("कॉपी", "Copy")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <a
                href={upiUri}
                className="w-full min-h-[42px] rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {t(
                    `UPI ऐप खोलें (₹${lockedAmount.toLocaleString("en-IN")} ऑटो-भरा रहेगा)`,
                    `Open UPI App (₹${lockedAmount.toLocaleString("en-IN")} pre-filled)`
                  )}
                </span>
              </a>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
                {t(
                  "भुगतान पूरा होने के बाद नीचे पेमेंट स्क्रीनशॉट और 12 अंकों का UTR नंबर अपलोड करें। स्कूल सत्यापन के तुरंत बाद पक्की रसीद बन जाएगी।",
                  "After paying via any UPI app, upload your payment screenshot and UTR / Ref No. below for 1-click school verification and official receipt."
                )}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              {t(
                "स्कूल का UPI ID अभी प्रोफ़ाइल में दर्ज नहीं है। यदि आपने स्कूल खाते/QR में जमा किया है, तो स्क्रीनशॉट व UTR नीचे अपलोड करें।",
                "School UPI ID is not configured yet. If you have already paid directly to the school account/QR, upload screenshot and UTR below."
              )}
            </div>
          )}

          {/* Screenshot Upload Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
              {t("1. पेमेंट स्क्रीनशॉट अपलोड करें *", "1. Upload Payment Screenshot *")}
            </label>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-950/60 p-4 cursor-pointer transition">
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

          {/* UTR / Reference No. Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
              {t("2. UTR / Transaction Ref No. *", "2. UTR / Transaction Reference No. *")}
            </label>
            <input
              type="text"
              required
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              placeholder={t("जैसे: 432198765432", "e.g. 432198765432")}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Optional Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block">
              {t("टिप्पणी (वैकल्पिक)", "Remark (Optional)")}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("जैसे: PhonePe द्वारा पिताजी ने भेजा", "e.g. Paid via PhonePe by father")}
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
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
              disabled={submitting || uploadingImg}
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
            <span>{t("डुप्लीकेट UTR सुरक्षा सक्रिय", "Duplicate UTR protection enabled")}</span>
          </div>
        </form>
      </div>
    </div>
  );
};
